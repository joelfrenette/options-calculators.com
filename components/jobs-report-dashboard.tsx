"use client"

import { useState, useCallback } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { TooltipProvider } from "@/components/ui/tooltip"
import { DataLoadGate } from "@/components/data-load-gate"
import { InfoTooltip } from "./jobs-report/jobs-tooltips"
import { ForecastSummaryCard } from "./jobs-report/forecast-summary-card"
import { TrendChartCard } from "./jobs-report/trend-chart-card"
import { IndicatorCards } from "./jobs-report/employment-indicator-cards"
import { TradingImplicationsCard } from "./jobs-report/trading-implications-card"
import { HistoricalTableCard } from "./jobs-report/historical-table-card"
import type { JobsData } from "./jobs-report/jobs-types"

export { JobsReportDashboard }
export default JobsReportDashboard

function JobsReportDashboard() {
  const [expanded, setExpanded] = useState(false)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<JobsData | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/jobs-report", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to load employment data")
      }
      setData(json as JobsData)
    } catch (err) {
      console.error("[v0] Jobs report load error:", err)
      setError(err instanceof Error ? err.message : "Failed to load employment data")
    } finally {
      setLoading(false)
    }
  }, [])

  const handleConfirm = () => {
    setLoaded(true)
    loadData()
  }

  // Gate: nothing loads until the user confirms
  if (!loaded) {
    return (
      <DataLoadGate
        title="Load BLS Jobs Rate Forecaster?"
        description="Fetch the latest live employment data (UNRATE/U-3, U-6, Non-Farm Payrolls, and wage growth) from FRED, plus trend-based forecasts. Nothing loads until you choose to."
        onConfirm={handleConfirm}
      />
    )
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 className="h-10 w-10 text-[#0D9488] animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Fetching live employment data from FRED…</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <Card className="bg-white shadow-md border-0 max-w-xl mx-auto my-12">
        <CardContent className="pt-6 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#1E3A8A] mb-2">Could not load employment data</h3>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 bg-[#0D9488] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0D9488]/90"
          >
            Try Again
          </button>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const { current, forecast, chartData, historicalTable } = data
  const forecastStart = chartData.filter((d) => !d.isForecast).slice(-1)[0]?.month
  const trendLabel = forecast.trend === "rising" ? "Rising" : forecast.trend === "falling" ? "Falling" : "Stable"
  const u6TrendLabel = current.u6YoY > 0 ? "Slight uptick" : current.u6YoY < 0 ? "Easing" : "Stable"
  const nfpAboveTrend =
    current.nfp !== null && current.nfp3MonthAvg !== null ? current.nfp >= current.nfp3MonthAvg : true

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#1E3A8A] mb-2 flex items-center gap-2">
                BLS Jobs Rate Forecaster
                <InfoTooltip
                  enabled={tooltipsEnabled}
                  content="Forecasts computed from official BLS data via FRED (UNRATE/U-3 and U-6) plus payroll and wage indicators. The projection is a trend read over recent months with a three-month payrolls average as the central estimate — deterministic arithmetic on published series, not a model's opinion. Missing inputs are excluded rather than filled in."
                />
              </h1>
              {/* Was "AI-Powered Employment Forecasts & Analysis". /api/jobs-report
                  imports NextResponse, getApiKey and fred-store — no model, no LLM
                  provider, nothing to be powered by. The forecast is a trend read
                  plus a 3-month payrolls average. The label was false in the
                  direction that flatters least: it claimed a guess where the code
                  does deterministic, sourced arithmetic.

                  P7-83: that fix corrected this line and left five more "AI"
                  labels below it — the summary card, the chart title, two series
                  names, the hover chip and the implications card. All corrected
                  with the split. */}
              <p className="text-[#0D9488] text-lg font-medium">Employment Forecasts &amp; Analysis from BLS Data</p>
            </div>
            <div className="flex items-center gap-3">
              <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
              <RefreshButton onClick={loadData} isLoading={loading} />
            </div>
          </div>
        </div>

        <ForecastSummaryCard
          current={current}
          forecast={forecast}
          tooltipsEnabled={tooltipsEnabled}
          trendLabel={trendLabel}
          u6TrendLabel={u6TrendLabel}
          nfpAboveTrend={nfpAboveTrend}
        />

        <TrendChartCard
          chartData={chartData}
          latestMonth={current.latestMonth}
          forecastStart={forecastStart}
          tooltipsEnabled={tooltipsEnabled}
        />

        <IndicatorCards
          current={current}
          forecast={forecast}
          tooltipsEnabled={tooltipsEnabled}
          nfpAboveTrend={nfpAboveTrend}
        />

        <TradingImplicationsCard current={current} forecast={forecast} tooltipsEnabled={tooltipsEnabled} />

        <HistoricalTableCard
          historicalTable={historicalTable}
          dataSource={data.dataSource}
          lastUpdated={data.lastUpdated}
          expanded={expanded}
          onToggleExpanded={() => setExpanded(!expanded)}
          tooltipsEnabled={tooltipsEnabled}
        />
      </div>
    </TooltipProvider>
  )
}
