// CCPI Scoring Core — pure, I/O-free, unit-testable.
//
// Extracted from app/api/ccpi/route.ts (AUDIT_BACKLOG P3-10..P3-13, P3-19).
// Every pillar's indicator maxima sum to exactly 100 (asserted at module load),
// so a pillar score of N genuinely means "N% of the risk this pillar can express".
//
// Three-tier provenance (P3-12): every scored input carries a tier —
//   "live"        real market data from an API/scrape — the only tier that scores
//   "ai-estimate" an LLM's recollection of the value (NOT scored since P6-34;
//                 still recorded so the UI can explain the exclusion)
//   "baseline"    a hardcoded constant (NOT scored)
// The pillar renormalizes over the weight actually backed by live data. If less
// than MIN_SCORED_MAX of a pillar's weight is live, the pillar reports null
// rather than a number built mostly on air.
//
// P6-34 (owner decision, 2026-08-10): ai-estimate stopped scoring. The eleven
// indicators on the LLM fallback chain are all PUBLISHED figures — the VIX, a
// share price, the CBOE put/call ratio, ISM PMI. An LLM asked for one of those
// returns a plausible number rather than the number, and the plausibility band
// is wide enough (VIX: 5-100) that a hallucination passes every check the code
// makes. Scoring them meant the headline index moved on guesses.
//
// Design changes vs. the pre-rework route (documented for FORMULAS.md §3):
//   - Yield curve is scored ONCE, in the Macro pillar (was: Pillar 1 @10,
//     Pillar 2 @8, AND a +15 crash amplifier — ~20 CCPI points for one input).
//   - Unsourced indicators deleted: bullishPercent (hardcoded 58), VXN, RVX,
//     ATR, LTV, spotVol (named baseline constants with no source). VIX level
//     and VIX term structure are kept — both now come from FRED.
//   - VIX term structure uses the RATIO convention: VIX3M / spot VIX.
//     ratio < 1 = backwardation (near-term fear) = risk. The old code scored
//     "termStructure < 1.2" where termStructure was a POINT SPREAD that shrank
//     with spot VIX, so calm markets (VIX < 15) were flagged as risk (P3-14).

// NOTE: this module is deliberately import-free so `node scripts/check-ccpi-scoring.ts`
// can load it with native type stripping (extensionless imports don't resolve there).
// PILLAR_WEIGHTS lives here — the scoring core owns its weights — and
// lib/ccpi/constants.ts re-exports it for existing consumers.

/** Pillar shares of the composite CCPI. Must sum to 1. */
export const PILLAR_WEIGHTS = {
  momentum: 0.35, // 35%
  riskAppetite: 0.3, // 30%
  valuation: 0.15, // 15%
  macro: 0.2, // 20%
} as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Tier = "live" | "ai-estimate" | "baseline"

export interface WeightEntry<K extends string = string> {
  key: K
  max: number
}

export interface PillarResult {
  /** 0-100, renormalized over the weight actually scored; null if scoredMax < MIN_SCORED_MAX */
  score: number | null
  /** Raw risk points earned by live + ai-estimate inputs */
  rawPoints: number
  /** Sum of maxima of the inputs that actually scored (live + ai-estimate, non-null) */
  scoredMax: number
  /** Portion of scoredMax backed by live data */
  liveMax: number
  /** Portion of scoredMax backed by AI estimates */
  aiMax: number
  /** Indicator keys excluded (baseline tier or missing value) */
  excluded: string[]
}

/** Below this scored weight, a pillar refuses to report a number. */
export const MIN_SCORED_MAX = 40

// ---------------------------------------------------------------------------
// WEIGHTS — each pillar's indicator maxima MUST sum to exactly 100.
// Rescaled proportionally from the pre-rework maxima after removing the
// yield-curve duplicates and the unsourced indicators (P3-10).
// ---------------------------------------------------------------------------

export type MomentumKey =
  | "nvidiaMomentum"
  | "soxIndex"
  | "qqqDailyReturn"
  | "qqqConsecDown"
  | "qqqSMA20"
  | "qqqSMA50"
  | "qqqSMA200"
  | "qqqBollinger"
  | "vix"
  | "vixTermStructure"

