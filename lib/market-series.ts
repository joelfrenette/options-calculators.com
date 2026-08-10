/**
 * Generic named daily-series store — E-8a (reused by E-7b).
 *
 * Thin wrapper over the Supabase `market_series` table: upsert one (series,
 * day, value) point; read latest value + its percentile within the series'
 * own stored history. Percentile-of-self is the house normalization after
 * P6-14 (a hardcoded range clamped retail-MMF at max-euphoria for months).
 *
 * Honesty: below `minHistory` points the reader returns pct: null — callers
 * drop the component from composites instead of scoring a thin sample. The
 * raw latest value is still returned for display.
 */

import { getMeteringSupabaseConfig } from "@/lib/metered-fetch"

/** Batch upsert — one PostgREST POST per 500-row chunk (E-7b: a FRED backfill
 * is thousands of points; per-point POSTs would be thousands of round trips). */
export async function upsertSeriesPoints(points: { series: string; day: string; value: number }[]): Promise<number> {
  const cfg = getMeteringSupabaseConfig()
  const rows = points.filter((p) => Number.isFinite(p.value))
  if (!cfg || rows.length === 0) return 0
  let stored = 0
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    try {
      const res = await fetch(`${cfg.url}/rest/v1/market_series?on_conflict=series,day`, {
        method: "POST",
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(chunk),
        signal: AbortSignal.timeout(15000),
      })
      if (res.ok) stored += chunk.length
    } catch {
      // chunk lost; caller sees the shortfall in the returned count
    }
  }
  return stored
}

/** Recent history for one series, newest first. Same 800-row ceiling note as
 * latestWithPercentile — single series stays under the PostgREST 1000 cap. */
export async function getSeriesHistory(series: string, limit = 400): Promise<{ day: string; value: number }[] | null> {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return null

  // PAGINATED, and it has to be. PostgREST enforces its own `db-max-rows`
  // (1000 on Supabase by default) and silently returns that many however large
  // a `limit` you ask for. A single request therefore CANNOT read a deep
  // series, and the truncation is invisible: the caller gets a well-formed
  // array of the most recent 1000 points and no indication that 10,000 more
  // exist. The first lead-time backtest ran against 1,000 days of a 44-year
  // series and produced confident zeros — the exact failure this codebase has
  // spent a fortnight removing, reintroduced by a server default nobody set.
  const PAGE = 1000
  const want = Math.min(20000, Math.max(1, limit))
  const headers = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }
  const out: { day: string; value: number }[] = []

  try {
    for (let offset = 0; offset < want; offset += PAGE) {
      const size = Math.min(PAGE, want - offset)
      const res = await fetch(
        `${cfg.url}/rest/v1/market_series?series=eq.${encodeURIComponent(series)}&select=day,value&order=day.desc&limit=${size}&offset=${offset}`,
        { headers, signal: AbortSignal.timeout(15000), cache: "no-store" },
      )
      if (!res.ok) return out.length > 0 ? out : null
      const rows = (await res.json()) as { day: string; value: string | number }[]
      if (!Array.isArray(rows) || rows.length === 0) break
      for (const r of rows) {
        const value = Number(r.value)
        if (Number.isFinite(value)) out.push({ day: r.day, value })
      }
      // A short page means the series is exhausted; asking again would only
      // cost a round trip to be told the same thing.
      if (rows.length < size) break
    }
    return out
  } catch {
    // Partial data is still data — and returning null here would look
    // identical to an empty store, which is the confusion this whole fix is
    // about. Callers can see the length.
    return out.length > 0 ? out : null
  }
}

export async function upsertSeriesPoint(series: string, day: string, value: number): Promise<boolean> {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg || !Number.isFinite(value)) return false
  try {
    const res = await fetch(`${cfg.url}/rest/v1/market_series?on_conflict=series,day`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ series, day, value }),
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function latestWithPercentile(
  series: string,
  minHistory = 8,
): Promise<{ value: number; day: string; pct: number | null; n: number } | null> {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return null
  try {
    // One series, daily points, 400-day retention ceiling — well under the
    // PostgREST 1000-row cap that broke the breadth JS compute (0006 lesson).
    const res = await fetch(
      `${cfg.url}/rest/v1/market_series?series=eq.${encodeURIComponent(series)}&select=day,value&order=day.desc&limit=800`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }, signal: AbortSignal.timeout(6000), cache: "no-store" },
    )
    if (!res.ok) return null
    const rows = (await res.json()) as { day: string; value: string | number }[]
    if (!Array.isArray(rows) || rows.length === 0) return null
    const values = rows.map((r) => Number(r.value)).filter((v) => Number.isFinite(v))
    const latest = values[0]
    if (values.length < minHistory) {
      return { value: latest, day: rows[0].day, pct: null, n: values.length }
    }
    const below = values.filter((v) => v < latest).length
    return { value: latest, day: rows[0].day, pct: below / values.length, n: values.length }
  } catch {
    return null
  }
}

/**
 * Per-series coverage: how many points are stored and the span they cover.
 *
 * Written for CCPI Phase 1. A backfill reports `totalStored`, which counts rows
 * WRITTEN, not rows that survived — an upsert overwriting the same 800 days
 * reports the same healthy number as one loading 25 years. The only way to know
 * a deep load landed is to ask the store what it now holds, and the earliest
 * day it holds is the number that decides which reference drawdowns are
 * testable at all.
 *
 * Uses PostgREST aggregates rather than pulling rows: counting 9,000 points by
 * fetching them would be a slow way to answer a cheap question.
 */
export async function getSeriesCoverage(
  series: string,
): Promise<{ series: string; points: number; earliest: string | null; latest: string | null } | null> {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return null
  const base = `${cfg.url}/rest/v1/market_series?series=eq.${encodeURIComponent(series)}`
  const headers = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }
  try {
    const [countRes, firstRes, lastRes] = await Promise.all([
      fetch(`${base}&select=day`, {
        headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      }),
      fetch(`${base}&select=day&order=day.asc&limit=1`, { headers, signal: AbortSignal.timeout(6000), cache: "no-store" }),
      fetch(`${base}&select=day&order=day.desc&limit=1`, { headers, signal: AbortSignal.timeout(6000), cache: "no-store" }),
    ])
    if (!countRes.ok || !firstRes.ok || !lastRes.ok) return null
    // content-range comes back as "0-0/1234"; the total is what matters.
    const range = countRes.headers.get("content-range") || ""
    const total = Number.parseInt(range.split("/")[1] ?? "", 10)
    const first = (await firstRes.json()) as { day: string }[]
    const last = (await lastRes.json()) as { day: string }[]
    return {
      series,
      points: Number.isFinite(total) ? total : 0,
      earliest: first?.[0]?.day ?? null,
      latest: last?.[0]?.day ?? null,
    }
  } catch {
    return null
  }
}
