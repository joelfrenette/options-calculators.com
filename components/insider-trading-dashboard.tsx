"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group"
import { RunScenarioInAIDialog } from "@/components/run-scenario-ai-dialog"
import { RefreshButton } from "@/components/ui/refresh-button"
import { ExportMenu } from "@/components/export-menu"
import { buildInsiderTradesReport } from "@/lib/reports/from-copy-pages"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Landmark,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Target,
  Info,
  Search,
  X,
  Sparkles,
  Zap,
  Minus,
} from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { DataLoadGate } from "@/components/data-load-gate"
import { yahooChartUrl } from "@/lib/ticker-links"

// P6-13. This file was 859 lines. The value/date parsing and row shapes, the
// transactions table and the AI analysis block are now in `components/insider/`,
// unchanged.
import {
  BIG_MOVE_THRESHOLD,
  type AiSignal,
  type SortDirection,
  type SortField,
  type Trade,
  formatDateDisplay,
  parseValueToUsd,
} from "@/components/insider/trade-parsing"
import { TransactionsTable } from "@/components/insider/transactions-table"
import { AiAnalysisSection } from "@/components/insider/ai-analysis-section"

const InsiderTradingDashboard = () => {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [trades, setTrades] = useState<Trade[]>([])
  const [dataSource, setDataSource] = useState<string>("live")
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)
  const [data, setData] = useState<any | null>(null)
  // The route can now fail honestly (503 when every source is empty, 502 on
  // error) instead of returning invented filings at 200. That only helps if the
  // page says so — a failed refresh that silently leaves the previous table on
  // screen reads exactly like a successful one.
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Smart filter state
  const [tickerFilter, setTickerFilter] = useState("")
  const [bigMovesOnly, setBigMovesOnly] = useState(false)
  const [daysBack, setDaysBack] = useState(30)
  // Source category toggles
  const [showCorporate, setShowCorporate] = useState(true)
  const [showCongressional, setShowCongressional] = useState(true)

  // AI Smart Analysis state
  const [aiSummary, setAiSummary] = useState<string>("")
  const [aiSignals, setAiSignals] = useState<AiSignal[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiProvider, setAiProvider] = useState<string>("")

  const fetchData = async (overrideTicker?: string) => {
    setIsLoading(true)
    try {
      const activeTicker = overrideTicker !== undefined ? overrideTicker : tickerFilter.trim().toUpperCase()
      const params = new URLSearchParams({ days: String(daysBack) })
      if (activeTicker) params.set("ticker", activeTicker)
      const response = await fetch(`/api/insider-trading?${params.toString()}`)
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        // Clear the table. Leaving the last good result up under a new filter
        // would attribute those filings to a window they did not come from.
        setFetchError(json?.message || json?.error || `The insider-trading feed returned ${response.status}.`)
        setTrades([])
        setData(null)
        setLastUpdated(null)
        return
      }
      setFetchError(null)
      setTrades(json.transactions ?? [])
      setDataSource(json.source || "live")
      setLastUpdated(new Date().toLocaleString())
      setData(json)
    } catch (error) {
      console.error("Error fetching insider trading data:", error)
      setFetchError("Could not reach the insider-trading feed.")
      setTrades([])
      setData(null)
      setLastUpdated(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (loaded) fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysBack, loaded])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchData()
    setIsRefreshing(false)
  }

  // The live client-side filter (filteredTrades) already matches BOTH ticker and
  // owner name as the user types. The Search button / Enter additionally runs a
  // deeper per-symbol server lookup — but only when the query actually looks like
  // a ticker (short, alphabetic). For name searches we skip the server round-trip
  // and rely on instant client-side filtering so names always resolve.
  const looksLikeTicker = (q: string) => /^[A-Za-z]{1,5}(\.[A-Za-z])?$/.test(q.trim())

  const handleTickerSearch = () => {
    const q = tickerFilter.trim()
    if (looksLikeTicker(q)) {
      fetchData(q.toUpperCase()) // deep per-ticker scan
    }
    // For names (or empty), the client-side filter handles it instantly — no refetch
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
    // Default sort: most recent first using _date (ISO) so "Jun 3" strings don't break order
    const defaultSorted = [...trades].sort((a, b) => {
      const aMs = a._date ? new Date(a._date).getTime() : 0
      const bMs = b._date ? new Date(b._date).getTime() : 0
      return bMs - aMs
    })

    if (!sortField || !sortDirection) return defaultSorted

    return defaultSorted.sort((a, b) => {
      let aVal: string | number = a[sortField as keyof Trade] ?? ""
      let bVal: string | number = b[sortField as keyof Trade] ?? ""

      // Date sort: use _date ISO for reliability
      if (sortField === "date") {
        aVal = a._date ? new Date(a._date).getTime() : 0
        bVal = b._date ? new Date(b._date).getTime() : 0
      }

      // Value sort: use shared parser that handles ranges and K/M/B suffixes
      if (sortField === "value") {
        aVal = parseValueToUsd(aVal as string)
        bVal = parseValueToUsd(bVal as string)
      }

      if (sortDirection === "asc") return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
    })
  }, [trades, sortField, sortDirection])

  // Apply the smart filter (ticker search + source toggles + big-moves-only) on top of sorting
  const filteredTrades = useMemo(() => {
    const query = tickerFilter.trim().toUpperCase()
    return sortedTrades.filter((trade) => {
      // Source category filter
      if (trade.category === "corporate" && !showCorporate) return false
      if (trade.category === "congressional" && !showCongressional) return false

      // Ticker / name search (client-side; server also runs a per-ticker lookup)
      const matchesTicker =
        !query ||
        (trade.ticker || "").toUpperCase().includes(query) ||
        (trade.owner || "").toUpperCase().includes(query)

      // Big moves toggle: when on, only show trades >= $500K (midpoint for ranges)
      const usdValue = parseValueToUsd(trade.value)
      const matchesBigMove = !bigMovesOnly || usdValue >= BIG_MOVE_THRESHOLD

      return matchesTicker && matchesBigMove
    })
  }, [sortedTrades, tickerFilter, bigMovesOnly, showCorporate, showCongressional])

  // Quick-access list of the tickers present in the data
  const availableTickers = useMemo(() => {
    const set = new Set<string>()
    for (const t of trades) {
      const tk = (t.ticker || "").toUpperCase()
      if (tk && tk !== "—" && tk !== "N/A") set.add(tk)
    }
    return Array.from(set).sort()
  }, [trades])

  const generateAiAnalysis = async () => {
    setAiLoading(true)
    setAiError(null)
    try {
      const response = await fetch("/api/insider-trading/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trades }),
      })
      const result = await response.json()
      if (result.success) {
        setAiSummary(result.summary || "")
        setAiSignals(Array.isArray(result.signals) ? result.signals : [])
        setAiProvider(result.provider || "")
      } else {
        setAiError(result.error || "Failed to generate analysis")
      }
    } catch (error) {
      console.error("Error generating AI analysis:", error)
      setAiError("Unable to reach the AI analysis service")
    } finally {
      setAiLoading(false)
    }
  }

  const buyClasses =
    "inline-flex items-center rounded-md border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700"
  const sellClasses =
    "inline-flex items-center rounded-md border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
  const disclosureClasses =
    "inline-flex items-center rounded-md border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700"
  const neutralClasses =
    "inline-flex items-center rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600"

  const getTypeBadge = (type: string, shares?: string) => {
    const normalizedType = (type || "").toLowerCase()
    if (normalizedType === "buy" || normalizedType.includes("buy") || normalizedType === "p") {
      return <span className={buyClasses}>Buy</span>
    }
    if (normalizedType === "sell" || normalizedType.includes("sell") || normalizedType === "s") {
      return <span className={sellClasses}>Sell</span>
    }
    if (normalizedType === "disclosure" || normalizedType.includes("disclos")) {
      return <span className={disclosureClasses}>Disclosure</span>
    }
    // Fallback - infer Buy/Sell from the share amount sign (e.g. "+330,006" vs "-176,935")
    const sharesStr = (shares || "").trim()
    if (sharesStr.startsWith("-")) {
      return <span className={sellClasses}>Sell</span>
    }
    if (sharesStr.startsWith("+") || /\d/.test(sharesStr)) {
      return <span className={buyClasses}>Buy</span>
    }
    // Last resort - show whatever type we have or "N/A"
    return <span className={neutralClasses}>{type || "N/A"}</span>
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

  if (!loaded) {
    return (
      <DataLoadGate
        title="Load Insider & Congressional Trading Data?"
        description="Fetch the latest SEC Form 4 and Congressional STOCK Act disclosures. Nothing loads until you choose to."
        onConfirm={() => setLoaded(true)}
      />
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
            <ExportMenu payload={() => buildInsiderTradesReport(filteredTrades)} />
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

        <TransactionsTable
          data={data}
          sortedTrades={sortedTrades}
          filteredTrades={filteredTrades}
          isLoading={isLoading}
          fetchError={fetchError}
          fetchData={fetchData}
          tickerFilter={tickerFilter}
          setTickerFilter={setTickerFilter}
          handleTickerSearch={handleTickerSearch}
          daysBack={daysBack}
          setDaysBack={setDaysBack}
          bigMovesOnly={bigMovesOnly}
          setBigMovesOnly={setBigMovesOnly}
          showCorporate={showCorporate}
          setShowCorporate={setShowCorporate}
          showCongressional={showCongressional}
          setShowCongressional={setShowCongressional}
          handleSort={handleSort}
          getSortIcon={getSortIcon}
          getTypeBadge={getTypeBadge}
          getCategoryIcon={getCategoryIcon}
          InfoTooltip={InfoTooltip}
        />
        <AiAnalysisSection
          aiSignals={aiSignals}
          aiSummary={aiSummary}
          aiProvider={aiProvider}
          aiLoading={aiLoading}
          aiError={aiError}
          generateAiAnalysis={generateAiAnalysis}
          trades={trades}
          InfoTooltip={InfoTooltip}
        />
      </div>
    </TooltipProvider>
  )
}

export { InsiderTradingDashboard }
export default InsiderTradingDashboard
