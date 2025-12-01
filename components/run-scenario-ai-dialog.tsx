"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, Bot, User, Send, Loader2, TrendingUp, Target, DollarSign, AlertTriangle } from "lucide-react"

interface ScenarioContext {
  type: "earnings" | "insider" | "jobs" | "strategy" | "economic"
  // Core fields - at least one way to identify the scenario
  title?: string
  details?: string
  // Earnings-specific fields
  ticker?: string
  company?: string
  estimate?: string
  date?: string
  aiExplainer?: string
  // Economic-specific fields
  event?: string
  impact?: string
  forecast?: string
  // Generic additional context
  additionalContext?: Record<string, string>
}

interface RunScenarioInAIDialogProps {
  context: ScenarioContext
  buttonVariant?: "default" | "outline"
  buttonClassName?: string
}

function getContextDisplay(context: ScenarioContext): { title: string; details: string } {
  if (context.type === "earnings") {
    const title =
      context.title ||
      (context.ticker && context.company
        ? `${context.ticker} Earnings - ${context.company}`
        : context.ticker || "Earnings Event")

    const detailParts: string[] = []
    if (context.company) detailParts.push(`Company: ${context.company}`)
    if (context.date) detailParts.push(`Date: ${context.date}`)
    if (context.estimate) detailParts.push(`EPS Estimate: ${context.estimate}`)
    if (context.aiExplainer) detailParts.push(`\n\nAI Analysis: ${context.aiExplainer}`)

    const details =
      context.details || detailParts.join(" | ") || `Upcoming earnings report for ${context.ticker || "this stock"}`

    return { title, details }
  }

  if (context.type === "economic") {
    const title = context.title || context.event || "Economic Event"

    const detailParts: string[] = []
    if (context.event) detailParts.push(`Event: ${context.event}`)
    if (context.date) detailParts.push(`Date: ${context.date}`)
    if (context.impact) detailParts.push(`Expected Impact: ${context.impact}`)
    if (context.forecast) detailParts.push(`Forecast: ${context.forecast}`)

    const details = context.details || detailParts.join(" | ") || "Upcoming economic event"

    return { title, details }
  }

  if (context.type === "insider") {
    const title = context.title || (context.ticker ? `${context.ticker} Insider Activity` : "Insider Transaction")
    const details = context.details || `Insider trading activity${context.ticker ? ` for ${context.ticker}` : ""}`
    return { title, details }
  }

  if (context.type === "jobs") {
    const title = context.title || "Jobs Report Analysis"
    const details = context.details || "Employment data and market impact analysis"
    return { title, details }
  }

  // Default/strategy type
  const title = context.title || "Strategy Analysis"
  const details = context.details || "Options trading strategy analysis"
  return { title, details }
}

