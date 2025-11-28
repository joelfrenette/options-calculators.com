"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  RefreshCw,
  RotateCcw,
  Zap,
  Filter,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Percent,
} from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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
}

const MOCK_CANDIDATES: WheelCandidate[] = [
  {
    ticker: "AAPL",
    company: "Apple Inc",
    price: 189.5,
    putStrike: 180,
    putPremium: 2.85,
    putDte: 30,
    annualizedReturn: 19.2,
    ivRank: 42,
    divYield: 0.5,
    cashRequired: 18000,
    signal: "strong",
    fundamentals: "A+",
    reason: "Best-in-class balance sheet, services growth, buyback machine",
  },
  {
    ticker: "MSFT",
    company: "Microsoft Corp",
    price: 425.0,
    putStrike: 410,
    putPremium: 4.2,
    putDte: 30,
    annualizedReturn: 12.4,
    ivRank: 35,
    divYield: 0.7,
    cashRequired: 41000,
    signal: "strong",
    fundamentals: "A+",
    reason: "AI leader, Azure growth, recurring revenue model",
  },
  {
    ticker: "AMD",
    company: "AMD Inc",
    price: 142.0,
    putStrike: 135,
    putPremium: 3.45,
    putDte: 30,
    annualizedReturn: 31.2,
    ivRank: 58,
    divYield: 0,
    cashRequired: 13500,
    signal: "moderate",
    fundamentals: "B+",
    reason: "AI chip demand, but more volatile than NVDA",
  },
  {
    ticker: "JPM",
    company: "JPMorgan Chase",
    price: 205.0,
    putStrike: 195,
    putPremium: 2.9,
    putDte: 30,
    annualizedReturn: 18.1,
    ivRank: 32,
    divYield: 2.2,
    cashRequired: 19500,
    signal: "strong",
    fundamentals: "A",
    reason: "Best-of-breed bank, rising rates benefit, strong dividend",
  },
  {
    ticker: "COST",
    company: "Costco Wholesale",
    price: 920.0,
    putStrike: 890,
    putPremium: 8.5,
    putDte: 30,
    annualizedReturn: 11.6,
    ivRank: 28,
    divYield: 0.5,
    cashRequired: 89000,
    signal: "strong",
    fundamentals: "A",
    reason: "Recession-resistant, membership model, consistent growth",
  },
  {
    ticker: "PLTR",
    company: "Palantir Technologies",
    price: 65.0,
    putStrike: 60,
    putPremium: 2.15,
    putDte: 30,
    annualizedReturn: 43.5,
    ivRank: 72,
    divYield: 0,
    cashRequired: 6000,
    signal: "speculative",
    fundamentals: "B",
    reason: "High IV = high premium, but volatile AI play",
  },
]

