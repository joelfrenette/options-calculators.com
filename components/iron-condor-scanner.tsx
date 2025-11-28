"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { RefreshCw, Layers, Zap, Filter, ArrowUpRight, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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
}

const MOCK_SETUPS: CondorSetup[] = [
  {
    ticker: "SPY",
    company: "SPDR S&P 500",
    putSpread: { short: 575, long: 570 },
    callSpread: { short: 610, long: 615 },
    expiration: "Dec 20",
    dte: 23,
    totalCredit: 1.45,
    maxLoss: 3.55,
    probability: 72,
    ivRank: 28,
    expectedRange: { low: 578, high: 607 },
    width: 5,
    signal: "strong",
    reason: "Low VIX environment, holiday range-bound expected",
  },
  {
    ticker: "QQQ",
    company: "Invesco QQQ",
    putSpread: { short: 480, long: 475 },
    callSpread: { short: 520, long: 525 },
    expiration: "Dec 20",
    dte: 23,
    totalCredit: 1.62,
    maxLoss: 3.38,
    probability: 68,
    ivRank: 32,
    expectedRange: { low: 485, high: 515 },
    width: 5,
    signal: "moderate",
    reason: "Tech consolidation phase, defined range",
  },
  {
    ticker: "IWM",
    company: "iShares Russell 2000",
    putSpread: { short: 225, long: 220 },
    callSpread: { short: 245, long: 250 },
    expiration: "Dec 20",
    dte: 23,
    totalCredit: 1.85,
    maxLoss: 3.15,
    probability: 65,
    ivRank: 45,
    expectedRange: { low: 228, high: 242 },
    width: 5,
    signal: "moderate",
    reason: "Higher IV, small caps range-bound",
  },
  {
    ticker: "AAPL",
    company: "Apple Inc",
    putSpread: { short: 175, long: 170 },
    callSpread: { short: 200, long: 205 },
    expiration: "Dec 20",
    dte: 23,
    totalCredit: 1.28,
    maxLoss: 3.72,
    probability: 76,
    ivRank: 38,
    expectedRange: { low: 178, high: 197 },
    width: 5,
    signal: "strong",
    reason: "Post-earnings stability, strong support/resistance",
  },
  {
    ticker: "AMZN",
    company: "Amazon.com",
    putSpread: { short: 195, long: 190 },
    callSpread: { short: 220, long: 225 },
    expiration: "Dec 20",
    dte: 23,
    totalCredit: 1.55,
    maxLoss: 3.45,
    probability: 70,
    ivRank: 42,
    expectedRange: { low: 198, high: 217 },
    width: 5,
    signal: "moderate",
    reason: "Holiday shopping catalyst, but range expected",
  },
]

