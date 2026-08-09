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

const STALENESS_DAYS: Record<string, number> = {
  DFF: 7,
  DGS10: 7,
  T10Y2Y: 7,
  BAMLH0A0HYM2: 7,
  DTWEXBGS: 7,
  RRPONTSYD: 7,
  // Discontinued Jan 2022 — FRED's own latest observation is that old, and the
  // live path serves it too. No staleness gate, else the store could never win.
  TEDRATE: Number.POSITIVE_INFINITY,
  GASREGW: 21,
  WRMFSL: 21,
  BOGZ1FL663067003Q: 150,
  UNRATE: 60,
  CPIAUCSL: 60,
  CPILFESL: 60,
  PCEPI: 60,
  PAYEMS: 60,
  U6RATE: 60,
  CES0500000003: 60,
  M2SL: 60,
  PPIACO: 60,
  A191RL1Q225SBEA: 150,
  GFDEGDQ188S: 150,
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
 * Latest / previous / trend for one series, computed over stored observations.
 *
 * `yoy: true` returns year-over-year percent change for a monthly index (CPI,
 * core CPI, PCE) and needs 14 observations: 13 for the current comparison and
 * one more so the PREVIOUS month's YoY spans a full 12 months too. The old
 * per-route version asked FRED for 13 and then read index 13, which is
 * undefined — it silently fell back to index 12 and compared an 11-month span
 * against a 12-month one, so "last month's inflation rate" was consistently
 * wrong by one month of base effect.
 */
export async function fredTrendFromStore(
  seriesId: string,
  yoy: boolean,
): Promise<{ current: number; previous: number; trend: "up" | "down" | "stable" } | null> {
  const need = yoy ? 14 : 2
  const rows = await fredHistoryFromStore(seriesId, need)
  if (!rows || rows.length < need) return null

  const v = rows.map((r) => r.value)
  const [current, previous] = yoy
    ? [((v[0] - v[12]) / v[12]) * 100, ((v[1] - v[13]) / v[13]) * 100]
    : [v[0], v[1]]
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
