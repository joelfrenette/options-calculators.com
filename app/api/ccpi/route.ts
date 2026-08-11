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


interface DataSourceStatus {
  live: boolean
  source: string
  lastUpdated: string
}

interface APIStatusTracker {
  technical: DataSourceStatus
  vixTerm: DataSourceStatus
  fred: DataSourceStatus
  alphaVantage: DataSourceStatus
  apify: DataSourceStatus
  fearGreed: DataSourceStatus
  buffett: DataSourceStatus
  putCall: DataSourceStatus
  aaii: DataSourceStatus
  shortInterest: DataSourceStatus
}

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

    try {
      await fetch(new URL("/api/ccpi/cache", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Was `JSON.JSON.stringify` — a TypeError swallowed by the catch below,
        // so the cache was never populated through this path (AUDIT_BACKLOG P3-x).
        body: JSON.stringify(response),
      })
    } catch (cacheError) {
      console.warn("[v0] Failed to cache CCPI data:", cacheError)
      // Don't fail the request if caching fails
    }

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

interface TierMaps {
  momentum: MomentumTiers
  riskAppetite: RiskAppetiteTiers
  valuation: ValuationTiers
  macro: MacroTiers
}

function buildProvenance(
  results: { momentum: PillarResult; riskAppetite: PillarResult; valuation: PillarResult; macro: PillarResult },
  tiers: TierMaps,
) {
  const pack = (r: PillarResult, t: Record<string, Tier>) => ({
    scoredMax: r.scoredMax,
    liveMax: r.liveMax,
    aiMax: r.aiMax,
    excluded: r.excluded,
    tiers: t,
  })
  return {
    momentum: pack(results.momentum, tiers.momentum),
    riskAppetite: pack(results.riskAppetite, tiers.riskAppetite),
    valuation: pack(results.valuation, tiers.valuation),
    macro: pack(results.macro, tiers.macro),
  }
}

/**
 * Passes a value through only when it was MEASURED.
 *
 * A baseline-tier value is the assembly layer's own fallback constant, and
 * since P6-34 an ai-estimate is an LLM's guess at a published figure — neither
 * is a market observation. Reading either as fact is the P6-20 defect, so both
 * come back null and the caller has to decide what to do about missing data.
 *
 * Originally this dropped `baseline` only. That left an inconsistency the
 * moment P6-34 landed: the pillars stopped scoring AI estimates while the crash
 * amplifiers and the headline canaries went on evaluating them, so a warning
 * could still fire off a number the index itself refused to count. Found while
 * fixing P6-33, one file over.
 */
function measured<T>(value: T, tier: Tier): T | null {
  return tier === "baseline" || tier === "ai-estimate" ? null : value
}

/**
 * AI-fallback source string → provenance tier.
 *
 * "unavailable" replaced "baseline" when fetchWithAIFallback stopped inventing
 * a constant (P6-34); both tier as `baseline`, which is excluded from scoring
 * and suppressed from the canaries. The difference is that "unavailable" now
 * carries a null value, so there is nothing left to accidentally read.
 */
function aiTier(source: "grok" | "groq" | "anthropic" | "openai" | "unavailable"): Tier {
  return source === "unavailable" ? "baseline" : "ai-estimate"
}

/** The weaker of two tiers, for derived indicators (live > ai-estimate > baseline). */
function weakerTier(a: Tier, b: Tier): Tier {
  const rank: Record<Tier, number> = { baseline: 0, "ai-estimate": 1, live: 2 }
  return rank[a] <= rank[b] ? a : b
}

