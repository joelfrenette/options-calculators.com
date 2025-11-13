"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Target, Shield, AlertTriangle, Activity, TrendingUp } from 'lucide-react'
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from "recharts"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface TrendData {
  name: string
  symbol: string
  currentPrice: number
  change: number
  changePercent: number
  ma20: number
  ma50: number
  ma200: number
  rsi: number
  macd: number
  macdSignal: number
  macdHistogram: number
  atr: number
  volumeRatio: number
  momentumStrength: number
  support: number
  resistance: number
  allSupport: number[]
  allResistance: number[]
  trend: string
  trendConfidence: number
  trendStrength: string
  priceTarget1Week: number
  priceTarget1Month: number
  stopLoss: number
  targetConfidence: number
  historicalData: {
    date: string
    price: number | null
    ma20: number | null
    ma50: number | null
    forecast?: number
    support: number
    resistance: number
  }[]
}

interface TrendAnalysisData {
  indices: TrendData[]
  lastUpdated: string
}

export function TrendAnalysis() {
  const [data, setData] = useState<TrendAnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<"SPY" | "SPX" | "QQQ">("SPY")

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/trend-analysis")
      if (!response.ok) throw new Error("Failed to fetch trend data")
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "Bullish":
        return "text-green-600 bg-green-50 border-green-200"
      case "Bearish":
        return "text-red-600 bg-red-50 border-red-200"
      default:
        return "text-gray-600 bg-gray-50 border-gray-200"
    }
  }

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case "Strong":
        return "text-green-700 font-bold"
      case "Moderate":
        return "text-orange-600 font-semibold"
      default:
        return "text-gray-600"
    }
  }

  const getMomentumColor = (momentum: number) => {
    if (momentum >= 70) return "text-green-600"
    if (momentum >= 55) return "text-green-500"
    if (momentum >= 45) return "text-gray-600"
    if (momentum >= 30) return "text-red-500"
    return "text-red-600"
  }

  const getOptionsStrategy = (ticker: string, item: TrendData) => {
    const strategies = {
      SPY: {
        bullish: {
          name: "SPY Bull Call Spread",
          description: `SPY is the most liquid options market. With ${(item.trendConfidence ?? 0).toFixed(0)}% bullish confidence, consider buying ATM calls at $${(item.currentPrice ?? 0).toFixed(2)} and selling OTM calls at $${(item.resistance ?? 0).toFixed(2)}. Target 30-45 DTE for optimal theta decay balance.`,
        },
        bearish: {
          name: "SPY Bear Put Spread",
          description: `SPY's high liquidity makes it ideal for put spreads. With ${(item.trendConfidence ?? 0).toFixed(0)}% bearish confidence, buy ATM puts at $${(item.currentPrice ?? 0).toFixed(2)} and sell OTM puts at $${(item.support ?? 0).toFixed(2)}. Consider weekly options for faster profits.`,
        },
        neutral: {
          name: "SPY Iron Condor",
          description: `SPY's tight bid-ask spreads are perfect for iron condors. Sell call spreads above $${(item.resistance ?? 0).toFixed(2)} and put spreads below $${(item.support ?? 0).toFixed(2)}. Target 30-45 DTE with 1 standard deviation wings.`,
        },
      },
      SPX: {
        bullish: {
          name: "SPX Bull Call Spread (Cash-Settled)",
          description: `SPX offers cash-settled, European-style options with tax advantages (60/40 treatment). With ${(item.trendConfidence ?? 0).toFixed(0)}% bullish confidence, buy calls at $${(item.currentPrice ?? 0).toFixed(2)} and sell at $${(item.resistance ?? 0).toFixed(2)}. No assignment risk - perfect for larger accounts.`,
        },
        bearish: {
          name: "SPX Bear Put Spread (Cash-Settled)",
          description: `SPX's cash settlement eliminates assignment risk. With ${(item.trendConfidence ?? 0).toFixed(0)}% bearish confidence, structure put spreads at $${(item.currentPrice ?? 0).toFixed(2)}/$${(item.support ?? 0).toFixed(2)}. Enjoy favorable tax treatment on gains.`,
        },
        neutral: {
          name: "SPX Iron Condor (Tax-Advantaged)",
          description: `SPX iron condors offer 60/40 tax treatment and no assignment risk. Sell premium outside support ($${(item.support ?? 0).toFixed(2)}) and resistance ($${(item.resistance ?? 0).toFixed(2)}). Ideal for consistent income with tax benefits.`,
        },
      },
      QQQ: {
        bullish: {
          name: "QQQ Bull Call Spread (Tech Focus)",
          description: `QQQ tracks Nasdaq-100 with heavy tech exposure. With ${(item.trendConfidence ?? 0).toFixed(0)}% bullish confidence, buy calls at $${(item.currentPrice ?? 0).toFixed(2)} and sell at $${(item.resistance ?? 0).toFixed(2)}. Higher volatility means larger premiums - perfect for tech rallies.`,
        },
        bearish: {
          name: "QQQ Bear Put Spread (Tech Hedge)",
          description: `QQQ's tech concentration makes it volatile during selloffs. With ${(item.trendConfidence ?? 0).toFixed(0)}% bearish confidence, structure put spreads at $${(item.currentPrice ?? 0).toFixed(2)}/$${(item.support ?? 0).toFixed(2)}. Great for hedging tech-heavy portfolios.`,
        },
        neutral: {
          name: "QQQ Iron Condor (High Premium)",
          description: `QQQ's higher IV means bigger premiums for iron condors. Sell call spreads above $${(item.resistance ?? 0).toFixed(2)} and put spreads below $${(item.support ?? 0).toFixed(2)}. Wider wings recommended due to tech volatility.`,
        },
      },
    }

    const tickerStrategies = strategies[ticker as keyof typeof strategies]
    if (item.trend === "Bullish") return tickerStrategies.bullish
    if (item.trend === "Bearish") return tickerStrategies.bearish
    return tickerStrategies.neutral
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-lg text-gray-600">Loading trend data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-red-600">Error: {error}</p>
          <Button onClick={fetchData} className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const selectedItem = data.indices.find((item) => item.name === selectedTicker)

  if (!selectedItem) return null

  const strategy = getOptionsStrategy(selectedTicker, selectedItem)

  return (
    <div className="space-y-4">
      {/* Index Trend Historical Scale visual matching Fear & Greed / Panic Euphoria design */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Index Trend Historical Scale
              </CardTitle>
              <CardDescription>
                Visual representation of trend direction from extreme bearish to extreme bullish
              </CardDescription>
            </div>
            <Button
              onClick={fetchData}
              variant="outline"
              size="sm"
              disabled={loading}
              className="bg-green-50 hover:bg-green-100 border-green-200"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="relative">
            {/* Horizontal gradient bar with labeled zones */}
            <div className="relative h-20 rounded-lg overflow-hidden shadow-sm border border-gray-300">
              <div className="absolute inset-0 h-24 bg-gradient-to-r from-red-600 via-red-400 via-20% via-yellow-400 via-50% via-green-400 via-80% to-green-600 rounded-lg shadow-inner" />
              
              {/* Zone labels */}
              <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-bold">
                {/* Extreme Bearish */}
                <div className="text-center text-white drop-shadow-lg">
                  <div className="text-base">EXTREME</div>
                  <div>BEARISH</div>
                  <div className="text-[10px] mt-1">0-20</div>
                </div>
                {/* Bearish */}
                <div className="text-center text-white drop-shadow-lg">
                  <div>BEARISH</div>
                  <div className="text-[10px] mt-1">21-40</div>
                </div>
                {/* Neutral */}
                <div className="text-center text-gray-800 drop-shadow">
                  <div>NEUTRAL</div>
                  <div className="text-[10px] mt-1">41-60</div>
                </div>
                {/* Bullish */}
                <div className="text-center text-white drop-shadow-lg">
                  <div>BULLISH</div>
                  <div className="text-[10px] mt-1">61-80</div>
                </div>
                {/* Extreme Bullish */}
                <div className="text-center text-white drop-shadow-lg">
                  <div className="text-base">EXTREME</div>
                  <div>BULLISH</div>
                  <div className="text-[10px] mt-1">81-100</div>
                </div>
              </div>
            </div>

            <div
              className="absolute top-0 bottom-0 w-2 bg-black shadow-lg transition-all duration-500"
              style={{
                left: `calc(${Math.max(0, Math.min(100, selectedItem.momentumStrength ?? 50))}% - 4px)`,
              }}
            >
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <div className="bg-black text-white px-4 py-2 rounded-lg shadow-xl">
                  <div className="text-xs font-semibold">TODAY</div>
                  <div className="text-2xl font-bold">{Math.round(selectedItem.momentumStrength ?? 50)}</div>
                  <div className="text-xs text-center">
                    {selectedItem.momentumStrength >= 80
                      ? "Extreme Bullish"
                      : selectedItem.momentumStrength >= 60
                        ? "Bullish"
                        : selectedItem.momentumStrength >= 40
                          ? "Neutral"
                          : selectedItem.momentumStrength >= 20
                            ? "Bearish"
                            : "Extreme Bearish"}
                  </div>
                </div>
                <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-black mx-auto" />
              </div>
            </div>
          </div>

          {/* Context information */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <p className="text-xs font-semibold text-gray-600 mb-1">Current Reading</p>
              <p className="text-lg font-bold text-gray-900">
                {(selectedItem.momentumStrength ?? 0).toFixed(0)}/100
              </p>
              <p className="text-xs text-gray-600 mt-1">Momentum strength indicator</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <p className="text-xs font-semibold text-gray-600 mb-1">Trend Confidence</p>
              <p className="text-lg font-bold text-gray-900">{(selectedItem.trendConfidence ?? 0).toFixed(0)}%</p>
              <p className="text-xs text-gray-600 mt-1">Signal reliability</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <p className="text-xs font-semibold text-gray-600 mb-1">Trend Strength</p>
              <p className={`text-lg font-bold ${getStrengthColor(selectedItem.trendStrength)}`}>
                {selectedItem.trendStrength}
              </p>
              <p className="text-xs text-gray-600 mt-1">Directional power</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Price Forecast card */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-900">{selectedItem.name} - Price Forecast</CardTitle>
          <CardDescription>60-day history + 30-day forecast with support/resistance levels</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={selectedItem.historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: "11px" }} interval="preserveStartEnd" />
              <YAxis stroke="#6b7280" style={{ fontSize: "12px" }} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                labelStyle={{ color: "#374151", fontWeight: "600" }}
                formatter={(value: any) => (value ? `$${value.toFixed(2)}` : "N/A")}
              />
              <Legend />
              <ReferenceLine
                y={selectedItem.support ?? 0}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{ value: "Support", position: "right", fill: "#ef4444", fontSize: 11 }}
              />
              <ReferenceLine
                y={selectedItem.resistance ?? 0}
                stroke="#10b981"
                strokeDasharray="3 3"
                label={{ value: "Resistance", position: "right", fill: "#10b981", fontSize: 11 }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#00a868"
                strokeWidth={2}
                name="Actual Price"
                dot={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Forecast"
                dot={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="ma20"
                stroke="#8b5cf6"
                strokeWidth={1.5}
                name="20-day MA"
                dot={false}
                strokeDasharray="3 3"
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="ma50"
                stroke="#3b82f6"
                strokeWidth={1.5}
                name="50-day MA"
                dot={false}
                strokeDasharray="3 3"
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Index Trend Analysis card */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-gray-900">Index Trend Analysis & Forecast</CardTitle>
              <CardDescription>Real-time trends and options strategies for major index funds</CardDescription>
            </div>
            <Button
              onClick={fetchData}
              variant="outline"
              size="sm"
              disabled={loading}
              className="bg-green-50 hover:bg-green-100 border-green-200"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex gap-2 mb-6">
            {data.indices.map((item) => (
              <button
                key={item.name}
                onClick={() => setSelectedTicker(item.name as "SPY" | "SPX" | "QQQ")}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  selectedTicker === item.name
                    ? "bg-green-50 border-green-200 shadow-sm"
                    : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg font-bold text-gray-900">{item.name}</span>
                  <span className={(item.changePercent ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                    {(item.changePercent ?? 0) >= 0 ? "+" : ""}
                    {(item.changePercent ?? 0).toFixed(3)}%
                  </span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Other existing cards */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-900">
            {selectedItem.name} - Price Targets & Action Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-900">1-Week Target</h3>
              </div>
              <p className="text-2xl font-bold text-green-700">${(selectedItem.priceTarget1Week ?? 0).toFixed(2)}</p>
              <p className="text-sm text-green-600 mt-1">
                {(((selectedItem.priceTarget1Week ?? 0) - (selectedItem.currentPrice ?? 0)) /
                  (selectedItem.currentPrice ?? 1)) *
                  100 >=
                0
                  ? "+"
                  : ""}
                {(
                  (((selectedItem.priceTarget1Week ?? 0) - (selectedItem.currentPrice ?? 0)) /
                    (selectedItem.currentPrice ?? 1)) *
                  100
                ).toFixed(2)}
                % from current
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">1-Month Target</h3>
              </div>
              <p className="text-2xl font-bold text-blue-700">${(selectedItem.priceTarget1Month ?? 0).toFixed(2)}</p>
              <p className="text-sm text-blue-600 mt-1">
                {(((selectedItem.priceTarget1Month ?? 0) - (selectedItem.currentPrice ?? 0)) /
                  (selectedItem.currentPrice ?? 1)) *
                  100 >=
                0
                  ? "+"
                  : ""}
                {(
                  (((selectedItem.priceTarget1Month ?? 0) - (selectedItem.currentPrice ?? 0)) /
                    (selectedItem.currentPrice ?? 1)) *
                  100
                ).toFixed(2)}
                % from current
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-red-900">Stop Loss</h3>
              </div>
              <p className="text-2xl font-bold text-red-700">${(selectedItem.stopLoss ?? 0).toFixed(2)}</p>
              <p className="text-sm text-red-600 mt-1">
                {(
                  (((selectedItem.stopLoss ?? 0) - (selectedItem.currentPrice ?? 0)) /
                    (selectedItem.currentPrice ?? 1)) *
                  100
                ).toFixed(2)}
                % from current
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Support Level</p>
              <p className="text-xl font-bold text-gray-900">${(selectedItem.support ?? 0).toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Key buying zone</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Resistance Level</p>
              <p className="text-xl font-bold text-gray-900">${(selectedItem.resistance ?? 0).toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Key selling zone</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Volatility (ATR)</p>
              <p className="text-xl font-bold text-gray-900">${(selectedItem.atr ?? 0).toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Daily range</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">RSI</p>
              <p className="text-xl font-bold text-gray-900">{(selectedItem.rsi ?? 0).toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {(selectedItem.rsi ?? 0) > 70 ? "Overbought" : (selectedItem.rsi ?? 0) < 30 ? "Oversold" : "Neutral"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-900">
            {selectedItem.name} - Options Strategy Recommendation
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div
              className={`border-2 rounded-lg p-4 ${selectedItem.trend === "Bullish" ? "bg-green-50 border-green-200" : selectedItem.trend === "Bearish" ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg">{strategy.name}</h3>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${selectedItem.trendStrength === "Strong" ? "bg-green-100 text-green-700" : selectedItem.trendStrength === "Moderate" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"}`}
                >
                  {selectedItem.trendStrength} Signal
                </span>
              </div>
              <p className="text-gray-700 leading-relaxed mb-4">{strategy.description}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="bg-white/50 p-3 rounded border">
                  <p className="font-semibold text-gray-700 mb-1">Entry Point</p>
                  <p className="text-gray-900">${(selectedItem.currentPrice ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-white/50 p-3 rounded border">
                  <p className="font-semibold text-gray-700 mb-1">Target Exit</p>
                  <p className="text-gray-900">${(selectedItem.priceTarget1Month ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-white/50 p-3 rounded border">
                  <p className="font-semibold text-gray-700 mb-1">Stop Loss</p>
                  <p className="text-gray-900">${(selectedItem.stopLoss ?? 0).toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Risk Management for {selectedItem.name}
              </h4>
              <ul className="text-orange-800 text-sm space-y-1 leading-relaxed">
                <li>• Set stop loss at ${(selectedItem.stopLoss ?? 0).toFixed(2)} to limit downside risk</li>
                <li>• Monitor momentum strength (currently ${(selectedItem.momentumStrength ?? 0).toFixed(0)}/100)</li>
                <li>
                  • Watch for volume changes - current ratio is {(selectedItem.volumeRatio ?? 0).toFixed(2)}x average
                </li>
                <li>• Adjust position if trend confidence drops below 60%</li>
                {selectedTicker === "SPX" && <li>• Remember: SPX is cash-settled with no assignment risk</li>}
                {selectedTicker === "QQQ" && <li>• QQQ has higher volatility - use wider stop losses</li>}
              </ul>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                <strong>Disclaimer:</strong> This analysis is based on technical indicators and historical data. It is
                not financial advice. All trading involves substantial risk of loss. Past performance does not guarantee
                future results. Always conduct your own research and consider consulting with a licensed financial
                advisor before making trading decisions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-900">Options Strategies by Trend Direction</CardTitle>
          <CardDescription>Recommended strategies for different market conditions</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 pb-4">
          <div className="space-y-2">
            {/* Bullish Trend */}
            <div
              className={`p-4 rounded-lg border transition-colors ${
                selectedItem.trend === "Bullish"
                  ? "border-primary bg-green-50 shadow-sm"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="font-bold text-lg text-green-700 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Uptrend / Bullish
                  </div>
                  {selectedItem.trend === "Bullish" && (
                    <div className="inline-block px-2 py-1 bg-green-600 text-white text-xs font-bold rounded mt-1">
                      CURRENT TREND
                    </div>
                  )}
                  <div className="text-xs text-gray-600 font-medium mt-2">Strong buying pressure, higher highs</div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-green-900 uppercase">Aggressive Strategies</div>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Long Calls - Direct upside exposure</li>
                    <li>• Bull Call Spread - Defined risk/reward</li>
                    <li>• Cash-Secured Puts - Get paid to buy dips</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-green-900 uppercase">Conservative Strategies</div>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Covered Calls - Income on holdings</li>
                    <li>• Poor Man's Covered Call - Lower capital</li>
                    <li>• Short Put Spreads - Benefit from stability</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Sideways/Neutral Trend */}
            <div
              className={`p-4 rounded-lg border transition-colors ${
                selectedItem.trend === "Neutral"
                  ? "border-primary bg-yellow-50 shadow-sm"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="font-bold text-lg text-yellow-700 flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Sideways / Neutral
                  </div>
                  {selectedItem.trend === "Neutral" && (
                    <div className="inline-block px-2 py-1 bg-yellow-600 text-white text-xs font-bold rounded mt-1">
                      CURRENT TREND
                    </div>
                  )}
                  <div className="text-xs text-gray-600 font-medium mt-2">Range-bound, low volatility</div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-yellow-900 uppercase">Income Strategies</div>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Iron Condor - Profit from range</li>
                    <li>• Straddle/Strangle Selling - Collect premium</li>
                    <li>• Calendar Spreads - Time decay advantage</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-yellow-900 uppercase">Theta Strategies</div>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Butterfly Spread - Max profit at strike</li>
                    <li>• Covered Calls - Income on flat stocks</li>
                    <li>• Wheel Strategy - Consistent premium</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Bearish Trend */}
            <div
              className={`p-4 rounded-lg border transition-colors ${
                selectedItem.trend === "Bearish"
                  ? "border-primary bg-red-50 shadow-sm"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="font-bold text-lg text-red-700 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Downtrend / Bearish
                  </div>
                  {selectedItem.trend === "Bearish" && (
                    <div className="inline-block px-2 py-1 bg-red-600 text-white text-xs font-bold rounded mt-1">
                      CURRENT TREND
                    </div>
                  )}
                  <div className="text-xs text-gray-600 font-medium mt-2">Selling pressure, lower lows</div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-red-900 uppercase">Directional Strategies</div>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Long Puts - Direct downside profit</li>
                    <li>• Bear Put Spread - Defined risk bearish</li>
                    <li>• Bear Call Spread - Credit from decline</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-red-900 uppercase">Hedging Strategies</div>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Protective Puts - Insurance for longs</li>
                    <li>• Collar - Protected downside, capped upside</li>
                    <li>• Ratio Put Spread - Enhanced protection</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <Alert className="mt-4 bg-blue-50 border-blue-200">
            <AlertDescription className="text-blue-900 text-sm">
              <strong>Strategy Selection Tip:</strong> The highlighted section shows strategies optimized for the
              current {selectedItem.trend.toLowerCase()} trend in {selectedItem.name}. Always match your strategy to
              market conditions and your risk tolerance. Consider combining multiple strategies for balanced exposure.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
