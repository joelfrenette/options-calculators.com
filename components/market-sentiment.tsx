"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
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
  timestamp?: string
  calculationDetails?: {
    // Added for calculation methodology display
    formula: string
    weighting: string
    methodology: string
    individualScores?: {
      i1_marketMomentum: number
      i2_stockStrength: number
      i3_stockBreadth: number
      i4_putCallRatio: number
      i5_marketVolatility: number
      i6_safeHavenDemand: number
      i7_junkBondDemand: number
    }
  }
  dataSourcesUsed?: {
    // Added for data sources display
    primary: string
    nyseData?: string
  }
  cnnComponents?: { score: number }[] // Array for CNN's 7 indicators
  dataSource?: string // Added to fetch and display data source
  score: number // Ensure score is part of the interface for validation
  chartData?: {
    // Added for chart visualization
    spy: number[]
    vix: number[]
    date: string[]
  }
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
      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 000 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 00-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
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

const MiniLineChart = ({
  data,
  dates,
  color = "#2563eb",
  yAxisLabel = "",
}: {
  data: number[]
  dates?: string[]
  color?: string
  yAxisLabel?: string
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 h-48">
        <div className="text-center text-gray-500">
          <div className="text-sm">No chart data available</div>
        </div>
      </div>
    )
  }

  const width = 600
  const height = 200
  const padding = { top: 20, right: 20, bottom: 30, left: 50 }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data
    .map((value, index) => {
      const x = padding.left + (index / (data.length - 1)) * (width - padding.left - padding.right)
      const y = height - padding.bottom - ((value - min) / range) * (height - padding.top - padding.bottom)
      return `${x},${y}`
    })
    .join(" ")

  // Format date labels (show first, middle, last)
  const firstDate = dates?.[0]
    ? new Date(dates[0]).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : ""
  const middleDate = dates?.[Math.floor(dates.length / 2)]
    ? new Date(dates[Math.floor(dates.length / 2)]).toLocaleDateString("en-US", { month: "short" })
    : ""
  const lastDate = dates?.[dates.length - 1]
    ? new Date(dates[dates.length - 1]).toLocaleDateString("en-US", { month: "short" })
    : ""

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="#e5e7eb"
          strokeWidth="1"
        />
        {/* X-axis */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="#e5e7eb"
          strokeWidth="1"
        />

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = height - padding.bottom - ratio * (height - padding.top - padding.bottom)
          return (
            <line
              key={ratio}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="#f3f4f6"
              strokeWidth="1"
            />
          )
        })}

        {/* Data line */}
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />

        {/* Y-axis labels */}
        <text x={padding.left - 10} y={padding.top} fontSize="11" fill="#6b7280" textAnchor="end">
          {max.toFixed(0)}
        </text>
        <text x={padding.left - 10} y={height - padding.bottom} fontSize="11" fill="#6b7280" textAnchor="end">
          {min.toFixed(0)}
        </text>
        {yAxisLabel && (
          <text
            x={padding.left - 35}
            y={height / 2}
            fontSize="11"
            fill="#6b7280"
            textAnchor="middle"
            transform={`rotate(-90, ${padding.left - 35}, ${height / 2})`}
          >
            {yAxisLabel}
          </text>
        )}

        {/* X-axis date labels */}
        {dates && dates.length > 0 && (
          <>
            <text x={padding.left} y={height - padding.bottom + 20} fontSize="11" fill="#6b7280" textAnchor="start">
              {firstDate}
            </text>
            <text
              x={(width - padding.right + padding.left) / 2}
              y={height - padding.bottom + 20}
              fontSize="11"
              fill="#6b7280"
              textAnchor="middle"
            >
              {middleDate}
            </text>
            <text
              x={width - padding.right}
              y={height - padding.bottom + 20}
              fontSize="11"
              fill="#6b7280"
              textAnchor="end"
            >
              {lastDate}
            </text>
          </>
        )}
      </svg>
    </div>
  )
}

