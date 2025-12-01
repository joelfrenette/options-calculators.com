"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Filter, AlertTriangle, Info, Wifi, WifiOff, TrendingUp, Activity, DollarSign, Zap, Target } from "lucide-react"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"

interface ZEBRASetup {
  ticker: string
  company: string
  type: "call" | "put"
  longStrike: number // Buy 2 ITM options at this strike
  shortStrike: number // Sell 1 ATM/OTM option at this strike
  currentPrice: number
  expiration: string
  dte: number
  netDebit: number
  maxProfit: string // Theoretically unlimited for calls
  maxLoss: number
  breakeven: number
  // ZEBRA specific KPIs
  delta: number // Position delta (should be ~100 like stock)
  extrinsicPaid: number // Should be near zero
  stockScore: number // Fundamental + growth score
  optionVolume: number
  trend: "bullish" | "bearish" | "neutral"
  distanceToBreakeven: number // % from current to breakeven
  leverageRatio: number
  signal: "strong" | "moderate" | "speculative"
  reason: string
  dataSource?: string
  isLive?: boolean
}

// Strong momentum stocks good for ZEBRAs
const ZEBRA_TICKERS = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "META",
  "NVDA", // Tech leaders
  "TSLA",
  "AMD",
  "CRM",
  "ADBE", // Growth stocks
  "JPM",
  "V",
  "MA", // Strong financials
  "UNH",
  "LLY",
  "ABBV", // Healthcare momentum
  "HD",
  "COST",
  "WMT", // Retail strength
]

