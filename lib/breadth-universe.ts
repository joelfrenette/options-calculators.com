/**
 * Breadth universe — E-6a.
 *
 * ~100 largest, most liquid US large-caps (S&P 100-style membership). Breadth
 * is computed as the % of THIS list above its own 200-DMA.
 *
 * MAINTAINED CONSTANT, AND LABELED AS ONE. Index membership drifts a few names
 * a year; that drift is immaterial to a breadth divergence signal, but the
 * as-of date below travels with the data so nobody mistakes the list for a
 * live constituent feed. Review roughly quarterly.
 *
 * This is a UNIVERSE DEFINITION, not market data — a fixed membership list is
 * the standard construction for breadth indicators (e.g. S5TH/OEXA200R are
 * "% of S&P constituents above 200-DMA" against defined membership).
 *
 * THE LIST IS 99 NAMES, AND THAT IS THE HONEST NUMBER (P7-39/P7-40, closed
 * 2026-08-13 on the owner's decision).
 *
 * MMC was delisted — Polygon has 404'd it since 2026-01-13, with 1,111 stored
 * rows that can never be extended. It was kept in the list on purpose for a
 * while, because removing it changes what the breadth percentage is a
 * percentage OF, and that is a real cost. But keeping it did not avoid the
 * change; it only hid it: the daily job could not fetch a close for MMC, so
 * `sample_size` had already been reading **99 against a universe_size of 100**
 * on every row since January. The denominator had moved months ago and the
 * constant was the only thing still saying otherwise.
 *
 * **A stale constant does not preserve a denominator, it just stops the
 * denominator being visible.** The owner's call was to drop to 99 and say so,
 * rather than substitute a hand-picked name — a curated replacement would be a
 * judgement rendered inside a number labelled as index breadth, and no
 * market-cap-ranked source is available on this plan to make it anything else.
 *
 * `universeSize` is derived from this array's length everywhere it is
 * published, so the tab now states 99 and `sample_size` can reach it.
 */

export const BREADTH_UNIVERSE_AS_OF = "2026-08"

/**
 * Names removed from the universe and why, so a shrinking list cannot be
 * mistaken for an editing accident. `scripts/check-breadth-universe.ts`
 * asserts the size against this record rather than against a bare number.
 */
export const BREADTH_UNIVERSE_REMOVED: { ticker: string; reason: string; since: string }[] = [
  { ticker: "MMC", reason: "delisted — Polygon 404 since 2026-01-13, 1,111 stored rows unrepairable", since: "2026-01-13" },
]

export const BREADTH_UNIVERSE: string[] = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "BRK.B", "JPM",
  "V", "UNH", "XOM", "LLY", "MA", "HD", "PG", "COST", "JNJ", "ABBV",
  "BAC", "CRM", "KO", "MRK", "CVX", "WMT", "PEP", "TMO", "ORCL", "AMD",
  "ACN", "MCD", "ABT", "CSCO", "ADBE", "PM", "WFC", "IBM", "GE", "TXN",
  "QCOM", "DHR", "INTU", "CAT", "VZ", "AMGN", "PFE", "NEE", "CMCSA", "UNP",
  "LOW", "RTX", "SPGI", "HON", "T", "COP", "BLK", "NFLX", "BA", "UPS",
  "SCHW", "AXP", "MS", "GS", "DE", "ELV", "LMT", "BKNG", "SYK", "ADI",
  "PLD", "MDT", "TJX", "GILD", "VRTX", "C", "CB", "SBUX", "MO",
  "AMT", "ISRG", "SO", "PGR", "REGN", "DUK", "ZTS", "CI", "BMY", "TGT",
  "USB", "APD", "CL", "EMR", "FDX", "NSC", "BSX", "ITW", "ETN", "AON",
]
