"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronRight, Calendar, Clock, TrendingUp, AlertTriangle, Sparkles, Info, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { RunScenarioInAIDialog } from "@/components/run-scenario-ai-dialog"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Types for dynamic data
interface EarningsEvent {
  date: string
  time: string
  timing: string
  ticker: string
  company: string
  aiExplainer: string
  estimate: string
}

interface EconomicEvent {
  date: string
  time: string
  event: string
  agency: string
  impact: string
  note: string
  forecast: string
  previous: string
  aiExplainer: string
}

interface AIInsight {
  id: string
  title: string
  summary: string
  watchPoints: string[]
  tradingTips: string[]
}

interface CalendarData {
  success: boolean
  dateRange: string
  lastUpdated: string
  dataSources: {
    earnings: string
    economic: string
  }
  earnings: EarningsEvent[]
  economic: EconomicEvent[]
  earningsInsights: AIInsight[]
  economicInsights: AIInsight[]
}

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

function LoadingState() {
  return (
    <Card className="bg-white shadow-md">
      <CardContent className="py-12 text-center">
        <Loader2 className="h-12 w-12 text-teal-500 mx-auto mb-4 animate-spin" />
        <p className="text-lg text-gray-600 mb-2">Loading calendar data...</p>
        <p className="text-sm text-gray-500">Fetching live earnings and economic events with AI analysis</p>
      </CardContent>
    </Card>
  )
}

