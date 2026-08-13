"use client"

/**
 * The six headline series the Fed watches — unemployment, CPI, PCE, core CPI, GDP and payrolls.
 *
 * Split out of `components/fomc-predictions.tsx` (P6-13) unchanged. What it
 * closed over is now props.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { IndicatorBody } from "./presentation"
import { InfoTooltip } from "./info-tooltip"
import type { EconomicIndicators } from "./fomc-types"

export function EconomicIndicatorsSection({
  economicIndicators,
  tooltipsEnabled,
}: {
  economicIndicators: EconomicIndicators | null
  tooltipsEnabled: boolean
}) {
  return (
    <>
        {economicIndicators && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-1">
                Key Economic Indicators
                <InfoTooltip enabled={tooltipsEnabled} content="The Fed watches these indicators to set policy. High inflation = hawkish (rate hikes). High unemployment = dovish (rate cuts). Strong GDP = less need for cuts. These drive Fed decisions and market expectations." />
              </CardTitle>
              <CardDescription>
                Real-time data from Federal Reserve Economic Data (FRED). Series that did not return show "—" — no
                figure is substituted.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid md:grid-cols-3 gap-4">
                {/* Unemployment */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Unemployment Rate
                    <InfoTooltip enabled={tooltipsEnabled} content="Rising unemployment makes the Fed more likely to cut rates to stimulate jobs. Low unemployment lets Fed focus on fighting inflation. Watch for surprises vs expectations." />
                  </p>
                  <IndicatorBody
                    indicator={economicIndicators.unemployment}
                    format={(n) => `${n.toFixed(1)}%`}
                    footnote="Fed Target: 4.0-4.5% (Full Employment)"
                  />
                </div>

                {/* CPI */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    CPI (YoY)
                    <InfoTooltip enabled={tooltipsEnabled} content="Consumer Price Index measures inflation. Above Fed's 2% target = hawkish pressure (rates stay high). Below target = room for cuts. Hot CPI prints are bearish for stocks." />
                  </p>
                  <IndicatorBody
                    indicator={economicIndicators.cpi}
                    format={(n) => `${n.toFixed(1)}%`}
                    footnote="Fed Target: 2.0% (Price Stability)"
                  />
                </div>

                {/* PCE */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    PCE Inflation
                    <InfoTooltip enabled={tooltipsEnabled} content="Personal Consumption Expenditures price index is the Fed's preferred inflation measure. Similar trends to CPI but often smoother. High PCE also signals hawkish policy." />
                  </p>
                  <IndicatorBody
                    indicator={economicIndicators.pce}
                    format={(n) => `${n.toFixed(1)}%`}
                    footnote="Fed's preferred inflation measure"
                  />
                </div>

                {/* Core CPI */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Core CPI
                    <InfoTooltip enabled={tooltipsEnabled} content="Core CPI excludes volatile food and energy prices, providing a clearer view of underlying inflation trends. Persistent high core inflation keeps the Fed hawkish." />
                  </p>
                  <IndicatorBody
                    indicator={economicIndicators.coreCPI}
                    format={(n) => `${n.toFixed(1)}%`}
                    footnote="Excludes food & energy volatility"
                  />
                </div>

                {/* GDP */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    GDP Growth
                    <InfoTooltip enabled={tooltipsEnabled} content="Strong GDP growth reduces urgency for rate cuts. Weak GDP increases cut probability. Negative GDP (recession) typically triggers aggressive easing - very bullish for stocks." />
                  </p>
                  <IndicatorBody
                    indicator={economicIndicators.gdp}
                    format={(n) => `${n.toFixed(1)}%`}
                    footnote="Annualized quarterly growth rate"
                  />
                </div>

                {/* Non-Farm Payrolls */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Non-Farm Payrolls
                    <InfoTooltip enabled={tooltipsEnabled} content="Job creation numbers are key to labor market health. Strong payrolls suggest a robust economy, allowing the Fed to stay hawkish. Weak numbers can signal slowdown and increase cut odds." />
                  </p>
                  <IndicatorBody
                    indicator={economicIndicators.payrolls}
                    format={(n) => `${(n / 1000).toFixed(0)}M`}
                    footnote="Total employed workers (thousands)"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

    </>
  )
}
