"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  RefreshCw,
  Flame,
  TrendingUp,
  TrendingDown,
  Filter,
  ArrowUpRight,
  Info,
  Activity,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { TooltipProvider } from "@/components/ui/tooltip"

interface IVCandidate {
  ticker: string
  company: string
  price: number
  ivRank: number
  ivPercentile: number
  currentIV: number
  historicalIV: number
  hvRatio: number
  catalyst: string | null
  daysToEvent: number | null
  recommendation: "sell-premium" | "buy-premium" | "neutral"
  reason: string
  dataSource?: string
  isLive?: boolean
}

export function HighIVWatchlist() {
  const [minIvRank, setMinIvRank] = useState([50])
  const [sortBy, setSortBy] = useState<"ivRank" | "ivPercentile" | "hvRatio">("ivRank")
  const [showOnly, setShowOnly] = useState<"all" | "sell" | "buy">("all")
  const [isLoading, setIsLoading] = useState(false)
  const [candidates, setCandidates] = useState<IVCandidate[]>([])
  const [isLiveData, setIsLiveData] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cached = localStorage.getItem("high-iv-watchlist-cache")
    if (cached) {
      try {
        const { data, timestamp, isLive } = JSON.parse(cached)
        setCandidates(data)
        setLastUpdated(timestamp)
        setIsLiveData(isLive)
      } catch {
        // Invalid cache
      }
    }
  }, [])

  const filteredCandidates = candidates
    .filter((c) => {
      if (c.ivRank < minIvRank[0]) return false
      if (showOnly === "sell" && c.recommendation !== "sell-premium") return false
      if (showOnly === "buy" && c.recommendation !== "buy-premium") return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === "ivRank") return b.ivRank - a.ivRank
      if (sortBy === "ivPercentile") return b.ivPercentile - a.ivPercentile
      return b.hvRatio - a.hvRatio
    })

  const handleRefresh = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/strategy-scanner?type=high-iv")

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const data = await response.json()

      if (data.highIV && data.highIV.length > 0) {
        setCandidates(data.highIV)
        setIsLiveData(data.isLive === true)
        setLastUpdated(new Date().toISOString())

        localStorage.setItem(
          "high-iv-watchlist-cache",
          JSON.stringify({
            data: data.highIV,
            timestamp: new Date().toISOString(),
            isLive: data.isLive === true,
          }),
        )
      } else {
        setError("No high IV candidates found")
      }
    } catch (err) {
      console.error("[High IV Watchlist] Fetch error:", err)
      setError("Failed to fetch live data")
    } finally {
      setIsLoading(false)
    }
  }

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case "sell-premium":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <TrendingDown className="w-3 h-3 mr-1" />
            Sell Premium
          </Badge>
        )
      case "buy-premium":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            <TrendingUp className="w-3 h-3 mr-1" />
            Buy Premium
          </Badge>
        )
      default:
        return (
          <Badge className="bg-slate-100 text-slate-800 border-slate-300">
            <Activity className="w-3 h-3 mr-1" />
            Neutral
          </Badge>
        )
    }
  }

  const getIVRankColor = (ivRank: number) => {
    if (ivRank >= 80) return "text-red-600"
    if (ivRank >= 60) return "text-orange-500"
    if (ivRank >= 40) return "text-yellow-500"
    if (ivRank >= 20) return "text-green-500"
    return "text-blue-500"
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                High IV Watchlist
                {isLiveData ? (
                  <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-300">
                    <Wifi className="w-3 h-3 mr-1" />
                    LIVE
                  </Badge>
                ) : candidates.length > 0 ? (
                  <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-300">
                    <WifiOff className="w-3 h-3 mr-1" />
                    Cached
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>
                Stocks with elevated implied volatility for premium selling
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
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Min IV Rank:</span>
              <Slider value={minIvRank} onValueChange={setMinIvRank} min={0} max={90} step={10} className="w-24" />
              <span className="text-sm font-medium w-8">{minIvRank[0]}%</span>
            </div>
            <Select value={sortBy} onValueChange={(v: "ivRank" | "ivPercentile" | "hvRatio") => setSortBy(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ivRank">IV Rank</SelectItem>
                <SelectItem value="ivPercentile">IV Percentile</SelectItem>
                <SelectItem value="hvRatio">HV Ratio</SelectItem>
              </SelectContent>
            </Select>
            <Select value={showOnly} onValueChange={(v: "all" | "sell" | "buy") => setShowOnly(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Show" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="sell">Sell Premium</SelectItem>
                <SelectItem value="buy">Buy Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {candidates.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <Flame className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No IV watchlist data loaded.</p>
              <p className="text-sm">Click Refresh to scan for high IV opportunities.</p>
            </div>
          )}

          <Accordion type="single" collapsible className="space-y-2">
            {filteredCandidates.map((candidate, idx) => (
              <AccordionItem key={`${candidate.ticker}-${idx}`} value={`${candidate.ticker}-${idx}`}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-100">
                        <Flame className="w-4 h-4 text-orange-600" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">{candidate.ticker}</div>
                        <div className="text-xs text-muted-foreground">${candidate.price.toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getRecommendationBadge(candidate.recommendation)}
                      <div className="text-right">
                        <div className={`font-semibold ${getIVRankColor(candidate.ivRank)}`}>
                          {candidate.ivRank}% IV Rank
                        </div>
                        <div className="text-xs text-muted-foreground">{candidate.hvRatio.toFixed(2)}x HV</div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                    <div>
                      <div className="text-xs text-muted-foreground">Company</div>
                      <div className="font-medium">{candidate.company}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Current IV</div>
                      <div className="font-medium">{candidate.currentIV}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Historical IV</div>
                      <div className="font-medium">{candidate.historicalIV}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">IV Percentile</div>
                      <div className="font-medium">{candidate.ivPercentile}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Catalyst</div>
                      <div className="font-medium">{candidate.catalyst || "None"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Days to Event</div>
                      <div className="font-medium">{candidate.daysToEvent ?? "N/A"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Data Source</div>
                      <div className="font-medium text-xs">{candidate.dataSource || "API"}</div>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-orange-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-orange-500 mt-0.5" />
                      <div className="text-sm text-orange-800">{candidate.reason}</div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {candidates.length > 0 && (
            <div className="mt-4 pt-4 border-t text-xs text-muted-foreground flex items-center justify-between">
              <span>Data: Polygon.io (options) + Finnhub (profiles)</span>
              <span>
                {filteredCandidates.length} of {candidates.length} candidates shown
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
