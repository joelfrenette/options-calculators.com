"use client"

// Step 3 results: sortable Fundamental Scan Results table with the top-10
// expand/collapse toggle. JSX + sort logic extracted verbatim from
// components/wheel-scanner.tsx (Phase 4 modularization — zero behavior change).

import type { Dispatch, SetStateAction } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart3 } from "lucide-react"
import type { QualifyingStock } from "./types"
import { stepTitled, SCANNER_STEPS } from "./steps"
import { yahooChartUrl } from "@/lib/ticker-links"

interface FundamentalResultsTableProps {
  fundamentalResults: QualifyingStock[]
  fundamentalSortColumn: string
  fundamentalSortDirection: "asc" | "desc"
  handleFundamentalSort: (column: string) => void
  showAllFundamentals: boolean
  setShowAllFundamentals: Dispatch<SetStateAction<boolean>>
}

export function FundamentalResultsTable({
  fundamentalResults,
  fundamentalSortColumn,
  fundamentalSortDirection,
  handleFundamentalSort,
  showAllFundamentals,
  setShowAllFundamentals,
}: FundamentalResultsTableProps) {
  // Use sortedFundamentalResults for the fundamental results table
  const sortedFundamentalResults = [...fundamentalResults].sort((a, b) => {
    let aValue: number | string = 0
    let bValue: number | string = 0

    switch (fundamentalSortColumn) {
      case "ticker":
        aValue = a.ticker
        bValue = b.ticker
        break
      case "currentPrice":
        aValue = a.currentPrice
        bValue = b.currentPrice
        break
      case "peRatio":
        aValue = a.peRatio ?? Number.NEGATIVE_INFINITY
        bValue = b.peRatio ?? Number.NEGATIVE_INFINITY
        break
      case "marketCap":
        // Unknown sorts last in either direction rather than tying with a
        // genuine zero.
        aValue = a.marketCap ?? Number.NEGATIVE_INFINITY
        bValue = b.marketCap ?? Number.NEGATIVE_INFINITY
        break
      case "roe":
        aValue = a.roe ?? Number.NEGATIVE_INFINITY
        bValue = b.roe ?? Number.NEGATIVE_INFINITY
        break
      case "avgVolume":
        aValue = a.avgVolume
        bValue = b.avgVolume
        break
      case "atrPercent":
        aValue = a.atrPercent
        bValue = b.atrPercent
        break
      case "yield":
        aValue = a.yield
        bValue = b.yield
        break
      case "profitableQuarters":
        aValue = a.profitableQuarters ?? 0
        bValue = b.profitableQuarters ?? 0
        break
      default:
        aValue = a.currentPrice
        bValue = b.currentPrice
    }

    if (typeof aValue === "string" && typeof bValue === "string") {
      return fundamentalSortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }

    return fundamentalSortDirection === "asc"
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number)
  })

  return (
        <Card className="mt-8 w-full max-w-7xl mx-auto shadow-lg border-gray-200">
          <CardHeader className="bg-blue-50 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Fundamental Scan Results
              </span>
              <span className="text-sm font-normal text-gray-600">
                {fundamentalResults.length} stock{fundamentalResults.length !== 1 ? "s" : ""} passed
              </span>
            </CardTitle>
            <CardDescription>
              These stocks passed fundamental screening. {stepTitled("technical")} to find optimal entries.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th
                      className="text-left py-2 px-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                      onClick={() => handleFundamentalSort("ticker")}
                    >
                      <div className="flex items-center gap-1">
                        Ticker
                        {fundamentalSortColumn === "ticker" && (
                          <span className="text-xs">{fundamentalSortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-right py-2 px-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                      onClick={() => handleFundamentalSort("currentPrice")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Price
                        {fundamentalSortColumn === "currentPrice" && (
                          <span className="text-xs">{fundamentalSortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-right py-2 px-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                      onClick={() => handleFundamentalSort("peRatio")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        PE
                        {fundamentalSortColumn === "peRatio" && (
                          <span className="text-xs">{fundamentalSortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-right py-2 px-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                      onClick={() => handleFundamentalSort("marketCap")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Market Cap
                        {fundamentalSortColumn === "marketCap" && (
                          <span className="text-xs">{fundamentalSortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-right py-2 px-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                      onClick={() => handleFundamentalSort("roe")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        ROE %
                        {fundamentalSortColumn === "roe" && (
                          <span className="text-xs">{fundamentalSortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-right py-2 px-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                      onClick={() => handleFundamentalSort("profitableQuarters")}
                      title="Consecutive profitable quarters (net income > 0), most recent first, out of up to 12 filings"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Prof. Qtrs
                        {fundamentalSortColumn === "profitableQuarters" && (
                          <span className="text-xs">{fundamentalSortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-right py-2 px-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                      onClick={() => handleFundamentalSort("avgVolume")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Volume (M)
                        {fundamentalSortColumn === "avgVolume" && (
                          <span className="text-xs">{fundamentalSortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-right py-2 px-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                      onClick={() => handleFundamentalSort("atrPercent")}
                      title="Average True Range as % of price — realized volatility; higher = richer option premiums"
                    >
                      <div className="flex items-center justify-end gap-1">
                        ATR %
                        {fundamentalSortColumn === "atrPercent" && (
                          <span className="text-xs">{fundamentalSortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-right py-2 px-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                      onClick={() => handleFundamentalSort("yield")}
                      title="Estimated weekly put premium yield from volatility — real quotes come in Step ${SCANNER_STEPS.technical.n}"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Est. Yield %
                        {fundamentalSortColumn === "yield" && (
                          <span className="text-xs">{fundamentalSortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllFundamentals ? sortedFundamentalResults : sortedFundamentalResults.slice(0, 10)).map((stock, index) => {
                    const yahooChartLink = yahooChartUrl(stock.ticker) ?? undefined
                    return (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <a
                            href={yahooChartLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {stock.ticker}
                          </a>
                        </td>
                        <td className="text-right py-2 px-3 text-gray-900">${stock.currentPrice.toFixed(2)}</td>
                        <td className="text-right py-2 px-3 text-gray-600">
                          {stock.peRatio !== null && stock.peRatio > 0 ? (
                            stock.peRatio.toFixed(1)
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-600">
                          {stock.marketCap !== null && stock.marketCap > 0 ? (
                            `$${stock.marketCap.toFixed(1)}B`
                          ) : (
                            <span className="text-gray-400" title="No shares outstanding and no complete trailing-twelve-month figure">
                              —
                            </span>
                          )}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-600">
                          {stock.roe !== null && stock.roe > 0 ? (
                            `${stock.roe.toFixed(1)}%`
                          ) : (
                            <span
                              className="text-gray-400"
                              title={
                                stock.ttmQuarters !== undefined && stock.ttmQuarters < 4
                                  ? `Trailing twelve months covers only ${stock.ttmQuarters} of 4 quarters`
                                  : "Equity not reported"
                              }
                            >
                              —
                            </span>
                          )}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-600">
                          {stock.profitableQuarters !== undefined ? stock.profitableQuarters : "-"}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-600">{stock.avgVolume.toFixed(1)}M</td>
                        <td
                          className={`text-right py-2 px-3 font-semibold ${
                            stock.atrPercent >= 4
                              ? "text-purple-700"
                              : stock.atrPercent >= 2.5
                                ? "text-purple-500"
                                : "text-gray-600"
                          }`}
                        >
                          {stock.atrPercent > 0 ? `${stock.atrPercent.toFixed(1)}%` : "-"}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-600">
                          {stock.yield > 0 ? `${stock.yield.toFixed(2)}%` : "-"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {fundamentalResults.length > 10 && (
              <div className="mt-3 flex flex-col items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllFundamentals((prev) => !prev)}
                  className="text-blue-700 border-blue-300 hover:bg-blue-50"
                >
                  {showAllFundamentals
                    ? "Show top 10 only"
                    : `Show all ${fundamentalResults.length} stocks`}
                </Button>
                <p className="text-xs text-gray-500">
                  {showAllFundamentals
                    ? `Showing all ${fundamentalResults.length} results`
                    : `Showing top 10 of ${fundamentalResults.length} results`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
  )
}
