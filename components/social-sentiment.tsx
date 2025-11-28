"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Info,
  TrendingUp,
  Activity,
  BarChart3,
  Sparkles,
  MessageSquare,
  Send,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react"

interface SocialSentimentData {
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
function SentimentIndicatorRow({
  indicator,
}: {
  indicator: {
    name: string
    score: number | null
    status: string
    description: string
  }
}) {
  const isLive = indicator.status === "LIVE" && indicator.score !== null && indicator.score >= 0
  const score = safeNumber(indicator.score, 50)

  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">{indicator.name}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm bg-white border shadow-lg">
                <p className="text-sm text-gray-700">{indicator.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              isLive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            {indicator.status}
          </span>
        </div>
        <span className={`text-sm font-bold ${isLive ? "text-gray-900" : "text-gray-400"}`}>
          {isLive ? Math.round(score) : "No data"}
        </span>
      </div>
      <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
        {isLive ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500" />
            <div className="absolute top-0 bottom-0 right-0 bg-gray-200" style={{ width: `${100 - score}%` }} />
          </>
        ) : (
          <div className="absolute inset-0 bg-gray-200 opacity-80" />
        )}
      </div>
      <p className="text-xs text-gray-500 mt-1">{indicator.description}</p>
    </div>
  )
}

// Ask AI Dialog Component
function AskAIDialog({ sentimentData }: { sentimentData: SocialSentimentData }) {
  const [isOpen, setIsOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState("")

  const suggestedQuestions = [
    "How should I adjust my options positions based on current sentiment?",
    "What sectors are showing the most bullish sentiment?",
    "Is this a good time to sell premium?",
    "What's the risk of a sentiment reversal?",
  ]

  const handleAskAI = async (q: string) => {
    setIsLoading(true)
    setQuestion(q)

    try {
      const res = await fetch("/api/scenario-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            type: "sentiment",
            title: "Social Sentiment Analysis",
            details: `Current sentiment score: ${sentimentData.global_social_sentiment}/100 (${getSentimentLabel(sentimentData.global_social_sentiment)}). Macro sentiment: ${sentimentData.macro_sentiment}, Social sentiment: ${sentimentData.social_sentiment}. Data quality: ${sentimentData.data_quality} (${sentimentData.sources_available}/${sentimentData.sources_total} sources).`,
          },
          question: q,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setResponse(data.response || data.analysis || "Unable to generate response.")
      } else {
        setResponse("I apologize, but I couldn't process your question. Please try again.")
      }
    } catch {
      setResponse("An error occurred while processing your question.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-transparent">
          <MessageSquare className="h-4 w-4" />
          Ask AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-600" />
            Ask AI About Sentiment
          </DialogTitle>
          <DialogDescription>
            Get AI-powered insights about how current social sentiment affects your options trading
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Suggested Questions */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((sq, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-transparent"
                  onClick={() => handleAskAI(sq)}
                  disabled={isLoading}
                >
                  {sq}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Question */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Or ask your own question:</p>
            <div className="flex gap-2">
              <Textarea
                placeholder="Type your question about sentiment and options trading..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            <Button
              onClick={() => handleAskAI(question)}
              disabled={isLoading || !question.trim()}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Ask AI
                </>
              )}
            </Button>
          </div>

          {/* Response */}
          {response && (
            <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
              <p className="text-sm font-medium text-teal-800 mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Response
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{response}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function SocialSentiment() {
  const [data, setData] = useState<SocialSentimentData>({
    macro_sentiment: 50,
    social_sentiment: 50,
    global_social_sentiment: 50,
    headline_market_mood: 50,
    sources_available: 0,
    sources_total: 10,
    per_symbol: [],
    indicators: [],
  })
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const CACHE_KEY = "social_sentiment_cache_v5"
  const CACHE_TIMESTAMP_KEY = "social_sentiment_cache_timestamp_v5"

  const fetchSentiment = async () => {
    setLoading(true)
    try {
      console.log("[v0] Fetching social sentiment...")
      const response = await fetch("/api/social-sentiment")
      if (response.ok) {
        const result = await response.json()
        setData(result)
        setLastUpdated(new Date())
        // Cache to localStorage
        localStorage.setItem(CACHE_KEY, JSON.stringify(result))
        localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
        console.log("[v0] Social sentiment data loaded successfully")
      } else {
        console.error("[v0] Social sentiment API error:", response.status)
      }
    } catch (error) {
      console.error("[v0] Error fetching social sentiment data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Check cache first
    const cached = localStorage.getItem(CACHE_KEY)
    const cacheTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)

    if (cached && cacheTimestamp) {
      const age = Date.now() - Number.parseInt(cacheTimestamp)
      const maxAge = 15 * 60 * 1000 // 15 minutes

      if (age < maxAge) {
        try {
          setData(JSON.parse(cached))
          setLastUpdated(new Date(Number.parseInt(cacheTimestamp)))
          console.log("[v0] Loaded social sentiment from cache")
          return
        } catch {}
      }
    }

    fetchSentiment()
  }, [])

  const handleRefresh = () => {
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(CACHE_TIMESTAMP_KEY)
    fetchSentiment()
  }

  // Get 5 component indicators (top 5 by weight)
  const fiveComponentIndicators = (data.indicators || []).slice(0, 5)
  // Get all 10 indicators
  const tenComponentIndicators = data.indicators || []

  // Get index data for heatmap
  const indexData = (data.per_symbol || []).filter((s) => ["SPY", "QQQ", "IWM", "DIA"].includes(s.symbol))

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header with Refresh */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-teal-600" />
                  Social Sentiment Historical Scale
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm bg-white border shadow-lg">
                        <p className="font-semibold text-sm">Social Sentiment Scale</p>
                        <p className="text-xs text-gray-600">
                          Aggregated sentiment from {data.sources_available || 0} live sources including AI analysis,
                          social media, and news sentiment.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
                <CardDescription className="mt-1">
                  Visual representation of sentiment zones from bearish to bullish
                </CardDescription>
              </div>
              <RefreshButton onRefresh={handleRefresh} isLoading={loading} />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Main Sentiment Gauge */}
            <div className="relative mb-8">
              {/* Score Display */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-2 bg-gray-900 text-white px-3 py-1 rounded-lg text-center z-10">
                <div className="text-xs text-gray-300">TODAY</div>
                <div className="text-2xl font-bold">{Math.round(safeNumber(data?.global_social_sentiment, 50))}</div>
                <div className="text-xs">{getSentimentLabel(safeNumber(data?.global_social_sentiment, 50))}</div>
              </div>

              {/* Gradient Bar */}
              <div className="h-12 rounded-lg overflow-hidden flex mt-8">
                <div className="flex-1 bg-green-600 flex items-end justify-start p-2">
                  <div className="text-white text-xs font-bold">
                    <div>EXTREME</div>
                    <div>BULLISH</div>
                    <div className="text-green-200">75-100</div>
                  </div>
                </div>
                <div className="flex-1 bg-green-400 flex items-end justify-center p-2">
                  <div className="text-white text-xs font-bold text-center">
                    <div>BULLISH</div>
                    <div className="text-green-100">56-74</div>
                  </div>
                </div>
                <div className="flex-1 bg-yellow-400 flex items-end justify-center p-2">
                  <div className="text-gray-800 text-xs font-bold text-center">
                    <div>NEUTRAL</div>
                    <div className="text-yellow-700">45-55</div>
                  </div>
                </div>
                <div className="flex-1 bg-orange-500 flex items-end justify-center p-2">
                  <div className="text-white text-xs font-bold text-center">
                    <div>BEARISH</div>
                    <div className="text-orange-200">25-44</div>
                  </div>
                </div>
                <div className="flex-1 bg-red-600 flex items-end justify-end p-2">
                  <div className="text-white text-xs font-bold text-right">
                    <div>EXTREME</div>
                    <div>BEARISH</div>
                    <div className="text-red-200">0-24</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Macro vs Social Split */}
            <div className="grid grid-cols-2 gap-6">
              <SentimentPill label="Macro Sentiment" value={safeNumber(data?.macro_sentiment, 47)} />
              <SentimentPill label="Social Sentiment" value={safeNumber(data?.social_sentiment, 54)} />
            </div>
          </CardContent>
        </Card>

        {/* 5 Component Indicators */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-teal-600" />5 Component Sentiment Indicators
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm bg-white border shadow-lg">
                    <p className="text-sm">Top 5 sentiment sources by weight and reliability.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {fiveComponentIndicators.map((indicator, idx) => (
              <SentimentIndicatorRow key={idx} indicator={indicator} />
            ))}
          </CardContent>
        </Card>

        {/* 10 Component Indicators */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-teal-600" />
              10 Component Sentiment Indicators
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm bg-white border shadow-lg">
                    <p className="text-sm">All 10 sentiment data sources with real-time status.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {tenComponentIndicators.map((indicator, idx) => (
              <SentimentIndicatorRow key={idx} indicator={indicator} />
            ))}
          </CardContent>
        </Card>

        {/* Sentiment Heatmap - Major Indices */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-teal-600" />
              Sentiment Heatmap
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
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-400 to-green-500" />
                        <div
                          className="absolute top-0 bottom-0 right-0 bg-gray-200"
                          style={{ width: `${100 - score}%` }}
                        />
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-gray-800 rounded"
                          style={{ left: `${score}%`, transform: "translateX(-50%)" }}
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

        {/* AI Executive Summary - Replaces Per-Symbol Social Sentiment */}
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
                <CardDescription className="mt-1">What social sentiment means for options traders</CardDescription>
              </div>
              <AskAIDialog sentimentData={data} />
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Summary */}
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-teal-800 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Current Sentiment Analysis
              </h4>
              <p className="text-sm text-gray-700 leading-relaxed">
                {data.executive_summary ||
                  `Social sentiment is currently at ${data.global_social_sentiment}/100 (${getSentimentLabel(
                    data.global_social_sentiment,
                  )}). ${getSentimentInterpretation(data.global_social_sentiment)}`}
              </p>
            </div>

            {/* Weekly Outlook */}
            <div className="space-y-2 p-4 bg-white rounded-lg border border-teal-100">
              <h4 className="text-sm font-bold text-teal-800 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Weekly Outlook
              </h4>
              <p className="text-sm text-gray-700">
                {data.weekly_outlook ||
                  (data.global_social_sentiment >= 60
                    ? "Bullish sentiment suggests momentum trades, but watch for overbought conditions."
                    : data.global_social_sentiment >= 40
                      ? "Mixed sentiment favors neutral strategies like iron condors and strangles."
                      : "Elevated fear creates premium selling opportunities; watch for capitulation.")}
              </p>
            </div>

            {/* Recommended Strategies */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-teal-800 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Recommended Options Strategies
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(data.recommended_strategies && data.recommended_strategies.length > 0
                  ? data.recommended_strategies
                  : data.global_social_sentiment >= 60
                    ? ["Sell call credit spreads", "Protective puts on longs", "Iron condors on high IV"]
                    : data.global_social_sentiment >= 40
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

            {/* Data Quality */}
            <div className="flex items-center justify-between pt-4 border-t border-teal-100 text-xs text-gray-500">
              <span>
                Data Quality: {data.data_quality || "MEDIUM"} ({data.sources_available || 0}/{data.sources_total || 10}{" "}
                sources)
              </span>
              {lastUpdated && <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
