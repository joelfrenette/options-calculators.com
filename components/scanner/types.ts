// Shared types for the Sell Put (Wheel) Scanner.
// Extracted verbatim from components/wheel-scanner.tsx (Phase 4 modularization — zero behavior change).

export interface QualifyingStock {
  ticker: string
  currentPrice: number
  peRatio: number | null // null when neither EPS nor a complete TTM supports it
  avgVolume: number
  last4EPS: number[] | null // the four REAL quarters, or null — never synthesised
  // Indicator fields are null when the price history is too short to compute
  // them (lib/indicators.ts contract) — gates fail-safe and the UI shows ✗/—,
  // never a fabricated 0. Kills the false Golden Cross on IPOs (FORMULAS.md §1).
  sma50: number | null
  sma100: number | null
  sma200: number | null
  uptrend: boolean // false when either SMA is null ("unknown" never passes the golden-cross gate)
  rsi: number | null
  bollingerPosition: string // "Below" | "Lower Half" | "Upper Half" | "—" (insufficient history)
  macdSignal: string // "Bullish" | "Bearish" | "—" (insufficient history)
  stochastic: number | null
  atr: number | null
  atrPercent: number
  putStrike: number
  premium?: number // This will be updated with real option premium
  yield: number // This will be updated with real option yield
  delta: number
  deltaSource?: "polygon" | "calculated" | "estimated" // Track source of delta
  // Where premium/bid/ask actually came from. `synthesized` means no quote was
  // available and the numbers were computed from a fixed 35% IV assumption —
  // the tables MUST show that, because a synthesized yield looks exactly like a
  // measured one and the default sort is by yield.
  priceSource?: "last_quote" | "last_trade" | "day_data" | "synthesized"
  // Billions. Null when shares outstanding and a complete TTM are both
  // missing — never 0, which rendered as a confident "$0.0B".
  marketCap: number | null
  redDay: boolean
  earningsDate?: string
  daysToEarnings?: number
  expectedMove?: number // This will be updated with expected move from IV
  volume: number // Added volume field
  roe: number | null // Return on Equity %, null when the TTM is incomplete
  debtToEquity: number | null // null when equity is unknown — 0 read as "no debt"
  /** How many of the four TTM quarters actually reported. 4 = a real year. */
  ttmQuarters?: number
  expiryDate?: string // Options expiration date
  daysToExpiry?: number // Days until option expiration
  annualizedYield?: number // Annualized yield percentage

  // Added fields for enriched option data
  optionStrike?: number
  optionPremium?: number
  optionYield?: number
  optionAnnualizedYield?: number
  optionDelta?: number
  optionDaysToExpiry?: number
  optionBid?: number
  optionAsk?: number
  bidPrice?: number // Added to match enrichWithOptionsData update
  askPrice?: number // Added to match enrichWithOptionsData update

  // Populated during Step 3: the names of fundamental filters this stock *didn't* pass.
  // Empty (or undefined) means strict pass; length 1–2 means "near miss" for the relaxed Step 4 fallback.
  failedFilters?: string[]

  // Real implied volatility (as %) from the Polygon options snapshot, captured
  // during Step 4 enrichment. The exact premium-richness KPI — undefined when
  // the market is closed and greeks are estimated.
  iv?: number

  // Consecutive profitable quarters (net income > 0) counted from the most
  // recent quarterly filing backwards, out of up to 12 fetched.
  profitableQuarters?: number
}

// Step 3 fundamental-scan rejection diagnostics shown when 0 stocks pass.
export interface RejectionSummary {
  scanned: number
  passed: number
  rejected: Record<string, string[]>
  skipped: Record<string, string[]>
}

// Landmine awareness payload — scheduled events (earnings, CPI, FOMC, jobs)
// landing before an option's expiry. Display-only; never used to filter.
export interface LandmineData {
  earnings: Record<string, { date: string; timing: string }[]>
  macro: { date: string; event: string; impact: string; time: string }[]
}

// Excel-style column filters for the relaxed results table. Empty string = no filter.
export interface RelaxedFilters {
  ticker: string
  maxDTE: string
  minPremium: string
  minYield: string
  minAnnualYield: string
  minIV: string
}
