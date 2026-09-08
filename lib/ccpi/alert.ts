import { Resend } from "resend"
import { resolveApiKey } from "@/lib/api-keys"
import { upsertSeriesPoint, getSeriesHistory } from "@/lib/market-series"
import { fetchMarketData } from "@/lib/ccpi/route/market-data"
import { measured } from "@/lib/ccpi/route/provenance"
import {
  computeMomentumPillar,
  computeRiskAppetitePillar,
  computeValuationPillar,
  computeMacroPillar,
  computeBaseCCPI,
  calculateCrashAmplifiers,
  computeCertainty,
  determineRegime,
  getPlaybook,
  type PillarResult,
} from "@/lib/ccpi/scoring"

/**
 * CCPI health check + alerting (Plan A / P7-69, 2026-09-07).
 *
 * The CCPI is computed only when a signed-in member opens the dashboard, so a
 * pillar dropping below the scored-weight floor, a certainty collapse, or a
 * regime worsening can all happen with NOBODY told. This runs the same scoring
 * spine as /api/ccpi on a nightly cron, stores the score (which also begins the
 * daily history the §6b backtests will eventually need), and emails the owner
 * ONLY when something is wrong — a dropped pillar, low certainty, or a regime
 * that just got worse than the last reading.
 *
 * It deliberately reuses the exact scoring functions the route uses — the math
 * is single-source — but does NOT touch the route, so it cannot regress the
 * dashboard. It skips the route's provenance/canary/weekly-summary assembly,
 * which alerting does not need.
 */

const PILLAR_LABEL: Record<string, string> = {
  momentum: "Momentum",
  riskAppetite: "Risk Appetite",
  valuation: "Valuation",
  macro: "Macro",
}

/** Friendly names for the scored inputs, so an alert can say WHICH feed failed
 *  (Plan A workstream 2 — feed reliability), not just which pillar dropped. */
const INDICATOR_LABEL: Record<string, string> = {
  qqqDailyReturn: "QQQ daily return", qqqConsecDown: "QQQ consecutive down days",
  qqqSMA20: "QQQ 20-day MA", qqqSMA50: "QQQ 50-day MA", qqqSMA200: "QQQ 200-day MA",
  qqqBollinger: "QQQ Bollinger", vix: "VIX", vixTermStructure: "VIX term structure",
  nvidiaMomentum: "NVIDIA momentum", soxIndex: "SOX index",
  putCallRatio: "Put/Call ratio", fearGreedIndex: "CNN Fear & Greed", aaiiBullish: "AAII bullish",
  spxPE: "S&P 500 P/E", spxPS: "S&P 500 P/S", buffettIndicator: "Buffett indicator", equityRiskPremium: "Equity risk premium",
  dxyIndex: "Dollar index", fedFundsRate: "Fed funds rate", fedReverseRepo: "Reverse repo",
  junkSpread: "Junk-bond spread", debtToGDP: "Debt/GDP", yieldCurve: "Yield curve",
}

const label = (key: string): string => INDICATOR_LABEL[key] ?? key

/** Certainty below this (percent of weight backed by live data) is worth a warning. */
const CERTAINTY_ALERT_BELOW = 60

export interface CcpiHealthResult {
  computed: boolean
  score: number | null
  regime: string | null
  certainty: number | null
  droppedPillars: string[]
  regimeWorsened: boolean
  lowCertainty: boolean
  alerted: boolean
  reason: string
}

