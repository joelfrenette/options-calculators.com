/**
 * Close-time snapshot jobs — E-7c.
 *
 * The three pieces of the daily snapshot, extracted from the cron routes that
 * used to own them so one consolidated cron can run them IN ORDER:
 *
 *   1. runClosesSnapshot   — one Polygon grouped-daily call → market_closes
 *   2. runFredSnapshot     — every FRED series the site reads → market_series
 *   3. runComputedIndicators — breadth RPC + VIX term structure, from what
 *                              steps 1 and 2 just stored
 *
 * Order matters: step 3 derives from steps 1 and 2, and two independent crons
 * 15 minutes apart could not guarantee that. The original routes stay as thin
 * wrappers so the `?backfill=` URLs already in use keep working.
 *
 * Honesty rules carried over from E-6a: a day's breadth divides ONLY by tickers
 * holding a full 200 closes, and no data means no row — never a guessed one.
 */

import { meteredFetch, getMeteringSupabaseConfig } from "@/lib/metered-fetch"
import { upsertSeriesPoints, upsertSeriesPoint, getSeriesHistory } from "@/lib/market-series"
import { BREADTH_UNIVERSE, BREADTH_UNIVERSE_AS_OF } from "@/lib/breadth-universe"
import { computeTermStructure } from "@/lib/vix-term"

/**
 * Index proxies charted by /api/trend-analysis. They are ordinary US-listed
 * ETFs, so the grouped-daily response already contains them — storing them
 * costs no extra API call and takes that tab off per-view Yahoo pulls.
 *
 * ^SPX is deliberately absent: Polygon's grouped stock endpoint carries no
 * indices, so that symbol stays on its live fetch.
 */
export const CHART_TICKERS = ["SPY", "QQQ"] as const

/** Every ticker whose daily close the snapshot stores. */
export const STORED_TICKERS: string[] = [...BREADTH_UNIVERSE, ...CHART_TICKERS]

// Every FRED series consumed anywhere on the site (ccpi, fomc-predictions,
// cpi-inflation, jobs-report, macro-indicators, panic-euphoria, vix term
// structure).
// dailyLimit = observations re-pulled each run: enough to absorb revisions
// and posting lag at each series' cadence.
export const FRED_SERIES: { id: string; cadence: "daily" | "weekly" | "monthly" | "quarterly"; dailyLimit: number }[] =
  [
    { id: "DFF", cadence: "daily", dailyLimit: 8 },
    { id: "DGS10", cadence: "daily", dailyLimit: 8 },
    { id: "DGS2", cadence: "daily", dailyLimit: 8 }, // 2Y constant maturity (fomc-predictions yield curve)
    { id: "T10Y2Y", cadence: "daily", dailyLimit: 8 },
    { id: "BAMLH0A0HYM2", cadence: "daily", dailyLimit: 8 },
    { id: "DTWEXBGS", cadence: "daily", dailyLimit: 8 },
    { id: "RRPONTSYD", cadence: "daily", dailyLimit: 8 },
    { id: "TEDRATE", cadence: "daily", dailyLimit: 8 }, // discontinued 2022; kept for the stored tail
    // E-7c: spot VIX and the Cboe 3-month index. Previously fetched live per
    // CCPI load by lib/vix-term-structure.ts; stored here so the ratio is
    // computed once a day and the tab stops depending on FRED being up.
    { id: "VIXCLS", cadence: "daily", dailyLimit: 8 },
    { id: "VXVCLS", cadence: "daily", dailyLimit: 8 },
    { id: "GASREGW", cadence: "weekly", dailyLimit: 4 },
    { id: "WRMFSL", cadence: "weekly", dailyLimit: 4 }, // retail MMF (panic-euphoria)
    { id: "BOGZ1FL663067003Q", cadence: "quarterly", dailyLimit: 2 }, // Z.1 margin debt (panic-euphoria)
    { id: "UNRATE", cadence: "monthly", dailyLimit: 3 },
    { id: "CPIAUCSL", cadence: "monthly", dailyLimit: 3 },
    { id: "CPILFESL", cadence: "monthly", dailyLimit: 3 },
    { id: "PCEPI", cadence: "monthly", dailyLimit: 3 },
    { id: "PAYEMS", cadence: "monthly", dailyLimit: 3 },
    { id: "U6RATE", cadence: "monthly", dailyLimit: 3 }, // broad unemployment (jobs-report)
    { id: "CES0500000003", cadence: "monthly", dailyLimit: 3 }, // avg hourly earnings (jobs-report)
    { id: "M2SL", cadence: "monthly", dailyLimit: 3 },
    { id: "PPIACO", cadence: "monthly", dailyLimit: 3 },
    { id: "A191RL1Q225SBEA", cadence: "quarterly", dailyLimit: 2 },
    { id: "GFDEGDQ188S", cadence: "quarterly", dailyLimit: 2 },
  ]

