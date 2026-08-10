"use client"

/**
 * Pillar 2 — Risk Appetite & Volatility accordion section.
 *
 * Lifted verbatim from components/ccpi-dashboard.tsx (S-6 size-budget split).
 * Presentation only — the caller supplies the pillar score, provenance and the
 * narrowed indicators record; nothing here fetches or scores.
 */

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Info, TrendingDown } from "lucide-react"
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

import type { CCPIPillarProvenance } from "@/lib/ccpi/types"
import { PillarProvenanceLine, PillarScore } from "@/components/ccpi/pillar-bits"

export function PillarRiskAppetite({
  score,
  prov,
  indicators,
  tooltipsEnabled,
}: {
  score: number | null
  prov?: CCPIPillarProvenance
  indicators: Record<string, any>
  tooltipsEnabled: boolean
}) {
  return (
    <AccordionItem value="pillar2" className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline py-10">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-orange-600" />
            <span className="text-lg font-semibold">Pillar 2 - Risk Appetite & Volatility</span>
            <span className="text-sm text-gray-600">Weight: 30% | 4 indicators</span>
          </div>
          <PillarScore score={score} />
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-6 pt-4">
          <PillarProvenanceLine prov={prov} />
          {score === null && (
            <p className="text-sm text-gray-600 italic">
              Insufficient live/AI-sourced data to score this pillar — its weight is renormalized across the
              remaining pillars.
            </p>
          )}
          {/* Put/Call Ratio */}
          {indicators.putCallRatio !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  Put/Call Ratio
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-orange-50 border-orange-200">
                        <p className="font-semibold mb-1">Put/Call Ratio</p>
                        <p className="text-sm">
                          Measures the ratio of put options to call options traded. Indicates market hedging
                          activity.
                        </p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{"<"} 0.7:</strong> Extreme complacency, high crash risk
                          </li>
                          <li>
                            <strong>0.7 - 1.0:</strong> Normal hedging levels
                          </li>
                          <li>
                            <strong>{">"} 1.0:</strong> Elevated fear, potential bottom signal
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Options Impact:</strong> Low ratios signal complacency - consider buying puts.
                          High ratios often precede rallies.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.putCallRatio.toFixed(2)}</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    // Convention: good (low crash risk) on the LEFT/green, bad on the RIGHT/red.
                    // A HIGH put/call ratio = fear/hedging = lower crash risk (left/green).
                    // A LOW put/call ratio = complacency = high crash risk (right/red).
                    marginLeft: `${Math.min(100, Math.max(0, 100 - ((indicators.putCallRatio - 0.5) / 1.0) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Fearful: {">"}1.0</span>
                <span>Normal: 0.8-1.0</span>
                <span>Complacent: {"<"}0.7</span>
              </div>
            </div>
          )}

          {/* AAII Bullish Sentiment */}
          {indicators.aaiiBullish !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  AAII Bullish Sentiment
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-orange-50 border-orange-200">
                        <p className="font-semibold mb-1">AAII Bullish Sentiment</p>
                        <p className="text-sm">
                          Weekly survey of individual investors. Measures retail investor optimism.
                        </p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{"<"} 25%:</strong> Extreme pessimism, contrarian buy signal
                          </li>
                          <li>
                            <strong>25-45%:</strong> Normal sentiment range
                          </li>
                          <li>
                            <strong>{">"} 50%:</strong> Euphoria, high crash risk
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Options Impact:</strong> High bullishness = sell premium. Low bullishness = buy
                          calls on dips.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.aaiiBullish.toFixed(1)}%</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, Math.max(0, (indicators.aaiiBullish / 70) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Pessimism: {"<"}25%</span>
                <span>Normal: 30-40%</span>
                <span>Euphoria: {">"}50%</span>
              </div>
            </div>
          )}

          {/* AAII Bearish Sentiment */}
          {indicators.aaiiBearish !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  AAII Bearish Sentiment
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-orange-50 border-orange-200">
                        <p className="font-semibold mb-1">AAII Bearish Sentiment</p>
                        <p className="text-sm">
                          Percentage of investors expecting stocks to fall over the next 6 months.
                        </p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{">"} 50%:</strong> Extreme fear, contrarian buy signal
                          </li>
                          <li>
                            <strong>25-40%:</strong> Normal bearishness
                          </li>
                          <li>
                            <strong>{"<"} 20%:</strong> Complacency, caution warranted
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Options Impact:</strong> Extreme bearishness often marks bottoms - consider
                          selling puts.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.aaiiBearish.toFixed(1)}%</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    // Convention: good (low crash risk) on the LEFT/green, bad on the RIGHT/red.
                    // HIGH bearishness = extreme fear = contrarian buy / lower crash risk (left/green).
                    // LOW bearishness = complacency = higher crash risk (right/red).
                    marginLeft: `${Math.min(100, Math.max(0, 100 - (indicators.aaiiBearish / 60) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Fear: {">"}50%</span>
                <span>Normal: 25-35%</span>
                <span>Complacent: {"<"}20%</span>
              </div>
            </div>
          )}

          {/* AAII Spread (Bull-Bear) */}
          {indicators.aaiiSpread !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  AAII Bull-Bear Spread
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-orange-50 border-orange-200">
                        <p className="font-semibold mb-1">AAII Bull-Bear Spread</p>
                        <p className="text-sm">
                          Difference between bullish and bearish percentages. Net investor sentiment.
                        </p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{">"} +20:</strong> Extreme optimism, potential top
                          </li>
                          <li>
                            <strong>-10 to +10:</strong> Neutral sentiment
                          </li>
                          <li>
                            <strong>{"<"} -20:</strong> Extreme pessimism, potential bottom
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Options Impact:</strong> Extreme readings are contrarian indicators.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span
                  className={`font-bold ${indicators.aaiiSpread > 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {indicators.aaiiSpread > 0 ? "+" : ""}
                  {indicators.aaiiSpread.toFixed(1)}
                </span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, Math.max(0, ((indicators.aaiiSpread + 40) / 80) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Pessimistic: {"<"}-20</span>
                <span>Neutral: 0</span>
                <span>Euphoric: {">"}+20</span>
              </div>
            </div>
          )}

          {/* Fear & Greed Index */}
          {indicators.fearGreedIndex !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  CNN Fear & Greed Index
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-orange-50 border-orange-200">
                        <p className="font-semibold mb-1">CNN Fear & Greed Index</p>
                        <p className="text-sm">
                          Composite of 7 market indicators measuring investor sentiment from 0 (extreme fear) to
                          100 (extreme greed).
                        </p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>0-25:</strong> Extreme Fear - contrarian buy zone
                          </li>
                          <li>
                            <strong>26-50:</strong> Fear/Neutral
                          </li>
                          <li>
                            <strong>51-75:</strong> Greed
                          </li>
                          <li>
                            <strong>76-100:</strong> Extreme Greed - high crash risk
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Options Impact:</strong> Extreme greed = buy puts/reduce exposure. Extreme fear
                          = sell puts.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.fearGreedIndex}/100</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, indicators.fearGreedIndex)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Extreme Fear: 0-25</span>
                <span>Neutral: 45-55</span>
                <span>Extreme Greed: 75-100</span>
              </div>
            </div>
          )}

          {/* High Yield Spread */}
          {indicators.highYieldSpread !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  High Yield Credit Spread
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-orange-50 border-orange-200">
                        <p className="font-semibold mb-1">High Yield Credit Spread</p>
                        <p className="text-sm">
                          Difference between junk bond yields and Treasury yields. Measures credit risk appetite.
                        </p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{"<"} 3%:</strong> Low risk perception, complacency
                          </li>
                          <li>
                            <strong>3-5%:</strong> Normal credit conditions
                          </li>
                          <li>
                            <strong>{">"} 5%:</strong> Credit stress, recession risk
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Options Impact:</strong> Widening spreads signal risk-off - reduce bullish
                          positions.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.highYieldSpread.toFixed(2)}%</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, Math.max(0, ((indicators.highYieldSpread - 2) / 6) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Low Risk: {"<"}3%</span>
                <span>Normal: 3-5%</span>
                <span>Stress: {">"}6%</span>
              </div>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
