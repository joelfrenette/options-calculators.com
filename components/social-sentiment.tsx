"use client"

import type React from "react"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { Badge } from "@/components/ui/badge"
import { RunScenarioInAIDialog } from "@/components/run-scenario-ai-dialog"
import {
  Info,
  TrendingUp,
  Activity,
  BarChart3,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Database,
} from "lucide-react"

interface SentimentData {
  global_social_sentiment: number
  macro_sentiment: number
  social_sentiment: number
  headline_market_mood: number
  api_version?: string
  timestamp?: string
  sources_available?: number
  sources_total?: number
  data_quality?: string
  indicators?: Array<{
    name: string
    score: number | null
    weight: number
    status: string
    source: string
    description: string
  }>
  sources?: Array<{
    name: string
    score: number
    weight: number
    source: string
  }>
  executive_summary?: string
  weekly_outlook?: string
  recommended_strategies?: string[]
  per_symbol?: Array<{
    symbol: string
    name: string
    sentiment: number
    direction?: string
    stocktwits_sentiment?: number | null
    reddit_sentiment?: number | null
    twitter_sentiment?: number | null
    google_trends?: number | null
  }>
}

interface SentimentIndicator {
  name: string
  score: number
  status: string
  description: string
  isLive: boolean
}

// Sentiment interpretation buckets
function getSentimentLabel(score: number): string {
  if (score >= 80) return "Extreme Bullish"
  if (score >= 60) return "Bullish"
  if (score >= 40) return "Neutral"
  if (score >= 20) return "Bearish"
  return "Extreme Bearish"
}

function safeNumber(value: number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined || isNaN(value)) {
    return fallback
  }
  return value
}

function getSentimentColor(score: number): string {
  if (score >= 80) return "bg-green-600"
  if (score >= 60) return "bg-green-500"
  if (score >= 40) return "bg-gray-400"
  if (score >= 20) return "bg-orange-500"
  return "bg-red-600"
}

function getSentimentInterpretation(score: number): string {
  if (score >= 75) return "Very high optimism - consider contrarian bearish positions"
  if (score >= 60) return "Bullish sentiment - momentum favors long positions"
  if (score >= 45) return "Neutral - market lacks clear direction"
  if (score >= 30) return "Bearish sentiment - caution on long positions"
  return "Extreme pessimism - contrarian bullish opportunity possible"
}

// Mini pill gauge
function SentimentPill({ value, label }: { value: number; label: string }) {
  const percentage = Math.min(100, Math.max(0, value))

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-gray-700">{label}</span>
          <span className="text-lg font-bold text-gray-900">{Math.round(value)}</span>
        </div>
        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 ${getSentimentColor(value)} transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-1">{getSentimentLabel(value)}</div>
      </div>
    </div>
  )
}

// Sentiment indicator row component
function SentimentIndicatorRow({ indicator }: { indicator: SentimentIndicator }) {
  const score = indicator.score ?? 0
  const isLive = indicator.isLive

  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{indicator.name}</span>
          <Badge variant={isLive ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
            {isLive ? "LIVE" : "N/A"}
          </Badge>
        </div>
        <span className={`text-sm font-bold ${isLive ? "text-gray-900" : "text-gray-400"}`}>
          {isLive ? Math.round(score) : "No data"}
        </span>
      </div>
      <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
        {isLive ? (
          <>
            <div className="absolute inset-y-0 left-0 bg-green-500" />
            <div className="absolute inset-y-0 right-0 bg-red-500" />
            <div className="absolute inset-y-0 bg-yellow-400" style={{ width: `${score}%` }} />
          </>
        ) : (
          <div className="absolute inset-0 bg-gray-200 opacity-80" />
        )}
      </div>
      <p className="text-xs text-gray-500 mt-1">{indicator.description}</p>
    </div>
  )
}

