"use client"

/**
 * The AI read of the transactions, and what it says when there is no model behind it.
 *
 * Split out of `components/insider-trading-dashboard.tsx` (P6-13) unchanged.
 * What it closed over is now props.
 */
import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RunScenarioInAIDialog } from "@/components/run-scenario-ai-dialog"
import { Building2, Landmark, Minus, Sparkles, Target, TrendingDown, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import type { AiSignal, Trade } from "./trade-parsing"

export function AiAnalysisSection({
  aiSignals,
  aiSummary,
  aiProvider,
  aiLoading,
  aiError,
  generateAiAnalysis,
  trades,
  InfoTooltip,
}: {
  aiSignals: AiSignal[]
  aiSummary: string | null
  aiProvider: string | null
  aiLoading: boolean
  aiError: string | null
  generateAiAnalysis: () => void
  trades: Trade[]
  InfoTooltip: React.ComponentType<{ content: string }>
}) {
  return (
    <>
        <Card className="bg-white shadow-md border-0">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-[#0D9488] flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Smart Analysis
                  <InfoTooltip content="AI cross-references corporate insider Form 4 activity with congressional disclosures to surface unusual clusters, cross-confirmed signals, and plausible catalysts. These are speculative hypotheses for research — not financial advice or claims of illegal insider information." />
                </CardTitle>
                <CardDescription>
                  Correlations & generalizations across insider and politician flows in the current data
                </CardDescription>
              </div>
              <Button
                type="button"
                onClick={generateAiAnalysis}
                disabled={aiLoading || trades.length === 0}
                className="bg-[#0D9488] hover:bg-[#0B7E74] text-white whitespace-nowrap"
              >
                {aiLoading ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-1.5 animate-pulse" />
                    Analyzing...
                  </>
                ) : aiSignals.length > 0 ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Re-analyze
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Generate AI Analysis
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {aiLoading ? (
              <LoadingSpinner message="Cross-referencing insider & congressional flows..." />
            ) : aiError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{aiError}</div>
            ) : aiSignals.length > 0 ? (
              <div className="space-y-4">
                {aiSummary && (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                    <p className="text-sm text-teal-900 leading-relaxed">{aiSummary}</p>
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  {aiSignals.map((signal, i) => {
                    const dirStyles =
                      signal.direction === "Bullish"
                        ? { border: "border-green-200", bg: "bg-green-50", text: "text-green-700", Icon: TrendingUp }
                        : signal.direction === "Bearish"
                          ? { border: "border-red-200", bg: "bg-red-50", text: "text-red-700", Icon: TrendingDown }
                          : { border: "border-gray-200", bg: "bg-gray-50", text: "text-gray-600", Icon: Minus }
                    const DirIcon = dirStyles.Icon
                    return (
                      <div key={i} className={`rounded-lg border ${dirStyles.border} ${dirStyles.bg} p-4 space-y-2`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-teal-600">{signal.ticker}</span>
                            <span className={`flex items-center gap-1 text-xs font-medium ${dirStyles.text}`}>
                              <DirIcon className="h-3.5 w-3.5" />
                              {signal.direction}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {signal.confidence} confidence
                          </Badge>
                        </div>
                        <h4 className="text-sm font-semibold text-gray-900">{signal.headline}</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">{signal.rationale}</p>
                        {signal.optionsIdea && (
                          <p className="text-xs font-medium text-[#0D9488] flex items-start gap-1">
                            <Target className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            {signal.optionsIdea}
                          </p>
                        )}
                        {signal.sources && signal.sources.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {signal.sources.map((src) => (
                              <span
                                key={src}
                                className="inline-flex items-center gap-1 rounded-full bg-white/70 border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600"
                              >
                                {src === "Congressional" ? (
                                  <Landmark className="h-3 w-3 text-blue-600" />
                                ) : (
                                  <Building2 className="h-3 w-3 text-gray-500" />
                                )}
                                {src}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="pt-1">
                          <RunScenarioInAIDialog
                            context={{
                              type: "insider",
                              title: `${signal.ticker} — ${signal.headline}`,
                              details: `${signal.direction} signal (${signal.confidence} confidence). ${signal.rationale} ${signal.optionsIdea ? "Idea: " + signal.optionsIdea : ""}`,
                            }}
                            buttonClassName="text-xs"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {aiProvider && (
                  <p className="text-xs text-muted-foreground text-right">
                    Generated by {aiProvider} · Speculative research signals, not financial advice
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Sparkles className="h-8 w-8 text-[#0D9488] mx-auto mb-3 opacity-70" />
                <p className="text-sm text-gray-600 max-w-md mx-auto">
                  Click <span className="font-semibold">Generate AI Analysis</span> to have AI scan the current data for
                  unusual clusters — like cross-confirmed buying from both insiders and politicians — and suggest what
                  catalysts might be driving the flow.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
    </>
  )
}
