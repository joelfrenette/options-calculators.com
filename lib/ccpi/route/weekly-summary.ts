/**
 * The weekly summary sentence /api/ccpi publishes alongside the score.
 *
 * Split out of `app/api/ccpi/route.ts` (P6-13) unchanged.
 */
import type { PillarResult, Regime } from "@/lib/ccpi/scoring"

export function generateWeeklySummary(
  ccpi: number,
  confidence: number,
  regime: Regime,
  pillars: { momentum: PillarResult; riskAppetite: PillarResult; valuation: PillarResult; macro: PillarResult },
  canaries: Array<{ signal: string; pillar: string; severity: "high" | "medium" | "low" }>,
) {
  const show = (r: PillarResult) => (r.score === null ? "n/a (insufficient data)" : `${r.score}/100`)
  return {
    headline: `CCPI at ${ccpi} (${regime.name}) with ${confidence}% data certainty`,
    bullets: [
      `Momentum pillar at ${show(pillars.momentum)}`,
      `Risk Appetite pillar at ${show(pillars.riskAppetite)}`,
      `${canaries.length} active warning signals`,
    ],
  }
}