// Was: 6,6,8,5,5,7,10,6,9,(vxn 7),(rvx 5),6,(yieldCurve 10) — summed to 90.
// Removed vxn/rvx (unsourced) and yieldCurve (moved to Macro); remaining 68
// rescaled ×100/68 and rounded to integers summing to 100.
export const MOMENTUM_WEIGHTS: ReadonlyArray<WeightEntry<MomentumKey>> = [
  { key: "nvidiaMomentum", max: 9 },
  { key: "soxIndex", max: 9 },
  { key: "qqqDailyReturn", max: 12 },
  { key: "qqqConsecDown", max: 7 },
  { key: "qqqSMA20", max: 7 },
  { key: "qqqSMA50", max: 10 },
  { key: "qqqSMA200", max: 15 },
  { key: "qqqBollinger", max: 9 },
  { key: "vix", max: 13 },
  { key: "vixTermStructure", max: 9 },
]

export type RiskAppetiteKey = "putCallRatio" | "fearGreedIndex" | "aaiiBullish" | "shortInterest"

// Was: 18,15,16,13,(atr 5),(ltv 5),(bullishPercent 5),(yieldCurve 8) — summed to 85.
// Removed the four unsourced/duplicate entries; remaining 62 rescaled ×100/62.
export const RISK_APPETITE_WEIGHTS: ReadonlyArray<WeightEntry<RiskAppetiteKey>> = [
  { key: "putCallRatio", max: 29 },
  { key: "fearGreedIndex", max: 24 },
  { key: "aaiiBullish", max: 26 },
  { key: "shortInterest", max: 21 },
]

export type ValuationKey =
  | "spxPE"
  | "spxPS"
  | "buffettIndicator"
  | "qqqPE"
  | "mag7Concentration"
  | "shillerCAPE"
  | "equityRiskPremium"

// Unchanged — already summed to 100.
export const VALUATION_WEIGHTS: ReadonlyArray<WeightEntry<ValuationKey>> = [
  { key: "spxPE", max: 18 },
  { key: "spxPS", max: 12 },
  { key: "buffettIndicator", max: 16 },
  { key: "qqqPE", max: 16 },
  { key: "mag7Concentration", max: 15 },
  { key: "shillerCAPE", max: 13 },
  { key: "equityRiskPremium", max: 10 },
]

export type MacroKey =
  | "tedSpread"
  | "dxyIndex"
  | "ismPMI"
  | "fedFundsRate"
  | "fedReverseRepo"
  | "junkSpread"
  | "debtToGDP"
  | "yieldCurve"

// Yield curve joins its natural home at max 14 (P3-13); the previous seven
// (15,14,18,17,13,12,11 = 100) rescaled ×86/100 with debtToGDP taking the
// rounding remainder so the pillar still sums to exactly 100.
export const MACRO_WEIGHTS: ReadonlyArray<WeightEntry<MacroKey>> = [
  { key: "tedSpread", max: 13 },
  { key: "dxyIndex", max: 12 },
  { key: "ismPMI", max: 15 },
  { key: "fedFundsRate", max: 15 },
  { key: "fedReverseRepo", max: 11 },
  { key: "junkSpread", max: 10 },
  { key: "debtToGDP", max: 10 },
  { key: "yieldCurve", max: 14 },
]

function assertSumsTo100(name: string, weights: ReadonlyArray<WeightEntry>): void {
  const sum = weights.reduce((s, w) => s + w.max, 0)
  if (sum !== 100) {
    throw new Error(`CCPI WEIGHTS invariant violated: ${name} maxima sum to ${sum}, expected 100`)
  }
}

assertSumsTo100("MOMENTUM_WEIGHTS", MOMENTUM_WEIGHTS)
assertSumsTo100("RISK_APPETITE_WEIGHTS", RISK_APPETITE_WEIGHTS)
assertSumsTo100("VALUATION_WEIGHTS", VALUATION_WEIGHTS)
assertSumsTo100("MACRO_WEIGHTS", MACRO_WEIGHTS)

/**
 * Indicators actually scored across the four pillars — derived from the weight
 * tables, not hand-counted, so it cannot drift the way the "34 indicators" and
 * "32 indicators" copy did (it is 29: 10+4+7+8).
 */
