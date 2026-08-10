import { NextResponse } from "next/server"
import { resolveApiKey } from "@/lib/api-keys"
import { checkCronAuth } from "@/lib/cron-auth"
import { runClosesSnapshot, runFredSnapshot, runComputedIndicators } from "@/lib/market-snapshot"

/**
 * Consolidated close-time market snapshot — E-7c.
 *
 * One cron, three steps, in order:
 *   1. Polygon grouped daily closes  → market_closes
 *   2. FRED series                   → market_series
 *   3. Computed indicators (breadth, VIX term structure) from what 1 and 2
 *      just stored
 *
 * Step 3 is why this is one cron and not three. Breadth and the VIX ratio are
 * DERIVED from the first two steps, and two independently scheduled crons
 * cannot guarantee that ordering — a slow FRED run and the old fixed 15-minute
 * gap would have computed indicators against yesterday's inputs.
 *
 * A failing step does not abort the ones after it: FRED being down is no
 * reason to skip storing closes. Each step reports its own ok flag and the
 * response is ok only when all three are.
 *
 * The per-job routes (/api/cron/breadth, /api/cron/fred-snapshot) remain as
 * thin wrappers over the same functions, so the existing `?backfill=` URLs
 * keep working for one-off history loads.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: Request) {
  const auth = checkCronAuth(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const url = new URL(request.url)
  // Caps raised to match retention (migration 0011 keeps 9,000 days) and the
  // fred-snapshot route (20,000). They were 320 and 800 — set when the deepest
  // consumer was a 200-day moving average — and both silently truncated a
  // deeper request instead of refusing it, which is how a backfill "succeeds"
  // and leaves a partial history that looks complete.
  const closesBackfill = Math.min(9000, Math.max(0, Number.parseInt(url.searchParams.get("closesBackfill") || "0", 10) || 0))
  const fredBackfill = Math.min(20000, Math.max(0, Number.parseInt(url.searchParams.get("fredBackfill") || "0", 10) || 0))

  const polygonKey = resolveApiKey("POLYGON_API_KEY")
  const fredKey = resolveApiKey("FRED_API_KEY")

  const steps: Record<string, unknown> = {}
  let allOk = true

  // ---- 1. closes ----
  if (polygonKey) {
    try {
      const closes = await runClosesSnapshot(polygonKey, closesBackfill)
      steps.closes = closes
      allOk &&= closes.ok
    } catch (err) {
      steps.closes = { ok: false, error: err instanceof Error ? err.message : String(err) }
      allOk = false
    }
  } else {
    steps.closes = { ok: false, error: "POLYGON_API_KEY not configured" }
    allOk = false
  }

  // ---- 2. FRED ----
  if (fredKey) {
    try {
      const fred = await runFredSnapshot(fredKey, fredBackfill)
      steps.fred = fred
      allOk &&= fred.ok
    } catch (err) {
      steps.fred = { ok: false, error: err instanceof Error ? err.message : String(err) }
      allOk = false
    }
  } else {
    steps.fred = { ok: false, error: "FRED_API_KEY not configured" }
    allOk = false
  }

  // ---- 3. computed indicators ----
  try {
    const computed = await runComputedIndicators()
    steps.computed = computed
    allOk &&= computed.breadth.ok && computed.vixTermStructure.ok
  } catch (err) {
    steps.computed = { ok: false, error: err instanceof Error ? err.message : String(err) }
    allOk = false
  }

  return NextResponse.json({
    ok: allOk,
    mode: closesBackfill > 0 || fredBackfill > 0 ? "backfill" : "daily",
    steps,
    ranAt: new Date().toISOString(),
  })
}