async function fetchMarketData() {
  const now = () => new Date().toISOString()
  const apiStatus: APIStatusTracker = {
    technical: { live: false, source: "baseline", lastUpdated: now() },
    vixTerm: { live: false, source: "baseline", lastUpdated: now() },
    fred: { live: false, source: "baseline", lastUpdated: now() },
    alphaVantage: { live: false, source: "baseline", lastUpdated: now() },
    apify: { live: false, source: "baseline", lastUpdated: now() },
    fearGreed: { live: false, source: "baseline", lastUpdated: now() },
    buffett: { live: false, source: "baseline", lastUpdated: now() },
    putCall: { live: false, source: "baseline", lastUpdated: now() },
    aaii: { live: false, source: "baseline", lastUpdated: now() },
    shortInterest: { live: false, source: "baseline", lastUpdated: now() },
  }

  const [
    shillerCAPEResult,
    shortInterestResult,
    mag7Result,
    qqqPEResult,
    buffettResult,
    putCallResult,
    aaiiBullishResult,
    vixAiResult,
    nvidiaPriceResult,
    soxIndexResult,
    ismPMIResult,
  ] = await Promise.all([
    getShillerCAPE(),
    getShortInterest(),
    getMag7Concentration(),
    getQQQPE(),
    getBuffettIndicator(),
    getPutCallRatio(),
    getAAIIBullish(),
    getVIX(),
    getNVIDIAPrice(),
    getSOXIndex(),
    getISMPMI(),
  ])

  // Spot VIX is a PUBLISHED NUMBER, and the site already stores it: the
  // market-snapshot cron writes FRED VIXCLS daily. Asking an LLM to recall
  // today's VIX — which is what the fallback chain did whenever the term
  // structure fetch failed — is guessing at a fact, and `isPlausible` waves
  // through anything between 5 and 100 (P6-31b). Read the store first; the AI
  // chain is now the third choice, behind two real sources.
  const vixFromStore = await fredLatestFromStore("VIXCLS")
  const vixResult = vixFromStore ? { value: vixFromStore.value, source: "fred-store" as const } : vixAiResult
  if (vixFromStore) {
    console.log(`[v0] ✓ VIX from FRED store: ${vixFromStore.value} (${vixFromStore.day})`)
  }

  console.log("[v0] AI Fallback Summary:")
  console.log(`  Shiller CAPE: ${shillerCAPEResult.value} (${shillerCAPEResult.source})`)
  console.log(`  Short Interest: ${shortInterestResult.value} (${shortInterestResult.source})`)
  console.log(`  Mag7 Concentration: ${mag7Result.value} (${mag7Result.source})`)
  console.log(`  QQQ P/E: ${qqqPEResult.value} (${qqqPEResult.source})`)
  console.log(`  Buffett Indicator: ${buffettResult.value} (${buffettResult.source})`)
  console.log(`  Put/Call Ratio: ${putCallResult.value} (${putCallResult.source})`)
  console.log(`  AAII Bullish: ${aaiiBullishResult.value} (${aaiiBullishResult.source})`)
  console.log(`  VIX: ${vixResult.value} (${vixResult.source})`)
  console.log(`  NVIDIA Price: ${nvidiaPriceResult.value} (${nvidiaPriceResult.source})`)
  console.log(`  SOX Index: ${soxIndexResult.value} (${soxIndexResult.source})`)
  console.log(`  ISM PMI: ${ismPMIResult.value} (${ismPMIResult.source})`)

  const results = await Promise.allSettled([
    fetchQQQTechnicalsData(),
    fetchVIXTermStructure(),
    fetchFREDIndicators(),
    fetchAlphaVantageIndicators(),
    fetchApifyYahooFinanceUtil("SPY"),
    fetchEquityFearGreed(),
    scrapeBuffettIndicator(),
    scrapePutCallRatio(),
    scrapeAAIISentiment(),
    fetchFMPValuation("SPY"), // live valuation fallback when Apify is disabled
  ])

  const qqqData = results[0].status === "fulfilled" ? results[0].value : null
  const vixTermData = results[1].status === "fulfilled" ? results[1].value : null
  const fredData = results[2].status === "fulfilled" ? results[2].value : null
  const alphaVantageData = results[3].status === "fulfilled" ? results[3].value : null
  const apifyRaw = results[4].status === "fulfilled" ? results[4].value : null
  const fearGreedData = results[5].status === "fulfilled" ? results[5].value : { fearGreed: null, dataSource: "failed" }
  const buffettData =
    results[6].status === "fulfilled"
      ? results[6].value
      : { ratio: buffettResult.value, status: "baseline" as const }
  const putCallData =
    results[7].status === "fulfilled"
      ? results[7].value
      : { ratio: putCallResult.value, status: "baseline" as const }
  const aaiData =
    results[8].status === "fulfilled"
      ? results[8].value
      : { bullish: aaiiBullishResult.value, bearish: 30, neutral: 35, spread: 5, status: "baseline" as const }
  const fmpVal = results[9].status === "fulfilled" ? results[9].value : null

  const qqqLive = qqqData?.source === "live"
  const vixTermLive = vixTermData?.source === "live"
  const fredLive = fredData?.source === "live"
  const alphaVantageLive = alphaVantageData?.source === "live"
  const apifyLive = Boolean(apifyRaw?.data && apifyRaw.dataSource && !apifyRaw.dataSource.includes("baseline"))
  const fearGreedLive = fearGreedData.fearGreed !== null
  const fmpLive = Boolean(fmpVal && (fmpVal.spxPE !== undefined || fmpVal.spxPS !== undefined))

  apiStatus.technical = { live: qqqLive, source: qqqData?.source || "baseline", lastUpdated: now() }
  apiStatus.vixTerm = { live: vixTermLive, source: vixTermData?.source || vixResult.source, lastUpdated: now() }
  apiStatus.fred = { live: fredLive, source: fredLive ? "FRED API" : ismPMIResult.source, lastUpdated: now() }
  apiStatus.alphaVantage = {
    live: alphaVantageLive,
    source: alphaVantageLive ? "Alpha Vantage API" : `${nvidiaPriceResult.source} / ${soxIndexResult.source}`,
    lastUpdated: now(),
  }
  apiStatus.apify = {
    live: apifyLive,
    source: apifyRaw?.dataSource || (fmpLive ? "FMP key-metrics" : "baseline"),
    lastUpdated: now(),
  }
  apiStatus.fearGreed = {
    live: fearGreedLive,
    source: fearGreedData.dataSource,
    lastUpdated: now(),
  }
  apiStatus.buffett = {
    live: buffettData.status === "live",
    source: buffettData.status === "live" ? "ScrapingBee" : buffettResult.source,
    lastUpdated: now(),
  }
  apiStatus.putCall = {
    live: putCallData.status === "live",
    source: putCallData.status === "live" ? "ScrapingBee" : putCallResult.source,
    lastUpdated: now(),
  }
  apiStatus.aaii = {
    live: aaiData.status === "live",
    source: aaiData.status === "live" ? "ScrapingBee" : aaiiBullishResult.source,
    lastUpdated: now(),
  }
  // Short interest has no scraped source wired in — it always comes from the
  // AI fallback chain (the old `status === "live"` comparison could never be true).
  apiStatus.shortInterest = { live: false, source: shortInterestResult.source, lastUpdated: now() }

  const spxPE = (apifyLive ? apifyRaw?.data?.forwardPE || apifyRaw?.data?.trailingPE : undefined) || fmpVal?.spxPE || 22.5
  const spxPS = (apifyLive ? apifyRaw?.data?.priceToSales : undefined) || fmpVal?.spxPS || 2.8
  const spxPETier: Tier = apifyLive || fmpVal?.spxPE !== undefined ? "live" : "baseline"
  const spxPSTier: Tier = (apifyLive && apifyRaw?.data?.priceToSales) || fmpVal?.spxPS !== undefined ? "live" : "baseline"
  const yieldCurve10Y = fredData?.yieldCurve10Y ?? 4.5
  // Per-series, not blanket (P6-6): the 10Y is the only series ERP depends on.
  const fredTier: Tier = fredData?.yieldCurve10Y != null ? "live" : "baseline"

  // -------------------------------------------------------------------------
  // Three-tier provenance map (P3-12): live | ai-estimate | baseline.
  // Baseline-tier inputs are EXCLUDED from their pillar and the pillar
  // renormalizes over the weight actually scored (lib/ccpi/scoring.ts).
  // -------------------------------------------------------------------------
  const tiers: TierMaps = {
    momentum: {
      nvidiaMomentum: alphaVantageLive ? "live" : "baseline",
      soxIndex: aiTier(soxIndexResult.source),
      qqqDailyReturn: qqqLive ? "live" : "baseline",
      qqqConsecDown: qqqLive ? "live" : "baseline",
      qqqSMA20: qqqLive ? "live" : "baseline",
      qqqSMA50: qqqLive ? "live" : "baseline",
      qqqSMA200: qqqLive ? "live" : "baseline",
      qqqBollinger: qqqLive ? "live" : "baseline",
      // Spot VIX: real FRED value when the term-structure fetch is live,
      // else the AI-fallback estimate.
      // Store-sourced VIX is a real FRED observation, not an estimate.
      vix: vixTermLive || vixResult.source === "fred-store" ? "live" : aiTier(vixResult.source),
      vixTermStructure: vixTermLive ? "live" : "baseline",
    },
    riskAppetite: {
      // `status === "live"` used to be trusted outright, which let
      // scrapePutCallRatio self-report an LLM answer and a VIX-derived number as
      // live — and live scores. The scraper now distinguishes its own tiers, so
      // only a real CBOE reading claims live.
      putCallRatio:
        putCallData.status === "live"
          ? "live"
          : putCallData.status === "ai-estimate"
            ? "ai-estimate"
            : aiTier(putCallResult.source),
      fearGreedIndex: fearGreedLive ? "live" : "baseline",
      aaiiBullish: aaiData.status === "live" ? "live" : aiTier(aaiiBullishResult.source),
      shortInterest: aiTier(shortInterestResult.source),
    },
    valuation: {
      spxPE: spxPETier,
      spxPS: spxPSTier,
      buffettIndicator: buffettData.status === "live" ? "live" : aiTier(buffettResult.source),
      qqqPE: aiTier(qqqPEResult.source),
      mag7Concentration: aiTier(mag7Result.source),
      shillerCAPE: aiTier(shillerCAPEResult.source),
      // Derived from S&P earnings yield and the FRED 10Y — as weak as its
      // weakest component.
      equityRiskPremium: weakerTier(spxPETier, fredTier),
    },
    macro: {
      // Per-series (P6-6): "live" only when THAT series actually parsed. The
      // blanket fredTier stamped every macro input live if the batch call as a
      // whole succeeded, so one dead series scored its baseline constant as
      // real data.
      tedSpread: fredData?.tedSpread != null ? "live" : "baseline",
      dxyIndex: fredData?.dxyIndex != null ? "live" : "baseline",
      ismPMI: aiTier(ismPMIResult.source),
      fedFundsRate: fredData?.fedFundsRate != null ? "live" : "baseline",
      fedReverseRepo: fredData?.fedReverseRepo != null ? "live" : "baseline",
      junkSpread: fredData?.junkSpread != null ? "live" : "baseline",
      debtToGDP: fredData?.debtToGDP != null ? "live" : "baseline",
      yieldCurve: fredData?.yieldCurve != null ? "live" : "baseline",
    },
  }

  return {
    // QQQ Technicals
    qqqDailyReturn: qqqData?.dailyReturn || 0,
    qqqConsecDown: qqqData?.consecutiveDaysDown || 0,
    qqqBelowSMA20: qqqData?.belowSMA20 || false,
    qqqBelowSMA50: qqqData?.belowSMA50 || false,
    qqqBelowSMA200: qqqData?.belowSMA200 || false,
    qqqBelowBollinger: qqqData?.belowBollingerBand || false,
    qqqSMA20Proximity: qqqData?.sma20Proximity || 0,
    qqqSMA50Proximity: qqqData?.sma50Proximity || 0,
    qqqSMA200Proximity: qqqData?.sma200Proximity || 0,
    qqqBollingerProximity: qqqData?.bollingerProximity || 0,

    // Volatility. Priority: real FRED spot VIX (VIXCLS, fetched by
    // fetchVIXTermStructure) → AI fallback → its baseline. Previously
    // `alphaVantageData?.vix || vixResult.value`, where fetchAlphaVantageIndicators
    // returned a hardcoded vix: 18 on BOTH its success and failure paths — so the
    // flagship crash index was permanently insensitive to actual volatility: the
    // VIX>35 crash amplifier and the VIX canaries could never fire (P0).
    vix: (vixTermLive ? vixTermData?.spotVIX : undefined) ?? vixResult.value,
    // RATIO convention (P3-14): VIX3M / spot VIX; < 1 = backwardation.
    vixTermStructure: vixTermData?.termStructure ?? 1.08,
    vixTermInverted: vixTermData?.isInverted ?? false,
    // vxn / rvx / atr / ltv / spotVol / bullishPercent were unsourced baseline
    // constants scored as if they were data — deleted per AUDIT P3-19.

    // Valuation
    spxPE,
    spxPS,
    qqqPE: qqqPEResult.value,
    mag7Concentration: mag7Result.value,
    shillerCAPE: shillerCAPEResult.value,
    equityRiskPremium: calculateEquityRiskPremium(spxPE, yieldCurve10Y),

    // Macro
    fedFundsRate: fredData?.fedFundsRate ?? 5.33,
    junkSpread: fredData?.junkSpread ?? 3.5,
    yieldCurve: fredData?.yieldCurve ?? 0.25,
    debtToGDP: fredData?.debtToGDP ?? 123,

    // Sentiment
    putCallRatio: putCallData.ratio,
    fearGreedIndex: fearGreedData.fearGreed,
    etfFlows: apifyRaw?.data?.netInflows as number | undefined,
    shortInterest: shortInterestResult.value,

    // AI Structural block deleted (P6-5): aiCapexGrowth/aiRevenueGrowth/
    // gpuPricingPremium/aiJobPostingsGrowth were hardcoded constants shipped in
    // the payload with zero consumers — dead fields carrying invented numbers.

    buffettIndicator: buffettData.status === "live" ? buffettData.ratio : buffettResult.value,
    aaiiBullish: aaiData.status === "live" ? aaiData.bullish : aaiiBullishResult.value,
    // Bearish/spread have NO AI-fallback path — only the (kill-switched)
    // ScrapingBee scrape carries them. When not live they are undefined, and
    // the dashboard's `!== undefined` guards hide the cards. They used to be
    // `|| 30` / `|| 5`, rendering an invented "30.0%" / "+5.0" with two-decimal
    // precision on every load since the scraper was disabled (P6-4).
    aaiiBearish: aaiData.status === "live" ? aaiData.bearish : undefined,
    aaiiSpread: aaiData.status === "live" ? aaiData.spread : undefined,

    // Phase 1 indicators
    nvidiaPrice: nvidiaPriceResult.value,
    // Was read from fredData, which never carries this field — the momentum
    // actually computed from the Alpha Vantage NVDA quote was discarded and the
    // indicator was permanently 50 (neutral).
    nvidiaMomentum: alphaVantageData?.nvidiaMomentum ?? 50,
    soxIndex: soxIndexResult.value,
    tedSpread: fredData?.tedSpread ?? 0.25,
    dxyIndex: fredData?.dxyIndex ?? 103,
    ismPMI: ismPMIResult.value,
    fedReverseRepo: fredData?.fedReverseRepo ?? 450,

    apiStatus,
    tiers,
  }
}

