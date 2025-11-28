"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  RefreshCw,
  Calendar,
  TrendingUp,
  TrendingDown,
  Zap,
  Filter,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  DollarSign,
  Target,
} from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface EarningsPlay {
  ticker: string
  company: string
  earningsDate: string
  earningsTime: "BMO" | "AMC"
  daysToEarnings: number
  price: number
  expectedMove: number
  expectedMovePercent: number
  ivRank: number
  historicalBeat: number
  avgPostEarningsMove: number
  straddlePrice: number
  strategy: "straddle" | "strangle" | "iron-condor" | "0dte-call" | "0dte-put"
  direction: "bullish" | "bearish" | "neutral"
  signal: "strong" | "moderate" | "speculative"
  thesis: string
}

const MOCK_PLAYS: EarningsPlay[] = [
  {
    ticker: "CRM",
    company: "Salesforce Inc",
    earningsDate: "Dec 3",
    earningsTime: "AMC",
    daysToEarnings: 6,
    price: 325.0,
    expectedMove: 18.5,
    expectedMovePercent: 5.7,
    ivRank: 72,
    historicalBeat: 75,
    avgPostEarningsMove: 6.2,
    straddlePrice: 19.5,
    strategy: "straddle",
    direction: "neutral",
    signal: "strong",
    thesis: "AI narrative strong, expected move underpriced vs historical",
  },
  {
    ticker: "AVGO",
    company: "Broadcom Inc",
    earningsDate: "Dec 5",
    earningsTime: "AMC",
    daysToEarnings: 8,
    price: 185.0,
    expectedMove: 12.0,
    expectedMovePercent: 6.5,
    ivRank: 68,
    historicalBeat: 80,
    avgPostEarningsMove: 7.8,
    straddlePrice: 13.2,
    strategy: "0dte-call",
    direction: "bullish",
    signal: "strong",
    thesis: "VMware integration + AI chip demand, tends to beat big",
  },
  {
    ticker: "LULU",
    company: "Lululemon",
    earningsDate: "Dec 5",
    earningsTime: "AMC",
    daysToEarnings: 8,
    price: 320.0,
    expectedMove: 22.0,
    expectedMovePercent: 6.9,
    ivRank: 75,
    historicalBeat: 65,
    avgPostEarningsMove: 8.5,
    straddlePrice: 24.0,
    strategy: "iron-condor",
    direction: "neutral",
    signal: "moderate",
    thesis: "Expected move seems fair, sell premium if neutral",
  },
  {
    ticker: "DOCU",
    company: "DocuSign Inc",
    earningsDate: "Dec 5",
    earningsTime: "AMC",
    daysToEarnings: 8,
    price: 92.0,
    expectedMove: 8.5,
    expectedMovePercent: 9.2,
    ivRank: 82,
    historicalBeat: 70,
    avgPostEarningsMove: 11.5,
    straddlePrice: 9.8,
    strategy: "straddle",
    direction: "neutral",
    signal: "strong",
    thesis: "High IV but historically moves bigger than expected",
  },
  {
    ticker: "MDB",
    company: "MongoDB Inc",
    earningsDate: "Dec 9",
    earningsTime: "AMC",
    daysToEarnings: 12,
    price: 285.0,
    expectedMove: 28.0,
    expectedMovePercent: 9.8,
    ivRank: 78,
    historicalBeat: 60,
    avgPostEarningsMove: 12.2,
    straddlePrice: 30.5,
    strategy: "strangle",
    direction: "neutral",
    signal: "moderate",
    thesis: "Cloud growth slowing, but AI database narrative emerging",
  },
  {
    ticker: "COST",
    company: "Costco Wholesale",
    earningsDate: "Dec 12",
    earningsTime: "AMC",
    daysToEarnings: 15,
    price: 920.0,
    expectedMove: 32.0,
    expectedMovePercent: 3.5,
    ivRank: 42,
    historicalBeat: 85,
    avgPostEarningsMove: 3.8,
    straddlePrice: 34.0,
    strategy: "0dte-call",
    direction: "bullish",
    signal: "strong",
    thesis: "Consistent beater, holiday shopping tailwind",
  },
]

