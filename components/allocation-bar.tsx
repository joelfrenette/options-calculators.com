"use client"

/**
 * The stocks/cash split, drawn to scale.
 *
 * One bar, two segments, widths equal to the actual percentages — so a reader
 * sees the proportion before reading either number. This replaced two numeric
 * tiles showing ranges, which could not be drawn to scale at all: "90-95%
 * stocks beside 5-10% cash" has no single proportion, so the page was asking
 * the reader to do arithmetic it should have done for them.
 *
 * Segment labels move outside the bar when a segment is too narrow to hold
 * them. At 10% cash an inside label is unreadable, and a bar that silently
 * clips its own number is worse than one that puts it alongside.
 */

import { type AllocationBand, formatPct, stocksFor } from "@/lib/allocation"

/** Below this width a segment cannot hold "NN%" legibly, so the label goes outside. */
const INSIDE_LABEL_MIN_PCT = 18

export function AllocationBar({ band, className = "" }: { band: AllocationBand; className?: string }) {
  const stocks = stocksFor(band)
  const cash = band.cash

  return (
    <div className={className}>
      <div
        className="flex h-10 w-full overflow-hidden rounded-md border border-gray-300"
        role="img"
        aria-label={`${formatPct(stocks)} stocks, ${formatPct(cash)} cash`}
      >
        <div
          className="flex items-center justify-center bg-blue-600 text-white transition-all"
          style={{ width: `${stocks}%` }}
        >
          {stocks >= INSIDE_LABEL_MIN_PCT && (
            <span className="text-sm font-bold whitespace-nowrap">
              {formatPct(stocks)} <span className="font-medium opacity-90">stocks</span>
            </span>
          )}
        </div>
        <div
          className="flex items-center justify-center bg-gray-400 text-white transition-all"
          style={{ width: `${cash}%` }}
        >
          {cash >= INSIDE_LABEL_MIN_PCT && (
            <span className="text-sm font-bold whitespace-nowrap">
              {formatPct(cash)} <span className="font-medium opacity-90">cash</span>
            </span>
          )}
        </div>
      </div>

      {/* Always present, so the two numbers are readable even when both segments are wide. */}
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-blue-700">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
          Stocks {formatPct(stocks)}
        </span>
        <span className="flex items-center gap-1.5 font-semibold text-gray-600">
          <span className="h-2.5 w-2.5 rounded-sm bg-gray-400" />
          Cash {formatPct(cash)}
        </span>
      </div>
    </div>
  )
}
