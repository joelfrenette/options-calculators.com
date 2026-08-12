"use client"

// Step 4 strict results: options that passed ALL technical criteria, with the
// earnings-first sort and Landmine column. JSX + sort logic extracted verbatim
// from components/wheel-scanner.tsx (Phase 4 modularization — zero behavior change).

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import type { QualifyingStock } from "./types"
import { evaluateCriteria, type TechnicalFilterSettings } from "./technical-criteria"
import { stepLabel } from "./steps"

interface StrictResultsTableProps {
  technicalResults: QualifyingStock[]
  sortColumn: keyof QualifyingStock
  sortDirection: "asc" | "desc"
  handleSort: (column: keyof QualifyingStock) => void
  technicalFilterSettings: TechnicalFilterSettings
  getLandminesForRow: (stock: QualifyingStock) => string[] | null
}

export function StrictResultsTable({
  technicalResults,
  sortColumn,
  sortDirection,
  handleSort,
  technicalFilterSettings,
  getLandminesForRow,
}: StrictResultsTableProps) {
  const sortedTechnicalStocks =
    technicalResults.length > 0
      ? [...technicalResults].sort((a, b) => {
          // First priority: stocks with earnings within 14 days
          const aHasUpcomingEarnings = a.daysToEarnings !== undefined && a.daysToEarnings >= 0 && a.daysToEarnings <= 14
          const bHasUpcomingEarnings = b.daysToEarnings !== undefined && b.daysToEarnings >= 0 && b.daysToEarnings <= 14

          if (aHasUpcomingEarnings && !bHasUpcomingEarnings) return -1
          if (!aHasUpcomingEarnings && bHasUpcomingEarnings) return 1

          // Then sort by selected column
          const aVal = a[sortColumn]
          const bVal = b[sortColumn]

          if (typeof aVal === "number" && typeof bVal === "number") {
            return sortDirection === "asc" ? aVal - bVal : bVal - aVal
          }

          if (sortColumn === "redDay" || sortColumn === "uptrend") {
            const aBool = Boolean(aVal)
            const bBool = Boolean(bVal)
            return sortDirection === "asc" ? Number(aBool) - Number(bBool) : Number(bBool) - Number(aBool)
          }

          if (typeof aVal === "string" && typeof bVal === "string") {
            return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
          }

          return 0
        })
      : [] // Initialize as empty array if no technical results

  // A synthesized row's premium/delta/yields come from a fixed 35% IV, not a
  // quote. Counted here so the header can say how much of the table is that.
  const synthesizedCount = sortedTechnicalStocks.filter((s) => s.priceSource === "synthesized").length

  return (
        <Card className="bg-white mt-8 w-full max-w-7xl mx-auto shadow-xl border-2 border-green-500">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <CardTitle className="text-green-900">
                  {stepLabel("technical")}: Technical Analysis Results (Premium Entries) ✨
                </CardTitle>
              </div>
              <span className="text-sm font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full">
                {technicalResults.length} {technicalResults.length === 1 ? "option meets" : "options meet"} all the
                selection criteria
              </span>
            </div>
            <p className="text-sm text-green-700 mt-2">
              🎉 Congratulations! These stocks passed ALL technical criteria - premium put-selling opportunities!
            </p>
            {synthesizedCount > 0 && (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <strong>
                  {synthesizedCount} of {sortedTechnicalStocks.length} rows carry no live option quote.
                </strong>{" "}
                Polygon&apos;s chain snapshot returned nothing for those contracts — the market is closed, or the feed
                is rate-limited or down. Their premium, delta and both yield columns are computed from a fixed 35%
                implied-volatility assumption, not from anything anyone traded, and are marked <em>est.</em> below.
                Sorting by yield will rank them against real quotes, so read the marker before comparing.
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-green-50 border-b border-green-200">
                  <tr>
                    <th
                      className="text-left p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("ticker" as keyof QualifyingStock)}
                    >
                      Ticker {sortColumn === "ticker" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("currentPrice" as keyof QualifyingStock)}
                    >
                      Price {sortColumn === "currentPrice" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("daysToExpiry" as keyof QualifyingStock)}
                    >
                      DTE {sortColumn === "daysToExpiry" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("expiryDate" as keyof QualifyingStock)}
                    >
                      Expiry {sortColumn === "expiryDate" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("putStrike" as keyof QualifyingStock)}
                    >
                      Strike {sortColumn === "putStrike" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("premium")}
                    >
                      Premium {sortColumn === "premium" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("delta" as keyof QualifyingStock)}
                    >
                      Delta {sortColumn === "delta" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("yield" as keyof QualifyingStock)}
                    >
                      Yield % {sortColumn === "yield" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("annualizedYield" as keyof QualifyingStock)}
                    >
                      Annual Yield % {sortColumn === "annualizedYield" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("iv" as keyof QualifyingStock)}
                      title="Implied volatility from live option quotes — the premium-richness KPI"
                    >
                      IV % {sortColumn === "iv" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900"
                      title="Scheduled events (earnings, CPI, FOMC, jobs report) landing BEFORE this option's expiry. A rich premium may be event-driven — hover for the list and research before selling."
                    >
                      Landmine ⚠
                    </th>
                    {/* Reordered: Red Day, RSI, Bollinger, MACD, then rest */}
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("redDay" as keyof QualifyingStock)}
                    >
                      Red Day {sortColumn === "redDay" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("rsi" as keyof QualifyingStock)}
                    >
                      RSI {"<"} {technicalFilterSettings.maxRSI} {sortColumn === "rsi" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("bollingerPosition" as keyof QualifyingStock)}
                    >
                      Bollinger {sortColumn === "bollingerPosition" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("macdSignal" as keyof QualifyingStock)}
                    >
                      MACD {sortColumn === "macdSignal" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("uptrend" as keyof QualifyingStock)}
                    >
                      Golden Cross {sortColumn === "uptrend" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("stochastic" as keyof QualifyingStock)}
                    >
                      Stochastic {sortColumn === "stochastic" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-center p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("atrPercent" as keyof QualifyingStock)}
                    >
                      ATR % {sortColumn === "atrPercent" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("sma50" as keyof QualifyingStock)}
                    >
                      50-SMA {sortColumn === "sma50" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("sma100" as keyof QualifyingStock)}
                    >
                      100-SMA {sortColumn === "sma100" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-green-900 cursor-pointer hover:bg-green-100"
                      onClick={() => handleSort("sma200" as keyof QualifyingStock)}
                    >
                      200-SMA {sortColumn === "sma200" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTechnicalStocks.map((stock, idx) => {
                    // Evaluate criteria for each stock to show which filters passed/failed
                    const criteria = evaluateCriteria(stock, technicalFilterSettings)
                    const isSynthesized = stock.priceSource === "synthesized"
                    // The delta column keys off its OWN provenance field rather
                    // than the price's. They resolve identically today — both
                    // come from the same `useEstimatedGreeks` branch — but a
                    // provenance field nothing reads is how priceSource ended up
                    // logged and discarded in the first place.
                    const deltaEstimated = stock.deltaSource === "estimated" || isSynthesized
                    return (
                      <tr
                        key={`${stock.ticker}-${stock.expiryDate}-${idx}`}
                        className={`border-b hover:bg-green-50 ${idx % 2 === 0 ? "bg-white" : "bg-green-50"}`}
                      >
                        <td className="p-3 font-semibold text-green-700">
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
                        {/* CHANGE: Display actual DTE from stock data without fallback that masks errors */}
                        <td className="text-center p-3">{stock.daysToExpiry ?? "N/A"}</td>
                        <td className="text-center p-3">{stock.expiryDate ?? "N/A"}</td>
                        <td className="text-center p-3">${stock.putStrike.toFixed(2)}</td>
                        {/* The four columns below are all downstream of `premium`.
                            When there is no quote they are one assumption wearing
                            four hats, so each says so rather than only the first. */}
                        <td
                          className={`text-right p-3 font-semibold ${
                            isSynthesized ? "text-amber-700" : "text-green-700"
                          }`}
                        >
                          ${stock.premium != null ? stock.premium.toFixed(2) : "N/A"}
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
                            deltaEstimated ? "text-amber-700" : stock.delta < -0.2 ? "text-green-700" : ""
                          }`}
                        >
                          {stock.delta.toFixed(3)}
                          {deltaEstimated && <span className="ml-1 text-[10px]">est.</span>}
                        </td>
                        <td className="text-right p-3">
                          <span className={`font-bold ${isSynthesized ? "text-amber-700" : "text-green-800"}`}>
                            {stock.yield.toFixed(2)}%
                          </span>
                          {isSynthesized && <span className="ml-1 text-[10px] text-amber-700">est.</span>}
                        </td>
                        <td className={`text-right p-3 ${isSynthesized ? "text-amber-700" : ""}`}>
                          {stock.annualizedYield != null && stock.annualizedYield > 0
                            ? stock.annualizedYield.toFixed(1) + "%"
                            : "N/A"}
                          {isSynthesized && stock.annualizedYield != null && stock.annualizedYield > 0 && (
                            <span className="ml-1 text-[10px]">est.</span>
                          )}
                        </td>
                        <td
                          className={`text-right p-3 font-semibold ${
                            stock.iv != null && stock.iv >= 50
                              ? "text-purple-700"
                              : stock.iv != null && stock.iv >= 35
                                ? "text-purple-500"
                                : "text-gray-600"
                          }`}
                        >
                          {stock.iv != null && stock.iv > 0 ? `${stock.iv.toFixed(0)}%` : "-"}
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
                          {stock.redDay ? (
                            <span className="text-green-600 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold text-lg">✗</span>
                          )}
                        </td>
                        <td className="text-center p-3">
                          {stock.rsi !== null && stock.rsi < 40 ? (
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
                          {stock.macdSignal === "Bullish" ? (
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
                          {stock.sma200 !== null && stock.currentPrice < stock.sma200 ? (
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
            <div className="p-4 bg-green-50 border-t border-green-200">
              <p className="text-sm text-green-700 font-medium">
                🎯 Next Step: Click "Show Relaxed Criteria" below to see additional opportunities with slightly relaxed
                filters.
              </p>
            </div>
          </CardContent>
        </Card>
  )
}
