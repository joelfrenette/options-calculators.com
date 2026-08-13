/**
 * The CCPI audit panel's data structure: the composite check, the data-quality
 * card, and the assembly of the four pillars into one auditable object.
 *
 * Split out of `components/ccpi-audit-admin.tsx` (P6-13) unchanged.
 *
 * NOT YET ASSERTABLE, and saying so rather than implying otherwise. The obvious
 * claim to make about this extraction is that `validateCCPI` — the function
 * deciding whether the panel prints a green "✅ VALID" badge over the site's
 * headline number — can now have assertions on it. It cannot: this file
 * composes four pillar modules through `@/` path aliases, and the check scripts
 * run under plain `node` with relative `.ts` imports, which is why
 * `lib/ccpi/scoring.ts` and `lib/beta.ts` are import-free. Only `./format.ts`
 * inherits that property here.
 *
 * So `validateCCPI` and `buildDataQuality` stay unexported: an export nothing
 * imports is what `check-dead-exports` exists to catch, and exporting them to
 * suggest a coverage that does not exist would be the label-is-a-claim failure
 * this audit is about. Making them testable means making the pillar modules
 * import-free, which is a separate piece of work.
 */
import { PILLAR_WEIGHTS, MIN_SCORED_MAX } from "@/lib/ccpi/scoring"
import { raw } from "./format"
import { buildMomentumPillar } from "./pillars/momentum"
import { buildRiskAppetitePillar } from "./pillars/risk-appetite"
import { buildValuationPillar } from "./pillars/valuation"
import { buildMacroPillar } from "./pillars/macro"

/**
 * Renormalization-aware check of the composite.
 *
 * The old implementation computed `m*.35 + r*.30 + v*.15 + M*.20` — the
 * PRE-REWORK, non-renormalized formula. A null pillar coerced to 0 in that
 * arithmetic, so the badge printed a confident green "✅ VALID" when the
 * numbers happened to line up and a meaningless "⚠️ DISCREPANCY" when they
 * did not. This reproduces `computeBaseCCPI` exactly: skip null pillars,
 * divide by the weight that actually participated.
 */
const validateCCPI = (ccpi: any): { ok: boolean | null; text: string } => {
  const p = ccpi.pillars ?? {}
  const entries: Array<[unknown, number]> = [
    [p.momentum, PILLAR_WEIGHTS.momentum],
    [p.riskAppetite, PILLAR_WEIGHTS.riskAppetite],
    [p.valuation, PILLAR_WEIGHTS.valuation],
    [p.macro, PILLAR_WEIGHTS.macro],
  ]

  let num = 0
  let den = 0
  const dropped: string[] = []
  const names = ["Momentum", "Risk Appetite", "Valuation", "Macro"]
  entries.forEach(([score, weight], i) => {
    if (typeof score !== "number" || !Number.isFinite(score)) {
      dropped.push(names[i])
      return
    }
    num += score * weight
    den += weight
  })

  const reportedBase = ccpi.baseCCPI
  const totalBonus = ccpi.totalBonus
  const finalCCPI = ccpi.ccpi

  if (den === 0) {
    return {
      ok: null,
      text: `⚪ NOT VERIFIABLE: no pillar reported a score, so there is no composite to check. /api/ccpi answers 503 in this state.`,
    }
  }
  if (typeof reportedBase !== "number") {
    return { ok: null, text: `⚪ NOT VERIFIABLE: the payload carried no numeric baseCCPI to check against.` }
  }

  const recomputed = Math.round(num / den)
  const droppedNote = dropped.length
    ? ` Renormalized over ${Math.round(den * 100)}% of the pillar weight — ${dropped.join(", ")} reported no score and ${dropped.length === 1 ? "was" : "were"} dropped.`
    : ` All four pillars scored, so the divisor is the full 100% of pillar weight.`

  if (Math.abs(recomputed - reportedBase) <= 1) {
    return {
      ok: true,
      text: `✅ VALID: recomputing the renormalized composite from the reported pillar scores gives ${recomputed}, matching the reported base CCPI of ${reportedBase}. Base ${reportedBase} + amplifier ${raw(totalBonus)} = final ${raw(finalCCPI)}.${droppedNote}`,
    }
  }
  return {
    ok: false,
    text: `⚠️ DISCREPANCY: recomputed renormalized base ${recomputed} vs reported base ${reportedBase} — ${Math.abs(recomputed - reportedBase)} points apart. Final: ${raw(finalCCPI)}.${droppedNote}`,
  }
}

/**
 * Data Quality card (A-8). `certainty` is emitted by /api/ccpi
 * (computeCertainty in lib/ccpi/scoring.ts — pure live/AI weight, no longer
 * inflated by canary counts) and was previously rendered nowhere.
 */
