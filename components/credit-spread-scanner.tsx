"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Info, Loader2, Target, DollarSign, AlertTriangle, Filter } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

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

  const InfoTooltip = ({ content }: { content: string }) => {
    if (!tooltipsEnabled) return null
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help ml-1 inline-block" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-white border border-gray-200 shadow-lg p-3 z-50">
          <p className="text-sm text-gray-700">{content}</p>
        </TooltipContent>
      </Tooltip>
    )
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
                <InfoTooltip content="Credit spreads are defined-risk options strategies that collect premium by selling a higher-probability option and buying a further OTM option for protection. Bull put spreads profit when stock stays above the short strike; bear call spreads profit when stock stays below." />
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
              <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
              <RefreshButton onClick={handleRefresh} isLoading={isLoading} loadingText="Scanning..." />
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
              <InfoTooltip content="Minimum probability of profit (POP). Higher values (70%+) mean more conservative trades with smaller credits. Lower values offer larger credits but higher risk." />
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
              <InfoTooltip content="Maximum Days to Expiration. Shorter DTE (7-21 days) offers faster theta decay but less time to be right. Longer DTE (30-45 days) provides more premium but ties up capital longer." />
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
                    <div className="text-xs text-muted-foreground flex items-center">
                      Strategy
                      <InfoTooltip content="Bull Put: Bullish strategy - sell put, buy lower put. Bear Call: Bearish strategy - sell call, buy higher call." />
                    </div>
                    <div className="font-medium capitalize">{setup.type.replace("-", " ")}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center">
                      Strikes
                      <InfoTooltip content="Short strike (sold) / Long strike (bought). The width between strikes determines max loss." />
                    </div>
                    <div className="font-medium">
                      ${setup.shortStrike} / ${setup.longStrike}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center">
                      Expiration
                      <InfoTooltip content="Option expiration date and days remaining. Theta decay accelerates in final 21 days." />
                    </div>
                    <div className="font-medium">
                      {setup.expiration} ({setup.dte}d)
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center">
                      Max Loss
                      <InfoTooltip content="Maximum possible loss = (strike width - credit received) × 100. This is your defined risk." />
                    </div>
                    <div className="font-medium text-red-600">${setup.maxLoss.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center">
                      IV Rank
                      <InfoTooltip content="Implied Volatility Rank shows current IV relative to the past year. High IV Rank (>50%) means options are expensive - good for selling premium." />
                    </div>
                    <div className="font-medium">{setup.ivRank}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center">
                      Delta
                      <InfoTooltip content="Delta of the short strike. Lower delta (0.15-0.30) means higher probability of profit but smaller credit." />
                    </div>
                    <div className="font-medium">{setup.delta.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center">
                      Risk/Reward
                      <InfoTooltip content="Ratio of max loss to max profit. Lower ratios (under 3:1) are more favorable for the trader." />
                    </div>
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
