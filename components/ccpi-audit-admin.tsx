"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  TrendingUp,
  Activity,
  Shield,
  Database,
  Gauge,
} from "lucide-react"
// Weights and the minimum scored weight come from the scoring core itself, so
// this panel can never drift from the engine the way the old hardcoded
// 35/30/15/20 arithmetic did.
import { PILLAR_WEIGHTS, MIN_SCORED_MAX } from "@/lib/ccpi/scoring"

// AUDIT A-8. This panel used to make 26 unguarded `.toFixed()` calls on
// indicators the CCPI route may legitimately emit as null. The first null threw
// a TypeError inside `buildAuditStructure`, the catch swallowed it, `auditData`
// stayed null, and the tab showed "Loading CCPI Audit…" forever with no error.
// Every value now goes through the null-safe formatters below and renders "—"
// when the datum does not exist. Provenance is read from `ccpi.provenance`
// (the real three-tier block) rather than merged in from /api/data-source-status.

/** Provenance tier vocabulary emitted by lib/ccpi/scoring.ts. */
type Tier = "live" | "ai-estimate" | "baseline" | "unknown"

const EM_DASH = "—"

/** Null-safe fixed-decimal formatter. Returns "—" for anything non-finite. */
function fx(v: unknown, digits: number, opts: { prefix?: string; suffix?: string; signed?: boolean } = {}): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return EM_DASH
  const sign = opts.signed && v > 0 ? "+" : ""
  return `${opts.prefix ?? ""}${sign}${v.toFixed(digits)}${opts.suffix ?? ""}`
}

/** Null-safe passthrough for values rendered verbatim. */
function raw(v: unknown, suffix = ""): string {
  if (v === null || v === undefined || v === "") return EM_DASH
  if (typeof v === "number" && !Number.isFinite(v)) return EM_DASH
  return `${v}${suffix}`
}

/** Boolean-with-proximity rendering: "YES (n% proximity)" / "NO" / "—". */
function breach(below: unknown, proximity: unknown, yesLabel = "YES"): string {
  if (typeof below !== "boolean") return EM_DASH
  if (!below) return "NO"
  const p = fx(proximity, 0, { suffix: "% proximity" })
  return p === EM_DASH ? `${yesLabel} (proximity ${EM_DASH})` : `${yesLabel} (${p})`
}

/** Pillar score band label; null-aware so a missing pillar never reads "🟢 NORMAL". */
function band(score: unknown, high: string, mid: string, low: string): string {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return `Pillar score ${EM_DASH}. ⚪ INSUFFICIENT DATA — under 40 of this pillar's 100 weight was backed by live or AI data, so it reports no score and is dropped from the composite.`
  }
  return `Pillar score ${score}/100. ${score > 70 ? high : score > 50 ? mid : low}`
}

interface IndicatorDetail {
  name: string
  formula: string
  executiveSummary: string
  currentValue: string
  ranges: {
    safe: string
    warning: string
    danger: string
  }
  dataSources: {
    primary: string
    fallbackChain: string[]
    currentSource: string
    status: Tier
    updateFrequency?: string
    methodology?: string
  }
  canaryThresholds: {
    medium: string
    high: string
  }
}

interface PillarAudit {
  name: string
  weight: number
  score: number | null
  scoredMax: number | null
  liveMax: number | null
  aiMax: number | null
  excluded: string[]
  formula: string
  calculation: string
  executiveSummary: string
  validation: string
  indicators: IndicatorDetail[]
}

