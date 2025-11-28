"use client"

import { useState } from "react"
import {
  ChevronRight,
  Calendar,
  Clock,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  Sparkles,
  Send,
  Bot,
  Info,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { RunScenarioInAIDialog } from "@/components/run-scenario-ai-dialog"
import { RefreshButton } from "@/components/ui/refresh-button" // Imported RefreshButton
import { TooltipsToggle } from "@/components/ui/tooltips-toggle" // Imported TooltipsToggle
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip" // Imported Tooltip components

const earningsData = [
  {
    date: "Thu Nov 27",
    time: "4:05 PM ET",
    timing: "AMC",
    ticker: "PTON",
    company: "Peloton Interactive",
    aiExplainer: "Turnaround play with high IV. Options pricing ~12% expected move. Watch subscription metrics.",
    estimate: "EPS $0.02",
  },
  {
    date: "Fri Nov 28",
    time: "4:10 PM ET",
    timing: "AMC",
    ticker: "WRB",
    company: "W.R. Berkley Corp",
    aiExplainer: "Insurance sector steady. Low IV environment. Consider selling puts at support.",
    estimate: "EPS $1.03",
  },
  {
    date: "Mon Dec 1",
    time: "7:00 AM ET",
    timing: "BMO",
    ticker: "ZS",
    company: "Zscaler Inc",
    aiExplainer: "Cybersecurity leader with elevated IV. Premium selling opportunity pre-earnings.",
    estimate: "EPS $0.63",
  },
  {
    date: "Tue Dec 2",
    time: "4:15 PM ET",
    timing: "AMC",
    ticker: "CRM",
    company: "Salesforce Inc",
    aiExplainer: "AI narrative strong. Watch guidance vs consensus. Bull put spreads at key support.",
    estimate: "EPS $2.44",
  },
  {
    date: "Wed Dec 3",
    time: "6:30 AM ET",
    timing: "BMO",
    ticker: "DLTR",
    company: "Dollar Tree Inc",
    aiExplainer: "Retail sector focus. Holiday shopping outlook key. Moderate IV, directional bias.",
    estimate: "EPS $1.07",
  },
]

// Static economic data
const economicData = [
  {
    date: "Thu Nov 27",
    time: "All Day",
    event: "Thanksgiving Holiday",
    agency: "NYSE",
    impact: "High",
    note: "US Markets Closed",
    forecast: "—",
    previous: "—",
    aiExplainer: "Markets closed. Low liquidity pre/post holiday. Avoid holding short-dated options through break.",
  },
  {
    date: "Fri Nov 28",
    time: "All Day",
    event: "Black Friday",
    agency: "NYSE",
    impact: "High",
    note: "Shortened Session (1PM Close)",
    forecast: "—",
    previous: "—",
    aiExplainer:
      "Half-day session with thin volume. Retail sentiment indicator. Avoid new positions; wide spreads likely.",
  },
  {
    date: "Fri Nov 29",
    time: "8:30 AM ET",
    event: "PCE Price Index",
    agency: "BEA",
    impact: "High",
    note: "Core MoM 0.2% est",
    forecast: "0.2%",
    previous: "0.3%",
    aiExplainer:
      "Fed's preferred inflation gauge. Hot print = hawkish Fed fears, bond yields up. Consider SPY straddles for vol.",
  },
  {
    date: "Mon Dec 1",
    time: "10:00 AM ET",
    event: "ISM Manufacturing PMI",
    agency: "ISM",
    impact: "High",
    note: "Est. 47.5",
    forecast: "47.5",
    previous: "46.5",
    aiExplainer: "Below 50 = contraction. Watch XLI/XLB for sector plays. Iron condors if reading near consensus.",
  },
  {
    date: "Wed Dec 3",
    time: "8:15 AM ET",
    event: "ADP Employment Change",
    agency: "ADP",
    impact: "Med",
    note: "Est. +150K",
    forecast: "+150K",
    previous: "+233K",
    aiExplainer: "NFP preview. Weak jobs = rate cut hopes = bullish tech. Consider QQQ call spreads if soft.",
  },
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

                <RunScenarioInAIDialog
                  context={{
                    type: "earnings",
                    title: insight.title,
                    details: `${insight.summary} Key points: ${insight.watchPoints.join(", ")}. Trading tips: ${insight.tradingTips.join(", ")}`,
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

function AskAIDialog({ ticker, company }: { ticker: string; company: string }) {
  const [question, setQuestion] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [conversation, setConversation] = useState<{ role: "user" | "ai"; message: string }[]>([])

  const suggestedQuestions = [
    `What's the expected move for ${ticker} this earnings?`,
    `Best options strategy for ${ticker} earnings play?`,
    `Should I buy or sell premium on ${ticker}?`,
    `What are the key risks for ${ticker} this quarter?`,
  ]

  const handleAskQuestion = async (q: string) => {
    if (!q.trim()) return

    setConversation((prev) => [...prev, { role: "user", message: q }])
    setQuestion("")
    setIsLoading(true)

    // Simulated AI response - in production this would call an API
    setTimeout(() => {
      const responses: Record<string, string> = {
        [suggestedQuestions[0]]: `Based on current options pricing, ${ticker} has an implied move of approximately 8-12% for this earnings report. The ATM straddle suggests the market expects significant volatility. Historical earnings moves have averaged 7% over the past 4 quarters.`,
        [suggestedQuestions[1]]: `For ${ticker}, consider these strategies:\n\n• **Iron Condor** if you expect range-bound action (collect premium from elevated IV)\n• **Bull Put Spread** if bullish bias with defined risk\n• **Straddle** if expecting larger than expected move\n\nGiven current IV rank of 65%, premium selling strategies have an edge.`,
        [suggestedQuestions[2]]: `With IV Rank at 65% for ${ticker}, **selling premium** has a statistical edge. Post-earnings IV crush typically benefits premium sellers. Consider selling puts if bullish or iron condors for neutral outlook.`,
        [suggestedQuestions[3]]: `Key risks for ${ticker} this quarter:\n\n1. **Guidance miss** - Forward looking statements matter more than EPS beat\n2. **Macro headwinds** - Consumer spending concerns\n3. **Competition** - Market share erosion\n4. **Management changes** - Leadership commentary on strategy`,
      }

      const aiResponse =
        responses[q] ||
        `For ${ticker} (${company}), I'd recommend monitoring the following:\n\n• **IV Percentile**: Check if premium is elevated vs historical\n• **Expected Move**: Compare to historical earnings moves\n• **Support/Resistance**: Key technical levels for strike selection\n• **Sector Sentiment**: How peers have performed this quarter\n\nConsider starting with a defined-risk strategy like a vertical spread to limit exposure.`

      setConversation((prev) => [...prev, { role: "ai", message: aiResponse }])
      setIsLoading(false)
    }, 1500)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 shadow-md transition-all cursor-pointer">
          <Sparkles className="h-3.5 w-3.5 text-white" />
          <span className="text-white font-semibold text-xs">Ask AI</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1E3A8A]">
            <Sparkles className="h-5 w-5 text-teal-600" />
            AI Earnings Assistant - {ticker}
          </DialogTitle>
          <DialogDescription>
            Ask about {company}'s earnings outlook, options strategies, and trading decisions.
          </DialogDescription>
        </DialogHeader>

        {/* Conversation Area */}
        <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[300px] space-y-4 p-4 bg-gray-50 rounded-lg">
          {conversation.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Ask me anything about {ticker}'s upcoming earnings!</p>
            </div>
          ) : (
            conversation.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    msg.role === "user" ? "bg-teal-600 text-white" : "bg-white border border-gray-200 text-gray-700"
                  }`}
                >
                  {msg.role === "ai" && (
                    <div className="flex items-center gap-1 mb-2 text-teal-600 text-xs font-semibold">
                      <Sparkles className="h-3 w-3" />
                      AI Assistant
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-line">{msg.message}</p>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="animate-pulse flex gap-1">
                    <span
                      className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    ></span>
                    <span
                      className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    ></span>
                    <span
                      className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    ></span>
                  </div>
                  <span className="text-xs">Analyzing {ticker}...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggested Questions */}
        {conversation.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Suggested Questions</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-white hover:bg-teal-50 hover:border-teal-300"
                  onClick={() => handleAskQuestion(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="flex gap-2 pt-2 border-t">
          <Textarea
            placeholder={`Ask about ${ticker}'s earnings, expected move, or options strategies...`}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleAskQuestion(question)
              }
            }}
            className="min-h-[60px] resize-none bg-white"
          />
          <Button
            onClick={() => handleAskQuestion(question)}
            disabled={!question.trim() || isLoading}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EconomicAskAIDialog({ event, note }: { event: string; note: string }) {
  const [question, setQuestion] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [conversation, setConversation] = useState<{ role: "user" | "ai"; message: string }[]>([])

  const suggestedQuestions = [
    `What's the expected impact of ${event}?`,
    `Best options strategy for ${event}?`,
    `Should I adjust my positions around ${event}?`,
    `What are the key risks for ${event}?`,
  ]

  const handleAskQuestion = async (q: string) => {
    if (!q.trim()) return

    setConversation((prev) => [...prev, { role: "user", message: q }])
    setQuestion("")
    setIsLoading(true)

    // Simulated AI response - in production this would call an API
    setTimeout(() => {
      const responses: Record<string, string> = {
        [suggestedQuestions[0]]: `The ${event} is expected to have a ${note} impact on the market. Monitor for any significant deviations from consensus.`,
        [suggestedQuestions[1]]: `For ${event}, consider these strategies:\n\n• **Straddle/Strangle** to capture volatility expansion\n• **Iron Condor** after direction is established\n• **Risk Management**: Reduce position size around high-impact releases`,
        [suggestedQuestions[2]]: `It's advisable to adjust your positions around ${event}. Consider scaling back short-dated options and reviewing sector ETFs most affected by this data point.`,
        [suggestedQuestions[3]]: `Key risks for ${event}:\n\n1. **Market Reaction**: Significant moves may cause market turbulence\n2. **Sector Impact**: Certain sectors may be more sensitive to ${event}\n3. **Volatility Shift**: Watch for changes in VIX levels before and after the event`,
      }

      const aiResponse =
        responses[q] ||
        `For ${event}, I'd recommend monitoring the following:\n\n• **Market Impact**: Consider the ${note} impact and potential deviations from consensus\n• **Options Strategies**: Use straddles/strangles for volatility capture and iron condors for defined-risk plays\n• **Risk Management**: Be prepared for market turbulence and adjust positions accordingly`

      setConversation((prev) => [...prev, { role: "ai", message: aiResponse }])
      setIsLoading(false)
    }, 1500)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100 hover:text-teal-800"
        >
          <MessageSquare className="h-3 w-3 mr-1" />
          Ask AI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1E3A8A]">
            <Sparkles className="h-5 w-5 text-teal-600" />
            AI Economic Assistant - {event}
          </DialogTitle>
          <DialogDescription>
            Ask about the economic impact of {event}, options strategies, and trading decisions.
          </DialogDescription>
        </DialogHeader>

        {/* Conversation Area */}
        <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[300px] space-y-4 p-4 bg-gray-50 rounded-lg">
          {conversation.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Ask me anything about the economic impact of {event}!</p>
            </div>
          ) : (
            conversation.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    msg.role === "user" ? "bg-teal-600 text-white" : "bg-white border border-gray-200 text-gray-700"
                  }`}
                >
                  {msg.role === "ai" && (
                    <div className="flex items-center gap-1 mb-2 text-teal-600 text-xs font-semibold">
                      <Sparkles className="h-3 w-3" />
                      AI Assistant
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-line">{msg.message}</p>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="animate-pulse flex gap-1">
                    <span
                      className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    ></span>
                    <span
                      className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    ></span>
                    <span
                      className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    ></span>
                  </div>
                  <span className="text-xs">Analyzing {event}...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggested Questions */}
        {conversation.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Suggested Questions</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-white hover:bg-teal-50 hover:border-teal-300"
                  onClick={() => handleAskQuestion(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="flex gap-2 pt-2 border-t">
          <Textarea
            placeholder={`Ask about the economic impact of ${event}, options strategies, or trading decisions...`}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleAskQuestion(question)
              }
            }}
            className="min-h-[60px] resize-none bg-white"
          />
          <Button
            onClick={() => handleAskQuestion(question)}
            disabled={!question.trim() || isLoading}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Removed RefreshButton as it's now imported

export function EarningsEconomicCalendar() {
  const [refreshing, setRefreshing] = useState(false)
  // Renamed state variables to match updates
  const [selectedEarningsItem, setSelectedEarningsItem] = useState<(typeof earningsData)[0] | null>(null)
  const [earningsAiResponse, setEarningsAiResponse] = useState("")
  const [earningsAiLoading, setEarningsAiLoading] = useState(false)
  const [earningsUserQuestion, setEarningsUserQuestion] = useState("")
  const [selectedEconomicEvent, setSelectedEconomicEvent] = useState<(typeof economicData)[0] | null>(null) // Renamed economicData to economicEventsData for consistency
  const [economicAiResponse, setEconomicAiResponse] = useState("")
  const [economicAiLoading, setEconomicAiLoading] = useState(false)
  const [economicUserQuestion, setEconomicUserQuestion] = useState("")

  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1500)
  }

  // Removed handleEconomicAiQuestion as it's handled inline now

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

  const startDate = new Date()
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 7)
  const dateRange = `${startDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${endDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Hero Section - Now shared between both tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1E3A8A] mb-1 flex items-center gap-2">
              Upcoming Earnings This Week
              <InfoTooltip content="Earnings announcements are major volatility events. Options prices (IV) typically increase before earnings and collapse after (IV crush). Options traders can sell premium before earnings to capture IV crush, or buy straddles/strangles if they expect a larger-than-expected move." />
            </h1>
            <p className="text-blue-600/80 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {dateRange}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
            <RefreshButton onClick={handleRefresh} isLoading={refreshing} />
          </div>
        </div>

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
                    {/* Existing tbody code */}
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
                              className="text-sm font-bold text-teal-600 hover:text-teal-700 hover:underline"
                            >
                              {item.ticker}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{item.company}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">{item.aiExplainer}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium text-right">{item.estimate}</td>
                          <td className="px-4 py-3 text-center">
                            {/* Updated RunScenarioInAIDialog props */}
                            <RunScenarioInAIDialog
                              context={{
                                type: "earnings",
                                ticker: item.ticker,
                                company: item.company,
                                estimate: item.estimate,
                                date: item.date,
                                aiExplainer: item.aiExplainer,
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
          <TabsContent value="economic" className="p-6 bg-amber-50/50 rounded-lg">
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
                        <InfoTooltip content="Economic events can significantly impact market direction. High-impact events like FOMC decisions, CPI, and NFP often cause large moves in indices and rate-sensitive stocks. Plan your options positions around these dates." />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Agency
                        <InfoTooltip content="The government agency or organization responsible for releasing this economic data. BEA = Bureau of Economic Analysis, BLS = Bureau of Labor Statistics, ISM = Institute for Supply Management, Fed = Federal Reserve." />
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
                  <tbody className="divide-y divide-gray-100">
                    {economicData.map((event, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{event.date}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {event.time}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-blue-600 font-medium">{event.event}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-medium">{event.agency}</td>
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
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* AI Insights */}
            <InsightAccordion insights={economicInsights} type="economic" />

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
