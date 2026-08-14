// Sentiment interpretation buckets
export function getSentimentLabel(score: number): string {
  if (score >= 80) return "Extreme Bullish"
  if (score >= 60) return "Bullish"
  if (score >= 40) return "Neutral"
  if (score >= 20) return "Bearish"
  return "Extreme Bearish"
}

/**
 * Formats a score for prose and for the AI context string. A missing score
 * renders as "no data" — never as a number, and never as 50.
 */
export function fmtScore(score: number | null | undefined): string {
  return score == null || Number.isNaN(score) ? "no data" : `${Math.round(score)}/100`
}

/**
 * A source count the response actually reported, or an em dash.
 *
 * P7-6. `sources_available ?? 0` / `sources_total ?? 0` rendered "0/0 sources
 * responded" — and put the same string into the AI prompt at the point where
 * the prompt is explaining that no reading exists. A denominator of zero is not
 * a measurement of anything; "how many sources are there" and "how many
 * answered" are different unknowns and neither is 0.
 */
export function srcCount(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? String(n) : "—"
}

// NOTE: safeNumber is for RAW COUNTS only (StockTwits bullish/bearish tags,
// where the row already declares "No live data" beside them). It used to back
// the gauge needles at a fallback of 50, which drew an unmeasured "Neutral" —
// those now hide instead. Never use it for a score or for a branch that
// produces advice.
export function safeNumber(value: number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined || isNaN(value)) {
    return fallback
  }
  return value
}

export function getSentimentInterpretation(score: number): string {
  if (score >= 75) return "Very high optimism - consider contrarian bearish positions"
  if (score >= 60) return "Bullish sentiment - momentum favors long positions"
  if (score >= 45) return "Neutral - market lacks clear direction"
  if (score >= 30) return "Bearish sentiment - caution on long positions"
  return "Extreme pessimism - contrarian bullish opportunity possible"
}