export const TOTAL_SCORED_INDICATORS =
  MOMENTUM_WEIGHTS.length + RISK_APPETITE_WEIGHTS.length + VALUATION_WEIGHTS.length + MACRO_WEIGHTS.length

// ---------------------------------------------------------------------------
// Generic pillar scorer with provenance-aware renormalization (P3-12)
// ---------------------------------------------------------------------------

function scorePillar<K extends string>(
  pillarName: string,
  weights: ReadonlyArray<WeightEntry<K>>,
  tiers: Record<K, Tier>,
  points: Record<K, number | null>,
): PillarResult {
  let rawPoints = 0
  let scoredMax = 0
  let liveMax = 0
  let aiMax = 0
  const excluded: string[] = []

  for (const { key, max } of weights) {
    const tier = tiers[key]
    const p = points[key]
    // Owner decision 2026-08-10 (P6-34): an AI estimate no longer scores.
    // Eleven of these indicators are figures somebody publishes — the VIX, a
    // share price, the CBOE put/call ratio — and an LLM asked for one returns
    // a plausible number, not the number. The plausibility band is wide enough
    // (VIX: 5-100) that a hallucination is indistinguishable from a reading.
    // Scoring it meant the headline crash index moved on guesses. The tier is
    // still recorded and still reported, so the UI can say WHY a pillar's
    // scored weight fell — it just does not earn weight.
    if (tier === "baseline" || tier === "ai-estimate" || p === null) {
      excluded.push(key)
      // Still counted, so the provenance line can say how much of the pillar
      // was dropped for being estimated rather than simply absent. Reporting
      // aiMax as 0 would read as "no AI estimates involved", which is the
      // opposite of what happened.
      if (tier === "ai-estimate") aiMax += max
      continue
    }
    if (!Number.isFinite(p) || p < 0 || p > max) {
      throw new Error(`CCPI ${pillarName}: indicator "${key}" scored ${p}, outside [0, ${max}]`)
    }
    rawPoints += p
    scoredMax += max
    liveMax += max // only "live" reaches here now
  }

  const score =
    scoredMax >= MIN_SCORED_MAX
      ? Math.min(100, Math.max(0, Math.round((rawPoints / scoredMax) * 100)))
      : null

  return { score, rawPoints, scoredMax, liveMax, aiMax, excluded }
}

// ---------------------------------------------------------------------------
// Pillar 1 — Momentum & Technical
// ---------------------------------------------------------------------------

export interface MomentumInputs {
  nvidiaMomentum: number // 0-100 (50 = neutral; low = NVDA falling)
  soxIndex: number | null // null when no source produced a reading (P6-34)
  qqqDailyReturn: number // percent
  qqqConsecDown: number
  qqqBelowSMA20: boolean
  qqqSMA20Proximity: number
  qqqBelowSMA50: boolean
  qqqSMA50Proximity: number
  qqqBelowSMA200: boolean
  qqqSMA200Proximity: number
  qqqBelowBollinger: boolean
  qqqBollingerProximity: number
  vix: number | null // null when no source produced a reading (P6-34)
  /** RATIO convention: VIX3M / spot VIX. <1 = backwardation. */
  vixTermStructure: number
}

export type MomentumTiers = Record<MomentumKey, Tier>

function smaPoints(below: boolean, proximity: number, breach: number, near: number, approach: number): number {
  if (below && proximity >= 100) return breach
  if (proximity >= 50) return near
  if (proximity >= 25) return approach
  return 0
}

