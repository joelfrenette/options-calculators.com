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
  const backfill = Math.min(800, Math.max(0, Number.parseInt(url.searchParams.get("backfill") || "0", 10) || 0))

  return NextResponse.json(await runFredSnapshot(fredKey, backfill))
}
