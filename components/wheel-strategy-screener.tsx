"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import {
  RotateCcw,
  Zap,
  Filter,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Percent,
  Wifi,
  WifiOff,
} from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { TooltipProvider } from "@/components/ui/tooltip"

interface WheelCandidate {
  ticker: string
  company: string
  price: number
  putStrike: number
  putPremium: number
  putDte: number
  annualizedReturn: number
  ivRank: number
  divYield: number
  cashRequired: number
  signal: "strong" | "moderate" | "speculative"
  fundamentals: string
  reason: string
  dataSource?: string
  isLive?: boolean
}

export function WheelStrategyScreener() {
  const [minReturn, setMinReturn] = useState([15])
  const [maxCash, setMaxCash] = useState([50000])
  const [fundamentalGrade, setFundamentalGrade] = useState<"all" | "a" | "b">("all")
  const [isLoading, setIsLoading] = useState(false)
  const [candidates, setCandidates] = useState<WheelCandidate[]>([])
  const [isLiveData, setIsLiveData] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  useEffect(() => {
    const cached = localStorage.getItem("wheel-strategy-screener-cache")
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

  const filteredCandidates = candidates.filter((c) => {
    if (c.annualizedReturn < minReturn[0]) return false
    if (c.cashRequired > maxCash[0]) return false
    if (fundamentalGrade === "a" && !c.fundamentals.startsWith("A")) return false
    if (fundamentalGrade === "b" && c.fundamentals.startsWith("C")) return false
    return true
  })

  const handleRefresh = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/strategy-scanner?type=wheel")

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const data = await response.json()

      if (data.wheelCandidates && data.wheelCandidates.length > 0) {
        setCandidates(data.wheelCandidates)
        setIsLiveData(data.isLive === true)
        setLastUpdated(new Date().toISOString())

        localStorage.setItem(
          "wheel-strategy-screener-cache",
          JSON.stringify({
            data: data.wheelCandidates,
            timestamp: new Date().toISOString(),
            isLive: data.isLive === true,
          }),
        )
      } else {
        setError("No wheel strategy candidates found")
      }
    } catch (err) {
      console.error("[Wheel Strategy Screener] Fetch error:", err)
      setError("Failed to fetch live data")
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

  const getFundamentalBadge = (grade: string) => {
    if (grade.startsWith("A")) return <Badge className="bg-green-600 text-white">{grade}</Badge>
    if (grade.startsWith("B")) return <Badge className="bg-yellow-600 text-white">{grade}</Badge>
    return <Badge className="bg-red-600 text-white">{grade}</Badge>
  }

  return (
    <TooltipProvider disabled={!tooltipsEnabled}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-indigo-500" />
                Wheel Strategy Screener
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
                Cash-secured put candidates for the wheel strategy
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
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Min Return:</span>
              <Slider value={minReturn} onValueChange={setMinReturn} min={5} max={50} step={5} className="w-24" />
              <span className="text-sm font-medium w-8">{minReturn[0]}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Max Cash:</span>
              <Slider value={maxCash} onValueChange={setMaxCash} min={5000} max={100000} step={5000} className="w-24" />
              <span className="text-sm font-medium w-16">${(maxCash[0] / 1000).toFixed(0)}k</span>
            </div>
            <Select value={fundamentalGrade} onValueChange={(v: "all" | "a" | "b") => setFundamentalGrade(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Fundamentals" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                <SelectItem value="a">A Grade Only</SelectItem>
                <SelectItem value="b">B+ and Above</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {candidates.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <RotateCcw className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No wheel strategy data loaded.</p>
              <p className="text-sm">Click Refresh to scan for wheel candidates.</p>
            </div>
          )}

          <Accordion type="single" collapsible className="space-y-2">
            {filteredCandidates.map((candidate, idx) => (
              <AccordionItem key={`${candidate.ticker}-${idx}`} value={`${candidate.ticker}-${idx}`}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-100">
                        <RotateCcw className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">{candidate.ticker}</div>
                        <div className="text-xs text-muted-foreground">${candidate.price.toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getSignalBadge(candidate.signal)}
                      {getFundamentalBadge(candidate.fundamentals)}
                      <div className="text-right">
                        <div className="font-semibold text-green-600">
                          <Percent className="w-3 h-3 inline mr-1" />
                          {candidate.annualizedReturn.toFixed(1)}% ann.
                        </div>
                        <div className="text-xs text-muted-foreground">${candidate.putPremium.toFixed(2)} prem</div>
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
                      <div className="text-xs text-muted-foreground">Put Strike</div>
                      <div className="font-medium">${candidate.putStrike}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">DTE</div>
                      <div className="font-medium">{candidate.putDte} days</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Cash Required</div>
                      <div className="font-medium">${candidate.cashRequired.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">IV Rank</div>
                      <div className="font-medium">{candidate.ivRank}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Div Yield</div>
                      <div className="font-medium">{candidate.divYield.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Data Source</div>
                      <div className="font-medium text-xs">{candidate.dataSource || "API"}</div>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-indigo-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-indigo-500 mt-0.5" />
                      <div className="text-sm text-indigo-800">{candidate.reason}</div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {candidates.length > 0 && (
            <div className="mt-4 pt-4 border-t text-xs text-muted-foreground flex items-center justify-between">
              <span>Data: Polygon.io (prices/options) + Finnhub (fundamentals)</span>
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
