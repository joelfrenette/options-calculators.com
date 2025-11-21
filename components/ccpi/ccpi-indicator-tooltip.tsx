// Standardized tooltip content for CCPI indicators
// Provides consistent formatting for indicator explanations

interface CCPIIndicatorTooltipProps {
  title: string
  description: string
  thresholds: Array<{
    label: string
    description: string
  }>
  impact?: string
}

export function CCPIIndicatorTooltip({ title, description, thresholds, impact }: CCPIIndicatorTooltipProps) {
  return (
    <div>
      <p className="font-semibold mb-1">{title}</p>
      <p className="text-sm">{description}</p>
      {thresholds.length > 0 && (
        <ul className="text-sm mt-1 space-y-1">
          {thresholds.map((threshold, index) => (
            <li key={index}>
              <strong>{threshold.label}:</strong> {threshold.description}
            </li>
          ))}
        </ul>
      )}
      {impact && (
        <p className="text-xs mt-2">
          <strong>Impact:</strong> {impact}
        </p>
      )}
    </div>
  )
}
