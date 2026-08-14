"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { DataLoadGate } from "@/components/data-load-gate"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  Loader2,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  PieChart,
  Target,
  ShoppingCart,
  BarChart3,
  Info,
} from "lucide-react"
// `Tooltip` is already bound to the shadcn/Radix tooltip on line 13, so the
// chart tooltip is imported under an alias. It was NOT imported at all before:
// the <Tooltip> inside the LineChart resolved to the Radix component, which
// renders nothing there, so the VIX chart had no hover readout. The only
// symptom was a TypeScript error that had been absorbed into the "8 known
// errors" baseline and treated as noise.
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
} from "recharts"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"


// P6-13. This file was 858 lines. The VIX bands and the allocation each implies
// are now in `components/risk/vix-allocation.ts`, unchanged.
import { VIX_LEVELS, type VixLevel, getVixLevel, getVixPortfolioAllocation } from "@/components/risk/vix-allocation"
import { computeFreeCashPosition, describeStanding } from "@/components/risk/free-cash"
import { AllocationByVixSection } from "@/components/risk/allocation-by-vix-section"
import { OptionsHedgingSection } from "@/components/risk/options-hedging-section"

export function RiskCalculator() {
  const [portfolioSize, setPortfolioSize] = useState<string>("")
  // P7-79. Optional: entering both turns the target into a position.
  const [cashOnHand, setCashOnHand] = useState<string>("")
  const [committedCollateral, setCommittedCollateral] = useState<string>("")
  const [vixValue, setVixValue] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vixHistory, setVixHistory] = useState<Array<{ date: string; value: number }>>([])
  const [chartLoading, setChartLoading] = useState(true)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!loaded) return
    fetchVixData()
    fetchVixHistory()
  }, [loaded])

  async function fetchVixData() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/vix")
      if (!response.ok) {
        throw new Error("Failed to fetch VIX data")
      }
      const data = await response.json()
      setVixValue(data.vix)
    } catch (err) {
      setError("Unable to fetch current VIX data. Please try again later.")
      console.error("[v0] Error fetching VIX:", err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchVixHistory() {
    try {
      setChartLoading(true)
      const response = await fetch("/api/vix-history")
      if (!response.ok) {
        throw new Error("Failed to fetch VIX history")
      }
      const data = await response.json()
      setVixHistory(data.history)
    } catch (err) {
      console.error("[v0] Error fetching VIX history:", err)
    } finally {
      setChartLoading(false)
    }
  }

  const portfolioValue = Number.parseFloat(portfolioSize) || 0
  const currentLevel = vixValue ? getVixLevel(vixValue) : null

  const cashMin = currentLevel ? (portfolioValue * currentLevel.cashMin) / 100 : 0
  const cashMax = currentLevel ? (portfolioValue * currentLevel.cashMax) / 100 : 0
  const investedMin = currentLevel ? (portfolioValue * currentLevel.investedMin) / 100 : 0
  const investedMax = currentLevel ? (portfolioValue * currentLevel.investedMax) / 100 : 0

  /**
   * The measured side. Blank fields stay NULL rather than becoming 0 — an
   * unentered figure is not a position of zero cash, and 0% against a
   * 25-50% target would render as a loud, false 'badly under'.
   */
  const numOrNull = (v: string): number | null => {
    if (v.trim() === "") return null
    const n = Number.parseFloat(v)
    return Number.isFinite(n) ? n : null
  }
  const freeCashPosition = currentLevel
    ? computeFreeCashPosition(
        {
          accountValue: numOrNull(portfolioSize),
          cashOnHand: numOrNull(cashOnHand),
          committedCollateral: numOrNull(committedCollateral),
        },
        currentLevel.cashMin,
        currentLevel.cashMax,
      )
    : null

  const marginBufferMin = currentLevel ? (cashMin * currentLevel.marginBufferPercent) / 100 : 0
  const marginBufferMax = currentLevel ? (cashMax * currentLevel.marginBufferPercent) / 100 : 0
  const opportunityCashMin = currentLevel ? (cashMin * currentLevel.opportunityPercent) / 100 : 0
  const opportunityCashMax = currentLevel ? (cashMax * currentLevel.opportunityPercent) / 100 : 0

  const ConditionalTooltip = ({ content, children }: { content: string; children: React.ReactNode }) => {
    if (!tooltipsEnabled) return <>{children}</>
    return (
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-xs">{content}</TooltipContent>
      </Tooltip>
    )
  }

  if (!loaded) {
    return (
      <DataLoadGate
        title="Load CBOE VIX Volatility Index?"
        description="Fetch the current VIX reading, 6-month history, and portfolio allocation guidance. Nothing loads until you choose to."
        onConfirm={() => setLoaded(true)}
      />
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              CBOE VIX Volatility Index
              {tooltipsEnabled && (
                <ConditionalTooltip content="The VIX (CBOE Volatility Index) measures expected 30-day S&P 500 volatility. For options traders: Low VIX (under 15) means cheap options but small premiums - favor buying strategies. High VIX (over 25) means expensive options with fat premiums - favor selling strategies like credit spreads and iron condors.">
                  <Info className="h-5 w-5 text-muted-foreground cursor-help" />
                </ConditionalTooltip>
              )}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Real-time volatility analysis and portfolio allocation recommendations
            </p>
          </div>
          <div className="flex items-center gap-3">
            <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
            <RefreshButton onClick={fetchVixData} isLoading={loading} />
          </div>
        </div>

        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  CBOE VIX Volatility Index
                  {tooltipsEnabled && (
                    <ConditionalTooltip content="This scale shows where current VIX falls relative to historical extremes. Green zones (low VIX) indicate market complacency - good for buying options. Red zones (high VIX) indicate fear - excellent for selling premium as volatility typically mean-reverts.">
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </ConditionalTooltip>
                  )}
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Visual representation of volatility zones from extreme calm to extreme fear
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="relative">
                <div className="h-24 bg-gradient-to-r from-green-500 via-yellow-400 via-50% via-orange-500 via-75% to-red-600 rounded-lg shadow-inner" />
                <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-bold">
                  <div className="text-center text-white drop-shadow-lg">
                    <div className="text-base">EXTREME</div>
                    <div>GREED</div>
                    <div className="text-[10px] mt-1">{"≤"}12</div>
                  </div>
                  <div className="text-center text-gray-800 drop-shadow">
                    <div>GREED</div>
                    <div className="text-[10px] mt-1">12-15</div>
                  </div>
                  <div className="text-center text-gray-800 drop-shadow">
                    <div>NORMAL</div>
                    <div className="text-[10px] mt-1">15-20</div>
                  </div>
                  <div className="text-center text-white drop-shadow-lg">
                    <div>FEAR</div>
                    <div className="text-[10px] mt-1">20-30</div>
                  </div>
                  <div className="text-center text-white drop-shadow-lg">
                    <div className="text-base">EXTREME</div>
                    <div>FEAR</div>
                    <div className="text-[10px] mt-1">{"≥"}30</div>
                  </div>
                </div>
                {vixValue && (
                  <div
                    className="absolute top-0 bottom-0 w-2 bg-black shadow-lg transition-all duration-500"
                    style={{
                      left: `calc(${Math.min(100, (vixValue / 30) * 100)}% - 4px)`,
                    }}
                  >
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <div className="bg-black text-white px-4 py-2 rounded-lg shadow-xl">
                        <div className="text-xs font-semibold">TODAY</div>
                        <div className="text-2xl font-bold">{vixValue.toFixed(2)}</div>
                        <div className="text-xs text-center">
                          {/* P7-77: the band names the sentiment. This was a
                              fifth inline threshold ladder — five rungs against
                              the library's four bands, so the marker could read
                              "Greed" while the table below highlighted a
                              different row. */}
                          {getVixLevel(vixValue).sentiment}
                        </div>
                      </div>
                      <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-black mx-auto" />
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-16 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-xs font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  Historical Reference Points
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-red-600">COVID-19 Peak (Mar 2020):</span>
                    <span className="ml-1 text-gray-700">82.69 (Extreme Fear)</span>
                  </div>
                  <div>
                    <span className="font-semibold text-green-600">Pre-COVID Low (Jan 2020):</span>
                    <span className="ml-1 text-gray-700">12.10 (Extreme Greed)</span>
                  </div>
                  <div>
                    <span className="font-semibold text-red-600">2008 Financial Crisis:</span>
                    <span className="ml-1 text-gray-700">89.53 (Extreme Fear)</span>
                  </div>
                  <div>
                    <span className="font-semibold text-green-600">2017 Bull Market:</span>
                    <span className="ml-1 text-gray-700">9.15 (Extreme Greed)</span>
                  </div>
                  <div>
                    <span className="font-semibold text-red-600">2022 Bear Market:</span>
                    <span className="ml-1 text-gray-700">36.45 (Extreme Fear)</span>
                  </div>
                  <div>
                    <span className="font-semibold text-green-600">AI Rally (Early 2024):</span>
                    <span className="ml-1 text-gray-700">12.74 (Extreme Greed)</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              VIX Chart (Last 6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 pb-4">
            {chartLoading ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="flex items-center gap-2 text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading chart...</span>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={vixHistory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                    tickFormatter={(value) => {
                      const date = new Date(value)
                      return `${date.getMonth() + 1}/${date.getDate()}`
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} domain={["dataMin - 2", "dataMax + 2"]} />
                  <ChartTooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "8px 12px",
                    }}
                    labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
                    formatter={(value: number) => [`${value.toFixed(2)}`, "VIX"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#00a868"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Portfolio Information
              {tooltipsEnabled && (
                <ConditionalTooltip content="Enter your portfolio value to see the cash target for the current VIX band. Higher VIX means a lower cash target — the buffer held at calm levels is what gets deployed when volatility rises.">
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </ConditionalTooltip>
              )}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              Enter your portfolio size to see the cash target for the current VIX band
            </p>
          </CardHeader>
          <CardContent className="pt-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="portfolio" className="text-sm font-semibold text-gray-700">
                Total Portfolio Size
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                <Input
                  id="portfolio"
                  type="number"
                  placeholder="100000"
                  value={portfolioSize}
                  onChange={(e) => setPortfolioSize(e.target.value)}
                  className="pl-7 h-12 text-lg border-gray-300 focus:border-primary focus:ring-primary"
                  min="0"
                  step="1000"
                />
              </div>
            </div>

            {/* P7-79. Both optional. The tab worked as a target-only calculator
                before these existed and still does when they are blank — which
                is why nothing below renders until a position can actually be
                computed. */}
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <div className="space-y-2">
                <Label htmlFor="cash-on-hand" className="text-sm font-semibold text-gray-700">
                  Cash in account <span className="font-normal text-gray-500">(optional)</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <Input
                    id="cash-on-hand"
                    type="number"
                    placeholder="30000"
                    value={cashOnHand}
                    onChange={(e) => setCashOnHand(e.target.value)}
                    className="pl-7 h-11 border-gray-300 focus:border-primary focus:ring-primary"
                    min="0"
                    step="1000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="committed-collateral" className="text-sm font-semibold text-gray-700">
                  Committed to open puts <span className="font-normal text-gray-500">(optional)</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <Input
                    id="committed-collateral"
                    type="number"
                    placeholder="20000"
                    value={committedCollateral}
                    onChange={(e) => setCommittedCollateral(e.target.value)}
                    className="pl-7 h-11 border-gray-300 focus:border-primary focus:ring-primary"
                    min="0"
                    step="1000"
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Cash pledged as collateral against open cash-secured puts is not deployable. Entering both
              shows free cash — the figure this framework's ratio is built on — against the band target.
            </p>

            {freeCashPosition && currentLevel && (
              <div
                className={`mt-4 p-4 rounded-lg border-2 ${
                  freeCashPosition.overCommitted
                    ? "border-red-300 bg-red-50"
                    : freeCashPosition.standing === "within"
                      ? "border-green-300 bg-green-50"
                      : "border-yellow-300 bg-yellow-50"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs font-semibold uppercase text-gray-600">Free liquid cash</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {freeCashPosition.freeCashPercent}%
                      <span className="ml-2 text-base font-normal text-gray-600">
                        (${freeCashPosition.freeCash.toLocaleString()})
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold uppercase text-gray-600">Band target</div>
                    <div className="text-lg font-bold text-gray-900">
                      {currentLevel.cashMin}-{currentLevel.cashMax}%
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mt-2">
                  {describeStanding(freeCashPosition, currentLevel.cashMin, currentLevel.cashMax)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Current VIX Level
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 pb-4">
            {loading ? (
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading VIX data...</span>
              </div>
            ) : error ? (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            ) : vixValue && currentLevel ? (
              <div className="space-y-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-bold text-gray-900">{vixValue.toFixed(2)}</span>
                  <span className={`text-xl font-bold ${currentLevel.color}`}>{currentLevel.sentiment}</span>
                </div>
                <div className="text-sm text-gray-600 font-medium">VIX Range: {currentLevel.range}</div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {portfolioValue > 0 && currentLevel && vixValue && (
          <Card className="shadow-md border-2 border-primary bg-gradient-to-br from-white to-green-50">
            <CardHeader className="border-b border-green-100">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                Recommended Allocation
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 pb-4 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2 p-4 bg-white rounded-lg border border-gray-200">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">VIX-Based Cash</div>
                  <div className="text-3xl font-bold text-gray-900">
                    ${cashMin.toLocaleString()} - ${cashMax.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">
                    {currentLevel.cashMin}% - {currentLevel.cashMax}% of portfolio
                  </div>
                </div>
                <div className="space-y-2 p-4 bg-white rounded-lg border border-gray-200">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Invested Capital</div>
                  <div className="text-3xl font-bold text-gray-900">
                    ${investedMin.toLocaleString()} - ${investedMax.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">
                    {currentLevel.investedMin}% - {currentLevel.investedMax}% of portfolio
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Cash Allocation Breakdown</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-600" />
                      <div className="text-xs font-semibold text-blue-900 uppercase">Trading Float (Margin Buffer)</div>
                    </div>
                    <div className="text-2xl font-bold text-blue-900">
                      ${marginBufferMin.toLocaleString()} - ${marginBufferMax.toLocaleString()}
                    </div>
                    <div className="text-xs text-blue-700">{currentLevel.marginBufferPercent}% of cash reserve</div>
                  </div>
                  <div className="space-y-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-amber-600" />
                      <div className="text-xs font-semibold text-amber-900 uppercase">Opportunity Cash (Dip-Buy)</div>
                    </div>
                    <div className="text-2xl font-bold text-amber-900">
                      ${opportunityCashMin.toLocaleString()} - ${opportunityCashMax.toLocaleString()}
                    </div>
                    <div className="text-xs text-amber-700">{currentLevel.opportunityPercent}% of cash reserve</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Recommended Actions</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="text-xs font-semibold text-purple-900 uppercase mb-1">Options Seller Strategy</div>
                    <div className="text-sm text-purple-800 font-medium">{currentLevel.optionsAction}</div>
                  </div>
                  <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                    <div className="text-xs font-semibold text-teal-900 uppercase mb-1">Equity Buyer Strategy</div>
                    <div className="text-sm text-teal-800 font-medium">{currentLevel.equityAction}</div>
                  </div>
                </div>
              </div>
              <Alert className="bg-white border-gray-200">
                <AlertDescription className="text-gray-700">
                  Based on current market volatility (VIX: {vixValue.toFixed(2)}), you should maintain{" "}
                  <strong className="text-gray-900">
                    {currentLevel.cashMin}-{currentLevel.cashMax}% cash
                  </strong>{" "}
                  to manage risk effectively in this{" "}
                  <strong className={currentLevel.color}>{currentLevel.sentiment}</strong> environment.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        <AllocationByVixSection vixValue={vixValue} />

        <OptionsHedgingSection currentLevel={currentLevel} />
      </div>
    </TooltipProvider>
  )
}
