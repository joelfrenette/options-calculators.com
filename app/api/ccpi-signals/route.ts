import { NextResponse } from "next/server"
import { getBreadthHistory, getCloseHistory, getSeriesHistory } from "@/lib/market-series"
import { SIGNALS, breadthDivergence, evaluableSignals, type SeriesPoint } from "@/lib/ccpi/signals"

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
/**
 * One Trigger row (CCPI_DESIGN §7a).
 *
 * Stated explicitly rather than inferred so the FRED rows and the breadth row
 * are provably the same shape — and so `state` can never widen to `string`,
 * which is what lets a `no-data` row be mistaken for a quiet one downstream.
 */
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

/** The signal's own lookback, from `breadthDivergence`'s default. */
const BREADTH_LOOKBACK_DAYS = 60
/** Enough tail for the lookback plus non-trading days and the odd gap. */
const BREADTH_TAIL_DAYS = 400

/**
 * Breadth divergence as a Trigger row.
 *
 * The only candidate in CCPI_DESIGN §6b with prior support that the 2026-08-10
 * run could not test, because it is not a FRED signal: the index comes from
 * stored SPY closes and breadth from `breadth_daily`. It is scored separately
 * in `/api/admin/ccpi-backtest` for the same reason, and this is the live half.
 *
 * **`no-data` is the expected answer for a while and is not a bug.** Breadth
 * spends roughly 280 calendar days of closes computing its first 200-day
 * average before it produces a single point, and this signal then needs 60 more
 * days of overlap on top. Reporting `no-data` truthfully is the whole point —
 * §7a forbids a signal without a reading rendering as `quiet`, which is the
 * P6-30 defect (a dead feed showing as "Neutral").
 */
async function breadthDivergenceRow(): Promise<TriggerRow> {
  const base = {
    id: "breadth-divergence",
    label: "Breadth divergence",
    meaning: "The index is near its high while fewer members hold above their 200-day average.",
    readingSeries: "breadth_daily.pct_above_200dma",
    record: "untested",
  }

  const [spy, breadth] = await Promise.all([
    getCloseHistory("SPY", BREADTH_TAIL_DAYS),
    getBreadthHistory(BREADTH_TAIL_DAYS),
  ])

  const haveSpy = spy?.length ?? 0
  const haveBreadth = breadth?.length ?? 0
  // The signal compares same-day points only (mismatched dates produced the
  // S-11 defect), so the usable history is the overlap, not either length.
  const asc = (rows: { day: string; value: number }[] | null) =>
    rows ? [...rows].sort((a, b) => (a.day < b.day ? -1 : 1)) : []
  const spyAsc = asc(spy)
  const breadthAsc = asc(breadth)
  const breadthDays = new Set(breadthAsc.map((p) => p.day))
  const overlap = spyAsc.filter((p) => breadthDays.has(p.day)).length

  const latestBreadth = breadthAsc.length > 0 ? breadthAsc[breadthAsc.length - 1] : null

  if (overlap <= BREADTH_LOOKBACK_DAYS) {
    return {
      ...base,
      state: "no-data" as const,
      reading: null,
      asOf: null,
      detail:
        `needs ${BREADTH_LOOKBACK_DAYS + 1} overlapping days of SPY closes and breadth; ` +
        `have ${overlap} (SPY ${haveSpy}, breadth ${haveBreadth})`,
    }
  }

  const obs = breadthDivergence(spyAsc, breadthAsc, { lookbackDays: BREADTH_LOOKBACK_DAYS })
  // Trailing nulls are days the signal could not evaluate; the last DECIDED day
  // is the current state. Reading the final element regardless would report
  // no-data on any day SPY and breadth happened not to align.
  const lastDecided = [...obs].reverse().find((o) => o.firing !== null) ?? null

  if (lastDecided === null) {
    return {
      ...base,
      state: "no-data" as const,
      reading: latestBreadth ? latestBreadth.value : null,
      asOf: latestBreadth ? latestBreadth.day : null,
      detail: `${overlap} overlapping days stored, but no day yet satisfies the ${BREADTH_LOOKBACK_DAYS}-day window`,
    }
  }

  const readingAt = breadthAsc.find((p) => p.day === lastDecided.day) ?? latestBreadth
  return {
    ...base,
    state: lastDecided.firing ? ("firing" as const) : ("quiet" as const),
    reading: readingAt ? readingAt.value : null,
    asOf: readingAt ? readingAt.day : lastDecided.day,
    detail: null,
  }
}

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

  const rows: TriggerRow[] = SIGNALS.map((sig): TriggerRow => {
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

  rows.push(await breadthDivergenceRow())

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
