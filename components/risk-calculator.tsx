"use client"

import type React from "react"

import { useState, useEffect } from "react"
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface VixLevel {
  range: string
  sentiment: string
  cashMin: number
  cashMax: number
  investedMin: number
  investedMax: number
  color: string
  optionsAction: string
  equityAction: string
  marginBufferPercent: number // Percentage of total cash for margin buffer
  opportunityPercent: number // Percentage of total cash for dip-buying
}

const VIX_LEVELS: VixLevel[] = [
  {
    range: "≤ 12",
    sentiment: "Extreme Greed",
    cashMin: 40,
    cashMax: 50,
    investedMin: 50,
    investedMax: 60,
    color: "text-green-600",
    optionsAction: "Sell limited-risk spreads only",
    equityAction: "Avoid new buys; trim winners",
    marginBufferPercent: 50, // 20-25% of portfolio
    opportunityPercent: 50, // 20-25% of portfolio
  },
  {
    range: "12-15",
    sentiment: "Greed",
    cashMin: 30,
    cashMax: 40,
    investedMin: 60,
    investedMax: 70,
    color: "text-green-500",
    optionsAction: "Small size, short puts on quality stocks",
    equityAction: "Wait for pullback",
    marginBufferPercent: 55,
    opportunityPercent: 45,
  },
  {
    range: "15-20",
    sentiment: "Slight Fear",
    cashMin: 20,
    cashMax: 25,
    investedMin: 75,
    investedMax: 80,
    color: "text-yellow-600",
    optionsAction: "Regular put selling",
    equityAction: "Start small DCA",
    marginBufferPercent: 60,
    opportunityPercent: 40,
  },
  {
    range: "20-25",
    sentiment: "Fear",
    cashMin: 10,
    cashMax: 15,
    investedMin: 85,
    investedMax: 90,
    color: "text-orange-600",
    optionsAction: "Scale up short puts / strangles",
    equityAction: "Deploy dip cash (10-15%)",
    marginBufferPercent: 70,
    opportunityPercent: 30,
  },
  {
    range: "25-30",
    sentiment: "Very Fearful",
    cashMin: 5,
    cashMax: 10,
    investedMin: 90,
    investedMax: 95,
    color: "text-red-600",
    optionsAction: "Go heavier into short puts (still hedged)",
    equityAction: "Aggressive DCA, nibble growth names",
    marginBufferPercent: 80,
    opportunityPercent: 20,
  },
  {
    range: "≥ 30",
    sentiment: "Extreme Fear",
    cashMin: 0,
    cashMax: 5,
    investedMin: 95,
    investedMax: 100,
    color: "text-red-700",
    optionsAction: "Massive premiums — ladder entries carefully",
    equityAction: "Deploy remaining cash in tranches",
    marginBufferPercent: 100,
    opportunityPercent: 0,
  },
]

function getVixLevel(vix: number): VixLevel {
  if (vix <= 12) return VIX_LEVELS[0]
  if (vix <= 15) return VIX_LEVELS[1]
  if (vix <= 20) return VIX_LEVELS[2]
  if (vix <= 25) return VIX_LEVELS[3]
  if (vix <= 30) return VIX_LEVELS[4]
  return VIX_LEVELS[5]
}

