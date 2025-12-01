"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DollarSign, Calendar, TrendingUp, BarChart3, Info } from "lucide-react"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

export function RiskRewardCalculator() {
  const [premium, setPremium] = useState<string>("500")
  const [capitalAtRisk, setCapitalAtRisk] = useState<string>("10000")
  const [daysToExpiration, setDaysToExpiration] = useState<string>("45")
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  const premiumNum = Number.parseFloat(premium) || 0
  const capitalNum = Number.parseFloat(capitalAtRisk) || 0
  const daysNum = Number.parseFloat(daysToExpiration) || 0

  // Calculate metrics
  const rawROI = capitalNum > 0 ? (premiumNum / capitalNum) * 100 : 0
  const annualizedROI = daysNum > 0 ? rawROI * (365 / daysNum) : 0
  const riskRewardRatio = premiumNum > 0 ? capitalNum / premiumNum : 0

  // Benchmark comparisons
  const spyAnnualReturn = 10
  const dividendETFReturn = 4

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
        {/* Input Card */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Trade Information
              <InfoTooltip content="This calculator helps you evaluate if a trade is worth taking. Enter the premium you'll collect, how much capital you're risking, and how long until expiration. It will show you the ROI compared to just buying index funds." />
            </CardTitle>
            {/* Header Actions */}
            <div className="flex gap-2">
              <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
              <RefreshButton />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="premium" className="text-sm font-semibold text-gray-700 flex items-center">
                  Premium Received
                  <InfoTooltip content="The credit (money) you collect when selling options. This is your maximum profit if the options expire worthless. Example: Selling a put spread for $2.00 credit = $200 premium received per contract." />
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
                <Label htmlFor="capital" className="text-sm font-semibold text-gray-700 flex items-center">
                  Capital at Risk
                  <InfoTooltip content="The maximum amount you could lose on this trade. For credit spreads: (Width of strikes - Premium) × 100. For cash-secured puts: Strike price × 100. This is the money your broker holds as collateral." />
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
                <Label htmlFor="days" className="text-sm font-semibold text-gray-700 flex items-center">
                  Days Until Expiration
                  <InfoTooltip content="How many days until the options expire. Shorter timeframes (30-45 days) have faster theta decay but less room for error. This is used to calculate your annualized return for comparison to other investments." />
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
                <InfoTooltip content="Return on Investment (ROI) tells you how much you're making relative to what you're risking. Higher ROI is better, but compare to the risk involved and alternative investments like index funds." />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left Column - ROI Metrics */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1 flex items-center">
                      Raw ROI
                      <InfoTooltip content="Your return for THIS specific trade. Calculated as: (Premium ÷ Capital at Risk) × 100. This tells you what percentage you're making on the money tied up in this trade." />
                    </p>
                    <p className="text-3xl font-bold text-gray-900">{rawROI.toFixed(2)}%</p>
                    <p className="text-xs text-gray-500 mt-1">Return on capital for this trade</p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1 flex items-center">
                      Annualized ROI
                      <InfoTooltip content="If you could repeat this exact trade all year, this is your yearly return. Calculated as: Raw ROI × (365 ÷ Days). Use this to compare options income to other investments like stocks or bonds." />
                    </p>
                    <p className="text-3xl font-bold text-primary">{annualizedROI.toFixed(2)}%</p>
                    <p className="text-xs text-gray-500 mt-1">Projected annual return at this rate</p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1 flex items-center">
                      Risk/Reward Ratio
                      <InfoTooltip content="How much you're risking to make $1. A ratio of 20:1 means you're risking $20 to make $1. Lower ratios are better - but lower ratios usually mean lower probability trades. Most credit spreads are 3:1 to 10:1." />
                    </p>
                    <p className="text-3xl font-bold text-gray-900">{riskRewardRatio.toFixed(2)}:1</p>
                    <p className="text-xs text-gray-500 mt-1">Capital at risk per dollar earned</p>
                  </div>
                </div>

                {/* Right Column - Benchmarks & Quality */}
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg ${tradeQuality.bg} border border-gray-200`}>
                    <p className="text-sm font-semibold text-gray-600 mb-1 flex items-center">
                      Trade Quality
                      <InfoTooltip content="A quick assessment of whether this trade is worth your time and risk. Excellent (20%+) means outstanding risk-adjusted returns. Poor (<5%) means you might be better off in index funds." />
                    </p>
                    <p className={`text-2xl font-bold ${tradeQuality.color}`}>{tradeQuality.label}</p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Benchmark Comparison
                      <InfoTooltip content="Compare your trade's annualized return to passive investments. If you can't beat index funds, why take the extra risk and effort of options trading?" />
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
                <p className="text-sm font-semibold text-blue-900 mb-1 flex items-center">
                  Trade Insight
                  <InfoTooltip content="This is an AI-generated recommendation based on your trade's risk/reward profile compared to passive investing alternatives." />
                </p>
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
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center">
              ROI Benchmarks & Guidelines
              <InfoTooltip content="Use these benchmarks to quickly evaluate if a trade is worth taking. Remember: higher returns usually mean higher risk. These are annualized returns for comparison." />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded border border-green-200">
                <div className="flex-1">
                  <p className="font-semibold text-green-900 flex items-center">
                    Excellent (20%+ annualized)
                    <InfoTooltip content="Outstanding returns that far exceed passive investing. These trades are typically found during high IV environments or with higher-risk strategies. Worth taking if probability of profit is acceptable." />
                  </p>
                  <p className="text-sm text-green-800">
                    Outstanding returns. Execute with confidence if risk is acceptable.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded border border-blue-200">
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 flex items-center">
                    Good (10-20% annualized)
                    <InfoTooltip content="Solid returns that beat the S&P 500 average. This is the 'sweet spot' for most premium sellers - good returns without excessive risk. The bread and butter of options income." />
                  </p>
                  <p className="text-sm text-blue-800">
                    Solid returns that match or beat market averages. Worth considering.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                <div className="flex-1">
                  <p className="font-semibold text-yellow-900 flex items-center">
                    Fair (5-10% annualized)
                    <InfoTooltip content="Modest returns that may or may not beat index funds after commissions and effort. Consider if the work and risk is worth only matching passive returns. Might be better opportunities elsewhere." />
                  </p>
                  <p className="text-sm text-yellow-800">Modest returns. Evaluate alternatives and risk carefully.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-red-50 rounded border border-red-200">
                <div className="flex-1">
                  <p className="font-semibold text-red-900 flex items-center">
                    Poor (&lt;5% annualized)
                    <InfoTooltip content="Below-market returns. You're taking on options risk for less than you could make in a savings account or bond fund. Unless there's a specific strategic reason, skip this trade and find a better opportunity." />
                  </p>
                  <p className="text-sm text-red-800">
                    Below market returns. Consider if this trade is worth the risk and effort.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
