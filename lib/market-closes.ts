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
 * Closes only, for callers that genuinely need no other leg (a moving average
 * of closes, say). Separate from getStoredBars on purpose: requiring OHLC
 * where it is not used would leave those callers empty until the 0009
 * backfill lands, for data that is already in the table today.
 *
 * Newest-first, or null when the store cannot serve `minBars` fresh closes.
 */
export async function getStoredCloses(ticker: string, limit: number, minBars: number): Promise<{ day: string; close: number }[] | null> {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return null

  try {
    const url =
      `${cfg.url}/rest/v1/market_closes` +
      `?ticker=eq.${encodeURIComponent(ticker)}` +
      `&select=day,close&order=day.desc&limit=${limit}`
    const res = await fetch(url, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const rows = (await res.json()) as { day: string; close: string | number }[] | null
    if (!Array.isArray(rows)) return null

    const closes = rows
      .map((r) => ({ day: r.day, close: Number(r.close) }))
      .filter((r) => Number.isFinite(r.close))
    if (closes.length < minBars) return null

    const ageDays = (Date.now() - new Date(closes[0].day + "T00:00:00Z").getTime()) / 86400000
    if (ageDays > MAX_STALE_DAYS) return null

    return closes
  } catch {
    return null
  }
}

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

/**
 * Universe members whose stored history has stopped advancing. (P7-40/P7-41)
 *
 * WHY THIS EXISTS. `MMC` stopped resolving at Polygon on 2026-01-13 and nobody
 * noticed for seven months. The design degraded gracefully — breadth divides
 * only by tickers holding a full 200-day window, so the published percentage
 * stayed honest while `sample_size` quietly read 99/100 — and that is precisely
 * why it went unseen. **Silence is not the same as "nothing to report".**
 *
 * It was found by hand, with a query somebody had to think of running. This
 * makes it something the admin health check asks every time.
 *
 * ABSENCE IS THE SIGNAL, so no API calls are needed: `market-snapshot` writes a
 * row for every ticker the grouped feed returns, so a universe member with no
 * recent row is a member the feed stopped returning. A ticker that was NEVER
 * stored reports too, with `lastDay: null` — otherwise a member that never
 * entered the store would be invisible to a freshness test, which is the
 * never-ran-versus-passed confusion in a new place.
 *
 * @param staleAfterDays how far behind the newest stored day counts as stale.
 *   Six calendar days clears a long weekend plus a holiday.
 */
export async function getStaleUniverseMembers(
  universe: readonly string[],
  staleAfterDays = 6,
): Promise<{ ticker: string; lastDay: string | null; daysBehind: number | null }[] | null> {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return null
  const headers = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }
  const base = `${cfg.url}/rest/v1/market_closes`

  try {
    // The newest day in the whole table is the reference. Using "today" instead
    // would report every ticker as stale whenever the snapshot cron itself has
    // not run — a real problem, but a different one, and conflating them would
    // make this report cry wolf on the morning after any outage.
    const newestRes = await fetch(`${base}?select=day&order=day.desc&limit=1`, {
      headers,
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    })
    if (!newestRes.ok) return null
    const newestRows = (await newestRes.json()) as { day: string }[]
    const newest = newestRows?.[0]?.day
    if (!newest) return null

    const cutoff = new Date(`${newest}T00:00:00Z`)
    cutoff.setUTCDate(cutoff.getUTCDate() - staleAfterDays)
    const cutoffDay = cutoff.toISOString().slice(0, 10)

    // One request: every ticker in the universe that HAS a row at or after the
    // cutoff. Whatever is missing from the answer is stale or unstored.
    const inList = universe.map((t) => `"${t}"`).join(",")
    const freshRes = await fetch(
      `${base}?select=ticker&ticker=in.(${encodeURIComponent(inList)})&day=gte.${cutoffDay}`,
      { headers, signal: AbortSignal.timeout(8000), cache: "no-store" },
    )
    if (!freshRes.ok) return null
    const fresh = new Set(((await freshRes.json()) as { ticker: string }[]).map((r) => r.ticker))

    const stale = universe.filter((t) => !fresh.has(t))
    if (stale.length === 0) return []

    // Only for the few that failed: their actual last day, so the report says
    // "since 2026-01-13" rather than merely "stale".
    return await Promise.all(
      stale.map(async (ticker) => {
        try {
          const res = await fetch(
            `${base}?select=day&ticker=eq.${encodeURIComponent(ticker)}&order=day.desc&limit=1`,
            { headers, signal: AbortSignal.timeout(6000), cache: "no-store" },
          )
          const rows = res.ok ? ((await res.json()) as { day: string }[]) : []
          const lastDay = rows?.[0]?.day ?? null
          const daysBehind =
            lastDay === null
              ? null
              : Math.round(
                  (Date.parse(`${newest}T00:00:00Z`) - Date.parse(`${lastDay}T00:00:00Z`)) / 86_400_000,
                )
          return { ticker, lastDay, daysBehind }
        } catch {
          return { ticker, lastDay: null, daysBehind: null }
        }
      }),
    )
  } catch {
    return null
  }
}
