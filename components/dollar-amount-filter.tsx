"use client"

import { Info } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * Shared "Dollar Amount Filtering (Step 1)" card used across every SCAN scanner.
 *
 * It exposes a single max-share-price control. A value of 1000 represents
 * "$1,000+" and is treated by callers as "no upper limit". Callers MUST apply
 * the returned value to their result set (e.g. `setup.currentPrice <= value`)
 * so high-priced tickers are actually filtered out.
 */
export function DollarAmountFilter({
  value,
  onChange,
  tooltipsEnabled = true,
}: {
  value: number
  onChange: (value: number) => void
  tooltipsEnabled?: boolean
}) {
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
