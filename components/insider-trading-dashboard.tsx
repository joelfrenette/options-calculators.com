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

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "N/A"

  // If already in "MMM DD" format, return as-is
  if (/^[A-Z][a-z]{2}\s\d{1,2}$/.test(dateStr)) {
    return dateStr
  }

  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return dateStr
  }
}

// Fallback sample data with consistent date format
const fallbackTrades: Trade[] = [
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
    date: "Nov 23",
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
    date: "Nov 22",
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
    date: "Nov 21",
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
    date: "Nov 20",
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
    date: "Nov 19",
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
    date: "Nov 18",
    type: "Sell",
    owner: "Dabiri John",
    role: "Officer",
    category: "corporate",
    ticker: "NVDA",
    shares: "-17,792",
    price: "$179.42/share",
    value: "$3.2M",
    notes: "Open market sale",
  },
]

const fallbackVolumeData = [
  { ticker: "AAPL", buys: 0, sells: 22 },
  { ticker: "NVDA", buys: 0, sells: 10.2 },
  { ticker: "META", buys: 0, sells: 43.5 },
  { ticker: "MSFT", buys: 0.05, sells: 0 },
  { ticker: "LMT", buys: 0.18, sells: 0 },
]

type SortField = "date" | "type" | "owner" | "ticker" | "shares" | "price" | "value" | "notes"
type SortDirection = "asc" | "desc" | null

const InsiderTradingDashboard = () => {
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
    const normalizedType = (type || "").toLowerCase()
    if (normalizedType === "buy" || normalizedType.includes("buy") || normalizedType === "p") {
      return <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-0.5">Buy</Badge>
    }
    if (normalizedType === "sell" || normalizedType.includes("sell") || normalizedType === "s") {
      return <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-0.5">Sell</Badge>
    }
    if (normalizedType === "disclosure" || normalizedType.includes("disclos")) {
      return <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-2 py-0.5">Disclosure</Badge>
    }
    // Fallback - show whatever type we have or "N/A"
    return (
      <Badge variant="secondary" className="text-xs px-2 py-0.5">
        {type || "N/A"}
      </Badge>
    )
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
                  formatter={(value: number) => [`$${value.toFixed(2)}M`, ""]}
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
                      className="text-left py-3 px-2 text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-50 select-none min-w-[70px]"
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
                        {formatDateDisplay(trade.date)}
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
            AI Insights: Insider Activity & Options Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="tech-selling">
              <AccordionTrigger className="text-[#1E3A8A] hover:no-underline">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Tech Sector Insider Selling
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <p className="text-gray-600">
                  Multiple tech executives have executed significant sales this week. Tim Cook (AAPL), Jensen Huang
                  (NVDA), and Mark Zuckerberg (META) have all reduced holdings through 10b5-1 plans.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    What to Watch:
                  </h4>
                  <ul className="list-disc list-inside text-amber-700 space-y-1 text-sm">
                    <li>IV typically rises 5-10% following large insider sales</li>
                    <li>Consider put spreads if further weakness develops</li>
                    <li>Monitor support levels for potential bounces</li>
                  </ul>
                </div>
                <RunScenarioInAIDialog
                  context={{
                    type: "insider",
                    title: "Tech Sector Insider Selling",
                    details:
                      "Multiple tech executives selling: AAPL, NVDA, META all seeing insider sales through 10b5-1 plans",
                  }}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="congress">
              <AccordionTrigger className="text-[#1E3A8A] hover:no-underline">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-blue-600" />
                  Congressional Trading Activity
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <p className="text-gray-600">
                  Notable congressional trades include defense sector allocations and energy bets. Sen. Tuberville
                  increased LMT position while Rep. Gottheimer added XOM exposure.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4" />
                    Trading Ideas:
                  </h4>
                  <ul className="list-disc list-inside text-blue-700 space-y-1 text-sm">
                    <li>Defense sector may see continued interest</li>
                    <li>Energy plays suggest confidence in oil prices</li>
                    <li>Consider bull call spreads on LMT, XOM</li>
                  </ul>
                </div>
                <RunScenarioInAIDialog
                  context={{
                    type: "insider",
                    title: "Congressional Trading Activity",
                    details:
                      "Defense and energy buying from congress members: LMT and XOM accumulation signals sector confidence",
                  }}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="strategy">
              <AccordionTrigger className="text-[#1E3A8A] hover:no-underline">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-600" />
                  Recommended Options Strategies
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-semibold text-red-800 mb-2">Bearish Tech Plays</h4>
                    <ul className="text-red-700 text-sm space-y-1">
                      <li>
                        <ArrowRight className="h-3 w-3 inline mr-1" />
                        AAPL: Bear put spread $220/$210
                      </li>
                      <li>
                        <ArrowRight className="h-3 w-3 inline mr-1" />
                        NVDA: Long put $130 strike
                      </li>
                    </ul>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">Bullish Sector Plays</h4>
                    <ul className="text-green-700 text-sm space-y-1">
                      <li>
                        <ArrowRight className="h-3 w-3 inline mr-1" />
                        LMT: Bull call spread $520/$540
                      </li>
                      <li>
                        <ArrowRight className="h-3 w-3 inline mr-1" />
                        XOM: Cash-secured put $105
                      </li>
                    </ul>
                  </div>
                </div>
                <RunScenarioInAIDialog
                  context={{
                    type: "strategy",
                    title: "Insider-Driven Options Strategies",
                    details:
                      "Bearish tech (AAPL, NVDA put spreads) vs Bullish defense/energy (LMT, XOM call spreads) based on insider flows",
                  }}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}

export { InsiderTradingDashboard }

export default InsiderTradingDashboard
