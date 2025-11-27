"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info, Search, TrendingUp, Activity, BarChart3 } from "lucide-react"
import { Input } from "@/components/ui/input"

interface SocialSentimentData {
  meta: {
    universe: string
    range: string
    last_updated: string
    api_version?: string
    active_sources?: number
    total_sources?: number
    source_details?: {
      groq_news?: { status: string; source: string }
      groq_social?: { status: string; source: string }
      google_trends?: { status: string; source: string }
      stocktwits?: { status: string; source: string }
      cnn_fear_greed?: { status: string; source: string }
    }
    data_status?: {
      reddit: string
      twitter: string
      stocktwits: string
      google_trends: string
      aaii: string
      cnn: string
    }
  }
  current: {
    headline_market_mood: number
    macro_sentiment: number
    global_social_sentiment: number
    components: {
      reddit_score?: number
      stocktwits_score?: number
      twitter_score?: number
      google_trends_score?: number
      aaii_score?: number
      fear_greed_score?: number
      groq_news_score?: number | null
      groq_social_score?: number | null
      cnn_fear_greed_score?: number | null
    }
    summaries?: {
      groq_news?: string | null
      groq_social?: string | null
    }
  }
  history: {
    timestamps: string[]
    headline_market_mood: number[]
    global_social_sentiment: number[]
    macro_sentiment: number[]
    price_series: {
      label: string
      values: number[]
    }
    note?: string
  }
  per_symbol: Array<{
    ticker: string
    name: string
    reddit_score: number | null
    stocktwits_score: number
    twitter_score: number | null
    google_trends_score: number | null
    combined_social_score: number
    data_note?: string
  }>
  indicators: Array<{
    name: string
    score: number
    status: string
    description: string
    source?: string
  }>
}

// Sentiment interpretation buckets
function getSentimentLabel(score: number): string {
  if (score >= 80) return "Extreme Bullish"
  if (score >= 60) return "Bullish"
  if (score >= 40) return "Neutral"
  if (score >= 20) return "Bearish"
  return "Extreme Bearish"
}

function getSentimentColor(score: number): string {
  if (score >= 80) return "bg-green-600"
  if (score >= 60) return "bg-green-500"
  if (score >= 40) return "bg-gray-400"
  if (score >= 20) return "bg-orange-500"
  return "bg-red-600"
}

