"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DollarSign, Calendar, TrendingUp, BarChart3 } from "lucide-react"

export function RiskRewardCalculator() {
  const [premium, setPremium] = useState<string>("500")
  const [capitalAtRisk, setCapitalAtRisk] = useState<string>("10000")
  const [daysToExpiration, setDaysToExpiration] = useState<string>("45")

  const premiumNum = Number.parseFloat(premium) || 0
  const capitalNum = Number.parseFloat(capitalAtRisk) || 0
  const daysNum = Number.parseFloat(daysToExpiration) || 0

  // Calculate metrics
  const rawROI = capitalNum > 0 ? (premiumNum / capitalNum) * 100 : 0
  const annualizedROI = daysNum > 0 ? rawROI * (365 / daysNum) : 0
  const riskRewardRatio = premiumNum > 0 ? capitalNum / premiumNum : 0

  // Benchmark comparisons
  const spyAnnualReturn = 10 // Historical SPY average
  const dividendETFReturn = 4 // Typical dividend ETF return

  const vsSpyDiff = annualizedROI - spyAnnualReturn
  const vsDividendDiff = annualizedROI - dividendETFReturn

  const getTradeQuality = () => {
    if (annualizedROI >= 20) return { label: "Excellent", color: "text-green-600", bg: "bg-green-50" }
    if (annualizedROI >= 15) return { label: "Very Good", color: "text-green-600", bg: "bg-green-50" }
    if (annualizedROI >= 10) return { label: "Good", color: "text-blue-600", bg: "bg-blue-50" }
    if (annualizedROI >= 5) return { label: "Fair", color: "text-yellow-600", bg: "bg-yellow-50" }
    return { label: "Poor", color: "text-red-600", bg: "bg-red-50" }
  }

  const tradeQuality = getTradeQuality()

  return (
    <div className="space-y-4">
      {/* Input Card */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Trade Information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="premium" className="text-sm font-semibold text-gray-700">
                Premium Received
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  id="premium"
                  type="number"
                  value={premium}
                  onChange={(e) => setPremium(e.target.value)}
                  className="pl-7 border-gray-300"
                  placeholder="500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capital" className="text-sm font-semibold text-gray-700">
                Capital at Risk
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  id="capital"
                  type="number"
                  value={capitalAtRisk}
                  onChange={(e) => setCapitalAtRisk(e.target.value)}
                  className="pl-7 border-gray-300"
                  placeholder="10000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="days" className="text-sm font-semibold text-gray-700">
                Days Until Expiration
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="days"
                  type="number"
                  value={daysToExpiration}
                  onChange={(e) => setDaysToExpiration(e.target.value)}
                  className="pl-10 border-gray-300"
                  placeholder="45"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Card */}
      {premiumNum > 0 && capitalNum > 0 && daysNum > 0 && (
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              ROI Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Column - ROI Metrics */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Raw ROI</p>
                  <p className="text-3xl font-bold text-gray-900">{rawROI.toFixed(2)}%</p>
                  <p className="text-xs text-gray-500 mt-1">Return on capital for this trade</p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Annualized ROI</p>
                  <p className="text-3xl font-bold text-primary">{annualizedROI.toFixed(2)}%</p>
                  <p className="text-xs text-gray-500 mt-1">Projected annual return at this rate</p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Risk/Reward Ratio</p>
                  <p className="text-3xl font-bold text-gray-900">{riskRewardRatio.toFixed(2)}:1</p>
                  <p className="text-xs text-gray-500 mt-1">Capital at risk per dollar earned</p>
                </div>
              </div>

              {/* Right Column - Benchmarks & Quality */}
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${tradeQuality.bg} border border-gray-200`}>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Trade Quality</p>
                  <p className={`text-2xl font-bold ${tradeQuality.color}`}>{tradeQuality.label}</p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Benchmark Comparison
                  </p>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">vs SPY (10% avg)</p>
                      <p className="text-xs text-gray-500">S&P 500 Index Fund</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${vsSpyDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {vsSpyDiff >= 0 ? "+" : ""}
                        {vsSpyDiff.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">vs Dividend ETFs (4% avg)</p>
                      <p className="text-xs text-gray-500">High Dividend Funds</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${vsDividendDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {vsDividendDiff >= 0 ? "+" : ""}
                        {vsDividendDiff.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Insight */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-1">Trade Insight</p>
              <p className="text-sm text-blue-800">
                {annualizedROI >= 15
                  ? "This trade offers excellent returns compared to passive investing. Strong candidate for execution."
                  : annualizedROI >= 10
                    ? "This trade matches or exceeds market returns. Consider your risk tolerance and portfolio allocation."
                    : annualizedROI >= 5
                      ? "This trade offers modest returns. Evaluate if the risk justifies the reward compared to alternatives."
                      : "This trade underperforms typical market returns. Consider if there are better opportunities available."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reference Guide */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-900">ROI Benchmarks & Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded border border-green-200">
              <div className="flex-1">
                <p className="font-semibold text-green-900">Excellent (20%+ annualized)</p>
                <p className="text-sm text-green-800">
                  Outstanding returns. Execute with confidence if risk is acceptable.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded border border-blue-200">
              <div className="flex-1">
                <p className="font-semibold text-blue-900">Good (10-20% annualized)</p>
                <p className="text-sm text-blue-800">
                  Solid returns that match or beat market averages. Worth considering.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded border border-yellow-200">
              <div className="flex-1">
                <p className="font-semibold text-yellow-900">Fair (5-10% annualized)</p>
                <p className="text-sm text-yellow-800">Modest returns. Evaluate alternatives and risk carefully.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-red-50 rounded border border-red-200">
              <div className="flex-1">
                <p className="font-semibold text-red-900">Poor (&lt;5% annualized)</p>
                <p className="text-sm text-red-800">
                  Below market returns. Consider if this trade is worth the risk and effort.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
