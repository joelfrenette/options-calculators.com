import { NextResponse } from "next/server"
import { isAuthenticated } from "@/lib/auth"
import { API_COSTS, getCostSummary } from "@/lib/api-costs"
import { getUsageStats } from "@/lib/api-usage"
import { isKeyConfigured } from "@/lib/api-keys"

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const usage = getUsageStats()
  const summary = getCostSummary()

  // Merge cost metadata with live key-configured state and usage counts.
  const services = API_COSTS.map((cost) => ({
    ...cost,
    configured: isKeyConfigured(cost.key),
    usageCount: usage[cost.key]?.count ?? 0,
    lastUsedISO: usage[cost.key]?.lastUsedISO ?? null,
  }))

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    summary,
    services,
  })
}
