"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Calendar, Target, Info, RefreshCw } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface NextMeeting {
  date: string
  daysUntil: number
  prediction: "CUT" | "HIKE" | "HOLD"
  predictionBps: number
  confidence: number
  impliedRate: number
}

interface RatePath {
  previousMeeting: number
  current: number
  nextMeeting: number
  threeMonth: number
  sixMonth: number
  twelveMonth: number
}

interface FomcMeeting {
  date: string
  daysAway: number
  impliedRate: number
  probCut50: number
  probCut25: number
  probNoChange: number
  probHike25: number
  probHike50: number
}

interface HistoricalRate {
  date: string
  rate: number
}

interface EconomicFactors {
  yieldCurve: string
  yieldCurveSignal: string
  treasuryTrend: string
  treasurySignal: string
  marketExpectation: string
}

interface EconomicIndicator {
  current: number
  previous: number
  trend: "up" | "down" | "stable"
}

interface EconomicIndicators {
  unemployment: EconomicIndicator
  cpi: EconomicIndicator
  coreCPI: EconomicIndicator
  pce: EconomicIndicator
  gdp: EconomicIndicator
  payrolls: EconomicIndicator
}

interface FedDecisionFactors {
  inflationPressure: string
  inflationTrend: string
  laborMarket: string
  laborTrend: string
  economicGrowth: string
  growthTrend: string
}

interface PredictionMethodology {
  description: string
  formula: string
  factors: string[]
  weights: {
    inflation: string
    employment: string
    growth: string
    marketPricing: string
  }
}

interface OptionsStrategy {
  name: string
  ticker: string
  type: string
  rationale: string
  entry: string
  target: string
  stopLoss: string
  timeframe: string
  risk: string
}

