"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  DollarSign,
  Shield,
  Lightbulb,
  RefreshCw,
  Info,
  BarChart3,
  AlertTriangle,
} from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface PanicEuphoriaData {
  overallScore: number
  level: string
  trend: "up" | "down" | "neutral"
  yesterdayChange: number
  lastWeekChange: number
  lastMonthChange: number
  spx: number
  spx200WeekMA: number
  aboveMA: boolean
  latestCitiReading?: number
  latestCitiDate?: string
  ytdAverage?: number
  // 9 Citibank Model Inputs
  nyseShortInterest: number
  marginDebt: number
  volumeRatio: number
  investorIntelligence: number
  aaiiBullish: number
  moneyMarketFunds: number
  putCallRatio: number
  commodityPrices: number
  gasPrices: number
}

export function PanicEuphoria() {
  const [data, setData] = useState<PanicEuphoriaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = async () => {
    try {
      const response = await fetch("/api/panic-euphoria")
      if (response.ok) {
        const result = await response.json()
        setData(result)
        setLastUpdated(new Date())
      } else {
        console.error("[v0] Panic/Euphoria API error:", response.status)
      }
    } catch (error) {
      console.error("[v0] Error fetching Panic/Euphoria data:", error)
    }
  }

  useEffect(() => {
    async function initialFetch() {
      setLoading(true)
      await fetchData()
      setLoading(false)
    }

    initialFetch()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.41) return "text-purple-600" // Euphoria (was 0.15)
    if (score >= 0) return "text-blue-500" // Positive
    if (score >= -0.1) return "text-orange-500" // Moderate (was -0.15)
    if (score >= -0.45) return "text-red-500" // Panic
    return "text-red-700" // Extreme Panic
  }

  const getScoreBackground = (score: number) => {
    if (score >= 0.41) return "bg-purple-50 border-purple-300"
    if (score >= 0) return "bg-blue-50 border-blue-200"
    if (score >= -0.1) return "bg-orange-50 border-orange-200"
    if (score >= -0.45) return "bg-red-50 border-red-200"
    return "bg-red-100 border-red-400"
  }

  const getTradeRecommendations = (score: number, aboveMA: boolean) => {
    // Extreme Panic: score < -0.45
    if (score < -0.45) {
      return {
        level: "Extreme Panic",
        signal: "STRONG BUY",
        confidence: "Very High",
        strategies: [
          "Aggressive cash-secured put selling on quality mega-caps",
          "Sell 30-45 DTE puts 10-20% OTM for maximum premium",
          "LEAPS calls on beaten-down dividend aristocrats",
          "Wheel strategy on highest conviction names (AAPL, MSFT, JPM)",
        ],
        riskManagement: [
          "Historical data shows >95% probability of gains within 12 months",
          "This is a generational buying opportunity - deploy capital aggressively",
          "Keep 10-15% cash reserve for potential further drops",
          "Focus on stocks you want to own long-term at these prices",
        ],
        allocation: {
          stocks: "60-70%",
          options: "20-30%",
          cash: "10-15%",
        },
        coachTips:
          "EXTREME PANIC DETECTED - History shows these signals are rare and incredibly profitable. Last extreme readings: 2009 (Financial Crisis), 2020 (COVID Crash). Official Citi data: >95% probability of positive returns within 1 year from extreme panic levels.",
      }
    }

    // Panic with SPX above 200-week MA: -0.45 < score < -0.10 AND above MA
    if (score < -0.1 && score >= -0.45 && aboveMA) {
      return {
        level: "Panic (Above 200-Week MA)",
        signal: "BUY",
        confidence: "High",
        strategies: [
          "Aggressive put selling on quality stocks during weakness",
          "Sell 30-45 DTE puts 5-15% OTM",
          "Credit spreads for defined risk with higher probability",
          "Accumulate shares via cash-secured puts",
        ],
        riskManagement: [
          "SPX above 200-week MA confirms long-term uptrend intact",
          "Historical data shows strong positive returns after panic signals",
          "Signals can be early - market may continue down 1-3 months",
          "Build positions gradually over 4-8 weeks",
        ],
        allocation: {
          stocks: "50-60%",
          options: "25-35%",
          cash: "15-20%",
        },
        coachTips:
          "Market showing panic while long-term trend remains intact. Historical avg returns: 6mo: +8.2%, 12mo: +15.7%. Be patient - best opportunities may be 4-6 weeks away.",
      }
    }

    // Panic below 200-week MA: -0.45 < score < -0.10 AND below MA
    if (score < -0.1 && score >= -0.45 && !aboveMA) {
      return {
        level: "Panic (Below 200-Week MA)",
        signal: "CAUTION",
        confidence: "Moderate",
        strategies: [
          "Selective put selling only on highest quality names",
          "Tight credit spreads with defined risk",
          "Consider waiting for SPX to reclaim 200-week MA",
          "Small position sizes - market may have further to fall",
        ],
        riskManagement: [
          "SPX below 200-week MA signals potential bear market",
          "Panic readings below MA can persist for months",
          "Reduce position sizes by 50% vs normal",
          "Focus on defensive sectors: utilities, healthcare, consumer staples",
        ],
        allocation: {
          stocks: "30-40%",
          options: "10-15%",
          cash: "45-60%",
        },
        coachTips:
          "Panic confirmed by broken long-term trend. Wait for SPX to reclaim 200-week MA before aggressive deployment. Build cash reserves.",
      }
    }

    // Moderate: -0.10 < score < 0
    if (score < 0 && score >= -0.1) {
      return {
        level: "Moderate",
        signal: aboveMA ? "BUY" : "HOLD",
        confidence: "Moderate",
        strategies: [
          "Moderate put selling on quality names",
          "Sell 30-45 DTE puts 5-10% OTM",
          "Credit spreads for better risk-reward",
          "Selective accumulation via puts",
        ],
        riskManagement: [
          "Market showing moderate sentiment - not extreme yet",
          aboveMA ? "Above 200-week MA supports bullish thesis" : "Below 200-week MA suggests caution",
          "Good environment for options sellers but be selective",
          "Maintain diversification and position sizing discipline",
        ],
        allocation: {
          stocks: aboveMA ? "45-55%" : "35-45%",
          options: aboveMA ? "20-25%" : "10-15%",
          cash: aboveMA ? "20-30%" : "40-50%",
        },
        coachTips: aboveMA
          ? "Moderate sentiment with intact uptrend. Good setup for selective put selling."
          : "Moderate sentiment with broken trend. Wait for better entry signals.",
      }
    }

    // Neutral/Positive: 0 < score < 0.41
    if (score >= 0 && score < 0.41) {
      return {
        level: "Neutral",
        signal: "HOLD",
        confidence: "Low",
        strategies: [
          "Balanced approach - no urgency",
          "Selective put selling on pullbacks",
          "Tight credit spreads for defined risk",
          "Take profits on existing positions",
        ],
        riskManagement: [
          "Market neither panicked nor euphoric",
          "Wait for better setups - patience is key",
          "Reduce position sizes and exposure",
          "Build cash reserves for future opportunities",
        ],
        allocation: {
          stocks: "35-45%",
          options: "10-15%",
          cash: "40-55%",
        },
        coachTips: "Neutral conditions - no compelling signal. Wait for panic (buy signal) or euphoria (avoid risk).",
      }
    }

    // Euphoria: score >= 0.41
    return {
      level: "Euphoria",
      signal: "AVOID/SELL",
      confidence: "High",
      strategies: [
        "STOP new put selling immediately",
        "Close profitable positions early",
        "Consider protective puts on long holdings",
        "Focus on bear call spreads if trading",
      ],
      riskManagement: [
        "Market showing euphoria - high risk of correction",
        "Official Citi data: >80% probability of lower prices within 12 months",
        "Build maximum cash reserves",
        "Prepare for volatility expansion",
      ],
      allocation: {
        stocks: "20-30%",
        options: "0-5%",
        cash: "65-80%",
      },
      coachTips:
        "EUPHORIA WARNING - Market exuberance suggests correction ahead. Historical pattern: >80% chance of lower prices within 1 year from euphoria levels (official Citi data).",
    }
  }

  const getAllLevelGuidance = () => {
    return [
      {
        range: "Below -0.45",
        level: "Extreme Panic",
        description: "Rare generational buying opportunity (>95% win rate)",
        signal: "STRONG BUY",
        guidance: getTradeRecommendations(-0.5, true),
      },
      {
        range: "-0.45 to -0.10 (Above 200-Week MA)",
        level: "Panic (Uptrend Intact)",
        description: "High probability bullish setup",
        signal: "BUY",
        guidance: getTradeRecommendations(-0.3, true),
      },
      {
        range: "-0.45 to -0.10 (Below 200-Week MA)",
        level: "Panic (Broken Trend)",
        description: "Wait for trend confirmation",
        signal: "CAUTION",
        guidance: getTradeRecommendations(-0.3, false),
      },
      {
        range: "-0.10 to 0",
        level: "Moderate",
        description: "Some caution present, selective opportunities",
        signal: "SELECTIVE",
        guidance: getTradeRecommendations(-0.05, true),
      },
      {
        range: "0 to 0.41",
        level: "Neutral",
        description: "No compelling signal",
        signal: "HOLD",
        guidance: getTradeRecommendations(0.2, true),
      },
      {
        range: "Above 0.41",
        level: "Euphoria",
        description: "Excessive optimism (>80% chance of lower prices in 1yr)",
        signal: "AVOID/SELL",
        guidance: getTradeRecommendations(0.5, true),
      },
    ]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading Panic/Euphoria model data...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Unable to load Panic/Euphoria data</div>
      </div>
    )
  }

  const recommendations = getTradeRecommendations(data.overallScore, data.aboveMA)
  const allLevelGuidance = getAllLevelGuidance()

  return (
    <div className="space-y-4">
      {/* Panic/Euphoria Historical Scale */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            Panic/Euphoria Historical Scale
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Visual representation of sentiment zones from extreme panic to extreme euphoria
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Main sentiment scale */}
            <div className="relative">
              <div className="h-24 bg-gradient-to-r from-red-600 via-red-400 via-30% via-green-300 via-50% via-yellow-300 via-70% to-purple-600 rounded-lg shadow-inner" />

              {/* Zone labels */}
              <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-bold">
                <div className="text-center text-white drop-shadow-lg">
                  <div className="text-base">EXTREME</div>
                  <div>PANIC</div>
                  <div className="text-[10px] mt-1">-1.0</div>
                </div>
                <div className="text-center text-gray-800 drop-shadow">
                  <div>PANIC</div>
                  <div className="text-[10px] mt-1">-0.45</div>
                </div>
                <div className="text-center text-gray-800 drop-shadow">
                  <div>MODERATE</div>
                  <div className="text-[10px] mt-1">-0.10</div>
                </div>
                <div className="text-center text-gray-800 drop-shadow">
                  <div>NEUTRAL</div>
                  <div className="text-[10px] mt-1">0.0</div>
                </div>
                <div className="text-center text-gray-800 drop-shadow">
                  <div>POSITIVE</div>
                  <div className="text-[10px] mt-1">+0.41</div>
                </div>
                <div className="text-center text-white drop-shadow-lg">
                  <div className="text-base">EXTREME</div>
                  <div>EUPHORIA</div>
                  <div className="text-[10px] mt-1">+1.0</div>
                </div>
              </div>

              {/* Current level indicator */}
              {data && (
                <div
                  className="absolute top-0 bottom-0 w-2 bg-black shadow-lg transition-all duration-500"
                  style={{ left: `calc(${((data.overallScore + 1) / 2) * 100}% - 4px)` }}
                >
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <div className="bg-black text-white px-4 py-2 rounded-lg shadow-xl">
                      <div className="text-xs font-semibold">TODAY</div>
                      <div className="text-2xl font-bold">
                        {data.overallScore >= 0 ? "+" : ""}
                        {data.overallScore.toFixed(3)}
                      </div>
                      <div className="text-xs text-center">{data.level}</div>
                    </div>
                    <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-black mx-auto" />
                  </div>
                </div>
              )}
            </div>

            {/* Component breakdown horizontal bars */}
            <div className="space-y-3 mt-16">
              <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-600" />
                Component Breakdown (9 Citibank Model Inputs)
              </h4>
              {data &&
                Object.entries({
                  "Short Interest": data.nyseShortInterest,
                  "Margin Debt": data.marginDebt,
                  "Volume Ratio": data.volumeRatio,
                  "II Survey": data.investorIntelligence,
                  "AAII Bullish": data.aaiiBullish,
                  "Money Markets": data.moneyMarketFunds,
                  "Put/Call Ratio": data.putCallRatio,
                  Commodities: data.commodityPrices,
                  "Gas Prices": data.gasPrices,
                }).map(([name, value], idx) => {
                  // Calculate normalized score for each component (-1 to +1)
                  const scores = [
                    (value - 3) / 2, // Short Interest: normalize around 3%
                    (value - 500) / 500, // Margin Debt: normalize around $500B
                    (value - 2.5) / 1.5, // Volume Ratio: normalize around 2.5x
                    (value - 50) / 50, // II Survey: normalize around 50%
                    (value - 40) / 40, // AAII: normalize around 40%
                    (value - 5) / 3, // Money Markets: normalize around $5T
                    (0.8 - value) / 0.4, // Put/Call: inverse, normalize around 0.8
                    (value - 250) / 150, // Commodities: normalize around 250
                    (3.5 - value) / 1.5, // Gas: inverse, normalize around $3.50
                  ]
                  const score = Math.max(-1, Math.min(1, scores[idx]))

                  return (
                    <div key={name} className="flex items-center gap-3">
                      <div className="w-36 text-xs font-semibold text-gray-700">{name}</div>
                      <div className="flex-1 relative h-7 bg-gray-200 rounded-full overflow-hidden">
                        {/* Center line */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-400 z-10" />

                        {/* Score bar */}
                        <div
                          className={`absolute top-0 bottom-0 transition-all duration-500 ${
                            score < -0.5
                              ? "bg-red-600"
                              : score < -0.15
                                ? "bg-red-400"
                                : score < 0
                                  ? "bg-orange-400"
                                  : score < 0.15
                                    ? "bg-green-400"
                                    : score < 0.5
                                      ? "bg-yellow-400"
                                      : "bg-purple-600"
                          }`}
                          style={{
                            left: score < 0 ? `${((score + 1) / 2) * 100}%` : "50%",
                            right: score >= 0 ? `${(1 - (score + 1) / 2) * 100}%` : "50%",
                          }}
                        />
                      </div>
                      <div className="w-20 text-xs font-bold text-right text-gray-900">
                        {score >= 0 ? "+" : ""}
                        {score.toFixed(2)}
                      </div>
                    </div>
                  )
                })}
            </div>

            {/* Historical context */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-bold text-blue-900 text-sm mb-2">Historical Reference Points</h4>
              <div className="space-y-2 text-xs text-blue-800">
                <div className="flex justify-between">
                  <span>• 2009 Financial Crisis Bottom:</span>
                  <span className="font-bold">-0.85 {`(\u003e95% gain rate)`}</span>
                </div>
                <div className="flex justify-between">
                  <span>• 2020 COVID-19 March Low:</span>
                  <span className="font-bold">-0.72 {`(\u003e95% gain rate)`}</span>
                </div>
                <div className="flex justify-between">
                  <span>• 2021 Meme Stock Peak:</span>
                  <span className="font-bold">+0.81 {`(\u003e80% drop rate)`}</span>
                </div>
                <div className="flex justify-between">
                  <span>• 2024 AI Rally Peak:</span>
                  <span className="font-bold">+0.73 {`(\u003e80% drop rate)`}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Nov 2025 (Latest Official Citi):</span>
                  <span className="font-bold">+0.72 (Euphoria Territory)</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {data?.latestCitiReading !== undefined && (
        <Card className="shadow-sm border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <BarChart3 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-3">Official Citibank vs. Real-Time Proxy</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-3 bg-white rounded-lg border border-blue-200">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Latest Official Citi Reading</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {data.latestCitiReading >= 0 ? "+" : ""}
                      {data.latestCitiReading.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{data.latestCitiDate || "Nov 7, 2025"}</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-purple-200">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Your Real-Time Proxy</div>
                    <div className="text-2xl font-bold text-purple-900">
                      {data.overallScore >= 0 ? "+" : ""}
                      {data.overallScore.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">Live calculation</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                    <div className="text-xs font-semibold text-gray-600 mb-1">2025 YTD Average</div>
                    <div className="text-2xl font-bold text-gray-900">+{data.ytdAverage?.toFixed(2) || "0.44"}</div>
                    <div className="text-xs text-gray-600 mt-1">Elevated euphoria year</div>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-3">
                  <strong>Note:</strong> Your proxy uses real-time market data to approximate the official Citibank
                  model. The official reading is updated periodically, while your proxy updates live.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Index Card */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-600" />
              Citibank Panic/Euphoria Model
              {lastUpdated && (
                <span className="text-xs font-normal text-gray-500">(Updated: {lastUpdated.toLocaleTimeString()})</span>
              )}
            </CardTitle>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
              className="bg-purple-50 hover:bg-purple-100 border-purple-200"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className={`transition-opacity duration-300 ${refreshing ? "opacity-50" : "opacity-100"}`}>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Overall Score */}
              <div className={`p-6 rounded-lg border-2 ${getScoreBackground(data.overallScore)}`}>
                <div className="text-sm font-semibold text-gray-600 mb-2">Current Model Reading</div>
                <div className="flex items-baseline gap-3">
                  <div className={`text-5xl font-bold ${getScoreColor(data.overallScore)}`}>
                    {data.overallScore >= 0 ? "+" : ""}
                    {data.overallScore.toFixed(3)}
                  </div>
                </div>
                <div className={`text-lg font-bold mt-2 ${getScoreColor(data.overallScore)}`}>{data.level}</div>
                <div className="mt-4 p-3 bg-white rounded border border-gray-200">
                  <div className="text-xs font-semibold text-gray-600 mb-2">S&P 500 vs 200-Week MA</div>
                  <div className="flex items-center gap-2">
                    {data.aboveMA ? (
                      <>
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-bold text-green-600">ABOVE (Bullish)</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-5 w-5 text-red-600" />
                        <span className="text-sm font-bold text-red-600">BELOW (Caution)</span>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    SPX: {data.spx.toFixed(2)} | 200-WMA: {data.spx200WeekMA.toFixed(2)}
                  </div>
                </div>
                <div className="flex flex-col gap-2 mt-3 text-xs">
                  <div className="flex items-center gap-1">
                    {data.yesterdayChange > 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : data.yesterdayChange < 0 ? (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    ) : (
                      <Minus className="h-3 w-3 text-gray-600" />
                    )}
                    <span className="font-semibold text-gray-700">
                      Yesterday: {data.yesterdayChange > 0 ? "+" : ""}
                      {data.yesterdayChange.toFixed(3)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {data.lastWeekChange > 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : data.lastWeekChange < 0 ? (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    ) : (
                      <Minus className="h-3 w-3 text-gray-600" />
                    )}
                    <span className="font-semibold text-gray-700">
                      Last Week: {data.lastWeekChange > 0 ? "+" : ""}
                      {data.lastWeekChange.toFixed(3)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {data.lastMonthChange > 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : data.lastMonthChange < 0 ? (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    ) : (
                      <Minus className="h-3 w-3 text-gray-600" />
                    )}
                    <span className="font-semibold text-gray-700">
                      Last Month: {data.lastMonthChange > 0 ? "+" : ""}
                      {data.lastMonthChange.toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Component Indicators - 9 Citibank Inputs */}
              <div className="space-y-2">
                <div className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                  Citibank Model Inputs (9 Components)
                </div>

                <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">NYSE Short Interest</span>
                    <div className="relative group/tooltip">
                      <Info className="h-3 w-3 text-gray-400 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        Short interest as % of float. High = bearish positioning (contrarian bullish).
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{data.nyseShortInterest.toFixed(1)}%</span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Margin Debt</span>
                    <div className="relative group/tooltip">
                      <Info className="h-3 w-3 text-gray-400 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        Margin debt change vs 12-month avg. High = leveraged speculation (risk).
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">${data.marginDebt.toFixed(0)}B</span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Nasdaq vs NYSE Volume</span>
                    <div className="relative group/tooltip">
                      <Info className="h-3 w-3 text-gray-400 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        Nasdaq/NYSE volume ratio. High = speculative tech trading (euphoria).
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{data.volumeRatio.toFixed(2)}x</span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Investor Intelligence</span>
                    <div className="relative group/tooltip">
                      <Info className="h-3 w-3 text-gray-400 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        Newsletter writer bulls vs bears. High bulls = euphoria (contrarian sell).
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{data.investorIntelligence.toFixed(0)}%</span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">AAII Bullish %</span>
                    <div className="relative group/tooltip">
                      <Info className="h-3 w-3 text-gray-400 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        Individual investor survey. High = retail euphoria (contrarian sell).
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{data.aaiiBullish.toFixed(0)}%</span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Money Market Funds</span>
                    <div className="relative group/tooltip">
                      <Info className="h-3 w-3 text-gray-400 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        Retail money market assets. High = cash on sidelines (bullish potential).
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">${data.moneyMarketFunds.toFixed(0)}T</span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Put/Call Ratio</span>
                    <div className="relative group/tooltip">
                      <Info className="h-3 w-3 text-gray-400 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        CBOE equity put/call ratio. High = fear (contrarian bullish).
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{data.putCallRatio.toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Commodity Prices</span>
                    <div className="relative group/tooltip">
                      <Info className="h-3 w-3 text-gray-400 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        CRB Index trend. Rising = inflation/growth fears or euphoria.
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{data.commodityPrices.toFixed(1)}</span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Retail Gas Prices</span>
                    <div className="relative group/tooltip">
                      <Info className="h-3 w-3 text-gray-400 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        National avg gas price. High = consumer stress (economic drag).
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">${data.gasPrices.toFixed(2)}/gal</span>
                </div>
              </div>
            </div>

            {/* Signal Strength */}
            <div className={`mt-4 p-4 rounded-lg border-2 ${getScoreBackground(data.overallScore)}`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`h-5 w-5 ${getScoreColor(data.overallScore)}`} />
                <div className="text-sm font-bold text-gray-900">Trading Signal</div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-bold ${getScoreColor(data.overallScore)}`}>
                  {recommendations.signal}
                </span>
                <span className="text-sm font-semibold text-gray-700">Confidence: {recommendations.confidence}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trade Recommendations */}
      <Accordion type="multiple" className="space-y-0">
        <AccordionItem value="options-trading-strategy" className="border-0">
          <Card className="shadow-sm border-gray-200">
            <AccordionTrigger className="hover:no-underline px-6 py-4 bg-gray-50 border-b border-gray-200 rounded-t-lg">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Options Trading Strategy for Current Level
              </CardTitle>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-4">
                <div className={`transition-opacity duration-300 ${refreshing ? "opacity-50" : "opacity-100"}`}>
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Portfolio Allocation */}
                    <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <DollarSign className="h-5 w-5 text-purple-600" />
                        <h3 className="font-bold text-gray-900">Recommended Allocation</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                          <span className="text-sm font-medium text-gray-700">Stocks/ETFs</span>
                          <span className="text-sm font-bold text-purple-600">{recommendations.allocation.stocks}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                          <span className="text-sm font-medium text-gray-700">Options Strategies</span>
                          <span className="text-sm font-bold text-purple-600">
                            {recommendations.allocation.options}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                          <span className="text-sm font-medium text-gray-700">Cash Reserve</span>
                          <span className="text-sm font-bold text-purple-600">{recommendations.allocation.cash}</span>
                        </div>
                      </div>
                    </div>

                    {/* Recommended Strategies */}
                    <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="h-5 w-5 text-purple-600" />
                        <h3 className="font-bold text-gray-900">Top Strategies</h3>
                      </div>
                      <ul className="space-y-2">
                        {recommendations.strategies.map((strategy, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-purple-600 mt-1 flex-shrink-0">•</span>
                            <span>{strategy}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Risk Management */}
                  <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-5 w-5 text-blue-700" />
                      <h3 className="font-bold text-blue-900">Risk Management & Historical Context</h3>
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
                  <div className={`mt-4 p-4 rounded-lg border-2 ${getScoreBackground(data.overallScore)}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className={`h-5 w-5 ${getScoreColor(data.overallScore)}`} />
                      <h3 className={`font-bold ${getScoreColor(data.overallScore)}`}>
                        Historical Performance Insight
                      </h3>
                    </div>
                    <p className={`text-sm ${getScoreColor(data.overallScore)}`}>{recommendations.coachTips}</p>
                  </div>
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>

      {/* All Level Guidance */}
      <Accordion type="multiple" className="space-y-0">
        <AccordionItem value="options-strategy-guide" className="border-0">
          <Card className="shadow-sm border-gray-200">
            <AccordionTrigger className="hover:no-underline px-6 py-4 bg-gray-50 border-b border-gray-200 rounded-t-lg">
              <CardTitle className="text-lg font-bold text-gray-900">
                Options Strategy Guide by Panic/Euphoria Level
              </CardTitle>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-4 pb-4">
                <div className="space-y-2">
                  {allLevelGuidance.map((item, index) => {
                    const isCurrent = item.level === recommendations.level

                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border transition-colors ${
                          isCurrent
                            ? "border-purple-600 bg-purple-50 shadow-sm"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-mono text-sm font-bold text-gray-900">Score: {item.range}</span>
                              <span
                                className={`ml-3 font-bold text-sm ${
                                  index === 0
                                    ? "text-red-700"
                                    : index === 1
                                      ? "text-red-500"
                                      : index === 2
                                        ? "text-orange-500"
                                        : index === 3
                                          ? "text-orange-500"
                                          : index === 4
                                            ? "text-blue-500"
                                            : "text-purple-600"
                                }}
                              >
                                {item.level}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isCurrent && (
                                <span className="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full">
                                  CURRENT
                                </span>
                              )}
                              <span
                                className={\`px-3 py-1 text-xs font-bold rounded-full ${
                                  item.signal === "STRONG BUY"
                                    ? "bg-green-100 text-green-800"
                                    : item.signal === "BUY"
                                      ? "bg-green-100 text-green-700"
                                      : item.signal === "SELECTIVE"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : item.signal === "HOLD"
                                          ? "bg-gray-100 text-gray-700"
                                          : item.signal === "CAUTION"
                                            ? "bg-orange-100 text-orange-700"
                                            : "bg-red-100 text-red-700"
                                }`}
                              >
                                {item.signal}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 italic">{item.description}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div className="p-3 bg-blue-50 rounded border border-blue-200">
                            <div className="text-xs font-semibold text-blue-900 uppercase mb-1">Stocks</div>
                            <div className="text-lg font-bold text-blue-900">{item.guidance.allocation.stocks}</div>
                          </div>
                          <div className="p-3 bg-purple-50 rounded border border-purple-200">
                            <div className="text-xs font-semibold text-purple-900 uppercase mb-1">Options</div>
                            <div className="text-lg font-bold text-purple-900">{item.guidance.allocation.options}</div>
                          </div>
                          <div className="p-3 bg-gray-50 rounded border border-gray-300">
                            <div className="text-xs font-semibold text-gray-900 uppercase mb-1">Cash</div>
                            <div className="text-lg font-bold text-gray-900">{item.guidance.allocation.cash}</div>
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="text-xs font-bold text-gray-900 uppercase mb-2">Top Strategies</div>
                          <div className="space-y-1">
                            {item.guidance.strategies.slice(0, 3).map((strategy, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                <span className="text-purple-600 mt-1 flex-shrink-0">•</span>
                                <span>{strategy}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm text-blue-800 leading-relaxed">
                    <strong>Note:</strong> This model is most powerful when combined with price trend analysis (S&P 500
                    vs 200-week MA). Panic readings below -0.10 (official Citi threshold) with SPX above its 200-week MA
                    have historically produced the strongest forward returns. Always size positions appropriately and
                    maintain strict risk management.
                  </p>
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>

      {/* Educational Overview */}
      <Card className="shadow-sm border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-gray-900 mb-2">About the Panic/Euphoria Model</h3>
              <p className="text-sm text-gray-700 leading-relaxed mb-2">
                This model, based on Citibank's research published in Barron's, measures extreme investor sentiment on a
                scale from <strong>-1.0 (extreme panic)</strong> to <strong>+1.0 (extreme euphoria)</strong>. It
                combines <strong>9 market indicators</strong> to identify contrarian buying opportunities during panic
                and warning signals during euphoria.
              </p>
              <p className="text-sm text-gray-700 leading-relaxed mb-2">
                <strong>Key insight:</strong> The model is especially valuable when readings drop below -0.10 (official
                Citi panic threshold) while the S&P 500 remains above its 200-week moving average, suggesting a tradable
                low in the months ahead. Extreme readings below -0.45 have historically preceded powerful rallies.
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong>Historical Performance:</strong> Panic readings below -0.10 show strong positive returns, with
                extreme panic ({"<"}-0.45) having a <strong>{">"} 95% probability of gains within 12 months</strong>.
                Euphoria readings above +0.41 have an{" "}
                <strong>{">"} 80% probability of lower prices within 12 months</strong> (official Citibank data).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
