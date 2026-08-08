import { NextResponse } from "next/server"
import { resolveApiKey } from "@/lib/api-keys"
import { meteredFetch } from "@/lib/metered-fetch"
import { upsertSeriesPoints } from "@/lib/market-series"

/**
 * FRED snapshot cron — E-7b.
 *
 * Daily mode (no params): pull the last few observations of every series the
 * site consumes (~17 FRED calls total) and upsert them into `market_series`
 * under `fred:<SERIES_ID>` keys. Routes then read the store instead of
 * re-fetching FRED per page view (sub-second tabs, FRED-outage-proof).
 *
 * Backfill mode (?backfill=obs, cap 800): same sweep with a deep per-series
 * limit, one-time, so history-consumers (FOMC dot history, CPI trend, charts)
 * have depth on day one.
 *
 * Honesty: FRED observations with value "." (not yet posted) are skipped —
 * a missing point is absent from the store, never invented. Revisions are
 * handled by the daily window re-upserting the trailing observations.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 300

// Every FRED series consumed anywhere on the site (ccpi, fomc-predictions,
// cpi-inflation, jobs-report, macro-indicators, panic-euphoria).
// dailyLimit = observations re-pulled each run: enough to absorb revisions
// and posting lag at each series' cadence.
const SERIES: { id: string; cadence: "daily" | "weekly" | "monthly" | "quarterly"; dailyLimit: number }[] = [
  { id: "DFF", cadence: "daily", dailyLimit: 8 },
  { id: "DGS10", cadence: "daily", dailyLimit: 8 },
  { id: "T10Y2Y", cadence: "daily", dailyLimit: 8 },
  { id: "BAMLH0A0HYM2", cadence: "daily", dailyLimit: 8 },
  { id: "DTWEXBGS", cadence: "daily", dailyLimit: 8 },
  { id: "RRPONTSYD", cadence: "daily", dailyLimit: 8 },
  { id: "TEDRATE", cadence: "daily", dailyLimit: 8 }, // discontinued 2022; kept for the stored tail
  { id: "GASREGW", cadence: "weekly", dailyLimit: 4 },
  { id: "UNRATE", cadence: "monthly", dailyLimit: 3 },
  { id: "CPIAUCSL", cadence: "monthly", dailyLimit: 3 },
  { id: "CPILFESL", cadence: "monthly", dailyLimit: 3 },
  { id: "PCEPI", cadence: "monthly", dailyLimit: 3 },
  { id: "PAYEMS", cadence: "monthly", dailyLimit: 3 },
  { id: "M2SL", cadence: "monthly", dailyLimit: 3 },
  { id: "PPIACO", cadence: "monthly", dailyLimit: 3 },
  { id: "A191RL1Q225SBEA", cadence: "quarterly", dailyLimit: 2 },
  { id: "GFDEGDQ188S", cadence: "quarterly", dailyLimit: 2 },
]

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  if (header.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: process.env.CRON_SECRET ? "Unauthorized" : "CRON_SECRET not configured" },
      { status: process.env.CRON_SECRET ? 401 : 503 },
    )
  }
  const fredKey = resolveApiKey("FRED_API_KEY")
  if (!fredKey) {
    return NextResponse.json({ error: "FRED_API_KEY not configured" }, { status: 503 })
  }

  const url = new URL(request.url)
  const backfill = Math.min(800, Math.max(0, Number.parseInt(url.searchParams.get("backfill") || "0", 10) || 0))

  const results: { series: string; fetched: number; stored: number; httpStatus: number }[] = []
  for (const s of SERIES) {
    const limit = backfill > 0 ? backfill : s.dailyLimit
    try {
      const r = await meteredFetch(
        "fred",
        `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&api_key=${fredKey}&file_type=json&sort_order=desc&limit=${limit}`,
        { signal: AbortSignal.timeout(15000), routeTag: "/api/cron/fred-snapshot" },
      )
      if (!r.ok) {
        results.push({ series: s.id, fetched: 0, stored: 0, httpStatus: r.status })
        continue
      }
      const j = await r.json().catch(() => null)
      const obs = Array.isArray(j?.observations) ? j.observations : []
      const points = obs
        .map((o: any) => ({ series: `fred:${s.id}`, day: String(o.date), value: Number.parseFloat(o.value) }))
        .filter((p: { value: number }) => Number.isFinite(p.value))
      const stored = await upsertSeriesPoints(points)
      results.push({ series: s.id, fetched: obs.length, stored, httpStatus: r.status })
    } catch (err) {
      results.push({ series: s.id, fetched: 0, stored: 0, httpStatus: 0 })
    }
  }

  const totalStored = results.reduce((a, r) => a + r.stored, 0)
  const failed = results.filter((r) => r.httpStatus !== 200).map((r) => r.series)
  return NextResponse.json({
    ok: failed.length < SERIES.length / 2,
    mode: backfill > 0 ? `backfill(${backfill})` : "daily",
    totalStored,
    failedSeries: failed,
    results,
  })
}
