"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PROJECTION_FLOOR, PROJECTION_CEILING, type CPIData } from "./cpi-types"

/**
 * The "Show Calculations" panel.
 *
 * P7-85. This panel existed to earn trust by disclosure, and every specific
 * claim it made about the projection was false. It described a "consensus
 * forecast" weighting Fed SEP projections, Blue Chip Economic Indicators and
 * the Survey of Professional Forecasters as
 * `Forecast(t) = α·FedProjection + β·SurveyConsensus + γ·TrendModel` with
 * α=0.5 / β=0.3 / γ=0.2, plus double exponential smoothing at α=0.3, β=0.1 and
 * confidence bands of ±0.5 / ±1.0 / ±1.5 percentage points.
 *
 * `/api/cpi-inflation` reads ONE FRED series and runs a two-term recurrence.
 * It fetches no Fed projection, no survey, and no forecaster consensus of any
 * kind; there is no smoothing, and no confidence band is computed or drawn.
 * The panel closed by saying "No proprietary or opaque models" — which was the
 * only sentence in it that a reader could not have checked, and the only one
 * that mattered.
 *
 * It now states the actual recurrence, including the clamp. The clamp is not a
 * detail: the chart's Y axis is drawn to the same two numbers, so a projection
 * pinned against it looks exactly like a projection that levelled off.
 */
