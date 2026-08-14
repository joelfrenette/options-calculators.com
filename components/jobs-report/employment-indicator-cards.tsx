"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { TrendingUp, Users, Briefcase, DollarSign } from "lucide-react"
import { CardTooltip } from "./jobs-tooltips"
import { fmtSigned, fmtNfp, type JobsData } from "./jobs-types"

/** The four measured-indicator cards: UNRATE, U-6, NFP and average hourly earnings. */
export function IndicatorCards({
  current,
  forecast,
  tooltipsEnabled,
  nfpAboveTrend,
}: {
  current: JobsData["current"]
  forecast: JobsData["forecast"]
  tooltipsEnabled: boolean
  nfpAboveTrend: boolean
}) {
  return (
    <>
      {/* Row 1: UNRATE and U-6 Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Official Unemployment Rate Card */}
        <CardTooltip
          enabled={tooltipsEnabled}
          content="UNRATE (U-3) is the official unemployment rate. A rate below 4% is considered 'full employment' - bullish for the economy but may pressure the Fed to raise rates. Rising unemployment above 5% signals recession risk - consider defensive strategies like put spreads on cyclical stocks."
        >
          <Card className="bg-white shadow-md border-0 cursor-help">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-[#0D9488]" />
                <CardTitle className="text-[#1E3A8A] text-xl">Official Unemployment Rate (UNRATE)</CardTitle>
              </div>
              <CardDescription className="text-gray-600">Bureau of Labor Statistics U-3 measure</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 mb-4">
                <span className="text-5xl font-bold text-[#1E3A8A]">{current.unrate}%</span>
                <span className="text-sm text-amber-600 font-medium pb-2">{fmtSigned(current.unrateYoY)} YoY</span>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  <strong>Previous Month:</strong> {current.unratePrevMonth}%
                </p>
                <p>
                  <strong>Previous Year:</strong> {current.unratePrevYear}%
                </p>
                <p>
                  <strong>Interpretation:</strong>{" "}
                  {forecast.trend === "rising"
                    ? "Labor market cooling as unemployment climbs"
                    : forecast.trend === "falling"
                      ? "Labor market re-tightening as unemployment falls"
                      : "Labor market remains solid and steady"}
                </p>
              </div>
            </CardContent>
          </Card>
        </CardTooltip>

        {/* Broad Unemployment Rate (U-6) Card */}
        <CardTooltip
          enabled={tooltipsEnabled}
          content="U-6 is the broadest measure of unemployment, including discouraged workers and those working part-time for economic reasons. When U-6 is significantly higher than UNRATE, it reveals hidden labor market slack."
        >
          <Card className="bg-white shadow-md border-0 cursor-help">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#0D9488]" />
                <CardTitle className="text-[#1E3A8A] text-xl">Broad Unemployment Rate (U-6)</CardTitle>
              </div>
              <CardDescription className="text-gray-600">
                Includes underemployed &amp; marginally attached workers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 mb-4">
                <span className="text-5xl font-bold text-[#0D9488]">{current.u6}%</span>
                <span className="text-sm text-amber-600 font-medium pb-2">{fmtSigned(current.u6YoY)} YoY</span>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  <strong>UNRATE Difference:</strong> {fmtSigned(current.unrateU6Diff)}
                </p>
                <p>
                  <strong>Year Ago:</strong> {current.u6PrevYear}%
                </p>
                <p>
                  <strong>Interpretation:</strong>{" "}
                  {current.unrateU6Diff > 4
                    ? "Elevated hidden slack relative to headline rate"
                    : "In line with typical headline-to-broad spread"}
                </p>
              </div>
            </CardContent>
          </Card>
        </CardTooltip>
      </div>

      {/* Row 2: Payroll & Wages Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Non-Farm Payrolls Card */}
        <CardTooltip
          enabled={tooltipsEnabled}
          content="Non-Farm Payrolls (NFP) measures the change in employed people excluding farm workers. Above 200K is strong job growth, 100-200K is moderate, below 100K is weak. Strong NFP is bullish for stocks short-term but may lead to Fed tightening."
        >
          <Card className="bg-white shadow-md border-0 cursor-help">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#0D9488]" />
                <CardTitle className="text-[#1E3A8A] text-xl">Non-Farm Payrolls (NFP)</CardTitle>
              </div>
              <CardDescription className="text-gray-600">Monthly job additions/losses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 mb-4">
                <span className="text-5xl font-bold text-green-600">{fmtNfp(current.nfp)}</span>
                <span className="text-sm text-green-600 font-medium pb-2">
                  {nfpAboveTrend ? "Above" : "Below"} 3-mo avg
                </span>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  <strong>Previous Month:</strong> {fmtNfp(current.nfpPrevMonth)}
                </p>
                <p>
                  <strong>3-Month Average:</strong> {fmtNfp(current.nfp3MonthAvg)}
                </p>
                <p>
                  <strong>Interpretation:</strong>{" "}
                  {current.nfp !== null && current.nfp >= 200
                    ? "Strong job growth"
                    : current.nfp !== null && current.nfp >= 100
                      ? "Moderate hiring pace"
                      : "Weak hiring — watch for cooling"}
                </p>
              </div>
            </CardContent>
          </Card>
        </CardTooltip>

        {/* Average Hourly Earnings Card */}
        <CardTooltip
          enabled={tooltipsEnabled}
          content="Average Hourly Earnings measures wage inflation. Rising wages above 3% YoY can pressure corporate margins (bearish) and may lead to Fed rate hikes. Falling wage growth below 2% suggests disinflation, potentially supportive of Fed rate cuts."
        >
          <Card className="bg-white shadow-md border-0 cursor-help">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-[#0D9488]" />
                <CardTitle className="text-[#1E3A8A] text-xl">Average Hourly Earnings</CardTitle>
              </div>
              <CardDescription className="text-gray-600">Wage growth indicator</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 mb-4">
                <span className="text-5xl font-bold text-[#1E3A8A]">
                  {current.earnings !== null ? `$${current.earnings.toFixed(2)}` : "n/a"}
                </span>
                {current.earningsYoY !== null && (
                  <span className="text-sm text-amber-600 font-medium pb-2">{fmtSigned(current.earningsYoY)} YoY</span>
                )}
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  <strong>Monthly Change:</strong>{" "}
                  {current.earningsMoM !== null ? fmtSigned(current.earningsMoM) : "n/a"}
                </p>
                <p>
                  <strong>Fed Target:</strong> ~3.0% YoY
                </p>
                <p>
                  <strong>Interpretation:</strong>{" "}
                  {current.earningsYoY !== null && current.earningsYoY > 3.5
                    ? "Wage pressures remain elevated, hawkish for Fed"
                    : current.earningsYoY !== null && current.earningsYoY < 2.5
                      ? "Wage growth cooling, supportive of rate cuts"
                      : "Wage growth near the Fed's comfort zone"}
                </p>
              </div>
            </CardContent>
          </Card>
        </CardTooltip>
      </div>
    </>
  )
}
