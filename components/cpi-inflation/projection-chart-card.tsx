"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { CpiInfoTooltip } from "./cpi-info-tooltip"
import { PROJECTION_FLOOR, PROJECTION_CEILING, type CPIData } from "./cpi-types"

/**
 * P7-85: the dashed series was named "Consensus Inflation Model" and the card
 * subtitle called it a "2-year consensus inflation forecast". A consensus is a
 * survey of forecasters; this is a recurrence on one FRED series. The Y-axis
 * bounds are the projection's own clamp, which is why the note below the chart
 * now says so — a line resting on the axis edge has been cut off, not levelled.
 */
export function ProjectionChartCard({ cpiData, tooltipsEnabled }: { cpiData: CPIData; tooltipsEnabled: boolean }) {
  return (
    <Card className="shadow-lg border-2 border-primary/20">
      <CardHeader className="bg-primary/5 border-b border-primary/20">
        <CardTitle className="text-lg font-bold text-gray-900">
          U.S. Inflation (CPI-U) &mdash; History and Projection
          <CpiInfoTooltip
            enabled={tooltipsEnabled}
            content="Solid line: 2 years of published CPI from FRED. Dashed line: this site's own 24-month extrapolation — a pull toward the Fed target plus a share of the recent slope, clamped to a fixed range. It is not anyone's published forecast. Open Show Calculations for the exact arithmetic."
          />
        </CardTitle>
        <CardDescription>2-year published history (solid) and a 24-month extrapolation (dashed)</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cpiData.chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
              <YAxis
                domain={[PROJECTION_FLOOR, PROJECTION_CEILING]}
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
                label={{
                  value: "YoY % Change",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 12, fill: "#6b7280" },
                }}
              />
              <RechartsTooltip
                contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                formatter={(value: any) => `${Number(value).toFixed(1)}%`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="historical"
                stroke="#1f2937"
                strokeWidth={3}
                name="Published (FRED)"
                dot={{ fill: "#1f2937", r: 4 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#22c55e"
                strokeWidth={3}
                strokeDasharray="5 5"
                name="Trend extrapolation"
                dot={{ fill: "#22c55e", r: 4 }}
                connectNulls={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <span className="font-semibold">Chart note:</span> the solid line is published CPI from FRED. The dashed
            line is this site&apos;s own extrapolation, clamped to {PROJECTION_FLOOR.toFixed(1)}%&ndash;
            {PROJECTION_CEILING.toFixed(1)}% &mdash; the same range as the vertical axis, so a dashed line running along
            the top or bottom edge has been cut off rather than flattening out. No confidence band is drawn because none
            is computed.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
