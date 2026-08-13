import { NextResponse } from "next/server"
import { resolveApiKey } from "@/lib/api-keys"
import { fredLatestFromStore } from "@/lib/fred-store"
import { fetchVIXTermStructure } from "@/lib/vix-term-structure"
import { fetchQQQTechnicals as fetchQQQTechnicalsData } from "@/lib/qqq-technicals"
import { scrapeBuffettIndicator, scrapePutCallRatio, scrapeAAIISentiment } from "@/lib/scraping-bee"
import { fetchApifyYahooFinance as fetchApifyYahooFinanceUtil } from "@/lib/apify-yahoo-finance"
import { fetchFMPValuation } from "@/lib/fmp-valuation"

import { PILLAR_WEIGHTS } from "@/lib/ccpi/constants"
import { generateCanarySignals } from "@/lib/ccpi/canaries"
import {
  type Tier,
  type PillarResult,
  type MomentumTiers,
  type RiskAppetiteTiers,
  type ValuationTiers,
  type MacroTiers,
  computeMomentumPillar,
  computeRiskAppetitePillar,
  computeValuationPillar,
  computeMacroPillar,
  computeBaseCCPI,
  calculateCrashAmplifiers,
  computeCertainty,
  determineRegime,
  getPlaybook,
  TOTAL_SCORED_INDICATORS,
  type Regime,
} from "@/lib/ccpi/scoring"

import {
  getShillerCAPE,
  getShortInterest,
  getMag7Concentration,
  getQQQPE,
  getBuffettIndicator,
  getPutCallRatio,
  getAAIIBullish,
  getVIX,
  getNVIDIAPrice,
  getSOXIndex,
  getISMPMI,
} from "@/lib/unified-ai-fallback"


// P6-13. This route was 990 lines. Its body is now `lib/ccpi/route/`:
// `provenance.ts` (which tier backed each indicator, and the guard that turns
// anything weaker than live-or-AI into a null), `market-data.ts`,
// `indicators.ts` (FRED, Alpha Vantage, equity fear/greed) and
// `weekly-summary.ts`. What is left here is GET and the status tracking.
import {
  type APIStatusTracker,
  type DataSourceStatus,
  type TierMaps,
  aiTier,
  buildProvenance,
  measured,
  weakerTier,
} from "@/lib/ccpi/route/provenance"
import { calculateEquityRiskPremium, fetchMarketData } from "@/lib/ccpi/route/market-data"
import {
  fetchAlphaVantageIndicators,
  fetchEquityFearGreed,
  fetchFREDIndicators,
} from "@/lib/ccpi/route/indicators"
import { generateWeeklySummary } from "@/lib/ccpi/route/weekly-summary"



// Pillar weights as display percentages (source of truth: lib/ccpi/constants.ts).
// The former inline comments claiming 40/30/20/10 were stale — actual weights
// are 35/30/15/20.
const PILLAR_PCT = {
  momentum: PILLAR_WEIGHTS.momentum * 100,
  riskAppetite: PILLAR_WEIGHTS.riskAppetite * 100,
  valuation: PILLAR_WEIGHTS.valuation * 100,
  macro: PILLAR_WEIGHTS.macro * 100,
} as const

