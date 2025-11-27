"use client"

import { useState } from "react"
import { RefreshCw, ChevronRight, Calendar, Clock, TrendingUp, AlertTriangle, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

// Sample earnings data
const earningsData = [
  {
    date: "Thu Nov 27",
    time: "4:05 PM ET",
    timing: "AMC",
    ticker: "PTON",
    company: "Peloton Interactive",
    impact: "High",
    estimate: "EPS $0.02",
  },
  {
    date: "Fri Nov 28",
    time: "4:10 PM ET",
    timing: "AMC",
    ticker: "WRB",
    company: "W.R. Berkley Corp",
    impact: "Med",
    estimate: "EPS $1.03",
  },
  {
    date: "Mon Dec 1",
    time: "7:00 AM ET",
    timing: "BMO",
    ticker: "ZS",
    company: "Zscaler Inc",
    impact: "High",
    estimate: "EPS $0.63",
  },
  {
    date: "Tue Dec 2",
    time: "4:15 PM ET",
    timing: "AMC",
    ticker: "CRM",
    company: "Salesforce Inc",
    impact: "High",
    estimate: "EPS $2.44",
  },
  {
    date: "Wed Dec 3",
    time: "6:30 AM ET",
    timing: "BMO",
    ticker: "DLTR",
    company: "Dollar Tree Inc",
    impact: "Med",
    estimate: "EPS $1.07",
  },
]

// Sample economic events data
const economicData = [
  { date: "Thu Nov 27", time: "All Day", event: "Thanksgiving Holiday", impact: "High", note: "US Markets Closed" },
  { date: "Fri Nov 28", time: "All Day", event: "Black Friday", impact: "High", note: "Shortened Session (1PM Close)" },
  { date: "Fri Nov 29", time: "8:30 AM ET", event: "PCE Price Index", impact: "High", note: "Core MoM 0.2% est" },
  { date: "Mon Dec 1", time: "10:00 AM ET", event: "ISM Manufacturing PMI", impact: "High", note: "Est. 47.5" },
  { date: "Wed Dec 3", time: "8:15 AM ET", event: "ADP Employment Change", impact: "Med", note: "Est. +150K" },
]

// AI insights for earnings
const earningsInsights = [
  {
    id: "holiday-impact",
    title: "Holiday Week Trading Dynamics",
    summary:
      "Thanksgiving week typically sees reduced volume and tighter ranges. Light earnings calendar this week means less event-driven volatility, but expect post-holiday momentum shifts.",
    watchPoints: [
      "Post-holiday volume spikes on Monday",
      "VIX historically drops during holiday weeks",
      "Retail sector focus with Black Friday data",
    ],
    tradingTips: [
      "Consider tightening stops due to low liquidity",
      "Wait for Monday confirmation before new positions",
      "Use the quiet period to review and adjust existing spreads",
    ],
  },
  {
    id: "pton-outlook",
    title: "PTON Earnings Preview",
    summary:
      "Peloton reports after market close Thursday. The stock has been volatile with turnaround efforts. Options are pricing in a 12% expected move.",
    watchPoints: [
      "Subscription growth metrics",
      "Connected Fitness hardware sales",
      "CEO commentary on profitability timeline",
    ],
    tradingTips: [
      "High IV presents iron condor opportunity if expecting range-bound outcome",
      "Consider selling puts at support if bullish on turnaround",
      "Wait for post-earnings IV crush before directional plays",
    ],
  },
  {
    id: "tech-earnings",
    title: "Tech Sector Earnings (CRM, ZS)",
    summary:
      "Enterprise software earnings continue next week with Salesforce and Zscaler. AI narrative remains strong but valuations are stretched.",
    watchPoints: [
      "AI-related revenue growth commentary",
      "Enterprise spending outlook for 2026",
      "Guidance vs. consensus estimates",
    ],
    tradingTips: [
      "Sell premium into elevated IV before announcements",
      "Consider bull put spreads on CRM at key support levels",
      "ZS has higher IV rank - better premium selling opportunity",
    ],
  },
]

// AI insights for economic events
const economicInsights = [
  {
    id: "pce-inflation",
    title: "PCE Price Index Impact",
    summary:
      "The Fed's preferred inflation gauge releases Friday. A reading above 0.3% MoM could reignite rate hike fears, while 0.1% or below would be bullish for risk assets.",
    watchPoints: ["Core PCE vs headline divergence", "Services inflation stickiness", "Housing component trends"],
    tradingTips: [
      "Position for volatility spike Friday morning",
      "SPY straddles may be attractive given binary outcome",
      "Wait for dust to settle before selling premium",
    ],
  },
  {
    id: "ism-manufacturing",
    title: "ISM Manufacturing PMI",
    summary:
      "Manufacturing has been contracting (below 50) for months. A surprise above 50 could signal economic resilience and push yields higher.",
    watchPoints: [
      "New orders sub-index for forward guidance",
      "Employment component for labor market health",
      "Prices paid for inflation signals",
    ],
    tradingTips: [
      "Industrial sector ETFs (XLI) may see movement",
      "Consider pairs trades: long industrials/short utilities on strong reading",
      "Bond market reaction could drive equity rotation",
    ],
  },
  {
    id: "market-closure",
    title: "Holiday Market Schedule",
    summary:
      "Thanksgiving closure means Thursday is dark, Friday is shortened (1PM close). Plan your trades accordingly - no adjustments possible Thursday.",
    watchPoints: [
      "Elevated theta decay over long weekend",
      "Gap risk from international markets",
      "Low liquidity Friday morning",
    ],
    tradingTips: [
      "Close or adjust positions by Wednesday if concerned",
      "Sell premium Wednesday to capture holiday theta",
      "Avoid holding short-dated options through the break",
    ],
  },
]

function ImpactBadge({ impact }: { impact: string }) {
  const colors = {
    High: "bg-red-100 text-red-700 border-red-200",
    Med: "bg-orange-100 text-orange-700 border-orange-200",
    Low: "bg-teal-100 text-teal-700 border-teal-200",
  }
  return (
    <Badge variant="outline" className={`${colors[impact as keyof typeof colors] || colors.Low} font-medium`}>
      {impact}
    </Badge>
  )
}

function TimingBadge({ timing }: { timing: string }) {
  return (
    <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 font-medium text-xs">
      {timing}
    </Badge>
  )
}

function EmptyState({ type }: { type: "earnings" | "economic" }) {
  return (
    <Card className="bg-white shadow-md">
      <CardContent className="py-12 text-center">
        <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-lg text-gray-600 mb-2">Quiet week ahead—perfect for reviewing your spreads!</p>
        <p className="text-sm text-gray-500 mb-4">
          No major {type === "earnings" ? "earnings reports" : "economic events"} scheduled.
        </p>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white">Back to Calculators</Button>
      </CardContent>
    </Card>
  )
}

function InsightAccordion({ insights, type }: { insights: typeof earningsInsights; type: string }) {
  return (
    <div className="mt-8">
      <div className="border-t border-gray-200 pt-6 mb-4">
        <h2 className="text-xl font-bold text-[#1E3A8A] flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-teal-600" />
          <span className="border-b-2 border-teal-500 pb-1">AI Insights: Market Impact & Options Trading Tips</span>
        </h2>
      </div>

      <Accordion type="single" collapsible defaultValue={insights[0]?.id} className="space-y-3">
        {insights.map((insight) => (
          <AccordionItem
            key={insight.id}
            value={insight.id}
            className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden"
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 [&[data-state=open]>svg]:rotate-180">
              <span className="text-[#1E3A8A] font-semibold text-left flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-teal-600 transition-transform duration-200" />
                {insight.title}
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-0 pb-0">
              <div className="bg-blue-50/50 p-4 space-y-4">
                <p className="text-gray-700 leading-relaxed">{insight.summary}</p>

                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <h4 className="font-semibold text-[#1E3A8A] text-sm mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    What to Watch:
                  </h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {insight.watchPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-teal-500 mt-1">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <h4 className="font-semibold text-[#1E3A8A] text-sm mb-2 flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Trading Decisions:
                  </h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {insight.tradingTips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-teal-500 mt-1">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button className="bg-teal-600 hover:bg-teal-700 text-white w-full sm:w-auto">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Run Scenario in Calculator
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

export function EarningsEconomicCalendar() {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1500)
  }

  // Calculate date range for display
  const startDate = new Date()
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 7)
  const dateRange = `${startDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${endDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`

  return (
    <div className="space-y-6">
      <Tabs defaultValue="earnings" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="earnings" className="text-sm font-semibold">
            Upcoming Earnings Reports
          </TabsTrigger>
          <TabsTrigger value="economic" className="text-sm font-semibold">
            Economic Events & Announcements
          </TabsTrigger>
        </TabsList>

        {/* Earnings Tab */}
        <TabsContent value="earnings" className="p-6 bg-blue-50/50 rounded-lg">
          {/* Hero Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[#1E3A8A] mb-1">Upcoming Earnings This Week</h1>
              <p className="text-blue-600/80 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {dateRange}
              </p>
            </div>
            <Button onClick={handleRefresh} disabled={refreshing} className="bg-teal-600 hover:bg-teal-700 text-white">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Earnings Table */}
          {earningsData.length > 0 ? (
            <Card className="bg-white shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Date/Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Ticker
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden sm:table-cell">
                        Company
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Impact
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Estimate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {earningsData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{item.date}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            {item.time}
                            <TimingBadge timing={item.timing} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={`https://finance.yahoo.com/quote/${item.ticker}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#1E3A8A] font-bold hover:text-teal-600 hover:underline"
                          >
                            {item.ticker}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{item.company}</td>
                        <td className="px-4 py-3 text-center">
                          <ImpactBadge impact={item.impact} />
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-700">{item.estimate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <EmptyState type="earnings" />
          )}

          {/* AI Insights */}
          <InsightAccordion insights={earningsInsights} type="earnings" />

          {/* Footer Banner */}
          <div className="mt-8 bg-blue-100/50 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3 border border-blue-200">
            <p className="text-[#1E3A8A] text-sm font-medium text-center sm:text-left">
              Stay ahead of earnings volatility—calculate your edge with Options-Calculators.com tools.
            </p>
            <div className="flex items-center gap-2 text-teal-600 font-semibold text-sm">
              <TrendingUp className="h-4 w-4" />
              OPTIONS-CALCULATORS.COM
            </div>
          </div>
        </TabsContent>

        {/* Economic Events Tab */}
        <TabsContent value="economic" className="p-6 bg-blue-50/50 rounded-lg">
          {/* Hero Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[#1E3A8A] mb-1">Key Economic Events This Week</h1>
              <p className="text-blue-600/80 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {dateRange}
              </p>
            </div>
            <Button onClick={handleRefresh} disabled={refreshing} className="bg-teal-600 hover:bg-teal-700 text-white">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Economic Events Table */}
          {economicData.length > 0 ? (
            <Card className="bg-white shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Date/Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Event
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Impact
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Est. Value/Note
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {economicData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{item.date}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {item.time}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[#1E3A8A] font-bold">{item.event}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ImpactBadge impact={item.impact} />
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-700">{item.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <EmptyState type="economic" />
          )}

          {/* AI Insights */}
          <InsightAccordion insights={economicInsights} type="economic" />

          {/* Footer Banner */}
          <div className="mt-8 bg-blue-100/50 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3 border border-blue-200">
            <p className="text-[#1E3A8A] text-sm font-medium text-center sm:text-left">
              Stay ahead of volatility—calculate your edge with Options-Calculators.com tools.
            </p>
            <div className="flex items-center gap-2 text-teal-600 font-semibold text-sm">
              <TrendingUp className="h-4 w-4" />
              OPTIONS-CALCULATORS.COM
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
