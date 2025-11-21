import type React from "react"
// Reusable indicator display component
// Eliminates 34+ duplicated code blocks throughout the dashboard

import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { CCPIGradientBar } from "./ccpi-gradient-bar"

interface CCPIIndicatorThresholds {
  low: { value: number; label: string }
  mid?: { value: number; label: string }
  high: { value: number; label: string }
}

interface CCPIIndicatorProps {
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

export function CCPIIndicator({
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
}: CCPIIndicatorProps) {
  // Format display value
  const displayValue = formatValue ? formatValue(value) : value

  // Convert string values to numbers for bar calculation
  const numericValue = typeof value === "string" ? Number.parseFloat(value) : value

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {/* Label and value row */}
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

        {/* Gradient bar */}
        <CCPIGradientBar value={numericValue} min={barMin} max={barMax} reverse={barReverse} />

        {/* Threshold labels */}
        <div className="flex justify-between text-xs text-gray-600">
          <span>{thresholds.low.label}</span>
          {thresholds.mid && <span>{thresholds.mid.label}</span>}
          <span>{thresholds.high.label}</span>
        </div>
      </div>
    </TooltipProvider>
  )
}