export function MethodologyCard({ cpiData }: { cpiData: CPIData }) {
  return (
    <Card className="shadow-lg border-2 border-blue-200 bg-blue-50">
      <CardHeader className="bg-blue-100 border-b border-blue-300">
        <CardTitle className="text-lg font-bold text-blue-900 flex items-center gap-2">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          CPI Calculation Methodology &amp; Data Sources
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <h4 className="font-bold text-gray-900 mb-2">Data Source</h4>
          <div className="space-y-1 text-sm">
            <p>
              <span className="font-semibold">Primary:</span> Federal Reserve Economic Data (FRED) API
            </p>
            <p>
              <span className="font-semibold">API Endpoint:</span>{" "}
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                https://api.stlouisfed.org/fred/series/observations
              </code>
            </p>
            <p>
              <span className="font-semibold">Series ID:</span> CPIAUCSL (Consumer Price Index for All Urban Consumers:
              All Items in U.S. City Average)
            </p>
            <p>
              <span className="font-semibold">Frequency:</span> Monthly, published by Bureau of Labor Statistics
            </p>
            <p>
              <span className="font-semibold">Update Schedule:</span> Mid-month (typically 13th-15th) for prior month's
              data
            </p>
            <p className="text-xs text-gray-600 pt-1">
              This series is the tab's <em>only</em> input. Nothing else is fetched.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <h4 className="font-bold text-gray-900 mb-2">YoY (Year-over-Year) Calculation</h4>
          <div className="space-y-2 text-sm font-mono bg-gray-50 p-3 rounded">
            <p>YoY % Change = ((Current CPI - CPI 12 Months Ago) / CPI 12 Months Ago) × 100</p>
            <p className="text-xs text-gray-600 font-sans mt-2">
              Example: If current CPI = 315.2 and 12 months ago = 310.1
            </p>
            <p>YoY % = ((315.2 - 310.1) / 310.1) × 100 = 1.6%</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <h4 className="font-bold text-gray-900 mb-2">Projection Method</h4>
          <div className="space-y-2 text-sm">
            <div>
              <p className="font-semibold">What it is:</p>
              <p className="text-gray-700">
                A two-term recurrence run forward month by month from the latest published reading. It is arithmetic on
                the CPI series alone &mdash; <strong>not</strong> a survey, a consensus, or a forecast published by
                anyone.
              </p>
            </div>
            <div>
              <p className="font-semibold">Formula, applied to each projected month:</p>
              <p className="font-mono text-xs bg-gray-50 p-2 rounded">
                next = clamp( current + 0.15 × (FedTarget − current) + 0.70 × recentSlope )
              </p>
              <p className="text-xs text-gray-600 mt-1">
                <code>recentSlope</code> is the average month-over-month change in YoY over the last 6 published
                readings. The first term pulls 15% of the remaining distance to the {cpiData.fedTarget.toFixed(1)}%
                target each month; the second carries 70% of that recent slope forward.
              </p>
            </div>
            <div>
              <p className="font-semibold text-amber-800">Every projected month is clamped:</p>
              <p className="text-gray-700">
                the result is bounded to {PROJECTION_FLOOR.toFixed(1)}% &ndash; {PROJECTION_CEILING.toFixed(1)}%. The
                chart&apos;s vertical axis is drawn to those same bounds, so a projection resting against one of them
                looks like a line that levelled off. It has been cut off.
              </p>
            </div>
            <div>
              <p className="font-semibold">No confidence interval is computed.</p>
              <p className="text-gray-700">
                The projection is a single path with no error band. A range would require a model of the forecast error,
                and there is none here.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <h4 className="font-bold text-gray-900 mb-2">Inflation Pressure Assessment Logic</h4>
          <div className="space-y-2 text-sm font-mono bg-gray-50 p-3 rounded">
            <p>
              if (Current CPI {">"} Fed Target + 1.5%): <span className="text-red-600 font-bold">High Pressure</span>
            </p>
            <p>
              else if (Current CPI {">"} Fed Target + 0.5%):{" "}
              <span className="text-yellow-600 font-bold">Moderate Pressure</span>
            </p>
            <p>
              else: <span className="text-green-600 font-bold">Low Pressure</span>
            </p>
            <p className="text-xs text-gray-600 font-sans mt-3">
              Current: {cpiData.currentCPI.toFixed(1)}% vs Target: {cpiData.fedTarget.toFixed(1)}% = Difference:{" "}
              {(cpiData.currentCPI - cpiData.fedTarget).toFixed(1)}pp → {cpiData.inflationPressure} Pressure
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <h4 className="font-bold text-gray-900 mb-2">Options Strategy Selection Algorithm</h4>
          <div className="space-y-2 text-sm">
            <p className="text-gray-700">
              The strategy list is a <strong>fixed set written into the route</strong>, chosen by which of the three
              pressure bands above the current reading falls into. It reads nothing about any ticker, price or option
              chain:
            </p>
            <div className="space-y-3 mt-3">
              <div className="border-l-4 border-red-500 pl-3">
                <p className="font-semibold text-red-900">High Inflation Pressure ({">"} Target + 1.5%)</p>
                <ul className="list-disc ml-5 text-gray-700 text-xs space-y-1 mt-1">
                  <li>Gold-miner (GDX) and materials (XLB) call spreads (inflation hedge)</li>
                  <li>Rate-sensitive sector put spreads, e.g. real estate (XLRE), as rates rise</li>
                  <li>Growth stock put protection (multiple compression risk)</li>
                  <li>Energy sector call strategies (inflation beneficiary)</li>
                </ul>
              </div>
              <div className="border-l-4 border-yellow-500 pl-3">
                <p className="font-semibold text-yellow-900">Moderate Inflation Pressure (Target + 0.5% to 1.5%)</p>
                <ul className="list-disc ml-5 text-gray-700 text-xs space-y-1 mt-1">
                  <li>Defensive sector rotation (utilities, consumer staples)</li>
                  <li>Balanced portfolio collar strategies</li>
                  <li>Gold-industry (GDX) equity exposure as an inflation-aware tilt</li>
                  <li>Value stock long call spreads</li>
                </ul>
              </div>
              <div className="border-l-4 border-green-500 pl-3">
                <p className="font-semibold text-green-900">Low Inflation Pressure ({"<"} Target + 0.5%)</p>
                <ul className="list-disc ml-5 text-gray-700 text-xs space-y-1 mt-1">
                  <li>Growth stock call strategies (rate cut anticipation)</li>
                  <li>Tech sector bull call spreads</li>
                  <li>Rate-sensitive sector call strategies (utilities XLU, real estate XLRE)</li>
                  <li>Broad market index long strategies</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
          <p className="text-xs text-yellow-800">
            <span className="font-semibold">Transparency Note:</span> The historical series is published data from FRED.
            The projection is the arithmetic described above and nothing more &mdash; it is the site&apos;s own
            extrapolation, not anybody&apos;s published forecast, and its accuracy degrades quickly with distance.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
