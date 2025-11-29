"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  Calendar,
  Clock,
  Filter,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Wifi,
  WifiOff,
  TrendingUp,
  Activity,
  Shield,
} from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"

interface CalendarSpreadSetup {
  ticker: string
  company: string
  type: "call" | "put"
  strike: number
  currentPrice: number
  nearExpiration: string
  nearDte: number
  farExpiration: string
  farDte: number
  debit: number
  maxProfit: number
  breakeven: { low: number; high: number }
  // Calendar spread specific KPIs
  beta: number
  historicalVolatility: number
  ivSkew: number // Front IV - Back IV (positive = favorable)
  priceStability: number // % price stayed in range over 30 days
  marketCap: string
  daysNoEarnings: number // Days until next earnings
  thetaAdvantage: number // Near theta / Far theta ratio
  signal: "strong" | "moderate" | "speculative"
  reason: string
  dataSource?: string
  isLive?: boolean
}

export function CalendarSpreadScanner() {
  const [spreads, setSpreads] = useState<CalendarSpreadSetup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [spreadType, setSpreadType] = useState<"all" | "call" | "put">("all")
  const [maxBeta, setMaxBeta] = useState(1.0)
  const [maxHV, setMaxHV] = useState(35)
  const [minStability, setMinStability] = useState(70)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [isLiveData, setIsLiveData] = useState(false)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  useEffect(() => {
    const cached = localStorage.getItem("calendar-spread-scanner-cache")
    if (cached) {
      try {
        const { data, timestamp, isLive } = JSON.parse(cached)
        setSpreads(data)
        setLastUpdated(timestamp)
        setIsLiveData(isLive)
      } catch {
        // Invalid cache, will fetch fresh
      }
    }
  }, [])

  const filteredSetups = spreads.filter((s) => {
    if (spreadType !== "all" && s.type !== spreadType) return false
    if (s.beta > maxBeta) return false
    if (s.historicalVolatility > maxHV) return false
    if (s.priceStability < minStability) return false
    return true
  })

  const handleRefresh = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/strategy-scanner?type=calendar-spreads")

      if (!response.ok) {
        // Try to get error message from response body
        const text = await response.text()
        console.error("[Calendar Spread Scanner] Server error:", response.status, text)
        throw new Error(`API returned ${response.status}`)
      }

      let data
      try {
        data = await response.json()
      } catch (parseError) {
        console.error("[Calendar Spread Scanner] JSON parse error:", parseError)
        throw new Error("Invalid response from server")
      }

      // Even if response wasn't ok, we might have data with empty arrays
      if (data.calendarSpreads && Array.isArray(data.calendarSpreads)) {
        setSpreads(data.calendarSpreads)
        setIsLiveData(data.isLive || false)
        const timestamp = new Date().toISOString()
        setLastUpdated(timestamp)

        localStorage.setItem(
          "calendar-spread-scanner-cache",
          JSON.stringify({
            data: data.calendarSpreads,
            timestamp,
            isLive: data.isLive || false,
          }),
        )

        if (data.calendarSpreads.length === 0) {
          setError("No calendar spread candidates found. Try refreshing later.")
        }
      } else {
        // Response ok but no data
        setSpreads([])
        setError("No data available. Try refreshing.")
      }
    } catch (err) {
      console.error("[Calendar Spread Scanner] Fetch error:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch data")
    } finally {
      setIsLoading(false)
    }
  }

  const getSignalBadge = (signal: string) => {
    switch (signal) {
      case "strong":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Strong
          </Badge>
        )
      case "moderate":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Moderate
          </Badge>
        )
      default:
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-300">
            <Clock className="w-3 h-3 mr-1" />
            Speculative
          </Badge>
        )
    }
  }

  const getBetaBadge = (beta: number) => {
    if (beta < 0.7) {
      return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Low Beta</Badge>
    } else if (beta < 1.0) {
      return <Badge className="bg-green-100 text-green-800 border-green-300">Stable</Badge>
    } else {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Higher Beta</Badge>
    }
  }

  return (
    <TooltipProvider disabled={!tooltipsEnabled}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-500" />
                Calendar Spread Scanner
                {isLiveData ? (
                  <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-300">
                    <Wifi className="w-3 h-3 mr-1" />
                    LIVE
                  </Badge>
                ) : spreads.length > 0 ? (
                  <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-300">
                    <WifiOff className="w-3 h-3 mr-1" />
                    Cached
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>
                Time decay strategies on stable, low-volatility stocks
                {lastUpdated && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    Updated: {new Date(lastUpdated).toLocaleTimeString()}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
              <RefreshButton onClick={handleRefresh} isLoading={isLoading} loadingText="Scanning..." />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Educational Info Banner */}
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-indigo-800">
                <strong>Calendar Spreads</strong> profit from time decay (theta) by selling near-term options and buying
                longer-term options at the same strike. Best on <strong>stable, low-volatility stocks</strong> with
                minimal price movement expected. Ideal when front-month IV is elevated relative to back-month.
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={spreadType} onValueChange={(v: "all" | "call" | "put") => setSpreadType(v)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="call">Call Calendar</SelectItem>
                <SelectItem value="put">Put Calendar</SelectItem>
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Max Beta:</span>
                  <Slider
                    value={[maxBeta]}
                    onValueChange={(v) => setMaxBeta(v[0])}
                    min={0.3}
                    max={1.5}
                    step={0.1}
                    className="w-24"
                  />
                  <span className="text-sm font-medium w-8">{maxBeta.toFixed(1)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Lower beta = less market correlation, more stable</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Max HV:</span>
                  <Slider
                    value={[maxHV]}
                    onValueChange={(v) => setMaxHV(v[0])}
                    min={10}
                    max={60}
                    step={5}
                    className="w-24"
                  />
                  <span className="text-sm font-medium w-8">{maxHV}%</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Historical Volatility - lower is better for calendars</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Min Stability:</span>
                  <Slider
                    value={[minStability]}
                    onValueChange={(v) => setMinStability(v[0])}
                    min={50}
                    max={95}
                    step={5}
                    className="w-24"
                  />
                  <span className="text-sm font-medium w-8">{minStability}%</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Price stability score - % time in trading range</TooltipContent>
            </Tooltip>
          </div>

          {/* Key Metrics Legend */}
          <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Activity className="w-3 h-3" />
              <span>Beta: Market correlation</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              <span>HV: Historical volatility</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Shield className="w-3 h-3" />
              <span>Stability: Price range consistency</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>IV Skew: Front vs back IV</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {spreads.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No calendar spread data loaded.</p>
              <p className="text-sm">Click Refresh to scan for stable, low-volatility opportunities.</p>
            </div>
          )}

          <Accordion type="single" collapsible className="space-y-2">
            {filteredSetups.map((setup, idx) => (
              <AccordionItem key={`${setup.ticker}-${setup.type}-${idx}`} value={`${setup.ticker}-${idx}`}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${setup.type === "call" ? "bg-indigo-100" : "bg-violet-100"}`}>
                        <Calendar
                          className={`w-4 h-4 ${setup.type === "call" ? "text-indigo-600" : "text-violet-600"}`}
                        />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold flex items-center gap-2">
                          {setup.ticker}
                          {getBetaBadge(setup.beta)}
                        </div>
                        <div className="text-xs text-muted-foreground">{setup.company}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getSignalBadge(setup.signal)}
                      <div className="text-right">
                        <div className="font-semibold text-indigo-600">${setup.debit.toFixed(2)} debit</div>
                        <div className="text-xs text-muted-foreground">Max: ${setup.maxProfit.toFixed(2)} profit</div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                    <div>
                      <div className="text-xs text-muted-foreground">Strategy</div>
                      <div className="font-medium capitalize">{setup.type} Calendar</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Strike</div>
                      <div className="font-medium">${setup.strike}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Current Price</div>
                      <div className="font-medium">${setup.currentPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Near Exp (Sell)</div>
                      <div className="font-medium">
                        {setup.nearExpiration} ({setup.nearDte}d)
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Far Exp (Buy)</div>
                      <div className="font-medium">
                        {setup.farExpiration} ({setup.farDte}d)
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Breakeven Range</div>
                      <div className="font-medium">
                        ${setup.breakeven.low.toFixed(0)} - ${setup.breakeven.high.toFixed(0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Beta</div>
                      <div className="font-medium">{setup.beta.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Historical Vol</div>
                      <div className="font-medium">{setup.historicalVolatility.toFixed(1)}%</div>
                    </div>
                  </div>

                  {/* Calendar-specific KPIs */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 mt-2 bg-indigo-50 rounded-lg">
                    <div>
                      <div className="text-xs text-indigo-600 font-medium">IV Skew</div>
                      <div className={`font-medium ${setup.ivSkew > 0 ? "text-green-600" : "text-red-600"}`}>
                        {setup.ivSkew > 0 ? "+" : ""}
                        {setup.ivSkew.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {setup.ivSkew > 0 ? "Favorable" : "Unfavorable"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-indigo-600 font-medium">Price Stability</div>
                      <div className="font-medium">{setup.priceStability}%</div>
                      <div className="text-xs text-muted-foreground">30-day range</div>
                    </div>
                    <div>
                      <div className="text-xs text-indigo-600 font-medium">Days to Earnings</div>
                      <div className="font-medium">{setup.daysNoEarnings > 90 ? "90+" : setup.daysNoEarnings}d</div>
                      <div className="text-xs text-muted-foreground">
                        {setup.daysNoEarnings > 45 ? "Safe" : "Watch out"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-indigo-600 font-medium">Theta Advantage</div>
                      <div className="font-medium">{setup.thetaAdvantage.toFixed(1)}x</div>
                      <div className="text-xs text-muted-foreground">Near/Far decay ratio</div>
                    </div>
                  </div>

                  <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-indigo-500 mt-0.5" />
                      <div className="text-sm text-indigo-800">{setup.reason}</div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {spreads.length > 0 && (
            <div className="mt-4 pt-4 border-t text-xs text-muted-foreground flex items-center justify-between">
              <span>Ideal for: Stable blue-chips, utilities, consumer staples, low-beta ETFs</span>
              <span>
                {filteredSetups.length} of {spreads.length} setups shown
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
