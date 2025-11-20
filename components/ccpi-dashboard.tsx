"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, AlertTriangle, Activity, DollarSign, BarChart3 } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Download } from "lucide-react"
import { RefreshButton } from "@/components/ui/refresh-button"

// Helper component for tooltips with descriptions
const InfoTooltip = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="text-gray-400 hover:text-gray-600 focus:outline-none">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs bg-white border-gray-200 shadow-lg">
        <p className="font-semibold mb-1">{title}</p>
        {children}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

const getIndicatorExplanation = (signal: string): { what: string; impact: string } => {
  // QQQ Daily Return
  if (signal.includes("QQQ crashed") || signal.includes("QQQ dropped")) {
    return {
      what: "The QQQ ETF tracks the Nasdaq-100 index, which includes the largest technology companies. This indicator measures how much QQQ's price changed today compared to yesterday.",
      impact:
        "Higher losses (more negative numbers) mean tech stocks are selling off rapidly. Losses over 6% in a single day are extremely rare and often signal panic selling. Losses over 3% show significant selling pressure and weak momentum that can continue for days or weeks.",
    }
  }

  // QQQ Consecutive Down Days
  if (signal.includes("consecutive down days")) {
    return {
      what: "This counts how many days in a row QQQ has closed lower than the previous day. It measures sustained downward pressure rather than single-day volatility.",
      impact:
        "More consecutive down days indicate persistent selling and broken momentum. Five or more days suggests the trend has turned negative and sellers are in control. Three or more days warns that buyers are losing confidence and the uptrend may be ending.",
    }
  }

  // QQQ Below SMAs (20, 50, 200-day)
  if (signal.includes("20-day SMA")) {
    return {
      what: "A Simple Moving Average (SMA) is the average price over a set period. The 20-day SMA represents the average price over the past month and acts as a short-term support level.",
      impact:
        "When QQQ falls below this average, it signals short-term momentum has turned negative. The further below (measured by proximity %), the stronger the breakdown. Breaking below shows sellers have overcome what was previously a price floor where buyers stepped in.",
    }
  }

  if (signal.includes("50-day SMA")) {
    return {
      what: "The 50-day SMA is the average price over roughly 2.5 months. It represents medium-term trend health and is watched closely by institutional investors as a key support level.",
      impact:
        "Breaking below the 50-day average is more serious than the 20-day because it shows the medium-term uptrend is broken. This often leads to more selling as automated trading systems trigger sell orders and investors lose confidence in the rally.",
    }
  }

  if (signal.includes("200-day SMA")) {
    return {
      what: "The 200-day SMA is the average price over roughly 10 months. This is the most important long-term trend indicator, often called the 'bull/bear line.' Trading above it means you're in a bull market; below it suggests a bear market.",
      impact:
        "Breaking below the 200-day average is extremely serious - it signals the long-term uptrend has ended and a bear market may have begun. This triggers massive institutional selling as funds reduce risk exposure. Recoveries above this level are difficult and can take months or years.",
    }
  }

  // Bollinger Bands
  if (signal.includes("Bollinger Band")) {
    return {
      what: "Bollinger Bands create a channel around the price using standard deviations. The lower band represents two standard deviations below the average, showing statistically extreme oversold conditions.",
      impact:
        "Breaking below the lower Bollinger Band means the price has moved further down than 95% of normal price movements. This signals either a sharp selloff (panic) or the start of a sustained downtrend. While sometimes it creates a 'bounce' opportunity, it more often signals continuation of selling.",
    }
  }

  // VIX
  if (signal.includes("VIX at")) {
    return {
      what: "The VIX (Volatility Index) measures how much volatility traders expect in the S&P 500 over the next 30 days, based on options prices. It's called the 'fear gauge' because it spikes when investors are scared and buy protection.",
      impact:
        "Higher VIX means investors expect bigger price swings and are paying more for protection (put options). Above 35 indicates extreme fear and often coincides with market crashes. Above 25 shows elevated anxiety and increased risk of sharp drops. Normal VIX is 12-20.",
    }
  }

  // VXN
  if (signal.includes("VXN at")) {
    return {
      what: "VXN is the volatility index specifically for the Nasdaq-100, measuring expected volatility in tech stocks. It works the same way as VIX but focuses on technology companies rather than the broader market.",
      impact:
        "Higher VXN means tech investors are nervous and expect big price swings. Since tech stocks make up a huge portion of market value, VXN spikes often lead market-wide selloffs. Above 35 signals panic in the tech sector; above 25 shows elevated fear that tech's rally is ending.",
    }
  }

  // RVX
  if (signal.includes("RVX at")) {
    return {
      what: "RVX measures expected volatility in the Russell 2000 index, which tracks small-cap stocks (smaller companies). Small-caps are riskier than large-caps and often lead market turns.",
      impact:
        "Higher RVX indicates stress in smaller companies, which are more vulnerable to economic slowdowns and credit tightening. When small-caps get volatile, it often signals broader economic weakness that will eventually spread to larger stocks. Above 35 is extreme stress; above 25 is a warning sign.",
    }
  }

  // VIX Term Structure
  if (signal.includes("VIX term structure")) {
    return {
      what: "VIX term structure compares short-term expected volatility to long-term expected volatility. Normally, long-term volatility is higher (ratio > 1.2), creating an upward slope. When inverted (ratio < 1), short-term fear exceeds long-term expectations.",
      impact:
        "Inversion signals immediate panic - traders expect big drops NOW more than later. This typically happens at the start of crashes or during crisis events. A flattening structure (ratio approaching 1) warns that near-term uncertainty is rising, often preceding selloffs.",
    }
  }

  // ATR
  if (signal.includes("ATR at")) {
    return {
      what: "Average True Range (ATR) measures how much a stock typically moves in a day, including gaps between trading days. It captures the average daily trading range and shows overall market volatility levels.",
      impact:
        "Higher ATR means bigger daily price swings and more uncertainty. Above 50 indicates extreme volatility where prices can move 5%+ in a single day. Above 40 shows elevated volatility that often leads to further instability. High ATR environments are risky because losses can mount quickly.",
    }
  }

  // LTV
  if (signal.includes("Long-term volatility")) {
    return {
      what: "Long-term Volatility (LTV) measures price fluctuations over weeks and months rather than days. It shows whether the market's instability is temporary or becoming a persistent pattern.",
      impact:
        "Higher LTV means sustained instability that doesn't calm down. Above 20% indicates the market is in a prolonged unstable period where crashes become more likely. Above 15% warns that volatility is building and may worsen. High LTV environments make it hard to predict prices and often lead to capitulation selling.",
    }
  }

  // Bullish Percent
  if (signal.includes("Bullish Percent")) {
    return {
      what: "Bullish Percent Index measures what percentage of stocks are trading in bullish chart patterns based on Point & Figure analysis. It's a breadth indicator showing how many stocks are in uptrends.",
      impact:
        "Higher percentages mean too many stocks are overbought at once, leaving little room for further gains. Above 70% indicates dangerous euphoria where most stocks have already risen substantially. Above 60% shows elevated optimism that typically precedes pullbacks as there are fewer stocks left to join the rally.",
    }
  }

  // Put/Call Ratio
  if (signal.includes("Put/Call")) {
    return {
      what: "The Put/Call Ratio compares how many put options (bearish bets) to call options (bullish bets) are being traded. A normal ratio is 0.85-1.0, showing balanced sentiment. Lower ratios mean more calls than puts.",
      impact:
        "Lower ratios indicate complacency - too many investors are betting on gains (calls) and too few are buying protection (puts). Below 0.6 signals extreme complacency where almost nobody expects a drop, which is dangerous because markets crash when everyone is optimistic. Below 0.85 warns that hedging activity is low and investors may be caught off guard.",
    }
  }

  // Fear & Greed
  if (signal.includes("Fear & Greed")) {
    return {
      what: "The Fear & Greed Index combines seven indicators (momentum, volatility, safe haven demand, etc.) into a single 0-100 score. Below 25 is fear, above 75 is greed. It measures overall market emotion.",
      impact:
        "Higher scores mean excessive greed where investors are overconfident and paying high prices without concern for risk. Above 80 signals extreme greed that typically marks market tops before crashes. Above 70 warns of elevated greed where a correction becomes increasingly likely as euphoria builds.",
    }
  }

  // AAII Bullish
  if (signal.includes("AAII Bullish")) {
    return {
      what: "The American Association of Individual Investors (AAII) surveys individual investors weekly, asking if they're bullish, bearish, or neutral. This percentage shows how many retail (non-professional) investors are optimistic.",
      impact:
        "Higher bullish percentages indicate retail euphoria, which is often a contrarian indicator - when inexperienced investors are most optimistic, markets tend to be overpriced. Above 55% shows extreme retail euphoria that has historically preceded major tops. Above 45% warns of elevated optimism that leaves markets vulnerable to disappointment.",
    }
  }

  // Short Interest
  if (signal.includes("Short Interest")) {
    return {
      what: "Short Interest measures what percentage of available shares are currently sold short (bearish bets where traders borrow and sell shares hoping to buy them back cheaper). It shows how many investors are betting against the market.",
      impact:
        "Lower short interest indicates complacency - too few investors are protecting against or betting on a decline. Below 1.5% is extreme complacency where almost nobody expects trouble, which is dangerous because there's no 'cushion' of pessimism. Below 2.5% shows low positioning that leaves markets vulnerable to sudden selling if sentiment shifts.",
    }
  }

  // ETF Flows
  if (signal.includes("ETF outflows")) {
    return {
      what: "ETF flows measure how many billions of dollars are moving into or out of equity ETFs (like SPY, QQQ). Outflows (negative numbers) mean investors are pulling money out of stocks, while inflows mean they're buying.",
      impact:
        "Larger outflows indicate capital flight - investors are selling stocks and moving to cash or bonds. Outflows over $3B suggest panic selling or major repositioning. Outflows over $1.5B show sustained selling pressure that can push markets lower as supply overwhelms demand.",
    }
  }

  // Yield Curve
  if (signal.includes("Yield curve inverted")) {
    return {
      what: "The yield curve compares 2-year Treasury yields to 10-year Treasury yields. Normally, longer-term bonds pay higher interest (positive spread). When inverted (negative spread), short-term rates are higher than long-term rates.",
      impact:
        "Inversion is one of the most reliable recession predictors, with recessions following within 6-24 months in nearly every case since 1960. Deeper inversions (more negative) indicate higher recession probability. It signals that bond investors expect the Fed to cut rates in the future due to economic weakness, which historically crashes stocks.",
    }
  }

  // S&P 500 P/E
  if (signal.includes("S&P 500 P/E")) {
    return {
      what: "The Price-to-Earnings (P/E) ratio divides the stock price by earnings per share. For the S&P 500, it shows how much investors are paying for every dollar of corporate profits. Historical average is around 16-17.",
      impact:
        "Higher P/E means stocks are more expensive relative to their earnings. Above 30 indicates extreme overvaluation where investors are paying twice the historical norm, leaving little room for disappointment. Above 22 shows elevated valuations that typically revert downward through either price drops or earnings growth.",
    }
  }

  // S&P 500 P/S
  if (signal.includes("S&P 500 P/S")) {
    return {
      what: "The Price-to-Sales (P/S) ratio divides market value by total revenue. Unlike P/E which can be distorted by accounting, P/S shows raw valuation based on sales. Historical average is 1.5-2.0.",
      impact:
        "Higher P/S means investors are paying more for each dollar of sales, regardless of profitability. Above 3.5 signals extreme expense where valuations have detached from fundamentals. Above 2.5 shows elevated pricing that typically corrects through price declines as reality sets in.",
    }
  }

  // Buffett Indicator
  if (signal.includes("Buffett Indicator")) {
    return {
      what: "The Buffett Indicator divides total stock market capitalization by GDP (the total economic output). Warren Buffett called this 'the best single measure' of valuation. It shows if stocks are overvalued relative to the economy. Fair value is around 100%.",
      impact:
        "Higher percentages mean the stock market is worth much more than the underlying economy produces. Above 200% indicates significant overvaluation - stocks are twice as expensive as the economy justifies. Above 150% warns of elevated valuations that typically decline toward fair value through market corrections.",
    }
  }

  // Fed Funds Rate
  if (signal.includes("Fed Funds")) {
    return {
      what: "The Federal Funds Rate is the interest rate banks charge each other for overnight loans, controlled by the Federal Reserve. It's the primary tool the Fed uses to control inflation and economic growth. Higher rates make borrowing expensive and slow the economy.",
      impact:
        "Higher Fed rates increase borrowing costs for businesses and consumers, slowing economic growth and reducing corporate profits. Above 6% is extremely restrictive, historically crushing economic activity and triggering recessions. Above 5% is restrictive policy that pressures stock valuations as bonds become more attractive than risky equities.",
    }
  }

  // Junk Spread
  if (signal.includes("Junk Bond Spread")) {
    return {
      what: "Junk Bond Spread measures the extra interest (yield) that risky corporate bonds pay compared to safe Treasury bonds. It shows how much investors demand to take on credit risk with below-investment-grade companies.",
      impact:
        "Wider spreads mean investors fear defaults and demand much higher yields to lend to risky companies. Above 8% indicates severe credit stress where funding becomes unavailable for weaker companies, often preceding bankruptcies and economic contraction. Above 5% shows credit tightening that stresses corporate balance sheets and slows growth.",
    }
  }

  // Debt-to-GDP
  if (signal.includes("Debt-to-GDP")) {
    return {
      what: "Debt-to-GDP divides total US government debt by GDP (annual economic output). It measures the government's debt burden relative to the economy's ability to service it. Sustainable levels are debated but historically were below 60%.",
      impact:
        "Higher ratios mean the government owes more relative to what the economy produces, raising concerns about fiscal sustainability and potential tax increases or spending cuts. Above 130% approaches levels that have triggered crises in other developed nations. Above 110% shows elevated fiscal burden that may limit government response to future recessions.",
    }
  }

  // NVIDIA Momentum
  if (signal.includes("NVIDIA momentum")) {
    return {
      what: "NVIDIA's momentum score (0-100) measures its relative strength and trend health across multiple timeframes. As the leader in AI chips, NVIDIA often leads the broader tech sector higher or lower.",
      impact:
        "Lower momentum indicates NVIDIA is weakening, which matters because it's become a market bellwether - when NVIDIA falls, tech follows. Below 20 signals severe weakness in AI/tech leadership that often spreads to other sectors. Below 40 warns that tech's strongest stock is losing steam, threatening the broader rally.",
    }
  }

  // SOX Index
  if (signal.includes("SOX")) {
    return {
      what: "The Philadelphia Semiconductor Index (SOX) tracks the 30 largest chip companies. Semiconductors are crucial to everything from phones to cars to AI, making this a leading indicator of economic and tech health.",
      impact:
        "Larger declines indicate weakness in the chip sector, which is foundational to the modern economy. Down over 15% signals a chip sector crash that typically predicts broader economic slowdown. Down over 10% shows semiconductor weakness that often leads tech and the broader market lower.",
    }
  }

  // TED Spread
  if (signal.includes("TED Spread")) {
    return {
      what: "TED Spread measures the difference between 3-month LIBOR (what banks charge each other) and 3-month Treasury rates (risk-free rate). It shows stress in the banking system - banks charge higher rates when they don't trust each other.",
      impact:
        "Wider spreads indicate banks fear lending to each other due to credit risk or liquidity concerns. Above 1.0% signals severe banking stress similar to the 2008 financial crisis. Above 0.5% shows credit market tension that can freeze lending and trigger economic contraction.",
    }
  }

  // DXY Dollar Index
  if (signal.includes("Dollar Index")) {
    return {
      what: "The DXY measures the US dollar's value against a basket of major foreign currencies (Euro, Yen, Pound, etc.). A higher DXY means the dollar is strengthening relative to other currencies.",
      impact:
        "A stronger dollar hurts US multinationals because their foreign earnings are worth less when converted back to dollars, reducing reported profits. Above 115 indicates extreme dollar strength that significantly pressures tech stocks' earnings. Above 105 shows strong dollar headwinds that typically lead to earnings disappointments.",
    }
  }

  // ISM PMI
  if (signal.includes("ISM PMI")) {
    return {
      what: "The ISM Manufacturing PMI surveys purchasing managers about business conditions. Above 50 indicates manufacturing is expanding; below 50 means it's contracting. It's a leading indicator of economic health.",
      impact:
        "Lower readings indicate manufacturing contraction, which typically predicts broader economic weakness. Below 46 signals significant manufacturing contraction that often precedes recessions. Below 50 shows weak manufacturing that pressures corporate earnings and employment.",
    }
  }

  // Fed Reverse Repo
  if (signal.includes("Fed Reverse Repo") || signal.includes("RRP")) {
    return {
      what: "The Fed's Reverse Repo facility lets money market funds park cash overnight with the Fed for interest. High balances mean cash is sitting idle rather than being invested in stocks or lent out to the economy.",
      impact:
        "Higher balances indicate money is sitting on the sidelines earning safe returns rather than taking risk in stocks. Above $2T suggests massive amounts of cash prefer safety over equity exposure. Above $1.5T shows significant capital that could flow into stocks isn't, indicating risk-off sentiment.",
    }
  }

  // Default fallback for any unmatched signals
  return {
    what: "This indicator measures a specific market condition that has historically been associated with increased crash risk based on backtesting against past market cycles.",
    impact:
      "When this indicator reaches warning levels, it suggests market conditions are becoming unfavorable. Higher severity levels indicate stronger warning signals based on historical patterns that preceded significant market declines.",
  }
}

