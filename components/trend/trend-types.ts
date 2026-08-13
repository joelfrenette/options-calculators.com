/**
 * The shapes `/api/trend-analysis` returns.
 *
 * Split out of `components/trend-analysis.tsx` (P6-13) unchanged. The nullable
 * fields are load-bearing: P6-68 and P7-6 both came from `?? 0` and `?? 50`
 * defaults here, which printed a flat day, a $0.00 price target and a needle
 * parked on "Neutral" wherever a value was actually missing.
 */

export interface TrendData {
  name: string
  symbol: string
  currentPrice: number
  // Null when the price came from the last stored close rather than a live
  // quote: the previous close is what a change is measured FROM, so a stored
  // close cannot supply its own delta.
  change: number | null
  changePercent: number | null
  historySource?: "store" | "yahoo"
  priceSource?: "yahoo-quote" | "stored-close"
  priceAsOf?: string | null
  ma20: number
  ma50: number
  ma200: number
  rsi: number
  macd: number
  macdSignal: number
  macdHistogram: number
  atr: number
  volumeRatio: number
  // Null when no momentum input was available. The gauge must not fall back to
  // 50 — on this scale 50 is a real NEUTRAL reading, not an absence.
  momentumStrength: number | null
  support: number
  resistance: number
  allSupport: number[]
  allResistance: number[]
  trend: string
  trendConfidence: number
  trendStrength: string
  trendSignals?: { bullish: number; bearish: number; total: number }
  indicatorContributions?: {
    rsi: { value: number | null; contribution: number | null; weight: number }
    macd: { value: number | null; contribution: number | null; weight: number }
    priceChange: { value: number | null; contribution: number | null; weight: number }
    volumeTrend: { value: number | null; contribution: number | null; weight: number }
  }
  // The weekly target scales by momentum, so it is withheld when momentum is
  // unknown rather than computed from a stand-in.
  priceTarget1Week: number | null
  priceTarget1Month: number
  stopLoss: number
  targetConfidence: number | null
  historicalData: {
    date: string
    price: number | null
    ma20: number | null
    ma50: number | null
    ma200: number | null
    bollingerUpper: number | null
    bollingerLower: number | null
    forecast?: number
    support: number
    resistance: number
  }[]
}

export interface TrendAnalysisData {
  indices: TrendData[]
  lastUpdated: string
}

/**
 * One momentum contribution, rendered null-aware.
 *
 * Replaces four near-identical blocks that each assumed `value` and
 * `contribution` were numbers. They are nullable now: an indicator with no data
 * contributes nothing, and "nothing" must not render as `0.0 / +0.0 pts`, which
 * reads as a measured flat reading rather than an absent one. Same reason the
 * momentum gauge no longer falls back to 50.
 */
