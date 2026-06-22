// Reusable gradient bar component for CCPI indicators
// Displays a color-coded bar from green (low risk) to red (high risk)

interface CCPIGradientBarProps {
  value: number
  min?: number
  max?: number
  reverse?: boolean
  className?: string
}

export function CCPIGradientBar({ value, min = 0, max = 100, reverse = false, className = "" }: CCPIGradientBarProps) {
  // Guard against missing / invalid data. Without this, a NaN value produces a
  // "NaN%" margin, the gray overlay fails to render, and the bar looks broken
  // (full green→red with no fill). Render a neutral muted bar instead.
  const hasValidValue = Number.isFinite(value) && Number.isFinite(min) && Number.isFinite(max) && max !== min

  if (!hasValidValue) {
    return (
      <div className={`relative w-full h-3 rounded-full overflow-hidden bg-gray-200 ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-medium text-gray-400">No data</span>
        </div>
      </div>
    )
  }

  // Calculate percentage position (0-100)
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))

  // Convention: good values sit on the LEFT (green), bad values on the RIGHT (red).
  // For "higher is better" indicators, pass reverse so a high value fills from the
  // green side. The gray overlay hides the portion of the gradient beyond the value.
  const marginLeft = reverse ? `${100 - percentage}%` : `${percentage}%`

  return (
    <div className={`relative w-full h-3 rounded-full overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
      <div className="absolute inset-0 bg-gray-200" style={{ marginLeft }} />
    </div>
  )
}
