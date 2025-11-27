"use client"

import { useState } from "react"
import {
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Users,
  Briefcase,
  DollarSign,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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

export function JobsReportDashboard() {
  const [refreshing, setRefreshing] = useState(false)
  const [expandedAccordion, setExpandedAccordion] = useState<number | null>(0)

  const handleRefresh = async () => {
    setRefreshing(true)
    // Simulate API refresh
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setRefreshing(false)
  }

  const toggleAccordion = (index: number) => {
    setExpandedAccordion(expandedAccordion === index ? null : index)
  }

  return (
    <div className="p-6 bg-blue-50/50 min-h-screen">
      {/* Hero Section */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#1E3A8A] mb-2">US Jobs Report Dashboard</h1>
            <p className="text-[#0D9488] text-lg font-medium">
              Latest Unemployment Data & Insights (Updated: Nov 2025)
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-[#0D9488] hover:bg-[#0F766E] text-white gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh Data"}
          </Button>
        </div>
      </div>

      {/* Row 1: UNRATE and TRU Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Official Unemployment Rate Card */}
        <Card className="bg-white shadow-md border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-[#0D9488]" />
              <CardTitle className="text-[#1E3A8A] text-xl">Official Unemployment Rate (UNRATE)</CardTitle>
            </div>
            <CardDescription className="text-gray-600">Bureau of Labor Statistics U-3 measure</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 text-gray-600 font-semibold">Month/Year</th>
                    <th className="text-right py-2 px-2 text-gray-600 font-semibold">Rate (%)</th>
                    <th className="text-right py-2 px-2 text-gray-600 font-semibold">YoY Change</th>
                  </tr>
                </thead>
                <tbody>
                  {unemploymentData
                    .slice(-6)
                    .reverse()
                    .map((row, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50/50">
                        <td className="py-2 px-2 font-medium text-gray-800">{row.month}</td>
                        <td className="py-2 px-2 text-right font-semibold text-[#1E3A8A]">{row.rate}%</td>
                        <td
                          className={`py-2 px-2 text-right font-medium ${
                            row.yoyChange.startsWith("+")
                              ? "text-red-600"
                              : row.yoyChange === "0.0%"
                                ? "text-gray-500"
                                : "text-green-600"
                          }`}
                        >
                          {row.yoyChange}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <a
              href="#"
              className="inline-flex items-center gap-1 mt-4 text-[#0D9488] hover:text-[#0F766E] font-medium text-sm"
            >
              View Full History <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        {/* True Rate of Unemployment Card */}
        <Card className="bg-white shadow-md border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#0D9488]" />
              <CardTitle className="text-[#1E3A8A] text-xl">True Rate of Unemployment (TRU)</CardTitle>
            </div>
            <CardDescription className="text-gray-600">Ludwig Institute broader unemployment measure</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-bold text-[#1E3A8A]">24.7%</span>
                <span className="text-sm text-gray-600">Aug 2025</span>
              </div>
              <p className="text-sm text-gray-600">
                vs Official: <span className="font-semibold text-[#0D9488]">4.3%</span> (6x higher)
              </p>
            </div>

            <p className="text-sm font-semibold text-gray-700 mb-2">Demographic Breakdown:</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {truBreakdown.map((item, idx) => (
                <span key={idx} className="px-2 py-1 bg-[#E0F2FE] text-[#1E3A8A] text-xs font-medium rounded">
                  {item.group}: {item.rate}
                </span>
              ))}
            </div>

            <ul className="text-sm text-gray-700 space-y-1">
              <li className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                Q/Q: +0.5% — Highlights underemployment gaps
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                Includes discouraged workers & part-time for economic reasons
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Trend Chart */}
      <Card className="bg-white shadow-md border-0 mb-6">
        <CardHeader>
          <CardTitle className="text-[#1E3A8A] text-xl">UNRATE vs TRU Trend (2020-2025)</CardTitle>
          <CardDescription className="text-gray-600">
            Cooling labor market signals Fed caution on rate cuts
          </CardDescription>
        </CardHeader>
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

      {/* Row 3: Upcoming NFP Report */}
      <div className="border-t-2 border-[#1E3A8A] pt-6 mb-6">
        <h2 className="text-2xl font-bold text-[#0D9488] mb-4">
          Upcoming Jobs Data: Dec 2025 NFP Report (Fri Dec 5, 8:30 AM ET)
        </h2>
        <Card className="bg-white shadow-md border-0">
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-600 font-semibold">Event</th>
                    <th className="text-right py-2 px-3 text-gray-600 font-semibold">Consensus</th>
                    <th className="text-right py-2 px-3 text-gray-600 font-semibold">Previous</th>
                  </tr>
                </thead>
                <tbody>
                  {nfpExpectations.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50/50">
                      <td className="py-3 px-3 font-medium text-gray-800">{row.event}</td>
                      <td className="py-3 px-3 text-right font-semibold text-[#1E3A8A]">{row.consensus}</td>
                      <td className="py-3 px-3 text-right text-gray-600">{row.previous}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-3 bg-[#E0F2FE] rounded-lg">
              <p className="text-sm text-[#1E3A8A] font-medium">
                <AlertTriangle className="h-4 w-4 inline mr-1 text-[#0D9488]" />
                Beat ({">"}200k) could delay rate cuts; miss risks VIX spike to 20+
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 4: AI Insights Accordions */}
      <div className="border-t-2 border-[#1E3A8A] pt-6 mb-6">
        <h2 className="text-2xl font-bold text-[#1E3A8A] mb-1">AI Insights: Market Impact & Options Trading Tips</h2>
        <div className="w-24 h-1 bg-[#0D9488] mb-6"></div>

        {/* Accordion 1: UNRATE */}
        <Card className="bg-white shadow-md border-0 mb-4">
          <button
            onClick={() => toggleAccordion(0)}
            className="w-full px-6 py-4 flex items-center justify-between text-left"
          >
            <span className="text-lg font-semibold text-[#1E3A8A]">UNRATE at 4.4%: Labor Market Cooling</span>
            {expandedAccordion === 0 ? (
              <ChevronUp className="h-5 w-5 text-[#0D9488]" />
            ) : (
              <ChevronDown className="h-5 w-5 text-[#0D9488]" />
            )}
          </button>
          {expandedAccordion === 0 && (
            <CardContent className="pt-0 pb-6">
              <div className="bg-blue-50/50 rounded-lg p-4 mb-4">
                <p className="text-gray-700">
                  Rise from 3.4% cycle low signals softening labor conditions. Bonds typically rally on weakness, but
                  equities show mixed reactions (SPY avg ±1% on release). Current trajectory supports Fed pause.
                </p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-[#1E3A8A] mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> What to Watch
                  </h4>
                  <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                    <li>Youth rate at 13.2% (recession flag if {">"}15%)</li>
                    <li>Wage growth trending below 4% YoY</li>
                    <li>Jobless claims rising above 220k weekly</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E3A8A] mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Trading Decisions
                  </h4>
                  <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                    <li>Favor iron condors on QQQ (20-30 delta wings)</li>
                    <li>Pause wheel puts on cyclicals like F, GM</li>
                    <li>Consider TLT calls for bond rally plays</li>
                  </ul>
                </div>
              </div>
              <Button
                variant="outline"
                className="mt-4 text-[#0D9488] border-[#0D9488] hover:bg-[#0D9488] hover:text-white bg-transparent"
              >
                Model in Calculator
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Accordion 2: TRU */}
        <Card className="bg-white shadow-md border-0 mb-4">
          <button
            onClick={() => toggleAccordion(1)}
            className="w-full px-6 py-4 flex items-center justify-between text-left"
          >
            <span className="text-lg font-semibold text-[#1E3A8A]">TRU at 24.7%: Hidden Labor Weakness</span>
            {expandedAccordion === 1 ? (
              <ChevronUp className="h-5 w-5 text-[#0D9488]" />
            ) : (
              <ChevronDown className="h-5 w-5 text-[#0D9488]" />
            )}
          </button>
          {expandedAccordion === 1 && (
            <CardContent className="pt-0 pb-6">
              <div className="bg-blue-50/50 rounded-lg p-4 mb-4">
                <p className="text-gray-700">
                  The True Rate captures underemployment drag not visible in headlines. At 6x the official rate, it
                  signals significant slack remains in labor markets despite "full employment" narrative.
                </p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-[#1E3A8A] mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> What to Watch
                  </h4>
                  <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                    <li>Demographic divergence (minority rates rising faster)</li>
                    <li>Part-time for economic reasons trend</li>
                    <li>Prime-age participation rate below 83%</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E3A8A] mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Trading Decisions
                  </h4>
                  <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                    <li>Widen credit spreads on broad ETFs if TRU stable</li>
                    <li>Bull put spreads on XLF if consumer remains strong</li>
                    <li>Hedge with VIX calls if TRU acceleration {">"}1%</li>
                  </ul>
                </div>
              </div>
              <Button
                variant="outline"
                className="mt-4 text-[#0D9488] border-[#0D9488] hover:bg-[#0D9488] hover:text-white bg-transparent"
              >
                Model in Calculator
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Accordion 3: NFP */}
        <Card className="bg-white shadow-md border-0 mb-4">
          <button
            onClick={() => toggleAccordion(2)}
            className="w-full px-6 py-4 flex items-center justify-between text-left"
          >
            <span className="text-lg font-semibold text-[#1E3A8A]">NFP Expectations: December Release Strategy</span>
            {expandedAccordion === 2 ? (
              <ChevronUp className="h-5 w-5 text-[#0D9488]" />
            ) : (
              <ChevronDown className="h-5 w-5 text-[#0D9488]" />
            )}
          </button>
          {expandedAccordion === 2 && (
            <CardContent className="pt-0 pb-6">
              <div className="bg-blue-50/50 rounded-lg p-4 mb-4">
                <p className="text-gray-700">
                  160k forecast = Goldilocks scenario. Hot print ({">"}200k) boosts USD and pressures growth stocks.
                  Miss ({"<"}100k) triggers risk-off but supports rate cut bets.
                </p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-[#1E3A8A] mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> What to Watch
                  </h4>
                  <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                    <li>Revisions to prior months (often +/-50k swing)</li>
                    <li>Government vs private sector breakdown</li>
                    <li>Average hourly earnings for inflation signal</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E3A8A] mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Trading Decisions
                  </h4>
                  <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                    <li>Sell straddles pre-release for IV premium decay</li>
                    <li>Close positions early on beat (vol crush)</li>
                    <li>Iron butterflies on SPY for range-bound plays</li>
                  </ul>
                </div>
              </div>
              <Button
                variant="outline"
                className="mt-4 text-[#0D9488] border-[#0D9488] hover:bg-[#0D9488] hover:text-white bg-transparent"
              >
                Model in Calculator
              </Button>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Global Tip Card */}
      <Card className="bg-[#E0F2FE] border-0 shadow-md">
        <CardContent className="py-4">
          <p className="text-[#1E3A8A] font-medium">
            <AlertTriangle className="h-4 w-4 inline mr-2 text-[#0D9488]" />
            Jobs data drives 70% of weekly volatility events. Use our{" "}
            <a href="#" className="text-[#0D9488] underline hover:text-[#0F766E]">
              Greeks Calculator
            </a>{" "}
            to hedge delta exposure pre-NFP, or model scenarios in the{" "}
            <a href="#" className="text-[#0D9488] underline hover:text-[#0F766E]">
              ROI Calculator
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
