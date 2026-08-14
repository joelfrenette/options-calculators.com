"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChevronDown, ChevronUp, ExternalLink, AlertTriangle } from "lucide-react"
import { InfoTooltip } from "./jobs-tooltips"
import type { JobsData } from "./jobs-types"

/** The 12-month UNRATE table and the data-source attribution beneath it. */
export function HistoricalTableCard({
  historicalTable,
  dataSource,
  lastUpdated,
  expanded,
  onToggleExpanded,
  tooltipsEnabled,
}: {
  historicalTable: JobsData["historicalTable"]
  dataSource: string
  lastUpdated: string
  expanded: boolean
  onToggleExpanded: () => void
  tooltipsEnabled: boolean
}) {
  return (
    <>
      <Card className="bg-white shadow-md border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-[#1E3A8A] text-xl flex items-center gap-2">
                Historical Unemployment Data
                <InfoTooltip
                  enabled={tooltipsEnabled}
                  content="Track unemployment trends over time to identify labor market cycles. Rising unemployment typically precedes recessions by 6-12 months."
                />
              </CardTitle>
              <CardDescription className="text-gray-600">
                Last 12 months of official unemployment rate data (FRED: UNRATE)
              </CardDescription>
            </div>
            <button
              onClick={onToggleExpanded}
              className="flex items-center gap-1 text-[#0D9488] hover:text-[#0D9488]/80 text-sm font-medium"
            >
              {expanded ? (
                <>
                  Show Less <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  Show All <ChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Month</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Rate</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">YoY Change</th>
                </tr>
              </thead>
              <tbody>
                {(expanded ? historicalTable : historicalTable.slice(0, 5)).map((row, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">{row.month}</td>
                    <td className="py-3 px-4 text-sm font-medium text-[#1E3A8A]">{row.rate}%</td>
                    <td className="py-3 px-4 text-sm">
                      <span
                        className={
                          row.yoyChange.startsWith("+")
                            ? "text-amber-600"
                            : row.yoyChange === "0.0%"
                              ? "text-gray-600"
                              : "text-green-600"
                        }
                      >
                        {row.yoyChange}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Data Source Attribution */}
      <Card className="bg-gray-50 border border-gray-200">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between text-sm text-gray-600 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>
                {dataSource}. Last updated {new Date(lastUpdated).toLocaleString()}. Forecasts are estimates and not
                financial advice.
              </span>
            </div>
            <a
              href="https://www.bls.gov/news.release/empsit.nr0.htm"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#0D9488] hover:underline"
            >
              View Official Report <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