export function computeMomentumPillar(d: MomentumInputs, tiers: MomentumTiers): PillarResult {
  const points: Record<MomentumKey, number | null> = {
    nvidiaMomentum: (() => {
      if (d.nvidiaMomentum < 20) return 9 // Severe weakness = max danger
      if (d.nvidiaMomentum < 40) return 6
      if (d.nvidiaMomentum > 80) return 4 // Overheating = moderate danger
      if (d.nvidiaMomentum > 60) return 2
      return 0
    })(),
    soxIndex: (() => {
      if (d.soxIndex === null) return null // P6-34: no reading, no points
      const dev = ((d.soxIndex - 5000) / 5000) * 100
      if (dev < -15) return 9 // Chip sector collapse
      if (dev < -10) return 6
      if (dev < -5) return 3
      return 0
    })(),
    qqqDailyReturn: (() => {
      if (d.qqqDailyReturn <= -6) return 12 // Crash day
      if (d.qqqDailyReturn <= -3) return 9
      if (d.qqqDailyReturn <= -1.5) return 6
      if (d.qqqDailyReturn <= -1) return 3
      return 0
    })(),
    qqqConsecDown: (() => {
      if (d.qqqConsecDown >= 5) return 7
      if (d.qqqConsecDown >= 3) return 4
      if (d.qqqConsecDown >= 2) return 2
      return 0
    })(),
    qqqSMA20: smaPoints(d.qqqBelowSMA20, d.qqqSMA20Proximity, 7, 4, 2),
    qqqSMA50: smaPoints(d.qqqBelowSMA50, d.qqqSMA50Proximity, 10, 7, 3),
    qqqSMA200: smaPoints(d.qqqBelowSMA200, d.qqqSMA200Proximity, 15, 10, 5),
    qqqBollinger: smaPoints(d.qqqBelowBollinger, d.qqqBollingerProximity, 9, 6, 3),
    vix: (() => {
      if (d.vix === null) return null // P6-34: no reading, no points
      if (d.vix > 35) return 13
      if (d.vix > 25) return 9
      if (d.vix > 20) return 6
      if (d.vix > 15) return 3
      return 0
    })(),
    // Ratio convention (P3-14): VIX3M/VIX < 1 = backwardation. A calm market
    // in normal contango (≈1.05-1.15) scores 0 — the old "spot<15 flags risk"
    // defect is structurally impossible here.
    vixTermStructure: (() => {
      if (d.vixTermStructure < 0.95) return 9 // Severe backwardation
      if (d.vixTermStructure < 1.0) return 5 // Mild backwardation
      return 0 // Contango = normal
    })(),
  }
  return scorePillar("Momentum & Technical", MOMENTUM_WEIGHTS, tiers, points)
}

// ---------------------------------------------------------------------------
// Pillar 2 — Risk Appetite & Sentiment
// ---------------------------------------------------------------------------

export interface RiskAppetiteInputs {
  putCallRatio: number | null // null when no source produced a reading (P6-34)
  /** CNN equity Fear & Greed 0-100; null when the source is unavailable */
  fearGreedIndex: number | null
  aaiiBullish: number | null // null when no source produced a reading (P6-34)
  shortInterest: number | null // null when no source produced a reading (P6-34)
}

export type RiskAppetiteTiers = Record<RiskAppetiteKey, Tier>

export function computeRiskAppetitePillar(d: RiskAppetiteInputs, tiers: RiskAppetiteTiers): PillarResult {
  const points: Record<RiskAppetiteKey, number | null> = {
    putCallRatio: (() => {
      if (d.putCallRatio === null) return null // P6-34: no reading, no points
      if (d.putCallRatio < 0.6) return 29 // Extreme complacency
      if (d.putCallRatio < 0.7) return 22
      if (d.putCallRatio < 0.9) return 16
      if (d.putCallRatio > 1.3) return 13 // Extreme fear (contrarian)
      if (d.putCallRatio > 1.1) return 6
      return 0
    })(),
    // null ⇒ excluded AND renormalized (the old code excluded without
    // renormalizing, permanently deflating Pillar 2 by 15 points — P3-11).
    fearGreedIndex:
      d.fearGreedIndex === null
        ? null
        : (() => {
            const fg = d.fearGreedIndex
            if (fg > 80) return 24 // Extreme greed
            if (fg > 70) return 19
            if (fg > 60) return 13
            if (fg < 20) return 13 // Extreme fear (contrarian)
            if (fg < 30) return 6
            return 0
          })(),
    aaiiBullish: (() => {
      if (d.aaiiBullish === null) return null // P6-34: no reading, no points
      if (d.aaiiBullish > 55) return 26 // Retail euphoria
      if (d.aaiiBullish > 50) return 19
      if (d.aaiiBullish > 45) return 13
      if (d.aaiiBullish < 25) return 10 // Extreme pessimism (contrarian)
      if (d.aaiiBullish < 30) return 5
      return 0
    })(),
    shortInterest: (() => {
      if (d.shortInterest === null) return null // P6-34: no reading, no points
      if (d.shortInterest < 1.5) return 21 // Extreme complacency
      if (d.shortInterest < 2.0) return 16
      if (d.shortInterest < 3.0) return 10
      if (d.shortInterest > 8.0) return 13 // Crowded shorts (contrarian)
      if (d.shortInterest > 6.0) return 6
      return 0
    })(),
  }
  return scorePillar("Risk Appetite & Sentiment", RISK_APPETITE_WEIGHTS, tiers, points)
}

