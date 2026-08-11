"use client"

import React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info, Sparkles } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingDown, AlertTriangle, Activity } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Download } from "lucide-react"

import type { CCPIData, HistoricalData } from "@/lib/ccpi/types"
import { getReadableColor, getRegimeZone, sortCanaries, countActiveWarnings } from "@/lib/ccpi/calculations"
import { saveCCPIToCache, loadCCPIFromCache, saveHistoryToCache } from "@/lib/ccpi/cache"
import { REFRESH_STATUS_MESSAGES } from "@/lib/ccpi/constants"
import { CCPI_ALLOCATION, bandForScore, formatRange, stocksRange } from "@/lib/allocation"
import { CCPIChatModal } from "./ccpi-chat-modal"
import { RefreshButton } from "./ui/refresh-button" // Assuming RefreshButton is in ui/refresh-button.tsx
import { DataLoadGate } from "@/components/data-load-gate"

import { getSignalTooltip, getCrashAmplifierTooltip } from "@/components/ccpi/tooltip-copy"
import { TriggerSection } from "@/components/ccpi/trigger-section"
import { PillarMomentum } from "@/components/ccpi/pillar-momentum"
import { PillarRiskAppetite } from "@/components/ccpi/pillar-risk-appetite"
import { PillarValuation } from "@/components/ccpi/pillar-valuation"
import { PillarMacro } from "@/components/ccpi/pillar-macro"

