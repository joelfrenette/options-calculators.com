"use client"

import { useState, useEffect } from "react"
import { DataLoadGate } from "@/components/data-load-gate"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Calendar, Target, Info, RefreshCw } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"


// P6-13. This file was 1,460 lines. The payload shapes, the options-strategy
// generator and the prediction/trend presentation lookups are now in
// `components/fomc/`. `generateOptionsStrategies` was an arrow constant inside
// the component and is now a function taking the same two arguments.
import {
  type EconomicFactors,
  type EconomicIndicators,
  type FedDecisionFactors,
  type FomcMeeting,
  type HistoricalRate,
  type NextMeeting,
  type OptionsStrategy,
  type PredictionMethodology,
  type Provenance,
  type RatePath,
  labelFor,
} from "@/components/fomc/fomc-types"
import { generateOptionsStrategies } from "@/components/fomc/options-strategies"
import { InfoTooltip } from "@/components/fomc/info-tooltip"
import { ProbabilityTableSection } from "@/components/fomc/probability-table-section"
import { RatePathSection } from "@/components/fomc/rate-path-section"
import { EconomicIndicatorsSection } from "@/components/fomc/economic-indicators-section"
import { FedDecisionFactorsSection } from "@/components/fomc/fed-decision-factors-section"
import { KeyEconomicFactorsSection } from "@/components/fomc/key-economic-factors-section"
import { PredictionMethodologySection } from "@/components/fomc/prediction-methodology-section"
import { OptionsStrategiesSection } from "@/components/fomc/options-strategies-section"
import {
  FactorValue,
  IndicatorBody,
  getConfidenceLevel,
  getGrowthTrendStyle,
  getInflationTrendStyle,
  getLaborTrendStyle,
  getMarketExpectationStyle,
  getPredictionBg,
  getPredictionColor,
  getPredictionIcon,
  getTrendColor,
  getTrendIcon,
} from "@/components/fomc/presentation"

