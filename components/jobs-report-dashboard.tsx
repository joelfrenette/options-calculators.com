"use client"

import type React from "react"

import { useState, useCallback } from "react"
import {
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Users,
  Briefcase,
  DollarSign,
  Info,
  Sparkles,
  Target,
  Calendar,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts"
import { RunScenarioInAIDialog } from "@/components/run-scenario-ai-dialog"
import { DataLoadGate } from "@/components/data-load-gate"

interface JobsData {
  current: {
    unrate: number
    unratePrevMonth: number
    unratePrevYear: number
    unrateYoY: number
    u6: number
    u6PrevYear: number
    u6YoY: number
    unrateU6Diff: number
    nfp: number | null
    nfpPrevMonth: number | null
    nfp3MonthAvg: number | null
    earnings: number | null
    earningsMoM: number | null
    earningsYoY: number | null
    latestMonth: string
  }
  forecast: {
    nextRelease: string
    unratePrediction: number
    unrateRange: { low: number; high: number }
    u6Prediction: number
    u6Range: { low: number; high: number }
    nfpPrediction: string
    nfpRange: { low: string; high: string }
    confidence: number
    trend: "rising" | "falling" | "stable"
    analysis: string
    keyFactors: string[]
    tradingImplications: string[]
  }
  chartData: any[]
  historicalTable: { month: string; rate: number; yoyChange: string }[]
  lastUpdated: string
  dataSource: string
}

const fmtSigned = (v: number, suffix = "%") => `${v > 0 ? "+" : ""}${v}${suffix}`
const fmtNfp = (v: number | null) => (v === null ? "n/a" : `${v >= 0 ? "+" : ""}${v}K`)

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

  const InfoTooltip = ({ content }: { content: string }) => {
    if (!tooltipsEnabled) return null
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-sm bg-white border shadow-lg p-3">
          <p className="text-sm text-gray-700">{content}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const ConditionalTooltip = ({ content, children }: { content: string; children: React.ReactNode }) => {
    if (!tooltipsEnabled) return <>{children}</>
    return (
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-sm bg-white border shadow-lg p-3">
          <p className="text-sm text-gray-700">{content}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0]?.payload
      const isForecast = d?.isForecast
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            {label}
            {isForecast && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">AI Forecast</span>
            )}
          </p>
          {isForecast ? (
            <>
              <p className="text-sm text-[#1E3A8A]">
                UNRATE: {d.unrateForecast}%{" "}
                <span className="text-gray-400">
                  ({d.unrateLow}-{d.unrateHigh}%)
                </span>
              </p>
              <p className="text-sm text-[#0D9488]">
                U-6: {d.u6Forecast}%{" "}
                <span className="text-gray-400">
                  ({d.u6Low}-{d.u6High}%)
                </span>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-[#1E3A8A]">UNRATE: {d.unrate}%</p>
              <p className="text-sm text-[#0D9488]">U-6: {d.u6}%</p>
            </>
          )}
        </div>
      )
    }
    return null
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
                <InfoTooltip content="AI-powered analysis of live employment data to forecast future unemployment trends. Uses official BLS data via FRED (UNRATE/U-3 and U-6) combined with payroll and wage indicators to project upcoming releases." />
              </h1>
              <p className="text-[#0D9488] text-lg font-medium">AI-Powered Employment Forecasts &amp; Analysis</p>
            </div>
            <div className="flex items-center gap-3">
              <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
              <RefreshButton onClick={loadData} isLoading={loading} />
            </div>
          </div>
        </div>

        {/* AI Forecast Summary Card */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 shadow-md border-0 mb-6">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-[#1E3A8A] text-xl">AI Forecast Summary</CardTitle>
                <InfoTooltip content="Forecasts are derived from the recent trend in official BLS series (UNRATE, U-6, payrolls) pulled live from FRED. Confidence reflects how steady the labor market has been." />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">
                    Next Release: <span className="font-semibold text-[#1E3A8A]">{forecast.nextRelease}</span>
                  </span>
                </div>
                <RunScenarioInAIDialog
                  context={{
                    type: "jobs_forecast",
                    title: "BLS Jobs Rate Forecast Analysis",
                    details: `Current UNRATE: ${current.unrate}%, U-6: ${current.u6}%, NFP: ${fmtNfp(current.nfp)}. AI Forecast: UNRATE ${forecast.unratePrediction}% (range: ${forecast.unrateRange.low}-${forecast.unrateRange.high}%), U-6 ${forecast.u6Prediction}% (range: ${forecast.u6Range.low}-${forecast.u6Range.high}%), NFP ${forecast.nfpPrediction} (range: ${forecast.nfpRange.low} to ${forecast.nfpRange.high}). Model confidence: ${forecast.confidence}%. Trend: ${forecast.trend}. Key factors: ${forecast.keyFactors.join(", ")}.`,
                  }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4 mb-4">
              {/* UNRATE Forecast */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">UNRATE Forecast</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-[#1E3A8A]">{forecast.unratePrediction}%</span>
                  <span className="text-xs text-gray-500 pb-1">
                    ({forecast.unrateRange.low}-{forecast.unrateRange.high}%)
                  </span>
                </div>
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> {trendLabel}
                </p>
              </div>

              {/* U-6 Forecast */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">U-6 Forecast</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-[#0D9488]">{forecast.u6Prediction}%</span>
                  <span className="text-xs text-gray-500 pb-1">
                    ({forecast.u6Range.low}-{forecast.u6Range.high}%)
                  </span>
                </div>
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> {u6TrendLabel}
                </p>
              </div>

              {/* NFP Forecast */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">NFP Forecast</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-green-600">{forecast.nfpPrediction}</span>
                  <span className="text-xs text-gray-500 pb-1">
                    ({forecast.nfpRange.low} to {forecast.nfpRange.high})
                  </span>
                </div>
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> {nfpAboveTrend ? "Above trend" : "Below trend"}
                </p>
              </div>

              {/* Confidence Score */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">Forecast Confidence</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-purple-600">{forecast.confidence}%</span>
                  <Target className="h-5 w-5 text-purple-400" />
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${forecast.confidence}%` }} />
                </div>
              </div>
            </div>

            {/* Analysis */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-700 leading-relaxed">{forecast.analysis}</p>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Chart with Forecasts */}
        <Card className="bg-white shadow-md border-0 mb-6">
          <CardHeader>
            <CardTitle className="text-[#1E3A8A] text-xl flex items-center gap-2">
              UNRATE &amp; U-6 Trend with AI Forecasts
              <InfoTooltip content="Historical UNRATE (official U-3) and U-6 (includes discouraged and part-time workers) from FRED, with trend-based forecasts shown as dashed lines. The shaded area represents the forecast confidence interval." />
            </CardTitle>
            <CardDescription className="text-gray-600">
              Historical data through {current.latestMonth}, forecasts projected forward
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="unrateForecastGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1E3A8A" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#1E3A8A" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="u6ForecastGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D9488" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#6B7280" />
                  <YAxis domain={[3, 10]} tick={{ fontSize: 11 }} stroke="#6B7280" tickFormatter={(v) => `${v}%`} />
                  <RechartsTooltip content={<CustomChartTooltip />} />
                  <Legend />

                  {forecastStart && (
                    <ReferenceLine
                      x={forecastStart}
                      stroke="#9333EA"
                      strokeDasharray="5 5"
                      label={{ value: "Forecast →", position: "top", fill: "#9333EA", fontSize: 11 }}
                    />
                  )}

                  <Line
                    type="monotone"
                    dataKey="unrate"
                    name="UNRATE (Actual)"
                    stroke="#1E3A8A"
                    strokeWidth={2}
                    dot={{ fill: "#1E3A8A", r: 3 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="u6"
                    name="U-6 (Actual)"
                    stroke="#0D9488"
                    strokeWidth={2}
                    dot={{ fill: "#0D9488", r: 3 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="unrateForecast"
                    name="UNRATE (AI Forecast)"
                    stroke="#1E3A8A"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: "#1E3A8A", r: 3, strokeDasharray: "0" }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="u6Forecast"
                    name="U-6 (AI Forecast)"
                    stroke="#0D9488"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: "#0D9488", r: 3, strokeDasharray: "0" }}
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="unrateHigh"
                    stroke="transparent"
                    fill="url(#unrateForecastGradient)"
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="u6High"
                    stroke="transparent"
                    fill="url(#u6ForecastGradient)"
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-[#1E3A8A]" />
                <span className="text-gray-600">Actual</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-[#1E3A8A]" style={{ borderTop: "2px dashed #1E3A8A" }} />
                <span className="text-gray-600">AI Forecast</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded" />
                <span className="text-gray-600">Confidence Range</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Row 1: UNRATE and U-6 Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Official Unemployment Rate Card */}
          <ConditionalTooltip content="UNRATE (U-3) is the official unemployment rate. A rate below 4% is considered 'full employment' - bullish for the economy but may pressure the Fed to raise rates. Rising unemployment above 5% signals recession risk - consider defensive strategies like put spreads on cyclical stocks.">
            <Card className="bg-white shadow-md border-0 cursor-help">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-[#0D9488]" />
                  <CardTitle className="text-[#1E3A8A] text-xl">Official Unemployment Rate (UNRATE)</CardTitle>
                </div>
                <CardDescription className="text-gray-600">Bureau of Labor Statistics U-3 measure</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-5xl font-bold text-[#1E3A8A]">{current.unrate}%</span>
                  <span className="text-sm text-amber-600 font-medium pb-2">{fmtSigned(current.unrateYoY)} YoY</span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <strong>Previous Month:</strong> {current.unratePrevMonth}%
                  </p>
                  <p>
                    <strong>Previous Year:</strong> {current.unratePrevYear}%
                  </p>
                  <p>
                    <strong>Interpretation:</strong>{" "}
                    {forecast.trend === "rising"
                      ? "Labor market cooling as unemployment climbs"
                      : forecast.trend === "falling"
                        ? "Labor market re-tightening as unemployment falls"
                        : "Labor market remains solid and steady"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </ConditionalTooltip>

          {/* Broad Unemployment Rate (U-6) Card */}
          <ConditionalTooltip content="U-6 is the broadest measure of unemployment, including discouraged workers and those working part-time for economic reasons. When U-6 is significantly higher than UNRATE, it reveals hidden labor market slack.">
            <Card className="bg-white shadow-md border-0 cursor-help">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#0D9488]" />
                  <CardTitle className="text-[#1E3A8A] text-xl">Broad Unemployment Rate (U-6)</CardTitle>
                </div>
                <CardDescription className="text-gray-600">
                  Includes underemployed &amp; marginally attached workers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-5xl font-bold text-[#0D9488]">{current.u6}%</span>
                  <span className="text-sm text-amber-600 font-medium pb-2">{fmtSigned(current.u6YoY)} YoY</span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <strong>UNRATE Difference:</strong> {fmtSigned(current.unrateU6Diff)}
                  </p>
                  <p>
                    <strong>Year Ago:</strong> {current.u6PrevYear}%
                  </p>
                  <p>
                    <strong>Interpretation:</strong>{" "}
                    {current.unrateU6Diff > 4
                      ? "Elevated hidden slack relative to headline rate"
                      : "In line with typical headline-to-broad spread"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </ConditionalTooltip>
        </div>

        {/* Row 2: Payroll & Wages Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Non-Farm Payrolls Card */}
          <ConditionalTooltip content="Non-Farm Payrolls (NFP) measures the change in employed people excluding farm workers. Above 200K is strong job growth, 100-200K is moderate, below 100K is weak. Strong NFP is bullish for stocks short-term but may lead to Fed tightening.">
            <Card className="bg-white shadow-md border-0 cursor-help">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#0D9488]" />
                  <CardTitle className="text-[#1E3A8A] text-xl">Non-Farm Payrolls (NFP)</CardTitle>
                </div>
                <CardDescription className="text-gray-600">Monthly job additions/losses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-5xl font-bold text-green-600">{fmtNfp(current.nfp)}</span>
                  <span className="text-sm text-green-600 font-medium pb-2">
                    {nfpAboveTrend ? "Above" : "Below"} 3-mo avg
                  </span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <strong>Previous Month:</strong> {fmtNfp(current.nfpPrevMonth)}
                  </p>
                  <p>
                    <strong>3-Month Average:</strong> {fmtNfp(current.nfp3MonthAvg)}
                  </p>
                  <p>
                    <strong>Interpretation:</strong>{" "}
                    {current.nfp !== null && current.nfp >= 200
                      ? "Strong job growth"
                      : current.nfp !== null && current.nfp >= 100
                        ? "Moderate hiring pace"
                        : "Weak hiring — watch for cooling"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </ConditionalTooltip>

          {/* Average Hourly Earnings Card */}
          <ConditionalTooltip content="Average Hourly Earnings measures wage inflation. Rising wages above 3% YoY can pressure corporate margins (bearish) and may lead to Fed rate hikes. Falling wage growth below 2% suggests disinflation, potentially supportive of Fed rate cuts.">
            <Card className="bg-white shadow-md border-0 cursor-help">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-[#0D9488]" />
                  <CardTitle className="text-[#1E3A8A] text-xl">Average Hourly Earnings</CardTitle>
                </div>
                <CardDescription className="text-gray-600">Wage growth indicator</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-5xl font-bold text-[#1E3A8A]">
                    {current.earnings !== null ? `$${current.earnings.toFixed(2)}` : "n/a"}
                  </span>
                  {current.earningsYoY !== null && (
                    <span className="text-sm text-amber-600 font-medium pb-2">{fmtSigned(current.earningsYoY)} YoY</span>
                  )}
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <strong>Monthly Change:</strong>{" "}
                    {current.earningsMoM !== null ? fmtSigned(current.earningsMoM) : "n/a"}
                  </p>
                  <p>
                    <strong>Fed Target:</strong> ~3.0% YoY
                  </p>
                  <p>
                    <strong>Interpretation:</strong>{" "}
                    {current.earningsYoY !== null && current.earningsYoY > 3.5
                      ? "Wage pressures remain elevated, hawkish for Fed"
                      : current.earningsYoY !== null && current.earningsYoY < 2.5
                        ? "Wage growth cooling, supportive of rate cuts"
                        : "Wage growth near the Fed's comfort zone"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </ConditionalTooltip>
        </div>

        {/* AI Trading Implications */}
        <Card className="bg-white shadow-md border-0 mb-6">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-[#1E3A8A] text-xl flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                AI Trading Implications
                <InfoTooltip content="Trading ideas derived from the current employment trend. These are educational suggestions, not financial advice." />
              </CardTitle>
              <RunScenarioInAIDialog
                context={{
                  type: "jobs_trading",
                  title: "Employment-Based Trading Strategies",
                  details: `Current conditions: UNRATE ${current.unrate}% (trend: ${forecast.trend}), U-6 ${current.u6}%, NFP ${fmtNfp(current.nfp)}. Trading implications: ${forecast.tradingImplications.join(" | ")}. Key factors: ${forecast.keyFactors.join(", ")}.`,
                }}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-purple-600" />
                  Key Factors Driving Forecast
                </h4>
                <ul className="space-y-2">
                  {forecast.keyFactors.map((factor, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Options Trading Ideas
                </h4>
                <ul className="space-y-2">
                  {forecast.tradingImplications.map((idea, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-green-600 mt-1">•</span>
                      {idea}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Historical Unemployment Table */}
        <Card className="bg-white shadow-md border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[#1E3A8A] text-xl flex items-center gap-2">
                  Historical Unemployment Data
                  <InfoTooltip content="Track unemployment trends over time to identify labor market cycles. Rising unemployment typically precedes recessions by 6-12 months." />
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Last 12 months of official unemployment rate data (FRED: UNRATE)
                </CardDescription>
              </div>
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-[#0D9488] hover:text-[#0D9488]/80 text-sm font-medium"
              >
                {expanded ? (
                  <>
                    Show Less <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Show All <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Month</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Rate</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">YoY Change</th>
                  </tr>
                </thead>
                <tbody>
                  {(expanded ? historicalTable : historicalTable.slice(0, 5)).map((row, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">{row.month}</td>
                      <td className="py-3 px-4 text-sm font-medium text-[#1E3A8A]">{row.rate}%</td>
                      <td className="py-3 px-4 text-sm">
                        <span
                          className={
                            row.yoyChange.startsWith("+")
                              ? "text-amber-600"
                              : row.yoyChange === "0.0%"
                                ? "text-gray-600"
                                : "text-green-600"
                          }
                        >
                          {row.yoyChange}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Data Source Attribution */}
        <Card className="bg-gray-50 border border-gray-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>
                  {data.dataSource}. Last updated {new Date(data.lastUpdated).toLocaleString()}. Forecasts are estimates
                  and not financial advice.
                </span>
              </div>
              <a
                href="https://www.bls.gov/news.release/empsit.nr0.htm"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[#0D9488] hover:underline"
              >
                View Official Report <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
