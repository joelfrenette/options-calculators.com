"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { RefreshCw, Flame, TrendingUp, TrendingDown, Zap, Filter, ArrowUpRight, Info, Activity } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface IVCandidate {
  ticker: string
  company: string
  price: number
  ivRank: number
  ivPercentile: number
  currentIV: number
  historicalIV: number
  hvRatio: number
  catalyst: string | null
  daysToEvent: number | null
  recommendation: "sell-premium" | "buy-premium" | "neutral"
  reason: string
}

const MOCK_CANDIDATES: IVCandidate[] = [
  {
    ticker: "MARA",
    company: "Marathon Digital",
    price: 24.5,
    ivRank: 92,
    ivPercentile: 95,
    currentIV: 125,
    historicalIV: 85,
    hvRatio: 1.47,
    catalyst: "Bitcoin volatility",
    daysToEvent: null,
    recommendation: "sell-premium",
    reason: "Extreme IV with no immediate catalyst - premium selling opportunity",
  },
  {
    ticker: "SMCI",
    company: "Super Micro Computer",
    price: 32.0,
    ivRank: 88,
    ivPercentile: 91,
    currentIV: 145,
    historicalIV: 95,
    hvRatio: 1.53,
    catalyst: "Audit concerns",
    daysToEvent: null,
    recommendation: "sell-premium",
    reason: "Elevated uncertainty IV, iron condors attractive",
  },
  {
    ticker: "RIVN",
    company: "Rivian Automotive",
    price: 11.5,
    ivRank: 78,
    ivPercentile: 82,
    currentIV: 95,
    historicalIV: 72,
    hvRatio: 1.32,
    catalyst: "Earnings Dec 5",
    daysToEvent: 8,
    recommendation: "neutral",
    reason: "IV elevated but earnings approaching - wait or play the event",
  },
  {
    ticker: "GME",
    company: "GameStop Corp",
    price: 27.0,
    ivRank: 72,
    ivPercentile: 78,
    currentIV: 85,
    historicalIV: 65,
    hvRatio: 1.31,
    catalyst: null,
    daysToEvent: null,
    recommendation: "sell-premium",
    reason: "Meme stock premium still elevated, sell OTM strangles",
  },
  {
    ticker: "TSLA",
    company: "Tesla Inc",
    price: 342.0,
    ivRank: 68,
    ivPercentile: 72,
    currentIV: 62,
    historicalIV: 48,
    hvRatio: 1.29,
    catalyst: null,
    daysToEvent: null,
    recommendation: "sell-premium",
    reason: "Post-election IV still elevated, mean reversion expected",
  },
  {
    ticker: "NVDA",
    company: "NVIDIA Corp",
    price: 475.0,
    ivRank: 45,
    ivPercentile: 52,
    currentIV: 48,
    historicalIV: 45,
    hvRatio: 1.07,
    catalyst: "Blackwell ramp",
    daysToEvent: null,
    recommendation: "neutral",
    reason: "IV fair value - no edge for premium sellers",
  },
  {
    ticker: "SPY",
    company: "SPDR S&P 500",
    price: 598.0,
    ivRank: 22,
    ivPercentile: 28,
    currentIV: 12,
    historicalIV: 15,
    hvRatio: 0.8,
    catalyst: null,
    daysToEvent: null,
    recommendation: "buy-premium",
    reason: "Historically low IV - buy protection or long straddles",
  },
]

