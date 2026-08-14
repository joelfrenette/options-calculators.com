"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { Database } from "lucide-react"
import { ConditionalTooltip } from "@/components/ui/conditional-tooltip"
import { getSentimentLabel } from "./format"
import type { SentimentData } from "./sentiment-types"

interface HeadlineCardProps {
  data: SentimentData | null
  lastUpdated: Date | null
  isFromCache: boolean
  fetchError: string | null
  loading: boolean
  tooltipsEnabled: boolean
  onToggleTooltips: (enabled: boolean) => void
  onRefresh: () => void
}

export function HeadlineCard({
  data,
  lastUpdated,
  isFromCache,
  fetchError,
  loading,
  tooltipsEnabled,
  onToggleTooltips,
  onRefresh,
}: HeadlineCardProps) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">Social Sentiment Indicator</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              {lastUpdated ? (
                <>
                  Last updated: {lastUpdated.toLocaleString()}
                  {isFromCache && (
                    <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-medium">
                      <Database className="h-3 w-3" />
                      Cached
                    </span>
                  )}
                </>
              ) : (
                <span className="text-amber-600">Click Refresh to load data</span>
              )}
            </p>
            {/* Failed fetches used to be console-only — the tab silently
                showed stale cache as if fresh (P6-15). */}
            {fetchError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mt-1">
                {fetchError}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <TooltipsToggle enabled={tooltipsEnabled} onToggle={onToggleTooltips} />
            <RefreshButton onRefresh={onRefresh} isLoading={loading} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <ConditionalTooltip enabled={tooltipsEnabled} content="Global Social Sentiment aggregates sentiment from news, social media, and market data. Scores 0-24 (Extreme Bearish) signal fear, good for selling puts. Scores 75-100 (Extreme Bullish) signal greed, consider protective strategies. Contrarian traders often fade extremes.">
            <div className="relative cursor-help">
              <div className="relative h-20 rounded-lg overflow-hidden shadow-sm border border-gray-300">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-lg shadow-inner" />

                <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-bold">
                  {/* Extreme Bullish - LEFT/GREEN */}
                  <div className="text-center text-white drop-shadow-lg">
                    <div className="text-base">EXTREME</div>
                    <div>BULLISH</div>
                    <div className="text-[10px] mt-1">81-100</div>
                  </div>
                  {/* Bullish */}
                  <div className="text-center text-white drop-shadow-lg">
                    <div>BULLISH</div>
                    <div className="text-[10px] mt-1">61-80</div>
                  </div>
                  {/* Neutral */}
                  <div className="text-center text-gray-800 drop-shadow">
                    <div>NEUTRAL</div>
                    <div className="text-[10px] mt-1">41-60</div>
                  </div>
                  {/* Bearish */}
                  <div className="text-center text-white drop-shadow-lg">
                    <div>BEARISH</div>
                    <div className="text-[10px] mt-1">21-40</div>
                  </div>
                  {/* Extreme Bearish - RIGHT/RED */}
                  <div className="text-center text-white drop-shadow-lg">
                    <div className="text-base">EXTREME</div>
                    <div>BEARISH</div>
                    <div className="text-[10px] mt-1">0-20</div>
                  </div>
                </div>
              </div>

              {/* A needle is a POSITION claim. With no reading there is no
                  position to claim, and parking it at 50% draws a "Neutral"
                  that nobody measured — so the gauge is covered instead. */}
              {data && data.global_social_sentiment == null && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-200/90">
                  <span className="text-sm font-semibold text-gray-600">No live sentiment reading</span>
                </div>
              )}
              {data && data.global_social_sentiment != null && (
                <div
                  className="absolute top-0 bottom-0 w-2 bg-black shadow-lg transition-all duration-500"
                  style={{ left: `calc(${100 - data.global_social_sentiment}% - 4px)` }}
                >
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <div className="bg-black text-white px-4 py-2 rounded-lg shadow-xl">
                      <div className="text-xs font-semibold">TODAY</div>
                      <div className="text-2xl font-bold">{Math.round(data.global_social_sentiment)}</div>
                      <div className="text-xs text-center">{getSentimentLabel(data.global_social_sentiment)}</div>
                    </div>
                    <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-black mx-auto" />
                  </div>
                </div>
              )}
            </div>
          </ConditionalTooltip>

          <div className="grid grid-cols-2 gap-6 mt-8">
            <ConditionalTooltip enabled={tooltipsEnabled} content="Macro Sentiment tracks institutional and economic indicators like bond yields, currency moves, and cross-asset flows. Low readings suggest risk-off environment - favor defined-risk strategies. High readings indicate risk-on, suitable for directional plays.">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 cursor-help">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Macro Sentiment</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {data?.macro_sentiment != null ? Math.round(data.macro_sentiment) : "—"}
                  </span>
                </div>
                <div className="relative h-3 rounded-full overflow-hidden mb-1">
                  {/* Green/bullish LEFT, red/bearish RIGHT */}
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500" />
                  {data?.macro_sentiment == null ? (
                    <div className="absolute inset-0 bg-gray-200" />
                  ) : (
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-gray-900 rounded"
                      style={{
                        left: `${100 - data.macro_sentiment}%`,
                        transform: "translateX(-50%)",
                      }}
                    />
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {data?.macro_sentiment != null ? getSentimentLabel(data.macro_sentiment) : "no data"}
                </div>
              </div>
            </ConditionalTooltip>
            <ConditionalTooltip enabled={tooltipsEnabled} content="Social Sentiment measures retail trader mood from StockTwits and financial news. Extreme bullish readings often precede reversals - consider selling premium. Extreme bearish readings may signal capitulation - look for mean reversion plays.">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 cursor-help">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Social Sentiment</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {data?.social_sentiment != null ? Math.round(data.social_sentiment) : "—"}
                  </span>
                </div>
                <div className="relative h-3 rounded-full overflow-hidden mb-1">
                  {/* Green/bullish LEFT, red/bearish RIGHT */}
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500" />
                  {data?.social_sentiment == null ? (
                    <div className="absolute inset-0 bg-gray-200" />
                  ) : (
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-gray-900 rounded"
                      style={{
                        left: `${100 - data.social_sentiment}%`,
                        transform: "translateX(-50%)",
                      }}
                    />
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {data?.social_sentiment != null ? getSentimentLabel(data.social_sentiment) : "no data"}
                </div>
              </div>
            </ConditionalTooltip>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
