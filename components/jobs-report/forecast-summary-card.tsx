"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RunScenarioInAIDialog } from "@/components/run-scenario-ai-dialog"
import { TrendingUp, Target, Calendar, Sparkles } from "lucide-react"
import { InfoTooltip } from "./jobs-tooltips"
import { fmtNfp, type JobsData } from "./jobs-types"

/**
 * The four forecast tiles and the analysis paragraph.
 *
 * P7-83: this card was titled "AI Forecast Summary" and the confidence tile
 * "Forecast Confidence" beside it. /api/jobs-report imports NextResponse,
 * getApiKey and fred-store — there is no model on that path, and keyFactors and
 * tradingImplications are hardcoded arrays chosen by an if/else on the trend.
 * The tab header had already been corrected for exactly this reason; the card
 * titles, the chart legend and the tooltip chip were not, which is the
 * half-a-change shape P7-77 records.
 */
export function ForecastSummaryCard({
  current,
  forecast,
  tooltipsEnabled,
  trendLabel,
  u6TrendLabel,
  nfpAboveTrend,
}: {
  current: JobsData["current"]
  forecast: JobsData["forecast"]
  tooltipsEnabled: boolean
  trendLabel: string
  u6TrendLabel: string
  nfpAboveTrend: boolean
}) {
  return (
    <Card className="bg-gradient-to-r from-purple-50 to-blue-50 shadow-md border-0 mb-6">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-[#1E3A8A] text-xl">Trend Forecast Summary</CardTitle>
            <InfoTooltip
              enabled={tooltipsEnabled}
              content="Forecasts are derived from the recent trend in official BLS series (UNRATE, U-6, payrolls) pulled live from FRED, with a three-month payrolls average as the central estimate. This is deterministic arithmetic on published series — no model is consulted. Confidence reflects how steady the labor market has been."
            />
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
                details: `Current UNRATE: ${current.unrate}%, U-6: ${current.u6}%, NFP: ${fmtNfp(current.nfp)}. Trend forecast: UNRATE ${forecast.unratePrediction}% (range: ${forecast.unrateRange.low}-${forecast.unrateRange.high}%), U-6 ${forecast.u6Prediction}% (range: ${forecast.u6Range.low}-${forecast.u6Range.high}%), NFP ${forecast.nfpPrediction} (range: ${forecast.nfpRange.low} to ${forecast.nfpRange.high}). Forecast confidence: ${forecast.confidence}%. Trend: ${forecast.trend}. Key factors: ${forecast.keyFactors.join(", ")}.`,
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
  )
}
