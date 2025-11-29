"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Filter, AlertTriangle, Info, Wifi, WifiOff, TrendingUp, Activity, Target, DollarSign } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"

interface ButterflySetup {
  ticker: string
  company: string
  type: "call" | "put"
  structure: "standard" | "broken-wing"
  lowerStrike: number
  middleStrike: number
  upperStrike: number
  currentPrice: number
  expiration: string
  dte: number
  cost: number // Debit for standard, credit for BWB
  maxProfit: number
  maxLoss: number
  breakeven: { low: number; high: number }
  // Butterfly specific KPIs
  ivRank: number
  ivPercentile: number
  wingWidth: { lower: number; upper: number }
  probabilityOfProfit: number
  riskRewardRatio: number
  distanceToProfit: number // % from current price to profit zone
  signal: "strong" | "moderate" | "speculative"
  reason: string
  dataSource?: string
  isLive?: boolean
}

// Tickers good for butterflies - high IV rank, range-bound
const BUTTERFLY_TICKERS = [
  "SPY",
  "QQQ",
  "IWM",
  "DIA", // ETFs - great for butterflies
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "META", // Large caps
  "NVDA",
  "AMD",
  "TSLA", // High IV stocks
  "JPM",
  "BAC",
  "GS", // Financials
  "XOM",
  "CVX", // Energy
]

