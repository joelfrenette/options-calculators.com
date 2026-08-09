import { NextResponse } from "next/server"
import { getMeteringSupabaseConfig } from "@/lib/metered-fetch"
import { BREADTH_UNIVERSE, BREADTH_UNIVERSE_AS_OF } from "@/lib/breadth-universe"
import {
  runBreadthBacktest,
  DEFAULT_SIGNAL,
  DRAWDOWN_EPISODES,
  type BreadthPoint,
  type SignalConfig,
} from "@/lib/breadth-backtest"

/**
 * Breadth lead-time backtest — E-7e.
 *
 * Reads the computed breadth series and reports whether it warned ahead of
 * real drawdown starts. This is the evidence for the E-6 gate: breadth earns
 * CCPI scoring weight only on demonstrated lead time, and until then it is
 * display-and-canary only.
 *
 * Two things this route will not do:
 *  - it will not report a lead time for an episode the stored series cannot
 *    cover (`covered: false`, with the reason)
 *  - it will not let "insufficient history" read as a pass — that is its own
 *    verdict, and it is the expected answer until a deep backfill has run
 *
 * `?recompute=1` runs compute_breadth_range() first, filling every stored day
 * that has a full 200-close lookback. That is a full-history window pass, so
 * it is opt-in rather than the default.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 120

async function fetchBreadthSeries(): Promise<BreadthPoint[] | null> {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return null
  // 1200 rows: above the ~1100-day retention window, and PostgREST's 1000-row
  // default cap is lifted by an explicit limit.
  const res = await fetch(
    `${cfg.url}/rest/v1/breadth_daily?select=day,pct_above_200dma&order=day.asc&limit=1200`,
    { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }, signal: AbortSignal.timeout(15000) },
  )
  if (!res.ok) return null
  const rows = (await res.json()) as { day: string; pct_above_200dma: string | number }[] | null
  if (!Array.isArray(rows)) return null
  return rows.map((r) => ({ day: r.day, pct: Number(r.pct_above_200dma) })).filter((p) => Number.isFinite(p.pct))
}

async function recomputeRange(): Promise<{ ok: boolean; daysWritten: number; detail: string }> {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return { ok: false, daysWritten: 0, detail: "Supabase not configured" }
  const res = await fetch(`${cfg.url}/rest/v1/rpc/compute_breadth_range`, {
    method: "POST",
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ universe_n: BREADTH_UNIVERSE.length }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) {
    return {
      ok: false,
      daysWritten: 0,
      detail: `compute_breadth_range RPC failed: HTTP ${res.status}. Migration 0010 may not be applied.`,
    }
  }
  const rows = await res.json()
  const n = Array.isArray(rows) ? rows.length : 0
  return { ok: n > 0, daysWritten: n, detail: n > 0 ? `${n} day(s) computed` : "no day has a full 200-close lookback yet" }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const recompute = url.searchParams.get("recompute") === "1"

    const num = (name: string, fallback: number) => {
      const raw = Number.parseFloat(url.searchParams.get(name) ?? "")
      return Number.isFinite(raw) ? raw : fallback
    }
    const config: SignalConfig = {
      threshold: num("threshold", DEFAULT_SIGNAL.threshold),
      sustainDays: Math.max(1, Math.round(num("sustainDays", DEFAULT_SIGNAL.sustainDays))),
      lookbackDays: Math.max(1, Math.round(num("lookbackDays", DEFAULT_SIGNAL.lookbackDays))),
      horizonDays: Math.max(1, Math.round(num("horizonDays", DEFAULT_SIGNAL.horizonDays))),
    }

    const recomputed = recompute ? await recomputeRange() : null

    const series = await fetchBreadthSeries()
    if (series === null) {
      // The store is unreachable — that is not "no lead", it is no answer.
      return NextResponse.json(
        {
          error: "Breadth series unavailable: the store could not be read.",
          recomputed,
        },
        { status: 503 },
      )
    }

    const result = runBreadthBacktest(series, config, DRAWDOWN_EPISODES)

    return NextResponse.json({
      ...result,
      universe: { size: BREADTH_UNIVERSE.length, asOf: BREADTH_UNIVERSE_AS_OF },
      recomputed,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] breadth-backtest error:", error)
    return NextResponse.json(
      { error: "Failed to run the breadth backtest", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