export function EarningsPlaysScanner() {
  const [strategyFilter, setStrategyFilter] = useState<"all" | "straddle" | "strangle" | "iron-condor" | "0dte">("all")
  const [timeframe, setTimeframe] = useState<"week" | "2weeks" | "month">("2weeks")
  const [isLoading, setIsLoading] = useState(false)
  const [plays, setPlays] = useState<EarningsPlay[]>(MOCK_PLAYS)

  const filteredPlays = plays.filter((p) => {
    if (strategyFilter === "0dte" && !p.strategy.startsWith("0dte")) return false
    if (strategyFilter !== "all" && strategyFilter !== "0dte" && p.strategy !== strategyFilter) return false
    if (timeframe === "week" && p.daysToEarnings > 7) return false
    if (timeframe === "2weeks" && p.daysToEarnings > 14) return false
    return true
  })

  const handleRefresh = () => {
    setIsLoading(true)
    setTimeout(() => setIsLoading(false), 1500)
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

  const getDirectionBadge = (direction: string) => {
    switch (direction) {
      case "bullish":
        return (
          <Badge className="bg-green-100 text-green-800">
            <TrendingUp className="w-3 h-3 mr-1" />
            Bullish
          </Badge>
        )
      case "bearish":
        return (
          <Badge className="bg-red-100 text-red-800">
            <TrendingDown className="w-3 h-3 mr-1" />
            Bearish
          </Badge>
        )
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800">
            <Target className="w-3 h-3 mr-1" />
            Neutral
          </Badge>
        )
    }
  }

  const getStrategyBadge = (strategy: string) => {
    const colors: Record<string, string> = {
      straddle: "bg-purple-100 text-purple-800 border-purple-300",
      strangle: "bg-indigo-100 text-indigo-800 border-indigo-300",
      "iron-condor": "bg-blue-100 text-blue-800 border-blue-300",
      "0dte-call": "bg-green-100 text-green-800 border-green-300",
      "0dte-put": "bg-red-100 text-red-800 border-red-300",
    }
    const labels: Record<string, string> = {
      straddle: "Straddle",
      strangle: "Strangle",
      "iron-condor": "Iron Condor",
      "0dte-call": "0DTE Call",
      "0dte-put": "0DTE Put",
    }
    return <Badge className={colors[strategy] || "bg-gray-100"}>{labels[strategy] || strategy}</Badge>
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-6 h-6" />
                <h1 className="text-2xl font-bold">Earnings Plays Scanner</h1>
              </div>
              <p className="text-violet-100">Find high-probability earnings trades: straddles, strangles, 0DTE plays</p>
            </div>
            <Button onClick={handleRefresh} variant="secondary" disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Scan Now
            </Button>
          </div>
        </div>

        {/* This Week's Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">Best Straddle</span>
              </div>
              <p className="text-2xl font-bold text-green-900">CRM</p>
              <p className="text-sm text-green-700">Dec 3 AMC - Expected move underpriced</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-800">Best 0DTE Call</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">AVGO</p>
              <p className="text-sm text-blue-700">Dec 5 AMC - 80% beat rate, AI catalyst</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-purple-600" />
                <span className="font-semibold text-purple-800">Best Premium Sale</span>
              </div>
              <p className="text-2xl font-bold text-purple-900">LULU</p>
              <p className="text-sm text-purple-700">Dec 5 AMC - Iron condor, fair pricing</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5 text-violet-600" />
              Scan Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Strategy Type</label>
                <Select
                  value={strategyFilter}
                  onValueChange={(v: "all" | "straddle" | "strangle" | "iron-condor" | "0dte") => setStrategyFilter(v)}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border shadow-lg z-50">
                    <SelectItem value="all">All Strategies</SelectItem>
                    <SelectItem value="straddle">Straddles Only</SelectItem>
                    <SelectItem value="strangle">Strangles Only</SelectItem>
                    <SelectItem value="iron-condor">Iron Condors Only</SelectItem>
                    <SelectItem value="0dte">0DTE Plays Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Timeframe</label>
                <Select value={timeframe} onValueChange={(v: "week" | "2weeks" | "month") => setTimeframe(v)}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border shadow-lg z-50">
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="2weeks">Next 2 Weeks</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Upcoming Earnings Plays</CardTitle>
                <CardDescription>{filteredPlays.length} actionable setups found</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">TICKER</th>
                    <th className="pb-3 font-medium">EARNINGS</th>
                    <th className="pb-3 font-medium">PRICE</th>
                    <th className="pb-3 font-medium">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          EXP MOVE <Info className="w-3 h-3" />
                        </TooltipTrigger>
                        <TooltipContent>Expected Move priced into options</TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="pb-3 font-medium">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          AVG MOVE <Info className="w-3 h-3" />
                        </TooltipTrigger>
                        <TooltipContent>Historical average post-earnings move</TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="pb-3 font-medium">IV RANK</th>
                    <th className="pb-3 font-medium">STRATEGY</th>
                    <th className="pb-3 font-medium">DIRECTION</th>
                    <th className="pb-3 font-medium">SIGNAL</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlays.map((play, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-4">
                        <div>
                          <span className="font-semibold text-violet-600">{play.ticker}</span>
                          <p className="text-xs text-muted-foreground">{play.company}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <span className="font-medium">{play.earningsDate}</span>
                            <Badge variant="outline" className="ml-2 text-xs">
                              {play.earningsTime}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{play.daysToEarnings} days</p>
                      </td>
                      <td className="py-4 font-mono">${play.price.toFixed(2)}</td>
                      <td className="py-4">
                        <div>
                          <span className="font-semibold">±${play.expectedMove.toFixed(2)}</span>
                          <p className="text-xs text-muted-foreground">±{play.expectedMovePercent}%</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <span
                          className={`font-semibold ${play.avgPostEarningsMove > play.expectedMovePercent ? "text-green-600" : "text-red-600"}`}
                        >
                          ±{play.avgPostEarningsMove}%
                        </span>
                      </td>
                      <td className="py-4">
                        <Badge variant={play.ivRank >= 60 ? "default" : "outline"}>{play.ivRank}%</Badge>
                      </td>
                      <td className="py-4">{getStrategyBadge(play.strategy)}</td>
                      <td className="py-4">{getDirectionBadge(play.direction)}</td>
                      <td className="py-4">{getSignalBadge(play.signal)}</td>
                      <td className="py-4">
                        <Button size="sm" variant="outline" className="gap-1 bg-transparent">
                          Trade <ArrowUpRight className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-violet-700">
              <Zap className="w-5 h-5" />
              AI Insights: Earnings Trading Strategies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="straddles">
                <AccordionTrigger className="font-semibold">When to Buy Straddles</AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>
                    Straddles profit when the stock moves more than the expected move priced into options. Look for
                    stocks that historically move bigger than expected.
                  </p>
                  <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 mt-2">
                    <p className="font-medium text-violet-800">Best Candidates:</p>
                    <ul className="text-sm text-violet-700 list-disc list-inside mt-1">
                      <li>Historical move &gt; expected move by 20%+</li>
                      <li>Major catalyst beyond just earnings (guidance, M&A)</li>
                      <li>IV Rank not at extreme highs (&lt;80%)</li>
                      <li>Liquid options with tight spreads</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="0dte">
                <AccordionTrigger className="font-semibold">0DTE Earnings Plays</AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>
                    0DTE options on earnings day offer massive leverage but require strong conviction and risk
                    management.
                  </p>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                    <p className="font-medium text-yellow-800">Risk Management:</p>
                    <ul className="text-sm text-yellow-700 list-disc list-inside mt-1">
                      <li>Never risk more than 1% of portfolio on 0DTE</li>
                      <li>Wait for after-hours price action to settle</li>
                      <li>Buy ATM or slightly OTM for best risk/reward</li>
                      <li>Set stop losses and don&apos;t chase</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="selling">
                <AccordionTrigger className="font-semibold">Selling Premium Into Earnings</AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>Iron condors and strangles can profit from IV crush when stocks move less than expected.</p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                    <p className="font-medium text-blue-800">Best Setups:</p>
                    <ul className="text-sm text-blue-700 list-disc list-inside mt-1">
                      <li>Expected move &gt; historical average move</li>
                      <li>IV Rank above 60% (rich premium)</li>
                      <li>No major secondary catalysts</li>
                      <li>Wide strikes for high probability</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}

export default EarningsPlaysScanner
