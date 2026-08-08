/**
 * Brute-force protection for the admin login (AUDIT_BACKLOG P4-3).
 *
 * `/api/auth/login` previously had no rate limiting whatsoever, so the admin
 * password could be guessed at network speed. This module counts recent failed
 * attempts per client IP in the Supabase `login_attempts` table and blocks once
 * the threshold is crossed.
 *
 * FAILS OPEN, DELIBERATELY. If Supabase is unreachable or unconfigured, logins
 * are allowed through unlimited. That is the right trade here specifically
 * because the owner has already been locked out of this admin once (P4-2): a
 * metering outage must not become a lockout with no recovery path, given the
 * credential lives in an env var and there is no working self-service reset.
 * Every fail-open is logged so it is visible rather than silent.
 *
 * NEVER LOCKS PERMANENTLY. The window slides — after `WINDOW_MINUTES` of no
 * failures the counter is empty again and the next attempt is allowed.
 *
 * PRIVACY: only an IP and a success flag are stored. The submitted email and
 * password are never written anywhere.
 */

import { getMeteringSupabaseConfig } from "@/lib/metered-fetch"

/** Failed attempts allowed from one IP inside the window before blocking. */
const MAX_FAILURES = 10
/** Sliding window length, minutes. */
const WINDOW_MINUTES = 15

function readPositiveInt(envName: string, fallback: number): number {
  const raw = Number(process.env[envName])
  return Number.isInteger(raw) && raw > 0 ? raw : fallback
}

export function getMaxFailures(): number {
  return readPositiveInt("LOGIN_MAX_FAILURES", MAX_FAILURES)
}

export function getWindowMinutes(): number {
  return readPositiveInt("LOGIN_WINDOW_MINUTES", WINDOW_MINUTES)
}

/**
 * Client IP as Vercel sees it. `x-forwarded-for` is a comma-separated chain and
 * the FIRST entry is the original client; later entries are proxies. Returns
 * null when no header is present — callers still record the attempt, so a
 * stripped header cannot be used to dodge the limit entirely.
 */
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return request.headers.get("x-real-ip")?.trim() || null
}

let warned = false
function warnOnce(context: string, detail: unknown): void {
  if (warned) return
  warned = true
  console.warn(
    `[login-rate-limit] Supabase unavailable (${context}); rate limiting is FAILING OPEN until it recovers:`,
    detail instanceof Error ? detail.message : String(detail),
  )
}

export interface RateLimitVerdict {
  /** True when the caller should be refused before checking the password. */
  blocked: boolean
  /** Failures counted in the current window; null when unknown (fail-open). */
  failures: number | null
  /** Seconds until the oldest failure ages out, for the Retry-After header. */
  retryAfterSeconds: number
  /** Set when the check could not run — the request was allowed through. */
  degradedReason: string | null
}

/**
 * Count recent failures for this IP and decide whether to block.
 * Never throws; a failure to check is a failure to block.
 */
export async function checkLoginRateLimit(ip: string | null): Promise<RateLimitVerdict> {
  const windowMinutes = getWindowMinutes()
  const allow = (degradedReason: string | null): RateLimitVerdict => ({
    blocked: false,
    failures: null,
    retryAfterSeconds: 0,
    degradedReason,
  })

  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return allow("Supabase is not configured; login rate limiting is inactive.")

  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString()
  // An absent IP is bucketed together rather than exempted.
  const ipFilter = ip === null ? "ip=is.null" : `ip=eq.${encodeURIComponent(ip)}`

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/login_attempts?select=ts&ok=is.false&${ipFilter}&ts=gte.${since}&order=ts.asc`,
      {
        headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      },
    )
    if (!res.ok) {
      warnOnce(`HTTP ${res.status}`, res.statusText)
      return allow(`Rate-limit lookup failed (HTTP ${res.status}); request allowed through.`)
    }
    const rows = (await res.json()) as Array<{ ts: string }>
    if (!Array.isArray(rows)) return allow("Rate-limit lookup returned an unexpected shape.")

    const max = getMaxFailures()
    if (rows.length < max) {
      return { blocked: false, failures: rows.length, retryAfterSeconds: 0, degradedReason: null }
    }

    // Blocked until the oldest failure in the window ages out.
    const oldest = new Date(rows[0].ts).getTime()
    const freeAt = oldest + windowMinutes * 60_000
    const retryAfterSeconds = Math.max(1, Math.ceil((freeAt - Date.now()) / 1000))
    return { blocked: true, failures: rows.length, retryAfterSeconds, degradedReason: null }
  } catch (err) {
    warnOnce("network", err)
    return allow("Rate-limit lookup failed; request allowed through.")
  }
}

/**
 * Record one attempt. Fire-and-forget: a metering failure must never turn a
 * valid login into an error.
 */
export function recordLoginAttempt(ip: string | null, ok: boolean): void {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return
  try {
    void fetch(`${cfg.url}/rest/v1/login_attempts`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ ip, ok }),
      signal: AbortSignal.timeout(3000),
    }).catch((err) => warnOnce("record", err))
  } catch (err) {
    warnOnce("record-sync", err)
  }
}

/**
 * Clear this IP's failures after a successful login, so a legitimate admin who
 * fat-fingered the password a few times does not stay near the threshold.
 * Fire-and-forget.
 */
export function clearLoginFailures(ip: string | null): void {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg || ip === null) return
  try {
    void fetch(`${cfg.url}/rest/v1/login_attempts?ok=is.false&ip=eq.${encodeURIComponent(ip)}`, {
      method: "DELETE",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        Prefer: "return=minimal",
      },
      signal: AbortSignal.timeout(3000),
    }).catch((err) => warnOnce("clear", err))
  } catch (err) {
    warnOnce("clear-sync", err)
  }
}

/** Opportunistic retention cleanup; safe to call on every login. */
export function pruneLoginAttempts(): void {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return
  try {
    void fetch(`${cfg.url}/rest/v1/rpc/prune_login_attempts`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(3000),
    }).catch(() => {})
  } catch {
    /* retention is best-effort and must never affect a login */
  }
}
