"use client"

import { Activity, HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * States what the numbers in a strategy-scanner table actually are.
 *
 * Replaces the per-tab "Live Data" / "Estimated Data" badge, which was driven by
 * a single boolean meaning "the stock-price fetch returned 200" and sat above
 * columns whose values were fabricated (AUDIT_BACKLOG P1-10).
 *
 * The distinction that matters to a trader is not live-vs-cached, it is
 * MEASURED (read from a venue) vs DERIVED (model output). Premiums, greeks and
 * probabilities from /api/strategy-scanner are always derived: Black-Scholes
 * evaluated at the measured ATM implied volatility. They are theoretical mids,
 * not fillable quotes, and will differ from the book by the bid-ask spread.
 */
export function PricingProvenance({
  lastUpdated,
  rowCount,
  className = "",
}: {
  lastUpdated?: string | null
  rowCount?: number
  className?: string
}) {
  return (
    <TooltipProvider>
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${className}`}>
        <span className="flex items-center gap-1 text-blue-700">
          <Activity className="h-4 w-4" />
          <span className="font-medium">Modelled prices</span>
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
              aria-label="How these numbers are produced"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="underline decoration-dotted underline-offset-2">how these are calculated</span>
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm text-left">
            <p className="mb-2">
              <strong>Measured from the market:</strong> the underlying&rsquo;s previous close, and at-the-money implied
              volatility averaged across the nearest option chain (both from Polygon). Earnings dates from Finnhub.
            </p>
            <p className="mb-2">
              <strong>Calculated from those:</strong> premiums, credits, deltas, breakevens and probabilities, using
              Black-Scholes at the measured IV.
            </p>
            <p>
              These are <strong>theoretical mid prices, not live quotes</strong> — a real fill will differ by the
              bid-ask spread. Probabilities are risk-neutral values implied by option prices, not a forecast of what
              will happen.
            </p>
          </TooltipContent>
        </Tooltip>

        {lastUpdated && <span className="text-gray-500">Updated: {lastUpdated}</span>}
        {typeof rowCount === "number" && <span className="text-gray-500">{rowCount} setups</span>}
      </div>
    </TooltipProvider>
  )
}

/** Renders a nullable metric, showing an em dash when the value is unavailable. */
export function Metric({
  value,
  suffix = "",
  prefix = "",
  digits = 2,
  unavailableLabel = "not available",
}: {
  value: number | null | undefined
  suffix?: string
  prefix?: string
  digits?: number
  unavailableLabel?: string
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return (
      <span className="text-gray-400" title={unavailableLabel}>
        —
      </span>
    )
  }
  return (
    <span>
      {prefix}
      {value.toFixed(digits)}
      {suffix}
    </span>
  )
}
