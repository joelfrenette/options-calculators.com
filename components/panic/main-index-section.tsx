"use client"

/**
 * The main index card: the score, its label, and what each component contributed.
 *
 * Split out of `components/panic-euphoria.tsx` (P6-13) unchanged. What it closed
 * over is now props.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { Activity, AlertTriangle, BarChart3, Info, Minus, TrendingDown, TrendingUp } from "lucide-react"
import { getScoreBackground, getScoreColor } from "./score-bands"
import type { getTradeRecommendations } from "./trade-guidance"
import type { PanicEuphoriaData } from "./panic-types"

export function MainIndexSection({
  data,
  recommendations,
  lastUpdated,
  refreshing,
  handleRefresh,
}: {
  data: PanicEuphoriaData
  recommendations: ReturnType<typeof getTradeRecommendations>
  lastUpdated: Date | null
  refreshing: boolean
  handleRefresh: () => void
}) {
  return (
    <>
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-600" />
                Citibank Panic/Euphoria Model
                {lastUpdated && (
                  <span className="text-xs font-normal text-gray-500">
                    (Updated: {lastUpdated.toLocaleTimeString()})
                  </span>
                )}
              </CardTitle>
              <RefreshButton onClick={handleRefresh} loading={refreshing} />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className={`transition-opacity duration-300 ${refreshing ? "opacity-50" : "opacity-100"}`}>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Overall Score */}
                <div className={`p-6 rounded-lg border-2 ${getScoreBackground(data.overallScore)}`}>
                  <div className="text-sm font-semibold text-gray-600 mb-2">Current Model Reading</div>
                  <div className="flex items-baseline gap-3">
                    <div className={`text-5xl font-bold ${getScoreColor(data.overallScore)}`}>
                      {data.overallScore >= 0 ? "+" : ""}
                      {data.overallScore.toFixed(3)}
                    </div>
                  </div>
                  <div className={`text-lg font-bold mt-2 ${getScoreColor(data.overallScore)}`}>{data.level}</div>
                  <div className="mt-4 p-3 bg-white rounded border border-gray-200">
                    <div className="text-xs font-semibold text-gray-600 mb-2">S&P 500 vs 200-Week MA</div>
                    <div className="flex items-center gap-2">
                      {data.aboveMA ? (
                        <>
                          <TrendingUp className="h-5 w-5 text-green-600" />
                          <span className="text-sm font-bold text-green-600">ABOVE (Bullish)</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-5 w-5 text-red-600" />
                          <span className="text-sm font-bold text-red-600">BELOW (Caution)</span>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      SPX: {data.spx.toFixed(2)} | 200-WMA: {data.spx200WeekMA.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 mt-3 text-xs">
                    <div className="flex items-center gap-1">
                      {data.yesterdayChange > 0 ? (
                        <TrendingUp className="h-3 w-3 text-green-600" />
                      ) : data.yesterdayChange < 0 ? (
                        <TrendingDown className="h-3 w-3 text-red-600" />
                      ) : (
                        <Minus className="h-3 w-3 text-gray-600" />
                      )}
                      <span className="font-semibold text-gray-700">
                        Yesterday: {data.yesterdayChange > 0 ? "+" : ""}
                        {data.yesterdayChange.toFixed(3)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {data.lastWeekChange > 0 ? (
                        <TrendingUp className="h-3 w-3 text-green-600" />
                      ) : data.lastWeekChange < 0 ? (
                        <TrendingDown className="h-3 w-3 text-red-600" />
                      ) : (
                        <Minus className="h-3 w-3 text-gray-600" />
                      )}
                      <span className="font-semibold text-gray-700">
                        Last Week: {data.lastWeekChange > 0 ? "+" : ""}
                        {data.lastWeekChange.toFixed(3)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {data.lastMonthChange > 0 ? (
                        <TrendingUp className="h-3 w-3 text-green-600" />
                      ) : data.lastMonthChange < 0 ? (
                        <TrendingDown className="h-3 w-3 text-red-600" />
                      ) : (
                        <Minus className="h-3 w-3 text-gray-600" />
                      )}
                      <span className="font-semibold text-gray-700">
                        Last Month: {data.lastMonthChange > 0 ? "+" : ""}
                        {data.lastMonthChange.toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Component Indicators - 9 Citibank Inputs */}
                <div className="space-y-2">
                  <div className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-purple-600" />
                    Citibank Model Inputs (9 Components)
                  </div>

                  <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">NYSE Short Interest</span>
                      <div className="relative group/tooltip">
                        <Info className="h-3 w-3 text-gray-400 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                          Short interest as % of float. High short interest indicates bearish positioning, which is a
                          contrarian bullish signal (panic = buying opportunity). Range: 10-30%.
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{data.nyseShortInterest !== null ? `${data.nyseShortInterest.toFixed(1)}%` : "—"}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Margin Debt</span>
                      <div className="relative group/tooltip">
                        <Info className="h-3 w-3 text-gray-400 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                          Total margin debt levels. High margin indicates leveraged speculation and euphoria risk. Low
                          margin suggests fear. Range: $600-$850B.
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">${data.marginDebt.toFixed(0)}B</span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Nasdaq vs NYSE Volume</span>
                      <div className="relative group/tooltip">
                        <Info className="h-3 w-3 text-gray-400 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                          Nasdaq/NYSE volume ratio. High ratio indicates speculative tech trading and euphoria. Low
                          indicates value rotation. Range: 0.8-1.5x.
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{data.volumeRatio.toFixed(2)}x</span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Investor Intelligence</span>
                      <div className="relative group/tooltip">
                        <Info className="h-3 w-3 text-gray-400 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                          Newsletter writer bulls vs bears. High bullishness = euphoria (contrarian sell).
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{data.investorIntelligence.toFixed(0)}%</span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">AAII Bullish %</span>
                      <div className="relative group/tooltip">
                        <Info className="h-3 w-3 text-gray-400 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                          Individual investor survey. High = retail euphoria (contrarian sell).
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{data.aaiiBullish.toFixed(0)}%</span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Money Market Funds</span>
                      <div className="relative group/tooltip">
                        <Info className="h-3 w-3 text-gray-400 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                          Retail money market assets. High = cash on sidelines (bullish potential).
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      {data.moneyMarketFunds !== null ? `$${data.moneyMarketFunds.toFixed(2)}T` : "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">VIX Momentum</span>
                      <div className="relative group/tooltip">
                        <Info className="h-3 w-3 text-gray-400 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                          VIX 5-day average / 50-day average. Above 1.0 = fear elevated against its own recent norm (contrarian bullish). Note this runs OPPOSITE to the CCPI tab's VIX term structure, where above 1.0 means calm.
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{data.vixMomentumRatio.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Commodity Prices</span>
                      <div className="relative group/tooltip">
                        <Info className="h-3 w-3 text-gray-400 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                          CRB Index trend. Rising = inflation/growth fears or euphoria.
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{data.commodityPrices !== null ? data.commodityPrices.toFixed(1) : "—"}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded group hover:border-purple-500 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Retail Gas Prices</span>
                      <div className="relative group/tooltip">
                        <Info className="h-3 w-3 text-gray-400 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                          National avg gas price. High = consumer stress (economic drag).
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      {data.gasPrices !== null ? `$${data.gasPrices.toFixed(2)}/gal` : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signal Strength */}
              <div className={`mt-4 p-4 rounded-lg border-2 ${getScoreBackground(data.overallScore)}`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className={`h-5 w-5 ${getScoreColor(data.overallScore)}`} />
                  <div className="text-sm font-bold text-gray-900">Trading Signal</div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-bold ${getScoreColor(data.overallScore)}`}>
                    {recommendations.signal}
                  </span>
                  <span className="text-sm font-semibold text-gray-700">Confidence: {recommendations.confidence}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
    </>
  )
}
