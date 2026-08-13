"use client"

/**
 * The index-trend scale, the score breakdown and the per-input contribution tiles.
 *
 * Split out of `components/trend-analysis.tsx` (P6-13) unchanged. What it closed
 * over is now props.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { Activity, AlertTriangle, Info, Shield, Target, TrendingUp } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ContributionCard } from "./contribution-card"
import { ConditionalTooltip } from "./trend-tooltip"
import { getStrengthColor } from "./style-maps"
import type { TrendData } from "./trend-types"

export function HistoricalScaleSection({
  selectedItem,
  loading,
  fetchData,
  tooltipsEnabled,
  setTooltipsEnabled,
}: {
  selectedItem: TrendData
  loading: boolean
  fetchData: () => void
  tooltipsEnabled: boolean
  setTooltipsEnabled: (v: boolean) => void
}) {
  return (
    <>
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Index Trend Historical Scale
                  {tooltipsEnabled && (
                    <ConditionalTooltip enabled={tooltipsEnabled} content="The Index Trend Scale measures overall market direction from 0-100. For options traders: scores above 60 favor bullish strategies (call spreads, covered calls), while scores below 40 favor bearish strategies (put spreads, protective puts). Extreme readings (>80 or <20) often signal reversal opportunities.">
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </ConditionalTooltip>
                  )}
                </CardTitle>
                <CardDescription>
                  Assess market and sector trends with technical indicators to make informed trading decisions
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <TooltipsToggle enabled={tooltipsEnabled} onChange={setTooltipsEnabled} />
                <RefreshButton onClick={fetchData} isLoading={loading} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="relative">
              <div className="relative h-20 rounded-lg overflow-hidden shadow-sm border border-gray-300">
                <div className="absolute inset-0 h-24 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-lg shadow-inner" />

                <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-bold">
                  {/* Extreme Bullish - LEFT/GREEN */}
                  <div className="text-center text-white drop-shadow-lg">
                    <div className="text-base">EXTREME</div>
                    <div>BULLISH</div>
                    <div className="text-[10px] mt-1">81-100</div>
                  </div>
                  {/* Bullish */}
                  <div className="text-center text-white drop-shadow-lg">
                    <div>BULLISH</div>
                    <div className="text-[10px] mt-1">61-80</div>
                  </div>
                  {/* Neutral */}
                  <div className="text-center text-gray-800 drop-shadow">
                    <div>NEUTRAL</div>
                    <div className="text-[10px] mt-1">41-60</div>
                  </div>
                  {/* Bearish */}
                  <div className="text-center text-white drop-shadow-lg">
                    <div>BEARISH</div>
                    <div className="text-[10px] mt-1">21-40</div>
                  </div>
                  {/* Extreme Bearish - RIGHT/RED */}
                  <div className="text-center text-white drop-shadow-lg">
                    <div className="text-base">EXTREME</div>
                    <div>BEARISH</div>
                    <div className="text-[10px] mt-1">0-20</div>
                  </div>
                </div>
              </div>

              {/* `?? 50` parked the needle dead-centre on "Neutral" whenever
                  momentum was unknown — the same defect the route was just fixed
                  for, one layer up. No reading, no needle. */}
              {selectedItem.momentumStrength === null ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <span className="text-sm font-semibold text-gray-600">
                    No momentum reading — not enough price history
                  </span>
                </div>
              ) : (
                <div
                  className="absolute top-0 bottom-0 w-2 bg-black shadow-lg transition-all duration-500"
                  style={{
                    left: `calc(${Math.max(0, Math.min(100, 100 - selectedItem.momentumStrength))}% - 4px)`,
                  }}
                >
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <div className="bg-black text-white px-4 py-2 rounded-lg shadow-xl">
                      <div className="text-xs font-semibold">TODAY</div>
                      <div className="text-2xl font-bold">{Math.round(selectedItem.momentumStrength)}</div>
                      <div className="text-xs text-center">
                        {selectedItem.momentumStrength >= 81
                          ? "Extreme Bullish"
                          : selectedItem.momentumStrength >= 61
                            ? "Bullish"
                            : selectedItem.momentumStrength >= 41
                              ? "Neutral"
                              : selectedItem.momentumStrength >= 21
                                ? "Bearish"
                                : "Extreme Bearish"}
                      </div>
                    </div>
                    <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-black mx-auto" />
                  </div>
                </div>
              )}
            </div>

            {/* Context information */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-600 mb-1">Current Reading</p>
                {/* Missed by the P6-68 pass, which fixed the gauge and the tile
                    and left this one. `?? 0` on a nullable momentum renders
                    "0/100" — the bottom of the scale, Extreme Bearish, from an
                    absent reading. */}
                <p className="text-lg font-bold text-gray-900">
                  {selectedItem.momentumStrength === null ? "—" : `${selectedItem.momentumStrength.toFixed(0)}/100`}
                </p>
                <p className="text-xs text-gray-600 mt-1">Momentum strength indicator</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-600 mb-1">Trend Confidence</p>
                <p className="text-lg font-bold text-gray-900">{selectedItem.trendConfidence.toFixed(0)}%</p>
                <p className="text-xs text-gray-600 mt-1">Signal reliability</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-600 mb-1">Trend Strength</p>
                <p className={`text-lg font-bold ${getStrengthColor(selectedItem.trendStrength)}`}>
                  {selectedItem.trendStrength}
                </p>
                <p className="text-xs text-gray-600 mt-1">Directional power</p>
              </div>
            </div>

            {selectedItem.indicatorContributions && (
              <div className="mt-6 border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-bold text-gray-900">Momentum Score Breakdown</h4>
                </div>
                <p className="text-xs text-gray-600 mb-4">
                  Starting from neutral baseline (50), each indicator adds or subtracts points based on bullish/bearish
                  signals
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* RSI Contribution */}
                  <ContributionCard
                    label="RSI"
                    c={selectedItem.indicatorContributions.rsi}
                    digits={1}
                    verdict={(v) => (v > 55 ? "Bullish momentum" : v < 45 ? "Bearish momentum" : "Neutral")}
                  />
                  <ContributionCard
                    label="MACD"
                    c={selectedItem.indicatorContributions.macd}
                    digits={2}
                    verdict={(v) => (v > 0 ? "Bullish trend" : "Bearish trend")}
                  />
                  <ContributionCard
                    label="20-Day Price Change"
                    c={selectedItem.indicatorContributions.priceChange}
                    digits={2}
                    suffix="%"
                    verdict={(v) => (v > 0 ? "Positive momentum" : "Negative momentum")}
                  />
                  <ContributionCard
                    label="Volume Trend"
                    c={selectedItem.indicatorContributions.volumeTrend}
                    digits={1}
                    suffix="%"
                    verdict={(v) => (v > 0 ? "Rising volume" : "Falling volume")}
                  />
                </div>

                {/* Visual Summary */}
                <div className="mt-4 bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Calculation Summary</p>
                  <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
                    <span>Baseline: 50</span>
                    {(["rsi", "macd", "priceChange", "volumeTrend"] as const).map((k) => {
                      const c = selectedItem.indicatorContributions![k].contribution
                      // An indicator with no data contributes nothing and says so.
                      // It used to print "+0.0", which reads as a measured zero.
                      if (c === null) return <span key={k} className="text-gray-400">(no {k} data)</span>
                      return (
                        <span key={k} className={c >= 0 ? "text-green-600" : "text-red-600"}>
                          {c >= 0 ? "+" : ""}
                          {c.toFixed(1)}
                        </span>
                      )
                    })}
                    <span className="font-bold">
                      = {selectedItem.momentumStrength === null ? "no reading" : selectedItem.momentumStrength.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {selectedItem.trendSignals && (
              <div className="mt-6 border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-4 w-4 text-purple-600" />
                  <h4 className="text-sm font-bold text-gray-900">Trend Confidence Signals</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-xs font-semibold text-green-700 mb-2">Bullish Signals</p>
                    <p className="text-3xl font-bold text-green-600">
                      {selectedItem.trendSignals.bullish}/{selectedItem.trendSignals.total}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      {((selectedItem.trendSignals.bullish / selectedItem.trendSignals.total) * 100).toFixed(0)}%
                      confidence
                    </p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-xs font-semibold text-red-700 mb-2">Bearish Signals</p>
                    <p className="text-3xl font-bold text-red-600">
                      {selectedItem.trendSignals.bearish}/{selectedItem.trendSignals.total}
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      {((selectedItem.trendSignals.bearish / selectedItem.trendSignals.total) * 100).toFixed(0)}%
                      confidence
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-3">
                  Signals analyzed: MA alignment (3 pts), RSI (1 pt), MACD (2 pts), Momentum (2 pts), Volume (1 pt)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

    </>
  )
}
