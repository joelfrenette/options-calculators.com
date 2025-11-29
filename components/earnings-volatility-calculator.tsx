"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, TrendingUp, Info } from "lucide-react"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { TooltipProvider } from "@/components/ui/tooltip"

export function EarningsVolatilityCalculator() {
  const [ticker, setTicker] = useState("AAPL")
  const [stockPrice, setStockPrice] = useState("175.00")
  const [earningsDate, setEarningsDate] = useState("")
  const [currentIV, setCurrentIV] = useState("45")
  const [historicalIV, setHistoricalIV] = useState("30")
  const [atmCallPrice, setAtmCallPrice] = useState("5.50")
  const [atmPutPrice, setAtmPutPrice] = useState("5.25")
  const [callStrike, setCallStrike] = useState("")
  const [putStrike, setPutStrike] = useState("")
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  const price = Number.parseFloat(stockPrice) || 0
  const iv = Number.parseFloat(currentIV) || 0
  const hv = Number.parseFloat(historicalIV) || 0
  const callPrice = Number.parseFloat(atmCallPrice) || 0
  const putPrice = Number.parseFloat(atmPutPrice) || 0
  const callStrikeNum = Number.parseFloat(callStrike) || price
  const putStrikeNum = Number.parseFloat(putStrike) || price

  // Calculate IV Crush Risk
  const ivCrushRisk = hv > 0 ? ((iv - hv) / hv) * 100 : 0
  const ivCrushLevel = ivCrushRisk > 50 ? "EXTREME" : ivCrushRisk > 30 ? "HIGH" : ivCrushRisk > 15 ? "MODERATE" : "LOW"

  // Calculate Expected Move
  const straddlePrice = callPrice + putPrice
  const expectedMovePercent = price > 0 ? (straddlePrice / price) * 100 : 0
  const expectedMoveDollars = (price * expectedMovePercent) / 100

  // Calculate Straddle Breakevens (ATM)
  const straddleUpperBreakeven = price + straddlePrice
  const straddleLowerBreakeven = price - straddlePrice

  // Calculate Strangle Breakevens
  const stranglePrice = callPrice + putPrice
  const strangleUpperBreakeven = callStrikeNum + stranglePrice
  const strangleLowerBreakeven = putStrikeNum - stranglePrice

  // Days until earnings
  const daysUntilEarnings = earningsDate
    ? Math.ceil((new Date(earningsDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const getRiskColor = (level: string) => {
    switch (level) {
      case "EXTREME":
        return "text-red-600 bg-red-50 border-red-200"
      case "HIGH":
        return "text-orange-600 bg-orange-50 border-orange-200"
      case "MODERATE":
        return "text-yellow-600 bg-yellow-50 border-yellow-200"
      default:
        return "text-green-600 bg-green-50 border-green-200"
    }
  }

  const getRecommendation = () => {
    if (ivCrushRisk > 50) {
      return "AVOID opening new long options positions. Consider selling premium or staying flat."
    } else if (ivCrushRisk > 30) {
      return "HIGH RISK for long options. If trading, consider spreads to reduce vega exposure."
    } else if (ivCrushRisk > 15) {
      return "MODERATE RISK. Consider reducing position size or using defined-risk strategies."
    } else {
      return "LOW RISK environment. IV is not significantly elevated above historical levels."
    }
  }

  return (
    <TooltipProvider disabled={!tooltipsEnabled}>
      <div className="space-y-4">
        {/* Input Section */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Earnings Volatility Analysis
            </div>
            <div className="flex items-center gap-2">
              <TooltipsToggle enabled={tooltipsEnabled} onToggle={() => setTooltipsEnabled(!tooltipsEnabled)} />
              <RefreshButton />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="ticker" className="text-sm font-semibold text-gray-700">
                    Ticker Symbol
                  </Label>
                  <Input
                    id="ticker"
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    className="mt-1"
                    placeholder="AAPL"
                  />
                </div>

                <div>
                  <Label htmlFor="stockPrice" className="text-sm font-semibold text-gray-700">
                    Current Stock Price ($)
                  </Label>
                  <Input
                    id="stockPrice"
                    type="number"
                    step="0.01"
                    value={stockPrice}
                    onChange={(e) => setStockPrice(e.target.value)}
                    className="mt-1"
                    placeholder="175.00"
                  />
                </div>

                <div>
                  <Label htmlFor="earningsDate" className="text-sm font-semibold text-gray-700">
                    Earnings Date
                  </Label>
                  <Input
                    id="earningsDate"
                    type="date"
                    value={earningsDate}
                    onChange={(e) => setEarningsDate(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="currentIV" className="text-sm font-semibold text-gray-700">
                    Current IV (%)
                  </Label>
                  <Input
                    id="currentIV"
                    type="number"
                    step="0.1"
                    value={currentIV}
                    onChange={(e) => setCurrentIV(e.target.value)}
                    className="mt-1"
                    placeholder="45"
                  />
                </div>

                <div>
                  <Label htmlFor="historicalIV" className="text-sm font-semibold text-gray-700">
                    Historical IV (%)
                  </Label>
                  <Input
                    id="historicalIV"
                    type="number"
                    step="0.1"
                    value={historicalIV}
                    onChange={(e) => setHistoricalIV(e.target.value)}
                    className="mt-1"
                    placeholder="30"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="atmCallPrice" className="text-sm font-semibold text-gray-700">
                    ATM Call Price ($)
                  </Label>
                  <Input
                    id="atmCallPrice"
                    type="number"
                    step="0.01"
                    value={atmCallPrice}
                    onChange={(e) => setAtmCallPrice(e.target.value)}
                    className="mt-1"
                    placeholder="5.50"
                  />
                </div>

                <div>
                  <Label htmlFor="atmPutPrice" className="text-sm font-semibold text-gray-700">
                    ATM Put Price ($)
                  </Label>
                  <Input
                    id="atmPutPrice"
                    type="number"
                    step="0.01"
                    value={atmPutPrice}
                    onChange={(e) => setAtmPutPrice(e.target.value)}
                    className="mt-1"
                    placeholder="5.25"
                  />
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-2">For Strangle Calculation (Optional)</p>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="callStrike" className="text-sm font-semibold text-gray-700">
                        Call Strike ($)
                      </Label>
                      <Input
                        id="callStrike"
                        type="number"
                        step="0.01"
                        value={callStrike}
                        onChange={(e) => setCallStrike(e.target.value)}
                        className="mt-1"
                        placeholder={stockPrice}
                      />
                    </div>

                    <div>
                      <Label htmlFor="putStrike" className="text-sm font-semibold text-gray-700">
                        Put Strike ($)
                      </Label>
                      <Input
                        id="putStrike"
                        type="number"
                        step="0.01"
                        value={putStrike}
                        onChange={(e) => setPutStrike(e.target.value)}
                        className="mt-1"
                        placeholder={stockPrice}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {price > 0 && (
          <>
            {/* Expected Move */}
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="bg-gray-50 border-b border-gray-200">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Expected Move (Based on ATM Straddle)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-semibold text-gray-600 mb-1">Expected Move</p>
                    <p className="text-3xl font-bold text-blue-600">±{expectedMovePercent.toFixed(2)}%</p>
                    <p className="text-lg text-gray-600 mt-1">±${expectedMoveDollars.toFixed(2)}</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm font-semibold text-gray-600 mb-1">Upper Target</p>
                    <p className="text-3xl font-bold text-green-600">${(price + expectedMoveDollars).toFixed(2)}</p>
                    <p className="text-sm text-gray-600 mt-1">+{expectedMovePercent.toFixed(2)}%</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm font-semibold text-gray-600 mb-1">Lower Target</p>
                    <p className="text-3xl font-bold text-red-600">${(price - expectedMoveDollars).toFixed(2)}</p>
                    <p className="text-sm text-gray-600 mt-1">-{expectedMovePercent.toFixed(2)}%</p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex gap-2">
                    <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-gray-700">
                      <p className="font-semibold mb-1">What is Expected Move?</p>
                      <p>
                        The expected move represents the market's prediction of how much the stock will move (up or
                        down) by expiration, based on the cost of an ATM straddle. This is derived from options pricing
                        and implied volatility.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* IV Crush Risk */}
            <Card className={`shadow-sm border-2 ${getRiskColor(ivCrushLevel)}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    IV Crush Risk Analysis
                  </span>
                  <span className="text-2xl font-bold">{ivCrushLevel}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Current IV</p>
                    <p className="text-2xl font-bold">{iv.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Historical IV</p>
                    <p className="text-2xl font-bold">{hv.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600">IV Premium</p>
                    <p className="text-2xl font-bold">{ivCrushRisk.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Days to Earnings</p>
                    <p className="text-2xl font-bold">{daysUntilEarnings > 0 ? daysUntilEarnings : "N/A"}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-current/20">
                  <p className="text-sm font-semibold mb-1">Recommendation:</p>
                  <p className="text-sm">{getRecommendation()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Breakeven Analysis */}
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="bg-gray-50 border-b border-gray-200">
                <CardTitle className="text-lg font-bold text-gray-900">Straddle & Strangle Breakevens</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {/* Straddle */}
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <h3 className="font-bold text-gray-900 mb-3">ATM Straddle (Strike: ${price.toFixed(2)})</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-600">Total Cost</p>
                        <p className="text-xl font-bold text-gray-900">${straddlePrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600">Upper Breakeven</p>
                        <p className="text-xl font-bold text-green-600">${straddleUpperBreakeven.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600">Lower Breakeven</p>
                        <p className="text-xl font-bold text-red-600">${straddleLowerBreakeven.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Strangle */}
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <h3 className="font-bold text-gray-900 mb-3">
                      Strangle (Call: ${callStrikeNum.toFixed(2)} | Put: ${putStrikeNum.toFixed(2)})
                    </h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-600">Total Cost</p>
                        <p className="text-xl font-bold text-gray-900">${stranglePrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600">Upper Breakeven</p>
                        <p className="text-xl font-bold text-green-600">${strangleUpperBreakeven.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600">Lower Breakeven</p>
                        <p className="text-xl font-bold text-red-600">${strangleLowerBreakeven.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-gray-700">
                      <p className="font-semibold mb-1">Post-Earnings IV Crush Warning</p>
                      <p>
                        After earnings, IV typically drops 30-70% within 24 hours. Long straddles/strangles can lose
                        significant value even if the stock moves as expected. Consider selling premium instead or using
                        spreads to limit vega exposure.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Educational Content */}
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="bg-gray-50 border-b border-gray-200">
                <CardTitle className="text-lg font-bold text-gray-900">Understanding Earnings Volatility</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3 text-sm text-gray-700">
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">What is IV Crush?</p>
                    <p>
                      IV Crush occurs when implied volatility drops sharply after an earnings announcement. Options lose
                      value rapidly as uncertainty is removed from the market, even if the stock moves significantly.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">Why Does It Happen?</p>
                    <p>
                      Before earnings, uncertainty drives up option prices (high IV). After the announcement,
                      uncertainty disappears, causing IV to collapse back to normal levels. This affects all options,
                      but especially ATM options.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">How to Trade Around Earnings:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>
                        <strong>Sell Premium:</strong> Benefit from IV crush by selling options before earnings
                      </li>
                      <li>
                        <strong>Use Spreads:</strong> Limit vega exposure with defined-risk strategies
                      </li>
                      <li>
                        <strong>Trade Post-Earnings:</strong> Wait for IV to normalize before entering long positions
                      </li>
                      <li>
                        <strong>Size Appropriately:</strong> Reduce position size during high IV periods
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </TooltipProvider>
  )
}