function calculateEquityRiskPremium(spxPE: number, treasury10Y: number): number {
  const earningsYield = (1 / spxPE) * 100
  return earningsYield - treasury10Y
}

async function fetchFREDIndicators() {
  const FRED_API_KEY = resolveApiKey("FRED_API_KEY")

  // Nulls, not constants (P6-6). The assembly layer applies its labeled
  // `?? baseline` there, and the per-field tier map reads null = "baseline" so
  // the constant is excluded from scoring. Returning numbers here would make
  // the per-field null-checks stamp invented values as live.
  const baselineValues = {
    fedFundsRate: null as number | null,
    junkSpread: null as number | null,
    yieldCurve: null as number | null,
    debtToGDP: null as number | null,
    tedSpread: null as number | null,
    dxyIndex: null as number | null,
    ismPMI: null as number | null,
    fedReverseRepo: null as number | null,
    shillerCAPE: null as number | null,
    yieldCurve10Y: null as number | null,
    source: "baseline" as const,
  }

  // E-7b store-first: the daily fred-snapshot cron already holds these series
  // in market_series; eight sub-second Supabase reads replace eight FRED round
  // trips per CCPI load. All-or-nothing — any stale/missing series falls
  // through to the live path unchanged, so the store is never a new failure
  // mode (and works even when FRED itself is down or the key is absent).
  try {
    const [sDff, sJunk, sCurve, sDebt, sTed, sDxy, sRrp, s10y] = await Promise.all([
      fredLatestFromStore("DFF"),
      fredLatestFromStore("BAMLH0A0HYM2"),
      fredLatestFromStore("T10Y2Y"),
      fredLatestFromStore("GFDEGDQ188S"),
      fredLatestFromStore("TEDRATE"),
      fredLatestFromStore("DTWEXBGS"),
      fredLatestFromStore("RRPONTSYD"),
      fredLatestFromStore("DGS10"),
    ])
    if (sDff && sJunk && sCurve && sDebt && sTed && sDxy && sRrp && s10y) {
      return {
        fedFundsRate: sDff.value,
        junkSpread: sJunk.value,
        yieldCurve: sCurve.value,
        debtToGDP: sDebt.value,
        tedSpread: sTed.value,
        dxyIndex: sDxy.value,
        ismPMI: null, // never carried by FRED; comes from the AI fallback
        fedReverseRepo: sRrp.value,
        shillerCAPE: null, // dead field, see live path note (P6-7)
        yieldCurve10Y: s10y.value,
        // Measured FRED observations, served from the snapshot store — same
        // provenance tier as a direct FRED read, not an estimate.
        source: "live" as const,
      }
    }
  } catch {
    // fall through to live FRED
  }

  if (!FRED_API_KEY) {
    return baselineValues
  }

  try {
    const baseUrl = "https://api.stlouisfed.org/fred/series/observations"

    const [fedFundsRes, junkSpreadRes, yieldCurveRes, debtToGDPRes, tedSpreadRes, dxyRes, rrpRes, treasury10YRes] =
      await Promise.all([
        fetch(`${baseUrl}?series_id=DFF&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, {
          signal: AbortSignal.timeout(10000),
        }),
        fetch(`${baseUrl}?series_id=BAMLH0A0HYM2&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, {
          signal: AbortSignal.timeout(10000),
        }),
        fetch(`${baseUrl}?series_id=T10Y2Y&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, {
          signal: AbortSignal.timeout(10000),
        }),
        fetch(`${baseUrl}?series_id=GFDEGDQ188S&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, {
          signal: AbortSignal.timeout(10000),
        }),
        fetch(`${baseUrl}?series_id=TEDRATE&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, {
          signal: AbortSignal.timeout(10000),
        }),
        fetch(`${baseUrl}?series_id=DTWEXBGS&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, {
          signal: AbortSignal.timeout(10000),
        }),
        fetch(`${baseUrl}?series_id=RRPONTSYD&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, {
          signal: AbortSignal.timeout(10000),
        }),
        fetch(`${baseUrl}?series_id=DGS10&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, {
          signal: AbortSignal.timeout(10000),
        }),
      ])

    const [fedFunds, junkSpread, yieldCurve, debtToGDP, tedSpread, dxy, rrp, treasury10Y] = await Promise.all([
      fedFundsRes.json(),
      junkSpreadRes.json(),
      yieldCurveRes.json(),
      debtToGDPRes.json(),
      tedSpreadRes.json(),
      dxyRes.json(),
      rrpRes.json(),
      treasury10YRes.json(),
    ])

    // Per-series honesty (P6-6): a missing FRED observation parses to null,
    // never to a constant. The old `|| "5.33"`-style fallbacks meant one dead
    // series silently entered the CCPI as an invented number stamped "live" —
    // the assembly layer's `?? baseline` + per-field tier is where a fallback
    // is allowed to happen, because there it is labeled and excluded from
    // scoring.
    const obs = (r: any): number | null => {
      const v = Number.parseFloat(r?.observations?.[0]?.value)
      return Number.isFinite(v) ? v : null
    }

    return {
      fedFundsRate: obs(fedFunds),
      junkSpread: obs(junkSpread),
      yieldCurve: obs(yieldCurve),
      debtToGDP: obs(debtToGDP),
      tedSpread: obs(tedSpread),
      dxyIndex: obs(dxy),
      ismPMI: null, // never carried by FRED; comes from the AI fallback
      fedReverseRepo: obs(rrp),
      // Dead field kept for shape only. The scored CAPE is shillerCAPEResult
      // from the tiered AI-fallback path; the old fetchShillerCAPEWithGrok()
      // call here burned an LLM request per CCPI load for a value nothing
      // consumed (P6-7).
      shillerCAPE: null,
      yieldCurve10Y: obs(treasury10Y),
      source: "live" as const,
    }
  } catch (error) {
    console.error("[v0] FRED API error:", error instanceof Error ? error.message : String(error))
    // No CAPE call here either — same dead field as the happy path (P6-7).
    return baselineValues
  }
}

