/**
 * The shape `/api/panic-euphoria` returns.
 *
 * Split out of `components/panic-euphoria.tsx` (P6-13) unchanged. The nullable
 * component fields are the record of P6-8 and P6-61: two members left the
 * composite and one is display-only, and a null must render an em-dash rather
 * than a mid-scale reading that looks measured.
 */

export interface PanicEuphoriaData {
  overallScore: number
  level: string
  trend: "up" | "down" | "neutral"
  yesterdayChange: number
  lastWeekChange: number
  lastMonthChange: number
  spx: number
  spx200WeekMA: number
  aboveMA: boolean
  latestCitiReading?: number
  latestCitiDate?: string
  ytdAverage?: number
  // 9 Citibank Model Inputs
  // Null until the Quiver off-exchange feed answers (E-8a).
  nyseShortInterest: number | null
  marginDebt: number
  volumeRatio: number
  investorIntelligence: number
  aaiiBullish: number
  // Null when FRED WRMFSL is unavailable — rendered as "—".
  moneyMarketFunds: number | null
  vixMomentumRatio: number
  // Null when FRED (PPIACO / GASREGW) is unavailable — rendered as "—".
  commodityPrices: number | null
  gasPrices: number | null
  // Server-computed scores for percentile-normalized components (P6-14) —
  // the client bars must not recompute these with the old hardcoded ranges.
  // `marginDebt` is `number | null` like its two neighbours, and was typed
  // `number` while the route could already... no: it could NOT, until P6-8 made
  // the score null when FRED is quiet. The type is corrected in the same change
  // that makes it reachable, which is the point — a non-null type is what stops
  // the compiler asking the question, so it has to move with the value.
  componentScores?: { moneyMarketFunds: number | null; marginDebt: number | null; shortInterest: number | null }
}