export function HighIVWatchlist() {
  const [minIvRank, setMinIvRank] = useState([50])
  const [sortBy, setSortBy] = useState<"ivRank" | "ivPercentile" | "hvRatio">("ivRank")
  const [showOnly, setShowOnly] = useState<"all" | "sell" | "buy">("all")
  const [isLoading, setIsLoading] = useState(false)
  const [candidates, setCandidates] = useState<IVCandidate[]>(MOCK_CANDIDATES)

  const filteredCandidates = candidates
    .filter((c) => {
      if (c.ivRank < minIvRank[0]) return false
      if (showOnly === "sell" && c.recommendation !== "sell-premium") return false
      if (showOnly === "buy" && c.recommendation !== "buy-premium") return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === "ivRank") return b.ivRank - a.ivRank
      if (sortBy === "ivPercentile") return b.ivPercentile - a.ivPercentile
      return b.hvRatio - a.hvRatio
    })

  const handleRefresh = () => {
    setIsLoading(true)
    setTimeout(() => setIsLoading(false), 1500)
  }

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case "sell-premium":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <TrendingDown className="w-3 h-3 mr-1" />
            Sell Premium
          </Badge>
        )
      case "buy-premium":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            <TrendingUp className="w-3 h-3 mr-1" />
            Buy Premium
          </Badge>
        )
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-300">
            <Activity className="w-3 h-3 mr-1" />
            Neutral
          </Badge>
        )
    }
  }

  const getIVRankColor = (rank: number) => {
    if (rank >= 80) return "text-red-600 bg-red-50"
    if (rank >= 50) return "text-orange-600 bg-orange-50"
    if (rank >= 30) return "text-yellow-600 bg-yellow-50"
    return "text-green-600 bg-green-50"
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-red-600 to-orange-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-6 h-6" />
                <h1 className="text-2xl font-bold">High IV Rank Watchlist</h1>
              </div>
              <p className="text-red-100">Track elevated implied volatility for premium selling opportunities</p>
            </div>
            <Button onClick={handleRefresh} variant="secondary" disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-red-700 font-medium">Extreme IV (80%+)</p>
              <p className="text-2xl font-bold text-red-800">{candidates.filter((c) => c.ivRank >= 80).length}</p>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-orange-700 font-medium">Elevated IV (50-80%)</p>
              <p className="text-2xl font-bold text-orange-800">
                {candidates.filter((c) => c.ivRank >= 50 && c.ivRank < 80).length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-green-700 font-medium">Low IV (&lt;30%)</p>
              <p className="text-2xl font-bold text-green-800">{candidates.filter((c) => c.ivRank < 30).length}</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-blue-700 font-medium">Upcoming Catalysts</p>
              <p className="text-2xl font-bold text-blue-800">{candidates.filter((c) => c.catalyst).length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5 text-red-600" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Min IV Rank: {minIvRank[0]}%</label>
                <Slider value={minIvRank} onValueChange={setMinIvRank} min={0} max={90} step={5} className="mt-3" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Sort By</label>
                <Select value={sortBy} onValueChange={(v: "ivRank" | "ivPercentile" | "hvRatio") => setSortBy(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ivRank">IV Rank</SelectItem>
                    <SelectItem value="ivPercentile">IV Percentile</SelectItem>
                    <SelectItem value="hvRatio">IV/HV Ratio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Show Only</label>
                <Select value={showOnly} onValueChange={(v: "all" | "sell" | "buy") => setShowOnly(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stocks</SelectItem>
                    <SelectItem value="sell">Sell Premium Candidates</SelectItem>
                    <SelectItem value="buy">Buy Premium Candidates</SelectItem>
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
                <CardTitle>IV Watchlist</CardTitle>
                <CardDescription>{filteredCandidates.length} stocks with notable IV levels</CardDescription>
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
                    <th className="pb-3 font-medium">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          IV RANK <Info className="w-3 h-3" />
                        </TooltipTrigger>
                        <TooltipContent>Current IV vs 52-week range</TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="pb-3 font-medium">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          IV %ILE <Info className="w-3 h-3" />
                        </TooltipTrigger>
                        <TooltipContent>% of days IV was lower</TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="pb-3 font-medium">CURRENT IV</th>
                    <th className="pb-3 font-medium">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          IV/HV <Info className="w-3 h-3" />
                        </TooltipTrigger>
                        <TooltipContent>Implied vs Historical Volatility</TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="pb-3 font-medium">CATALYST</th>
                    <th className="pb-3 font-medium">ACTION</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((candidate, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-4">
                        <div>
                          <span className="font-semibold text-red-600">{candidate.ticker}</span>
                          <p className="text-xs text-muted-foreground">{candidate.company}</p>
                        </div>
                      </td>
                      <td className="py-4 font-mono">${candidate.price.toFixed(2)}</td>
                      <td className="py-4">
                        <Badge className={`font-bold ${getIVRankColor(candidate.ivRank)}`}>{candidate.ivRank}%</Badge>
                      </td>
                      <td className="py-4">
                        <Badge variant="outline">{candidate.ivPercentile}%</Badge>
                      </td>
                      <td className="py-4 font-mono">{candidate.currentIV}%</td>
                      <td className="py-4">
                        <span
                          className={`font-semibold ${candidate.hvRatio >= 1.2 ? "text-red-600" : candidate.hvRatio <= 0.9 ? "text-green-600" : "text-muted-foreground"}`}
                        >
                          {candidate.hvRatio.toFixed(2)}x
                        </span>
                      </td>
                      <td className="py-4">
                        {candidate.catalyst ? (
                          <div>
                            <span className="text-sm font-medium">{candidate.catalyst}</span>
                            {candidate.daysToEvent && (
                              <p className="text-xs text-muted-foreground">{candidate.daysToEvent} days</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">None</span>
                        )}
                      </td>
                      <td className="py-4">{getRecommendationBadge(candidate.recommendation)}</td>
                      <td className="py-4">
                        <Button size="sm" variant="outline" className="gap-1 bg-transparent">
                          Analyze <ArrowUpRight className="w-3 h-3" />
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
            <CardTitle className="text-lg flex items-center gap-2 text-red-700">
              <Zap className="w-5 h-5" />
              AI Insights: IV Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="iv-basics">
                <AccordionTrigger className="font-semibold">Understanding IV Rank vs IV Percentile</AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>
                    <strong>IV Rank</strong> tells you where current IV sits within the 52-week high/low range.{" "}
                    <strong>IV Percentile</strong> tells you what percentage of days had lower IV.
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                    <p className="font-medium text-red-800">Key Insight:</p>
                    <p className="text-sm text-red-700 mt-1">
                      IV Percentile is often more reliable because IV Rank can be skewed by a single extreme day. Use
                      both together for confirmation.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="selling-strategies">
                <AccordionTrigger className="font-semibold">High IV Selling Strategies</AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>When IV Rank is above 50%, selling premium has a statistical edge as IV typically mean-reverts.</p>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-2">
                    <p className="font-medium text-orange-800">Best Strategies:</p>
                    <ul className="text-sm text-orange-700 list-disc list-inside mt-1">
                      <li>
                        <strong>Iron Condors:</strong> Neutral outlook, range-bound expected
                      </li>
                      <li>
                        <strong>Short Strangles:</strong> Higher risk, higher reward (naked)
                      </li>
                      <li>
                        <strong>Credit Spreads:</strong> Directional bias with defined risk
                      </li>
                      <li>
                        <strong>Cash-Secured Puts:</strong> Bullish, willing to own stock
                      </li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="low-iv">
                <AccordionTrigger className="font-semibold">Low IV Buying Opportunities</AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>When IV Rank is below 30%, options are cheap relative to history - consider buying strategies.</p>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                    <p className="font-medium text-green-800">Best Strategies:</p>
                    <ul className="text-sm text-green-700 list-disc list-inside mt-1">
                      <li>
                        <strong>Long Straddles:</strong> Expecting big move, unsure of direction
                      </li>
                      <li>
                        <strong>Calendar Spreads:</strong> Buy far-dated, sell near-dated
                      </li>
                      <li>
                        <strong>Protective Puts:</strong> Cheap portfolio insurance
                      </li>
                      <li>
                        <strong>LEAPS:</strong> Long-term bullish positions at discount
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

export default HighIVWatchlist
