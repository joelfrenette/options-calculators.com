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
import type { EntryExclusion } from "./technical-criteria"
import { stepLabel } from "./steps"
import { REJECTION_REASONS, SKIP_REASONS } from "./scan-diagnostics"

/**
 * The heading for a bucket, from the map that also defines the bucket keys.
 *
 * This was a chain of `{reason === "x" && "…"}` expressions with no `else`
 * (P7-53), so an unlabelled bucket rendered a BLANK heading beside a live
 * count — invisible in exactly the way a missing check is. Falling back to the
 * raw key is deliberately ugly: an unlabelled bucket should look wrong on
 * screen, not look like nothing.
 */
function reasonLabel(labels: Record<string, string>, reason: string): string {
  return (labels[reason] ?? reason).replace("{step}", stepLabel("dollarFilter"))
}

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
                    <span>{reasonLabel(REJECTION_REASONS, reason)}</span>
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
                    <span>{reasonLabel(SKIP_REASONS, reason)}</span>
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
              The current technical filters are very strict. None of the {fundamentalCount} stocks from{" "}
              {stepLabel("fundamentals")} passed all technical criteria.
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
              <CardTitle className="text-yellow-900">{stepLabel("relaxed")}: No Relaxed Options Found</CardTitle>
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

interface EntryExclusionCardProps {
  excluded: EntryExclusion[]
}

/**
 * What the entry exclusions removed, and why.
 *
 * This card exists because the alternative is a scanner that quietly returns
 * fewer rows, which is indistinguishable from a market with fewer candidates.
 * The exclusions default ON, so without this the user is looking at a filtered
 * list and a filter they never set — the same shape as the hidden yield/volume
 * gates recorded under S-8, and the reason those got a paragraph of their own.
 *
 * Renders nothing when nothing was excluded: an empty card asserting "0
 * excluded" is noise on every clean run.
 */
export function EntryExclusionCard({ excluded }: EntryExclusionCardProps) {
  if (excluded.length === 0) return null
  return (
    <Card className="mt-6 w-full max-w-7xl mx-auto border-amber-200">
      <CardHeader className="bg-amber-50 border-b border-amber-200">
        <CardTitle className="text-base font-bold text-amber-900 flex items-center gap-2">
          <Filter className="h-4 w-4" />
          {excluded.length} candidate{excluded.length === 1 ? "" : "s"} excluded before pricing
        </CardTitle>
        <CardDescription className="text-amber-800">
          Removed from the STRICT {stepLabel("technical")} table by the entry exclusions, not by the sliders. Run
          {" "}{stepLabel("relaxed")} to price them anyway — they appear there flagged with the reason below. A stock
          whose history is too short to measure is excluded by the filter that needs it.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex flex-wrap gap-2">
          {excluded.map((e) => (
            <span
              key={e.ticker}
              className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-1 text-xs"
            >
              <span className="font-semibold text-gray-900">{e.ticker}</span>
              <span className="text-gray-600">{e.reasons.join(" · ")}</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