async function fetchAlphaVantageIndicators() {
  const ALPHA_VANTAGE_API_KEY = resolveApiKey("ALPHA_VANTAGE_API_KEY")

  const baselineValues = {
    nvidiaPrice: 800,
    nvidiaMomentum: 50,
    soxIndex: 5000,
    mag7Concentration: 55,
    source: "baseline" as const,
  }

  if (!ALPHA_VANTAGE_API_KEY) {
    return baselineValues
  }

  try {
    const [nvidiaRes, soxRes, aaplRes, msftRes, googlRes, amznRes, metaRes, tslaRes] = await Promise.all([
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=NVDA&apikey=${ALPHA_VANTAGE_API_KEY}`, {
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SOXX&apikey=${ALPHA_VANTAGE_API_KEY}`, {
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${ALPHA_VANTAGE_API_KEY}`, {
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=MSFT&apikey=${ALPHA_VANTAGE_API_KEY}`, {
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=GOOGL&apikey=${ALPHA_VANTAGE_API_KEY}`, {
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AMZN&apikey=${ALPHA_VANTAGE_API_KEY}`, {
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=META&apikey=${ALPHA_VANTAGE_API_KEY}`, {
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=TSLA&apikey=${ALPHA_VANTAGE_API_KEY}`, {
        signal: AbortSignal.timeout(10000),
      }),
    ])

    const [nvidiaData, soxData, aaplData, msftData, googlData, amznData, metaData, tslaData] = await Promise.all([
      nvidiaRes.json(),
      soxRes.json(),
      aaplRes.json(),
      msftRes.json(),
      googlRes.json(),
      amznRes.json(),
      metaRes.json(),
      tslaRes.json(),
    ])

    const nvidiaPrice = Number.parseFloat(nvidiaData?.["Global Quote"]?.["05. price"] || "800")
    const nvidiaChangePercent = Number.parseFloat(
      nvidiaData?.["Global Quote"]?.["10. change percent"]?.replace("%", "") || "0",
    )
    // Map momentum to 0-100 scale: -10% = 100 (high risk), 0% = 50, +10% = 0 (low risk)
    const nvidiaMomentum = Math.min(100, Math.max(0, 50 - nvidiaChangePercent * 5))

    const soxIndex = Number.parseFloat(soxData?.["Global Quote"]?.["05. price"] || "5000")

    // This is a proxy based on stock price strength
    const mag7Avg =
      [aaplData, msftData, googlData, amznData, metaData, tslaData, nvidiaData]
        .map((d) => Number.parseFloat(d?.["Global Quote"]?.["10. change percent"]?.replace("%", "") || "0"))
        .reduce((a, b) => a + b, 0) / 7

    // Higher = more concentrated (using simplified proxy)
    const mag7Concentration = 55 + (mag7Avg > 0 ? 5 : -5)

    console.log(
      `[v0] Alpha Vantage Phase 2: NVDA=${nvidiaPrice}, Change=${nvidiaChangePercent}%, Momentum=${nvidiaMomentum.toFixed(1)}, SOX=${soxIndex}, Mag7=${mag7Concentration.toFixed(1)}%`,
    )

    return {
      nvidiaPrice,
      nvidiaMomentum,
      soxIndex,
      mag7Concentration,
      source: "live" as const,
    }
  } catch (error) {
    console.error("[v0] Alpha Vantage error:", error)
    return baselineValues
  }
}

/**
 * CNN equity Fear & Greed index (P3-11). The previous implementation fetched
 * api.alternative.me — the CRYPTO Fear & Greed index — and scored it as equity
 * sentiment. On failure this returns null and the indicator is excluded from
 * Pillar 2 with renormalization (rule P3-12), instead of silently deflating
 * the pillar.
 */
async function fetchEquityFearGreed(): Promise<{ fearGreed: number | null; dataSource: string }> {
  try {
    const res = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      throw new Error(`CNN F&G API returned ${res.status}`)
    }

    const data = await res.json()
    const score = Number(data?.fear_and_greed?.score)
    if (Number.isFinite(score) && score >= 0 && score <= 100) {
      console.log(`[v0] ✓ CNN Fear & Greed: ${Math.round(score)}`)
      return { fearGreed: Math.round(score), dataSource: "cnn-live" }
    }
    throw new Error("CNN F&G payload missing fear_and_greed.score")
  } catch (error) {
    console.warn("[v0] CNN Fear & Greed fetch failed:", error instanceof Error ? error.message : String(error))
    return { fearGreed: null, dataSource: "unavailable" }
  }
}

function generateWeeklySummary(
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