export function ButterflyScanner() {
  const [setups, setSetups] = useState<ButterflySetup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [butterflyType, setButterflyType] = useState<"all" | "standard" | "broken-wing">("all")
  const [optionType, setOptionType] = useState<"all" | "call" | "put">("all")
  const [minIVRank, setMinIVRank] = useState(30)
  const [maxDTE, setMaxDTE] = useState(45)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [isLiveData, setIsLiveData] = useState(false)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  useEffect(() => {
    const cached = localStorage.getItem("butterfly-scanner-cache")
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
    if (butterflyType !== "all" && s.structure !== butterflyType) return false
    if (optionType !== "all" && s.type !== optionType) return false
    if (s.ivRank < minIVRank) return false
    if (s.dte > maxDTE) return false
    return true
  })

  const standardSetups = filteredSetups.filter((s) => s.structure === "standard")
  const brokenWingSetups = filteredSetups.filter((s) => s.structure === "broken-wing")

  const handleRefresh = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/strategy-scanner?type=butterflies")

      if (!response.ok) {
        const text = await response.text()
        console.error("[Butterfly Scanner] Server error:", response.status, text)
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()

      if (data.butterflies && data.butterflies.length > 0) {
        setSetups(data.butterflies)
        setIsLiveData(data.isLive || false)
        const timestamp = new Date().toLocaleString()
        setLastUpdated(timestamp)

        localStorage.setItem(
          "butterfly-scanner-cache",
          JSON.stringify({ data: data.butterflies, timestamp, isLive: data.isLive }),
        )
      } else {
        setError("No butterfly setups found. Try adjusting filters.")
      }
    } catch (err) {
      console.error("[Butterfly Scanner] Fetch error:", err)
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

  const renderSetupCard = (setup: ButterflySetup) => (
    <Card key={`${setup.ticker}-${setup.structure}-${setup.type}`} className="border-l-4 border-l-purple-500">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">{setup.ticker}</span>
              <Badge variant="outline" className={setup.type === "call" ? "text-green-600" : "text-red-600"}>
                {setup.type.toUpperCase()}
              </Badge>
              <Badge
                variant="outline"
                className={setup.structure === "broken-wing" ? "text-purple-600" : "text-blue-600"}
              >
                {setup.structure === "broken-wing" ? "BWB" : "Standard"}
              </Badge>
              {getSignalBadge(setup.signal)}
            </div>
            <p className="text-sm text-gray-500">{setup.company}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Current</p>
            <p className="font-semibold">${setup.currentPrice.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="text-center">
              <p className="text-gray-500">Lower</p>
              <p className="font-mono font-semibold">${setup.lowerStrike}</p>
            </div>
            <div className="text-gray-300">→</div>
            <div className="text-center">
              <p className="text-gray-500">Middle (2x)</p>
              <p className="font-mono font-semibold text-purple-600">${setup.middleStrike}</p>
            </div>
            <div className="text-gray-300">→</div>
            <div className="text-center">
              <p className="text-gray-500">Upper</p>
              <p className="font-mono font-semibold">${setup.upperStrike}</p>
            </div>
          </div>
          <div className="mt-2 text-center text-xs text-gray-500">
            Wing Width: ${setup.wingWidth.lower} / ${setup.wingWidth.upper}
            {setup.structure === "broken-wing" && " (Uneven)"}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 text-sm mb-3">
          <div>
            <p className="text-gray-500 flex items-center">
              {setup.structure === "standard" ? "Debit" : "Credit"}
              <InfoTooltip
                content={setup.structure === "standard" ? "Cost to enter the trade" : "Credit received (BWB)"}
              />
            </p>
            <p className={`font-semibold ${setup.structure === "broken-wing" ? "text-green-600" : ""}`}>
              ${Math.abs(setup.cost).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-gray-500 flex items-center">
              Max Profit
              <InfoTooltip content="Maximum profit if price is at middle strike at expiration" />
            </p>
            <p className="font-semibold text-green-600">${setup.maxProfit.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-500 flex items-center">
              Max Loss
              <InfoTooltip content="Maximum loss for this position" />
            </p>
            <p className="font-semibold text-red-600">${setup.maxLoss.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-500 flex items-center">
              R:R Ratio
              <InfoTooltip content="Risk-to-reward ratio (lower is better)" />
            </p>
            <p className="font-semibold">{setup.riskRewardRatio.toFixed(1)}:1</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 text-sm mb-3">
          <div>
            <p className="text-gray-500 flex items-center">
              IV Rank
              <InfoTooltip content="Current IV compared to past year (higher = more expensive options)" />
            </p>
            <p className={`font-semibold ${setup.ivRank >= 50 ? "text-green-600" : "text-gray-600"}`}>
              {setup.ivRank}%
            </p>
          </div>
          <div>
            <p className="text-gray-500 flex items-center">
              POP
              <InfoTooltip content="Probability of profit at expiration" />
            </p>
            <p className="font-semibold">{setup.probabilityOfProfit}%</p>
          </div>
          <div>
            <p className="text-gray-500 flex items-center">
              DTE
              <InfoTooltip content="Days to expiration" />
            </p>
            <p className="font-semibold">{setup.dte}d</p>
          </div>
          <div>
            <p className="text-gray-500 flex items-center">
              Distance
              <InfoTooltip content="How far current price is from the profit zone" />
            </p>
            <p className="font-semibold">{setup.distanceToProfit.toFixed(1)}%</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
          <span>
            Breakeven: ${setup.breakeven.low.toFixed(2)} - ${setup.breakeven.high.toFixed(2)}
          </span>
          <span>Exp: {setup.expiration}</span>
        </div>

        <div className="mt-2 text-xs text-gray-600 bg-blue-50 p-2 rounded">
          <strong>Setup Rationale:</strong> {setup.reason}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              <CardTitle>Butterfly & Broken Wing Butterfly Scanner</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
              <RefreshButton onClick={handleRefresh} isLoading={isLoading} loadingText="Scanning..." />
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mt-2">
            <p className="text-sm text-purple-800">
              <Info className="h-4 w-4 inline mr-1" />
              <strong>Butterflies</strong> profit when the underlying stays near the middle strike at expiration. Best
              for <strong>range-bound stocks with elevated IV</strong>. <strong>Broken Wing Butterflies (BWB)</strong>{" "}
              shift risk to one side, often for a credit, with directional bias.
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

            <Select value={butterflyType} onValueChange={(v: any) => setButterflyType(v)}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Structure" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="broken-wing">Broken Wing</SelectItem>
              </SelectContent>
            </Select>

            <Select value={optionType} onValueChange={(v: any) => setOptionType(v)}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="Option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Call & Put</SelectItem>
                <SelectItem value="call">Calls Only</SelectItem>
                <SelectItem value="put">Puts Only</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Min IV Rank:</span>
              <Slider
                value={[minIVRank]}
                onValueChange={([v]) => setMinIVRank(v)}
                min={0}
                max={100}
                step={5}
                className="w-24"
              />
              <span className="text-sm font-medium w-12">{minIVRank}%</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Max DTE:</span>
              <Slider
                value={[maxDTE]}
                onValueChange={([v]) => setMaxDTE(v)}
                min={14}
                max={90}
                step={7}
                className="w-24"
              />
              <span className="text-sm font-medium w-12">{maxDTE}d</span>
            </div>
          </div>

          {/* KPI Legend */}
          <div className="grid grid-cols-4 gap-4 mb-4 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-purple-500" />
              IV Rank: Implied volatility ranking
            </div>
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3 text-blue-500" />
              POP: Probability of profit
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-green-500" />
              R:R: Risk to reward ratio
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-orange-500" />
              Distance: % to profit zone
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
              <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No butterfly setups loaded.</p>
              <p className="text-sm">Click Refresh to scan for butterfly opportunities.</p>
            </div>
          )}

          {filteredSetups.length > 0 && (
            <Accordion type="multiple" defaultValue={["standard", "broken-wing"]} className="space-y-4">
              {/* Standard Butterflies */}
              {standardSetups.length > 0 && (
                <AccordionItem value="standard" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold">Standard Butterflies</span>
                      <Badge variant="secondary">{standardSetups.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <p className="text-sm text-gray-600 mb-3">
                      Equal wing widths. Pay a debit upfront, profit if price stays at middle strike.
                    </p>
                    <div className="grid gap-4">{standardSetups.map(renderSetupCard)}</div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Broken Wing Butterflies */}
              {brokenWingSetups.length > 0 && (
                <AccordionItem value="broken-wing" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-purple-600" />
                      <span className="font-semibold">Broken Wing Butterflies (BWB)</span>
                      <Badge variant="secondary">{brokenWingSetups.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <p className="text-sm text-gray-600 mb-3">
                      Uneven wing widths. Often entered for a credit with directional bias. Risk shifted to one side.
                    </p>
                    <div className="grid gap-4">{brokenWingSetups.map(renderSetupCard)}</div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
