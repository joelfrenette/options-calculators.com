import { NextResponse } from "next/server"
import { isAuthenticated } from "@/lib/auth"
import { API_COSTS, getCostSummary } from "@/lib/api-costs"
import { getUsageStats } from "@/lib/api-usage"
import { hasRawKey, isServiceDisabled, getDisabledServices, getMonthlyBudgetTarget } from "@/lib/api-keys"
import {
  getCallStats,
  getRecentCalls,
  getSupabaseDailyRollup,
  isSupabaseMeteringConfigured,
  type DailyRollupRow,
} from "@/lib/metered-fetch"

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const usage = getUsageStats()
  const summary = getCostSummary()
  const budgetTarget = getMonthlyBudgetTarget()

  // Merge cost metadata with live control state and usage counts.
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
      usageCount: usage[cost.key]?.count ?? 0,
      lastUsedISO: usage[cost.key]?.lastUsedISO ?? null,
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
  if (isSupabaseMeteringConfigured()) {
    dailyRollup = await getSupabaseDailyRollup(30)
  }
  const realUsage = {
    source: dailyRollup !== null ? ("supabase" as const) : ("memory-ephemeral" as const),
    note:
      dailyRollup !== null
        ? "Durable per-call metering from the Supabase api_calls_daily rollup (last 30 days), plus this instance's live ring buffer."
        : "Per-instance in-memory ring buffer only: counts reset on every serverless cold start and are not shared across instances. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for durable metering.",
    daily: dailyRollup, // null when Supabase is unavailable
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
