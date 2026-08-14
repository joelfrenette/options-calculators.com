"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Info, BarChart3 } from "lucide-react"
import { getSentimentLabel } from "./format"
import type { SentimentIndicator } from "./sentiment-types"

// Sentiment indicator row component
// Orientation: LEFT = green/bullish (high score), RIGHT = red/bearish (low score).
function SentimentIndicatorRow({ indicator }: { indicator: SentimentIndicator }) {
  const score = Math.min(100, Math.max(0, indicator.score ?? 0))
  const isLive = indicator.isLive
  const scoreColor = !isLive
    ? "text-gray-400"
    : score >= 60
      ? "text-green-600"
      : score >= 40
        ? "text-gray-600"
        : "text-red-600"

  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{indicator.name}</span>
          <Badge variant={isLive ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
            {isLive ? "LIVE" : "No data"}
          </Badge>
          {isLive && (
            <span className={`text-[10px] font-semibold ${scoreColor}`}>{getSentimentLabel(score)}</span>
          )}
        </div>
        <span className={`text-sm font-bold ${scoreColor}`}>{isLive ? Math.round(score) : "No data"}</span>
      </div>
      <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
        {isLive ? (
          <>
            {/* Green (bullish) on the LEFT, red (bearish) on the RIGHT */}
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500" />
            {/* Marker: high score sits on the left (green), low score on the right (red) */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-gray-900 rounded"
              style={{ left: `${100 - score}%`, transform: "translateX(-50%)" }}
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-gray-200 opacity-80" />
        )}
      </div>
      <p className="text-xs text-gray-500 mt-1">{indicator.description}</p>
    </div>
  )
}

export function IndicatorsCard({ indicators }: { indicators: SentimentIndicator[] }) {
  return (
    <Card className="shadow-sm border-gray-200">
      <CardHeader className="bg-gray-50 border-b border-gray-200">
        <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-teal-600" />
          Social Sentiment Indicators
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm bg-white border shadow-lg">
                <p className="text-sm">
                  Every source pulls live data and is reliability-weighted into the headline score. Sources with no
                  live reading show &quot;No data&quot; and are excluded from the average. Sorted alphabetically.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            Left = Bullish (good)
          </span>
          <span className="flex items-center gap-1.5">
            Right = Bearish (bad)
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {indicators.map((indicator, idx) => (
          <SentimentIndicatorRow key={idx} indicator={indicator} />
        ))}
      </CardContent>
    </Card>
  )
}