// ---------------------------------------------------------------------------
// 1. Daily closes
// ---------------------------------------------------------------------------

export interface ClosesResult {
  ok: boolean
  mode: "daily" | "backfill"
  day: string | null
  tickersStored: number
  universeAsOf: string
  failedTickers?: string[]
  error?: string
}

/**
 * A stored bar. high/low/volume are nullable because rows written before
 * migration 0009 have none — never substitute the close for a missing leg, a
 * bar whose high and low equal the close is a fabricated zero-range day.
 */
export interface CloseRow {
  ticker: string
  day: string
  close: number
  high: number | null
  low: number | null
  volume: number | null
}

/** Polygon bars carry h/l/v alongside c; they were simply being discarded. */
function toRow(ticker: string, day: string, b: any): CloseRow {
  return {
    ticker,
    day,
    close: b.c,
    high: Number.isFinite(b.h) ? b.h : null,
    low: Number.isFinite(b.l) ? b.l : null,
    volume: Number.isFinite(b.v) ? Math.round(b.v) : null,
  }
}

async function upsertCloses(rows: CloseRow[]): Promise<boolean> {
  const cfg = getMeteringSupabaseConfig()
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

export async function runClosesSnapshot(polygonKey: string, backfillDays = 0): Promise<ClosesResult> {
  if (backfillDays > 0) {
    // Per-ticker history: ~100 metered calls, one-time.
    const to = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - backfillDays * 1.6 * 86400000).toISOString().slice(0, 10) // pad weekends
    let stored = 0
    const failed: string[] = []
    for (const t of STORED_TICKERS) {
      const r = await meteredFetch(
        "polygon",
        `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(t)}/range/1/day/${from}/${to}?adjusted=true&sort=desc&limit=${backfillDays + 30}&apiKey=${polygonKey}`,
        { signal: AbortSignal.timeout(15000), routeTag: "/api/cron/market-snapshot:backfill" },
      )
      if (!r.ok) {
        failed.push(`${t}:${r.status}`)
        continue
      }
      const j = await r.json()
      const bars = Array.isArray(j?.results) ? j.results : []
      const rows = bars.map((b: any) => toRow(t, new Date(b.t).toISOString().slice(0, 10), b))
      if (await upsertCloses(rows)) stored += rows.length
    }
    return {
      ok: failed.length < STORED_TICKERS.length / 2,
      mode: "backfill",
      day: to,
      tickersStored: stored,
      universeAsOf: BREADTH_UNIVERSE_AS_OF,
      failedTickers: failed,
    }
  }

  // Daily mode: one grouped call for the latest completed trading day.
  // Try today backwards up to 5 days to find the last session.
  const wanted = new Set(STORED_TICKERS)
  let day = ""
  let closes: CloseRow[] = []
  for (let back = 0; back < 6; back++) {
    const d = new Date(Date.now() - back * 86400000).toISOString().slice(0, 10)
    const r = await meteredFetch(
      "polygon",
      `https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${d}?adjusted=true&apiKey=${polygonKey}`,
      { signal: AbortSignal.timeout(30000), routeTag: "/api/cron/market-snapshot" },
    )
    if (!r.ok) continue
    const j = await r.json()
    const bars = Array.isArray(j?.results) ? j.results : []
    if (bars.length === 0) continue
    closes = bars.filter((b: any) => wanted.has(b.T)).map((b: any) => toRow(b.T, d, b))
    day = d
    break
  }
  if (!day || closes.length === 0) {
    return {
      ok: false,
      mode: "daily",
      day: null,
      tickersStored: 0,
      universeAsOf: BREADTH_UNIVERSE_AS_OF,
      error: "No grouped bars found in the last 6 days.",
    }
  }

  const upserted = await upsertCloses(closes)

  // Opportunistic retention.
  const cfg = getMeteringSupabaseConfig()
  if (cfg) {
    void fetch(`${cfg.url}/rest/v1/rpc/prune_market_closes`, {
      method: "POST",
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(5000),
    }).catch(() => {})
  }

  return {
    ok: upserted,
    mode: "daily",
    day,
    tickersStored: closes.length,
    universeAsOf: BREADTH_UNIVERSE_AS_OF,
  }
}

// ---------------------------------------------------------------------------
// 2. FRED series
// ---------------------------------------------------------------------------

export interface FredResult {
  ok: boolean
  mode: string
  totalStored: number
  failedSeries: string[]
  results: { series: string; fetched: number; stored: number; httpStatus: number }[]
}

