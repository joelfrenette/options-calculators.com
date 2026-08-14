/**
 * The market-data half of /api/ccpi: prices, valuation inputs and the equity
 * risk premium derived from them.
 *
 * Split out of `app/api/ccpi/route.ts` (P6-13) unchanged.
 */
import { fredLatestFromStore } from "@/lib/fred-store"
import { fetchVIXTermStructure } from "@/lib/vix-term-structure"
import { fetchQQQTechnicals as fetchQQQTechnicalsData } from "@/lib/qqq-technicals"
import { fetchApifyYahooFinance as fetchApifyYahooFinanceUtil } from "@/lib/apify-yahoo-finance"
import {
  getAAIIBullish,
  getBuffettIndicator,
  getISMPMI,
  getMag7Concentration,
  getNVIDIAPrice,
  getPutCallRatio,
  getQQQPE,
  getShillerCAPE,
  getShortInterest,
  getSOXIndex,
  getVIX,
} from "@/lib/unified-ai-fallback"
import { scrapeAAIISentiment, scrapePutCallRatio } from "@/lib/scraping-bee"
import { fetchFredBuffett } from "./fred-buffett"
import { fetchSpxValuation } from "@/lib/spx-valuation"
import type { Tier } from "@/lib/ccpi/scoring"
import { type APIStatusTracker, type TierMaps, aiTier, weakerTier } from "./provenance"
import { fetchAlphaVantageIndicators, fetchEquityFearGreed, fetchFREDIndicators } from "./indicators"

