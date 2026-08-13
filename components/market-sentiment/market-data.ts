/**
 * The shape `/api/market-sentiment` returns.
 *
 * Split out of `components/market-sentiment.tsx` (P6-13) unchanged. Note how
 * many fields are `number | null`: that is the audit's first rule showing up in
 * a type. A null here means CNN did not supply the component, and the tab's job
 * is to render "NO DATA" rather than a 50 that reads as a real neutral.
 */

export interface MarketData {
  vix: number | null
  /** Real 50-day average of FRED VIXCLS (P6-22). */
  vix50DayMA?: number | null
  vixVs50DayMA: number | null
  putCallRatio: number | null
  marketMomentum: number | null
  stockPriceStrength: number | null
  stockBreadth: number | null
  junkBondSpread: number | null
  safeHavenDemand: number | null
  overallScore: number
  sentiment: string
  // Null when no prior reading exists to derive a direction from (P3-18). The
  // scrape path used to report "neutral" on every request because its own
  // yesterday-change was structurally zero.
  trend: "up" | "down" | "neutral" | null
  // P3-18. Null when the route has no historical point to measure the change
  // FROM. `lastMonthChange`/`lastYearChange` are now always null on both paths:
  // nothing in this route reads a month-ago or year-ago score, and the values
  // that used to appear here were the week-ago score times 1.2 and 2. None of
  // the four is rendered — they reached the UI only through the cache-validity
  // gate below, which is why a fabrication survived every visual sweep.
  yesterdayChange: number | null
  lastWeekChange: number | null
  lastMonthChange: number | null
  lastYearChange: number | null
  volatilitySkew: number | null
  openInterestPutCall: number | null
  vixTermStructure: string | number | null
  cboeSkewIndex: number | null
  usingFallback?: boolean // Added flag to indicate fallback data
  timestamp?: string
  calculationDetails?: {
    // Added for calculation methodology display
    formula: string
    weighting: string
    methodology: string
    individualScores?: {
      i1_marketMomentum: number
      i2_stockStrength: number
      i3_stockBreadth: number
      i4_putCallRatio: number
      i5_marketVolatility: number
      i6_safeHavenDemand: number
      i7_junkBondDemand: number
    }
  }
  dataSourcesUsed?: {
    // Added for data sources display
    primary: string
    nyseData?: string
  }
  cnnComponents?: { score: number | null }[] // Array for CNN's 7 indicators
  unavailableComponents?: string[] // Components CNN did not supply this fetch
  notTracked?: string[] // Indicators with no source at all — a null here is not a fault
  dataSource?: string // Added to fetch and display data source
  score: number // Ensure score is part of the interface for validation
  chartData?: {
    // Added for chart visualization
    spy: number[]
    vix: number[]
    date: string[]
  }
}