// ---------------------------------------------------------------------------
// Pillar 3 — Valuation & Market Structure
// ---------------------------------------------------------------------------

export interface ValuationInputs {
  spxPE: number
  spxPS: number
  buffettIndicator: number | null // null when no source produced a reading (P6-34)
  qqqPE: number | null // null when no source produced a reading (P6-34)
  mag7Concentration: number | null // null when no source produced a reading (P6-34)
  shillerCAPE: number | null // null when no source produced a reading (P6-34)
  equityRiskPremium: number
}

export type ValuationTiers = Record<ValuationKey, Tier>

export function computeValuationPillar(d: ValuationInputs, tiers: ValuationTiers): PillarResult {
  const points: Record<ValuationKey, number | null> = {
    spxPE: (() => {
      if (d.spxPE > 30) return 18 // Extreme overvaluation
      if (d.spxPE > 25) return 14
      if (d.spxPE > 22) return 10
      if (d.spxPE > 18) return 6
      return 2
    })(),
    spxPS: (() => {
      if (d.spxPS > 3.5) return 12
      if (d.spxPS > 3.0) return 10
      if (d.spxPS > 2.5) return 7
      if (d.spxPS > 2.0) return 4
      return 0
    })(),
    buffettIndicator: (() => {
      if (d.buffettIndicator === null) return null // P6-34: no reading, no points
      if (d.buffettIndicator > 200) return 16 // Danger: >200%
      if (d.buffettIndicator > 180) return 13
      if (d.buffettIndicator > 150) return 9
      if (d.buffettIndicator > 120) return 5
      return 0
    })(),
    qqqPE: (() => {
      if (d.qqqPE === null) return null // P6-34: no reading, no points
      if (d.qqqPE > 40) return 16 // Bubble territory
      if (d.qqqPE > 35) return 13
      if (d.qqqPE > 30) return 10
      if (d.qqqPE > 25) return 6
      return 2
    })(),
    mag7Concentration: (() => {
      if (d.mag7Concentration === null) return null // P6-34: no reading, no points
      if (d.mag7Concentration > 65) return 15 // Extreme concentration
      if (d.mag7Concentration > 60) return 12
      if (d.mag7Concentration > 55) return 9
      if (d.mag7Concentration > 50) return 6
      if (d.mag7Concentration > 45) return 3
      return 0
    })(),
    shillerCAPE: (() => {
      if (d.shillerCAPE === null) return null // P6-34: no reading, no points
      if (d.shillerCAPE > 35) return 13 // Historic overvaluation
      if (d.shillerCAPE > 30) return 10
      if (d.shillerCAPE > 25) return 7
      if (d.shillerCAPE > 20) return 4
      return 0
    })(),
    equityRiskPremium: (() => {
      if (d.equityRiskPremium < 1.5) return 10 // Severely overpriced vs bonds
      if (d.equityRiskPremium < 2.0) return 8
      if (d.equityRiskPremium < 3.0) return 5
      if (d.equityRiskPremium < 4.0) return 2
      return 0
    })(),
  }
  return scorePillar("Valuation & Market Structure", VALUATION_WEIGHTS, tiers, points)
}

// ---------------------------------------------------------------------------
// Pillar 4 — Macro
// ---------------------------------------------------------------------------