export function WheelStrategyScreener() {
  const [minReturn, setMinReturn] = useState([15])
  const [maxCash, setMaxCash] = useState([50000])
  const [fundamentalGrade, setFundamentalGrade] = useState<"all" | "a" | "b">("all")
  const [isLoading, setIsLoading] = useState(false)
  const [candidates, setCandidates] = useState<WheelCandidate[]>(MOCK_CANDIDATES)

  const filteredCandidates = candidates.filter((c) => {
    if (c.annualizedReturn < minReturn[0]) return false
    if (c.cashRequired > maxCash[0]) return false
    if (fundamentalGrade === "a" && !c.fundamentals.startsWith("A")) return false
    if (fundamentalGrade === "b" && c.fundamentals.startsWith("C")) return false
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

  const getFundamentalBadge = (grade: string) => {
    if (grade.startsWith("A")) return <Badge className="bg-green-600 text-white">{grade}</Badge>
    if (grade.startsWith("B")) return <Badge className="bg-yellow-600 text-white">{grade}</Badge>
    return <Badge className="bg-red-600 text-white">{grade}</Badge>
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <RotateCcw className="w-6 h-6" />
                <h1 className="text-2xl font-bold">Wheel Strategy Screener</h1>
              </div>
              <p className="text-amber-100">
                Find quality stocks for cash-secured puts with excellent fundamentals and premium
              </p>
            </div>
            <Button onClick={handleRefresh} variant="secondary" disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Scan Now
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-green-700 font-medium">Avg Annualized Return</p>
              <p className="text-2xl font-bold text-green-800">22.5%</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-blue-700 font-medium">Stocks Scanned</p>
              <p className="text-2xl font-bold text-blue-800">1,247</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-purple-700 font-medium">Quality Candidates</p>
              <p className="text-2xl font-bold text-purple-800">{filteredCandidates.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-amber-700 font-medium">Avg IV Rank</p>
              <p className="text-2xl font-bold text-amber-800">44%</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5 text-amber-600" />
              Screening Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Min Annualized Return: {minReturn[0]}%</label>
                <Slider value={minReturn} onValueChange={setMinReturn} min={5} max={50} step={5} className="mt-3" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Max Cash Required: ${maxCash[0].toLocaleString()}
                </label>
                <Slider
                  value={maxCash}
                  onValueChange={setMaxCash}
                  min={5000}
                  max={100000}
                  step={5000}
                  className="mt-3"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Fundamental Grade</label>
                <Select value={fundamentalGrade} onValueChange={(v: "all" | "a" | "b") => setFundamentalGrade(v)}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border shadow-lg z-50">
                    <SelectItem value="all">All Grades</SelectItem>
                    <SelectItem value="a">A Grade Only</SelectItem>
                    <SelectItem value="b">B+ or Better</SelectItem>
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
                <CardTitle>Top Wheel Candidates</CardTitle>
                <CardDescription>Stocks you&apos;d be happy to own at a discount</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">TICKER</th>
                    <th className="pb-3 font-medium">PRICE</th>
                    <th className="pb-3 font-medium">PUT STRIKE</th>
                    <th className="pb-3 font-medium">PREMIUM</th>
                    <th className="pb-3 font-medium">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          ANN. RET <Info className="w-3 h-3" />
                        </TooltipTrigger>
                        <TooltipContent>Annualized Return if Put Expires Worthless</TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="pb-3 font-medium">IV RANK</th>
                    <th className="pb-3 font-medium">GRADE</th>
                    <th className="pb-3 font-medium">CASH REQ</th>
                    <th className="pb-3 font-medium">SIGNAL</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((candidate, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-4">
                        <div>
                          <span className="font-semibold text-amber-600">{candidate.ticker}</span>
                          <p className="text-xs text-muted-foreground">{candidate.company}</p>
                        </div>
                      </td>
                      <td className="py-4 font-mono">${candidate.price.toFixed(2)}</td>
                      <td className="py-4 font-mono font-semibold">${candidate.putStrike}</td>
                      <td className="py-4 font-semibold text-green-600">${candidate.putPremium.toFixed(2)}</td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <Percent className="w-4 h-4 text-green-600" />
                          <span
                            className={`font-bold ${candidate.annualizedReturn >= 20 ? "text-green-600" : candidate.annualizedReturn >= 15 ? "text-yellow-600" : "text-muted-foreground"}`}
                          >
                            {candidate.annualizedReturn.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-4">
                        <Badge variant={candidate.ivRank >= 50 ? "default" : "outline"}>{candidate.ivRank}%</Badge>
                      </td>
                      <td className="py-4">{getFundamentalBadge(candidate.fundamentals)}</td>
                      <td className="py-4 font-mono text-sm">${candidate.cashRequired.toLocaleString()}</td>
                      <td className="py-4">{getSignalBadge(candidate.signal)}</td>
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
            <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
              <Zap className="w-5 h-5" />
              AI Insights: Wheel Strategy Selection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="stock-selection">
                <AccordionTrigger className="font-semibold">What Makes a Good Wheel Stock?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>
                    The best wheel candidates are stocks you&apos;d genuinely want to own long-term at a discount. Focus
                    on quality over premium.
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                    <p className="font-medium text-amber-800">Selection Criteria:</p>
                    <ul className="text-sm text-amber-700 list-disc list-inside mt-1">
                      <li>Strong balance sheet and cash flow</li>
                      <li>Dividend paying (bonus income if assigned)</li>
                      <li>Liquid options with tight bid-ask spreads</li>
                      <li>IV Rank 30%+ for worthwhile premium</li>
                      <li>Avoid earnings, FDA events during the trade</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="management">
                <AccordionTrigger className="font-semibold">Position Management</AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>The wheel works best with proper position sizing and exit rules.</p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                    <p className="font-medium text-blue-800">Management Rules:</p>
                    <ul className="text-sm text-blue-700 list-disc list-inside mt-1">
                      <li>Sell puts at 70-80% probability (OTM)</li>
                      <li>Roll for credit if tested before expiration</li>
                      <li>If assigned, immediately sell covered calls</li>
                      <li>Target call strikes at or above cost basis</li>
                      <li>Never more than 5% of portfolio in one wheel</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="current-picks">
                <AccordionTrigger className="font-semibold">This Week&apos;s Top Picks</AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>Based on current IV levels, fundamentals, and technical setups:</p>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                    <p className="font-medium text-green-800">Recommended Setups:</p>
                    <ul className="text-sm text-green-700 list-disc list-inside mt-1">
                      <li>
                        <strong>AAPL $180 Put:</strong> Strong support, post-earnings stability
                      </li>
                      <li>
                        <strong>JPM $195 Put:</strong> Bank strength + 2.2% dividend if assigned
                      </li>
                      <li>
                        <strong>MSFT $410 Put:</strong> AI leader, cloud growth intact
                      </li>
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

export default WheelStrategyScreener
