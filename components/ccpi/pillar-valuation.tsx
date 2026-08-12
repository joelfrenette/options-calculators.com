"use client"

/**
 * Pillar 3 — Valuation & Market Structure accordion section.
 *
 * Lifted verbatim from components/ccpi-dashboard.tsx (S-6 size-budget split).
 * Presentation only — the caller supplies the pillar score, provenance and the
 * narrowed indicators record; nothing here fetches or scores.
 */

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Info, DollarSign } from "lucide-react"
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

import type { CCPIPillarProvenance } from "@/lib/ccpi/types"
import { PillarProvenanceLine, PillarScore } from "@/components/ccpi/pillar-bits"

export function PillarValuation({
  score,
  prov,
  indicators,
  tooltipsEnabled,
  badge,
  caveat,
}: {
  score: number | null
  prov?: CCPIPillarProvenance
  indicators: Record<string, any>
  tooltipsEnabled: boolean
  /** Short role label shown beside the title, visible while collapsed. */
  badge?: string
  /** Longer caveat shown when the section is open. */
  caveat?: string
}) {
  return (
    <AccordionItem value="pillar3" className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline py-10">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <span className="text-lg font-semibold">Pillar 3 - Valuation & Market Structure</span>
            <span className="text-sm text-gray-600">Weight: 15% | 7 indicators</span>
            {badge && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border border-gray-300 text-gray-600">
                {badge}
              </span>
            )}
          </div>
          <PillarScore score={score} />
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-6 pt-4">
          {caveat && <p className="text-xs text-gray-500 italic">{caveat}</p>}
          <PillarProvenanceLine prov={prov} />
          {score === null && (
            <p className="text-sm text-gray-600 italic">
              Insufficient live/AI-sourced data to score this pillar — its weight is renormalized across the
              remaining pillars.
            </p>
          )}
          {/* S&P 500 P/E */}
          {indicators.spxPE != null && (
            <div className="space-y-2">
              {/* Added tooltip to S&P 500 P/E indicator */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  S&P 500 Forward P/E
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-green-50 border-green-200">
                        <p className="font-semibold mb-1">S&P 500 Forward P/E Ratio</p>
                        <p className="text-sm">Price-to-Earnings ratio based on estimated future earnings.</p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{"<"} 15:</strong> Undervalued, low crash risk
                          </li>
                          <li>
                            <strong>16-20:</strong> Fair value, moderate risk
                          </li>
                          <li>
                            <strong>{">"} 20:</strong> Overvalued, high crash risk
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> High P/E ratios indicate expensive markets vulnerable to
                          corrections
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.spxPE}</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, ((indicators.spxPE - 10) / 15) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Historical Median: 16</span>
                <span>Current: {indicators.spxPE}</span>
              </div>
            </div>
          )}

          {/* P/S Ratio */}
          {indicators.spxPS != null && (
            <div className="space-y-2">
              {/* Added tooltip to S&P 500 P/S indicator */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  S&P 500 Price-to-Sales
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-green-50 border-green-200">
                        <p className="font-semibold mb-1">S&P 500 Price-to-Sales Ratio</p>
                        <p className="text-sm">Market capitalization relative to total company revenues.</p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{"<"} 2.5:</strong> Undervalued, low risk
                          </li>
                          <li>
                            <strong>2.5 - 3.0:</strong> Fair value, moderate risk
                          </li>
                          <li>
                            <strong>{">"} 3.0:</strong> Overvalued, high crash risk
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> High P/S ratios indicate markets trading at a premium to sales,
                          vulnerable to price drops
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.spxPS}</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, ((indicators.spxPS - 1) / 2) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Normal: {"<"}2.5</span>
                <span>Elevated: {">"}3.0</span>
              </div>
            </div>
          )}

          {/* Buffett Indicator */}
          {indicators.buffettIndicator != null && (
            <div className="space-y-2">
              {/* Added tooltip to Buffett Indicator */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  Buffett Indicator (Market Cap / GDP)
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-red-50 border-red-200">
                        <p className="font-semibold mb-1">Buffett Indicator</p>
                        <p className="text-sm">Compares total stock market capitalization to GDP.</p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{"<"} 120%:</strong> Undervalued, low crash risk
                          </li>
                          <li>
                            <strong>120-150%:</strong> Fair value, moderate risk
                          </li>
                          <li>
                            <strong>150-180%:</strong> Elevated risk
                          </li>
                          <li>
                            <strong>{">"} 200%:</strong> Historically signifies market bubbles, extreme crash risk
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> A high Buffett Indicator suggests the market is significantly
                          overvalued relative to the economy's productive capacity
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.buffettIndicator.toFixed(0)}%</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, Math.max(0, (indicators.buffettIndicator - 80) / 1.6))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Undervalued: {"<"}120%</span>
                <span>Fair: 120-150%</span>
                <span>Warning: 150-180%</span>
                <span className="text-red-600">Danger: {">"}200%</span>
              </div>
            </div>
          )}

          {indicators.qqqPE != null && (
            <div className="space-y-2">
              {/* Added tooltip to QQQ P/E indicator */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  QQQ Forward P/E (AI-Specific Valuation)
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                        <p className="font-semibold mb-1">QQQ Forward P/E Ratio</p>
                        <p className="text-sm">
                          Measures the valuation of the Nasdaq-100, often driven by tech and AI growth
                          expectations.
                        </p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{"<"} 25:</strong> Fairly valued or undervalued
                          </li>
                          <li>
                            <strong>25-35:</strong> Elevated valuation, moderate risk
                          </li>
                          <li>
                            <strong>{">"} 35:</strong> Bubble territory, very high crash risk
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> High P/E in tech can lead to sharp corrections when growth
                          expectations are not met
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.qqqPE.toFixed(1)}</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, ((indicators.qqqPE - 15) / 30) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Fair: {"<"}25</span>
                <span>Elevated: 30-35</span>
                <span>Bubble: {">"}40</span>
              </div>
            </div>
          )}

          {indicators.mag7Concentration != null && (
            <div className="space-y-2">
              {/* Added tooltip to Magnificent 7 Concentration */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  Magnificent 7 Concentration (Crash Contagion Risk)
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-red-50 border-red-200">
                        <p className="font-semibold mb-1">Magnificent 7 Concentration</p>
                        <p className="text-sm">
                          Percentage of the S&P 500 market cap held by the 'Magnificent 7' stocks.
                        </p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{"<"} 50%:</strong> Diversified market, lower contagion risk
                          </li>
                          <li>
                            <strong>55-60%:</strong> High concentration, increased contagion risk
                          </li>
                          <li>
                            <strong>{">"} 65%:</strong> Extreme concentration, very high crash risk
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> High concentration means a downturn in these stocks can
                          severely impact the entire market
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.mag7Concentration.toFixed(1)}%</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, ((indicators.mag7Concentration - 40) / 30) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Diversified: {"<"}50%</span>
                <span>High: 55-60%</span>
                <span>Extreme: {">"}65%</span>
              </div>
            </div>
          )}

          {indicators.shillerCAPE != null && (
            <div className="space-y-2">
              {/* Added tooltip to Shiller CAPE Ratio */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  Shiller CAPE Ratio (10-Year Cyclical Valuation)
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-red-50 border-red-200">
                        <p className="font-semibold mb-1">Shiller CAPE Ratio</p>
                        <p className="text-sm">Cyclically Adjusted Price-to-Earnings ratio over 10 years.</p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{"<"} 20:</strong> Undervalued, low risk
                          </li>
                          <li>
                            <strong>20-30:</strong> Fair value, moderate risk
                          </li>
                          <li>
                            <strong>30-35:</strong> Elevated valuation, high risk
                          </li>
                          <li>
                            <strong>{">"} 35:</strong> Historically signals market tops, extreme crash risk
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> High CAPE values indicate markets trading significantly above
                          historical averages, prone to reversion
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.shillerCAPE.toFixed(1)}</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, ((indicators.shillerCAPE - 15) / 25) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Historical Avg: 16-17</span>
                <span>Elevated: 25-30</span>
                <span>Extreme: {">"}35</span>
              </div>
            </div>
          )}

          {indicators.equityRiskPremium != null && (
            <div className="space-y-2">
              {/* Added tooltip to Equity Risk Premium */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  Equity Risk Premium (Earnings Yield - 10Y Treasury)
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-green-50 border-green-200">
                        <p className="font-semibold mb-1">Equity Risk Premium</p>
                        <p className="text-sm">
                          The excess return investors expect for holding stocks over risk-free bonds.
                        </p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{">"} 5%:</strong> Attractive returns, low risk
                          </li>
                          <li>
                            <strong>3-4%:</strong> Fair compensation, moderate risk
                          </li>
                          <li>
                            <strong>{"<"} 2%:</strong> Low compensation, high crash risk
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> Low ERP suggests stocks are overvalued relative to their risk
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.equityRiskPremium.toFixed(2)}%</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, Math.max(0, ((6 - indicators.equityRiskPremium) / 6) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Attractive: {">"}5%</span>
                <span>Fair: 3-4%</span>
                <span>Overvalued: {"<"}2%</span>
              </div>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
