import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/auth"
import { API_COSTS, getCostSummary } from "@/lib/api-costs"
import { hasRawKey, isServiceDisabled, getDisabledServices, getMonthlyBudgetTarget } from "@/lib/api-keys"
import {
  getCallStats,
  getRecentCalls,
  getSupabaseDailyRollup,
  getSupabaseMonthlyByProvider,
  isSupabaseMeteringConfigured,
  type DailyRollupRow,
  type MonthlyUsageRow,
} from "@/lib/metered-fetch"

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const summary = getCostSummary()
  const budgetTarget = getMonthlyBudgetTarget()

  // Merge cost metadata with live control state.
  //
  // A-13 / P7-9. This used to attach `usageCount` and `lastUsedISO` from
  // lib/api-usage.ts. That module's writer, `recordApiUsage`, was called from
  // nowhere in the repo, so the counter was structurally incapable of moving
  // and every service reported `0` with `?? 0` — a fabricated measurement,
  // exactly the shape CLAUDE.md's "missing data is null, never 0" rule
  // forbids. The component had already stopped rendering it; the field stayed
  // on the wire, which only moved the trap one layer out. The module is
  // deleted. Measured per-call counts live in `realUsage` below, from
  // lib/metered-fetch.ts, which is wired to the calls that actually happen.
  const services = API_COSTS.map((cost) => {
    const keyPresent = hasRawKey(cost.key)
    const disabled = isServiceDisabled(cost.key)
    // "active" = we are actually able to call it (key present and not killed).
    const active = keyPresent && !disabled
    return {
      ...cost,
      keyPresent,
      disabled,
      active,
      // Effective spend: a disabled or unconfigured paid API costs nothing.
      effectiveCost: active ? cost.monthlyCost : 0,
    }
  })

  const effectiveMonthly = services.reduce((sum, s) => sum + s.effectiveCost, 0)

  // Real per-call metering (lib/metered-fetch.ts) — measured calls, not estimates.
  // Durable tier: Supabase daily rollup, used when SUPABASE_URL +
  // SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) are configured.
  // Otherwise: the in-memory ring buffer, which is PER-INSTANCE and resets on
  // every serverless cold start — labeled "memory-ephemeral" so nobody mistakes
  // it for complete accounting.
  let dailyRollup: DailyRollupRow[] | null = null
  let monthlyByProvider: MonthlyUsageRow[] | null = null
  if (isSupabaseMeteringConfigured()) {
    // Both durable rollups in parallel — the daily table and the per-month
    // per-provider view (migration 0014). Monthly is null until that migration
    // is applied, and the UI renders an empty state for that.
    ;[dailyRollup, monthlyByProvider] = await Promise.all([
      getSupabaseDailyRollup(30),
      getSupabaseMonthlyByProvider(6),
    ])
  }
  const realUsage = {
    source: dailyRollup !== null ? ("supabase" as const) : ("memory-ephemeral" as const),
    note:
      dailyRollup !== null
        ? "Durable per-call metering from the Supabase api_calls_daily rollup (last 30 days), plus this instance's live ring buffer."
        : "Per-instance in-memory ring buffer only: counts reset on every serverless cold start and are not shared across instances. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for durable metering.",
    daily: dailyRollup, // null when Supabase is unavailable
    monthly: monthlyByProvider, // null when Supabase is unavailable or 0014 not yet applied
    stats: getCallStats(),
    recent: getRecentCalls().slice(-50),
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    summary,
    realUsage,
    controls: {
      budgetTarget,
      effectiveMonthly,
      overBudget: effectiveMonthly > budgetTarget,
      disabledServices: getDisabledServices(),
    },
    services,
  })
}
