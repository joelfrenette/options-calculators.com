"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Clock, Filter, AlertTriangle, Info, Wifi, WifiOff, TrendingUp, Activity, Shield, Percent } from "lucide-react"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"

interface LEAPSSetup {
  ticker: string
  company: string
  type: "call" | "put"
  strike: number
  currentPrice: number
  expiration: string
  dte: number
  premium: number
  delta: number
  intrinsicValue: number
  extrinsicValue: number
  breakeven: number
  // LEAPS specific KPIs
  epsGrowth: number // 5-year EPS growth rate
  debtToEquity: number
  priceToBook: number
  marketCap: string
  sector: string
  analystRating: "Strong Buy" | "Buy" | "Hold" | "Sell"
  leverageRatio: number // Effective leverage vs stock
  annualizedCost: number // Cost per year as % of stock price
  signal: "strong" | "moderate" | "speculative"
  reason: string
  dataSource?: string
  isLive?: boolean
}

// Fundamentally strong stocks good for LEAPS
const LEAPS_TICKERS = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "META", // Big tech
  "JPM",
  "V",
  "MA",
  "BRK.B", // Financials
  "JNJ",
  "UNH",
  "PFE",
  "ABBV", // Healthcare
  "PG",
  "KO",
  "PEP",
  "WMT",
  "COST", // Consumer staples
  "XOM",
  "CVX", // Energy
  "HD",
  "LOW", // Retail
  "DIS",
  "NFLX", // Entertainment
]

