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
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

// Sample unemployment data (last 12 months)
const unemploymentData = [
  { month: "Dec 2024", rate: 4.1, yoyChange: "+0.1%" },
  { month: "Jan 2025", rate: 4.0, yoyChange: "0.0%" },
  { month: "Feb 2025", rate: 4.1, yoyChange: "+0.1%" },
  { month: "Mar 2025", rate: 4.2, yoyChange: "+0.2%" },
  { month: "Apr 2025", rate: 4.2, yoyChange: "+0.2%" },
  { month: "May 2025", rate: 4.3, yoyChange: "+0.3%" },
  { month: "Jun 2025", rate: 4.3, yoyChange: "+0.2%" },
  { month: "Jul 2025", rate: 4.3, yoyChange: "+0.2%" },
  { month: "Aug 2025", rate: 4.3, yoyChange: "+0.2%" },
  { month: "Sep 2025", rate: 4.4, yoyChange: "+0.3%" },
  { month: "Oct 2025", rate: 4.4, yoyChange: "+0.3%" },
  { month: "Nov 2025", rate: 4.4, yoyChange: "+0.2%" },
]

// Chart data for trend visualization
const chartData = [
  { month: "Apr 2020", unrate: 14.8, tru: 32.1 },
  { month: "Dec 2020", unrate: 6.7, tru: 26.4 },
  { month: "Jun 2021", unrate: 5.9, tru: 25.2 },
  { month: "Dec 2021", unrate: 3.9, tru: 23.8 },
  { month: "Jun 2022", unrate: 3.6, tru: 22.5 },
  { month: "Dec 2022", unrate: 3.5, tru: 22.1 },
  { month: "Jun 2023", unrate: 3.6, tru: 22.8 },
  { month: "Dec 2023", unrate: 3.7, tru: 23.2 },
  { month: "Jun 2024", unrate: 4.1, tru: 24.0 },
  { month: "Dec 2024", unrate: 4.1, tru: 24.3 },
  { month: "Jun 2025", unrate: 4.3, tru: 24.5 },
  { month: "Nov 2025", unrate: 4.4, tru: 24.7 },
]

// NFP expectations data
const nfpExpectations = [
  { event: "Nonfarm Payrolls", consensus: "+160k", previous: "+150k" },
  { event: "Unemployment Rate", consensus: "4.4%", previous: "4.4%" },
  { event: "Avg Hourly Earnings MoM", consensus: "+0.3%", previous: "+0.4%" },
  { event: "Avg Hourly Earnings YoY", consensus: "+4.0%", previous: "+4.1%" },
  { event: "Labor Force Participation", consensus: "62.6%", previous: "62.5%" },
]

// TRU demographic breakdown
const truBreakdown = [
  { group: "Overall", rate: "24.7%" },
  { group: "Black", rate: "12.5%" },
  { group: "Hispanic", rate: "10.8%" },
  { group: "White", rate: "20.1%" },
  { group: "Youth (16-24)", rate: "13.2%" },
]

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

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#1E3A8A] mb-2 flex items-center gap-2">
                US Jobs Report Dashboard
                <InfoTooltip content="The monthly jobs report (Non-Farm Payrolls) is one of the most market-moving economic releases. Strong jobs growth is bullish for the economy but may lead to Fed rate hikes. Weak jobs data suggests economic slowdown but may prompt Fed rate cuts. Options traders can profit from the volatility around release dates." />
              </h1>
              <p className="text-[#0D9488] text-lg font-medium">
                Latest Unemployment Data & Insights (Updated: Nov 2025)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
              <RefreshButton onClick={handleRefresh} isLoading={refreshing} />
            </div>
          </div>
        </div>

        <Card className="bg-white shadow-md border-0 mb-6">
          <CardHeader>
            <CardTitle className="text-[#1E3A8A] text-xl flex items-center gap-2">
              UNRATE vs TRU Trend (2020-2025)
              <InfoTooltip content="This chart compares the official unemployment rate (UNRATE) with the 'True' unemployment rate (TRU) which includes discouraged workers and part-time workers seeking full-time work. A widening gap suggests hidden labor market weakness - potentially bearish for consumer discretionary stocks." />
            </CardTitle>
            <CardDescription className="text-gray-600">
              Cooling labor market signals Fed caution on rate cuts
            </CardDescription>
          </CardHeader>
          {/* ... existing code for chart ... */}
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#6B7280" />
                  <YAxis domain={[0, 35]} tick={{ fontSize: 11 }} stroke="#6B7280" tickFormatter={(v) => `${v}%`} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "white", border: "1px solid #E5E7EB", borderRadius: "8px" }}
                    formatter={(value: number, name: string) => [`${value}%`, name === "unrate" ? "UNRATE" : "TRU"]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="unrate"
                    name="UNRATE (Official)"
                    stroke="#1E3A8A"
                    strokeWidth={2}
                    dot={{ fill: "#1E3A8A", r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tru"
                    name="TRU (True Rate)"
                    stroke="#0D9488"
                    strokeWidth={2}
                    dot={{ fill: "#0D9488", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Row 1: UNRATE and TRU Cards */}
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
                  <span className="text-5xl font-bold text-[#1E3A8A]">4.4%</span>
                  <span className="text-sm text-amber-600 font-medium pb-2">+0.2% YoY</span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <strong>Previous Month:</strong> 4.4%
                  </p>
                  <p>
                    <strong>Previous Year:</strong> 4.2%
                  </p>
                  <p>
                    <strong>Interpretation:</strong> Labor market remains solid but cooling gradually
                  </p>
                </div>
              </CardContent>
            </Card>
          </ConditionalTooltip>

          {/* True Unemployment Rate Card */}
          <ConditionalTooltip content="TRU (True Unemployment Rate) includes discouraged workers and those working part-time for economic reasons. When TRU is significantly higher than UNRATE, it reveals hidden labor market slack. This can be bullish for stocks as it suggests the Fed has room to keep rates lower.">
            <Card className="bg-white shadow-md border-0 cursor-help">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#0D9488]" />
                  <CardTitle className="text-[#1E3A8A] text-xl">True Unemployment Rate (TRU)</CardTitle>
                </div>
                <CardDescription className="text-gray-600">
                  Includes underemployed & discouraged workers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-5xl font-bold text-[#0D9488]">8.2%</span>
                  <span className="text-sm text-amber-600 font-medium pb-2">+0.3% YoY</span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <strong>UNRATE Difference:</strong> +3.8%
                  </p>
                  <p>
                    <strong>Pre-Pandemic Average:</strong> 7.0%
                  </p>
                  <p>
                    <strong>Interpretation:</strong> Hidden labor slack persists post-pandemic
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
                  <span className="text-5xl font-bold text-green-600">+183K</span>
                  <span className="text-sm text-green-600 font-medium pb-2">Above Forecast (+165K)</span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <strong>Previous Month:</strong> +227K (revised)
                  </p>
                  <p>
                    <strong>3-Month Average:</strong> +195K
                  </p>
                  <p>
                    <strong>Interpretation:</strong> Solid job growth continues, supporting consumer spending
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
                  <span className="text-5xl font-bold text-[#1E3A8A]">$35.46</span>
                  <span className="text-sm text-amber-600 font-medium pb-2">+3.9% YoY</span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <strong>Monthly Change:</strong> +0.3%
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
                <span>Data sourced from Bureau of Labor Statistics (BLS)</span>
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
