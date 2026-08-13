"use client"

import type React from "react"

import { TooltipContent } from "@/components/ui/tooltip"

import { useEffect, useState } from "react"
import { DataLoadGate } from "@/components/data-load-gate"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { PANIC_EUPHORIA_ALLOCATION, bandForScore } from "@/lib/allocation"
import { AllocationBar } from "@/components/allocation-bar"
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  DollarSign,
  Shield,
  Lightbulb,
  Info,
  BarChart3,
  AlertTriangle,
} from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"



// P6-13. This file was 1,163 lines. The payload shape, the gradient bar and
// indicator row, the score-band lookups, the per-band trade guidance, the
// conditional tooltip and the four render sections are now in
// `components/panic/`. `getTradeRecommendations` and `getAllLevelGuidance` were
// arrow constants inside the component and are now functions taking the same
// arguments.
import type { PanicEuphoriaData } from "@/components/panic/panic-types"
import { getAllLevelGuidance, getTradeRecommendations } from "@/components/panic/trade-guidance"
import { SentimentScaleSection } from "@/components/panic/sentiment-scale-section"
import { MainIndexSection } from "@/components/panic/main-index-section"
import { TradeRecommendationsSection } from "@/components/panic/trade-recommendations-section"
import { AllLevelGuidanceSection } from "@/components/panic/all-level-guidance-section"

export function PanicEuphoria() {
  const [data, setData] = useState<PanicEuphoriaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)
  const [loaded, setLoaded] = useState(false)

  const fetchData = async () => {
    try {
      const response = await fetch("/api/panic-euphoria")
      if (response.ok) {
        const result = await response.json()
        setData(result)
        setLastUpdated(new Date())
      } else {
        console.error("[v0] Panic/Euphoria API error:", response.status)
      }
    } catch (error) {
      console.error("[v0] Error fetching Panic/Euphoria data:", error)
    }
  }

  useEffect(() => {
    if (!loaded) return

    async function initialFetch() {
      setLoading(true)
      await fetchData()
      setLoading(false)
    }

    initialFetch()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [loaded])

  if (!loaded) {
    return (
      <DataLoadGate
        title="Load Panic & Euphoria Index?"
        description="Fetch Citibank's Panic & Euphoria sentiment data. Nothing loads until you choose to."
        onConfirm={() => setLoaded(true)}
      />
    )
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  // Keyed by level, never by score.


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner message="Loading Panic/Euphoria model data..." />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Unable to load Panic/Euphoria data</div>
      </div>
    )
  }

  // The single classification of this score. Everything else reads off it.
  const allocationBand = bandForScore(PANIC_EUPHORIA_ALLOCATION.bands, data.overallScore)
  const recommendations = getTradeRecommendations(allocationBand?.level ?? null, data.aboveMA)
  const allLevelGuidance = getAllLevelGuidance()

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <SentimentScaleSection
          data={data}
          refreshing={refreshing}
          handleRefresh={handleRefresh}
          tooltipsEnabled={tooltipsEnabled}
          setTooltipsEnabled={setTooltipsEnabled}
        />

        <MainIndexSection
          data={data}
          recommendations={recommendations}
          lastUpdated={lastUpdated}
          refreshing={refreshing}
          handleRefresh={handleRefresh}
        />

        <TradeRecommendationsSection
          data={data}
          recommendations={recommendations}
          allocationBand={allocationBand}
          refreshing={refreshing}
        />

        <AllLevelGuidanceSection
          allLevelGuidance={allLevelGuidance}
          allocationBand={allocationBand}
          recommendations={recommendations}
        />

        {/* Educational Overview */}
        <Card className="shadow-sm border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-2">About the Panic/Euphoria Model</h3>
                <p className="text-sm text-gray-700 leading-relaxed mb-2">
                  This model, based on Citibank's research published in Barron's, measures extreme investor sentiment on
                  a scale from <strong>-1.0 (extreme panic)</strong> to <strong>+1.0 (extreme euphoria)</strong>. It
                  combines <strong>9 market indicators</strong> to identify contrarian buying opportunities during panic
                  and warning signals during euphoria.
                </p>
                <p className="text-sm text-gray-700 leading-relaxed mb-2">
                  <strong>Key insight:</strong> The model is especially valuable when readings drop below -0.10
                  (official Citi panic threshold) while the S&P 500 remains above its 200-week moving average,
                  suggesting a tradable low in the months ahead. Extreme readings below -0.45 have historically preceded
                  powerful rallies.
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  <strong>Historical Performance:</strong> Panic readings below -0.10 show strong positive returns, with
                  extreme panic ({"<"}-0.45) having a <strong>{">"} 95% probability of gains within 12 months</strong>.
                  Euphoria readings above +0.41 have an{" "}
                  <strong>{">"} 80% probability of lower prices within 12 months</strong> (official Citibank data).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
