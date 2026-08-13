"use client"

/**
 * The per-meeting probability table.
 *
 * Split out of `components/fomc-predictions.tsx` (P6-13) unchanged. What it
 * closed over is now props.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { FomcMeeting } from "./fomc-types"

export function ProbabilityTableSection({
  meetings,
}: {
  meetings: FomcMeeting[]
}) {
  return (
    <>
        {meetings.length > 0 && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-900">Meeting Probabilities</CardTitle>
              {/* Not CME FedWatch, which prices 30-Day Fed Funds futures. This
                  is a rule-based score over FRED series — see the route. */}
              <CardDescription>Next FOMC Meeting - scored from FRED economic series</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-semibold text-gray-900">Meeting Date</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-900">Days Away</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-900">Implied Rate</th>
                      <th className="text-right py-2 px-3 font-semibold text-green-700">50bp Cut</th>
                      <th className="text-right py-2 px-3 font-semibold text-green-600">25bp Cut</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">No Change</th>
                      <th className="text-right py-2 px-3 font-semibold text-red-600">25bp Hike</th>
                      <th className="text-right py-2 px-3 font-semibold text-red-700">50bp Hike</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetings.slice(0, 3).map((meeting, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium text-gray-900">{meeting.date}</td>
                        <td className="text-right py-2 px-3 text-gray-600">{meeting.daysAway} days</td>
                        <td className="text-right py-2 px-3 text-gray-900 font-semibold">
                          {meeting.impliedRate.toFixed(2)}%
                        </td>
                        <td className="text-right py-2 px-3 text-green-700 font-semibold">
                          {meeting.probCut50.toFixed(1)}%
                        </td>
                        <td className="text-right py-2 px-3 text-green-600 font-semibold">
                          {meeting.probCut25.toFixed(1)}%
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700 font-semibold">
                          {meeting.probNoChange.toFixed(1)}%
                        </td>
                        <td className="text-right py-2 px-3 text-red-600 font-semibold">
                          {meeting.probHike25.toFixed(1)}%
                        </td>
                        <td className="text-right py-2 px-3 text-red-700 font-semibold">
                          {meeting.probHike50.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">Note:</span> Showing next 3 meetings for actionable near-term
                  predictions. Market expectations become less reliable for meetings further out.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

    </>
  )
}