export function ZEBRAScanner() {
  const [setups, setSetups] = useState<ZEBRASetup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [optionType, setOptionType] = useState<"all" | "call" | "put">("all")
  const [trendFilter, setTrendFilter] = useState<"all" | "bullish" | "bearish">("all")
  const [minDTE, setMinDTE] = useState(60)
  const [maxBreakevenDistance, setMaxBreakevenDistance] = useState(5)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [isLiveData, setIsLiveData] = useState(false)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  useEffect(() => {
    const cached = localStorage.getItem("zebra-scanner-cache")
    if (cached) {
      try {
        const { data, timestamp, isLive } = JSON.parse(cached)
        setSetups(data)
        setLastUpdated(timestamp)
        setIsLiveData(isLive)
      } catch {
        // Invalid cache
      }
    }
  }, [])

  const filteredSetups = setups.filter((s) => {
    if (optionType !== "all" && s.type !== optionType) return false
    if (trendFilter !== "all" && s.trend !== trendFilter) return false
    if (s.dte < minDTE) return false
    if (Math.abs(s.distanceToBreakeven) > maxBreakevenDistance) return false
    return true
  })

  const handleRefresh = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/strategy-scanner?type=zebra")

      if (!response.ok) {
        const text = await response.text()
        console.error("[ZEBRA Scanner] Server error:", response.status, text)
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()

      if (data.zebra && data.zebra.length > 0) {
        setSetups(data.zebra)
        setIsLiveData(data.isLive || false)
        const timestamp = new Date().toLocaleString()
        setLastUpdated(timestamp)

        localStorage.setItem(
          "zebra-scanner-cache",
          JSON.stringify({ data: data.zebra, timestamp, isLive: data.isLive }),
        )
      } else {
        setError("No ZEBRA setups found. Try adjusting filters.")
      }
    } catch (err) {
      console.error("[ZEBRA Scanner] Fetch error:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch data")
    } finally {
      setIsLoading(false)
    }
  }

  const InfoTooltip = ({ content }: { content: string }) => {
    if (!tooltipsEnabled) return null
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-gray-400 cursor-help inline ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-sm bg-white text-gray-900 border shadow-lg p-3 z-50">
          <p className="text-sm leading-relaxed">{content}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const getSignalBadge = (signal: string) => {
    switch (signal) {
      case "strong":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Strong</Badge>
      case "moderate":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Moderate</Badge>
      default:
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Speculative</Badge>
    }
  }

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case "bullish":
        return <Badge className="bg-green-600 text-white">Bullish</Badge>
      case "bearish":
        return <Badge className="bg-red-600 text-white">Bearish</Badge>
      default:
        return <Badge className="bg-gray-600 text-white">Neutral</Badge>
    }
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              <CardTitle>ZEBRA Scanner (Zero Extrinsic Back Ratio)</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
              <RefreshButton onClick={handleRefresh} isLoading={isLoading} loadingText="Scanning..." />
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
            <p className="text-sm text-yellow-800">
              <Info className="h-4 w-4 inline mr-1" />
              <strong>ZEBRA</strong> (Zero Extrinsic Back Ratio) is a stock replacement strategy: Buy 2 deep ITM
              calls/puts and sell 1 ATM call/put. Results in ~100 delta with <strong>near-zero extrinsic value</strong>{" "}
              paid. Best for <strong>strong trending stocks</strong> where you want stock-like exposure with defined
              risk.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          {/* Status Bar */}
          <div className="flex items-center justify-between mb-4 text-sm">
            <div className="flex items-center gap-4">
              {isLiveData ? (
                <span className="flex items-center gap-1 text-green-600">
                  <Wifi className="h-4 w-4" /> Live Data
                </span>
              ) : (
                <span className="flex items-center gap-1 text-gray-500">
                  <WifiOff className="h-4 w-4" /> Estimated Data
                </span>
              )}
              {lastUpdated && <span className="text-gray-500">Updated: {lastUpdated}</span>}
            </div>
            <span className="text-gray-500">{filteredSetups.length} setups found</span>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Filters:</span>
              <InfoTooltip content="Filter ZEBRA setups by your market view and preferences. Call ZEBRAs are bullish (you profit when stock rises). Put ZEBRAs are bearish (you profit when stock falls). The breakeven distance filter helps you find setups where you're already close to profitability." />
            </div>

            <Select value={optionType} onValueChange={(v: any) => setOptionType(v)}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="call">Call ZEBRA</SelectItem>
                <SelectItem value="put">Put ZEBRA</SelectItem>
              </SelectContent>
            </Select>

            <Select value={trendFilter} onValueChange={(v: any) => setTrendFilter(v)}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="Trend" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trends</SelectItem>
                <SelectItem value="bullish">Bullish</SelectItem>
                <SelectItem value="bearish">Bearish</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Min DTE:</span>
              <InfoTooltip content="Minimum Days to Expiration. ZEBRAs work best with longer expirations (60+ days) because you need time for your directional thesis to play out. Shorter DTE = less time premium but also less room for the trade to work. Most ZEBRA traders use 60-120 day options." />
              <Slider
                value={[minDTE]}
                onValueChange={([v]) => setMinDTE(v)}
                min={30}
                max={180}
                step={15}
                className="w-24"
              />
              <span className="text-sm font-medium w-12">{minDTE}d</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Max B/E Dist:</span>
              <InfoTooltip content="Maximum Breakeven Distance - how far the stock price is from your breakeven point. Smaller distance (under 3%) means you're already close to profitability - a small move in your favor starts making money. Larger distance means the stock has further to travel before you profit." />
              <Slider
                value={[maxBreakevenDistance]}
                onValueChange={([v]) => setMaxBreakevenDistance(v)}
                min={1}
                max={10}
                step={0.5}
                className="w-24"
              />
              <span className="text-sm font-medium w-12">{maxBreakevenDistance}%</span>
            </div>
          </div>

          {/* KPI Legend */}
          <div className="grid grid-cols-4 gap-4 mb-4 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-blue-500" />
              Delta: Position delta (~100 = stock-like)
              <InfoTooltip content="Position Delta shows how the entire ZEBRA position moves with the stock. ~100 delta means it moves almost exactly like owning 100 shares of stock. The magic of ZEBRA is getting stock-like exposure while paying almost zero time premium." />
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-green-500" />
              Extrinsic: Time value paid (lower = better)
              <InfoTooltip content="Extrinsic (time) value is what you pay above intrinsic value. In a ZEBRA, the goal is ZERO extrinsic - hence 'Zero Extrinsic Back Ratio.' The sold ATM option offsets the extrinsic of the 2 ITM options you buy. Under $1 extrinsic = excellent ZEBRA." />
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-purple-500" />
              Stock Score: Fundamental strength
              <InfoTooltip content="A composite score (1-10) measuring the stock's fundamental quality - revenue growth, earnings, balance sheet strength, analyst ratings. Higher scores = more confidence the stock will trend in your direction. Look for 7+ for high-conviction ZEBRAs." />
            </div>
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3 text-orange-500" />
              B/E Dist: Distance to breakeven %
              <InfoTooltip content="How far current price is from breakeven. Positive = stock needs to rise (for call ZEBRA). Negative = stock needs to fall. Under 3% = you're close to profiting already. This helps gauge how much the stock needs to move before you make money." />
            </div>
          </div>

          {/* Results */}
          {error && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg mb-4">
              <AlertTriangle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          {filteredSetups.length === 0 && !isLoading && !error && (
            <div className="text-center py-12 text-gray-500">
              <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No ZEBRA setups loaded.</p>
              <p className="text-sm">Click Refresh to scan for ZEBRA opportunities.</p>
            </div>
          )}

          {filteredSetups.length > 0 && (
            <div className="grid gap-4">
              {filteredSetups.map((setup) => (
                <Card
                  key={`${setup.ticker}-${setup.type}-${setup.longStrike}`}
                  className="border-l-4 border-l-yellow-500"
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">{setup.ticker}</span>
                          <Badge
                            variant="outline"
                            className={setup.type === "call" ? "text-green-600" : "text-red-600"}
                          >
                            {setup.type.toUpperCase()} ZEBRA
                          </Badge>
                          {getTrendBadge(setup.trend)}
                          {getSignalBadge(setup.signal)}
                        </div>
                        <p className="text-sm text-gray-500">{setup.company}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Current Price</p>
                        <p className="font-semibold">${setup.currentPrice.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <div className="text-center mb-2">
                        <p className="text-xs text-gray-500 uppercase">ZEBRA Structure</p>
                      </div>
                      <div className="flex items-center justify-center gap-6">
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Buy 2x ITM {setup.type === "call" ? "Calls" : "Puts"}</p>
                          <p className="font-mono font-bold text-lg text-green-600">${setup.longStrike}</p>
                        </div>
                        <div className="text-2xl text-gray-300">+</div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Sell 1x ATM {setup.type === "call" ? "Call" : "Put"}</p>
                          <p className="font-mono font-bold text-lg text-red-600">${setup.shortStrike}</p>
                        </div>
                      </div>
                      <div className="mt-2 text-center text-sm">
                        <span className="text-gray-500">Net Debit: </span>
                        <span className="font-semibold">${setup.netDebit.toFixed(2)}</span>
                        <span className="text-gray-400 mx-2">|</span>
                        <span className="text-gray-500">Position Delta: </span>
                        <span className="font-semibold text-blue-600">{setup.delta.toFixed(0)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-3 text-sm mb-3">
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Max Loss
                          <InfoTooltip content="The maximum you can lose is your net debit paid. Unlike buying stock (where you could theoretically lose everything), your risk is capped. This is the DEFINED RISK benefit of ZEBRA - you know your worst case before entering. Example: $1,500 max loss means that's the most you can ever lose on this trade." />
                        </p>
                        <p className="font-semibold text-red-600">${setup.maxLoss.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Max Profit
                          <InfoTooltip content="For call ZEBRAs, profit is theoretically unlimited as the stock rises (like owning stock). For put ZEBRAs, max profit is if stock goes to zero. In practice, think of it as: with ~100 delta, you make about $100 per contract for every $1 the stock moves in your favor." />
                        </p>
                        <p className="font-semibold text-green-600">{setup.maxProfit}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Breakeven
                          <InfoTooltip content="The stock price where you start making money at expiration. For a call ZEBRA: roughly your lower strike + net debit paid per share. Above this price, every dollar the stock rises is approximately a dollar of profit for you (with ~100 delta)." />
                        </p>
                        <p className="font-semibold">${setup.breakeven.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          B/E Dist
                          <InfoTooltip content="Breakeven Distance shows how far the stock needs to move to reach profitability. +2.5% means the stock needs to rise 2.5% from current price. -1.5% means it needs to fall 1.5%. Closer to 0% = better entry point. Under 3% distance is generally favorable." />
                        </p>
                        <p
                          className={`font-semibold ${Math.abs(setup.distanceToBreakeven) < 3 ? "text-green-600" : ""}`}
                        >
                          {setup.distanceToBreakeven > 0 ? "+" : ""}
                          {setup.distanceToBreakeven.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          DTE
                          <InfoTooltip content="Days to Expiration - how long you have for your directional thesis to play out. ZEBRAs don't suffer much from time decay (because you paid almost zero extrinsic), so you can hold longer without theta burning you. 60-120 days is common for ZEBRAs." />
                        </p>
                        <p className="font-semibold">{setup.dte}d</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 text-sm pt-2 border-t">
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Extrinsic
                          <InfoTooltip content="The total time premium paid for this ZEBRA position. The goal is near ZERO - that's what makes ZEBRA special. Under $1.00 is excellent. Under $0.50 is ideal. If extrinsic is high, the ZEBRA structure isn't working properly - look for a different setup." />
                        </p>
                        <p
                          className={`font-semibold ${setup.extrinsicPaid < 1 ? "text-green-600" : "text-yellow-600"}`}
                        >
                          ${setup.extrinsicPaid.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Stock Score
                          <InfoTooltip content="Fundamental strength score from 1-10 based on revenue growth, earnings, margins, and analyst ratings. 7+ = strong company likely to trend. 5-6 = average. Under 5 = weak fundamentals. For directional bets like ZEBRA, you want fundamentally strong stocks (7+) moving in your direction." />
                        </p>
                        <p className={`font-semibold ${setup.stockScore >= 7 ? "text-green-600" : ""}`}>
                          {setup.stockScore}/10
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Leverage
                          <InfoTooltip content="Capital efficiency vs buying stock outright. 2.5x leverage means you control $25,000 worth of stock exposure with $10,000 in capital. ZEBRA gives you stock-like returns with less capital at risk. Higher leverage = more capital efficient but requires getting direction right." />
                        </p>
                        <p className="font-semibold">{setup.leverageRatio.toFixed(1)}x</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Opt Volume
                          <InfoTooltip content="Options trading volume - higher is better for liquidity. 10K+ daily volume means tight bid-ask spreads and easy entry/exit. Low volume (<1K) can mean wide spreads and difficulty closing the position at a fair price. Stick to liquid options (5K+ volume)." />
                        </p>
                        <p className="font-semibold">{(setup.optionVolume / 1000).toFixed(0)}K</p>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-gray-600 bg-yellow-50 p-2 rounded">
                      <strong>Setup Rationale:</strong> {setup.reason}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
