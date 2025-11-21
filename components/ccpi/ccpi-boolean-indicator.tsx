import type React from "react"
// Boolean indicator variant (YES/NO display)
// Used for indicators like "Below SMA20", "Death Cross", etc.

import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { CCPIGradientBar } from "./ccpi-gradient-bar"

interface CCPIBooleanIndicatorProps {
  label: string
  value: boolean
  proximity?: number // 0-100 percentage for bar display
  thresholds: {
    low: { value: number; label: string }
    mid?: { value: number; label: string }
    high: { value: number; label: string }
  }
  tooltipContent?: React.ReactNode
  tooltipsEnabled?: boolean
  additionalInfo?: string
}

export function CCPIBooleanIndicator({
  label,
  value,
  proximity = 0,
  thresholds,
  tooltipContent,
  tooltipsEnabled = true,
  additionalInfo,
}: CCPIBooleanIndicatorProps) {
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
          <div className="flex items-center gap-2">
            {additionalInfo && <span className="text-xs font-semibold text-orange-600">{additionalInfo}</span>}
            <span className={`font-bold ${value ? "text-red-600" : "text-green-600"}`}>{value ? "YES" : "NO"}</span>
          </div>
        </div>

        {/* Gradient bar showing proximity */}
        <CCPIGradientBar value={proximity} />

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