export interface MacroInputs {
  tedSpread: number
  dxyIndex: number
  ismPMI: number | null // null when no source produced a reading (P6-34)
  fedFundsRate: number
  fedReverseRepo: number
  junkSpread: number
  debtToGDP: number
  /** 10Y-2Y spread in percentage points; negative = inverted */
  yieldCurve: number
}

export type MacroTiers = Record<MacroKey, Tier>

export function computeMacroPillar(d: MacroInputs, tiers: MacroTiers): PillarResult {
  const points: Record<MacroKey, number | null> = {
    tedSpread: (() => {
      if (d.tedSpread > 1.0) return 13 // Extreme banking stress
      if (d.tedSpread > 0.75) return 10
      if (d.tedSpread > 0.5) return 8
      if (d.tedSpread > 0.35) return 4
      return 0
    })(),
    dxyIndex: (() => {
      if (d.dxyIndex > 115) return 12 // Very strong dollar hurts tech
      if (d.dxyIndex > 110) return 9
      if (d.dxyIndex > 105) return 6
      if (d.dxyIndex > 100) return 3
      return 0
    })(),
    ismPMI: (() => {
      if (d.ismPMI === null) return null // P6-34: no reading, no points
      if (d.ismPMI < 42) return 15 // Deep contraction
      if (d.ismPMI < 46) return 12
      if (d.ismPMI < 50) return 8
      if (d.ismPMI < 52) return 3
      return 0
    })(),
    fedFundsRate: (() => {
      if (d.fedFundsRate > 6.0) return 15 // Extremely restrictive
      if (d.fedFundsRate > 5.5) return 12
      if (d.fedFundsRate > 5.0) return 9
      if (d.fedFundsRate > 4.5) return 6
      if (d.fedFundsRate > 4.0) return 3
      return 0
    })(),
    fedReverseRepo: (() => {
      if (d.fedReverseRepo > 2000) return 11 // Extreme liquidity drain
      if (d.fedReverseRepo > 1500) return 8
      if (d.fedReverseRepo > 1000) return 6
      if (d.fedReverseRepo > 500) return 3
      return 0
    })(),
    junkSpread: (() => {
      if (d.junkSpread > 10) return 10 // Severe credit stress
      if (d.junkSpread > 8) return 8
      if (d.junkSpread > 6) return 6
      if (d.junkSpread > 5) return 3
      if (d.junkSpread > 3.5) return 2
      return 0
    })(),
    debtToGDP: (() => {
      if (d.debtToGDP > 130) return 10 // Fiscal crisis risk
      if (d.debtToGDP > 120) return 8
      if (d.debtToGDP > 110) return 5
      if (d.debtToGDP > 100) return 3
      return 0
    })(),
    // Scored ONCE, here (P3-13).
    yieldCurve: (() => {
      if (d.yieldCurve < -1.0) return 14 // Deep inversion
      if (d.yieldCurve < -0.5) return 11
      if (d.yieldCurve < -0.2) return 6
      if (d.yieldCurve < 0) return 3
      return 0
    })(),
  }
  return scorePillar("Macro", MACRO_WEIGHTS, tiers, points)
}

// ---------------------------------------------------------------------------
// Composite
// ---------------------------------------------------------------------------

export interface PillarResults {
  momentum: PillarResult
  riskAppetite: PillarResult
  valuation: PillarResult
  macro: PillarResult
}

/**
 * Weighted mean of the pillars that produced a score, renormalized over
 * the weights of those pillars. Null only if NO pillar could be scored.
 */
export function computeBaseCCPI(results: PillarResults): number | null {
  const entries: Array<[number | null, number]> = [
    [results.momentum.score, PILLAR_WEIGHTS.momentum],
    [results.riskAppetite.score, PILLAR_WEIGHTS.riskAppetite],
    [results.valuation.score, PILLAR_WEIGHTS.valuation],
    [results.macro.score, PILLAR_WEIGHTS.macro],
  ]
  let num = 0
  let den = 0
  for (const [score, weight] of entries) {
    if (score === null) continue
    num += score * weight
    den += weight
  }
  return den > 0 ? Math.round(num / den) : null
}

// ---------------------------------------------------------------------------
// Crash amplifiers
// ---------------------------------------------------------------------------

