"use client"

/**
 * The canary signals, sorted by severity, with the count of what is currently flashing.
 *
 * Split out of `components/ccpi-dashboard.tsx` (P6-13) unchanged. What it closed
 * over is now props.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Activity, AlertTriangle, Info, Sparkles, TrendingDown } from "lucide-react"
import type { CCPIData } from "@/lib/ccpi/types"
import { getSignalTooltip } from "@/components/ccpi/tooltip-copy"

export function CanariesCard({
  data,
  sortedCanaries,
  activeCanariesCount,
  indicatorCount,
  tooltipsEnabled,
}: {
  data: CCPIData
  sortedCanaries: CCPIData["canaries"]
  activeCanariesCount: number
  /** NULL when /api/ccpi did not report a count. Never coerced to a number —
   * the old `|| 29` invented a total for any falsy value. */
  indicatorCount: number | null
  tooltipsEnabled: boolean
}) {
  return (
    <>
        <Card className="border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-red-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-xl">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help border-b border-dashed border-orange-400">Active Warning Signals</span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="max-w-sm bg-white text-gray-900 border border-gray-200 shadow-lg p-3"
                  >
                    <p className="text-sm">
                      <strong>What are Warning Signals?</strong>
                      <br />
                      These are individual market indicators that are currently flashing caution. Each signal represents
                      a different aspect of market health (momentum, valuation, sentiment, etc.).
                      <br />
                      <br />
                      <strong className="text-red-600">HIGH RISK</strong> signals are severe and historically precede
                      significant market declines.
                      <br />
                      <strong className="text-yellow-600">MEDIUM RISK</strong> signals warrant attention but are less
                      urgent.
                      <br />
                      <br />
                      The more signals that fire together, the higher the crash probability.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-3xl font-bold text-orange-600 cursor-help">
                    {activeCanariesCount}/{indicatorCount ?? "—"}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  className="max-w-xs bg-white text-gray-900 border border-gray-200 shadow-lg p-3"
                >
                  <p className="text-sm">
                    <strong>
                      {activeCanariesCount} out of {indicatorCount ?? "—"}
                    </strong>{" "}
                    warning signals are currently active.
                    <br />
                    <br />• <strong>0-5 signals:</strong> Low risk environment
                    <br />• <strong>6-12 signals:</strong> Elevated caution needed
                    <br />• <strong>13+ signals:</strong> High risk - consider defensive strategies
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <CardDescription className="text-base mt-2">
              Last Updated: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : "Loading..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedCanaries
                .filter((canary) => canary.severity === "high" || canary.severity === "medium")
                .map((canary, i) => {
                  const severityConfig = {
                    high: {
                      bgColor: "bg-red-100",
                      textColor: "text-red-900",
                      borderColor: "border-red-400",
                      badgeColor: "bg-red-600 text-white",
                      label: "HIGH RISK",
                    },
                    medium: {
                      bgColor: "bg-yellow-100",
                      textColor: "text-yellow-900",
                      borderColor: "border-yellow-400",
                      badgeColor: "bg-yellow-600 text-white",
                      label: "MEDIUM RISK",
                    },
                    // Low-severity canaries are filtered out above; map them to
                    // medium so the lookup is total for the type system.
                  }[canary.severity === "high" ? "high" : "medium"]

                  const uniqueKey = `${canary.signal}-${i}`

                  return tooltipsEnabled ? (
                    <Tooltip key={uniqueKey}>
                      <TooltipTrigger asChild>
                        <div className="h-full">
                          <div
                            className={`p-4 rounded-lg border-2 cursor-help hover:shadow-md transition-shadow ${severityConfig.bgColor} ${severityConfig.borderColor} h-full`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <Badge variant="outline" className="text-xs font-semibold">
                                {canary.pillar}
                              </Badge>
                              <span
                                className={`text-xs font-bold px-3 py-1 rounded-md ${severityConfig.badgeColor} shadow-sm whitespace-nowrap flex items-center gap-1`}
                              >
                                {severityConfig.label}
                                <Info className="h-3 w-3" />
                              </span>
                            </div>
                            <p className={`text-sm font-semibold ${severityConfig.textColor}`}>{canary.signal}</p>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="max-w-sm bg-white text-gray-900 border border-gray-200 shadow-lg p-3"
                      >
                        <p className="text-sm">{getSignalTooltip(canary.signal)}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <div key={uniqueKey} className="h-full">
                      <div
                        className={`p-4 rounded-lg border-2 transition-shadow ${severityConfig.bgColor} ${severityConfig.borderColor} h-full`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Badge variant="outline" className="text-xs font-semibold">
                            {canary.pillar}
                          </Badge>
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-md ${severityConfig.badgeColor} shadow-sm whitespace-nowrap`}
                          >
                            {severityConfig.label}
                          </span>
                        </div>
                        <p className={`text-sm font-semibold ${severityConfig.textColor}`}>{canary.signal}</p>
                      </div>
                    </div>
                  )
                })}
            </div>
            {sortedCanaries.filter((c) => c.severity === "high" || c.severity === "medium").length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-green-700 font-medium">No medium or high severity warnings detected</p>
              </div>
            )}
          </CardContent>
        </Card>
    </>
  )
}
