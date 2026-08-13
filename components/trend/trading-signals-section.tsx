"use client"

/**
 * Trading signals and the suggested option structure.
 *
 * Split out of `components/trend-analysis.tsx` (P6-13) unchanged. What it closed
 * over is now props.
 */
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Activity, AlertTriangle, Info, Shield, Target, TrendingUp } from "lucide-react"
import { getMomentumColor, getTrendColor } from "./style-maps"
import type { getOptionsStrategy } from "./options-strategy"
import type { TrendData } from "./trend-types"

export function TradingSignalsSection({
  selectedItem,
  selectedTicker,
  strategy,
}: {
  selectedItem: TrendData
  selectedTicker: string
  strategy: ReturnType<typeof getOptionsStrategy>
}) {
  return (
    <>
        <Accordion type="single" collapsible defaultValue="trading-signals">
          <AccordionItem value="trading-signals" className="border rounded-lg shadow-sm">
            <AccordionTrigger className="px-6 py-4 bg-gray-50 hover:bg-gray-100 rounded-t-lg border-b">
              <div className="text-left">
                <h3 className="text-lg font-bold text-gray-900">{selectedItem.name} - Trading Signals</h3>
                <p className="text-sm text-gray-600 mt-1">Click to view key technical indicators and signals</p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">Trend Direction</p>
                  <p className={`text-xl font-bold ${getTrendColor(selectedItem.trend)}`}>
                    {selectedItem.trend} ({selectedItem.trendConfidence.toFixed(0)}% Confident)
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">Momentum Strength</p>
                  {/* Grey and em-dash when there is no reading. `getMomentumColor`
                      would otherwise have to be handed a stand-in number, and any
                      stand-in on a 0-100 scale is itself a reading. */}
                  {selectedItem.momentumStrength === null ? (
                    <p className="text-xl font-bold text-gray-400">—</p>
                  ) : (
                    <p className={`text-xl font-bold ${getMomentumColor(selectedItem.momentumStrength)}`}>
                      {selectedItem.momentumStrength.toFixed(0)}/100
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">20-Day MA</p>
                  <p className="text-xl font-bold text-gray-900">${selectedItem.ma20.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">50-Day MA</p>
                  <p className="text-xl font-bold text-gray-900">${selectedItem.ma50.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">200-Day MA</p>
                  <p className="text-xl font-bold text-gray-900">${selectedItem.ma200.toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">RSI (Relative Strength Index)</p>
                  <p className="text-xl font-bold text-gray-900">{selectedItem.rsi.toFixed(0)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedItem.rsi > 70 ? "Overbought" : selectedItem.rsi < 30 ? "Oversold" : "Neutral"}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">MACD</p>
                  <p className="text-xl font-bold text-gray-900">{selectedItem.macd.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedItem.macdHistogram > 0 ? "Bullish momentum" : "Bearish momentum"}
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Options Strategies by Trend Direction in collapsible accordion */}
        <Accordion type="single" collapsible defaultValue="">
          <AccordionItem value="strategies-by-direction" className="border rounded-lg shadow-sm">
            <AccordionTrigger className="px-6 py-4 bg-gray-50 hover:bg-gray-100 rounded-t-lg border-b">
              <div className="text-left">
                <h3 className="text-lg font-bold text-gray-900">Options Strategies by Trend Direction</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Click to view recommended strategies for different market conditions
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 py-6">
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
                  market conditions and your risk tolerance. Consider combining multiple strategies for balanced
                  exposure.
                </AlertDescription>
              </Alert>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* SPY Options Strategy Recommendation in collapsible accordion */}
        <Accordion type="single" collapsible defaultValue="">
          <AccordionItem value="strategy-recommendation" className="border rounded-lg shadow-sm">
            <AccordionTrigger className="px-6 py-4 bg-gray-50 hover:bg-gray-100 rounded-t-lg border-b">
              <div className="text-left">
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedItem.name} - Options Strategy Recommendation
                </h3>
                <p className="text-sm text-gray-600 mt-1">Click to view detailed options strategy for current trend</p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 py-6">
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
                      <p className="text-gray-900">${selectedItem.currentPrice.toFixed(2)}</p>
                    </div>
                    <div className="bg-white/50 p-3 rounded border">
                      <p className="font-semibold text-gray-700 mb-1">Target Exit</p>
                      <p className="text-gray-900">${selectedItem.priceTarget1Month.toFixed(2)}</p>
                    </div>
                    <div className="bg-white/50 p-3 rounded border">
                      <p className="font-semibold text-gray-700 mb-1">Stop Loss</p>
                      <p className="text-gray-900">${selectedItem.stopLoss.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h4 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Risk Management for {selectedItem.name}
                  </h4>
                  <ul className="text-orange-800 text-sm space-y-1 leading-relaxed">
                    <li>• Set stop loss at ${selectedItem.stopLoss.toFixed(2)} to limit downside risk</li>
                    <li>
                      • Monitor momentum strength (currently ${selectedItem.momentumStrength === null ? "no reading" : `${selectedItem.momentumStrength.toFixed(0)}/100`})
                    </li>
                    <li>
                      • Watch for volume changes - current ratio is {selectedItem.volumeRatio.toFixed(2)}x
                      average
                    </li>
                    <li>• Adjust position if trend confidence drops below 60%</li>
                    {selectedTicker === "SPX" && <li>• Remember: SPX is cash-settled with no assignment risk</li>}
                    {selectedTicker === "QQQ" && <li>• QQQ has higher volatility - use wider stop losses</li>}
                  </ul>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    <strong>Disclaimer:</strong> This analysis is based on technical indicators and historical data. It
                    is not financial advice. All trading involves substantial risk of loss. Past performance does not
                    guarantee future results. Always conduct your own research and consider consulting with a licensed
                    financial advisor before making trading decisions.
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
    </>
  )
}
