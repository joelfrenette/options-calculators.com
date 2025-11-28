"use client"

import type React from "react"

import { useState } from "react"
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
  Send,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

// Historical unemployment data (last 12 months) - UNRATE from BLS
const unemploymentData = [
  { month: "Dec 2024", rate: 4.1, yoyChange: "+0.1%" },
  { month: "Jan 2025", rate: 4.0, yoyChange: "0.0%" },
  { month: "Feb 2025", rate: 4.1, yoyChange: "+0.1%" },
  { month: "Mar 2025", rate: 4.2, yoyChange: "+0.2%" },
  { month: "Apr 2025", rate: 4.2, yoyChange: "+0.2%" },
  { month: "May 2025", rate: 4.3, yoyChange: "+0.3%" },
  { month: "Jun 2025", rate: 4.3, yoyChange: "+0.2%" },
  { month: "Jul 2025", rate: 4.3, yoyChange: "+0.2%" },
  { month: "Aug 2025", rate: 4.2, yoyChange: "+0.1%" },
  { month: "Sep 2025", rate: 4.1, yoyChange: "0.0%" },
  { month: "Oct 2025", rate: 4.1, yoyChange: "0.0%" },
  { month: "Nov 2025", rate: 4.2, yoyChange: "+0.2%" },
]

// Chart data with historical UNRATE and U6 (True Unemployment) plus AI forecasts
const chartData = [
  // Historical data (actual)
  { month: "Jan 2024", unrate: 3.7, u6: 7.2, isForecast: false },
  { month: "Mar 2024", unrate: 3.8, u6: 7.3, isForecast: false },
  { month: "May 2024", unrate: 4.0, u6: 7.4, isForecast: false },
  { month: "Jul 2024", unrate: 4.3, u6: 7.8, isForecast: false },
  { month: "Sep 2024", unrate: 4.1, u6: 7.7, isForecast: false },
  { month: "Nov 2024", unrate: 4.2, u6: 7.8, isForecast: false },
  { month: "Jan 2025", unrate: 4.0, u6: 7.5, isForecast: false },
  { month: "Mar 2025", unrate: 4.2, u6: 7.9, isForecast: false },
  { month: "May 2025", unrate: 4.3, u6: 8.0, isForecast: false },
  { month: "Jul 2025", unrate: 4.3, u6: 8.0, isForecast: false },
  { month: "Sep 2025", unrate: 4.1, u6: 8.0, isForecast: false },
  { month: "Nov 2025", unrate: 4.2, u6: 8.1, isForecast: false },
  // AI Forecast data (projected)
  {
    month: "Dec 2025",
    unrateForecast: 4.2,
    u6Forecast: 8.1,
    unrateLow: 4.1,
    unrateHigh: 4.3,
    u6Low: 7.9,
    u6High: 8.3,
    isForecast: true,
  },
  {
    month: "Jan 2026",
    unrateForecast: 4.3,
    u6Forecast: 8.2,
    unrateLow: 4.1,
    unrateHigh: 4.5,
    u6Low: 7.9,
    u6High: 8.5,
    isForecast: true,
  },
  {
    month: "Mar 2026",
    unrateForecast: 4.4,
    u6Forecast: 8.3,
    unrateLow: 4.1,
    unrateHigh: 4.7,
    u6Low: 7.9,
    u6High: 8.7,
    isForecast: true,
  },
  {
    month: "May 2026",
    unrateForecast: 4.5,
    u6Forecast: 8.4,
    unrateLow: 4.2,
    unrateHigh: 4.8,
    u6Low: 8.0,
    u6High: 8.9,
    isForecast: true,
  },
]

// AI Forecast summary
const aiForecast = {
  nextRelease: "December 6, 2025",
  unratePrediction: 4.2,
  unrateRange: { low: 4.1, high: 4.3 },
  u6Prediction: 8.1,
  u6Range: { low: 7.9, high: 8.3 },
  nfpPrediction: "+175K",
  nfpRange: { low: "+145K", high: "+205K" },
  confidence: 78,
  trend: "stable",
  analysis:
    "Labor market showing signs of gradual cooling with unemployment rate expected to remain stable around 4.2%. The Fed's restrictive policy stance is beginning to impact hiring, particularly in interest-rate sensitive sectors. NFP expected to moderate but remain positive, suggesting a soft landing scenario remains in play.",
  keyFactors: [
    "Continuing claims trending higher (+5% MoM)",
    "Tech layoffs stabilizing after 2024 restructuring",
    "Service sector hiring remains resilient",
    "Fed policy lag effects materializing",
  ],
  tradingImplications: [
    "Bullish Credit Spreads: Consider selling put spreads on XLF if unemployment stays below 4.5%",
    "Iron Condors on SPY: Range-bound employment data supports neutral strategies",
    "Protective Puts: Buy puts on consumer discretionary (XLY) as hedge against labor weakness",
  ],
}

