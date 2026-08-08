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
  UNRATE: 60,
  CPIAUCSL: 60,
  CPILFESL: 60,
  PCEPI: 60,
  PAYEMS: 60,
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
