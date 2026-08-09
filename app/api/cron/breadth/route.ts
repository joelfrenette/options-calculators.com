import { NextResponse } from "next/server"
import { resolveApiKey } from "@/lib/api-keys"
import { checkCronAuth } from "@/lib/cron-auth"
import { runClosesSnapshot, computeBreadth } from "@/lib/market-snapshot"

/**
 * Breadth pipeline — E-6a, now a thin wrapper over the shared jobs.
 *
 * The daily schedule moved to the consolidated /api/cron/market-snapshot
 * (E-7c), which runs the closes pull before the indicators derived from it.
 * This route stays because the one-off backfill URL is in use.
 *
 * Daily mode (no params): ONE Polygon grouped-daily call for the most recent
 * trading day, upsert closes, recompute breadth.
 *
 * Backfill mode (?backfill=days): per-ticker range fetch for the whole stored
 * set (~100 metered Polygon calls, one-time) so the 200-DMA has history on day
 * one instead of warming up for 200 trading days.
 *
 * Honesty rules: a day's breadth divides ONLY by tickers holding a full 200
 * closes (sample_size travels with the number); no data → no row, never a
 * guessed one. Unscored in CCPI until the lead-time backtest (E-6 constraint).
 */

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: Request) {
  const auth = checkCronAuth(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const polygonKey = resolveApiKey("POLYGON_API_KEY")
  if (!polygonKey) {
    return NextResponse.json({ error: "POLYGON_API_KEY not configured" }, { status: 503 })
  }

  const url = new URL(request.url)
  const backfillDays = Math.min(320, Math.max(0, Number.parseInt(url.searchParams.get("backfill") || "0", 10) || 0))

  try {
    const closes = await runClosesSnapshot(polygonKey, backfillDays)
    if (!closes.ok && closes.error) {
      return NextResponse.json({ ok: false, error: closes.error }, { status: 502 })
    }
    const breadth = await computeBreadth()
    return NextResponse.json({
      ok: closes.ok && breadth.ok,
      mode: closes.mode,
      day: closes.day,
      universeAsOf: closes.universeAsOf,
      tickersStored: closes.tickersStored,
      failedTickers: closes.failedTickers,
      breadth,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
