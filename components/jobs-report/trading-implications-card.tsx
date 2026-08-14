"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RunScenarioInAIDialog } from "@/components/run-scenario-ai-dialog"
import { TrendingUp, Target, Sparkles } from "lucide-react"
import { InfoTooltip } from "./jobs-tooltips"
import { fmtNfp, type JobsData } from "./jobs-types"

/**
 * P7-83: titled "AI Trading Implications". The two lists it renders —
 * `keyFactors` and `tradingImplications` — are hardcoded string arrays in
 * app/api/jobs-report/route.ts, selected by an if/else on the trend direction.
 * No model produces them. The dialog beside the title IS a real model path,
 * which is why the AI-claim rule passed the file; the rule cannot tell "there
 * is an AI dialog here" from "these bullets are AI-generated", and this card
 * was the difference.
 */
export function TradingImplicationsCard({
  current,
  forecast,
  tooltipsEnabled,
}: {
  current: JobsData["current"]
  forecast: JobsData["forecast"]
  tooltipsEnabled: boolean
}) {
  return (
    <Card className="bg-white shadow-md border-0 mb-6">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-[#1E3A8A] text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Trading Implications
            <InfoTooltip
              enabled={tooltipsEnabled}
              content="Trading ideas selected by the current employment trend from a fixed set written into the route — not generated per request. These are educational suggestions, not financial advice."
            />
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
  )
}
