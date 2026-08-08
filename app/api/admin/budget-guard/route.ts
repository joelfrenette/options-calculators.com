import { NextResponse } from "next/server"
import { isAuthenticated } from "@/lib/auth"
import {
  getGuardStatus,
  clearBudgetGuard,
  tripBudgetGuard,
  getSpendReport,
  resetBudgetGuardCache,
} from "@/lib/budget-guard"
import { isSupabaseMeteringConfigured } from "@/lib/metered-fetch"
import { TOKEN_PRICES_AS_OF } from "@/lib/api-costs"

/**
 * Admin budget-guard panel — AUDIT_BACKLOG E-5.
 *
 *   GET           current spend vs hard stops, plus the kill-flag state.
 *   POST {clear}  re-enable paid APIs after a shutoff.
 *   POST {trip}   trip it by hand (a panic button, and the only way to test the
 *                 cutoff end-to-end without actually spending $50).
 *
 * Session-gated: this endpoint can cut off every paid API, so it must never be
 * reachable without the admin cookie.
 */

export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const status = await getGuardStatus()

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    ...status,
    metering: {
      configured: isSupabaseMeteringConfigured(),
      // Says plainly what the numbers are, so nobody reads them as a vendor bill.
      note: `Spend is ESTIMATED from vendor list prices recorded ${TOKEN_PRICES_AS_OF} (lib/api-costs.ts) applied to metered token counts. It is not an invoice and will differ from one. Day boundaries are UTC.`,
    },
  })
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { action?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected a JSON body with an `action` field." }, { status: 400 })
  }

  if (body.action === "clear") {
    const ok = await clearBudgetGuard("admin")
    if (!ok) {
      // Real error status, not 200-with-an-error-body (house rule).
      return NextResponse.json(
        { error: "Could not clear the kill flag — Supabase write failed. Paid APIs are still cut off." },
        { status: 502 },
      )
    }
    resetBudgetGuardCache()
    return NextResponse.json({ ok: true, action: "cleared", state: (await getGuardStatus()).state })
  }

  if (body.action === "trip") {
    const spend = await getSpendReport()
    const ok = await tripBudgetGuard({
      reason: "manual",
      spendUsd: spend.daily.usd,
      thresholdUsd: spend.dailyHardStop,
    })
    if (!ok) {
      return NextResponse.json(
        { error: "Could not write the kill flag — Supabase write failed. Paid APIs are NOT cut off." },
        { status: 502 },
      )
    }
    resetBudgetGuardCache()
    return NextResponse.json({ ok: true, action: "tripped", state: (await getGuardStatus()).state })
  }

  return NextResponse.json({ error: 'Unknown action. Expected "clear" or "trip".' }, { status: 400 })
}
