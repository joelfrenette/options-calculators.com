"use client"

// Notice cards for empty/edge outcomes: Step 3 zero-pass rejection breakdown,
// Step 4 zero technical passes, and Step 4 empty relaxed enrichment. JSX
// extracted verbatim from components/wheel-scanner.tsx (Phase 4 — zero behavior
// change; the near-miss promotion button's inline handler became the
// onUseRelaxedFundamentals callback, wired to the same logic in the hook).

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Filter } from "lucide-react"
import type { QualifyingStock, RejectionSummary } from "./types"
import { stepLabel } from "./steps"

interface RejectionSummaryCardProps {
  rejectionSummary: RejectionSummary
  nearMissFundamentals: QualifyingStock[]
  onUseRelaxedFundamentals: () => void
}

export function RejectionSummaryCard({
  rejectionSummary,
  nearMissFundamentals,
  onUseRelaxedFundamentals,
}: RejectionSummaryCardProps) {
  return (
        <Card className="mt-6 w-full max-w-7xl mx-auto shadow border-amber-300 bg-amber-50">
          <CardHeader className="border-b border-amber-200">
            <CardTitle className="text-base font-bold text-amber-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {stepLabel("fundamentals")} — No stocks passed the strict filters ({rejectionSummary.scanned} scanned)
            </CardTitle>
            <CardDescription className="text-amber-800">
              {nearMissFundamentals.length > 0
                ? `${nearMissFundamentals.length} stocks came within 1–2 filters of passing. Click below to proceed to ${stepLabel("technical")} with the relaxed set, or loosen a slider and rescan.`
                : "Breakdown of why every ticker was rejected. Loosen the slider next to the largest bucket to get results."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-2 text-sm">
            {nearMissFundamentals.length > 0 && (
              <Button
                onClick={onUseRelaxedFundamentals}
                className="w-full h-11 text-base font-semibold bg-purple-600 hover:bg-purple-700 text-white mb-2"
              >
                <Filter className="mr-2 h-5 w-5" />
                Use Relaxed Fundamentals ({nearMissFundamentals.length} stocks) → {stepLabel("technical")}
              </Button>
            )}
            {(Object.entries(rejectionSummary.rejected) as [string, string[]][])
              .filter(([, ts]) => ts.length > 0)
              .sort((a, b) => b[1].length - a[1].length)
              .map(([reason, ts]) => (
                <div key={reason} className="flex flex-col gap-1 border-b border-amber-200 pb-2 last:border-0">
                  <div className="flex justify-between font-semibold text-amber-900">
                    <span>
                      {reason === "priceCap" && `Above Max Stock Price (${stepLabel("dollarFilter")})`}
                      {reason === "volume" && "Volume below Min Volume"}
                      {reason === "debtEquity" && "Debt/Equity above Max"}
                      {reason === "roe" && "ROE below Min ROE %"}
                      {reason === "fundamentalsIncomplete" &&
                        "Financials incomplete — fewer than 4 reported quarters, so ROE/market cap could not be computed"}
                      {reason === "profitableQuarters" && "Fewer consecutive profitable quarters than required"}
                      {reason === "marketCap" && "Market cap below Min"}
                    </span>
                    <span>{ts.length}</span>
                  </div>
                  <div className="text-xs text-amber-700 break-words">
                    {ts.slice(0, 25).join(", ")}
                    {ts.length > 25 ? `, +${ts.length - 25} more` : ""}
                  </div>
                </div>
              ))}
            {(Object.entries(rejectionSummary.skipped) as [string, string[]][])
              .filter(([, ts]) => ts.length > 0)
              .map(([reason, ts]) => (
                <div key={reason} className="flex flex-col gap-1 border-b border-amber-200 pb-2 last:border-0">
                  <div className="flex justify-between font-semibold text-amber-900">
                    <span>
                      {reason === "rateLimit" && "Skipped — Polygon rate limit (429)"}
                      {reason === "apiError" && "Skipped — Polygon API error (non-200)"}
                      {reason === "thinFinancials" && "Warn — Polygon returned thin financials (likely null ROE/EPS)"}
                      {reason === "exception" && "Skipped — client-side exception in loop"}
                    </span>
                    <span>{ts.length}</span>
                  </div>
                  <div className="text-xs text-amber-700 break-words">
                    {ts.slice(0, 25).join(", ")}
                    {ts.length > 25 ? `, +${ts.length - 25} more` : ""}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
  )
}

interface NoTechnicalPassCardProps {
  fundamentalCount: number
  maxRSI: number
}

export function NoTechnicalPassCard({ fundamentalCount, maxRSI }: NoTechnicalPassCardProps) {
  return (
        <Card className="mt-8 w-full max-w-7xl mx-auto border-2 border-yellow-500 bg-white">
          <CardHeader className="bg-gradient-to-r from-yellow-50 to-amber-50">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-yellow-900">{stepLabel("technical")}: No Stocks Passed Technical Criteria</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-gray-700 mb-4">
              The current technical filters are very strict. None of the {fundamentalCount} stocks from {stepLabel("fundamentals")} 3
              passed all technical criteria.
            </p>
            <p className="text-gray-600 text-sm mb-4">Consider:</p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Relaxing the RSI threshold (increase from {maxRSI})</li>
              <li>Disabling some optional filters (200-day SMA, Red Day preference)</li>
              <li>Viewing {stepLabel("technical")} Relaxed Results for alternative opportunities</li>
            </ul>
          </CardContent>
        </Card>
  )
}

interface NoRelaxedResultsCardProps {
  fundamentalCount: number
}

export function NoRelaxedResultsCard({ fundamentalCount }: NoRelaxedResultsCardProps) {
  return (
        <Card className="mt-8 w-full max-w-7xl mx-auto border-2 border-yellow-500 bg-white">
          <CardHeader className="bg-gradient-to-r from-yellow-50 to-amber-50">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-yellow-900">{stepLabel("technical")}: No Relaxed Options Found</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-gray-700 mb-4">
              No options with valid pricing data were found for the {fundamentalCount} stocks that passed
              fundamental criteria.
            </p>
            <p className="text-gray-600 text-sm">This could happen if:</p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mt-2">
              <li>The market is closed and options quotes are unavailable</li>
              <li>No options match the delta range (0.25-0.35)</li>
              <li>API rate limits were reached - try again in a few minutes</li>
            </ul>
          </CardContent>
        </Card>
  )
}