const buildDataQuality = (ccpi: any) => {
  const prov = ccpi.provenance ?? {}
  const keys = ["momentum", "riskAppetite", "valuation", "macro"] as const
  const labels: Record<(typeof keys)[number], string> = {
    momentum: "Momentum & Technical",
    riskAppetite: "Risk Appetite & Sentiment",
    valuation: "Valuation & Market Structure",
    macro: "Macro",
  }

  let liveCount = 0
  let aiCount = 0
  let baselineCount = 0
  let unknownCount = 0

  const pillars = keys.map((k) => {
    const b = prov[k] ?? {}
    const tiers: Record<string, unknown> = b.tiers ?? {}
    for (const key of Object.keys(tiers)) {
      const t = tiers[key]
      if (t === "live") liveCount++
      else if (t === "ai-estimate") aiCount++
      else if (t === "baseline") baselineCount++
      else unknownCount++
    }
    const scoredMax = typeof b.scoredMax === "number" ? b.scoredMax : null
    const liveMax = typeof b.liveMax === "number" ? b.liveMax : null
    const aiMax = typeof b.aiMax === "number" ? b.aiMax : null
    return {
      key: k,
      name: labels[k],
      score: typeof ccpi.pillars?.[k] === "number" ? ccpi.pillars[k] : null,
      scoredMax,
      liveMax,
      aiMax,
      excluded: Array.isArray(b.excluded) ? (b.excluded as string[]) : [],
      // Below MIN_SCORED_MAX the pillar reports nothing at all.
      belowMinimum: scoredMax !== null && scoredMax < MIN_SCORED_MAX,
    }
  })

  const hasProvenance = pillars.some((p) => p.scoredMax !== null)

  return {
    certainty: typeof ccpi.certainty === "number" ? ccpi.certainty : null,
    minScoredMax: MIN_SCORED_MAX,
    hasProvenance,
    tierCounts: { live: liveCount, aiEstimate: aiCount, baseline: baselineCount, unknown: unknownCount },
    pillars,
  }
}

export const buildAuditStructure = (ccpi: any): any => {
  const prov = ccpi.provenance ?? {}
  // Read the real count. The old `ccpi.totalIndicators || 29` invented 29 for
  // any falsy value, including a payload that never carried the field.
  const totalIndicators = typeof ccpi.totalIndicators === "number" ? ccpi.totalIndicators : null
  const activeCanaries = typeof ccpi.activeCanaries === "number" ? ccpi.activeCanaries : null
  const baseCCPI = typeof ccpi.baseCCPI === "number" ? ccpi.baseCCPI : null
  const finalCCPI = typeof ccpi.ccpi === "number" ? ccpi.ccpi : null
  const totalBonus = typeof ccpi.totalBonus === "number" ? ccpi.totalBonus : null

  return {
    dataQuality: buildDataQuality(ccpi),
    ccpi: {
      baseCCPI,
      finalCCPI,
      formula:
        "CCPI = Σ(pillar score × pillar weight) / Σ(weight of pillars that scored) — weights 35/30/15/20, renormalized over the pillars with at least 40 of their 100 weight backed by live or AI data",
      executiveSummary: `The Comprehensive Crash Prediction Index (CCPI) aggregates risk across four market dimensions. Each pillar scores 0-100, where higher means elevated crash risk. A pillar whose live/AI-backed weight falls below 40 of 100 reports no score at all and is dropped from the composite, which then renormalizes over the remaining pillars — so the divisor is not always 1.00. The base CCPI is then amplified by acute crash conditions to produce the final score.`,
      validation: validateCCPI(ccpi),
      weights: {
        momentum: Math.round(PILLAR_WEIGHTS.momentum * 100),
        riskAppetite: Math.round(PILLAR_WEIGHTS.riskAppetite * 100),
        valuation: Math.round(PILLAR_WEIGHTS.valuation * 100),
        macro: Math.round(PILLAR_WEIGHTS.macro * 100),
      },
    },
    crashAmplifier: {
      baseScore: baseCCPI,
      bonuses: Array.isArray(ccpi.crashAmplifiers) ? ccpi.crashAmplifiers : [],
      totalBonus,
      finalScore: finalCCPI,
      formula: "Final CCPI = Base CCPI + Crash Amplifier Bonus (capped at 100)",
      executiveSummary: `The Crash Amplifier system adds bonus points to the base CCPI when acute conditions occur — single-day crashes (QQQ −6% = +25), a 50-day SMA break (+20), a VIX panic spike (+20). Currently: Base ${raw(baseCCPI)} + Bonus ${raw(totalBonus)} = Final ${raw(finalCCPI)}.`,
      triggers: [
        { condition: "QQQ drops ≥6% in 1 day", bonus: "+25 points (replaced by +40 if ≥9%)" },
        { condition: "QQQ drops ≥9% in 1 day", bonus: "+40 points" },
        { condition: "QQQ breaks below 50-day SMA", bonus: "+20 points" },
        { condition: "VIX spikes above 35", bonus: "+20 points" },
        { condition: "Put/Call ratio exceeds 1.3", bonus: "+15 points (extreme hedging)" },
        // Yield-curve amplifier removed: the curve is scored once in the Macro
        // pillar and slow-moving inversion is not an acute crash event (P3-13).
      ],
    },
    canaries: {
      total: totalIndicators,
      active: activeCanaries,
      formula: "Count of indicators breaching medium or high risk thresholds",
      executiveSummary:
        activeCanaries === null || totalIndicators === null
          ? "The CCPI payload did not report a canary count, so no warning tally can be shown."
          : `Canary signals are binary warnings triggered when individual indicators cross predefined thresholds. ${activeCanaries} of ${totalIndicators} scored indicators are currently flashing warning signals.`,
      severityLevels: {
        high: "Critical breach requiring immediate attention",
        medium: "Elevated risk requiring monitoring",
      },
    },
    pillars: [
      buildMomentumPillar(ccpi, prov),
      buildRiskAppetitePillar(ccpi, prov),
      buildValuationPillar(ccpi, prov),
      buildMacroPillar(ccpi, prov),
    ],
  }
}
