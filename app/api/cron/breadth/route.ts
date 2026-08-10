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
  // 320 raised to 9,000 to match retention (migration 0011) and the
  // market-snapshot route. This is the route that computes breadth BACKWARDS
  // over stored closes, so a 320-day cap put a hard ceiling on how far the
  // breadth-divergence signal could ever be backtested — regardless of how
  // much close history was bought. Fourth silent clamp found today.
  const requestedBackfill = Math.max(0, Number.parseInt(url.searchParams.get("backfill") || "0", 10) || 0)
  const backfillDays = Math.min(9000, requestedBackfill)

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
      // Report the clamp instead of applying it silently. Four caps found on
      // 2026-08-10 truncated a request and returned ok:true, which reads as
      // success and sends the caller debugging the wrong thing.
      ...(requestedBackfill > backfillDays
        ? { backfillClamped: { requested: requestedBackfill, applied: backfillDays } }
        : {}),
      breadth,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
