"use client"

// Step 4: Technical Criteria card (RSI/Stochastic/ATR sliders + the six
// checkbox gates). JSX extracted verbatim from components/wheel-scanner.tsx
// (Phase 4 modularization — zero behavior change).

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Info, TrendingUp, CheckCircle2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface Step4TechnicalCardProps {
  maxRSI: number[]
  setMaxRSI: (value: number[]) => void
  maxStochastic: number[]
  setMaxStochastic: (value: number[]) => void
  minATR: number[]
  setMinATR: (value: number[]) => void
  maxATR: number[]
  setMaxATR: (value: number[]) => void
  requireBollingerBands: boolean
  setRequireBollingerBands: (value: boolean) => void
  requireAbove200SMA: boolean
  setRequireAbove200SMA: (value: boolean) => void
  requireAbove50SMA: boolean
  setRequireAbove50SMA: (value: boolean) => void
  requireGoldenCross: boolean
  setRequireGoldenCross: (value: boolean) => void
  requireMACDBullish: boolean
  setRequireMACDBullish: (value: boolean) => void
  requireRedDay: boolean
  setRequireRedDay: (value: boolean) => void
  tooltipsEnabled: boolean
}

export function Step4TechnicalCard({
  maxRSI,
  setMaxRSI,
  maxStochastic,
  setMaxStochastic,
  minATR,
  setMinATR,
  maxATR,
  setMaxATR,
  requireBollingerBands,
  setRequireBollingerBands,
  requireAbove200SMA,
  setRequireAbove200SMA,
  requireAbove50SMA,
  setRequireAbove50SMA,
  requireGoldenCross,
  setRequireGoldenCross,
  requireMACDBullish,
  setRequireMACDBullish,
  requireRedDay,
  setRequireRedDay,
  tooltipsEnabled,
}: Step4TechnicalCardProps) {
  return (
        <Card className="mt-8 w-full max-w-7xl mx-auto shadow-lg border-blue-200">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              TECHNICAL CRITERIA (Step 4)
            </CardTitle>
            <CardDescription>
              Adjust technical thresholds to relax or tighten entry criteria for optimal put-selling setups.
              {/* S-8. Two gates filter this step and have no control here. Stating
                  them is the honest half of the fix — a threshold the user cannot
                  see is still a threshold that removed rows from their results.
                  Sliders are the other half and are still open. */}
              <span className="block mt-2 text-xs text-amber-800">
                Two further gates are applied automatically and are not adjustable here: a minimum yield of{" "}
                <strong>1%</strong> and a minimum average volume of <strong>2M</strong> shares. Rows below either are
                filtered out of this step.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Technical Criteria Bullet Points */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-sm text-gray-900">TECHNICAL CRITERIA (Step 4)</span>
              </div>
              <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                <li>
                  <strong>
                    RSI {"<"} {maxRSI[0]}:
                  </strong>{" "}
                  Oversold conditions, potential for bounce (medium-term pullback setup)
                </li>
                <li>
                  <strong>100-day SMA:</strong> Price above 100-day SMA (long-term uptrend confirmed)
                </li>
                <li>
                  <strong>200-day SMA:</strong> Price above 200-day SMA (long-term uptrend confirmed)
                </li>
                <li>
                  <strong>50-day SMA:</strong> Price above 50-SMA (short-term strength)
                </li>
                <li>
                  <strong>MACD (12, 26, 9):</strong> MACD above signal line (bullish momentum)
                </li>
                <li>
                  <strong>
                    Stochastic (14) {"<"} {maxStochastic[0]}:
                  </strong>{" "}
                  Oversold signal, reversal potential
                </li>
                <li>
                  <strong>
                    ATR {minATR[0]}-{maxATR[0]}%:
                  </strong>{" "}
                  Moderate volatility for attractive premiums
                </li>
                <li>
                  <strong>Red Day Preferred:</strong> Stock down from previous close = optimal put-selling entry point
                </li>
              </ul>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Max RSI ({maxRSI[0]})
                  {tooltipsEnabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                        <p className="font-semibold mb-1">Max RSI (Relative Strength Index)</p>
                        <p className="text-sm mb-2">
                          <strong>What:</strong> Momentum oscillator measuring speed and magnitude of price changes
                          (0-100 scale).
                        </p>
                        <p className="text-sm mb-2">
                          <strong>Why Important:</strong> Identifies oversold/overbought conditions. Put sellers prefer
                          oversold stocks because they're more likely to bounce back (reducing assignment risk).
                        </p>
                        <p className="text-sm">
                          <strong>Lower (&lt;30):</strong> Only severely oversold stocks (best entry).{" "}
                          <strong>Higher (50-70):</strong> Includes neutral to overbought stocks (riskier for puts).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </Label>
                <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                      {maxRSI[0]}
                    </span>
                  </div>
                  <Slider
                    id="maxRSI"
                    value={maxRSI}
                    onValueChange={setMaxRSI}
                    min={20}
                    max={70}
                    step={1}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>20</span>
                    <span className="text-xs font-semibold">Oversold threshold</span>
                    <span>70</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Max Stochastic ({maxStochastic[0]})
                  {tooltipsEnabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                        <p className="font-semibold mb-1">Max Stochastic Oscillator</p>
                        <p className="text-sm mb-2">
                          <strong>What:</strong> Momentum indicator comparing closing price to price range over time
                          (0-100 scale).
                        </p>
                        <p className="text-sm mb-2">
                          <strong>Why Important:</strong> Helps identify oversold reversal opportunities. Lower values
                          suggest stock is oversold and likely to bounce.
                        </p>
                        <p className="text-sm">
                          <strong>Lower (&lt;20):</strong> Only deeply oversold stocks (strong bounce potential).{" "}
                          <strong>Higher (20-50):</strong> Includes moderately oversold to neutral conditions.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </Label>
                <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                      {maxStochastic[0]}
                    </span>
                  </div>
                  <Slider
                    id="maxStochastic"
                    value={maxStochastic}
                    onValueChange={setMaxStochastic}
                    min={10}
                    max={80}
                    step={1}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>10</span>
                    <span className="text-xs font-semibold">Oversold signal</span>
                    <span>80</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Min ATR %
                  {tooltipsEnabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                        <p className="font-semibold mb-1">Min ATR % (Average True Range)</p>
                        <p className="text-sm mb-2">
                          <strong>What:</strong> Volatility measure showing average daily price movement as percentage
                          of stock price.
                        </p>
                        <p className="text-sm mb-2">
                          <strong>Why Important:</strong> Higher volatility = higher option premiums. Put sellers need
                          minimum volatility to earn attractive premiums.
                        </p>
                        <p className="text-sm">
                          <strong>Lower (1%):</strong> Includes low-volatility stocks (lower premiums).{" "}
                          <strong>Higher (2-3%+):</strong> Only volatile stocks (best premiums).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </Label>
                <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                      {minATR[0]}%
                    </span>
                  </div>
                  <Slider
                    id="minATR"
                    value={minATR}
                    onValueChange={setMinATR}
                    min={0.5}
                    max={5}
                    step={0.1}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0.5%</span>
                    <span className="text-xs font-semibold">Min volatility</span>
                    <span>5%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Max ATR %
                  {tooltipsEnabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                        <p className="font-semibold mb-1">Max ATR % (Average True Range)</p>
                        <p className="text-sm mb-2">
                          <strong>What:</strong> Maximum daily volatility allowed, measured as percentage of stock
                          price.
                        </p>
                        <p className="text-sm mb-2">
                          <strong>Why Important:</strong> Too much volatility = excessive risk of large moves against
                          you. Limit max ATR to avoid wild, unpredictable stocks.
                        </p>
                        <p className="text-sm">
                          <strong>Lower (3-5%):</strong> Only moderate volatility stocks (safer).{" "}
                          <strong>Higher (10%+):</strong> Includes highly volatile stocks (higher risk/reward).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </Label>
                <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                      {maxATR[0]}%
                    </span>
                  </div>
                  <Slider
                    id="maxATR"
                    value={maxATR}
                    onValueChange={setMaxATR}
                    min={1}
                    max={15}
                    step={0.5}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1%</span>
                    <span className="text-xs font-semibold">Max volatility</span>
                    <span>15%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Technical Filters checkboxes */}
            <div className="space-y-3">
              <Label className="font-medium">Additional Technical Filters:</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    Bollinger Bands Setup
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">Bollinger Bands Setup</p>
                          <p className="text-sm">
                            Price is at or below the lower Bollinger Band (mean reversion setup). This suggests the
                            stock is oversold relative to its recent trading range and likely to bounce back, making it
                            an attractive put-selling entry point.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <input
                    id="bollingerToggle"
                    type="checkbox"
                    checked={requireBollingerBands}
                    onChange={(e) => setRequireBollingerBands(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    Above 200-day SMA
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">Above 200-day SMA</p>
                          <p className="text-sm">
                            Stock is trading above its 200-day simple moving average (long-term uptrend confirmation).
                            Indicates strong long-term momentum and reduces the risk of being assigned shares in a
                            declining stock.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <input
                    id="sma200Toggle"
                    type="checkbox"
                    checked={requireAbove200SMA}
                    onChange={(e) => setRequireAbove200SMA(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    Above 50-day SMA
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">Above 50-day SMA</p>
                          <p className="text-sm">
                            Stock is trading above its 50-day simple moving average (short-term strength). Confirms
                            recent positive momentum while still allowing for minor pullbacks that create put-selling
                            opportunities.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <input
                    id="sma50Toggle"
                    type="checkbox"
                    checked={requireAbove50SMA}
                    onChange={(e) => setRequireAbove50SMA(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    Golden Cross (50 &gt; 200)
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">Golden Cross (50 &gt; 200)</p>
                          <p className="text-sm">
                            The 50-day SMA has crossed above the 200-day SMA (bullish crossover signal). This indicates
                            a shift from downtrend to uptrend and is one of the most reliable long-term buy signals for
                            put sellers.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <input
                    id="goldenCrossToggle"
                    type="checkbox"
                    checked={requireGoldenCross}
                    onChange={(e) => setRequireGoldenCross(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    MACD Bullish Signal
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">MACD Bullish Signal</p>
                          <p className="text-sm">
                            The MACD line is above the signal line (bullish momentum). This indicates that short-term
                            momentum is stronger than longer-term momentum, suggesting continued upward price movement.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <input
                    id="macdToggle"
                    type="checkbox"
                    checked={requireMACDBullish}
                    onChange={(e) => setRequireMACDBullish(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    Red Day Preferred
                    {tooltipsEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                          <p className="font-semibold mb-1">Red Day Preferred</p>
                          <p className="text-sm">
                            Stock is down from its previous close (optimal put-selling entry point). Selling puts on red
                            days allows you to collect premium when fear is elevated, then potentially profit as the
                            stock recovers.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </Label>
                  <input
                    id="redDayToggle"
                    type="checkbox"
                    checked={requireRedDay}
                    onChange={(e) => setRequireRedDay(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
  )
}
