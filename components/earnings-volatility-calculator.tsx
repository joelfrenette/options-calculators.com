"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, TrendingUp, Info } from "lucide-react"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

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

  const InfoTooltip = ({ content }: { content: string }) => {
    if (!tooltipsEnabled) return null
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-gray-400 cursor-help inline ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-white text-gray-900 border shadow-lg p-3 z-50">
          <p className="text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Input Section */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Earnings Volatility Analysis
              <InfoTooltip content="This calculator helps you understand how much a stock might move around earnings and whether options are overpriced. It shows the 'expected move' (how far the market thinks the stock will go) and 'IV crush risk' (how much option value you might lose after the announcement)." />
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
                  <Label htmlFor="ticker" className="text-sm font-semibold text-gray-700 flex items-center">
                    Ticker Symbol
                    <InfoTooltip content="Enter the stock symbol you're analyzing for earnings. Examples: AAPL, TSLA, NVDA" />
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
                  <Label htmlFor="stockPrice" className="text-sm font-semibold text-gray-700 flex items-center">
                    Current Stock Price ($)
                    <InfoTooltip content="The current trading price of the stock. This is used to calculate breakeven points and expected move percentages." />
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
                  <Label htmlFor="earningsDate" className="text-sm font-semibold text-gray-700 flex items-center">
                    Earnings Date
                    <InfoTooltip content="When the company reports earnings. Options lose most of their IV premium immediately after this date (IV crush)." />
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
                  <Label htmlFor="currentIV" className="text-sm font-semibold text-gray-700 flex items-center">
                    Current IV (%)
                    <InfoTooltip content="Current Implied Volatility - how expensive options are right now. Before earnings, IV typically spikes 20-50% above normal as traders price in the expected move." />
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
                  <Label htmlFor="historicalIV" className="text-sm font-semibold text-gray-700 flex items-center">
                    Historical IV (%)
                    <InfoTooltip content="The 'normal' IV level for this stock when there's no earnings event. After earnings, IV typically crashes back to this level within hours. The difference between Current IV and Historical IV is your 'crush risk'." />
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
                  <Label htmlFor="atmCallPrice" className="text-sm font-semibold text-gray-700 flex items-center">
                    ATM Call Price ($)
                    <InfoTooltip content="Price of an at-the-money call option (strike = stock price). Combined with the put price, this tells us how big a move the market expects." />
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
                  <Label htmlFor="atmPutPrice" className="text-sm font-semibold text-gray-700 flex items-center">
                    ATM Put Price ($)
                    <InfoTooltip content="Price of an at-the-money put option (strike = stock price). Combined with the call price, this tells us the expected move the market is pricing in." />
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
                      <Label htmlFor="callStrike" className="text-sm font-semibold text-gray-700 flex items-center">
                        Call Strike ($)
                        <InfoTooltip content="Enter the strike price for the call option. This is used to calculate the strangle breakeven points." />
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
                      <Label htmlFor="putStrike" className="text-sm font-semibold text-gray-700 flex items-center">
                        Put Strike ($)
                        <InfoTooltip content="Enter the strike price for the put option. This is used to calculate the strangle breakeven points." />
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
                  <InfoTooltip content="The 'expected move' is how far the market thinks the stock will move by expiration. It's calculated from the straddle price. If the stock moves MORE than this amount, buying options could be profitable. If it moves LESS, selling options wins." />
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-semibold text-gray-600 mb-1 flex items-center justify-center">
                      Expected Move
                      <InfoTooltip content="The market's prediction of the stock's price range by expiration. The stock could move this much in either direction. Calculated as: (Call + Put Price) ÷ Stock Price × 100" />
                    </p>
                    <p className="text-3xl font-bold text-blue-600">±{expectedMovePercent.toFixed(2)}%</p>
                    <p className="text-lg text-gray-600 mt-1">±${expectedMoveDollars.toFixed(2)}</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm font-semibold text-gray-600 mb-1 flex items-center justify-center">
                      Upper Target
                      <InfoTooltip content="If the stock rallies, this is where the market expects it could reach. To profit from buying calls, the stock needs to close ABOVE this price by expiration." />
                    </p>
                    <p className="text-3xl font-bold text-green-600">${(price + expectedMoveDollars).toFixed(2)}</p>
                    <p className="text-sm text-gray-600 mt-1">+{expectedMovePercent.toFixed(2)}%</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm font-semibold text-gray-600 mb-1 flex items-center justify-center">
                      Lower Target
                      <InfoTooltip content="If the stock drops, this is where the market expects it could fall to. To profit from buying puts, the stock needs to close BELOW this price by expiration." />
                    </p>
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
                    <InfoTooltip content="IV Crush is when implied volatility drops sharply after an event like earnings. If you BUY options before earnings, you lose money from IV crush even if you're right about direction. Higher IV crush risk = more dangerous to buy options." />
                  </span>
                  <span className="text-2xl font-bold">{ivCrushLevel}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 flex items-center">
                      Current IV
                      <InfoTooltip content="Today's implied volatility - elevated because of the upcoming earnings event. This is what you pay when buying options now." />
                    </p>
                    <p className="text-2xl font-bold">{iv.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 flex items-center">
                      Historical IV
                      <InfoTooltip content="The 'normal' IV level for this stock. After earnings, IV typically crashes to this level within hours, destroying option value." />
                    </p>
                    <p className="text-2xl font-bold">{hv.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 flex items-center">
                      IV Premium
                      <InfoTooltip content="How much 'extra' IV is priced in for earnings. This is the percentage above normal that you're paying. After earnings, this premium disappears immediately (IV crush)." />
                    </p>
                    <p className="text-2xl font-bold">{ivCrushRisk.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 flex items-center">
                      Days to Earnings
                      <InfoTooltip content="How many days until the earnings announcement. IV typically builds leading up to earnings and collapses the moment results are announced." />
                    </p>
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
