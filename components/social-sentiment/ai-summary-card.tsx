"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { RunScenarioInAIDialog } from "@/components/run-scenario-ai-dialog"
import { Info, TrendingUp, Activity, Sparkles } from "lucide-react"
import { getSentimentLabel, getSentimentInterpretation, fmtScore, srcCount } from "./format"
import type { SentimentData } from "./sentiment-types"

export function AiSummaryCard({ data, lastUpdated }: { data: SentimentData | null; lastUpdated: Date | null }) {
  return (
    <Card className="shadow-sm border-teal-200 bg-gradient-to-br from-teal-50 to-white">
      <CardHeader className="border-b border-teal-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-600" />
              AI Executive Summary
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm bg-white border shadow-lg">
                    <p className="font-semibold text-sm">AI-Powered Analysis</p>
                    <p className="text-xs text-gray-600">
                      Real-time analysis of social sentiment and its impact on options trading strategies.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </div>
          <RunScenarioInAIDialog
            context={{
              type: "sentiment",
              title: "Social Sentiment Analysis",
              // A missing score is missing, not 50. `?? 50` handed the AI a
              // neutral reading nobody measured and then read a strategy off
              // it — the P6-19 defect, one tab over.
              details:
                data?.global_social_sentiment == null
                  ? `No live sentiment reading is available (${srcCount(data?.sources_available)}/${srcCount(data?.sources_total)} sources responded, data quality ${data?.data_quality || "NONE"}). Do not infer a neutral market from the absence of a score, and do not recommend a strategy from it.`
                  : `Current global sentiment score: ${data.global_social_sentiment}/100 (${getSentimentLabel(data.global_social_sentiment)}). Macro sentiment: ${fmtScore(data.macro_sentiment)}. Social sentiment: ${fmtScore(data.social_sentiment)}. Headline mood: ${fmtScore(data.headline_market_mood)}. Data quality: ${data.data_quality || "N/A"} with ${srcCount(data.sources_available)}/${srcCount(data.sources_total)} sources available. ${data.global_social_sentiment >= 70 ? "Bullish conditions - consider selling puts or buying calls." : data.global_social_sentiment <= 30 ? "Bearish conditions - consider defensive strategies or puts." : "Neutral conditions - consider iron condors or strangles."}`,
            }}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-teal-800 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Current Sentiment Analysis
          </h4>
          <p className="text-sm text-gray-700 leading-relaxed">
            {data?.executive_summary ||
              (data?.global_social_sentiment == null
                ? "No live sentiment source returned a reading, so there is no score to interpret. Missing data is not a neutral market."
                : `Social sentiment is currently at ${data.global_social_sentiment}/100 (${getSentimentLabel(
                    data.global_social_sentiment,
                  )}). ${getSentimentInterpretation(data.global_social_sentiment)}`)}
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-bold text-teal-800 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Weekly Outlook
          </h4>
          {(() => {
            // No score means no strategy list. The old `?? 0` fell through to
            // the bullish-contrarian branch and recommended trades off a
            // reading that did not exist.
            const strategies =
              data?.recommended_strategies && data.recommended_strategies.length > 0
                ? data.recommended_strategies
                : data?.global_social_sentiment == null
                  ? []
                  : data.global_social_sentiment >= 60
                    ? ["Sell call credit spreads", "Protective puts on longs", "Iron condors on high IV"]
                    : data.global_social_sentiment >= 40
                      ? ["Iron condors on indices", "Calendar spreads", "Covered calls"]
                      : ["Bull put spreads at support", "Cash-secured puts", "Long calls on quality names"]

            if (strategies.length === 0) {
              return (
                <p className="text-sm text-gray-500 italic">
                  No strategy suggestions — there is no live sentiment reading to base them on.
                </p>
              )
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {strategies.map((strategy, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-teal-50 rounded-lg border border-teal-200 text-sm font-medium text-teal-800"
                  >
                    {strategy}
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-teal-100 text-xs text-gray-500">
          <span>
            Data Quality: {data?.data_quality || "NONE"} ({srcCount(data?.sources_available)}/
            {srcCount(data?.sources_total)} sources)
          </span>
          {lastUpdated && <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
