// Beta for a ticker, from the stored close history (P7-21).
//
// Splits the FETCHING from the ARITHMETIC: `lib/beta.ts` is import-free so a
// check script can assert the regression, and this file — which touches the
// store and therefore cannot be loaded by one — does nothing but read closes
// and hand them over. The import graph decides what can be tested (P6-85), so
// the boundary is drawn deliberately rather than where it fell.

import { getStoredCloses } from "./market-closes"
import { computeBeta, DEFAULT_BETA_WINDOW_DAYS, type BetaResult } from "./beta"

/** The benchmark every beta on this site is measured against. */
export const BETA_BENCHMARK = "SPY"

/**
 * Minimum paired observations. ~120 trading days is roughly six months; below
 * that the standard error on the slope is wide enough that the number would be
 * decoration. `computeBeta` returns null rather than a small beta.
 */
const MIN_OBSERVATIONS = 120

/**
 * Betas for several tickers against SPY, from stored closes.
 *
 * Returns a map of ticker → BetaResult | null. **Null means "not computable
 * here", never 0.7** — the constant this replaces. A caller that needs a number
 * has to decide what to do with an absence rather than inheriting one.
 *
 * The benchmark is fetched once for the whole batch: it is the same series for
 * every ticker, and the previous shape of this problem (P6-8's margin proxy)
 * came from a per-item fallback nobody could see.
 */
export async function betasForTickers(
  tickers: string[],
  windowDays: number = DEFAULT_BETA_WINDOW_DAYS,
): Promise<Record<string, BetaResult | null>> {
  const out: Record<string, BetaResult | null> = {}
  for (const t of tickers) out[t] = null

  const benchmark = await getStoredCloses(BETA_BENCHMARK, windowDays, MIN_OBSERVATIONS + 1)
  if (!benchmark) {
    // No benchmark, no betas — and the whole batch is null rather than some
    // tickers silently keeping a stale value.
    console.log(`[v0] beta: ${BETA_BENCHMARK} history unavailable — every beta is null this request`)
    return out
  }

  for (const ticker of tickers) {
    if (ticker === BETA_BENCHMARK) {
      // Trivially 1.0, and computing it would spend a query to say so.
      out[ticker] = {
        beta: 1,
        observations: benchmark.length - 1,
        rSquared: 1,
        from: benchmark[0]?.day ?? "",
        to: benchmark[benchmark.length - 1]?.day ?? "",
      }
      continue
    }
    const closes = await getStoredCloses(ticker, windowDays, MIN_OBSERVATIONS + 1)
    out[ticker] = closes ? computeBeta(closes, benchmark, MIN_OBSERVATIONS) : null
  }

  return out
}