const cnnComponentTooltips: Record<string, { title: string; description: string; impact: string; dataSource: string }> =
  {
    marketmomentum: {
      title: "Market Momentum",
      description:
        "Measures whether the S&P 500 is trading above or below its 125-day moving average. When the market stays above this average, it signals positive momentum and investor confidence.",
      impact:
        "If the S&P 500 is far above its 125-day average, this indicator shows high scores (greed). If it's below, it shows low scores (fear). Each 1% above the average adds 5 points to the score.",
      dataSource: "Live S&P 500 price via Yahoo Finance API compared to its 125-day historical average",
    },
    stockpricestrength: {
      title: "Stock Price Strength",
      description:
        "Compares the number of stocks hitting 52-week highs versus 52-week lows on the New York Stock Exchange. This shows whether more stocks are strengthening or weakening.",
      impact:
        "High ratio of new highs to new lows indicates market strength (scores 75-100 = extreme greed). Low ratio or more new lows indicates weakness (scores 0-25 = extreme fear). Equal highs and lows scores 50 (neutral).",
      dataSource: "NYSE advance/decline data approximated from S&P 500 constituent momentum",
    },
    stockpricebreadth: {
      title: "Stock Price Breadth",
      description:
        "Uses the McClellan Volume Summation Index to measure whether trading volume is flowing into advancing stocks or declining stocks across the market.",
      impact:
        "Positive breadth (volume in advancing stocks) scores high 75-100 showing broad participation and greed. Negative breadth (volume in declining stocks) scores low 0-25 showing widespread fear. Zero scores 50 (neutral).",
      dataSource: "Calculated from NYSE advance/decline volume data approximated from major indices",
    },
    putandcalloptions: {
      title: "Put and Call Options",
      description:
        "Compares the volume of put options (bets that stocks will fall) to call options (bets that stocks will rise) over a 5-day period. This reveals what options traders expect.",
      impact:
        "Low put/call ratio (more calls than puts) scores 75-100 indicating traders expect gains (greed). High put/call ratio (more puts) scores 0-25 showing traders expect losses (fear). Ratio of 1.0 scores 50 (neutral).",
      dataSource: "Live put/call ratio calculated from CBOE options data via Yahoo Finance",
    },
    marketvolatility: {
      title: "Market Volatility (VIX)",
      description:
        "Compares the current VIX (market fear gauge) to its 50-day moving average. VIX measures expected volatility in stock prices based on options pricing.",
      impact:
        "VIX far below its 50-day average scores high 75-100 (low volatility = greed). VIX far above its average scores low 0-25 (high volatility = fear). VIX at its average scores 50 (neutral).",
      dataSource: "Live VIX index (^VIX) via Yahoo Finance compared to 50-day historical average",
    },
    safehavendemand: {
      title: "Safe Haven Demand",
      description:
        "Compares 20-day returns of stocks (SPY) versus bonds (TLT). When investors are fearful, they sell stocks and buy safe bonds, causing bonds to outperform.",
      impact:
        "Stocks strongly outperforming bonds scores 75-100 (risk-on = greed). Bonds outperforming stocks scores 0-25 (risk-off = fear). Equal performance scores 50 (neutral).",
      dataSource: "Live 20-day returns for SPY (stocks) and TLT (bonds) via Yahoo Finance",
    },
    junkbonddemand: {
      title: "Junk Bond Demand",
      description:
        "Measures the yield spread between high-yield (junk) bonds and safe Treasury bonds. When investors are greedy, they buy riskier junk bonds, narrowing the spread.",
      impact:
        "Narrow spread (junk bonds in demand) scores 75-100 indicating risk appetite (greed). Wide spread (investors avoiding junk) scores 0-25 showing risk aversion (fear). Normal spread scores 50.",
      dataSource: "Live high-yield corporate bond ETF (HYG) performance via Yahoo Finance",
    },
  }

const componentTooltips = {
  momentum: cnnComponentTooltips.marketmomentum,
  strength: cnnComponentTooltips.stockpricestrength,
  stockBreadth: cnnComponentTooltips.stockpricebreadth,
  putCall: cnnComponentTooltips.putandcalloptions,
  vix: cnnComponentTooltips.marketvolatility,
  safeHaven: cnnComponentTooltips.safehavendemand,
  junkBond: cnnComponentTooltips.junkbonddemand,
}

const getIndicatorSentiment = (score: number): string => {
  if (score < 25) return "EXTREME FEAR"
  if (score < 45) return "FEAR"
  if (score >= 55 && score < 75) return "GREED"
  if (score >= 75) return "EXTREME GREED"
  return "NEUTRAL"
}

const getSentimentColor = (sentiment: string): string => {
  switch (sentiment) {
    case "EXTREME FEAR":
      return "bg-red-500 text-white"
    case "FEAR":
      return "bg-orange-500 text-white"
    case "GREED":
      return "bg-green-500 text-white"
    case "EXTREME GREED":
      return "bg-emerald-600 text-white"
    default:
      return "bg-yellow-500 text-gray-900"
  }
}

