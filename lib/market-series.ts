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
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/market_series?series=eq.${encodeURIComponent(series)}&select=day,value&order=day.desc&limit=${Math.min(800, Math.max(1, limit))}`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }, signal: AbortSignal.timeout(6000), cache: "no-store" },
    )
    if (!res.ok) return null
    const rows = (await res.json()) as { day: string; value: string | number }[]
    if (!Array.isArray(rows)) return null
    return rows
      .map((r) => ({ day: r.day, value: Number(r.value) }))
      .filter((r) => Number.isFinite(r.value))
  } catch {
    return null
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
