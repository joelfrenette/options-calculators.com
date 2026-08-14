"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info, TrendingUp, Activity, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react"
import { safeNumber } from "./format"
import type { SentimentData } from "./sentiment-types"

type PerSymbolRow = NonNullable<SentimentData["per_symbol"]>[number]

export function IndexHeatmapCard({ indexData }: { indexData: PerSymbolRow[] }) {
  return (
    <Card className="shadow-sm border-gray-200">
      <CardHeader className="bg-gray-50 border-b border-gray-200">
        <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-teal-600" />
          Index Sentiment by Symbol
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm bg-white border shadow-lg">
                <p className="font-semibold text-sm">Index Sentiment Heatmap</p>
                <p className="text-xs text-gray-600">
                  Live per-symbol sentiment from StockTwits bullish/bearish message tags. Shows "No live data"
                  when there isn&apos;t enough recent activity to score.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          Live, symbol-specific sentiment from StockTwits bullish/bearish tags. Higher (left/green) is more bullish.
        </p>
      </CardHeader>
      <CardContent className="pt-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal-600" />
            Major Indices
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {indexData.map((item) => {
              const hasData = item.sentiment !== null && item.sentiment !== undefined
              const score = Math.min(100, Math.max(0, item.sentiment ?? 0))
              const direction = !hasData
                ? "No data"
                : item.direction || (score >= 55 ? "Bullish" : score >= 45 ? "Neutral" : "Bearish")
              const DirectionIcon =
                direction === "Bullish" ? ArrowUpRight : direction === "Bearish" ? ArrowDownRight : Minus
              const directionColor =
                direction === "Bullish"
                  ? "text-green-600"
                  : direction === "Bearish"
                    ? "text-red-600"
                    : "text-gray-500"

              return (
                <div
                  key={item.symbol}
                  className="p-4 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-bold text-lg text-gray-900">{item.symbol}</span>
                      <span className="text-xs text-gray-500 ml-2">{item.name}</span>
                    </div>
                    <div className={`flex items-center gap-1 ${directionColor}`}>
                      <DirectionIcon className="h-4 w-4" />
                      <span className="text-sm font-semibold">{direction}</span>
                    </div>
                  </div>

                  {hasData ? (
                    <>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl font-bold text-gray-900">{Math.round(score)}</span>
                        <span className="text-sm text-gray-500">/100</span>
                      </div>

                      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                        {/* Green/bullish LEFT, red/bearish RIGHT */}
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500" />
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-gray-900 rounded"
                          style={{ left: `${100 - score}%`, transform: "translateX(-50%)" }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          {safeNumber(item.bullish, 0)} bullish / {safeNumber(item.bearish, 0)} bearish tags
                        </span>
                        <span className="text-teal-600 font-medium">{item.source}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                      <span className="text-sm font-medium text-gray-400">No live data</span>
                      <span className="text-xs text-gray-400 mt-1">
                        Not enough StockTwits activity to score right now
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
