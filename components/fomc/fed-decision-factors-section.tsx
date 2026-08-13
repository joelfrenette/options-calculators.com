"use client"

/**
 * Inflation, labour and growth, each as a direction rather than a number.
 *
 * Split out of `components/fomc-predictions.tsx` (P6-13) unchanged. What it
 * closed over is now props.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FactorValue, getGrowthTrendStyle, getInflationTrendStyle, getLaborTrendStyle } from "./presentation"
import type { FedDecisionFactors } from "./fomc-types"

export function FedDecisionFactorsSection({
  fedDecisionFactors,
}: {
  fedDecisionFactors: FedDecisionFactors | null
}) {
  return (
    <>
        {fedDecisionFactors && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-900">Fed Decision Analysis</CardTitle>
              <CardDescription>How economic data influences the Fed's rate decision</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Inflation Pressure</p>
                  <FactorValue value={fedDecisionFactors.inflationPressure} />
                  {fedDecisionFactors.inflationTrend !== null && (
                    <span
                      className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded ${getInflationTrendStyle(fedDecisionFactors.inflationTrend)}`}
                    >
                      Trend: {fedDecisionFactors.inflationTrend}
                    </span>
                  )}
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Labor Market</p>
                  <FactorValue value={fedDecisionFactors.laborMarket} />
                  {fedDecisionFactors.laborTrend !== null && (
                    <span
                      className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded ${getLaborTrendStyle(fedDecisionFactors.laborTrend)}`}
                    >
                      Trend: {fedDecisionFactors.laborTrend}
                    </span>
                  )}
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Economic Growth</p>
                  <FactorValue value={fedDecisionFactors.economicGrowth} />
                  {fedDecisionFactors.growthTrend !== null && (
                    <span
                      className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded ${getGrowthTrendStyle(fedDecisionFactors.growthTrend)}`}
                    >
                      Trend: {fedDecisionFactors.growthTrend}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

    </>
  )
}
