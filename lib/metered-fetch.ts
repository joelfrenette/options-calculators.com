// Real per-call API metering (AUDIT_BACKLOG S-19).
//
// `meteredFetch` is a mechanical wrapper around `fetch` that records one
// {provider, route, status, ms, ts, ok} row per outbound call. It NEVER
// changes the behavior of the wrapped call: the init object is passed
// through untouched (minus the metering-only `routeTag` field), the
// Response is returned as-is, and errors are rethrown unchanged after
// being recorded.
//
// Storage tiers:
//   1. Supabase (durable) — when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
//      (or SUPABASE_ANON_KEY) are set, every call is POSTed fire-and-forget
//      to the `api_calls` table via Supabase REST. Failures are swallowed
//      after a single console.warn per instance; the wrapped call is never
//      blocked or failed by metering. See supabase/migrations/0001_api_calls.sql.
//   2. In-memory ring buffer (ALWAYS on) — capped at 2000 entries, exposed via
//      getRecentCalls() / getCallStats().
//
// IMPORTANT — the in-memory tier is PER-INSTANCE and EPHEMERAL on serverless:
// on Vercel each lambda/edge isolate has its own buffer, which resets on every
// cold start and is not shared across instances. It is an indicative signal,
// not an accounting record. Durable accounting requires the Supabase tier.
//
// This module is edge-runtime safe (no Node-only imports).

import { estimateAiCallCost } from "@/lib/api-costs"

export interface MeteredCall {
  provider: string
  /** Calling route (from init.routeTag), or null when the caller didn't tag. */
  route: string | null
  /** HTTP status of the wrapped call; 0 when the fetch threw (timeout/network). */
  status: number
  /** Wall-clock duration of the wrapped call in ms. */
  ms: number
  /** ISO timestamp of when the call completed (or threw). */
  ts: string
  ok: boolean
  // --- LLM calls only (recordAiCall); null/undefined for plain fetches. ---
  /** Exact model id requested. */
  model?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  /** Estimated marginal USD. NULL means unpriced — never treat it as free. */
  costUsd?: number | null
  /** False when the model had no price on file. */
  costKnown?: boolean | null
}

export interface ProviderCallStats {
  count: number
  avgMs: number
  /** Fraction of calls with ok === false, 0..1. */
  errorRate: number
  /** ISO timestamp of the most recent call, or null. */
  lastTs: string | null
}

const RING_CAP = 2000
const ring: MeteredCall[] = []

// Warn at most once per instance when the Supabase tier fails, then go quiet:
// metering must never spam logs or affect the wrapped call.
let supabaseWarned = false

function warnSupabaseOnce(context: string, detail: unknown): void {
  if (supabaseWarned) return
  supabaseWarned = true
  console.warn(
    `[metered-fetch] Supabase metering write failed (${context}); further failures will be silent:`,
    detail instanceof Error ? detail.message : String(detail),
  )
}

function getSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) return null
  return { url: url.replace(/\/+$/, ""), key }
}

/** True when the durable Supabase tier is configured (SUPABASE_URL + a key). */
export function isSupabaseMeteringConfigured(): boolean {
  return getSupabaseConfig() !== null
}

/**
 * Shared Supabase REST config, exported so lib/budget-guard.ts reads the ledger
 * through the same resolution as the writer. Duplicating the env lookup would
 * let the guard and the meter disagree about whether metering is even on.
 */
export function getMeteringSupabaseConfig(): { url: string; key: string } | null {
  return getSupabaseConfig()
}

/** Fire-and-forget durable write. Never throws, never blocks the caller. */
function persistToSupabase(call: MeteredCall): void {
  const cfg = getSupabaseConfig()
  if (!cfg) return
  try {
    void fetch(`${cfg.url}/rest/v1/api_calls`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        ts: call.ts,
        provider: call.provider,
        route: call.route,
        status: call.status,
        ms: call.ms,
        ok: call.ok,
        model: call.model ?? null,
        input_tokens: call.inputTokens ?? null,
        output_tokens: call.outputTokens ?? null,
        cost_usd: call.costUsd ?? null,
        cost_known: call.costKnown ?? null,
      }),
      signal: AbortSignal.timeout(3000),
    })
      .then((res) => {
        if (!res.ok) warnSupabaseOnce(`HTTP ${res.status}`, res.statusText)
      })
      .catch((err) => warnSupabaseOnce("network", err))
  } catch (err) {
    warnSupabaseOnce("sync", err)
  }
}