function InsightAccordion({ insights, type }: { insights: AIInsight[]; type: string }) {
  if (!insights || insights.length === 0) return null

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
                    {insight.watchPoints?.map((point, i) => (
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
                    {insight.tradingTips?.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-teal-500 mt-1">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                <RunScenarioInAIDialog
                  context={{
                    type: "earnings",
                    title: insight.title,
                    details: `${insight.summary} Key points: ${insight.watchPoints?.join(", ")}. Trading tips: ${insight.tradingTips?.join(", ")}`,
                  }}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

// Helper function to sort by date ascending (soonest first)
const sortByDateAscending = <T extends { date: string }>(items: T[]): T[] => {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.date)
    const dateB = new Date(b.date)
    return dateA.getTime() - dateB.getTime()
  })
}

export function EarningsEconomicCalendar() {
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  const fetchCalendarData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch("/api/earnings-calendar", {
        cache: "no-store",
      })

      if (!res.ok) {
        throw new Error("Failed to fetch calendar data")
      }

      const calendarData = await res.json()
      setData(calendarData)
    } catch (err) {
      console.error("[v0] Calendar fetch error:", err)
      setError("Unable to load calendar data. Please try again.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchCalendarData()
  }, [fetchCalendarData])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    fetchCalendarData()
  }, [fetchCalendarData])

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

  const dateRange = data?.dateRange || "Loading..."
  const lastUpdated = data?.lastUpdated
    ? new Date(data.lastUpdated).toLocaleString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : ""

  const sortedEarnings = data ? sortByDateAscending(data.earnings) : []
  const sortedEconomic = data ? sortByDateAscending(data.economic) : []

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Hero Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1E3A8A] mb-1 flex items-center gap-2">
              Upcoming Earnings This Week
              <InfoTooltip content="Earnings announcements are major volatility events. Options prices (IV) typically increase before earnings and collapse after (IV crush). Options traders can sell premium before earnings to capture IV crush, or buy straddles/strangles if they expect a larger-than-expected move." />
            </h1>
            <p className="text-blue-600/80 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {dateRange}
              {lastUpdated && <span className="text-xs text-gray-500 ml-2">(Updated: {lastUpdated})</span>}
            </p>
            {data?.dataSources && (
              <p className="text-xs text-gray-500 mt-1">
                Sources: Earnings via {data.dataSources.earnings || "N/A"}, Economic via{" "}
                {data.dataSources.economic || "N/A"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
            <RefreshButton onClick={handleRefresh} isLoading={refreshing} />
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
            <Button variant="outline" size="sm" className="ml-4 bg-transparent" onClick={handleRefresh}>
              Retry
            </Button>
          </div>
        )}

        <Tabs defaultValue="earnings" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="earnings" className="text-sm font-semibold">
              Upcoming Earnings Reports
            </TabsTrigger>
            <TabsTrigger value="economic" className="text-sm font-semibold">
              Economic Events & Announcements
            </TabsTrigger>
          </TabsList>

          {/* Earnings Tab */}
          <TabsContent value="earnings" className="p-6 bg-blue-50/50 rounded-lg">
            {loading ? (
              <LoadingState />
            ) : sortedEarnings.length > 0 ? (
              <Card className="bg-white shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
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
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-teal-600" />
                            AI Explainer
                            <InfoTooltip content="AI-generated insights about expected volatility and potential options strategies for each earnings report. Consider the expected move (IV) when deciding on strike prices." />
                          </span>
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Estimate
                          <InfoTooltip content="Consensus analyst EPS estimate. Stocks often move based on whether they beat or miss this estimate. A beat by 5%+ is typically bullish, while a miss can trigger sharp selloffs." />
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedEarnings.map((item, index) => (
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
                              className="text-sm font-bold text-teal-600 hover:text-teal-700 hover:underline"
                            >
                              {item.ticker}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{item.company}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">{item.aiExplainer}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium text-right">{item.estimate}</td>
                          <td className="px-4 py-3 text-center">
                            <RunScenarioInAIDialog
                              context={{
                                type: "earnings",
                                ticker: item.ticker,
                                company: item.company,
                                estimate: item.estimate,
                                aiExplainer: item.aiExplainer,
                                title: `${item.ticker} Earnings - ${item.company}`,
                                details: `Upcoming earnings report on ${item.date}. EPS Estimate: ${item.estimate}. ${item.aiExplainer || "Analyze this earnings event for options trading opportunities."}`,
                              }}
                            />
                          </td>
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
            {!loading && data?.earningsInsights && (
              <InsightAccordion insights={data.earningsInsights} type="earnings" />
            )}

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
          <TabsContent value="economic" className="p-6 bg-amber-50/50 rounded-lg">
            {loading ? (
              <LoadingState />
            ) : sortedEconomic.length > 0 ? (
              <Card className="bg-white shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Date/Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Event
                          <InfoTooltip content="Economic events can significantly impact market direction. High-impact events like FOMC decisions, CPI, and NFP often cause large moves in indices and rate-sensitive stocks. Plan your options positions around these dates." />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Impact
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[280px]">
                          <div className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-blue-500" />
                            AI Explainer
                            <InfoTooltip content="AI-generated summary of potential market impact and options trading implications for this economic event." />
                          </div>
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Forecast
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedEconomic.map((event, index) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{event.date}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {event.time}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-blue-600 font-medium">{event.event}</td>
                          <td className="px-4 py-3">
                            <ImpactBadge impact={event.impact} />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-[320px]">{event.aiExplainer}</td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600">{event.forecast || "—"}</td>
                          <td className="px-4 py-3 text-center">
                            <RunScenarioInAIDialog
                              context={{
                                type: "economic",
                                event: event.event,
                                date: event.date,
                                impact: event.impact,
                                forecast: event.forecast,
                                title: `${event.event} - Economic Release`,
                                details: `Economic event on ${event.date}. Impact: ${event.impact}. ${event.forecast ? `Forecast: ${event.forecast}.` : ""} ${event.aiExplainer || "Analyze this economic event for options trading implications."}`,
                              }}
                            />
                          </td>
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
            {!loading && data?.economicInsights && (
              <InsightAccordion insights={data.economicInsights} type="economic" />
            )}

            {/* Footer Banner */}
            <div className="mt-8 bg-amber-100/50 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3 border border-amber-200">
              <p className="text-[#1E3A8A] text-sm font-medium text-center sm:text-left">
                Plan your trades around market-moving events—use Options-Calculators.com for scenario analysis.
              </p>
              <div className="flex items-center gap-2 text-teal-600 font-semibold text-sm">
                <TrendingUp className="h-4 w-4" />
                OPTIONS-CALCULATORS.COM
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}
