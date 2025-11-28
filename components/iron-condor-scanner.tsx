"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import {
  RefreshCw,
  Layers,
  Zap,
  Filter,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { TooltipProvider } from "@/components/ui/tooltip"

interface CondorSetup {
  ticker: string
  company: string
  putSpread: { short: number; long: number }
  callSpread: { short: number; long: number }
  expiration: string
  dte: number
  totalCredit: number
  maxLoss: number
  probability: number
  ivRank: number
  expectedRange: { low: number; high: number }
  width: number
  signal: "strong" | "moderate" | "speculative"
  reason: string
  dataSource?: string
  isLive?: boolean
}

export function IronCondorScanner() {
  const [minProbability, setMinProbability] = useState([65])
  const [maxDte, setMaxDte] = useState([45])
  const [minIvRank, setMinIvRank] = useState([25])
  const [isLoading, setIsLoading] = useState(false)
  const [setups, setSetups] = useState<CondorSetup[]>([])
  const [isLiveData, setIsLiveData] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cached = localStorage.getItem("iron-condor-scanner-cache")
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
    if (s.probability < minProbability[0]) return false
    if (s.dte > maxDte[0]) return false
    if (s.ivRank < minIvRank[0]) return false
    return true
  })

  const handleRefresh = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/strategy-scanner?type=iron-condors")

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const data = await response.json()

      if (data.ironCondors && data.ironCondors.length > 0) {
        setSetups(data.ironCondors)
        setIsLiveData(data.isLive === true)
        setLastUpdated(new Date().toISOString())

        localStorage.setItem(
          "iron-condor-scanner-cache",
          JSON.stringify({
            data: data.ironCondors,
            timestamp: new Date().toISOString(),
            isLive: data.isLive === true,
          }),
        )
      } else {
        setError("No iron condor setups found")
      }
    } catch (err) {
      console.error("[Iron Condor Scanner] Fetch error:", err)
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

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-500" />
                Iron Condor Scanner
                {isLiveData ? (
                  <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-300">
                    <Wifi className="w-3 h-3 mr-1" />
                    LIVE
                  </Badge>
                ) : setups.length > 0 ? (
                  <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-300">
                    <WifiOff className="w-3 h-3 mr-1" />
                    Cached
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>
                Range-bound income strategies with defined risk
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
              <span className="text-sm text-slate-600">Min Prob:</span>
              <Slider
                value={minProbability}
                onValueChange={setMinProbability}
                min={50}
                max={85}
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
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Min IV Rank:</span>
              <Slider value={minIvRank} onValueChange={setMinIvRank} min={0} max={70} step={5} className="w-24" />
              <span className="text-sm font-medium w-8">{minIvRank[0]}%</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {setups.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No iron condor data loaded.</p>
              <p className="text-sm">Click Refresh to scan for opportunities.</p>
            </div>
          )}

          <Accordion type="single" collapsible className="space-y-2">
            {filteredSetups.map((setup, idx) => (
              <AccordionItem key={`${setup.ticker}-${idx}`} value={`${setup.ticker}-${idx}`}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-100">
                        <Layers className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">{setup.ticker}</div>
                        <div className="text-xs text-muted-foreground">{setup.company}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getSignalBadge(setup.signal)}
                      <div className="text-right">
                        <div className="font-semibold text-green-600">${setup.totalCredit.toFixed(2)} credit</div>
                        <div className="text-xs text-muted-foreground">{setup.probability}% prob</div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                    <div>
                      <div className="text-xs text-muted-foreground">Put Spread</div>
                      <div className="font-medium">
                        ${setup.putSpread.short} / ${setup.putSpread.long}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Call Spread</div>
                      <div className="font-medium">
                        ${setup.callSpread.short} / ${setup.callSpread.long}
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
                      <div className="text-xs text-muted-foreground">Expected Range</div>
                      <div className="font-medium">
                        ${setup.expectedRange.low} - ${setup.expectedRange.high}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Width</div>
                      <div className="font-medium">${setup.width}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Data Source</div>
                      <div className="font-medium text-xs">{setup.dataSource || "API"}</div>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-purple-500 mt-0.5" />
                      <div className="text-sm text-purple-800">{setup.reason}</div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

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
