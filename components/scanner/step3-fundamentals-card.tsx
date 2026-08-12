"use client"

// Step 3: Fundamental Criteria card (sliders for D/E, ROE, profitable quarters,
// market-cap floor). JSX extracted verbatim from components/wheel-scanner.tsx
// (Phase 4 modularization — zero behavior change).

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Info, BarChart3 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PRE_FILTER_MARKET_CAP_TIERS } from "./constants"
import { stepTitled, stepLabel } from "./steps"

interface Step3FundamentalsCardProps {
  maxDebtToEquity: number[]
  setMaxDebtToEquity: (value: number[]) => void
  minROE: number[]
  setMinROE: (value: number[]) => void
  minProfitableQuarters: number[]
  setMinProfitableQuarters: (value: number[]) => void
  minMarketCapCategory: number[]
  setMinMarketCapCategory: (value: number[]) => void
  tooltipsEnabled: boolean
}

export function Step3FundamentalsCard({
  maxDebtToEquity,
  setMaxDebtToEquity,
  minROE,
  setMinROE,
  minProfitableQuarters,
  setMinProfitableQuarters,
  minMarketCapCategory,
  setMinMarketCapCategory,
  tooltipsEnabled,
}: Step3FundamentalsCardProps) {
  return (
        <Card className="mt-8 w-full max-w-7xl mx-auto shadow-lg border-2 border-blue-300">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-700" />
              <CardTitle className="text-xl font-bold">{stepTitled("fundamentals", "FUNDAMENTAL CRITERIA")}</CardTitle>
            </div>
            <CardDescription>
              Using Polygon quarterly filings for real fundamental metrics. All slider filters are applied with live
              data.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-1 mb-6 text-sm text-gray-700">
              <li>
                <strong>Debt-to-Equity:</strong> Max {maxDebtToEquity[0]} (healthy leverage - adjustable below)
              </li>
              <li>
                <strong>ROE:</strong> Min {minROE[0]}% (efficient profit generation - adjustable below)
              </li>
              <li>
                <strong>Profitable Quarters:</strong> Min {minProfitableQuarters[0]} consecutive quarters (
                {minProfitableQuarters[0] === 0 ? "no filter" : "consistent profitability"} - adjustable below)
              </li>
              <li>
                <strong>Min Market Cap:</strong>{" "}
                {PRE_FILTER_MARKET_CAP_TIERS[minMarketCapCategory[0]]?.label ?? "Any"} company size floor (adjustable
                below)
              </li>
            </ul>

            {/* Step 3 Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Max Debt/Eq
                  {tooltipsEnabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                        <p className="font-semibold mb-1">Debt-to-Equity Ratio</p>
                        <p className="text-xs mb-2">
                          <strong>What:</strong> Measures how much debt a company has relative to shareholder equity.
                          Calculated as Total Debt ÷ Total Equity.
                        </p>
                        <p className="text-xs mb-2">
                          <strong>Why Important:</strong> Companies with lower debt are more financially stable and less
                          likely to face distress during downturns. Safer for put selling since you want to avoid
                          assignment on troubled stocks.
                        </p>
                        <p className="text-xs">
                          <strong>Lower:</strong> Only financially conservative companies (safer).{" "}
                          <strong>Higher:</strong> Includes more leveraged companies (potentially riskier).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </Label>
                <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                      {maxDebtToEquity[0]}
                    </span>
                  </div>
                  <Slider
                    id="maxDebtToEquity"
                    value={maxDebtToEquity}
                    onValueChange={setMaxDebtToEquity}
                    min={0.5}
                    max={3}
                    step={0.1}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0.5</span>
                    <span className="text-xs font-semibold">Financial strength</span>
                    <span>3.0</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Min ROE %
                  {tooltipsEnabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                        <p className="font-semibold mb-1">Return on Equity (ROE %)</p>
                        <p className="text-xs mb-2">
                          <strong>What:</strong> Net income generated per dollar of shareholder equity. Calculated as
                          Net Income ÷ Shareholders' Equity.
                        </p>
                        <p className="text-xs mb-2">
                          <strong>Why Important:</strong> Measures how efficiently management uses your capital to
                          generate profits. Higher ROE = better quality company = lower assignment risk.
                        </p>
                        <p className="text-xs">
                          <strong>Lower (10%):</strong> Includes profitable but mediocre companies.{" "}
                          <strong>Higher (20%+):</strong> Only exceptional profit generators.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </Label>
                <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                      {minROE[0]}%
                    </span>
                  </div>
                  <Slider
                    id="minROE"
                    value={minROE}
                    onValueChange={setMinROE}
                    min={0}
                    max={20}
                    step={1}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span className="text-xs font-semibold">Quality of profit</span>
                    <span>20%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Min Profitable Quarters
                  {tooltipsEnabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                        <p className="font-semibold mb-1">Consecutive Profitable Quarters</p>
                        <p className="text-xs mb-2">
                          <strong>What:</strong> The number of consecutive quarters (3-month periods) where the company
                          reported positive earnings per share (EPS).
                        </p>
                        <p className="text-xs mb-2">
                          <strong>Why Important:</strong> Consistent profitability indicates business stability and
                          reduces the risk of major stock declines. Critical for put sellers who want to avoid being
                          assigned shares of declining companies.
                        </p>
                        <p className="text-xs">
                          <strong>Lower/0:</strong> Includes growth companies that may be unprofitable (riskier).{" "}
                          <strong>Higher:</strong> Only consistently profitable companies (5+ years = 20 quarters).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </Label>
                <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                      {minProfitableQuarters[0]}
                    </span>
                  </div>
                  <Slider
                    id="minProfitableQuarters"
                    value={minProfitableQuarters}
                    onValueChange={setMinProfitableQuarters}
                    min={0}
                    max={20}
                    step={1}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0</span>
                    <span className="text-xs font-semibold">
                      {minProfitableQuarters[0] === 0 ? "Any (no filter)" : `${minProfitableQuarters[0]} quarters`}
                    </span>
                    <span>20</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Min Market Cap
                  {tooltipsEnabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs bg-green-50 border-green-200 text-gray-900">
                        <p className="font-semibold mb-1">Market Cap Floor ({stepLabel("fundamentals")})</p>
                        <p className="text-xs mb-2">
                          <strong>What:</strong> Rejects companies below this total value (price × shares) using live
                          Polygon data, independent of the {stepLabel("preFilter")} universe filter.
                        </p>
                        <p className="text-xs mb-2">
                          <strong>Why Important:</strong> Smaller companies carry richer premiums but bigger gap risk.
                          This floor is your final quality gate before options are priced.
                        </p>
                        <p className="text-xs">
                          <strong>Lower ($500M–$2B):</strong> Admits volatile mid-caps (BE-class names).{" "}
                          <strong>Higher ($10B+):</strong> Large caps only.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </Label>
                <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-gray-900 bg-blue-100 px-3 py-1 rounded border border-blue-300">
                      {PRE_FILTER_MARKET_CAP_TIERS[minMarketCapCategory[0]]?.label ?? "Any"}
                    </span>
                  </div>
                  <Slider
                    id="minMarketCapCategory"
                    value={minMarketCapCategory}
                    onValueChange={setMinMarketCapCategory}
                    min={0}
                    max={PRE_FILTER_MARKET_CAP_TIERS.length - 1}
                    step={1}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Any</span>
                    <span className="text-xs font-semibold">Company size floor</span>
                    <span>{PRE_FILTER_MARKET_CAP_TIERS[PRE_FILTER_MARKET_CAP_TIERS.length - 1].label}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CHANGE: Removed the 'Max PE Ratio' slider and its related state */}
            {/* CHANGE: Removed the 'Min Volume' slider and its related state */}
          </CardContent>
        </Card>
  )
}
