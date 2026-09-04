// Ticker Research Queue — shared types (RESEARCH_QUEUE_DESIGN.md).
//
// The recommendation shape is ported from the owner's TradingAgents
// (agents/options/options_strategist.py OptionsRecommendation, Apache-2.0). The
// deliberate difference from the source: TradingAgents asks the LLM to ESTIMATE
// the numeric methodology fields; here they are COMPUTED (Polygon IV +
// lib/black-scholes.ts) and handed to the model, which only selects the strategy
// and writes the prose. See lib/research/run.ts.

/** The five wheel strategies plus a defined no-trade. */
export type OptionsStrategy = "CSP" | "CC" | "LONG_CALL" | "LEAPS" | "PMCC" | "NO_TRADE"

/** Directional read that feeds strategy selection (TradingAgents PortfolioRating). */
export type PortfolioRating = "Buy" | "Overweight" | "Hold" | "Underweight" | "Sell"

/**
 * One options recommendation for one ticker.
 *
 * `strategy`, `rationale`, `riskFlags` and `fitScore` are the MODEL's job. Every
 * other field is COMPUTED and passed in — the model may quote them but never
 * invents them. A field is null when its input could not be measured (never a
 * guessed stand-in — the P6-34 rule).
 */
export interface OptionsRecommendation {
  ticker: string
  strategy: OptionsStrategy
  /** Model's 2–4 sentence rationale over the computed numbers. */
  rationale: string
  /** How well the strategy fits: 5 excellent … 1 poor. */
  fitScore: 1 | 2 | 3 | 4 | 5
  /** Model-surfaced risks (earnings window, thin liquidity, low IV, …). */
  riskFlags: string[]

  // --- computed inputs (never LLM-invented) --------------------------------
  /** Underlying price the recommendation was built on. */
  price: number | null
  asOf: string | null
  /** ATM implied vol as a percent (28.4 = 28.4%). */
  atmIvPct: number | null
  /**
   * IV rank 0–100 when a real IV history exists, else a realized-vol estimate.
   * `ivRankIsEstimate` says which — the label is a claim.
   */
  ivRank: number | null
  ivRankIsEstimate: boolean
  ivRankNote: string | null

  /** CSP band: sell puts between `cspStrikeLow` (deeper OTM, safer) and High. */
  cspStrikeLow: number | null
  cspStrikeHigh: number | null
  cspDte: number | null
  cspCredit: number | null
  cspProbabilityOfProfit: number | null
  cspBreakeven: number | null
  cspAnnualizedReturnPct: number | null
  cspCapitalRequired: number | null

  /** LEAPS: a ~0.75Δ call, and the pullback price that makes it a buy. */
  leapsStrike: number | null
  leapsDte: number | null
  leapsBuyBelowPrice: number | null

  /** Covered-call strike when shares are held (else null). */
  ccStrike: number | null
  ccCredit: number | null

  /** Mechanical management plan (take profit ~50%, roll ~21 DTE, wheel …). */
  managementPlan: string
  /** Smaller defined-risk alternative (e.g., a put credit spread). */
  definedRiskAlternative: string
  /** Directional rating that drove selection, and how it was derived. */
  rating: PortfolioRating
  ratingBasis: string
}

export type ResearchStatus =
  | "pending"
  | "researching"
  | "researched"
  | "failed"
  | "stale"
  | "paused"
  | "archived"

export interface ResearchRow {
  id: number
  ownerEmail: string
  ticker: string
  status: ResearchStatus
  sharesHeld: number
  costBasis: number | null
  recommendation: OptionsRecommendation | null
  researchedAt: string | null
  createdAt: string
}

/** Per-owner premium-selling preferences (TradingAgents wheel_profile). */
export interface WheelProfile {
  accountType: "401k" | "taxable" | "ira"
  willingToBeAssigned: boolean
  avoidEarningsWithinDte: boolean
  maxCapitalPerTradeUsd: number
  minIvRankForPremiumSale: number
  targetCspDelta: [number, number]
  preferredDte: [number, number]
  leapsMinDte: number
  leapsTargetDelta: [number, number]
}

/** Matches the column defaults in migration 0018. */
export const DEFAULT_WHEEL_PROFILE: WheelProfile = {
  accountType: "taxable",
  willingToBeAssigned: true,
  avoidEarningsWithinDte: true,
  maxCapitalPerTradeUsd: 25000,
  minIvRankForPremiumSale: 30,
  targetCspDelta: [0.16, 0.3],
  preferredDte: [30, 45],
  leapsMinDte: 365,
  leapsTargetDelta: [0.7, 0.8],
}

/** How old a recommendation may be before the tab marks it stale. */
export const RESEARCH_TTL_MS = 20 * 60 * 60 * 1000 // 20h — one overnight cycle

/** One "what changed overnight" line in the morning recap (Phase 3). */
export interface RecapItem {
  ticker: string
  /** flip = strategy changed · band = CSP band moved · trigger = LEAPS/price trigger in range · new = first read. */
  kind: "flip" | "band" | "trigger" | "new"
  detail: string
}

/** The morning recap for one owner — a research_recap row (Phase 3). */
export interface Recap {
  ownerEmail: string
  generatedAt: string
  /** Opus 5 narration over the deltas, or the deterministic sentence (see isLlm). */
  summary: string
  items: RecapItem[]
  isLlm: boolean
}