function ConditionalTooltip({ children, content }: { children: React.ReactNode; content: string }) {
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  if (!tooltipsEnabled) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-xs text-sm">
        <p>{content}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export function SocialSentiment() {
  const [data, setData] = useState<SentimentData | null>(null)
  const [loading, setLoading] = useState(false)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingSource, setLoadingSource] = useState("")
  const [isFromCache, setIsFromCache] = useState(false)
  const [needsInitialFetch, setNeedsInitialFetch] = useState(false)

  const CACHE_KEY = "social_sentiment_cache_v6"
  const CACHE_TIMESTAMP_KEY = "social_sentiment_cache_timestamp_v6"

  const fetchSentiment = useCallback(async () => {
    setLoading(true)
    setLoadingProgress(0)
    setIsFromCache(false)

    const sources = [
      "Initializing...",
      "Fetching Grok AI sentiment...",
      "Fetching Google Trends...",
      "Fetching AAII Survey...",
      "Fetching CNN Fear & Greed...",
      "Fetching StockTwits...",
      "Fetching Finnhub News...",
      "Fetching Reddit sentiment...",
      "Fetching Yahoo Finance...",
      "Generating AI summary...",
      "Finalizing data...",
    ]

    let progress = 0
    const progressInterval = setInterval(() => {
      progress += Math.random() * 15
      if (progress > 90) progress = 90
      setLoadingProgress(Math.min(progress, 90))
      const sourceIndex = Math.floor((progress / 100) * sources.length)
      setLoadingSource(sources[Math.min(sourceIndex, sources.length - 1)])
    }, 300)

    try {
      const response = await fetch("/api/social-sentiment")

      clearInterval(progressInterval)
      setLoadingProgress(95)
      setLoadingSource("Processing results...")

      if (response.ok) {
        const result = await response.json()
        setData(result)
        setLastUpdated(new Date())
        localStorage.setItem(CACHE_KEY, JSON.stringify(result))
        localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
        setLoadingProgress(100)
        setLoadingSource("Complete!")
      } else {
        console.error("[v0] Social sentiment API error:", response.status)
      }
    } catch (error) {
      clearInterval(progressInterval)
      console.error("[v0] Error fetching social sentiment data:", error)
    } finally {
      setTimeout(() => {
        setLoading(false)
        setLoadingProgress(0)
        setLoadingSource("")
      }, 500)
    }
  }, [])

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY)
    const cacheTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)

    if (cached) {
      try {
        setData(JSON.parse(cached))
        setLastUpdated(cacheTimestamp ? new Date(Number.parseInt(cacheTimestamp)) : null)
        setIsFromCache(true)
      } catch {
        // Cache parse failed, need to fetch
        setNeedsInitialFetch(true)
      }
    } else {
      // No cache exists, need to fetch
      setNeedsInitialFetch(true)
    }
  }, [])

  useEffect(() => {
    if (needsInitialFetch && !loading) {
      fetchSentiment()
      setNeedsInitialFetch(false)
    }
  }, [needsInitialFetch, loading, fetchSentiment])

  const handleRefresh = () => {
    fetchSentiment()
  }

  const allIndicators = data?.indicators || []
  const uniqueIndicators: SentimentIndicator[] = Array.from(
    new Map(
      allIndicators.map((ind) => [
        ind.name,
        {
          name: ind.name,
          score: ind.score ?? 0,
          status: ind.status,
          description: ind.description,
          isLive: ind.status === "LIVE" && ind.score !== null && ind.score >= 0,
        },
      ]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name))

  const indexData = (data?.per_symbol || []).filter((s) => ["SPY", "QQQ", "IWM", "DIA"].includes(s.symbol))

  return (
    <TooltipProvider>
      <div className="space-y-6">
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
              </div>
              <div className="flex items-center gap-3">
                <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
                <RefreshButton onRefresh={handleRefresh} isLoading={loading} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <ConditionalTooltip content="Global Social Sentiment aggregates sentiment from news, social media, and market data. Scores 0-24 (Extreme Bearish) signal fear, good for selling puts. Scores 75-100 (Extreme Bullish) signal greed, consider protective strategies. Contrarian traders often fade extremes.">
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

                  {data && (
                    <div
                      className="absolute top-0 bottom-0 w-2 bg-black shadow-lg transition-all duration-500"
                      style={{ left: `calc(${100 - safeNumber(data.global_social_sentiment, 50)}% - 4px)` }}
                    >
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        <div className="bg-black text-white px-4 py-2 rounded-lg shadow-xl">
                          <div className="text-xs font-semibold">TODAY</div>
                          <div className="text-2xl font-bold">
                            {Math.round(safeNumber(data.global_social_sentiment, 50))}
                          </div>
                          <div className="text-xs text-center">
                            {getSentimentLabel(safeNumber(data.global_social_sentiment, 50))}
                          </div>
                        </div>
                        <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-black mx-auto" />
                      </div>
                    </div>
                  )}
                </div>
              </ConditionalTooltip>

              <div className="grid grid-cols-2 gap-6 mt-8">
                <ConditionalTooltip content="Macro Sentiment tracks institutional and economic indicators like bond yields, currency moves, and cross-asset flows. Low readings suggest risk-off environment - favor defined-risk strategies. High readings indicate risk-on, suitable for directional plays.">
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 cursor-help">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-700">Macro Sentiment</span>
                      <span className="text-2xl font-bold text-gray-900">
                        {Math.round(safeNumber(data?.macro_sentiment, 47))}
                      </span>
                    </div>
                    <div className="relative h-3 rounded-full overflow-hidden mb-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500" />
                      <div
                        className="absolute top-0 bottom-0 right-0 bg-gray-200"
                        style={{ width: `${safeNumber(data?.macro_sentiment, 47)}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-gray-800 rounded"
                        style={{
                          left: `${100 - safeNumber(data?.macro_sentiment, 47)}%`,
                          transform: "translateX(-50%)",
                        }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {getSentimentLabel(safeNumber(data?.macro_sentiment, 47))}
                    </div>
                  </div>
                </ConditionalTooltip>
                <ConditionalTooltip content="Social Sentiment measures retail trader mood from Reddit, Twitter, and StockTwits. Extreme bullish readings often precede reversals - consider selling premium. Extreme bearish readings may signal capitulation - look for mean reversion plays.">
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 cursor-help">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-700">Social Sentiment</span>
                      <span className="text-2xl font-bold text-gray-900">
                        {Math.round(safeNumber(data?.social_sentiment, 54))}
                      </span>
                    </div>
                    <div className="relative h-3 rounded-full overflow-hidden mb-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500" />
                      <div
                        className="absolute top-0 bottom-0 right-0 bg-gray-200"
                        style={{ width: `${safeNumber(data?.social_sentiment, 54)}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-gray-800 rounded"
                        style={{
                          left: `${100 - safeNumber(data?.social_sentiment, 54)}%`,
                          transform: "translateX(-50%)",
                        }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {getSentimentLabel(safeNumber(data?.social_sentiment, 54))}
                    </div>
                  </div>
                </ConditionalTooltip>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-teal-600" />
              Macro Sentiment Indicators
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm bg-white border shadow-lg">
                    <p className="font-semibold text-sm">Index Sentiment Heatmap</p>
                    <p className="text-xs text-gray-600">
                      Blended sentiment for major indices from social media, AI analysis, and news sources.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              AI-powered sentiment from social media discussions and news analysis
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
                  const score = safeNumber(item.sentiment, 50)
                  const direction = item.direction || (score >= 55 ? "Bullish" : score >= 45 ? "Neutral" : "Bearish")
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

                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl font-bold text-gray-900">{Math.round(score)}</span>
                        <span className="text-sm text-gray-500">/100</span>
                      </div>

                      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500" />
                        <div className="absolute top-0 bottom-0 right-0 bg-gray-200" style={{ width: `${score}%` }} />
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-gray-800 rounded"
                          style={{ left: `${100 - score}%`, transform: "translateX(-50%)" }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">StockTwits:</span>
                          <span className="font-medium">{Math.round(safeNumber(item.stocktwits_sentiment, 50))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Reddit:</span>
                          <span className="font-medium">{Math.round(safeNumber(item.reddit_sentiment, 50))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Twitter:</span>
                          <span className="font-medium">{Math.round(safeNumber(item.twitter_sentiment, 50))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Trends:</span>
                          <span className="font-medium">{Math.round(safeNumber(item.google_trends, 50))}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

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
                    <p className="text-sm">All sentiment data sources sorted alphabetically with real-time status.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {uniqueIndicators.map((indicator, idx) => (
              <SentimentIndicatorRow key={idx} indicator={indicator} />
            ))}
          </CardContent>
        </Card>

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
                  details: `Current global sentiment score: ${data?.global_social_sentiment ?? 50}/100 (${getSentimentLabel(data?.global_social_sentiment ?? 50)}). Macro sentiment: ${data?.macro_sentiment ?? 50}/100. Social sentiment: ${data?.social_sentiment ?? 50}/100. Headline mood: ${data?.headline_market_mood ?? 50}/100. Data quality: ${data?.data_quality || "N/A"} with ${data?.sources_available || 0}/${data?.sources_total || 0} sources available. ${(data?.global_social_sentiment ?? 50) >= 70 ? "Bullish conditions - consider selling puts or buying calls." : (data?.global_social_sentiment ?? 50) <= 30 ? "Bearish conditions - consider defensive strategies or puts." : "Neutral conditions - consider iron condors or strangles."}`,
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
                  `Social sentiment is currently at ${data?.global_social_sentiment ?? 50}/100 (${getSentimentLabel(
                    data?.global_social_sentiment ?? 50,
                  )}). ${getSentimentInterpretation(data?.global_social_sentiment ?? 50)}`}
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-teal-800 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Weekly Outlook
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(data?.recommended_strategies && data?.recommended_strategies.length > 0
                  ? data?.recommended_strategies
                  : data?.global_social_sentiment >= 60
                    ? ["Sell call credit spreads", "Protective puts on longs", "Iron condors on high IV"]
                    : data?.global_social_sentiment >= 40
                      ? ["Iron condors on indices", "Calendar spreads", "Covered calls"]
                      : ["Bull put spreads at support", "Cash-secured puts", "Long calls on quality names"]
                ).map((strategy, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-teal-50 rounded-lg border border-teal-200 text-sm font-medium text-teal-800"
                  >
                    {strategy}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-teal-100 text-xs text-gray-500">
              <span>
                Data Quality: {data?.data_quality || "MEDIUM"} ({data?.sources_available || 0}/
                {data?.sources_total || 10} sources)
              </span>
              {lastUpdated && <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
