/**
 * Store-first FRED reads — E-7b.
 *
 * Routes call these instead of hitting api.stlouisfed.org per page view. Data
 * comes from `market_series` rows keyed `fred:<SERIES_ID>`, populated daily by
 * /api/cron/fred-snapshot. A miss (store empty, point stale for its cadence,
 * Supabase down) returns null and the caller falls back to its existing live
 * FRED path — the store is an accelerator, never a new failure mode.
 *
 * Staleness is judged per series cadence: a quarterly series 3 months old is
 * current; a daily series 3 months old means the cron died and the caller
 * should re-verify live rather than serve a dead number as fresh.
 */

import { getSeriesHistory } from "@/lib/market-series"
import { yoyTrend, type SeriesTrend } from "@/lib/yoy"

// Re-exported so routes have one import for store reads and the YoY maths that
// goes with them; lib/yoy.ts stays dependency-free for scripts/check-yoy.ts.
export { yoyTrend, type SeriesTrend }

const STALENESS_DAYS: Record<string, number> = {
  DFF: 7,
  DGS10: 7,
  DGS2: 7,
  T10Y2Y: 7,
  BAMLH0A0HYM2: 7,
  DTWEXBGS: 7,
  RRPONTSYD: 7,
  // Daily, and the market-snapshot cron writes both. A stale VIX is worse than
  // no VIX, so keep the gate tight (P6-31b).
  VIXCLS: 7,
  VXVCLS: 7,
  // Discontinued Jan 2022 — FRED's own latest observation is that old, and the
  // live path serves it too. No staleness gate, else the store could never win.
  TEDRATE: Number.POSITIVE_INFINITY,
  // CCPI redesign Phase 1. Weekly series post with a lag, so the gate has to
  // clear a full publication cycle plus slack — 7 days would mark a perfectly
  // current NFCI stale every week and push every read back onto live FRED,
  // the exact per-view traffic the store exists to remove (the CPI lesson).
  T10Y3M: 7,
  NFCI: 21,
  ANFCI: 21,
  STLFSI4: 21,
  ICSA: 21,
  PERMIT: 100, // monthly, published ~5 weeks in arrears
  GASREGW: 21,
  WRMFSL: 21,
  BOGZ1FL663067003Q: 200,
  // Monthly series publish 4-6 weeks in arrears and occasionally skip a month
  // (no October 2025 CPI was ever published). A 60-day gate marked genuinely
  // current data stale and pushed every read back onto live FRED — the exact
  // per-view traffic the store exists to remove. 100 days still catches a cron
  // that has been dead for three publication cycles.
  UNRATE: 100,
  CPIAUCSL: 100,
  CPILFESL: 100,
  PCEPI: 100,
  PAYEMS: 100,
  U6RATE: 100,
  CES0500000003: 100,
  M2SL: 100,
  PPIACO: 100,
  A191RL1Q225SBEA: 200,
  GFDEGDQ188S: 200,
}

function fresh(day: string, seriesId: string): boolean {
  const max = STALENESS_DAYS[seriesId] ?? 7
  if (!Number.isFinite(max)) return true
  const ageDays = (Date.now() - new Date(day + "T00:00:00Z").getTime()) / 86400000
  return ageDays <= max
}

/** Latest stored observation, or null if absent/stale for the series' cadence. */
export async function fredLatestFromStore(seriesId: string): Promise<{ value: number; day: string } | null> {
  const rows = await getSeriesHistory(`fred:${seriesId}`, 1)
  if (!rows || rows.length === 0) return null
  const latest = rows[0]
  return fresh(latest.day, seriesId) ? { value: latest.value, day: latest.day } : null
}

/**
 * Latest / previous / trend for one series from the store.
 *
 * `yoy: true` uses date-aligned year-over-year (see yoyTrend) and pulls 16
 * observations so a gap month cannot push the base out of the window.
 */
export async function fredTrendFromStore(seriesId: string, yoy: boolean): Promise<SeriesTrend | null> {
  const rows = await fredHistoryFromStore(seriesId, yoy ? 16 : 2)
  if (!rows || rows.length < 2) return null
  if (yoy) return yoyTrend(rows)

  const [current, previous] = [rows[0].value, rows[1].value]
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  return {
    current: Number(current.toFixed(2)),
    previous: Number(previous.toFixed(2)),
    trend: current > previous ? "up" : current < previous ? "down" : "stable",
  }
}

/** Latest stored value + percentile within stored history — the house
 * percentile-of-self normalization (P6-14), fed from the store instead of a
 * live FRED history pull. Null below minHistory points or when the head point
 * is stale for the series' cadence. */
export async function fredPercentileFromStore(
  seriesId: string,
  minHistory = 8,
): Promise<{ value: number; day: string; pct: number; n: number } | null> {
  const rows = await getSeriesHistory(`fred:${seriesId}`, 800)
  if (!rows || rows.length < minHistory) return null
  if (!fresh(rows[0].day, seriesId)) return null
  const values = rows.map((r) => r.value)
  const latest = values[0]
  const below = values.filter((v) => v < latest).length
  return { value: latest, day: rows[0].day, pct: below / values.length, n: values.length }
}

/** Recent stored observations, newest first — same freshness gate on the head
 * point, since serving a dead series as history misleads charts the same way. */
export async function fredHistoryFromStore(
  seriesId: string,
  limit: number,
): Promise<{ day: string; value: number }[] | null> {
  const rows = await getSeriesHistory(`fred:${seriesId}`, limit)
  if (!rows || rows.length === 0) return null
  return fresh(rows[0].day, seriesId) ? rows : null
}
