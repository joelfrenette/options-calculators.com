"use client"

import { Info, ShieldAlert } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * Shared "Dollar Amount Filtering (Step 1)" card used across every SCAN scanner.
 *
 * Two modes:
 *
 * - "share-price" (default): exposes a single max-share-price control. A value of
 *   1000 represents "$1,000+" and is treated by callers as "no upper limit".
 *   Callers MUST apply the returned value to their result set
 *   (e.g. `setup.currentPrice <= value`). Used by CREDIT strategies where buying
 *   power is tied to the underlying/width rather than a single debit.
 *
 * - "net-debit": for DEBIT strategies (calendar, butterfly, ZEBRA, LEAPS). The
 *   slider sets the maximum NET DEBIT per spread in dollars — this is the real
 *   capital tied up and the maximum loss. A value of 5000 represents "$5,000+"
 *   and is treated as "no upper limit". Callers MUST filter on the per-contract
 *   debit, e.g. `setup.debit * 100 <= value`.
 *
 * - "credit-margin": for defined-risk CREDIT strategies (credit spreads, iron
 *   condors). You receive premium up front, but your broker locks up collateral
 *   equal to the max loss = (strike width − credit) × 100. The slider sets the
 *   maximum buying-power reduction (margin) per spread. A value of 5000
 *   represents "$5,000+" and is treated as "no upper limit". Callers MUST filter
 *   on the per-contract max loss, e.g. `setup.maxLoss * 100 <= value`.
 */