export function FomcPredictions() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // No seed value: 4.375 was a made-up rate that rendered as live data for the
  // whole first paint and for any request that came back without DFF.
  const [currentRate, setCurrentRate] = useState<number | null>(null)
  const [historicalRates, setHistoricalRates] = useState<HistoricalRate[]>([])
  const [nextMeeting, setNextMeeting] = useState<NextMeeting | null>(null)
  const [ratePath, setRatePath] = useState<RatePath | null>(null)
  const [economicFactors, setEconomicFactors] = useState<EconomicFactors | null>(null)
  const [economicIndicators, setEconomicIndicators] = useState<EconomicIndicators | null>(null)
  const [fedDecisionFactors, setFedDecisionFactors] = useState<FedDecisionFactors | null>(null)
  const [provenance, setProvenance] = useState<Provenance | null>(null)
  const [predictionMethodology, setPredictionMethodology] = useState<PredictionMethodology | null>(null)
  const [meetings, setMeetings] = useState<FomcMeeting[]>([])
  const [optionsStrategies, setOptionsStrategies] = useState<OptionsStrategy[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [chartData, setChartData] = useState<any[]>([])
  // `showTooltips` was a SECOND tooltip state (P7-63). It was initialised true,
  // `setShowTooltips` was never called, and it gated exactly one control — the
  // (i) beside each strategy row. So the "Tooltips" toggle, which drives
  // `tooltipsEnabled`, turned off every tooltip on the tab except that one,
  // which stayed on forever. Deleted; that row now reads the toggle like the
  // rest. Found by `check-write-only-state.ts` when the split left it unread.
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true) // New state for tooltip toggle
  const [loaded, setLoaded] = useState(false)


  const fetchFomcData = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/fomc-predictions")
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        // 503 means the route refused to publish a forecast rather than
        // anchoring it on a stand-in rate. Keep the provenance so the UI can
        // say which input was missing instead of just "failed".
        if (data?.provenance) setProvenance(data.provenance)
        if (data?.economicIndicators) setEconomicIndicators(data.economicIndicators)
        setNextMeeting(null)
        setRatePath(null)
        setMeetings([])
        setOptionsStrategies([])
        setChartData([])
        setLastUpdated(new Date())
        throw new Error(data?.error || "Failed to fetch FOMC data")
      }

      setCurrentRate(data.currentRate)
      setProvenance(data.provenance ?? null)
      setHistoricalRates(data.historicalRates || [])
      setNextMeeting(data.nextMeeting)
      setRatePath(data.ratePath)
      setEconomicFactors(data.economicFactors)
      setEconomicIndicators(data.economicIndicators)
      setFedDecisionFactors(data.fedDecisionFactors)
      setPredictionMethodology(data.predictionMethodology)
      setMeetings(data.meetings)

      // Trade ideas are only as good as the forecast they sit on. When a key
      // input is missing the prediction is published qualified, so the
      // strategy list is withheld rather than dressed up as actionable.
      if (data.nextMeeting && data.provenance?.predictionReliability === "full") {
        const strategies = generateOptionsStrategies(data.nextMeeting, data.currentRate)
        setOptionsStrategies(strategies)
      } else {
        setOptionsStrategies([])
      }

      const generateChartData = () => {
        const today = new Date()
        const chartPoints: any[] = []

        // Historical data - 2 years back using FRED data
        if (data.historicalRates && data.historicalRates.length > 0) {
          // Sample monthly (every ~30 days) for cleaner visualization
          const samplingInterval = 30
          for (let i = 0; i < data.historicalRates.length; i += samplingInterval) {
            const dataPoint = data.historicalRates[i]
            const date = new Date(dataPoint.date)
            chartPoints.push({
              date: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
              historical: dataPoint.rate,
              forecast: null,
              type: "historical",
            })
          }
        }
        // No fallback series. The old one drew 24 flat months at today's rate,
        // which read as "rates never moved" whenever FRED history was missing.

        // Current point (connects historical to forecast)
        chartPoints.push({
          date: today.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          historical: data.currentRate,
          forecast: data.currentRate,
          type: "current",
        })

        // Forecast data - 2 years forward using meeting schedule + interpolation
        if (data.meetings && data.meetings.length > 0) {
          // Add each FOMC meeting forecast
          data.meetings.forEach((meeting: FomcMeeting, index: number) => {
            chartPoints.push({
              date: meeting.date.split(",")[0], // Just get "Nov 6-7"
              historical: null,
              forecast: meeting.impliedRate,
              type: "forecast",
            })
          })

          // For months beyond the last meeting, extrapolate to 2 years
          const lastMeeting = data.meetings[data.meetings.length - 1]
          const lastMeetingDate = new Date(
            lastMeeting.date.split(",")[1].trim() + ", " + lastMeeting.date.split(",")[0],
          )
          const twoYearsFromNow = new Date(today)
          twoYearsFromNow.setFullYear(today.getFullYear() + 2)

          // Calculate trend from last few meetings to project forward
          const recentMeetings = data.meetings.slice(-4) // Last 4 meetings
          const avgRateChange =
            recentMeetings.length > 1
              ? (recentMeetings[recentMeetings.length - 1].impliedRate - recentMeetings[0].impliedRate) /
                (recentMeetings.length - 1)
              : 0

          // Add monthly points from last meeting to 2 years out
          let monthsAfterLastMeeting = 1
          const projectedDate = new Date(lastMeetingDate)
          while (projectedDate < twoYearsFromNow) {
            projectedDate.setMonth(projectedDate.getMonth() + 1)
            if (projectedDate <= twoYearsFromNow) {
              const projectedRate = Math.max(
                2.0,
                Math.min(6.0, lastMeeting.impliedRate + avgRateChange * monthsAfterLastMeeting * 0.5),
              ) // Slower trend projection
              chartPoints.push({
                date: projectedDate.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
                historical: null,
                forecast: projectedRate,
                type: "forecast-extended",
              })
              monthsAfterLastMeeting++
            }
          }
        }

        return chartPoints
      }

      setChartData(generateChartData())
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (loaded) fetchFomcData()
  }, [loaded])

  if (!loaded) {
    return (
      <DataLoadGate
        title="Load FOMC Predictions?"
        description="Fetch the latest Federal Reserve rate predictions and meeting data. Nothing loads until you choose to."
        onConfirm={() => setLoaded(true)}
      />
    )
  }



  const unavailableInputs = provenance?.unavailable ?? []
  const keyInputsMissing = provenance?.keyInputsMissing ?? []
  const displayOnlyMissing = unavailableInputs.filter((k) => !keyInputsMissing.includes(k))
  const isDegraded = provenance?.predictionReliability === "degraded"

  if (loading && !nextMeeting) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-lg text-gray-600">Loading FOMC data...</span>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Fed Rate Decision Predictor
                  <InfoTooltip enabled={tooltipsEnabled} content="The Federal Reserve sets interest rates to control inflation and employment. Rate hikes slow the economy (bearish for stocks), while rate cuts stimulate growth (bullish). Options traders can profit from rate decisions by trading rate-sensitive sectors and index options." />
                </CardTitle>
                {/* Was "AI-powered predictions using Fed Funds futures and
                    economic data". Both halves were false: the route imports no
                    model, and it reads no futures — see the comment on
                    predictionMethodology in app/api/fomc-predictions/route.ts. */}
                <CardDescription className="mt-1">
                  Rule-based rate forecasts scored from FRED economic series — not market-implied
                  {lastUpdated && <span className="ml-2 text-xs">(Updated: {lastUpdated.toLocaleTimeString()})</span>}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
                <RefreshButton onClick={fetchFomcData} isLoading={loading} />
              </div>
            </div>
          </CardHeader>
        </Card>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="h-5 w-5" />
                <p className="font-semibold">{error}</p>
              </div>
              {unavailableInputs.length > 0 && (
                <p className="mt-2 text-sm text-red-700">
                  Unavailable inputs: {unavailableInputs.map(labelFor).join(", ")}.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Prediction is published, but a load-bearing input was missing. Say
            so before any of the numbers below are read as a clean forecast. */}
        {!error && isDegraded && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-2 text-amber-900">
                <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Prediction qualified — insufficient data</p>
                  <p className="text-sm mt-1">
                    {keyInputsMissing.map(labelFor).join(", ")} {keyInputsMissing.length === 1 ? "was" : "were"} not
                    available, so {keyInputsMissing.length === 1 ? "it was" : "they were"} excluded from the model
                    rather than replaced with a representative value. The rate path and probabilities below rest on
                    fewer inputs than the stated methodology assumes. Rate-based options strategies are withheld until
                    the missing data returns.
                  </p>
                  {unavailableInputs.length > keyInputsMissing.length && (
                    <p className="text-xs mt-2 text-amber-800">
                      Also unavailable (display only): {displayOnlyMissing.map(labelFor).join(", ")}.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {chartData.length > 0 && (
          <Card className="shadow-lg border-2 border-primary/20">
            <CardHeader className="bg-primary/5 border-b border-primary/20">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-1">
                Federal Funds Rate - Forecast Chart
                <InfoTooltip enabled={tooltipsEnabled} content="This chart shows historical Fed rates and market expectations for future rates. Falling forecasts signal potential rate cuts (bullish for growth stocks, bearish for banks). Rising forecasts signal hawkish Fed (bearish for growth, bullish for financials)." />
              </CardTitle>
              <CardDescription>
                2-year historical data (solid) and 2-year market consensus forecast (dashed)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <YAxis
                      domain={[2.0, 5.5]}
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                      label={{
                        value: "Percent",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 12, fill: "#6b7280" },
                      }}
                    />
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
                              <p className="text-sm font-bold text-gray-900">{label}</p>
                              {payload.map((p, i) => (
                                <p
                                  key={i}
                                  className={`text-sm ${p.dataKey === "historical" ? "text-gray-800" : "text-green-600"}`}
                                >
                                  {p.name}: {Number(p.value).toFixed(2)}%
                                </p>
                              ))}
                            </div>
                          )
                        }
                        return null
                      }}
                      cursor={{ stroke: "#ccc", strokeWidth: 1, strokeDasharray: "3 3" }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="historical"
                      stroke="#1f2937"
                      strokeWidth={3}
                      name="Historical Data"
                      dot={{ fill: "#1f2937", r: 4 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      stroke="#22c55e"
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      name="Market Consensus Forecast"
                      dot={{ fill: "#22c55e", r: 4 }}
                      connectNulls={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">Chart Methodology:</span> Historical rates from FRED (2 years of daily
                  data, sampled monthly) — those are measured. The forward line is this site&apos;s own projection, not
                  a market consensus: each FOMC meeting is stepped by the hawkish/dovish score, then extrapolated two
                  years forward. No Fed Funds futures are read anywhere in this chart. Values represent monthly
                  averages.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Meeting Prediction */}
        {nextMeeting && (
          <Card className="shadow-lg border-2 border-primary">
            <CardHeader className="bg-primary/10 border-b border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-primary" />
                    Next FOMC Meeting Prediction
                    {isDegraded && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 border border-amber-300">
                        Qualified — insufficient data
                      </span>
                    )}
                    <InfoTooltip enabled={tooltipsEnabled} content="FOMC meets 8 times per year to set rates. Markets move on rate decisions - unexpected cuts/hikes cause volatility. Trade IV expansion before meetings with straddles, or direction after decisions are announced." />
                  </CardTitle>
                  <CardDescription className="text-base">
                    {nextMeeting.daysUntil} days until announcement
                    {isDegraded && ` · computed without ${keyInputsMissing.map(labelFor).join(", ")}`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-6">
                {/* Prediction */}
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>{getPredictionIcon(nextMeeting.prediction)}</TooltipTrigger>
                        <TooltipContent>
                          <p>Predicted action for the upcoming FOMC meeting.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">Predicted Action</p>
                  <p className={`text-3xl font-bold ${getPredictionColor(nextMeeting.prediction)}`}>
                    {nextMeeting.prediction === "HOLD"
                      ? "HOLD"
                      : `${Math.abs(nextMeeting.predictionBps)}bp ${nextMeeting.prediction}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {nextMeeting.prediction === "CUT" && "Rate Decrease Expected"}
                    {nextMeeting.prediction === "HIKE" && "Rate Increase Expected"}
                    {nextMeeting.prediction === "HOLD" && "No Change Expected"}
                  </p>
                </div>

                {/* Confidence */}
                <div className="text-center border-l border-r border-gray-200">
                  <div className="mb-2">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white border-4 border-primary">
                      <span className="text-2xl font-bold text-primary">{nextMeeting.confidence.toFixed(0)}%</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    Confidence
                    <InfoTooltip enabled={tooltipsEnabled} content="How confident the market is in the predicted outcome. High confidence (>80%) means the outcome is priced in - surprises cause big moves. Low confidence means uncertainty - expect volatility." />
                  </p>
                  <p className={`text-lg font-semibold ${getConfidenceLevel(nextMeeting.confidence).color}`}>
                    {getConfidenceLevel(nextMeeting.confidence).label}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {isDegraded ? "Model confidence only — key inputs missing" : "Based on market pricing"}
                  </p>
                </div>

                {/* Rates */}
                <div className="text-center">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">
                        Current Rate
                        <InfoTooltip enabled={tooltipsEnabled} content="The current Federal Funds rate target range. Higher rates increase borrowing costs, slowing economic activity. Lower rates stimulate borrowing and spending." />
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {currentRate === null ? <span className="text-gray-400">—</span> : `${currentRate.toFixed(2)}%`}
                      </p>
                    </div>
                    <div className="h-px bg-gray-200" />
                    <div>
                      {/* Called "Implied Rate", described as what futures markets
                          imply and what traders expect. In rates, "implied" means
                          market-implied specifically — and this number is
                          `currentRate + adjustedChange`, where the change comes
                          from this site's own hawkish/dovish tally. No market
                          priced it. Renamed, because the tooltip alone could not
                          undo what the word claims. */}
                      <p className="text-sm text-gray-600 mb-1">
                        Projected Rate
                        <InfoTooltip enabled={tooltipsEnabled} content="This site's projection: the current Fed Funds rate plus the change suggested by its hawkish/dovish score over FRED series. It is NOT a market-implied rate — no futures are priced here — so it will not match the CME FedWatch Tool, and where they disagree the market is the one quoting real money." />
                      </p>
                      <p className="text-2xl font-bold text-primary">{nextMeeting.impliedRate.toFixed(2)}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <ProbabilityTableSection
          meetings={meetings}
        />
        <RatePathSection
          ratePath={ratePath}
          nextMeeting={nextMeeting}
          tooltipsEnabled={tooltipsEnabled}
        />
        <EconomicIndicatorsSection
          economicIndicators={economicIndicators}
          tooltipsEnabled={tooltipsEnabled}
        />
        <FedDecisionFactorsSection
          fedDecisionFactors={fedDecisionFactors}
        />
        <KeyEconomicFactorsSection
          economicFactors={economicFactors}
        />
        <PredictionMethodologySection
          predictionMethodology={predictionMethodology}
          provenance={provenance}
          unavailableInputs={unavailableInputs}
        />
        <OptionsStrategiesSection
          optionsStrategies={optionsStrategies}
          nextMeeting={nextMeeting}
          tooltipsEnabled={tooltipsEnabled}
        />
      </div>
    </TooltipProvider>
  )
}
