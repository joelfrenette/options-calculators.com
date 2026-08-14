/**
 * Payload shape and presentation helpers for the CPI tab. Split from
 * components/cpi-inflation-analysis.tsx (P6-13).
 */

export interface CPIData {
  currentCPI: number
  previousCPI: number
  trend: "up" | "down" | "stable"
  targetCPI: number
  chartData: CPIChartPoint[]
  forecastData: CPIForecastPoint[]
  optionsStrategies: InflationStrategy[]
  inflationPressure: string
  fedTarget: number
  lastUpdated: string
}

export interface CPIChartPoint {
  date: string
  historical: number | null
  forecast: number | null
  type: "historical" | "current" | "forecast"
}

export interface CPIForecastPoint {
  month: string
  cpi: number
  yoyChange: number
}

export interface InflationStrategy {
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

export function getTrendIcon(trend: string): string {
  if (trend === "up") return "↑"
  if (trend === "down") return "↓"
  return "→"
}

export function getTrendColor(trend: string): string {
  if (trend === "up") return "text-red-600"
  if (trend === "down") return "text-green-600"
  return "text-gray-600"
}

export function getInflationPressureStyle(pressure: string): string {
  if (pressure === "High") return "bg-red-100 text-red-800 border-red-300"
  if (pressure === "Moderate") return "bg-yellow-100 text-yellow-800 border-yellow-300"
  return "bg-green-100 text-green-800 border-green-300"
}

/**
 * The bounds `/api/cpi-inflation` clamps every projected month to. Named here
 * because the projection card has to disclose them (P7-85) and the chart's Y
 * axis is drawn to the same numbers — without the disclosure, a projection
 * sitting ON the clamp is indistinguishable from one that happens to be flat.
 */
export const PROJECTION_FLOOR = 1.5
export const PROJECTION_CEILING = 5.0
