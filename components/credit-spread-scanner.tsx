"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Filter,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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
}

const MOCK_SETUPS: SpreadSetup[] = [
  {
    ticker: "AAPL",
    company: "Apple Inc",
    type: "bull-put",
    shortStrike: 180,
    longStrike: 175,
    expiration: "Dec 20",
    dte: 23,
    credit: 0.85,
    maxLoss: 4.15,
    probability: 78,
    ivRank: 42,
    delta: -0.18,
    riskReward: "1:4.9",
    signal: "strong",
    reason: "Strong support at $180, earnings behind us, low IV crush risk",
  },
  {
    ticker: "MSFT",
    company: "Microsoft Corp",
    type: "bull-put",
    shortStrike: 410,
    longStrike: 405,
    expiration: "Dec 20",
    dte: 23,
    credit: 0.72,
    maxLoss: 4.28,
    probability: 82,
    ivRank: 35,
    delta: -0.15,
    riskReward: "1:5.9",
    signal: "strong",
    reason: "AI momentum intact, cloud growth accelerating",
  },
  {
    ticker: "NVDA",
    company: "NVIDIA Corp",
    type: "bear-call",
    shortStrike: 520,
    longStrike: 525,
    expiration: "Dec 13",
    dte: 16,
    credit: 1.15,
    maxLoss: 3.85,
    probability: 68,
    ivRank: 65,
    delta: 0.28,
    riskReward: "1:3.3",
    signal: "moderate",
    reason: "Elevated IV after earnings, resistance at $520",
  },
  {
    ticker: "SPY",
    company: "SPDR S&P 500",
    type: "bull-put",
    shortStrike: 580,
    longStrike: 575,
    expiration: "Dec 20",
    dte: 23,
    credit: 0.65,
    maxLoss: 4.35,
    probability: 85,
    ivRank: 28,
    delta: -0.12,
    riskReward: "1:6.7",
    signal: "strong",
    reason: "Broad market strength, Santa rally seasonality",
  },
  {
    ticker: "TSLA",
    company: "Tesla Inc",
    type: "bear-call",
    shortStrike: 360,
    longStrike: 365,
    expiration: "Dec 13",
    dte: 16,
    credit: 1.45,
    maxLoss: 3.55,
    probability: 62,
    ivRank: 72,
    delta: 0.32,
    riskReward: "1:2.4",
    signal: "speculative",
    reason: "High IV, resistance zone, but momentum strong",
  },
  {
    ticker: "AMD",
    company: "AMD Inc",
    type: "bull-put",
    shortStrike: 135,
    longStrike: 130,
    expiration: "Dec 20",
    dte: 23,
    credit: 0.92,
    maxLoss: 4.08,
    probability: 74,
    ivRank: 48,
    delta: -0.22,
    riskReward: "1:4.4",
    signal: "moderate",
    reason: "AI chip demand, support at $135",
  },
]

