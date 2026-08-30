// Observed AI provider liveness, read from the ledger — never probed.
//
// WHY THIS EXISTS. The admin AI tab reports `willBeTried: p.hasKey`: whether a
// key RESOLVES, not whether the provider ANSWERS. The route is honest about it
// ("key presence only — no AI provider was called"), and it is still not the
// question a reader is asking when they look at a provider list. Between
// 2026-08-08 and 2026-08-30 xAI failed 401 times out of 401 while the panel
// showed it configured and first in the chain. A resolvable key and a working
// provider are different facts; only one of them was on screen.
//
// WHY IT DOES NOT PROBE. Every AI endpoint the app calls is a chat completion,
// which spends tokens. A liveness probe on an admin page load would bill the
// owner for the privilege of rendering a status light, and would make the panel
// itself the top consumer. Everything here comes from rows the app already
// wrote for real work — the `api_provider_health` view (migration 0016).
//
// Reads the ledger through `getMeteringSupabaseConfig()`, the same resolution
// the writer uses, so the panel and the meter cannot disagree about whether
// metering is even on.

import { getMeteringSupabaseConfig } from "@/lib/metered-fetch"

export interface ProviderHealth {
  provider: string
  calls: number
  okCalls: number
  failedCalls: number
  lastOk: string | null
  lastFailure: string | null
  /**
   * Dominant failure cause over the window, or null. NULL means NOT RECORDED —
   * rows written before migration 0015 carry no cause — and must never be
   * rendered as "fine". See lib/ai-error-class.ts for the classes.
   */
  topErrorClass: string | null
}

export interface ProviderHealthReport {
  /** Trailing window the view covers, in days. Matches migration 0016. */
  windowDays: 7
  /** Keyed by canonical provider tag. Empty when the ledger is unreadable. */
  byProvider: Record<string, ProviderHealth>
  /**
   * Why there is no data, when there is none. Non-null here means "we could not
   * look", which the UI must distinguish from "we looked and saw no calls".
   */
  unavailableReason: string | null
}

function empty(reason: string): ProviderHealthReport {
  return { windowDays: 7, byProvider: {}, unavailableReason: reason }
}

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Read observed liveness for every AI provider that has been called in the
 * trailing window. Providers with no calls are simply absent — that is "never
 * tried", which the caller must not collapse into "broken".
 */
export async function getAiProviderHealth(): Promise<ProviderHealthReport> {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) {
    return empty("Supabase metering is not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).")
  }

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/api_provider_health` +
        `?select=provider,calls,ok_calls,failed_calls,last_ok,last_failure,top_error_class`,
      {
        headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    )
    if (!res.ok) {
      return empty(`Supabase provider-health query failed: HTTP ${res.status} ${res.statusText}`)
    }
    const body: unknown = await res.json()
    if (!Array.isArray(body)) return empty("Supabase provider-health query returned an unexpected shape.")

    const byProvider: Record<string, ProviderHealth> = {}
    for (const raw of body as Record<string, unknown>[]) {
      const provider = typeof raw.provider === "string" ? raw.provider : null
      if (!provider) continue
      byProvider[provider] = {
        provider,
        calls: toNumber(raw.calls),
        okCalls: toNumber(raw.ok_calls),
        failedCalls: toNumber(raw.failed_calls),
        lastOk: typeof raw.last_ok === "string" ? raw.last_ok : null,
        lastFailure: typeof raw.last_failure === "string" ? raw.last_failure : null,
        topErrorClass: typeof raw.top_error_class === "string" ? raw.top_error_class : null,
      }
    }
    return { windowDays: 7, byProvider, unavailableReason: null }
  } catch (err) {
    return empty(`Supabase provider-health query failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Observed verdict for one provider.
 *
 * The three states are deliberately not two. "Never called in this window" is
 * NOT healthy and NOT broken — collapsing it into either is how a dead provider
 * reads as fine, and how an unused one reads as an incident.
 */
export type ObservedState = "working" | "failing" | "degraded" | "untried" | "unknown"

export function observedState(h: ProviderHealth | undefined, unavailable: boolean): ObservedState {
  if (unavailable) return "unknown"
  if (!h || h.calls === 0) return "untried"
  if (h.okCalls === 0) return "failing"
  if (h.failedCalls === 0) return "working"
  return "degraded"
}
