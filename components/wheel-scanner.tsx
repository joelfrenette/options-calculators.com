"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { TrendingUp, Info, Loader2, BarChart3, Filter, AlertCircle, CheckCircle2 } from "lucide-react"
import React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"

const CACHE_VERSION = "v1"

// Check if it's a weekday (Monday-Friday)
const isWeekday = (date: Date): boolean => {
  const day = date.getDay()
  return day >= 1 && day <= 5 // Monday = 1, Friday = 5
}

// Get today's market open time (9:30 AM ET)
const getMarketOpenTime = (): Date => {
  const now = new Date()
  const etDate = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  etDate.setHours(9, 30, 0, 0)
  return etDate
}

// Check if cache is valid (same day, after 9:30 AM ET, weekday)
const isCacheValid = (cacheTimestamp: number): boolean => {
  const now = new Date()
  const etNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const cacheDate = new Date(cacheTimestamp)
  const cacheEtDate = new Date(cacheDate.toLocaleString("en-US", { timeZone: "America/New_York" }))

  console.log(`[v0] Cache validation check:`)
  console.log(`  - Current ET time: ${etNow.toLocaleString()}`)
  console.log(`  - Cache ET time: ${cacheEtDate.toLocaleString()}`)
  console.log(
    `  - Current day of week: ${etNow.getDay()} (${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][etNow.getDay()]})`,
  )

  // Check if it's a weekday
  if (!isWeekday(etNow)) {
    console.log("[v0] ❌ Cache check: Not a weekday, cache invalid")
    return false
  }

  // Check if cache is from today (in ET timezone)
  const isSameDay =
    cacheEtDate.getFullYear() === etNow.getFullYear() &&
    cacheEtDate.getMonth() === etNow.getMonth() &&
    cacheEtDate.getDate() === etNow.getDate()

  console.log(`  - Is same day? ${isSameDay}`)

  // Don't check if we're past market open or if cache was created after market open
  // This allows cache to work all day long once created
  const isValid = isSameDay

  console.log(`  - Cache valid? ${isValid} (only checking same day + weekday)`)

  return isValid
}

// Generate cache key from filter parameters
const generateCacheKey = (params: {
  minVolume: number
  maxDebtToEquity: number
  minROE: number
  minProfitableQuarters: number
  minMarketCapCategory: number
  tickers: string
}): string => {
  return `fundamental_scan_${CACHE_VERSION}_${params.minVolume}_${params.maxDebtToEquity}_${params.minROE}_${params.minProfitableQuarters}_${params.minMarketCapCategory}_${params.tickers.replace(/[^a-zA-Z,]/g, "").substring(0, 50)}`
}

const saveToCache = (key: string, data: any): void => {
  try {
    const cacheData = {
      timestamp: Date.now(),
      data: data,
    }
    localStorage.setItem(key, JSON.stringify(cacheData))
    console.log(`[v0] Saved to cache: ${key}`)
  } catch (err) {
    console.error("[v0] Error saving to cache:", err)
  }
}

// Load from cache
const loadFromCache = (key: string): any | null => {
  try {
    console.log(`[v0] 🔍 loadFromCache() called with key: ${key}`)
    const cached = localStorage.getItem(key)

    if (!cached) {
      console.log(`[v0] ❌ No cache found in localStorage for key: ${key}`)
      return null
    }

    console.log(`[v0] ✅ Found cache data in localStorage`)
    const cacheData = JSON.parse(cached)
    console.log(`[v0] Cache timestamp: ${new Date(cacheData.timestamp).toLocaleString()}`)

    if (!isCacheValid(cacheData.timestamp)) {
      console.log(`[v0] ❌ Cache expired/invalid - removing from localStorage`)
      localStorage.removeItem(key)
      return null
    }

    console.log(`[v0] ✅✅✅ Cache is valid! Returning cached data`)
    return cacheData.data
  } catch (err) {
    console.error("[v0] ❌ Error loading from cache:", err)
    return null
  }
}

interface QualifyingStock {
  ticker: string
  currentPrice: number
  peRatio: number
  avgVolume: number
  last4EPS: number[]
  sma50: number
  sma100: number
  sma200: number
  uptrend: boolean
  rsi: number
  bollingerPosition: string
  macdSignal: string
  stochastic: number
  atr: number
  atrPercent: number
  putStrike: number
  premium?: number // This will be updated with real option premium
  yield: number // This will be updated with real option yield
  delta: number
  deltaSource?: "polygon" | "calculated" | "estimated" // Track source of delta
  marketCap: number // Store market cap in billions
  redDay: boolean
  earningsDate?: string
  daysToEarnings?: number
  expectedMove?: number // This will be updated with expected move from IV
  volume: number // Added volume field
  roe: number // Return on Equity percentage
  debtToEquity: number // Debt-to-Equity ratio
  expiryDate?: string // Options expiration date
  daysToExpiry?: number // Days until option expiration
  annualizedYield?: number // Annualized yield percentage

  // Added fields for enriched option data
  optionStrike?: number
  optionPremium?: number
  optionYield?: number
  optionAnnualizedYield?: number
  optionDelta?: number
  optionDaysToExpiry?: number
  optionBid?: number
  optionAsk?: number
  bidPrice?: number // Added to match enrichWithOptionsData update
  askPrice?: number // Added to match enrichWithOptionsData update
}

const MEGA_CAP_STOCKS = [
  // Mega-cap Tech (Top tier - all $100B+ market cap)
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "NVDA",
  "META",
  "TSLA",
  "AVGO",
  "ORCL",
  "ADBE",
  "CRM",
  "AMD",
  "INTC",
  "CSCO",
  "QCOM",
  "NFLX",
  "TXN",
  "AMAT",
  "INTU",
  "NOW",

  // Major Financials (All $50B+ market cap)
  "BRK.B",
  "JPM",
  "V",
  "MA",
  "BAC",
  "WFC",
  "GS",
  "MS",
  "C",
  "AXP",
  "SPGI",
  "BLK",
  "SCHW",
  "CB",
  "PGR",
  "MMC",
  "ICE",
  "COF",
  "USB",
  "TFC",

  // Healthcare & Pharma (All $50B+ market cap)
  "UNH",
  "LLY",
  "JNJ",
  "ABBV",
  "MRK",
  "TMO",
  "ABT",
  "DHR",
  "PFE",
  "BMY",
  "AMGN",
  "GILD",
  "CVS",
  "CI",
  "ELV",
  "HUM",
  "ISRG",
  "REGN",
  "VRTX",
  "SYK",

  // Consumer & Retail (All $50B+ market cap)
  "WMT",
  "COST",
  "HD",
  "MCD",
  "NKE",
  "LOW",
  "SBUX",
  "TGT",
  "TJX",
  "BKNG",
  "PG",
  "KO",
  "PEP",
  "PM",
  "MO",
  "MDLZ",
  "CL",
  "EL",
  "MNST",
  "KHC",

  // Industrials & Materials (All $30B+ market cap)
  "CAT",
  "BA",
  "GE",
  "HON",
  "UNP",
  "RTX",
  "LMT",
  "DE",
  "UPS",
  "ADP",
  "MMM",
  "EMR",
  "ITW",
  "ETN",
  "PH",
  "GD",
  "NOC",
  "FDX",
  "CSX",
  "NSC",

  // Energy (All $50B+ market cap)
  "XOM",
  "CVX",
  "COP",
  "SLB",
  "EOG",
  "MPC",
  "PSX",
  "VLO",
  "OXY",
  "HAL",

  // Communication Services (All $20B+ market cap)
  "T",
  "VZ",
  "TMUS",
  "CMCSA",
  "DIS",
  "CHTR",
  "EA",
  "NWSA",
  "FOXA",
  "WBD",

  // Utilities & Other
  "NEE",
  "DUK",
  "SO",
  "D",
  "AEP",
  "EXC",
  "SRE",
  "PEG",
  "XEL",
  "ED",
]

const MEGA_CAP_STOCKS_ALPHABETIZED = [
  "AAPL",
  "ABT",
  "ABBV",
  "ADBE",
  "ADP",
  "AEP",
  "AMAT",
  "AMD",
  "AMGN",
  "AMZN",
  "AVGO",
  "AXP",
  "BA",
  "BAC",
  "BKNG",
  "BLK",
  "BMY",
  "BRK.B",
  "C",
  "CAT",
  "CB",
  "CHTR",
  "CI",
  "CL",
  "CMCSA",
  "COF",
  "COP",
  "COST",
  "CRM",
  "CSCO",
  "CSX",
  "CVS",
  "CVX",
  "D",
  "DE",
  "DHR",
  "DIS",
  "DUK",
  "EA",
  "ED",
  "EL",
  "ELV",
  "EMR",
  "EOG",
  "ETN",
  "EXC",
  "FDX",
  "FOXA",
  "GD",
  "GE",
  "GILD",
  "GOOGL",
  "GS",
  "HAL",
  "HD",
  "HON",
  "HUM",
  "ICE",
  "INTC",
  "INTU",
  "ISRG",
  "ITW",
  "JNJ",
  "JPM",
  "KHC",
  "KO",
  "LLY",
  "LMT",
  "LOW",
  "MA",
  "MCD",
  "MDLZ",
  "META",
  "MMC",
  "MMM",
  "MNST",
  "MO",
  "MPC",
  "MRK",
  "MS",
  "MSFT",
  "NEE",
  "NFLX",
  "NKE",
  "NOC",
  "NOW",
  "NSC",
  "NVDA",
  "NWSA",
  "ORCL",
  "OXY",
  "PEG",
  "PEP",
  "PFE",
  "PG",
  "PGR",
  "PH",
  "PM",
  "PSX",
  "QCOM",
  "REGN",
  "RTX",
  "SBUX",
  "SCHW",
  "SLB",
  "SO",
  "SPGI",
  "SRE",
  "SYK",
  "T",
  "TFC",
  "TGT",
  "TJX",
  "TMO",
  "TMUS",
  "TSLA",
  "TXN",
  "UNH",
  "UNP",
  "UPS",
  "USB",
  "V",
  "VLO",
  "VRTX",
  "VZ",
  "WBD",
  "WFC",
  "WMT",
  "XEL",
  "XOM",
].sort()

// Helper function to get the numerical limit for top ranked stocks
const getTopRankedValue = (percentage: number): number => {
  if (percentage <= 16) return 500 // Top 500
  if (percentage <= 50) return 100 // Top 100
  if (percentage <= 83) return 50 // Top 50
  return 10 // Top 10
}

// Helper function to get the label for top ranked stocks
const getTopRankedLabel = (percentage: number): string => {
  if (percentage <= 16) return "Top 500"
  if (percentage <= 50) return "Top 100"
  if (percentage <= 83) return "Top 50"
  return "Top 10"
}

