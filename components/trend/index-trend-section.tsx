"use client"

/**
 * The index picker row.
 *
 * Split out of `components/trend-analysis.tsx` (P6-13) unchanged. What it closed
 * over is now props.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { Button } from "@/components/ui/button"
import { Activity, AlertTriangle, Info, Shield, Target, TrendingUp } from "lucide-react"
/** The three indexes this tab can show. Widening it here would let the picker
 * set a ticker the payload has no entry for. */
export type TrendTicker = "SPY" | "QQQ" | "SPX"

import type { TrendAnalysisData } from "./trend-types"

export function IndexTrendSection({
  data,
  selectedTicker,
  setSelectedTicker,
  loading,
  fetchData,
}: {
  data: TrendAnalysisData
  selectedTicker: TrendTicker
  setSelectedTicker: (t: TrendTicker) => void
  loading: boolean
  fetchData: () => void
}) {
  return (
    <>
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900">Index Trend Analysis & Forecast</CardTitle>
                <CardDescription>Real-time trends and options strategies for major index funds</CardDescription>
              </div>
              <RefreshButton onClick={fetchData} isLoading={loading} />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex gap-2 mb-6">
              {data.indices.map((item) => (
                <button
                  key={item.name}
                  onClick={() => setSelectedTicker(item.name as "SPY" | "SPX" | "QQQ")}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                    selectedTicker === item.name
                      ? "bg-green-50 border-green-200 shadow-sm"
                      : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-lg font-bold text-gray-900">{item.name}</span>
                    {/* `?? 0` printed "+0.000%" — a flat day — whenever the
                        change was unavailable. */}
                    {item.changePercent === null || item.changePercent === undefined ? (
                      <span className="text-gray-400" title={`Close of ${item.priceAsOf ?? "an earlier session"}; no live quote`}>
                        —
                      </span>
                    ) : (
                      <span className={item.changePercent >= 0 ? "text-green-600" : "text-red-600"}>
                        {item.changePercent >= 0 ? "+" : ""}
                        {item.changePercent.toFixed(3)}%
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

    </>
  )
}
