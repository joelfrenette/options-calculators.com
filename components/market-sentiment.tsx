"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
// import {
//   Activity,
//   TrendingUp,
//   TrendingDown,
//   Minus,
//   Target,
//   DollarSign,
//   Shield,
//   Lightbulb,
//   RefreshCw,
//   Info,
//   BarChart3,
// } from "lucide-react"

interface MarketData {
  vix: number
  vixVs50DayMA: number
  putCallRatio: number
  marketMomentum: number
  stockPriceStrength: number
  stockBreadth: number
  junkBondSpread: number
  safeHavenDemand: number
  overallScore: number
  sentiment: string
  trend: "up" | "down" | "neutral"
  yesterdayChange: number
  lastWeekChange: number
  lastMonthChange: number
  lastYearChange: number
  volatilitySkew: number
  openInterestPutCall: number
  vixTermStructure: string
  cboeSkewIndex: number
  usingFallback?: boolean // Added flag to indicate fallback data
}

interface SentimentData {
  ticker: string
  sector: string
  bullishScore: number
  bearishScore: number
  netSentiment: number
  volume: number
  category?: string
  industry?: string
}

const RefreshIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
)

const InfoIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
)

const BarChartIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
)

const ActivityIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
)

const TrendingUpIcon = () => (
  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
)

const TrendingDownIcon = () => (
  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
  </svg>
)

const MinusIcon = () => (
  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
  </svg>
)

const TargetIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 00-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
    />
  </svg>
)

const DollarSignIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
)

const ShieldIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
    />
  </svg>
)

const LightbulbIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
    />
  </svg>
)

