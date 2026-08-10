import { NextResponse } from "next/server"
import { getSeriesHistory } from "@/lib/market-series"
import { SIGNALS, evaluableSignals, type SeriesPoint } from "@/lib/ccpi/signals"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const maxDuration = 60

/**
 * Current state of every Trigger signal (CCPI_DESIGN.md §7a).
 *
 * The data behind Phase 2's Trigger section. One row per signal, each carrying
 * the four things §7a requires and never fewer: state, the reading and its
 * date, what firing would mean, and its record.
 *
 * **`record` reads "untested" for every signal and will keep doing so until the
 * lead-time backtest has real history to score against.** That is not a
 * placeholder to be filled in optimistically later — it is the honest answer,
 * and §7a treats a row without its record as a row asserting something it has
 * not earned.
 *
 * Three states, and the distinction between the last two is the whole point:
 *   firing   — the condition is true today
 *   quiet    — measured, and the condition is false
 *   no-data  — not measured. NEVER reported as quiet (P6-30: a dead feed
 *              rendering as "Neutral" is what this redesign exists to undo).
 */
export async function GET() {
  const seriesNeeded = [...new Set(SIGNALS.flatMap((s) => s.requires))]

  // Only the recent tail is needed for a current reading, but velocity signals
  // look back 20 days and the claims signal 182, so pull enough for the longest
  // lookback plus slack rather than guessing per signal.
  const loaded: Record<string, readonly SeriesPoint[]> = {}
  const available: string[] = []
  for (const id of seriesNeeded) {
    const rows = await getSeriesHistory(`fred:${id}`, 400)
    if (rows && rows.length > 0) {
      loaded[id] = [...rows].sort((a, b) => (a.day < b.day ? -1 : 1))
      available.push(id)
    }
  }

  const evaluable = new Set(evaluableSignals(available).map((s) => s.id))

  const rows = SIGNALS.map((sig) => {
    if (!evaluable.has(sig.id)) {
      return {
        id: sig.id,
        label: sig.label,
        meaning: sig.meaning,
        state: "no-data" as const,
        reading: null,
        readingSeries: null,
        asOf: null,
        detail: `not stored: ${sig.requires.filter((r) => !available.includes(r)).join(", ")}`,
        record: "untested",
      }
    }
    const obs = sig.evaluate(loaded)
    const last = obs.length > 0 ? obs[obs.length - 1] : null
    // The reading shown is the signal's FIRST required series — the one its
    // threshold is expressed against. Showing a number the state does not
    // derive from would be worse than showing none.
    const primary = sig.requires[0]
    const primaryPoints = loaded[primary]
    const latestPoint = primaryPoints && primaryPoints.length > 0 ? primaryPoints[primaryPoints.length - 1] : null

    return {
      id: sig.id,
      label: sig.label,
      meaning: sig.meaning,
      state: last === null || last.firing === null ? ("no-data" as const) : last.firing ? ("firing" as const) : ("quiet" as const),
      reading: latestPoint ? latestPoint.value : null,
      readingSeries: primary,
      asOf: latestPoint ? latestPoint.day : null,
      detail: null,
      record: "untested",
    }
  })

  const firing = rows.filter((r) => r.state === "firing").length
  const measured = rows.filter((r) => r.state !== "no-data").length

  return NextResponse.json({
    ok: true,
    // §7a: the header states a count and nothing more. No composite, no gauge.
    headline: `${firing} of ${measured} measured signals firing`,
    firing,
    measured,
    total: rows.length,
    // Stated on the response so no consumer can present these as scored.
    scored: false,
    scoringNote:
      "No signal carries weight yet. Lead times are unmeasured until the store holds enough history for the backtest (CCPI_DESIGN.md Phase 1).",
    rows,
  })
}
