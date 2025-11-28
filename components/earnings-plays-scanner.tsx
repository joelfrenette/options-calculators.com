"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  RefreshCw,
  Calendar,
  TrendingUp,
  TrendingDown,
  Zap,
  Filter,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Target,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { TooltipProvider } from "@/components/ui/tooltip"

interface EarningsPlay {
  ticker: string
  company: string
  earningsDate: string
  earningsTime: "BMO" | "AMC"
  daysToEarnings: number
  price: number
  expectedMove: number
  expectedMovePercent: number
  ivRank: number
  historicalBeat: number
  avgPostEarningsMove: number
  straddlePrice: number
  strategy: "straddle" | "strangle" | "iron-condor" | "0dte-call" | "0dte-put"
  direction: "bullish" | "bearish" | "neutral"
  signal: "strong" | "moderate" | "speculative"
  thesis: string
  dataSource?: string
  isLive?: boolean
}

export function EarningsPlaysScanner() {
  const [strategyFilter, setStrategyFilter] = useState<"all" | "straddle" | "strangle" | "iron-condor" | "0dte">("all")
  const [timeframe, setTimeframe] = useState<"week" | "2weeks" | "month">("2weeks")
  const [isLoading, setIsLoading] = useState(false)
  const [plays, setPlays] = useState<EarningsPlay[]>([])
  const [isLiveData, setIsLiveData] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cached = localStorage.getItem("earnings-plays-scanner-cache")
    if (cached) {
      try {
        const { data, timestamp, isLive } = JSON.parse(cached)
        setPlays(data)
        setLastUpdated(timestamp)
        setIsLiveData(isLive)
      } catch {
        // Invalid cache
      }
    }
  }, [])

  const filteredPlays = plays.filter((p) => {
    if (strategyFilter === "0dte" && !p.strategy.startsWith("0dte")) return false
    if (strategyFilter !== "all" && strategyFilter !== "0dte" && p.strategy !== strategyFilter) return false
    if (timeframe === "week" && p.daysToEarnings > 7) return false
    if (timeframe === "2weeks" && p.daysToEarnings > 14) return false
    return true
  })

  const handleRefresh = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/strategy-scanner?type=earnings")

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const data = await response.json()

      if (data.earningsPlays && data.earningsPlays.length > 0) {
        setPlays(data.earningsPlays)
        setIsLiveData(data.isLive === true)
        setLastUpdated(new Date().toISOString())

        localStorage.setItem(
          "earnings-plays-scanner-cache",
          JSON.stringify({
            data: data.earningsPlays,
            timestamp: new Date().toISOString(),
            isLive: data.isLive === true,
          }),
        )
      } else {
        setError("No earnings plays found in the selected timeframe")
      }
    } catch (err) {
      console.error("[Earnings Plays Scanner] Fetch error:", err)
      setError("Failed to fetch live earnings data")
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
            <Zap className="w-3 h-3 mr-1" />
            Speculative
          </Badge>
        )
    }
  }

  const getDirectionBadge = (direction: string) => {
    switch (direction) {
      case "bullish":
        return (
          <Badge variant="outline" className="border-green-300 text-green-700">
            <TrendingUp className="w-3 h-3 mr-1" />
            Bullish
          </Badge>
        )
      case "bearish":
        return (
          <Badge variant="outline" className="border-red-300 text-red-700">
            <TrendingDown className="w-3 h-3 mr-1" />
            Bearish
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="border-slate-300 text-slate-700">
            <Target className="w-3 h-3 mr-1" />
            Neutral
          </Badge>
        )
    }
  }

  const getStrategyBadge = (strategy: string) => {
    const colors: Record<string, string> = {
      straddle: "bg-purple-100 text-purple-800",
      strangle: "bg-indigo-100 text-indigo-800",
      "iron-condor": "bg-blue-100 text-blue-800",
      "0dte-call": "bg-green-100 text-green-800",
      "0dte-put": "bg-red-100 text-red-800",
    }
    return <Badge className={colors[strategy] || "bg-slate-100 text-slate-800"}>{strategy.replace("-", " ")}</Badge>
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                Earnings Plays Scanner
                {isLiveData ? (
                  <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-300">
                    <Wifi className="w-3 h-3 mr-1" />
                    LIVE
                  </Badge>
                ) : plays.length > 0 ? (
                  <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-300">
                    <WifiOff className="w-3 h-3 mr-1" />
                    Cached
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>
                Options strategies for upcoming earnings announcements
                {lastUpdated && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    Updated: {new Date(lastUpdated).toLocaleTimeString()}
                  </span>
                )}
              </CardDescription>
            </div>
            <Button onClick={handleRefresh} disabled={isLoading} size="sm">
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {isLoading ? "Scanning..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select
              value={strategyFilter}
              onValueChange={(v: "all" | "straddle" | "strangle" | "iron-condor" | "0dte") => setStrategyFilter(v)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Strategies</SelectItem>
                <SelectItem value="straddle">Straddle</SelectItem>
                <SelectItem value="strangle">Strangle</SelectItem>
                <SelectItem value="iron-condor">Iron Condor</SelectItem>
                <SelectItem value="0dte">0DTE</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeframe} onValueChange={(v: "week" | "2weeks" | "month") => setTimeframe(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="2weeks">Next 2 Weeks</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {plays.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No earnings plays data loaded.</p>
              <p className="text-sm">Click Refresh to scan for upcoming earnings opportunities.</p>
            </div>
          )}

          <Accordion type="single" collapsible className="space-y-2">
            {filteredPlays.map((play, idx) => (
              <AccordionItem key={`${play.ticker}-${idx}`} value={`${play.ticker}-${idx}`}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100">
                        <Calendar className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">{play.ticker}</div>
                        <div className="text-xs text-muted-foreground">
                          {play.earningsDate} {play.earningsTime}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getSignalBadge(play.signal)}
                      {getStrategyBadge(play.strategy)}
                      <div className="text-right">
                        <div className="font-semibold">{play.daysToEarnings}d</div>
                        <div className="text-xs text-muted-foreground">±{play.expectedMovePercent.toFixed(1)}%</div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                    <div>
                      <div className="text-xs text-muted-foreground">Company</div>
                      <div className="font-medium">{play.company}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Price</div>
                      <div className="font-medium">${play.price.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Expected Move</div>
                      <div className="font-medium">
                        ±${play.expectedMove.toFixed(2)} ({play.expectedMovePercent.toFixed(1)}%)
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">IV Rank</div>
                      <div className="font-medium">{play.ivRank}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Historical Beat Rate</div>
                      <div className="font-medium">{play.historicalBeat}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Avg Post-Earnings Move</div>
                      <div className="font-medium">{play.avgPostEarningsMove.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">ATM Straddle</div>
                      <div className="font-medium">${play.straddlePrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Direction</div>
                      <div>{getDirectionBadge(play.direction)}</div>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                      <div className="text-sm text-blue-800">{play.thesis}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Data: {play.dataSource || "Finnhub + Polygon + calculated"}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {plays.length > 0 && (
            <div className="mt-4 pt-4 border-t text-xs text-muted-foreground flex items-center justify-between">
              <span>Data: Finnhub (earnings calendar) + Polygon (prices/IV)</span>
              <span>
                {filteredPlays.length} of {plays.length} plays shown
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}

export default EarningsPlaysScanner
