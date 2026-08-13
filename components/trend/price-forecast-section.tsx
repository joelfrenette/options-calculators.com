"use client"

/**
 * The price forecast card.
 *
 * Split out of `components/trend-analysis.tsx` (P6-13) unchanged. What it closed
 * over is now props.
 */
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, AlertTriangle, Info, Shield, Target, TrendingUp } from "lucide-react"
import type { TrendData } from "./trend-types"

export function PriceForecastSection({
  selectedItem,
}: {
  selectedItem: TrendData
}) {
  return (
    <>
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-900">{selectedItem.name} - Price Forecast</CardTitle>
            <CardDescription>
              60-day history + 30-day forecast with moving averages, Bollinger Bands, and support/resistance levels
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={selectedItem.historicalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: "11px" }} interval="preserveStartEnd" />
                <YAxis stroke="#6b7280" style={{ fontSize: "12px" }} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                  labelStyle={{ color: "#374151", fontWeight: "600" }}
                  formatter={(value: any) => (value ? `$${value.toFixed(2)}` : "N/A")}
                />
                <Legend />
                {/* P7-6. These read `?? 0`, so an unknown support or resistance
                    drew a dashed line labelled "Support" across y=0 — a price
                    level of zero asserted on the chart, and with
                    `domain={["auto","auto"]}` the axis then stretched to include
                    it and flattened the whole series against the bottom. P6-68
                    fixed `priceTarget1Week ?? 0` printing "$0.00" in this same
                    component and did not reach the chart. An unknown level draws
                    no line. */}
                {Number.isFinite(selectedItem.support) && (
                  <ReferenceLine
                    y={selectedItem.support as number}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    label={{ value: "Support", position: "right", fill: "#ef4444", fontSize: 11 }}
                  />
                )}
                {Number.isFinite(selectedItem.resistance) && (
                  <ReferenceLine
                    y={selectedItem.resistance as number}
                    stroke="#10b981"
                    strokeDasharray="3 3"
                    label={{ value: "Resistance", position: "right", fill: "#10b981", fontSize: 11 }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="bollingerUpper"
                  stroke="#94a3b8"
                  strokeWidth={1}
                  name="Bollinger Upper"
                  dot={false}
                  strokeDasharray="2 2"
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="bollingerLower"
                  stroke="#94a3b8"
                  strokeWidth={1}
                  name="Bollinger Lower"
                  dot={false}
                  strokeDasharray="2 2"
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#00a868"
                  strokeWidth={2}
                  name="Actual Price"
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Forecast (30-day)"
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="ma20"
                  stroke="#8b5cf6"
                  strokeWidth={1.5}
                  name="20-day MA"
                  dot={false}
                  strokeDasharray="3 3"
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="ma50"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  name="50-day MA"
                  dot={false}
                  strokeDasharray="3 3"
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="ma200"
                  stroke="#dc2626"
                  strokeWidth={2}
                  name="200-day MA"
                  dot={false}
                  strokeDasharray="4 4"
                  connectNulls={true}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

    </>
  )
}