interface CCPIData {
  ccpi: number
  baseCCPI?: number
  crashAmplifiers?: Array<{ reason: string; points: number }>
  totalBonus?: number
  certainty: number
  pillars: {
    momentum: number // NEW: Pillar 1 - Momentum & Technical (40%)
    riskAppetite: number // NEW: Pillar 2 - Risk Appetite (30%)
    valuation: number // NEW: Pillar 3 - Valuation (20%)
    macro: number // Pillar 4 - Macro (10%)
  }
  regime: {
    level: number
    name: string
    color: string
    description: string
  }
  playbook: {
    bias: string
    strategies: string[]
    allocation: Record<string, string>
  }
  summary: {
    headline: string
    bullets: string[]
  }
  canaries: Array<{
    signal: string
    pillar: string
    severity: "high" | "medium" | "low"
    indicatorWeight?: number
    pillarWeight?: number
    impactScore?: number
  }>
  indicators?: Record<string, any>
  apiStatus?: Record<string, { live: boolean; source: string }> // Updated for clarity
  timestamp: string
  totalIndicators?: number // Added for the canary count display
  cachedAt?: string // Added cache timestamp
  lastUpdated?: string // Added for last updated timestamp
}

interface HistoricalData {
  history: Array<{
    date: string
    ccpi: number
    certainty: number
  }>
}

