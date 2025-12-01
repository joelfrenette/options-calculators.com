"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { RunScenarioInAIDialog } from "@/components/run-scenario-ai-dialog"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  TrendingUp,
  Building2,
  Landmark,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Lightbulb,
  Target,
  ArrowRight,
  Info,
} from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

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

type SortField = "date" | "owner" | "ticker" | "shares" | "price" | "value" | "notes"
type SortDirection = "asc" | "desc" | null

const InsiderTradingDashboard = () => {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [trades, setTrades] = useState<Trade[]>(fallbackTrades)
  const [dataSource, setDataSource] = useState<string>("mock")
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)
  const [data, setData] = useState<any | null>(null)

  const fetchData = async () => {
    try {
      const response = await fetch("/api/insider-trading")
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.transactions?.length > 0) {
          setTrades(data.transactions)
          setDataSource(data.source || "live")
          setLastUpdated(new Date().toLocaleString())
          setData(data)
        }
      }
    } catch (error) {
      console.error("Error fetching insider trading data:", error)
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
      return <ChevronUp className="h-3 w-3 ml-1 text-[#0D9488]" />
    }
    return <ChevronDown className="h-3 w-3 ml-1 text-[#0D9488]" />
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

  const InfoTooltip = ({ content }: { content: string }) => {
    if (!tooltipsEnabled) return null
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-sm bg-white border shadow-lg p-3">
          <p className="text-sm text-gray-700">{content}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#1E3A8A] flex items-center gap-2">
              Insider & Congressional Trading Tracker
              <InfoTooltip content="Insider trading data shows when company executives and board members buy or sell their own stock. Large insider buys often signal confidence in the company's future - bullish signal. Large insider sells may indicate concerns - potentially bearish. Congressional trades are disclosed with delays but can reveal policy-driven investment themes." />
            </h2>
            <p className="text-sm text-muted-foreground">
              Latest Disclosures (Updated:{" "}
              {lastUpdated ||
                new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              )
            </p>
          </div>
          <div className="flex items-center gap-3">
            <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
            <RefreshButton onClick={handleRefresh} isLoading={isRefreshing} loadingText="Refreshing..." />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Net selling in tech signals caution</span>
              <span className="text-amber-700"> — watch for IV lift on AAPL, NVDA options.</span>
            </p>
          </div>
          <RunScenarioInAIDialog
            context={{
              type: "insider",
              title: "Tech Insider Selling Alert",
              details: "Net selling in tech sector signals caution. Watch for IV lift on AAPL, NVDA options.",
            }}
            buttonVariant="outline"
            buttonClassName="border-amber-400 text-amber-700 hover:bg-amber-100 whitespace-nowrap"
          />
        </div>

        {/* Recent Insider Transactions Table */}
        <Card className="bg-white shadow-md border-0">
          <CardHeader>
            <CardTitle className="text-[#1E3A8A] flex items-center gap-2">
              Recent Insider Transactions
              <InfoTooltip content="This table shows recent SEC Form 4 filings from corporate insiders and congressional trade disclosures. Look for clusters of buying activity as a bullish signal. High-value purchases by CEOs and CFOs are particularly significant." />
            </CardTitle>
            <CardDescription>
              Showing all {sortedTrades.length} trades from the past week (click column headers to sort)
            </CardDescription>
            {data?.dataSources && (
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2 pt-2 border-t">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${data.dataSources.corporate?.isLive ? "bg-green-500" : "bg-yellow-500"}`}
                  />
                  <span className="font-medium">Corporate:</span>{" "}
                  {data.dataSources.corporate?.isLive ? "Live SEC Form 4 data via Finnhub" : "Sample data"} (
                  {data.dataSources.corporate?.count || 0} trades)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="font-medium">Congressional:</span> Public STOCK Act disclosures (
                  {data.dataSources.congressional?.count || 0} trades)
                  <InfoTooltip content="Congressional trades are disclosed with up to 45-day delay per STOCK Act. Value ranges (not exact amounts) are reported. Prices shown are approximate market prices at disclosure." />
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingSpinner message="Loading insider transactions..." />
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
                        <div className="flex items-center">
                          Shares/Amount {getSortIcon("shares")}
                          <InfoTooltip content="Positive numbers indicate purchases (bullish). Negative numbers indicate sales. Look for transactions over 10,000 shares or $500K+ as significant moves." />
                        </div>
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
                        <div className="flex items-center">
                          Value {getSortIcon("value")}
                          <InfoTooltip content="Total transaction value. Trades over $1M from C-suite executives are most significant. Congressional trades over $50K may indicate awareness of upcoming policy changes." />
                        </div>
                      </th>
                      <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTrades.map((trade, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2 text-sm text-gray-900">
                          <div className="flex items-center gap-1">
                            <span>{formatDateDisplay(trade.date)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(trade.category)}
                            <div>
                              <div className="text-sm font-medium text-gray-900">{trade.owner}</div>
                              <div className="text-xs text-gray-500">{trade.role}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-sm font-bold text-teal-600">{trade.ticker}</span>
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-900">
                          <span className={trade.shares.startsWith("-") ? "text-red-600" : "text-green-600"}>
                            {trade.shares}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-900">{trade.price}</td>
                        <td className="py-3 px-2 text-sm font-medium text-gray-900">{trade.value}</td>
                        <td className="py-3 px-2 text-sm text-gray-500">{trade.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No recent insider transactions found.</p>
            )}
          </CardContent>
        </Card>

        {/* AI Insights Section */}
        <Card className="bg-white shadow-md border-0">
          <CardHeader>
            <CardTitle className="text-[#0D9488] flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              AI Insights: Insider Activity & Options Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" defaultValue={["tech-selling", "congress", "strategy"]} className="w-full">
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
                    <ul className="text-blue-700 text-sm space-y-1">
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
    </TooltipProvider>
  )
}

export { InsiderTradingDashboard }
export default InsiderTradingDashboard
