"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts"
import { InfoTooltip } from "./jobs-tooltips"
import type { JobsData } from "./jobs-types"

/**
 * P7-83: the series were named "UNRATE (AI Forecast)" / "U-6 (AI Forecast)",
 * the legend key read "AI Forecast" and the hover chip said "AI Forecast".
 * Nothing on this tab's data path reaches a model — the projection is a trend
 * read over recent months. Renamed to "Projected", which is what it is.
 */
function CustomChartTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const d = payload[0]?.payload
    const isForecast = d?.isForecast
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <p className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          {label}
          {isForecast && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Projected</span>
          )}
        </p>
        {isForecast ? (
          <>
            <p className="text-sm text-[#1E3A8A]">
              UNRATE: {d.unrateForecast}%{" "}
              <span className="text-gray-400">
                ({d.unrateLow}-{d.unrateHigh}%)
              </span>
            </p>
            <p className="text-sm text-[#0D9488]">
              U-6: {d.u6Forecast}%{" "}
              <span className="text-gray-400">
                ({d.u6Low}-{d.u6High}%)
              </span>
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-[#1E3A8A]">UNRATE: {d.unrate}%</p>
            <p className="text-sm text-[#0D9488]">U-6: {d.u6}%</p>
          </>
        )}
      </div>
    )
  }
  return null
}

export function TrendChartCard({
  chartData,
  latestMonth,
  forecastStart,
  tooltipsEnabled,
}: {
  chartData: JobsData["chartData"]
  latestMonth: string
  forecastStart: string | undefined
  tooltipsEnabled: boolean
}) {
  return (
    <Card className="bg-white shadow-md border-0 mb-6">
      <CardHeader>
        <CardTitle className="text-[#1E3A8A] text-xl flex items-center gap-2">
          UNRATE &amp; U-6 Trend with Projections
          <InfoTooltip
            enabled={tooltipsEnabled}
            content="Historical UNRATE (official U-3) and U-6 (includes discouraged and part-time workers) from FRED, with trend-based projections shown as dashed lines. The shaded area represents the projection's confidence interval."
          />
        </CardTitle>
        <CardDescription className="text-gray-600">
          Historical data through {latestMonth}, projections extended forward
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="unrateForecastGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1E3A8A" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#1E3A8A" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="u6ForecastGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D9488" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#6B7280" />
              <YAxis domain={[3, 10]} tick={{ fontSize: 11 }} stroke="#6B7280" tickFormatter={(v) => `${v}%`} />
              <RechartsTooltip content={<CustomChartTooltip />} />
              <Legend />

              {forecastStart && (
                <ReferenceLine
                  x={forecastStart}
                  stroke="#9333EA"
                  strokeDasharray="5 5"
                  label={{ value: "Projected →", position: "top", fill: "#9333EA", fontSize: 11 }}
                />
              )}

              <Line
                type="monotone"
                dataKey="unrate"
                name="UNRATE (Actual)"
                stroke="#1E3A8A"
                strokeWidth={2}
                dot={{ fill: "#1E3A8A", r: 3 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="u6"
                name="U-6 (Actual)"
                stroke="#0D9488"
                strokeWidth={2}
                dot={{ fill: "#0D9488", r: 3 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="unrateForecast"
                name="UNRATE (Projected)"
                stroke="#1E3A8A"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: "#1E3A8A", r: 3, strokeDasharray: "0" }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="u6Forecast"
                name="U-6 (Projected)"
                stroke="#0D9488"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: "#0D9488", r: 3, strokeDasharray: "0" }}
                connectNulls={false}
              />
              <Area
                type="monotone"
                dataKey="unrateHigh"
                stroke="transparent"
                fill="url(#unrateForecastGradient)"
                connectNulls={false}
              />
              <Area
                type="monotone"
                dataKey="u6High"
                stroke="transparent"
                fill="url(#u6ForecastGradient)"
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-[#1E3A8A]" />
            <span className="text-gray-600">Actual</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-[#1E3A8A]" style={{ borderTop: "2px dashed #1E3A8A" }} />
            <span className="text-gray-600">Trend projection</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded" />
            <span className="text-gray-600">Confidence Range</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
