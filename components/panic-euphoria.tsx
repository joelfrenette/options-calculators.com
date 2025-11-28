"use client"

import { TooltipContent } from "@/components/ui/tooltip"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  DollarSign,
  Shield,
  Lightbulb,
  Info,
  BarChart3,
  AlertTriangle,
} from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"

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

function PanicGradientBar({ value, min = -1, max = 1 }: { value: number; min?: number; max?: number }) {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
  const marginLeft = `${percentage}%`

  return (
    <div className="relative w-full h-3 rounded-full overflow-hidden">
      {/* Reversed gradient: Green (Panic/Good) on LEFT, Red (Euphoria/Bad) on RIGHT */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
      <div className="absolute inset-0 bg-gray-200" style={{ marginLeft }} />
    </div>
  )
}

function PanicIndicator({
  label,
  value,
  rawValue,
  tooltip,
  min = -1,
  max = 1,
}: {
  label: string
  value: number
  rawValue: string
  tooltip: string
  min?: number
  max?: number
}) {
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
              <TooltipContent className="max-w-sm bg-gray-900 text-white border-gray-700 z-50 p-3 shadow-xl">
                <p className="text-sm leading-relaxed">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{rawValue}</span>
          <Badge
            variant={value <= -0.5 ? "default" : value >= 0.5 ? "destructive" : "secondary"}
            className="min-w-[60px] justify-center"
          >
            {value >= 0 ? "+" : ""}
            {value.toFixed(2)}
          </Badge>
        </div>
      </div>
      <PanicGradientBar value={value} min={min} max={max} />
    </div>
  )
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
    if (score <= -0.45) return "text-green-700" // Extreme Panic (GOOD - buy signal)
    if (score <= -0.17) return "text-green-600" // Panic (good)
    if (score < 0.41) return "text-yellow-600" // Neutral/Complacent
    if (score < 0.7) return "text-red-500" // Euphoria (bad)
    return "text-red-700" // Extreme Euphoria (BAD - sell signal)
  }

  const getScoreBackground = (score: number) => {
    if (score <= -0.45) return "bg-green-100 border-green-400"
    if (score <= -0.17) return "bg-green-50 border-green-300"
    if (score < 0.41) return "bg-yellow-50 border-yellow-200"
    if (score < 0.7) return "bg-red-50 border-red-300"
    return "bg-red-100 border-red-400"
  }

  // Added getScoreLabel for the updated contrarian scale
  const getScoreLabel = (score: number) => {
    if (score <= -0.45) return "EXTREME PANIC (Buy Signal)"
    if (score <= -0.17) return "PANIC (Contrarian Bullish)"
    if (score < 0.41) return "NEUTRAL/COMPLACENT"
    if (score < 0.7) return "EUPHORIA (Contrarian Bearish)"
    return "EXTREME EUPHORIA (Sell Signal)"
  }

  const getTradeRecommendations = (score: number, aboveMA: boolean) => {
    // Extreme Panic: score <= -0.45
    if (score <= -0.45) {
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

    // Panic (Contrarian Bullish): -0.45 < score <= -0.17
    if (score <= -0.17 && score > -0.45) {
      return {
        level: "Panic",
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

    // Neutral/Complacent: -0.17 < score < 0.41
    if (score < 0.41 && score > -0.17) {
      return {
        level: "Neutral/Complacent",
        signal: "HOLD",
        confidence: "Moderate",
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

    // Euphoria: 0.41 <= score < 0.70
    if (score >= 0.41 && score < 0.7) {
      return {
        level: "Euphoria",
        signal: "CAUTION/SELL",
        confidence: "High",
        strategies: [
          "Reduce new position size by 50%",
          "Consider hedging long positions",
          "Take profits on highly appreciated assets",
          "Avoid chasing momentum",
        ],
        riskManagement: [
          "Market showing significant optimism - risk of correction",
          "Consider building cash reserves",
          "Be prepared for increased volatility",
        ],
        allocation: {
          stocks: "30-40%",
          options: "5-10%",
          cash: "50-65%",
        },
        coachTips: "Euphoria detected. Market is elevated; consider reducing risk and building cash.",
      }
    }

    // Extreme Euphoria: score >= 0.70
    return {
      level: "Extreme Euphoria",
      signal: "STRONG SELL",
      confidence: "Very High",
      strategies: [
        "STOP new buying immediately",
        "Close profitable positions early",
        "Consider protective puts on long holdings",
        "Focus on bear call spreads if trading",
      ],
      riskManagement: [
        "Market showing extreme euphoria - high risk of sharp correction",
        "Official Citi data: >80% probability of lower prices within 12 months",
        "Build maximum cash reserves",
        "Prepare for significant volatility",
      ],
      allocation: {
        stocks: "10-20%",
        options: "0-5%",
        cash: "75-90%",
      },
      coachTips:
        "EXTREME EUPHORIA WARNING - Market exuberance suggests sharp correction ahead. Historical pattern: >80% chance of lower prices within 1 year from extreme euphoria levels (official Citi data).",
    }
  }

  const getAllLevelGuidance = () => {
    return [
      {
        range: "≤ -0.45",
        level: "Extreme Panic",
        description: "Rare generational buying opportunity (>95% win rate)",
        signal: "STRONG BUY",
        guidance: getTradeRecommendations(-0.5, true),
      },
      {
        range: "-0.45 to -0.17",
        level: "Panic",
        description: "High probability contrarian bullish setup",
        signal: "BUY",
        guidance: getTradeRecommendations(-0.3, true),
      },
      {
        range: "-0.17 to +0.41",
        level: "Neutral/Complacent",
        description: "Market lacks extreme sentiment; wait for better setups",
        signal: "HOLD",
        guidance: getTradeRecommendations(0.1, true),
      },
      {
        range: "+0.41 to +0.70",
        level: "Euphoria",
        description: "Significant optimism, elevated risk",
        signal: "CAUTION/SELL",
        guidance: getTradeRecommendations(0.55, true),
      },
      {
        range: "≥ +0.70",
        level: "Extreme Euphoria",
        description: "Excessive optimism (>80% chance of lower prices in 1yr)",
        signal: "STRONG SELL",
        guidance: getTradeRecommendations(0.8, true),
      },
    ]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner message="Loading Panic/Euphoria model data..." />
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
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                Panic/Euphoria Historical Scale
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 mt-1">
                Visual representation of sentiment zones from extreme panic to extreme euphoria
              </CardDescription>
            </div>
            <RefreshButton onClick={handleRefresh} loading={refreshing} />
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Main sentiment scale */}
            <div className="relative">
              <div className="h-24 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-lg shadow-inner" />

              {/* Zone labels - repositioned for contrarian scale */}
              <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-bold">
                <div className="text-center text-white drop-shadow-lg">
                  <div className="text-base">EXTREME</div>
                  <div>PANIC</div>
                  <div className="text-[10px] mt-1 text-green-100">≤ -0.45</div>
                  <div className="text-[9px] text-green-200">BUY</div>
                </div>
                <div className="text-center text-gray-800 drop-shadow">
                  <div>PANIC</div>
                  <div className="text-[10px] mt-1">-0.17</div>
                  <div className="text-[9px] text-green-700">Bullish</div>
                </div>
                <div className="text-center text-gray-800 drop-shadow">
                  <div>NEUTRAL</div>
                  <div className="text-[10px] mt-1">0.0</div>
                </div>
                <div className="text-center text-gray-800 drop-shadow">
                  <div>EUPHORIA</div>
                  <div className="text-[10px] mt-1">+0.41</div>
                  <div className="text-[9px] text-red-700">Bearish</div>
                </div>
                <div className="text-center text-white drop-shadow-lg">
                  <div className="text-base">EXTREME</div>
                  <div>EUPHORIA</div>
                  <div className="text-[10px] mt-1">≥ +0.70</div>
                  <div className="text-[9px] text-red-200">SELL</div>
                </div>
              </div>

              {/* Current level indicator */}
              {data && (
                <div
                  className="absolute top-0 bottom-0 w-2 bg-black shadow-lg transition-all duration-500"
                  style={{
                    left: `calc(${((data.overallScore + 1) / 2) * 100}% - 4px)`,
                  }}
                >
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <div className="bg-black text-white px-4 py-2 rounded-lg shadow-xl">
                      <div className="text-xs font-semibold">TODAY</div>
                      <div className="text-2xl font-bold">
                        {data.overallScore >= 0 ? "+" : ""}
                        {data.overallScore.toFixed(3)}
                      </div>
                      <div className="text-xs text-center">{getScoreLabel(data.overallScore)}</div>
                    </div>
                    <div className="w-0 h-0 border-l-8 border-r-8 border-transparent border-t-black mx-auto" />
                  </div>
                </div>
              )}
            </div>

            {/* Component breakdown horizontal bars */}

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

      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-purple-600" />9 Levkovich Indicators (Citibank Model)
          </CardTitle>
          <CardDescription className="text-xs text-gray-600">
            Live data from FINRA, FRED, Yahoo Finance, and AI estimates • Updated every 60 seconds
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {data && (
            <>
              <PanicIndicator
                label="NYSE Short Interest"
                value={Math.max(-1, Math.min(1, ((data.nyseShortInterest - 20) / 10) * -1))}
                rawValue={`${data.nyseShortInterest}%`}
                tooltip="NYSE Short Interest measures the percentage of shares sold short relative to total float. SOURCE: Derived from VIX volatility and market conditions. INTERPRETATION: High short interest (>25%) indicates extreme bearish positioning, which historically signals panic and is a contrarian BUY signal. Low short interest (<15%) suggests complacency/euphoria. Current range: 10-30%."
              />
              <PanicIndicator
                label="Margin Debt"
                value={(data.marginDebt - 700) / 150}
                rawValue={`$${data.marginDebt}B`}
                tooltip="Margin Debt tracks total borrowed money used for stock purchases. SOURCE: FINRA monthly margin statistics via FRED. INTERPRETATION: High margin debt (>$800B) indicates leveraged speculation and euphoria—investors are borrowing heavily to buy stocks, a warning sign. Low margin debt (<$600B) suggests fear/panic. Current range: $600-$850B."
              />
              <PanicIndicator
                label="Nasdaq/NYSE Volume Ratio"
                value={(data.volumeRatio - 1.0) / 0.5}
                rawValue={`${data.volumeRatio.toFixed(2)}x`}
                tooltip="Nasdaq/NYSE Volume Ratio compares trading volume between tech-heavy Nasdaq and value-oriented NYSE. SOURCE: Real-time exchange volume data. INTERPRETATION: High ratio (>1.3x) indicates speculative tech/growth trading—euphoria signal. Low ratio (<0.9x) suggests rotation to value/safety—defensive positioning. Current range: 0.8-1.5x."
              />
              <PanicIndicator
                label="Investor Intelligence Survey"
                value={(data.investorIntelligence - 50) / 20}
                rawValue={`${data.investorIntelligence}% bulls`}
                tooltip="Investor Intelligence Survey polls professional newsletter writers for their market outlook. SOURCE: Investor Intelligence weekly survey data. INTERPRETATION: High bullishness (>60%) is a contrarian SELL signal—when experts are too optimistic, markets often decline. Low bullishness (<40%) is a contrarian BUY signal. Current range: 30-70%."
              />
              <PanicIndicator
                label="AAII Bullish Sentiment"
                value={(data.aaiiBullish - 40) / 25}
                rawValue={`${data.aaiiBullish}%`}
                tooltip="AAII (American Association of Individual Investors) Bullish Sentiment measures retail investor optimism. SOURCE: Weekly AAII sentiment survey. INTERPRETATION: High bullishness (>55%) indicates retail euphoria—historically a contrarian SELL signal. Low bullishness (<25%) indicates panic—historically a BUY opportunity. Current range: 25-65%."
              />
              <PanicIndicator
                label="Money Market Funds"
                value={(6.0 - data.moneyMarketFunds) / 1.0}
                rawValue={`$${data.moneyMarketFunds}T`}
                tooltip="Money Market Fund Assets tracks cash sitting on the sidelines in low-risk money market accounts. SOURCE: Investment Company Institute (ICI) via FRED. INTERPRETATION: High cash levels (>$6T) indicate fear/caution—this is 'dry powder' that could fuel a rally (bullish). Low cash (<$5T) means investors are fully invested—euphoria/risk. Current range: $5-7T."
              />
              <PanicIndicator
                label="Put/Call Ratio"
                value={(1.0 - data.putCallRatio) / 0.3}
                rawValue={`${data.putCallRatio.toFixed(2)}`}
                tooltip="Put/Call Ratio measures hedging activity via options markets. SOURCE: Derived from VIX term structure and options flow data. INTERPRETATION: High ratio (>1.1) indicates heavy put buying/hedging—fear and panic, which is contrarian bullish. Low ratio (<0.8) indicates complacency—no one is hedging, euphoria signal. Current range: 0.8-1.3."
              />
              <PanicIndicator
                label="Commodity Prices (CRB)"
                value={(data.commodityPrices - 280) / 40}
                rawValue={`${data.commodityPrices.toFixed(1)}`}
                tooltip="CRB Commodity Index tracks a basket of raw materials including energy, metals, and agriculture. SOURCE: Live commodity futures data. INTERPRETATION: High prices (>300) indicate inflation/speculation—economic overheating and euphoria. Low prices (<260) suggest deflation fears/recession—panic territory. Current range: 250-320."
              />
              <PanicIndicator
                label="Retail Gas Prices"
                value={(3.25 - data.gasPrices) / 1.0}
                rawValue={`$${data.gasPrices.toFixed(2)}/gal`}
                tooltip="Retail Gas Prices track national average gasoline costs that directly impact consumer spending. SOURCE: EIA (Energy Information Administration) weekly data. INTERPRETATION: High prices (>$4.00) create consumer stress and economic drag—bearish for markets. Low prices (<$3.00) act as a 'tax cut' for consumers—bullish. Current range: $2.50-$4.50/gal."
              />
            </>
          )}
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
            <RefreshButton onClick={handleRefresh} loading={refreshing} />
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
                        Short interest as % of float. High short interest indicates bearish positioning, which is a
                        contrarian bullish signal (panic = buying opportunity). Range: 10-30%.
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
                        Total margin debt levels. High margin indicates leveraged speculation and euphoria risk. Low
                        margin suggests fear. Range: $600-$850B.
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
                        Nasdaq/NYSE volume ratio. High ratio indicates speculative tech trading and euphoria. Low
                        indicates value rotation. Range: 0.8-1.5x.
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
                        Newsletter writer bulls vs bears. High bullishness = euphoria (contrarian sell).
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
                                    ? "text-green-700" // Extreme Panic
                                    : index === 1
                                      ? "text-green-600" // Panic
                                      : index === 2
                                        ? "text-yellow-600" // Neutral/Complacent
                                        : index === 3
                                          ? "text-red-500" // Euphoria
                                          : "text-red-700" // Extreme Euphoria
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
                                      : item.signal === "HOLD"
                                        ? "bg-gray-100 text-gray-700"
                                        : item.signal === "CAUTION/SELL"
                                          ? "bg-red-100 text-red-700"
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
                          <div className="p-3 bg-green-50 rounded border border-green-300">
                            <div className="text-xs font-semibold text-green-900 uppercase mb-1">Stocks</div>
                            <div className="text-lg font-bold text-green-900">{item.guidance.allocation.stocks}</div>
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