export function LEAPSScanner() {
  const [setups, setSetups] = useState<LEAPSSetup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [optionType, setOptionType] = useState<"all" | "call" | "put">("all")
  const [minDTE, setMinDTE] = useState(365)
  const [maxDebtEquity, setMaxDebtEquity] = useState(1.5)
  const [minDelta, setMinDelta] = useState(0.7)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [isLiveData, setIsLiveData] = useState(false)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  useEffect(() => {
    const cached = localStorage.getItem("leaps-scanner-cache")
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
    if (s.dte < minDTE) return false
    if (s.debtToEquity > maxDebtEquity) return false
    if (Math.abs(s.delta) < minDelta) return false
    return true
  })

  const handleRefresh = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/strategy-scanner?type=leaps")

      if (!response.ok) {
        const text = await response.text()
        console.error("[LEAPS Scanner] Server error:", response.status, text)
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()

      if (data.leaps && data.leaps.length > 0) {
        setSetups(data.leaps)
        setIsLiveData(data.isLive || false)
        const timestamp = new Date().toLocaleString()
        setLastUpdated(timestamp)

        localStorage.setItem(
          "leaps-scanner-cache",
          JSON.stringify({ data: data.leaps, timestamp, isLive: data.isLive }),
        )
      } else {
        setError("No LEAPS setups found. Try adjusting filters.")
      }
    } catch (err) {
      console.error("[LEAPS Scanner] Fetch error:", err)
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

  const getRatingBadge = (rating: string) => {
    switch (rating) {
      case "Strong Buy":
        return <Badge className="bg-green-600 text-white">Strong Buy</Badge>
      case "Buy":
        return <Badge className="bg-green-100 text-green-800">Buy</Badge>
      case "Hold":
        return <Badge className="bg-gray-100 text-gray-800">Hold</Badge>
      default:
        return <Badge className="bg-red-100 text-red-800">Sell</Badge>
    }
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <CardTitle>LEAPS Scanner (Long-Term Options)</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
              <RefreshButton onClick={handleRefresh} isLoading={isLoading} loadingText="Scanning..." />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
            <p className="text-sm text-blue-800">
              <Info className="h-4 w-4 inline mr-1" />
              <strong>LEAPS</strong> (Long-Term Equity Anticipation Securities) are options with expirations 1+ years
              out. Best for <strong>fundamentally strong companies</strong> with consistent earnings growth, low debt,
              and strong analyst ratings. Use deep ITM calls (delta 0.70+) as a stock replacement strategy.
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
                <SelectItem value="call">Calls Only</SelectItem>
                <SelectItem value="put">Puts Only</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Min DTE:</span>
              <Slider
                value={[minDTE]}
                onValueChange={([v]) => setMinDTE(v)}
                min={180}
                max={730}
                step={30}
                className="w-24"
              />
              <span className="text-sm font-medium w-16">{minDTE}d</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Max D/E:</span>
              <Slider
                value={[maxDebtEquity]}
                onValueChange={([v]) => setMaxDebtEquity(v)}
                min={0}
                max={3}
                step={0.1}
                className="w-24"
              />
              <span className="text-sm font-medium w-12">{maxDebtEquity.toFixed(1)}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Min Delta:</span>
              <Slider
                value={[minDelta]}
                onValueChange={([v]) => setMinDelta(v)}
                min={0.5}
                max={0.95}
                step={0.05}
                className="w-24"
              />
              <span className="text-sm font-medium w-12">{minDelta.toFixed(2)}</span>
            </div>
          </div>

          {/* KPI Legend */}
          <div className="grid grid-cols-4 gap-4 mb-4 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              EPS Growth: 5-year earnings growth
            </div>
            <div className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-blue-500" />
              D/E: Debt-to-equity ratio
            </div>
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-purple-500" />
              Delta: Option sensitivity to stock
            </div>
            <div className="flex items-center gap-1">
              <Percent className="h-3 w-3 text-orange-500" />
              Ann. Cost: Yearly cost as % of stock
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
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No LEAPS setups loaded.</p>
              <p className="text-sm">Click Refresh to scan for long-term options opportunities.</p>
            </div>
          )}

          {filteredSetups.length > 0 && (
            <div className="grid gap-4">
              {filteredSetups.map((setup) => (
                <Card key={`${setup.ticker}-${setup.type}-${setup.strike}`} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">{setup.ticker}</span>
                          <Badge
                            variant="outline"
                            className={setup.type === "call" ? "text-green-600" : "text-red-600"}
                          >
                            {setup.type.toUpperCase()} LEAP
                          </Badge>
                          {getRatingBadge(setup.analystRating)}
                          {getSignalBadge(setup.signal)}
                        </div>
                        <p className="text-sm text-gray-500">
                          {setup.company} • {setup.sector}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Current Price</p>
                        <p className="font-semibold">${setup.currentPrice.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <div className="flex items-center justify-between">
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Strike</p>
                          <p className="font-mono font-bold text-lg">${setup.strike}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Premium</p>
                          <p className="font-mono font-bold text-lg">${setup.premium.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Delta</p>
                          <p className="font-mono font-bold text-lg text-blue-600">{setup.delta.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">DTE</p>
                          <p className="font-mono font-bold text-lg">{setup.dte}d</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Expiration</p>
                          <p className="font-mono font-bold">{setup.expiration}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-3 text-sm mb-3">
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Intrinsic
                          <InfoTooltip content="Value if exercised today (stock price - strike)" />
                        </p>
                        <p className="font-semibold text-green-600">${setup.intrinsicValue.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Extrinsic
                          <InfoTooltip content="Time value premium paid" />
                        </p>
                        <p className="font-semibold">${setup.extrinsicValue.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Breakeven
                          <InfoTooltip content="Stock price needed to break even at expiration" />
                        </p>
                        <p className="font-semibold">${setup.breakeven.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Leverage
                          <InfoTooltip content="Effective leverage ratio vs owning stock" />
                        </p>
                        <p className="font-semibold">{setup.leverageRatio.toFixed(1)}x</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Ann. Cost
                          <InfoTooltip content="Annualized cost of time value as % of stock price" />
                        </p>
                        <p className="font-semibold">{setup.annualizedCost.toFixed(1)}%</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 text-sm mb-3 pt-2 border-t">
                      <div>
                        <p className="text-gray-500 flex items-center">
                          EPS Growth
                          <InfoTooltip content="5-year earnings per share growth rate" />
                        </p>
                        <p className={`font-semibold ${setup.epsGrowth >= 10 ? "text-green-600" : ""}`}>
                          {setup.epsGrowth > 0 ? "+" : ""}
                          {setup.epsGrowth.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Debt/Equity
                          <InfoTooltip content="Lower is better - indicates financial health" />
                        </p>
                        <p
                          className={`font-semibold ${setup.debtToEquity < 0.5 ? "text-green-600" : setup.debtToEquity > 1.5 ? "text-red-600" : ""}`}
                        >
                          {setup.debtToEquity.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          P/B Ratio
                          <InfoTooltip content="Price-to-book ratio" />
                        </p>
                        <p className="font-semibold">{setup.priceToBook.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Market Cap
                          <InfoTooltip content="Company market capitalization" />
                        </p>
                        <p className="font-semibold">{setup.marketCap}</p>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-gray-600 bg-blue-50 p-2 rounded">
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