export function WheelScanner() {
  const [tickersToScan, setTickersToScan] = useState<string>("")
  const [minVolume, setMinVolume] = useState([2])
  const [maxDebtToEquity, setMaxDebtToEquity] = useState([2]) // Updated from 1 to 2.0 for professional standards
  const [minROE, setMinROE] = useState([15]) // Updated from 10 to 15 for professional standards
  const [minProfitableQuarters, setMinProfitableQuarters] = useState([4])
  const [minMarketCapCategory, setMinMarketCapCategory] = useState([3])
  // FIX: Declare maxPE state variable
  const [maxPE, setMaxPE] = useState([20])

  const [preFilterMarketCap, setPreFilterMarketCap] = useState([4]) // 0=Any, 1=$300M, 2=$2B, 3=$10B, 4=$50B
  const [preFilterLiquidity, setPreFilterLiquidity] = useState([25]) // Changed from 10M to 25M for ultra-liquid mega-caps
  const [preFilterTopRanked, setPreFilterTopRanked] = useState([100]) // Changed from 66 (Top 100) to 100 (Top 10) for most elite mega-caps

  const [isLoadingPreFilter, setIsLoadingPreFilter] = useState(false) // Renamed from preFilterLoading
  const [preFilterCount, setPreFilterCount] = useState(0)

  const [loading, setLoading] = useState(false)
  // FIX: Renamed state variables to reflect their purpose more accurately
  const [technicalLoading, setTechnicalLoading] = useState(false) // Renamed from technicalLoading
  const [technicalScanAttempted, setTechnicalScanAttempted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fundamentalResults, setFundamentalResults] = useState<QualifyingStock[]>([])
  const [technicalResults, setTechnicalResults] = useState<QualifyingStock[]>([])
  const [showRelaxedResults, setShowRelaxedResults] = useState(false)
  const [fundamentalSortColumn, setFundamentalSortColumn] = useState<string>("ticker")
  const [fundamentalSortDirection, setFundamentalSortDirection] = useState<"asc" | "desc">("asc")

  const [sortColumn, setSortColumn] = useState<keyof QualifyingStock>("yield")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [relaxedSortColumn, setRelaxedSortColumn] = useState<keyof QualifyingStock>("yield")
  const [relaxedSortDirection, setRelaxedSortDirection] = useState<"asc" | "desc">("desc")
  const [scanProgress, setScanProgress] = useState(0)
  const [currentTicker, setCurrentTicker] = useState("")
  const [technicalProgress, setTechnicalProgress] = useState(0)
  const [technicalCurrentTicker, setTechnicalCurrentTicker] = useState("")
  const [isScanningTechnicals, setIsScanningTechnicals] = useState(false) // This is the correct state for tracking technical scan progress

  const [preFilterProgress, setPreFilterProgress] = useState(0)
  const [preFilterCurrentTicker, setPreFilterCurrentTicker] = useState("")

  const [step4Progress, setStep4Progress] = useState(0)
  const [step4CurrentTicker, setStep4CurrentTicker] = useState("")
  const [isEnrichingRelaxed, setIsEnrichingRelaxed] = useState(false)

  const [maxROE, setMaxROE] = useState(20)

  // Step 3: Technical Analysis Filters
  const [maxRSI, setMaxRSI] = useState([30]) // Changed from 40 to 30 - captures genuine oversold conditions
  const [maxStochastic, setMaxStochastic] = useState([25]) // Changed from 30 to 25 - extreme oversold with bounce probability
  const [minATR, setMinATR] = useState([2.5]) // Keep 2.5 - ensures sufficient premium/volatility
  const [maxATR, setMaxATR] = useState([6]) // Changed from 8 to 6 - high enough for premiums, low enough for safety

  const [requireBollingerBands, setRequireBollingerBands] = useState(true) // Keep true - mean reversion is key
  // FIX: Renamed state variables from require200SMA to requireAbove200SMA and require50SMA to requireAbove50SMA
  const [requireAbove200SMA, setRequireAbove200SMA] = useState(true) // Keep true - long-term trend protection
  const [requireAbove50SMA, setRequireAbove50SMA] = useState(false) // Changed to false - allows dips below 50-day
  const [requireGoldenCross, setRequireGoldenCross] = useState(false) // Changed to false - too restrictive, misses early entries
  const [requireMACDBullish, setRequireMACDBullish] = useState(false) // Changed to false - optional confirmation, not required
  const [requireRedDay, setRequireRedDay] = useState(true) // Keep true - sell on weakness for better prices

  const [cacheStatus, setCacheStatus] = useState<string>("")

  // FIX: Declare and initialize minYield and minVolumeTechnicals state variables
  const [minYield, setMinYield] = useState([1])
  const [minVolumeTechnicals, setMinVolumeTechnicals] = useState([2]) // This variable is declared but not used in the provided code snippet.

  const [relaxedResults, setRelaxedResults] = useState<QualifyingStock[]>([])
  const [relaxedResultsEnriched, setRelaxedResultsEnriched] = React.useState(false)

  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  const [hasAttemptedTechnicalScan, setHasAttemptedTechnicalScan] = useState(false)

  // FIX: Added isRelaxedMode state variable
  const [isRelaxedMode, setIsRelaxedMode] = useState(false)

  const [step, setStep] = useState(1) // 1=Initial, 2=After fundamental scan, 3=After technical scan, 4=Relaxed results

  const isScanning = loading // `loading` is for Step 2 (Fundamental Scan)
  // const isScanningTechnicals = technicalLoading // This is the correct state for technical scanning

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const fetchWithRetry = async (url: string, maxRetries = 3, initialDelay = 1000): Promise<Response> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await fetch(url)

      // If rate limited, wait and retry with exponential backoff
      if (response.status === 429) {
        const retryDelay = initialDelay * Math.pow(2, attempt) // 1s, 2s, 4s
        console.log(`[v0] ⏳ Rate limit hit. Retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await delay(retryDelay)
        continue
      }

      return response
    }

    // If all retries exhausted, return the last response
    return fetch(url)
  }

  const calculateSMA = (prices: number[], period: number): number => {
    if (prices.length < period) return 0
    const slice = prices.slice(-period)
    return slice.reduce((sum, price) => sum + price, 0) / period
  }

  const calculateRSI = (closes: number[], period = 14): number => {
    if (closes.length < period + 1) return 50

    const changes: number[] = []
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1])
    }

    const recentChanges = changes.slice(-period)
    const gains = recentChanges.filter((c) => c > 0)
    const losses = recentChanges.filter((c) => c < 0).map((c) => Math.abs(c))

    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0

    if (avgLoss === 0) return 100
    const rs = avgGain / avgLoss
    return 100 - 100 / (1 + rs)
  }

  const calculateBollingerBands = (closes: number[], period = 20): { upper: number; middle: number; lower: number } => {
    if (closes.length < period) return { upper: 0, middle: 0, lower: 0 }

    const slice = closes.slice(-period)
    const middle = slice.reduce((sum, price) => sum + price, 0) / period
    const variance = slice.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period
    const stdDev = Math.sqrt(variance)

    return {
      upper: middle + 2 * stdDev,
      middle,
      lower: middle - 2 * stdDev,
    }
  }

  const calculateMACD = (closes: number[]): { macd: number; signal: number; histogram: number } => {
    if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 }

    const ema12 = calculateEMA(closes, 12)
    const ema26 = calculateEMA(closes, 26)
    const macd = ema12 - ema26

    const signal = macd * 0.9
    const histogram = macd - signal

    return { macd, signal, histogram }
  }

  const calculateEMA = (prices: number[], period: number): number => {
    if (prices.length === 0) return 0
    const k = 2 / (period + 1)
    let ema = prices[0]

    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k)
    }

    return ema
  }

  const calculateStochastic = (closes: number[], highs: number[], lows: number[], period = 14): number => {
    if (closes.length < period || highs.length < period || lows.length < period) return 50

    const recentCloses = closes.slice(-period)
    const recentHighs = highs.slice(-period)
    const recentLows = lows.slice(-period)

    const currentClose = recentCloses[recentCloses.length - 1]
    const highestHigh = Math.max(...recentHighs)
    const lowestLow = Math.min(...recentLows)

    if (highestHigh === lowestLow) return 50

    return ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100
  }

  const calculateATR = (highs: number[], lows: number[], closes: number[], period = 14): number => {
    if (highs.length < period + 1) return 0

    const trueRanges: number[] = []
    for (let i = 1; i < highs.length; i++) {
      const high = highs[i]
      const low = lows[i]
      const prevClose = closes[i - 1]

      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
      trueRanges.push(tr)
    }

    const recentTR = trueRanges.slice(-period)
    return recentTR.reduce((sum, tr) => sum + tr, 0) / period
  }

  // Extract earnings data from Polygon snapshot
  const extractEarningsData = (tickerData: any, currentPrice: number, atrPercent: number) => {
    const earningsTimestamp = tickerData?.next_earnings_date
    let earningsDate: string | undefined
    let daysToEarnings: number | undefined
    let expectedMove: number | undefined

    if (earningsTimestamp) {
      const earnDate = new Date(earningsTimestamp)
      earningsDate = earnDate.toLocaleDateString()
      const today = new Date()
      daysToEarnings = Math.floor((earnDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      if (daysToEarnings >= 0 && daysToEarnings <= 30) {
        expectedMove = currentPrice * (atrPercent / 100) * Math.sqrt(Math.max(daysToEarnings, 1) / 7) * 1.5
      }
    }

    return { earningsDate, daysToEarnings, expectedMove }
  }

  const getCurrentDate = async (): Promise<Date> => {
    try {
      const response = await fetch("/api/time-server")
      if (response.ok) {
        const data = await response.json()
        console.log("[v0] Time server response:", {
          date: data.date,
          dayOfWeek: data.day_of_week,
          timezone: data.timezone,
          fallback: data.fallback || false,
        })
        return new Date(data.datetime)
      }
    } catch (error) {
      console.log("[v0] Time server failed, using local time:", error)
    }
    return new Date() // Fallback to local time
  }

  const getNextTwoFridays = async (): Promise<[string, string]> => {
    const today = await getCurrentDate()

    // Calculate next Friday
    const dayOfWeek = today.getDay()
    let daysUntilFriday: number
    if (dayOfWeek === 5) {
      daysUntilFriday = 7
    } else if (dayOfWeek === 6) {
      daysUntilFriday = 6
    } else {
      daysUntilFriday = 5 - dayOfWeek
    }

    const nextFriday = new Date(today)
    nextFriday.setDate(today.getDate() + daysUntilFriday)

    const followingFriday = new Date(nextFriday)
    followingFriday.setDate(nextFriday.getDate() + 7)

    return [nextFriday.toISOString().split("T")[0], followingFriday.toISOString().split("T")[0]]
  }

  const getNextFriday = async () => {
    const today = await getCurrentDate()
    const dayOfWeek = today.getDay() // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday

    console.log("[v0] Current date:", {
      date: today.toISOString().split("T")[0],
      dayOfWeek: dayOfWeek,
      dayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek],
    })

    // Calculate days until next Friday
    let daysUntilFriday: number
    if (dayOfWeek === 5) {
      // Today is Friday, get next Friday (7 days)
      daysUntilFriday = 7
    } else if (dayOfWeek === 6) {
      // Today is Saturday, Friday is 6 days away
      daysUntilFriday = 6
    } else {
      // Sunday (0) through Thursday (4)
      daysUntilFriday = 5 - dayOfWeek
    }

    const nextFriday = new Date(today)
    nextFriday.setDate(today.getDate() + daysUntilFriday)

    const fridayDate = nextFriday.toISOString().split("T")[0]

    console.log("[v0] Next Friday calculation:", {
      today: today.toISOString().split("T")[0],
      daysUntilFriday,
      nextFriday: fridayDate,
      nextFridayDayOfWeek: nextFriday.getDay(), // Should always be 5
    })

    // Verify it's actually a Friday
    if (nextFriday.getDay() !== 5) {
      console.error("[v0] ⚠️ ERROR: Calculated date is not a Friday!", {
        calculated: fridayDate,
        dayOfWeek: nextFriday.getDay(),
      })
    }

    return fridayDate // YYYY-MM-DD format
  }

  const scanFundamentals = async () => {
    console.log("[v0] 🔴🔴🔴🔴🔴 SCAN FUNDAMENTALS CALLED 🔴🔴🔴🔴🔴")
    console.log("[v0] Time:", new Date().toISOString())

    const tickers = tickersToScan
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length > 0)

    if (tickers.length === 0) {
      setError("Please enter at least one ticker symbol")
      return
    }

    const cacheParams = {
      minVolume: minVolume[0],
      maxDebtToEquity: maxDebtToEquity[0],
      minROE: minROE[0],
      minProfitableQuarters: minProfitableQuarters[0],
      minMarketCapCategory: minMarketCapCategory[0],
      tickers: tickers.join(","), // Use joined tickers for cache key
    }

    const cacheKey = generateCacheKey(cacheParams)
    console.log("[v0] 🔵 Generated cache key:", cacheKey)
    console.log("[v0] 🔵 Cache params:", JSON.stringify(cacheParams, null, 2))

    const rawCache = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null
    console.log("[v0] 🔵 Raw localStorage value:", rawCache ? "EXISTS" : "NULL")

    const cached = loadFromCache(cacheKey)
    console.log("[v0] 🔵 loadFromCache result:", cached ? `FOUND ${cached.length} stocks` : "NULL")

    if (cached && Array.isArray(cached) && cached.length > 0) {
      console.log("[v0] ✅✅✅ CACHE HIT! Using cached data ✅✅✅")
      setFundamentalResults(cached)
      setCacheStatus("✅ Using cached fundamental scan (saved today)")
      setLoading(false)
      setStep(2)
      return
    }

    console.log("[v0] ❌ No valid cache - Starting fresh scan")
    setCacheStatus("")

    setLoading(true)
    setError(null)
    setFundamentalResults([])
    setTechnicalResults([])
    setTechnicalScanAttempted(false)
    setScanProgress(0)
    setCurrentTicker("")

    try {
      console.log(`[v0] Step 2: Scanning ${tickers.length} stocks with Polygon API`)
      console.log(`[v0] Using optimized batch processing for paid account: 5 stocks at a time with 1000ms delays`)

      const qualifyingStocks: QualifyingStock[] = []
      const skippedTickers: string[] = []

      const batchSize = 2 // Reduced from 5 to 2 for better rate limit compliance
      const batchDelay = 2000 // Increased from 1000ms to 2000ms between batches
      const apiDelay = 300 // Increased from 100ms to 300ms between API calls

      for (let i = 0; i < tickers.length; i += batchSize) {
        const batch = tickers.slice(i, i + batchSize)

        const batchPromises = batch.map(async (ticker, batchIndex) => {
          try {
            const currentIndex = i + batchIndex
            setScanProgress(Math.floor(((currentIndex + 1) / tickers.length) * 100))
            setCurrentTicker(ticker)

            const snapshotRes = await fetchWithRetry(`/api/polygon-proxy?endpoint=snapshot&ticker=${ticker}`)
            await delay(apiDelay)

            const financialsRes = await fetchWithRetry(`/api/polygon-proxy?endpoint=financials&ticker=${ticker}`)
            await delay(apiDelay)

            const aggregatesRes = await fetchWithRetry(`/api/polygon-proxy?endpoint=aggregates&ticker=${ticker}`)

            if (snapshotRes.status === 429 || financialsRes.status === 429 || aggregatesRes.status === 429) {
              console.log(`[v0] ⚠️ ${ticker} - Rate limit hit after retries. Skipping...`)
              skippedTickers.push(ticker)
              return null
            }

            if (!snapshotRes.ok || !aggregatesRes.ok) {
              console.log(`[v0] ⚠️ ${ticker} - Polygon API error. Skipping...`)
              skippedTickers.push(ticker)
              return null
            }

            const snapshotData = await snapshotRes.json()
            const financialsData = await financialsRes.json()
            const aggregatesData = await aggregatesRes.json()

            console.log(`[v0] ${ticker} - Raw Polygon snapshot:`, JSON.stringify(snapshotData.ticker, null, 2))
            console.log(
              `[v0] ${ticker} - Raw Polygon financials:`,
              JSON.stringify(financialsData.results?.[0], null, 2),
            )

            const ticker_data = snapshotData.ticker
            const prevDay = ticker_data?.prevDay || {}
            const day = ticker_data?.day || {}

            const currentPrice = day.c || prevDay.c || 0
            const volume = day.v || prevDay.v || 0
            const volumeInMillions = volume / 1000000

            const financials = financialsData.results?.[0]?.financials || {}
            const income_statement = financials.income_statement || {}
            const balance_sheet = financials.balance_sheet || {}

            const revenues = income_statement.revenues?.value || 0
            const net_income = income_statement.net_income_loss?.value || 0
            const total_assets = balance_sheet.assets?.value || 0
            const stockholders_equity = balance_sheet.equity?.value || 0
            const total_liabilities = balance_sheet.liabilities?.value || 0

            // Extract shares outstanding from multiple possible sources
            const basic_shares = income_statement.basic_average_shares?.value || 0
            const shares_outstanding =
              ticker_data?.shares_outstanding ||
              ticker_data?.weighted_shares_outstanding ||
              financialsData.results?.[0]?.shares_outstanding ||
              basic_shares ||
              0

            // Extract EPS directly from income statement (REAL DATA)
            const eps =
              income_statement.diluted_earnings_per_share?.value ||
              income_statement.basic_earnings_per_share?.value ||
              (shares_outstanding > 0 && net_income ? net_income / shares_outstanding : 0)

            // Calculate Market Cap: Price × Shares Outstanding
            let marketCap = 0
            if (shares_outstanding > 0) {
              marketCap = currentPrice * shares_outstanding
            } else if (ticker_data?.market_cap) {
              marketCap = ticker_data.market_cap
            } else {
              // Fallback: estimate from financials (PE ratio method)
              // If PE is typically 15-20 for large caps, and we have net income
              if (net_income > 0 && eps > 0) {
                marketCap = (currentPrice / eps) * net_income
              }
            }

            // Calculate PE Ratio
            let peRatio = 0
            if (eps > 0) {
              peRatio = currentPrice / eps
            } else if (marketCap > 0 && net_income > 0) {
              // Fallback: use market cap / net income as approximation
              peRatio = marketCap / net_income
            }

            // Calculate Debt-to-Equity
            const debtToEquity = stockholders_equity > 0 ? total_liabilities / stockholders_equity : 0

            // Calculate ROE (Return on Equity) - REAL DATA
            const roe = stockholders_equity > 0 ? (net_income / stockholders_equity) * 100 : 0

            const earningsTimestamp =
              snapshotData.ticker?.earnings?.announcement_date ||
              snapshotData.ticker?.earnings_date ||
              ticker_data?.next_earnings_date ||
              snapshotData.results?.earnings?.date

            let earningsDate: string | undefined
            let daysToEarnings: number | undefined

            if (earningsTimestamp) {
              const earnDate = new Date(earningsTimestamp)
              earningsDate = earnDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              const today = new Date()
              daysToEarnings = Math.floor((earnDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            }

            console.log(
              `[v0] ${ticker}: Price=$${currentPrice.toFixed(2)}, EPS=$${eps.toFixed(4)}, PE=${peRatio.toFixed(1)}, MarketCap=$${(marketCap / 1e9).toFixed(1)}B, Vol=${volumeInMillions.toFixed(1)}M, D/E=${debtToEquity.toFixed(2)}, ROE=${roe.toFixed(1)}%${earningsDate ? `, Earnings: ${earningsDate} (${daysToEarnings}d)` : " (no earnings date)"} ${eps > 0 ? "(REAL EPS)" : "(ESTIMATED PE)"}`,
            )

            // Apply filters with REAL data from Polygon
            const minVolumeValue = minVolume[0]
            const maxDebtValue = maxDebtToEquity[0]
            const minROEValue = minROE[0]

            // Filter 1: Volume (real data)
            if (volumeInMillions < minVolumeValue) {
              console.log(`[v0]   ❌ ${ticker}: Volume ${volumeInMillions.toFixed(1)}M < ${minVolumeValue}M`)
              return null
            }

            // Filter 3: Debt-to-Equity (real data)
            if (debtToEquity > 0 && debtToEquity > maxDebtValue) {
              console.log(`[v0]   ❌ ${ticker}: D/E ${debtToEquity.toFixed(2)} > ${maxDebtValue}`)
              return null
            }

            // Filter 4: ROE (real data) - reject if below minimum (including 0%)
            if (roe < minROEValue) {
              console.log(`[v0]   ❌ ${ticker}: ROE ${roe.toFixed(1)}% < ${minROEValue}%`)
              return null
            }
            // Filter 5: Profitable Quarters (REAL DATA)
            if (minProfitableQuarters[0] > 0 && eps <= 0) {
              console.log(`[v0]   ❌ ${ticker}: EPS ${eps.toFixed(2)} <= 0 (unprofitable)`)
              return null
            }
            const marketCapThresholds = [0, 300_000_000, 2_000_000_000, 10_000_000_000]
            const minMarketCapValue = marketCapThresholds[minMarketCapCategory[0]]
            if (minMarketCapValue > 0 && marketCap < minMarketCapValue) {
              console.log(
                `[v0]   ❌ ${ticker}: Market Cap $${(marketCap / 1e9).toFixed(1)}B < $${(minMarketCapValue / 1e9).toFixed(1)}B`,
              )
              return null
            }

            console.log(`[v0]   ✅ ${ticker} PASSED all filters with REAL Polygon data`)

            const historicalData = aggregatesData.results || []
            const closes = historicalData.map((bar: any) => bar.c).filter((c: number) => c != null)
            const highs = historicalData.map((bar: any) => bar.h).filter((h: number) => h != null)
            const lows = historicalData.map((bar: any) => bar.l).filter((l: number) => l != null)

            const sma50 = calculateSMA(closes, 50)
            const sma100 = calculateSMA(closes, 100)
            const sma200 = calculateSMA(closes, 200)
            const rsi = calculateRSI(closes, 14)
            const bb = calculateBollingerBands(closes, 20)
            const bbPosition =
              currentPrice <= bb.lower ? "Below" : currentPrice <= bb.middle ? "Lower Half" : "Upper Half"
            const macd = calculateMACD(closes)
            const macdSignal = macd.macd > macd.signal ? "Bullish" : "Bearish"
            const stochastic = calculateStochastic(closes, highs, lows, 14)
            const atr = calculateATR(highs, lows, closes, 14)
            const atrPercent = atr > 0 ? (atr / currentPrice) * 100 : 2.5
            const redDay = closes.length >= 2 && closes[closes.length - 1] < closes[closes.length - 2]

            const {
              earningsDate: finalEarningsDate,
              daysToEarnings: finalDaysToEarnings,
              expectedMove: fundamentalExpectedMove,
            } = extractEarningsData(ticker_data, currentPrice, atrPercent)

            // Calculate estimated premium and yield
            const putStrike = currentPrice * 0.95
            const daysToExpiration = 7

            let premiumMultiplier = 1.0
            if (finalDaysToEarnings !== undefined && finalDaysToEarnings >= 0 && finalDaysToEarnings <= 14) {
              premiumMultiplier = 1.5 + ((14 - finalDaysToEarnings) / 14) * 0.3
            }

            const estimatedPremium = atr * 0.4 * Math.sqrt(daysToExpiration / 7) * premiumMultiplier
            const yieldPercent = putStrike > 0 ? (estimatedPremium / putStrike) * 100 : 0
            const volatilityAdjustedYield = yieldPercent * (1 + (atrPercent - 2) * 0.1)
            const finalYield = Math.max(0.5, Math.min(5, volatilityAdjustedYield))

            const estimatedDelta = -0.3

            const stockEarningsDate = earningsDate || finalEarningsDate
            const stockDaysToEarnings = daysToEarnings !== undefined ? daysToEarnings : finalDaysToEarnings

            return {
              ticker,
              currentPrice,
              peRatio: peRatio > 0 ? Number(peRatio.toFixed(1)) : 0,
              avgVolume: Number(volumeInMillions.toFixed(2)),
              last4EPS: eps > 0 ? [eps, eps, eps, eps] : [0, 0, 0, 0], // Use real EPS instead of placeholder
              sma50,
              sma100,
              sma200,
              uptrend: sma50 > sma200,
              rsi: Number(rsi.toFixed(1)),
              bollingerPosition: bbPosition,
              macdSignal,
              stochastic: Number(stochastic.toFixed(1)),
              atr: Number(atr.toFixed(2)),
              atrPercent: Number(atrPercent.toFixed(2)),
              putStrike: Number(putStrike.toFixed(2)),
              premium: Number(estimatedPremium.toFixed(2)),
              yield: Number(finalYield.toFixed(2)),
              delta: estimatedDelta,
              deltaSource: "estimated", // Default to estimated for fundamental scan
              marketCap: marketCap > 0 ? Number((marketCap / 1_000_000_000).toFixed(1)) : 0, // Store market cap in billions
              redDay,
              earningsDate: stockEarningsDate, // Use real earnings date
              daysToEarnings: stockDaysToEarnings, // Use real days to earnings
              expectedMove: fundamentalExpectedMove,
              volume: volume, // Store raw volume
              roe: Number(roe.toFixed(1)), // Return on Equity percentage
              debtToEquity: Number(debtToEquity.toFixed(2)), // Debt-to-Equity ratio
            }
          } catch (err) {
            console.log(`[v0] Error processing ${ticker}:`, err)
            skippedTickers.push(ticker)
            return null
          }
        })

        const batchResults = await Promise.all(batchPromises)
        const validResults = batchResults.filter((r): r is QualifyingStock => r !== null)
        qualifyingStocks.push(...validResults)

        if (i + batchSize < tickers.length) {
          await delay(batchDelay)
        }
      }

      setScanProgress(100)
      setCurrentTicker("")

      console.log(
        `[v0] ✅ Step 2 Complete with REAL Polygon data: ${qualifyingStocks.length} passed out of ${tickers.length} scanned`,
      )

      if (skippedTickers.length > 0) {
        console.log(`[v0] Skipped tickers: ${skippedTickers.join(", ")}`)
      }

      const qualified = qualifyingStocks // Alias for clarity
      setFundamentalResults(qualified)
      setLoading(false)
      setScanProgress(0)
      setCurrentTicker("")
      setStep(2)
      setCacheStatus("Fundamental scan completed and cached (valid until tomorrow 9:30 AM ET)")

      saveToCache(cacheKey, qualified)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while scanning")
      console.error("[v0] Scan error:", err)
    } finally {
      setLoading(false)
      setScanProgress(0)
      setCurrentTicker("")
    }
  }

  const enrichWithOptionsData = async (
    stocks: QualifyingStock[],
    onProgress?: (current: number, total: number, ticker: string) => void,
  ): Promise<QualifyingStock[]> => {
    console.log("[v0] ================================================")
    console.log("[v0] ENRICHING WITH OPTIONS DATA")
    console.log("[v0] ================================================")

    const enriched: QualifyingStock[] = []
    const [nextFriday, followingFriday] = await getNextTwoFridays()
    console.log(`[v0] Target expiries: Next Friday=${nextFriday}, Following Friday=${followingFriday}`)

    let processedCount = 0
    const totalStocks = stocks.length

    for (const stock of stocks) {
      processedCount++
      if (onProgress) {
        onProgress(processedCount, totalStocks, stock.ticker)
      }

      try {
        let availableExpiries: string[] = []

        try {
          const expiriesRes = await fetch(`/api/polygon-proxy?endpoint=options-expiries&ticker=${stock.ticker}`)
          await delay(200)

          if (expiriesRes.ok) {
            const expiriesData = await expiriesRes.json()
            const contracts = expiriesData.results || []

            // Extract unique expiry dates from contracts
            const expirySet = new Set<string>()
            for (const contract of contracts) {
              if (contract.expiration_date) {
                expirySet.add(contract.expiration_date)
              }
            }
            availableExpiries = Array.from(expirySet).sort()
            console.log(
              `[v0] ${stock.ticker} - Found ${availableExpiries.length} available expiry dates: ${availableExpiries.slice(0, 5).join(", ")}${availableExpiries.length > 5 ? "..." : ""}`,
            )
          }
        } catch (expiriesError) {
          console.error(`[v0] ${stock.ticker} - Error fetching expiries:`, expiriesError)
        }

        let expiryDatesToUse: string[] = []

        if (availableExpiries.length > 0) {
          // Find the 2 nearest expiries that are at least 2 days out
          const today = new Date()
          const minDate = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000) // At least 2 days out

          const validExpiries = availableExpiries.filter((exp) => new Date(exp) >= minDate)
          expiryDatesToUse = validExpiries.slice(0, 2) // Take first 2

          console.log(`[v0] ${stock.ticker} - Using actual expiries: ${expiryDatesToUse.join(", ")}`)
        } else {
          // Fallback to calculated Fridays
          expiryDatesToUse = [nextFriday, followingFriday].filter(Boolean)
          console.log(`[v0] ${stock.ticker} - Using calculated Friday expiries: ${expiryDatesToUse.join(", ")}`)
        }

        for (const expiryDate of expiryDatesToUse) {
          if (!expiryDate) continue

          const daysToExpiry = Math.max(
            0,
            Math.floor((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) + 1,
          )

          console.log(
            `[v0] ${stock.ticker} - Fetching options chain snapshot for expiry: ${expiryDate} (${daysToExpiry} days away)`,
          )

          let contracts: any[] = []
          let useEstimatedGreeks = false

          // Try snapshot API first (has greeks and quotes)
          try {
            const chainSnapshotRes = await fetch(
              `/api/polygon-proxy?endpoint=options-chain-snapshot&ticker=${stock.ticker}&expiry_date=${expiryDate}&option_type=put`,
            )
            await delay(300)

            if (chainSnapshotRes.ok) {
              const chainSnapshotData = await chainSnapshotRes.json()
              contracts = chainSnapshotData.results || []
              console.log(`[v0] ${stock.ticker} - Snapshot API returned ${contracts.length} contracts`)
            }
          } catch (fetchError) {
            console.error(`[v0] ${stock.ticker} - Snapshot API error:`, fetchError)
          }

          if (contracts.length === 0 && availableExpiries.length > 0) {
            console.log(
              `[v0] ${stock.ticker} - Snapshot empty, using contracts from expiries API (market may be closed)`,
            )
            useEstimatedGreeks = true

            try {
              // Fetch all contracts for this ticker and filter by expiry
              const contractsRes = await fetch(
                `/api/polygon-proxy?endpoint=options-chain&ticker=${stock.ticker}&expiry_date=${expiryDate}&option_type=put`,
              )
              await delay(300)

              if (contractsRes.ok) {
                const contractsData = await contractsRes.json()
                const rawContracts = contractsData.results || []
                console.log(
                  `[v0] ${stock.ticker} - Contracts API returned ${rawContracts.length} contracts for ${expiryDate}`,
                )

                // Transform contracts API format to match snapshot format
                contracts = rawContracts.map((c: any) => ({
                  details: {
                    strike_price: c.strike_price,
                    ticker: c.ticker,
                    expiration_date: c.expiration_date,
                  },
                  // These will be estimated since market is closed
                  greeks: null,
                  last_quote: null,
                  last_trade: null,
                  day: null,
                }))
              }
            } catch (fallbackError) {
              console.error(`[v0] ${stock.ticker} - Contracts API fallback error:`, fallbackError)
            }
          }

          console.log(`[v0] ${stock.ticker} - Found ${contracts.length} put contracts for ${expiryDate}`)

          if (contracts.length === 0) {
            console.log(`[v0] ${stock.ticker} - No options found for ${expiryDate}`)
            continue
          }

          // Filter to relevant strike range (85-100% of current price)
          const relevantContracts = contracts.filter((contract: any) => {
            const strikePrice = contract.details?.strike_price
            if (!strikePrice) return false

            const percentOfPrice = strikePrice / stock.currentPrice
            return percentOfPrice >= 0.85 && percentOfPrice <= 1.0
          })

          console.log(
            `[v0] ${stock.ticker} - Filtered to ${relevantContracts.length} contracts in strike range (85-100% of price)`,
          )

          const optionsWithData: QualifyingStock[] = []

          for (const snapshot of relevantContracts) {
            const strikePrice = snapshot.details?.strike_price
            const optionTicker = snapshot.details?.ticker

            if (!strikePrice || !optionTicker) {
              continue
            }

            let delta: number | null = null
            let bid: number | undefined
            let ask: number | undefined
            let premium: number | undefined
            let priceSource = ""

            if (useEstimatedGreeks) {
              // Delta estimation based on moneyness (strike / stock price)
              const moneyness = strikePrice / stock.currentPrice
              // Simple delta estimation: OTM puts have delta between -0.5 and 0
              // At-the-money (moneyness = 1.0) ≈ -0.5 delta
              // 10% OTM (moneyness = 0.9) ≈ -0.25 delta
              // 15% OTM (moneyness = 0.85) ≈ -0.15 delta
              delta = -0.5 * Math.pow(moneyness, 3) // Simplified estimation

              // Estimate premium based on typical option pricing
              // Rule of thumb: ATM options ≈ 2-3% of stock price for weekly/bi-weekly
              const timeValue = daysToExpiry / 365
              const estimatedIV = 0.35 // Assume 35% IV as baseline
              const atmPremiumPercent = estimatedIV * Math.sqrt(timeValue) * 0.4
              const otmDiscount = Math.pow(moneyness, 2)
              premium = stock.currentPrice * atmPremiumPercent * otmDiscount
              bid = premium * 0.95
              ask = premium * 1.05
              priceSource = "estimated (market closed)"

              console.log(
                `[v0] ${stock.ticker} - Estimated: Strike=$${strikePrice.toFixed(2)}, Delta=${delta.toFixed(3)}, Premium=$${premium.toFixed(2)}`,
              )
            } else {
              // Use actual data from snapshot
              delta = snapshot.greeks?.delta || null

              if (snapshot.last_quote?.bid_price && snapshot.last_quote?.ask_price) {
                bid = snapshot.last_quote.bid_price
                ask = snapshot.last_quote.ask_price
                premium = (bid + ask) / 2
                priceSource = "last_quote"
              } else if (snapshot.last_trade?.price) {
                premium = snapshot.last_trade.price
                bid = premium * 0.995
                ask = premium * 1.005
                priceSource = "last_trade"
              } else if (snapshot.day?.close) {
                premium = snapshot.day.close
                bid = premium
                ask = premium
                priceSource = "day_data"
              }
            }

            const deltaMin = useEstimatedGreeks ? -0.45 : -0.35
            const deltaMax = useEstimatedGreeks ? -0.15 : -0.25

            if (!delta || delta > deltaMax || delta < deltaMin) {
              if (!useEstimatedGreeks) {
                console.log(
                  `[v0] ${stock.ticker} - Skipping strike $${strikePrice}, delta ${delta?.toFixed(3)} outside range [${deltaMin}, ${deltaMax}]`,
                )
              }
              continue
            }

            if (!premium || !bid || !ask) {
              console.log(`[v0] ${stock.ticker} - No valid pricing for strike $${strikePrice}`)
              continue
            }

            const yieldPercent = (premium * 100) / strikePrice
            const optionDaysToExpiry = Math.max(
              0,
              Math.floor((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) + 1,
            )
            const annualizedYield = optionDaysToExpiry > 0 ? (yieldPercent * 365) / optionDaysToExpiry : 0

            console.log(
              `[v0] ✅ ${stock.ticker} - Strike=$${strikePrice.toFixed(2)}, Premium=$${premium.toFixed(2)}, Delta=${delta.toFixed(3)}, Bid=$${bid.toFixed(2)}, Ask=$${ask.toFixed(2)} [${priceSource}]`,
            )

            optionsWithData.push({
              ...stock,
              putStrike: strikePrice,
              premium: premium,
              yield: yieldPercent,
              annualizedYield: annualizedYield,
              delta: delta,
              daysToExpiry: optionDaysToExpiry,
              expiryDate,
              bidPrice: bid,
              askPrice: ask,
            })
          }

          if (optionsWithData.length === 0) {
            console.log(`[v0] ${stock.ticker} - No options with valid data for ${expiryDate}`)
            continue
          }

          // Sort by proximity to -0.30 delta
          optionsWithData.sort((a, b) => {
            const aDist = Math.abs((a.delta || 0) - -0.3)
            const bDist = Math.abs((b.delta || 0) - -0.3)
            return aDist - bDist
          })

          const top3Options = optionsWithData.slice(0, 3)

          console.log(`[v0] ✅ ${stock.ticker} - Adding ${top3Options.length} options for ${expiryDate}:`)
          top3Options.forEach((opt) => {
            console.log(
              `[v0]    - Strike=$${opt.putStrike?.toFixed(2)}, Premium=$${opt.premium?.toFixed(2)}, Delta=${opt.delta?.toFixed(3)}, Yield=${opt.yield?.toFixed(2)}%, Annual=${opt.annualizedYield?.toFixed(1)}%`,
            )
          })

          enriched.push(...top3Options)
        } // End loop for expiry dates
      } catch (error) {
        console.error(`[v0] ${stock.ticker} - Error processing options data:`, error)
        console.log(`[v0] ${stock.ticker} - Skipping due to error, continuing with next stock`)
        continue
      }
    } // End of loop through stocks

    console.log("[v0] ================================================")
    console.log(`[v0] Final enriched results: ${enriched.length} stock/expiry combinations`)
    console.log("[v0] ================================================")

    return enriched
  }

  const scanTechnicals = async () => {
    setStep(3)
    setHasAttemptedTechnicalScan(true)

    console.log("[v0] 🟢 Run Technical Analysis (Step 3) button clicked")
    console.log("[v0] fundamentalResults.length:", fundamentalResults.length)
    console.log("[v0] Current technicalResults.length:", technicalResults.length)

    if (fundamentalResults.length === 0) {
      setError("Please complete Step 2 first (Scan Fundamentals)")
      setStep(2)
      return
    }

    setIsScanningTechnicals(true)
    setTechnicalProgress(0)
    setTechnicalCurrentTicker("")
    setError(null)

    const technicalCacheKey = `technical_scan_${CACHE_VERSION}_${maxRSI[0]}_${maxStochastic[0]}_${minATR[0]}_${maxATR[0]}_${requireBollingerBands}_${requireAbove200SMA}_${requireAbove50SMA}_${requireGoldenCross}_${requireMACDBullish}_${requireRedDay}_${minYield[0]}_${minVolumeTechnicals[0]}_${fundamentalResults
      .map((s) => s.ticker)
      .join(",")
      .substring(0, 100)}`

    console.log("[v0] Technical scan cache check:", technicalCacheKey)
    const cached = loadFromCache(technicalCacheKey)
    if (cached) {
      console.log("[v0] ✅ Step 3: Using cached technical analysis results (same filters, same day)")
      console.log("[v0] Cached results count:", cached.length)
      setTechnicalResults(cached)
      setCacheStatus("Technical analysis completed and cached (parameters match, valid until tomorrow 9:30 AM ET)")
      setIsScanningTechnicals(false)
      console.log(`[v0] ✅ technicalResults state updated with ${cached.length} stocks`)
      console.log("[v0] Tickers:", cached.map((s: QualifyingStock) => s.ticker).join(", "))
      return
    }

    setTechnicalScanAttempted(true)
    setTechnicalLoading(true)
    setError(null)
    setTechnicalResults([])
    setTechnicalProgress(0)
    setTechnicalCurrentTicker("")

    try {
      console.log(
        `[v0] Step 3: Fetching real options premium data and filtering by slider criteria for ${fundamentalResults.length} stocks`,
      )

      const enrichedStocks = await enrichWithOptionsData(fundamentalResults, (current, total, ticker) => {
        setTechnicalProgress(Math.round((current / total) * 100))
        setTechnicalCurrentTicker(ticker)
      })

      const filteredStocks = enrichedStocks.filter((stock) => {
        const criteria = checkTechnicalCriteria(stock)
        const passesAll = Object.values(criteria).every(Boolean)
        if (!passesAll) {
          console.log(
            `[v0] ${stock.ticker} (Strike: $${stock.putStrike?.toFixed(2)}) - FILTERED OUT:`,
            Object.entries(criteria)
              .filter(([_, v]) => !v)
              .map(([k]) => k)
              .join(", "),
          )
        }
        return passesAll
      })

      console.log(
        `[v0] Enriched: ${enrichedStocks.length} options, After filtering: ${filteredStocks.length} pass all criteria`,
      )
      setTechnicalResults(filteredStocks)

      console.log(
        `[v0] ✅ Step 3 Complete: ${filteredStocks.length} stocks passed technical filters (and enriched with options data)`,
      )

      saveToCache(technicalCacheKey, filteredStocks)
      setCacheStatus(`Technical analysis completed and cached (valid until tomorrow 9:30 AM ET)`)

      setIsScanningTechnicals(false)
      console.log(`[v0] 📊 Step 3 Complete! ${filteredStocks.length} stocks passed technical analysis`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during technical analysis")
      console.error("[v0] Technical analysis error:", err)
      setIsScanningTechnicals(false)
    } finally {
      setTechnicalLoading(false)
      setTechnicalProgress(0)
      setTechnicalCurrentTicker("")
      setCacheStatus(`Technical analysis completed and cached (valid until tomorrow 9:30 AM ET)`)
    }
  }

  const loadPreFilteredTickers = async () => {
    console.log("[v0] 🟢 Scan for Potential Stocks (Step 1) button clicked")
    setIsLoadingPreFilter(true) // Renamed from preFilterLoading

    setPreFilterProgress(0)
    setPreFilterCurrentTicker("")
    setError(null)

    try {
      const marketCapThreshold = [0, 300_000_000, 2_000_000_000, 10_000_000_000, 50_000_000_000][preFilterMarketCap[0]]
      const minVolumeValue = preFilterLiquidity[0] * 1000000
      const topRankedLimit = getTopRankedValue(preFilterTopRanked[0])

      console.log("[v0] Step 1 Filter Parameters:")
      console.log(
        `  - Market Cap: $${(marketCapThreshold / 1000000000).toFixed(1)}B+ (${["Any", "Small", "Mid", "Large", "Mega"][preFilterMarketCap[0]]})`,
      )
      console.log(`  - Min Volume: ${(minVolumeValue / 1000000).toFixed(1)}M`)
      console.log(`  - Top Ranked: ${getTopRankedLabel(preFilterTopRanked[0])} (limit to ${topRankedLimit} stocks)`)

      setPreFilterProgress(10)
      setPreFilterCurrentTicker("Fetching major index tickers...")

      const response = await fetch(
        `/api/polygon-tickers?minMarketCap=${marketCapThreshold}&minVolume=${minVolumeValue}&limit=${topRankedLimit}`,
      )

      setPreFilterProgress(50)
      setPreFilterCurrentTicker("Filtering by volume and market cap...")

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || response.statusText)
      }

      const data = await response.json()

      setPreFilterProgress(90)
      setPreFilterCurrentTicker("Processing results...")

      if (data.tickers && Array.isArray(data.tickers)) {
        const tickers = data.tickers.sort((a, b) => a.localeCompare(b))
        setTickersToScan(tickers.join(", "))
        setPreFilterCount(tickers.length)
        setPreFilterProgress(100)
        setPreFilterCurrentTicker("")
        console.log(`[v0] ✅ Step 1 Complete: Loaded ${tickers.length} tickers`)
        console.log(`[v0] Tickers: ${tickers.slice(0, 10).join(", ")}${tickers.length > 10 ? "..." : ""}`)
        // Set step to 2 after step 1 completes
        setStep(2)
      } else {
        throw new Error("No tickers returned from API")
      }
    } catch (err: any) {
      console.error("[v0] Step 1 Error:", err)
      setError(`Step 1 failed: ${err.message}`)
      setPreFilterProgress(0)
      setPreFilterCurrentTicker("")
    } finally {
      setIsLoadingPreFilter(false) // Renamed from setPreFilterLoading
    }
  }

  const checkTechnicalCriteria = (stock: QualifyingStock) => {
    // FIX: Ensure all criteria are correctly checked and return boolean
    const criteria = {
      rsiCheck: stock.rsi <= maxRSI[0],
      stochasticCheck: stock.stochastic <= maxStochastic[0],
      sma200Check: !requireAbove200SMA || (stock.sma200 > 0 && stock.currentPrice >= stock.sma200),
      sma50Check: !requireAbove50SMA || (stock.sma50 > 0 && stock.currentPrice >= stock.sma50),
      goldenCrossCheck: !requireGoldenCross || stock.uptrend,
      macdCheck: !requireMACDBullish || stock.macdSignal === "Bullish",
      atrCheck: stock.atrPercent >= minATR[0] && stock.atrPercent <= maxATR[0],
      bollingerCheck: !requireBollingerBands || stock.bollingerPosition !== "Upper Half",
      redDayCheck: !requireRedDay || stock.redDay,
      // FIX: Add yield check to criteria
      yieldCheck: stock.yield >= minYield[0],
      // FIX: Add volume check to criteria
      volumeCheck: stock.avgVolume >= minVolumeTechnicals[0],
    }
    return criteria
  }

  const resultsToDisplay = technicalResults.length > 0 ? technicalResults : fundamentalResults

  // Use sortedFundamentalResults for the fundamental results table
  const sortedFundamentalResults = [...fundamentalResults].sort((a, b) => {
    let aValue: number | string = 0
    let bValue: number | string = 0

    switch (fundamentalSortColumn) {
      case "ticker":
        aValue = a.ticker
        bValue = b.ticker
        break
      case "currentPrice":
        aValue = a.currentPrice
        bValue = b.currentPrice
        break
      case "peRatio":
        aValue = a.peRatio
        bValue = b.peRatio
        break
      case "marketCap":
        aValue = a.marketCap
        bValue = b.marketCap
        break
      case "roe":
        aValue = a.roe
        bValue = b.roe
        break
      case "avgVolume":
        aValue = a.avgVolume
        bValue = b.avgVolume
        break
      default:
        aValue = a.currentPrice
        bValue = b.currentPrice
    }

    if (typeof aValue === "string" && typeof bValue === "string") {
      return fundamentalSortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }

    return fundamentalSortDirection === "asc"
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number)
  })

  const sortedTechnicalStocks =
    technicalResults.length > 0
      ? [...technicalResults].sort((a, b) => {
          // First priority: stocks with earnings within 14 days
          const aHasUpcomingEarnings = a.daysToEarnings !== undefined && a.daysToEarnings >= 0 && a.daysToEarnings <= 14
          const bHasUpcomingEarnings = b.daysToEarnings !== undefined && b.daysToEarnings >= 0 && b.daysToEarnings <= 14

          if (aHasUpcomingEarnings && !bHasUpcomingEarnings) return -1
          if (!aHasUpcomingEarnings && bHasUpcomingEarnings) return 1

          // Then sort by selected column
          const aVal = a[sortColumn]
          const bVal = b[sortColumn]

          if (typeof aVal === "number" && typeof bVal === "number") {
            return sortDirection === "asc" ? aVal - bVal : bVal - aVal
          }

          if (sortColumn === "redDay" || sortColumn === "uptrend") {
            const aBool = Boolean(aVal)
            const bBool = Boolean(bVal)
            return sortDirection === "asc" ? Number(aBool) - Number(bBool) : Number(bBool) - Number(aBool)
          }

          if (typeof aVal === "string" && typeof bVal === "string") {
            return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
          }

          return 0
        })
      : [] // Initialize as empty array if no technical results

  // Sorting logic for relaxed results
  const sortedRelaxedResults = [...relaxedResults].sort((a, b) => {
    const aHasUpcomingEarnings = a.daysToEarnings !== undefined && a.daysToEarnings >= 0 && a.daysToEarnings <= 14
    const bHasUpcomingEarnings = b.daysToEarnings !== undefined && b.daysToEarnings >= 0 && b.daysToEarnings <= 14

    if (aHasUpcomingEarnings && !bHasUpcomingEarnings) return -1
    if (!aHasUpcomingEarnings && bHasUpcomingEarnings) return 1

    const aVal = a[relaxedSortColumn]
    const bVal = b[relaxedSortColumn]

    if (typeof aVal === "number" && typeof bVal === "number") {
      return relaxedSortDirection === "asc" ? aVal - bVal : bVal - aVal
    }

    if (relaxedSortColumn === "redDay") {
      const aBool = Boolean(aVal)
      const bBool = Boolean(bVal)
      if (relaxedSortDirection === "asc") {
        return Number(aBool) - Number(bBool)
      } else {
        return Number(bBool) - Number(aBool)
      }
    }

    return 0
  })

  const handleFundamentalSort = (column: string) => {
    if (fundamentalSortColumn === column) {
      setFundamentalSortDirection(fundamentalSortDirection === "asc" ? "desc" : "asc")
    } else {
      setFundamentalSortColumn(column)
      setFundamentalSortDirection("desc")
    }
  }

  const handleRelaxedSort = (column: keyof QualifyingStock) => {
    if (relaxedSortColumn === column) {
      setRelaxedSortDirection(relaxedSortDirection === "asc" ? "desc" : "asc")
    } else {
      setRelaxedSortColumn(column)
      setRelaxedSortDirection("asc")
    }
  }

  const handleSort = (column: keyof QualifyingStock) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  // Helper function to evaluate all technical criteria for relaxed results table
  const evaluateCriteria = (stock: QualifyingStock) => {
    return {
      rsiCheck: stock.rsi <= maxRSI[0],
      sma200Check: !requireAbove200SMA || (stock.sma200 > 0 && stock.currentPrice >= stock.sma200),
      sma50Check: !requireAbove50SMA || (stock.sma50 > 0 && stock.currentPrice >= stock.sma50),
      goldenCrossCheck: !requireGoldenCross || stock.uptrend,
      macdCheck: !requireMACDBullish || stock.macdSignal === "Bullish",
      stochasticCheck: stock.stochastic <= maxStochastic[0],
      atrCheck: stock.atrPercent >= minATR[0] && stock.atrPercent <= maxATR[0],
      bollingerCheck: !requireBollingerBands || stock.bollingerPosition !== "Upper Half",
      redDayCheck: !requireRedDay || stock.redDay,
      yieldCheck: stock.yield >= minYield[0],
      volumeCheck: stock.avgVolume >= minVolumeTechnicals[0],
    }
  }

  // Determine the current step based on state
  const currentStep =
    tickersToScan.trim().length === 0
      ? 1
      : fundamentalResults.length === 0 && !loading
        ? 2
        : !technicalScanAttempted || isScanningTechnicals
          ? 3
          : technicalResults.length > 0 || hasAttemptedTechnicalScan
            ? 4 // This means step 3 finished and produced results (or was attempted and not yet shown)
            : 3 // Default to step 3 if no results yet but attempted scan

  const toggleRelaxedResults = () => {
    setShowRelaxedResults((prev) => !prev)
    if (!showRelaxedResults) {
      setIsEnrichingRelaxed(true)
      setStep4Progress(0)
      setStep4CurrentTicker("")
      setRelaxedResults([]) // Clear previous relaxed results

      enrichWithOptionsData(fundamentalResults, (current, total, ticker) => {
        setStep4Progress(Math.round((current / total) * 100))
        setStep4CurrentTicker(ticker)
      })
        .then((enrichedResults) => {
          console.log(`[v0] Step 4: Enrichment complete with ${enrichedResults.length} total options`)

          // These are options that didn't make it to Step 3 strict results
          const relaxedOptions = enrichedResults.filter((stock) => {
            const criteria = checkTechnicalCriteria(stock)
            const passesAll = Object.values(criteria).every(Boolean)
            const passesSome = Object.values(criteria).some(Boolean)

            // Relaxed = passes at least some criteria but NOT all (would have been in Step 3 otherwise)
            // Also include options that pass none but have valid data (exploratory)
            if (passesAll) {
              console.log(
                `[v0] ${stock.ticker} $${stock.putStrike} - Passes ALL criteria (already in Step 3, excluding from Step 4)`,
              )
              return false
            }

            // Count how many criteria pass
            const passCount = Object.values(criteria).filter(Boolean).length
            const totalCriteria = Object.values(criteria).length
            console.log(
              `[v0] ${stock.ticker} $${stock.putStrike} - Passes ${passCount}/${totalCriteria} criteria (included in relaxed)`,
            )

            return true // Include all options that don't pass ALL criteria
          })

          console.log(
            `[v0] Step 4: ${relaxedOptions.length} options meet relaxed criteria (out of ${enrichedResults.length} total)`,
          )
          setRelaxedResults(relaxedOptions)
          setIsEnrichingRelaxed(false)
        })
        .catch((error) => {
          console.error("[v0] Error enriching relaxed results:", error)
          setError("Failed to enrich relaxed criteria results.")
          setIsEnrichingRelaxed(false)
        })
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Card className="w-full max-w-7xl mx-auto shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-target h-5 w-5 text-primary"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="6"></circle>
                <circle cx="12" cy="12" r="2"></circle>
              </svg>
              Sell Put Scanner
            </CardTitle>

            <div className="flex items-center gap-2">
              {/* CHANGE: Use TooltipsToggle and RefreshButton components */}
              <TooltipsToggle enabled={tooltipsEnabled} setEnabled={setTooltipsEnabled} />
              <RefreshButton onClick={() => {}} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-6">
          {/* STEP 1: PRE-FILTERING */}
          {step === 1 && (
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-3">
                <Info className="h-5 w-5 text-blue-700 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Smart Pre-Filtering (Step 1)</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    Customize your starting universe with advanced filters. All stocks are pre-qualified for active
                    options markets.
                  </p>
                </div>
              </div>

              <ul className="list-disc list-inside space-y-1 ml-7 text-sm text-gray-700 mb-4">
                <li>
                  <strong>Market Cap:</strong> Filter by company size (adjustable below)
                </li>
                <li>
                  <strong>Liquidity:</strong> Minimum recent daily trading volume - uses most recent trading day data,
                  not 30-day average (adjustable below)
                </li>
                <li>
                  <strong>Top By Market Cap:</strong> Largest companies by market capitalization from S&P 500,
                  Nasdaq-100, Dow indices (adjustable below)
                </li>
              </ul>

              {/* Step 1 Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    Min Market Cap
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">Market Capitalization Filter</p>
                          <p className="text-sm">
                            Filters stocks by total company value (shares × price). For put selling:
                          </p>
                          <ul className="text-sm mt-1 space-y-1">
                            <li>
                              <strong>Higher ($10B+):</strong> More stable, liquid options, lower assignment risk
                            </li>
                            <li>
                              <strong>Lower ($1B-$10B):</strong> Higher premiums but more volatility risk
                            </li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                        {["Any", "$300M+", "$2B+", "$10B+", "$50B+"][preFilterMarketCap[0]]}
                      </span>
                    </div>
                    <Slider
                      id="preFilterMarketCap"
                      value={preFilterMarketCap}
                      onValueChange={setPreFilterMarketCap}
                      min={0}
                      max={4}
                      step={1}
                      className="cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Any</span>
                      <span className="text-xs font-semibold">Company size filter</span>
                      <span>$50B+</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    Min Recent Day Volume
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">Trading Volume Filter</p>
                          <p className="text-sm">Daily shares traded. Critical for put sellers:</p>
                          <ul className="text-sm mt-1 space-y-1">
                            <li>
                              <strong>Higher (5M+):</strong> Tighter bid-ask spreads, easier exit
                            </li>
                            <li>
                              <strong>Lower (&lt;2M):</strong> Wider spreads = worse fills, harder to close
                            </li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                        {preFilterLiquidity[0]}M
                      </span>
                    </div>
                    <Slider
                      id="preFilterLiquidity"
                      value={preFilterLiquidity}
                      onValueChange={setPreFilterLiquidity}
                      min={0.5}
                      max={50}
                      step={0.5}
                      className="cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0.5M</span>
                      <span className="text-xs font-semibold">Ensure liquidity</span>
                      <span>50M</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    Top By Market Cap
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">Top Companies Selector</p>
                          <p className="text-sm">Limits scan to largest companies by market cap:</p>
                          <ul className="text-sm mt-1 space-y-1">
                            <li>
                              <strong>Top 10-50:</strong> Blue chips, most stable, lowest premiums
                            </li>
                            <li>
                              <strong>Top 100-500:</strong> Balance of safety and returns
                            </li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                        {getTopRankedLabel(preFilterTopRanked[0])}
                      </span>
                    </div>
                    <Slider
                      id="preFilterTopRanked"
                      value={preFilterTopRanked}
                      onValueChange={(val) => {
                        // Snap to specific points for better UX
                        const snapped = val[0] <= 16 ? [0] : val[0] <= 50 ? [33] : val[0] <= 83 ? [66] : [100]
                        setPreFilterTopRanked(snapped)
                      }}
                      min={0}
                      max={100}
                      step={1}
                      className="cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>Top 500</span>
                      <span className="text-[9px]">Top By Market Cap</span>
                      <span>Top 10</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={loadPreFilteredTickers}
            disabled={isLoadingPreFilter || isScanning || isScanningTechnicals}
            size="lg"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white text-lg font-bold py-6 transition-all hover:scale-105 mt-4"
          >
            {isLoadingPreFilter ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading Tickers...
              </>
            ) : (
              <>
                <Filter className="mr-2 h-5 w-5" />
                Scan for Potential Stocks (Step 1)
              </>
            )}
          </Button>

          {isLoadingPreFilter && preFilterProgress > 0 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-blue-900">{preFilterCurrentTicker || "Loading..."}</span>
                <span className="text-sm font-bold text-blue-900">{preFilterProgress}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${preFilterProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {preFilterCount > 0 && (
            <p className="text-sm text-green-700 font-semibold mt-2 text-center">
              ✅ {preFilterCount} tickers loaded and ready for Step 2 scan
            </p>
          )}
        </CardContent>
      </Card>

      {tickersToScan.trim().length > 0 && (
        <Card className="mt-8 w-full max-w-7xl mx-auto shadow-lg">
          <CardContent className="pt-6">
            <Label className="text-base font-bold text-gray-900 mb-2 block">Tickers to Scan</Label>
            <Textarea
              value={tickersToScan}
              onChange={(e) => setTickersToScan(e.target.value)}
              placeholder="Enter ticker symbols separated by commas (e.g., AAPL, MSFT, GOOGL) or use Step 1 above to load automatically"
              className="h-32 font-mono text-sm"
            />
          </CardContent>
        </Card>
      )}

      {tickersToScan.trim().length > 0 && (
        <Card className="mt-8 w-full max-w-7xl mx-auto shadow-lg border-2 border-blue-300">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-700" />
              <CardTitle className="text-xl font-bold">FUNDAMENTAL CRITERIA (Step 2)</CardTitle>
            </div>
            <CardDescription>
              Using Twelve Data API for real fundamental metrics. All slider filters are applied with live data.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-1 mb-6 text-sm text-gray-700">
              <li>
                <strong>Debt-to-Equity:</strong> Max {maxDebtToEquity[0]} (healthy leverage - adjustable below)
              </li>
              <li>
                <strong>ROE:</strong> Min {minROE[0]}% (efficient profit generation - adjustable below)
              </li>
              <li>
                <strong>Profitable Quarters:</strong> Min {minProfitableQuarters[0]} consecutive quarters (
                {minProfitableQuarters[0] === 0 ? "no filter" : "consistent profitability"} - adjustable below)
              </li>
            </ul>

            {/* Step 2 Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Max Debt/Eq
                  {tooltipsEnabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                        <p className="font-semibold mb-1">Debt-to-Equity Ratio</p>
                        <p className="text-xs mb-2">
                          <strong>What:</strong> Measures how much debt a company has relative to shareholder equity.
                          Calculated as Total Debt ÷ Total Equity.
                        </p>
                        <p className="text-xs mb-2">
                          <strong>Why Important:</strong> Companies with lower debt are more financially stable and less
                          likely to face distress during downturns. Safer for put selling since you want to avoid
                          assignment on troubled stocks.
                        </p>
                        <p className="text-xs">
                          <strong>Lower:</strong> Only financially conservative companies (safer).{" "}
                          <strong>Higher:</strong> Includes more leveraged companies (potentially riskier).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </Label>
                <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                      {maxDebtToEquity[0]}
                    </span>
                  </div>
                  <Slider
                    id="maxDebtToEquity"
                    value={maxDebtToEquity}
                    onValueChange={setMaxDebtToEquity}
                    min={0.5}
                    max={3}
                    step={0.1}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0.5</span>
                    <span className="text-xs font-semibold">Financial strength</span>
                    <span>3.0</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Min ROE %
                  {tooltipsEnabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                        <p className="font-semibold mb-1">Return on Equity (ROE %)</p>
                        <p className="text-xs mb-2">
                          <strong>What:</strong> Net income generated per dollar of shareholder equity. Calculated as
                          Net Income ÷ Shareholders' Equity.
                        </p>
                        <p className="text-xs mb-2">
                          <strong>Why Important:</strong> Measures how efficiently management uses your capital to
                          generate profits. Higher ROE = better quality company = lower assignment risk.
                        </p>
                        <p className="text-xs">
                          <strong>Lower (10%):</strong> Includes profitable but mediocre companies.{" "}
                          <strong>Higher (20%+):</strong> Only exceptional profit generators.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </Label>
                <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                      {minROE[0]}%
                    </span>
                  </div>
                  <Slider
                    id="minROE"
                    value={minROE}
                    onValueChange={setMinROE}
                    min={5}
                    max={20}
                    step={1}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>5%</span>
                    <span className="text-xs font-semibold">Quality of profit</span>
                    <span>20%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Min Profitable Quarters
                  {tooltipsEnabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                        <p className="font-semibold mb-1">Consecutive Profitable Quarters</p>
                        <p className="text-xs mb-2">
                          <strong>What:</strong> The number of consecutive quarters (3-month periods) where the company
                          reported positive earnings per share (EPS).
                        </p>
                        <p className="text-xs mb-2">
                          <strong>Why Important:</strong> Consistent profitability indicates business stability and
                          reduces the risk of major stock declines. Critical for put sellers who want to avoid being
                          assigned shares of declining companies.
                        </p>
                        <p className="text-xs">
                          <strong>Lower/0:</strong> Includes growth companies that may be unprofitable (riskier).{" "}
                          <strong>Higher:</strong> Only consistently profitable companies (5+ years = 20 quarters).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </Label>
                <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                      {minProfitableQuarters[0]}
                    </span>
                  </div>
                  <Slider
                    id="minProfitableQuarters"
                    value={minProfitableQuarters}
                    onValueChange={setMinProfitableQuarters}
                    min={0}
                    max={20}
                    step={1}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0</span>
                    <span className="text-xs font-semibold">
                      {minProfitableQuarters[0] === 0 ? "Any (no filter)" : `${minProfitableQuarters[0]} quarters`}
                    </span>
                    <span>20</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CHANGE: Removed the 'Max PE Ratio' slider and its related state */}
            {/* CHANGE: Removed the 'Min Volume' slider and its related state */}
          </CardContent>
        </Card>
      )}

      {/* CHANGE: Fixed button condition to show at step 1 and before technical scan */}
      {step <= 2 && tickersToScan.trim().length > 0 && !loading && !isScanningTechnicals && (
        <Button
          onClick={scanFundamentals}
          disabled={isScanning || isScanningTechnicals || tickersToScan.trim() === ""}
          size="lg"
          className="mt-4 w-full max-w-7xl mx-auto h-12 text-base font-semibold bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <BarChart3 className="mr-2 h-5 w-5" />
              Scan Fundamentals (Step 2)
            </>
          )}
        </Button>
      )}

      {/* Scan Progress */}
      {loading && scanProgress > 0 && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg w-full max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-blue-900">Scanning Fundamentals: {currentTicker}</span>
            <span className="text-sm font-bold text-blue-900">{scanProgress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${scanProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {fundamentalResults.length > 0 && (
        <Card className="mt-8 w-full max-w-7xl mx-auto shadow-lg border-gray-200">
          <CardHeader className="bg-blue-50 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Fundamental Scan Results
              </span>
              <span className="text-sm font-normal text-gray-600">
                {fundamentalResults.length} stock{fundamentalResults.length !== 1 ? "s" : ""} passed
              </span>
            </CardTitle>
            <CardDescription>
              These stocks passed fundamental screening. Run Technical Analysis (Step 3) to find optimal entries.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th
                      className="text-left py-2 px-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                      onClick={() => handleFundamentalSort("ticker")}
                    >
                      <div className="flex items-center gap-1">
                        Ticker
                        {fundamentalSortColumn === "ticker" && (
                          <span className="text-xs">{fundamentalSortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-right py-2 px-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                      onClick={() => handleFundamentalSort("currentPrice")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Price
                        {fundamentalSortColumn === "currentPrice" && (
                          <span className="text-xs">{fundamentalSortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-right py-2 px-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                      onClick={() => handleFundamentalSort("peRatio")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        PE
                        {fundamentalSortColumn === "peRatio" && (
                          <span className="text-xs">{fundamentalSortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-right py-2 px-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                      onClick={() => handleFundamentalSort("marketCap")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Market Cap
                        {fundamentalSortColumn === "marketCap" && (
                          <span className="text-xs">{fundamentalSortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-right py-2 px-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                      onClick={() => handleFundamentalSort("roe")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        ROE %
                        {fundamentalSortColumn === "roe" && (
                          <span className="text-xs">{fundamentalSortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-right py-2 px-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                      onClick={() => handleFundamentalSort("avgVolume")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Volume (M)
                        {fundamentalSortColumn === "avgVolume" && (
                          <span className="text-xs">{fundamentalSortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFundamentalResults.slice(0, 10).map((stock, index) => {
                    const yahooChartLink = `https://finance.yahoo.com/quote/${stock.ticker}/chart`
                    return (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <a
                            href={yahooChartLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {stock.ticker}
                          </a>
                        </td>
                        <td className="text-right py-2 px-3 text-gray-900">${stock.currentPrice.toFixed(2)}</td>
                        <td className="text-right py-2 px-3 text-gray-600">
                          {stock.peRatio > 0 ? stock.peRatio.toFixed(1) : "-"}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-600">
                          {stock.marketCap > 0 ? `$${stock.marketCap.toFixed(1)}B` : "$0.0B"}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-600">
                          {stock.roe > 0 ? `${stock.roe.toFixed(1)}%` : "0.0%"}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-600">{stock.avgVolume.toFixed(1)}M</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {fundamentalResults.length > 10 && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Showing top 10 of {fundamentalResults.length} results
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {step >= 2 && fundamentalResults.length > 0 && (
        <Card className="mt-8 w-full max-w-7xl mx-auto shadow-lg border-blue-200">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              TECHNICAL CRITERIA (Step 3)
            </CardTitle>
            <CardDescription>
              Adjust technical thresholds to relax or tighten entry criteria for optimal put-selling setups.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Technical Criteria Bullet Points */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-sm text-gray-900">TECHNICAL CRITERIA (Step 3)</span>
              </div>
              <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                <li>
                  <strong>
                    RSI {"<"} {maxRSI[0]}:
                  </strong>{" "}
                  Oversold conditions, potential for bounce (medium-term pullback setup)
                </li>
                <li>
                  <strong>100-day SMA:</strong> Price above 100-day SMA (long-term uptrend confirmed)
                </li>
                <li>
                  <strong>200-day SMA:</strong> Price above 200-day SMA (long-term uptrend confirmed)
                </li>
                <li>
                  <strong>50-day SMA:</strong> Price above 50-SMA (short-term strength)
                </li>
                <li>
                  <strong>MACD (12, 26, 9):</strong> MACD above signal line (bullish momentum)
                </li>
                <li>
                  <strong>
                    Stochastic (14) {"<"} {maxStochastic[0]}:
                  </strong>{" "}
                  Oversold signal, reversal potential
                </li>
                <li>
                  <strong>
                    ATR {minATR[0]}-{maxATR[0]}%:
                  </strong>{" "}
                  Moderate volatility for attractive premiums
                </li>
                <li>
                  <strong>Red Day Preferred:</strong> Stock down from previous close = optimal put-selling entry point
                </li>
              </ul>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Max RSI ({maxRSI[0]})
                  {tooltipsEnabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                        <p className="font-semibold mb-1">Max RSI (Relative Strength Index)</p>
                        <p className="text-sm mb-2">
                          <strong>What:</strong> Momentum oscillator measuring speed and magnitude of price changes
                          (0-100 scale).
                        </p>
                        <p className="text-sm mb-2">
                          <strong>Why Important:</strong> Identifies oversold/overbought conditions. Put sellers prefer
                          oversold stocks because they're more likely to bounce back (reducing assignment risk).
                        </p>
                        <p className="text-sm">
                          <strong>Lower (&lt;30):</strong> Only severely oversold stocks (best entry).{" "}
                          <strong>Higher (50-70):</strong> Includes neutral to overbought stocks (riskier for puts).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </Label>
                <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                      {maxRSI[0]}
                    </span>
                  </div>
                  <Slider
                    id="maxRSI"
                    value={maxRSI}
                    onValueChange={setMaxRSI}
                    min={20}
                    max={70}
                    step={1}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>20</span>
                    <span className="text-xs font-semibold">Oversold threshold</span>
                    <span>70</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Max Stochastic ({maxStochastic[0]})
                  {tooltipsEnabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                        <p className="font-semibold mb-1">Max Stochastic Oscillator</p>
                        <p className="text-sm mb-2">
                          <strong>What:</strong> Momentum indicator comparing closing price to price range over time
                          (0-100 scale).
                        </p>
                        <p className="text-sm mb-2">
                          <strong>Why Important:</strong> Helps identify oversold reversal opportunities. Lower values
                          suggest stock is oversold and likely to bounce.
                        </p>
                        <p className="text-sm">
                          <strong>Lower (&lt;20):</strong> Only deeply oversold stocks (strong bounce potential).{" "}
                          <strong>Higher (20-50):</strong> Includes moderately oversold to neutral conditions.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </Label>
                <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                      {maxStochastic[0]}
                    </span>
                  </div>
                  <Slider
                    id="maxStochastic"
                    value={maxStochastic}
                    onValueChange={setMaxStochastic}
                    min={10}
                    max={50}
                    step={1}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>10</span>
                    <span className="text-xs font-semibold">Oversold signal</span>
                    <span>50</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Min ATR %
                  {tooltipsEnabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                        <p className="font-semibold mb-1">Min ATR % (Average True Range)</p>
                        <p className="text-sm mb-2">
                          <strong>What:</strong> Volatility measure showing average daily price movement as percentage
                          of stock price.
                        </p>
                        <p className="text-sm mb-2">
                          <strong>Why Important:</strong> Higher volatility = higher option premiums. Put sellers need
                          minimum volatility to earn attractive premiums.
                        </p>
                        <p className="text-sm">
                          <strong>Lower (1%):</strong> Includes low-volatility stocks (lower premiums).{" "}
                          <strong>Higher (2-3%+):</strong> Only volatile stocks (best premiums).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </Label>
                <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                      {minATR[0]}%
                    </span>
                  </div>
                  <Slider
                    id="minATR"
                    value={minATR}
                    onValueChange={setMinATR}
                    min={0.5}
                    max={5}
                    step={0.1}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0.5%</span>
                    <span className="text-xs font-semibold">Min volatility</span>
                    <span>5%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Max ATR %
                  {tooltipsEnabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                        <p className="font-semibold mb-1">Max ATR % (Average True Range)</p>
                        <p className="text-sm mb-2">
                          <strong>What:</strong> Maximum daily volatility allowed, measured as percentage of stock
                          price.
                        </p>
                        <p className="text-sm mb-2">
                          <strong>Why Important:</strong> Too much volatility = excessive risk of large moves against
                          you. Limit max ATR to avoid wild, unpredictable stocks.
                        </p>
                        <p className="text-sm">
                          <strong>Lower (3-5%):</strong> Only moderate volatility stocks (safer).{" "}
                          <strong>Higher (10%+):</strong> Includes highly volatile stocks (higher risk/reward).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </Label>
                <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                      {maxATR[0]}%
                    </span>
                  </div>
                  <Slider
                    id="maxATR"
                    value={maxATR}
                    onValueChange={setMaxATR}
                    min={1}
                    max={15}
                    step={0.5}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1%</span>
                    <span className="text-xs font-semibold">Max volatility</span>
                    <span>15%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Technical Filters checkboxes */}
            <div className="space-y-3">
              <Label className="font-medium">Additional Technical Filters:</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    Bollinger Bands Setup
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">Bollinger Bands Setup</p>
                          <p className="text-sm">
                            Price is at or below the lower Bollinger Band (mean reversion setup). This suggests the
                            stock is oversold relative to its recent trading range and likely to bounce back, making it
                            an attractive put-selling entry point.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <input
                    id="bollingerToggle"
                    type="checkbox"
                    checked={requireBollingerBands}
                    onChange={(e) => setRequireBollingerBands(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    Above 200-day SMA
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">Above 200-day SMA</p>
                          <p className="text-sm">
                            Stock is trading above its 200-day simple moving average (long-term uptrend confirmation).
                            Indicates strong long-term momentum and reduces the risk of being assigned shares in a
                            declining stock.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <input
                    id="sma200Toggle"
                    type="checkbox"
                    checked={requireAbove200SMA}
                    onChange={(e) => setRequireAbove200SMA(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    Above 50-day SMA
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">Above 50-day SMA</p>
                          <p className="text-sm">
                            Stock is trading above its 50-day simple moving average (short-term strength). Confirms
                            recent positive momentum while still allowing for minor pullbacks that create put-selling
                            opportunities.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <input
                    id="sma50Toggle"
                    type="checkbox"
                    checked={requireAbove50SMA}
                    onChange={(e) => setRequireAbove50SMA(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    Golden Cross (50 &gt; 200)
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">Golden Cross (50 &gt; 200)</p>
                          <p className="text-sm">
                            The 50-day SMA has crossed above the 200-day SMA (bullish crossover signal). This indicates
                            a shift from downtrend to uptrend and is one of the most reliable long-term buy signals for
                            put sellers.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <input
                    id="goldenCrossToggle"
                    type="checkbox"
                    checked={requireGoldenCross}
                    onChange={(e) => setRequireGoldenCross(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    MACD Bullish Signal
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">MACD Bullish Signal</p>
                          <p className="text-sm">
                            The MACD line is above the signal line (bullish momentum). This indicates that short-term
                            momentum is stronger than longer-term momentum, suggesting continued upward price movement.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <input
                    id="macdToggle"
                    type="checkbox"
                    checked={requireMACDBullish}
                    onChange={(e) => setRequireMACDBullish(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    Red Day Preferred
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">Red Day Preferred</p>
                          <p className="text-sm">
                            Stock is down from its previous close (optimal put-selling entry point). Selling puts on red
                            days allows you to collect premium when fear is elevated, then potentially profit as the
                            stock recovers.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <input
                    id="redDayToggle"
                    type="checkbox"
                    checked={requireRedDay}
                    onChange={(e) => setRequireRedDay(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step >= 2 && fundamentalResults.length > 0 && (
        <Button
          onClick={scanTechnicals}
          disabled={isScanningTechnicals || fundamentalResults.length === 0}
          className="mt-4 w-full max-w-7xl mx-auto h-12 text-base font-semibold bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
        >
          {isScanningTechnicals ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Analyzing Technical Indicators...
            </>
          ) : (
            <>
              <TrendingUp className="mr-2 h-5 w-5" />
              Run Technical Analysis (Step 3)
            </>
          )}
        </Button>
      )}

      {isScanningTechnicals && (
        <Card className="mt-4 w-full max-w-7xl mx-auto border-2 border-blue-300 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Analyzing {technicalCurrentTicker || "..."}</span>
              <span className="text-sm font-semibold text-blue-700">{technicalProgress}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${technicalProgress}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && technicalResults.length > 0 && (
        <Card className="bg-white mt-8 w-full max-w-7xl mx-auto shadow-xl border-2 border-green-500">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <CardTitle className="text-green-900">
                  Step 3: Technical Analysis Results (Premium Entries) ✨
                </CardTitle>
              </div>
              <span className="text-sm font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full">
                {technicalResults.length} {technicalResults.length === 1 ? "option meets" : "options meet"} all the
                selection criteria
              </span>
            </div>
            <p className="text-sm text-green-700 mt-2">
              🎉 Congratulations! These stocks passed ALL technical criteria - premium put-selling opportunities!
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-green-50 border-b border-green-200">
                  <tr>
                    <th
                      className="text-left p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("ticker" as keyof QualifyingStock)}
                    >
                      Ticker {sortColumn === "ticker" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("currentPrice" as keyof QualifyingStock)}
                    >
                      Price {sortColumn === "currentPrice" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("daysToExpiry" as keyof QualifyingStock)}
                    >
                      DTE {sortColumn === "daysToExpiry" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("expiryDate" as keyof QualifyingStock)}
                    >
                      Expiry {sortColumn === "expiryDate" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("putStrike" as keyof QualifyingStock)}
                    >
                      Strike {sortColumn === "putStrike" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("premium")}
                    >
                      Premium {sortColumn === "premium" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("delta" as keyof QualifyingStock)}
                    >
                      Delta {sortColumn === "delta" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("yield" as keyof QualifyingStock)}
                    >
                      Yield % {sortColumn === "yield" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("annualizedYield" as keyof QualifyingStock)}
                    >
                      Annual Yield % {sortColumn === "annualizedYield" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    {/* Reordered: Red Day, RSI, Bollinger, MACD, then rest */}
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("redDay" as keyof QualifyingStock)}
                    >
                      Red Day {sortColumn === "redDay" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("rsi" as keyof QualifyingStock)}
                    >
                      RSI {"<"} {maxRSI[0]} {sortColumn === "rsi" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("bollingerPosition" as keyof QualifyingStock)}
                    >
                      Bollinger {sortColumn === "bollingerPosition" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("macdSignal" as keyof QualifyingStock)}
                    >
                      MACD {sortColumn === "macdSignal" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("uptrend" as keyof QualifyingStock)}
                    >
                      Golden Cross {sortColumn === "uptrend" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("stochastic" as keyof QualifyingStock)}
                    >
                      Stochastic {sortColumn === "stochastic" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("atrPercent" as keyof QualifyingStock)}
                    >
                      ATR % {sortColumn === "atrPercent" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("sma50" as keyof QualifyingStock)}
                    >
                      50-SMA {sortColumn === "sma50" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("sma100" as keyof QualifyingStock)}
                    >
                      100-SMA {sortColumn === "sma100" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("sma200" as keyof QualifyingStock)}
                    >
                      200-SMA {sortColumn === "sma200" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTechnicalStocks.map((stock, idx) => {
                    // Evaluate criteria for each stock to show which filters passed/failed
                    const criteria = evaluateCriteria(stock)
                    return (
                      <tr
                        key={`${stock.ticker}-${stock.expiryDate}-${idx}`}
                        className={`border-b hover:bg-green-50 ${idx % 2 === 0 ? "bg-white" : "bg-green-50"}`}
                      >
                        <td className="p-3 font-semibold text-green-700">
                          <a
                            href={`https://finance.yahoo.com/quote/${stock.ticker}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {stock.ticker}
                          </a>
                        </td>
                        <td className="text-right p-3">${stock.currentPrice.toFixed(2)}</td>
                        {/* CHANGE: Display actual DTE from stock data without fallback that masks errors */}
                        <td className="text-center p-3">{stock.daysToExpiry ?? "N/A"}</td>
                        <td className="text-center p-3">{stock.expiryDate ?? "N/A"}</td>
                        <td className="text-center p-3">${stock.putStrike.toFixed(2)}</td>
                        <td className="text-right p-3 font-semibold text-green-700">
                          ${stock.premium !== undefined ? stock.premium.toFixed(2) : "N/A"}
                        </td>
                        <td className={`text-center p-3 ${stock.delta < -0.2 ? "text-green-700" : ""}`}>
                          {stock.delta.toFixed(3)}
                        </td>
                        <td className="text-right p-3">
                          <span className="font-bold text-green-800">{stock.yield.toFixed(2)}%</span>
                        </td>
                        <td className="text-right p-3">
                          {stock.annualizedYield !== undefined && stock.annualizedYield > 0
                            ? stock.annualizedYield.toFixed(1) + "%"
                            : "N/A"}
                        </td>
                        <td className="text-center p-3">
                          {stock.redDay ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.rsi !== undefined && stock.rsi < 40 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.bollingerPosition === "Below" || stock.bollingerPosition === "Lower Half" ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.macdSignal === "Bullish" ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.uptrend && stock.sma50 > stock.sma200 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.stochastic !== undefined && stock.stochastic < 25 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.atrPercent !== undefined && stock.atrPercent >= 2.5 && stock.atrPercent <= 6 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.sma50 !== undefined && stock.currentPrice < stock.sma50 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.sma100 !== undefined && stock.currentPrice < stock.sma100 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.sma200 !== undefined && stock.currentPrice < stock.sma200 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-green-50 border-t border-green-200">
              <p className="text-sm text-green-700 font-medium">
                🎯 Next Step: Click "Show Relaxed Criteria" below to see additional opportunities with slightly relaxed
                filters.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CHANGE: Added Step 4 button when Step 3 has results (previously only showed when no results) */}
      {step >= 3 && !isScanningTechnicals && technicalResults.length > 0 && !showRelaxedResults && (
        <Button
          onClick={toggleRelaxedResults}
          className="mt-4 w-full max-w-7xl mx-auto h-12 text-base font-semibold bg-purple-600 hover:bg-purple-700 text-white"
          disabled={isEnrichingRelaxed}
        >
          <Filter className="mr-2 h-5 w-5" />
          View Relaxed Criteria Results (Step 4)
        </Button>
      )}

      {step >= 3 && !isScanningTechnicals && technicalResults.length === 0 && fundamentalResults.length > 0 && (
        <Card className="mt-8 w-full max-w-7xl mx-auto border-2 border-yellow-500 bg-white">
          <CardHeader className="bg-gradient-to-r from-yellow-50 to-amber-50">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-yellow-900">Step 3: No Stocks Passed Technical Criteria</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-gray-700 mb-4">
              The current technical filters are very strict. None of the {fundamentalResults.length} stocks from Step 2
              passed all technical criteria.
            </p>
            <p className="text-gray-600 text-sm mb-4">Consider:</p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Relaxing the RSI threshold (increase from {maxRSI[0]})</li>
              <li>Disabling some optional filters (200-day SMA, Red Day preference)</li>
              <li>Viewing Step 4 Relaxed Results for alternative opportunities</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {step >= 3 && !isScanningTechnicals && technicalResults.length === 0 && fundamentalResults.length > 0 && (
        <Button
          onClick={toggleRelaxedResults}
          className="mt-4 w-full max-w-7xl mx-auto h-12 text-base font-semibold bg-yellow-600 hover:bg-yellow-700 text-white"
          disabled={isEnrichingRelaxed}
        >
          <Filter className="mr-2 h-5 w-5" />
          View Relaxed Criteria Results (Step 4)
        </Button>
      )}

      {isEnrichingRelaxed && step4Progress > 0 && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg w-full max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-blue-900">Enriching Options Data: {step4CurrentTicker}</span>
            <span className="text-sm font-bold text-blue-900">{step4Progress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${step4Progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* CHANGE: Only render Step 4 table when we have enriched relaxed results (not during loading or when empty) */}
      {showRelaxedResults && !isEnrichingRelaxed && relaxedResults.length > 0 && (
        <Card className="mt-8 w-full max-w-7xl mx-auto shadow-xl border-2 border-purple-500">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-purple-900">Step 4: Relaxed Criteria Results</CardTitle>
              </div>
              <span className="text-sm font-semibold text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
                {sortedRelaxedResults.length} {sortedRelaxedResults.length === 1 ? "option meets" : "options meet"} the
                relaxed criteria
              </span>
            </div>
            <p className="text-sm text-purple-700 mt-2">
              These stocks passed a slightly relaxed set of technical filters. Review for additional put-selling
              opportunities. Click column headers to sort.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-purple-50 border-b border-purple-200">
                  <tr>
                    <th
                      className="text-left p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("ticker")}
                    >
                      Ticker {relaxedSortColumn === "ticker" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("currentPrice")}
                    >
                      Price {relaxedSortColumn === "currentPrice" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("daysToExpiry")}
                    >
                      DTE {relaxedSortColumn === "daysToExpiry" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("expiryDate")}
                    >
                      Expiry {relaxedSortColumn === "expiryDate" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("putStrike")}
                    >
                      Strike {relaxedSortColumn === "putStrike" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("premium")}
                    >
                      Premium {relaxedSortColumn === "premium" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("delta")}
                    >
                      Delta {relaxedSortColumn === "delta" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("yield")}
                    >
                      Yield % {relaxedSortColumn === "yield" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("annualizedYield")}
                    >
                      Annual Yield %{" "}
                      {relaxedSortColumn === "annualizedYield" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("redDay")}
                    >
                      Red Day {relaxedSortColumn === "redDay" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("macdSignal")}
                    >
                      MACD {relaxedSortColumn === "macdSignal" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("rsi")}
                    >
                      RSI {"<"} {maxRSI[0]}{" "}
                      {relaxedSortColumn === "rsi" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("bollingerPosition")}
                    >
                      Bollinger{" "}
                      {relaxedSortColumn === "bollingerPosition" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("uptrend")}
                    >
                      Golden Cross {relaxedSortColumn === "uptrend" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("stochastic")}
                    >
                      Stochastic {relaxedSortColumn === "stochastic" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("atrPercent")}
                    >
                      ATR % {relaxedSortColumn === "atrPercent" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("sma50")}
                    >
                      50-SMA {relaxedSortColumn === "sma50" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("sma100")}
                    >
                      100-SMA {relaxedSortColumn === "sma100" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("sma200")}
                    >
                      200-SMA {relaxedSortColumn === "sma200" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRelaxedResults.map((stock, index) => {
                    // Evaluate criteria for each stock to show which filters passed/failed
                    const criteria = evaluateCriteria(stock)
                    const passedCount = Object.values(criteria).filter(Boolean).length
                    const totalCriteria = Object.values(criteria).length

                    return (
                      <tr
                        key={`${stock.ticker}-${stock.expiryDate}-${index}`}
                        className={`border-b hover:bg-purple-50 ${index % 2 === 0 ? "bg-white" : "bg-purple-50"}`}
                      >
                        <td className="p-3 font-semibold text-purple-700">
                          <a
                            href={`https://finance.yahoo.com/quote/${stock.ticker}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {stock.ticker}
                          </a>
                        </td>
                        <td className="text-right p-3">${stock.currentPrice.toFixed(2)}</td>
                        <td className="text-center p-3">{stock.daysToExpiry ?? "N/A"}</td>
                        <td className="text-center p-3">{stock.expiryDate ?? "N/A"}</td>
                        <td className="text-center p-3">${stock.putStrike.toFixed(2)}</td>
                        <td className="text-right p-3 font-semibold text-purple-700">
                          ${stock.premium !== undefined ? stock.premium.toFixed(2) : "N/A"}
                        </td>
                        <td className={`text-center p-3 ${stock.delta < -0.2 ? "text-purple-700" : ""}`}>
                          {stock.delta.toFixed(3)}
                        </td>
                        <td className="text-right p-3">
                          <span className="font-bold text-purple-800">{stock.yield.toFixed(2)}%</span>
                        </td>
                        <td className="text-right p-3">
                          {stock.annualizedYield !== undefined && stock.annualizedYield > 0
                            ? stock.annualizedYield.toFixed(1) + "%"
                            : "N/A"}
                        </td>
                        <td className="text-center p-3">
                          {stock.redDay ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.macdSignal === "Bullish" ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.rsi !== undefined && stock.rsi < maxRSI[0] ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.bollingerPosition === "Below" || stock.bollingerPosition === "Lower Half" ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.uptrend && stock.sma50 > stock.sma200 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.stochastic !== undefined && stock.stochastic < 25 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.atrPercent !== undefined && stock.atrPercent >= 2.5 && stock.atrPercent <= 6 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.sma50 !== undefined && stock.currentPrice < stock.sma50 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.sma100 !== undefined && stock.currentPrice < stock.sma100 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.sma200 !== undefined && stock.currentPrice > stock.sma200 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-purple-600">Review these opportunities and adjust filters as needed.</p>
          </CardContent>
        </Card>
      )}

      {/* Add message when Step 4 enrichment completes but finds no options */}
      {showRelaxedResults && !isEnrichingRelaxed && relaxedResults.length === 0 && (
        <Card className="mt-8 w-full max-w-7xl mx-auto border-2 border-yellow-500 bg-white">
          <CardHeader className="bg-gradient-to-r from-yellow-50 to-amber-50">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-yellow-900">Step 4: No Relaxed Options Found</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-gray-700 mb-4">
              No options with valid pricing data were found for the {fundamentalResults.length} stocks that passed
              fundamental criteria.
            </p>
            <p className="text-gray-600 text-sm">This could happen if:</p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mt-2">
              <li>The market is closed and options quotes are unavailable</li>
              <li>No options match the delta range (0.25-0.35)</li>
              <li>API rate limits were reached - try again in a few minutes</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="mt-4 w-full max-w-7xl mx-auto p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span className="font-bold">Error:</span> {error}
          </div>
        </div>
      )}

      {cacheStatus && (
        <div className="mt-4 w-full max-w-7xl mx-auto p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-center text-sm">
          {cacheStatus}
        </div>
      )}
    </TooltipProvider>
  )
}
