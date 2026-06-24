import { NextResponse } from "next/server"
import { isAuthenticated } from "@/lib/auth"
import { API_COSTS, getCostSummary } from "@/lib/api-costs"
import { getUsageStats } from "@/lib/api-usage"
import { hasRawKey, isServiceDisabled, getDisabledServices, getMonthlyBudgetTarget } from "@/lib/api-keys"

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

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    summary,
    controls: {
      budgetTarget,
      effectiveMonthly,
      overBudget: effectiveMonthly > budgetTarget,
      disabledServices: getDisabledServices(),
    },
    services,
  })
}
