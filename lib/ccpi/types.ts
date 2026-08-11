// CCPI Type Definitions
// Extracted from ccpi-dashboard.tsx for reusability

// Provenance tier of a scored input (see lib/ccpi/scoring.ts):
// "live" = real market data, "ai-estimate" = LLM recollection,
// "baseline" = hardcoded constant (excluded from scoring, renormalized away).
export type CCPITier = "live" | "ai-estimate" | "baseline"

export interface CCPIPillarProvenance {
  /** Sum of indicator maxima that actually scored (live + ai) out of 100 */
  scoredMax: number
  /** Portion of scoredMax backed by live data */
  liveMax: number
  /** Portion of scoredMax backed by AI estimates */
  aiMax: number
  /** Indicator keys excluded (baseline tier or unavailable value) */
  excluded: string[]
  /** Per-indicator tier map */
  tiers: Record<string, CCPITier>
}

export interface CCPIProvenance {
  momentum: CCPIPillarProvenance
  riskAppetite: CCPIPillarProvenance
  valuation: CCPIPillarProvenance
  macro: CCPIPillarProvenance
}

export interface CCPIData {
  ccpi: number
  baseCCPI?: number
  crashAmplifiers?: Array<{ reason: string; points: number }>
  totalBonus?: number
  certainty: number
  // Null when a pillar's scored weight fell below the minimum after baseline
  // exclusion (see lib/ccpi/scoring.ts) — the dashboard renders "insufficient
  // data" for null and the composite renormalizes over the scored pillars.
  pillars: {
    momentum: number | null // Pillar 1 - Momentum & Technical (35%)
    riskAppetite: number | null // Pillar 2 - Risk Appetite & Volatility (30%)
    valuation: number | null // Pillar 3 - Valuation (15%)
    macro: number | null // Pillar 4 - Macro (20%)
  }
  regime: {
    level: number
    name: string
    color: string
    description: string
  }
  playbook: {
    bias: string
    strategies: string[]
    allocation: Record<string, string>
  }
  summary: {
    headline: string
    bullets: string[]
  }
  canaries: Array<{
    signal: string
    pillar: string
    severity: "high" | "medium" | "low"
    indicatorWeight?: number
    pillarWeight?: number
    impactScore?: number
  }>
  /** Per-pillar data-provenance breakdown (added by the P3 scoring rework). */
  provenance?: CCPIProvenance
  indicators?: Record<string, any>
  apiStatus?: Record<string, { live: boolean; source: string }>
  timestamp: string
  totalIndicators?: number
  cachedAt?: string
  lastUpdated?: string
}

export interface HistoricalData {
  dates: string[]
  ccpiValues: number[]
  regimes: string[]
}

// `CCPIIndicatorThresholds` and `CCPIIndicatorStatus` were deleted here (P7-9),
// with `getIndicatorStatus` in ./calculations — the only thing that used
// either. The live indicator thresholds are declared by `CCPIIndicator` in
// components/ccpi/indicator-primitives.tsx, under the SAME NAME and an
// incompatible shape; keeping both invited importing the wrong one.

export interface CCPIRegimeZone {
  color: string
  label: string
}

export type CCPISeverity = "high" | "medium" | "low"

export interface CCPISeverityConfig {
  bgColor: string
  textColor: string
  borderColor: string
  badgeColor: string
  label: string
}
