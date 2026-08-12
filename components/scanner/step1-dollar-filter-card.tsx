"use client"

// Step 1: Dollar Amount Filtering card. JSX extracted verbatim from
// components/wheel-scanner.tsx (Phase 4 modularization — zero behavior change).

import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { stepTitled } from "./steps"

interface Step1DollarFilterCardProps {
  maxStockPrice: number[]
  setMaxStockPrice: (value: number[]) => void
  tooltipsEnabled: boolean
}

export function Step1DollarFilterCard({ maxStockPrice, setMaxStockPrice, tooltipsEnabled }: Step1DollarFilterCardProps) {
  return (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-3">
                <Info className="h-5 w-5 text-emerald-700 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{stepTitled("dollarFilter", "Dollar Amount Filtering")}</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    Set the maximum stock price you are willing to trade. Selling a put requires 100 shares of cash
                    collateral — the total cash needed is shown instantly below.
                  </p>
                </div>
              </div>

              <ul className="list-disc list-inside space-y-1 ml-7 text-sm text-gray-700 mb-4">
                <li>
                  <strong>Max Stock Price:</strong> Only stocks at or below this price will be included in the scan
                </li>
                <li>
                  <strong>Total Cash Needed:</strong> Max stock price &times; 100 shares (standard put contract size)
                </li>
                <li>
                  Set this to match your available capital or your maximum allocation per trade
                </li>
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
                            Filters out stocks whose share price exceeds this value. When you sell a put, you must hold
                            100 &times; strike price in cash as collateral.
                          </p>
                          <ul className="text-sm mt-1 space-y-1">
                            <li>
                              <strong>Low ($50-$150):</strong> Smaller capital requirement, more accessible
                            </li>
                            <li>
                              <strong>High ($300-$1000):</strong> Larger companies, higher premiums, more capital needed
                            </li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-emerald-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-black text-gray-900 bg-emerald-100 px-3 py-1 rounded border border-emerald-300">
                        ${maxStockPrice[0] === 1000 ? "1,000+" : maxStockPrice[0].toLocaleString()}
                      </span>
                    </div>
                    <Slider
                      id="maxStockPrice"
                      value={maxStockPrice}
                      onValueChange={setMaxStockPrice}
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
                    Total Cash Needed (Per Contract)
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-emerald-50 border-emerald-200 text-gray-900">
                          <p className="font-semibold mb-1">Cash-Secured Put Collateral</p>
                          <p className="text-sm">
                            This is the maximum cash you need to hold per contract when selling a cash-secured put.
                            Calculated as: Max Stock Price &times; 100 shares.
                          </p>
                          <p className="text-sm mt-1">
                            Actual cash required will vary based on the strike price chosen, which is typically set below
                            the current market price.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <div className="p-4 rounded-lg border-2 border-emerald-300 bg-emerald-50 flex flex-col items-center justify-center min-h-[96px]">
                    <span className="text-3xl font-black text-emerald-800">
                      ${(maxStockPrice[0] * 100).toLocaleString()}
                    </span>
                    <span className="text-xs text-emerald-700 mt-1 font-semibold">
                      ${maxStockPrice[0] === 1000 ? "1,000+" : maxStockPrice[0].toLocaleString()} &times; 100 shares
                    </span>
                    <span className="text-[10px] text-emerald-600 mt-0.5">
                      maximum cash collateral per contract
                    </span>
                  </div>
                </div>
              </div>
            </div>
  )
}
