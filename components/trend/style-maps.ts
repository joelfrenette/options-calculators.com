/**
 * Trend, strength and momentum colour lookups.
 *
 * Split out of `components/trend-analysis.tsx` (P6-13) unchanged, including
 * their fall-through to a neutral grey — an unreadable value must not be
 * coloured as a direction.
 */

export const getTrendColor = (trend: string) => {
  switch (trend) {
    case "Bullish":
      return "text-green-600 bg-green-50 border-green-200"
    case "Bearish":
      return "text-red-600 bg-red-50 border-red-200"
    default:
      return "text-gray-600 bg-gray-50 border-gray-200"
  }
}

export const getStrengthColor = (strength: string) => {
  switch (strength) {
    case "Strong":
      return "text-green-700 font-bold"
    case "Moderate":
      return "text-orange-600 font-semibold"
    default:
      return "text-gray-600"
  }
}

export const getMomentumColor = (momentum: number) => {
  if (momentum >= 70) return "text-green-600"
  if (momentum >= 55) return "text-green-500"
  if (momentum >= 45) return "text-gray-600"
  if (momentum >= 30) return "text-red-500"
  return "text-red-600"
}

