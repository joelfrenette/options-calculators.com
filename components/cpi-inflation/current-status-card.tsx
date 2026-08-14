"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CpiInfoTooltip } from "./cpi-info-tooltip"
import { getTrendIcon, getTrendColor, getInflationPressureStyle, type CPIData } from "./cpi-types"

export function CurrentStatusCard({ cpiData, tooltipsEnabled }: { cpiData: CPIData; tooltipsEnabled: boolean }) {
  return (
    <Card className="shadow-lg border-2 border-gray-200">
      <CardHeader className="bg-gray-50 border-b border-gray-200">
        <CardTitle className="text-lg font-bold text-gray-900">
          Current Inflation Status
          <CpiInfoTooltip
            enabled={tooltipsEnabled}
            content="Comparing current CPI to previous month and Fed target shows inflation momentum. If CPI is above Fed's 2% target, expect hawkish policy (bad for stocks). If below target, expect dovish policy (good for growth stocks)."
          />
        </CardTitle>
        <CardDescription>Latest CPI readings and trend analysis</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">
              Current CPI (YoY)
              <CpiInfoTooltip
                enabled={tooltipsEnabled}
                content="Year-over-Year CPI shows how much prices have risen in the past 12 months. Above 3% is considered elevated inflation. For options: high CPI = sell call spreads on growth, buy put protection. Low CPI = bullish strategies on tech/growth."
              />
            </p>
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
            <p className="text-sm text-gray-600 mb-2">
              Previous Month
              <CpiInfoTooltip
                enabled={tooltipsEnabled}
                content="Comparing to previous month shows short-term inflation momentum. Month-over-month increases signal accelerating inflation - consider defensive options strategies."
              />
            </p>
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
            <p className="text-sm text-gray-600 mb-2">
              Fed Target
              <CpiInfoTooltip
                enabled={tooltipsEnabled}
                content="The Fed targets 2% inflation. Distance from target indicates likelihood of rate changes. Far above = rate hikes coming (bearish). Near or below = potential rate cuts (bullish for stocks)."
              />
            </p>
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
  )
}
