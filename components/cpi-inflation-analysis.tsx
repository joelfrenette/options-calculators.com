"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface CPIData {
  currentCPI: number
  previousCPI: number
  trend: "up" | "down" | "stable"
  targetCPI: number
  chartData: CPIChartPoint[]
  forecastData: CPIForecastPoint[]
  optionsStrategies: InflationStrategy[]
  inflationPressure: string
  fedTarget: number
  lastUpdated: string
}

interface CPIChartPoint {
  date: string
  historical: number | null
  forecast: number | null
  type: "historical" | "current" | "forecast"
}

interface CPIForecastPoint {
  month: string
  cpi: number
  yoyChange: number
}

interface InflationStrategy {
  name: string
  ticker: string
  type: string
  rationale: string
  entry: string
  target: string
  stopLoss: string
  timeframe: string
  risk: string
}

export function CpiInflationAnalysis() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cpiData, setCpiData] = useState<CPIData | null>(null)

  const fetchCPIData = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/cpi-inflation")
      if (!response.ok) throw new Error("Failed to fetch CPI data")

      const data = await response.json()
      setCpiData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCPIData()
  }, [])

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return "↑"
    if (trend === "down") return "↓"
    return "→"
  }

  const getTrendColor = (trend: string) => {
    if (trend === "up") return "text-red-600"
    if (trend === "down") return "text-green-600"
    return "text-gray-600"
  }

  const getInflationPressureStyle = (pressure: string) => {
    if (pressure === "High") return "bg-red-100 text-red-800 border-red-300"
    if (pressure === "Moderate") return "bg-yellow-100 text-yellow-800 border-yellow-300"
    return "bg-green-100 text-green-800 border-green-300"
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                U.S. Inflation (CPI-U) Forecast
              </CardTitle>
              <CardDescription className="mt-1">
                Consumer Price Index year-over-year change with 2-year forecast
                {cpiData?.lastUpdated && (
                  <span className="ml-2 text-xs">(Updated: {new Date(cpiData.lastUpdated).toLocaleString()})</span>
                )}
              </CardDescription>
            </div>
            <RefreshButton
              onClick={fetchCPIData}
              isLoading={loading}
              variant="default"
              className="bg-primary hover:bg-primary/90"
            />
          </div>
        </CardHeader>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-800">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="font-semibold">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {cpiData && (
        <>
          {/* CPI Forecast Chart */}
          <Card className="shadow-lg border-2 border-primary/20">
            <CardHeader className="bg-primary/5 border-b border-primary/20">
              <CardTitle className="text-lg font-bold text-gray-900">U.S. Inflation (CPI-U) - Forecast Chart</CardTitle>
              <CardDescription>
                2-year historical data (solid) and 2-year consensus inflation forecast (dashed)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cpiData.chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <YAxis
                      domain={[1.5, 5.0]}
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                      label={{
                        value: "YoY % Change",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 12, fill: "#6b7280" },
                      }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                      formatter={(value: any) => `${Number(value).toFixed(1)}%`}
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
                      name="Consensus Inflation Model"
                      dot={{ fill: "#22c55e", r: 4 }}
                      connectNulls={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">Chart Methodology:</span> Historical CPI from FRED (2 years of monthly
                  data). Consensus forecast based on Fed projections, economist surveys, and trend analysis. Values
                  represent year-over-year percentage change.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Current CPI Status */}
          <Card className="shadow-lg border-2 border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-900">Current Inflation Status</CardTitle>
              <CardDescription>Latest CPI readings and trend analysis</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">Current CPI (YoY)</p>
                  <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-300">
                    <p className="text-4xl font-bold text-blue-900">{cpiData.currentCPI.toFixed(1)}%</p>
                  </div>
                  <div className={`mt-2 flex items-center justify-center gap-1 ${getTrendColor(cpiData.trend)}`}>
                    <span className="text-2xl">{getTrendIcon(cpiData.trend)}</span>
                    <span className="text-sm font-semibold">
                      {cpiData.trend === "up" ? "Rising" : cpiData.trend === "down" ? "Falling" : "Stable"}
                    </span>
                  </div>
                </div>

                <div className="text-center border-l border-r border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">Previous Month</p>
                  <div className="bg-gray-100 rounded-lg p-4 border-2 border-gray-300">
                    <p className="text-4xl font-bold text-gray-900">{cpiData.previousCPI.toFixed(1)}%</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {cpiData.currentCPI > cpiData.previousCPI
                      ? `+${(cpiData.currentCPI - cpiData.previousCPI).toFixed(1)}pp increase`
                      : `${(cpiData.currentCPI - cpiData.previousCPI).toFixed(1)}pp decrease`}
                  </p>
                </div>

                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">Fed Target</p>
                  <div className="bg-green-50 rounded-lg p-4 border-2 border-green-300">
                    <p className="text-4xl font-bold text-green-900">{cpiData.fedTarget.toFixed(1)}%</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {cpiData.currentCPI > cpiData.fedTarget
                      ? `${(cpiData.currentCPI - cpiData.fedTarget).toFixed(1)}pp above target`
                      : "At or below target"}
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">Inflation Pressure Assessment</p>
                    <p className="text-xs text-gray-600">Based on current CPI vs. Fed target</p>
                  </div>
                  <span
                    className={`px-4 py-2 rounded-lg text-lg font-bold border-2 ${getInflationPressureStyle(cpiData.inflationPressure)}`}
                  >
                    {cpiData.inflationPressure}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Forecast Table */}
          {cpiData.forecastData && cpiData.forecastData.length > 0 && (
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="bg-gray-50 border-b border-gray-200">
                <CardTitle className="text-lg font-bold text-gray-900">24-Month CPI Forecast</CardTitle>
                <CardDescription>Projected inflation readings for the next 2 years</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-semibold text-gray-900">Month</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-900">Projected CPI (YoY %)</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-900">Change from Current</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cpiData.forecastData.slice(0, 12).map((forecast, index) => (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-3 font-medium text-gray-900">{forecast.month}</td>
                          <td className="text-right py-2 px-3 text-gray-900 font-semibold">
                            {forecast.cpi.toFixed(1)}%
                          </td>
                          <td
                            className={`text-right py-2 px-3 font-semibold ${forecast.yoyChange >= 0 ? "text-red-600" : "text-green-600"}`}
                          >
                            {forecast.yoyChange >= 0 ? "+" : ""}
                            {forecast.yoyChange.toFixed(1)}pp
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-xs text-blue-800">
                    <span className="font-semibold">Note:</span> Showing first 12 months. Forecasts become less reliable
                    beyond 6 months as economic conditions evolve.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Options Trading Strategies */}
          {cpiData.optionsStrategies && cpiData.optionsStrategies.length > 0 && (
            <Card className="shadow-lg border-2 border-primary">
              <CardHeader className="bg-primary/5 border-b border-primary/20">
                <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Inflation-Based Options Strategies
                </CardTitle>
                <CardDescription className="text-base">
                  Trade ideas based on {cpiData.inflationPressure.toLowerCase()} inflation pressure (CPI:{" "}
                  {cpiData.currentCPI.toFixed(1)}% vs Target: {cpiData.fedTarget.toFixed(1)}%)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid md:grid-cols-2 gap-4">
                  {cpiData.optionsStrategies.map((strategy, index) => (
                    <Card key={index} className="border-2 border-gray-200 hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base font-bold text-gray-900">{strategy.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                {strategy.ticker}
                              </span>
                              <span className="text-xs text-gray-600">{strategy.type}</span>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-700">{strategy.rationale}</p>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex items-start gap-2">
                            <span className="font-semibold text-gray-900 min-w-[70px]">Entry:</span>
                            <span className="text-gray-700">{strategy.entry}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="font-semibold text-gray-900 min-w-[70px]">Target:</span>
                            <span className="text-gray-700">{strategy.target}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="font-semibold text-gray-900 min-w-[70px]">Stop Loss:</span>
                            <span className="text-gray-700">{strategy.stopLoss}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="font-semibold text-gray-900 min-w-[70px]">Timeframe:</span>
                            <span className="text-gray-700">{strategy.timeframe}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-gray-200">
                          <div className="flex items-start gap-2 text-xs">
                            <svg
                              className="h-3 w-3 mt-0.5 flex-shrink-0 text-orange-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                            <p className="text-gray-600">
                              <span className="font-semibold">Risk:</span> {strategy.risk}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <span className="font-semibold">⚠️ Important Disclaimer:</span> These strategies are for educational
                    purposes only and do not constitute financial advice. Inflation data can be volatile and revised.
                    Always conduct your own research and consider consulting with a licensed financial advisor before
                    making any investment decisions.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