export interface AmplifierInputs {
  // Nullable throughout: the amplifiers sit OUTSIDE the pillar tier system, so
  // a baseline-tier input reached them as a real reading. `qqqDailyReturn: 0`
  // and `qqqBelowSMA50: false` are both assertions the data never made.
  qqqDailyReturn: number | null
  qqqBelowSMA50: boolean | null
  vix: number | null
  putCallRatio: number | null
}

export interface AmplifierResult {
  bonuses: Array<{ reason: string; points: number }>
  totalBonus: number
  /** Amplifier inputs that were unavailable, so a 0 bonus is not read as "all clear". */
  unavailableInputs: string[]
}

/**
 * Acute-event bonuses on top of the base index.
 * Thresholds are checked in DESCENDING severity order — the old code tested
 * `<= -6` before `<= -9`, making the -9 branch unreachable (P3-13).
 * The yield-curve amplifier was removed: the curve is already scored in the
 * Macro pillar and slow-moving inversion is not an acute crash event.
 */
export function calculateCrashAmplifiers(d: AmplifierInputs): AmplifierResult {
  const bonuses: Array<{ reason: string; points: number }> = []
  const unavailableInputs: string[] = []
  let totalBonus = 0

  if (d.qqqDailyReturn === null) {
    unavailableInputs.push("qqqDailyReturn")
  } else if (d.qqqDailyReturn <= -9) {
    bonuses.push({
      reason: `QQQ crashed ${Math.abs(d.qqqDailyReturn).toFixed(1)}% in one day (EXTREME)`,
      points: 40,
    })
    totalBonus += 40
  } else if (d.qqqDailyReturn <= -6) {
    bonuses.push({ reason: `QQQ crashed ${Math.abs(d.qqqDailyReturn).toFixed(1)}% in one day`, points: 25 })
    totalBonus += 25
  }

  if (d.qqqBelowSMA50 === null) {
    unavailableInputs.push("qqqBelowSMA50")
  } else if (d.qqqBelowSMA50) {
    bonuses.push({ reason: "QQQ broken below 50-day SMA", points: 20 })
    totalBonus += 20
  }

  if (d.vix === null) {
    unavailableInputs.push("vix")
  } else if (d.vix > 35) {
    bonuses.push({ reason: `VIX spiked to ${d.vix.toFixed(1)} (panic level)`, points: 20 })
    totalBonus += 20
  }

  if (d.putCallRatio === null) {
    unavailableInputs.push("putCallRatio")
  } else if (d.putCallRatio > 1.3) {
    bonuses.push({ reason: `Put/Call ratio ${d.putCallRatio.toFixed(2)} (extreme hedging)`, points: 15 })
    totalBonus += 15
  }

  if (totalBonus > 100) {
    totalBonus = 100
    bonuses.push({ reason: "Bonus capped at maximum +100", points: 0 })
  }

  return { bonuses, totalBonus, unavailableInputs }
}

// ---------------------------------------------------------------------------
// Certainty — strictly a data-quality number (P3-13)
// ---------------------------------------------------------------------------

/**
 * certainty = round(100 × liveWeight / totalWeight), where weights are
 * indicator maxima scaled by the pillar's share of the composite. 100 = every
 * input live; 0 = nothing live. Canary count deliberately plays NO part — the
 * old formula RAISED certainty as more warning canaries fired.
 *
 * The `0.5 × aiMax` term is gone with P6-34. Half-crediting an LLM's guess at
 * a published figure was the same claim as scoring it, made quieter: certainty
 * is meant to answer "how much of this is measured?", and the answer for an
 * estimate is none of it.
 */
export function computeCertainty(results: PillarResults): number {
  const dataQuality = (r: PillarResult) => r.liveMax / 100
  return Math.round(
    100 *
      (dataQuality(results.momentum) * PILLAR_WEIGHTS.momentum +
        dataQuality(results.riskAppetite) * PILLAR_WEIGHTS.riskAppetite +
        dataQuality(results.valuation) * PILLAR_WEIGHTS.valuation +
        dataQuality(results.macro) * PILLAR_WEIGHTS.macro),
  )
}

// ---------------------------------------------------------------------------
// Regime & playbook
// ---------------------------------------------------------------------------