export function MarketSentiment() {
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [sentimentData, setSentimentData] = useState<SentimentData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = async () => {
    try {
      const [marketRes, sentimentRes] = await Promise.all([
        fetch("/api/market-sentiment"),
        fetch("/api/sentiment-heatmap"),
      ])

      if (marketRes.ok) {
        const market = await marketRes.json()
        setMarketData(market)
      } else {
        console.error("[v0] Market sentiment API error:", marketRes.status)
      }

      if (sentimentRes.ok) {
        const sentiment = await sentimentRes.json()
        const sentimentArray = sentiment.data || sentiment // Handle both old and new formats
        if (Array.isArray(sentimentArray)) {
          setSentimentData(sentimentArray)
        } else {
          console.error("[v0] Sentiment data is not an array:", sentiment)
          setSentimentData([]) // Keep as empty array on error
        }
      } else {
        console.error("[v0] Sentiment heatmap API error:", sentimentRes.status)
        setSentimentData([]) // Keep as empty array on error
      }

      setLastUpdated(new Date())
    } catch (error) {
      console.error("[v0] Error fetching market sentiment data:", error)
    }
  }

  useEffect(() => {
    async function initialFetch() {
      setLoading(true)
      await fetchData()
      setLoading(false)
    }

    initialFetch()
    const interval = setInterval(fetchData, 60000) // Refresh every minute

    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-red-600"
    if (score >= 50) return "text-orange-500"
    if (score >= 30) return "text-yellow-600"
    return "text-green-600"
  }

  const getScoreBackground = (score: number) => {
    if (score >= 70) return "bg-red-50 border-red-200"
    if (score >= 50) return "bg-orange-50 border-orange-200"
    if (score >= 30) return "bg-yellow-50 border-yellow-200"
    return "bg-green-50 border-green-200"
  }

  const getSentimentColor = (score: number) => {
    if (score > 20) return "bg-green-500"
    if (score > 0) return "bg-green-300"
    if (score > -20) return "bg-red-300"
    return "bg-red-500"
  }

  const getTradeRecommendations = (score: number) => {
    if (score <= 24) {
      return {
        level: "Extreme Fear",
        cashAllocation: "10-20%",
        marketExposure: "80-90%",
        positionSize: "Larger positions (3-5% per trade)",
        strategies: [
          "Aggressive cash-secured puts on quality stocks",
          "Sell puts 10-20% OTM for premium collection",
          "Consider LEAPS calls on beaten-down stocks",
          "Wheel strategy on high-quality names",
        ],
        riskManagement: [
          "This is a buying opportunity - deploy capital aggressively",
          "Focus on stocks you want to own long-term",
          "Use 30-45 DTE for optimal theta decay",
          "Keep some cash for potential further drops",
        ],
        coachTips:
          "Top coaches recommend being greedy when others are fearful. This is prime time for put selling on quality stocks.",
      }
    } else if (score <= 44) {
      return {
        level: "Fear",
        cashAllocation: "20-30%",
        marketExposure: "70-80%",
        positionSize: "Standard positions (2-3% per trade)",
        strategies: [
          "Moderate cash-secured put selling",
          "Sell puts 5-15% OTM",
          "Credit spreads for defined risk",
          "Iron condors on high IV stocks",
        ],
        riskManagement: [
          "Good environment for premium selling",
          "Maintain diversification across sectors",
          "Use 30-45 DTE for balance of premium and time",
          "Be selective with underlying stocks",
        ],
        coachTips:
          "Market showing some fear - favorable for options sellers. Focus on quality underlyings and maintain discipline.",
      }
    } else if (score <= 55) {
      return {
        level: "Neutral",
        cashAllocation: "30-40%",
        marketExposure: "60-70%",
        positionSize: "Conservative positions (1-2% per trade)",
        strategies: [
          "Balanced approach to put selling",
          "Sell puts 5-10% OTM",
          "Credit spreads for better risk/reward",
          "Focus on earnings plays with defined risk",
        ],
        riskManagement: [
          "Market is balanced - be selective",
          "Reduce position sizes slightly",
          "Consider taking profits early (50% max profit)",
          "Increase cash reserves for opportunities",
        ],
        coachTips: "Neutral market conditions - maintain discipline and don't force trades. Wait for better setups.",
      }
    } else if (score <= 74) {
      return {
        level: "Greed",
        cashAllocation: "40-60%",
        marketExposure: "40-60%",
        positionSize: "Small positions (0.5-1% per trade)",
        strategies: [
          "Reduce new put selling significantly",
          "Focus on credit spreads with tight strikes",
          "Consider bear call spreads",
          "Take profits on existing positions early",
        ],
        riskManagement: [
          "Market showing greed - be cautious",
          "Reduce overall exposure and position sizes",
          "Build cash reserves for future opportunities",
          "Consider closing profitable trades early",
        ],
        coachTips:
          "Greed levels rising - time to be defensive. Top coaches recommend reducing exposure and building cash.",
      }
    } else {
      return {
        level: "Extreme Greed",
        cashAllocation: "60-80%",
        marketExposure: "20-40%",
        positionSize: "Minimal positions (0.25-0.5% per trade)",
        strategies: [
          "STOP opening new put positions",
          "Close existing positions for profits",
          "Consider protective puts on long holdings",
          "Focus on bear call spreads if trading",
        ],
        riskManagement: [
          "Extreme greed - high risk of correction",
          "Build maximum cash reserves",
          "Close profitable trades immediately",
          "Prepare for volatility expansion",
        ],
        coachTips:
          "DANGER ZONE - Extreme greed often precedes corrections. Top coaches recommend maximum cash and minimal exposure.",
      }
    }
  }

  const getPortfolioAllocation = (score: number) => {
    if (score <= 24) {
      return {
        level: "Extreme Fear",
        stocks: "50-60%",
        options: "20-30%",
        crypto: "5-10%",
        gold: "5-10%",
        cash: "10-15%",
        description: "Maximum equity exposure - time to be aggressive with quality assets",
        rationale: [
          "Stocks/ETFs: Focus on quality dividend-paying stocks, S&P 500 ETFs, and beaten-down tech leaders",
          "Options: Aggressive put selling and LEAPS calls on quality names with high IV",
          "Bitcoin/Crypto: Small allocation to BTC/ETH - typically correlates with risk-on sentiment recovery",
          "Gold/Silver: Minimal allocation - defensive assets less needed during extreme fear",
          "Cash: Keep 10-15% for potential further dips and margin requirements",
        ],
      }
    } else if (score <= 44) {
      return {
        level: "Fear",
        stocks: "45-55%",
        options: "15-25%",
        crypto: "5-10%",
        gold: "10-15%",
        cash: "15-20%",
        description: "Strong equity exposure with balanced defensive positioning",
        rationale: [
          "Stocks/ETFs: Diversified portfolio across sectors, favor quality over speculation",
          "Options: Moderate put selling and credit spreads on high-quality underlyings",
          "Bitcoin/Crypto: Maintain small position, good entry point if you believe in long-term",
          "Gold/Silver: Increase defensive allocation as insurance against volatility",
          "Cash: Build reserves for opportunities and risk management",
        ],
      }
    } else if (score <= 55) {
      return {
        level: "Neutral",
        stocks: "35-45%",
        options: "10-15%",
        crypto: "3-5%",
        gold: "15-20%",
        cash: "25-30%",
        description: "Balanced allocation with increased defensive positioning",
        rationale: [
          "Stocks/ETFs: Reduce exposure, favor dividend stocks and defensive sectors (utilities, consumer staples)",
          "Options: Selective put selling, tight credit spreads, consider protective puts on long positions",
          "Bitcoin/Crypto: Reduce crypto exposure, too risky in neutral-to-greedy markets",
          "Gold/Silver: Increase safe-haven allocation for portfolio insurance",
          "Cash: Build significant reserves - opportunity will come",
        ],
      }
    } else if (score <= 74) {
      return {
        level: "Greed",
        stocks: "25-35%",
        options: "5-10%",
        crypto: "0-3%",
        gold: "20-30%",
        cash: "35-45%",
        description: "Defensive positioning with heavy cash reserves",
        rationale: [
          "Stocks/ETFs: Trim winners aggressively, hold only highest-conviction positions",
          "Options: Minimal new positions, close profitable trades early, consider protective strategies",
          "Bitcoin/Crypto: Exit or minimize - crypto crashes hard when greed turns to fear",
          "Gold/Silver: Maximize safe-haven allocation for protection",
          "Cash: Build maximum reserves - correction likely coming",
        ],
      }
    } else {
      return {
        level: "Extreme Greed",
        stocks: "15-25%",
        options: "0-5%",
        crypto: "0%",
        gold: "30-40%",
        cash: "45-60%",
        description: "Maximum defensive positioning - prepare for correction",
        rationale: [
          "Stocks/ETFs: Minimum exposure - only hold absolute best quality defensive stocks",
          "Options: STOP new positions. Close everything profitable. Consider protective puts.",
          "Bitcoin/Crypto: EXIT completely - crypto typically crashes 30-50% in corrections",
          "Gold/Silver: Maximum safe-haven allocation - best protection during market crashes",
          "Cash: Maximum reserves - you'll have amazing opportunities soon",
        ],
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading market sentiment data...</div>
      </div>
    )
  }

  if (!marketData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Unable to load market data</div>
      </div>
    )
  }

  const recommendations = getTradeRecommendations(marketData.overallScore)
  const portfolioAllocation = getPortfolioAllocation(marketData.overallScore)

  const safeSentimentData = Array.isArray(sentimentData) ? sentimentData : []

  return (
    <div className="space-y-4">
      {marketData?.usingFallback && (
        <Card className="shadow-sm border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <InfoIcon className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-yellow-900 mb-1">Using Calculated Values</h3>
                <p className="text-sm text-yellow-800 leading-relaxed">
                  CNN's Fear & Greed Index is currently unavailable. We're using our own calculation based on real
                  market data (VIX, S&P 500, bond spreads) with similar methodology. Values may differ slightly from
                  CNN's official index.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {marketData && (
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BarChartIcon className="h-5 w-5 text-primary" />
                  Fear & Greed Historical Scale
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Visual representation of sentiment zones from extreme fear to extreme greed
                </p>
              </div>
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                variant="outline"
                size="sm"
                className="bg-green-50 hover:bg-green-100 border-green-200"
              >
                <span className={refreshing ? "animate-spin mr-2" : "mr-2"}>
                  <RefreshIcon />
                </span>
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Scale Visualization - Matching Panic/Euphoria style */}
            <div className="space-y-6">
              <div className="relative">
                {/* Gradient Bar */}
                <div className="h-24 bg-gradient-to-r from-green-600 via-green-500 via-20% via-green-400 via-40% via-yellow-400 via-60% via-orange-500 via-80% to-red-600 rounded-lg shadow-inner" />

                {/* Zone labels */}
                <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-bold">
                  <div className="text-center text-white drop-shadow-lg">
                    <div className="text-base">EXTREME</div>
                    <div>FEAR</div>
                    <div className="text-[10px] mt-1">0-24</div>
                  </div>
                  <div className="text-center text-white drop-shadow-lg">
                    <div>FEAR</div>
                    <div className="text-[10px] mt-1">25-44</div>
                  </div>
                  <div className="text-center text-gray-800 drop-shadow">
                    <div>NEUTRAL</div>
                    <div className="text-[10px] mt-1">45-55</div>
                  </div>
                  <div className="text-center text-white drop-shadow-lg">
                    <div>GREED</div>
                    <div className="text-[10px] mt-1">56-74</div>
                  </div>
                  <div className="text-center text-white drop-shadow-lg">
                    <div className="text-base">EXTREME</div>
                    <div>GREED</div>
                    <div className="text-[10px] mt-1">75-100</div>
                  </div>
                </div>

                {/* Current level indicator - exact match to Panic page structure */}
                {marketData && (
                  <div
                    className="absolute top-0 bottom-0 w-2 bg-black shadow-lg transition-all duration-500"
                    style={{ left: `calc(${marketData.overallScore}% - 4px)` }}
                  >
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <div className="bg-black text-white px-4 py-2 rounded-lg shadow-xl">
                        <div className="text-xs font-semibold">TODAY</div>
                        <div className="text-2xl font-bold">{marketData.overallScore.toFixed(0)}</div>
                        <div className="text-xs text-center">
                          {marketData.overallScore <= 24
                            ? "Extreme Fear"
                            : marketData.overallScore <= 44
                              ? "Fear"
                              : marketData.overallScore <= 55
                                ? "Neutral"
                                : marketData.overallScore <= 74
                                  ? "Greed"
                                  : "Extreme Greed"}
                        </div>
                      </div>
                      <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-green-500 mx-auto" />
                    </div>
                  </div>
                )}
              </div>

              {/* Component breakdown bars */}
              <div className="space-y-3 mt-16">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <ActivityIcon className="h-4 w-4 text-primary" />
                  Component Breakdown
                </h3>

                {[
                  {
                    name: "Market Volatility (VIX)",
                    value: marketData.vixVs50DayMA ?? 50,
                    tooltip: "VIX vs 50-day MA. High VIX = fear; low = greed",
                  },
                  {
                    name: "Put/Call Ratio",
                    value: ((marketData.putCallRatio ?? 1) - 0.7) * 100,
                    tooltip: "5-day average. High ratio (>1) = more puts = fear",
                  },
                  {
                    name: "Stock Price Momentum",
                    value: 50 + (marketData.marketMomentum ?? 0) / 2,
                    tooltip: "S&P 500 vs 125-day MA. Above average = greed",
                  },
                  {
                    name: "Stock Price Strength",
                    value: marketData.stockPriceStrength ?? 50,
                    tooltip: "52-week highs vs lows. More highs = greed",
                  },
                  {
                    name: "Stock Price Breadth",
                    value: marketData.stockBreadth ?? 50,
                    tooltip: "Advancing vs declining volume. Strong = greed",
                  },
                  {
                    name: "Junk Bond Spread",
                    value: Math.max(0, Math.min(100, 100 - (marketData.junkBondSpread ?? 5) * 10)),
                    tooltip: "High-yield vs investment-grade. Narrow = greed",
                  },
                  {
                    name: "Safe Haven Demand",
                    value: 50 - (marketData.safeHavenDemand ?? 0),
                    tooltip: "Stocks vs Treasuries. Treasuries outperforming = fear",
                  },
                ].map((component, idx) => {
                  const normalizedValue = Math.max(0, Math.min(100, component.value))
                  const getColor = (val: number) => {
                    if (val <= 24) return "bg-green-500"
                    if (val <= 44) return "bg-green-400"
                    if (val <= 55) return "bg-yellow-400"
                    if (val <= 74) return "bg-orange-500"
                    return "bg-red-500"
                  }

                  return (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-700">{component.name}</span>
                          <div className="relative group/tooltip">
                            <InfoIcon />
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                              {component.tooltip}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-gray-900">{normalizedValue.toFixed(0)}</span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getColor(normalizedValue)} transition-all duration-500`}
                          style={{ width: `${normalizedValue}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Historical Reference Points */}
              <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-xs font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <InfoIcon />
                  Historical Reference Points
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-green-600">COVID-19 Crash (Mar 2020):</span>
                    <span className="ml-1 text-gray-700">12 (Extreme Fear)</span>
                  </div>
                  <div>
                    <span className="font-semibold text-red-600">Meme Stock Peak (Feb 2021):</span>
                    <span className="ml-1 text-gray-700">89 (Extreme Greed)</span>
                  </div>
                  <div>
                    <span className="font-semibold text-green-600">2022 Bear Market Low:</span>
                    <span className="ml-1 text-gray-700">18 (Extreme Fear)</span>
                  </div>
                  <div>
                    <span className="font-semibold text-red-600">AI Rally Peak (Jul 2024):</span>
                    <span className="ml-1 text-gray-700">83 (Extreme Greed)</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fear & Greed Index - Main Card with detailed indicators */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ActivityIcon className="h-5 w-5 text-primary" />
              Fear & Greed Index
              {lastUpdated && (
                <span className="text-xs font-normal text-gray-500">(Updated: {lastUpdated.toLocaleTimeString()})</span>
              )}
            </CardTitle>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
              className="bg-green-50 hover:bg-green-100 border-green-200"
            >
              <span className={refreshing ? "animate-spin mr-2" : "mr-2"}>
                <RefreshIcon />
              </span>
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className={`transition-opacity duration-300 ${refreshing ? "opacity-50" : "opacity-100"}`}>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Overall Score */}
              <div className={`p-6 rounded-lg border-2 ${getScoreBackground(marketData.overallScore)}`}>
                <div className="text-sm font-semibold text-gray-600 mb-2">Overall Market Sentiment</div>
                <div className="flex items-baseline gap-3">
                  <div className={`text-5xl font-bold ${getScoreColor(marketData.overallScore)}`}>
                    {marketData.overallScore.toFixed(2)}
                  </div>
                  <div className="text-2xl font-semibold text-gray-700">/100</div>
                </div>
                <div className={`text-lg font-bold mt-2 ${getScoreColor(marketData.overallScore)}`}>
                  {marketData.sentiment}
                </div>
                <div className="flex flex-col gap-2 mt-3 text-xs">
                  <div className="flex items-center gap-1">
                    {(marketData.yesterdayChange ?? 0) > 0 ? (
                      <TrendingUpIcon />
                    ) : (marketData.yesterdayChange ?? 0) < 0 ? (
                      <TrendingDownIcon />
                    ) : (
                      <MinusIcon />
                    )}
                    <span className="font-semibold text-gray-700">
                      Yesterday: {(marketData.yesterdayChange ?? 0) > 0 ? "+" : ""}
                      {(marketData.yesterdayChange ?? 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(marketData.lastWeekChange ?? 0) > 0 ? (
                      <TrendingUpIcon />
                    ) : (marketData.lastWeekChange ?? 0) < 0 ? (
                      <TrendingDownIcon />
                    ) : (
                      <MinusIcon />
                    )}
                    <span className="font-semibold text-gray-700">
                      Last Week: {(marketData.lastWeekChange ?? 0) > 0 ? "+" : ""}
                      {(marketData.lastWeekChange ?? 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(marketData.lastMonthChange ?? 0) > 0 ? (
                      <TrendingUpIcon />
                    ) : (marketData.lastMonthChange ?? 0) < 0 ? (
                      <TrendingDownIcon />
                    ) : (
                      <MinusIcon />
                    )}
                    <span className="font-semibold text-gray-700">
                      Last Month: {(marketData.lastMonthChange ?? 0) > 0 ? "+" : ""}
                      {(marketData.lastMonthChange ?? 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(marketData.lastYearChange ?? 0) > 0 ? (
                      <TrendingUpIcon />
                    ) : (marketData.lastYearChange ?? 0) < 0 ? (
                      <TrendingDownIcon />
                    ) : (
                      <MinusIcon />
                    )}
                    <span className="font-semibold text-gray-700">
                      Last Year: {(marketData.lastYearChange ?? 0) > 0 ? "+" : ""}
                      {(marketData.lastYearChange ?? 0).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Component Indicators - Standard CNN Indicators */}
              <div className="space-y-2">
                <div className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <BarChartIcon className="h-4 w-4 text-primary" />
                  Standard Market Indicators (CNN Model)
                </div>

                <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Market Volatility (VIX)</span>
                    <div className="relative group/tooltip">
                      <InfoIcon />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        VIX vs 50-day MA. High VIX = fear; low = greed. Derived from S&P 500 options IV.
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{(marketData.vix ?? 0).toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Put/Call Ratio</span>
                    <div className="relative group/tooltip">
                      <InfoIcon />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        5-day average. High ratio (&gt;1) = more puts = fear. Core options sentiment tool.
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{(marketData.putCallRatio ?? 0).toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Stock Price Momentum</span>
                    <div className="relative group/tooltip">
                      <InfoIcon />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        S&P 500 vs 125-day MA. Above average = greed; below = fear.
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {(marketData.marketMomentum ?? 0).toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Stock Price Strength</span>
                    <div className="relative group/tooltip">
                      <InfoIcon />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        52-week highs vs lows ratio. More highs = greed; more lows = fear.
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {(marketData.stockPriceStrength ?? 0).toFixed(0)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Stock Price Breadth</span>
                    <div className="relative group/tooltip">
                      <InfoIcon />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        Advancing vs declining volume. Strong breadth = greed; weak = fear.
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{marketData.stockBreadth ?? 0}.toFixed(1)%</span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Junk Bond Spread</span>
                    <div className="relative group/tooltip">
                      <InfoIcon />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        High-yield vs investment-grade spread. Narrow = greed; wide = fear.
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {(marketData.junkBondSpread ?? 0).toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Safe Haven Demand</span>
                    <div className="relative group/tooltip">
                      <InfoIcon />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        Stocks vs Treasuries (20-day). Treasuries outperforming = fear.
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {(marketData.safeHavenDemand ?? 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Options-Focused Indicators */}
            <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <div className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                <ActivityIcon className="h-4 w-4" />
                Options-Focused Indicators (Enhanced for Options Traders)
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 bg-white rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Volatility Skew</span>
                    <div className="relative group/tooltip">
                      <InfoIcon />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        OTM put IV vs call IV. High skew = fear (put protection demand).
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-blue-900">
                    {(marketData.volatilitySkew ?? 0).toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Open Interest P/C</span>
                    <div className="relative group/tooltip">
                      <InfoIcon />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        Total open interest puts vs calls. High = fear (open bearish positions).
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-blue-900">
                    {(marketData.openInterestPutCall ?? 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">VIX Term Structure</span>
                    <div className="relative group/tooltip">
                      <InfoIcon />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        VIX futures curve slope. Contango = greed; backwardation = fear.
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-blue-900">{marketData.vixTermStructure ?? "N/A"}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">CBOE Skew Index</span>
                    <div className="relative group/tooltip">
                      <InfoIcon />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        Tail-risk perception in SPX options. High = fear of black swan events. Neutral ~115-120.
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-blue-900">{(marketData.cboeSkewIndex ?? 0).toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* Trading Guidance */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm font-semibold text-blue-900 mb-2">Put-Selling Confidence</div>
              <div className="text-sm text-blue-800">
                {marketData.overallScore <= 24 &&
                  "High confidence - Market showing extreme fear. Excellent time for aggressive put selling."}
                {marketData.overallScore > 24 &&
                  marketData.overallScore <= 44 &&
                  "Moderate confidence - Market showing fear. Good environment for put selling."}
                {marketData.overallScore > 44 &&
                  marketData.overallScore <= 55 &&
                  "Neutral confidence - Market balanced. Selective put selling recommended."}
                {marketData.overallScore > 55 &&
                  marketData.overallScore <= 74 &&
                  "Low confidence - Market showing greed. Reduce put selling exposure."}
                {marketData.overallScore > 74 &&
                  "Very low confidence - Extreme greed detected. Avoid new put positions."}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sentiment Heatmap */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TrendingUpIcon className="h-5 w-5 text-primary" />
            Sentiment Heatmap
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">Social media sentiment analysis for major market indices</p>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Indices Section */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <BarChartIcon className="h-4 w-4 text-primary" />
              Major Indices
            </h3>
            <div className="space-y-3">
              {safeSentimentData
                .filter((item) => item.category === "index")
                .map((item) => (
                  <div
                    key={item.ticker}
                    className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-bold text-gray-900">{item.ticker}</div>
                        <div className="text-sm text-gray-600">{item.sector}</div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-lg font-bold ${item.netSentiment > 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {item.netSentiment > 0 ? "+" : ""}
                          {item.netSentiment}
                        </div>
                        <div className="text-xs text-gray-500">{item.volume.toLocaleString()} mentions</div>
                      </div>
                    </div>

                    {/* Sentiment Bar */}
                    <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
                      <div className="absolute inset-0 flex">
                        <div className="bg-red-500 transition-all" style={{ width: `${item.bearishScore}%` }} />
                        <div className="bg-green-500 transition-all" style={{ width: `${item.bullishScore}%` }} />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-semibold text-white">
                        <span>Bearish {item.bearishScore}%</span>
                        <span>Bullish {item.bullishScore}%</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
            Data aggregated from Reddit, Twitter, YouTube, and financial forums. Updated every 15 minutes.
          </div>
        </CardContent>
      </Card>

      {/* Trade Recommendations & Portfolio Guidance */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TargetIcon className="h-5 w-5 text-primary" />
            Trade Recommendations & Portfolio Guidance
            {refreshing && <span className="text-xs font-normal text-primary animate-pulse">(Recalculating...)</span>}
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Expert recommendations based on current {recommendations.level} market conditions
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className={`transition-opacity duration-300 ${refreshing ? "opacity-50" : "opacity-100"}`}>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Portfolio Allocation */}
              <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSignIcon className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-gray-900">Portfolio Allocation</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm font-medium text-gray-700">Cash on Hand</span>
                    <span className="text-sm font-bold text-primary">{recommendations.cashAllocation}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm font-medium text-gray-700">Market Exposure</span>
                    <span className="text-sm font-bold text-primary">{recommendations.marketExposure}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm font-medium text-gray-700">Position Size</span>
                    <span className="text-sm font-bold text-primary">{recommendations.positionSize}</span>
                  </div>
                </div>
              </div>

              {/* Recommended Strategies */}
              <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <LightbulbIcon className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-gray-900">Recommended Strategies</h3>
                </div>
                <ul className="space-y-2">
                  {recommendations.strategies.map((strategy, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-primary mt-1 flex-shrink-0">•</span>
                      <span>{strategy}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Risk Management */}
            <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <ShieldIcon className="h-5 w-5 text-blue-700" />
                <h3 className="font-bold text-blue-900">Risk Management Guidelines</h3>
              </div>
              <ul className="space-y-2">
                {recommendations.riskManagement.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-blue-800">
                    <span className="text-blue-600 mt-1">✓</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Coach Tips */}
            <div className={`mt-4 p-4 rounded-lg border-2 ${getScoreBackground(marketData.overallScore)}`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUpIcon className={`h-5 w-5 ${getScoreColor(marketData.overallScore)}`} />
                <h3 className={`font-bold ${getScoreColor(marketData.overallScore)}`}>Expert Coach Insight</h3>
              </div>
              <p className={`text-sm ${getScoreColor(marketData.overallScore)}`}>{recommendations.coachTips}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Allocation by Fear & Greed Level */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-900">Portfolio Allocation by Fear & Greed Level</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Recommended asset class diversification across market sentiment levels
          </p>
        </CardHeader>
        <CardContent className="pt-4 pb-4">
          <div className="space-y-2">
            {[
              { range: "0-24", level: "Extreme Fear", data: getPortfolioAllocation(12) },
              { range: "25-44", level: "Fear", data: getPortfolioAllocation(34) },
              { range: "45-55", level: "Neutral", data: getPortfolioAllocation(50) },
              { range: "56-74", level: "Greed", data: getPortfolioAllocation(65) },
              { range: "75-100", level: "Extreme Greed", data: getPortfolioAllocation(87) },
            ].map((item, index) => {
              const isCurrent =
                marketData.overallScore >= Number.parseInt(item.range.split("-")[0]) &&
                marketData.overallScore <= Number.parseInt(item.range.split("-")[1])

              return (
                <div
                  key={index}
                  className={`p-4 rounded-lg border transition-colors ${
                    isCurrent ? "border-primary bg-green-50 shadow-sm" : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-mono text-sm font-bold text-gray-900">Score {item.range}</span>
                        <span
                          className={`ml-3 font-bold text-sm ${
                            index === 0
                              ? "text-green-600"
                              : index === 1
                                ? "text-green-500"
                                : index === 2
                                  ? "text-yellow-600"
                                  : index === 3
                                    ? "text-orange-600"
                                    : "text-red-600"
                          }`}
                        >
                          {item.level}
                        </span>
                      </div>
                      {isCurrent && (
                        <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">CURRENT</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 italic">{item.data.description}</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                      <div className="text-xs font-semibold text-blue-900 uppercase mb-1">Stocks/ETFs</div>
                      <div className="text-lg font-bold text-blue-900">{item.data.stocks}</div>
                    </div>
                    <div className="p-3 bg-purple-50 rounded border border-purple-200">
                      <div className="text-xs font-semibold text-purple-900 uppercase mb-1">Options</div>
                      <div className="text-lg font-bold text-purple-900">{item.data.options}</div>
                    </div>
                    <div className="p-3 bg-orange-50 rounded border border-orange-200">
                      <div className="text-xs font-semibold text-orange-900 uppercase mb-1">BTC/Crypto</div>
                      <div className="text-lg font-bold text-orange-900">{item.data.crypto}</div>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                      <div className="text-xs font-semibold text-yellow-900 uppercase mb-1">Gold/Silver</div>
                      <div className="text-lg font-bold text-yellow-900">{item.data.gold}</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded border border-gray-300">
                      <div className="text-xs font-semibold text-gray-900 uppercase mb-1">Cash Reserve</div>
                      <div className="text-lg font-bold text-gray-900">{item.data.cash}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {item.data.rationale.map((point, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-primary mt-1 flex-shrink-0">•</span>
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800 leading-relaxed">
              <strong>Note:</strong> These allocations are guidelines based on historical market patterns. Always adjust
              based on your personal risk tolerance, time horizon, and financial goals. Consult with a financial advisor
              for personalized advice.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <InfoIcon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-gray-900 mb-2">About the Fear & Greed Index</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                This index quantifies investor emotions on a scale from 0 (extreme fear) to 100 (extreme greed). Based
                on CNN's methodology, it combines <strong>7 equally-weighted market indicators</strong> with additional
                options-specific metrics. Options pricing and activity are highly sensitive to sentiment—fear drives
                higher put buying and volatility, while greed boosts call activity and risk-taking. Each indicator is
                normalized to a 0-100 scale based on historical extremes, then averaged for the final score.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