export async function fetchMarketData() {
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
    // P7-73a: the Buffett Indicator comes from FRED (store, then live API),
    // scored through the recalibrated basis-correct ladder in buffett-bands.ts.
    // The GuruFocus/ScrapingBee scrape is retired for this input.
    fetchFredBuffett(),
    scrapePutCallRatio(),
    scrapeAAIISentiment(),
    fetchSpxValuation(), // P7-75: free multpl first, FMP only for whatever it misses
  ])

  const qqqData = results[0].status === "fulfilled" ? results[0].value : null
  const vixTermData = results[1].status === "fulfilled" ? results[1].value : null
  const fredData = results[2].status === "fulfilled" ? results[2].value : null
  const alphaVantageData = results[3].status === "fulfilled" ? results[3].value : null
  const apifyRaw = results[4].status === "fulfilled" ? results[4].value : null
  const fearGreedData = results[5].status === "fulfilled" ? results[5].value : { fearGreed: null, dataSource: "failed" }
  const fredBuffett = results[6].status === "fulfilled" ? results[6].value : null
  const putCallData =
    results[7].status === "fulfilled"
      ? results[7].value
      : { ratio: putCallResult.value, status: "baseline" as const }
  const aaiData =
    results[8].status === "fulfilled"
      ? results[8].value
      : { bullish: aaiiBullishResult.value, bearish: 30, neutral: 35, spread: 5, status: "baseline" as const }
  const spxVal =
    results[9].status === "fulfilled"
      ? results[9].value
      : { spxPE: null, spxPS: null, peSource: null, psSource: null }

  const qqqLive = qqqData?.source === "live"
  const vixTermLive = vixTermData?.source === "live"
  const fredLive = fredData?.source === "live"
  const alphaVantageLive = alphaVantageData?.source === "live"
  const apifyLive = Boolean(apifyRaw?.data && apifyRaw.dataSource && !apifyRaw.dataSource.includes("baseline"))
  const fearGreedLive = fearGreedData.fearGreed !== null
  const fmpLive = Boolean(spxVal.peSource || spxVal.psSource)

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
    // Names the source that actually answered — "multpl" and "FMP key-metrics"
    // are different claims and the payload should not blur them (P7-75).
    source: apifyRaw?.dataSource || (fmpLive ? `spx:${spxVal.peSource ?? spxVal.psSource}` : "baseline"),
    lastUpdated: now(),
  }
  apiStatus.fearGreed = {
    live: fearGreedLive,
    source: fearGreedData.dataSource,
    lastUpdated: now(),
  }
  apiStatus.buffett = {
    live: fredBuffett !== null,
    // The basis is part of the source claim: this is NOT the total-market-cap
    // figure the site used to scrape, and the label must not let the two blur.
    source: fredBuffett ? `${fredBuffett.source} (${fredBuffett.reading.basis})` : buffettResult.source,
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

  // P7-75. Order: Apify (if a token exists at all), then the free/paid resolver
  // in `lib/spx-valuation.ts`, which tries multpl before FMP. Apify stays first
  // only because a deployment that HAS paid for it should use what it bought;
  // with no token `apifyLive` is false and this falls straight through.
  const spxPE = (apifyLive ? apifyRaw?.data?.forwardPE || apifyRaw?.data?.trailingPE : undefined) ?? spxVal.spxPE
  const spxPS = (apifyLive ? apifyRaw?.data?.priceToSales : undefined) ?? spxVal.spxPS
  // TIERED ON THE VALUE, not on "did a provider respond". The old expression
  // read `apifyLive || fmpVal?.spxPE !== undefined`, so an Apify response that
  // carried no P/E still claimed `live` — harmless only because `scorePillar`
  // independently refuses a null (P6-34's belt-and-braces). Stating it on the
  // value removes the need to rely on that.
  const spxPETier: Tier = spxPE !== null && spxPE !== undefined ? "live" : "baseline"
  const spxPSTier: Tier = spxPS !== null && spxPS !== undefined ? "live" : "baseline"
  const yieldCurve10Y = fredData?.yieldCurve10Y ?? null
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
      // Same self-report bypass as putCallRatio above (P6-72): the scraper's
      // Grok path used to claim "live", and live scores.
      aaiiBullish:
        aaiData.status === "live"
          ? "live"
          : aaiData.status === "ai-estimate"
            ? "ai-estimate"
            : aiTier(aaiiBullishResult.source),
      shortInterest: aiTier(shortInterestResult.source),
    },
    valuation: {
      spxPE: spxPETier,
      spxPS: spxPSTier,
      // P7-73a: a FRED reading is a measurement — "live". Without one the LLM
      // recollection still fills the DISPLAY (ai-estimate never scores, P6-34).
      buffettIndicator: fredBuffett ? "live" : aiTier(buffettResult.source),
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
    qqqDailyReturn: qqqData?.dailyReturn ?? null,
    qqqConsecDown: qqqData?.consecutiveDaysDown ?? null,
    qqqBelowSMA20: qqqData?.belowSMA20 ?? null,
    qqqBelowSMA50: qqqData?.belowSMA50 ?? null,
    qqqBelowSMA200: qqqData?.belowSMA200 ?? null,
    qqqBelowBollinger: qqqData?.belowBollingerBand ?? null,
    qqqSMA20Proximity: qqqData?.sma20Proximity ?? null,
    qqqSMA50Proximity: qqqData?.sma50Proximity ?? null,
    qqqSMA200Proximity: qqqData?.sma200Proximity ?? null,
    qqqBollingerProximity: qqqData?.bollingerProximity ?? null,

    // Volatility. Priority: real FRED spot VIX (VIXCLS, fetched by
    // fetchVIXTermStructure) → AI fallback → its baseline. Previously
    // `alphaVantageData?.vix || vixResult.value`, where fetchAlphaVantageIndicators
    // returned a hardcoded vix: 18 on BOTH its success and failure paths — so the
    // flagship crash index was permanently insensitive to actual volatility: the
    // VIX>35 crash amplifier and the VIX canaries could never fire (P0).
    vix: (vixTermLive ? vixTermData?.spotVIX : undefined) ?? vixResult.value,
    // RATIO convention (P3-14): VIX3M / spot VIX; < 1 = backwardation.
    vixTermStructure: vixTermData?.termStructure ?? null,
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
    fedFundsRate: fredData?.fedFundsRate ?? null,
    junkSpread: fredData?.junkSpread ?? null,
    yieldCurve: fredData?.yieldCurve ?? null,
    debtToGDP: fredData?.debtToGDP ?? null,

    // Sentiment
    putCallRatio: putCallData.ratio,
    fearGreedIndex: fearGreedData.fearGreed,
    etfFlows: apifyRaw?.data?.netInflows as number | undefined,
    shortInterest: shortInterestResult.value,

    // AI Structural block deleted (P6-5): aiCapexGrowth/aiRevenueGrowth/
    // gpuPricingPremium/aiJobPostingsGrowth were hardcoded constants shipped in
    // the payload with zero consumers — dead fields carrying invented numbers.

    buffettIndicator: fredBuffett ? fredBuffett.reading.percent : buffettResult.value,
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
    //
    // P7-10: `?? 50` became `?? null`. On a 0-100 momentum scale **50 is a real
    // neutral reading**, and the tab's own axis labels it "Neutral: 40-60" — so
    // the default was indistinguishable from a measurement saying NVDA is flat.
    // The scoring side was already safe (the tier below is `baseline` when Alpha
    // Vantage is down, and baseline inputs are excluded and renormalized), but
    // the DISPLAY side read this value raw: `nvidiaPrice` comes from an
    // independent AI-fallback chain, so it stays defined when Alpha Vantage
    // fails, and the momentum card rendered "$X | 50/100" as though both halves
    // were measured. P6-4 fixed exactly this idiom for AAII eight lines above
    // and left this one.
    nvidiaMomentum: alphaVantageData?.nvidiaMomentum ?? null,
    soxIndex: soxIndexResult.value,
    tedSpread: fredData?.tedSpread ?? null,
    dxyIndex: fredData?.dxyIndex ?? null,
    ismPMI: ismPMIResult.value,
    fedReverseRepo: fredData?.fedReverseRepo ?? null,

    apiStatus,
    tiers,
  }
}

/**
 * Equity risk premium = S&P earnings yield − the 10Y Treasury.
 *
 * P7-17: null in, null out. Both inputs used to arrive defaulted — `spxPE ||
 * 22.5` and `yieldCurve10Y ?? 4.5` — so this function could not fail to produce
 * a number, and a "premium" computed from two invented constants is a **derived
 * fabrication**: further from its sources than either, and correspondingly
 * harder to recognise on screen as something nobody measured.
 */
export function calculateEquityRiskPremium(spxPE: number | null, treasury10Y: number | null): number | null {
  if (spxPE === null || treasury10Y === null || spxPE === 0) return null
  const earningsYield = (1 / spxPE) * 100
  return earningsYield - treasury10Y
}