export interface Regime {
  level: 1 | 2 | 3 | 4 | 5
  name: string
  color: string
  description: string
}

export function determineRegime(ccpi: number): Regime {
  if (ccpi >= 80) {
    return { level: 5, name: "Crash Watch", color: "red", description: "Extreme risk across multiple pillars" }
  } else if (ccpi >= 60) {
    return { level: 4, name: "High Alert", color: "orange", description: "Elevated risk signals" }
  } else if (ccpi >= 40) {
    return { level: 3, name: "Elevated Risk", color: "yellow", description: "Caution warranted" }
  } else if (ccpi >= 20) {
    return { level: 2, name: "Normal", color: "lightgreen", description: "Market conditions normal" }
  } else {
    return { level: 1, name: "Low Risk", color: "green", description: "Healthy market conditions" }
  }
}

export interface Playbook {
  bias: string
  strategies: string[]
  allocation: {
    cash: string
    deployed: string // shares + LEAPS + short options (CSPs/CCs)
    tilt: string // sector/index guidance for the deployed book
  }
}

/**
 * Branches on regime.level — the old implementation returned "Risk-On,
 * 60-80% equities" in every regime including Crash Watch (P3-13).
 */
export function getPlaybook(regime: Regime): Playbook {
  switch (regime.level) {
    case 5: // Crash Watch
      return {
        bias: "Risk-Off / Defensive",
        strategies: [
          "Close or roll short puts down and out — do not add new short-put exposure",
          "Hedge core holdings with protective puts or collars",
          "Raise cash; wait for the regime to downgrade before redeploying",
          "If selling premium at all, sell call spreads into rallies, small size",
        ],
        allocation: {
          cash: "60-80%",
          deployed: "20-40%",
          tilt: "What stays deployed leans defensive: utilities/staples (XLU/XLP), gold-industry names (GDX), and hedged index positions — no new short puts or LEAPS",
        },
      }
    case 4: // High Alert
      return {
        bias: "Risk-Off Tilt",
        strategies: [
          "Cut position sizes; take profits on winners early",
          "Sell covered calls against long stock to harvest elevated IV",
          "Only high-quality cash-secured puts at wide margins of safety (low delta, short DTE)",
          "Tighten stops and avoid holding through binary events (earnings, FOMC)",
        ],
        allocation: {
          cash: "40-60%",
          deployed: "40-60%",
          tilt: "Favor defensive sectors (XLU/XLP/XLV) and high-quality large caps; hedge index exposure (SPY/QQQ) with puts or collars",
        },
      }
    case 3: // Elevated Risk
      return {
        bias: "Neutral / Selective",
        strategies: [
          "Smaller-size cash-secured puts on quality names only",
          "Prefer defined-risk spreads over naked premium",
          "Take profits at 50% of max rather than holding to expiry",
          "Keep dry powder for better entries if risk escalates",
        ],
        allocation: {
          cash: "25-40%",
          deployed: "60-75%",
          tilt: "Quality names and broad indexes (SPY/QQQ) with added defensive sector weight (XLU/XLP); defined-risk options over naked premium",
        },
      }
    case 2: // Normal
      return {
        bias: "Risk-On",
        strategies: [
          "Maintain exposure; run the wheel on quality underlyings",
          "Use cash-secured puts to enter positions at a discount",
          "Covered calls at normal deltas for income",
        ],
        allocation: {
          cash: "10-20%",
          deployed: "80-90%",
          tilt: "Diversified across sectors and broad indexes (SPY/QQQ); run the wheel on quality underlyings at normal size",
        },
      }
    case 1: // Low Risk
    default:
      return {
        bias: "Risk-On / Fully Deployed",
        strategies: [
          "Deploy capital; sell puts into dips with longer DTE",
          "Favor equity exposure over premium selling when IV is cheap",
          "Ladder cash-secured put expirations for steady assignment flow",
        ],
        allocation: {
          cash: "5-15%",
          deployed: "85-95%",
          tilt: "Full sector diversification — growth, financials, industrials — plus broad indexes (SPY/QQQ); LEAPS and laddered short puts at full size",
        },
      }
  }
}
