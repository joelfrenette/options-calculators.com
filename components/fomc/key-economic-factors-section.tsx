"use client"

/**
 * The factor summary, including what the market currently expects.
 *
 * Split out of `components/fomc-predictions.tsx` (P6-13) unchanged. What it
 * closed over is now props.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getMarketExpectationStyle } from "./presentation"
import type { EconomicFactors } from "./fomc-types"

export function KeyEconomicFactorsSection({
  economicFactors,
}: {
  economicFactors: EconomicFactors | null
}) {
  return (
    <>
        {economicFactors && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-900">Key Economic Factors</CardTitle>
              <CardDescription>Market signals influencing the prediction</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-900 mb-1">Yield Curve</p>
                  {economicFactors.yieldCurve === null ? (
                    <>
                      <p className="text-sm text-gray-400">—</p>
                      <p className="text-xs text-gray-500 mt-1">Insufficient data — Treasury yields unavailable</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-700">{economicFactors.yieldCurve}</p>
                      <span
                        className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded ${
                          economicFactors.yieldCurveSignal === "bearish"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {economicFactors.yieldCurveSignal === "bearish"
                          ? "Recession Signal"
                          : economicFactors.yieldCurve === "Flat"
                            ? "Flattening"
                            : "Normal"}
                      </span>
                    </>
                  )}
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-900 mb-1">Treasury Yields</p>
                  {economicFactors.treasuryTrend === null ? (
                    <>
                      <p className="text-sm text-gray-400">—</p>
                      <p className="text-xs text-gray-500 mt-1">Insufficient data — 10Y Treasury unavailable</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-700">{economicFactors.treasuryTrend}</p>
                      <span
                        className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded ${
                          economicFactors.treasurySignal === "dovish"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {economicFactors.treasurySignal === "dovish" ? "Dovish Signal" : "Hawkish Signal"}
                      </span>
                    </>
                  )}
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 md:col-span-2">
                  <p className="text-sm font-semibold text-gray-900 mb-1">Market Expectation</p>
                  <span
                    className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded ${getMarketExpectationStyle(economicFactors.marketExpectation)}`}
                  >
                    {economicFactors.marketExpectation} Fed policy stance
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

    </>
  )
}