export function CcpiAuditAdmin() {
  const [loading, setLoading] = useState(false)
  const [auditData, setAuditData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAudit()
  }, [])

  const fetchAudit = async () => {
    setLoading(true)
    setError(null)
    try {
      const ccpiRes = await fetch("/api/ccpi", { cache: "no-store" })
      const ccpi = await ccpiRes.json()

      if (!ccpiRes.ok) {
        // /api/ccpi returns 503 with a provenance block when every pillar is
        // unscorable, and 500 on an internal error. Surface it rather than
        // spinning forever.
        throw new Error(ccpi?.error ? `HTTP ${ccpiRes.status} — ${ccpi.error}` : `HTTP ${ccpiRes.status}`)
      }
      if (!ccpi?.pillars || !ccpi?.indicators) {
        throw new Error("The CCPI payload has no `pillars`/`indicators` block — nothing to audit.")
      }

      setAuditData(buildAuditStructure(ccpi))
    } catch (e) {
      console.error("Failed to fetch CCPI audit:", e)
      setAuditData(null)
      setError(e instanceof Error ? e.message : "Failed to load the CCPI audit.")
    } finally {
      setLoading(false)
    }
  }

  const buildAuditStructure = (ccpi: any): any => {
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

  /** Read an indicator's real provenance tier out of `ccpi.provenance`. */
  const tierOf = (prov: any, pillarKey: string, indicatorKey: string): Tier => {
    const t = prov?.[pillarKey]?.tiers?.[indicatorKey]
    return t === "live" || t === "ai-estimate" || t === "baseline" ? t : "unknown"
  }

  /**
   * Provenance for one indicator, read from `ccpi.provenance` at source.
   * The old version merged this in from /api/data-source-status, a route that
   * was a hardcoded object literal (A-5) — so the tab that was otherwise correct
   * was being fed invented "live" statuses.
   */
  const src = (
    prov: any,
    pillarKey: string,
    indicatorKey: string,
    primary: string,
    fallbackChain: string[],
  ): IndicatorDetail["dataSources"] => {
    const status = tierOf(prov, pillarKey, indicatorKey)
    return {
      primary,
      fallbackChain,
      // Never invent a provider name. Only a "live" tier means the primary
      // actually served it; anything else renders the tier's own label and "—".
      currentSource: status === "live" ? primary : EM_DASH,
      status,
    }
  }

  const buildMomentumPillar = (ccpi: any, prov: any): PillarAudit => {
    const i = ccpi.indicators ?? {}
    const p = prov?.momentum ?? {}
    const POLYGON = "Polygon.io daily aggregates → lib/indicators.ts"
    return {
      name: "Pillar 1 - Momentum & Technical",
      weight: Math.round(PILLAR_WEIGHTS.momentum * 100),
      score: typeof ccpi.pillars?.momentum === "number" ? ccpi.pillars.momentum : null,
      scoredMax: typeof p.scoredMax === "number" ? p.scoredMax : null,
      liveMax: typeof p.liveMax === "number" ? p.liveMax : null,
      aiMax: typeof p.aiMax === "number" ? p.aiMax : null,
      excluded: Array.isArray(p.excluded) ? p.excluded : [],
      formula: "Momentum = (Raw Points / Scored Weight) × 100, renormalized over live/AI-backed indicators",
      calculation:
        "10 indicators with maxima summing to 100: NVIDIA (9), SOX (9), QQQ Daily Return (12), QQQ Consecutive Down (7), QQQ Below SMA20 (7), QQQ Below SMA50 (10), QQQ Below SMA200 (15), QQQ Bollinger (9), VIX (13), VIX Term Structure (9). Baseline-tier or missing indicators are excluded and the pillar renormalizes; below 40 scored weight the pillar reports no score.",
      executiveSummary:
        "Momentum pillar captures price action deterioration, technical breakdown, and volatility spikes. Heavy weighting on critical support levels (SMA50/200) and the VIX complex. Scores rise dramatically when QQQ breaks key moving averages or volatility explodes above panic thresholds.",
      validation: band(ccpi.pillars?.momentum, "🔴 EXTREME RISK", "🟡 ELEVATED RISK", "🟢 NORMAL"),
      indicators: [
        {
          name: "NVIDIA Momentum Score",
          formula: "AI Bellwether = Price change % over rolling 30-day period",
          executiveSummary:
            "NVIDIA acts as leading indicator for AI/tech sentiment. Rapid drops signal sector rotation or bubble concerns.",
          // Was `|| 50`, which invented a neutral reading whenever the value was
          // missing (and also whenever it was legitimately 0).
          currentValue: raw(i.nvidiaMomentum ?? null),
          ranges: {
            safe: "Above 60 (healthy momentum)",
            warning: "40-60 (slowing growth)",
            danger: "Below 40 (severe weakness/overheating >80)",
          },
          dataSources: src(prov, "momentum", "nvidiaMomentum", "Alpha Vantage API", [
            "AI fallback chain (lib/unified-ai-fallback.ts)",
          ]),
          canaryThresholds: {
            medium: "Momentum < 40 or > 80",
            high: "Momentum < 20 (AI sector crash signal)",
          },
        },
        {
          name: "SOX Semiconductor Index",
          formula: "Chip Health = (Current Price - Baseline 5000) / 5000 × 100%",
          executiveSummary:
            "Semiconductor index tracks hardware backbone of AI economy. Chip crashes often precede broader tech selloffs.",
          currentValue: raw(i.soxIndex ?? null),
          ranges: {
            safe: "Above baseline (5000+)",
            warning: "-5% to -10% from baseline",
            danger: "Below -10% (chip sector crash)",
          },
          dataSources: src(
            prov,
            "momentum",
            "soxIndex",
            "AI fallback chain (lib/unified-ai-fallback.ts) — no live provider is wired for SOX",
            [],
          ),
          canaryThresholds: {
            medium: "Down 10-15%",
            high: "Down >15% (sector collapse)",
          },
        },
        {
          name: "QQQ Daily Return (5× downside amplifier)",
          formula: "Daily % Change = (Close - Previous Close) / Previous Close × 100",
          executiveSummary:
            "Single-day crashes are the strongest short-term crash predictor. Down days are weighted 5× more than up days to capture asymmetric risk.",
          currentValue: fx(i.qqqDailyReturn, 2, { suffix: "%" }),
          ranges: {
            safe: "Above -1%",
            warning: "-1% to -3%",
            danger: "Below -3% (crash day if <-6%)",
          },
          dataSources: src(prov, "momentum", "qqqDailyReturn", "Polygon.io daily aggregates", []),
          canaryThresholds: {
            medium: "Return < -1.5%",
            high: "Return < -6% (single-day crash)",
          },
        },
        {
          name: "QQQ Consecutive Down Days",
          formula: "Streak Counter = Number of consecutive days with negative returns",
          executiveSummary: "Extended losing streaks indicate sustained selling pressure and potential trend reversal.",
          currentValue: raw(i.qqqConsecDown ?? null, " days"),
          ranges: {
            safe: "0-1 days",
            warning: "2-3 days",
            danger: "4+ days (trend breakdown)",
          },
          dataSources: src(prov, "momentum", "qqqConsecDown", "Polygon.io daily aggregates", []),
          canaryThresholds: {
            medium: "3+ days down",
            high: "5+ days down (persistent weakness)",
          },
        },
        {
          name: "QQQ Below 20-Day SMA",
          formula: "Short-term Support = Binary (Price < SMA20) + Proximity Score (0-100%)",
          executiveSummary:
            "20-day moving average is critical short-term support. Breaches signal momentum loss and potential correction.",
          currentValue: breach(i.qqqBelowSMA20, i.qqqSMA20Proximity),
          ranges: {
            safe: "Above SMA20 (0% proximity)",
            warning: "25-50% proximity to breach",
            danger: "Below SMA20 (100% proximity = breached)",
          },
          dataSources: src(prov, "momentum", "qqqSMA20", POLYGON, []),
          canaryThresholds: {
            medium: "50%+ proximity",
            high: "Breached (100% proximity)",
          },
        },
        {
          name: "QQQ Below 50-Day SMA",
          formula: "Medium-term Support = Binary (Price < SMA50) + Proximity Score (0-100%)",
          executiveSummary:
            "50-day moving average marks intermediate trend health. Breaches often precede deeper corrections.",
          currentValue: breach(i.qqqBelowSMA50, i.qqqSMA50Proximity),
          ranges: {
            safe: "Above SMA50",
            warning: "25-50% proximity",
            danger: "Below SMA50 (medium-term trend broken)",
          },
          dataSources: src(prov, "momentum", "qqqSMA50", POLYGON, []),
          canaryThresholds: {
            medium: "50%+ proximity",
            high: "Breached (100% proximity)",
          },
        },
        {
          name: "QQQ Below 200-Day SMA",
          formula: "Long-term Support = Binary (Price < SMA200) + Proximity Score (0-100%)",
          executiveSummary:
            "200-day moving average is the ultimate bull/bear line. Breaches signal potential bear market.",
          currentValue: breach(i.qqqBelowSMA200, i.qqqSMA200Proximity),
          ranges: {
            safe: "Above SMA200 (bull market)",
            warning: "25-50% proximity (approaching danger)",
            danger: "Below SMA200 (bear market signal)",
          },
          dataSources: src(prov, "momentum", "qqqSMA200", POLYGON, []),
          canaryThresholds: {
            medium: "50%+ proximity",
            high: "Breached (100% proximity - bear market)",
          },
        },
        {
          name: "QQQ Below Bollinger Band (Lower)",
          formula: "Oversold Territory = Binary (Price < Lower Band) + Proximity Score (0-100%)",
          executiveSummary:
            "Bollinger bands mark statistical extremes. Breaches indicate oversold conditions or accelerating declines.",
          currentValue: breach(i.qqqBelowBollinger, i.qqqBollingerProximity, "YES - OVERSOLD"),
          ranges: {
            safe: "Within bands",
            warning: "25-50% proximity to lower band",
            danger: "Below lower band (extreme oversold)",
          },
          dataSources: src(prov, "momentum", "qqqBollinger", POLYGON, []),
          canaryThresholds: {
            medium: "50%+ proximity",
            high: "Breached lower band (100% proximity - panic selling)",
          },
        },
        {
          name: "VIX (Fear Gauge)",
          formula: "Implied Volatility = S&P 500 30-day expected volatility from options pricing",
          executiveSummary:
            "VIX measures market fear through options prices. Spikes above 25 indicate elevated stress; above 35 signals panic.",
          currentValue: fx(i.vix, 1),
          ranges: {
            safe: "Below 15 (calm market)",
            warning: "15-25 (elevated volatility)",
            danger: "Above 25 (fear), >35 (panic)",
          },
          dataSources: src(prov, "momentum", "vix", "FRED VIXCLS", [
            "AI fallback chain (lib/unified-ai-fallback.ts)",
          ]),
          canaryThresholds: {
            medium: "VIX > 25",
            high: "VIX > 35 (extreme fear)",
          },
        },
        {
          name: "VIX Term Structure (VIX3M / VIX)",
          formula: "Term Structure = 3-Month VIX (VIX3M) / Spot VIX — ratio convention, normal contango ≈ 1.08",
          executiveSummary:
            "Term structure shows the market's fear timeline. Backwardation (ratio < 1.0) means immediate fear exceeds future expectations - classic crash signal. Both legs come from FRED.",
          currentValue: `${fx(i.vixTermStructure, 2)}${i.vixTermInverted === true ? " (INVERTED - FEAR)" : ""}`,
          ranges: {
            safe: "Above 1.05 (normal contango, baseline ~1.08)",
            warning: "1.00-1.05 (flattening)",
            danger: "Below 1.00 (backwardation - immediate fear; <0.95 severe)",
          },
          dataSources: src(prov, "momentum", "vixTermStructure", "FRED VXVCLS ÷ FRED VIXCLS", []),
          canaryThresholds: {
            medium: "Ratio < 1.0 (mild backwardation)",
            high: "Ratio < 0.95 (severe backwardation)",
          },
        },
      ],
    }
  }

  const buildRiskAppetitePillar = (ccpi: any, prov: any): PillarAudit => {
    const i = ccpi.indicators ?? {}
    const p = prov?.riskAppetite ?? {}
    return {
      name: "Pillar 2 - Risk Appetite & Sentiment",
      weight: Math.round(PILLAR_WEIGHTS.riskAppetite * 100),
      score: typeof ccpi.pillars?.riskAppetite === "number" ? ccpi.pillars.riskAppetite : null,
      scoredMax: typeof p.scoredMax === "number" ? p.scoredMax : null,
      liveMax: typeof p.liveMax === "number" ? p.liveMax : null,
      aiMax: typeof p.aiMax === "number" ? p.aiMax : null,
      excluded: Array.isArray(p.excluded) ? p.excluded : [],
      formula: "Risk Appetite = (Raw Points / Scored Weight) × 100, renormalized over live/AI-backed indicators",
      calculation:
        "4 indicators with maxima summing to 100: Put/Call (29), Fear & Greed (24), AAII Bullish (26), Short Interest (21). A null Fear & Greed is excluded AND renormalized rather than silently deflating the pillar.",
      executiveSummary:
        "Risk appetite pillar detects euphoria (complacency) and panic (capitulation) through sentiment and positioning indicators. Low put/call ratios and high bullish sentiment signal dangerous complacency, while extreme fear can be contrarian opportunity.",
      validation: band(ccpi.pillars?.riskAppetite, "🔴 EXTREME COMPLACENCY", "🟡 ELEVATED RISK", "🟢 HEALTHY"),
      indicators: [
        {
          name: "Put/Call Ratio",
          formula: "Hedging Activity = Put Options Volume / Call Options Volume",
          executiveSummary:
            "Measures market hedging behavior. Ratios below 0.7 signal complacency (too few hedges), above 1.3 signals panic.",
          currentValue: fx(i.putCallRatio, 2),
          ranges: {
            safe: "0.85-1.10 (balanced hedging)",
            warning: "0.70-0.85 or 1.10-1.30",
            danger: "Below 0.70 (complacency) or Above 1.30 (panic)",
          },
          dataSources: src(prov, "riskAppetite", "putCallRatio", "ScrapingBee scrape", [
            "AI fallback chain (lib/unified-ai-fallback.ts)",
          ]),
          canaryThresholds: {
            medium: "<0.85 or >1.10",
            high: "<0.60 (extreme complacency) or >1.30 (panic)",
          },
        },
        {
          name: "Fear & Greed Index",
          formula:
            "CNN Composite: 7 indicators (Market Momentum [S&P vs 125-MA], Stock Strength [52-wk highs/lows], Breadth [McClellan Vol], Put/Call [5-day avg], VIX [vs 50-MA], Safe Haven [stock vs bond 20d], Junk Bond [HY spread])",
          executiveSummary:
            "CNN's official 7-indicator equity sentiment composite. Scores 0-24 = Extreme Fear, 75-100 = Extreme Greed. Equal-weighted and updated continuously during market hours. (The crypto Fear & Greed index that previously stood in for it was replaced in the provenance rework.)",
          currentValue: raw(i.fearGreedIndex ?? null),
          ranges: {
            safe: "45-55 (neutral - balanced market)",
            warning: "25-44 (fear - cautious) or 56-74 (greed - elevated)",
            danger: "0-24 (extreme fear - max opportunity) or 75-100 (extreme greed - correction risk)",
          },
          dataSources: {
            ...src(
              prov,
              "riskAppetite",
              "fearGreedIndex",
              "CNN Fear & Greed API (production.dataviz.cnn.io/index/fearandgreed/graphdata)",
              [],
            ),
            updateFrequency: "Continuous during market hours",
            methodology:
              "Each of 7 indicators scores 0-100 independently, then averaged with equal weighting against historical ranges.",
          },
          canaryThresholds: {
            medium: "Score >70 (greed building) or <30 (fear building)",
            high: "Score >80 (extreme greed - contrarian sell signal) or <20 (extreme fear - contrarian buy signal)",
          },
        },
        {
          name: "AAII Bullish Sentiment",
          formula: "Retail Optimism = % of AAII members bullish on stocks (6-month outlook)",
          executiveSummary:
            "Retail investor sentiment survey. Values above 50% indicate excessive optimism; sustained highs precede corrections.",
          currentValue: fx(i.aaiiBullish, 1, { suffix: "%" }),
          ranges: {
            safe: "30-45% (historical average ~38%)",
            warning: "45-55%",
            danger: "Above 55% (retail euphoria) or Below 25% (capitulation)",
          },
          dataSources: src(prov, "riskAppetite", "aaiiBullish", "ScrapingBee scrape", [
            "AI fallback chain (lib/unified-ai-fallback.ts)",
          ]),
          canaryThresholds: {
            medium: ">45% or <30%",
            high: ">55% (euphoria warning)",
          },
        },
        {
          name: "SPY Short Interest Ratio",
          formula: "Bearish Positioning = SPY ETF short interest as % of float",
          executiveSummary:
            "Measures bearish bets on the S&P 500. Lower short interest (2-3%) signals bullish confidence; high short interest (>6%) signals bearish positioning and elevated stress.",
          currentValue: fx(i.shortInterest, 1, { suffix: "%" }),
          ranges: {
            safe: "2-3% (bullish confidence, low bearish stress)",
            warning: "3-5% (normal range)",
            danger: "Above 6% (elevated bearish stress), >8% (extreme bearish sentiment)",
          },
          dataSources: src(
            prov,
            "riskAppetite",
            "shortInterest",
            "AI fallback chain (lib/unified-ai-fallback.ts) — no live provider is wired for short interest",
            [],
          ),
          canaryThresholds: {
            medium: ">5% (increased bearish positioning)",
            high: ">8% (extreme bearish stress)",
          },
        },
      ],
    }
  }

  const buildValuationPillar = (ccpi: any, prov: any): PillarAudit => {
    const i = ccpi.indicators ?? {}
    const p = prov?.valuation ?? {}
    const APIFY = "Apify Yahoo Finance"
    return {
      name: "Pillar 3 - Valuation & Market Structure",
      weight: Math.round(PILLAR_WEIGHTS.valuation * 100),
      score: typeof ccpi.pillars?.valuation === "number" ? ccpi.pillars.valuation : null,
      scoredMax: typeof p.scoredMax === "number" ? p.scoredMax : null,
      liveMax: typeof p.liveMax === "number" ? p.liveMax : null,
      aiMax: typeof p.aiMax === "number" ? p.aiMax : null,
      excluded: Array.isArray(p.excluded) ? p.excluded : [],
      formula: "Valuation = (Raw Points / Scored Weight) × 100, renormalized over live/AI-backed indicators",
      calculation:
        "7 indicators with maxima summing to 100: S&P P/E (18), S&P P/S (12), Buffett Indicator (16), QQQ P/E (16), Mag7 Concentration (15), Shiller CAPE (13), Equity Risk Premium (10).",
      executiveSummary:
        "Valuation pillar identifies bubble conditions and structural fragility. High P/E ratios, extreme concentration in Mag7, and negative equity risk premiums signal overvalued markets vulnerable to sharp corrections.",
      validation: band(ccpi.pillars?.valuation, "🔴 BUBBLE TERRITORY", "🟡 OVERVALUED", "🟢 REASONABLE"),
      indicators: [
        {
          name: "S&P 500 Forward P/E",
          formula: "Valuation Multiple = Current Price / Next 12 Months Estimated Earnings",
          executiveSummary:
            "Forward P/E above 22 indicates expensive market; above 25 signals bubble risk. Historical average is ~16-18.",
          currentValue: fx(i.spxPE, 1),
          ranges: {
            safe: "Below 18 (undervalued)",
            warning: "18-25 (fair to expensive)",
            danger: "Above 25 (overvalued), >30 (bubble)",
          },
          dataSources: src(prov, "valuation", "spxPE", APIFY, ["FMP key-metrics"]),
          canaryThresholds: {
            medium: "P/E > 22",
            high: "P/E > 30 (extreme overvaluation)",
          },
        },
        {
          name: "S&P 500 Price-to-Sales",
          formula: "Revenue Multiple = Market Cap / Total Revenue",
          executiveSummary:
            "P/S above 2.5 indicates expensive market; above 3.0 signals bubble conditions. Less manipulable than P/E.",
          currentValue: fx(i.spxPS, 1),
          ranges: {
            safe: "Below 2.0",
            warning: "2.0-2.8",
            danger: "Above 2.8 (expensive if >3.5)",
          },
          dataSources: src(prov, "valuation", "spxPS", APIFY, ["FMP key-metrics"]),
          canaryThresholds: {
            medium: "P/S > 2.5",
            high: "P/S > 3.5 (extreme)",
          },
        },
        {
          name: "Buffett Indicator (Market Cap / GDP)",
          formula: "Total Market Valuation = Wilshire 5000 Market Cap / US GDP × 100",
          executiveSummary:
            "Warren Buffett's favorite metric. Above 120% is fairly valued; above 150% is overvalued; above 200% is bubble territory.",
          currentValue: fx(i.buffettIndicator, 0, { suffix: "%" }),
          ranges: {
            safe: "Below 100% (undervalued)",
            warning: "100-150% (fairly valued)",
            danger: "Above 150% (overvalued), >180% (bubble)",
          },
          dataSources: src(prov, "valuation", "buffettIndicator", "ScrapingBee scrape", [
            "AI fallback chain (lib/unified-ai-fallback.ts)",
          ]),
          canaryThresholds: {
            medium: ">150%",
            high: ">180% (significantly overvalued)",
          },
        },
        {
          name: "QQQ Forward P/E (AI-Specific Valuation)",
          formula: "Tech Valuation = QQQ Price / Weighted Average Forward Earnings",
          executiveSummary:
            "QQQ P/E above 30 indicates AI/tech bubble; above 40 signals extreme speculation. More sensitive than S&P 500.",
          currentValue: fx(i.qqqPE, 1),
          ranges: {
            safe: "Below 25",
            warning: "25-35",
            danger: "Above 35 (bubble if >40)",
          },
          dataSources: src(
            prov,
            "valuation",
            "qqqPE",
            "AI fallback chain (lib/unified-ai-fallback.ts) — no live provider is wired for QQQ P/E",
            [],
          ),
          canaryThresholds: {
            medium: ">30",
            high: ">40 (AI bubble territory)",
          },
        },
        {
          name: "Magnificent 7 Concentration (Crash Contagion Risk)",
          formula:
            "Top-Heavy Risk = (AAPL + MSFT + GOOGL + AMZN + NVDA + META + TSLA Market Cap) / Total QQQ Market Cap × 100",
          executiveSummary:
            "Extreme concentration amplifies crash risk. If Mag7 falls, entire index collapses. Above 60% is dangerous top-heaviness.",
          currentValue: fx(i.mag7Concentration, 1, { suffix: "%" }),
          ranges: {
            safe: "Below 45% (diversified)",
            warning: "45-55%",
            danger: "Above 55% (concentrated), >60% (extreme)",
          },
          dataSources: src(
            prov,
            "valuation",
            "mag7Concentration",
            "AI fallback chain (lib/unified-ai-fallback.ts) — no live provider is wired for Mag7 weight",
            [],
          ),
          canaryThresholds: {
            medium: ">50%",
            high: ">60% (severe concentration risk)",
          },
        },
        {
          name: "Shiller CAPE Ratio (10-Year Cyclical Valuation)",
          formula: "Cyclically-Adjusted P/E = Price / 10-Year Average Inflation-Adjusted Earnings",
          executiveSummary:
            "CAPE above 30 has historically preceded major market declines. Smooths earnings volatility for long-term valuation view.",
          currentValue: fx(i.shillerCAPE, 1),
          ranges: {
            safe: "Below 20 (historical average ~16)",
            warning: "20-30",
            danger: "Above 30 (overvalued), >35 (extreme)",
          },
          dataSources: src(
            prov,
            "valuation",
            "shillerCAPE",
            "AI fallback chain (lib/unified-ai-fallback.ts) — no live provider is wired for CAPE",
            [],
          ),
          canaryThresholds: {
            medium: ">28",
            high: ">35 (historic overvaluation)",
          },
        },
        {
          name: "Equity Risk Premium (Earnings Yield - 10Y Treasury)",
          formula: "Stock vs Bond Attractiveness = (1 / S&P P/E × 100) - 10Y Treasury Yield",
          executiveSummary:
            "Negative or near-zero premiums mean bonds are more attractive than stocks. Below 2% signals stocks are overpriced relative to risk-free rates.",
          currentValue: fx(i.equityRiskPremium, 2, { suffix: "%" }),
          ranges: {
            safe: "Above 4% (stocks attractive)",
            warning: "2-4% (fair)",
            danger: "Below 2% (stocks overpriced), <0% (bonds dominate)",
          },
          dataSources: src(
            prov,
            "valuation",
            "equityRiskPremium",
            "Derived: S&P earnings yield − FRED 10Y (tier = weaker of the two)",
            [],
          ),
          canaryThresholds: {
            medium: "<3%",
            high: "<1.5% (severely overpriced)",
          },
        },
      ],
    }
  }

  const buildMacroPillar = (ccpi: any, prov: any): PillarAudit => {
    const i = ccpi.indicators ?? {}
    const p = prov?.macro ?? {}
    const FRED = "FRED API"
    return {
      name: "Pillar 4 - Macro",
      weight: Math.round(PILLAR_WEIGHTS.macro * 100),
      score: typeof ccpi.pillars?.macro === "number" ? ccpi.pillars.macro : null,
      scoredMax: typeof p.scoredMax === "number" ? p.scoredMax : null,
      liveMax: typeof p.liveMax === "number" ? p.liveMax : null,
      aiMax: typeof p.aiMax === "number" ? p.aiMax : null,
      excluded: Array.isArray(p.excluded) ? p.excluded : [],
      formula: "Macro = (Raw Points / Scored Weight) × 100, renormalized over live/AI-backed indicators",
      calculation:
        "8 indicators with maxima summing to 100: TED Spread (13), DXY Dollar Index (12), ISM PMI (15), Fed Funds Rate (15), Fed Reverse Repo (11), Junk Bond Spread (10), US Debt-to-GDP (10), Yield Curve (14). The 10Y-2Y yield curve is scored once, here — its former duplicates in Pillars 1 and 2 and the crash-amplifier bonus were removed.",
      executiveSummary:
        "Macro pillar captures systemic economic and financial conditions. Banking stress (TED spread), policy tightness (Fed funds), and credit stress (junk spreads) signal macro headwinds that can trigger crashes.",
      validation: band(ccpi.pillars?.macro, "🔴 MACRO CRISIS", "🟡 RESTRICTIVE", "🟢 STABLE"),
      indicators: [
        {
          name: "TED Spread (Banking System Stress)",
          formula: "Credit Risk = 3-Month LIBOR - 3-Month Treasury Yield",
          executiveSummary:
            "TED spread above 0.5% signals banking sector stress; above 1.0% indicates credit crisis. 2008 crisis saw TED > 4%.",
          currentValue: fx(i.tedSpread, 2, { suffix: "%" }),
          ranges: {
            safe: "Below 0.35% (healthy credit markets)",
            warning: "0.35-0.75%",
            danger: "Above 0.75% (stress), >1.0% (crisis)",
          },
          dataSources: src(prov, "macro", "tedSpread", FRED, []),
          canaryThresholds: {
            medium: ">0.50%",
            high: ">1.0% (banking crisis signal)",
          },
        },
        {
          name: "US Dollar Index (DXY) - Tech Headwind",
          formula: "Dollar Strength = Weighted basket vs EUR, JPY, GBP, CAD, SEK, CHF",
          executiveSummary:
            "Strong dollar (>110) hurts tech earnings from overseas and tightens global financial conditions. Dollar rallies often precede crashes.",
          currentValue: fx(i.dxyIndex, 1),
          ranges: {
            safe: "Below 100 (weak dollar helps tech)",
            warning: "100-110 (normal range)",
            danger: "Above 110 (strong dollar hurts tech), >115 (extreme)",
          },
          dataSources: src(prov, "macro", "dxyIndex", FRED, []),
          canaryThresholds: {
            medium: ">105",
            high: ">110 (extreme dollar strength)",
          },
        },
        {
          name: "ISM Manufacturing PMI (Economic Leading)",
          formula: "Factory Health = Survey of purchasing managers (>50 = expansion, <50 = contraction)",
          executiveSummary:
            "PMI below 50 indicates manufacturing contraction; below 45 signals recession risk. Leading indicator for GDP.",
          currentValue: fx(i.ismPMI, 1),
          ranges: {
            safe: "Above 52 (expansion)",
            warning: "50-52 (neutral)",
            danger: "Below 50 (contraction), <45 (recession)",
          },
          dataSources: src(
            prov,
            "macro",
            "ismPMI",
            "AI fallback chain (lib/unified-ai-fallback.ts) — no live provider is wired for ISM",
            [],
          ),
          canaryThresholds: {
            medium: "<50 (contraction)",
            high: "<46 (deep contraction)",
          },
        },
        {
          name: "Fed Funds Rate - Restrictive Policy",
          formula: "Policy Rate = Federal Reserve target rate for overnight bank lending",
          executiveSummary:
            "Rates above 5% are restrictive and slow economy. Aggressive rate hikes have triggered past recessions and crashes.",
          currentValue: fx(i.fedFundsRate, 2, { suffix: "%" }),
          ranges: {
            safe: "Below 4% (accommodative)",
            warning: "4-5% (neutral)",
            danger: "Above 5% (restrictive), >6% (extreme)",
          },
          dataSources: src(prov, "macro", "fedFundsRate", FRED, []),
          canaryThresholds: {
            medium: ">4.5%",
            high: ">6.0% (severely restrictive)",
          },
        },
        {
          name: "Fed Reverse Repo (Liquidity Conditions)",
          formula: "Liquidity Drain = $ parked at Fed overnight (removes money from markets)",
          executiveSummary:
            "High RRP (>$1T) means tight liquidity. Money market funds choosing Fed over lending to markets reduces available capital.",
          currentValue: fx(i.fedReverseRepo, 0, { prefix: "$", suffix: "B" }),
          ranges: {
            safe: "Below $500B (loose liquidity)",
            warning: "$500B-$1000B",
            danger: "Above $1000B (tight), >$1500B (severe drain)",
          },
          dataSources: src(prov, "macro", "fedReverseRepo", FRED, []),
          canaryThresholds: {
            medium: ">$1000B",
            high: ">$2000B (extreme liquidity drain)",
          },
        },
        {
          name: "Junk Bond Spread",
          formula: "Credit Stress = High-Yield Corporate Bonds - 10Y Treasury Yield",
          executiveSummary:
            "Spread above 6% signals credit stress; above 8% indicates corporate distress. Widens dramatically before recessions.",
          currentValue: fx(i.junkSpread, 2, { suffix: "%" }),
          ranges: {
            safe: "Below 3.5% (tight credit)",
            warning: "3.5-6%",
            danger: "Above 6% (stress), >8% (crisis)",
          },
          dataSources: src(prov, "macro", "junkSpread", FRED, []),
          canaryThresholds: {
            medium: ">5%",
            high: ">8% (credit crisis)",
          },
        },
        {
          name: "US Debt-to-GDP Ratio",
          formula: "Fiscal Burden = Total Federal Debt / Annual GDP × 100",
          executiveSummary:
            "Debt above 120% raises sovereign risk concerns; above 130% approaches fiscal crisis. Limits government crisis response capacity.",
          currentValue: fx(i.debtToGDP, 0, { suffix: "%" }),
          ranges: {
            safe: "Below 100% (healthy)",
            warning: "100-120% (elevated)",
            danger: "Above 120% (high risk), >130% (crisis risk)",
          },
          dataSources: src(prov, "macro", "debtToGDP", FRED, []),
          canaryThresholds: {
            medium: ">110%",
            high: ">130% (fiscal crisis risk)",
          },
        },
        {
          name: "Yield Curve (10Y-2Y)",
          formula: "Recession Signal = 10-Year Treasury Yield - 2-Year Treasury Yield",
          executiveSummary:
            "Inverted yield curve (negative spread) has preceded every recession since 1950. Scored once, in this pillar (max 14 points).",
          currentValue: fx(i.yieldCurve, 2, { suffix: "%", signed: true }),
          ranges: {
            safe: "Above 0% (normal curve)",
            warning: "0% to -0.5% (inverted)",
            danger: "Below -0.5% (deep inversion - recession signal)",
          },
          dataSources: src(prov, "macro", "yieldCurve", FRED, []),
          canaryThresholds: {
            medium: "Curve inverted (-0.2% to -0.5%)",
            high: "Deep inversion (< -0.5%)",
          },
        },
      ],
    }
  }

  // Badge vocabulary now matches the engine's tiers exactly. The old
  // "aiFallback"/"failed" cases came from /api/data-source-status, which never
  // measured anything; "ai-estimate" and "baseline" are what scoring.ts emits.
  const getStatusBadge = (status: Tier) => {
    switch (status) {
      case "live":
        return <Badge className="bg-green-500 text-white">🟢 Live</Badge>
      case "ai-estimate":
        return <Badge className="bg-yellow-500 text-white">🟡 AI estimate</Badge>
      case "baseline":
        return <Badge className="bg-orange-500 text-white">🟠 Baseline (not scored)</Badge>
      default:
        return <Badge className="bg-slate-400 text-white">❓ Unknown</Badge>
    }
  }

  const exportReport = () => {
    if (!auditData) return

    const report = `# CCPI AUDIT REPORT
Generated: ${new Date().toISOString()}

## CCPI Index Calculation
Score: ${raw(auditData.ccpi.finalCCPI)}/100
Formula: ${auditData.ccpi.formula}

${auditData.ccpi.executiveSummary}

Validation: ${auditData.ccpi.validation.text}

## Data Quality
Certainty (live/AI weight): ${auditData.dataQuality.certainty === null ? EM_DASH : `${auditData.dataQuality.certainty}%`}
Indicator tiers: ${auditData.dataQuality.tierCounts.live} live · ${auditData.dataQuality.tierCounts.aiEstimate} AI estimate · ${auditData.dataQuality.tierCounts.baseline} baseline · ${auditData.dataQuality.tierCounts.unknown} unknown
${auditData.dataQuality.pillars
  .map(
    (p: any) =>
      `- ${p.name}: score ${raw(p.score)} · scored weight ${raw(p.scoredMax)}/100 (live ${raw(p.liveMax)}, AI ${raw(p.aiMax)})${p.excluded.length ? ` · excluded: ${p.excluded.join(", ")}` : ""}`,
  )
  .join("\n")}

Pillar Weights:
- Momentum & Technical: ${auditData.ccpi.weights.momentum}%
- Risk Appetite & Volatility: ${auditData.ccpi.weights.riskAppetite}%
- Valuation & Market Structure: ${auditData.ccpi.weights.valuation}%
- Macro Economic: ${auditData.ccpi.weights.macro}%

---

## Crash Amplifier Bonus System
Base Score: ${raw(auditData.crashAmplifier.baseScore)} | Bonus: ${raw(auditData.crashAmplifier.totalBonus)} | Final Score: ${raw(auditData.crashAmplifier.finalScore)}
Formula: ${auditData.crashAmplifier.formula}

${auditData.crashAmplifier.executiveSummary}

Crash Amplifier Triggers:
${auditData.crashAmplifier.triggers.map((trigger: any) => `- ${trigger.condition}: ${trigger.bonus}`).join("\n")}

Active Bonuses:
${auditData.crashAmplifier.bonuses.length > 0 ? auditData.crashAmplifier.bonuses.map((bonus: any) => `- ${bonus.reason}: +${bonus.points} points`).join("\n") : "- None"}

---

## Canary Warning System
Active Warnings: ${raw(auditData.canaries.active)} / ${raw(auditData.canaries.total)} indicators
Formula: ${auditData.canaries.formula}

${auditData.canaries.executiveSummary}

Severity Levels:
- High: ${auditData.canaries.severityLevels.high}
- Medium: ${auditData.canaries.severityLevels.medium}

---

${auditData.pillars
  .map(
    (pillar: PillarAudit) => `
## ${pillar.name}
Weight: ${pillar.weight}% | Score: ${raw(pillar.score)}/100 | Scored weight: ${raw(pillar.scoredMax)}/100 (live ${raw(pillar.liveMax)}, AI ${raw(pillar.aiMax)})
Formula: ${pillar.formula}
Calculation: ${pillar.calculation}

### Executive Summary
${pillar.executiveSummary}

### Validation
${pillar.validation}

### Indicators (${pillar.indicators.length})
${pillar.indicators
  .map(
    (ind: IndicatorDetail, idx: number) => `
${idx + 1}. **${ind.name}**
   Formula: ${ind.formula}
   Current Value: ${JSON.stringify(ind.currentValue)}
   
   Summary: ${ind.executiveSummary}
   
   Ranges:
   - Safe: ${ind.ranges.safe}
   - Warning: ${ind.ranges.warning}
   - Danger: ${ind.ranges.danger}
   
   Data Sources:
   - Primary: ${ind.dataSources.primary}
   - Current: ${ind.dataSources.currentSource} (${ind.dataSources.status})
   - Fallback Chain: ${ind.dataSources.fallbackChain.join(" → ")}
   
   Canary Thresholds:
   - Medium Risk: ${ind.canaryThresholds.medium}
   - High Risk: ${ind.canaryThresholds.high}
`,
  )
  .join("\n")}
`,
  )
  .join("\n---\n")}

---
**END OF AUDIT REPORT**
`

    const blob = new Blob([report], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ccpi-audit-detailed-${new Date().toISOString().split("T")[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // A real error state. The old code had only the spinner, so any thrown
  // TypeError left the tab loading forever with nothing to diagnose (A-8).
  if (error) {
    return (
      <div className="bg-white rounded-lg p-6 border border-red-300">
        <div className="flex items-start gap-3">
          <XCircle className="h-6 w-6 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="font-bold text-red-900">CCPI audit could not be loaded</h3>
            <p className="text-sm text-red-800 mt-1">{error}</p>
            <p className="text-xs text-red-700 mt-2">
              Nothing is shown rather than a partially-invented audit. Check the CCPI route&apos;s logs and the provider
              keys it depends on.
            </p>
            <Button onClick={fetchAudit} disabled={loading} size="sm" className="mt-3">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!auditData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600">Loading CCPI Audit...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg p-6 border">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            CCPI Audit - Complete Transparency
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Formulas, thresholds, provenance and validation for the{" "}
            {auditData.canaries.total === null ? EM_DASH : auditData.canaries.total} scored indicators across{" "}
            {auditData.pillars.length} pillars. Values the engine could not source render {EM_DASH}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAudit} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={exportReport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Data Quality — built from ccpi.certainty + ccpi.provenance. The
          reworked certainty number was emitted by the route and rendered
          nowhere until now (A-8). */}
      <Card className="bg-white border-slate-300">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Gauge className="h-6 w-6 text-slate-700" />
            Data Quality
          </CardTitle>
          <CardDescription>
            What this score is actually built on. Certainty is pure data provenance — the share of scored weight backed
            by live data, plus half credit for AI estimates. Canary counts do not raise it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!auditData.dataQuality.hasProvenance ? (
            <p className="text-sm text-slate-600">
              This CCPI payload carried no <code>provenance</code> block, so no per-indicator tiers can be shown.
            </p>
          ) : null}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-4 rounded-lg border bg-slate-50">
              <div className="text-3xl font-bold text-slate-800">
                {auditData.dataQuality.certainty === null ? EM_DASH : `${auditData.dataQuality.certainty}%`}
              </div>
              <div className="text-xs text-slate-600">Certainty</div>
            </div>
            <div className="p-4 rounded-lg border bg-green-50">
              <div className="text-3xl font-bold text-green-700">{auditData.dataQuality.tierCounts.live}</div>
              <div className="text-xs text-green-700">Live</div>
            </div>
            <div className="p-4 rounded-lg border bg-yellow-50">
              <div className="text-3xl font-bold text-yellow-700">{auditData.dataQuality.tierCounts.aiEstimate}</div>
              <div className="text-xs text-yellow-700">AI estimate</div>
            </div>
            <div className="p-4 rounded-lg border bg-orange-50">
              <div className="text-3xl font-bold text-orange-700">{auditData.dataQuality.tierCounts.baseline}</div>
              <div className="text-xs text-orange-700">Baseline (excluded)</div>
            </div>
            <div className="p-4 rounded-lg border bg-slate-50">
              <div className="text-3xl font-bold text-slate-600">{auditData.dataQuality.tierCounts.unknown}</div>
              <div className="text-xs text-slate-600">Unknown</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {auditData.dataQuality.pillars.map((p: any) => (
              <div key={p.key} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-900">{p.name}</span>
                  <span className="text-lg font-bold text-slate-700">{p.score === null ? EM_DASH : `${p.score}/100`}</span>
                </div>
                <p className="text-xs text-slate-600">
                  Scored weight <span className="font-mono">{raw(p.scoredMax)}</span>/100 — live{" "}
                  <span className="font-mono">{raw(p.liveMax)}</span>, AI <span className="font-mono">{raw(p.aiMax)}</span>
                </p>
                {p.belowMinimum && (
                  <p className="text-xs text-orange-700 mt-1">
                    Below the {auditData.dataQuality.minScoredMax}-point minimum — this pillar reports no score and is
                    dropped from the composite, which renormalizes over the rest.
                  </p>
                )}
                {p.excluded.length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">Excluded from scoring: {p.excluded.join(", ")}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 1: CCPI Index Calculation */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            1. CCPI Index Calculation
          </CardTitle>
          <CardDescription>Overall crash prediction score formula and validation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white p-6 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Current CCPI Score</h3>
              <div className="text-4xl font-bold text-blue-600">{raw(auditData.ccpi.finalCCPI)}/100</div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Formula</h4>
                <code className="block bg-gray-50 p-3 rounded text-sm">{auditData.ccpi.formula}</code>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Executive Summary</h4>
                <p className="text-sm text-gray-700">{auditData.ccpi.executiveSummary}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Pillar Weights</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(auditData.ccpi.weights).map(([key, value]: [string, any]) => (
                    <div key={key} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                      <span className="capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                      <span className="font-bold">{value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* The badge colour now follows the actual result. Previously the
                  card was hardcoded green regardless of what validateCCPI said. */}
              <div
                className={`p-4 border rounded ${
                  auditData.ccpi.validation.ok === true
                    ? "bg-green-50 border-green-200"
                    : auditData.ccpi.validation.ok === false
                      ? "bg-red-50 border-red-200"
                      : "bg-slate-50 border-slate-200"
                }`}
              >
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  {auditData.ccpi.validation.ok === true ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : auditData.ccpi.validation.ok === false ? (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-slate-500" />
                  )}
                  Validation
                </h4>
                <p
                  className={`text-sm ${
                    auditData.ccpi.validation.ok === true
                      ? "text-green-800"
                      : auditData.ccpi.validation.ok === false
                        ? "text-red-800"
                        : "text-slate-700"
                  }`}
                >
                  {auditData.ccpi.validation.text}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            2. Crash Amplifier "Bonus" System
          </CardTitle>
          <CardDescription>Extreme condition multipliers that amplify crash risk beyond base score</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white p-6 rounded-lg border border-red-200">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Base CCPI</div>
                <div className="text-3xl font-bold text-blue-600">{raw(auditData.crashAmplifier.baseScore)}</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Amplifier Bonus</div>
                <div className="text-3xl font-bold text-orange-600">{auditData.crashAmplifier.totalBonus === null ? EM_DASH : `+${auditData.crashAmplifier.totalBonus}`}</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Final CCPI</div>
                <div className="text-3xl font-bold text-red-600">{raw(auditData.crashAmplifier.finalScore)}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Formula</h4>
                <code className="block bg-gray-50 p-3 rounded text-sm">{auditData.crashAmplifier.formula}</code>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Executive Summary</h4>
                <p className="text-sm text-gray-700">{auditData.crashAmplifier.executiveSummary}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Crash Amplifier Triggers</h4>
                <div className="space-y-2">
                  {auditData.crashAmplifier.triggers.map((trigger: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded">
                      <div className="mt-0.5">
                        {auditData.crashAmplifier.bonuses.find((b: any) =>
                          b.reason.includes(trigger.condition.split(" ")[0]),
                        ) ? (
                          <CheckCircle2 className="h-5 w-5 text-red-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-gray-900">{trigger.condition}</div>
                        <div className="text-sm text-red-700">{trigger.bonus}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {auditData.crashAmplifier.bonuses.length > 0 && (
                <div className="p-4 bg-red-100 border border-red-300 rounded">
                  <h4 className="font-semibold mb-2 text-red-900">🔴 Active Amplifiers</h4>
                  <div className="space-y-1">
                    {auditData.crashAmplifier.bonuses.map((bonus: any, idx: number) => (
                      <div key={idx} className="text-sm text-red-800">
                        • {bonus.reason}: <span className="font-bold">+{bonus.points} points</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
            3. Canary Warning System
          </CardTitle>
          <CardDescription>Early warning signals and threshold logic</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white p-6 rounded-lg border border-yellow-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Active Warnings</h3>
              <div className="text-4xl font-bold text-yellow-600">
                {raw(auditData.canaries.active)}/{raw(auditData.canaries.total)}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Formula</h4>
                <code className="block bg-gray-50 p-3 rounded text-sm">{auditData.canaries.formula}</code>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Executive Summary</h4>
                <p className="text-sm text-gray-700">{auditData.canaries.executiveSummary}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Severity Levels</h4>
                <div className="space-y-2">
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <span className="font-semibold text-red-900">🔴 High Severity: </span>
                    <span className="text-sm text-red-800">{auditData.canaries.severityLevels.high}</span>
                  </div>
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <span className="font-semibold text-yellow-900">🟡 Medium Severity: </span>
                    <span className="text-sm text-yellow-800">{auditData.canaries.severityLevels.medium}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Activity className="h-6 w-6 text-purple-600" />
            4. Four Pillars - Detailed Breakdown
          </CardTitle>
          <CardDescription>Complete formulas, indicators, data sources, and thresholds for all pillars</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="space-y-4">
            {auditData.pillars.map((pillar: PillarAudit, pillarIdx: number) => (
              <AccordionItem
                key={pillarIdx}
                value={`pillar-${pillarIdx}`}
                className="border rounded-lg overflow-hidden bg-white"
              >
                <AccordionTrigger className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="text-left">
                      <h3 className="font-bold text-lg">{pillar.name}</h3>
                      <p className="text-sm text-gray-600">
                        Weight: {pillar.weight}% | {pillar.indicators.length} indicators | scored weight{" "}
                        {raw(pillar.scoredMax)}/100 (live {raw(pillar.liveMax)}, AI {raw(pillar.aiMax)})
                      </p>
                    </div>
                    <div className="text-2xl font-bold text-purple-600">{raw(pillar.score)}/100</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  <div className="space-y-6">
                    {/* Pillar Summary */}
                    <div className="bg-purple-50 p-5 rounded-lg border border-purple-200">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold mb-2">Formula</h4>
                          <code className="block bg-white p-3 rounded text-xs">{pillar.formula}</code>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2">Calculation</h4>
                          <p className="text-sm text-gray-700">{pillar.calculation}</p>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2">Executive Summary</h4>
                          <p className="text-sm text-gray-700">{pillar.executiveSummary}</p>
                        </div>

                        <div className="p-3 bg-white border border-purple-300 rounded">
                          <p className="text-sm font-semibold">{pillar.validation}</p>
                        </div>
                      </div>
                    </div>

                    {/* Indicators */}
                    <div>
                      <h4 className="font-semibold mb-4 flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Indicators ({pillar.indicators.length})
                      </h4>
                      <Accordion type="single" collapsible className="space-y-3">
                        {pillar.indicators.map((indicator: IndicatorDetail, indIdx: number) => (
                          <AccordionItem
                            key={indIdx}
                            value={`indicator-${pillarIdx}-${indIdx}`}
                            className="border rounded-lg"
                          >
                            <AccordionTrigger className="px-4 py-3 hover:bg-gray-50">
                              <div className="flex items-center justify-between w-full pr-4">
                                <div className="text-left">
                                  <span className="font-semibold">{indicator.name}</span>
                                  <div className="flex items-center gap-2 mt-1">
                                    {getStatusBadge(indicator.dataSources.status)}
                                    <span className="text-xs text-gray-600">{String(indicator.currentValue)}</span>
                                  </div>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                              <div className="space-y-4">
                                <div>
                                  <h5 className="font-semibold text-sm mb-1">Technical Formula</h5>
                                  <code className="block bg-gray-50 p-2 rounded text-xs">{indicator.formula}</code>
                                </div>

                                <div>
                                  <h5 className="font-semibold text-sm mb-1">Executive Summary</h5>
                                  <p className="text-sm text-gray-700">{indicator.executiveSummary}</p>
                                </div>

                                <div>
                                  <h5 className="font-semibold text-sm mb-2">Value Ranges</h5>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-green-600">🟢 Safe:</span>
                                      <span className="text-gray-700">{indicator.ranges.safe}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-yellow-600">🟡 Warning:</span>
                                      <span className="text-gray-700">{indicator.ranges.warning}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-red-600">🔴 Danger:</span>
                                      <span className="text-gray-700">{indicator.ranges.danger}</span>
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <h5 className="font-semibold text-sm mb-2">Data Sources</h5>
                                  <div className="bg-gray-50 p-3 rounded space-y-2">
                                    <div className="text-sm">
                                      <span className="font-semibold">Primary:</span> {indicator.dataSources.primary}
                                    </div>
                                    <div className="text-sm">
                                      <span className="font-semibold">Current:</span>{" "}
                                      {indicator.dataSources.currentSource}{" "}
                                      {getStatusBadge(indicator.dataSources.status)}
                                    </div>
                                    <div className="text-sm">
                                      <span className="font-semibold">Fallback Chain:</span>
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {indicator.dataSources.fallbackChain.map((source: string, idx: number) => (
                                          <Badge key={idx} variant="outline" className="text-xs">
                                            {source}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <h5 className="font-semibold text-sm mb-2">Canary Thresholds</h5>
                                  <div className="space-y-1">
                                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                                      <span className="font-semibold">🟡 Medium Risk:</span>{" "}
                                      {indicator.canaryThresholds.medium}
                                    </div>
                                    <div className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                                      <span className="font-semibold">🔴 High Risk:</span>{" "}
                                      {indicator.canaryThresholds.high}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}