export function IronCondorScanner() {
  const [minProbability, setMinProbability] = useState([65])
  const [maxDte, setMaxDte] = useState([45])
  const [minIvRank, setMinIvRank] = useState([25])
  const [isLoading, setIsLoading] = useState(false)
  const [setups, setSetups] = useState<CondorSetup[]>(MOCK_SETUPS)

  const filteredSetups = setups.filter((s) => {
    if (s.probability < minProbability[0]) return false
    if (s.dte > maxDte[0]) return false
    if (s.ivRank < minIvRank[0]) return false
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
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-6 h-6" />
                <h1 className="text-2xl font-bold">Iron Condor Scanner</h1>
              </div>
              <p className="text-purple-100">
                Find range-bound setups with high probability of profit in neutral markets
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
              <Filter className="w-5 h-5 text-purple-600" />
              Scan Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Min Probability: {minProbability[0]}%</label>
                <Slider
                  value={minProbability}
                  onValueChange={setMinProbability}
                  min={50}
                  max={85}
                  step={5}
                  className="mt-3"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Max DTE: {maxDte[0]} days</label>
                <Slider value={maxDte} onValueChange={setMaxDte} min={14} max={60} step={1} className="mt-3" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Min IV Rank: {minIvRank[0]}%</label>
                <Slider value={minIvRank} onValueChange={setMinIvRank} min={0} max={60} step={5} className="mt-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Iron Condor Setups</CardTitle>
                <CardDescription>{filteredSetups.length} range-bound setups found</CardDescription>
              </div>
              <Badge variant="outline" className="gap-1">
                <Layers className="w-3 h-3 text-purple-600" />
                Iron Condor
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">TICKER</th>
                    <th className="pb-3 font-medium">PUT SPREAD</th>
                    <th className="pb-3 font-medium">CALL SPREAD</th>
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
                          <span className="font-semibold text-purple-600">{setup.ticker}</span>
                          <p className="text-xs text-muted-foreground">{setup.company}</p>
                        </div>
                      </td>
                      <td className="py-4 font-mono text-sm text-green-600">
                        ${setup.putSpread.short}/{setup.putSpread.long}
                      </td>
                      <td className="py-4 font-mono text-sm text-red-600">
                        ${setup.callSpread.short}/{setup.callSpread.long}
                      </td>
                      <td className="py-4">
                        <div>
                          <span className="font-medium">{setup.expiration}</span>
                          <p className="text-xs text-muted-foreground">{setup.dte} DTE</p>
                        </div>
                      </td>
                      <td className="py-4 font-semibold text-green-600">${setup.totalCredit.toFixed(2)}</td>
                      <td className="py-4 font-semibold text-red-600">${setup.maxLoss.toFixed(2)}</td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${setup.probability >= 70 ? "bg-green-500" : setup.probability >= 60 ? "bg-yellow-500" : "bg-orange-500"}`}
                              style={{ width: `${setup.probability}%` }}
                            />
                          </div>
                          <span className="font-medium">{setup.probability}%</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <Badge variant={setup.ivRank >= 40 ? "default" : "outline"}>{setup.ivRank}%</Badge>
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

        {/* Expected Range Visualization */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Expected Price Ranges</CardTitle>
            <CardDescription>Visual representation of profit zones for each setup</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredSetups.slice(0, 3).map((setup, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{setup.ticker}</span>
                  <span className="text-muted-foreground">
                    Expected: ${setup.expectedRange.low} - ${setup.expectedRange.high}
                  </span>
                </div>
                <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                  {/* Loss zones */}
                  <div className="absolute left-0 h-full bg-red-200" style={{ width: "15%" }} />
                  <div className="absolute right-0 h-full bg-red-200" style={{ width: "15%" }} />
                  {/* Profit zone */}
                  <div className="absolute h-full bg-green-200" style={{ left: "15%", right: "15%" }} />
                  {/* Strike markers */}
                  <div
                    className="absolute h-full w-0.5 bg-green-600"
                    style={{ left: "15%" }}
                    title={`Put Short: $${setup.putSpread.short}`}
                  />
                  <div
                    className="absolute h-full w-0.5 bg-red-600"
                    style={{ right: "15%" }}
                    title={`Call Short: $${setup.callSpread.short}`}
                  />
                  {/* Labels */}
                  <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-medium">
                    <span className="text-red-700">${setup.putSpread.long}</span>
                    <span className="text-green-700">PROFIT ZONE</span>
                    <span className="text-red-700">${setup.callSpread.long}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-purple-700">
              <Zap className="w-5 h-5" />
              AI Insights: Iron Condor Strategy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="ideal-conditions">
                <AccordionTrigger className="font-semibold">Ideal Market Conditions</AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>
                    Iron condors thrive in low-volatility, range-bound markets. The strategy profits from time decay
                    when the underlying stays between your short strikes.
                  </p>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mt-2">
                    <p className="font-medium text-purple-800">Best Conditions:</p>
                    <ul className="text-sm text-purple-700 list-disc list-inside mt-1">
                      <li>VIX between 15-25 (elevated but not spiking)</li>
                      <li>No major catalysts during the trade</li>
                      <li>30-45 DTE for optimal theta decay</li>
                      <li>Index ETFs (SPY, QQQ, IWM) for diversification</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="adjustment">
                <AccordionTrigger className="font-semibold">Adjustment Strategies</AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>
                    When the market moves against your position, you have several adjustment options to manage risk.
                  </p>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                    <p className="font-medium text-yellow-800">Common Adjustments:</p>
                    <ul className="text-sm text-yellow-700 list-disc list-inside mt-1">
                      <li>Roll the tested side up/down and out in time</li>
                      <li>Close the untested side for profit to reduce risk</li>
                      <li>Convert to a broken wing butterfly</li>
                      <li>Close at 21 DTE if not yet profitable</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="current-outlook">
                <AccordionTrigger className="font-semibold">Current Market Outlook</AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>
                    Holiday trading typically sees reduced volume and tighter ranges - ideal for iron condors.
                    Index-based setups on SPY and QQQ offer the best risk/reward currently.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                    <p className="font-medium text-blue-800">This Week's Focus:</p>
                    <ul className="text-sm text-blue-700 list-disc list-inside mt-1">
                      <li>SPY and QQQ condors with 68-72% POP</li>
                      <li>Avoid individual stocks with pending catalysts</li>
                      <li>Target 20-25% of width as credit</li>
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

export default IronCondorScanner
