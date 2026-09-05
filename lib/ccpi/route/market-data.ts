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
  getNVIDIAPrice,
  getPutCallRatio,
  getSOXIndex,
  getVIX,
  type AIFallbackResult,
} from "@/lib/unified-ai-fallback"
import { scrapeAAIISentiment, scrapePutCallRatio } from "@/lib/scraping-bee"
import { fetchFredBuffett } from "./fred-buffett"
import { fetchSoxIndex } from "./sox-index"
import { fetchSpxValuation } from "@/lib/spx-valuation"
import { getPolygonPutCallRatio } from "@/lib/strategy-scanner/market-data"
import type { Tier } from "@/lib/ccpi/scoring"
import { type APIStatusTracker, type TierMaps, aiTier, weakerTier } from "./provenance"
import { fetchNvidiaQuote, fetchEquityFearGreed, fetchFREDIndicators } from "./indicators"

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
  }

  // MEASURE FIRST, ASK THE MODEL ONLY FOR THE GAPS (2026-08-30).
  //
  // P7-89 removed five getters that burned a model call per load for numbers
  // nothing consumed. This is that lesson one step further. The remaining six
  // still fired UNCONDITIONALLY, from a `Promise.all` that ran BEFORE the real
  // feeds — so on a healthy load five or six model answers were produced, paid
  // for, and then discarded in favour of the measurement that was always going
  // to win.
  //
  // That is the direct mechanism behind xAI's 401 recorded calls: it is slot 1
  // of all six chains, it fired on every uncached load, and its answer was
  // thrown away. Every one of those calls also failed, which is how a dead
  // provider stayed invisible — nothing downstream depended on it succeeding.
  //
  // Now the feeds run first and the model is asked only for what they could
  // not supply. On a fully healthy load that is ZERO model calls.
  //
  // Spot VIX is a PUBLISHED NUMBER and the site already stores it: the
  // market-snapshot cron writes FRED VIXCLS daily. Asking an LLM to recall
  // today's VIX is guessing at a fact, and `isPlausible` waves through anything
  // between 5 and 100 (P6-31b). Store first, term structure second, model third.
  const vixFromStore = await fredLatestFromStore("VIXCLS")
  if (vixFromStore) {
    console.log(`[v0] ✓ VIX from FRED store: ${vixFromStore.value} (${vixFromStore.day})`)
  }

  const results = await Promise.allSettled([
    fetchQQQTechnicalsData(),
    fetchVIXTermStructure(),
    fetchFREDIndicators(),
    fetchNvidiaQuote(),
    fetchApifyYahooFinanceUtil("SPY"),
    fetchEquityFearGreed(),
    // P7-73a: the Buffett Indicator comes from FRED (store, then live API),
    // scored through the recalibrated basis-correct ladder in buffett-bands.ts.
    // The GuruFocus/ScrapingBee scrape is retired for this input.
    fetchFredBuffett(),
    // P7-89: measured ^SOX from Yahoo's keyless chart API — the input's only
    // source was an LLM, so its 9 Momentum points could never score.
    fetchSoxIndex(),
    scrapePutCallRatio(),
    scrapeAAIISentiment(),
    fetchSpxValuation(), // P7-75: free multpl first, FMP only for whatever it misses
    getPolygonPutCallRatio(), // 2026-09-05: real Polygon options put/call — primary over the scrape
  ])

  const qqqData = results[0].status === "fulfilled" ? results[0].value : null
  const vixTermData = results[1].status === "fulfilled" ? results[1].value : null
  const fredData = results[2].status === "fulfilled" ? results[2].value : null
  const alphaVantageData = results[3].status === "fulfilled" ? results[3].value : null
  const apifyRaw = results[4].status === "fulfilled" ? results[4].value : null
  const fearGreedData = results[5].status === "fulfilled" ? results[5].value : { fearGreed: null, dataSource: "failed" }
  const fredBuffett = results[6].status === "fulfilled" ? results[6].value : null
  const soxMeasured = results[7].status === "fulfilled" ? results[7].value : null
  const putCallScrape = results[8].status === "fulfilled" ? results[8].value : null
  const aaiScrape = results[9].status === "fulfilled" ? results[9].value : null
  const polyPutCall = results[11].status === "fulfilled" ? results[11].value : null

  // --- the gaps, and only the gaps -----------------------------------------

  /**
   * An indicator with no model answer. `"unavailable"` is the same source tag
   * `fetchWithAIFallback` returns when no provider produced a value, so it
   * already tiers as baseline and is already excluded from scoring — a skipped
   * call and a failed one are indistinguishable downstream, which is correct:
   * in both cases we do not have a number from a model.
   */
  const NO_AI: AIFallbackResult = { value: null, source: "unavailable" }
  const askAi = (needed: boolean, get: () => Promise<AIFallbackResult>): Promise<AIFallbackResult> =>
    needed ? get() : Promise.resolve(NO_AI)

  const alphaVantageIsLive = alphaVantageData?.source === "live"

  const [buffettResult, putCallResult, aaiiBullishResult, vixAiResult, nvidiaPriceResult, soxIndexResult] =
    await Promise.all([
      askAi(!fredBuffett, getBuffettIndicator),
      // A fulfilled-but-not-live scrape still falls back to the model for both
      // the value and the source label, so "fulfilled" is not the test — "live" is.
      askAi(!polyPutCall && putCallScrape?.status !== "live", getPutCallRatio),
      askAi(aaiScrape?.status !== "live", getAAIIBullish),
      askAi(!vixFromStore, getVIX),
      askAi(!alphaVantageIsLive || alphaVantageData?.nvidiaPrice == null, getNVIDIAPrice),
      askAi(!soxMeasured || !alphaVantageIsLive, getSOXIndex),
    ])

  const vixResult = vixFromStore ? { value: vixFromStore.value, source: "fred-store" as const } : vixAiResult

  const asked = [buffettResult, putCallResult, aaiiBullishResult, vixAiResult, nvidiaPriceResult, soxIndexResult].filter(
    (r) => r !== NO_AI,
  ).length
  console.log(`[v0] AI Fallback Summary (${asked}/6 asked; the rest were measured):`)
  console.log(`  Buffett Indicator: ${buffettResult.value} (${buffettResult.source})`)
  console.log(`  Put/Call Ratio: ${putCallResult.value} (${putCallResult.source})`)
  console.log(`  AAII Bullish: ${aaiiBullishResult.value} (${aaiiBullishResult.source})`)
  console.log(`  VIX: ${vixResult.value} (${vixResult.source})`)
  console.log(`  NVIDIA Price: ${nvidiaPriceResult.value} (${nvidiaPriceResult.source})`)
  console.log(`  SOX Index: ${soxIndexResult.value} (${soxIndexResult.source})`)

  // Polygon options put/call is the primary live source (owner's Options add-on,
  // 2026-09-05); the ScrapingBee CBOE scrape and the AI estimate are the fallbacks.
  const putCallData = polyPutCall
    ? { ratio: polyPutCall.ratio, status: "live" as const }
    : (putCallScrape ?? { ratio: putCallResult.value, status: "baseline" as const })
  const aaiData =
    aaiScrape ??
    // bearish/neutral/spread were literals — 30, 35, 5 — invented whenever the
    // AAII scrape failed. They are read only on the `live` branch today, so
    // nothing consumed them, but an invented constant parked where a future
    // caller will find it and believe it is exactly the shape P7-10 warned
    // about. Null means "not measured".
    {
      bullish: aaiiBullishResult.value,
      bearish: null,
      neutral: null,
      spread: null,
      status: "baseline" as const,
    }
  const spxVal =
    results[10].status === "fulfilled"
      ? results[10].value
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
  apiStatus.fred = { live: fredLive, source: fredLive ? "FRED API" : "unavailable", lastUpdated: now() }
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
    source: putCallData.status === "live" ? (polyPutCall ? "Polygon options" : "ScrapingBee") : putCallResult.source,
    lastUpdated: now(),
  }
  apiStatus.aaii = {
    live: aaiData.status === "live",
    source: aaiData.status === "live" ? "ScrapingBee" : aaiiBullishResult.source,
    lastUpdated: now(),
  }
  // Short interest has no scraped source wired in — it always comes from the
  // AI fallback chain (the old `status === "live"` comparison could never be true).

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
      // P7-89: a Yahoo close is a measurement; the LLM recollection remains
      // display-only.
      soxIndex: soxMeasured ? "live" : aiTier(soxIndexResult.source),
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
      // live — and live scores. As of 2026-09-05 the primary "live" source is
      // Polygon options (real put/call VOLUME); the CBOE scrape is the fallback,
      // and it still distinguishes its own tiers. Both are measured — an AI or
      // VIX-derived value never claims live.
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
    },
    valuation: {
      spxPE: spxPETier,
      spxPS: spxPSTier,
      // P7-73a: a FRED reading is a measurement — "live". Without one the LLM
      // recollection still fills the DISPLAY (ai-estimate never scores, P6-34).
      buffettIndicator: fredBuffett ? "live" : aiTier(buffettResult.source),
      // Derived from S&P earnings yield and the FRED 10Y — as weak as its
      // weakest component.
      equityRiskPremium: weakerTier(spxPETier, fredTier),
    },
    macro: {
      // Per-series (P6-6): "live" only when THAT series actually parsed. The
      // blanket fredTier stamped every macro input live if the batch call as a
      // whole succeeded, so one dead series scored its baseline constant as
      // real data.
      dxyIndex: fredData?.dxyIndex != null ? "live" : "baseline",
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
    // `alphaVantageData?.vix || vixResult.value`, where fetchNvidiaQuote
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
    //
    // 2026-08-30: this read `nvidiaPriceResult.value` unconditionally — an LLM
    // asked "what is the current NVDA price" — while `fetchNvidiaQuote`
    // was fetching a REAL, metered NVDA quote in the same request and throwing it
    // away. It was the only indicator on this route with no feed in front of the
    // model; every other one here reads its real source first and treats the AI
    // as a fallback. A price is a published fact, not something to recall.
    //
    // Measured first, model second, exactly like VIX above.
    nvidiaPrice: alphaVantageData?.nvidiaPrice ?? nvidiaPriceResult.value,
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
    soxIndex: soxMeasured ? soxMeasured.level : soxIndexResult.value,
    tedSpread: fredData?.tedSpread ?? null,
    dxyIndex: fredData?.dxyIndex ?? null,
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
