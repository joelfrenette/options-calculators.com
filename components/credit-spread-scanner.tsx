"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Info, Loader2, Target, DollarSign, AlertTriangle, Filter } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"

interface SpreadSetup {
  ticker: string
  company: string
  type: "bull-put" | "bear-call"
  shortStrike: number
  longStrike: number
  expiration: string
  dte: number
  credit: number
  maxLoss: number
  probability: number
  ivRank: number
  delta: number
  riskReward: string
  signal: "strong" | "moderate" | "speculative"
  reason: string
  dataSource?: string
  isLive?: boolean
}

export function CreditSpreadScanner() {
  const [spreadType, setSpreadType] = useState<"all" | "bull-put" | "bear-call">("all")
  const [minProbability, setMinProbability] = useState([70])
  const [maxDte, setMaxDte] = useState([45])
  const [isLoading, setIsLoading] = useState(false)
  const [setups, setSetups] = useState<SpreadSetup[]>([])
  const [isLiveData, setIsLiveData] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cached = localStorage.getItem("credit-spread-scanner-cache")
    if (cached) {
      try {
        const { data, timestamp, isLive } = JSON.parse(cached)
        setSetups(data)
        setLastUpdated(timestamp)
        setIsLiveData(isLive)
      } catch {
        // Invalid cache, will fetch fresh
      }
    }
  }, [])

  const filteredSetups = setups.filter((s) => {
    if (spreadType !== "all" && s.type !== spreadType) return false
    if (s.probability < minProbability[0]) return false
    if (s.dte > maxDte[0]) return false
    return true
  })

  const handleRefresh = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/strategy-scanner?type=credit-spreads")

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const data = await response.json()

      if (data.creditSpreads && data.creditSpreads.length > 0) {
        setSetups(data.creditSpreads)
        setIsLiveData(data.isLive === true)
        setLastUpdated(new Date().toISOString())

        localStorage.setItem(
          "credit-spread-scanner-cache",
          JSON.stringify({
            data: data.creditSpreads,
            timestamp: new Date().toISOString(),
            isLive: data.isLive === true,
          }),
        )
      } else {
        setError("No setups found matching criteria")
      }
    } catch (err) {
      console.error("[Credit Spread Scanner] Fetch error:", err)
      setError("Failed to fetch live data. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const getSignalBadge = (signal: string) => {
    switch (signal) {
      case "strong":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <Loader2 className="w-3 h-3 mr-1" />
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
            <Filter className="w-3 h-3 mr-1" />
            Speculative
          </Badge>
        )
    }
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-500" />
                Credit Spread Scanner
                {isLiveData ? (
                  <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-300">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    LIVE
                  </Badge>
                ) : setups.length > 0 ? (
                  <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-300">
                    <TrendingDown className="w-3 h-3 mr-1" />
                    Cached
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>
                High-probability bull put and bear call spreads
                {lastUpdated && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    Updated: {new Date(lastUpdated).toLocaleTimeString()}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <RefreshButton onClick={handleRefresh} disabled={isLoading} />
              <TooltipsToggle />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={spreadType} onValueChange={(v: "all" | "bull-put" | "bear-call") => setSpreadType(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="bull-put">Bull Put</SelectItem>
                <SelectItem value="bear-call">Bear Call</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Min Prob:</span>
              <Slider
                value={minProbability}
                onValueChange={setMinProbability}
                min={50}
                max={90}
                step={5}
                className="w-24"
              />
              <span className="text-sm font-medium w-8">{minProbability[0]}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Max DTE:</span>
              <Slider value={maxDte} onValueChange={setMaxDte} min={7} max={60} step={7} className="w-24" />
              <span className="text-sm font-medium w-8">{maxDte[0]}d</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {setups.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No credit spread data loaded.</p>
              <p className="text-sm">Click Refresh to scan for opportunities.</p>
            </div>
          )}

          <div className="space-y-2">
            {filteredSetups.map((setup, idx) => (
              <div key={`${setup.ticker}-${setup.type}-${idx}`} className="border rounded-lg">
                <div className="flex items-center justify-between p-4 hover:bg-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${setup.type === "bull-put" ? "bg-green-100" : "bg-red-100"}`}>
                      {setup.type === "bull-put" ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">{setup.ticker}</div>
                      <div className="text-xs text-muted-foreground">{setup.company}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getSignalBadge(setup.signal)}
                    <div className="text-right">
                      <div className="font-semibold text-green-600">${setup.credit.toFixed(2)} credit</div>
                      <div className="text-xs text-muted-foreground">{setup.probability}% prob</div>
                    </div>
                    <DollarSign className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <div className="text-xs text-muted-foreground">Strategy</div>
                    <div className="font-medium capitalize">{setup.type.replace("-", " ")}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Strikes</div>
                    <div className="font-medium">
                      ${setup.shortStrike} / ${setup.longStrike}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Expiration</div>
                    <div className="font-medium">
                      {setup.expiration} ({setup.dte}d)
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Max Loss</div>
                    <div className="font-medium text-red-600">${setup.maxLoss.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">IV Rank</div>
                    <div className="font-medium">{setup.ivRank}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Delta</div>
                    <div className="font-medium">{setup.delta.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Risk/Reward</div>
                    <div className="font-medium">{setup.riskReward}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Data Source</div>
                    <div className="font-medium text-xs">{setup.dataSource || "API"}</div>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                    <div className="text-sm text-blue-800">{setup.reason}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {setups.length > 0 && (
            <div className="mt-4 pt-4 border-t text-xs text-muted-foreground flex items-center justify-between">
              <span>Data: Polygon.io (prices) + Black-Scholes calculations</span>
              <span>
                {filteredSetups.length} of {setups.length} setups shown
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
