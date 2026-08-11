"use client"

// Step 2: Smart Pre-Filtering card + its scan button, progress bar, and loaded-
// tickers confirmation. JSX extracted verbatim from components/wheel-scanner.tsx
// (Phase 4 modularization — zero behavior change).

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Info, Loader2, Filter } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  PRE_FILTER_MARKET_CAP_TIERS,
  PRE_FILTER_VOLATILITY_TIERS,
  getTopRankedLabel,
} from "./constants"

interface Step2PreFilterCardProps {
  preFilterMarketCap: number[]
  setPreFilterMarketCap: (value: number[]) => void
  preFilterLiquidity: number[]
  setPreFilterLiquidity: (value: number[]) => void
  preFilterTopRanked: number[]
  setPreFilterTopRanked: (value: number[]) => void
  preFilterVolatility: number[]
  setPreFilterVolatility: (value: number[]) => void
  tooltipsEnabled: boolean
  isLoadingPreFilter: boolean
  isScanning: boolean
  isScanningTechnicals: boolean
  preFilterProgress: number
  preFilterCurrentTicker: string
  preFilterCount: number
  onScan: () => void
}

export function Step2PreFilterCard({
  preFilterMarketCap,
  setPreFilterMarketCap,
  preFilterLiquidity,
  setPreFilterLiquidity,
  preFilterTopRanked,
  setPreFilterTopRanked,
  preFilterVolatility,
  setPreFilterVolatility,
  tooltipsEnabled,
  isLoadingPreFilter,
  isScanning,
  isScanningTechnicals,
  preFilterProgress,
  preFilterCurrentTicker,
  preFilterCount,
  onScan,
}: Step2PreFilterCardProps) {
  return (
    <>
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-3">
                <Info className="h-5 w-5 text-blue-700 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Smart Pre-Filtering (Step 2)</h3>
                  {/* Used to read "All stocks are pre-qualified for active options
                      markets." Nothing in /api/polygon-tickers checks that — the
                      universe is filtered on size, liquidity, price and range only,
                      and the single mention of options in that route is a comment.
                      A ticker with no chain gets carried to Step 4 and dropped
                      there, which is fine, but it is not what the sentence promised
                      on a put-selling scanner. */}
                  <p className="text-xs text-gray-600 mt-1">
                    Customize your starting universe with advanced filters — size, liquidity, price and daily range.
                    Options availability is <strong>not</strong> checked here; Step 4 is where a missing chain shows up.
                  </p>
                </div>
              </div>

              <ul className="list-disc list-inside space-y-1 ml-7 text-sm text-gray-700 mb-4">
                <li>
                  <strong>Market Cap:</strong> Filter by company size (adjustable below)
                </li>
                <li>
                  <strong>Liquidity:</strong> Minimum recent daily trading volume - uses most recent trading day data,
                  not 30-day average (adjustable below)
                </li>
                {/* The S&P 500 / Nasdaq-100 / Dow wording described the FALLBACK
                    path only — `MAJOR_INDEX_TICKERS`, a hardcoded 100-name list
                    the route uses when FMP and grouped bars are both unavailable.
                    The path that normally runs is FMP's screener across NYSE and
                    Nasdaq, which is a different and much larger universe. */}
                <li>
                  <strong>Top By Market Cap:</strong> Largest companies by market capitalization, ranked across NYSE
                  and Nasdaq. If that screener is unavailable the scan falls back to a fixed list of ~100 large-cap
                  index names (adjustable below)
                </li>
                <li>
                  <strong>Min Volatility:</strong> Minimum daily price range — volatile stocks carry richer option
                  premiums (adjustable below)
                </li>
              </ul>

              {/* Step 2 Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    Min Market Cap
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">Market Capitalization Filter</p>
                          <p className="text-sm">
                            Filters stocks by total company value (shares × price). For put selling:
                          </p>
                          <ul className="text-sm mt-1 space-y-1">
                            <li>
                              <strong>Higher ($10B+):</strong> More stable, liquid options, lower assignment risk
                            </li>
                            <li>
                              <strong>Lower ($1B-$10B):</strong> Higher premiums but more volatility risk
                            </li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                        {PRE_FILTER_MARKET_CAP_TIERS[preFilterMarketCap[0]]?.label ?? "Any"}
                      </span>
                    </div>
                    <Slider
                      id="preFilterMarketCap"
                      value={preFilterMarketCap}
                      onValueChange={setPreFilterMarketCap}
                      min={0}
                      max={PRE_FILTER_MARKET_CAP_TIERS.length - 1}
                      step={1}
                      className="cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Any</span>
                      <span className="text-xs font-semibold">Company size filter</span>
                      <span>{PRE_FILTER_MARKET_CAP_TIERS[PRE_FILTER_MARKET_CAP_TIERS.length - 1].label}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    Min Recent Day Volume
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">Trading Volume Filter</p>
                          <p className="text-sm">Daily shares traded. Critical for put sellers:</p>
                          <ul className="text-sm mt-1 space-y-1">
                            <li>
                              <strong>Higher (5M+):</strong> Tighter bid-ask spreads, easier exit
                            </li>
                            <li>
                              <strong>Lower (&lt;2M):</strong> Wider spreads = worse fills, harder to close
                            </li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                        {preFilterLiquidity[0]}M
                      </span>
                    </div>
                    <Slider
                      id="preFilterLiquidity"
                      value={preFilterLiquidity}
                      onValueChange={setPreFilterLiquidity}
                      min={0.5}
                      max={50}
                      step={0.5}
                      className="cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0.5M</span>
                      <span className="text-xs font-semibold">Ensure liquidity</span>
                      <span>50M</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    Top By Market Cap
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">Top Companies Selector</p>
                          <p className="text-sm">Limits scan to largest companies by market cap:</p>
                          <ul className="text-sm mt-1 space-y-1">
                            <li>
                              <strong>Top 10-50:</strong> Blue chips, most stable, lowest premiums
                            </li>
                            <li>
                              <strong>Top 100-500:</strong> Balance of safety and returns
                            </li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                        {getTopRankedLabel(preFilterTopRanked[0])}
                      </span>
                    </div>
                    <Slider
                      id="preFilterTopRanked"
                      value={preFilterTopRanked}
                      onValueChange={(val) => {
                        // Snap to specific points for better UX
                        const snapped = val[0] <= 16 ? [0] : val[0] <= 50 ? [33] : val[0] <= 83 ? [66] : [100]
                        setPreFilterTopRanked(snapped)
                      }}
                      min={0}
                      max={100}
                      step={1}
                      className="cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>Top 500</span>
                      <span className="text-[9px]">Top By Market Cap</span>
                      <span>Top 10</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    Min Volatility
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">Volatility Filter (Premium Richness)</p>
                          <p className="text-sm">
                            Minimum daily price range ((high − low) ÷ close). Volatility is what makes option premiums
                            rich — it tracks implied volatility closely:
                          </p>
                          <ul className="text-sm mt-1 space-y-1">
                            <li>
                              <strong>Higher (4%+):</strong> Rich premiums (HOOD, SOFI, TSLA territory), bigger swings
                            </li>
                            <li>
                              <strong>Any:</strong> No filter — includes calm, low-premium names
                            </li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                        {PRE_FILTER_VOLATILITY_TIERS[preFilterVolatility[0]]?.label ?? "Any"}
                      </span>
                    </div>
                    <Slider
                      id="preFilterVolatility"
                      value={preFilterVolatility}
                      onValueChange={setPreFilterVolatility}
                      min={0}
                      max={PRE_FILTER_VOLATILITY_TIERS.length - 1}
                      step={1}
                      className="cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Any</span>
                      <span className="text-xs font-semibold">Premium richness</span>
                      <span>{PRE_FILTER_VOLATILITY_TIERS[PRE_FILTER_VOLATILITY_TIERS.length - 1].label}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          <Button
            onClick={onScan}
            disabled={isLoadingPreFilter || isScanning || isScanningTechnicals}
            size="lg"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white text-lg font-bold py-6 transition-all hover:scale-105 mt-4"
          >
            {isLoadingPreFilter ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading Tickers...
              </>
            ) : (
              <>
                <Filter className="mr-2 h-5 w-5" />
                Scan for Potential Stocks (Step 2)
              </>
            )}
          </Button>

          {isLoadingPreFilter && preFilterProgress > 0 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-blue-900">{preFilterCurrentTicker || "Loading..."}</span>
                <span className="text-sm font-bold text-blue-900">{preFilterProgress}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${preFilterProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {preFilterCount > 0 && (
            <p className="text-sm text-green-700 font-semibold mt-2 text-center">
              ✅ {preFilterCount} tickers loaded and ready for Step 3 scan
            </p>
          )}
    </>
  )
}
