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
import { saveCCPIToCache, loadCCPIFromCache, hasFreshCache, CACHE_FRESH_MINUTES } from "@/lib/ccpi/cache"
import { REFRESH_STATUS_MESSAGES } from "@/lib/ccpi/constants"
import { CCPI_ALLOCATION, bandForScore } from "@/lib/allocation"
import { AllocationBar } from "@/components/allocation-bar"
import { CCPIChatModal } from "./ccpi-chat-modal"
import { RefreshButton } from "./ui/refresh-button" // Assuming RefreshButton is in ui/refresh-button.tsx
import { DataLoadGate } from "@/components/data-load-gate"

import { getSignalTooltip, getCrashAmplifierTooltip } from "@/components/ccpi/tooltip-copy"
import { TriggerSection } from "@/components/ccpi/trigger-section"
import { PillarMomentum } from "@/components/ccpi/pillar-momentum"
import { PillarRiskAppetite } from "@/components/ccpi/pillar-risk-appetite"
import { PillarValuation } from "@/components/ccpi/pillar-valuation"
import { PillarMacro } from "@/components/ccpi/pillar-macro"

// P6-13. This file was 992 lines. Four render sections — the score card, the
// crash amplifiers, the canaries and the allocation block — are now child
// components in `components/ccpi/`, unchanged.
import { ScoreCard } from "@/components/ccpi/dashboard-score-card"
import { CrashAmplifiersCard } from "@/components/ccpi/dashboard-amplifiers-card"
import { CanariesCard } from "@/components/ccpi/dashboard-canaries-card"
import { AllocationCard } from "@/components/ccpi/dashboard-allocation-card"

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

  /**
   * P7-16. What the header says about this reading's age, or null when there is
   * no reading to date.
   *
   * `cached` and `when` come from state that already existed and was never
   * read; `stale` is `hasFreshCache()` inverted — the age check that had been
   * wired only into the unreachable hook deleted in P7-14.
   *
   * The staleness flag is deliberately shown only for a CACHED reading. A fresh
   * fetch is current by construction, and running the localStorage age check
   * against it would report on the stored copy rather than on what is displayed.
   */
  const reading = useMemo(() => {
    const iso = cacheTimestamp ?? data?.timestamp ?? null
    if (!iso) return null
    const when = new Date(iso)
    if (Number.isNaN(when.getTime())) return null
    return {
      cached: fromCache,
      when: when.toLocaleString(),
      stale: fromCache && !hasFreshCache(CACHE_FRESH_MINUTES),
    }
  }, [fromCache, cacheTimestamp, data])

  const ccpiScore = useMemo(() => (data ? Math.round(data.ccpi) : 0), [data])
  const zone = useMemo(() => getRegimeZone(ccpiScore), [ccpiScore])
  const regimeColor = useMemo(() => getReadableColor(zone.color), [zone.color])
  const sortedCanaries = useMemo(() => (data ? sortCanaries(data.canaries) : []), [data])
  const activeCanariesCount = useMemo(() => (data ? countActiveWarnings(data.canaries) : 0), [data])
  /**
   * The scored-indicator count the payload reported, or null.
   *
   * P7-2. This component carried `data.totalIndicators || 29` in five places —
   * the exact idiom `ccpi-audit-admin.tsx` records as removed ("invented 29 for
   * any falsy value") while the flagship dashboard kept it. `totalIndicators` is
   * optional on `CCPIData` and derived route-side from the weight tables
   * (`TOTAL_SCORED_INDICATORS`, currently 29), so the literal is right only by
   * coincidence: change a weight table and five render sites keep printing 29.
   * A denominator is a measurement; a missing one renders "—".
   */
  const indicatorCount = useMemo(
    () => (typeof data?.totalIndicators === "number" ? data.totalIndicators : null),
    [data],
  )

  const fetchExecutiveSummary = useCallback(async (ccpiData: CCPIData) => {
    try {
      setSummaryLoading(true)

      const summaryPayload = {
        // P7-19. `Math.round(ccpiData.ccpi)` and `certainty || 0`.
        // **`Math.round(null)` is 0**, so an unscoreable composite left here as
        // a hard zero — and the summary route's prompt tells the model
        // "0-19: Low Risk (markets healthy)". The absence was narrated as the
        // strongest possible all-clear, by the one field the whole summary is
        // about. P6-19 fixed the PILLARS in this same payload and left the
        // composite, which is why `pillars` two lines down is already careful.
        ccpi: typeof ccpiData.ccpi === "number" ? Math.round(ccpiData.ccpi) : null,
        certainty: typeof ccpiData.certainty === "number" ? ccpiData.certainty : null,
        activeCanaries: ccpiData.canaries ? countActiveWarnings(ccpiData.canaries) : 0,
        // The payload's scored-indicator count, not the canary-array length —
        // "3 of 12" was being narrated against a 29-indicator index.
        totalIndicators: ccpiData.totalIndicators ?? null,
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
      // Was: setExecutiveSummary("Executive summary is temporarily unavailable.
      // Market analysis data has been successfully loaded.") — which is a
      // sentence, so it rendered in the summary slot under "Generated by Grok
      // xAI". A failure wearing a model's byline is worse than a blank space.
      setExecutiveSummary(null)
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

      // P2-2. The POST to /api/ccpi/cache is gone with the route. It wrote a
      // module-level variable on whichever serverless instance answered, and the
      // next request would probably not reach that instance. Client-side caching
      // is unaffected — that is `saveCCPIToCache` above, which uses localStorage
      // and actually persists.

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
      // P7-9. `saveHistoryToCache(result)` was here. It wrote the full history
      // series to localStorage on every fetch and nothing ever read that key
      // back — a write-only cache, spending the origin's storage quota against
      // the CCPI snapshot that IS read. History comes from /api/ccpi/history on
      // each load; the fetch above is the whole path.
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
            {/* P7-16. This said "Real-time market crash risk assessment". The tab
                restores a localStorage snapshot on load and does not refetch
                until the user asks, so "real-time" was a claim the component
                contradicts on its most common path — the first render after a
                revisit. The freshness claim now lives on the timestamp line
                below, where it is derived from the data instead of asserted
                over it. */}
            <p className="text-muted-foreground">Market crash risk assessment across 4 key dimensions</p>
            <p className="text-xs text-muted-foreground italic mt-0.5">
              Original index designed by Joel Frenette
            </p>
            {/* P7-16. This block read `data?.lastUpdated`, which /api/ccpi never
                returns: `lastUpdated` exists only inside each `apiStatus` source
                entry, and the type marks the top-level field optional, so the
                guard silently failed and NO date rendered at all. Meanwhile
                `fromCache` and `cacheTimestamp` were written at four sites and
                read at none. The result was a tab that could show a snapshot of
                any age with nothing on screen dating it.
                `timestamp` is the field the route actually sends. */}
            {reading && (
              <p className="text-xs text-muted-foreground mt-1">
                {reading.cached ? "Cached reading from" : "Updated"} {reading.when}
                {reading.stale && (
                  <span className="ml-1 font-medium text-amber-700">
                    · over {CACHE_FRESH_MINUTES} min old — press Refresh for current data
                  </span>
                )}
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

        <ScoreCard
          data={data}
          ccpiScore={ccpiScore}
          zone={zone}
          executiveSummary={executiveSummary}
          summaryLoading={summaryLoading}
          indicatorCount={indicatorCount}
          regimeColor={regimeColor}
          setIsChatOpen={setIsChatOpen}
        />

        <CrashAmplifiersCard
          data={data}
        />

        <CanariesCard
          data={data}
          sortedCanaries={sortedCanaries}
          activeCanariesCount={activeCanariesCount}
          indicatorCount={indicatorCount}
          tooltipsEnabled={tooltipsEnabled}
        />

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
        {/*
          All four open on load, by owner decision. §7a asked for the coincident
          group to be collapsed by default; the badge and caveat on the pillar
          carry that warning whether it is open or shut, so collapsing it bought
          nothing the label does not already say.
        */}
        <Accordion type="multiple" defaultValue={["pillar1", "pillar2", "pillar3", "pillar4"]} className="space-y-4">
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

        <AllocationCard
          currentBand={currentBand}
        />
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
          totalIndicators: data?.totalIndicators ?? null,
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