function getVixPortfolioAllocation(vixLevel: number): {
  stocks: string
  options: string
  crypto: string
  gold: string
  cash: string
  description: string
  rationale: string[]
} {
  if (vixLevel <= 12) {
    // Extreme Greed (VIX ≤ 12)
    return {
      stocks: "35-45%",
      options: "10-15%",
      crypto: "5-10%",
      gold: "5-10%",
      cash: "40-50%",
      description: "Maximum caution - markets at peak complacency, crashes often follow extreme lows",
      rationale: [
        "Trim equity exposure aggressively; VIX this low historically precedes sharp corrections",
        "Limit options to defined-risk spreads only; avoid naked short puts",
        "Build large cash reserves for inevitable volatility spike buying opportunities",
        "Gold/defensive assets as portfolio hedges against sudden reversals",
        "Small crypto allocation only if already profitable; avoid new entries at market peaks",
      ],
    }
  } else if (vixLevel <= 15) {
    // Greed (VIX 12-15)
    return {
      stocks: "40-50%",
      options: "10-15%",
      crypto: "5-10%",
      gold: "5-10%",
      cash: "30-40%",
      description: "Still elevated greed - cautious deployment, wait for better risk/reward setups",
      rationale: [
        "Maintain elevated cash levels; market still pricing in low volatility",
        "Selective short puts on highest-quality names only with small position sizing",
        "Continue building cash reserves for better opportunities ahead",
        "Gold as portfolio stabilizer; crypto only as tactical satellite position",
        "Focus on risk management over aggressive growth",
      ],
    }
  } else if (vixLevel <= 20) {
    // Slight Fear (VIX 15-20)
    return {
      stocks: "50-60%",
      options: "15-20%",
      crypto: "5-10%",
      gold: "5-10%",
      cash: "20-25%",
      description: "Normal volatility environment - balanced approach with regular options selling",
      rationale: [
        "Healthy volatility levels support regular put-selling strategies",
        "Begin DCA into quality growth stocks on minor pullbacks",
        "Options premiums still attractive for income generation",
        "Maintain tactical cash buffer for opportunistic additions",
        "Diversified exposure across asset classes for risk balance",
      ],
    }
  } else if (vixLevel <= 25) {
    // Fear (VIX 20-25)
    return {
      stocks: "60-70%",
      options: "15-20%",
      crypto: "5-10%",
      gold: "5-10%",
      cash: "10-15%",
      description: "Elevated fear creates opportunities - deploy dip-buying cash on pullbacks",
      rationale: [
        "Increase equity exposure as fear rises; best buying opportunities emerge",
        "Scale up short put strategies as premiums expand significantly",
        "Deploy 10-15% of cash reserves on high-quality dip purchases",
        "Options strategies generate outsized income during volatility spikes",
        "Maintain some cash for potential further downside but start getting aggressive",
      ],
    }
  } else if (vixLevel <= 30) {
    // Very Fearful (VIX 25-30)
    return {
      stocks: "65-75%",
      options: "20-25%",
      crypto: "5-10%",
      gold: "0-5%",
      cash: "5-10%",
      description: "High fear environment - aggressive buying of quality assets at discount prices",
      rationale: [
        "Significant market fear creates exceptional entry points for long-term holdings",
        "Heavy short put activity captures massive volatility premiums",
        "Deploy cash reserves aggressively through systematic DCA approach",
        "Focus on mega-cap tech and defensive blue chips at attractive valuations",
        "Options strategies generate outsized income during volatility spikes",
      ],
    }
  } else {
    // Extreme Fear (VIX ≥ 30)
    return {
      stocks: "70-85%",
      options: "20-30%",
      crypto: "5-10%",
      gold: "0-5%",
      cash: "0-5%",
      description: "Maximum opportunity - panic creates generational buying moments",
      rationale: [
        "Deploy all remaining cash in measured tranches; these are lifetime opportunities",
        "Massive options premiums available; ladder short put entries carefully to avoid catching falling knives",
        "Buy growth stocks that sold off 40-60% from highs with strong balance sheets",
        "Market panic rarely lasts; positioning for 6-12 month recovery timeframe",
        "Keep minimal cash only for emergency margin requirements and essential liquidity",
      ],
    }
  }
}

