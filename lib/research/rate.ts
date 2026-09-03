// Research Queue — the RATE step (RESEARCH_QUEUE_DESIGN.md).
//
// A deterministic directional rating from the computed trend, so the input to
// strategy selection is auditable rather than an LLM opinion. The optional Opus 5
// "portfolio manager" narrative pass is a Phase-3 toggle; this is the default.
//
// Per the design, the rating is a technical read (price vs 200-DMA + trailing
// return). Fundamentals and the CCPI market-regime tilt are noted as future
// inputs; ratingBasis always states exactly what drove THIS rating, so the
// label never over-claims.

import type { PortfolioRating } from "./types"
import type { ComputedNumbers } from "./compute"

export function rateTicker(n: ComputedNumbers): { rating: PortfolioRating; basis: string } {
  const { price, sma200, return12mPct } = n

  if (price === null || sma200 === null || return12mPct === null) {
    return {
      rating: "Hold",
      basis: "insufficient price history to rate the trend — treated as Hold, not a directional call",
    }
  }

  const aboveSma = price > sma200
  const smaGapPct = ((price - sma200) / sma200) * 100

  if (aboveSma && return12mPct >= 15) {
    return { rating: "Buy", basis: `uptrend: +${return12mPct.toFixed(0)}% on the year, ${smaGapPct.toFixed(0)}% above the 200-DMA` }
  }
  if (aboveSma && return12mPct >= 0) {
    return { rating: "Overweight", basis: `constructive: +${return12mPct.toFixed(0)}% on the year, above the 200-DMA` }
  }
  if (return12mPct <= -25) {
    return { rating: "Sell", basis: `deep downtrend: ${return12mPct.toFixed(0)}% on the year — a falling knife, not a pullback` }
  }
  if (!aboveSma) {
    return { rating: "Underweight", basis: `below the 200-DMA (${smaGapPct.toFixed(0)}%), ${return12mPct.toFixed(0)}% on the year — a pullback to watch, not chase` }
  }
  return { rating: "Hold", basis: `mixed: ${return12mPct.toFixed(0)}% on the year, hovering around the 200-DMA` }
}
