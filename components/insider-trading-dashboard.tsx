"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { RunScenarioInAIDialog } from "@/components/run-scenario-ai-dialog"
import {
  RefreshCw,
  TrendingUp,
  Building2,
  Landmark,
  ArrowRight,
  AlertTriangle,
  Lightbulb,
  Target,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

// Fallback sample data
const fallbackTrades = [
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

const fallbackVolumeData = [
  { ticker: "AAPL", buys: 2.5, sells: 10.0 },
  { ticker: "NVDA", buys: 1.8, sells: 7.0 },
  { ticker: "MSFT", buys: 4.2, sells: 2.1 },
  { ticker: "XOM", buys: 3.5, sells: 0.8 },
  { ticker: "TSLA", buys: 0.9, sells: 5.2 },
]

interface Trade {
  date: string
  type: string
  owner: string
  role: string
  category: string
  ticker: string
  shares: string
  price: string
  value: string
  notes: string
}

type SortField = "date" | "type" | "owner" | "ticker" | "shares" | "price" | "value" | "notes"
type SortDirection = "asc" | "desc" | null

export { InsiderTradingDashboard }

export default function InsiderTradingDashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [trades, setTrades] = useState<Trade[]>(fallbackTrades)
  const [volumeData, setVolumeData] = useState(fallbackVolumeData)
  const [dataSource, setDataSource] = useState<string>("mock")
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  const fetchData = async () => {
    try {
      const response = await fetch("/api/insider-trading")
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.transactions?.length > 0) {
          setTrades(data.transactions)
          if (data.volumeData?.length > 0) {
            setVolumeData(data.volumeData)
          }
          setDataSource(data.source || "api")
          setLastUpdated(data.lastUpdated)
        }
      }
    } catch (error) {
      console.error("[v0] Failed to fetch insider data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchData()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else if (sortDirection === "desc") {
        setSortField(null)
        setSortDirection(null)
      } else {
        setSortDirection("asc")
      }
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="h-3 w-3 ml-1 text-[#0D9488]" />
    }
    return <ArrowDown className="h-3 w-3 ml-1 text-[#0D9488]" />
  }

  const sortedTrades = useMemo(() => {
    const tradesCopy = [...trades]

    if (!sortField || !sortDirection) return tradesCopy

    return tradesCopy.sort((a, b) => {
      let aVal: string | number = a[sortField as keyof Trade] || ""
      let bVal: string | number = b[sortField as keyof Trade] || ""

      // Handle numeric sorting for value column
      if (sortField === "value") {
        const parseValue = (v: string) => {
          const num = Number.parseFloat(v.replace(/[$KM,]/g, ""))
          if (v.includes("M")) return num * 1000000
          if (v.includes("K")) return num * 1000
          return num
        }
        aVal = parseValue(aVal as string)
        bVal = parseValue(bVal as string)
      }

      if (sortDirection === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      }
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
    })
  }, [trades, sortField, sortDirection])

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "Buy":
        return <Badge className="bg-green-500 hover:bg-green-600 text-white">Buy</Badge>
      case "Sell":
        return <Badge className="bg-red-500 hover:bg-red-600 text-white">Sell</Badge>
      case "Disclosure":
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Disclosure</Badge>
      default:
        return <Badge variant="secondary">{type || "N/A"}</Badge>
    }
  }

  const getCategoryIcon = (category: string) => {
    return category === "corporate" ? (
      <Building2 className="h-4 w-4 text-gray-500" />
    ) : (
      <Landmark className="h-4 w-4 text-blue-600" />
    )
  }

  const formatLastUpdated = () => {
    if (!lastUpdated) return "Nov 27, 2025"
    try {
      return new Date(lastUpdated).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    } catch {
      return "Nov 27, 2025"
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1E3A8A]">Insider & Congressional Trading Tracker</h1>
          <p className="text-[#0D9488] mt-1">
            Latest Disclosures (Updated: {formatLastUpdated()})
            {dataSource === "finnhub" && (
              <Badge variant="outline" className="ml-2 text-xs">
                Live Data
              </Badge>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="bg-[#0D9488] hover:bg-[#0B7A6E] text-white"
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Row 1: Weekly Volume Chart */}
      <Card className="bg-white shadow-md border-0">
        <CardHeader>
          <CardTitle className="text-[#1E3A8A] flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Weekly Buy vs. Sell Volume ($M)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="ticker" tick={{ fill: "#6B7280", fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `$${v}M`} tick={{ fill: "#6B7280", fontSize: 12 }} width={60} />
                <Tooltip
                  formatter={(value: number) => [`$${value.toFixed(1)}M`, ""]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #E5E7EB" }}
                />
                <Legend />
                <Bar dataKey="buys" name="Buys" fill="#22C55E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sells" name="Sells" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* AI Insight Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold text-amber-800">Net selling in tech signals caution</span>
          <span className="text-amber-700">—watch for IV lift on AAPL, NVDA options.</span>
        </div>
      </div>

      {/* Row 2: Trades Table */}
      <Card className="bg-white shadow-md border-0">
        <CardHeader>
          <CardTitle className="text-[#1E3A8A]">Recent Insider Transactions</CardTitle>
          <CardDescription>
            Showing all {sortedTrades.length} trades from the past week (click column headers to sort)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#0D9488]" />
              <span className="ml-3 text-gray-500">Loading insider transactions...</span>
            </div>
          ) : sortedTrades.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th
                      className="text-left py-3 px-2 text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-50 select-none min-w-[80px]"
                      onClick={() => handleSort("date")}
                    >
                      <div className="flex items-center">Date {getSortIcon("date")}</div>
                    </th>
                    <th
                      className="text-left py-3 px-2 text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-50 select-none min-w-[80px]"
                      onClick={() => handleSort("type")}
                    >
                      <div className="flex items-center">Type {getSortIcon("type")}</div>
                    </th>
                    <th
                      className="text-left py-3 px-2 text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-50 select-none"
                      onClick={() => handleSort("owner")}
                    >
                      <div className="flex items-center">Owner {getSortIcon("owner")}</div>
                    </th>
                    <th
                      className="text-left py-3 px-2 text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-50 select-none"
                      onClick={() => handleSort("ticker")}
                    >
                      <div className="flex items-center">Ticker {getSortIcon("ticker")}</div>
                    </th>
                    <th
                      className="text-left py-3 px-2 text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-50 select-none"
                      onClick={() => handleSort("shares")}
                    >
                      <div className="flex items-center">Shares/Amount {getSortIcon("shares")}</div>
                    </th>
                    <th
                      className="text-left py-3 px-2 text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-50 select-none"
                      onClick={() => handleSort("price")}
                    >
                      <div className="flex items-center">Price {getSortIcon("price")}</div>
                    </th>
                    <th
                      className="text-left py-3 px-2 text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-50 select-none"
                      onClick={() => handleSort("value")}
                    >
                      <div className="flex items-center">Value {getSortIcon("value")}</div>
                    </th>
                    <th
                      className="text-left py-3 px-2 text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-50 select-none"
                      onClick={() => handleSort("notes")}
                    >
                      <div className="flex items-center">Notes {getSortIcon("notes")}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTrades.map((trade, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors">
                      <td className="py-3 px-2 text-sm text-gray-700 font-medium whitespace-nowrap">
                        {trade.date || "N/A"}
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">{getTypeBadge(trade.type)}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(trade.category)}
                          <div>
                            <span className="font-semibold text-[#1E3A8A]">{trade.owner}</span>
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
            <div className="text-center py-8 text-gray-500">No trades to display</div>
          )}
        </CardContent>
      </Card>

      {/* Row 3: AI Insights */}
      <Card className="bg-white shadow-md border-0">
        <CardHeader>
          <CardTitle className="text-[#0D9488] flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            AI Insights: Insider Activity Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="tech-selling">
              <AccordionTrigger>Tech Sector Selling Pressure</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Heavy insider selling in AAPL, NVDA, and META signals potential profit-taking at current valuations.
                    CEO-level sales often precede periods of consolidation.
                  </p>
                  <div className="bg-amber-50 rounded-lg p-4">
                    <h4 className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      What to Watch:
                    </h4>
                    <ul className="list-disc list-inside text-amber-700 space-y-1">
                      <li>Elevated put/call ratios on tech names</li>
                      <li>IV expansion in AAPL and NVDA options</li>
                      <li>Support levels at 50-day moving averages</li>
                    </ul>
                  </div>
                  <div className="bg-teal-50 rounded-lg p-4">
                    <h4 className="font-semibold text-teal-800 flex items-center gap-2 mb-2">
                      <Lightbulb className="h-4 w-4" />
                      Trading Strategy:
                    </h4>
                    <ul className="list-disc list-inside text-teal-700 space-y-1">
                      <li>Consider put spreads on AAPL 30-45 DTE</li>
                      <li>Iron condors on NVDA if IV rank {">"} 50</li>
                      <li>Wait for confirmation before directional plays</li>
                    </ul>
                  </div>
                  <RunScenarioInAIDialog
                    context={{
                      type: "insider",
                      title: "Tech Sector Selling Pressure",
                      details:
                        "Heavy insider selling in AAPL, NVDA, and META signals potential profit-taking. CEO-level sales often precede consolidation periods.",
                      additionalContext: {
                        tickers: ["AAPL", "NVDA", "META"],
                        sentiment: "bearish",
                        strategy: "put spreads, iron condors",
                      },
                    }}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="congressional-energy">
              <AccordionTrigger>Congressional Energy & Defense Bets</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Multiple congressional members adding to XOM and LMT positions suggests potential policy tailwinds
                    for energy and defense sectors.
                  </p>
                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4" />
                      Bullish Signals:
                    </h4>
                    <ul className="list-disc list-inside text-green-700 space-y-1">
                      <li>Bipartisan buying in defense names</li>
                      <li>Energy sector accumulation ahead of winter</li>
                      <li>Infrastructure spending implications</li>
                    </ul>
                  </div>
                  <div className="bg-teal-50 rounded-lg p-4">
                    <h4 className="font-semibold text-teal-800 flex items-center gap-2 mb-2">
                      <Lightbulb className="h-4 w-4" />
                      Trading Strategy:
                    </h4>
                    <ul className="list-disc list-inside text-teal-700 space-y-1">
                      <li>Bull call spreads on XOM with 60 DTE</li>
                      <li>Cash-secured puts on LMT at support</li>
                      <li>Consider XLE ETF calls for sector exposure</li>
                    </ul>
                  </div>
                  <RunScenarioInAIDialog
                    context={{
                      type: "insider",
                      title: "Congressional Energy & Defense Bets",
                      details:
                        "Multiple congressional members adding to XOM and LMT positions suggests potential policy tailwinds for energy and defense sectors.",
                      additionalContext: {
                        tickers: ["XOM", "LMT", "XLE"],
                        sentiment: "bullish",
                        strategy: "bull call spreads, cash-secured puts",
                      },
                    }}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="crypto-disclosure">
              <AccordionTrigger>Crypto Holdings Disclosure</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Senator Lummis's BTC disclosure highlights growing institutional and political acceptance of
                    cryptocurrency as an asset class.
                  </p>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h4 className="font-semibold text-purple-800 flex items-center gap-2 mb-2">
                      <ArrowRight className="h-4 w-4" />
                      Implications:
                    </h4>
                    <ul className="list-disc list-inside text-purple-700 space-y-1">
                      <li>Regulatory clarity may be forthcoming</li>
                      <li>Crypto-related equities may benefit</li>
                      <li>Watch for policy announcements</li>
                    </ul>
                  </div>
                  <RunScenarioInAIDialog
                    context={{
                      type: "insider",
                      title: "Crypto Holdings Disclosure",
                      details:
                        "Senator Lummis's BTC disclosure highlights growing institutional and political acceptance of cryptocurrency.",
                      additionalContext: {
                        tickers: ["BTC", "COIN", "MSTR"],
                        sentiment: "neutral-bullish",
                        strategy: "crypto-related equities options",
                      },
                    }}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}
