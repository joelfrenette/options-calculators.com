"use client"

import { useState, useEffect } from "react"
import { Metric, PricingProvenance } from "@/components/pricing-provenance"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { DollarAmountFilter } from "@/components/dollar-amount-filter"
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
  returnOnCapital?: number
  qualityScore?: number
  breakeven: { low: number; high: number }
  beta: number
  atmIV: number
  // historicalVolatility, ivSkew and priceStability were all functions of beta
  // dressed up as independent measurements; the scanner has no second-expiry IV
  // and no realised-vol series, so all three are withheld (AUDIT_BACKLOG P1-6).
  historicalVolatility: number | null
  ivSkew: number | null
  priceStability: number | null
  marketCap: string | null
  /** Days until the next earnings report (Finnhub). Null when unknown — never "safe". */
  daysNoEarnings: number | null
  earningsDate: string | null
  thetaAdvantage: number
  signal: "strong" | "moderate" | "speculative" | null
  reason: string
  pricingModel?: string
  quoteType?: string
}

export function CalendarSpreadScanner() {
  const [spreads, setSpreads] = useState<CalendarSpreadSetup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [spreadType, setSpreadType] = useState<"all" | "call" | "put">("all")
  const [maxBeta, setMaxBeta] = useState(1.0)
  const [maxDebit, setMaxDebit] = useState(1000) // Step 1 dollar filter: max net debit per spread ($)
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
        // Invalid cache
      }
    }
  }, [])

  // Risk-adjusted rank: reward profitability (return on capital) and penalize risk
  // (low price stability). Prefer the API quality score when it is available.
  // Prefer the API's composite quality score, which now blends only measured or
  // modelled inputs. The old local fallback multiplied return on capital by
  // priceStability — a value derived from beta — so it double-counted beta.
  const rankScore = (s: CalendarSpreadSetup) => {
    if (s.qualityScore != null) return s.qualityScore
    return s.returnOnCapital ?? (s.debit > 0 ? (s.maxProfit / s.debit) * 100 : 0)
  }

  const filteredSetups = spreads
    .filter((s) => {
      if (maxDebit < 5000 && s.debit * 100 > maxDebit) return false
      if (spreadType !== "all" && s.type !== spreadType) return false
      if (s.beta > maxBeta) return false
      // historicalVolatility and priceStability are hardcoded null in the route —
      // both were restatements of beta presented as independent measurements. The
      // two sliders that used to drive these lines went with them; beta above is
      // the real filter, and it is what they were paraphrasing.
      return true
    })
    .sort((a, b) => rankScore(b) - rankScore(a))

  const handleRefresh = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/strategy-scanner?type=calendar-spreads")

      if (!response.ok) {
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

  const getSignalBadge = (signal: string | null) => {
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
      case "speculative":
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-300">
            <Clock className="w-3 h-3 mr-1" />
            Speculative
          </Badge>
        )
      default:
        return null
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
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-500" />
                Calendar Spread Scanner
                <InfoTooltip content="Finds stocks ideal for calendar spreads - a strategy where you sell a near-term option and buy a longer-term option at the same strike. You profit from the faster time decay of the front-month option while the back-month holds value." />
                
              </CardTitle>
              <CardDescription>
                Time decay strategies on stable, low-volatility stocks
                <PricingProvenance className="mt-2" lastUpdated={lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : null} />
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
                longer-term options at the same strike. You profit from the faster time decay of the front-month option
                while the back-month holds value. Best on <strong>stable, low-volatility stocks</strong> with minimal
                price movement expected. Ideal when front-month IV is elevated relative to back-month.
              </div>
            </div>
          </div>

          {/* Dollar Amount Filtering (Step 1) */}
          <div className="mb-6">
            <DollarAmountFilter
              value={maxDebit}
              onChange={setMaxDebit}
              tooltipsEnabled={tooltipsEnabled}
              mode="net-debit"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-nowrap items-center gap-4 mb-6 p-4 bg-slate-50 rounded-lg overflow-x-auto">
            <div className="flex items-center gap-2 shrink-0">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium">Filters:</span>
              <InfoTooltip content="Use these filters to narrow down calendar spread opportunities based on your risk tolerance and market view. Stricter filters (lower beta, lower HV, higher stability) show more conservative trades." />
            </div>
            <Select value={spreadType} onValueChange={(v: "all" | "call" | "put") => setSpreadType(v)}>
              <SelectTrigger className="w-[130px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="call">Call Calendar</SelectItem>
                <SelectItem value="put">Put Calendar</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm text-slate-600 whitespace-nowrap">Max Beta:</span>
              <InfoTooltip content="Beta measures how much a stock moves compared to the overall market. A beta of 1.0 means it moves exactly with the market. For calendar spreads, you want LOW beta stocks (under 0.8) because you need the stock to stay near your strike price. High beta stocks move too much and can blow through your breakeven points." />
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
            {/* The "Max HV" and "Min Stability" sliders are gone.
                `historicalVolatility` and `priceStability` are hardcoded null in
                /api/strategy-scanner — an earlier pass removed them once it found
                both were restatements of beta dressed up as independent
                measurements (HV was derived from beta; stability was
                `100 - beta*20 - HV*0.5`). The filters correctly stopped excluding
                rows on data that no longer exists, which left two sliders the user
                could drag from 50 to 95 with no effect whatsoever, above a tooltip
                telling them to "Look for 75% or higher" on a column that renders
                "not measured" on every row. Same defect as the handler-less
                Refresh buttons (P6-38): a control that takes input and does
                nothing. Beta is still filterable above, and it is the real
                measurement these two were paraphrasing. */}
          </div>

          {/* Key Metrics Legend */}
          <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Activity className="w-3 h-3" />
              <span>Beta: Market correlation</span>
              <InfoTooltip content="How the stock moves relative to the S&P 500. Beta of 0.5 means if the market drops 10%, this stock only drops about 5%. Lower beta = more stable = better for calendars." />
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              <span>HV: Historical volatility</span>
              <InfoTooltip content="The actual price swings the stock made recently. A 20% HV means the stock typically moves about 20% per year. Lower HV = calmer stock = better for this strategy." />
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Shield className="w-3 h-3" />
              <span>Stability: Price range consistency</span>
              <InfoTooltip content="How often the stock stays in a trading range. 85% means the stock was range-bound 85% of the last month. Higher = more predictable = higher chance your calendar spread profits." />
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>IV Skew: Front vs back IV</span>
              <InfoTooltip content="The difference in implied volatility between the option you're selling (front month) and buying (back month). POSITIVE skew is good - it means you're selling expensive options and buying cheaper ones, giving you an edge." />
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
                          <a
                            href={`https://finance.yahoo.com/quote/${setup.ticker}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-600 hover:text-teal-700 hover:underline"
                          >
                            {setup.ticker}
                          </a>
                          {getBetaBadge(setup.beta)}
                        </div>
                        <div className="text-xs text-muted-foreground">{setup.company}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getSignalBadge(setup.signal)}
                      <div className="text-right">
                        <div className="font-semibold text-indigo-600">${setup.debit.toFixed(2)} debit</div>
                        <div className="text-xs text-muted-foreground">
                          Max: ${setup.maxProfit.toFixed(2)}
                          {typeof setup.returnOnCapital === "number" && (
                            <span className="ml-1 font-medium text-green-600">({setup.returnOnCapital}% ROC)</span>
                          )}
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center">
                        Strategy
                        <InfoTooltip content="Call calendars are slightly bullish, put calendars are slightly bearish. Both profit most when the stock sits at the strike price at front-month expiration." />
                      </div>
                      <div className="font-medium capitalize">{setup.type} Calendar</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center">
                        Strike
                        <InfoTooltip content="The strike price for both options. Ideally close to current stock price (ATM). Max profit occurs if stock is exactly at this price when the front month expires." />
                      </div>
                      <div className="font-medium">${setup.strike}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center">
                        Current Price
                        <InfoTooltip content="Where the stock is trading now. Compare to the strike - closer is better for maximum profit potential." />
                      </div>
                      <div className="font-medium">${setup.currentPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center">
                        Near Exp (Sell)
                        <InfoTooltip content="The front-month option you SELL. This is the one that decays faster. You keep the premium if it expires worthless near the strike." />
                      </div>
                      <div className="font-medium">
                        {setup.nearExpiration} ({setup.nearDte}d)
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center">
                        Far Exp (Buy)
                        <InfoTooltip content="The back-month option you BUY. This retains more value since it has more time left. You can sell it after the front month expires or continue selling more front-month options against it." />
                      </div>
                      <div className="font-medium">
                        {setup.farExpiration} ({setup.farDte}d)
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center">
                        Breakeven Range
                        <InfoTooltip content="The stock price range where you make money. Wider is better - gives more room for the stock to move and still profit." />
                      </div>
                      <div className="font-medium">
                        ${setup.breakeven.low.toFixed(0)} - ${setup.breakeven.high.toFixed(0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center">
                        Beta
                        <InfoTooltip content="Stock's correlation to market moves. Lower beta = more stable = better for calendars." />
                      </div>
                      <div className="font-medium">{setup.beta.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center">
                        Historical Vol
                        <InfoTooltip content="How much the stock has actually moved recently. Lower HV stocks are more predictable and better for calendar spreads." />
                      </div>
                      <div className="font-medium">
                        <Metric value={setup.historicalVolatility} digits={1} suffix="%" unavailableLabel="not measured" />
                      </div>
                    </div>
                  </div>

                  {/* Calendar-specific KPIs with tooltips */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 mt-2 bg-indigo-50 rounded-lg">
                    <div>
                      <div className="text-xs text-indigo-600 font-medium flex items-center">
                        IV Skew
                        <InfoTooltip content="The difference between front-month IV and back-month IV. Positive is favorable — you would be selling richer options than you buy. Not currently measured: the scanner reads one at-the-money IV, so a front-vs-back comparison needs a second expiry it does not yet fetch." />
                      </div>
                      <div
                        className={`font-medium ${
                          setup.ivSkew === null ? "" : setup.ivSkew > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {setup.ivSkew !== null && setup.ivSkew > 0 ? "+" : ""}
                        <Metric value={setup.ivSkew} digits={1} suffix="%" unavailableLabel="needs a second expiry" />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {setup.ivSkew === null ? "not measured" : setup.ivSkew > 0 ? "Favorable" : "Unfavorable"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-indigo-600 font-medium flex items-center">
                        Price Stability
                        <InfoTooltip content="How tightly the stock has held a range. Not currently measured — the previous figure was computed from beta alone, so it restated beta rather than observing the price series. Beta is shown above." />
                      </div>
                      <div className="font-medium">
                        <Metric value={setup.priceStability} digits={0} suffix="%" unavailableLabel="not measured" />
                      </div>
                      <div className="text-xs text-muted-foreground">not measured</div>
                    </div>
                    <div>
                      <div className="text-xs text-indigo-600 font-medium flex items-center">
                        Days to Earnings
                        <InfoTooltip content="Days until the company reports earnings, from Finnhub's calendar. Avoid holding a calendar through earnings — the move can destroy the position. The verdict below compares this against the short leg's expiry." />
                      </div>
                      <div className="font-medium">
                        {setup.daysNoEarnings === null ? (
                          <span className="text-gray-400" title="earnings date unavailable">
                            —
                          </span>
                        ) : (
                          `${setup.daysNoEarnings > 90 ? "90+" : setup.daysNoEarnings}d`
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {setup.daysNoEarnings === null
                          ? "date unavailable"
                          : setup.daysNoEarnings > setup.nearDte
                            ? "clear of short leg"
                            : "inside short leg"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-indigo-600 font-medium flex items-center">
                        Theta Advantage
                        <InfoTooltip content="How much faster the front-month decays compared to the back-month. 2.0x means the short option decays twice as fast - your edge from time decay. Higher is better." />
                      </div>
                      <div className="font-medium">{setup.thetaAdvantage.toFixed(1)}x</div>
                      <div className="text-xs text-muted-foreground">Near/Far decay ratio</div>
                    </div>
                  </div>

                  {/* Capital mechanics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                      <div className="text-xs text-emerald-700 font-medium flex items-center">
                        Capital Tied Up
                        <InfoTooltip content="The net debit you pay to open this calendar, per contract. This is the actual capital that leaves your account and your maximum loss. Calculated as net debit × 100." />
                      </div>
                      <div className="font-bold text-emerald-800">${(setup.debit * 100).toLocaleString()}</div>
                      <div className="text-[11px] text-emerald-600">net debit × 100 · = max loss</div>
                    </div>
                    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                      <div className="text-xs text-amber-700 font-medium flex items-center">
                        Early-Assignment Reserve
                        <InfoTooltip content="Risk reserve only — NOT required to open. If the short (near-term) leg is assigned early, you may briefly need this much cash to settle 100 shares before unwinding with your long leg. Calculated as strike × 100." />
                      </div>
                      <div className="font-bold text-amber-800">${(setup.strike * 100).toLocaleString()}</div>
                      <div className="text-[11px] text-amber-600">strike × 100 · worst-case buffer</div>
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
