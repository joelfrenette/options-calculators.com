import { NextResponse } from "next/server"
import { isAuthenticated } from "@/lib/auth"
import { getSeriesHistory } from "@/lib/market-series"
import { SIGNALS, evaluableSignals, type SeriesPoint } from "@/lib/ccpi/signals"
import { scoreLeadTime, proposedWeight } from "@/lib/ccpi/lead-time"
import { REFERENCE_DRAWDOWNS } from "@/lib/ccpi/drawdowns"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * CCPI lead-time backtest (CCPI_DESIGN.md §6).
 *
 * Runs every signal whose series are in the store through the lead-time scorer
 * and returns the table that decides which of them earn weight. Read-only:
 * it computes nothing into the live index and writes nothing back.
 *
 * **It is expected to answer `insufficient-history` for everything until a deep
 * backfill has run**, and that is the correct answer, not a fault. A backtest
 * that produced numbers from 131 days of history would be worse than useless —
 * it would be confidently wrong, which is the failure this whole audit exists
 * to remove.
 *
 * Admin-gated because it is a diagnostic, and because it is slow enough to be
 * worth not exposing.
 */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seriesNeeded = [...new Set(SIGNALS.flatMap((s) => s.requires))]

  // Pull each series once, as deep as the store allows. Still reported in the
  // response: if this ever becomes the binding constraint again, the reader
  // should be able to see that from the output rather than deduce it.
  const HISTORY_CAP = 20000
  const loaded: Record<string, readonly SeriesPoint[]> = {}
  const available: string[] = []
  for (const id of seriesNeeded) {
    const rows = await getSeriesHistory(`fred:${id}`, HISTORY_CAP)
    if (rows && rows.length > 0) {
      loaded[id] = [...rows].sort((a, b) => (a.day < b.day ? -1 : 1))
      available.push(id)
    }
  }

  const events = REFERENCE_DRAWDOWNS.map((d) => ({ id: d.id, peak: d.peak }))
  const evaluable = evaluableSignals(available)

  const rows = evaluable.map((sig) => {
    const observations = sig.evaluate(loaded)
    const result = scoreLeadTime(observations, events)
    return {
      id: sig.id,
      label: sig.label,
      meaning: sig.meaning,
      hypothesis: sig.hypothesis,
      verdict: result.verdict,
      reason: result.reason,
      observedDays: result.observedDays,
      coveredEvents: result.coveredEventIds.length,
      hitRate: result.hitRate,
      medianLeadDays: result.medianLeadDays,
      falsePositives: result.falsePositives,
      falsePositivesPerDecade: result.falsePositivesPerDecade,
      medianEpisodeDays: result.medianEpisodeDays,
      proposedWeight: proposedWeight(result),
    }
  })

  const scored = rows.filter((r) => r.verdict === "scored")

  return NextResponse.json({
    ok: true,
    // Stated first because it is the question a reader actually has.
    summary:
      scored.length === 0
        ? `No signal has enough history to score. ${evaluable.length} of ${SIGNALS.length} signals are evaluable; the store must reach ${REFERENCE_DRAWDOWNS[0].peak} for the earliest reference drawdown to be testable.`
        : `${scored.length} of ${evaluable.length} evaluable signals scored against ${REFERENCE_DRAWDOWNS.length} reference drawdowns.`,
    historyCapPerSeries: HISTORY_CAP,
    seriesAvailable: available,
    seriesMissing: seriesNeeded.filter((id) => !available.includes(id)),
    signalsEvaluable: evaluable.length,
    signalsTotal: SIGNALS.length,
    referenceDrawdowns: REFERENCE_DRAWDOWNS.length,
    rows,
  })
}
