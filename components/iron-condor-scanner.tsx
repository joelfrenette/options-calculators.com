"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { Layers, Zap, Filter, ArrowUpRight, AlertTriangle, CheckCircle2, Info, Wifi, WifiOff } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

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
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

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
                <Layers className="w-5 h-5 text-amber-500" />
                Iron Condor Scanner
                <InfoTooltip content="This scanner finds stocks ideal for iron condor trades - a strategy that profits when the stock stays within a price range. You collect premium from both sides and keep it if the stock doesn't move too much." />
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
            <div className="flex items-center gap-2">
              <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
              <RefreshButton onClick={handleRefresh} isLoading={isLoading} loadingText="Scanning..." />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
            <p className="text-sm text-amber-800">
              <Info className="h-4 w-4 inline mr-1" />
              <strong>Iron Condors</strong> profit when the stock price stays within a range between expiration. You
              sell both a <strong>bull put spread</strong> (below current price) and a <strong>bear call spread</strong>{" "}
              (above current price), collecting premium from both sides. Best for{" "}
              <strong>high IV, range-bound stocks</strong> where you expect minimal movement. Maximum profit occurs if
              the stock stays between your short strikes at expiration.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium">Filters:</span>
              <InfoTooltip content="Adjust these filters to find iron condors matching your risk preference. Higher probability = safer but less reward. Higher IV Rank = more premium collected but potentially more volatile underlying." />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Min Prob:</span>
              <InfoTooltip content="Minimum Probability of Profit (POP). This is your estimated chance of making money on this trade. 70% POP means historically, 7 out of 10 similar trades would have been profitable. Higher POP (65-80%) = safer trades but smaller premiums. Lower POP = more premium but higher risk of loss." />
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
              <InfoTooltip content="Maximum Days to Expiration. Shorter timeframes (21-30 days) mean faster time decay in your favor - you profit as time passes. But shorter DTE also means less room for error if the stock moves against you. Longer DTE (45+ days) gives more time for the trade to work but ties up your capital longer. Most traders prefer 30-45 DTE for iron condors." />
              <Slider value={maxDte} onValueChange={setMaxDte} min={7} max={60} step={7} className="w-24" />
              <span className="text-sm font-medium w-8">{maxDte[0]}d</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Min IV Rank:</span>
              <InfoTooltip content="Minimum IV Rank shows how expensive options are RIGHT NOW compared to the past year. 0% = options are at their cheapest. 100% = options are at their most expensive. For iron condors, you WANT high IV Rank (40%+) because you're SELLING options - when options are expensive, you collect more premium. This is why experienced traders say 'sell when IV is high.'" />
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
                      <div className="text-xs text-muted-foreground flex items-center">
                        Put Spread
                        <InfoTooltip content="This is the LOWER side of your iron condor (bull put spread). You SELL the higher strike put and BUY the lower strike put for protection. Example: Sell $540 put, Buy $535 put. You profit on this side if the stock stays ABOVE $540. The long put at $535 limits your loss if the stock crashes." />
                      </div>
                      <div className="font-medium">
                        ${setup.putSpread.short} / ${setup.putSpread.long}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center">
                        Call Spread
                        <InfoTooltip content="This is the UPPER side of your iron condor (bear call spread). You SELL the lower strike call and BUY the higher strike call for protection. Example: Sell $560 call, Buy $565 call. You profit on this side if the stock stays BELOW $560. The long call at $565 limits your loss if the stock rockets up." />
                      </div>
                      <div className="font-medium">
                        ${setup.callSpread.short} / ${setup.callSpread.long}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center">
                        Expiration
                        <InfoTooltip content="The date when these options expire. Your goal is for the stock to stay between your short strikes ($540-$560 in our example) until this date. As expiration approaches, time decay (theta) accelerates in your favor - the options you sold lose value faster, which is exactly what you want." />
                      </div>
                      <div className="font-medium">
                        {setup.expiration} ({setup.dte}d)
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center">
                        Max Loss
                        <InfoTooltip content="The absolute WORST case - the most money you can lose on this trade. This happens if the stock moves completely outside your wings at expiration. Calculated as: (Width of spread - Credit received) × 100. For a $5 wide spread with $1.50 credit, max loss is ($5 - $1.50) × 100 = $350 per contract. You know this number BEFORE you enter - that's 'defined risk'." />
                      </div>
                      <div className="font-medium text-red-600">${setup.maxLoss.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center">
                        IV Rank
                        <InfoTooltip content="IV Rank tells you if options are cheap or expensive compared to the past year. 50% means current IV is halfway between the yearly low and high. For iron condors, higher is better because you're a seller. When IV Rank is high (50%+), you get paid more premium. When IV eventually drops (IV crush), your sold options lose value and you profit." />
                      </div>
                      <div className="font-medium">{setup.ivRank}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center">
                        Expected Range
                        <InfoTooltip content="This is the price range the options market expects the stock to stay within by expiration. It's calculated from current implied volatility. Your short strikes should ideally be OUTSIDE this range - that's how you achieve high probability of profit. If the expected range is $535-$565 and your shorts are at $530 and $570, you have a good buffer." />
                      </div>
                      <div className="font-medium">
                        ${setup.expectedRange.low} - ${setup.expectedRange.high}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center">
                        Width
                        <InfoTooltip content="The distance between your short and long strikes on each side (in dollars). $5 wide means your protection is $5 away from what you sold. Wider spreads collect more premium but have higher max loss. Narrower spreads have less max loss but collect less premium. Most traders use $5 or $10 wide spreads on stocks trading $50-$500." />
                      </div>
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