export default function CcpiDashboard({ symbol = "SPY" }: { symbol?: string }) {
  const [data, setData] = useState<CCPIData | null>(null)
  const [history, setHistory] = useState<HistoricalData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [executiveSummary, setExecutiveSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const [refreshProgress, setRefreshProgress] = useState(0)
  const [refreshStatus, setRefreshStatus] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  const getReadableColor = (colorName: string): string => {
    const colorMap: Record<string, string> = {
      green: "#16a34a", // Green for low risk
      lime: "#65a30d", // Lime for normal
      yellow: "#f97316", // Orange instead of yellow for better readability
      orange: "#f97316", // Orange for caution
      red: "#dc2626", // Red for high alert/crash watch
    }
    return colorMap[colorName] || "#6b7280" // Default to gray if color not found
  }

  const getBarColor = (percentage: number): string => {
    if (percentage <= 33) return "#22c55e" // green-500
    if (percentage <= 66) return "#eab308" // yellow-500
    return "#ef4444" // red-500
  }

  const getStatusBadge = (live: boolean, source: string) => {
    if (live) {
      return (
        <Badge className="ml-2 bg-green-500 text-white text-xs flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-white"></span>
          Live
        </Badge>
      )
    } else if (source.includes("baseline") || source.includes("fallback") || source.includes("historical")) {
      return (
        <Badge className="ml-2 bg-amber-500 text-white text-xs flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-white"></span>
          Baseline
        </Badge>
      )
    } else {
      return (
        <Badge className="ml-2 bg-red-500 text-white text-xs flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-white"></span>
          Failed
        </Badge>
      )
    }
  }

  useEffect(() => {
    console.log("[v0] CCPI Dashboard mounted")
    loadFromLocalStorage()
    fetchHistory()
    fetchData()
  }, [])

  const loadFromLocalStorage = () => {
    try {
      const cached = localStorage.getItem("ccpi-data")
      if (cached) {
        const parsedData = JSON.parse(cached)
        console.log("[v0] CCPI: Loaded from localStorage", parsedData.cachedAt)
        setData(parsedData)
        const cacheAge = Date.now() - new Date(parsedData.cachedAt).getTime()
        const minutesOld = Math.floor(cacheAge / 60000)
        console.log(`[v0] CCPI: Cache is ${minutesOld} minutes old`)
      } else {
        console.log("[v0] CCPI: No cached data in localStorage")
        setError("No cached data available. Loading fresh data...")
      }
    } catch (error) {
      console.error("[v0] CCPI localStorage load error:", error)
      setError("Loading fresh data...")
    }
  }

  const fetchData = async () => {
    try {
      setIsRefreshing(true)
      if (!data) {
        setLoading(true)
      }
      setRefreshProgress(5)
      setRefreshStatus("Initializing CCPI calculation...")
      setError(null)

      // Simulate progress updates (in reality, the API would stream these)
      const progressInterval = setInterval(() => {
        setRefreshProgress((prev) => {
          if (prev >= 90) return prev
          return prev + Math.random() * 8
        })
        // Update status messages during fetch
        setRefreshStatus((prev) => {
          const messages = [
            "Fetching market data...",
            "Analyzing technical indicators...",
            "Computing sentiment metrics...",
            "Evaluating valuation signals...",
            "Processing macro indicators...",
            "Calculating CCPI score...",
          ]
          return messages[Math.floor(Math.random() * messages.length)]
        })
      }, 800)

      const response = await fetch("/api/ccpi")

      clearInterval(progressInterval)
      setRefreshProgress(100)
      setRefreshStatus("Complete!")

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      console.log("[v0] CCPI Data Loaded:", {
        ccpi: result.ccpi,
        certainty: result.certainty,
        regime: result.regime.name,
        pillars: result.pillars,
        activeCanaries: result.canaries.filter((c: any) => c.severity === "high" || c.severity === "medium").length,
        totalIndicators: 38,
      })
      console.log("[v0] Pillar Breakdown (weighted contribution to CCPI):")
      console.log("  Momentum:", result.pillars.momentum, "× 40% =", (result.pillars.momentum * 0.4).toFixed(1))
      console.log(
        "  Risk Appetite:",
        result.pillars.riskAppetite,
        "× 30% =",
        (result.pillars.riskAppetite * 0.3).toFixed(1),
      )
      console.log("  Valuation:", result.pillars.valuation, "× 20% =", (result.pillars.valuation * 0.2).toFixed(1))
      console.log("  Macro:", result.pillars.macro, "× 10% =", (result.pillars.macro * 0.1).toFixed(1))

      const calculatedCCPI =
        result.pillars.momentum * 0.4 +
        result.pillars.riskAppetite * 0.3 +
        result.pillars.valuation * 0.2 +
        result.pillars.macro * 0.1
      console.log("  Calculated CCPI:", calculatedCCPI.toFixed(1), "| API CCPI:", result.ccpi)

      const cachedData = {
        ...result,
        cachedAt: new Date().toISOString(),
      }

      setData(cachedData)

      try {
        localStorage.setItem("ccpi-data", JSON.stringify(cachedData))
        console.log("[v0] CCPI data saved to localStorage")
      } catch (storageError) {
        console.error("[v0] Failed to save to localStorage:", storageError)
      }

      try {
        await fetch("/api/ccpi/cache", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cachedData),
        })
        console.log("[v0] CCPI data cached to API")
      } catch (cacheError) {
        console.error("[v0] Failed to cache CCPI data:", cacheError)
        // Don't fail the whole operation if caching fails
      }

      await fetchExecutiveSummary(cachedData)
    } catch (error) {
      console.error("[v0] CCPI API error:", error)
      setError(error instanceof Error ? error.message : "Failed to load CCPI data")
    } finally {
      setIsRefreshing(false)
      setLoading(false) // Clear loading state
      setRefreshProgress(0)
      setRefreshStatus("")
    }
  }

  const fetchExecutiveSummary = async (ccpiData: CCPIData) => {
    try {
      setSummaryLoading(true)
      const response = await fetch("/api/ccpi/executive-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ccpi: ccpiData.ccpi,
          certainty: ccpiData.certainty,
          activeCanaries: ccpiData.canaries.filter((c) => c.severity === "high" || c.severity === "medium").length,
          totalIndicators: 38, // Removed problematic comment
          regime: ccpiData.regime,
          pillars: ccpiData.pillars,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setExecutiveSummary(result.summary)
        console.log("[v0] Grok executive summary generated:", result.summary)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch executive summary:", error)
      // Silently fail - we'll show the default summary
    } finally {
      setSummaryLoading(false)
    }
  }

  const fetchHistory = async () => {
    try {
      const response = await fetch("/api/ccpi/history")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      setHistory(result)
    } catch (error) {
      console.error("[v0] Failed to fetch CCPI history:", error)
    }
  }

  const sortCanaries = (canaries: CCPIData["canaries"]) => {
    return [...canaries].sort((a, b) => {
      // First sort by severity: high before medium before low
      if (a.severity === "high" && b.severity !== "high") return -1
      if (a.severity !== "high" && b.severity === "high") return 1
      if (a.severity === "medium" && b.severity === "low") return -1
      if (a.severity === "low" && b.severity === "medium") return 1

      // Within same severity, sort by impact score descending
      const impactA = a.impactScore ?? 0
      const impactB = b.impactScore ?? 0
      return impactB - impactA
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-gray-600">Loading CCPI data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="outline" onClick={fetchData} className="mt-4 bg-transparent">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!data) {
    return null // Should not happen if loading/error handled
  }

  const getRegimeColor = (level: number) => {
    if (level >= 80) return "bg-red-600"
    if (level >= 60) return "bg-orange-500"
    if (level >= 40) return "bg-yellow-500"
    if (level >= 20) return "bg-lime-500"
    return "bg-green-600"
  }

  const getRegimeZone = (ccpi: number) => {
    if (ccpi >= 80) return { color: "red", label: "CRASH WATCH" }
    if (ccpi >= 60) return { color: "orange", label: "HIGH ALERT" }
    if (ccpi >= 40) return { color: "yellow", label: "CAUTION" }
    if (ccpi >= 20) return { color: "lightgreen", label: "NORMAL" }
    return { color: "green", label: "LOW RISK" }
  }

  const getIndicatorStatus = (value: number, thresholds: { low: number; high: number; ideal?: number }) => {
    if (thresholds.ideal !== undefined) {
      const deviation = Math.abs(value - thresholds.ideal)
      if (deviation < 5) return { color: "bg-green-500", status: "Normal" }
      if (deviation < 15) return { color: "bg-yellow-500", status: "Elevated" }
      return { color: "bg-red-500", status: "Warning" }
    }
    if (value <= thresholds.low) return { color: "bg-green-500", status: "Low Risk" }
    if (value <= thresholds.high) return { color: "bg-yellow-500", status: "Moderate" }
    return { color: "bg-red-500", status: "High Risk" }
  }

  const pillarData = [
    { name: "Pillar 1 - Momentum & Technical", value: data.pillars.momentum, weight: "35%", icon: Activity },
    {
      name: "Pillar 2 - Risk Appetite & Volatility",
      value: data.pillars.riskAppetite,
      weight: "30%",
      icon: TrendingUp,
    },
    { name: "Pillar 3 - Valuation & Market Structure", value: data.pillars.valuation, weight: "15%", icon: DollarSign },
    { name: "Pillar 4 - Macro", value: data.pillars.macro, weight: "20%", icon: BarChart3 },
  ]

  const pillarChartData = pillarData.map((pillar, index) => ({
    name: `Pillar ${index + 1}`,
    fullName: pillar.name,
    value: pillar.value,
    weight: pillar.weight,
    icon: pillar.icon,
  }))

  const zone = getRegimeZone(data.ccpi)
  const ccpiScore = data.ccpi

  return (
    <TooltipProvider delayDuration={300}>
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-2">
          <div
            className="h-full bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 transition-all duration-300 ease-out"
            style={{ width: `${refreshProgress}%` }}
          />
        </div>
      )}

      {isRefreshing && refreshStatus && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 text-white px-6 py-3 rounded-full shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 animate-spin" />
            <span className="font-medium">{refreshStatus}</span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Comprehensive Crash Prediction Index (CCPI)</h2>
            <p className="text-muted-foreground">Real-time market crash risk assessment across 4 key dimensions</p>
            {data?.lastUpdated && (
              <p className="text-xs text-muted-foreground mt-1">
                Last updated: {new Date(data.lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tooltips</span>
              <button
                onClick={() => setTooltipsEnabled(!tooltipsEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  tooltipsEnabled ? "bg-blue-600" : "bg-gray-300"
                }`}
                aria-label="Toggle tooltips"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    tooltipsEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <RefreshButton onClick={fetchData} isLoading={isRefreshing} loadingText="Refreshing..." />
          </div>
        </div>

        {/* Original progress card removed as it's replaced by the fixed bar and status message */}

        {/* Main CCPI Score Card */}
        <Card className="border-2 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">CCPI: Crash & Correction Prediction Index</CardTitle>
                <CardDescription>AI-led market correction early warning oracle for options traders</CardDescription>
              </div>
              <Badge variant={zone.color === "red" ? "destructive" : "secondary"} className="text-lg px-4 py-2">
                {zone.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="pt-0">
                <div className="relative">
                  {/* Gradient bar */}
                  <div className="h-16 bg-gradient-to-r from-green-600 via-[20%] via-lime-500 via-[40%] via-yellow-500 via-[60%] via-orange-500 via-[80%] via-red-500 to-[100%] to-red-700 rounded-lg shadow-inner" />

                  {/* Zone labels */}
                  <div className="absolute inset-0 flex items-center justify-between px-4 text-white text-xs font-bold">
                    <div className="text-center">
                      <div>LOW</div>
                      <div>RISK</div>
                      <div className="text-[10px]">0-19</div>
                    </div>
                    <div className="text-center">
                      <div>NORMAL</div>
                      <div className="text-[10px]">20-39</div>
                    </div>
                    <div className="text-center text-gray-800">
                      <div>CAUTION</div>
                      <div className="text-[10px]">40-59</div>
                    </div>
                    <div className="text-center">
                      <div>HIGH</div>
                      <div>ALERT</div>
                      <div className="text-[10px]">60-79</div>
                    </div>
                    <div className="text-center">
                      <div>CRASH</div>
                      <div>WATCH</div>
                      <div className="text-[10px]">80-100</div>
                    </div>
                  </div>

                  {/* Pointer indicator */}
                  <div
                    className="absolute top-0 bottom-0 w-2 bg-black shadow-lg transition-all duration-500"
                    style={{ left: `calc(${ccpiScore}% - 4px)` }}
                  >
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <div className="bg-black text-white px-4 py-2 rounded-lg shadow-xl text-center">
                        <div className="text-xs font-semibold">TODAY</div>
                        <div className="text-2xl font-bold">{ccpiScore}</div>
                        <div className="text-xs">{zone.label}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">CCPI Score</p>
                <p className="text-5xl font-bold mb-2" style={{ color: getReadableColor(data.regime.color) }}>
                  {data.ccpi}
                </p>
                <p className="text-xs text-gray-500">0 = No risk, 100 = Imminent crash</p>
              </div>

              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Certainty Score</p>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-5xl font-bold text-blue-600">{data.certainty}%</p>
                  {/* CHANGE: Enhanced Certainty Score tooltip with clearer explanation */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-gray-400 hover:text-gray-600"></button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md p-3">
                        <p className="font-semibold mb-2">Certainty Score - How Confident Are We?</p>
                        <p className="text-sm leading-relaxed mb-2">
                          This score measures how confident we are in our crash prediction. Think of it like weather
                          forecasting - sometimes all the data points to rain (high certainty), other times the forecast
                          is less clear (low certainty).
                        </p>
                        <p className="text-sm leading-relaxed mb-2">
                          <strong>How It's Calculated:</strong>
                        </p>
                        <ul className="text-sm space-y-1 mb-2">
                          <li>
                            • <strong>70% weight:</strong> How much our 4 pillars agree with each other (when all
                            pillars point the same direction, we're more confident)
                          </li>
                          <li>
                            • <strong>30% weight:</strong> How many warning signals ("canaries") are triggered across
                            all indicators
                          </li>
                        </ul>
                        <p className="text-xs text-gray-600">
                          Current calculation:{" "}
                          {Math.round(
                            ((100 -
                              (Math.max(...Object.values(data.pillars)) - Math.min(...Object.values(data.pillars)))) /
                              100) *
                              70,
                          )}
                          % from pillar alignment +{" "}
                          {Math.round(
                            (data.canaries.filter((c) => c.severity === "high" || c.severity === "medium").length /
                              15) *
                              30,
                          )}
                          % from active warnings
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xs text-gray-500">Signal consistency & alignment</p>
              </div>

              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Current Regime</p>
                <p className="text-2xl font-bold mb-1" style={{ color: getReadableColor(data.regime.color) }}>
                  {data.regime.name}
                </p>
                <p className="text-xs text-gray-600 px-2">{data.regime.description}</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-base text-blue-900 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  Weekly Output - Executive Summary
                </h4>
                {summaryLoading && <Activity className="h-4 w-4 animate-spin text-blue-600" />}
              </div>

              {/* AI-Generated Executive Summary */}
              {executiveSummary ? (
                <div className="mb-4 p-4 bg-white rounded-lg border border-blue-200 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                      <span className="text-white font-bold text-xs">AI</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 leading-relaxed">{executiveSummary}</p>
                      <p className="text-xs text-gray-500 mt-2 italic">Generated by Grok xAI - grok-2-latest</p>
                    </div>
                  </div>
                </div>
              ) : (
                summaryLoading && (
                  <div className="mb-4 p-4 bg-white rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-600 italic">Generating AI executive summary...</p>
                  </div>
                )
              )}

              {/* Original Summary */}
              <div className="space-y-2">
                <ul className="space-y-1">{data.summary.bullets.map((bullet, i) => null)}</ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {data.totalBonus && data.totalBonus > 0 && (
          <Card className="border-2 border-red-600 bg-gradient-to-r from-red-50 to-orange-50 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-900">
                <AlertTriangle className="h-6 w-6 text-red-600 animate-pulse" />🚨 CRASH AMPLIFIERS ACTIVE +
                {data.totalBonus} BONUS POINTS
              </CardTitle>
              <CardDescription className="text-red-700 font-medium">
                Multiple extreme crash signals detected - CCPI boosted from {data.baseCCPI} to {data.ccpi}
                <span className="block mt-1 text-xs text-red-600">
                  Last updated: {new Date(data.cachedAt || data.timestamp).toLocaleString()}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.crashAmplifiers?.map((amp, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border-2 border-red-300"
                  >
                    <span className="text-sm font-semibold text-red-900">{amp.reason}</span>
                    <Badge className="bg-red-600 text-white text-base font-bold">+{amp.points}</Badge>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-red-100 border-2 border-red-400 rounded-lg">
                <p className="text-sm text-red-900 font-bold">
                  ⚠️ CRASH AMPLIFIERS = Short-term (1-14 day) indicators that trigger 10%+ corrections. These are
                  automatically recalculated on every page load to ensure real-time accuracy. Maximum bonus capped at
                  +100 points to prevent over-signaling.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-red-50">
          <CardHeader>
            {/* Added tooltip to Canaries section header */}
            <CardTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Canaries in the Coal Mine - Active Warning Signals
                {/* CHANGE: Enhanced Canaries section tooltip */}
                {tooltipsEnabled && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent
                      className={`max-w-md ${data.canaries.length > 0 && data.canaries.some((c) => c.severity === "high") ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}
                    >
                      <p className="font-semibold mb-2">Early Warning System - What Are "Canaries"?</p>
                      <p className="text-sm mb-2">
                        Historically, coal miners brought canaries into mines because these birds would show signs of
                        distress before dangerous gases reached toxic levels for humans. Similarly, these market
                        indicators give us early warning signs before a potential crash.
                      </p>
                      <p className="text-sm mb-2">
                        Each warning appears when a specific market indicator crosses a dangerous threshold - like when
                        market valuations get extremely high, volatility spikes dramatically, or investor sentiment
                        becomes too one-sided.
                      </p>
                      <ul className="text-sm mt-2 space-y-2">
                        <li>
                          <strong className="text-red-600">High Risk (Red):</strong> Critical danger zone - this
                          indicator has reached levels historically associated with market crashes. Immediate attention
                          recommended.
                        </li>
                        <li>
                          <strong className="text-yellow-600">Medium Risk (Yellow):</strong> Warning zone - this
                          indicator is showing concerning signs but hasn't reached critical levels yet. Increased
                          caution advised.
                        </li>
                      </ul>
                      <p className="text-xs mt-2 text-gray-600">
                        We monitor {data.canaries.length} total warning signals across all of the market indicators.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <span className="text-2xl font-bold text-red-600">
                {data.canaries.filter((canary) => canary.severity === "high" || canary.severity === "medium").length}/
                {data.totalIndicators || 38}
              </span>
            </CardTitle>
            <CardDescription>
              Executive summary of medium and high severity red flags across all indicators
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {sortCanaries(data.canaries)
                .filter((canary) => canary.severity === "high" || canary.severity === "medium")
                .map((canary, i) => {
                  const severityConfig = {
                    high: {
                      bgColor: "bg-red-100",
                      textColor: "text-red-900",
                      borderColor: "border-red-400",
                      badgeColor: "bg-red-600 text-white",
                      label: "HIGH RISK",
                    },
                    medium: {
                      bgColor: "bg-yellow-100",
                      textColor: "text-yellow-900",
                      borderColor: "border-yellow-400",
                      badgeColor: "bg-yellow-600 text-white",
                      label: "MEDIUM RISK",
                    },
                  }[canary.severity]

                  return (
                    <div
                      key={i}
                      className={`flex-1 min-w-[280px] p-4 rounded-lg border-2 ${severityConfig.bgColor} ${severityConfig.borderColor}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant="outline" className="text-xs font-semibold">
                          {canary.pillar}
                        </Badge>
                        <div className="flex items-center gap-2">
                          {canary.impactScore !== undefined && (
                            <span className="text-xs font-mono text-muted-foreground">
                              Impact: {canary.impactScore.toFixed(2)}
                            </span>
                          )}
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-md ${severityConfig.badgeColor} shadow-sm whitespace-nowrap`}
                          >
                            {severityConfig.label}
                          </span>
                        </div>
                      </div>
                      {/* CHANGE: Enhanced individual canary card tooltips */}
                      <div className="flex items-start gap-2">
                        <p className={`text-sm font-semibold ${severityConfig.textColor} flex-1`}>{canary.signal}</p>
                        {tooltipsEnabled &&
                          (() => {
                            const explanation = getIndicatorExplanation(canary.signal)
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-4 w-4 text-muted-foreground cursor-help flex-shrink-0 mt-0.5" />
                                </TooltipTrigger>
                                <TooltipContent
                                  className={`max-w-lg ${canary.severity === "high" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}
                                >
                                  <p className="font-semibold mb-3 text-base">{canary.signal}</p>

                                  <div className="space-y-3 text-sm">
                                    <div>
                                      <p className="font-semibold mb-1">What This Measures:</p>
                                      <p className="text-muted-foreground leading-relaxed">{explanation.what}</p>
                                    </div>

                                    <div>
                                      <p className="font-semibold mb-1">Why This Matters:</p>
                                      <p className="text-muted-foreground leading-relaxed">{explanation.impact}</p>
                                    </div>

                                    {canary.impactScore !== undefined && (
                                      <div className="bg-white/60 p-3 rounded-md border border-gray-200 mt-3">
                                        <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-gray-600">
                                          Impact on CCPI Score
                                        </p>
                                        <div className="space-y-1 text-xs">
                                          <p className="flex justify-between">
                                            <span className="text-muted-foreground">Indicator Weight:</span>
                                            <span className="font-mono font-semibold">
                                              {canary.indicatorWeight}/100 points
                                            </span>
                                          </p>
                                          <p className="flex justify-between">
                                            <span className="text-muted-foreground">Pillar Weight:</span>
                                            <span className="font-mono font-semibold">{canary.pillarWeight}%</span>
                                          </p>
                                          <div className="border-t border-gray-200 mt-2 pt-2">
                                            <p className="flex justify-between font-semibold">
                                              <span>Total Impact:</span>
                                              <span className="font-mono text-base">
                                                {canary.impactScore.toFixed(2)} pts
                                              </span>
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )
                          })()}
                      </div>
                    </div>
                  )
                })}
            </div>
            {data.canaries.filter((c) => c.severity === "high" || c.severity === "medium").length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-green-700 font-medium">No medium or high severity warnings detected</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Four Pillars - Collapsible Breakdown */}
        <Accordion type="multiple" defaultValue={[]} className="space-y-4 pb-6">
          {/* Pillar 1 - Momentum & Technical */}
          <AccordionItem value="pillar1" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-10">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-cyan-600" />
                  <span className="text-lg font-semibold">Pillar 1 - Momentum & Technical</span>
                  {/* CHANGE: Updated from 16 to 12 indicators after removing duplicates (ATR, LTV, Bullish Percent, Yield Curve) */}
                  <span className="text-sm text-gray-600">Weight: 35% | 12 indicators</span>
                </div>
                <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.momentum)}/100</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6 pt-4">
                {/* NVIDIA Momentum Score */}
                {data.indicators?.nvidiaMomentum !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        NVIDIA Momentum Score (AI Bellwether)
                        {/* CHANGE: Enhanced NVIDIA Momentum tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">NVIDIA Momentum Score - The AI Sector Bellwether</p>
                              <p className="text-sm mb-2">
                                NVIDIA has become the most important indicator of AI and technology sector health. As
                                the leading AI chip maker, NVIDIA's stock performance often predicts broader tech market
                                movements.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> This score combines NVIDIA's recent price trend with
                                trading volume and relative strength compared to the overall market. Higher scores mean
                                strong momentum (bullish), lower scores mean weakening momentum (bearish).
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Above 80:</strong> NVIDIA is in a strong uptrend - tech sector is healthy,
                                  lower crash risk
                                </li>
                                <li>
                                  • <strong>40-60:</strong> Neutral momentum - tech sector is treading water, moderate
                                  risk
                                </li>
                                <li>
                                  • <strong>Below 20:</strong> NVIDIA is falling - tech sector weakness often leads to
                                  broader market selloffs
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Real-time price data from major stock exchanges, analyzed
                                using technical momentum indicators.
                              </p>
                              <p className="text-xs text-gray-600">
                                Why it matters: NVIDIA's market cap exceeds $3 trillion, making it one of the largest
                                companies in the world. When it falls, it can drag down entire indexes.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">
                        ${data.indicators.nvidiaPrice?.toFixed(0) ?? "N/A"} | {data.indicators.nvidiaMomentum}/100
                      </span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${data.indicators.nvidiaMomentum !== undefined ? Math.min(100, Math.max(0, (data.indicators.nvidiaMomentum / 100) * 100)) : 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Strong: {">"}80</span>
                      <span>Neutral: 40-60</span>
                      <span>Falling: {"<"}20 (Tech crash risk)</span>
                    </div>
                  </div>
                )}

                {/* SOX Semiconductor Index */}
                {data.indicators?.soxIndex !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        SOX Semiconductor Index (Chip Sector Health)
                        {/* CHANGE: Enhanced SOX Index tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">SOX Semiconductor Index - Chip Sector Health Check</p>
                              <p className="text-sm mb-2">
                                The SOX (PHLX Semiconductor Index) tracks 30 of the largest semiconductor companies.
                                Think of semiconductors as the building blocks of all modern technology - they're in
                                everything from smartphones to cars to data centers.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> The combined stock price performance of major chip
                                makers including NVIDIA, AMD, Intel, Taiwan Semiconductor, and others. This index is
                                often called a "leading indicator" because chip demand tends to slow before broader
                                economic slowdowns.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Above 5500:</strong> Chip sector is strong - healthy tech ecosystem, low
                                  crash risk
                                </li>
                                <li>
                                  • <strong>Around 5000 (baseline):</strong> Normal levels - tech sector is stable
                                </li>
                                <li>
                                  • <strong>Below 4500:</strong> Chip sector weakness - may signal broader tech and
                                  economic problems ahead
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Philadelphia Stock Exchange (PHLX), updated daily based on
                                trading prices of semiconductor stocks.
                              </p>
                              <p className="text-xs text-gray-600">
                                Historical note: The SOX Index often peaks 6-12 months before major market corrections,
                                making it an important early warning indicator.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.soxIndex.toFixed(0)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${100 - Math.min(100, Math.max(0, ((data.indicators.soxIndex - 4000) / 2000) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Strong: {">"}5500</span>
                      <span>Baseline: 5000</span>
                      <span>Weak: {"<"}4500</span>
                    </div>
                  </div>
                )}

                {/* QQQ Daily Return */}
                {data.indicators?.qqqDailyReturn !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to QQQ Daily Return indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        QQQ Daily Return (5× downside amplifier)
                        {/* CHANGE: Enhanced QQQ Daily Return tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">QQQ Daily Return - Tech Sector Daily Performance</p>
                              <p className="text-sm mb-2">
                                QQQ is an ETF (Exchange Traded Fund) that tracks the Nasdaq-100 Index - the 100 largest
                                non-financial companies on the Nasdaq stock exchange. This includes major tech companies
                                like Apple, Microsoft, Amazon, Google, and Meta (Facebook).
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> The percentage change in QQQ's price from yesterday's
                                close to today's close. It tells us whether big tech stocks went up or down today, and
                                by how much.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>The 5× Downside Amplifier:</strong> We give extra weight to negative days
                                because research shows markets fall faster than they rise. A -2% day gets treated as
                                more significant than a +2% day in our crash calculations.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Above +1%:</strong> Tech stocks are rallying - bullish momentum, lower crash
                                  risk
                                </li>
                                <li>
                                  • <strong>-1% to +1%:</strong> Normal daily fluctuation - neutral market conditions
                                </li>
                                <li>
                                  • <strong>Below -1%:</strong> Tech stocks are selling off - bearish pressure,
                                  increased crash risk
                                </li>
                                <li>
                                  • <strong>Below -3%:</strong> Sharp selloff - panic selling may be beginning
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Real-time pricing from Nasdaq stock exchange, updated
                                every trading day.
                              </p>
                              <p className="text-xs text-gray-600">
                                Why it matters: The Nasdaq-100 represents about 40% of the total U.S. stock market
                                value, so its daily moves significantly impact the overall market.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span
                        className={`font-bold ${Number.parseFloat(data.indicators.qqqDailyReturn) > 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {data.indicators.qqqDailyReturn}
                      </span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, ((Number.parseFloat(data.indicators.qqqDailyReturn) + 2) / 4) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Down: {"<"}-1%</span>
                      <span className="text-yellow-600">Flat: -1% to +1%</span>
                      <span>Up: {">"} +1%</span>
                    </div>
                  </div>
                )}

                {/* QQQ Consecutive Down Days */}
                {data.indicators?.qqqConsecDown !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to QQQ Consecutive Down Days indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        QQQ Consecutive Down Days
                        {/* CHANGE: Enhanced QQQ Consecutive Down Days tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">QQQ Consecutive Down Days - Losing Streak Tracker</p>
                              <p className="text-sm mb-2">
                                This indicator counts how many trading days in a row the QQQ (Nasdaq-100 tech stocks)
                                has closed lower than the previous day. Think of it like a sports team's losing streak -
                                the longer it goes, the more concerning it becomes.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> Simply the number of consecutive days where QQQ's
                                closing price was lower than the day before. It resets to zero whenever QQQ has an up
                                day.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Why Consecutive Losses Matter:</strong> Markets typically bounce back and forth
                                between up and down days. When we see multiple consecutive down days, it suggests
                                persistent selling pressure rather than normal volatility. This pattern often precedes
                                larger market declines.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>0-1 days:</strong> Healthy market - normal buying and selling balance
                                </li>
                                <li>
                                  • <strong>2-3 days:</strong> Warning sign - sellers are gaining control, watch closely
                                </li>
                                <li>
                                  • <strong>4+ days:</strong> Danger zone - sustained selling pressure often leads to
                                  accelerated declines
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Daily closing prices from Nasdaq exchange, tracked
                                continuously.
                              </p>
                              <p className="text-xs text-gray-600">
                                Historical pattern: Markets crashes often feature 5-7+ consecutive down days as panic
                                selling takes hold. The 2020 COVID crash had 6 consecutive down days, and the 2008
                                financial crisis had multiple 5-7 day losing streaks.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.qqqConsecDown} days</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.qqqConsecDown / 5) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Healthy: 0-1 days</span>
                      <span>Warning: 2-3 days</span>
                      <span>Danger: 4+ days</span>
                    </div>
                  </div>
                )}

                {/* Below SMA20 */}
                {data.indicators?.qqqBelowSMA20 !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to QQQ Below 20-Day SMA indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        QQQ Below 20-Day SMA
                        {/* CHANGE: Add tooltips for QQQ Below SMAs - these appear to be missing */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">QQQ Below 20-Day SMA - Short-Term Trend</p>
                              <p className="text-sm mb-2">
                                SMA stands for "Simple Moving Average" - it's the average closing price over the last 20
                                trading days (about one month). Think of it like a smoothed-out trend line that filters
                                out daily noise to show the short-term direction.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> Whether today's QQQ price is above or below its
                                20-day average price. Traders use this to identify whether the short-term trend is up
                                (price above average) or down (price below average).
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>0% (far above):</strong> QQQ is trading well above its 20-day average -
                                  strong short-term uptrend
                                </li>
                                <li>
                                  • <strong>~50%:</strong> QQQ is near its 20-day average - neutral, no clear short-term
                                  trend
                                </li>
                                <li>
                                  • <strong>100% (breached):</strong> QQQ has dropped below its 20-day average -
                                  short-term downtrend developing, increased crash risk
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Calculation:</strong> Add up the closing prices from the last 20 trading days,
                                divide by 20. Compare today's price to this average.
                              </p>
                              <p className="text-xs text-gray-600">
                                Trading signal: When price crosses below the 20-day SMA, many traders interpret this as
                                a "sell" signal, which can create self-fulfilling selling pressure.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {data.indicators?.qqqSMA20Proximity !== undefined && (
                          <span className="text-xs font-semibold text-orange-600">
                            {data.indicators.qqqSMA20Proximity.toFixed(0)}% proximity
                          </span>
                        )}
                        <span
                          className={`font-bold ${data.indicators.qqqBelowSMA20 ? "text-red-600" : "text-green-600"}`}
                        >
                          {data.indicators.qqqBelowSMA20 ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${data.indicators?.qqqSMA20Proximity || 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Safe: 0% (far above)</span>
                      <span>Warning: 50%</span>
                      <span>Danger: 100% (breached)</span>
                    </div>
                  </div>
                )}

                {/* Below SMA50 */}
                {data.indicators?.qqqBelowSMA50 !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to QQQ Below 50-Day SMA indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        QQQ Below 50-Day SMA
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">QQQ Below 50-Day SMA - Medium-Term Trend</p>
                              <p className="text-sm mb-2">
                                The 50-day SMA is a key medium-term trend indicator watched by institutional investors.
                                It represents the average price over the last 10 weeks (roughly 2.5 months).
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> Whether QQQ's price is currently trading above or
                                below its 50-day moving average. A break below this level is a significant bearish
                                signal.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Above SMA50:</strong> Healthy medium-term uptrend, low risk
                                </li>
                                <li>
                                  • <strong>~50% proximity:</strong> Testing critical support, moderate risk
                                </li>
                                <li>
                                  • <strong>Below SMA50 (100% breached):</strong> Broken support, major bearish signal,
                                  high crash risk
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Calculated from 50 days of closing prices for QQQ.
                              </p>
                              <p className="text-xs text-gray-600">
                                Institutional Significance: Many large funds use the 50-day SMA as a benchmark for trend
                                following. Breaking below it can trigger significant selling pressure from these
                                entities.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {data.indicators?.qqqSMA50Proximity !== undefined && (
                          <span className="text-xs font-semibold text-orange-600">
                            {data.indicators.qqqSMA50Proximity.toFixed(0)}% proximity
                          </span>
                        )}
                        <span
                          className={`font-bold ${data.indicators.qqqBelowSMA50 ? "text-red-600" : "text-green-600"}`}
                        >
                          {data.indicators.qqqBelowSMA50 ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${data.indicators?.qqqSMA50Proximity || 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Safe: 0% (far above)</span>
                      <span>Warning: 50%</span>
                      <span>Danger: 100% (breached)</span>
                    </div>
                  </div>
                )}

                {/* Below SMA200 */}
                {data.indicators?.qqqBelowSMA200 !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to QQQ Below 200-Day SMA indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        QQQ Below 200-Day SMA
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">QQQ Below 200-Day SMA - Long-Term Trend</p>
                              <p className="text-sm mb-2">
                                The 200-day SMA is the most critical long-term technical indicator, representing the
                                average price over the last 40 weeks (about 9 months). A break below this level signals
                                a major shift from a bull market to a bear market.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> Whether QQQ's price is trading above or below its
                                200-day moving average. This is the ultimate test of the long-term trend's health.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Above SMA200:</strong> Confirmed bull market, low crash risk
                                </li>
                                <li>
                                  • <strong>~50% proximity:</strong> Testing major support, high risk
                                </li>
                                <li>
                                  • <strong>Below SMA200 (100% breached):</strong> Bear market confirmed, very high
                                  crash risk
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Calculated from 200 days of closing prices for QQQ.
                              </p>
                              <p className="text-xs text-gray-600">
                                Historically: The 200-day SMA has acted as a major support/resistance level in all major
                                market cycles. Breaking below it has consistently marked the beginning of significant
                                bear markets and precedes major crashes.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {data.indicators?.qqqSMA200Proximity !== undefined && (
                          <span className="text-xs font-semibold text-orange-600">
                            {data.indicators.qqqSMA200Proximity.toFixed(0)}% proximity
                          </span>
                        )}
                        <span
                          className={`font-bold ${data.indicators.qqqBelowSMA200 ? "text-red-600" : "text-green-600"}`}
                        >
                          {data.indicators.qqqBelowSMA200 ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${data.indicators?.qqqSMA200Proximity || 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Safe: 0% (far above)</span>
                      <span>Warning: 50%</span>
                      <span>Danger: 100% (breached)</span>
                    </div>
                  </div>
                )}

                {/* Below Bollinger Band (Lower) */}
                {data.indicators?.qqqBelowBollinger !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to QQQ Below Bollinger Band indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        QQQ Below Bollinger Band (Lower) - Oversold Signal
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">QQQ Below Bollinger Band (Lower) - Oversold Signal</p>
                              <p className="text-sm mb-2">
                                Bollinger Bands are volatility indicators. The lower band represents a price level two
                                standard deviations below the 20-day moving average. When QQQ falls below this band, it
                                signals that the price is unusually low and the market may be oversold.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> Whether QQQ's current price is below the lower
                                Bollinger Band.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>0% (far above):</strong> Normal trading range, low risk
                                </li>
                                <li>
                                  • <strong>~50% proximity:</strong> Approaching oversold territory, moderate risk
                                </li>
                                <li>
                                  • <strong>100% (breached):</strong> Significantly oversold, high crash risk signal
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Calculation:</strong> Lower Band = 20-Day SMA - (2 * 20-Day Standard Deviation).
                              </p>
                              <p className="text-xs text-gray-600">
                                Trading implication: While touching or slightly breaking the lower band can signal
                                buying opportunities, a significant sustained break below it often precedes sharp
                                downward moves as panic selling takes hold.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {data.indicators?.qqqBollingerProximity !== undefined && (
                          <span className="text-xs font-semibold text-orange-600">
                            {data.indicators.qqqBollingerProximity.toFixed(0)}% proximity
                          </span>
                        )}
                        <span
                          className={`font-bold ${data.indicators.qqqBelowBollinger ? "text-red-600" : "text-green-600"}`}
                        >
                          {data.indicators.qqqBelowBollinger ? "YES - OVERSOLD" : "NO"}
                        </span>
                      </div>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${data.indicators?.qqqBollingerProximity || 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Safe: 0% (at middle band)</span>
                      <span>Warning: 50%</span>
                      <span>Oversold: 100% (breached)</span>
                    </div>
                  </div>
                )}

                {/* Death Cross */}
                {data.indicators?.qqqDeathCross !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        QQQ Death Cross (SMA50 {"<"} SMA200)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-red-50 border-red-200">
                              <p className="font-semibold mb-2">Death Cross - Major Bearish Signal</p>
                              <p className="text-sm mb-2">
                                A "Death Cross" occurs when the 50-day moving average (medium-term trend) crosses BELOW
                                the 200-day moving average (long-term trend). This is a widely watched bearish signal
                                that historically precedes major market declines.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> The crossover point between the 50-day SMA and the
                                200-day SMA for QQQ.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>NO (Golden Cross):</strong> 50-day SMA is above 200-day SMA - bullish
                                  long-term trend, low crash risk
                                </li>
                                <li>
                                  • <strong>YES (Death Cross):</strong> 50-day SMA is below 200-day SMA - bearish
                                  long-term trend, high crash risk
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Daily closing prices for QQQ, used to calculate 50-day and
                                200-day SMAs.
                              </p>
                              <p className="text-xs text-gray-600">
                                Major death crosses for the S&P 500 occurred in 1974, 2000, 2007, 2020, and 2022,
                                preceding significant bear markets and crashes.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span
                        className={`font-bold ${data.indicators.qqqDeathCross ? "text-red-600" : "text-green-600"}`}
                      >
                        {data.indicators.qqqDeathCross ? "YES - DANGER" : "NO"}
                      </span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: data.indicators.qqqDeathCross ? "100%" : "0%",
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Golden Cross: Bullish</span>
                      <span>Death Cross: Bearish</span>
                    </div>
                  </div>
                )}

                {/* VIX */}
                {data.indicators.vix !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        VIX (Fear Gauge)
                        {/* CHANGE: Enhanced VIX tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">VIX - The "Fear Gauge" of the Stock Market</p>
                              <p className="text-sm mb-2">
                                The VIX (Volatility Index) is often called the market's "fear gauge." It doesn't measure
                                whether stocks are going up or down - it measures how much investors expect stocks to
                                swing around in the next 30 days.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> The VIX is calculated from S&P 500 options prices.
                                When investors are nervous and buy lots of insurance (put options) against market drops,
                                the VIX goes up. When investors are calm and confident, the VIX stays low.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Below 15:</strong> Market is calm - investors are complacent, low volatility
                                  (but can signal danger if TOO calm)
                                </li>
                                <li>
                                  • <strong>15-25:</strong> Normal volatility - healthy market fluctuations
                                </li>
                                <li>
                                  • <strong>Above 25:</strong> Fear is rising - investors are worried about potential
                                  losses
                                </li>
                                <li>
                                  • <strong>Above 40:</strong> Panic mode - extreme fear, crashes often occur at these
                                  levels
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Calculated by the Chicago Board Options Exchange (CBOE)
                                using real-time options prices on the S&P 500 index, updated every 15 seconds during
                                market hours.
                              </p>
                              <p className="text-xs text-gray-600">
                                Historical spikes: 2008 Financial Crisis (VIX hit 80), 2020 COVID Crash (VIX hit 82),
                                2022 Ukraine War (VIX hit 36).
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.vix.toFixed(1)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.vix / 50) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Calm: {"<"}15</span>
                      <span className="text-yellow-600">Elevated: 15-25</span>
                      <span>Fear: {">"}25</span>
                    </div>
                  </div>
                )}

                {/* VXN */}
                {data.indicators.vxn !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        VXN (Nasdaq Volatility)
                        {/* CHANGE: Enhanced VXN tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">VXN - Nasdaq Volatility (Tech Fear Gauge)</p>
                              <p className="text-sm mb-2">
                                VXN is like the VIX, but specifically for the Nasdaq-100 tech stocks instead of the
                                broader S&P 500. Since tech stocks tend to be more volatile than the overall market, VXN
                                helps us measure fear specifically in the technology sector.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> Expected volatility (price swings) in Nasdaq-100
                                stocks over the next 30 days, calculated from options prices on the QQQ ETF. Higher VXN
                                means traders expect bigger tech stock price movements.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Why Tech Volatility Matters:</strong> Technology companies often fall harder and
                                faster than other sectors during market crashes because they typically have higher
                                valuations and are seen as riskier investments.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Below 15:</strong> Tech sector is calm - low volatility, stable conditions
                                </li>
                                <li>
                                  • <strong>15-25:</strong> Normal tech volatility - healthy fluctuation range
                                </li>
                                <li>
                                  • <strong>Above 35:</strong> Tech sector panic - elevated fear, increased crash risk
                                  for tech stocks
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Chicago Board Options Exchange (CBOE), calculated from
                                Nasdaq-100 options prices.
                              </p>
                              <p className="text-xs text-gray-600">
                                VXN tends to spike higher than VIX during tech selloffs, making it an early warning
                                system for tech-led market crashes.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.vxn.toFixed(1)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.vxn / 50) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Calm: {"<"}15</span>
                      <span className="text-yellow-600">Elevated: 15-25</span>
                      <span>Panic: {">"}35</span>
                    </div>
                  </div>
                )}

                {/* RVX */}
                {data.indicators.rvx !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        RVX (Russell 2000 Volatility)
                        {/* CHANGE: Enhanced RVX tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">RVX - Russell 2000 Volatility (Small Cap Fear)</p>
                              <p className="text-sm mb-2">
                                RVX measures expected volatility in the Russell 2000 Index, which tracks 2,000 small
                                American companies. Small companies are often more vulnerable during economic downturns,
                                so RVX can be an early warning signal.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> Expected 30-day price swings in small-cap stocks,
                                calculated from Russell 2000 ETF (IWM) options prices. Small companies tend to be more
                                volatile than large companies, so RVX is typically higher than VIX.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Why Small Caps Matter:</strong> Small companies are often the "canary in the
                                coal mine" - they struggle first during economic slowdowns because they have less cash,
                                less pricing power, and more debt relative to their size.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Below 18:</strong> Small caps are stable - healthy economic conditions
                                </li>
                                <li>
                                  • <strong>18-25:</strong> Normal small-cap volatility - standard risk levels
                                </li>
                                <li>
                                  • <strong>Above 30:</strong> Small caps are in trouble - economic stress, increased
                                  crash risk
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Chicago Board Options Exchange (CBOE), derived from
                                Russell 2000 options.
                              </p>
                              <p className="text-xs text-gray-600">
                                Leading indicator: RVX often spikes before VIX during the early stages of market
                                selloffs, as smart money sells risky small caps first.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.rvx.toFixed(1)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.rvx / 50) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Low: {"<"}18</span>
                      <span className="text-yellow-600">Normal: 18-25</span>
                      <span>High: {">"}30</span>
                    </div>
                  </div>
                )}

                {/* VIX Term Structure */}
                {data.indicators.vixTermStructure !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        VIX Term Structure (Spot/1M)
                        {/* CHANGE: Enhanced VIX Term Structure tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">VIX Term Structure - Fear Now vs. Fear Later</p>
                              <p className="text-sm mb-2">
                                This indicator compares today's VIX (spot VIX - fear right now) to VIX futures one month
                                out. It tells us whether traders think volatility will increase or decrease over the
                                next month.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> The ratio of current VIX to 1-month VIX futures. When
                                spot VIX is higher than futures (ratio above 1.0), the market structure is "inverted" -
                                a warning sign called "backwardation."
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Understanding Backwardation:</strong> Normally, traders expect volatility to be
                                higher in the future than today, so VIX futures trade above spot VIX (ratio below 1.0).
                                But during market stress, fear spikes so high RIGHT NOW that it exceeds future
                                expectations - this is backwardation, and it's dangerous.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Below 1.0 (Contango):</strong> Normal market structure - today's fear is
                                  lower than expected future fear. Safe.
                                </li>
                                <li>
                                  • <strong>1.0-1.2 (Slight Backwardation):</strong> Market stress building - fear is
                                  elevated but manageable
                                </li>
                                <li>
                                  • <strong>Above 1.2 (Deep Backwardation):</strong> Market panic - immediate fear
                                  dominates, crash conditions forming
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> CBOE spot VIX and VIX futures contracts, updated
                                continuously during trading.
                              </p>
                              <p className="text-xs text-gray-600">
                                Crisis signal: During the 2008 crash and 2020 COVID crash, VIX term structure went into
                                deep backwardation (ratios above 1.5) as panic set in.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.vixTermStructure.toFixed(2)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, ((2.0 - data.indicators.vixTermStructure) / 1.5) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Contango: {">"}1.5 (Safe)</span>
                      <span className="text-yellow-600">Normal: 1.0-1.2</span>
                      <span className="text-red-600">Backwardation: {"<"}1.0 (FEAR)</span>
                    </div>
                  </div>
                )}

                {/* ATR - Average True Range */}
                {data.indicators.atr !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        ATR - Average True Range
                        {/* CHANGE: Enhanced ATR tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">ATR - Average True Range (Daily Price Swings)</p>
                              <p className="text-sm mb-2">
                                ATR measures how much the market typically moves up and down each day. It's like
                                measuring the waves in the ocean - bigger waves (higher ATR) mean rougher seas (more
                                volatility).
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> The average of daily price ranges over the past 14
                                trading days. It calculates the difference between each day's high and low price, then
                                averages those differences. Expressed as a dollar amount or points.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Why Daily Swings Matter:</strong> When markets start swinging wildly (high ATR),
                                it indicates uncertainty and fear. Professional traders use ATR to set stop-losses and
                                position sizes - they trade smaller when ATR is high because risk is elevated.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Below 25:</strong> Low volatility - calm, stable market with small daily
                                  swings
                                </li>
                                <li>
                                  • <strong>25-40:</strong> Normal volatility - typical market fluctuations
                                </li>
                                <li>
                                  • <strong>Above 50:</strong> High volatility - large daily swings indicate stress and
                                  uncertainty
                                </li>
                                <li>
                                  • <strong>Above 70:</strong> Extreme volatility - panic-level price swings, crash
                                  conditions
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Calculation Example:</strong> If SPY ranged from $500 low to $510 high (10-point
                                range) for 14 days straight, ATR would be 10. But if it then has a day with a $500-$530
                                range (30 points), ATR would start increasing, signaling rising volatility.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Calculated from daily high, low, and close prices from
                                stock exchanges.
                              </p>
                              <p className="text-xs text-gray-600">
                                Professional use: Traders multiply ATR by 2-3 to set stop-loss levels. If ATR is $10,
                                they might risk $20-30 per share, knowing that's typical volatility.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.atr.toFixed(1)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.atr / 60) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Low Vol: {"<"}25</span>
                      <span className="text-yellow-600">Normal: 25-40</span>
                      <span>High Vol: {">"}50</span>
                    </div>
                  </div>
                )}

                {/* LTV - Long-term Volatility */}
                {data.indicators.ltv !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        LTV - Long-term Volatility
                        {/* CHANGE: Enhanced LTV tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">
                                LTV - Long-Term Volatility (90-Day Price Variability)
                              </p>
                              <p className="text-sm mb-2">
                                While ATR measures short-term (14-day) volatility, LTV looks at longer-term (90-day)
                                volatility patterns. It's like zooming out from daily waves to see the overall sea
                                conditions over three months.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> The standard deviation of daily returns over the past
                                90 trading days, expressed as an annualized percentage. This statistical measure shows
                                how much prices have been bouncing around over the last quarter.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Understanding Standard Deviation:</strong> Imagine if the average daily return
                                is 0%, standard deviation tells us how far from 0% prices typically swing. Higher
                                standard deviation = more unpredictable, wider price swings.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Below 10%:</strong> Very stable market - prices are predictable, low crash
                                  risk
                                </li>
                                <li>
                                  • <strong>10-15%:</strong> Normal volatility - healthy market fluctuations
                                </li>
                                <li>
                                  • <strong>15-20%:</strong> Elevated volatility - market is getting choppy, increased
                                  uncertainty
                                </li>
                                <li>
                                  • <strong>Above 20%:</strong> High long-term volatility - sustained market stress,
                                  elevated crash risk
                                </li>
                                <li>
                                  • <strong>Above 30%:</strong> Extreme long-term volatility - prolonged crisis
                                  conditions
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Why 90 Days Matters:</strong> Short-term volatility spikes can be temporary
                                reactions to news. But when volatility stays elevated for 90 days, it suggests
                                fundamental market problems that won't go away quickly.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Calculation:</strong> Take daily returns for 90 days, calculate standard
                                deviation, annualize it by multiplying by √252 (trading days in a year).
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Calculated from 90 days of closing prices from stock
                                exchanges.
                              </p>
                              <p className="text-xs text-gray-600">
                                Historical context: LTV stayed above 25% for months during 2008-2009 financial crisis
                                and March-June 2020 COVID crash, signaling prolonged market distress.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{(data.indicators.ltv * 100).toFixed(1)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.ltv / 0.3) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Stable: {"<"}10%</span>
                      <span className="text-yellow-600">Normal: 10-15%</span>
                      <span>Elevated: {">"}20%</span>
                    </div>
                  </div>
                )}

                {/* Bullish Percent Index */}
                {data.indicators.bullishPercent !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Bullish Percent Index
                        {/* CHANGE: Enhanced Bullish Percent Index tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">Bullish Percent Index - Market Breadth Indicator</p>
                              <p className="text-sm mb-2">
                                This indicator measures what percentage of stocks in an index are showing bullish
                                technical signals based on "Point & Figure" charting. It's like taking a vote among all
                                stocks - how many are trending up vs. down?
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> The percentage of stocks in the S&P 500 that have
                                "bullish" chart patterns according to Point & Figure methodology. Each stock gets a
                                simple yes/no vote: is its chart pattern bullish or bearish?
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Understanding Point & Figure Charts:</strong> Instead of showing every price
                                move, Point & Figure charts only mark significant reversals in trend. A stock is
                                "bullish" when its chart shows a pattern of higher highs and higher lows (uptrend
                                intact).
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Below 30%:</strong> Extreme bearishness - most stocks are in downtrends, but
                                  often marks bottoms (contrarian buy)
                                </li>
                                <li>
                                  • <strong>30-50%:</strong> Bearish market - more stocks declining than advancing
                                </li>
                                <li>
                                  • <strong>50-70%:</strong> Bullish market - more stocks advancing than declining,
                                  healthy
                                </li>
                                <li>
                                  • <strong>Above 70%:</strong> Extreme bullishness - most stocks overbought, dangerous
                                  (contrarian sell)
                                </li>
                                <li>
                                  • <strong>Above 80%:</strong> Euphoria - market is extremely overbought, crash risk
                                  very high
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Market Breadth Concept:</strong> It's healthier when many stocks participate in
                                a rally (high breadth) than when just a few big stocks drive indexes higher while most
                                stocks fall (low breadth). Declining breadth often precedes crashes.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Compiled from Point & Figure charts of S&P 500 stocks,
                                updated daily.
                              </p>
                              <p className="text-xs text-gray-600">
                                Historical pattern: Readings above 75% preceded major tops in 2000 (dot-com bubble),
                                2007 (pre-financial crisis), and early 2020 (pre-COVID crash).
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.bullishPercent}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${data.indicators.bullishPercent}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Oversold: {"<"}30%</span>
                      <span className="text-yellow-600">Normal: 30-50%</span>
                      <span>Overbought: {">"}70%</span>
                    </div>
                  </div>
                )}

                {/* Yield Curve (10Y-2Y Spread) */}
                {data.indicators.yieldCurve !== undefined && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">Yield Curve (10Y-2Y Spread)</h4>
                      <InfoTooltip title="The Yield Curve spread measures the difference between 10-year and 2-year U.S. Treasury bond yields, expressed in basis points (hundredths of a percent). Normally, long-term bonds pay higher interest than short-term bonds (positive spread of +50 to +200 bps), reflecting the extra risk of holding bonds longer. When this inverts (negative spread), it means short-term rates are higher than long-term rates, signaling that bond markets expect economic trouble and future rate cuts. Inversions have preceded every U.S. recession since 1950, typically 6-18 months before the downturn. The calculation is simple: 10-Year Treasury Yield minus 2-Year Treasury Yield. A deeply inverted curve (below -50 bps) is a major recession warning and often precedes stock market crashes." />
                    </div>
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">Inverted: &lt;0</span>
                        <span className="text-gray-700">Flat: 0-50</span>
                        <span className="text-gray-700">Steep: &gt;100</span>
                      </div>
                      <div className="w-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded h-4"></div>
                      <div
                        className="absolute top-[28px] w-1 h-6 bg-black"
                        style={{
                          left: `${Math.min(Math.max(((data.indicators.yieldCurve + 100) / 300) * 100, 0), 100)}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-2xl font-bold">{data.indicators.yieldCurve.toFixed(0)} bps</span>
                      <span
                        className={`text-sm font-medium ${
                          data.indicators.yieldCurve < 0
                            ? "text-red-600"
                            : data.indicators.yieldCurve > 100
                              ? "text-green-600"
                              : "text-yellow-600"
                        }`}
                      >
                        {data.indicators.yieldCurve < 0
                          ? "Inverted (Recession Risk)"
                          : data.indicators.yieldCurve > 100
                            ? "Steep (Healthy)"
                            : "Flat"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Pillar 3 - Valuation & Market Structure */}
          <AccordionItem value="pillar3" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-10">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <span className="text-lg font-semibold">Pillar 3 - Valuation & Market Structure</span>
                  <span className="text-sm text-gray-600">Weight: 15% | 7 indicators</span>
                </div>
                <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.valuation)}/100</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6 pt-4">
                {/* S&P 500 P/E */}
                {data.indicators?.spxPE !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to S&P 500 P/E indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        S&P 500 Forward P/E
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-green-50 border-green-200">
                              <p className="font-semibold mb-1">S&P 500 Forward P/E Ratio</p>
                              <p className="text-sm">Price-to-Earnings ratio based on estimated future earnings.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 15:</strong> Undervalued, low crash risk
                                </li>
                                <li>
                                  <strong>16-20:</strong> Fair value, moderate risk
                                </li>
                                <li>
                                  <strong>{">"} 20:</strong> Overvalued, high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> High P/E ratios indicate markets vulnerable to corrections
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.spxPE}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, ((data.indicators.spxPE - 10) / 15) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Historical Median: 16</span>
                      <span>Current: {data.indicators.spxPE}</span>
                    </div>
                  </div>
                )}

                {/* P/S Ratio */}
                {data.indicators.spxPS !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to S&P 500 P/S indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        S&P 500 Price-to-Sales
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-green-50 border-green-200">
                              <p className="font-semibold mb-1">S&P 500 Price-to-Sales Ratio</p>
                              <p className="text-sm">Market capitalization relative to total company revenues.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 2.5:</strong> Undervalued, low risk
                                </li>
                                <li>
                                  <strong>2.5 - 3.0:</strong> Fair value, moderate risk
                                </li>
                                <li>
                                  <strong>{">"} 3.0:</strong> Overvalued, high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> High P/S ratios indicate markets trading at a premium to sales,
                                vulnerable to price drops
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.spxPS}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, ((data.indicators.spxPS - 1) / 2) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Normal: {"<"}2.5</span>
                      <span>Elevated: {">"}3.0</span>
                    </div>
                  </div>
                )}

                {/* Buffett Indicator */}
                {data.indicators.buffettIndicator !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Buffett Indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Buffett Indicator (Market Cap / GDP)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-red-50 border-red-200">
                              <p className="font-semibold mb-1">Buffett Indicator</p>
                              <p className="text-sm">Compares total stock market capitalization to GDP.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 120%:</strong> Undervalued, low crash risk
                                </li>
                                <li>
                                  <strong>120-150%:</strong> Fair value, moderate risk
                                </li>
                                <li>
                                  <strong>150-180%:</strong> Elevated risk
                                </li>
                                <li>
                                  <strong>{">"} 200%:</strong> Historically signifies market bubbles, extreme crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> A high Buffett Indicator suggests the market is significantly
                                overvalued relative to the economy's productive capacity
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.buffettIndicator.toFixed(0)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, (data.indicators.buffettIndicator - 80) / 1.6))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Undervalued: {"<"}120%</span>
                      <span>Fair: 120-150%</span>
                      <span>Warning: 150-180%</span>
                      <span className="text-red-600">Danger: {">"}200%</span>
                    </div>
                  </div>
                )}

                {data.indicators.qqqPE !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to QQQ P/E indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        QQQ Forward P/E (AI-Specific Valuation)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">QQQ Forward P/E Ratio</p>
                              <p className="text-sm">
                                Measures the valuation of the Nasdaq-100, often driven by tech and AI growth
                                expectations.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 25:</strong> Fairly valued or undervalued
                                </li>
                                <li>
                                  <strong>25-35:</strong> Elevated valuation, moderate risk
                                </li>
                                <li>
                                  <strong>{">"} 35:</strong> Bubble territory, very high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> High P/E in tech can lead to sharp corrections when growth
                                expectations are not met
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.qqqPE.toFixed(1)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, ((data.indicators.qqqPE - 15) / 30) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Fair: {"<"}25</span>
                      <span>Elevated: 30-35</span>
                      <span>Bubble: {">"}40</span>
                    </div>
                  </div>
                )}

                {data.indicators.mag7Concentration !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Magnificent 7 Concentration */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Magnificent 7 Concentration (Crash Contagion Risk)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-red-50 border-red-200">
                              <p className="font-semibold mb-1">Magnificent 7 Concentration</p>
                              <p className="text-sm">
                                Percentage of the S&P 500 market cap held by the 'Magnificent 7' stocks.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 50%:</strong> Diversified market, lower contagion risk
                                </li>
                                <li>
                                  <strong>55-60%:</strong> High concentration, increased contagion risk
                                </li>
                                <li>
                                  <strong>{">"} 65%:</strong> Extreme concentration, very high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> High concentration means a downturn in these stocks can
                                severely impact the entire market
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.mag7Concentration.toFixed(1)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, ((data.indicators.mag7Concentration - 40) / 30) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Diversified: {"<"}50%</span>
                      <span>High: 55-60%</span>
                      <span>Extreme: {">"}65%</span>
                    </div>
                  </div>
                )}

                {data.indicators.shillerCAPE !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Shiller CAPE Ratio */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Shiller CAPE Ratio (10-Year Cyclical Valuation)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-red-50 border-red-200">
                              <p className="font-semibold mb-1">Shiller CAPE Ratio</p>
                              <p className="text-sm">Cyclically Adjusted Price-to-Earnings ratio over 10 years.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 20:</strong> Undervalued, low risk
                                </li>
                                <li>
                                  <strong>20-30:</strong> Fair value, moderate risk
                                </li>
                                <li>
                                  <strong>30-35:</strong> Elevated valuation, high risk
                                </li>
                                <li>
                                  <strong>{">"} 35:</strong> Historically signals market tops, extreme crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> High CAPE values indicate markets trading significantly above
                                historical averages, prone to reversion
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.shillerCAPE.toFixed(1)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, ((data.indicators.shillerCAPE - 15) / 25) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Historical Avg: 16-17</span>
                      <span>Elevated: 25-30</span>
                      <span>Extreme: {">"}35</span>
                    </div>
                  </div>
                )}

                {data.indicators.equityRiskPremium !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Equity Risk Premium */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Equity Risk Premium (Earnings Yield - 10Y Treasury)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-green-50 border-green-200">
                              <p className="font-semibold mb-1">Equity Risk Premium</p>
                              <p className="text-sm">
                                The excess return investors expect for holding stocks over risk-free bonds.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{">"} 5%:</strong> Attractive returns, low risk
                                </li>
                                <li>
                                  <strong>3-4%:</strong> Fair compensation, moderate risk
                                </li>
                                <li>
                                  <strong>{"<"} 2%:</strong> Low compensation, high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Low ERP suggests stocks are overvalued relative to their risk
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.equityRiskPremium.toFixed(2)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, ((6 - data.indicators.equityRiskPremium) / 6) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Attractive: {">"}5%</span>
                      <span>Fair: 3-4%</span>
                      <span>Overvalued: {"<"}2%</span>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Pillar 4 - Macro Economic */}
          <AccordionItem value="pillar4" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-10">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  <span className="text-lg font-semibold">Pillar 4 - Macro</span>
                  <span className="text-sm text-gray-600">Weight: 20% | 7 indicators</span>
                </div>
                <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.macro)}/100</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6 pt-4">
                {/* TED Spread */}
                {data.indicators?.tedSpread !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to TED Spread indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        TED Spread (Banking System Stress)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-orange-50 border-orange-200">
                              <p className="font-semibold mb-1">TED Spread</p>
                              <p className="text-sm">
                                Difference between US Dollar LIBOR and US Treasury yields, indicating credit market
                                stress.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 0.35%:</strong> Low stress, stable banking
                                </li>
                                <li>
                                  <strong>0.5-0.75%:</strong> Rising stress, caution needed
                                </li>
                                <li>
                                  <strong>{">"} 1.0%:</strong> High stress, impending crisis
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Widening TED spread signals increasing fear of bank defaults
                                and credit tightening
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.tedSpread.toFixed(2)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.tedSpread / 1.5) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Normal: {"<"}0.35%</span>
                      <span>Warning: 0.5-0.75%</span>
                      <span>Crisis: {">"}1.0%</span>
                    </div>
                  </div>
                )}

                {/* US Dollar Index (DXY) */}
                {data.indicators?.dxyIndex !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to DXY Index */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        US Dollar Index (DXY) - Tech Headwind
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-green-50 border-green-200">
                              <p className="font-semibold mb-1">US Dollar Index (DXY)</p>
                              <p className="text-sm">Measures USD strength against a basket of major currencies.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 95:</strong> Weak dollar, supports asset prices
                                </li>
                                <li>
                                  <strong>95-105:</strong> Normal range
                                </li>
                                <li>
                                  <strong>{">"} 110:</strong> Strong dollar, headwinds for global growth and tech
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> A strong dollar can hurt multinational tech earnings and
                                emerging markets
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.dxyIndex.toFixed(1)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, ((data.indicators.dxyIndex - 90) / 30) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Weak: {"<"}95</span>
                      <span>Normal: 100-105</span>
                      <span>Strong: {">"}110 (Hurts tech)</span>
                    </div>
                  </div>
                )}

                {/* ISM Manufacturing PMI */}
                {data.indicators?.ismPMI !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to ISM Manufacturing PMI */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        ISM Manufacturing PMI (Economic Leading)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-gray-50 border-gray-200">
                              <p className="font-semibold mb-1">ISM Manufacturing PMI</p>
                              <p className="text-sm">Purchasing Managers' Index for the manufacturing sector.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{">"} 52:</strong> Expansion, positive economic signal
                                </li>
                                <li>
                                  <strong>50-52:</strong> Slowing growth
                                </li>
                                <li>
                                  <strong>{"<"} 50:</strong> Contraction, recessionary signal
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> A PMI below 50 often indicates weakening demand and potential
                                economic slowdown
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.ismPMI.toFixed(1)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, 100 - ((data.indicators.ismPMI - 40) / 20) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Expansion: {">"}52</span>
                      <span>Neutral: 50</span>
                      <span>Contraction: {"<"}50</span>
                    </div>
                  </div>
                )}

                {/* Fed Funds Rate */}
                {data.indicators.fedFundsRate !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Fed Funds Rate */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Fed Funds Rate
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">Federal Funds Rate</p>
                              <p className="text-sm">
                                The target rate set by the Federal Reserve for overnight lending between banks.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 2%:</strong> Accommodative policy, supports growth
                                </li>
                                <li>
                                  <strong>2-4%:</strong> Neutral policy
                                </li>
                                <li>
                                  <strong>{">"} 4.5%:</strong> Restrictive policy, slows economy, increases crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> High rates increase borrowing costs and can trigger market
                                downturns
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.fedFundsRate}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.fedFundsRate / 6) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Accommodative: {"<"}2%</span>
                      <span className="text-yellow-600">Neutral: 2-4%</span>
                      <span>Restrictive: {">"}4.5%</span>
                    </div>
                  </div>
                )}

                {/* Fed Reverse Repo */}
                {data.indicators?.fedReverseRepo !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Fed Reverse Repo */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Fed Reverse Repo (Liquidity Conditions)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">Fed Reverse Repo Operations</p>
                              <p className="text-sm">Measures excess liquidity in the financial system.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} $500B:</strong> Tight liquidity, potential headwinds
                                </li>
                                <li>
                                  <strong>$500B - $1T:</strong> Normal
                                </li>
                                <li>
                                  <strong>{">"} $2T:</strong> Abundant liquidity, supports asset prices
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Declining reverse repo balances can signal tightening
                                liquidity, increasing crash risk
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">${data.indicators.fedReverseRepo.toFixed(0)}B</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.fedReverseRepo / 2500) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Loose: {"<"}500B</span>
                      <span>Normal: 1000B</span>
                      <span>Tight: {">"}2000B</span>
                    </div>
                  </div>
                )}

                {/* Junk Bond Spread - moved to Macro */}
                {data.indicators.junkSpread !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Junk Bond Spread */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Junk Bond Spread
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-orange-50 border-orange-200">
                              <p className="font-semibold mb-1">Junk Bond Spread</p>
                              <p className="text-sm">
                                Difference between yields on high-yield (junk) bonds and risk-free Treasuries.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 3%:</strong> Tight spread, low perceived risk, low crash risk
                                </li>
                                <li>
                                  <strong>3-6%:</strong> Normal spread, moderate risk
                                </li>
                                <li>
                                  <strong>{">"} 7%:</strong> Wide spread, high perceived risk, high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Widening spreads indicate investor fear of default and credit
                                tightening
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.junkSpread.toFixed(2)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, ((data.indicators.junkSpread - 2) / 8) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Tight: {"<"}3%</span>
                      <span className="text-yellow-600">Normal: 3-5%</span>
                      <span>Wide: {">"}6%</span>
                    </div>
                  </div>
                )}

                {/* US Debt-to-GDP */}
                {data.indicators.debtToGDP !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to US Debt-to-GDP */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        US Debt-to-GDP Ratio
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-red-50 border-red-200">
                              <p className="font-semibold mb-1">US Debt-to-GDP Ratio</p>
                              <p className="text-sm">Total public debt as a percentage of Gross Domestic Product.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 90%:</strong> Healthy level
                                </li>
                                <li>
                                  <strong>90-120%:</strong> Elevated risk
                                </li>
                                <li>
                                  <strong>{">"} 130%:</strong> Very high risk, potential for fiscal crisis
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> High debt levels can lead to inflation, higher interest rates,
                                and reduced fiscal flexibility
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.debtToGDP.toFixed(1)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, ((data.indicators.debtToGDP - 60) / 80) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Healthy: {"<"}90%</span>
                      <span className="text-yellow-600">Elevated: 100-120%</span>
                      <span className="text-red-600">Danger: {">"}130%</span>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* CCPI Formula Weights */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-sm mb-3 text-blue-900">CCPI Formula Weights</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Technical & Price:</span>
              <span className="font-bold text-blue-900">35%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Risk Appetite:</span>
              <span className="font-bold text-blue-900">30%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Valuation:</span>
              <span className="font-bold text-blue-900">15%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Macro:</span>
              <span className="font-bold text-blue-900">20%</span>
            </div>
          </div>
          <p className="text-xs text-blue-700 mt-3">
            Final CCPI = Σ(Pillar Score × Weight). Pillar 3 now includes 7 valuation & market structure indicators: S&P
            P/E, S&P P/S, Buffett Indicator, QQQ P/E, Mag7 Concentration, Shiller CAPE, and Equity Risk Premium.
          </p>
        </div>

        <Accordion type="multiple" className="space-y-4 mt-8">
          {/* Portfolio Allocation by CCPI Crash Risk Level */}
          <AccordionItem value="portfolio-allocation" className="border-0">
            <Card className="shadow-sm border-gray-200">
              <AccordionTrigger className="hover:no-underline px-6 py-0">
                <CardHeader className="bg-gray-50 border-b border-gray-200 w-full py-3">
                  <CardTitle className="text-lg font-bold text-gray-900 text-left">
                    Portfolio Allocation by CCPI Crash Risk Level
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1 text-left">
                    Recommended asset class diversification across crash risk regimes
                  </p>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-2">
                    {[
                      {
                        range: "0-19",
                        level: "Low Risk",
                        data: {
                          stocks: "55-65%",
                          options: "15-20%",
                          crypto: "8-12%",
                          gold: "3-5%",
                          cash: "5-10%",
                          description: "Aggressive growth allocation with maximum equity exposure",
                          rationale: [
                            "Deploy capital aggressively into quality tech growth stocks",
                            "Allocate 15-20% to options strategies for leverage and income",
                            "Hold 8-12% crypto for asymmetric upside (BTC/ETH)",
                            "Minimal cash reserves needed in low-risk environment",
                            "Small gold allocation (3-5%) as insurance policy",
                          ],
                        },
                      },
                      {
                        range: "20-39",
                        level: "Normal",
                        data: {
                          stocks: "45-55%",
                          options: "12-15%",
                          crypto: "5-8%",
                          gold: "5-8%",
                          cash: "15-25%",
                          description: "Balanced allocation with standard risk management",
                          rationale: [
                            "Core equity exposure via diversified ETFs and blue chips",
                            "Use options for income generation and tactical positioning",
                            "Reduce crypto exposure to 5-8% of portfolio",
                            "Increase gold/silver to 5-8% for diversification",
                            "Build cash reserves to 15-25% for opportunities",
                          ],
                        },
                      },
                      {
                        range: "40-59",
                        level: "Caution",
                        data: {
                          stocks: "30-40%",
                          options: "8-12%",
                          crypto: "3-5%",
                          gold: "10-15%",
                          cash: "30-40%",
                          description: "Defensive tilt with elevated cash and hedges",
                          rationale: [
                            "Reduce equity exposure to highest-quality names only",
                            "Shift options allocation toward hedges and put spreads",
                            "Trim crypto to minimal allocation (3-5%)",
                            "Increase gold/silver to 10-15% as safe haven",
                            "Build substantial cash position (30-40%) for volatility",
                          ],
                        },
                      },
                      {
                        range: "60-79",
                        level: "High Alert",
                        data: {
                          stocks: "15-25%",
                          options: "10-15%",
                          crypto: "0-2%",
                          gold: "15-20%",
                          cash: "50-60%",
                          description: "Capital preservation mode with heavy defensive positioning",
                          rationale: [
                            "Minimal equity exposure - only defensive sectors (utilities, staples)",
                            "Options portfolio entirely hedges and volatility plays",
                            "Exit nearly all crypto exposure due to crash risk",
                            "Gold allocation 15-20% as primary safe haven asset",
                            "Hold 50-60% cash to deploy after market correction",
                          ],
                        },
                      },
                      {
                        range: "80-100",
                        level: "Crash Watch",
                        data: {
                          stocks: "5-10%",
                          options: "10-15%",
                          crypto: "0%",
                          gold: "20-25%",
                          cash: "70-80%",
                          description: "Maximum defense - cash and hard assets only",
                          rationale: [
                            "Liquidate nearly all equity exposure immediately",
                            "Options used exclusively for tail risk hedges and put spreads",
                            "Zero crypto exposure - too correlated with risk assets",
                            "Maximum gold/precious metals allocation (20-25%)",
                            "Hold 70-80% cash reserves to deploy after crash",
                          ],
                        },
                      },
                    ].map((item, index) => {
                      const isCurrent =
                        data.ccpi >= Number.parseInt(item.range.split("-")[0]) &&
                        data.ccpi <= Number.parseInt(item.range.split("-")[1])

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
                                <span className="font-mono text-sm font-bold text-gray-900">CCPI {item.range}</span>
                                <span
                                  className={`ml-3 font-bold text-sm ${
                                    index === 0
                                      ? "text-green-600"
                                      : index === 1
                                        ? "text-lime-600"
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
                      <strong>Note:</strong> These allocations represent baseline guidelines for crash risk management.
                      Always adjust based on your personal risk tolerance, time horizon, and financial goals. CCPI
                      levels above 60 warrant significant defensive positioning regardless of individual circumstances.
                      Consult with a financial advisor for personalized advice.
                    </p>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          {/* Options Strategy Guide by CCPI Crash Risk Level */}
          <AccordionItem value="options-strategy" className="border-0">
            <Card className="shadow-sm border-gray-200">
              <AccordionTrigger className="hover:no-underline px-6 py-0">
                <CardHeader className="bg-gray-50 border-b border-gray-200 w-full py-3">
                  <CardTitle className="text-lg font-bold text-gray-900 text-left">
                    Options Strategy Guide by CCPI Crash Risk Level
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1 text-left">
                    Complete trading playbook across all crash risk regimes
                  </p>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-2">
                    {[
                      {
                        range: "0-19",
                        level: "Low Risk",
                        signal: "STRONG BUY",
                        description:
                          "Market shows minimal crash signals. Safe to deploy capital with aggressive strategies.",
                        guidance: {
                          cashAllocation: "5-10%",
                          marketExposure: "90-100%",
                          positionSize: "Large (5-10%)",
                          strategies: [
                            "Sell cash-secured puts on quality names at 30-delta",
                            "Run the wheel strategy on tech leaders (NVDA, MSFT, AAPL)",
                            "Long ITM LEAPS calls (70-80 delta) for portfolio leverage",
                            "Aggressive short strangles on high IV stocks",
                            "Credit spreads in earnings season",
                          ],
                        },
                      },
                      {
                        range: "20-39",
                        level: "Normal",
                        signal: "BUY",
                        description:
                          "Standard market conditions. Deploy capital with normal risk management protocols.",
                        guidance: {
                          cashAllocation: "15-25%",
                          marketExposure: "70-85%",
                          positionSize: "Medium (3-5%)",
                          strategies: [
                            "Balanced put selling at 20-30 delta on SPY/QQQ",
                            "Covered calls on existing positions (40-45 DTE)",
                            "Bull put spreads with 1.5-2x credit/risk ratio",
                            "Diagonal calendar spreads for income + upside",
                            "Protective puts on core holdings (10% allocation)",
                          ],
                        },
                      },
                      {
                        range: "40-59",
                        level: "Caution",
                        signal: "HOLD",
                        description: "Mixed signals appearing. Reduce exposure and focus on defensive positioning.",
                        guidance: {
                          cashAllocation: "30-40%",
                          marketExposure: "50-70%",
                          positionSize: "Small (1-3%)",
                          strategies: [
                            "Shift to defined-risk strategies only (spreads, iron condors)",
                            "Increase VIX call hedges (2-3 month expiry)",
                            "Roll out short puts to avoid assignment",
                            "Close winning trades early (50-60% max profit)",
                            "Buy protective puts on concentrated positions",
                          ],
                        },
                      },
                      {
                        range: "60-79",
                        level: "High Alert",
                        signal: "CAUTION",
                        description:
                          "Multiple crash signals active. Preserve capital and prepare for volatility expansion.",
                        guidance: {
                          cashAllocation: "50-60%",
                          marketExposure: "30-50%",
                          positionSize: "Very Small (0.5-1%)",
                          strategies: [
                            "Buy VIX calls for crash insurance (60-90 DTE)",
                            "Long put spreads on QQQ/SPY at-the-money",
                            "Tactical long volatility trades (VXX calls)",
                            "Gold miners (GDX) call options as diversification",
                          ],
                        },
                      },
                      {
                        range: "80-100",
                        level: "Crash Watch",
                        signal: "SELL/HEDGE",
                        description:
                          "Extreme crash risk. Full defensive positioning required. Prioritize capital preservation.",
                        guidance: {
                          cashAllocation: "70-80%",
                          marketExposure: "10-30%",
                          positionSize: "Minimal (0.25-0.5%)",
                          strategies: [
                            "Aggressive long puts on SPY/QQQ (30-60 DTE)",
                            "VIX call spreads to capitalize on volatility spike",
                            "Inverse ETFs (SQQQ, SH) or long put options",
                            "Close ALL short premium positions",
                            "Tail risk hedges: deep OTM puts on major indices",
                          ],
                        },
                      },
                    ].map((item, index) => {
                      const isCurrent =
                        data.ccpi >= Number.parseInt(item.range.split("-")[0]) &&
                        data.ccpi <= Number.parseInt(item.range.split("-")[1])

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
                                <span className="font-mono text-sm font-bold text-gray-900">CCPI: {item.range}</span>
                                <span
                                  className={`ml-3 font-bold text-sm ${
                                    index === 0
                                      ? "text-green-600"
                                      : index === 1
                                        ? "text-lime-600"
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
                            <div className="p-3 bg-gray-50 rounded border border-gray-300">
                              <div className="text-xs font-semibold text-gray-900 uppercase mb-1">Position Size</div>
                              <div className="text-sm font-bold text-gray-900">{item.guidance.positionSize}</div>
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
                      <strong>Disclaimer:</strong> Options trading carries significant risk of loss. These strategies
                      are educational examples only. Past performance does not guarantee future results. Always
                      implement proper position sizing, stop losses, and risk management protocols. Consider your
                      personal risk tolerance and market conditions before trading. Not financial advice - consult a
                      licensed professional.
                    </p>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>

        {/* Export Controls */}
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const summary = `CCPI Weekly Outlook\n\n${data.summary.headline}\n\n${data.summary.bullets.join("\n")}\n\nCCPI Score: ${data.ccpi}\nCertainty: ${data.certainty}\nRegime: ${data.regime.name}\n\nGenerated: ${new Date(data.timestamp).toLocaleString()}`
              navigator.clipboard.writeText(summary)
              alert("Summary copied to clipboard!")
            }}
          >
            Copy Summary
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* API Data Source Status - Removed as per update */}
      </div>
    </TooltipProvider>
  )
}

export { CcpiDashboard }
