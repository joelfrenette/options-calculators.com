"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Building2,
  Landmark,
  ArrowRight,
  AlertTriangle,
  Lightbulb,
  Target,
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

// Sample weekly buy vs sell volume data
const volumeData = [
  { ticker: "AAPL", buys: 2.5, sells: 10.0 },
  { ticker: "NVDA", buys: 1.8, sells: 7.0 },
  { ticker: "MSFT", buys: 4.2, sells: 2.1 },
  { ticker: "XOM", buys: 3.5, sells: 0.8 },
  { ticker: "TSLA", buys: 0.9, sells: 5.2 },
]

// Sample insider trades data
const insiderTrades = [
  {
    date: "Nov 25",
    type: "Sell",
    owner: "Cook Timothy D",
    role: "CEO",
    category: "corporate",
    ticker: "AAPL",
    shares: "-100,000",
    price: "$220/share",
    value: "$22M",
    notes: "Routine divestiture",
  },
  {
    date: "Nov 24",
    type: "Buy",
    owner: "Pelosi Nancy",
    role: "Senator",
    category: "congressional",
    ticker: "MSFT",
    shares: "+$50K",
    price: "N/A",
    value: "$50K",
    notes: "Spousal trade",
  },
  {
    date: "Nov 22",
    type: "Sell",
    owner: "Huang Jensen",
    role: "CEO",
    category: "corporate",
    ticker: "NVDA",
    shares: "-50,000",
    price: "$140/share",
    value: "$7M",
    notes: "10b5-1 plan",
  },
  {
    date: "Nov 21",
    type: "Buy",
    owner: "Rep. Josh Gottheimer",
    role: "House",
    category: "congressional",
    ticker: "XOM",
    shares: "+$15K-$50K",
    price: "N/A",
    value: "$15K-$50K",
    notes: "Energy bet",
  },
  {
    date: "Nov 20",
    type: "Sell",
    owner: "Zuckerberg Mark",
    role: "CEO",
    category: "corporate",
    ticker: "META",
    shares: "-75,000",
    price: "$580/share",
    value: "$43.5M",
    notes: "Scheduled sale",
  },
  {
    date: "Nov 19",
    type: "Buy",
    owner: "Sen. Tommy Tuberville",
    role: "Senator",
    category: "congressional",
    ticker: "LMT",
    shares: "+$100K-$250K",
    price: "N/A",
    value: "$100K-$250K",
    notes: "Defense allocation",
  },
  {
    date: "Nov 18",
    type: "Disclosure",
    owner: "Sen. Cynthia Lummis",
    role: "Senator",
    category: "congressional",
    ticker: "BTC",
    shares: "+5 BTC",
    price: "~$95K",
    value: "$475K",
    notes: "Crypto disclosure",
  },
  {
    date: "Nov 17",
    type: "Sell",
    owner: "Nadella Satya",
    role: "CEO",
    category: "corporate",
    ticker: "MSFT",
    shares: "-30,000",
    price: "$415/share",
    value: "$12.45M",
    notes: "Annual plan sale",
  },
]

export { InsiderTradingDashboard }

