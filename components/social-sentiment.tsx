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
      reddit_score: number
      stocktwits_score: number
      twitter_score: number
      google_trends_score: number
      aaii_score: number
      fear_greed_score: number
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
                <Info className="h-3 w-3 text-gray-400 cursor-help" />
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

export function SocialSentiment() {
  const [data, setData] = useState<SocialSentimentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range] = useState("1W")
  const [universe] = useState("all_market")
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = async () => {
    try {
      console.log(`[v0] Fetching social sentiment - Universe: ${universe}, Range: ${range}`)
      const response = await fetch(`/api/social-sentiment?universe=${universe}&range=${range}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
        setLastUpdated(new Date())
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
    async function initialFetch() {
      setLoading(true)
      await fetchData()
      setLoading(false)
    }

    initialFetch()
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

  const filteredSymbols = data.per_symbol.filter(
    (s) =>
      s.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      {/* Hero Section - Main Scale Visual */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Social Sentiment Historical Scale
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Visual representation of sentiment zones from bearish to bullish
              </p>
            </div>
            <RefreshButton onRefresh={handleRefresh} isRefreshing={refreshing} lastUpdated={lastUpdated} />
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
                  <span className="text-sm font-semibold text-gray-700">Macro Sentiment</span>
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
                  <span className="text-sm font-semibold text-gray-700">Social Sentiment</span>
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

      {/* Component Sentiment Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />6 Component Sentiment Indicators
          </CardTitle>
          <CardDescription>
            Individual scores from Reddit, Twitter, StockTwits, Google Trends, AAII Survey, and CNN Fear & Greed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {[
            {
              name: "Reddit Sentiment",
              value: data.current.components.reddit_score,
              description: "r/wallstreetbets hot posts analyzed by AI",
              status: data.meta.data_status?.reddit,
            },
            {
              name: "Twitter / X Sentiment",
              value: data.current.components.twitter_score,
              description: "Twitter search results analyzed by AI",
              status: data.meta.data_status?.twitter,
            },
            {
              name: "StockTwits Sentiment",
              value: data.current.components.stocktwits_score,
              description: "StockTwits posts + bullish/bearish tags",
              status: data.meta.data_status?.stocktwits,
            },
            {
              name: "Google Trends",
              value: data.current.components.google_trends_score,
              description: "Inverted 'stock market crash' search volume (SerpAPI)",
              status: data.meta.data_status?.google_trends,
            },
            {
              name: "AAII Investor Sentiment",
              value: data.current.components.aaii_score,
              description: "AAII.com weekly survey (scraped)",
              status: data.meta.data_status?.aaii,
            },
            {
              name: "CNN Fear & Greed",
              value: data.current.components.fear_greed_score,
              description: "CNN Fear & Greed Index (scraped)",
              status: data.meta.data_status?.cnn,
            },
          ].map((indicator, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">{indicator.name}</span>
                  {indicator.status && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${indicator.status === "LIVE" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
                    >
                      {indicator.status}
                    </span>
                  )}
                </div>
                <span className="font-semibold text-gray-900">{indicator.value}</span>
              </div>
              <div className="relative h-4 w-full rounded-full overflow-hidden bg-gradient-to-r from-green-500 via-yellow-400 to-red-500">
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    clipPath: `polygon(${100 - indicator.value}% 0, 100% 0, 100% 100%, ${100 - indicator.value}% 100%)`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-gray-500">{indicator.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sentiment Heatmap Section */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Sentiment Heatmap
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
              {data.per_symbol
                .filter((s) => ["SPY", "QQQ", "IWM", "DIA"].includes(s.ticker))
                .map((item) => (
                  <div key={item.ticker} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900">{item.ticker}</span>
                        <span className="text-xs text-gray-500">{item.name}</span>
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

      {/* Per Symbol Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Per-Symbol Social Sentiment</CardTitle>
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
          {data.per_symbol.length > 0 && data.per_symbol[0].data_note && (
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
                            <Info className="h-3 w-3 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between gap-4">
                                <span>StockTwits (LIVE):</span>
                                <span className="font-semibold">{Math.round(symbol.stocktwits_score)}</span>
                              </div>
                              <div className="flex justify-between gap-4 text-gray-400">
                                <span>Reddit:</span>
                                <span>Market-wide only</span>
                              </div>
                              <div className="flex justify-between gap-4 text-gray-400">
                                <span>Twitter:</span>
                                <span>Market-wide only</span>
                              </div>
                              <div className="flex justify-between gap-4 text-gray-400">
                                <span>Google Trends:</span>
                                <span>Market-wide only</span>
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