export function MarketSentiment() {
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [sentimentData, setSentimentData] = useState<SentimentData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null)

  // Define cache keys and version
  const CACHE_KEY = "market_sentiment_data"
  const CACHE_TIMESTAMP_KEY = "market_sentiment_timestamp"
  const CACHE_VERSION_KEY = "fearGreedCacheVersion"
  const CACHE_VERSION = "12.0" // Updated cache version for new caching behavior

  // Define components based on CNN's Fear & Greed Index indicators
  const components = [
    {
      name: "Market Momentum",
      description: "S&P 500 vs 125-Day MA",
      value: marketData?.cnnComponents?.[0]?.score ?? marketData?.marketMomentum ?? 50,
    },
    {
      name: "Stock Price Strength",
      description: "52-week highs vs lows",
      value: marketData?.cnnComponents?.[1]?.score ?? marketData?.stockPriceStrength ?? 50,
    },
    {
      name: "Stock Price Breadth",
      description: "McClellan Volume Summation",
      value: marketData?.cnnComponents?.[2]?.score ?? marketData?.stockBreadth ?? 50,
    },
    {
      name: "Put and Call Options",
      description: "5-day average ratio",
      value: marketData?.cnnComponents?.[3]?.score ?? (marketData?.putCallRatio ? marketData.putCallRatio * 50 : 50),
    },
    {
      name: "Market Volatility",
      description: "VIX vs 50-day MA",
      value: marketData?.cnnComponents?.[4]?.score ?? marketData?.vix ?? 50,
    },
    {
      name: "Safe Haven Demand",
      description: "20-day stock vs bond returns",
      value:
        marketData?.cnnComponents?.[5]?.score ??
        (marketData?.safeHavenDemand ? Math.min(100, Math.max(0, 50 + marketData.safeHavenDemand * 2)) : 50),
    },
    {
      name: "Junk Bond Demand",
      description: "Yield spread analysis",
      value:
        marketData?.cnnComponents?.[6]?.score ??
        (marketData?.junkBondSpread ? Math.min(100, Math.max(0, marketData.junkBondSpread * 10)) : 50),
    },
  ]

  const cnnIndicatorCards = [
    {
      name: "MARKET MOMENTUM",
      description: "S&P 500 vs 125-day moving average",
      score: components[0].value,
      sentiment: getIndicatorSentiment(components[0].value),
      icon: <ActivityIcon />,
      tooltipKey: "momentum",
    },
    {
      name: "STOCK PRICE STRENGTH",
      description: "Next over 52-week highs and lows on the NYSE",
      score: components[1].value,
      sentiment: getIndicatorSentiment(components[1].value),
      icon: <TrendingUpIcon />,
      tooltipKey: "strength",
    },
    {
      name: "STOCK PRICE BREADTH",
      description: "McClellan Volume Summation Index",
      score: components[2].value,
      sentiment: getIndicatorSentiment(components[2].value),
      icon: <BarChartIcon />,
      tooltipKey: "stockBreadth",
    },
    {
      name: "PUT AND CALL OPTIONS",
      description: "5-day average put/call ratio",
      score: components[3].value,
      sentiment: getIndicatorSentiment(components[3].value),
      icon: <TargetIcon />,
      tooltipKey: "putCall",
    },
    {
      name: "MARKET VOLATILITY",
      description: "VIX vs 50-day moving average",
      score: components[4].value,
      sentiment: getIndicatorSentiment(components[4].value),
      icon: <ActivityIcon />,
      tooltipKey: "vix",
    },
    {
      name: "SAFE HAVEN DEMAND",
      description: "Difference in 20-day stock and bond returns",
      score: components[5].value,
      sentiment: getIndicatorSentiment(components[5].value),
      icon: <ShieldIcon />,
      tooltipKey: "safeHaven",
    },
    {
      name: "JUNK BOND DEMAND",
      description: "Yield spread: Investment grade bonds vs junk bonds",
      score: components[6].value,
      sentiment: getIndicatorSentiment(components[6].value),
      icon: <DollarSignIcon />,
      tooltipKey: "junkBond",
    },
  ]

  const getChartDataForIndicator = (indicatorName: string): { data: number[]; dates: string[]; label: string } => {
    console.log("[v0] Getting chart data for indicator:", indicatorName)

    if (!marketData?.chartData) {
      console.log("[v0] No chartData available in marketData")
      return { data: [], dates: [], label: "" }
    }

    const { spy, vix, dates } = marketData.chartData

    console.log(
      "[v0] Available chart data - SPY points:",
      spy?.length,
      "VIX points:",
      vix?.length,
      "Dates:",
      dates?.length,
    )

    switch (indicatorName.toLowerCase().replace(/\s/g, "")) {
      case "marketmomentum":
        // SPY price (momentum)
        return { data: spy || [], dates: dates || [], label: "S&P 500 Price" }

      case "stockpricestrength":
        // SPY percentage change from 52-week average
        if (spy && spy.length > 0) {
          const avg52Week = spy.slice(-252).reduce((a, b) => a + b, 0) / Math.min(spy.length, 252)
          const strengthData = spy.map((price) => ((price - avg52Week) / avg52Week) * 100)
          return { data: strengthData, dates: dates || [], label: "% from 52-week avg" }
        }
        return { data: [], dates: [], label: "" }

      case "stockpricebreadth":
        // Volume-based breadth indicator
        if (spy && spy.length > 1) {
          const breadthData = spy.map((price, i) => {
            if (i === 0) return 50
            const change = ((price - spy[i - 1]) / spy[i - 1]) * 100
            return 50 + change * 5 // Scale to 0-100
          })
          return { data: breadthData, dates: dates || [], label: "Market Breadth Score" }
        }
        return { data: [], dates: [], label: "" }

      case "putandcalloptions":
        // VIX-based options sentiment (inverted - high VIX = fear = low score)
        if (vix && vix.length > 0) {
          const optionsData = vix.map((v) => Math.max(0, Math.min(100, 100 - v * 2)))
          return { data: optionsData, dates: dates || [], label: "Options Sentiment" }
        }
        return { data: [], dates: [], label: "" }

      case "marketvolatility":
        // Raw VIX
        return { data: vix || [], dates: dates || [], label: "VIX Level" }

      case "safehavendemand":
        // Inverse of SPY volatility (stable = high score = greed)
        if (spy && spy.length > 5) {
          const volatilityData = spy.map((price, i) => {
            if (i < 5) return 50
            const recentPrices = spy.slice(Math.max(0, i - 5), i + 1)
            const volatility = Math.max(...recentPrices) - Math.min(...recentPrices)
            const percentVolatility = (volatility / price) * 100
            return Math.max(0, Math.min(100, 100 - percentVolatility * 10))
          })
          return { data: volatilityData, dates: dates || [], label: "Safe Haven Score" }
        }
        return { data: [], dates: [], label: "" }

      case "junkbonddemand":
        // Based on SPY trend (uptrend = junk bond demand = greed)
        if (spy && spy.length > 10) {
          const junkBondData = spy.map((price, i) => {
            if (i < 10) return 50
            const ma10 = spy.slice(i - 10, i).reduce((a, b) => a + b, 0) / 10
            const trendStrength = ((price - ma10) / ma10) * 100
            return Math.max(0, Math.min(100, 50 + trendStrength * 5))
          })
          return { data: junkBondData, dates: dates || [], label: "Junk Bond Demand" }
        }
        return { data: [], dates: [], label: "" }

      default:
        return { data: [], dates: [], label: "" }
    }
  }

  useEffect(() => {
    const cachedData = localStorage.getItem(CACHE_KEY)
    const cachedSentiment = localStorage.getItem("sentimentHeatmapData")
    const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
    const cacheVersion = localStorage.getItem(CACHE_VERSION_KEY)

    // Check cache version and if data is from cache
    const isDataFromCache = cachedData && cachedTimestamp && cacheVersion === CACHE_VERSION

    if (isDataFromCache) {
      try {
        const data = JSON.parse(cachedData)

        if (
          typeof data.score === "number" &&
          data.score >= 0 &&
          data.score <= 100 &&
          data.cnnComponents &&
          Array.isArray(data.cnnComponents) &&
          data.cnnComponents.length === 7 &&
          typeof data.yesterdayChange === "number" &&
          typeof data.lastWeekChange === "number" &&
          typeof data.lastMonthChange === "number" &&
          typeof data.lastYearChange === "number" &&
          !isNaN(data.yesterdayChange) &&
          !isNaN(data.lastWeekChange) &&
          !isNaN(data.lastMonthChange) &&
          !isNaN(data.lastYearChange) &&
          data.chartData?.dates?.length > 0 && // Require chartData with actual dates
          data.chartData?.spy?.length > 0 && // Require SPY price data
          data.chartData?.vix?.length > 0 // Require VIX data
        ) {
          setMarketData(data)
          setLastUpdated(new Date(cachedTimestamp))
          setFromCache(true)
          setCacheTimestamp(cachedTimestamp)
          console.log(
            "[v0] Loaded valid cached CNN data with charts (score:",
            data.score,
            ", version:",
            cacheVersion,
            ")",
          )
          setLoading(false)

          if (cachedSentiment) {
            try {
              const sentiment = JSON.parse(cachedSentiment)
              setSentimentData(Array.isArray(sentiment) ? sentiment : [])
            } catch (error) {
              console.error("[v0] Error loading cached sentiment:", error)
            }
          }
          return // Return early - don't auto-fetch when cache is valid
        } else {
          console.log("[v0] Cache data invalid, fetching fresh CNN data with charts...")
          fetchData()
        }
      } catch (error) {
        console.error("[v0] Error loading cached data:", error)
        fetchData()
      }
    } else {
      if (cacheVersion !== CACHE_VERSION) {
        console.log(
          "[v0] Cache version mismatch (",
          cacheVersion,
          "!==",
          CACHE_VERSION,
          "), clearing and fetching fresh CNN data with charts...",
        )
        localStorage.removeItem(CACHE_KEY)
        localStorage.removeItem(CACHE_TIMESTAMP_KEY)
        localStorage.removeItem(CACHE_VERSION_KEY)
      }
      fetchData()
    }

    if (cachedSentiment) {
      try {
        const sentiment = JSON.parse(cachedSentiment)
        setSentimentData(Array.isArray(sentiment) ? sentiment : [])
      } catch (error) {
        console.error("[v0] Error loading cached sentiment:", error)
      }
    }
  }, [])

  const fetchData = async () => {
    try {
      // Only set loading to true if we are actually fetching and don't have marketData yet
      if (!marketData && !loading) {
        setLoading(true)
      }
      setFromCache(false)
      console.log("[v0] Fetching fresh Fear & Greed data from API...")
      const [marketRes, sentimentRes] = await Promise.all([
        fetch("/api/market-sentiment", {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        }),
        fetch("/api/sentiment-heatmap"),
      ])

      if (marketRes.ok) {
        const market = await marketRes.json()
        console.log("[v0] ✓ Received Fear & Greed data from API")
        console.log(`[v0] CNN Score: ${market.score}/100 (${market.sentiment})`)
        console.log(`[v0] Data Source: ${market.dataSource}`)

        // Validate we have real data
        if ((!market.score && market.score !== 0) || typeof market.score !== "number") {
          console.error("[v0] ✗ Received invalid data (no valid score)")
          throw new Error("Invalid data received from API")
        }
        // Also validate cnnComponents as per the updated cache validation logic
        if (!market.cnnComponents || !Array.isArray(market.cnnComponents) || market.cnnComponents.length !== 7) {
          console.error("[v0] ✗ Received invalid data (cnnComponents array invalid)")
          throw new Error("Invalid data received from API")
        }
        // Also validate chartData as per the updated cache validation logic
        if (!market.chartData || !market.chartData.dates || !market.chartData.spy || !market.chartData.vix) {
          console.error("[v0] ✗ Received invalid data (chartData invalid)")
          throw new Error("Invalid data received from API")
        }

        setMarketData(market)
        const timestamp = new Date().toISOString()
        localStorage.setItem(CACHE_KEY, JSON.stringify(market))
        localStorage.setItem(CACHE_TIMESTAMP_KEY, timestamp)
        localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION)
        setCacheTimestamp(timestamp)
        console.log("[v0] Fear & Greed data cached successfully with version", CACHE_VERSION)
      } else {
        const errorData = await marketRes.json().catch(() => ({}))
        console.error("[v0] ✗ Market sentiment API error:", marketRes.status, errorData)
        throw new Error(errorData.error || `API returned ${marketRes.status}`)
      }

      if (sentimentRes.ok) {
        const sentiment = await sentimentRes.json()
        const sentimentArray = sentiment.data || sentiment // Handle both old and new formats
        if (Array.isArray(sentimentArray)) {
          setSentimentData(sentimentArray)
          localStorage.setItem("sentimentHeatmapData", JSON.stringify(sentimentArray))
        } else {
          console.error("[v0] Sentiment data is not an array:", sentiment)
          setSentimentData([]) // Keep as empty array on error
        }
      } else {
        console.error("[v0] ✗ Sentiment heatmap API error:", sentimentRes.status)
        setSentimentData([]) // Keep as empty array on error
      }

      setLastUpdated(new Date())
    } catch (error) {
      console.error("[v0] Error fetching market sentiment data:", error)
      // Ensure loading is false even if there's an error
      setLoading(false)
    } finally {
      // Set loading to false after all fetching is done or attempted
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const formatCacheTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString()
  }

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-green-600" // Extreme Greed
    if (score >= 56) return "text-green-500" // Greed
    if (score >= 45) return "text-yellow-600" // Neutral
    if (score >= 25) return "text-orange-500" // Fear
    return "text-red-600" // Extreme Fear
  }

  const getScoreBackground = (score: number) => {
    if (score >= 75) return "bg-green-50 border-green-200"
    if (score >= 56) return "bg-green-50 border-green-200"
    if (score >= 45) return "bg-yellow-50 border-yellow-200"
    if (score >= 25) return "bg-orange-50 border-orange-200"
    return "bg-red-50 border-red-200"
  }

  // const getSentimentColor = (score: number) => { // REMOVED AND REPLACED BY getSentimentColor FUNCTION ABOVE
  //   if (score > 20) return "bg-green-500"
  //   if (score > 0) return "bg-green-300"
  //   if (score > -20) return "bg-red-300"
  //   return "bg-red-500"
  // }

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

  const getAllLevelGuidance = () => {
    return [
      {
        range: "0-24",
        level: "Extreme Fear",
        description: "Maximum buying opportunity - deploy capital aggressively",
        signal: "STRONG BUY",
        guidance: getTradeRecommendations(12),
        allocation: getPortfolioAllocation(12),
      },
      {
        range: "25-44",
        level: "Fear",
        description: "Good environment for premium sellers",
        signal: "BUY",
        guidance: getTradeRecommendations(34),
        allocation: getPortfolioAllocation(34),
      },
      {
        range: "45-55",
        level: "Neutral",
        description: "Market balanced - be selective",
        signal: "HOLD",
        guidance: getTradeRecommendations(50),
        allocation: getPortfolioAllocation(50),
      },
      {
        range: "56-74",
        level: "Greed",
        description: "Reduce exposure and build cash",
        signal: "CAUTION",
        guidance: getTradeRecommendations(65),
        allocation: getPortfolioAllocation(65),
      },
      {
        range: "75-100",
        level: "Extreme Greed",
        description: "High risk of correction - maximum defensive positioning",
        signal: "AVOID/SELL",
        guidance: getTradeRecommendations(87),
        allocation: getPortfolioAllocation(87),
      },
    ]
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
        <div className="text-gray-600 font-medium">Loading Fear & Greed Index data...</div>
      </div>
    )
  }

  if (!marketData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
        <div className="text-gray-600 font-medium">Loading market data...</div>
      </div>
    )
  }

  const recommendations = getTradeRecommendations(marketData.overallScore)
  const portfolioAllocation = getPortfolioAllocation(marketData.overallScore)
  const allLevelGuidance = getAllLevelGuidance()

  const safeSentimentData = Array.isArray(sentimentData) ? sentimentData : []

  return (
    <div className="space-y-6">
      {marketData?.usingFallback && (
        <Card className="shadow-sm border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <InfoIcon />
              <div>
                <h3 className="font-bold text-yellow-900 mb-1">Using Calculated Values</h3>
                <p className="text-sm text-yellow-800 leading-relaxed">
                  CNN's Fear & Greed Index is currently unavailable. We're using our own calculation based on real
                  market data (VIX, S&P 500, bond spreads) with the same 7-indicator methodology. Values may differ
                  slightly from CNN's official index but follow the same formula.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {fromCache && cacheTimestamp && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <InfoIcon />
            <span className="text-sm text-yellow-800">
              Showing cached data from <strong>{formatCacheTime(cacheTimestamp)}</strong>
            </span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-sm text-yellow-700 hover:text-yellow-900 font-medium flex items-center gap-1"
          >
            {refreshing ? (
              <>
                <div className="w-3 h-3 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshIcon />
                Refresh Now
              </>
            )}
          </button>
        </div>
      )}

      {/* Fear & Greed Historical Scale - KEEP */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <BarChartIcon />
                Fear & Greed Historical Scale
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Visual representation of sentiment zones from extreme greed to extreme fear
              </p>
            </div>
            <RefreshButton onClick={handleRefresh} loading={refreshing} />
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="relative">
              <div className="h-24 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-lg shadow-inner" />

              <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-bold">
                <div className="text-center text-white drop-shadow-lg">
                  <div className="text-base">EXTREME</div>
                  <div>GREED</div>
                  <div className="text-[10px] mt-1">75-100</div>
                </div>
                <div className="text-center text-white drop-shadow-lg">
                  <div>GREED</div>
                  <div className="text-[10px] mt-1">56-74</div>
                </div>
                <div className="text-center text-gray-800 drop-shadow">
                  <div>NEUTRAL</div>
                  <div className="text-[10px] mt-1">45-55</div>
                </div>
                <div className="text-center text-white drop-shadow-lg">
                  <div>FEAR</div>
                  <div className="text-[10px] mt-1">25-44</div>
                </div>
                <div className="text-center text-white drop-shadow-lg">
                  <div className="text-base">EXTREME</div>
                  <div>FEAR</div>
                  <div className="text-[10px] mt-1">0-24</div>
                </div>
              </div>

              {marketData && (
                <div
                  className="absolute top-0 bottom-0 w-2 bg-black shadow-lg transition-all duration-500"
                  style={{ left: `calc(${100 - marketData.overallScore}% - 4px)` }}
                >
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <div className="bg-black text-white px-4 py-2 rounded-lg shadow-xl">
                      <div className="text-xs font-semibold">TODAY</div>
                      <div className="text-2xl font-bold">{marketData.overallScore.toFixed(0)}</div>
                      <div className="text-xs text-center">{marketData.sentiment}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Score Calculation Methodology Display */}
            {marketData.calculationDetails && (
              <div className="col-span-full rounded-lg border-2 border-blue-100 bg-blue-50 p-4">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-blue-900">
                  <InfoIcon />
                  Score Calculation Methodology
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-semibold text-blue-900">Formula:</span>
                      <p className="text-blue-800 font-mono text-xs mt-1">{marketData.calculationDetails.formula}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-900">Weighting:</span>
                      <p className="text-blue-800">{marketData.calculationDetails.weighting}</p>
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold text-blue-900">Methodology:</span>
                    <p className="text-blue-800">{marketData.calculationDetails.methodology}</p>
                  </div>
                  {marketData.calculationDetails.individualScores && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <span className="font-semibold text-blue-900 block mb-2">Individual Indicator Scores:</span>
                      <div className="grid grid-cols-2 gap-2 text-xs text-blue-800 font-mono">
                        <div>I1 (Momentum): {marketData.calculationDetails.individualScores.i1_marketMomentum}</div>
                        <div>I2 (Strength): {marketData.calculationDetails.individualScores.i2_stockStrength}</div>
                        <div>I3 (Breadth): {marketData.calculationDetails.individualScores.i3_stockBreadth}</div>
                        <div>I4 (Put/Call): {marketData.calculationDetails.individualScores.i4_putCallRatio}</div>
                        <div>I5 (Volatility): {marketData.calculationDetails.individualScores.i5_marketVolatility}</div>
                        <div>I6 (Safe Haven): {marketData.calculationDetails.individualScores.i6_safeHavenDemand}</div>
                        <div>I7 (Junk Bonds): {marketData.calculationDetails.individualScores.i7_junkBondDemand}</div>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <span className="font-semibold text-blue-900 block mb-1">Data Sources:</span>
                    <p className="text-xs text-blue-700">
                      {marketData.dataSourcesUsed?.primary} •
                      {marketData.dataSourcesUsed?.nyseData
                        ? ` NYSE via ${marketData.dataSourcesUsed.nyseData} • `
                        : " "}
                      All indicators collected independently and calculated in real-time
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Historical Reference Points */}
            <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="text-xs font-bold text-gray-900 mb-3 flex items-center gap-2">
                <InfoIcon />
                Historical Reference Points
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-semibold text-red-600">COVID-19 Crash (Mar 2020):</span>
                  <span className="ml-1 text-gray-700">12 (Extreme Fear)</span>
                </div>
                <div>
                  <span className="font-semibold text-green-600">Meme Stock Peak (Feb 2021):</span>
                  <span className="ml-1 text-gray-700">89 (Extreme Greed)</span>
                </div>
                <div>
                  <span className="font-semibold text-red-600">2022 Bear Market Low:</span>
                  <span className="ml-1 text-gray-700">18 (Extreme Fear)</span>
                </div>
                <div>
                  <span className="font-semibold text-green-600">AI Rally Peak (Jul 2024):</span>
                  <span className="ml-1 text-gray-700">83 (Extreme Greed)</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 7 FEAR & GREED INDICATORS section with individual cards and charts */}
      <div className="space-y-6">
        <div className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUpIcon className="h-6 w-6 text-primary" />7 FEAR & GREED INDICATORS
        </div>

        {cnnIndicatorCards.map((indicator, index) => {
          const chartInfo = getChartDataForIndicator(indicator.name) // Use indicator.name to match tooltip keys
          console.log(`[v0] Chart for ${indicator.name}:`, {
            dataPoints: chartInfo.data.length,
            datePoints: chartInfo.dates.length,
            firstValue: chartInfo.data[0],
            lastValue: chartInfo.data[chartInfo.data.length - 1],
          })

          return (
            <Card key={index} className="bg-white border-gray-200">
              <CardHeader className="bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-gray-900 mb-1">{indicator.name}</CardTitle>
                    <CardDescription className="text-sm text-gray-600">{indicator.description}</CardDescription>
                  </div>
                  <div className={`px-3 py-1 rounded text-xs font-bold ${getSentimentColor(indicator.sentiment)}`}>
                    {indicator.sentiment}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <MiniLineChart
                    data={chartInfo.data}
                    dates={chartInfo.dates}
                    color="#2563eb"
                    yAxisLabel={chartInfo.label}
                  />

                  {/* Explanation text */}
                  <div className="flex items-center">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {componentTooltips[indicator.tooltipKey as keyof typeof componentTooltips].description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Trade Recommendations accordion */}
      <Accordion type="multiple" className="space-y-0">
        <AccordionItem value="trade-recommendations" className="border-0">
          <Card className="shadow-sm border-gray-200">
            <AccordionTrigger className="hover:no-underline px-6 py-4 bg-gray-50 border-b border-gray-200 rounded-t-lg">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <TargetIcon className="h-5 w-5 text-primary" />
                Trade Recommendations & Portfolio Guidance
                {refreshing && (
                  <span className="text-xs font-normal text-primary animate-pulse">(Recalculating...)</span>
                )}
              </CardTitle>
            </AccordionTrigger>
            <AccordionContent>
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
                  <div className={`mt-4 p-4 rounded-lg border-2 ${getScoreBackground(marketData.overallScore)}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldIcon className="h-5 w-5 text-primary" />
                      <h3 className={`font-bold ${getScoreColor(marketData.overallScore)}`}>
                        Risk Management Guidelines
                      </h3>
                    </div>
                    <ul className="space-y-2">
                      {recommendations.riskManagement.map((tip, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-primary">
                          <span className="text-primary mt-1">✓</span>
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
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>

      <Accordion type="multiple" className="space-y-0">
        <AccordionItem value="options-strategy-guide" className="border-0">
          <Card className="shadow-sm border-gray-200">
            <AccordionTrigger className="hover:no-underline px-6 py-4 bg-gray-50 border-b border-gray-200 rounded-t-lg">
              <CardTitle className="text-lg font-bold text-gray-900">
                Options Strategy Guide by Fear & Greed Level
              </CardTitle>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-4 pb-4">
                <div className="space-y-2">
                  {[
                    {
                      range: "0-24",
                      level: "Extreme Fear",
                      description: "Maximum buying opportunity - deploy capital aggressively",
                      signal: "STRONG BUY",
                      guidance: getTradeRecommendations(12),
                      allocation: getPortfolioAllocation(12),
                    },
                    {
                      range: "25-44",
                      level: "Fear",
                      description: "Good environment for premium sellers",
                      signal: "BUY",
                      guidance: getTradeRecommendations(34),
                      allocation: getPortfolioAllocation(34),
                    },
                    {
                      range: "45-55",
                      level: "Neutral",
                      description: "Market balanced - be selective",
                      signal: "HOLD",
                      guidance: getTradeRecommendations(50),
                      allocation: getPortfolioAllocation(50),
                    },
                    {
                      range: "56-74",
                      level: "Greed",
                      description: "Reduce exposure and build cash",
                      signal: "CAUTION",
                      guidance: getTradeRecommendations(65),
                      allocation: getPortfolioAllocation(65),
                    },
                    {
                      range: "75-100",
                      level: "Extreme Greed",
                      description: "High risk of correction - maximum defensive positioning",
                      signal: "AVOID/SELL",
                      guidance: getTradeRecommendations(87),
                      allocation: getPortfolioAllocation(87),
                    },
                  ].map((item, index) => {
                    const isCurrent =
                      marketData.overallScore >= Number.parseInt(item.range.split("-")[0]) &&
                      marketData.overallScore <= Number.parseInt(item.range.split("-")[1])

                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border transition-colors ${
                          isCurrent
                            ? "border-green-500 bg-green-100 shadow-md ring-2 ring-green-300"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-mono text-sm font-bold text-gray-900">Score {item.range}</span>
                              <span
                                className={`ml-3 font-bold text-sm ${
                                  index === 0
                                    ? "text-red-600" // Extreme Fear
                                    : index === 1
                                      ? "text-orange-500" // Fear
                                      : index === 2
                                        ? "text-yellow-600" // Neutral
                                        : index === 3
                                          ? "text-green-500" // Greed
                                          : "text-green-600" // Extreme Greed
                                }`}
                              >
                                {item.level}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isCurrent && (
                                <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">
                                  CURRENT
                                </span>
                              )}
                              <span
                                className={`px-3 py-1 text-xs font-bold rounded-full ${
                                  item.signal === "STRONG BUY"
                                    ? "bg-green-100 text-green-800"
                                    : item.signal === "BUY"
                                      ? "bg-green-100 text-green-700"
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
                            <div className="text-xs font-semibold text-blue-900 uppercase mb-1">Cash</div>
                            <div className="text-lg font-bold text-blue-900">{item.guidance.cashAllocation}</div>
                          </div>
                          <div className="p-3 bg-purple-50 rounded border border-purple-200">
                            <div className="text-xs font-semibold text-purple-900 uppercase mb-1">Exposure</div>
                            <div className="text-lg font-bold text-purple-900">{item.guidance.marketExposure}</div>
                          </div>
                          <div className="p-3 bg-orange-50 rounded border border-orange-200">
                            <div className="text-xs font-semibold text-orange-900 uppercase mb-1">Position Size</div>
                            <div className="text-sm font-bold text-orange-900">{item.guidance.positionSize}</div>
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="text-xs font-bold text-gray-900 uppercase mb-2">Top Strategies</div>
                          <div className="space-y-1">
                            {item.guidance.strategies.slice(0, 3).map((strategy, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                <span className="text-primary mt-1 flex-shrink-0">•</span>
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
                    <strong>Note:</strong> The Fear & Greed Index is most effective when extreme readings align with
                    technical levels. Extreme fear (0-24) with strong support levels historically produces the best
                    risk/reward for options sellers. Always maintain proper position sizing and risk management.
                  </p>
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>

      {/* Portfolio Allocation accordion */}
      <Accordion type="multiple" className="space-y-0">
        <AccordionItem value="portfolio-allocation" className="border-0">
          <Card className="shadow-sm border-gray-200">
            <AccordionTrigger className="hover:no-underline px-6 py-4 bg-gray-50 border-b border-gray-200 rounded-t-lg">
              <CardTitle className="text-lg font-bold text-gray-900">
                Portfolio Allocation by Fear & Greed Level
              </CardTitle>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-4 pb-4">
                <div className="space-y-2">
                  {[
                    { range: "0-24", level: "Extreme Greed", data: getPortfolioAllocation(12) },
                    { range: "25-44", level: "Greed", data: getPortfolioAllocation(34) },
                    { range: "45-55", level: "Neutral", data: getPortfolioAllocation(50) },
                    { range: "56-74", level: "Fear", data: getPortfolioAllocation(65) },
                    { range: "75-100", level: "Extreme Fear", data: getPortfolioAllocation(87) },
                  ].map((item, index) => {
                    const isCurrent =
                      marketData.overallScore >= Number.parseInt(item.range.split("-")[0]) &&
                      marketData.overallScore <= Number.parseInt(item.range.split("-")[1])

                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border transition-colors ${
                          isCurrent
                            ? "border-green-500 bg-green-100 shadow-md ring-2 ring-green-300"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-mono text-sm font-bold text-gray-900">Score {item.range}</span>
                              <span
                                className={`ml-3 font-bold text-sm ${
                                  index === 0
                                    ? "text-green-600" // Extreme Greed
                                    : index === 1
                                      ? "text-green-500" // Greed
                                      : index === 2
                                        ? "text-yellow-600" // Neutral
                                        : index === 3
                                          ? "text-orange-500" // Fear
                                          : "text-red-600" // Extreme Fear
                                }`}
                              >
                                {item.level}
                              </span>
                            </div>
                            {isCurrent && (
                              <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">
                                CURRENT
                              </span>
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
                    <strong>Note:</strong> These allocations are guidelines based on historical market patterns. Always
                    adjust based on your personal risk tolerance, time horizon, and financial goals. Consult with a
                    financial advisor for personalized advice.
                  </p>
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>

      {/* About section */}
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
