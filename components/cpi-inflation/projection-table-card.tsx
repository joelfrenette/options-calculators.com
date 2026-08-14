"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PROJECTION_FLOOR, PROJECTION_CEILING, type CPIData } from "./cpi-types"

export function ProjectionTableCard({ forecastData }: { forecastData: CPIData["forecastData"] }) {
  return (
    <Card className="shadow-sm border-gray-200">
      <CardHeader className="bg-gray-50 border-b border-gray-200">
        <CardTitle className="text-lg font-bold text-gray-900">24-Month CPI Projection</CardTitle>
        <CardDescription>This site&apos;s own extrapolation, not a published forecast</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-semibold text-gray-900">Month</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-900">Projected CPI (YoY %)</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-900">Change from Current</th>
              </tr>
            </thead>
            <tbody>
              {forecastData.slice(0, 12).map((forecast, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium text-gray-900">{forecast.month}</td>
                  <td className="text-right py-2 px-3 text-gray-900 font-semibold">{forecast.cpi.toFixed(1)}%</td>
                  <td
                    className={`text-right py-2 px-3 font-semibold ${forecast.yoyChange >= 0 ? "text-red-600" : "text-green-600"}`}
                  >
                    {forecast.yoyChange >= 0 ? "+" : ""}
                    {forecast.yoyChange.toFixed(1)}pp
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
          <p className="text-xs text-blue-800">
            <span className="font-semibold">Note:</span> showing the first 12 of 24 projected months. Each value is
            clamped to {PROJECTION_FLOOR.toFixed(1)}%&ndash;{PROJECTION_CEILING.toFixed(1)}%, so a run of identical
            readings at either bound is the clamp, not a projection of stability. Accuracy degrades quickly beyond a few
            months.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
