import { NextResponse } from "next/server"
import { resolveApiKey } from "@/lib/api-keys"
import { fredLatestFromStore } from "@/lib/fred-store"
import { fetchVIXTermStructure } from "@/lib/vix-term-structure"
import { fetchQQQTechnicals as fetchQQQTechnicalsData } from "@/lib/qqq-technicals"
import { scrapeBuffettIndicator, scrapePutCallRatio, scrapeAAIISentiment } from "@/lib/scraping-bee"
import { fetchApifyYahooFinance as fetchApifyYahooFinanceUtil } from "@/lib/apify-yahoo-finance"
import { fetchFMPValuation } from "@/lib/fmp-valuation"

import { PILLAR_WEIGHTS } from "@/lib/ccpi/constants"
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

/** Count of indicators actually scored across the four pillars (10+4+7+8). */
const TOTAL_SCORED_INDICATORS = 29

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

    const crashAmplifiers = calculateCrashAmplifiers({
      qqqDailyReturn: data.qqqDailyReturn,
      qqqBelowSMA50: data.qqqBelowSMA50,
      vix: data.vix,
      putCallRatio: data.putCallRatio,
    })
    const finalCCPI = Math.min(100, baseCCPI + crashAmplifiers.totalBonus)

    console.log("[v0] CCPI v2.1 Calculation:")
    console.log("  Base CCPI:", baseCCPI)
    console.log("  Crash Amplifiers:", crashAmplifiers.bonuses)
    console.log("  Total Bonus:", crashAmplifiers.totalBonus)
    console.log("  Final CCPI:", finalCCPI)

    console.log("[v0] CCPI GET: Generating canary signals...")
    const canaries = generateCanarySignals(data)
    console.log("[v0] CCPI GET: Canary signals generated:", canaries.length)

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

