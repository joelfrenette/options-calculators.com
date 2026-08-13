"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { DataLoadGate } from "@/components/data-load-gate"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { Button } from "@/components/ui/button"
import { RefreshCw, Target, Shield, AlertTriangle, Activity, TrendingUp, Info } from "lucide-react"
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from "recharts"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"


// P6-13. This file was 1,168 lines. The payload shapes, the contribution tile,
// the colour lookups, the options-strategy table, the conditional tooltip and the
// six render sections are now in `components/trend/`. `getOptionsStrategy` was an
// arrow constant inside the component and is now a function taking the same two
// arguments.
import { type TrendAnalysisData, type TrendData } from "@/components/trend/trend-types"
import { getOptionsStrategy } from "@/components/trend/options-strategy"
import { HistoricalScaleSection } from "@/components/trend/historical-scale-section"
import { IndexTrendSection } from "@/components/trend/index-trend-section"
import { PriceForecastSection } from "@/components/trend/price-forecast-section"
import { PriceTargetsSection } from "@/components/trend/price-targets-section"
import { SupportResistanceSection } from "@/components/trend/support-resistance-section"
import { TradingSignalsSection } from "@/components/trend/trading-signals-section"

export function TrendAnalysis() {
  const [data, setData] = useState<TrendAnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<"SPY" | "SPX" | "QQQ">("SPY")
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)
  const [loaded, setLoaded] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/trend-analysis")
      if (!response.ok) throw new Error("Failed to fetch trend data")
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (loaded) fetchData()
  }, [loaded])

  if (!loaded) {
    return (
      <DataLoadGate
        title="Load Index Trend Analysis?"
        description="Fetch the latest trend data for SPY, QQQ, IWM, and DIA. Nothing loads until you choose to."
        onConfirm={() => setLoaded(true)}
      />
    )
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-lg text-gray-600">Loading trend data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-red-600">Error: {error}</p>
          <Button onClick={fetchData} className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const selectedItem = data.indices.find((item) => item.name === selectedTicker)

  if (!selectedItem) return null

  const strategy = getOptionsStrategy(selectedTicker, selectedItem)


  return (
    <TooltipProvider>
      <div className="space-y-4">
        <HistoricalScaleSection
          selectedItem={selectedItem}
          loading={loading}
          fetchData={fetchData}
          tooltipsEnabled={tooltipsEnabled}
          setTooltipsEnabled={setTooltipsEnabled}
        />
        <IndexTrendSection
          data={data}
          selectedTicker={selectedTicker}
          setSelectedTicker={setSelectedTicker}
          loading={loading}
          fetchData={fetchData}
        />
        <PriceForecastSection
          selectedItem={selectedItem}
        />
        <PriceTargetsSection
          selectedItem={selectedItem}
        />
        <SupportResistanceSection
          selectedItem={selectedItem}
        />
        <TradingSignalsSection
          selectedItem={selectedItem}
          selectedTicker={selectedTicker}
          strategy={strategy}
        />
      </div>
    </TooltipProvider>
  )
}