export function DollarAmountFilter({
  value,
  onChange,
  tooltipsEnabled = true,
  mode = "share-price",
}: {
  value: number
  onChange: (value: number) => void
  tooltipsEnabled?: boolean
  mode?: "share-price" | "net-debit" | "credit-margin"
}) {
  if (mode === "net-debit") {
    const isUnlimited = value >= 5000
    const display = isUnlimited ? "5,000+" : value.toLocaleString()

    return (
      <TooltipProvider>
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-4">
          <div className="flex items-start gap-2 mb-3">
            <Info className="h-5 w-5 text-emerald-700 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-gray-900 text-base">Dollar Amount Filtering (Step 1)</h3>
              <p className="text-xs text-gray-600 mt-1">
                Set the maximum net debit you are willing to pay per spread. This is the capital that gets tied up — and
                your maximum loss — on a defined-risk debit position. Only setups at or below this cost will appear in
                your results.
              </p>
            </div>
          </div>

          <ul className="list-disc list-inside space-y-1 ml-7 text-sm text-gray-700 mb-4">
            <li>
              <strong>Max Net Debit (per spread):</strong> The most you&apos;ll pay to open one spread (1 contract = 100
              shares)
            </li>
            <li>
              <strong>Capital at Risk:</strong> Equals the net debit — the long leg covers the short leg, so no stock
              collateral is required to open
            </li>
            <li>Set this to match your maximum allocation per trade</li>
          </ul>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Max Net Debit Slider */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                Max Net Debit (per spread)
                {tooltipsEnabled ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-emerald-50 border-emerald-200 text-gray-900">
                      <p className="font-semibold mb-1">Maximum Net Debit Filter</p>
                      <p className="text-sm">
                        Filters out any setup whose net debit per contract exceeds this value. The net debit is the
                        actual cash that leaves your account and the most you can lose on the trade.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </Label>
              <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-emerald-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-black text-gray-900 bg-emerald-100 px-3 py-1 rounded border border-emerald-300">
                    ${display}
                  </span>
                </div>
                <Slider
                  value={[value]}
                  onValueChange={(v) => onChange(v[0])}
                  min={50}
                  max={5000}
                  step={50}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>$50</span>
                  <span className="text-xs font-semibold">Max net debit</span>
                  <span>$5,000+</span>
                </div>
              </div>
            </div>

            {/* Capital at Risk Display */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                Capital at Risk (per spread)
                {tooltipsEnabled ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-emerald-50 border-emerald-200 text-gray-900">
                      <p className="font-semibold mb-1">Capital Tied Up</p>
                      <p className="text-sm">
                        For a debit spread, the capital tied up equals the net debit paid. The long leg covers the short
                        leg, so brokers treat it as defined-risk and do not require stock collateral to open.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </Label>
              <div className="p-4 rounded-lg border-2 border-emerald-300 bg-emerald-50 flex flex-col items-center justify-center min-h-[96px]">
                <span className="text-3xl font-black text-emerald-800">${display}</span>
                <span className="text-xs text-emerald-700 mt-1 font-semibold">per spread (1 contract)</span>
                <span className="text-[10px] text-emerald-600 mt-0.5">= max loss · no stock collateral required</span>
              </div>
            </div>
          </div>

          {/* Early-assignment settlement buffer notice */}
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Early-assignment reserve (risk only):</strong> If the short leg is assigned early, you may briefly
              need up to <strong>strike &times; 100</strong> in cash to settle the resulting shares before unwinding. This
              is a worst-case buffer — not capital required to open — and is shown per setup in the results below.
            </p>
          </div>
        </div>
      </TooltipProvider>
    )
  }

  if (mode === "credit-margin") {
    const isUnlimited = value >= 5000
    const display = isUnlimited ? "5,000+" : value.toLocaleString()

    return (
      <TooltipProvider>
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-4">
          <div className="flex items-start gap-2 mb-3">
            <Info className="h-5 w-5 text-emerald-700 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-gray-900 text-base">Dollar Amount Filtering (Step 1)</h3>
              <p className="text-xs text-gray-600 mt-1">
                Set the maximum buying power you are willing to tie up per spread. On a defined-risk credit trade your
                broker locks up collateral equal to the max loss — (strike width &minus; credit) &times; 100 — even
                though you collect premium up front. Only setups at or below this margin will appear in your results.
              </p>
            </div>
          </div>

          <ul className="list-disc list-inside space-y-1 ml-7 text-sm text-gray-700 mb-4">
            <li>
              <strong>Max Margin (per spread):</strong> The most buying power one spread will tie up (1 contract = 100
              shares)
            </li>
            <li>
              <strong>Margin = max loss:</strong> (strike width &minus; credit) &times; 100 — the credit you collect
              reduces this, it is not extra capital required
            </li>
            <li>Set this to match your maximum allocation per trade</li>
          </ul>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Max Margin Slider */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                Max Margin (per spread)
                {tooltipsEnabled ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-emerald-50 border-emerald-200 text-gray-900">
                      <p className="font-semibold mb-1">Maximum Margin Filter</p>
                      <p className="text-sm">
                        Filters out any setup whose buying-power reduction per contract exceeds this value. Margin equals
                        the max loss = (strike width &minus; credit) &times; 100.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </Label>
              <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-emerald-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-black text-gray-900 bg-emerald-100 px-3 py-1 rounded border border-emerald-300">
                    ${display}
                  </span>
                </div>
                <Slider
                  value={[value]}
                  onValueChange={(v) => onChange(v[0])}
                  min={50}
                  max={5000}
                  step={50}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>$50</span>
                  <span className="text-xs font-semibold">Max margin</span>
                  <span>$5,000+</span>
                </div>
              </div>
            </div>

            {/* Buying Power Tied Up Display */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                Buying Power Tied Up
                {tooltipsEnabled ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-emerald-50 border-emerald-200 text-gray-900">
                      <p className="font-semibold mb-1">Collateral Held</p>
                      <p className="text-sm">
                        For a defined-risk credit spread, the broker holds collateral equal to the max loss until the
                        position is closed or expires. The premium you collect is credited to your account and offsets
                        this requirement.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </Label>
              <div className="p-4 rounded-lg border-2 border-emerald-300 bg-emerald-50 flex flex-col items-center justify-center min-h-[96px]">
                <span className="text-3xl font-black text-emerald-800">${display}</span>
                <span className="text-xs text-emerald-700 mt-1 font-semibold">per spread (1 contract)</span>
                <span className="text-[10px] text-emerald-600 mt-0.5">= max loss · credit collected offsets this</span>
              </div>
            </div>
          </div>

          {/* Assignment / pin-risk notice */}
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Assignment &amp; pin risk (risk only):</strong> If a short leg finishes in or near the money you may
              be assigned and have to settle shares before your long leg covers you. Your loss is still capped at the
              margin shown above — this is a settlement-timing buffer, not extra capital required to open.
            </p>
          </div>
        </div>
      </TooltipProvider>
    )
  }

  // Default: share-price mode
  const isUnlimited = value >= 1000
  const display = isUnlimited ? "1,000+" : value.toLocaleString()

  return (
    <TooltipProvider>
      <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-4">
        <div className="flex items-start gap-2 mb-3">
          <Info className="h-5 w-5 text-emerald-700 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-gray-900 text-base">Dollar Amount Filtering (Step 1)</h3>
            <p className="text-xs text-gray-600 mt-1">
              Set the maximum stock price you are willing to trade. Only tickers at or below this price will appear in
              your scan results — the cash needed for 100 shares is shown instantly below.
            </p>
          </div>
        </div>

        <ul className="list-disc list-inside space-y-1 ml-7 text-sm text-gray-700 mb-4">
          <li>
            <strong>Max Stock Price:</strong> Only stocks at or below this price will be included in the scan
          </li>
          <li>
            <strong>Total Cash (100 shares):</strong> Max stock price &times; 100 shares
          </li>
          <li>Set this to match your available capital or your maximum allocation per trade</li>
        </ul>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Max Stock Price Slider */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              Max Stock Price
              {tooltipsEnabled ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs bg-emerald-50 border-emerald-200 text-gray-900">
                    <p className="font-semibold mb-1">Maximum Share Price Filter</p>
                    <p className="text-sm">
                      Filters out any ticker whose share price exceeds this value, so every result fits your chosen
                      price point.
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </Label>
            <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xl font-black text-gray-900 bg-emerald-100 px-3 py-1 rounded border border-emerald-300">
                  ${display}
                </span>
              </div>
              <Slider
                value={[value]}
                onValueChange={(v) => onChange(v[0])}
                min={1}
                max={1000}
                step={1}
                className="cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>$1</span>
                <span className="text-xs font-semibold">Max share price</span>
                <span>$1,000+</span>
              </div>
            </div>
          </div>

          {/* Total Cash Needed Display */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              Total Cash (100 shares)
              {tooltipsEnabled ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs bg-emerald-50 border-emerald-200 text-gray-900">
                    <p className="font-semibold mb-1">Capital Reference</p>
                    <p className="text-sm">
                      The cash required to control 100 shares at your max price. Calculated as Max Stock Price &times; 100
                      shares.
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </Label>
            <div className="p-4 rounded-lg border-2 border-emerald-300 bg-emerald-50 flex flex-col items-center justify-center min-h-[96px]">
              <span className="text-3xl font-black text-emerald-800">${(value * 100).toLocaleString()}</span>
              <span className="text-xs text-emerald-700 mt-1 font-semibold">${display} &times; 100 shares</span>
              <span className="text-[10px] text-emerald-600 mt-0.5">capital to control 100 shares</span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
