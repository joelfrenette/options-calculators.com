"use client"

// Step 4 relaxed results: options that passed SOME (not all) technical gates,
// with the Excel-style filter bar, synced top scrollbar, and Landmine column.
// JSX + filter/sort logic extracted verbatim from components/wheel-scanner.tsx
// (Phase 4 modularization — zero behavior change).

import { useState, useRef, useEffect, type Dispatch, type SetStateAction } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Filter } from "lucide-react"
import type { QualifyingStock, RelaxedFilters } from "./types"
import { evaluateCriteria, type TechnicalFilterSettings } from "./technical-criteria"

interface RelaxedResultsTableProps {
  relaxedResults: QualifyingStock[]
  relaxedFilters: RelaxedFilters
  setRelaxedFilters: Dispatch<SetStateAction<RelaxedFilters>>
  clearRelaxedFilters: () => void
  relaxedSortColumn: keyof QualifyingStock
  relaxedSortDirection: "asc" | "desc"
  handleRelaxedSort: (column: keyof QualifyingStock) => void
  showRelaxedResults: boolean
  technicalFilterSettings: TechnicalFilterSettings
  getLandminesForRow: (stock: QualifyingStock) => string[] | null
}

export function RelaxedResultsTable({
  relaxedResults,
  relaxedFilters,
  setRelaxedFilters,
  clearRelaxedFilters,
  relaxedSortColumn,
  relaxedSortDirection,
  handleRelaxedSort,
  showRelaxedResults,
  technicalFilterSettings,
  getLandminesForRow,
}: RelaxedResultsTableProps) {
  // Refs/state for the synced top horizontal scrollbar on the relaxed results table
  const topScrollRef = useRef<HTMLDivElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const [relaxedScrollWidth, setRelaxedScrollWidth] = useState(0)

  const filteredRelaxedResults = relaxedResults.filter((stock) => {
    const tickerQuery = relaxedFilters.ticker.trim().toUpperCase()
    if (tickerQuery) {
      // Comma/space separated list; row matches if its ticker contains any token
      const tokens = tickerQuery.split(/[\s,]+/).filter(Boolean)
      if (tokens.length > 0 && !tokens.some((t) => stock.ticker.includes(t))) return false
    }
    const maxDTE = Number.parseFloat(relaxedFilters.maxDTE)
    if (Number.isFinite(maxDTE) && (stock.daysToExpiry ?? Number.POSITIVE_INFINITY) > maxDTE) return false
    const minPremium = Number.parseFloat(relaxedFilters.minPremium)
    if (Number.isFinite(minPremium) && (stock.premium ?? 0) < minPremium) return false
    const minYieldF = Number.parseFloat(relaxedFilters.minYield)
    if (Number.isFinite(minYieldF) && (stock.yield ?? 0) < minYieldF) return false
    const minAnnual = Number.parseFloat(relaxedFilters.minAnnualYield)
    if (Number.isFinite(minAnnual) && (stock.annualizedYield ?? 0) < minAnnual) return false
    const minIVF = Number.parseFloat(relaxedFilters.minIV)
    if (Number.isFinite(minIVF) && (stock.iv ?? 0) < minIVF) return false
    return true
  })

  // Sorting logic for relaxed results.
  // Default view: shortest DTE first, then highest Yield % within each DTE group.
  const sortedRelaxedResults = [...filteredRelaxedResults].sort((a, b) => {
    const aVal = a[relaxedSortColumn]
    const bVal = b[relaxedSortColumn]

    // Highest-yield tiebreaker, used to rank rows that share the same primary value
    const yieldTiebreak = () => (b.yield ?? 0) - (a.yield ?? 0)

    if (relaxedSortColumn === "redDay") {
      const aBool = Boolean(aVal)
      const bBool = Boolean(bVal)
      const diff =
        relaxedSortDirection === "asc" ? Number(aBool) - Number(bBool) : Number(bBool) - Number(aBool)
      return diff !== 0 ? diff : yieldTiebreak()
    }

    if (typeof aVal === "number" || typeof bVal === "number") {
      // Treat missing numeric values as the largest so they sort last when ascending
      const aNum = typeof aVal === "number" ? aVal : Number.POSITIVE_INFINITY
      const bNum = typeof bVal === "number" ? bVal : Number.POSITIVE_INFINITY
      const diff = relaxedSortDirection === "asc" ? aNum - bNum : bNum - aNum
      // Within the same DTE, rank by highest yield
      if (diff === 0 && relaxedSortColumn === "daysToExpiry") return yieldTiebreak()
      return diff
    }

    // String comparison fallback (e.g. expiryDate, bollingerPosition, macdSignal)
    const cmp = String(aVal ?? "").localeCompare(String(bVal ?? ""))
    return relaxedSortDirection === "asc" ? cmp : -cmp
  })

  // Keep the top scrollbar spacer width in sync with the actual table width
  useEffect(() => {
    if (tableScrollRef.current) {
      setRelaxedScrollWidth(tableScrollRef.current.scrollWidth)
    }
  }, [relaxedResults, showRelaxedResults, relaxedSortColumn, relaxedSortDirection])

  return (
        <Card className="mt-8 w-full max-w-7xl mx-auto shadow-xl border-2 border-purple-500">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-purple-900">Step 4: Relaxed Criteria Results</CardTitle>
              </div>
              <span className="text-sm font-semibold text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
                {relaxedResults.length} {relaxedResults.length === 1 ? "option meets" : "options meet"} the relaxed
                criteria
              </span>
            </div>
            <p className="text-sm text-purple-700 mt-2">
              These stocks passed a slightly relaxed set of technical filters. Review for additional put-selling
              opportunities. Click column headers to sort, or narrow the list with the filters below.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {/* Excel-style filter bar */}
            <div className="px-4 py-3 bg-purple-50/50 border-b border-purple-100 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="rf-ticker" className="text-[11px] font-semibold text-purple-900">
                  Ticker(s)
                </Label>
                <input
                  id="rf-ticker"
                  type="text"
                  placeholder="e.g. AMD, GOOGL"
                  value={relaxedFilters.ticker}
                  onChange={(e) => setRelaxedFilters((f) => ({ ...f, ticker: e.target.value }))}
                  className="h-8 w-36 rounded border border-purple-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="rf-dte" className="text-[11px] font-semibold text-purple-900">
                  Max DTE
                </Label>
                <input
                  id="rf-dte"
                  type="number"
                  min="0"
                  placeholder="any"
                  value={relaxedFilters.maxDTE}
                  onChange={(e) => setRelaxedFilters((f) => ({ ...f, maxDTE: e.target.value }))}
                  className="h-8 w-20 rounded border border-purple-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="rf-premium" className="text-[11px] font-semibold text-purple-900">
                  Min Premium $
                </Label>
                <input
                  id="rf-premium"
                  type="number"
                  min="0"
                  step="0.25"
                  placeholder="any"
                  value={relaxedFilters.minPremium}
                  onChange={(e) => setRelaxedFilters((f) => ({ ...f, minPremium: e.target.value }))}
                  className="h-8 w-24 rounded border border-purple-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="rf-yield" className="text-[11px] font-semibold text-purple-900">
                  Min Yield %
                </Label>
                <input
                  id="rf-yield"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="any"
                  value={relaxedFilters.minYield}
                  onChange={(e) => setRelaxedFilters((f) => ({ ...f, minYield: e.target.value }))}
                  className="h-8 w-24 rounded border border-purple-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="rf-annual" className="text-[11px] font-semibold text-purple-900">
                  Min Annual %
                </Label>
                <input
                  id="rf-annual"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="any"
                  value={relaxedFilters.minAnnualYield}
                  onChange={(e) => setRelaxedFilters((f) => ({ ...f, minAnnualYield: e.target.value }))}
                  className="h-8 w-24 rounded border border-purple-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="rf-iv" className="text-[11px] font-semibold text-purple-900">
                  Min IV %
                </Label>
                <input
                  id="rf-iv"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="any"
                  value={relaxedFilters.minIV}
                  onChange={(e) => setRelaxedFilters((f) => ({ ...f, minIV: e.target.value }))}
                  className="h-8 w-20 rounded border border-purple-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearRelaxedFilters}
                className="h-8 text-purple-700 border-purple-300 hover:bg-purple-100"
              >
                Clear filters
              </Button>
              <span className="text-xs text-purple-700 ml-auto self-center">
                Showing {sortedRelaxedResults.length} of {relaxedResults.length} options
              </span>
            </div>
            {/* Top horizontal scrollbar, synced with the table below */}
            <div
              ref={topScrollRef}
              className="overflow-x-auto"
              onScroll={() => {
                if (tableScrollRef.current && topScrollRef.current) {
                  tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft
                }
              }}
            >
              <div style={{ width: relaxedScrollWidth, height: 1 }} aria-hidden="true" />
            </div>
            <div
              ref={tableScrollRef}
              className="overflow-x-auto"
              onScroll={() => {
                if (tableScrollRef.current && topScrollRef.current) {
                  topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft
                }
              }}
            >
              <table className="w-full text-sm">
                <thead className="bg-purple-50 border-b border-purple-200">
                  <tr>
                    <th
                      className="text-left p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("ticker")}
                    >
                      Ticker {relaxedSortColumn === "ticker" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("currentPrice")}
                    >
                      Price {relaxedSortColumn === "currentPrice" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("daysToExpiry")}
                    >
                      DTE {relaxedSortColumn === "daysToExpiry" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("expiryDate")}
                    >
                      Expiry {relaxedSortColumn === "expiryDate" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("putStrike")}
                    >
                      Strike {relaxedSortColumn === "putStrike" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("premium")}
                    >
                      Premium {relaxedSortColumn === "premium" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("delta")}
                    >
                      Delta {relaxedSortColumn === "delta" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("yield")}
                    >
                      Yield % {relaxedSortColumn === "yield" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("annualizedYield")}
                    >
                      Annual Yield %{" "}
                      {relaxedSortColumn === "annualizedYield" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("iv" as keyof QualifyingStock)}
                      title="Implied volatility from live option quotes — the premium-richness KPI"
                    >
                      IV % {relaxedSortColumn === "iv" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900"
                      title="Scheduled events (earnings, CPI, FOMC, jobs report) landing BEFORE this option's expiry. A rich premium may be event-driven — hover for the list and research before selling."
                    >
                      Landmine ⚠
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("daysToEarnings")}
                    >
                      Earnings {relaxedSortColumn === "daysToEarnings" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("redDay")}
                    >
                      Red Day {relaxedSortColumn === "redDay" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("macdSignal")}
                    >
                      MACD {relaxedSortColumn === "macdSignal" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("rsi")}
                    >
                      RSI {"<"} {technicalFilterSettings.maxRSI}{" "}
                      {relaxedSortColumn === "rsi" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("bollingerPosition")}
                    >
                      Bollinger{" "}
                      {relaxedSortColumn === "bollingerPosition" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("uptrend")}
                    >
                      Golden Cross {relaxedSortColumn === "uptrend" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("stochastic")}
                    >
                      Stochastic {relaxedSortColumn === "stochastic" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("atrPercent")}
                    >
                      ATR % {relaxedSortColumn === "atrPercent" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("sma50")}
                    >
                      50-SMA {relaxedSortColumn === "sma50" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("sma100")}
                    >
                      100-SMA {relaxedSortColumn === "sma100" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-purple-900 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleRelaxedSort("sma200")}
                    >
                      200-SMA {relaxedSortColumn === "sma200" && (relaxedSortDirection === "asc" ? "↑" : "↓")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRelaxedResults.map((stock, index) => {
                    // Evaluate criteria for each stock to show which filters passed/failed
                    const criteria = evaluateCriteria(stock, technicalFilterSettings)
                    const passedCount = Object.values(criteria).filter(Boolean).length
                    const totalCriteria = Object.values(criteria).length
                    // Same enrichment path as the strict table: no quote means
                    // premium/delta/both yields came from a fixed 35% IV.
                    const isSynthesized = stock.priceSource === "synthesized"
                    // The delta column keys off its OWN provenance field rather
                    // than the price's. They resolve identically today — both
                    // come from the same `useEstimatedGreeks` branch — but a
                    // provenance field nothing reads is how priceSource ended up
                    // logged and discarded in the first place.
                    const deltaEstimated = stock.deltaSource === "estimated" || isSynthesized

                    return (
                      <tr
                        key={`${stock.ticker}-${stock.expiryDate}-${index}`}
                        className={`border-b hover:bg-purple-50 ${index % 2 === 0 ? "bg-white" : "bg-purple-50"}`}
                      >
                        <td className="p-3 font-semibold text-purple-700">
                          <a
                            href={`https://finance.yahoo.com/quote/${stock.ticker}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {stock.ticker}
                          </a>
                        </td>
                        <td className="text-right p-3">${stock.currentPrice.toFixed(2)}</td>
                        <td className="text-center p-3">{stock.daysToExpiry ?? "N/A"}</td>
                        <td className="text-center p-3">{stock.expiryDate ?? "N/A"}</td>
                        <td className="text-center p-3">${stock.putStrike.toFixed(2)}</td>
                        <td
                          className={`text-right p-3 font-semibold ${
                            isSynthesized ? "text-amber-700" : "text-purple-700"
                          }`}
                        >
                          ${stock.premium !== undefined ? stock.premium.toFixed(2) : "N/A"}
                          {isSynthesized && (
                            <span
                              className="ml-1 text-[10px] font-normal text-amber-700"
                              title="No live quote — computed from a fixed 35% IV assumption"
                            >
                              est.
                            </span>
                          )}
                        </td>
                        <td
                          className={`text-center p-3 ${
                            deltaEstimated ? "text-amber-700" : stock.delta < -0.2 ? "text-purple-700" : ""
                          }`}
                        >
                          {stock.delta.toFixed(3)}
                          {deltaEstimated && <span className="ml-1 text-[10px]">est.</span>}
                        </td>
                        <td className="text-right p-3">
                          <span className={`font-bold ${isSynthesized ? "text-amber-700" : "text-purple-800"}`}>
                            {stock.yield.toFixed(2)}%
                          </span>
                          {isSynthesized && <span className="ml-1 text-[10px] text-amber-700">est.</span>}
                        </td>
                        <td className={`text-right p-3 ${isSynthesized ? "text-amber-700" : ""}`}>
                          {stock.annualizedYield !== undefined && stock.annualizedYield > 0
                            ? stock.annualizedYield.toFixed(1) + "%"
                            : "N/A"}
                          {isSynthesized && stock.annualizedYield !== undefined && stock.annualizedYield > 0 && (
                            <span className="ml-1 text-[10px]">est.</span>
                          )}
                        </td>
                        <td
                          className={`text-right p-3 font-semibold ${
                            stock.iv !== undefined && stock.iv >= 50
                              ? "text-purple-700"
                              : stock.iv !== undefined && stock.iv >= 35
                                ? "text-purple-500"
                                : "text-gray-600"
                          }`}
                        >
                          {stock.iv !== undefined && stock.iv > 0 ? `${stock.iv.toFixed(0)}%` : "-"}
                        </td>
                        <td className="text-center p-3">
                          {(() => {
                            const mines = getLandminesForRow(stock)
                            if (mines === null) return <span className="text-gray-400 text-xs">…</span>
                            if (mines.length === 0) return <span className="text-green-600 font-bold">—</span>
                            return (
                              <span
                                className="text-amber-600 font-bold cursor-help whitespace-nowrap"
                                title={mines.join("\n")}
                              >
                                ⚠ {mines.length}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="text-center p-3">
                          {stock.daysToEarnings !== undefined &&
                          stock.daysToEarnings >= 0 &&
                          stock.daysToExpiry !== undefined &&
                          stock.daysToEarnings <= stock.daysToExpiry ? (
                            <span
                              className="text-green-600 font-bold text-lg"
                              title={
                                stock.earningsDate
                                  ? `Earnings ${stock.earningsDate} (${stock.daysToEarnings}d) — within ${stock.daysToExpiry}d DTE`
                                  : `Earnings within ${stock.daysToExpiry}d DTE`
                              }
                            >
                              ✓
                            </span>
                          ) : (
                            <span
                              className="text-red-600 font-bold text-lg"
                              title={
                                stock.earningsDate
                                  ? `Earnings ${stock.earningsDate} (${stock.daysToEarnings}d) — outside DTE window`
                                  : "No earnings scheduled within the DTE window"
                              }
                            >
                              ✗
                            </span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.redDay ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.macdSignal === "Bullish" ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.rsi !== null && stock.rsi < technicalFilterSettings.maxRSI ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.bollingerPosition === "Below" || stock.bollingerPosition === "Lower Half" ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.uptrend ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.stochastic !== null && stock.stochastic < 25 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.atrPercent !== undefined && stock.atrPercent >= 2.5 && stock.atrPercent <= 6 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.sma50 !== null && stock.currentPrice < stock.sma50 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.sma100 !== null && stock.currentPrice < stock.sma100 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.sma200 !== null && stock.currentPrice > stock.sma200 ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-purple-600">Review these opportunities and adjust filters as needed.</p>
          </CardContent>
        </Card>
  )
}