export function CreditSpreadScanner() {
  const [spreadType, setSpreadType] = useState<"all" | "bull-put" | "bear-call">("all")
  const [minProbability, setMinProbability] = useState([70])
  const [maxDte, setMaxDte] = useState([45])
  const [isLoading, setIsLoading] = useState(false)
  const [setups, setSetups] = useState<SpreadSetup[]>(MOCK_SETUPS)

  const filteredSetups = setups.filter((s) => {
    if (spreadType !== "all" && s.type !== spreadType) return false
    if (s.probability < minProbability[0]) return false
    if (s.dte > maxDte[0]) return false
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

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-6 h-6" />
                <h1 className="text-2xl font-bold">Credit Spread Scanner</h1>
              </div>
              <p className="text-blue-100">
                Find high-probability bull put and bear call spreads with optimal risk/reward
              </p>
            </div>
            <Button onClick={handleRefresh} variant="secondary" disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Scan Now
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-600" />
              Scan Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Spread Type</label>
                <Select value={spreadType} onValueChange={(v: "all" | "bull-put" | "bear-call") => setSpreadType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Spreads</SelectItem>
                    <SelectItem value="bull-put">Bull Put (Bullish)</SelectItem>
                    <SelectItem value="bear-call">Bear Call (Bearish)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Min Probability: {minProbability[0]}%</label>
                <Slider
                  value={minProbability}
                  onValueChange={setMinProbability}
                  min={50}
                  max={90}
                  step={5}
                  className="mt-3"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Max DTE: {maxDte[0]} days</label>
                <Slider value={maxDte} onValueChange={setMaxDte} min={7} max={60} step={1} className="mt-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Credit Spread Setups</CardTitle>
                <CardDescription>{filteredSetups.length} setups match your criteria</CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="gap-1">
                  <TrendingUp className="w-3 h-3 text-green-600" />
                  Bull Put
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <TrendingDown className="w-3 h-3 text-red-600" />
                  Bear Call
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">TICKER</th>
                    <th className="pb-3 font-medium">TYPE</th>
                    <th className="pb-3 font-medium">STRIKES</th>
                    <th className="pb-3 font-medium">EXP</th>
                    <th className="pb-3 font-medium">CREDIT</th>
                    <th className="pb-3 font-medium">MAX LOSS</th>
                    <th className="pb-3 font-medium">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          POP <Info className="w-3 h-3" />
                        </TooltipTrigger>
                        <TooltipContent>Probability of Profit</TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="pb-3 font-medium">IV RANK</th>
                    <th className="pb-3 font-medium">SIGNAL</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSetups.map((setup, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-4">
                        <div>
                          <span className="font-semibold text-blue-600">{setup.ticker}</span>
                          <p className="text-xs text-muted-foreground">{setup.company}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        {setup.type === "bull-put" ? (
                          <Badge className="bg-green-100 text-green-800 border-green-300">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            Bull Put
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 border-red-300">
                            <TrendingDown className="w-3 h-3 mr-1" />
                            Bear Call
                          </Badge>
                        )}
                      </td>
                      <td className="py-4 font-mono text-sm">
                        ${setup.shortStrike}/{setup.longStrike}
                      </td>
                      <td className="py-4">
                        <div>
                          <span className="font-medium">{setup.expiration}</span>
                          <p className="text-xs text-muted-foreground">{setup.dte} DTE</p>
                        </div>
                      </td>
                      <td className="py-4 font-semibold text-green-600">${setup.credit.toFixed(2)}</td>
                      <td className="py-4 font-semibold text-red-600">${setup.maxLoss.toFixed(2)}</td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${setup.probability >= 75 ? "bg-green-500" : setup.probability >= 65 ? "bg-yellow-500" : "bg-orange-500"}`}
                              style={{ width: `${setup.probability}%` }}
                            />
                          </div>
                          <span className="font-medium">{setup.probability}%</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <Badge variant={setup.ivRank >= 50 ? "default" : "outline"}>{setup.ivRank}%</Badge>
                      </td>
                      <td className="py-4">{getSignalBadge(setup.signal)}</td>
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
            <CardTitle className="text-lg flex items-center gap-2 text-teal-700">
              <Zap className="w-5 h-5" />
              AI Insights: Credit Spread Strategy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="when-to-use">
                <AccordionTrigger className="font-semibold">When to Use Credit Spreads</AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>
                    Credit spreads work best when you have a directional bias but want defined risk. Bull put spreads
                    profit when the underlying stays above your short strike, while bear call spreads profit when it
                    stays below.
                  </p>
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mt-2">
                    <p className="font-medium text-teal-800">Ideal Conditions:</p>
                    <ul className="text-sm text-teal-700 list-disc list-inside mt-1">
                      <li>IV Rank above 30% for better premium</li>
                      <li>Clear support/resistance levels to place strikes</li>
                      <li>21-45 DTE for optimal theta decay</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="risk-management">
                <AccordionTrigger className="font-semibold">Risk Management Rules</AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>The key to credit spread success is position sizing and knowing when to exit.</p>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                    <p className="font-medium text-yellow-800">Exit Guidelines:</p>
                    <ul className="text-sm text-yellow-700 list-disc list-inside mt-1">
                      <li>Take profit at 50% of max credit</li>
                      <li>Cut losses at 2x the credit received</li>
                      <li>Close or roll at 21 DTE if not yet profitable</li>
                      <li>Never risk more than 2-3% of account per trade</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="current-market">
                <AccordionTrigger className="font-semibold">Current Market Assessment</AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>
                    With VIX in the low-to-mid range and overall bullish market momentum, bull put spreads on quality
                    names offer favorable risk/reward. Focus on stocks with clear technical support levels.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                    <p className="font-medium text-blue-800">This Week's Focus:</p>
                    <ul className="text-sm text-blue-700 list-disc list-inside mt-1">
                      <li>Favor bull put spreads on mega-cap tech</li>
                      <li>Consider bear call spreads on extended names like TSLA</li>
                      <li>Watch for post-holiday volume return for better fills</li>
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

export default CreditSpreadScanner