function getSentimentBadgeVariant(score: number): "default" | "secondary" | "destructive" {
  if (score >= 60) return "default"
  if (score >= 40) return "secondary"
  return "destructive"
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

// Sentiment indicator component
function SocialSentimentIndicator({
  label,
  value,
  description,
}: {
  label: string
  value: number
  description: string
}) {
  const getSentimentLabel = (score: number) => {
    if (score >= 75) return "EXTREME BULLISH"
    if (score >= 56) return "BULLISH"
    if (score >= 45) return "NEUTRAL"
    if (score >= 25) return "BEARISH"
    return "EXTREME BEARISH"
  }

  // Calculate position on bar (inverted so bullish/high scores are on left)
  const percentage = 100 - value

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">{label}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="text-sm">{description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className="text-sm font-bold text-gray-900">{Math.round(value)}</span>
      </div>
      <div className="relative w-full h-3 rounded-full overflow-hidden">
        {/* Gradient: Green (Bullish) on LEFT, Red (Bearish) on RIGHT */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
        <div className="absolute inset-0 bg-gray-200" style={{ marginLeft: `${percentage}%` }} />
      </div>
    </div>
  )
}

function getSentimentInterpretation(score: number): string {
  if (score >= 75) return "Strong buying interest - market participants are very optimistic"
  if (score >= 56) return "Moderate optimism - generally positive market outlook"
  if (score >= 45) return "Mixed signals - no clear directional bias"
  if (score >= 25) return "Cautious sentiment - participants showing concern"
  return "High fear levels - significant pessimism in the market"
}

export function SocialSentiment() {
  const [data, setData] = useState<SocialSentimentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range] = useState("1W")
  const [universe] = useState("all_market")
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isFromCache, setIsFromCache] = useState(false)

  const CACHE_KEY = "social_sentiment_cache"
  const CACHE_TIMESTAMP_KEY = "social_sentiment_cache_timestamp"

  const fetchData = async () => {
    try {
      console.log(`[v0] Fetching social sentiment - Universe: ${universe}, Range: ${range}`)
      const response = await fetch(`/api/social-sentiment?universe=${universe}&range=${range}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
        setLastUpdated(new Date())
        setIsFromCache(false)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(result))
          localStorage.setItem(CACHE_TIMESTAMP_KEY, new Date().toISOString())
          console.log("[v0] Social sentiment data cached to localStorage")
        } catch (e) {
          console.warn("[v0] Failed to cache data to localStorage:", e)
        }
        console.log("[v0] Social sentiment data loaded successfully")
      } else {
        console.error("[v0] Social sentiment API error:", response.status)
        setError(`API error: ${response.status}`)
      }
    } catch (error) {
      console.error("[v0] Error fetching social sentiment data:", error)
      setError(`Error fetching data: ${error}`)
    }
  }

  useEffect(() => {
    function loadFromCache() {
      try {
        const cachedData = localStorage.getItem(CACHE_KEY)
        const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)

        if (cachedData) {
          const parsed = JSON.parse(cachedData)
          setData(parsed)
          setIsFromCache(true)
          if (cachedTimestamp) {
            setLastUpdated(new Date(cachedTimestamp))
          }
          console.log("[v0] Loaded social sentiment from cache")
          setLoading(false)
          return true
        }
      } catch (e) {
        console.warn("[v0] Failed to load from cache:", e)
      }
      return false
    }

    const hasCache = loadFromCache()

    if (!hasCache) {
      console.log("[v0] No cache found, fetching fresh data")
      fetchData().finally(() => setLoading(false))
    }
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600">Loading Market Mood data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-600">No sentiment data available</p>
        </div>
      </div>
    )
  }

  const filteredSymbols = (data.per_symbol || []).filter(
    (s) =>
      s.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      {/* Hero Section - Main Scale Visual */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  Social Sentiment Historical Scale
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        className="max-w-sm bg-gray-900 text-white p-4 rounded-lg shadow-xl border-0"
                      >
                        <div className="space-y-2">
                          <p className="font-semibold text-sm">How This Score Is Calculated</p>
                          <p className="text-xs text-gray-300">
                            The Headline Market Mood combines 5 data sources using AI-powered analysis:
                          </p>
                          <ul className="text-xs text-gray-300 list-disc pl-4 space-y-1">
                            <li>
                              <span className="text-white font-medium">Groq AI News Analysis</span> - Real-time market
                              news sentiment (25%)
                            </li>
                            <li>
                              <span className="text-white font-medium">Groq AI Social Search</span> - Twitter/Reddit
                              discussions (30%)
                            </li>
                            <li>
                              <span className="text-white font-medium">Google Trends</span> - Fear vs greed search terms
                              (15%)
                            </li>
                            <li>
                              <span className="text-white font-medium">StockTwits</span> - Bullish/bearish post analysis
                              (20%)
                            </li>
                            <li>
                              <span className="text-white font-medium">CNN Fear & Greed</span> - Market indicators
                              composite (10%)
                            </li>
                          </ul>
                          <div className="pt-2 border-t border-gray-700">
                            <p className="text-xs text-gray-400">Scale: 0 (Extreme Fear) → 100 (Extreme Greed)</p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Visual representation of sentiment zones from bearish to bullish
                </p>
              </div>
              <RefreshButton onRefresh={handleRefresh} isRefreshing={refreshing} lastUpdated={lastUpdated} />
            </div>
            {isFromCache && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                Showing cached data from {lastUpdated?.toLocaleString()}. Press Refresh to load live data.
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {data?.meta.data_status && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="text-xs font-semibold text-gray-700 mb-2">Data Source Status:</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {Object.entries(data.meta.data_status).map(([source, status]) => (
                  <div key={source} className="flex items-center gap-1">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${status === "LIVE" ? "bg-green-500" : "bg-yellow-500"}`}
                    ></span>
                    <span className="capitalize">{source.replace("_", " ")}:</span>
                    <span className="font-semibold">{status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div className="relative">
              <div className="h-24 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-lg shadow-inner" />

              <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-bold">
                <div className="text-center text-white drop-shadow-lg">
                  <div className="text-base">EXTREME</div>
                  <div>BULLISH</div>
                  <div className="text-[10px] mt-1">75-100</div>
                </div>
                <div className="text-center text-white drop-shadow-lg">
                  <div>BULLISH</div>
                  <div className="text-[10px] mt-1">56-74</div>
                </div>
                <div className="text-center text-gray-800 drop-shadow">
                  <div>NEUTRAL</div>
                  <div className="text-[10px] mt-1">45-55</div>
                </div>
                <div className="text-center text-white drop-shadow-lg">
                  <div>BEARISH</div>
                  <div className="text-[10px] mt-1">25-44</div>
                </div>
                <div className="text-center text-white drop-shadow-lg">
                  <div className="text-base">EXTREME</div>
                  <div>BEARISH</div>
                  <div className="text-[10px] mt-1">0-24</div>
                </div>
              </div>

              {data && (
                <div
                  className="absolute top-0 bottom-0 w-2 bg-black shadow-lg transition-all duration-500"
                  style={{ left: `calc(${100 - data.current.headline_market_mood}% - 4px)` }}
                >
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <div className="bg-black text-white px-4 py-2 rounded-lg shadow-xl">
                      <div className="text-xs font-semibold">TODAY</div>
                      <div className="text-2xl font-bold">{Math.round(data.current.headline_market_mood)}</div>
                      <div className="text-xs text-center">{getSentimentLabel(data.current.headline_market_mood)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                    Macro Sentiment
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-xs bg-gray-900 text-white p-3 rounded-lg shadow-xl border-0"
                        >
                          <div className="space-y-2">
                            <p className="font-semibold text-sm">Macro Sentiment</p>
                            <p className="text-xs text-gray-300">
                              Combines AAII Investor Survey (weekly poll of individual investors) with CNN Fear & Greed
                              Index (7 market indicators).
                            </p>
                            <p className="text-xs text-gray-400 pt-1 border-t border-gray-700">
                              {getSentimentInterpretation(data?.current.macro_sentiment ?? 50)}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    {data ? Math.round(data.current.macro_sentiment) : 53}
                  </span>
                </div>
                <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 ${getSentimentColor(data?.current.macro_sentiment ?? 53)} transition-all duration-500`}
                    style={{ width: `${data?.current.macro_sentiment ?? 53}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500">{getSentimentLabel(data?.current.macro_sentiment ?? 53)}</div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                    Social Sentiment
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-xs bg-gray-900 text-white p-3 rounded-lg shadow-xl border-0"
                        >
                          <div className="space-y-2">
                            <p className="font-semibold text-sm">Social Sentiment</p>
                            <p className="text-xs text-gray-300">
                              AI-analyzed sentiment from social platforms: Reddit (r/wallstreetbets), Twitter/X market
                              discussions, and StockTwits posts using Groq compound-beta.
                            </p>
                            <p className="text-xs text-gray-400 pt-1 border-t border-gray-700">
                              {getSentimentInterpretation(data?.current.global_social_sentiment ?? 50)}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    {data ? Math.round(data.current.global_social_sentiment) : 64}
                  </span>
                </div>
                <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 ${getSentimentColor(data?.current.global_social_sentiment ?? 64)} transition-all duration-500`}
                    style={{ width: `${data?.current.global_social_sentiment ?? 64}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500">
                  {getSentimentLabel(data?.current.global_social_sentiment ?? 64)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Component Sentiment Indicators - Updated to match actual API fields */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />5 Component Sentiment Indicators
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="max-w-sm bg-gray-900 text-white p-3 rounded-lg shadow-xl border-0"
                >
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">Component Sentiment Indicators</p>
                    <p className="text-xs text-gray-300">
                      Each indicator contributes to the overall Headline Market Mood. Green badges indicate LIVE data,
                      yellow indicates unavailable sources.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <CardDescription>
            Individual scores from Groq AI News, Groq AI Social, StockTwits, Google Trends, and CNN Fear & Greed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {[
            {
              name: "Groq AI News Sentiment",
              value: data.current.components.groq_news_score,
              description: "Real-time market news analyzed by Groq AI",
              status: data.meta.source_details?.groq_news?.status,
              weight: "25%",
              tooltipDetail:
                "Groq's compound-beta model performs real-time web search for current market news, earnings reports, and economic indicators.",
              methodology: "AI analyzes news headlines and articles for bullish/bearish sentiment on a 0-100 scale.",
            },
            {
              name: "Groq AI Social Sentiment",
              value: data.current.components.groq_social_score,
              description: "Twitter/Reddit discussions analyzed by Groq AI",
              status: data.meta.source_details?.groq_social?.status,
              weight: "30%",
              tooltipDetail:
                "Groq's compound-beta model searches Twitter, Reddit, and social media for real-time market sentiment discussions.",
              methodology: "AI evaluates social media posts for retail investor sentiment and trending topics.",
            },
            {
              name: "StockTwits Sentiment",
              value: data.current.components.stocktwits_score,
              description: "StockTwits posts + bullish/bearish tags",
              status: data.meta.source_details?.stocktwits?.status,
              weight: "20%",
              tooltipDetail:
                "ScrapingBee fetches recent StockTwits posts which are then analyzed by Groq AI for sentiment.",
              methodology: "User-tagged bullish/bearish posts combined with AI text analysis.",
            },
            {
              name: "Google Trends",
              value: data.current.components.google_trends_score,
              description: "Fear vs greed search terms via SerpAPI",
              status: data.meta.source_details?.google_trends?.status,
              weight: "15%",
              tooltipDetail:
                "SerpAPI fetches Google Trends data comparing fear terms ('stock market crash', 'recession') vs greed terms ('buy stocks', 'stock rally').",
              methodology: "High fear searches = low score. High greed searches = high score. Normalized to 0-100.",
            },
            {
              name: "CNN Fear & Greed Index",
              value: data.current.components.cnn_fear_greed_score,
              description: "CNN's composite market sentiment index",
              status: data.meta.source_details?.cnn_fear_greed?.status,
              weight: "10%",
              tooltipDetail:
                "CNN's composite index based on 7 market indicators: momentum, strength, breadth, put/call ratio, junk bond demand, VIX, and safe haven demand.",
              methodology: "Already scaled 0-100 by CNN. Fetched via internal market-sentiment API.",
            },
          ].map((indicator, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{indicator.name}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        className="max-w-sm bg-gray-900 text-white p-4 rounded-lg shadow-xl border-0 z-50"
                      >
                        <div className="space-y-2">
                          <p className="font-semibold text-sm">{indicator.name}</p>
                          <p className="text-xs text-gray-300">{indicator.tooltipDetail}</p>
                          <div className="pt-2 border-t border-gray-700">
                            <p className="text-xs text-gray-400">
                              <span className="text-white font-medium">Weight:</span> {indicator.weight}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              <span className="text-white font-medium">Methodology:</span> {indicator.methodology}
                            </p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {/* Status badge */}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      indicator.status === "LIVE"
                        ? "bg-green-100 text-green-700"
                        : indicator.value != null && indicator.value >= 0
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {indicator.status === "LIVE"
                      ? "LIVE"
                      : indicator.value != null && indicator.value >= 0
                        ? "CACHED"
                        : "UNAVAILABLE"}
                  </span>
                </div>
                {indicator.value != null && indicator.value >= 0 ? (
                  <span className="font-bold">{Math.round(indicator.value)}</span>
                ) : (
                  <span className="text-gray-400 text-xs">No data</span>
                )}
              </div>
              {/* Sentiment bar */}
              <div className="relative h-3 bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 rounded-full overflow-hidden">
                {indicator.value != null && indicator.value >= 0 ? (
                  <div
                    className="absolute top-0 h-full w-1 bg-black shadow-lg"
                    style={{ left: `${Math.min(100, Math.max(0, indicator.value))}%`, transform: "translateX(-50%)" }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gray-200 opacity-80" />
                )}
              </div>
              <p className="text-xs text-gray-500">{indicator.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 10 Component Sentiment Indicators */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">10 Component Sentiment Indicators</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm bg-gray-900 text-white border-gray-700 z-50 p-3">
                  <p className="font-semibold mb-1">10 Data Sources</p>
                  <p className="text-xs text-gray-300">
                    Real-time sentiment from: Groq AI News, Google Trends, AAII Survey, CNN Fear & Greed, StockTwits,
                    Finnhub News, Alpha Vantage, Reddit, Polygon News, and Yahoo Finance. Sources are fetched in
                    parallel with weighted averaging.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(data.indicators || []).map((indicator, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">{indicator.name}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-gray-900 text-white border-gray-700 z-50 p-3">
                        <p className="text-xs">{indicator.description}</p>
                        {indicator.source && <p className="text-xs text-gray-400 mt-1">Source: {indicator.source}</p>}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      indicator.status === "LIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {indicator.status}
                  </span>
                </div>
                {indicator.score != null && indicator.score >= 0 ? (
                  <span className="text-sm font-bold text-gray-900">{Math.round(indicator.score)}</span>
                ) : (
                  <span className="text-gray-400 text-xs">No data</span>
                )}
              </div>
              <div className="relative h-3 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 rounded-full overflow-hidden">
                {indicator.score != null && indicator.score >= 0 ? (
                  <div
                    className="absolute top-0 h-full w-1 bg-black shadow-lg"
                    style={{
                      left: `${100 - Math.min(100, Math.max(0, indicator.score))}%`,
                      transform: "translateX(-50%)",
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gray-200 opacity-80" />
                )}
              </div>
              <p className="text-xs text-gray-500">{indicator.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sentiment Heatmap Section - Added tooltips to heatmap items */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Sentiment Heatmap
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="max-w-sm bg-gray-900 text-white p-3 rounded-lg shadow-xl border-0"
                >
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">Sentiment Heatmap</p>
                    <p className="text-xs text-gray-300">
                      Per-symbol sentiment derived from StockTwits data combined with market-wide social sentiment.
                      Click on any symbol for detailed breakdown.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            AI-powered sentiment from social media discussions (Reddit, Twitter/X, financial forums)
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Major Indices
            </h3>
            <div className="space-y-4">
              {(data.per_symbol || [])
                .filter((s) => ["SPY", "QQQ", "IWM", "DIA"].includes(s.ticker))
                .map((item) => (
                  <div key={item.ticker} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900">{item.ticker}</span>
                        <span className="text-xs text-gray-500">{item.name}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-xs bg-gray-900 text-white p-3 rounded-lg shadow-xl border-0 z-50"
                            >
                              <div className="space-y-2">
                                <p className="font-semibold text-sm">
                                  {item.ticker} - {item.name}
                                </p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                  <span className="text-gray-400">StockTwits:</span>
                                  <span className="text-white font-medium">{Math.round(item.stocktwits_score)}</span>
                                  <span className="text-gray-400">Combined:</span>
                                  <span className="text-white font-medium">
                                    {Math.round(item.combined_social_score)}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400 pt-1 border-t border-gray-700">
                                  {getSentimentInterpretation(item.combined_social_score)}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-gray-900">{Math.round(item.combined_social_score)}</span>
                        <span className="text-xs text-gray-500 ml-2">(StockTwits)</span>
                      </div>
                    </div>

                    {/* Gradient bar matching Component Sentiment Indicators style */}
                    <div className="relative h-6 bg-gray-100 rounded overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          width: `${100 - item.combined_social_score}%`,
                          marginLeft: `${item.combined_social_score}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-gray-700">
            <strong>Data Source:</strong> StockTwits only for per-symbol sentiment. Reddit, Twitter, and Google Trends
            provide market-wide sentiment only, not per-symbol breakdowns.
          </div>
        </CardContent>
      </Card>

      {/* Per Symbol Breakdown - Improved tooltip styling and content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Per-Symbol Social Sentiment
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="max-w-sm bg-gray-900 text-white p-3 rounded-lg shadow-xl border-0"
                    >
                      <div className="space-y-2">
                        <p className="font-semibold text-sm">Per-Symbol Sentiment</p>
                        <p className="text-xs text-gray-300">
                          Individual stock sentiment primarily from StockTwits, blended with market-wide social
                          sentiment from Reddit and Twitter for context.
                        </p>
                        <div className="pt-2 border-t border-gray-700 text-xs text-gray-400">
                          <p>
                            <span className="text-green-400">Green (60-100):</span> Bullish sentiment
                          </p>
                          <p>
                            <span className="text-yellow-400">Yellow (40-59):</span> Neutral sentiment
                          </p>
                          <p>
                            <span className="text-red-400">Red (0-39):</span> Bearish sentiment
                          </p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription>Individual stock sentiment from StockTwits</CardDescription>
            </div>
            <div className="w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search ticker or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(data.per_symbol || []).length > 0 && data.per_symbol[0].data_note && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-gray-700">
              {data.per_symbol[0].data_note}
            </div>
          )}

          <div className="space-y-4">
            {filteredSymbols
              .sort((a, b) => b.combined_social_score - a.combined_social_score)
              .map((symbol) => (
                <div key={symbol.ticker} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-gray-900">{symbol.ticker}</span>
                      <span className="text-xs text-gray-500">{symbol.name}</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            align="start"
                            className="max-w-sm bg-gray-900 text-white p-4 rounded-lg shadow-xl border-0 z-50"
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                                <span className="font-bold text-sm">{symbol.ticker}</span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    symbol.combined_social_score >= 60
                                      ? "bg-green-600"
                                      : symbol.combined_social_score >= 40
                                        ? "bg-yellow-600"
                                        : "bg-red-600"
                                  }`}
                                >
                                  {getSentimentLabel(symbol.combined_social_score)}
                                </span>
                              </div>

                              <div className="space-y-2">
                                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                                  Data Sources
                                </p>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">StockTwits</span>
                                    <span className="text-green-400 font-semibold">
                                      {Math.round(symbol.stocktwits_score)}{" "}
                                      <span className="text-[10px] text-green-500">LIVE</span>
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Combined</span>
                                    <span className="text-white font-semibold">
                                      {Math.round(symbol.combined_social_score)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between col-span-2 pt-1 border-t border-gray-800">
                                    <span className="text-gray-500">Reddit/Twitter</span>
                                    <span className="text-gray-500 text-[10px]">Market-wide only</span>
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-gray-700">
                                <p className="text-xs text-gray-400">
                                  {getSentimentInterpretation(symbol.combined_social_score)}
                                </p>
                              </div>

                              <div className="text-[10px] text-gray-500 pt-1">
                                Score derived from StockTwits posts + market-wide social signals
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{Math.round(symbol.combined_social_score)}</span>
                  </div>
                  <div className="relative h-6 bg-gray-100 rounded overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div
                      className="absolute inset-0 bg-gray-200"
                      style={{
                        width: `${100 - symbol.combined_social_score}%`,
                        marginLeft: `${symbol.combined_social_score}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