export function FomcPredictions() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRate, setCurrentRate] = useState(4.375)
  const [historicalRates, setHistoricalRates] = useState<HistoricalRate[]>([])
  const [nextMeeting, setNextMeeting] = useState<NextMeeting | null>(null)
  const [ratePath, setRatePath] = useState<RatePath | null>(null)
  const [economicFactors, setEconomicFactors] = useState<EconomicFactors | null>(null)
  const [economicIndicators, setEconomicIndicators] = useState<EconomicIndicators | null>(null)
  const [fedDecisionFactors, setFedDecisionFactors] = useState<FedDecisionFactors | null>(null)
  const [predictionMethodology, setPredictionMethodology] = useState<PredictionMethodology | null>(null)
  const [meetings, setMeetings] = useState<FomcMeeting[]>([])
  const [optionsStrategies, setOptionsStrategies] = useState<OptionsStrategy[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [showTooltips, setShowTooltips] = useState(true) // State for tooltip toggle
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true) // New state for tooltip toggle

  const InfoTooltip = ({ content }: { content: string }) => {
    if (!tooltipsEnabled) return null
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help inline ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-white border shadow-lg">
          <p className="text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const fetchFomcData = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/fomc-predictions")
      if (!response.ok) throw new Error("Failed to fetch FOMC data")

      const data = await response.json()
      setCurrentRate(data.currentRate)
      setHistoricalRates(data.historicalRates || [])
      setNextMeeting(data.nextMeeting)
      setRatePath(data.ratePath)
      setEconomicFactors(data.economicFactors)
      setEconomicIndicators(data.economicIndicators)
      setFedDecisionFactors(data.fedDecisionFactors)
      setPredictionMethodology(data.predictionMethodology)
      setMeetings(data.meetings)

      if (data.nextMeeting) {
        const strategies = generateOptionsStrategies(data.nextMeeting, data.currentRate)
        setOptionsStrategies(strategies)
      }

      const generateChartData = () => {
        const today = new Date()
        const chartPoints: any[] = []

        // Historical data - 2 years back using FRED data
        if (data.historicalRates && data.historicalRates.length > 0) {
          // Sample monthly (every ~30 days) for cleaner visualization
          const samplingInterval = 30
          for (let i = 0; i < data.historicalRates.length; i += samplingInterval) {
            const dataPoint = data.historicalRates[i]
            const date = new Date(dataPoint.date)
            chartPoints.push({
              date: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
              historical: dataPoint.rate,
              forecast: null,
              type: "historical",
            })
          }
        } else {
          // Fallback: generate monthly points for 2 years
          for (let i = 24; i >= 0; i--) {
            const date = new Date(today)
            date.setMonth(date.getMonth() - i)
            chartPoints.push({
              date: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
              historical: data.currentRate,
              forecast: null,
              type: "historical",
            })
          }
        }

        // Current point (connects historical to forecast)
        chartPoints.push({
          date: today.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          historical: data.currentRate,
          forecast: data.currentRate,
          type: "current",
        })

        // Forecast data - 2 years forward using meeting schedule + interpolation
        if (data.meetings && data.meetings.length > 0) {
          // Add each FOMC meeting forecast
          data.meetings.forEach((meeting: FomcMeeting, index: number) => {
            chartPoints.push({
              date: meeting.date.split(",")[0], // Just get "Nov 6-7"
              historical: null,
              forecast: meeting.impliedRate,
              type: "forecast",
            })
          })

          // For months beyond the last meeting, extrapolate to 2 years
          const lastMeeting = data.meetings[data.meetings.length - 1]
          const lastMeetingDate = new Date(
            lastMeeting.date.split(",")[1].trim() + ", " + lastMeeting.date.split(",")[0],
          )
          const twoYearsFromNow = new Date(today)
          twoYearsFromNow.setFullYear(today.getFullYear() + 2)

          // Calculate trend from last few meetings to project forward
          const recentMeetings = data.meetings.slice(-4) // Last 4 meetings
          const avgRateChange =
            recentMeetings.length > 1
              ? (recentMeetings[recentMeetings.length - 1].impliedRate - recentMeetings[0].impliedRate) /
                (recentMeetings.length - 1)
              : 0

          // Add monthly points from last meeting to 2 years out
          let monthsAfterLastMeeting = 1
          const projectedDate = new Date(lastMeetingDate)
          while (projectedDate < twoYearsFromNow) {
            projectedDate.setMonth(projectedDate.getMonth() + 1)
            if (projectedDate <= twoYearsFromNow) {
              const projectedRate = Math.max(
                2.0,
                Math.min(6.0, lastMeeting.impliedRate + avgRateChange * monthsAfterLastMeeting * 0.5),
              ) // Slower trend projection
              chartPoints.push({
                date: projectedDate.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
                historical: null,
                forecast: projectedRate,
                type: "forecast-extended",
              })
              monthsAfterLastMeeting++
            }
          }
        }

        return chartPoints
      }

      setChartData(generateChartData())
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFomcData()
  }, [])

  const generateOptionsStrategies = (meeting: NextMeeting, currentRate: number): OptionsStrategy[] => {
    const strategies: OptionsStrategy[] = []

    if (meeting.prediction === "CUT") {
      // Rate cut expected - bullish for stocks, bearish for dollar
      strategies.push({
        name: "Long Calls on SPY",
        ticker: "SPY",
        type: "Directional Bullish",
        rationale: `${Math.abs(meeting.predictionBps)}bp rate cut expected with ${meeting.confidence}% confidence. Rate cuts typically boost equity markets, especially large caps.`,
        entry: "Buy ATM or slightly OTM calls (0.45-0.55 delta)",
        target: `+3-5% move in SPY within ${meeting.daysUntil} days`,
        stopLoss: "Exit if SPY breaks below recent support or loses 50% of premium",
        timeframe: `${meeting.daysUntil} days until announcement`,
        risk: "Limited to premium paid. Consider spreading to reduce cost.",
      })

      strategies.push({
        name: "Bull Call Spread on QQQ",
        ticker: "QQQ",
        type: "Defined Risk Bullish",
        rationale:
          "Tech stocks benefit most from rate cuts due to lower discount rates on future earnings. Spread reduces cost and defines risk.",
        entry: "Buy ATM call, sell call 5-7% OTM",
        target: "Max profit if QQQ rallies above short strike by expiration",
        stopLoss: "Exit at 50% loss or if QQQ breaks key support",
        timeframe: "30-45 DTE, hold through announcement",
        risk: "Limited to net debit paid. Max profit = strike width - debit.",
      })

      strategies.push({
        name: "Long Puts on TLT",
        ticker: "TLT",
        type: "Directional Bearish",
        rationale:
          "Rate cuts often lead to steeper yield curve. Long-term bonds may sell off if market expects inflation. Counter-intuitive but profitable trade.",
        entry: "Buy ATM puts on TLT (20-year Treasury ETF)",
        target: "2-4% decline in TLT as long yields rise",
        stopLoss: "Exit if TLT breaks above resistance or loses 40% of premium",
        timeframe: `Hold through ${meeting.date} announcement`,
        risk: "Limited to premium. TLT can be volatile around Fed decisions.",
      })

      strategies.push({
        name: "Long Calls on XLF",
        ticker: "XLF",
        type: "Sector Play",
        rationale:
          "Financial stocks often rally on initial rate cut as it signals economic support. Banks benefit from steeper yield curve.",
        entry: "Buy slightly OTM calls (0.40-0.50 delta)",
        target: "+4-6% move in financials sector",
        stopLoss: "Exit if XLF fails to hold above 50-day MA",
        timeframe: "Through FOMC announcement + 1 week",
        risk: "Moderate. Financials can be volatile on Fed decisions.",
      })
    } else if (meeting.prediction === "HIKE") {
      // Rate hike expected - bearish for stocks, bullish for dollar
      strategies.push({
        name: "Bear Put Spread on SPY",
        ticker: "SPY",
        type: "Defined Risk Bearish",
        rationale: `${meeting.predictionBps}bp rate hike expected with ${meeting.confidence}% confidence. Hikes typically pressure equity valuations and increase recession risk.`,
        entry: "Buy ATM put, sell put 5% OTM",
        target: "Max profit if SPY drops below short strike",
        stopLoss: "Exit at 50% loss or if SPY breaks above resistance",
        timeframe: `${meeting.daysUntil} days until announcement`,
        risk: "Limited to net debit. Max profit = strike width - debit.",
      })

      strategies.push({
        name: "Long Puts on QQQ",
        ticker: "QQQ",
        type: "Directional Bearish",
        rationale:
          "Growth/tech stocks most vulnerable to rate hikes. Higher rates increase discount rates on future earnings, pressuring valuations.",
        entry: "Buy ATM or slightly ITM puts (0.50-0.60 delta)",
        target: "-4-7% decline in QQQ",
        stopLoss: "Exit if QQQ holds above key support or loses 50% of premium",
        timeframe: "30-45 DTE, hold through announcement",
        risk: "Limited to premium. Tech can be highly volatile.",
      })

      strategies.push({
        name: "Long Calls on TLT",
        ticker: "TLT",
        type: "Safe Haven Play",
        rationale:
          "Rate hikes increase recession risk. Flight to safety often boosts long-term Treasuries despite higher short-term rates.",
        entry: "Buy ATM calls on TLT",
        target: "+3-5% rally in long-term bonds",
        stopLoss: "Exit if TLT breaks below support",
        timeframe: `Through ${meeting.date} + 1 week`,
        risk: "Limited to premium. Bond volatility can spike.",
      })

      strategies.push({
        name: "Short Calls on XLF (Covered)",
        ticker: "XLF",
        type: "Income Strategy",
        rationale:
          "If holding financial stocks, sell OTM calls to generate income. Rate hikes help banks but market may already price this in.",
        entry: "Sell calls 5-7% OTM (0.20-0.30 delta)",
        target: "Collect premium if XLF stays below strike",
        stopLoss: "Buy back if XLF rallies strongly or at 200% loss",
        timeframe: "Expiration after FOMC meeting",
        risk: "Caps upside. Requires stock ownership or margin.",
      })
    } else {
      // No change expected - neutral strategies
      strategies.push({
        name: "Iron Condor on SPY",
        ticker: "SPY",
        type: "Neutral Income",
        rationale: `${meeting.confidence}% probability of no rate change. Market likely to stay range-bound. Sell premium on both sides.`,
        entry: "Sell OTM call spread + OTM put spread (16-20 delta)",
        target: "Collect premium if SPY stays within range",
        stopLoss: "Exit at 2x credit received or if SPY breaks out",
        timeframe: `${meeting.daysUntil} days, close before announcement`,
        risk: "Defined risk. Max loss = strike width - credit received.",
      })

      strategies.push({
        name: "Short Straddle on VIX",
        ticker: "VIX",
        type: "Volatility Play",
        rationale:
          "If no change expected, volatility should decline post-announcement. Sell straddle to profit from vol crush.",
        entry: "Sell ATM call and put on VIX or VXX",
        target: "Profit from volatility decline after FOMC",
        stopLoss: "Exit if VIX spikes above 25 or at 150% loss",
        timeframe: "Close day after FOMC announcement",
        risk: "High risk. VIX can spike unexpectedly. Use small size.",
      })

      strategies.push({
        name: "Calendar Spread on QQQ",
        ticker: "QQQ",
        type: "Time Decay Play",
        rationale:
          "Sell near-term options, buy longer-term at same strike. Profit from time decay if market stays flat.",
        entry: "Sell options expiring before FOMC, buy options expiring after",
        target: "Profit from faster decay of short-term options",
        stopLoss: "Exit if QQQ moves >3% in either direction",
        timeframe: "Front month expires before FOMC",
        risk: "Limited risk to net debit. Profits if underlying stays near strike.",
      })

      strategies.push({
        name: "Covered Calls on Holdings",
        ticker: "Portfolio",
        type: "Income Generation",
        rationale: "If holding stocks and expecting range-bound market, sell OTM calls to generate income.",
        entry: "Sell calls 5-10% OTM on existing positions",
        target: "Collect premium if stocks stay below strikes",
        stopLoss: "Buy back if position rallies strongly",
        timeframe: "30-45 DTE",
        risk: "Caps upside. Requires stock ownership.",
      })
    }

    return strategies
  }

  const getPredictionColor = (prediction: string) => {
    switch (prediction) {
      case "CUT":
        return "text-green-600"
      case "HIKE":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  const getPredictionBg = (prediction: string) => {
    switch (prediction) {
      case "CUT":
        return "bg-green-50 border-green-200"
      case "HIKE":
        return "bg-red-50 border-red-200"
      default:
        return "bg-gray-50 border-gray-200"
    }
  }

  const getPredictionIcon = (prediction: string) => {
    switch (prediction) {
      case "CUT":
        return <TrendingDown className="h-8 w-8 text-green-600" />
      case "HIKE":
        return <TrendingUp className="h-8 w-8 text-red-600" />
      default:
        return <Minus className="h-8 w-8 text-gray-600" />
    }
  }

  const getConfidenceLevel = (confidence: number) => {
    if (confidence >= 70) return { label: "High", color: "text-green-600" }
    if (confidence >= 50) return { label: "Moderate", color: "text-yellow-600" }
    return { label: "Low", color: "text-orange-600" }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-red-600" />
      case "down":
        return <TrendingDown className="h-4 w-4 text-green-600" />
      default:
        return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "up":
        return "text-red-600"
      case "down":
        return "text-green-600"
      default:
        return "text-gray-600"
    }
  }

  const getInflationTrendStyle = (trend: string) => {
    // Heating inflation = hawkish (red), Cooling inflation = dovish (green)
    if (trend.toLowerCase().includes("heating") || trend.toLowerCase().includes("rising")) {
      return "bg-red-50 text-red-700 border border-red-200"
    }
    if (trend.toLowerCase().includes("cooling") || trend.toLowerCase().includes("falling")) {
      return "bg-green-50 text-green-700 border border-green-200"
    }
    return "bg-gray-50 text-gray-700 border border-gray-200"
  }

  const getLaborTrendStyle = (trend: string) => {
    // Weakening labor = dovish (green), Strengthening labor = hawkish (red)
    if (trend.toLowerCase().includes("weakening") || trend.toLowerCase().includes("softening")) {
      return "bg-green-50 text-green-700 border border-green-200"
    }
    if (trend.toLowerCase().includes("strengthening") || trend.toLowerCase().includes("tightening")) {
      return "bg-red-50 text-red-700 border border-red-200"
    }
    return "bg-gray-50 text-gray-700 border border-gray-200"
  }

  const getGrowthTrendStyle = (trend: string) => {
    // Accelerating growth = hawkish (red), Slowing growth = dovish (green)
    if (trend.toLowerCase().includes("accelerating") || trend.toLowerCase().includes("expanding")) {
      return "bg-red-50 text-red-700 border border-red-200"
    }
    if (trend.toLowerCase().includes("slowing") || trend.toLowerCase().includes("contracting")) {
      return "bg-green-50 text-green-700 border border-green-200"
    }
    return "bg-gray-50 text-gray-700 border border-gray-200"
  }

  const getMarketExpectationStyle = (expectation: string) => {
    // Dovish = green, Hawkish = red
    if (expectation.toLowerCase().includes("dovish")) {
      return "bg-green-50 text-green-700 border border-green-200"
    }
    if (expectation.toLowerCase().includes("hawkish")) {
      return "bg-red-50 text-red-700 border border-red-200"
    }
    return "bg-gray-50 text-gray-700 border border-gray-200"
  }

  if (loading && !nextMeeting) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-lg text-gray-600">Loading FOMC data...</span>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Fed Rate Decision Predictor
                  <InfoTooltip content="The Federal Reserve sets interest rates to control inflation and employment. Rate hikes slow the economy (bearish for stocks), while rate cuts stimulate growth (bullish). Options traders can profit from rate decisions by trading Treasury ETFs and rate-sensitive sectors." />
                </CardTitle>
                <CardDescription className="mt-1">
                  AI-powered predictions using Fed Funds futures and economic data
                  {lastUpdated && <span className="ml-2 text-xs">(Updated: {lastUpdated.toLocaleTimeString()})</span>}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
                <RefreshButton onClick={fetchFomcData} isLoading={loading} />
              </div>
            </div>
          </CardHeader>
        </Card>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="h-5 w-5" />
                <p className="font-semibold">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {chartData.length > 0 && (
          <Card className="shadow-lg border-2 border-primary/20">
            <CardHeader className="bg-primary/5 border-b border-primary/20">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-1">
                Federal Funds Rate - Forecast Chart
                <InfoTooltip content="This chart shows historical Fed rates and market expectations for future rates. Falling forecasts signal potential rate cuts (bullish for growth stocks, bearish for banks). Rising forecasts signal hawkish Fed (bearish for growth, bullish for financials)." />
              </CardTitle>
              <CardDescription>
                2-year historical data (solid) and 2-year market consensus forecast (dashed)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <YAxis
                      domain={[2.0, 5.5]}
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                      label={{
                        value: "Percent",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 12, fill: "#6b7280" },
                      }}
                    />
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
                              <p className="text-sm font-bold text-gray-900">{label}</p>
                              {payload.map((p, i) => (
                                <p
                                  key={i}
                                  className={`text-sm ${p.dataKey === "historical" ? "text-gray-800" : "text-green-600"}`}
                                >
                                  {p.name}: {Number(p.value).toFixed(2)}%
                                </p>
                              ))}
                            </div>
                          )
                        }
                        return null
                      }}
                      cursor={{ stroke: "#ccc", strokeWidth: 1, strokeDasharray: "3 3" }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="historical"
                      stroke="#1f2937"
                      strokeWidth={3}
                      name="Historical Data"
                      dot={{ fill: "#1f2937", r: 4 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      stroke="#22c55e"
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      name="Market Consensus Forecast"
                      dot={{ fill: "#22c55e", r: 4 }}
                      connectNulls={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">Chart Methodology:</span> Historical rates from FRED (2 years of daily
                  data, sampled monthly). Market consensus forecast calculated from Fed Funds futures and Treasury
                  yields for FOMC meetings, with trend extrapolation to 2 years forward. Values represent monthly
                  averages.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Meeting Prediction */}
        {nextMeeting && (
          <Card className="shadow-lg border-2 border-primary">
            <CardHeader className="bg-primary/10 border-b border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-primary" />
                    Next FOMC Meeting Prediction
                    <InfoTooltip content="FOMC meets 8 times per year to set rates. Markets move on rate decisions - unexpected cuts/hikes cause volatility. Trade IV expansion before meetings with straddles, or direction after decisions are announced." />
                  </CardTitle>
                  <CardDescription className="text-base">
                    {nextMeeting.daysUntil} days until announcement
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-6">
                {/* Prediction */}
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>{getPredictionIcon(nextMeeting.prediction)}</TooltipTrigger>
                        <TooltipContent>
                          <p>Predicted action for the upcoming FOMC meeting.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">Predicted Action</p>
                  <p className={`text-3xl font-bold ${getPredictionColor(nextMeeting.prediction)}`}>
                    {nextMeeting.prediction === "HOLD"
                      ? "HOLD"
                      : `${Math.abs(nextMeeting.predictionBps)}bp ${nextMeeting.prediction}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {nextMeeting.prediction === "CUT" && "Rate Decrease Expected"}
                    {nextMeeting.prediction === "HIKE" && "Rate Increase Expected"}
                    {nextMeeting.prediction === "HOLD" && "No Change Expected"}
                  </p>
                </div>

                {/* Confidence */}
                <div className="text-center border-l border-r border-gray-200">
                  <div className="mb-2">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white border-4 border-primary">
                      <span className="text-2xl font-bold text-primary">{nextMeeting.confidence.toFixed(0)}%</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    Confidence
                    <InfoTooltip content="How confident the market is in the predicted outcome. High confidence (>80%) means the outcome is priced in - surprises cause big moves. Low confidence means uncertainty - expect volatility." />
                  </p>
                  <p className={`text-lg font-semibold ${getConfidenceLevel(nextMeeting.confidence).color}`}>
                    {getConfidenceLevel(nextMeeting.confidence).label}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Based on market pricing</p>
                </div>

                {/* Rates */}
                <div className="text-center">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">
                        Current Rate
                        <InfoTooltip content="The current Federal Funds rate target range. Higher rates increase borrowing costs, slowing economic activity. Lower rates stimulate borrowing and spending." />
                      </p>
                      <p className="text-2xl font-bold text-gray-900">{currentRate.toFixed(2)}%</p>
                    </div>
                    <div className="h-px bg-gray-200" />
                    <div>
                      <p className="text-sm text-gray-600 mb-1">
                        Implied Rate
                        <InfoTooltip content="The rate implied by Fed Funds futures markets. Represents what traders expect the rate to be after the meeting. Compare to current rate to see expected change." />
                      </p>
                      <p className="text-2xl font-bold text-primary">{nextMeeting.impliedRate.toFixed(2)}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Probability Table */}
        {meetings.length > 0 && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-900">Meeting Probabilities</CardTitle>
              <CardDescription>Next FOMC Meeting - Calculated using CME FedWatch methodology</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-semibold text-gray-900">Meeting Date</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-900">Days Away</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-900">Implied Rate</th>
                      <th className="text-right py-2 px-3 font-semibold text-green-700">50bp Cut</th>
                      <th className="text-right py-2 px-3 font-semibold text-green-600">25bp Cut</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">No Change</th>
                      <th className="text-right py-2 px-3 font-semibold text-red-600">25bp Hike</th>
                      <th className="text-right py-2 px-3 font-semibold text-red-700">50bp Hike</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetings.slice(0, 3).map((meeting, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium text-gray-900">{meeting.date}</td>
                        <td className="text-right py-2 px-3 text-gray-600">{meeting.daysAway} days</td>
                        <td className="text-right py-2 px-3 text-gray-900 font-semibold">
                          {meeting.impliedRate.toFixed(2)}%
                        </td>
                        <td className="text-right py-2 px-3 text-green-700 font-semibold">
                          {meeting.probCut50.toFixed(1)}%
                        </td>
                        <td className="text-right py-2 px-3 text-green-600 font-semibold">
                          {meeting.probCut25.toFixed(1)}%
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700 font-semibold">
                          {meeting.probNoChange.toFixed(1)}%
                        </td>
                        <td className="text-right py-2 px-3 text-red-600 font-semibold">
                          {meeting.probHike25.toFixed(1)}%
                        </td>
                        <td className="text-right py-2 px-3 text-red-700 font-semibold">
                          {meeting.probHike50.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">Note:</span> Showing next 3 meetings for actionable near-term
                  predictions. Market expectations become less reliable for meetings further out.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expected Rate Path Card */}
        {ratePath && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-1">
                Expected Rate Path
                <InfoTooltip content="Shows where markets expect rates to be over time. A downward path suggests rate cuts coming (bullish for stocks). An upward path suggests more hikes (bearish). Use this to plan longer-dated options strategies." />
              </CardTitle>
              <CardDescription>Historical and projected Fed Funds rate over time</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-2">Last Meeting</p>
                  <div className="bg-gray-100 rounded-lg p-3 border-2 border-gray-300">
                    <p className="text-2xl font-bold text-gray-900">{ratePath.previousMeeting.toFixed(2)}%</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">~60 days ago</p>
                  <p className="text-xs text-gray-400 mt-0.5">(Historical)</p>
                </div>

                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-2">Current</p>
                  <div className="bg-blue-100 rounded-lg p-3 border-2 border-blue-400">
                    <p className="text-2xl font-bold text-blue-900">{ratePath.current.toFixed(2)}%</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Today</p>
                  <p className="text-xs text-gray-400 mt-0.5">(Real-time)</p>
                </div>

                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-2">Next Meeting</p>
                  <div className="bg-green-50 rounded-lg p-3 border-2 border-green-300">
                    <p className="text-2xl font-bold text-green-900">{ratePath.nextMeeting.toFixed(2)}%</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{nextMeeting?.daysUntil} days</p>
                  <p className="text-xs text-gray-400 mt-0.5">(Predicted)</p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-700">
                  <span className="font-semibold">Note:</span> Historical rates from FRED data (real). Future
                  projections based on market pricing, economic indicators, and FOMC meeting schedule. Predictions may
                  change as economic data evolves.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Economic Indicators Section */}
        {economicIndicators && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-1">
                Key Economic Indicators
                <InfoTooltip content="The Fed watches these indicators to set policy. High inflation = hawkish (rate hikes). High unemployment = dovish (rate cuts). Strong GDP = less need for cuts. These drive Fed decisions and market expectations." />
              </CardTitle>
              <CardDescription>Real-time data from Federal Reserve Economic Data (FRED)</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid md:grid-cols-3 gap-4">
                {/* Unemployment */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Unemployment Rate
                    <InfoTooltip content="Rising unemployment makes the Fed more likely to cut rates to stimulate jobs. Low unemployment lets Fed focus on fighting inflation. Watch for surprises vs expectations." />
                  </p>
                  <div className="flex items-center justify-between mb-2">
                    {getTrendIcon(economicIndicators.unemployment.trend)}
                  </div>
                  <p className="text-3xl font-bold text-gray-900">
                    {economicIndicators.unemployment.current.toFixed(1)}%
                  </p>
                  <p className={`text-xs mt-1 ${getTrendColor(economicIndicators.unemployment.trend)}`}>
                    Previous: {economicIndicators.unemployment.previous.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Fed Target: 4.0-4.5% (Full Employment)</p>
                </div>

                {/* CPI */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    CPI (YoY)
                    <InfoTooltip content="Consumer Price Index measures inflation. Above Fed's 2% target = hawkish pressure (rates stay high). Below target = room for cuts. Hot CPI prints are bearish for stocks." />
                  </p>
                  <div className="flex items-center justify-between mb-2">
                    {getTrendIcon(economicIndicators.cpi.trend)}
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{economicIndicators.cpi.current.toFixed(1)}%</p>
                  <p className={`text-xs mt-1 ${getTrendColor(economicIndicators.cpi.trend)}`}>
                    Previous: {economicIndicators.cpi.previous.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Fed Target: 2.0% (Price Stability)</p>
                </div>

                {/* PCE */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    PCE Inflation
                    <InfoTooltip content="Personal Consumption Expenditures price index is the Fed's preferred inflation measure. Similar trends to CPI but often smoother. High PCE also signals hawkish policy." />
                  </p>
                  <div className="flex items-center justify-between mb-2">
                    {getTrendIcon(economicIndicators.pce.trend)}
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{economicIndicators.pce.current.toFixed(1)}%</p>
                  <p className={`text-xs mt-1 ${getTrendColor(economicIndicators.pce.trend)}`}>
                    Previous: {economicIndicators.pce.previous.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Fed's preferred inflation measure</p>
                </div>

                {/* Core CPI */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Core CPI
                    <InfoTooltip content="Core CPI excludes volatile food and energy prices, providing a clearer view of underlying inflation trends. Persistent high core inflation keeps the Fed hawkish." />
                  </p>
                  <div className="flex items-center justify-between mb-2">
                    {getTrendIcon(economicIndicators.coreCPI.trend)}
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{economicIndicators.coreCPI.current.toFixed(1)}%</p>
                  <p className={`text-xs mt-1 ${getTrendColor(economicIndicators.coreCPI.trend)}`}>
                    Previous: {economicIndicators.coreCPI.previous.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Excludes food & energy volatility</p>
                </div>

                {/* GDP */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    GDP Growth
                    <InfoTooltip content="Strong GDP growth reduces urgency for rate cuts. Weak GDP increases cut probability. Negative GDP (recession) typically triggers aggressive easing - very bullish for stocks." />
                  </p>
                  <div className="flex items-center justify-between mb-2">
                    {getTrendIcon(economicIndicators.gdp.trend)}
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{economicIndicators.gdp.current.toFixed(1)}%</p>
                  <p className={`text-xs mt-1 ${getTrendColor(economicIndicators.gdp.trend)}`}>
                    Previous: {economicIndicators.gdp.previous.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Annualized quarterly growth rate</p>
                </div>

                {/* Non-Farm Payrolls */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Non-Farm Payrolls
                    <InfoTooltip content="Job creation numbers are key to labor market health. Strong payrolls suggest a robust economy, allowing the Fed to stay hawkish. Weak numbers can signal slowdown and increase cut odds." />
                  </p>
                  <div className="flex items-center justify-between mb-2">
                    {getTrendIcon(economicIndicators.payrolls.trend)}
                  </div>
                  <p className="text-3xl font-bold text-gray-900">
                    {(economicIndicators.payrolls.current / 1000).toFixed(0)}M
                  </p>
                  <p className={`text-xs mt-1 ${getTrendColor(economicIndicators.payrolls.trend)}`}>
                    Previous: {(economicIndicators.payrolls.previous / 1000).toFixed(0)}M
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Total employed workers (thousands)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fed Decision Factors Section */}
        {fedDecisionFactors && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-900">Fed Decision Analysis</CardTitle>
              <CardDescription>How economic data influences the Fed's rate decision</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Inflation Pressure</p>
                  <p className="text-lg font-bold text-gray-900">{fedDecisionFactors.inflationPressure}</p>
                  <span
                    className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded ${getInflationTrendStyle(fedDecisionFactors.inflationTrend)}`}
                  >
                    Trend: {fedDecisionFactors.inflationTrend}
                  </span>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Labor Market</p>
                  <p className="text-lg font-bold text-gray-900">{fedDecisionFactors.laborMarket}</p>
                  <span
                    className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded ${getLaborTrendStyle(fedDecisionFactors.laborTrend)}`}
                  >
                    Trend: {fedDecisionFactors.laborTrend}
                  </span>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Economic Growth</p>
                  <p className="text-lg font-bold text-gray-900">{fedDecisionFactors.economicGrowth}</p>
                  <span
                    className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded ${getGrowthTrendStyle(fedDecisionFactors.growthTrend)}`}
                  >
                    Trend: {fedDecisionFactors.growthTrend}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Economic Factors section */}
        {economicFactors && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-900">Key Economic Factors</CardTitle>
              <CardDescription>Market signals influencing the prediction</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-900 mb-1">Yield Curve</p>
                  <p className="text-sm text-gray-700">{economicFactors.yieldCurve}</p>
                  <span
                    className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded ${
                      economicFactors.yieldCurveSignal === "bearish"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {economicFactors.yieldCurveSignal === "bearish" ? "Recession Signal" : "Normal"}
                  </span>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-900 mb-1">Treasury Yields</p>
                  <p className="text-sm text-gray-700">{economicFactors.treasuryTrend}</p>
                  <span
                    className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded ${
                      economicFactors.treasurySignal === "dovish"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {economicFactors.treasurySignal === "dovish" ? "Dovish Signal" : "Hawkish Signal"}
                  </span>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 md:col-span-2">
                  <p className="text-sm font-semibold text-gray-900 mb-1">Market Expectation</p>
                  <span
                    className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded ${getMarketExpectationStyle(economicFactors.marketExpectation)}`}
                  >
                    {economicFactors.marketExpectation} Fed policy stance
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Prediction Methodology Section */}
        {predictionMethodology && (
          <Card className="shadow-sm border-2 border-blue-200 bg-blue-50">
            <CardHeader className="bg-blue-100 border-b border-blue-200">
              <CardTitle className="text-lg font-bold text-gray-900">Prediction Methodology</CardTitle>
              <CardDescription className="text-gray-700">
                Transparent formula showing how we calculate predictions
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Description:</p>
                  <p className="text-sm text-gray-700">{predictionMethodology.description}</p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Formula:</p>
                  <p className="text-sm font-mono bg-white p-3 rounded border border-blue-200 text-gray-900">
                    {predictionMethodology.formula}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Factor Weights:</p>
                  <div className="grid md:grid-cols-2 gap-2">
                    <div className="text-sm bg-white p-2 rounded border border-blue-200">
                      <span className="font-semibold text-gray-900">Inflation:</span>{" "}
                      {predictionMethodology.weights.inflation}
                    </div>
                    <div className="text-sm bg-white p-2 rounded border border-blue-200">
                      <span className="font-semibold text-gray-900">Employment:</span>{" "}
                      {predictionMethodology.weights.employment}
                    </div>
                    <div className="text-sm bg-white p-2 rounded border border-blue-200">
                      <span className="font-semibold text-gray-900">Growth:</span>{" "}
                      {predictionMethodology.weights.growth}
                    </div>
                    <div className="text-sm bg-white p-2 rounded border border-blue-200">
                      <span className="font-semibold text-gray-900">Market Pricing:</span>{" "}
                      {predictionMethodology.weights.marketPricing}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Scoring Factors:</p>
                  <ul className="space-y-1">
                    {predictionMethodology.factors.map((factor, index) => (
                      <li key={index} className="text-xs text-gray-700 bg-white p-2 rounded border border-blue-200">
                        • {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wrapped strategies card in Accordion with default collapsed state */}
        {optionsStrategies.length > 0 && (
          <Accordion type="single" collapsible defaultValue="">
            <AccordionItem value="strategies" className="border-none">
              <Card className="shadow-lg border-2 border-primary">
                <AccordionTrigger className="hover:no-underline">
                  <CardHeader className="bg-primary/5 border-b border-primary/20 w-full pb-4">
                    <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <Target className="h-6 w-6 text-primary" />
                      Rate-Based Options Strategies
                      <InfoTooltip content="These strategies are designed for the current rate environment. Rate cut expectations favor growth stocks and bonds. Rate hike expectations favor banks and value stocks. Uncertainty favors volatility strategies like straddles." />
                    </CardTitle>
                    <CardDescription className="text-base">
                      Actionable trades based on {nextMeeting?.prediction} prediction with{" "}
                      {nextMeeting?.confidence.toFixed(0)}% confidence
                    </CardDescription>
                  </CardHeader>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="pt-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      {optionsStrategies.map((strategy, index) => (
                        <Card
                          key={index}
                          className="border-2 border-gray-200 hover:border-primary/50 transition-colors"
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-base font-bold text-gray-900">{strategy.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                    {strategy.ticker}
                                  </span>
                                  <span className="text-xs text-gray-600">{strategy.type}</span>
                                </div>
                              </div>
                              {showTooltips && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="h-4 w-4 text-gray-400 cursor-pointer" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs max-w-xs">
                                        Detailed explanation of this strategy, including entry, target, stop-loss, and
                                        risk.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div>
                              <p className="text-sm text-gray-700">{strategy.rationale}</p>
                            </div>

                            <div className="space-y-2 text-xs">
                              <div className="flex items-start gap-2">
                                <span className="font-semibold text-gray-900 min-w-[70px]">Entry:</span>
                                <span className="text-gray-700">{strategy.entry}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="font-semibold text-gray-900 min-w-[70px]">Target:</span>
                                <span className="text-gray-700">{strategy.target}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="font-semibold text-gray-900 min-w-[70px]">Stop Loss:</span>
                                <span className="text-gray-700">{strategy.stopLoss}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="font-semibold text-gray-900 min-w-[70px]">Timeframe:</span>
                                <span className="text-gray-700">{strategy.timeframe}</span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-gray-200">
                              <div className="flex items-start gap-2 text-xs">
                                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-orange-600" />
                                <p className="text-gray-600">
                                  <span className="font-semibold">Risk:</span> {strategy.risk}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <span className="font-semibold">⚠️ Important Disclaimer:</span> These strategies are for
                        educational purposes only and do not constitute financial advice. Options trading involves
                        substantial risk and is not suitable for all investors. Always conduct your own research,
                        understand the risks, and consider consulting with a licensed financial advisor before making
                        any investment decisions. Past performance does not guarantee future results.
                      </p>
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    </TooltipProvider>
  )
}