export function RunScenarioInAIDialog({
  context,
  buttonVariant = "default",
  buttonClassName = "px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 shadow-md transition-all",
}: RunScenarioInAIDialogProps) {
  const [question, setQuestion] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [conversation, setConversation] = useState<{ role: "user" | "ai"; message: string }[]>([])
  const [isOpen, setIsOpen] = useState(false)

  const { title: contextTitle, details: contextDetails } = getContextDisplay(context)

  const getSuggestedQuestions = () => {
    switch (context.type) {
      case "earnings":
        return [
          `What options strategies work best for ${context.ticker || "this"} earnings?`,
          "How should I size my position for this trade?",
          "What are the key risks I should watch for?",
          "When should I exit if the trade goes against me?",
        ]
      case "insider":
        return [
          "Is this insider activity bullish or bearish?",
          "What options plays align with this insider signal?",
          "How reliable is this type of insider transaction?",
          "Should I wait for confirmation before trading?",
        ]
      case "jobs":
        return [
          "How does this jobs data typically impact markets?",
          "Best options strategies for this economic scenario?",
          "Which sectors benefit most from this data?",
          "How should I adjust my existing positions?",
        ]
      case "economic":
        return [
          `How does ${context.event || "this event"} typically impact options pricing?`,
          "Best strategies to trade around this announcement?",
          "Which sectors are most affected by this data?",
          "Should I reduce position size ahead of this event?",
        ]
      case "strategy":
        return [
          "Walk me through the entry criteria for this setup",
          "What's the optimal position size for my account?",
          "When and how should I adjust this position?",
          "What's my max loss scenario and how do I manage it?",
        ]
      default:
        return [
          "Analyze this scenario for options trading",
          "What are the risks and rewards?",
          "Suggest an optimal strategy",
          "How should I manage this position?",
        ]
    }
  }

  const handleAskQuestion = async (q: string) => {
    if (!q.trim()) return

    const fullQuestion = `Context: ${contextTitle}\n\nDetails: ${contextDetails}${
      context.ticker ? `\n\nTicker: ${context.ticker}` : ""
    }${context.company ? `\nCompany: ${context.company}` : ""}${context.date ? `\nDate: ${context.date}` : ""}${
      context.estimate ? `\nEPS Estimate: ${context.estimate}` : ""
    }${context.aiExplainer ? `\nAI Analysis: ${context.aiExplainer}` : ""}${
      context.event ? `\nEvent: ${context.event}` : ""
    }${context.impact ? `\nImpact: ${context.impact}` : ""}${
      context.forecast ? `\nForecast: ${context.forecast}` : ""
    }${
      context.additionalContext
        ? `\n\nAdditional Info:\n${Object.entries(context.additionalContext)
            .map(([k, v]) => `- ${k}: ${v}`)
            .join("\n")}`
        : ""
    }\n\nUser Question: ${q}`

    setConversation((prev) => [...prev, { role: "user", message: q }])
    setQuestion("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/scenario-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: fullQuestion,
          context: {
            ...context,
            title: contextTitle,
            details: contextDetails,
          },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setConversation((prev) => [...prev, { role: "ai", message: data.analysis }])
      } else {
        // Fallback response
        const fallbackResponse = generateFallbackResponse(q, context, contextTitle)
        setConversation((prev) => [...prev, { role: "ai", message: fallbackResponse }])
      }
    } catch {
      const fallbackResponse = generateFallbackResponse(q, context, contextTitle)
      setConversation((prev) => [...prev, { role: "ai", message: fallbackResponse }])
    } finally {
      setIsLoading(false)
    }
  }

  const generateFallbackResponse = (q: string, ctx: ScenarioContext, title: string): string => {
    const baseAnalysis = `Based on the scenario "${title}":\n\n`

    if (ctx.type === "earnings") {
      const tickerInfo = ctx.ticker ? ` for ${ctx.ticker}` : ""
      return `${baseAnalysis}**Options Strategy Recommendations${tickerInfo}:**\n\n• **If Bullish:** Consider bull put spreads 10-15% below current price. Target 65-70% probability of profit with 30-45 DTE.\n\n• **If Neutral:** Iron condors can capture elevated IV. Set wings outside expected move, targeting 2:1 reward/risk.\n\n• **If Bearish:** Bear call spreads above resistance with defined risk. Look for 60%+ POP.\n\n**Risk Management:**\n- Position size: 1-2% of portfolio max\n- Have an exit plan BEFORE earnings\n- Consider closing at 50% profit or 2x loss\n\n**Key Metrics to Watch:**\n- IV Rank/Percentile for premium levels\n- Expected Move vs historical moves\n- Put/Call skew for sentiment${ctx.estimate ? `\n- EPS Estimate: ${ctx.estimate}` : ""}`
    }

    if (ctx.type === "insider") {
      return `${baseAnalysis}**Insider Signal Analysis:**\n\n• Cluster buys by multiple insiders are more significant than single transactions\n• Form 4 filings within 48 hours of earnings are particularly notable\n• Watch for 10b5-1 plan modifications\n\n**Options Plays:**\n- For bullish signals: Bull put spreads or cash-secured puts\n- For bearish signals: Bear call spreads or protective puts\n- Size based on confidence level (1-3% of portfolio)\n\n**Confirmation Checklist:**\n✓ Multiple insiders buying/selling\n✓ Significant $ amounts (>$500K)\n✓ Not routine compensation-related\n✓ Near support/resistance levels`
    }

    if (ctx.type === "jobs" || ctx.type === "economic") {
      const eventInfo = ctx.event ? ` (${ctx.event})` : ""
      return `${baseAnalysis}**Economic Event Trading Framework${eventInfo}:**\n\n• **Pre-Event:** Reduce position sizes, tighten stops\n• **During:** Avoid trading first 30 minutes post-release\n• **Post-Event:** Look for follow-through confirmation\n\n**Sector Rotations:**\n- Strong jobs: Cyclicals, financials, small caps\n- Weak jobs: Defensives, utilities, bonds (TLT)\n- Inflation concerns: Commodities, energy, TIPS\n\n**Options Considerations:**\n- IV typically elevated pre-event\n- Look for IV crush opportunities post-announcement\n- Calendar spreads can benefit from term structure${ctx.forecast ? `\n\nForecast: ${ctx.forecast}` : ""}${ctx.impact ? `\nExpected Impact: ${ctx.impact}` : ""}`
    }

    return `${baseAnalysis}**Strategic Analysis:**\n\n1. **Entry Criteria:**\n   - Confirm directional bias with technical levels\n   - Check IV environment for strategy selection\n   - Size position based on max loss tolerance\n\n2. **Risk Management:**\n   - Define max loss before entry\n   - Set profit target (typically 50-75% of max profit)\n   - Have adjustment plan ready\n\n3. **Exit Rules:**\n   - Take profits at 50% of max profit\n   - Stop loss at 2x credit received\n   - Close at 21 DTE to avoid gamma risk\n\n**Next Steps:**\nReview the specific setup parameters and adjust based on your risk tolerance and account size.`
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className={buttonClassName}>
          <Sparkles className="h-3.5 w-3.5 text-white" />
          <span className="text-white font-semibold text-xs">Ask AI</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1E3A8A]">
            <Sparkles className="h-5 w-5 text-teal-600" />
            AI Scenario Analysis
          </DialogTitle>
          <DialogDescription>Analyze "{contextTitle}" for options trading insights</DialogDescription>
        </DialogHeader>

        {/* Context Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-teal-50 rounded-lg p-4 border border-blue-100">
          <h4 className="font-semibold text-[#1E3A8A] text-sm mb-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-teal-600" />
            Scenario Context
          </h4>
          <p className="text-sm text-gray-700">{contextDetails}</p>
          {context.ticker && (
            <div className="mt-2 flex items-center gap-2">
              <span className="bg-teal-100 text-teal-800 text-xs font-semibold px-2 py-1 rounded">
                {context.ticker}
              </span>
              {context.company && <span className="text-xs text-gray-600">{context.company}</span>}
              {context.date && <span className="text-xs text-gray-500">• {context.date}</span>}
            </div>
          )}
          {context.type === "economic" && context.event && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded">{context.event}</span>
              {context.impact && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    context.impact === "High"
                      ? "bg-red-100 text-red-700"
                      : context.impact === "Medium"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {context.impact} Impact
                </span>
              )}
              {context.forecast && <span className="text-xs text-gray-600">Forecast: {context.forecast}</span>}
            </div>
          )}
        </div>

        {/* Conversation Area */}
        <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[300px] space-y-4 p-4 bg-gray-50 rounded-lg">
          {conversation.length === 0 ? (
            <div className="text-center py-6">
              <Bot className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Ask me to analyze this scenario for options trading!</p>
              <div className="mt-4 grid grid-cols-1 gap-2">
                {getSuggestedQuestions()
                  .slice(0, 2)
                  .map((sq, i) => (
                    <button
                      key={i}
                      onClick={() => handleAskQuestion(sq)}
                      className="text-left text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-teal-50 hover:border-teal-200 transition-colors"
                    >
                      {sq}
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            conversation.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "ai" && (
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 ${
                    msg.role === "user" ? "bg-teal-600 text-white" : "bg-white border border-gray-200 text-gray-700"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                </div>
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                  <span className="text-sm text-gray-500">Analyzing scenario...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggested Questions */}
        {conversation.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {getSuggestedQuestions().map((sq, i) => (
              <button
                key={i}
                onClick={() => handleAskQuestion(sq)}
                disabled={isLoading}
                className="text-xs bg-gray-100 hover:bg-teal-50 border border-gray-200 hover:border-teal-200 rounded-full px-3 py-1 transition-colors disabled:opacity-50"
              >
                {sq}
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="flex gap-2 pt-2 border-t">
          <Textarea
            placeholder="Ask about strategy, risk management, position sizing..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleAskQuestion(question)
              }
            }}
            className="flex-1 min-h-[60px] max-h-[100px] resize-none"
          />
          <Button
            onClick={() => handleAskQuestion(question)}
            disabled={!question.trim() || isLoading}
            className="bg-teal-600 hover:bg-teal-700 text-white self-end"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-4 pt-2 text-xs text-gray-500 border-t">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-green-500" />
            Strategy analysis
          </div>
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-blue-500" />
            Position sizing
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-orange-500" />
            Risk assessment
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