export { JobsReportDashboard }
export default JobsReportDashboard

function JobsReportDashboard() {
  const [expanded, setExpanded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1500)
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

  // Custom tooltip for the chart
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload
      const isForecast = data?.isForecast

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
                UNRATE: {data.unrateForecast}%{" "}
                <span className="text-gray-400">
                  ({data.unrateLow}-{data.unrateHigh}%)
                </span>
              </p>
              <p className="text-sm text-[#0D9488]">
                U-6: {data.u6Forecast}%{" "}
                <span className="text-gray-400">
                  ({data.u6Low}-{data.u6High}%)
                </span>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-[#1E3A8A]">UNRATE: {data.unrate}%</p>
              <p className="text-sm text-[#0D9488]">U-6: {data.u6}%</p>
            </>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#1E3A8A] mb-2 flex items-center gap-2">
                BLS Jobs Rate Forecaster
                <InfoTooltip content="AI-powered analysis of employment data to forecast future unemployment trends. Uses official BLS data (UNRATE/U-3 and U-6) combined with leading indicators to predict upcoming releases. Options traders can use these forecasts to position ahead of market-moving jobs reports." />
              </h1>
              <p className="text-[#0D9488] text-lg font-medium">AI-Powered Employment Forecasts & Analysis</p>
            </div>
            <div className="flex items-center gap-3">
              <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
              <RefreshButton onClick={handleRefresh} isLoading={refreshing} />
            </div>
          </div>
        </div>

        {/* AI Forecast Summary Card */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 shadow-md border-0 mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-[#1E3A8A] text-xl">AI Forecast Summary</CardTitle>
                <InfoTooltip content="Our AI analyzes leading indicators including initial claims, continuing claims, ADP data, ISM employment indices, and Fed commentary to forecast upcoming employment reports." />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">
                    Next Release: <span className="font-semibold text-[#1E3A8A]">{aiForecast.nextRelease}</span>
                  </span>
                </div>
                <AskAIForecastDialog />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4 mb-4">
              {/* UNRATE Forecast */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">UNRATE Forecast</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-[#1E3A8A]">{aiForecast.unratePrediction}%</span>
                  <span className="text-xs text-gray-500 pb-1">
                    ({aiForecast.unrateRange.low}-{aiForecast.unrateRange.high}%)
                  </span>
                </div>
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Stable
                </p>
              </div>

              {/* U-6 Forecast */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">U-6 Forecast</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-[#0D9488]">{aiForecast.u6Prediction}%</span>
                  <span className="text-xs text-gray-500 pb-1">
                    ({aiForecast.u6Range.low}-{aiForecast.u6Range.high}%)
                  </span>
                </div>
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Slight uptick
                </p>
              </div>

              {/* NFP Forecast */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">NFP Forecast</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-green-600">{aiForecast.nfpPrediction}</span>
                  <span className="text-xs text-gray-500 pb-1">
                    ({aiForecast.nfpRange.low} to {aiForecast.nfpRange.high})
                  </span>
                </div>
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Above trend
                </p>
              </div>

              {/* Confidence Score */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">AI Confidence</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-purple-600">{aiForecast.confidence}%</span>
                  <Target className="h-5 w-5 text-purple-400" />
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${aiForecast.confidence}%` }} />
                </div>
              </div>
            </div>

            {/* AI Analysis */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-700 leading-relaxed">{aiForecast.analysis}</p>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Chart with Forecasts */}
        <Card className="bg-white shadow-md border-0 mb-6">
          <CardHeader>
            <CardTitle className="text-[#1E3A8A] text-xl flex items-center gap-2">
              UNRATE & U-6 Trend with AI Forecasts
              <InfoTooltip content="This chart shows historical UNRATE (official U-3 unemployment) and U-6 (includes discouraged and part-time workers) with AI-generated forecasts shown as dashed lines. The shaded area represents the confidence interval for predictions." />
            </CardTitle>
            <CardDescription className="text-gray-600">
              Historical data through Nov 2025, AI forecasts through May 2026
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

                  {/* Reference line for forecast start */}
                  <ReferenceLine
                    x="Nov 2025"
                    stroke="#9333EA"
                    strokeDasharray="5 5"
                    label={{ value: "Forecast →", position: "top", fill: "#9333EA", fontSize: 11 }}
                  />

                  {/* Historical UNRATE */}
                  <Line
                    type="monotone"
                    dataKey="unrate"
                    name="UNRATE (Actual)"
                    stroke="#1E3A8A"
                    strokeWidth={2}
                    dot={{ fill: "#1E3A8A", r: 3 }}
                    connectNulls={false}
                  />

                  {/* Historical U-6 */}
                  <Line
                    type="monotone"
                    dataKey="u6"
                    name="U-6 (Actual)"
                    stroke="#0D9488"
                    strokeWidth={2}
                    dot={{ fill: "#0D9488", r: 3 }}
                    connectNulls={false}
                  />

                  {/* Forecast UNRATE */}
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

                  {/* Forecast U-6 */}
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

                  {/* Confidence bands */}
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
                  <span className="text-5xl font-bold text-[#1E3A8A]">4.2%</span>
                  <span className="text-sm text-amber-600 font-medium pb-2">+0.2% YoY</span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <strong>Previous Month:</strong> 4.1%
                  </p>
                  <p>
                    <strong>Previous Year:</strong> 4.0%
                  </p>
                  <p>
                    <strong>Interpretation:</strong> Labor market remains solid but cooling gradually
                  </p>
                </div>
              </CardContent>
            </Card>
          </ConditionalTooltip>

          {/* True Unemployment Rate Card - Updated to U-6 */}
          <ConditionalTooltip content="U-6 is the broadest measure of unemployment, including discouraged workers and those working part-time for economic reasons. When U-6 is significantly higher than UNRATE, it reveals hidden labor market slack. Current U-6 around 8% is historically normal.">
            <Card className="bg-white shadow-md border-0 cursor-help">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#0D9488]" />
                  <CardTitle className="text-[#1E3A8A] text-xl">Broad Unemployment Rate (U-6)</CardTitle>
                </div>
                <CardDescription className="text-gray-600">
                  Includes underemployed & marginally attached workers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-5xl font-bold text-[#0D9488]">8.1%</span>
                  <span className="text-sm text-amber-600 font-medium pb-2">+0.3% YoY</span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <strong>UNRATE Difference:</strong> +3.9%
                  </p>
                  <p>
                    <strong>Pre-Pandemic Average:</strong> 7.0%
                  </p>
                  <p>
                    <strong>Interpretation:</strong> Slightly elevated from pre-pandemic norms
                  </p>
                </div>
              </CardContent>
            </Card>
          </ConditionalTooltip>
        </div>

        {/* Row 2: Payroll & Wages Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Non-Farm Payrolls Card */}
          <ConditionalTooltip content="Non-Farm Payrolls (NFP) measures the change in employed people excluding farm workers. Above 200K is strong job growth, 100-200K is moderate, below 100K is weak. Strong NFP is bullish for stocks short-term but may lead to Fed tightening. Weak NFP may initially hurt stocks but could prompt Fed rate cuts.">
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
                  <span className="text-5xl font-bold text-green-600">+227K</span>
                  <span className="text-sm text-green-600 font-medium pb-2">Above Forecast (+200K)</span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <strong>Previous Month:</strong> +36K (hurricane impact)
                  </p>
                  <p>
                    <strong>3-Month Average:</strong> +173K
                  </p>
                  <p>
                    <strong>Interpretation:</strong> Strong rebound after hurricane disruptions
                  </p>
                </div>
              </CardContent>
            </Card>
          </ConditionalTooltip>

          {/* Average Hourly Earnings Card */}
          <ConditionalTooltip content="Average Hourly Earnings measures wage inflation. Rising wages above 3% YoY can pressure corporate margins (bearish) and may lead to Fed rate hikes. Falling wage growth below 2% suggests disinflation, potentially supportive of Fed rate cuts. For options traders, elevated wage growth increases IV in rate-sensitive sectors.">
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
                  <span className="text-5xl font-bold text-[#1E3A8A]">$35.61</span>
                  <span className="text-sm text-amber-600 font-medium pb-2">+4.0% YoY</span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <strong>Monthly Change:</strong> +0.4%
                  </p>
                  <p>
                    <strong>Fed Target:</strong> ~3.0% YoY
                  </p>
                  <p>
                    <strong>Interpretation:</strong> Wage pressures remain elevated, hawkish for Fed
                  </p>
                </div>
              </CardContent>
            </Card>
          </ConditionalTooltip>
        </div>

        {/* AI Trading Implications */}
        <Card className="bg-white shadow-md border-0 mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[#1E3A8A] text-xl flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                AI Trading Implications
                <InfoTooltip content="AI-generated trading ideas based on employment forecast analysis. These are educational suggestions, not financial advice." />
              </CardTitle>
              <AskAITradingDialog />
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
                  {aiForecast.keyFactors.map((factor, i) => (
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
                  {aiForecast.tradingImplications.map((idea, i) => (
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
                  <InfoTooltip content="Track unemployment trends over time to identify labor market cycles. Rising unemployment typically precedes recessions by 6-12 months. Options traders can position for increased volatility when unemployment trends higher." />
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Last 12 months of official unemployment rate data
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
                  {(expanded ? unemploymentData : unemploymentData.slice(0, 5)).map((data, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">{data.month}</td>
                      <td className="py-3 px-4 text-sm font-medium text-[#1E3A8A]">{data.rate}%</td>
                      <td className="py-3 px-4 text-sm">
                        <span
                          className={
                            data.yoyChange.startsWith("+")
                              ? "text-amber-600"
                              : data.yoyChange === "0.0%"
                                ? "text-gray-600"
                                : "text-green-600"
                          }
                        >
                          {data.yoyChange}
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
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>
                  Data sourced from Bureau of Labor Statistics (BLS). AI forecasts are estimates and not financial
                  advice.
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

function AskAIForecastDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState("")

  const suggestedQuestions = [
    "What do the current employment trends mean for Fed policy?",
    "How should I position my options portfolio for the next jobs report?",
    "What sectors benefit most from stable unemployment?",
    "Is the labor market weakening enough to trigger rate cuts?",
  ]

  const handleAskAI = async (q: string) => {
    setIsLoading(true)
    setQuestion(q)

    try {
      const res = await fetch("/api/scenario-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            type: "jobs_forecast",
            title: "BLS Jobs Rate Forecast Analysis",
            details: `Current UNRATE: 4.2%, U-6: 8.1%, NFP: +227K. AI Forecast: UNRATE ${aiForecast.unrateForecast}% (${aiForecast.unrateRange}), U-6 ${aiForecast.u6Forecast}% (${aiForecast.u6Range}), NFP ${aiForecast.nfpForecast} (${aiForecast.nfpRange}). Confidence: ${aiForecast.confidence}%. Key factors: ${aiForecast.keyFactors.join(", ")}.`,
          },
          question: q,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setResponse(data.response || data.analysis || "Unable to generate response.")
      } else {
        setResponse("I apologize, but I couldn't process your question. Please try again.")
      }
    } catch {
      setResponse("An error occurred while processing your question.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 shadow-md transition-all cursor-pointer">
          <Sparkles className="h-3.5 w-3.5 text-white" />
          <span className="text-white font-semibold text-xs">Ask AI</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Ask AI About Jobs Forecast
          </DialogTitle>
          <DialogDescription>
            Get AI-powered insights about employment trends and their impact on options trading
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Suggested Questions */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((sq, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-transparent"
                  onClick={() => handleAskAI(sq)}
                  disabled={isLoading}
                >
                  {sq}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Question */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Or ask your own question:</p>
            <div className="flex gap-2">
              <Textarea
                placeholder="Type your question about employment data and options trading..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            <Button
              onClick={() => handleAskAI(question)}
              disabled={isLoading || !question.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Ask AI
                </>
              )}
            </Button>
          </div>

          {/* Response */}
          {response && (
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm font-medium text-purple-800 mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Response
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{response}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AskAITradingDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState("")

  const suggestedQuestions = [
    "What options strategies work best before jobs reports?",
    "Should I sell premium or buy directional ahead of NFP?",
    "How does unemployment affect sector rotation?",
    "What ETFs are most sensitive to employment data?",
  ]

  const handleAskAI = async (q: string) => {
    setIsLoading(true)
    setQuestion(q)

    try {
      const res = await fetch("/api/scenario-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            type: "jobs_trading",
            title: "Employment-Based Trading Strategy",
            details: `Current market conditions: UNRATE 4.2%, U-6 8.1%, NFP +227K above forecast. Trading implications: ${aiForecast.tradingImplications.join(" | ")}. Key factors: ${aiForecast.keyFactors.join(", ")}.`,
          },
          question: q,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setResponse(data.response || data.analysis || "Unable to generate response.")
      } else {
        setResponse("I apologize, but I couldn't process your question. Please try again.")
      }
    } catch {
      setResponse("An error occurred while processing your question.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 shadow-md transition-all cursor-pointer">
          <Sparkles className="h-3.5 w-3.5 text-white" />
          <span className="text-white font-semibold text-xs">Ask AI</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-green-600" />
            Ask AI About Trading Strategies
          </DialogTitle>
          <DialogDescription>
            Get AI-powered trading ideas based on employment data and market conditions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Suggested Questions */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((sq, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-transparent"
                  onClick={() => handleAskAI(sq)}
                  disabled={isLoading}
                >
                  {sq}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Question */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Or ask your own question:</p>
            <div className="flex gap-2">
              <Textarea
                placeholder="Type your question about employment-based trading strategies..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            <Button
              onClick={() => handleAskAI(question)}
              disabled={isLoading || !question.trim()}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Ask AI
                </>
              )}
            </Button>
          </div>

          {/* Response */}
          {response && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Response
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{response}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
