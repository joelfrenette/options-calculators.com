import { NextResponse } from "next/server"
import { resolveApiKey } from "@/lib/api-keys"
import { meteredFetch, getMeteringSupabaseConfig } from "@/lib/metered-fetch"
import { BREADTH_UNIVERSE, BREADTH_UNIVERSE_AS_OF } from "@/lib/breadth-universe"

/**
 * Breadth pipeline cron — E-6a.
 *
 * Daily mode (no params): ONE Polygon grouped-daily call for the most recent
 * trading day, upsert closes for the universe, recompute breadth.
 *
 * Backfill mode (?backfill=days): per-ticker range fetch for the whole
 * universe (~100 metered Polygon calls, one-time) so the 200-DMA has history
 * on day one instead of warming up for 200 trading days.
 *
 * Honesty rules: a day's breadth divides ONLY by tickers holding a full 200
 * closes (sample_size travels with the number); no data → no row, never a
 * guessed one. Unscored in CCPI until the lead-time backtest (E-6 constraint).
 */

export const dynamic = "force-dynamic"
export const maxDuration = 300

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

function sb() {
  return getMeteringSupabaseConfig()
}

async function sbUpsertCloses(rows: { ticker: string; day: string; close: number }[]): Promise<boolean> {
  const cfg = sb()
  if (!cfg || rows.length === 0) return false
  // Chunked upserts — PostgREST handles arrays natively.
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(`${cfg.url}/rest/v1/market_closes?on_conflict=ticker,day`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows.slice(i, i + 500)),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return false
  }
  return true
}

/** Recompute breadth for the most recent stored day. */
async function computeBreadth(): Promise<{ ok: boolean; detail: string; row?: object }> {
  const cfg = sb()
  if (!cfg) return { ok: false, detail: "Supabase not configured" }

  // Last 200 trading days of closes for the universe, newest first.
  const res = await fetch(
    `${cfg.url}/rest/v1/market_closes?select=ticker,day,close&order=day.desc&limit=${BREADTH_UNIVERSE.length * 210}`,
    { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }, signal: AbortSignal.timeout(20000), cache: "no-store" },
  )
  if (!res.ok) return { ok: false, detail: `closes read failed: HTTP ${res.status}` }
  const rows = (await res.json()) as { ticker: string; day: string; close: string | number }[]
  if (rows.length === 0) return { ok: false, detail: "no closes stored yet — run backfill" }

  const latestDay = rows[0].day
  const byTicker = new Map<string, number[]>()
  for (const r of rows) {
    const arr = byTicker.get(r.ticker) ?? []
    if (arr.length < 200) arr.push(Number(r.close)) // newest-first, cap at 200
    byTicker.set(r.ticker, arr)
  }

  let above = 0
  let qualified = 0
  for (const t of BREADTH_UNIVERSE) {
    const closes = byTicker.get(t)
    // Full 200-day history required — partial histories do not vote.
    if (!closes || closes.length < 200 || closes[0] === undefined) continue
    const sma200 = closes.reduce((a, b) => a + b, 0) / closes.length
    qualified++
    if (closes[0] > sma200) above++
  }
  if (qualified === 0) return { ok: false, detail: "no ticker has 200 days of history yet — keep backfilling" }

  const row = {
    day: latestDay,
    pct_above_200dma: Math.round((above / qualified) * 10000) / 100,
    sample_size: qualified,
    universe_size: BREADTH_UNIVERSE.length,
  }
  const ins = await fetch(`${cfg.url}/rest/v1/breadth_daily?on_conflict=day`, {
    method: "POST",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(10000),
  })
  if (!ins.ok) return { ok: false, detail: `breadth write failed: HTTP ${ins.status}` }
  return { ok: true, detail: `breadth ${row.pct_above_200dma}% (${above}/${qualified})`, row }
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: process.env.CRON_SECRET ? "Unauthorized" : "CRON_SECRET not configured" }, { status: process.env.CRON_SECRET ? 401 : 503 })
  }
  const polygonKey = resolveApiKey("POLYGON_API_KEY")
  if (!polygonKey) {
    return NextResponse.json({ error: "POLYGON_API_KEY not configured" }, { status: 503 })
  }

  const universe = new Set(BREADTH_UNIVERSE)
  const url = new URL(request.url)
  const backfillDays = Math.min(320, Math.max(0, Number.parseInt(url.searchParams.get("backfill") || "0", 10) || 0))

  try {
    if (backfillDays > 0) {
      // Per-ticker history: ~100 metered calls, one-time.
      const to = new Date().toISOString().slice(0, 10)
      const from = new Date(Date.now() - backfillDays * 1.6 * 86400000).toISOString().slice(0, 10) // pad weekends
      let stored = 0
      let failed: string[] = []
      for (const t of BREADTH_UNIVERSE) {
        const r = await meteredFetch(
          "polygon",
          `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(t)}/range/1/day/${from}/${to}?adjusted=true&sort=desc&limit=${backfillDays + 30}&apiKey=${polygonKey}`,
          { signal: AbortSignal.timeout(15000), routeTag: "/api/cron/breadth:backfill" },
        )
        if (!r.ok) {
          failed.push(`${t}:${r.status}`)
          continue
        }
        const j = await r.json()
        const bars = Array.isArray(j?.results) ? j.results : []
        const rows = bars.map((b: any) => ({
          ticker: t,
          day: new Date(b.t).toISOString().slice(0, 10),
          close: b.c,
        }))
        if (await sbUpsertCloses(rows)) stored += rows.length
      }
      const breadth = await computeBreadth()
      return NextResponse.json({
        ok: failed.length < BREADTH_UNIVERSE.length / 2,
        mode: "backfill",
        universeAsOf: BREADTH_UNIVERSE_AS_OF,
        closesStored: stored,
        failedTickers: failed,
        breadth,
      })
    }

    // Daily mode: one grouped call for the latest completed trading day.
    // Try today backwards up to 5 days to find the last session.
    let day = ""
    let closes: { ticker: string; day: string; close: number }[] = []
    for (let back = 0; back < 6; back++) {
      const d = new Date(Date.now() - back * 86400000).toISOString().slice(0, 10)
      const r = await meteredFetch(
        "polygon",
        `https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${d}?adjusted=true&apiKey=${polygonKey}`,
        { signal: AbortSignal.timeout(30000), routeTag: "/api/cron/breadth" },
      )
      if (!r.ok) continue
      const j = await r.json()
      const bars = Array.isArray(j?.results) ? j.results : []
      if (bars.length === 0) continue
      closes = bars
        .filter((b: any) => universe.has(b.T))
        .map((b: any) => ({ ticker: b.T, day: d, close: b.c }))
      day = d
      break
    }
    if (!day || closes.length === 0) {
      return NextResponse.json({ ok: false, error: "No grouped bars found in the last 6 days." }, { status: 502 })
    }

    const upserted = await sbUpsertCloses(closes)
    // Opportunistic retention.
    const cfg = sb()
    if (cfg) {
      void fetch(`${cfg.url}/rest/v1/rpc/prune_market_closes`, {
        method: "POST",
        headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(5000),
      }).catch(() => {})
    }
    const breadth = await computeBreadth()
    return NextResponse.json({
      ok: upserted && breadth.ok,
      mode: "daily",
      day,
      universeAsOf: BREADTH_UNIVERSE_AS_OF,
      tickersStored: closes.length,
      breadth,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