export async function GET() {
  try {
    console.log("[v0] CCPI GET: Starting...")

    console.log("[v0] CCPI GET: Fetching market data...")
    const data = await fetchMarketData()
    console.log("[v0] CCPI GET: Market data fetched successfully")

    // Compute the 4 pillar scores through the pure scoring core
    // (lib/ccpi/scoring.ts) with three-tier provenance renormalization.
    console.log("[v0] CCPI GET: Computing pillars...")
    const momentum = computeMomentumPillar(data, data.tiers.momentum)
    console.log("[v0] CCPI GET: Momentum pillar computed:", momentum)

    const riskAppetite = computeRiskAppetitePillar(data, data.tiers.riskAppetite)
    console.log("[v0] CCPI GET: Risk appetite pillar computed:", riskAppetite)

    const valuation = computeValuationPillar(data, data.tiers.valuation)
    console.log("[v0] CCPI GET: Valuation pillar computed:", valuation)

    const macro = computeMacroPillar(data, data.tiers.macro)
    console.log("[v0] CCPI GET: Macro pillar computed:", macro)

    const pillarResults = { momentum, riskAppetite, valuation, macro }
    const baseCCPI = computeBaseCCPI(pillarResults)

    if (baseCCPI === null) {
      // Every pillar fell below the minimum scored weight — refuse to invent a number.
      return NextResponse.json(
        {
          error: "CCPI cannot be computed: insufficient live/AI-sourced data in every pillar",
          provenance: buildProvenance(pillarResults, data.tiers),
          apiStatus: data.apiStatus,
          timestamp: new Date().toISOString(),
        },
        { status: 503 },
      )
    }

    // The amplifiers sit outside the pillar tier system, so they used to read
    // the assembly layer's baseline constants as real market data: with QQQ
    // unavailable, `qqqDailyReturn` arrived as 0 and `qqqBelowSMA50` as false —
    // two assertions the data never made. Baseline-tier inputs are passed as
    // null and simply do not fire their bonus. `measured` is module-scope
    // now — the canary signals need the same guard (P6-31).
    const crashAmplifiers = calculateCrashAmplifiers({
      qqqDailyReturn: measured(data.qqqDailyReturn, data.tiers.momentum.qqqDailyReturn),
      qqqBelowSMA50: measured(data.qqqBelowSMA50, data.tiers.momentum.qqqSMA50),
      vix: measured(data.vix, data.tiers.momentum.vix),
      putCallRatio: measured(data.putCallRatio, data.tiers.riskAppetite.putCallRatio),
    })
    const finalCCPI = Math.min(100, baseCCPI + crashAmplifiers.totalBonus)

    console.log("[v0] CCPI v2.1 Calculation:")
    console.log("  Base CCPI:", baseCCPI)
    console.log("  Crash Amplifiers:", crashAmplifiers.bonuses)
    console.log("  Total Bonus:", crashAmplifiers.totalBonus)
    console.log("  Final CCPI:", finalCCPI)

    // Canaries live in lib/ccpi/canaries.ts and take nullable inputs only
    // (P6-32). Resolving the tier here is the whole point: a baseline-tier
    // value is the assembly layer's own constant, and a warning evaluated
    // against a constant is not a warning about the market. Paired inputs
    // (breach flag + proximity) share one tier, because they share one source.
    console.log("[v0] CCPI GET: Generating canary signals...")
    const mt = data.tiers.momentum
    const rt = data.tiers.riskAppetite
    const vt = data.tiers.valuation
    const kt = data.tiers.macro
    const { canaries, suppressed: suppressedCanaries } = generateCanarySignals({
      qqqDailyReturn: measured(data.qqqDailyReturn, mt.qqqDailyReturn),
      qqqConsecDown: measured(data.qqqConsecDown, mt.qqqConsecDown),
      qqqBelowSMA20: measured(data.qqqBelowSMA20, mt.qqqSMA20),
      qqqSMA20Proximity: measured(data.qqqSMA20Proximity, mt.qqqSMA20),
      qqqBelowSMA50: measured(data.qqqBelowSMA50, mt.qqqSMA50),
      qqqSMA50Proximity: measured(data.qqqSMA50Proximity, mt.qqqSMA50),
      qqqBelowSMA200: measured(data.qqqBelowSMA200, mt.qqqSMA200),
      qqqSMA200Proximity: measured(data.qqqSMA200Proximity, mt.qqqSMA200),
      qqqBelowBollinger: measured(data.qqqBelowBollinger, mt.qqqBollinger),
      qqqBollingerProximity: measured(data.qqqBollingerProximity, mt.qqqBollinger),
      vix: measured(data.vix, mt.vix),
      vixTermStructure: measured(data.vixTermStructure, mt.vixTermStructure),
      nvidiaMomentum: measured(data.nvidiaMomentum, mt.nvidiaMomentum),
      soxIndex: measured(data.soxIndex, mt.soxIndex),
      putCallRatio: measured(data.putCallRatio, rt.putCallRatio),
      // Already nullable at source (P6-18) — no tier gate needed.
      fearGreedIndex: data.fearGreedIndex,
      aaiiBullish: measured(data.aaiiBullish, rt.aaiiBullish),
      shortInterest: measured(data.shortInterest, rt.shortInterest),
      // Informational, outside the tier system; undefined means not fetched.
      etfFlows: data.etfFlows ?? null,
      spxPE: measured(data.spxPE, vt.spxPE),
      spxPS: measured(data.spxPS, vt.spxPS),
      buffettIndicator: measured(data.buffettIndicator, vt.buffettIndicator),
      qqqPE: measured(data.qqqPE, vt.qqqPE),
      mag7Concentration: measured(data.mag7Concentration, vt.mag7Concentration),
      shillerCAPE: measured(data.shillerCAPE, vt.shillerCAPE),
      equityRiskPremium: measured(data.equityRiskPremium, vt.equityRiskPremium),
      fedFundsRate: measured(data.fedFundsRate, kt.fedFundsRate),
      junkSpread: measured(data.junkSpread, kt.junkSpread),
      debtToGDP: measured(data.debtToGDP, kt.debtToGDP),
      yieldCurve: measured(data.yieldCurve, kt.yieldCurve),
      tedSpread: measured(data.tedSpread, kt.tedSpread),
      dxyIndex: measured(data.dxyIndex, kt.dxyIndex),
      ismPMI: measured(data.ismPMI, kt.ismPMI),
      fedReverseRepo: measured(data.fedReverseRepo, kt.fedReverseRepo),
    }, PILLAR_PCT)
    console.log(
      `[v0] CCPI GET: ${canaries.length} canary signals; ${suppressedCanaries.length} indicator(s) could not be evaluated`,
    )

    // Certainty is strictly a data-quality number (live vs AI vs baseline
    // weight); the canary count no longer inflates it.
    console.log("[v0] CCPI GET: Computing certainty...")
    const confidence = computeCertainty(pillarResults)
    console.log("[v0] CCPI GET: Certainty computed:", confidence)

    console.log("[v0] CCPI GET: Determining regime...")
    const regime = determineRegime(finalCCPI)
    console.log("[v0] CCPI GET: Regime determined:", regime.name)

    console.log("[v0] CCPI GET: Getting playbook...")
    const playbook = getPlaybook(regime)
    console.log("[v0] CCPI GET: Playbook retrieved")

    console.log("[v0] CCPI GET: Generating summary...")
    const summary = generateWeeklySummary(finalCCPI, confidence, regime, pillarResults, canaries)
    console.log("[v0] CCPI GET: Summary generated")

    const response = {
      ccpi: finalCCPI,
      baseCCPI,
      crashAmplifiers: crashAmplifiers.bonuses,
      totalBonus: crashAmplifiers.totalBonus,
      // Amplifier inputs that were unavailable, so a +0 bonus is not read as
      // "no acute event detected" when it means "could not check".
      amplifierInputsUnavailable: crashAmplifiers.unavailableInputs,
      confidence,
      certainty: confidence,
      regime,
      playbook,
      summary,
      // A pillar is null when less than 40 of its 100 weight is backed by
      // live or AI data — the composite renormalizes over the scored pillars.
      pillars: {
        momentum: momentum.score,
        riskAppetite: riskAppetite.score,
        valuation: valuation.score,
        macro: macro.score,
      },
      // NEW: per-pillar provenance so the UI can show what the score is built on.
      provenance: buildProvenance(pillarResults, data.tiers),
      indicators: {
        // Technical & Price Action
        qqqDailyReturn: data.qqqDailyReturn,
        qqqConsecDown: data.qqqConsecDown,
        qqqBelowSMA20: data.qqqBelowSMA20,
        qqqBelowSMA50: data.qqqBelowSMA50,
        qqqBelowSMA200: data.qqqBelowSMA200,
        qqqBelowBollinger: data.qqqBelowBollinger,
        qqqSMA20Proximity: data.qqqSMA20Proximity,
        qqqSMA50Proximity: data.qqqSMA50Proximity,
        qqqSMA200Proximity: data.qqqSMA200Proximity,
        qqqBollingerProximity: data.qqqBollingerProximity,
        vix: data.vix,
        // RATIO convention: VIX3M / spot VIX; < 1 = backwardation.
        vixTermStructure: data.vixTermStructure,
        vixTermInverted: data.vixTermInverted,
        // vxn / rvx / atr / ltv / spotVol / bullishPercent / highLowIndex were
        // removed: unsourced baseline constants (AUDIT P3-19).

        // Fundamental & Valuation
        spxPE: data.spxPE,
        spxPS: data.spxPS,
        buffettIndicator: data.buffettIndicator,

        // Macro Economic
        fedFundsRate: data.fedFundsRate,
        junkSpread: data.junkSpread,
        yieldCurve: data.yieldCurve,
        debtToGDP: data.debtToGDP,

        // Sentiment & Social
        putCallRatio: data.putCallRatio,
        fearGreedIndex: data.fearGreedIndex,
        etfFlows: data.etfFlows,
        shortInterest: data.shortInterest,
        aaiiBullish: data.aaiiBullish,
        aaiiBearish: data.aaiiBearish,
        aaiiSpread: data.aaiiSpread,

        // Phase 1 indicators
        nvidiaPrice: data.nvidiaPrice,
        nvidiaMomentum: data.nvidiaMomentum,
        soxIndex: data.soxIndex,
        tedSpread: data.tedSpread,
        dxyIndex: data.dxyIndex,
        ismPMI: data.ismPMI,
        fedReverseRepo: data.fedReverseRepo,

        // Phase 2 indicators
        qqqPE: data.qqqPE,
        mag7Concentration: data.mag7Concentration,
        shillerCAPE: data.shillerCAPE,
        equityRiskPremium: data.equityRiskPremium,
      },
      canaries,
      activeCanaries: canaries.filter((c) => c.severity === "high" || c.severity === "medium").length,
      // Indicators whose input was baseline-tier, so no warning could be
      // evaluated either way. A short canary list and a short canary list with
      // eleven suppressed inputs are very different states (P6-32).
      suppressedCanaries,
      totalIndicators: TOTAL_SCORED_INDICATORS,
      apiStatus: data.apiStatus,
      timestamp: new Date().toISOString(),
      cachedAt: new Date().toISOString(),
    }

    // P2-2. This route used to POST its own response to /api/ccpi/cache — a
    // server-side fetch from a route back into the same deployment, to write a
    // module-level variable that the next invocation would not see. On Vercel
    // each request may get a fresh isolate, so the write was usually invisible
    // and always cost a round trip. The route and the self-fetch are both gone.

    console.log("[v0] CCPI GET: Returning response...")
    return NextResponse.json(response)
  } catch (error) {
    console.error("[v0] CCPI GET Error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

