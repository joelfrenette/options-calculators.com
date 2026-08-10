import { NextResponse } from "next/server"
import { resolveApiKey } from "@/lib/api-keys"
import { checkCronAuth } from "@/lib/cron-auth"
import { runFredSnapshot } from "@/lib/market-snapshot"

/**
 * FRED series snapshot — E-7b, now a thin wrapper over the shared job.
 *
 * The daily schedule moved to the consolidated /api/cron/market-snapshot
 * (E-7c), which runs this between the closes pull and the computed indicators
 * that depend on it. This route stays because the one-off backfill URL is in
 * use — `?backfill=800` deep-loads every series' history in a single sweep.
 *
 * Daily mode (no params): pull the last few observations of every series the
 * site consumes and upsert them into `market_series` under `fred:<SERIES_ID>`
 * keys. Routes then read Supabase instead of re-fetching FRED per page view
 * (sub-second tabs, FRED-outage-proof).
 *
 * Backfill mode (?backfill=obs, cap 800): same sweep with a deep per-series
 * limit, so charts have history immediately instead of accumulating it daily.
 *
 * The series list itself now lives in lib/market-snapshot.ts (FRED_SERIES).
 */

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: Request) {
  const auth = checkCronAuth(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const fredKey = resolveApiKey("FRED_API_KEY")
  if (!fredKey) {
    return NextResponse.json({ error: "FRED_API_KEY not configured" }, { status: 503 })
  }

  const url = new URL(request.url)
  // Cap raised 800 -> 20000 for the CCPI lead-time backtest (CCPI_DESIGN.md
  // Phase 1). 800 observations is ~3 years of a daily series; scoring against
  // 2008 needs ~6,300 trading days, and NFCI has 2,900 weekly points back to
  // 1971. The old cap silently truncated any attempt at a deep load.
  const backfill = Math.min(20000, Math.max(0, Number.parseInt(url.searchParams.get("backfill") || "0", 10) || 0))

  // `?series=NFCI,T10Y3M` restricts the run. A deep backfill across all series
  // in one call will not finish inside maxDuration, and a backfill that times
  // out half way leaves a partial history that looks complete.
  const only = (url.searchParams.get("series") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)

  return NextResponse.json(await runFredSnapshot(fredKey, backfill, only))
}
