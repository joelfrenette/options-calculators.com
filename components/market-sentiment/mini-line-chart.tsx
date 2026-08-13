/**
 * The sparkline drawn beside each Fear & Greed indicator.
 *
 * Split out of `components/market-sentiment.tsx` (P6-13) unchanged, including
 * its empty-data guard: no points means no chart, not a flat line at zero.
 */

import type React from "react"

export const MiniLineChart = ({
  data,
  dates,
  color = "#2563eb",
  yAxisLabel = "",
}: {
  data: number[]
  dates?: string[]
  color?: string
  yAxisLabel?: string
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 h-48">
        <div className="text-center text-gray-500">
          <div className="text-sm">No chart data available</div>
        </div>
      </div>
    )
  }

  const width = 600
  const height = 200
  const padding = { top: 20, right: 20, bottom: 30, left: 50 }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data
    .map((value, index) => {
      const x = padding.left + (index / (data.length - 1)) * (width - padding.left - padding.right)
      const y = height - padding.bottom - ((value - min) / range) * (height - padding.top - padding.bottom)
      return `${x},${y}`
    })
    .join(" ")

  // Format date labels (show first, middle, last)
  const firstDate = dates?.[0]
    ? new Date(dates[0]).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : ""
  const middleDate = dates?.[Math.floor(dates.length / 2)]
    ? new Date(dates[Math.floor(dates.length / 2)]).toLocaleDateString("en-US", { month: "short" })
    : ""
  const lastDate = dates?.[dates.length - 1]
    ? new Date(dates[dates.length - 1]).toLocaleDateString("en-US", { month: "short" })
    : ""

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="#e5e7eb"
          strokeWidth="1"
        />
        {/* X-axis */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="#e5e7eb"
          strokeWidth="1"
        />

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = height - padding.bottom - ratio * (height - padding.top - padding.bottom)
          return (
            <line
              key={ratio}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="#f3f4f6"
              strokeWidth="1"
            />
          )
        })}

        {/* Data line */}
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />

        {/* Y-axis labels */}
        <text x={padding.left - 10} y={padding.top} fontSize="11" fill="#6b7280" textAnchor="end">
          {max.toFixed(0)}
        </text>
        <text x={padding.left - 10} y={height - padding.bottom} fontSize="11" fill="#6b7280" textAnchor="end">
          {min.toFixed(0)}
        </text>
        {yAxisLabel && (
          <text
            x={padding.left - 35}
            y={height / 2}
            fontSize="11"
            fill="#6b7280"
            textAnchor="middle"
            transform={`rotate(-90, ${padding.left - 35}, ${height / 2})`}
          >
            {yAxisLabel}
          </text>
        )}

        {/* X-axis date labels */}
        {dates && dates.length > 0 && (
          <>
            <text x={padding.left} y={height - padding.bottom + 20} fontSize="11" fill="#6b7280" textAnchor="start">
              {firstDate}
            </text>
            <text
              x={(width - padding.right + padding.left) / 2}
              y={height - padding.bottom + 20}
              fontSize="11"
              fill="#6b7280"
              textAnchor="middle"
            >
              {middleDate}
            </text>
            <text
              x={width - padding.right}
              y={height - padding.bottom + 20}
              fontSize="11"
              fill="#6b7280"
              textAnchor="end"
            >
              {lastDate}
            </text>
          </>
        )}
      </svg>
    </div>
  )
}
