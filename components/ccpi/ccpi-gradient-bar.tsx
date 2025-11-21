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
  // Calculate percentage position (0-100)
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))

  // Position from left if normal, from right if reversed
  const marginLeft = reverse ? `${100 - percentage}%` : `${percentage}%`

  return (
    <div className={`relative w-full h-3 rounded-full overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
      <div className="absolute inset-0 bg-gray-200" style={{ marginLeft }} />
    </div>
  )
}
