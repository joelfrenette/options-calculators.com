"use client"

/**
 * TRIGGER — the Phase 2 leading-signals section (CCPI_DESIGN.md §7a).
 *
 * One row per signal from /api/ccpi-signals, each carrying the four things §7a
 * requires and never fewer: state, the reading and its date, what firing would
 * mean, and its record — which reads "lead: untested" for every signal until
 * the backtest confirms one, because that is the honest answer.
 *
 * What this component must NEVER do (§7a, verbatim):
 * - No score, no gauge, no 0-100 anything. The header is a count.
 * - No inferring a state from a missing reading: NO DATA is never QUIET.
 * - No reordering rows by "importance" — the API's order (grouped by data
 *   source) is kept as-is.
 */

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface TriggerRow {
  id: string
  label: string
  meaning: string
  state: "firing" | "quiet" | "no-data"
  reading: number | null
  readingSeries: string | null
  asOf: string | null
  detail: string | null
  record: string
}

interface TriggerResponse {
  ok: boolean
  headline: string
  firing: number
  measured: number
  total: number
  scored: boolean
  scoringNote: string
  rows: TriggerRow[]
}

function formatReading(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—"
  if (Math.abs(value) >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 0 })
  const formatted = value.toFixed(2)
  return value > 0 ? `+${formatted}` : formatted
}

function formatAsOf(day: string | null): string {
  if (!day) return ""
  const parsed = Date.parse(`${day}T00:00:00Z`)
  if (!Number.isFinite(parsed)) return day
  return new Date(parsed).toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" })
}

const STATE_STYLES: Record<TriggerRow["state"], { dot: string; badge: string; label: string }> = {
  firing: { dot: "bg-red-500", badge: "bg-red-100 text-red-800 border-red-300", label: "FIRING" },
  quiet: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "QUIET" },
  "no-data": { dot: "bg-gray-300", badge: "bg-gray-100 text-gray-500 border-gray-300", label: "NO DATA" },
}

export function TriggerSection() {
  const [data, setData] = useState<TriggerResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/ccpi-signals")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Signals request failed: ${res.status}`)
        return (await res.json()) as TriggerResponse
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load signals")
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">
          TRIGGER{data ? ` — ${data.firing} of ${data.measured} measured signals firing` : ""}
        </CardTitle>
        <CardDescription>
          Leading signals only. Each row states what firing would mean and its measured record — no signal
          carries weight until the walk-forward backtest confirms one, and none has yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-red-600">Could not load signals: {error}</p>}
        {!error && !data && <p className="text-sm text-gray-500">Loading signals…</p>}
        {data && (
          <div className="divide-y divide-gray-100">
            {data.rows.map((row) => {
              const style = STATE_STYLES[row.state]
              return (
                <div key={row.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${style.dot}`} />
                      <span className="text-sm font-semibold truncate">{row.label}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm text-gray-700 tabular-nums">
                        {row.state === "no-data" ? "—" : formatReading(row.reading)}
                        {row.asOf ? <span className="text-gray-400"> · {formatAsOf(row.asOf)}</span> : null}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${style.badge}`}>
                        {style.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pl-4.5 mt-0.5 ml-4">
                    <span className="text-xs text-gray-600">
                      {row.meaning}
                      {row.state === "no-data" && row.detail ? ` (${row.detail})` : ""}
                    </span>
                    <span className="text-xs text-gray-400 italic shrink-0">lead: {row.record}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {data && <p className="text-xs text-gray-500 mt-4">{data.scoringNote}</p>}
      </CardContent>
    </Card>
  )
}
