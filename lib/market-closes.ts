/**
 * Store-first reads of daily bars — E-7c part 2.
 *
 * `market_closes` is written by the close-time snapshot cron from Polygon
 * grouped-daily bars. Routes read here first and fall back to their live
 * source, the same accelerator-never-a-new-failure-mode contract as
 * lib/fred-store.ts.
 *
 * A bar only counts as usable when every leg the caller needs is present.
 * Rows written before migration 0009 carry a close and nulls for high/low/
 * volume, and substituting the close for a missing high and low would make a
 * zero-range day — ATR would read a violent session as perfectly calm. There
 * is no partial credit: an incomplete history sends the caller to the live
 * source rather than serving a quietly degraded one.
 */

import { getMeteringSupabaseConfig } from "@/lib/metered-fetch"

export interface StoredBar {
  day: string
  close: number
  high: number
  low: number
  volume: number | null
}

/**
 * How stale the newest stored bar may be before the store is considered dead.
 * Three sessions of slack absorbs a long weekend plus a holiday; beyond that
 * the cron has stopped and serving its last bar as "today" would misprice
 * every downstream signal.
 */
const MAX_STALE_DAYS = 6

/**
 * Newest-first bars for one ticker, or null when the store cannot serve a
 * complete, fresh history of at least `minBars`.
 *
 * Returns null (not a short array) on purpose: every caller here needs a
 * minimum window for its longest indicator, and a half-filled series is the
 * failure mode that produced the "200-day MA" that was really the last close.
 */
export async function getStoredBars(ticker: string, limit: number, minBars: number): Promise<StoredBar[] | null> {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return null

  try {
    const url =
      `${cfg.url}/rest/v1/market_closes` +
      `?ticker=eq.${encodeURIComponent(ticker)}` +
      `&select=day,close,high,low,volume&order=day.desc&limit=${limit}`
    const res = await fetch(url, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const rows = (await res.json()) as
      | { day: string; close: string | number; high: string | number | null; low: string | number | null; volume: string | number | null }[]
      | null
    if (!Array.isArray(rows) || rows.length === 0) return null

    const bars: StoredBar[] = []
    for (const r of rows) {
      const close = Number(r.close)
      const high = r.high === null ? Number.NaN : Number(r.high)
      const low = r.low === null ? Number.NaN : Number(r.low)
      // A pre-0009 row (or any bar missing a leg) ends the usable history —
      // the rows are newest-first, so everything older is at least as old as
      // the gap and the window would straddle it.
      if (!Number.isFinite(close) || !Number.isFinite(high) || !Number.isFinite(low)) break
      const volume = r.volume === null ? null : Number(r.volume)
      bars.push({ day: r.day, close, high, low, volume: Number.isFinite(volume as number) ? (volume as number) : null })
    }

    if (bars.length < minBars) return null

    const ageDays = (Date.now() - new Date(bars[0].day + "T00:00:00Z").getTime()) / 86400000
    if (ageDays > MAX_STALE_DAYS) return null

    return bars
  } catch {
    return null
  }
}
