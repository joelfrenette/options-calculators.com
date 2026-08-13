"use client"

/**
 * The acute conditions adding bonus points on top of the base index.
 *
 * Split out of `components/ccpi-dashboard.tsx` (P6-13) unchanged. What it closed
 * over is now props.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Activity, AlertTriangle, Info, Sparkles, TrendingDown } from "lucide-react"
import type { CCPIData } from "@/lib/ccpi/types"
import { getCrashAmplifierTooltip } from "@/components/ccpi/tooltip-copy"

export function CrashAmplifiersCard({
  data,
}: {
  data: CCPIData
}) {
  return (
    <>
        {data.crashAmplifiers && data.crashAmplifiers.length > 0 && (
          <Card className="border-4 border-red-600 bg-gradient-to-r from-red-50 to-orange-50 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-red-700">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help border-b border-dashed border-red-400">
                      {/* P7-6. `|| 0` read "+0 BONUS POINTS" under a heading
                          saying amplifiers are ACTIVE — a contradiction, and the
                          reassuring half of it. Same rule as P6-20(a): a +0
                          bonus must not be read as "no acute event" when it
                          means "could not check". */}
                      CRASH AMPLIFIERS ACTIVE +{typeof data.totalBonus === "number" ? data.totalBonus : "—"} BONUS
                      POINTS
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="max-w-sm bg-white text-gray-900 border border-gray-200 shadow-lg p-3"
                  >
                    <p className="text-sm">
                      <strong>What are Crash Amplifiers?</strong>
                      <br />
                      These are extreme market conditions that historically appear before major crashes. When detected,
                      they add "bonus points" to the CCPI score because they significantly increase crash risk. Multiple
                      amplifiers firing together is a serious warning sign that demands defensive positioning.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription className="text-red-700 font-medium">
                {data.baseCCPI && data.totalBonus
                  ? `Multiple extreme crash signals detected - CCPI boosted from ${data.baseCCPI} to ${data.ccpi}`
                  : "Multiple extreme crash signals detected"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.crashAmplifiers?.map((amp, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border-2 border-red-300 cursor-help hover:border-red-500 transition-colors">
                        <span className="text-sm font-semibold text-red-900">{amp.reason}</span>
                        <Badge className="bg-red-600 text-white text-base font-bold">+{amp.points}</Badge>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="max-w-xs bg-white text-gray-900 border border-gray-200 shadow-lg p-3"
                    >
                      <p className="text-sm">{getCrashAmplifierTooltip(amp.reason)}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
    </>
  )
}
