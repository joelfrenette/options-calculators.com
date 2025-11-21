// CCPI Type Definitions
// Extracted from ccpi-dashboard.tsx for reusability

export interface CCPIData {
  ccpi: number
  baseCCPI?: number
  crashAmplifiers?: Array<{ reason: string; points: number }>
  totalBonus?: number
  certainty: number
  pillars: {
    momentum: number // Pillar 1 - Momentum & Technical (35%)
    riskAppetite: number // Pillar 2 - Risk Appetite & Volatility (30%)
    valuation: number // Pillar 3 - Valuation (15%)
    macro: number // Pillar 4 - Macro (20%)
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

export interface CCPIIndicatorThresholds {
  low: number
  mid?: number
  high: number
  ideal?: number
}

export interface CCPIRegimeZone {
  color: string
  label: string
}

export interface CCPIIndicatorStatus {
  color: string
  status: string
}

export type CCPISeverity = "high" | "medium" | "low"

export interface CCPISeverityConfig {
  bgColor: string
  textColor: string
  borderColor: string
  badgeColor: string
  label: string
}
