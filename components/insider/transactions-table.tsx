"use client"

/**
 * The recent-transactions table, its filters and its column sorting.
 *
 * Split out of `components/insider-trading-dashboard.tsx` (P6-13) unchanged.
 * What it closed over is now props.
 */
import type React from "react"
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  ChevronDown,
  ChevronUp,
  Info,
  Landmark,
  Minus,
  Search,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { RefreshButton } from "@/components/ui/refresh-button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { yahooChartUrl } from "@/lib/ticker-links"
import { ResearchButton } from "@/components/research/research-button"
import { formatDateDisplay, type SortField, type Trade } from "./trade-parsing"

export function TransactionsTable({
  data,
  sortedTrades,
  filteredTrades,
  isLoading,
  fetchError,
  fetchData,
  tickerFilter,
  setTickerFilter,
  handleTickerSearch,
  daysBack,
  setDaysBack,
  bigMovesOnly,
  setBigMovesOnly,
  showCorporate,
  setShowCorporate,
  showCongressional,
  setShowCongressional,
  handleSort,
  getSortIcon,
  getTypeBadge,
  getCategoryIcon,
  InfoTooltip,
}: {
  data: any
  sortedTrades: Trade[]
  filteredTrades: Trade[]
  isLoading: boolean
  fetchError: string | null
  fetchData: (ticker?: string) => void
  tickerFilter: string
  setTickerFilter: (v: string) => void
  handleTickerSearch: () => void
  daysBack: number
  setDaysBack: (v: number) => void
  bigMovesOnly: boolean
  setBigMovesOnly: React.Dispatch<React.SetStateAction<boolean>>
  showCorporate: boolean
  setShowCorporate: React.Dispatch<React.SetStateAction<boolean>>
  showCongressional: boolean
  setShowCongressional: React.Dispatch<React.SetStateAction<boolean>>
  handleSort: (field: SortField) => void
  getSortIcon: (field: SortField) => React.ReactNode
  getTypeBadge: (type: string, shares?: string) => React.ReactNode
  getCategoryIcon: (c: string) => React.ReactNode
  InfoTooltip: React.ComponentType<{ content: string }>
}) {
  return (
    <>
        <Card className="bg-white shadow-md border-0">
          <CardHeader>
            <CardTitle className="text-[#1E3A8A] flex items-center gap-2">
              Recent Insider Transactions
              <InfoTooltip content="This table shows recent SEC Form 4 filings from corporate insiders and congressional trade disclosures. Look for clusters of buying activity as a bullish signal. High-value purchases by CEOs and CFOs are particularly significant." />
            </CardTitle>
            <CardDescription>
              Showing {filteredTrades.length} of {sortedTrades.length} trades
              {tickerFilter.trim() ? ` matching "${tickerFilter.trim().toUpperCase()}"` : ""}
              {bigMovesOnly ? " · $500K+ only" : ""}
              {!showCorporate ? " · corporate hidden" : ""}
              {!showCongressional ? " · congressional hidden" : ""}
              {" "}· last {daysBack === 180 ? "6 months" : daysBack === 365 ? "1 year" : `${daysBack} days`}
              {" "}— click column headers to sort
            </CardDescription>
            {fetchError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <strong>No filings retrieved.</strong> {fetchError} Nothing is shown below, because nothing was read —
                this page does not fall back to placeholder trades.
              </div>
            )}
            {data?.dataSources && (
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2 pt-2 border-t">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${data.dataSources.corporate?.isLive ? "bg-green-500" : "bg-yellow-500"}`}
                  />
                  <span className="font-medium">Corporate:</span>{" "}
                  {/* P7-6. `|| 0` rendered "(0 trades)" beside "Live SEC Form 4
                      data via Finnhub" when the feed reported live but sent no
                      count — a live source that returned nothing and a source
                      that never reported a count read identically. */}
                  {data.dataSources.corporate?.isLive ? "Live SEC Form 4 data via Finnhub" : "Data unavailable"} (
                  {typeof data.dataSources.corporate?.count === "number" ? data.dataSources.corporate.count : "—"}{" "}
                  trades)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="font-medium">Congressional:</span> Public STOCK Act disclosures (
                  {typeof data.dataSources.congressional?.count === "number"
                    ? data.dataSources.congressional.count
                    : "—"}{" "}
                  trades)
                  <InfoTooltip content="Congressional trades are disclosed with up to 45-day delay per STOCK Act. Value ranges (not exact amounts) are reported. Prices shown are approximate market prices at disclosure." />
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {/* Smart Filter */}
            <div className="mb-4 flex flex-col gap-3">

              {/* Row 1: Search + source toggles + big-moves — all in one line */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Ticker search */}
                <InputGroup className="w-56 shrink-0">
                  <InputGroupAddon>
                    <Search className="h-4 w-4 text-muted-foreground" />
                  </InputGroupAddon>
                  <InputGroupInput
                    placeholder="Ticker or name (e.g. NEE)"
                    value={tickerFilter}
                    onChange={(e) => setTickerFilter(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleTickerSearch()}
                    aria-label="Filter trades by ticker or owner name"
                  />
                  {tickerFilter && (
                    <InputGroupAddon align="inline-end">
                      <button
                        type="button"
                        onClick={() => { setTickerFilter(""); fetchData("") }}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Clear filter"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </InputGroupAddon>
                  )}
                </InputGroup>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleTickerSearch}
                  className="bg-[#1E3A8A] hover:bg-[#1a3478] text-white shrink-0"
                >
                  <Search className="h-4 w-4 mr-1.5" />
                  Search
                </Button>

                <div className="w-px h-5 bg-gray-200 mx-1 shrink-0" aria-hidden="true" />

                {/* Source toggles */}
                <button
                  type="button"
                  onClick={() => setShowCorporate((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors shrink-0 ${
                    showCorporate
                      ? "border-gray-500 bg-gray-700 text-white"
                      : "border-gray-200 bg-gray-50 text-gray-400 line-through"
                  }`}
                  aria-pressed={showCorporate}
                >
                  <Building2 className="h-3 w-3" />
                  Corporate (SEC Form 4)
                </button>

                <button
                  type="button"
                  onClick={() => setShowCongressional((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors shrink-0 ${
                    showCongressional
                      ? "border-blue-500 bg-blue-600 text-white"
                      : "border-gray-200 bg-gray-50 text-gray-400 line-through"
                  }`}
                  aria-pressed={showCongressional}
                >
                  <Landmark className="h-3 w-3" />
                  Congressional (STOCK Act)
                </button>

                <div className="w-px h-5 bg-gray-200 mx-1 shrink-0" aria-hidden="true" />

                {/* Big moves toggle */}
                <Button
                  type="button"
                  variant={bigMovesOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBigMovesOnly((v) => !v)}
                  className={`shrink-0 ${bigMovesOnly ? "bg-[#0D9488] hover:bg-[#0B7E74] text-white" : ""}`}
                >
                  <Zap className="h-4 w-4 mr-1.5" />
                  {bigMovesOnly ? "$500K+ only" : "All sizes"}
                </Button>
              </div>

              {/* Row 2: Look-back selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium shrink-0">Look back:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "30d", value: 30 },
                    { label: "60d", value: 60 },
                    { label: "90d", value: 90 },
                    { label: "6mo", value: 180 },
                    { label: "1yr", value: 365 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDaysBack(opt.value)}
                      className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${
                        daysBack === opt.value
                          ? "border-[#0D9488] bg-[#0D9488] text-white"
                          : "border-gray-200 bg-gray-50 text-gray-600 hover:border-[#0D9488] hover:text-[#0D9488]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {isLoading && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 ml-2">
                    <span className="inline-block h-3 w-3 rounded-full border-2 border-[#0D9488] border-t-transparent animate-spin" />
                    Loading...
                  </span>
                )}
              </div>

            </div>

            {isLoading ? (
              <LoadingSpinner message="Loading insider transactions..." />
            ) : filteredTrades.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed min-w-[900px]">
                  {/* Fixed column widths so geometry never shifts when filters change the row set */}
                  <colgroup>
                    <col className="w-[8%]" />
                    <col className="w-[9%]" />
                    <col className="w-[21%]" />
                    <col className="w-[9%]" />
                    <col className="w-[13%]" />
                    <col className="w-[9%]" />
                    <col className="w-[10%]" />
                    <col className="w-[21%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th
                        className="text-left py-3 px-2 text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-50 select-none min-w-[80px]"
                        onClick={() => handleSort("date")}
                      >
                        <div className="flex items-center">Date {getSortIcon("date")}</div>
                      </th>
                      <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600 select-none min-w-[70px]">
                        Type
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
                    {filteredTrades.map((trade, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2 text-sm text-gray-900">
                          <div className="flex items-center gap-1">
                            <span>{formatDateDisplay(trade.date)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 whitespace-nowrap">
                          {getTypeBadge(trade.type, trade.shares)}
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
                          <div className="flex items-center gap-2">
                            <a
                              href={yahooChartUrl(trade.ticker) ?? undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-bold text-teal-600 hover:text-teal-700 hover:underline"
                            >
                              {trade.ticker}
                            </a>
                            <ResearchButton ticker={trade.ticker} variant="ghost" compact />
                          </div>
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-900">
                          {trade.shares === "N/A" || trade.shares === "+0" || trade.shares === "-0" ? (
                            <span className="text-gray-400">N/A</span>
                          ) : (
                            <span className={trade.shares.startsWith("-") ? "text-red-600" : "text-green-600"}>
                              {trade.shares}
                            </span>
                          )}
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
              <div className="text-center text-gray-500 py-8 space-y-2">
                <p className="font-medium">No trades match your current filters.</p>
                <p className="text-sm">
                  {!showCorporate && !showCongressional
                    ? "Both source types are disabled — enable at least one above."
                    : tickerFilter.trim()
                      ? `No results for "${tickerFilter.trim().toUpperCase()}" in the selected ${daysBack}d window. Try a longer look-back or click Search to run a deeper per-ticker scan.`
                      : bigMovesOnly
                        ? "No trades over $500K found. Turn off \"Big moves only\" to see all trade sizes."
                        : "No recent transactions found for the selected sources and date range."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

    </>
  )
}
