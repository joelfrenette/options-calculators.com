/**
 * Quiver Quantitative congressional-trading client — AUDIT_BACKLOG P6-1.
 *
 * WHAT WAS WRONG. Three routes (/api/congress-trades, /api/politician-spotlight,
 * /api/top-performers) each called Quiver's endpoint directly with no
 * credential — just a User-Agent header. Quiver answers 401. All three then
 * told the user:
 *
 *     "Quiver Quant rate-limited briefly. Try again in a moment."
 *
 * A 401 is not a rate limit and no amount of trying again will fix it. Three
 * public tabs invited users to retry forever against a permanent auth failure,
 * and the health check reported three separate route failures for what is one
 * missing key. Both are corrected here: the credential is sent when configured,
 * and each upstream status is described as what it actually is.
 *
 * The key resolves through lib/api-keys.ts like every other, so DISABLED_APIS
 * and the budget guard apply. Calls go through meteredFetch so they land in the
 * ledger.
 */

import { resolveApiKey } from "@/lib/api-keys"
import { meteredFetch } from "@/lib/metered-fetch"

const QUIVER_URL = "https://api.quiverquant.com/beta/live/congresstrading"

export type QuiverFailure =
  /** No QUIVER_API_KEY configured. Not an outage — the feature is unconfigured. */
  | { kind: "not-configured"; httpStatus: 503; message: string; transient: false }
  /** Quiver rejected the credential. Permanent until the key or plan is fixed. */
  | { kind: "unauthorized"; httpStatus: 502; upstreamStatus: number; message: string; transient: false }
  /** Genuinely transient — retrying later is the correct advice. */
  | { kind: "rate-limited"; httpStatus: 429; upstreamStatus: number; message: string; transient: true }
  /** Anything else upstream returned, or a malformed payload. */
  | { kind: "upstream"; httpStatus: 502; upstreamStatus: number | null; message: string; transient: false }

export type QuiverResult<T> = { ok: true; data: T } | ({ ok: false } & QuiverFailure)

/** True when a Quiver credential is available (respects DISABLED_APIS + guard). */
export function isQuiverConfigured(): boolean {
  return resolveApiKey("QUIVER_API_KEY").length > 0
}

/**
 * Fetch the live congressional-trading feed.
 *
 * @param routeTag calling route, recorded with the metered call.
 */
export async function fetchCongressTrading(routeTag: string): Promise<QuiverResult<unknown[]>> {
  const apiKey = resolveApiKey("QUIVER_API_KEY")

  if (!apiKey) {
    return {
      ok: false,
      kind: "not-configured",
      httpStatus: 503,
      message:
        "Congressional trading data is unavailable: no Quiver Quantitative API key is configured. " +
        "This is a configuration gap, not an outage — retrying will not help.",
      transient: false,
    }
  }

  let res: Response
  try {
    res = await meteredFetch("quiver", QUIVER_URL, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "options-calculators.com contact@options-calculators.com",
      },
      // Hourly cache; the underlying disclosures update infrequently.
      next: { revalidate: 3600 },
      routeTag,
    })
  } catch (err) {
    return {
      ok: false,
      kind: "upstream",
      httpStatus: 502,
      upstreamStatus: null,
      message: `Could not reach Quiver Quantitative: ${err instanceof Error ? err.message : String(err)}`,
      transient: false,
    }
  }

  if (!res.ok) {
    // The distinction that was missing. 401/403 mean the credential is wrong,
    // absent, or the plan does not cover this endpoint — permanent until
    // someone changes something. Only 429 justifies "try again".
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        kind: "unauthorized",
        httpStatus: 502,
        upstreamStatus: res.status,
        message:
          `Quiver Quantitative rejected our credentials (HTTP ${res.status}). ` +
          "The API key is missing, invalid, or the plan does not include this endpoint. " +
          "This will not resolve on its own.",
        transient: false,
      }
    }
    if (res.status === 429) {
      return {
        ok: false,
        kind: "rate-limited",
        httpStatus: 429,
        upstreamStatus: 429,
        message: "Quiver Quantitative rate-limited this request. Try again in a moment.",
        transient: true,
      }
    }
    return {
      ok: false,
      kind: "upstream",
      httpStatus: 502,
      upstreamStatus: res.status,
      message: `Quiver Quantitative returned HTTP ${res.status}.`,
      transient: false,
    }
  }

  let data: unknown
  try {
    data = await res.json()
  } catch (err) {
    return {
      ok: false,
      kind: "upstream",
      httpStatus: 502,
      upstreamStatus: res.status,
      message: `Quiver Quantitative returned a body that is not JSON: ${err instanceof Error ? err.message : String(err)}`,
      transient: false,
    }
  }

  if (!Array.isArray(data)) {
    return {
      ok: false,
      kind: "upstream",
      httpStatus: 502,
      upstreamStatus: res.status,
      message: "Quiver Quantitative returned an unexpected payload shape (expected an array).",
      transient: false,
    }
  }

  return { ok: true, data }
}
