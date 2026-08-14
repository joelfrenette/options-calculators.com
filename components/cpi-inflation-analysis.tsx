"use client"

import { useState, useEffect } from "react"
import { DataLoadGate } from "@/components/data-load-gate"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { CpiInfoTooltip } from "./cpi-inflation/cpi-info-tooltip"
import { MethodologyCard } from "./cpi-inflation/methodology-card"
import { ProjectionChartCard } from "./cpi-inflation/projection-chart-card"
import { CurrentStatusCard } from "./cpi-inflation/current-status-card"
import { ProjectionTableCard } from "./cpi-inflation/projection-table-card"
import { StrategiesCard } from "./cpi-inflation/strategies-card"
import type { CPIData } from "./cpi-inflation/cpi-types"

export function CpiInflationAnalysis() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cpiData, setCpiData] = useState<CPIData | null>(null)
  const [showCalculations, setShowCalculations] = useState(false)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)
  const [loaded, setLoaded] = useState(false)

  const fetchCPIData = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/cpi-inflation")
      if (!response.ok) throw new Error("Failed to fetch CPI data")

      const data = await response.json()
      setCpiData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (loaded) fetchCPIData()
  }, [loaded])

  if (!loaded) {
    return (
      <DataLoadGate
        title="Load CPI Inflation Analysis?"
        description="Fetch the latest Consumer Price Index inflation data. Nothing loads until you choose to."
        onConfirm={() => setLoaded(true)}
      />
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-7xl space-y-6">
        <div className="text-center py-12">
          <LoadingSpinner message="Loading CPI inflation data..." />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 max-w-7xl space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <button onClick={fetchCPIData} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
          Try Again
        </button>
      </div>
    )
  }

  if (!cpiData) {
    return (
      <div className="container mx-auto p-4 max-w-7xl space-y-6">
        <div className="text-center py-12">
          <p className="text-gray-600">No data available</p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  U.S. Inflation (CPI-U) Forecast
                  <CpiInfoTooltip
                    enabled={tooltipsEnabled}
                    content="CPI (Consumer Price Index) measures the average change in prices paid by consumers for goods and services. Rising CPI signals inflation, which typically leads to Fed rate hikes - bad for growth stocks but can benefit value and commodity sectors."
                  />
                </CardTitle>
                <CardDescription className="mt-1">
                  Consumer Price Index year-over-year change with a 24-month trend extrapolation
                  {cpiData?.lastUpdated && (
                    <span className="ml-2 text-xs">(Updated: {new Date(cpiData.lastUpdated).toLocaleString()})</span>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
                <button
                  onClick={() => setShowCalculations(!showCalculations)}
                  className="px-3 py-2 text-sm font-medium border rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {showCalculations ? "Hide" : "Show"} Calculations
                </button>
                <RefreshButton onClick={fetchCPIData} isLoading={loading} />
              </div>
            </div>
          </CardHeader>
        </Card>

        {showCalculations && cpiData && <MethodologyCard cpiData={cpiData} />}

        <ProjectionChartCard cpiData={cpiData} tooltipsEnabled={tooltipsEnabled} />

        <CurrentStatusCard cpiData={cpiData} tooltipsEnabled={tooltipsEnabled} />

        {cpiData.forecastData && cpiData.forecastData.length > 0 && (
          <ProjectionTableCard forecastData={cpiData.forecastData} />
        )}

        {cpiData.optionsStrategies && cpiData.optionsStrategies.length > 0 && <StrategiesCard cpiData={cpiData} />}
      </div>
    </TooltipProvider>
  )
}
