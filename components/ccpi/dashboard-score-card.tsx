"use client"

/**
 * The main CCPI score card, the regime it names, and the executive summary beneath it.
 *
 * Split out of `components/ccpi-dashboard.tsx` (P6-13) unchanged. What it closed
 * over is now props.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Activity, AlertTriangle, Info, Sparkles, TrendingDown } from "lucide-react"
import type { CCPIData } from "@/lib/ccpi/types"
import { countActiveWarnings, type getRegimeZone } from "@/lib/ccpi/calculations"

export function ScoreCard({
  data,
  ccpiScore,
  zone,
  executiveSummary,
  summaryLoading,
  indicatorCount,
  regimeColor,
  setIsChatOpen,
}: {
  data: CCPIData
  ccpiScore: number
  zone: ReturnType<typeof getRegimeZone>
  executiveSummary: string | null
  summaryLoading: boolean
  /** NULL when /api/ccpi did not report a count. Never coerced to a number —
   * the old `|| 29` invented a total for any falsy value. */
  indicatorCount: number | null
  regimeColor: string
  setIsChatOpen: (v: boolean) => void
}) {
  return (
    <>
        <Card className="border-2 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Crash &amp; Corrections Prediction Index (CCPI)</CardTitle>
                <CardDescription>AI-led market correction early warning oracle for options traders</CardDescription>
              </div>
              <Badge variant={zone.color === "red" ? "destructive" : "secondary"} className="text-lg px-4 py-2">
                {zone.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="pt-0">
                <div className="relative">
                  <div className="h-16 bg-gradient-to-r from-green-600 via-[20%] via-lime-500 via-[40%] via-yellow-500 via-[60%] via-orange-500 via-[80%] via-red-500 to-[100%] to-red-700 rounded-lg shadow-inner" />

                  <div className="absolute inset-0 flex items-center justify-between px-4 text-white text-xs font-bold">
                    <div className="text-center">
                      <div>LOW</div>
                      <div>RISK</div>
                      <div className="text-[10px]">0-19</div>
                    </div>
                    <div className="text-center">
                      <div>NORMAL</div>
                      <div className="text-[10px]">20-39</div>
                    </div>
                    <div className="text-center text-gray-800">
                      <div>CAUTION</div>
                      <div className="text-[10px]">40-59</div>
                    </div>
                    <div className="text-center">
                      <div>HIGH</div>
                      <div>ALERT</div>
                      <div className="text-[10px]">60-79</div>
                    </div>
                    <div className="text-center">
                      <div>CRASH</div>
                      <div>WATCH</div>
                      <div className="text-[10px]">80-100</div>
                    </div>
                  </div>

                  <div
                    className="absolute top-0 bottom-0 w-2 bg-black shadow-lg transition-all duration-500"
                    style={{ left: `calc(${ccpiScore}% - 4px)` }}
                  >
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <div className="bg-black text-white px-4 py-2 rounded-lg shadow-xl text-center">
                        <div className="text-xs font-semibold">TODAY</div>
                        <div className="text-2xl font-bold">{ccpiScore}</div>
                        <div className="text-xs">{zone.label}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">CCPI Score</p>
                <p className="text-5xl font-bold mb-2" style={{ color: regimeColor }}>
                  {data.ccpi}
                </p>
                <p className="text-xs text-gray-500">0 = No risk, 100 = Imminent crash</p>
              </div>

              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Data Quality</p>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-5xl font-bold text-blue-600">{data.certainty}%</p>
                </div>
                <p className="text-xs text-gray-500">Share of scoring weight backed by live data (AI estimates count half)</p>
              </div>

              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Current Regime</p>
                <p className="text-2xl font-bold mb-1" style={{ color: regimeColor }}>
                  {data.regime.name}
                </p>
                <p className="text-xs text-gray-600 px-2">{data.regime.description}</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-base text-blue-900 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  Executive Summary
                </h4>
                <div className="flex items-center gap-2">
                  {summaryLoading && <Activity className="h-4 w-4 animate-spin text-emerald-600" />}
                  <button
                    onClick={() => setIsChatOpen(true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                    <span className="text-white font-semibold text-xs">Ask AI</span>
                  </button>
                </div>
              </div>

              <div className="mb-4 p-4 bg-white rounded-lg border border-blue-200 shadow-sm">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 leading-relaxed">
                      {executiveSummary || (
                        <>
                          {data.ccpi <= 19 && (
                            <>
                              <span className="text-green-700">LOW RISK Environment (CCPI: {data.ccpi}).</span> Market
                              conditions are favorable with minimal crash signals active.
                              <span className="font-bold text-gray-800"> Options Implication:</span> This is an ideal
                              environment for premium selling strategies. Consider selling puts on quality stocks, iron
                              condors on stable indices, or covered calls. Low volatility means cheaper options - buying
                              strategies may underperform.
                            </>
                          )}
                          {data.ccpi >= 20 && data.ccpi <= 39 && (
                            <>
                              <span className="text-blue-700">NORMAL Market Conditions (CCPI: {data.ccpi}).</span>{" "}
                              Standard market environment with moderate warning signals. Risk remains manageable.
                              <span className="font-bold text-gray-800"> Options Implication:</span> Balanced approach
                              recommended. Credit spreads with defined risk work well here. Consider 30-45 DTE
                              positions. Monitor for regime changes and be prepared to adjust positions if CCPI rises
                              above 40.
                            </>
                          )}
                          {data.ccpi >= 40 && data.ccpi <= 59 && (
                            <>
                              <span className="text-yellow-700">CAUTION - Elevated Risk (CCPI: {data.ccpi}).</span>{" "}
                              Multiple warning signals active. Market showing stress but not yet in crisis.
                              <span className="font-bold text-gray-800"> Options Implication:</span> Reduce position
                              sizes and tighten stop-losses. Consider protective puts on long equity positions. Avoid
                              selling naked options. VIX likely elevated - look for mean reversion plays after spikes.
                            </>
                          )}
                          {data.ccpi >= 60 && data.ccpi <= 79 && (
                            <>
                              <span className="text-orange-700">
                                HIGH ALERT - Significant Risk (CCPI: {data.ccpi}).
                              </span>{" "}
                              Serious crash signals present. Market vulnerable to sharp correction.
                              <span className="font-bold text-gray-800"> Options Implication:</span> Defensive
                              positioning critical. Consider long puts or put spreads for protection. Close short
                              premium positions. Cash is a position - preserve capital. If trading, use longer-dated
                              options to ride out volatility.
                            </>
                          )}
                          {data.ccpi >= 80 && (
                            <>
                              <span className="text-red-700">CRASH WATCH - Extreme Risk (CCPI: {data.ccpi}).</span>{" "}
                              Maximum warning state. Multiple crash amplifiers active.
                              <span className="font-bold text-gray-800"> Options Implication:</span> Capital
                              preservation is paramount. Consider VIX calls or SPY puts as crash insurance. Do NOT sell
                              premium - gamma risk is extreme. Wait for VIX spike above 35 before considering mean
                              reversion trades.
                            </>
                          )}
                        </>
                      )}
                    </p>
                    {executiveSummary && <p className="text-xs text-gray-500 mt-2 italic">Generated by Grok xAI</p>}
                  </div>
                </div>
              </div>

              {/* Was "Weekly Outlook & Options Trading Tips", and each CCPI band
                  carried a list of options strategies under a "Recommended
                  Strategies This Week" heading. Those lists are gone, per the same
                  owner decision that removed the "Options Strategy Guide by CCPI
                  Crash Risk Level" card in 19f4778: the CCPI is a market-wide
                  crash index and has not demonstrated lead time, so it is not a
                  basis for recommending trades. The low-risk list also named AAPL,
                  MSFT and GOOGL as put candidates — the index reads nothing about
                  any individual ticker — and quoted a "70% POP" nothing computes.
                  "Weekly" went too: the index refreshes on ISR, not on a week.
                  What survives is the regime sentence, every number in which is
                  measured — the band, the active canary count, the indicator total
                  and the certainty. */}
              <div className="p-4 bg-white rounded-lg border border-blue-200 shadow-sm">
                <h5 className="font-semibold text-gray-800 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-primary" />
                  Current Regime
                </h5>
                <div className="space-y-2 text-sm text-gray-700">
                  {data.ccpi <= 39 ? (
                    <p>
                      <span className="font-semibold text-green-700">Regime: {data.regime.name}</span> - With{" "}
                      {countActiveWarnings(data.canaries)} of {indicatorCount ?? "—"} warning signals active and{" "}
                      {data.certainty}% data quality, the market is in a {data.ccpi <= 19 ? "low-risk" : "normal"}{" "}
                      state.
                    </p>
                  ) : data.ccpi <= 59 ? (
                    <p>
                      <span className="font-semibold text-yellow-700">Regime: {data.regime.name}</span> - With{" "}
                      {countActiveWarnings(data.canaries)} of {indicatorCount ?? "—"} warning signals active,
                      elevated caution is warranted. Monitor for regime shift.
                    </p>
                  ) : (
                    <p>
                      <span className="font-semibold text-red-700">Regime: {data.regime.name}</span> - With{" "}
                      {countActiveWarnings(data.canaries)} of {indicatorCount ?? "—"} warning signals active and
                      CCPI at {data.ccpi}, extreme caution required.
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    The index describes market conditions. It does not select trades — no strategy on this site is
                    chosen from the CCPI band.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
    </>
  )
}
