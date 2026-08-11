"use client"

/**
 * Presentational primitives for the CCPI dashboard — the tooltip, the gradient
 * bar and the two indicator rows.
 *
 * Lifted VERBATIM out of components/ccpi-dashboard.tsx, which stood at 3,196
 * lines against a 600-line budget (SITE_MAP §5). Pure presentation: no state,
 * no fetching, no scoring, so the move cannot change behaviour and tsc proves
 * the wiring.
 */

import React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"

export interface CCPIIndicatorTooltipProps {
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

export interface CCPIGradientBarProps {
  value: number
  min?: number
  max?: number
  reverse?: boolean
}

export const CCPIGradientBar = React.memo(({ value, min = 0, max = 100, reverse = false }: CCPIGradientBarProps) => {
  // Guard against missing / invalid data. Without this, a NaN value produces a
  // "NaN%" margin, the gray overlay fails to render, and the bar looks broken
  // (full green→red with no fill). Render a neutral muted bar instead.
  const hasValidValue = Number.isFinite(value) && Number.isFinite(min) && Number.isFinite(max) && max !== min

  if (!hasValidValue) {
    return (
      <div className="relative w-full h-3 rounded-full overflow-hidden bg-gray-200">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-medium text-gray-400">No data</span>
        </div>
      </div>
    )
  }

  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
  // Convention: good values sit on the LEFT (green), bad on the RIGHT (red).
  // "Higher is better" indicators pass reverse so a high value fills from green.
  const marginLeft = reverse ? `${100 - percentage}%` : `${percentage}%`

  return (
    <div className="relative w-full h-3 rounded-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
      <div className="absolute inset-0 bg-gray-200" style={{ marginLeft }} />
    </div>
  )
})
CCPIGradientBar.displayName = "CCPIGradientBar"

export interface CCPIIndicatorThresholds {
  low: { value: number; label: string }
  mid?: { value: number; label: string }
  high: { value: number; label: string }
}

export interface CCPIIndicatorProps {
  label: string
  value: number | string
  thresholds: CCPIIndicatorThresholds
  tooltipContent?: React.ReactNode
  formatValue?: (v: number | string) => string
  valueColor?: string
  barMin?: number
  barMax?: number
  barReverse?: boolean
  tooltipsEnabled?: boolean
}

export const CCPIIndicator = React.memo(
  ({
    label,
    value,
    thresholds,
    tooltipContent,
    formatValue,
    valueColor,
    barMin,
    barMax,
    barReverse,
    tooltipsEnabled = true,
  }: CCPIIndicatorProps) => {
    const displayValue = formatValue ? formatValue(value) : value
    const numericValue = typeof value === "string" ? Number.parseFloat(value) : value

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium flex items-center gap-1">
            {label}
            {tooltipsEnabled && tooltipContent && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">{tooltipContent}</TooltipContent>
              </Tooltip>
            )}
          </span>
          <span className={`font-bold ${valueColor || ""}`}>{displayValue}</span>
        </div>

        <CCPIGradientBar value={numericValue} min={barMin} max={barMax} reverse={barReverse} />

        <div className="flex justify-between text-xs text-gray-600">
          <span>{thresholds.low.label}</span>
          {thresholds.mid && <span>{thresholds.mid.label}</span>}
          <span>{thresholds.high.label}</span>
        </div>
      </div>
    )
  },
)
CCPIIndicator.displayName = "CCPIIndicator"

export interface CCPIBooleanIndicatorProps {
  label: string
  value: boolean
  /**
   * Null/undefined when the proximity could not be measured. It must NOT fall
   * back to 0: this bar's own scale labels 0 as "Safe: 0% (far above)", so a
   * default renders absence as reassurance — the same shape as P6-31's
   * `buffettIndicator || 180`, except that one fired a false warning and this
   * one suppresses a real concern, which is the more dangerous direction.
   */
  proximity?: number | null
  additionalInfo?: string
  thresholds: CCPIIndicatorThresholds
  tooltipContent?: React.ReactNode
  tooltipsEnabled?: boolean
}

export const CCPIBooleanIndicator = React.memo(
  ({
    label,
    value,
    proximity = null,
    additionalInfo,
    thresholds,
    tooltipContent,
    tooltipsEnabled = true,
  }: CCPIBooleanIndicatorProps) => {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium flex items-center gap-1">
            {label}
            {tooltipsEnabled && tooltipContent && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">{tooltipContent}</TooltipContent>
              </Tooltip>
            )}
          </span>
          <span className="font-bold">
            <span className={value ? "text-red-600" : "text-green-600"}>{value ? "YES" : "NO"}</span>
            {additionalInfo && <span className="text-gray-600 ml-2 text-xs">({additionalInfo})</span>}
          </span>
        </div>

        {proximity === null ? (
          <div className="h-2 w-full rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-[10px] text-gray-500">proximity not measured</span>
          </div>
        ) : (
          <CCPIGradientBar value={proximity} min={0} max={100} reverse={false} />
        )}

        <div className="flex justify-between text-xs text-gray-600">
          <span>{thresholds.low.label}</span>
          {thresholds.mid && <span>{thresholds.mid.label}</span>}
          <span>{thresholds.high.label}</span>
        </div>
      </div>
    )
  },
)
CCPIBooleanIndicator.displayName = "CCPIBooleanIndicator"

// Helper function for warning signal tooltips
