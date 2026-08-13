/**
 * Prediction, trend and indicator presentation: the colour and icon lookups,
 * and the two small renderers they feed.
 *
 * Split out of `components/fomc-predictions.tsx` (P6-13) unchanged.
 *
 * `FactorValue` rendering "—" for null is the piece that matters: a factor the
 * route could not measure must not appear as a value, and every style function
 * here falls through to a grey neutral rather than picking a direction it was
 * not given.
 */
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { EconomicIndicator } from "./fomc-types"

export const getPredictionColor = (prediction: string) => {
  switch (prediction) {
    case "CUT":
      return "text-green-600"
    case "HIKE":
      return "text-red-600"
    default:
      return "text-gray-600"
  }
}

export const getPredictionBg = (prediction: string) => {
  switch (prediction) {
    case "CUT":
      return "bg-green-50 border-green-200"
    case "HIKE":
      return "bg-red-50 border-red-200"
    default:
      return "bg-gray-50 border-gray-200"
  }
}

export const getPredictionIcon = (prediction: string) => {
  switch (prediction) {
    case "CUT":
      return <TrendingDown className="h-8 w-8 text-green-600" />
    case "HIKE":
      return <TrendingUp className="h-8 w-8 text-red-600" />
    default:
      return <Minus className="h-8 w-8 text-gray-600" />
  }
}

export const getConfidenceLevel = (confidence: number) => {
  if (confidence >= 70) return { label: "High", color: "text-green-600" }
  if (confidence >= 50) return { label: "Moderate", color: "text-yellow-600" }
  return { label: "Low", color: "text-orange-600" }
}

export const getTrendIcon = (trend: string) => {
  switch (trend) {
    case "up":
      return <TrendingUp className="h-4 w-4 text-red-600" />
    case "down":
      return <TrendingDown className="h-4 w-4 text-green-600" />
    default:
      return <Minus className="h-4 w-4 text-gray-600" />
  }
}

export const getTrendColor = (trend: string) => {
  switch (trend) {
    case "up":
      return "text-red-600"
    case "down":
      return "text-green-600"
    default:
      return "text-gray-600"
  }
}

// One indicator card body. A null series renders "—" plus an explicit
// insufficient-data note — never a substituted figure, and never a 0.
export const IndicatorBody = ({
  indicator,
  format,
  footnote,
}: {
  indicator: EconomicIndicator | null
  format: (n: number) => string
  footnote: string
}) => {
  if (!indicator) {
    return (
      <>
        <div className="flex items-center justify-between mb-2">
          <Minus className="h-4 w-4 text-gray-300" />
        </div>
        <p className="text-3xl font-bold text-gray-400">—</p>
        <p className="text-xs text-gray-500 mt-1">Insufficient data — series unavailable</p>
        <p className="text-xs text-gray-500 mt-2">{footnote}</p>
      </>
    )
  }
  return (
    <>
      <div className="flex items-center justify-between mb-2">{getTrendIcon(indicator.trend)}</div>
      <p className="text-3xl font-bold text-gray-900">{format(indicator.current)}</p>
      <p className={`text-xs mt-1 ${getTrendColor(indicator.trend)}`}>Previous: {format(indicator.previous)}</p>
      <p className="text-xs text-gray-500 mt-2">{footnote}</p>
    </>
  )
}

/** Fed-decision category, or "—" when the input behind it was missing. */
export const FactorValue = ({ value }: { value: string | null }) =>
  value === null ? (
    <>
      <p className="text-lg font-bold text-gray-400">—</p>
      <p className="text-xs text-gray-500 mt-1">Insufficient data</p>
    </>
  ) : (
    <p className="text-lg font-bold text-gray-900">{value}</p>
  )

export const getInflationTrendStyle = (trend: string) => {
  // Heating inflation = hawkish (red), Cooling inflation = dovish (green)
  if (trend.toLowerCase().includes("heating") || trend.toLowerCase().includes("rising")) {
    return "bg-red-50 text-red-700 border border-red-200"
  }
  if (trend.toLowerCase().includes("cooling") || trend.toLowerCase().includes("falling")) {
    return "bg-green-50 text-green-700 border border-green-200"
  }
  return "bg-gray-50 text-gray-700 border border-gray-200"
}

export const getLaborTrendStyle = (trend: string) => {
  // Weakening labor = dovish (green), Strengthening labor = hawkish (red)
  if (trend.toLowerCase().includes("weakening") || trend.toLowerCase().includes("softening")) {
    return "bg-green-50 text-green-700 border border-green-200"
  }
  if (trend.toLowerCase().includes("strengthening") || trend.toLowerCase().includes("tightening")) {
    return "bg-red-50 text-red-700 border border-red-200"
  }
  return "bg-gray-50 text-gray-700 border border-gray-200"
}

export const getGrowthTrendStyle = (trend: string) => {
  // Accelerating growth = hawkish (red), Slowing growth = dovish (green)
  if (trend.toLowerCase().includes("accelerating") || trend.toLowerCase().includes("expanding")) {
    return "bg-red-50 text-red-700 border border-red-200"
  }
  if (trend.toLowerCase().includes("slowing") || trend.toLowerCase().includes("contracting")) {
    return "bg-green-50 text-green-700 border border-green-200"
  }
  return "bg-gray-50 text-gray-700 border border-gray-200"
}

export const getMarketExpectationStyle = (expectation: string) => {
  // Dovish = green, Hawkish = red
  if (expectation.toLowerCase().includes("dovish")) {
    return "bg-green-50 text-green-700 border border-green-200"
  }
  if (expectation.toLowerCase().includes("hawkish")) {
    return "bg-red-50 text-red-700 border border-red-200"
  }
  return "bg-gray-50 text-gray-700 border border-gray-200"
}
