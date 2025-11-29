"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Info, TrendingUp, Activity } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"

// Black-Scholes Greeks calculations
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - prob : prob
}

function normalPDF(x: number): number {
  return Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI)
}

function calculateGreeks(
  stockPrice: number,
  strikePrice: number,
  timeToExpiration: number,
  volatility: number,
  riskFreeRate: number,
  optionType: "call" | "put",
) {
  const T = timeToExpiration / 365
  const S = stockPrice
  const K = strikePrice
  const sigma = volatility / 100
  const r = riskFreeRate / 100

  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)

  // Delta
  const delta = optionType === "call" ? normalCDF(d1) : normalCDF(d1) - 1

  // Gamma (same for calls and puts)
  const gamma = normalPDF(d1) / (S * sigma * Math.sqrt(T))

  // Theta (per day)
  const thetaCall = ((-S * normalPDF(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normalCDF(d2)) / 365
  const thetaPut = ((-S * normalPDF(d1) * sigma) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * normalCDF(-d2)) / 365
  const theta = optionType === "call" ? thetaCall : thetaPut

  // Vega (per 1% change in IV)
  const vega = (S * normalPDF(d1) * Math.sqrt(T)) / 100

  // Rho (per 1% change in interest rate)
  const rhoCall = (K * T * Math.exp(-r * T) * normalCDF(d2)) / 100
  const rhoPut = (-K * T * Math.exp(-r * T) * normalCDF(-d2)) / 100
  const rho = optionType === "call" ? rhoCall : rhoPut

  return { delta, gamma, theta, vega, rho }
}

const STRATEGY_RECOMMENDATIONS = [
  {
    name: "Buying Deep ITM LEAPS",
    description: "Long-term bullish position with high delta exposure",
    targets: { delta: { min: 0.7, max: 0.9, optimal: 0.8 } },
    explanation:
      "High delta (70-90) ensures the LEAP moves nearly 1:1 with the stock, providing stock-like exposure with less capital. This maximizes directional profit while maintaining leverage.",
  },
  {
    name: "Selling Calls on PMCC",
    description: "Poor Man's Covered Call - selling short-term calls against LEAPS",
    targets: { delta: { min: 0.15, max: 0.25, optimal: 0.2 } },
    explanation:
      "Low delta (≤20) on short calls reduces assignment risk while collecting premium. This keeps the probability of the call expiring worthless high (~80%), protecting your LEAP.",
  },
  {
    name: "Selling Cash-Secured Puts",
    description: "Income generation with potential stock acquisition",
    targets: { delta: { min: 0.25, max: 0.35, optimal: 0.3 } },
    explanation:
      "Delta around 30 provides a good balance: ~70% probability of profit while collecting meaningful premium. If assigned, you acquire stock at a price you're comfortable with.",
  },
  {
    name: "Selling Credit Spreads",
    description: "Defined-risk premium collection strategy",
    targets: { delta: { min: 0.15, max: 0.3, optimal: 0.2 } },
    explanation:
      "Delta 15-30 on the short leg offers high probability of profit (70-85%) while keeping risk defined. Lower delta = higher win rate but lower premium.",
  },
  {
    name: "Buying ATM/Slightly OTM Calls",
    description: "Directional speculation with leverage",
    targets: { delta: { min: 0.45, max: 0.6, optimal: 0.5 } },
    explanation:
      "Delta around 50 (ATM) provides balanced leverage and time value. Each $1 move in stock = ~$0.50 move in option, with reasonable premium cost.",
  },
  {
    name: "Theta Decay Strategies",
    description: "Selling options to profit from time decay",
    targets: { theta: { min: -0.1, max: -0.02, optimal: -0.05 } },
    explanation:
      "Higher absolute theta means faster time decay. Selling options with theta around -0.05 means collecting ~$5/day per contract as time passes.",
  },
]

const GREEK_INFO = {
  delta: {
    name: "Delta (Δ)",
    description: "Rate of change in option price per $1 change in stock price",
    interpretation:
      "Delta of 0.30 means option price changes by $0.30 for every $1 stock move. Also represents approximate probability of expiring ITM.",
    range: "Calls: 0 to 1.0 | Puts: -1.0 to 0",
  },
  gamma: {
    name: "Gamma (Γ)",
    description: "Rate of change in delta per $1 change in stock price",
    interpretation:
      "Gamma of 0.05 means delta increases by 0.05 for every $1 stock move. High gamma = delta changes rapidly (good for buyers, risky for sellers).",
    range: "Always positive, peaks at ATM",
  },
  theta: {
    name: "Theta (Θ)",
    description: "Rate of time decay - option value lost per day",
    interpretation:
      "Theta of -0.05 means option loses $5 in value per day (all else equal). Accelerates as expiration approaches. Negative for buyers, positive for sellers.",
    range: "Negative for long positions",
  },
  vega: {
    name: "Vega (ν)",
    description: "Sensitivity to 1% change in implied volatility",
    interpretation:
      "Vega of 0.15 means option price changes by $15 for every 1% change in IV. High vega = more sensitive to volatility changes.",
    range: "Always positive, peaks at ATM",
  },
  rho: {
    name: "Rho (ρ)",
    description: "Sensitivity to 1% change in interest rates",
    interpretation:
      "Rho of 0.10 means option price changes by $10 for every 1% change in interest rates. Usually least important Greek for short-term trades.",
    range: "Calls: positive | Puts: negative",
  },
}

function getGreekColor(greek: string, value: number, optionType: string): string {
  if (greek === "delta") {
    const absValue = Math.abs(value)
    if (absValue >= 0.7) return "text-green-600 bg-green-50"
    if (absValue >= 0.5) return "text-blue-600 bg-blue-50"
    if (absValue >= 0.3) return "text-yellow-600 bg-yellow-50"
    return "text-gray-600 bg-gray-50"
  }
  if (greek === "gamma") {
    if (value >= 0.05) return "text-red-600 bg-red-50"
    if (value >= 0.02) return "text-yellow-600 bg-yellow-50"
    return "text-green-600 bg-green-50"
  }
  if (greek === "theta") {
    const absValue = Math.abs(value)
    if (absValue >= 0.1) return "text-red-600 bg-red-50"
    if (absValue >= 0.05) return "text-yellow-600 bg-yellow-50"
    return "text-green-600 bg-green-50"
  }
  if (greek === "vega") {
    if (value >= 0.2) return "text-purple-600 bg-purple-50"
    if (value >= 0.1) return "text-blue-600 bg-blue-50"
    return "text-gray-600 bg-gray-50"
  }
  return "text-gray-600 bg-gray-50"
}

export function GreeksCalculator() {
  const [stockPrice, setStockPrice] = useState("100")
  const [strikePrice, setStrikePrice] = useState("100")
  const [daysToExpiration, setDaysToExpiration] = useState("30")
  const [impliedVolatility, setImpliedVolatility] = useState("30")
  const [optionType, setOptionType] = useState<"call" | "put">("put")
  const [greeks, setGreeks] = useState<any>(null)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  useEffect(() => {
    const stock = Number.parseFloat(stockPrice) || 0
    const strike = Number.parseFloat(strikePrice) || 0
    const days = Number.parseFloat(daysToExpiration) || 0
    const iv = Number.parseFloat(impliedVolatility) || 0

    if (stock > 0 && strike > 0 && days > 0 && iv > 0) {
      const calculated = calculateGreeks(stock, strike, days, iv, 4.5, optionType)
      setGreeks(calculated)
    }
  }, [stockPrice, strikePrice, daysToExpiration, impliedVolatility, optionType])

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Option Parameters
          </CardTitle>
          <div className="flex items-center gap-2">
            <TooltipsToggle enabled={tooltipsEnabled} onToggle={() => setTooltipsEnabled(!tooltipsEnabled)} />
            <RefreshButton
              onClick={() => {
                /* Refresh logic here */
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock-price">Stock Price ($)</Label>
              <Input
                id="stock-price"
                type="number"
                value={stockPrice}
                onChange={(e) => setStockPrice(e.target.value)}
                placeholder="100.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="strike-price">Strike Price ($)</Label>
              <Input
                id="strike-price"
                type="number"
                value={strikePrice}
                onChange={(e) => setStrikePrice(e.target.value)}
                placeholder="100.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="days">Days to Expiration</Label>
              <Input
                id="days"
                type="number"
                value={daysToExpiration}
                onChange={(e) => setDaysToExpiration(e.target.value)}
                placeholder="30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="iv">Implied Volatility (%)</Label>
              <Input
                id="iv"
                type="number"
                value={impliedVolatility}
                onChange={(e) => setImpliedVolatility(e.target.value)}
                placeholder="30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="option-type">Option Type</Label>
              <Select value={optionType} onValueChange={(value: "call" | "put") => setOptionType(value)}>
                <SelectTrigger id="option-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="put">Put</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {greeks && (
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-900">Calculated Greeks</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {tooltipsEnabled && <TooltipProvider />}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Delta */}
              <div className={`p-4 rounded-lg border-2 ${getGreekColor("delta", greeks.delta, optionType)}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{GREEK_INFO.delta.name}</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold mb-1">{GREEK_INFO.delta.description}</p>
                      <p className="text-sm mb-1">{GREEK_INFO.delta.interpretation}</p>
                      <p className="text-xs text-gray-500">{GREEK_INFO.delta.range}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-3xl font-bold">{greeks.delta.toFixed(3)}</div>
                <div className="text-sm mt-1">~{Math.abs(greeks.delta * 100).toFixed(0)}% probability ITM</div>
              </div>

              {/* Gamma */}
              <div className={`p-4 rounded-lg border-2 ${getGreekColor("gamma", greeks.gamma, optionType)}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{GREEK_INFO.gamma.name}</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold mb-1">{GREEK_INFO.gamma.description}</p>
                      <p className="text-sm mb-1">{GREEK_INFO.gamma.interpretation}</p>
                      <p className="text-xs text-gray-500">{GREEK_INFO.gamma.range}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-3xl font-bold">{greeks.gamma.toFixed(4)}</div>
                <div className="text-sm mt-1">
                  {greeks.gamma >= 0.05 ? "High risk" : greeks.gamma >= 0.02 ? "Moderate" : "Low risk"}
                </div>
              </div>

              {/* Theta */}
              <div className={`p-4 rounded-lg border-2 ${getGreekColor("theta", greeks.theta, optionType)}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{GREEK_INFO.theta.name}</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold mb-1">{GREEK_INFO.theta.description}</p>
                      <p className="text-sm mb-1">{GREEK_INFO.theta.interpretation}</p>
                      <p className="text-xs text-gray-500">{GREEK_INFO.theta.range}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-3xl font-bold">{greeks.theta.toFixed(4)}</div>
                <div className="text-sm mt-1">${(greeks.theta * 100).toFixed(2)}/day per contract</div>
              </div>

              {/* Vega */}
              <div className={`p-4 rounded-lg border-2 ${getGreekColor("vega", greeks.vega, optionType)}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{GREEK_INFO.vega.name}</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold mb-1">{GREEK_INFO.vega.description}</p>
                      <p className="text-sm mb-1">{GREEK_INFO.vega.interpretation}</p>
                      <p className="text-xs text-gray-500">{GREEK_INFO.vega.range}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-3xl font-bold">{greeks.vega.toFixed(4)}</div>
                <div className="text-sm mt-1">${(greeks.vega * 100).toFixed(2)} per 1% IV change</div>
              </div>

              {/* Rho */}
              <div className="p-4 rounded-lg border-2 text-gray-600 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{GREEK_INFO.rho.name}</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold mb-1">{GREEK_INFO.rho.description}</p>
                      <p className="text-sm mb-1">{GREEK_INFO.rho.interpretation}</p>
                      <p className="text-xs text-gray-500">{GREEK_INFO.rho.range}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-3xl font-bold">{greeks.rho.toFixed(4)}</div>
                <div className="text-sm mt-1">${(greeks.rho * 100).toFixed(2)} per 1% rate change</div>
              </div>
            </div>
            {tooltipsEnabled && <TooltipProvider />}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Strategy Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-4">
            {STRATEGY_RECOMMENDATIONS.map((strategy, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-primary transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-gray-900">{strategy.name}</h3>
                    <p className="text-sm text-gray-600">{strategy.description}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {strategy.targets.delta && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-blue-900">Target Delta:</span>
                        <span className="text-blue-700 font-bold">
                          {strategy.targets.delta.min.toFixed(2)} - {strategy.targets.delta.max.toFixed(2)} (Optimal:{" "}
                          {strategy.targets.delta.optimal.toFixed(2)})
                        </span>
                      </div>
                      <p className="text-sm text-blue-800">{strategy.explanation}</p>
                    </div>
                  )}
                  {strategy.targets.theta && (
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-green-900">Target Theta:</span>
                        <span className="text-green-700 font-bold">
                          {strategy.targets.theta.min.toFixed(2)} to {strategy.targets.theta.max.toFixed(2)} (Optimal:{" "}
                          {strategy.targets.theta.optimal.toFixed(2)})
                        </span>
                      </div>
                      <p className="text-sm text-green-800">{strategy.explanation}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