function record(call: MeteredCall): void {
  ring.push(call)
  if (ring.length > RING_CAP) ring.splice(0, ring.length - RING_CAP)
  persistToSupabase(call)
}

/**
 * Drop-in fetch wrapper that meters the call.
 *
 * @param provider canonical lowercase provider tag ("polygon", "finnhub", "fmp", ...)
 * @param url      passed to fetch unchanged
 * @param init     passed to fetch unchanged, except the metering-only `routeTag`
 *                 field is stripped first. Timeout signals and Next.js `next`
 *                 cache options survive intact.
 */
export async function meteredFetch(
  provider: string,
  url: string,
  init?: RequestInit & { routeTag?: string },
): Promise<Response> {
  let passthrough: RequestInit | undefined = init
  let route: string | null = null
  if (init && "routeTag" in init) {
    const { routeTag, ...rest } = init
    route = routeTag ?? null
    passthrough = rest
  }

  const started = Date.now()
  try {
    const response = await fetch(url, passthrough)
    record({
      provider,
      route,
      status: response.status,
      ms: Date.now() - started,
      ts: new Date().toISOString(),
      ok: response.ok,
    })
    return response
  } catch (error) {
    record({
      provider,
      route,
      status: 0,
      ms: Date.now() - started,
      ts: new Date().toISOString(),
      ok: false,
    })
    throw error
  }
}

// ------------------------------------------------------- LLM metering (E-5)
//
// LLM calls go through the Vercel AI SDK, not fetch(), so `meteredFetch` never
// sees them — which left the ledger blind to the only providers that bill per
// use. `recordAiCall` is the equivalent entry point for them: same table, same
// fire-and-forget contract, plus token counts and an estimated cost.

/** Token usage as reported by the AI SDK. Fields are optional — some providers omit them. */
export interface AiUsage {
  inputTokens?: number
  outputTokens?: number
}

/**
 * Record one LLM call. Never throws: metering must not be able to break a
 * generation. Cost is estimated from lib/api-costs.ts list prices; an unknown
 * model yields costUsd=null / costKnown=false rather than a $0 that would
 * quietly understate spend.
 */
export function recordAiCall(args: {
  /** Provider name from lib/ai-providers.ts ("openai", "anthropic", "xai", ...). */
  provider: string
  model: string
  route: string | null
  ms: number
  ok: boolean
  usage?: AiUsage | null
}): void {
  try {
    const inputTokens = Number.isFinite(args.usage?.inputTokens) ? (args.usage!.inputTokens as number) : null
    const outputTokens = Number.isFinite(args.usage?.outputTokens) ? (args.usage!.outputTokens as number) : null

    // No token counts means no defensible cost. Say so rather than guessing —
    // and mark it unpriced so the guard counts it as unaccounted, not free.
    let costUsd: number | null = null
    let costKnown = false
    if (inputTokens !== null || outputTokens !== null) {
      const estimate = estimateAiCallCost(args.model, inputTokens ?? 0, outputTokens ?? 0)
      costUsd = estimate.usd
      costKnown = !estimate.unpriced
    }

    record({
      provider: args.provider,
      route: args.route,
      // Not an HTTP call from our side; the SDK owns the transport. 200/0
      // mirrors the ok/failed convention the rest of the ledger uses.
      status: args.ok ? 200 : 0,
      ms: args.ms,
      ts: new Date().toISOString(),
      ok: args.ok,
      model: args.model,
      inputTokens,
      outputTokens,
      costUsd,
      costKnown,
    })
  } catch (err) {
    warnSupabaseOnce("recordAiCall", err)
  }
}