export async function runFredSnapshot(fredKey: string, backfill = 0): Promise<FredResult> {
  const results: FredResult["results"] = []
  for (const s of FRED_SERIES) {
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
    } catch {
      results.push({ series: s.id, fetched: 0, stored: 0, httpStatus: 0 })
    }
  }

  const failed = results.filter((r) => r.httpStatus !== 200).map((r) => r.series)
  return {
    ok: failed.length < FRED_SERIES.length / 2,
    mode: backfill > 0 ? `backfill(${backfill})` : "daily",
    totalStored: results.reduce((a, r) => a + r.stored, 0),
    failedSeries: failed,
    results,
  }
}

// ---------------------------------------------------------------------------
// 3. Computed indicators, derived from what steps 1 and 2 just stored
// ---------------------------------------------------------------------------

export interface BreadthResult {
  ok: boolean
  detail: string
  row?: object
}

/**
 * Recompute breadth for the most recent stored day — server-side via the
 * compute_breadth() RPC (migration 0006). The first version read closes back
 * through PostgREST and computed in JS; PostgREST caps responses at 1000 rows
 * (~10 days of a 100-ticker universe), so no ticker ever reached 200 days and
 * the compute always reported "keep backfilling" against a fully-loaded store.
 * SQL has no row cap and does one window pass.
 *
 * universe_n stays BREADTH_UNIVERSE.length: the chart-proxy tickers share the
 * closes table but are NOT breadth constituents, and counting them would
 * change the denominator of a published indicator.
 */
export async function computeBreadth(): Promise<BreadthResult> {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return { ok: false, detail: "Supabase not configured" }

  const res = await fetch(`${cfg.url}/rest/v1/rpc/compute_breadth`, {
    method: "POST",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ universe_n: BREADTH_UNIVERSE.length }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) return { ok: false, detail: `compute_breadth RPC failed: HTTP ${res.status}` }
  const rows = (await res.json()) as { day: string; pct: string | number; sample_size: number; universe_size: number }[]
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, detail: "no ticker has 200 days of history yet — keep backfilling" }
  }
  const r = rows[0]
  return { ok: true, detail: `breadth ${r.pct}% (${r.sample_size}/${r.universe_size} qualified) for ${r.day}`, row: r }
}

/** Series key for the stored VIX3M / spot-VIX ratio. */
export const VIX_TERM_SERIES = "calc:vix_term_structure"

export interface VixTermResult {
  ok: boolean
  detail: string
  day?: string
  spotVIX?: number
  vix3m?: number
  termStructure?: number
  isInverted?: boolean
}

/**
 * VIX term structure from the two series step 2 just stored, written back as a
 * computed series so consumers read one number instead of re-deriving it.
 *
 * Both legs must come from the SAME day. Pairing a stale spot VIX with a fresh
 * VIX3M (or the reverse) manufactures a ratio move out of a data gap, and this
 * ratio crossing 1 is the backwardation signal.
 */
export async function computeVixTermStructure(): Promise<VixTermResult> {
  const [spotRows, vix3mRows] = await Promise.all([
    getSeriesHistory("fred:VIXCLS", 10),
    getSeriesHistory("fred:VXVCLS", 10),
  ])
  if (!spotRows?.length || !vix3mRows?.length) {
    return { ok: false, detail: "VIXCLS/VXVCLS not in the store yet" }
  }

  const vix3mByDay = new Map(vix3mRows.map((r) => [r.day, r.value]))
  const paired = spotRows.find((r) => vix3mByDay.has(r.day))
  if (!paired) {
    return { ok: false, detail: "no day has both VIXCLS and VXVCLS — refusing to pair mismatched dates" }
  }

  const spotVIX = paired.value
  const vix3m = vix3mByDay.get(paired.day) as number
  if (!(spotVIX > 0) || !(vix3m > 0)) {
    return { ok: false, detail: `non-positive VIX values for ${paired.day}` }
  }

  const { termStructure, isInverted } = computeTermStructure(spotVIX, vix3m)
  const stored = await upsertSeriesPoint(VIX_TERM_SERIES, paired.day, termStructure)
  return {
    ok: stored,
    detail: `ratio ${termStructure.toFixed(3)} (${isInverted ? "BACKWARDATION" : "contango"}) for ${paired.day}`,
    day: paired.day,
    spotVIX,
    vix3m,
    termStructure,
    isInverted,
  }
}

export async function runComputedIndicators(): Promise<{ breadth: BreadthResult; vixTermStructure: VixTermResult }> {
  // Independent of each other; both depend on steps 1 and 2 having run.
  const [breadth, vixTermStructure] = await Promise.all([computeBreadth(), computeVixTermStructure()])
  return { breadth, vixTermStructure }
}
