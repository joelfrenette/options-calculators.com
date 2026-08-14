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
import { buffettMarkerPercent } from "@/lib/ccpi/buffett-bands"
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
            <span className="text-sm text-gray-600">Weight: 15% | 4 indicators</span>
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
                  Buffett Indicator (Corporate Equities / GDP)
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-red-50 border-red-200">
                        <p className="font-semibold mb-1">Buffett Indicator</p>
                        <p className="text-sm">
                          Nonfinancial corporate equities (FRED NCBEILQ027S) relative to GDP. This basis reads higher
                          than the classic total-market-cap version — the bands below are calibrated to this series'
                          own 55-year history, not to the classic one.
                        </p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{"<"} 120%:</strong> Below its historical midpoint, low crash risk
                          </li>
                          <li>
                            <strong>120-150%:</strong> Around the modern-era median
                          </li>
                          <li>
                            <strong>150-195%:</strong> Elevated — upper quartile of readings since 1995
                          </li>
                          <li>
                            <strong>{">"} 210%:</strong> Top 5% of all readings since 1995 — extreme
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Record:</strong> above 210% it warned three quarters before the 2022 bear — and gave
                          no warning before 2000, 2008 or 2020. One episode in four; treat it as a valuation gauge,
                          not a crash timer.
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
                    marginLeft: `${buffettMarkerPercent(indicators.buffettIndicator)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Low: {"<"}120%</span>
                <span>Median: 120-150%</span>
                <span>Elevated: 150-195%</span>
                <span className="text-red-600">Extreme: {">"}210%</span>
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
