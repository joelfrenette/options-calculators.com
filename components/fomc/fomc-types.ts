/**
 * The shapes `/api/fomc-predictions` returns, plus the input-label lookup.
 *
 * Split out of `components/fomc-predictions.tsx` (P6-13) unchanged. `Provenance`
 * is the load-bearing one: `unavailable`, `keyInputsMissing` and
 * `predictionReliability` are how the tab tells "we predicted without this" from
 * "we could not predict", and the route answers 503 rather than forecast on a
 * stand-in rate (P0-16).
 */

export interface NextMeeting {
  date: string
  daysUntil: number
  prediction: "CUT" | "HIKE" | "HOLD"
  predictionBps: number
  confidence: number
  impliedRate: number
  reliability: "full" | "degraded"
}

export interface RatePath {
  // Null when FRED's DFF history is too short to reach back a meeting cycle.
  previousMeeting: number | null
  current: number
  nextMeeting: number
  threeMonth: number
  sixMonth: number
  twelveMonth: number
}

export interface FomcMeeting {
  date: string
  daysAway: number
  impliedRate: number
  probCut50: number
  probCut25: number
  probNoChange: number
  probHike25: number
  probHike50: number
}

export interface HistoricalRate {
  date: string
  rate: number
}

export interface EconomicFactors {
  yieldCurve: string | null
  yieldCurveSignal: string | null
  treasuryTrend: string | null
  treasurySignal: string | null
  marketExpectation: string
}

export interface EconomicIndicator {
  current: number
  previous: number
  trend: "up" | "down" | "stable"
}

// Every indicator is null when its FRED series was unavailable. Nothing is
// substituted, so the card renders "—" instead of a representative figure.
export interface EconomicIndicators {
  unemployment: EconomicIndicator | null
  cpi: EconomicIndicator | null
  coreCPI: EconomicIndicator | null
  pce: EconomicIndicator | null
  gdp: EconomicIndicator | null
  payrolls: EconomicIndicator | null
}

export interface FedDecisionFactors {
  inflationPressure: string | null
  inflationTrend: string | null
  laborMarket: string | null
  laborTrend: string | null
  economicGrowth: string | null
  growthTrend: string | null
}

export interface Provenance {
  inputs: Record<string, { tier: "live" | "unavailable"; source: string }>
  unavailable: string[]
  keyInputsMissing: string[]
  predictionReliability: "full" | "degraded" | "unavailable"
  scoring?: { predictionScore: number; scoredInputs: string[]; excludedFromScore: string[] }
}

/** Human-readable names for the provenance keys the API reports. */
export const INPUT_LABELS: Record<string, string> = {
  unemployment: "Unemployment (UNRATE)",
  cpi: "CPI YoY (CPIAUCSL)",
  coreCPI: "Core CPI YoY (CPILFESL)",
  pce: "PCE YoY (PCEPI)",
  gdp: "GDP growth (A191RL1Q225SBEA)",
  payrolls: "Non-farm payrolls (PAYEMS)",
  fedFundsRate: "Fed Funds rate (DFF)",
  previousMeetingRate: "Rate at last meeting (DFF history)",
  treasury10Y: "10Y Treasury (DGS10)",
  treasury2Y: "2Y Treasury (DGS2)",
}

export const labelFor = (key: string) => INPUT_LABELS[key] ?? key

export interface PredictionMethodology {
  description: string
  formula: string
  factors: string[]
  // Renamed from `weights`, which named four percentages the score never
  // applied — including one for a "market pricing" input the route does not read.
  scoreContributions: {
    inflation: string
    employment: string
    growth: string
    note: string
  }
  methodology?: string
  comparison?: string
}

export interface OptionsStrategy {
  name: string
  ticker: string
  type: string
  rationale: string
  entry: string
  target: string
  stopLoss: string
  timeframe: string
  risk: string
}
