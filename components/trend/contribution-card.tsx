/**
 * One scoring input, its weight, and what it contributed.
 *
 * Split out of `components/trend-analysis.tsx` (P6-13) unchanged. A null value
 * or a null contribution renders "—" and "no data" rather than a zero: on this
 * card a "+0.0 pts" reads as a measured neutral input, not an absent one.
 */

export function ContributionCard({
  label,
  c,
  digits,
  suffix = "",
  verdict,
}: {
  label: string
  c: { value: number | null; contribution: number | null; weight: number }
  digits: number
  suffix?: string
  verdict: (v: number) => string
}) {
  const missing = c.value === null || c.contribution === null
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className="text-xs text-gray-500">Weight: ±{c.weight} pts</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono">{missing ? "—" : `${c.value!.toFixed(digits)}${suffix}`}</span>
        <span className={`text-sm font-bold ${missing ? "text-gray-400" : c.contribution! >= 0 ? "text-green-600" : "text-red-600"}`}>
          {missing ? "no data" : `${c.contribution! >= 0 ? "+" : ""}${c.contribution!.toFixed(1)} pts`}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {missing ? "Not enough history to compute this input" : verdict(c.value!)}
      </p>
    </div>
  )
}
