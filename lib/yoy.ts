/**
 * Date-aligned year-over-year arithmetic for monthly economic series.
 *
 * Deliberately dependency-free so scripts/check-yoy.ts can exercise it
 * directly — the same reason lib/black-scholes.ts and lib/indicators.ts carry
 * no imports. lib/fred-store.ts re-exports it for route callers.
 */

export interface SeriesTrend {
  current: number
  previous: number
  trend: "up" | "down" | "stable"
}

/** Shift a YYYY-MM-01 monthly key back n months, staying on the first. */
function monthsBack(day: string, n: number): string {
  const [y, m] = day.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 - n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`
}

/**
 * Year-over-year percent change for a monthly index, aligned BY DATE.
 *
 * Counting back twelve rows is wrong whenever a month is missing from the
 * series, and months do go missing: CPIAUCSL and CPILFESL have no 2025-10
 * observation (never published), so a row-offset comparison silently measures
 * a 13-month span and calls it year-over-year. Worse, FRED returns those gaps
 * as "." placeholders, so a fixed 14-row request came back with 13 usable
 * values and the caller fell through to a hardcoded inflation constant.
 *
 * Aligning on the calendar date makes both failures impossible: the base month
 * either exists or the answer is null.
 *
 * @param rows newest-first observations.
 */
export function yoyTrend(rows: { day: string; value: number }[]): SeriesTrend | null {
  if (rows.length < 2) return null
  const byDay = new Map(rows.map((r) => [r.day, r.value]))

  const latest = rows[0].value
  const prev = rows[1].value
  const latestBase = byDay.get(monthsBack(rows[0].day, 12))
  const prevBase = byDay.get(monthsBack(rows[1].day, 12))
  if (latestBase === undefined || prevBase === undefined || latestBase === 0 || prevBase === 0) return null

  const current = ((latest - latestBase) / latestBase) * 100
  const previous = ((prev - prevBase) / prevBase) * 100
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null

  return {
    current: Number(current.toFixed(2)),
    previous: Number(previous.toFixed(2)),
    trend: current > previous ? "up" : current < previous ? "down" : "stable",
  }
}