export async function runCcpiHealthCheck(): Promise<CcpiHealthResult> {
  const data = await fetchMarketData()

  const pillars: Record<string, PillarResult> = {
    momentum: computeMomentumPillar(data, data.tiers.momentum),
    riskAppetite: computeRiskAppetitePillar(data, data.tiers.riskAppetite),
    valuation: computeValuationPillar(data, data.tiers.valuation),
    macro: computeMacroPillar(data, data.tiers.macro),
  }
  const pillarResults = {
    momentum: pillars.momentum,
    riskAppetite: pillars.riskAppetite,
    valuation: pillars.valuation,
    macro: pillars.macro,
  }

  // A pillar that scored null fell below the minimum scored weight — the silent
  // dropout P7-69 is about. Naming the excluded inputs turns "Risk Appetite is
  // not scoring" into "…because AAII and Fear & Greed are not live" — the
  // actionable half (Plan A workstream 2).
  const dropped = Object.entries(pillars).filter(([, p]) => p.score === null)
  const droppedPillars = dropped.map(([k]) => PILLAR_LABEL[k] ?? k)
  const droppedDetail = dropped.map(([k, p]) => {
    const missing = p.excluded.map(label)
    return `${PILLAR_LABEL[k] ?? k}${missing.length ? ` (not live: ${missing.join(", ")})` : ""}`
  })

  const baseCCPI = computeBaseCCPI(pillarResults)
  if (baseCCPI === null) {
    // Every pillar is below the floor — the strongest possible alert.
    const alerted = await sendAlert({
      score: null,
      regimeName: null,
      certainty: null,
      droppedPillars: Object.values(PILLAR_LABEL),
      regimeWorsened: false,
      lowCertainty: true,
      cashTarget: null,
      bias: null,
    })
    return {
      computed: false,
      score: null,
      regime: null,
      certainty: null,
      droppedPillars: Object.values(PILLAR_LABEL),
      regimeWorsened: false,
      lowCertainty: true,
      alerted,
      reason: "CCPI could not be computed — every pillar below the scored-weight floor.",
    }
  }

  const crash = calculateCrashAmplifiers({
    qqqDailyReturn: measured(data.qqqDailyReturn, data.tiers.momentum.qqqDailyReturn),
    qqqBelowSMA50: measured(data.qqqBelowSMA50, data.tiers.momentum.qqqSMA50),
    vix: measured(data.vix, data.tiers.momentum.vix),
    putCallRatio: measured(data.putCallRatio, data.tiers.riskAppetite.putCallRatio),
  })
  const finalCCPI = Math.min(100, baseCCPI + crash.totalBonus)
  const certainty = computeCertainty(pillarResults)
  const regime = determineRegime(finalCCPI)
  const playbook = getPlaybook(regime)

  const today = new Date().toISOString().slice(0, 10)

  // Read the prior stored reading BEFORE writing today's, to detect a worsening.
  let regimeWorsened = false
  const history = await getSeriesHistory("calc:ccpi", 10)
  const prior = (history ?? []).find((h) => h.day < today)
  if (prior) {
    const priorRegime = determineRegime(prior.value)
    regimeWorsened = regime.level > priorRegime.level
  }

  // Store today's score and certainty — begins the daily CCPI history the route
  // never kept, and makes data-health (certainty) trackable over time, not just
  // alertable in the moment.
  await upsertSeriesPoint("calc:ccpi", today, Math.round(finalCCPI * 100) / 100)
  await upsertSeriesPoint("calc:ccpi_certainty", today, Math.round(certainty * 10) / 10)

  const lowCertainty = certainty < CERTAINTY_ALERT_BELOW
  const shouldAlert = droppedPillars.length > 0 || regimeWorsened || lowCertainty

  let alerted = false
  if (shouldAlert) {
    alerted = await sendAlert({
      score: finalCCPI,
      regimeName: regime.name,
      certainty,
      droppedPillars: droppedDetail,
      regimeWorsened,
      lowCertainty,
      cashTarget: playbook.allocation.cash,
      bias: playbook.bias,
    })
  }

  return {
    computed: true,
    score: Math.round(finalCCPI * 100) / 100,
    regime: regime.name,
    certainty: Math.round(certainty),
    droppedPillars,
    regimeWorsened,
    lowCertainty,
    alerted,
    reason: shouldAlert ? "Alert conditions met." : "All clear — no alert sent.",
  }
}

async function sendAlert(a: {
  score: number | null
  regimeName: string | null
  certainty: number | null
  droppedPillars: string[]
  regimeWorsened: boolean
  lowCertainty: boolean
  cashTarget: string | null
  bias: string | null
}): Promise<boolean> {
  const key = resolveApiKey("RESEND_API_KEY")
  const to = process.env.ADMIN_EMAIL
  if (!key || !to) return false

  const reasons: string[] = []
  if (a.regimeWorsened) reasons.push("The market regime just worsened from the last reading.")
  if (a.droppedPillars.length > 0)
    reasons.push(`Not scoring (below the live-data floor): ${a.droppedPillars.join(", ")}. The headline runs on the pillars that remain.`)
  if (a.lowCertainty && a.certainty !== null) reasons.push(`Certainty is ${Math.round(a.certainty)}% — below the ${CERTAINTY_ALERT_BELOW}% floor; too little of the score is backed by live data.`)
  if (a.lowCertainty && a.certainty === null) reasons.push("The CCPI could not be computed at all — no pillar had enough live data.")

  const scoreLine = a.score !== null ? `CCPI ${a.score.toFixed(0)} — ${a.regimeName}` : "CCPI: not computable"
  const cashLine = a.cashTarget ? `<p style="margin:8px 0 0;color:#334155"><b>Playbook:</b> ${a.bias}. Suggested cash ${a.cashTarget}.</p>` : ""

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;line-height:1.55;color:#0f172a">
    <h2 style="margin:0 0 6px;font-size:18px">CCPI alert — ${scoreLine}</h2>
    <ul style="padding-left:18px;color:#334155;margin:8px 0">${reasons.map((r) => `<li style="margin:4px 0">${r}</li>`).join("")}</ul>
    ${cashLine}
    <p style="color:#94a3b8;font-size:12px;margin-top:16px">Computed nightly from the same scoring the dashboard uses. This is a data-health and regime alert, not advice.</p>
  </div>`
  const text = `CCPI alert — ${scoreLine}\n\n${reasons.map((r) => `- ${r}`).join("\n")}${a.cashTarget ? `\n\nPlaybook: ${a.bias}. Suggested cash ${a.cashTarget}.` : ""}`

  try {
    const { error } = await new Resend(key).emails.send({
      from: "Options Calculator <noreply@options-calculators.com>",
      to,
      subject: `CCPI alert — ${scoreLine}`,
      html,
      text,
    })
    return !error
  } catch {
    return false
  }
}
