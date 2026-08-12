"use client"

/**
 * Pillar 1 — Momentum & Technical accordion section.
 *
 * Lifted verbatim from components/ccpi-dashboard.tsx (S-6 size-budget split).
 * Presentation only — the caller supplies the pillar score, provenance and the
 * narrowed indicators record; nothing here fetches or scores.
 */

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Info, Activity } from "lucide-react"
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

import type { CCPIPillarProvenance } from "@/lib/ccpi/types"
import {
  CCPIIndicator,
  CCPIBooleanIndicator,
  CCPIIndicatorTooltip,
} from "@/components/ccpi/indicator-primitives"
import { PillarProvenanceLine, PillarScore } from "@/components/ccpi/pillar-bits"

export function PillarMomentum({
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
    <AccordionItem value="pillar1" className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline py-10">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-600" />
            <span className="text-lg font-semibold">Pillar 1 - Momentum & Technical</span>
            <span className="text-sm text-gray-600">Weight: 35% | 10 indicators</span>
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
          {/* NVIDIA Momentum Score.
              P7-10: the guard was `!== undefined` on both halves, and the
              momentum half is now null rather than a defaulted 50 when Alpha
              Vantage is down. `null !== undefined` is TRUE, so the old guard
              would have rendered the string "null/100" — a nullable value and a
              `!== undefined` check are not the same test. `!= null` covers both,
              and the card is withheld rather than showing half a reading:
              `nvidiaPrice` comes from an independent AI-fallback chain and stays
              defined, so without this the row would pair a real price with a
              missing momentum and look complete. */}
          {indicators.nvidiaPrice != null && indicators.nvidiaMomentum != null && (
            <CCPIIndicator
              label="NVIDIA Price Momentum (Tech Bellwether)"
              value={`$${indicators.nvidiaPrice.toFixed(0)} | ${indicators.nvidiaMomentum}/100`}
              thresholds={{
                low: { value: 0, label: "Falling: <20 (Tech crash risk)" },
                mid: { value: 50, label: "Neutral: 40-60" },
                high: { value: 100, label: "Strong: >80" },
              }}
              barMin={0}
              barMax={100}
              tooltipContent={
                <CCPIIndicatorTooltip
                  title="NVIDIA Price Momentum"
                  description="NVIDIA's stock performance is a key indicator of AI/tech sector health and overall market sentiment."
                  thresholds={[
                    { label: ">$140 + momentum >80", description: "Strong AI rally, bullish tech sector" },
                    { label: "$120-140 + momentum 40-60", description: "Neutral, consolidation phase" },
                    { label: "<$120 + momentum <40", description: "Tech sector weakness, crash warning" },
                  ]}
                  impact="NVIDIA weakness often precedes broader tech selloffs"
                />
              }
              tooltipsEnabled={tooltipsEnabled}
            />
          )}

          {/* SOX Semiconductor Index */}
          {indicators.soxIndex != null && (
            <CCPIIndicator
              label="SOX Semiconductor Index (Chip Sector Health)"
              value={indicators.soxIndex.toFixed(0)}
              thresholds={{
                low: { value: 4000, label: "Weak: <4500" },
                mid: { value: 5000, label: "Baseline: 5000" },
                high: { value: 6000, label: "Strong: >5500" },
              }}
              barMin={4000}
              barMax={6000}
              barReverse={true}
              tooltipContent={
                <CCPIIndicatorTooltip
                  title="SOX Semiconductor Index"
                  description="Measures the health of the semiconductor industry, a critical leading indicator for tech sector performance."
                  thresholds={[
                    { label: ">5500", description: "Strong chip sector, bullish for tech" },
                    { label: "~5000", description: "Baseline level, neutral risk" },
                    { label: "<4500", description: "Weak chip demand, tech crash risk" },
                  ]}
                  impact="Chip weakness signals broader tech sector vulnerability"
                />
              }
              tooltipsEnabled={tooltipsEnabled}
            />
          )}

          {/* QQQ Daily Return */}
          {indicators.qqqDailyReturn != null && (
            <CCPIIndicator
              label="QQQ Daily Return (5× downside amplifier)"
              value={indicators.qqqDailyReturn}
              valueColor={
                Number.parseFloat(indicators.qqqDailyReturn) > 0 ? "text-green-600" : "text-red-600"
              }
              thresholds={{
                low: { value: -2, label: "Down: <-1%" },
                mid: { value: 0, label: "Flat: -1% to +1%" },
                high: { value: 2, label: "Up: > +1%" },
              }}
              barMin={-2}
              barMax={2}
              tooltipContent={
                <CCPIIndicatorTooltip
                  title="QQQ Daily Return"
                  description="Tracks the daily percentage change in the Nasdaq-100 ETF (QQQ)."
                  thresholds={[
                    { label: "> +1%", description: "Strong bullish momentum, low crash risk" },
                    { label: "-1% to +1%", description: "Neutral momentum, moderate risk" },
                    { label: "< -1%", description: "Bearish momentum, increased crash risk" },
                  ]}
                  impact="Large negative moves indicate selling pressure and risk-off sentiment"
                />
              }
              tooltipsEnabled={tooltipsEnabled}
            />
          )}

          {/* Consecutive Down Days */}
          {indicators.qqqConsecDown != null && (
            <CCPIIndicator
              label="QQQ Consecutive Down Days"
              value={`${indicators.qqqConsecDown} days`}
              thresholds={{
                low: { value: 0, label: "Healthy: 0-1 days" },
                mid: { value: 2.5, label: "Warning: 2-3 days" },
                high: { value: 5, label: "Danger: 4+ days" },
              }}
              barMin={0}
              barMax={5}
              tooltipContent={
                <CCPIIndicatorTooltip
                  title="Consecutive Down Days"
                  description="Counts how many trading days in a row QQQ has closed lower."
                  thresholds={[
                    { label: "0-1 days", description: "Healthy market, minimal crash risk" },
                    { label: "2-3 days", description: "Warning sign, increasing risk" },
                    { label: "4+ days", description: "Dangerous selling pressure, high crash risk" },
                  ]}
                  impact="Extended selling streaks often precede larger corrections or crashes"
                />
              }
              tooltipsEnabled={tooltipsEnabled}
            />
          )}

          {/* Below SMA20 */}
          {indicators.qqqBelowSMA20 != null && (
            <CCPIBooleanIndicator
              label="QQQ Below 20-Day SMA"
              value={indicators.qqqBelowSMA20}
              proximity={indicators.qqqSMA20Proximity ?? null}
              additionalInfo={
                indicators.qqqSMA20Proximity != null
                  ? `${indicators.qqqSMA20Proximity.toFixed(0)}% proximity`
                  : undefined
              }
              thresholds={{
                low: { value: 0, label: "Safe: 0% (far above)" },
                mid: { value: 50, label: "Warning: 50%" },
                high: { value: 100, label: "Danger: 100% (breached)" },
              }}
              tooltipContent={
                <CCPIIndicatorTooltip
                  title="20-Day Simple Moving Average"
                  description="Short-term trend indicator. Breach signals near-term momentum shift."
                  thresholds={[
                    { label: "Above SMA20", description: "Bullish short-term trend, low risk" },
                    { label: "Near SMA20 (50%)", description: "Testing support, moderate risk" },
                    { label: "Below SMA20", description: "Bearish short-term trend, elevated risk" },
                  ]}
                  impact="Breaking below 20-day SMA often triggers technical selling"
                />
              }
              tooltipsEnabled={tooltipsEnabled}
            />
          )}

          {/* Below SMA50 */}
          {indicators.qqqBelowSMA50 != null && (
            <CCPIBooleanIndicator
              label="QQQ Below 50-Day SMA"
              value={indicators.qqqBelowSMA50}
              proximity={indicators.qqqSMA50Proximity ?? null}
              additionalInfo={
                indicators.qqqSMA50Proximity != null
                  ? `${indicators.qqqSMA50Proximity.toFixed(0)}% proximity`
                  : undefined
              }
              thresholds={{
                low: { value: 0, label: "Safe: 0% (far above)" },
                mid: { value: 50, label: "Warning: 50%" },
                high: { value: 100, label: "Danger: 100% (breached)" },
              }}
              tooltipContent={
                <CCPIIndicatorTooltip
                  title="50-Day Simple Moving Average"
                  description="Medium-term trend indicator. Key support level watched by institutions."
                  thresholds={[
                    { label: "Above SMA50", description: "Healthy medium-term trend, low risk" },
                    { label: "Near SMA50 (50%)", description: "Critical support test, moderate risk" },
                    { label: "Below SMA50", description: "Broken support, high crash risk" },
                  ]}
                  impact="Breaking below 50-day SMA signals weakening trend and triggers institutional selling"
                />
              }
              tooltipsEnabled={tooltipsEnabled}
            />
          )}

          {/* Below SMA200 */}
          {indicators.qqqBelowSMA200 != null && (
            <CCPIBooleanIndicator
              label="QQQ Below 200-Day SMA"
              value={indicators.qqqBelowSMA200}
              proximity={indicators.qqqSMA200Proximity ?? null}
              additionalInfo={
                indicators.qqqSMA200Proximity != null
                  ? `${indicators.qqqSMA200Proximity.toFixed(0)}% proximity`
                  : undefined
              }
              thresholds={{
                low: { value: 0, label: "Safe: 0% (far above)" },
                mid: { value: 50, label: "Warning: 50%" },
                high: { value: 100, label: "Danger: 100% (breached)" },
              }}
              tooltipContent={
                <CCPIIndicatorTooltip
                  title="200-Day Simple Moving Average"
                  description="Long-term trend indicator and major support/resistance. Most critical technical level."
                  thresholds={[
                    { label: "Above SMA200", description: "Bull market confirmed, low crash risk" },
                    { label: "Near SMA200 (50%)", description: "Major support test, elevated risk" },
                    { label: "Below SMA200", description: "Bear market territory, very high crash risk" },
                  ]}
                  impact="Breaking below 200-day SMA historically precedes major market crashes"
                />
              }
              tooltipsEnabled={tooltipsEnabled}
            />
          )}

          {/* Below Bollinger Band (Lower) */}
          {indicators.qqqBelowBollinger != null && (
            <div className="space-y-2">
              {/* Added tooltip to QQQ Below Bollinger Band indicator */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  QQQ Below Bollinger Band (Lower)
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                        <p className="font-semibold mb-1">Bollinger Band (Lower)</p>
                        <p className="text-sm">
                          Volatility-based indicator showing 2 standard deviations below 20-day average.
                        </p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>Above band:</strong> Normal trading, low risk
                          </li>
                          <li>
                            <strong>Near band (50%):</strong> Approaching oversold, moderate risk
                          </li>
                          <li>
                            <strong>Below band:</strong> Oversold/panic selling, high crash risk
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> Breaking below lower band signals extreme volatility and
                          potential capitulation
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {indicators.qqqBollingerProximity != null && (
                    <span className="text-xs font-semibold text-orange-600">
                      {indicators.qqqBollingerProximity.toFixed(0)}% proximity
                    </span>
                  )}
                  <span
                    className={`font-bold ${indicators.qqqBelowBollinger ? "text-red-600" : "text-green-600"}`}
                  >
                    {indicators.qqqBelowBollinger ? "YES - OVERSOLD" : "NO"}
                  </span>
                </div>
              </div>
              {Number.isFinite(indicators.qqqBollingerProximity) ? (
                <div className="relative w-full h-3 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                  <div
                    className="absolute inset-0 bg-gray-200"
                    style={{
                      marginLeft: `${Math.min(100, Math.max(0, indicators.qqqBollingerProximity as number))}%`,
                    }}
                  />
                </div>
              ) : (
                <div className="relative w-full h-3 rounded-full overflow-hidden bg-gray-200">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-medium text-gray-400">No data</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between text-xs text-gray-600">
                <span>Safe: 0% (at middle band)</span>
                <span>Warning: 50%</span>
                <span>Oversold: 100% (breached)</span>
              </div>
            </div>
          )}

          {/* VIX */}
          {indicators.vix != null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  VIX (Fear Gauge)
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                        <p className="font-semibold mb-1">VIX - Fear Gauge</p>
                        <p className="text-sm">
                          The CBOE Volatility Index measures market expectations of 30-day forward volatility from
                          S&P 500 options.
                        </p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{"<"}15:</strong> Calm market, complacency risk
                          </li>
                          <li>
                            <strong>15-25:</strong> Elevated fear, normal volatility
                          </li>
                          <li>
                            <strong>{">"}25:</strong> Fear/panic mode, high crash risk
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> Rising VIX indicates increasing fear and crash probability
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.vix.toFixed(1)}</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    marginLeft: `${Math.min(100, (indicators.vix / 50) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Calm: {"<"}15</span>
                <span>Elevated: 15-25</span>
                <span>Fear: {">"}25</span>
              </div>
            </div>
          )}

          {/* VIX Term Structure — RATIO convention: VIX3M / spot VIX */}
          {indicators.vixTermStructure != null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  VIX Term Structure (VIX3M / VIX)
                  {tooltipsEnabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                        <p className="font-semibold mb-1">VIX Term Structure</p>
                        <p className="text-sm">
                          Ratio of 3-month VIX (VIX3M) to spot VIX. Normal markets sit in contango (ratio around
                          1.08); a ratio below 1.0 means near-term fear exceeds longer-dated fear.
                        </p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>
                            <strong>{">"}1.05:</strong> Normal contango - calm market, low risk (good)
                          </li>
                          <li>
                            <strong>1.00-1.05:</strong> Flattening curve, watch closely
                          </li>
                          <li>
                            <strong>{"<"}1.00:</strong> Backwardation - near-term panic, high crash risk (bad)
                          </li>
                        </ul>
                        <p className="text-xs mt-2">
                          <strong>Impact:</strong> Backwardation (ratio below 1.0) signals acute fear and elevated
                          crash risk; below 0.95 is severe
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{indicators.vixTermStructure.toFixed(2)}</span>
              </div>
              <div className="relative w-full h-3 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div
                  className="absolute inset-0 bg-gray-200"
                  style={{
                    // Ratio scale: 1.15+ (healthy contango) = 0% risk on the left,
                    // 1.00 (flat) = midpoint, 0.85 or lower (severe backwardation) = 100%.
                    marginLeft: `${Math.min(100, Math.max(0, ((1.15 - indicators.vixTermStructure) / 0.3) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span className="text-green-600">Contango: {">"}1.05 (Safe)</span>
                <span>Flat: 1.00</span>
                <span className="text-red-600">Backwardation: {"<"}1.00 (FEAR)</span>
              </div>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