/**
 * Recent metered calls, oldest first (copy of the ring buffer, ≤ 2000 rows).
 * PER-INSTANCE / EPHEMERAL on serverless — see module header.
 */
export function getRecentCalls(): MeteredCall[] {
  return ring.map((c) => ({ ...c }))
}

/**
 * Per-provider aggregates over the ring buffer.
 * PER-INSTANCE / EPHEMERAL on serverless — see module header.
 */
export function getCallStats(): Record<string, ProviderCallStats> {
  const acc: Record<string, { count: number; totalMs: number; errors: number; lastTs: string | null }> = {}
  for (const call of ring) {
    const entry = (acc[call.provider] ??= { count: 0, totalMs: 0, errors: 0, lastTs: null })
    entry.count += 1
    entry.totalMs += call.ms
    if (!call.ok) entry.errors += 1
    if (entry.lastTs === null || call.ts > entry.lastTs) entry.lastTs = call.ts
  }
  const stats: Record<string, ProviderCallStats> = {}
  for (const [provider, e] of Object.entries(acc)) {
    stats[provider] = {
      count: e.count,
      avgMs: e.count > 0 ? Math.round(e.totalMs / e.count) : 0,
      errorRate: e.count > 0 ? Math.round((e.errors / e.count) * 1000) / 1000 : 0,
      lastTs: e.lastTs,
    }
  }
  return stats
}

export interface DailyRollupRow {
  day: string
  provider: string
  calls: number
  avg_ms: number | null
  errors: number
}

export interface MonthlyUsageRow {
  /** First day of the month, YYYY-MM-DD (date_trunc('month', ts)). */
  month: string
  provider: string
  calls: number
  /** Priced marginal USD (LLM rows only); 0 for flat-rate data providers. */
  cost_usd: number
  /** Calls whose model had no price on file — never summed into cost_usd. */
  unpriced_calls: number
}

/**
 * Per-month, per-provider rollup from the Supabase `api_usage_monthly` view
 * (durable tier, migration 0014). Returns null when Supabase is not configured,
 * the query fails, OR the view does not exist yet (migration not applied) — the
 * caller renders an empty table in that case rather than erroring.
 */
export async function getSupabaseMonthlyByProvider(months = 6): Promise<MonthlyUsageRow[] | null> {
  const cfg = getSupabaseConfig()
  if (!cfg) return null
  try {
    const limit = Math.max(1, months) * 25 // generous: up to ~25 providers per month
    const res = await fetch(
      `${cfg.url}/rest/v1/api_usage_monthly?select=month,provider,calls,cost_usd,unpriced_calls&order=month.desc,provider.asc&limit=${limit}`,
      {
        headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      },
    )
    if (!res.ok) {
      warnSupabaseOnce(`monthly HTTP ${res.status}`, res.statusText)
      return null
    }
    const rows = await res.json()
    return Array.isArray(rows) ? (rows as MonthlyUsageRow[]) : null
  } catch (err) {
    warnSupabaseOnce("monthly", err)
    return null
  }
}

/**
 * Daily rollup from the Supabase `api_calls_daily` view (durable tier).
 * Returns null when Supabase is not configured or the query fails —
 * callers fall back to the in-memory stats.
 */
export async function getSupabaseDailyRollup(days = 30): Promise<DailyRollupRow[] | null> {
  const cfg = getSupabaseConfig()
  if (!cfg) return null
  try {
    const limit = Math.max(1, days) * 10 // generous: up to 10 providers per day
    const res = await fetch(
      `${cfg.url}/rest/v1/api_calls_daily?select=day,provider,calls,avg_ms,errors&order=day.desc&limit=${limit}`,
      {
        headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      },
    )
    if (!res.ok) {
      warnSupabaseOnce(`rollup HTTP ${res.status}`, res.statusText)
      return null
    }
    const rows = await res.json()
    return Array.isArray(rows) ? (rows as DailyRollupRow[]) : null
  } catch (err) {
    warnSupabaseOnce("rollup", err)
    return null
  }
}
