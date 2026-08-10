"use client"

/**
 * Pillar 4 — Macro accordion section.
 *
 * Lifted verbatim from components/ccpi-dashboard.tsx (S-6 size-budget split).
 * Presentation only — the caller supplies the pillar score, provenance and the
 * narrowed indicators record; nothing here fetches or scores.
 */

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Info, BarChart3 } from "lucide-react"
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

import type { CCPIPillarProvenance } from "@/lib/ccpi/types"
import { PillarProvenanceLine, PillarScore } from "@/components/ccpi/pillar-bits"

export function PillarMacro({
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
    <AccordionItem value="pillar4" className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline py-10">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <span className="text-lg font-semibold">Pillar 4 - Macro</span>
            <span className="text-sm text-gray-600">Weight: 20% | 8 indicators</span>
          </div>
          <PillarScore score={score} />
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <div className="space-y-6 pt-4">
          <PillarProvenanceLine prov={prov} />
          {score === null && (
            <p className="text-sm text-gray-600 italic">
              Insufficient live/AI-sourced data to score this pillar — its weight is renormalized across the
              remaining pillars.
            </p>
          )}
          {/* TED Spread */}
          {indicators.tedSpread !== undefined && (
            <div className="space-y-2">
              {/* Added tooltip to TED Spread indicator */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  TED Spread (Banking System Stress)
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-orange-50 border-orange-200">
                        <p className="font-semibold mb-1">TED Spread</p>
                        <p className="text-sm">
                          Difference between US Dollar LIBOR and US Treasury yields, indicating credit market
                          stress.
                        </p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{"<"} 0.35%:</strong> Low stress, stable banking
                          </li>
                          <li>
                            <strong>0.5-0.75%:</strong> Rising stress, caution needed
                          </li>
                          <li>
                            <strong>{">"} 1.0%:</strong> High stress, impending crisis
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> Widening TED spread signals increasing fear of bank defaults
                          and credit crunch
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.tedSpread.toFixed(2)}%</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, (indicators.tedSpread / 1.5) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Normal: {"<"}0.35%</span>
                <span>Warning: 0.5-0.75%</span>
                <span>Crisis: {">"}1.0%</span>
              </div>
            </div>
          )}

          {/* US Dollar Index (DXY) */}
          {indicators.dxyIndex !== undefined && (
            <div className="space-y-2">
              {/* Added tooltip to DXY Index */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  US Dollar Index (DXY) - Tech Headwind
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-green-50 border-green-200">
                        <p className="font-semibold mb-1">US Dollar Index (DXY)</p>
                        <p className="text-sm">Measures USD strength against a basket of major currencies.</p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{"<"} 95:</strong> Weak dollar, supports asset prices
                          </li>
                          <li>
                            <strong>95-105:</strong> Normal range
                          </li>
                          <li>
                            <strong>{">"} 110:</strong> Strong dollar, headwinds for global growth and tech
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> A strong dollar can hurt multinational tech earnings and
                          emerging markets
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.dxyIndex.toFixed(1)}</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, Math.max(0, ((indicators.dxyIndex - 90) / 30) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Weak: {"<"}95</span>
                <span>Normal: 100-105</span>
                <span>Strong: {">"}110 (Hurts tech)</span>
              </div>
            </div>
          )}

          {/* ISM Manufacturing PMI */}
          {indicators.ismPMI !== undefined && (
            <div className="space-y-2">
              {/* Added tooltip to ISM Manufacturing PMI */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  ISM Manufacturing PMI (Economic Leading)
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-gray-50 border-gray-200">
                        <p className="font-semibold mb-1">ISM Manufacturing PMI</p>
                        <p className="text-sm">Purchasing Managers' Index for the manufacturing sector.</p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{">"} 52:</strong> Expansion, positive economic signal
                          </li>
                          <li>
                            <strong>50-52:</strong> Slowing growth
                          </li>
                          <li>
                            <strong>{"<"} 50:</strong> Contraction, recessionary signal
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> A PMI below 50 often indicates weakening demand and potential
                          economic slowdown
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.ismPMI.toFixed(1)}</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, Math.max(0, 100 - ((indicators.ismPMI - 40) / 20) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Expansion: {">"}52</span>
                <span>Neutral: 50</span>
                <span>Contraction: {"<"}50</span>
              </div>
            </div>
          )}

          {/* Fed Funds Rate */}
          {indicators.fedFundsRate !== undefined && (
            <div className="space-y-2">
              {/* Added tooltip to Fed Funds Rate */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  Fed Funds Rate
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                        <p className="font-semibold mb-1">Federal Funds Rate</p>
                        <p className="text-sm">
                          The target rate set by the Federal Reserve for overnight lending between banks.
                        </p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{"<"} 2%:</strong> Accommodative policy, supports growth
                          </li>
                          <li>
                            <strong>2-4%:</strong> Neutral policy
                          </li>
                          <li>
                            <strong>{">"} 4.5%:</strong> Restrictive policy, slows economy, increases crash risk
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> High rates increase borrowing costs and can trigger market
                          downturns
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.fedFundsRate}%</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, (indicators.fedFundsRate / 6) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Accommodative: {"<"}2%</span>
                <span>Neutral: 2-4%</span>
                <span>Restrictive: {">"}4.5%</span>
              </div>
            </div>
          )}

          {/* Fed Reverse Repo */}
          {indicators.fedReverseRepo !== undefined && (
            <div className="space-y-2">
              {/* Added tooltip to Fed Reverse Repo */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  Fed Reverse Repo (Liquidity Conditions)
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                        <p className="font-semibold mb-1">Fed Reverse Repo Operations</p>
                        <p className="text-sm">Measures excess liquidity in the financial system.</p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{"<"} $500B:</strong> Tight liquidity, potential headwinds
                          </li>
                          <li>
                            <strong>$500B - $1T:</strong> Normal
                          </li>
                          <li>
                            <strong>{">"} $2T:</strong> Abundant liquidity, supports asset prices
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> Declining reverse repo balances can signal tightening
                          liquidity, increasing crash risk
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">${indicators.fedReverseRepo.toFixed(0)}B</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, (indicators.fedReverseRepo / 2500) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Loose: {"<"}500B</span>
                <span>Normal: 1000B</span>
                <span>Tight: {">"}2000B</span>
              </div>
            </div>
          )}

          {/* Junk Bond Spread - moved to Macro */}
          {indicators.junkSpread !== undefined && (
            <div className="space-y-2">
              {/* Added tooltip to Junk Bond Spread */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  Junk Bond Spread
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-orange-50 border-orange-200">
                        <p className="font-semibold mb-1">Junk Bond Spread</p>
                        <p className="text-sm">
                          Difference between high-yield (junk) bonds and risk-free Treasuries.
                        </p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{"<"} 3%:</strong> Tight spread, low perceived risk, low crash risk
                          </li>
                          <li>
                            <strong>3-6%:</strong> Normal spread, moderate risk
                          </li>
                          <li>
                            <strong>{">"} 7%:</strong> Wide spread, high perceived risk, high crash risk
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> Widening spreads indicate investor fear of default and credit
                          tightening
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.junkSpread.toFixed(2)}%</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, ((indicators.junkSpread - 2) / 8) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Tight: {"<"}3%</span>
                <span>Normal: 3-5%</span>
                <span>Wide: {">"}6%</span>
              </div>
            </div>
          )}

          {/* US Debt-to-GDP */}
          {indicators.debtToGDP !== undefined && (
            <div className="space-y-2">
              {/* Added tooltip to US Debt-to-GDP */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  US Debt-to-GDP Ratio
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-red-50 border-red-200">
                        <p className="font-semibold mb-1">US Debt-to-GDP Ratio</p>
                        <p className="text-sm">Total public debt as a percentage of Gross Domestic Product.</p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{"<"} 90%:</strong> Healthy level
                          </li>
                          <li>
                            <strong>90-120%:</strong> Elevated risk
                          </li>
                          <li>
                            <strong>{">"} 130%:</strong> Very high risk, potential for fiscal crisis
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> High debt levels can lead to inflation, higher interest rates,
                          and reduced fiscal flexibility
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.debtToGDP.toFixed(1)}%</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, Math.max(0, ((indicators.debtToGDP - 60) / 80) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Healthy: {"<"}90%</span>
                <span>Elevated: 100-120%</span>
                <span>Danger: {">"}130%</span>
              </div>
            </div>
          )}

          {/* Yield Curve — scored once, in Macro (P3-13) */}
          {indicators.yieldCurve !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  Yield Curve (10Y-2Y)
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                        <p className="font-semibold mb-1">Yield Curve (10Y-2Y) Spread</p>
                        <p className="text-sm">Difference between 10-year and 2-year Treasury yields.</p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{">"} 0.5%:</strong> Steep curve, healthy economy, low risk
                          </li>
                          <li>
                            <strong>0-0.5%:</strong> Flat curve, slowing growth, moderate risk
                          </li>
                          <li>
                            <strong>{"<"} 0% (Inverted):</strong> Inverted curve, recession signal, high crash
                            risk
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> Inverted yield curve has historically preceded recessions and
                          market crashes
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.yieldCurve.toFixed(2)}%</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, Math.max(0, 100 - ((indicators.yieldCurve + 1) / 2) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Normal: {">"}0.5%</span>
                <span>Flat: 0-0.5%</span>
                <span>Inverted: {"<"}0%</span>
              </div>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
