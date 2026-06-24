// Progressive AI endpoint for the earnings/economic calendar.
// The main /api/earnings-calendar route returns the calendar data FAST
// (when called with ?skipAI=true) so the UI can render immediately.
// The client then POSTs the rendered items here and we fill in AI explainers
// + the weekly insights asynchronously — perceived latency drops from ~75s
// to ~2s for first paint.

import { NextResponse } from "next/server"
import {
  generateEarningsExplainer,
  generateEconomicExplainer,
  generateWeeklyInsights,
} from "@/lib/earnings-calendar-ai"

export const maxDuration = 60

interface EarningsItem {
  ticker: string
  company?: string
  estimate?: string
}
interface EconomicItem {
  event: string
  impact?: string
  forecast?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      earnings?: EarningsItem[]
      economic?: EconomicItem[]
      label?: string
    }

    const earnings = body.earnings || []
    const economic = body.economic || []
    const label = body.label || ""

    // Fire all three workloads in parallel — bounded by the AI provider's rate limit.
    const [earningsExplainers, economicExplainers, weekly] = await Promise.all([
      Promise.all(
        earnings.map(async (e) => ({
          ticker: e.ticker,
          aiExplainer: await generateEarningsExplainer(e.ticker, e.company || e.ticker, e.estimate || "EPS TBD"),
        })),
      ),
      Promise.all(
        economic.map(async (e) => ({
          event: e.event,
          aiExplainer: await generateEconomicExplainer(e.event, e.impact || "Medium", e.forecast || "—"),
        })),
      ),
      generateWeeklyInsights(
        earnings.map((e) => ({ ticker: e.ticker })),
        economic.map((e) => ({ event: e.event, impact: e.impact })),
        label,
      ),
    ])

    return NextResponse.json({
      success: true,
      earningsExplainers, // [{ticker, aiExplainer}]
      economicExplainers, // [{event, aiExplainer}]
      earningsInsights: weekly.earningsInsights,
      economicInsights: weekly.economicInsights,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error("[v0] Calendar insights error:", err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: "Failed to generate insights" }, { status: 500 })
  }
}