export default function InsiderTradingDashboard() {
  const [showCorporate, setShowCorporate] = useState(true)
  const [showCongressional, setShowCongressional] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 2000)
  }

  const filteredTrades = insiderTrades.filter((trade) => {
    if (showCorporate && showCongressional) return true
    if (showCorporate && trade.category === "corporate") return true
    if (showCongressional && trade.category === "congressional") return true
    return false
  })

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "Buy":
        return <Badge className="bg-green-500 hover:bg-green-600 text-white">Buy</Badge>
      case "Sell":
        return <Badge className="bg-red-500 hover:bg-red-600 text-white">Sell</Badge>
      case "Disclosure":
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Disclosure</Badge>
      default:
        return <Badge variant="secondary">{type}</Badge>
    }
  }

  const getCategoryIcon = (category: string) => {
    return category === "corporate" ? (
      <Building2 className="h-4 w-4 text-gray-500" />
    ) : (
      <Landmark className="h-4 w-4 text-blue-600" />
    )
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1E3A8A]">Insider & Congressional Trading Tracker</h1>
          <p className="text-[#0D9488] mt-1">Latest Disclosures (Updated: Nov 27, 2025)</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4 bg-white rounded-lg px-4 py-2 shadow-sm border">
            <div className="flex items-center gap-2">
              <Switch id="corporate" checked={showCorporate} onCheckedChange={setShowCorporate} />
              <Label htmlFor="corporate" className="text-sm font-medium cursor-pointer">
                <Building2 className="h-4 w-4 inline mr-1" />
                Corporate
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="congressional" checked={showCongressional} onCheckedChange={setShowCongressional} />
              <Label htmlFor="congressional" className="text-sm font-medium cursor-pointer">
                <Landmark className="h-4 w-4 inline mr-1" />
                Congress
              </Label>
            </div>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="bg-[#0D9488] hover:bg-[#0F766E] text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Row 1: Weekly Buy vs Sell Volume Chart */}
      <Card className="bg-white shadow-md border-0">
        <CardHeader>
          <CardTitle className="text-[#1E3A8A] flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#0D9488]" />
            Weekly Buy vs. Sell Volume ($M)
          </CardTitle>
          <CardDescription>Top 5 tickers by insider activity this week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="ticker" tick={{ fill: "#1E3A8A", fontWeight: 600 }} />
                <YAxis tick={{ fill: "#6b7280" }} tickFormatter={(value) => `$${value}M`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                  formatter={(value: number) => [`$${value}M`, ""]}
                />
                <Legend />
                <Bar dataKey="buys" name="Buys" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sells" name="Sells" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-gray-600 mt-4 bg-blue-50 p-3 rounded-lg">
            <AlertTriangle className="h-4 w-4 inline mr-1 text-amber-500" />
            <strong>Net selling in tech signals caution</strong>—watch for IV lift on AAPL, NVDA options.
          </p>
        </CardContent>
      </Card>

      {/* Row 2: Trades Table */}
      <Card className="bg-white shadow-md border-0">
        <CardHeader>
          <CardTitle className="text-[#1E3A8A]">Recent Insider Transactions</CardTitle>
          <CardDescription>Showing {filteredTrades.length} trades from the past week</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTrades.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Date</th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Type</th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Owner</th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Ticker</th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Shares/Amount</th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Price</th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Value</th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map((trade, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors">
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="bg-[#0D9488]/10 text-[#0D9488] border-[#0D9488]/30">
                          {trade.date}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">{getTypeBadge(trade.type)}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(trade.category)}
                          <div>
                            <a href="#" className="font-semibold text-[#1E3A8A] hover:underline">
                              {trade.owner}
                            </a>
                            <p className="text-xs text-gray-500">{trade.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="font-semibold text-[#0D9488]">{trade.ticker}</span>
                      </td>
                      <td className="py-3 px-2 font-medium">{trade.shares}</td>
                      <td className="py-3 px-2 text-gray-600">{trade.price}</td>
                      <td className="py-3 px-2 font-semibold">{trade.value}</td>
                      <td className="py-3 px-2 text-sm text-gray-500">{trade.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">Quiet week—check historical for trends.</p>
              <Button
                variant="outline"
                className="text-[#0D9488] border-[#0D9488] hover:bg-[#0D9488]/10 bg-transparent"
              >
                View Full Archive
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 3: AI Insights */}
      <div className="border-t-2 border-[#1E3A8A]/20 pt-6">
        <h2 className="text-xl font-bold text-[#1E3A8A] mb-4 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-[#0D9488]" />
          AI Insights: Market Signals & Options Trading Tips
          <span className="h-0.5 flex-1 bg-[#0D9488]/30 ml-4"></span>
        </h2>

        <Accordion type="single" collapsible defaultValue="item-1" className="space-y-3">
          <AccordionItem value="item-1" className="bg-white rounded-lg shadow-md border-0 overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-blue-50/50 [&[data-state=open]]:bg-blue-50/50">
              <div className="flex items-center gap-2 text-left">
                <TrendingDown className="h-5 w-5 text-red-500" />
                <span className="font-semibold text-[#1E3A8A]">AAPL Exec Sells: Bearish Tech Signal</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-gray-700">
                    Heavy selling by top execs ($22M) amid iPhone slowdown fears—could pressure Nasdaq, VIX +5% if
                    clusters grow. Tim Cook's sale follows Q4 guidance concerns.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E3A8A] mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#0D9488]" />
                    What to Watch
                  </h4>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
                    <li>Follow-on buys by institutions in next 5 days</li>
                    <li>Volume &gt;1M shares post-filing signals confirmation</li>
                    <li>Check if other FAANG execs follow with sales</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E3A8A] mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-[#0D9488]" />
                    Trading Decisions
                  </h4>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
                    <li>
                      <strong>Bear put spreads</strong> on AAPL (10-15 delta, 30 DTE for 2:1 R/R)
                    </li>
                    <li>
                      <strong>Widen iron condors</strong> on QQQ to capture IV crush
                    </li>
                    <li>
                      <strong>Wheel strategy:</strong> Roll covered calls down if assigned
                    </li>
                  </ul>
                </div>
                <Button className="bg-[#0D9488] hover:bg-[#0F766E] text-white">
                  Model Spread in Calculator
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2" className="bg-white rounded-lg shadow-md border-0 overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-blue-50/50 [&[data-state=open]]:bg-blue-50/50">
              <div className="flex items-center gap-2 text-left">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="font-semibold text-[#1E3A8A]">Congressional MSFT Buys: Policy Tailwind?</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-gray-700">
                    Bipartisan tech bets emerging—multiple congressional members adding MSFT positions ahead of AI
                    infrastructure bills. Watch upcoming committee hearings for policy signals.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E3A8A] mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#0D9488]" />
                    What to Watch
                  </h4>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
                    <li>AI infrastructure bill progress in Congress</li>
                    <li>Additional &gt;$100K cluster buys signal conviction</li>
                    <li>Azure contract announcements from government</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E3A8A] mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-[#0D9488]" />
                    Trading Decisions
                  </h4>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
                    <li>
                      <strong>Bull call spreads</strong> if cluster exceeds $100K total
                    </li>
                    <li>
                      <strong>Calendar spreads</strong> around bill vote dates
                    </li>
                    <li>
                      <strong>Sell cash-secured puts</strong> at support levels
                    </li>
                  </ul>
                </div>
                <Button className="bg-[#0D9488] hover:bg-[#0F766E] text-white">
                  Model Spread in Calculator
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3" className="bg-white rounded-lg shadow-md border-0 overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-blue-50/50 [&[data-state=open]]:bg-blue-50/50">
              <div className="flex items-center gap-2 text-left">
                <TrendingDown className="h-5 w-5 text-amber-500" />
                <span className="font-semibold text-[#1E3A8A]">NVDA CEO Dump: AI Hype Fade?</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-gray-700">
                    Jensen Huang's $7M sale under 10b5-1 plan—routine but timing near earnings raises questions. AI chip
                    demand narrative may be peaking; watch for margin compression signals.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E3A8A] mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#0D9488]" />
                    What to Watch
                  </h4>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
                    <li>Q4 earnings guidance on data center demand</li>
                    <li>Competition from AMD MI300X ramp</li>
                    <li>China export restriction updates</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E3A8A] mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-[#0D9488]" />
                    Trading Decisions
                  </h4>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
                    <li>
                      <strong>Sell credit spreads</strong> OTM to harvest elevated IV
                    </li>
                    <li>
                      <strong>Iron condors</strong> if expecting range-bound post-earnings
                    </li>
                    <li>
                      <strong>Avoid naked calls</strong>—AI momentum can surprise
                    </li>
                  </ul>
                </div>
                <Button className="bg-[#0D9488] hover:bg-[#0F766E] text-white">
                  Model Spread in Calculator
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4" className="bg-white rounded-lg shadow-md border-0 overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-blue-50/50 [&[data-state=open]]:bg-blue-50/50">
              <div className="flex items-center gap-2 text-left">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <span className="font-semibold text-[#1E3A8A]">Energy Disclosures: Sector Rotation?</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-gray-700">
                    Congressional buys in XOM and energy names suggest policy insiders see value. OPEC+ decisions and
                    winter demand could catalyze sector rotation from tech to energy.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E3A8A] mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#0D9488]" />
                    What to Watch
                  </h4>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
                    <li>OPEC+ December meeting decisions</li>
                    <li>Winter weather forecasts for natural gas</li>
                    <li>Additional congressional energy filings</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E3A8A] mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-[#0D9488]" />
                    Trading Decisions
                  </h4>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
                    <li>
                      <strong>Pause puts</strong> on XLE wheel strategy
                    </li>
                    <li>
                      <strong>Bull call spreads</strong> on XOM for OPEC catalyst
                    </li>
                    <li>
                      <strong>Diagonal spreads</strong> to play time decay + upside
                    </li>
                  </ul>
                </div>
                <Button className="bg-[#0D9488] hover:bg-[#0F766E] text-white">
                  Model Spread in Calculator
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Global Tip Card */}
        <Card className="mt-6 bg-blue-50 border-[#0D9488]/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="bg-[#0D9488] rounded-full p-2 shrink-0">
                <Lightbulb className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-gray-700">
                  <strong className="text-[#1E3A8A]">Pro Tip:</strong> Insider clusters predict 60% of significant
                  moves—use our{" "}
                  <a href="#" className="text-[#0D9488] font-semibold hover:underline">
                    Greeks calculator
                  </a>{" "}
                  to hedge delta exposure on net sell signals, and the{" "}
                  <a href="#" className="text-[#0D9488] font-semibold hover:underline">
                    ROI calculator
                  </a>{" "}
                  to model risk/reward before entering positions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
