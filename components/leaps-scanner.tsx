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
              <InfoTooltip content="These filters help you find quality LEAPS candidates. Focus on companies with low debt, strong earnings growth, and high delta options. LEAPS are a long-term commitment - you want fundamentally solid companies that will grow over 1-2 years." />
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
              <InfoTooltip content="Minimum Days to Expiration. LEAPS are defined as options with 1+ year until expiration. The longer the DTE, the more time you have for your thesis to play out - but you also pay more time premium. 365+ days is standard for LEAPS. Some traders go 500+ days for major positions." />
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
              <InfoTooltip content="Maximum Debt-to-Equity ratio. This measures how much debt a company has compared to shareholder equity. Lower is safer - a D/E of 0.5 means the company has $0.50 of debt for every $1 of equity. For LEAPS, you want financially healthy companies (D/E under 1.0) that won't struggle if the economy slows." />
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
              <InfoTooltip content="Minimum Delta for the LEAPS option. Delta tells you how much the option moves for every $1 the stock moves. A 0.70 delta call gains ~$70 when the stock rises $1 (per contract). For stock replacement, use deep ITM options with 0.70-0.85 delta - they move almost like stock but cost less capital." />
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
              <InfoTooltip content="Earnings Per Share growth over 5 years. A company growing EPS 15%+ annually is building real value. For LEAPS, you want companies that will be worth MORE in 1-2 years - consistent earnings growth is the best predictor of that." />
            </div>
            <div className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-blue-500" />
              D/E: Debt-to-equity ratio
              <InfoTooltip content="How much debt vs equity the company has. Under 0.5 = very conservative. Under 1.0 = healthy. Over 1.5 = higher risk. Avoid high-debt companies for LEAPS - they're more vulnerable to economic downturns and rising interest rates." />
            </div>
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-purple-500" />
              Delta: Option sensitivity to stock
              <InfoTooltip content="How much your option moves per $1 stock move. A 0.80 delta LEAP call moves $80 per contract when the stock rises $1. Deep ITM LEAPS (0.70+ delta) act like stock but cost 20-30% of buying shares outright - that's the leverage advantage." />
            </div>
            <div className="flex items-center gap-1">
              <Percent className="h-3 w-3 text-orange-500" />
              Ann. Cost: Yearly cost as % of stock
              <InfoTooltip content="The annualized cost of the extrinsic (time) value as a percentage of the stock price. If a stock is $100 and you pay $5 in extrinsic for a 2-year LEAP, that's 2.5% per year. Lower is better - you're essentially paying 'rent' for the leverage." />
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
                          <InfoTooltip content="Intrinsic value is the 'real' value - what the option is worth if exercised immediately. For a call: Stock Price - Strike Price. If stock is $150 and strike is $120, intrinsic value is $30 ($3,000 per contract). This is the portion of the premium that's guaranteed value, not time premium." />
                        </p>
                        <p className="font-semibold text-green-600">${setup.intrinsicValue.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Extrinsic
                          <InfoTooltip content="Extrinsic value is the 'time premium' - what you pay above intrinsic value for the privilege of controlling the stock with less capital. This portion decays over time (theta). For LEAPS, lower extrinsic is better. Deep ITM options have less extrinsic than ATM options." />
                        </p>
                        <p className="font-semibold">${setup.extrinsicValue.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Breakeven
                          <InfoTooltip content="The stock price where you break even at expiration. For a call LEAP: Strike + Premium Paid. If you pay $35 for a $120 strike call, breakeven is $155. The stock must be above this price at expiration for you to profit (or you can sell the LEAP earlier if it gains value)." />
                        </p>
                        <p className="font-semibold">${setup.breakeven.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Leverage
                          <InfoTooltip content="How much stock exposure you get per dollar invested compared to buying shares. 3x leverage means you control 3x more stock value than your investment. Example: $10,000 in LEAPS might give you exposure to $30,000 worth of stock. Higher leverage = more profit potential but also more risk if wrong." />
                        </p>
                        <p className="font-semibold">{setup.leverageRatio.toFixed(1)}x</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Ann. Cost
                          <InfoTooltip content="The yearly 'cost' of using LEAPS instead of stock, expressed as a percentage of the stock price. A 3% annual cost means you're paying 3% per year in time decay for the leverage benefit. Compare this to margin interest rates (6-8%) - LEAPS can be cheaper! Lower is better." />
                        </p>
                        <p className="font-semibold">{setup.annualizedCost.toFixed(1)}%</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 text-sm mb-3 pt-2 border-t">
                      <div>
                        <p className="text-gray-500 flex items-center">
                          EPS Growth
                          <InfoTooltip content="5-year Earnings Per Share growth rate. This shows if the company is actually making more money over time. 10%+ annual growth is solid. 15%+ is excellent. Negative growth is a red flag for LEAPS - you're betting the stock will be higher in 1-2 years, so you need a growing company." />
                        </p>
                        <p className={`font-semibold ${setup.epsGrowth >= 10 ? "text-green-600" : ""}`}>
                          {setup.epsGrowth > 0 ? "+" : ""}
                          {setup.epsGrowth.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Debt/Equity
                          <InfoTooltip content="Debt-to-Equity ratio measures financial health. Under 0.5 = very safe (green). 0.5-1.0 = normal. Over 1.5 = concerning (red). High-debt companies are riskier for LEAPS because they may struggle in recessions or if interest rates rise, hurting the stock price over your holding period." />
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
                          <InfoTooltip content="Price-to-Book ratio compares stock price to the company's net assets. A P/B of 3 means you're paying $3 for every $1 of book value. Lower P/B can indicate value (or problems). Higher P/B often means investors expect strong growth. For LEAPS, compare P/B to peers in the same industry." />
                        </p>
                        <p className="font-semibold">{setup.priceToBook.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 flex items-center">
                          Market Cap
                          <InfoTooltip content="The total market value of the company (share price × shares outstanding). Larger market cap ($100B+) = more stable, less volatile. Smaller cap = more growth potential but more risk. For LEAPS, large caps are safer; mid-caps offer more upside if you're confident in your thesis." />
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
