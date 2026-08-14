"use client"

/**
 * The headline card: the current Fear & Greed score, the historical scale it
 * sits on, how the score was calculated and which sources backed it.
 *
 * Split out of `components/market-sentiment.tsx` (P6-13) unchanged. What it
 * closed over — the payload, the refresh handler and the tooltips toggle — is
 * now props.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { Info } from "lucide-react"
import { BarChartIcon, InfoIcon } from "./icons"
import { ConditionalTooltip } from "@/components/ui/conditional-tooltip"
import type { MarketData } from "./market-data"

export function HistoricalScaleCard({
  marketData,
  refreshing,
  handleRefresh,
  tooltipsEnabled,
  setTooltipsEnabled,
}: {
  marketData: MarketData
  refreshing: boolean
  handleRefresh: () => void
  tooltipsEnabled: boolean
  setTooltipsEnabled: (v: boolean) => void
}) {
  return (
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BarChartIcon />
                  Fear & Greed Historical Scale
                  {tooltipsEnabled && (
                    <ConditionalTooltip enabled={tooltipsEnabled} content="The Fear & Greed Index measures market sentiment from 0-100. For options traders: Extreme Fear (0-24) often signals buying opportunities - consider selling puts or buying calls. Extreme Greed (75-100) suggests caution - consider protective puts or reducing exposure. Contrarian traders use extremes to fade crowd sentiment.">
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </ConditionalTooltip>
                  )}
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Visual representation of sentiment zones from extreme greed to extreme fear
                </p>
              </div>
              <div className="flex items-center gap-3">
                <TooltipsToggle enabled={tooltipsEnabled} onChange={setTooltipsEnabled} />
                <RefreshButton onClick={handleRefresh} isLoading={refreshing} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="relative">
                <div className="h-24 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-lg shadow-inner" />

                <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-bold">
                  <div className="text-center text-white drop-shadow-lg">
                    <div className="text-base">EXTREME</div>
                    <div>GREED</div>
                    <div className="text-[10px] mt-1">75-100</div>
                  </div>
                  <div className="text-center text-white drop-shadow-lg">
                    <div>GREED</div>
                    <div className="text-[10px] mt-1">56-74</div>
                  </div>
                  <div className="text-center text-gray-800 drop-shadow">
                    <div>NEUTRAL</div>
                    <div className="text-[10px] mt-1">45-55</div>
                  </div>
                  <div className="text-center text-white drop-shadow-lg">
                    <div>FEAR</div>
                    <div className="text-[10px] mt-1">25-44</div>
                  </div>
                  <div className="text-center text-white drop-shadow-lg">
                    <div className="text-base">EXTREME</div>
                    <div>FEAR</div>
                    <div className="text-[10px] mt-1">0-24</div>
                  </div>
                </div>

                {marketData && (
                  <div
                    className="absolute top-0 bottom-0 w-2 bg-black shadow-lg transition-all duration-500"
                    style={{ left: `calc(${100 - marketData.overallScore}% - 4px)` }}
                  >
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <div className="bg-black text-white px-4 py-2 rounded-lg shadow-xl">
                        <div className="text-xs font-semibold">TODAY</div>
                        <div className="text-2xl font-bold">{marketData.overallScore.toFixed(0)}</div>
                        <div className="text-xs text-center">{marketData.sentiment}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Score Calculation Methodology Display */}
              {marketData.calculationDetails && (
                <div className="col-span-full rounded-lg border-2 border-blue-100 bg-blue-50 p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-blue-900">
                    <InfoIcon />
                    Score Calculation Methodology
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-semibold text-blue-900">Formula:</span>
                        <p className="text-blue-800 font-mono text-xs mt-1">{marketData.calculationDetails.formula}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-blue-900">Weighting:</span>
                        <p className="text-blue-800">{marketData.calculationDetails.weighting}</p>
                      </div>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-900">Methodology:</span>
                      <p className="text-blue-800">{marketData.calculationDetails.methodology}</p>
                    </div>
                    {marketData.calculationDetails.individualScores && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <span className="font-semibold text-blue-900 block mb-2">Individual Indicator Scores:</span>
                        <div className="grid grid-cols-2 gap-2 text-xs text-blue-800 font-mono">
                          <div>I1 (Momentum): {marketData.calculationDetails.individualScores.i1_marketMomentum}</div>
                          <div>I2 (Strength): {marketData.calculationDetails.individualScores.i2_stockStrength}</div>
                          <div>I3 (Breadth): {marketData.calculationDetails.individualScores.i3_stockBreadth}</div>
                          <div>I4 (Put/Call): {marketData.calculationDetails.individualScores.i4_putCallRatio}</div>
                          <div>
                            I5 (Volatility): {marketData.calculationDetails.individualScores.i5_marketVolatility}
                          </div>
                          <div>
                            I6 (Safe Haven): {marketData.calculationDetails.individualScores.i6_safeHavenDemand}
                          </div>
                          <div>I7 (Junk Bonds): {marketData.calculationDetails.individualScores.i7_junkBondDemand}</div>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <span className="font-semibold text-blue-900 block mb-1">Data Sources:</span>
                      <p className="text-xs text-blue-700">
                        {marketData.dataSourcesUsed?.primary} •
                        {marketData.dataSourcesUsed?.nyseData
                          ? ` NYSE via ${marketData.dataSourcesUsed.nyseData} • `
                          : " "}
                        All indicators collected independently and calculated in real-time
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Historical Reference Points */}
              <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-xs font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <InfoIcon />
                  Historical Reference Points
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-red-600">COVID-19 Crash (Mar 2020):</span>
                    <span className="ml-1 text-gray-700">12 (Extreme Fear)</span>
                  </div>
                  <div>
                    <span className="font-semibold text-green-600">Meme Stock Peak (Feb 2021):</span>
                    <span className="ml-1 text-gray-700">89 (Extreme Greed)</span>
                  </div>
                  <div>
                    <span className="font-semibold text-red-600">2022 Bear Market Low:</span>
                    <span className="ml-1 text-gray-700">18 (Extreme Fear)</span>
                  </div>
                  <div>
                    <span className="font-semibold text-green-600">AI Rally Peak (Jul 2024):</span>
                    <span className="ml-1 text-gray-700">83 (Extreme Greed)</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
  )
}
