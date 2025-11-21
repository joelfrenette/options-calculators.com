// Reusable canary warning card component
// Displays individual warning signals with severity-based styling

import { Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { SEVERITY_CONFIGS } from "@/lib/ccpi/constants"
import type { CCPIData, CCPISeverity } from "@/lib/ccpi/types"

interface CCPICanaryCardProps {
  canary: CCPIData["canaries"][0]
  tooltipsEnabled?: boolean
}

export function CCPICanaryCard({ canary, tooltipsEnabled = true }: CCPICanaryCardProps) {
  const severityConfig = SEVERITY_CONFIGS[canary.severity as CCPISeverity]

  if (!severityConfig) return null

  return (
    <TooltipProvider>
      <div className={`p-3 rounded-lg border-l-4 ${severityConfig.bgColor} ${severityConfig.borderColor}`}>
        <div className="flex items-start justify-between mb-2">
          <Badge className={`text-xs font-bold ${severityConfig.badgeColor}`}>{severityConfig.label}</Badge>
          <span className="text-xs text-gray-600">{canary.pillar}</span>
        </div>

        <div className="flex items-start gap-2">
          <p className={`text-sm font-semibold ${severityConfig.textColor} flex-1`}>{canary.signal}</p>
          {tooltipsEnabled && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help flex-shrink-0 mt-0.5" />
              </TooltipTrigger>
              <TooltipContent
                className={`max-w-xs ${
                  canary.severity === "high" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"
                }`}
              >
                <p className="font-semibold mb-1">{canary.signal}</p>
                <p className="text-sm">
                  {canary.severity === "high"
                    ? "This indicator has breached a critical threshold, signaling elevated crash risk. Historical data shows increased volatility when this condition persists."
                    : "This indicator is showing warning signs. While not critical yet, it suggests increasing caution and risk monitoring."}
                </p>
                {canary.indicatorWeight !== undefined && canary.pillarWeight !== undefined && (
                  <p className="text-xs font-medium mt-2">
                    Indicator Weight: {canary.indicatorWeight}/100 in pillar
                    <br />
                    Pillar Weight: {canary.pillarWeight}% of CCPI
                    <br />
                    Combined Impact: {canary.impactScore?.toFixed(2)}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