/** AI-fallback source string → provenance tier. */
function aiTier(source: "grok" | "groq" | "anthropic" | "openai" | "baseline"): Tier {
  return source === "baseline" ? "baseline" : "ai-estimate"
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
    vixResult,
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
      vix: vixTermLive ? "live" : aiTier(vixResult.source),
      vixTermStructure: vixTermLive ? "live" : "baseline",
    },
    riskAppetite: {
      putCallRatio: putCallData.status === "live" ? "live" : aiTier(putCallResult.source),
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

function generateCanarySignals(data: Awaited<ReturnType<typeof fetchMarketData>>) {
  const canaries: Array<{
    signal: string
    pillar: string
    severity: "high" | "medium" | "low"
    indicatorWeight: number
    pillarWeight: number
    impactScore: number
  }> = []

  const MOMENTUM = "Momentum & Technical"
  const RISK = "Risk Appetite & Volatility"
  const VALUATION = "Valuation & Market Structure"
  const MACRO = "Macro"

  const push = (
    signal: string,
    pillar: string,
    severity: "high" | "medium",
    indicatorWeight: number,
    pillarPct: number,
  ) => {
    canaries.push({
      signal,
      pillar,
      severity,
      indicatorWeight,
      pillarWeight: pillarPct,
      impactScore: indicatorWeight * (pillarPct / 100),
    })
  }

  // --- Pillar 1: Momentum & Technical (weights from MOMENTUM_WEIGHTS) ---

  // QQQ Daily Return (12)
  if (data.qqqDailyReturn <= -6) {
    push(`QQQ crashed ${Math.abs(data.qqqDailyReturn).toFixed(1)}% - Momentum loss`, MOMENTUM, "high", 12, PILLAR_PCT.momentum)
  } else if (data.qqqDailyReturn <= -3) {
    push(`QQQ dropped ${Math.abs(data.qqqDailyReturn).toFixed(1)}% - Sharp decline`, MOMENTUM, "medium", 12, PILLAR_PCT.momentum)
  }

  // QQQ Consecutive Down Days (7)
  if (data.qqqConsecDown >= 5) {
    push(`${data.qqqConsecDown} consecutive down days - Trend break`, MOMENTUM, "high", 7, PILLAR_PCT.momentum)
  } else if (data.qqqConsecDown >= 3) {
    push(`${data.qqqConsecDown} consecutive down days`, MOMENTUM, "medium", 7, PILLAR_PCT.momentum)
  }

  // QQQ Below 20-Day SMA (7)
  if (data.qqqBelowSMA20 && data.qqqSMA20Proximity >= 100) {
    push("QQQ breached 20-day SMA - Short-term support lost", MOMENTUM, "high", 7, PILLAR_PCT.momentum)
  } else if (data.qqqSMA20Proximity >= 50) {
    push(`QQQ approaching 20-day SMA (${data.qqqSMA20Proximity.toFixed(0)}% proximity)`, MOMENTUM, "medium", 7, PILLAR_PCT.momentum)
  }

  // QQQ Below 50-Day SMA (10)
  if (data.qqqBelowSMA50 && data.qqqSMA50Proximity >= 100) {
    push("QQQ breached 50-day SMA - Medium-term trend broken", MOMENTUM, "high", 10, PILLAR_PCT.momentum)
  } else if (data.qqqSMA50Proximity >= 50) {
    push(`QQQ approaching 50-day SMA (${data.qqqSMA50Proximity.toFixed(0)}% proximity)`, MOMENTUM, "medium", 10, PILLAR_PCT.momentum)
  }

  // QQQ Below 200-Day SMA (15)
  if (data.qqqBelowSMA200 && data.qqqSMA200Proximity >= 100) {
    push("QQQ breached 200-day SMA - Long-term bull market in question", MOMENTUM, "high", 15, PILLAR_PCT.momentum)
  } else if (data.qqqSMA200Proximity >= 50) {
    push(`QQQ approaching 200-day SMA (${data.qqqSMA200Proximity.toFixed(0)}% proximity)`, MOMENTUM, "medium", 15, PILLAR_PCT.momentum)
  }

  // QQQ Below Bollinger Band (9)
  if (data.qqqBelowBollinger && data.qqqBollingerProximity >= 100) {
    push("QQQ breached lower Bollinger Band - Oversold territory", MOMENTUM, "high", 9, PILLAR_PCT.momentum)
  } else if (data.qqqBollingerProximity >= 50) {
    push(`QQQ approaching Bollinger Band (${data.qqqBollingerProximity.toFixed(0)}% proximity)`, MOMENTUM, "medium", 9, PILLAR_PCT.momentum)
  }

  // VIX (13)
  if (data.vix > 35) {
    push(`VIX at ${data.vix.toFixed(1)} - Extreme fear`, MOMENTUM, "high", 13, PILLAR_PCT.momentum)
  } else if (data.vix > 25) {
    push(`VIX at ${data.vix.toFixed(1)} - Elevated fear`, MOMENTUM, "medium", 13, PILLAR_PCT.momentum)
  }

  // VIX Term Structure (9) — RATIO convention: VIX3M / spot; < 1 = backwardation.
  if (data.vixTermStructure < 0.95) {
    push(`VIX term structure in backwardation (${data.vixTermStructure.toFixed(2)}) - Immediate fear`, MOMENTUM, "high", 9, PILLAR_PCT.momentum)
  } else if (data.vixTermStructure < 1.0) {
    push(`VIX term structure flattening (${data.vixTermStructure.toFixed(2)})`, MOMENTUM, "medium", 9, PILLAR_PCT.momentum)
  }

  // NVIDIA Momentum (9)
  if (data.nvidiaMomentum < 20) {
    push(`NVIDIA momentum at ${data.nvidiaMomentum} - AI sector weakness`, MOMENTUM, "high", 9, PILLAR_PCT.momentum)
  } else if (data.nvidiaMomentum < 40) {
    push(`NVIDIA momentum at ${data.nvidiaMomentum} - Tech leadership fading`, MOMENTUM, "medium", 9, PILLAR_PCT.momentum)
  }

  // SOX Index (9)
  const soxDeviation = ((data.soxIndex - 5000) / 5000) * 100
  if (soxDeviation < -15) {
    push(`SOX down ${Math.abs(soxDeviation).toFixed(1)}% - Chip sector crash`, MOMENTUM, "high", 9, PILLAR_PCT.momentum)
  } else if (soxDeviation < -10) {
    push(`SOX down ${Math.abs(soxDeviation).toFixed(1)}% - Semiconductor weakness`, MOMENTUM, "medium", 9, PILLAR_PCT.momentum)
  }

  // --- Pillar 2: Risk Appetite & Sentiment (weights from RISK_APPETITE_WEIGHTS) ---

  // Put/Call Ratio (29)
  if (data.putCallRatio < 0.6) {
    push(`Put/Call at ${data.putCallRatio.toFixed(2)} - Extreme complacency`, RISK, "high", 29, PILLAR_PCT.riskAppetite)
  } else if (data.putCallRatio < 0.85) {
    push(`Put/Call at ${data.putCallRatio.toFixed(2)} - Low hedging activity`, RISK, "medium", 29, PILLAR_PCT.riskAppetite)
  }

  // Fear & Greed (24) — CNN equity index; skipped entirely when unavailable
  if (data.fearGreedIndex !== null) {
    if (data.fearGreedIndex > 80) {
      push(`Fear & Greed at ${data.fearGreedIndex} - Extreme greed`, RISK, "high", 24, PILLAR_PCT.riskAppetite)
    } else if (data.fearGreedIndex > 70) {
      push(`Fear & Greed at ${data.fearGreedIndex} - Elevated greed`, RISK, "medium", 24, PILLAR_PCT.riskAppetite)
    }
  }

  // AAII Bullish (26)
  const aaiiBullish = data.aaiiBullish || 35
  if (aaiiBullish > 55) {
    push(`AAII Bullish at ${aaiiBullish}% - Retail euphoria`, RISK, "high", 26, PILLAR_PCT.riskAppetite)
  } else if (aaiiBullish > 45) {
    push(`AAII Bullish at ${aaiiBullish}% - Elevated retail optimism`, RISK, "medium", 26, PILLAR_PCT.riskAppetite)
  }

  // Short Interest (21)
  const shortInterest = data.shortInterest || 2.5
  if (shortInterest < 1.5) {
    push(`Short Interest at ${shortInterest.toFixed(1)}% - Extreme complacency`, RISK, "high", 21, PILLAR_PCT.riskAppetite)
  } else if (shortInterest < 2.5) {
    push(`Short Interest at ${shortInterest.toFixed(1)}% - Low positioning`, RISK, "medium", 21, PILLAR_PCT.riskAppetite)
  }

  // ETF Flows — informational only; not part of any pillar's WEIGHTS (weight 0)
  if (data.etfFlows !== undefined) {
    if (data.etfFlows < -3.0) {
      push(`ETF outflows at $${Math.abs(data.etfFlows).toFixed(1)}B - Capital flight`, RISK, "high", 0, PILLAR_PCT.riskAppetite)
    } else if (data.etfFlows < -1.5) {
      push(`ETF outflows at $${Math.abs(data.etfFlows).toFixed(1)}B - Selling pressure`, RISK, "medium", 0, PILLAR_PCT.riskAppetite)
    }
  }

  // --- Pillar 3: Valuation & Market Structure (weights from VALUATION_WEIGHTS) ---

  // S&P 500 P/E (18)
  if (data.spxPE > 30) {
    push(`S&P 500 P/E at ${data.spxPE.toFixed(1)} - Extreme overvaluation`, VALUATION, "high", 18, PILLAR_PCT.valuation)
  } else if (data.spxPE > 22) {
    push(`S&P 500 P/E at ${data.spxPE.toFixed(1)} - Above historical average`, VALUATION, "medium", 18, PILLAR_PCT.valuation)
  }

  // S&P 500 P/S (12)
  if (data.spxPS > 3.5) {
    push(`S&P 500 P/S at ${data.spxPS.toFixed(1)} - Extremely expensive`, VALUATION, "high", 12, PILLAR_PCT.valuation)
  } else if (data.spxPS > 2.5) {
    push(`S&P 500 P/S at ${data.spxPS.toFixed(1)} - Elevated valuation`, VALUATION, "medium", 12, PILLAR_PCT.valuation)
  }

  // Buffett Indicator (16)
  const buffett = data.buffettIndicator || 180
  if (buffett > 200) {
    push(`Buffett Indicator at ${buffett.toFixed(0)}% - Significantly overvalued`, VALUATION, "high", 16, PILLAR_PCT.valuation)
  } else if (buffett > 150) {
    push(`Buffett Indicator at ${buffett.toFixed(0)}% - Above fair value`, VALUATION, "medium", 16, PILLAR_PCT.valuation)
  }

  // QQQ P/E (16)
  if (data.qqqPE > 40) {
    push(`QQQ P/E at ${data.qqqPE.toFixed(1)} - AI bubble territory`, VALUATION, "high", 16, PILLAR_PCT.valuation)
  } else if (data.qqqPE > 30) {
    push(`QQQ P/E at ${data.qqqPE.toFixed(1)} - Tech overvaluation`, VALUATION, "medium", 16, PILLAR_PCT.valuation)
  }

  // Mag7 Concentration (15)
  if (data.mag7Concentration > 65) {
    push(`Mag7 at ${data.mag7Concentration.toFixed(1)}% of QQQ - Extreme concentration risk`, VALUATION, "high", 15, PILLAR_PCT.valuation)
  } else if (data.mag7Concentration > 55) {
    push(`Mag7 at ${data.mag7Concentration.toFixed(1)}% of QQQ - High concentration`, VALUATION, "medium", 15, PILLAR_PCT.valuation)
  }

  // Shiller CAPE (13)
  if (data.shillerCAPE > 35) {
    push(`Shiller CAPE at ${data.shillerCAPE.toFixed(1)} - Historic overvaluation`, VALUATION, "high", 13, PILLAR_PCT.valuation)
  } else if (data.shillerCAPE > 28) {
    push(`Shiller CAPE at ${data.shillerCAPE.toFixed(1)} - Elevated cyclical valuation`, VALUATION, "medium", 13, PILLAR_PCT.valuation)
  }

  // Equity Risk Premium (10)
  if (data.equityRiskPremium < 1.5) {
    push(`Equity Risk Premium at ${data.equityRiskPremium.toFixed(2)}% - Stocks vs bonds severely overpriced`, VALUATION, "high", 10, PILLAR_PCT.valuation)
  } else if (data.equityRiskPremium < 3.0) {
    push(`Equity Risk Premium at ${data.equityRiskPremium.toFixed(2)}% - Low compensation for equity risk`, VALUATION, "medium", 10, PILLAR_PCT.valuation)
  }

  // --- Pillar 4: Macro (weights from MACRO_WEIGHTS) ---

  // Fed Funds Rate (15)
  if (data.fedFundsRate > 6.0) {
    push(`Fed Funds at ${data.fedFundsRate.toFixed(2)}% - Extremely restrictive`, MACRO, "high", 15, PILLAR_PCT.macro)
  } else if (data.fedFundsRate > 5.0) {
    push(`Fed Funds at ${data.fedFundsRate.toFixed(2)}% - Restrictive policy`, MACRO, "medium", 15, PILLAR_PCT.macro)
  }

  // Junk Spread (10)
  if (data.junkSpread > 8) {
    push(`Junk Bond Spread at ${data.junkSpread.toFixed(2)}% - Severe credit stress`, MACRO, "high", 10, PILLAR_PCT.macro)
  } else if (data.junkSpread > 5) {
    push(`Junk Bond Spread at ${data.junkSpread.toFixed(2)}% - Credit tightening`, MACRO, "medium", 10, PILLAR_PCT.macro)
  }

  // Debt-to-GDP (10)
  if (data.debtToGDP > 130) {
    push(`US Debt-to-GDP at ${data.debtToGDP.toFixed(0)}% - Fiscal crisis risk`, MACRO, "high", 10, PILLAR_PCT.macro)
  } else if (data.debtToGDP > 110) {
    push(`US Debt-to-GDP at ${data.debtToGDP.toFixed(0)}% - Elevated fiscal burden`, MACRO, "medium", 10, PILLAR_PCT.macro)
  }

  // Yield Curve (14) — scored once, in Macro (P3-13)
  if (data.yieldCurve < -1.0) {
    push(`Yield curve inverted ${Math.abs(data.yieldCurve).toFixed(2)}% - Deep inversion`, MACRO, "high", 14, PILLAR_PCT.macro)
  } else if (data.yieldCurve < -0.2) {
    push(`Yield curve inverted ${Math.abs(data.yieldCurve).toFixed(2)}%`, MACRO, "medium", 14, PILLAR_PCT.macro)
  }

  // TED Spread (13)
  if (data.tedSpread > 1.0) {
    push(`TED Spread at ${data.tedSpread.toFixed(2)}% - Banking system stress`, MACRO, "high", 13, PILLAR_PCT.macro)
  } else if (data.tedSpread > 0.5) {
    push(`TED Spread at ${data.tedSpread.toFixed(2)}% - Credit market tension`, MACRO, "medium", 13, PILLAR_PCT.macro)
  }

  // DXY Dollar Index (12)
  if (data.dxyIndex > 115) {
    push(`Dollar Index at ${data.dxyIndex.toFixed(1)} - Extreme dollar strength hurts tech`, MACRO, "high", 12, PILLAR_PCT.macro)
  } else if (data.dxyIndex > 105) {
    push(`Dollar Index at ${data.dxyIndex.toFixed(1)} - Strong dollar headwind`, MACRO, "medium", 12, PILLAR_PCT.macro)
  }

  // ISM PMI (15)
  if (data.ismPMI < 46) {
    push(`ISM PMI at ${data.ismPMI.toFixed(1)} - Manufacturing contraction`, MACRO, "high", 15, PILLAR_PCT.macro)
  } else if (data.ismPMI < 50) {
    push(`ISM PMI at ${data.ismPMI.toFixed(1)} - Weak manufacturing`, MACRO, "medium", 15, PILLAR_PCT.macro)
  }

  // Fed Reverse Repo (11)
  if (data.fedReverseRepo > 2000) {
    push(`Fed RRP at $${data.fedReverseRepo.toFixed(0)}B - Severe liquidity drain`, MACRO, "high", 11, PILLAR_PCT.macro)
  } else if (data.fedReverseRepo > 1000) {
    push(`Fed RRP at $${data.fedReverseRepo.toFixed(0)}B - Tight liquidity conditions`, MACRO, "medium", 11, PILLAR_PCT.macro)
  }

  return canaries.sort((a, b) => {
    // First sort by severity: high before medium
    if (a.severity === "high" && b.severity !== "high") return -1
    if (a.severity !== "high" && b.severity === "high") return 1

    // Within same severity, sort by impact score descending
    return b.impactScore - a.impactScore
  })
}