export function CcpiDashboard({ symbol = "SPY" }: { symbol?: string }) {
  const [data, setData] = useState<CCPIData | null>(null)
  const [history, setHistory] = useState<HistoricalData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [executiveSummary, setExecutiveSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState(0)
  const [refreshStatus, setRefreshStatus] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const ccpiScore = useMemo(() => (data ? Math.round(data.ccpi) : 0), [data])
  const zone = useMemo(() => getRegimeZone(ccpiScore), [ccpiScore])
  const regimeColor = useMemo(() => getReadableColor(zone.color), [zone.color])
  const sortedCanaries = useMemo(() => (data ? sortCanaries(data.canaries) : []), [data])
  const activeCanariesCount = useMemo(() => (data ? countActiveWarnings(data.canaries) : 0), [data])

  const fetchExecutiveSummary = useCallback(async (ccpiData: CCPIData) => {
    try {
      setSummaryLoading(true)

      const summaryPayload = {
        ccpi: Math.round(ccpiData.ccpi),
        certainty: ccpiData.certainty || 0,
        activeCanaries: ccpiData.canaries ? countActiveWarnings(ccpiData.canaries) : 0,
        // The payload's scored-indicator count, not the canary-array length —
        // "3 of 12" was being narrated against a 29-indicator index.
        totalIndicators: ccpiData.totalIndicators ?? 0,
        regime: ccpiData.regime || { name: "Unknown", description: "Unknown" },
        pillars: ccpiData.pillars ?? { momentum: null, riskAppetite: null, valuation: null, macro: null },
      }

      const response = await fetch("/api/ccpi/executive-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summaryPayload),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch executive summary: ${response.status}`)
      }

      const result = await response.json()

      if (result.summary) {
        setExecutiveSummary(result.summary)
      } else {
        setExecutiveSummary(null)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch executive summary:", error)
      setExecutiveSummary(
        "Executive summary is temporarily unavailable. Market analysis data has been successfully loaded.",
      )
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  const fetchCCPIData = useCallback(async () => {
    try {
      setIsRefreshing(true)
      setLoading(true)
      setFromCache(false)
      setRefreshProgress(5)
      setRefreshStatus("Initializing CCPI calculation...")
      setError(null)

      const progressInterval = setInterval(() => {
        setRefreshProgress((prev) => {
          if (prev >= 90) return prev
          return prev + Math.random() * 8
        })
        setRefreshStatus(() => {
          return REFRESH_STATUS_MESSAGES[Math.floor(Math.random() * REFRESH_STATUS_MESSAGES.length)]
        })
      }, 800)

      const response = await fetch("/api/ccpi")

      clearInterval(progressInterval)
      setRefreshProgress(100)
      setRefreshStatus("Complete!")

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      const cachedData = {
        ...result,
        timestamp: new Date().toISOString(),
      }

      setData(cachedData)
      saveCCPIToCache(cachedData)
      setCacheTimestamp(cachedData.timestamp)

      try {
        await fetch("/api/ccpi/cache", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cachedData),
        })
      } catch (cacheError) {
        console.error("[v0] Failed to cache CCPI data:", cacheError)
      }

      await fetchExecutiveSummary(cachedData)
    } catch (error) {
      console.error("[v0] CCPI API error:", error)
      setError(error instanceof Error ? error.message : "Failed to load CCPI data")
    } finally {
      setIsRefreshing(false)
      setLoading(false)
      setRefreshProgress(0)
      setRefreshStatus("")
    }
  }, [fetchExecutiveSummary])

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/ccpi/history")
      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.status}`)
      }
      const result = await response.json()
      setHistory(result)
      saveHistoryToCache(result)
    } catch (error) {
      console.error("[v0] Failed to fetch CCPI history:", error)
    }
  }, [])

  useEffect(() => {
    if (!loaded) return

    const loadInitialData = async () => {
      // Older cache entries may carry the executive summary alongside CCPIData.
      const cached = loadCCPIFromCache() as (CCPIData & { executiveSummary?: string }) | null
      if (cached) {
        setData(cached)
        setFromCache(true)
        setCacheTimestamp(cached.timestamp || null)
        // Don't auto-fetch - only refresh when user clicks button
        if (cached.executiveSummary) {
          setExecutiveSummary(cached.executiveSummary)
        }
      } else {
        // No cache exists, fetch fresh data
        await fetchCCPIData()
      }
    }

    loadInitialData()
  }, [loaded]) // Only after the user opts in

  if (!loaded) {
    return (
      <DataLoadGate
        title="Load Crash & Corrections Predictions?"
        description="Fetch the latest Crash & Correction Probability Index data. Nothing loads until you choose to."
        onConfirm={() => setLoaded(true)}
      />
    )
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-gray-600">Loading CCPI data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="outline" onClick={fetchCCPIData} className="mt-4 bg-transparent">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  // Since the P3 provenance rework the API reports null for a pillar whose
  // scored weight fell below the minimum (lib/ccpi/types.ts still types
  // pillars as number pending its own pass) — never render 0 for missing data.
  const pillarScores = data.pillars as unknown as {
    momentum: number | null
    riskAppetite: number | null
    valuation: number | null
    macro: number | null
  }
  // Narrowed once so indicator blocks don't each re-check for undefined.
  const indicators: Record<string, any> = data.indicators ?? {}
  // null when the score is missing — never falls back to the benign first band.
  const currentBand = bandForScore(CCPI_ALLOCATION.bands, ccpiScore)

  return (
    <TooltipProvider delayDuration={300}>
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-2">
          <div
            className="h-full bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 transition-all duration-300 ease-out"
            style={{ width: `${refreshProgress}%` }}
          />
        </div>
      )}

      {isRefreshing && refreshStatus && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 text-white px-6 py-3 rounded-full shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 animate-spin" />
            <span className="font-medium">{refreshStatus}</span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Crash &amp; Corrections Prediction Index (CCPI)</h2>
            <p className="text-muted-foreground">Real-time market crash risk assessment across 4 key dimensions</p>
            <p className="text-xs text-muted-foreground italic mt-0.5">
              Original index designed by Joel Frenette
            </p>
            {data?.lastUpdated && (
              <p className="text-xs text-muted-foreground mt-1">
                Last updated: {new Date(data.lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tooltips</span>
              <button
                onClick={() => setTooltipsEnabled(!tooltipsEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  tooltipsEnabled ? "bg-emerald-600" : "bg-gray-300"
                }`}
                aria-label="Toggle tooltips"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    tooltipsEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <RefreshButton onClick={fetchCCPIData} isLoading={isRefreshing} />
          </div>
        </div>

        {/* Main CCPI Score Card */}
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

              <div className="p-4 bg-white rounded-lg border border-blue-200 shadow-sm">
                <h5 className="font-semibold text-gray-800 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-primary" />
                  Weekly Outlook & Options Trading Tips
                </h5>
                <div className="space-y-2 text-sm text-gray-700">
                  {data.ccpi <= 39 ? (
                    <>
                      <p>
                        <span className="font-semibold text-green-700">Regime: {data.regime.name}</span> - With{" "}
                        {countActiveWarnings(data.canaries)} of {data.totalIndicators || 29} warning signals active and{" "}
                        {data.certainty}% data quality, the market is in a {data.ccpi <= 19 ? "low-risk" : "normal"}{" "}
                        state.
                      </p>
                      <div className="bg-green-50 p-3 rounded border border-green-200">
                        <p className="font-semibold text-green-800">Recommended Strategies This Week:</p>
                        <ul className="list-disc list-inside mt-1 text-green-700 space-y-1">
                          <li>Sell cash-secured puts on quality stocks (AAPL, MSFT, GOOGL)</li>
                          <li>Iron condors on SPY/QQQ with 30-45 DTE, target 70% POP</li>
                          <li>Covered calls if holding long equity positions</li>
                          <li>Consider wheel strategy entries on pullbacks</li>
                        </ul>
                      </div>
                    </>
                  ) : data.ccpi <= 59 ? (
                    <>
                      <p>
                        <span className="font-semibold text-yellow-700">Regime: {data.regime.name}</span> - With{" "}
                        {countActiveWarnings(data.canaries)} of {data.totalIndicators || 29} warning signals active,
                        elevated caution is warranted. Monitor for regime shift.
                      </p>
                      <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                        <p className="font-semibold text-yellow-800">Recommended Strategies This Week:</p>
                        <ul className="list-disc list-inside mt-1 text-yellow-700 space-y-1">
                          <li>Reduce position sizes by 25-50%</li>
                          <li>Use defined-risk spreads only - no naked options</li>
                          <li>Consider protective puts on core holdings</li>
                          <li>Wait for VIX spikes to sell premium</li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>
                        <span className="font-semibold text-red-700">Regime: {data.regime.name}</span> - With{" "}
                        {countActiveWarnings(data.canaries)} of {data.totalIndicators || 29} warning signals active and
                        CCPI at {data.ccpi}, extreme caution required.
                      </p>
                      <div className="bg-red-50 p-3 rounded border border-red-200">
                        <p className="font-semibold text-red-800">Recommended Strategies This Week:</p>
                        <ul className="list-disc list-inside mt-1 text-red-700 space-y-1">
                          <li>Close or hedge existing short premium positions</li>
                          <li>Consider long puts or put debit spreads for protection</li>
                          <li>VIX calls as crash insurance if VIX under 20</li>
                          <li>Preserve capital - cash is a valid position</li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Crash Amplifiers Card */}
        {data.crashAmplifiers && data.crashAmplifiers.length > 0 && (
          <Card className="border-4 border-red-600 bg-gradient-to-r from-red-50 to-orange-50 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-red-700">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help border-b border-dashed border-red-400">
                      CRASH AMPLIFIERS ACTIVE +{data.totalBonus || 0} BONUS POINTS
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="max-w-sm bg-white text-gray-900 border border-gray-200 shadow-lg p-3"
                  >
                    <p className="text-sm">
                      <strong>What are Crash Amplifiers?</strong>
                      <br />
                      These are extreme market conditions that historically appear before major crashes. When detected,
                      they add "bonus points" to the CCPI score because they significantly increase crash risk. Multiple
                      amplifiers firing together is a serious warning sign that demands defensive positioning.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription className="text-red-700 font-medium">
                {data.baseCCPI && data.totalBonus
                  ? `Multiple extreme crash signals detected - CCPI boosted from ${data.baseCCPI} to ${data.ccpi}`
                  : "Multiple extreme crash signals detected"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.crashAmplifiers?.map((amp, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border-2 border-red-300 cursor-help hover:border-red-500 transition-colors">
                        <span className="text-sm font-semibold text-red-900">{amp.reason}</span>
                        <Badge className="bg-red-600 text-white text-base font-bold">+{amp.points}</Badge>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="max-w-xs bg-white text-gray-900 border border-gray-200 shadow-lg p-3"
                    >
                      <p className="text-sm">{getCrashAmplifierTooltip(amp.reason)}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Canaries Card */}
        <Card className="border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-red-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-xl">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help border-b border-dashed border-orange-400">Active Warning Signals</span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="max-w-sm bg-white text-gray-900 border border-gray-200 shadow-lg p-3"
                  >
                    <p className="text-sm">
                      <strong>What are Warning Signals?</strong>
                      <br />
                      These are individual market indicators that are currently flashing caution. Each signal represents
                      a different aspect of market health (momentum, valuation, sentiment, etc.).
                      <br />
                      <br />
                      <strong className="text-red-600">HIGH RISK</strong> signals are severe and historically precede
                      significant market declines.
                      <br />
                      <strong className="text-yellow-600">MEDIUM RISK</strong> signals warrant attention but are less
                      urgent.
                      <br />
                      <br />
                      The more signals that fire together, the higher the crash probability.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-3xl font-bold text-orange-600 cursor-help">
                    {activeCanariesCount}/{data.totalIndicators || 29}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  className="max-w-xs bg-white text-gray-900 border border-gray-200 shadow-lg p-3"
                >
                  <p className="text-sm">
                    <strong>
                      {activeCanariesCount} out of {data.totalIndicators || 29}
                    </strong>{" "}
                    warning signals are currently active.
                    <br />
                    <br />• <strong>0-5 signals:</strong> Low risk environment
                    <br />• <strong>6-12 signals:</strong> Elevated caution needed
                    <br />• <strong>13+ signals:</strong> High risk - consider defensive strategies
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <CardDescription className="text-base mt-2">
              Last Updated: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : "Loading..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedCanaries
                .filter((canary) => canary.severity === "high" || canary.severity === "medium")
                .map((canary, i) => {
                  const severityConfig = {
                    high: {
                      bgColor: "bg-red-100",
                      textColor: "text-red-900",
                      borderColor: "border-red-400",
                      badgeColor: "bg-red-600 text-white",
                      label: "HIGH RISK",
                    },
                    medium: {
                      bgColor: "bg-yellow-100",
                      textColor: "text-yellow-900",
                      borderColor: "border-yellow-400",
                      badgeColor: "bg-yellow-600 text-white",
                      label: "MEDIUM RISK",
                    },
                    // Low-severity canaries are filtered out above; map them to
                    // medium so the lookup is total for the type system.
                  }[canary.severity === "high" ? "high" : "medium"]

                  const uniqueKey = `${canary.signal}-${i}`

                  return tooltipsEnabled ? (
                    <Tooltip key={uniqueKey}>
                      <TooltipTrigger asChild>
                        <div className="h-full">
                          <div
                            className={`p-4 rounded-lg border-2 cursor-help hover:shadow-md transition-shadow ${severityConfig.bgColor} ${severityConfig.borderColor} h-full`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <Badge variant="outline" className="text-xs font-semibold">
                                {canary.pillar}
                              </Badge>
                              <span
                                className={`text-xs font-bold px-3 py-1 rounded-md ${severityConfig.badgeColor} shadow-sm whitespace-nowrap flex items-center gap-1`}
                              >
                                {severityConfig.label}
                                <Info className="h-3 w-3" />
                              </span>
                            </div>
                            <p className={`text-sm font-semibold ${severityConfig.textColor}`}>{canary.signal}</p>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="max-w-sm bg-white text-gray-900 border border-gray-200 shadow-lg p-3"
                      >
                        <p className="text-sm">{getSignalTooltip(canary.signal)}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <div key={uniqueKey} className="h-full">
                      <div
                        className={`p-4 rounded-lg border-2 transition-shadow ${severityConfig.bgColor} ${severityConfig.borderColor} h-full`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Badge variant="outline" className="text-xs font-semibold">
                            {canary.pillar}
                          </Badge>
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-md ${severityConfig.badgeColor} shadow-sm whitespace-nowrap`}
                          >
                            {severityConfig.label}
                          </span>
                        </div>
                        <p className={`text-sm font-semibold ${severityConfig.textColor}`}>{canary.signal}</p>
                      </div>
                    </div>
                  )
                })}
            </div>
            {sortedCanaries.filter((c) => c.severity === "high" || c.severity === "medium").length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-green-700 font-medium">No medium or high severity warnings detected</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/*
          Leading signals (CCPI_DESIGN §7a), directly below the score card.
          Its own section rather than a pillar: nothing here is scored, and §7a
          forbids aggregating these rows into any number.
        */}
        <TriggerSection />

        {/*
          The four pillars in numeric order. §7a's Vulnerability and Coincident
          roles ride on the pillars themselves as badge + caveat rather than as
          grouping headers — the reader still learns that valuation says how far
          and not when, and that momentum confirms rather than predicts, without
          the pillar numbering being reshuffled to say it.
        */}
        <Accordion type="multiple" defaultValue={["pillar2", "pillar3", "pillar4"]} className="space-y-4">
          <PillarMomentum
            score={pillarScores.momentum}
            prov={data.provenance?.momentum}
            indicators={indicators}
            tooltipsEnabled={tooltipsEnabled}
            badge="Coincident"
            caveat="These confirm a decline that has already started. They do not predict one."
          />

          <PillarRiskAppetite
            score={pillarScores.riskAppetite}
            prov={data.provenance?.riskAppetite}
            indicators={indicators}
            tooltipsEnabled={tooltipsEnabled}
          />

          <PillarValuation
            score={pillarScores.valuation}
            prov={data.provenance?.valuation}
            indicators={indicators}
            tooltipsEnabled={tooltipsEnabled}
            badge="Vulnerability"
            caveat="Context, not a timing signal. This has been elevated since 2017 — it describes how far a fall could go, not when."
          />

          <PillarMacro
            score={pillarScores.macro}
            prov={data.provenance?.macro}
            indicators={indicators}
            tooltipsEnabled={tooltipsEnabled}
          />
        </Accordion>

        {/* CCPI Formula Weights */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-sm mb-3 text-blue-900">CCPI Formula Weights</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Momentum & Technical:</span>
              <span className="font-bold text-blue-900">35%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Risk Appetite & Volatility:</span>
              <span className="font-bold text-blue-900">30%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Valuation & Market Structure:</span>
              <span className="font-bold text-blue-900">15%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Macro:</span>
              <span className="font-bold text-blue-900">20%</span>
            </div>
          </div>
          <p className="text-xs text-blue-700 mt-3">
            Final CCPI = Σ(Pillar Score × Weight), renormalized over the pillars with sufficient live/AI data. 29 scored
            indicators across 4 pillars: 10 momentum, 4 risk appetite, 7 valuation (S&P P/E, S&P P/S, Buffett Indicator,
            QQQ P/E, Mag7 Concentration, Shiller CAPE, Equity Risk Premium), and 8 macro (incl. the 10Y-2Y yield curve,
            scored once here).
          </p>
        </div>

        <Accordion
          type="multiple"
          defaultValue={["portfolio-allocation", "options-strategy"]}
          className="space-y-4 mt-8"
        >
          {/* Portfolio Allocation by CCPI Crash Risk Level */}
          <AccordionItem value="portfolio-allocation" className="border-0">
            <Card className="shadow-sm border-gray-200">
              <AccordionTrigger className="hover:no-underline px-6 py-0">
                <CardHeader className="bg-gray-50 border-b border-gray-200 w-full py-3">
                  <CardTitle className="text-lg font-bold text-gray-900 text-left">
                    Cash vs Stocks by CCPI Crash Risk Level
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1 text-left">
                    One ratio per regime. "Stocks" is everything deployed — shares, ETFs, LEAPS and options
                  </p>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-2">
                    {CCPI_ALLOCATION.bands.map((band) => {
                      const stocks = stocksRange(band)
                      const isCurrent = currentBand?.range === band.range

                      return (
                        <div
                          key={band.range}
                          className={`p-4 rounded-lg border transition-colors ${
                            isCurrent
                              ? "border-green-500 bg-green-100 shadow-md ring-2 ring-green-300"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="font-mono text-sm font-bold text-gray-900">CCPI {band.range}</span>
                              <span className="ml-3 font-bold text-sm text-gray-700">{band.level}</span>
                            </div>
                            {isCurrent && (
                              <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">
                                CURRENT
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-blue-50 rounded border border-blue-200">
                              <div className="text-xs font-semibold text-blue-900 uppercase mb-1">Stocks</div>
                              <div className="text-2xl font-bold text-blue-900">
                                {formatRange(stocks.min, stocks.max)}
                              </div>
                            </div>
                            <div className="p-3 bg-gray-50 rounded border border-gray-300">
                              <div className="text-xs font-semibold text-gray-900 uppercase mb-1">Cash</div>
                              <div className="text-2xl font-bold text-gray-900">
                                {formatRange(band.cashMin, band.cashMax)}
                              </div>
                            </div>
                          </div>

                          <p className="text-sm text-gray-600 italic mt-3">{band.stance}</p>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-800 leading-relaxed">
                      <strong>Note:</strong> Stocks and cash are complements — the stocks figure is computed as 100%
                      minus cash, so the two halves cannot disagree. Diversify within the stocks half through sectors
                      and indexes (GDX, XLU, SPY) rather than by adding asset classes. Baseline guidelines only, not
                      personal advice — consult a financial advisor.
                    </p>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          {/* Options Strategy Guide by CCPI Crash Risk Level */}
          <AccordionItem value="options-strategy" className="border-0">
            <Card className="shadow-sm border-gray-200">
              <AccordionTrigger className="hover:no-underline px-6 py-0">
                <CardHeader className="bg-gray-50 border-b border-gray-200 w-full py-3">
                  <CardTitle className="text-lg font-bold text-gray-900 text-left">
                    Options Strategy Guide by CCPI Crash Risk Level
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1 text-left">
                    Complete trading playbook across all crash risk regimes
                  </p>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-2">
                    {[
                      {
                        range: "0-19",
                        level: "Low Risk",
                        signal: "STRONG BUY",
                        description:
                          "Market shows minimal crash signals. Safe to deploy capital with aggressive strategies.",
                        guidance: {
                          positionSize: "Large (5-10%)",
                          strategies: [
                            "Sell cash-secured puts on quality names at 30-delta",
                            "Run the wheel strategy on tech leaders (NVDA, MSFT, AAPL)",
                            "Long ITM LEAPS calls (70-80 delta) for leverage",
                            "Aggressive short strangles on high IV stocks",
                            "Credit spreads in earnings season",
                          ],
                        },
                      },
                      {
                        range: "20-39",
                        level: "Normal",
                        signal: "BUY",
                        description:
                          "Standard market conditions. Deploy capital with normal risk management protocols.",
                        guidance: {
                          positionSize: "Medium (3-5%)",
                          strategies: [
                            "Balanced put selling at 20-30 delta on SPY/QQQ",
                            "Covered calls on existing positions (40-45 DTE)",
                            "Bull put spreads with 1.5-2x credit/risk ratio",
                            "Diagonal calendar spreads for income + upside",
                            "Protective puts on core holdings (10% allocation)",
                          ],
                        },
                      },
                      {
                        range: "40-59",
                        level: "Caution",
                        signal: "HOLD",
                        description: "Mixed signals appearing. Reduce exposure and focus on defensive positioning.",
                        guidance: {
                          positionSize: "Small (1-3%)",
                          strategies: [
                            "Shift to defined-risk strategies only (spreads, iron condors)",
                            "Increase VIX call hedges (2-3 month expiry)",
                            "Roll out short puts to avoid assignment",
                            "Close winning trades early (50-60% max profit)",
                            "Buy protective puts on concentrated positions",
                          ],
                        },
                      },
                      {
                        range: "60-79",
                        level: "High Alert",
                        signal: "CAUTION",
                        description:
                          "Multiple crash signals active. Preserve capital and prepare for volatility expansion.",
                        guidance: {
                          positionSize: "Very Small (0.5-1%)",
                          strategies: [
                            "Buy VIX calls for crash insurance (60-90 DTE)",
                            "Long put spreads on QQQ/SPY at-the-money",
                            "Tactical long volatility trades (VXX calls)",
                            "Gold miners (GDX) call options for defensive sector exposure",
                          ],
                        },
                      },
                      {
                        range: "80-100",
                        level: "Crash Watch",
                        signal: "SELL/HEDGE",
                        description:
                          "Extreme crash risk. Full defensive positioning required. Prioritize capital preservation.",
                        guidance: {
                          positionSize: "Minimal (0.25-0.5%)",
                          strategies: [
                            "Aggressive long puts on SPY/QQQ (30-60 DTE)",
                            "VIX call spreads to capitalize on volatility spike",
                            "Inverse ETFs (SQQQ, SH) or long put options",
                            "Close ALL short premium positions",
                            "Tail risk hedges: deep OTM puts on major indices",
                          ],
                        },
                      },
                    ].map((item, index) => {
                      const isCurrent =
                        ccpiScore >= Number.parseInt(item.range.split("-")[0]) &&
                        ccpiScore <= Number.parseInt(item.range.split("-")[1])
                      const band = CCPI_ALLOCATION.bands.find((b) => b.range === item.range) ?? null

                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border transition-colors ${
                            isCurrent
                              ? "border-green-500 bg-green-100 shadow-md ring-2 ring-green-300"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="font-mono text-sm font-bold text-gray-900">CCPI: {item.range}</span>
                                <span
                                  className={`ml-3 font-bold text-sm ${
                                    index === 0
                                      ? "text-green-600"
                                      : index === 1
                                        ? "text-lime-600"
                                        : index === 2
                                          ? "text-yellow-600"
                                          : index === 3
                                            ? "text-orange-600"
                                            : "text-red-600"
                                  }`}
                                >
                                  {item.level}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {isCurrent && (
                                  <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">
                                    CURRENT
                                  </span>
                                )}
                                <span
                                  className={`px-3 py-1 text-xs font-bold rounded-full ${
                                    item.signal === "STRONG BUY"
                                      ? "bg-green-100 text-green-800"
                                      : item.signal === "BUY"
                                        ? "bg-green-100 text-green-700"
                                        : item.signal === "HOLD"
                                          ? "bg-gray-100 text-gray-700"
                                          : item.signal === "CAUTION"
                                            ? "bg-orange-100 text-orange-700"
                                            : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {item.signal}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 italic">{item.description}</p>
                          </div>

                          {/*
                            Same cash/stocks pair as the allocation section above, read from
                            ALLOCATION_BANDS rather than restated here. The old card carried its
                            own "cash 5-10% + exposure 90-100%" pair, which summed to 110.
                          */}
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="p-3 bg-blue-50 rounded border border-blue-200">
                              <div className="text-xs font-semibold text-blue-900 uppercase mb-1">Stocks</div>
                              <div className="text-lg font-bold text-blue-900">
                                {band ? formatRange(stocksRange(band).min, stocksRange(band).max) : "—"}
                              </div>
                            </div>
                            <div className="p-3 bg-gray-50 rounded border border-gray-300">
                              <div className="text-xs font-semibold text-gray-900 uppercase mb-1">Cash</div>
                              <div className="text-lg font-bold text-gray-900">
                                {band ? formatRange(band.cashMin, band.cashMax) : "—"}
                              </div>
                            </div>
                            <div className="p-3 bg-purple-50 rounded border border-purple-200">
                              <div className="text-xs font-semibold text-purple-900 uppercase mb-1">Position Size</div>
                              <div className="text-sm font-bold text-purple-900">{item.guidance.positionSize}</div>
                            </div>
                          </div>

                          <div className="mb-3">
                            <div className="text-xs font-bold text-gray-900 uppercase mb-2">Top Strategies</div>
                            <div className="space-y-1">
                              {item.guidance.strategies.slice(0, 3).map((strategy, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                  <span className="text-primary mt-1 flex-shrink-0">•</span>
                                  <span>{strategy}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-800 leading-relaxed">
                      <strong>Disclaimer:</strong> Options trading carries significant risk of loss. These strategies
                      are educational examples only. Past performance does not guarantee future results. Always
                      implement proper position sizing, stop losses, and risk management protocols. Consider your
                      personal risk tolerance and market conditions before trading. Not financial advice - consult a
                      licensed professional.
                    </p>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>

        {/* Export Controls */}
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const summary = `CCPI Weekly Outlook\n\n${data.summary.headline}\n\n${data.summary.bullets.join("\n")}\n\nCCPI Score: ${data.ccpi}\nData quality: ${data.certainty}%\nRegime: ${data.regime.name}\n\nGenerated: ${new Date(data.timestamp).toLocaleString()}`
              navigator.clipboard.writeText(summary)
              alert("Summary copied to clipboard!")
            }}
          >
            Copy Summary
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* API Data Source Status - Removed as per update */}
      </div>

      {/* CCPI AI Chat Modal */}
      <CCPIChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        ccpiContext={{
          ccpi: data?.ccpi ?? null,
          certainty: data?.certainty ?? null,
          regime: data?.regime || { name: "Unknown", description: "" },
          // Nulls pass through: an unscored pillar reaching the assistant as 0
          // told it "maximum crash signal" for data that does not exist.
          pillars: data?.pillars ?? { momentum: null, riskAppetite: null, valuation: null, macro: null },
          activeWarnings: data ? countActiveWarnings(data.canaries) : 0,
          // The payload's own scored-indicator count. This was the canary-array
          // length, so the prompt read "3 of 12" against a 29-indicator index.
          totalIndicators: data?.totalIndicators ?? 0,
          crashAmplifiers: data?.crashAmplifiers?.map((ca) => ca.reason) || [],
          activeSignals:
            data?.canaries
              ?.filter((c) => c.severity === "high" || c.severity === "medium")
              .map((c) => ({ name: c.signal, severity: c.severity })) || [],
        }}
      />
    </TooltipProvider>
  )
}
