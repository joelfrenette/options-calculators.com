"use client"

/**
 * The expected rate path card.
 *
 * Split out of `components/fomc-predictions.tsx` (P6-13) unchanged. What it
 * closed over is now props.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "./info-tooltip"
import type { NextMeeting, RatePath } from "./fomc-types"

export function RatePathSection({
  ratePath,
  nextMeeting,
  tooltipsEnabled,
}: {
  ratePath: RatePath | null
  nextMeeting: NextMeeting | null
  tooltipsEnabled: boolean
}) {
  return (
    <>
        {ratePath && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-1">
                Expected Rate Path
                <InfoTooltip enabled={tooltipsEnabled} content="Shows where markets expect rates to be over time. A downward path suggests rate cuts coming (bullish for stocks). An upward path suggests more hikes (bearish). Use this to plan longer-dated options strategies." />
              </CardTitle>
              <CardDescription>Historical and projected Fed Funds rate over time</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-2">Last Meeting</p>
                  <div className="bg-gray-100 rounded-lg p-3 border-2 border-gray-300">
                    <p className="text-2xl font-bold text-gray-900">
                      {ratePath.previousMeeting === null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        `${ratePath.previousMeeting.toFixed(2)}%`
                      )}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">~45 sessions ago</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ratePath.previousMeeting === null ? "(Insufficient data)" : "(Historical)"}
                  </p>
                </div>

                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-2">Current</p>
                  <div className="bg-blue-100 rounded-lg p-3 border-2 border-blue-400">
                    <p className="text-2xl font-bold text-blue-900">{ratePath.current.toFixed(2)}%</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Today</p>
                  <p className="text-xs text-gray-400 mt-0.5">(Real-time)</p>
                </div>

                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-2">Next Meeting</p>
                  <div className="bg-green-50 rounded-lg p-3 border-2 border-green-300">
                    <p className="text-2xl font-bold text-green-900">{ratePath.nextMeeting.toFixed(2)}%</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{nextMeeting?.daysUntil} days</p>
                  <p className="text-xs text-gray-400 mt-0.5">(Predicted)</p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-700">
                  <span className="font-semibold">Note:</span> Historical rates from FRED data (real). Future
                  projections based on market pricing, economic indicators, and FOMC meeting schedule. Predictions may
                  change as economic data evolves.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

    </>
  )
}
