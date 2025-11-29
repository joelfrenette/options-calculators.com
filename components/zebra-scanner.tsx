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
        <TooltipContent className="max-w-xs bg-white text-gray-900 border shadow-lg">
          <p className="text-xs">{content}</p>
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
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-green-500" />
              Extrinsic: Time value paid (lower = better)
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-purple-500" />
              Stock Score: Fundamental strength
            </div>
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3 text-orange-500" />
              B/E Dist: Distance to breakeven %
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
                          <InfoTooltip content="Maximum loss is limited to net debit paid" />
                        </p>
                        <p className="font-semibold text-red-600">${setup.maxLoss.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Max Profit
                          <InfoTooltip content="Profit potential as stock moves in your direction" />
                        </p>
                        <p className="font-semibold text-green-600">{setup.maxProfit}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Breakeven
                          <InfoTooltip content="Stock price needed to break even" />
                        </p>
                        <p className="font-semibold">${setup.breakeven.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          B/E Dist
                          <InfoTooltip content="Distance from current price to breakeven" />
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
                          <InfoTooltip content="Days to expiration" />
                        </p>
                        <p className="font-semibold">{setup.dte}d</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 text-sm pt-2 border-t">
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Extrinsic
                          <InfoTooltip content="Time value paid - should be near zero for ZEBRA" />
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
                          <InfoTooltip content="Fundamental + growth score (higher = better)" />
                        </p>
                        <p className={`font-semibold ${setup.stockScore >= 7 ? "text-green-600" : ""}`}>
                          {setup.stockScore}/10
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Leverage
                          <InfoTooltip content="Capital efficiency vs owning stock" />
                        </p>
                        <p className="font-semibold">{setup.leverageRatio.toFixed(1)}x</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Opt Volume
                          <InfoTooltip content="Options volume for liquidity" />
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