export function RiskCalculator() {
  const [portfolioSize, setPortfolioSize] = useState<string>("")
  const [vixValue, setVixValue] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vixHistory, setVixHistory] = useState<Array<{ date: string; value: number }>>([])
  const [chartLoading, setChartLoading] = useState(true)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  useEffect(() => {
    fetchVixData()
    fetchVixHistory()
  }, [])

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
                  VIX Volatility Historical Scale
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
                          {vixValue <= 12
                            ? "Extreme Greed"
                            : vixValue <= 15
                              ? "Greed"
                              : vixValue <= 20
                                ? "Normal"
                                : vixValue <= 30
                                  ? "Fear"
                                  : "Extreme Fear"}
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
                  <Tooltip
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
                <ConditionalTooltip content="Enter your total portfolio value to get personalized cash allocation recommendations based on current VIX levels. Higher VIX = keep more cash ready for opportunities and margin requirements.">
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </ConditionalTooltip>
              )}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              Please Enter Your Portfolio Size - So we can calculate the recommended Cash on Hand Level
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

        <Accordion type="single" collapsible defaultValue="">
          <AccordionItem value="portfolio-allocation" className="border-0">
            <Card className="shadow-sm border-gray-200">
              <AccordionTrigger className="hover:no-underline [&[data-state=open]>div]:rounded-b-none">
                <CardHeader className="bg-gray-50 border-b border-gray-200 w-full py-4">
                  <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-primary" />
                    Portfolio Allocation Guidance by VIX Level
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-2 text-left">
                    Complete allocation strategies across all volatility regimes with asset class breakdowns
                  </p>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-3">
                    {[
                      { range: "≤ 12", vix: 10 },
                      { range: "12-15", vix: 13.5 },
                      { range: "15-20", vix: 17.5 },
                      { range: "20-25", vix: 22.5 },
                      { range: "25-30", vix: 27.5 },
                      { range: "≥ 30", vix: 35 },
                    ].map((item, index) => {
                      const levelData = getVixPortfolioAllocation(item.vix)
                      const levelInfo = getVixLevel(item.vix)
                      const isCurrent =
                        vixValue &&
                        vixValue >=
                          (index === 0
                            ? 0
                            : index === 1
                              ? 12
                              : index === 2
                                ? 15
                                : index === 3
                                  ? 20
                                  : index === 4
                                    ? 25
                                    : 30) &&
                        vixValue <
                          (index === 5
                            ? 999
                            : index === 4
                              ? 30
                              : index === 3
                                ? 25
                                : index === 2
                                  ? 20
                                  : index === 1
                                    ? 15
                                    : 12)

                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border transition-colors ${
                            isCurrent
                              ? "border-green-500 bg-green-100 shadow-md ring-2 ring-green-300"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="font-mono text-sm font-bold text-gray-900">VIX {item.range}</span>
                                <span className={`ml-3 font-bold text-sm ${levelInfo.color}`}>
                                  {levelInfo.sentiment}
                                </span>
                              </div>
                              {isCurrent && (
                                <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">
                                  CURRENT
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 italic">{levelData.description}</p>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                            <div className="p-3 bg-blue-50 rounded border border-blue-200">
                              <div className="text-xs font-semibold text-blue-900 uppercase mb-1">Stocks/ETFs</div>
                              <div className="text-lg font-bold text-blue-900">{levelData.stocks}</div>
                            </div>
                            <div className="p-3 bg-purple-50 rounded border border-purple-200">
                              <div className="text-xs font-semibold text-purple-900 uppercase mb-1">Options</div>
                              <div className="text-lg font-bold text-purple-900">{levelData.options}</div>
                            </div>
                            <div className="p-3 bg-orange-50 rounded border border-orange-200">
                              <div className="text-xs font-semibold text-orange-900 uppercase mb-1">BTC/Crypto</div>
                              <div className="text-lg font-bold text-orange-900">{levelData.crypto}</div>
                            </div>
                            <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                              <div className="text-xs font-semibold text-yellow-900 uppercase mb-1">Gold/Silver</div>
                              <div className="text-lg font-bold text-yellow-900">{levelData.gold}</div>
                            </div>
                            <div className="p-3 bg-gray-50 rounded border border-gray-300">
                              <div className="text-xs font-semibold text-gray-900 uppercase mb-1">Cash Reserve</div>
                              <div className="text-lg font-bold text-gray-900">{levelData.cash}</div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {levelData.rationale.map((point, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                <span className="text-primary mt-1 flex-shrink-0">•</span>
                                <span>{point}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-800 leading-relaxed">
                      <strong>Note:</strong> These allocations are strategic guidelines based on historical VIX patterns
                      and market behavior. Always adjust based on your personal risk tolerance, investment timeline, and
                      financial objectives. VIX levels are forward-looking volatility expectations and should be
                      combined with other market indicators for comprehensive decision-making.
                    </p>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>

        <Accordion type="single" collapsible defaultValue="">
          <AccordionItem value="cash-suggestions" className="border-0">
            <Card className="shadow-sm border-gray-200">
              <AccordionTrigger className="hover:no-underline [&[data-state=open]>div]:rounded-b-none">
                <CardHeader className="bg-gray-50 border-b border-gray-200 w-full py-4">
                  <CardTitle className="text-lg font-bold text-gray-900">
                    Cash-On Hand Suggestions Based on VIX Levels
                  </CardTitle>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-2">
                    {VIX_LEVELS.map((level, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border transition-colors ${
                          currentLevel === level
                            ? "border-primary bg-green-50 shadow-sm"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <div className="font-mono text-sm font-bold text-gray-900">VIX {level.range}</div>
                            <div className={`font-bold text-sm ${level.color}`}>{level.sentiment}</div>
                            <div className="text-xs text-gray-600 font-medium mt-2">
                              {level.cashMin}-{level.cashMax}% Cash
                            </div>
                            <div className="text-xs text-gray-600 font-medium">
                              {level.investedMin}-{level.investedMax}% Invested
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-purple-900 uppercase">Options Seller</div>
                            <div className="text-sm text-gray-700">{level.optionsAction}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-teal-900 uppercase">Equity Buyer</div>
                            <div className="text-sm text-gray-700">{level.equityAction}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
      </div>
    </TooltipProvider>
  )
}
