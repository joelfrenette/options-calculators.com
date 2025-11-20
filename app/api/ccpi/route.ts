import { NextResponse } from "next/server"
import { fetchVIXTermStructure } from "@/lib/vix-term-structure"
import { fetchQQQTechnicals as fetchQQQTechnicalsData } from "@/lib/qqq-technicals"
import { scrapeBuffettIndicator, scrapePutCallRatio, scrapeAAIISentiment } from "@/lib/scraping-bee"
import { fetchApifyYahooFinance as fetchApifyYahooFinanceUtil } from "@/lib/apify-yahoo-finance"

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

import { fetchShillerCAPEWithGrok } from "@/lib/grok-market-data" // Kept Grok for now as a fallback

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

export async function GET() {
  try {
    console.log("[v0] CCPI GET: Starting...")

    console.log("[v0] CCPI GET: Fetching market data...")
    const data = await fetchMarketData()
    console.log("[v0] CCPI GET: Market data fetched successfully")

    // Compute 4 new pillar scores
    console.log("[v0] CCPI GET: Computing pillars...")
    const momentum = await computeMomentumPillar(data) // NEW: Pillar 1 - Momentum & Technical (40%)
    console.log("[v0] CCPI GET: Momentum pillar computed:", momentum)

    const riskAppetite = await computeRiskAppetitePillar(data) // NEW: Pillar 2 - Risk Appetite (30%)
    console.log("[v0] CCPI GET: Risk appetite pillar computed:", riskAppetite)

    const valuation = await computeValuationPillar(data) // NEW: Pillar 3 - Valuation (20%)
    console.log("[v0] CCPI GET: Valuation pillar computed:", valuation)

    const macro = await computeMacroPillar(data) // NEW: Pillar 4 - Macro (10%)
    console.log("[v0] CCPI GET: Macro pillar computed:", macro)

    const baseCCPI = Math.round(
      momentum * 0.35 + // Updated from 0.40 to 0.35
        riskAppetite * 0.3 +
        valuation * 0.15 + // Updated from 0.20 to 0.15
        macro * 0.2, // Updated from 0.10 to 0.20
    )

    const crashAmplifiers = calculateCrashAmplifiers(data)
    const finalCCPI = Math.min(100, baseCCPI + crashAmplifiers.totalBonus)

    console.log("[v0] CCPI v2.0 Calculation:")
    console.log("  Base CCPI:", baseCCPI)
    console.log("  Crash Amplifiers:", crashAmplifiers.bonuses)
    console.log("  Total Bonus:", crashAmplifiers.totalBonus)
    console.log("  Final CCPI:", finalCCPI)

    // Generate canary signals and other metadata
    console.log("[v0] CCPI GET: Generating canary signals...")
    const canaries = await generateCanarySignals(data)
    console.log("[v0] CCPI GET: Canary signals generated:", canaries.length)

    console.log("[v0] CCPI GET: Computing confidence...")
    const confidence = computeCertaintyScore({ momentum, riskAppetite, valuation, macro }, data, canaries.length)
    console.log("[v0] CCPI GET: Confidence computed:", confidence)

    console.log("[v0] CCPI GET: Determining regime...")
    const regime = determineRegime(finalCCPI, canaries.length)
    console.log("[v0] CCPI GET: Regime determined:", regime.name)

    console.log("[v0] CCPI GET: Getting playbook...")
    const playbook = getPlaybook(regime)
    console.log("[v0] CCPI GET: Playbook retrieved")

    console.log("[v0] CCPI GET: Generating summary...")
    const summary = generateWeeklySummary(
      finalCCPI,
      confidence,
      regime,
      { momentum, riskAppetite, valuation, macro },
      data,
      canaries,
    )
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
      pillars: {
        momentum,
        riskAppetite,
        valuation,
        macro,
      },
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
        vxn: data.vxn,
        rvx: data.rvx,
        atr: data.atr,
        ltv: data.ltv,
        spotVol: data.spotVol,
        vixTermStructure: data.vixTermStructure,
        vixTermInverted: data.vixTermInverted,
        highLowIndex: data.highLowIndex,
        bullishPercent: data.bullishPercent,

        // Fundamental & Valuation
        spxPE: data.spxPE,
        spxPS: data.spxPS,
        buffettIndicator: data.buffettIndicator,

        // Macro Economic
        fedFundsRate: data.fedFundsRate,
        junkSpread: data.junkSpread,
        yieldCurve: data.yieldCurve,
        debtToGDP: data.debtToGDP, // Added Debt-to-GDP to indicators

        // Sentiment & Social
        putCallRatio: data.putCallRatio,
        fearGreedIndex: data.fearGreedIndex,
        etfFlows: data.etfFlows,
        shortInterest: data.shortInterest,
        aaiiBullish: data.aaiiBullish,
        aaiiBearish: data.aaiiBearish,
        aaiiSpread: data.aaiiSpread,

        // AI Structural
        aiCapexGrowth: data.aiCapexGrowth,
        aiRevenueGrowth: data.aiRevenueGrowth,
        gpuPricingPremium: data.gpuPricingPremium,
        aiJobPostingsGrowth: data.aiJobPostingsGrowth,

        // Phase 1 indicators
        nvidiaPrice: data.nvidiaPrice,
        nvidiaMomentum: data.nvidiaMomentum,
        soxIndex: data.soxIndex,
        tedSpread: data.tedSpread,
        dxyIndex: data.dxyIndex,
        ismPMI: data.ismPMI,
        fedReverseRepo: data.fedReverseRepo,

        // NEW Phase 2 indicators
        qqqPE: data.qqqPE,
        mag7Concentration: data.mag7Concentration,
        shillerCAPE: data.shillerCAPE,
        equityRiskPremium: data.equityRiskPremium,
      },
      canaries,
      activeCanaries: canaries.filter((c) => c.severity === "high" || c.severity === "medium").length,
      totalIndicators: 38,
      apiStatus: data.apiStatus,
      timestamp: new Date().toISOString(),
      cachedAt: new Date().toISOString(), // Added cache timestamp
    }

    try {
      await fetch(new URL("/api/ccpi/cache", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.JSON.stringify(response),
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

async function fetchMarketData() {
  const apiStatus: APIStatusTracker = {
    technical: { live: false, source: "baseline", lastUpdated: new Date().toISOString() },
    vixTerm: { live: false, source: "baseline", lastUpdated: new Date().toISOString() },
    fred: { live: false, source: "baseline", lastUpdated: new Date().toISOString() },
    alphaVantage: { live: false, source: "baseline", lastUpdated: new Date().toISOString() },
    apify: { live: false, source: "baseline", lastUpdated: new Date().toISOString() },
    fearGreed: { live: false, source: "baseline", lastUpdated: new Date().toISOString() },
    buffett: { live: false, source: "baseline", lastUpdated: new Date().toISOString() },
    putCall: { live: false, source: "baseline", lastUpdated: new Date().toISOString() },
    aaii: { live: false, source: "baseline", lastUpdated: new Date().toISOString() },
    shortInterest: { live: false, source: "baseline", lastUpdated: new Date().toISOString() },
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
    fetchApifyYahooFinanceUtil("QQQ"),
    fetchAAIISentiment(),
    scrapeBuffettIndicator(),
    scrapePutCallRatio(),
    scrapeAAIISentiment(),
  ])

  const qqqData = results[0].status === "fulfilled" ? results[0].value : null
  const vixTermData = results[1].status === "fulfilled" ? results[1].value : null
  const fredData = results[2].status === "fulfilled" ? results[2].value : null
  const alphaVantageData = results[3].status === "fulfilled" ? results[3].value : null
  const apifyData = results[4].status === "fulfilled" ? results[4].value : null
  const qqqFundamentals = results[5].status === "fulfilled" ? results[5].value : null
  const sentimentData = results[6].status === "fulfilled" ? results[6].value : null
  const buffettData =
    results[7].status === "fulfilled" ? results[7].value : { ratio: buffettResult.value, status: buffettResult.source }
  const putCallData =
    results[8].status === "fulfilled" ? results[8].value : { ratio: putCallResult.value, status: putCallResult.source }
  const aaiData =
    results[9].status === "fulfilled"
      ? results[9].value
      : { bullish: aaiiBullishResult.value, bearish: 30, neutral: 35, spread: 5, status: aaiiBullishResult.source }
  const shortInterestData = { spyShortRatio: shortInterestResult.value, status: shortInterestResult.source }

  apiStatus.technical = {
    live: qqqData?.source === "live",
    source: qqqData?.source || "baseline",
    lastUpdated: new Date().toISOString(),
  }

  apiStatus.vixTerm = {
    live: vixTermData?.source === "live",
    source: vixTermData?.source || vixResult.source,
    lastUpdated: new Date().toISOString(),
  }

  apiStatus.fred = {
    live: results[2].status === "fulfilled",
    source: results[2].status === "fulfilled" ? "FRED API" : ismPMIResult.source,
    lastUpdated: new Date().toISOString(),
  }

  apiStatus.alphaVantage = {
    live: results[3].status === "fulfilled",
    source:
      results[3].status === "fulfilled"
        ? "Alpha Vantage API"
        : `${nvidiaPriceResult.source} / ${soxIndexResult.source}`,
    lastUpdated: new Date().toISOString(),
  }

  apiStatus.apify = {
    live: apifyData?.dataSource && !apifyData.dataSource.includes("baseline"),
    source: apifyData?.dataSource || "baseline",
    lastUpdated: new Date().toISOString(),
  }

  apiStatus.fearGreed = {
    live:
      sentimentData?.dataSource &&
      !sentimentData.dataSource.includes("baseline") &&
      !sentimentData.dataSource.includes("failed"),
    source: sentimentData?.dataSource || "baseline",
    lastUpdated: new Date().toISOString(),
  }

  apiStatus.buffett = {
    live: buffettData.status === "live",
    source: buffettData.status === "live" ? "ScrapingBee" : buffettResult.source,
    lastUpdated: new Date().toISOString(),
  }

  apiStatus.putCall = {
    live: putCallData.status === "live",
    source: putCallData.status === "live" ? "ScrapingBee" : putCallResult.source,
    lastUpdated: new Date().toISOString(),
  }

  apiStatus.aaii = {
    live: aaiData.status === "live",
    source: aaiData.status === "live" ? "ScrapingBee" : aaiiBullishResult.source,
    lastUpdated: new Date().toISOString(),
  }

  apiStatus.shortInterest = {
    live: shortInterestData.status === "live",
    source: shortInterestData.status === "live" ? "ScrapingBee" : shortInterestResult.source,
    lastUpdated: new Date().toISOString(),
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

    // Volatility (use AI fallback for VIX)
    vix: alphaVantageData?.vix || vixResult.value,
    vxn: alphaVantageData?.vxn || 19,
    rvx: alphaVantageData?.rvx || 20,
    atr: alphaVantageData?.atr || 35,
    ltv: alphaVantageData?.ltv || 0.12,
    spotVol: alphaVantageData?.spotVol || 0.22,
    vixTermStructure: vixTermData?.termStructure || 1.5,
    vixTermInverted: vixTermData?.isInverted || false,
    highLowIndex: undefined,
    bullishPercent: 58,

    // Valuation (use AI fallback)
    spxPE: apifyData?.spxPE || 22.5,
    spxPS: apifyData?.spxPS || 2.8,
    qqqPE: qqqPEResult.value,
    mag7Concentration: mag7Result.value,
    shillerCAPE: shillerCAPEResult.value,
    equityRiskPremium: calculateEquityRiskPremium(apifyData?.spxPE || 22.5, fredData?.yieldCurve10Y || 4.5),

    // Macro
    fedFundsRate: fredData?.fedFundsRate || 5.33,
    junkSpread: fredData?.junkSpread || 3.5,
    yieldCurve: fredData?.yieldCurve || 0.25,
    debtToGDP: fredData?.debtToGDP || 123,

    // Sentiment (use AI fallback)
    putCallRatio: putCallData.ratio,
    fearGreedIndex: sentimentData?.fearGreed || null,
    etfFlows: apifyData?.etfFlows,
    shortInterest: shortInterestResult.value, // Using AI fallback directly

    // AI Structural
    aiCapexGrowth: 40,
    aiRevenueGrowth: 15,
    gpuPricingPremium: 20,
    aiJobPostingsGrowth: -5,

    // New indicators (use AI fallback)
    buffettIndicator: buffettResult.value,
    aaiiBullish: aaiiBullishResult.value,
    aaiiBearish: aaiData.bearish || 30,
    aaiiSpread: aaiData.spread || 5,

    // Phase 1 indicators (use AI fallback)
    nvidiaPrice: nvidiaPriceResult.value,
    nvidiaMomentum: fredData?.nvidiaMomentum || 50,
    soxIndex: soxIndexResult.value,
    tedSpread: fredData?.tedSpread || 0.25,
    dxyIndex: fredData?.dxyIndex || 103,
    ismPMI: ismPMIResult.value,
    fedReverseRepo: fredData?.fedReverseRepo || 450,

    apiStatus,
  }
}

function calculateEquityRiskPremium(spxPE: number, treasury10Y: number): number {
  const earningsYield = (1 / spxPE) * 100
  return earningsYield - treasury10Y
}

async function fetchFREDIndicators() {
  const FRED_API_KEY = process.env.FRED_API_KEY

  if (!FRED_API_KEY) {
    return {
      fedFundsRate: 5.33,
      junkSpread: 3.5,
      yieldCurve: 0.25,
      debtToGDP: 123,
      tedSpread: 0.25,
      dxyIndex: 103,
      ismPMI: 48,
      fedReverseRepo: 450,
      shillerCAPE: 30,
      yieldCurve10Y: 4.5,
    }
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

    console.log("[v0] FRED: Attempting to fetch Shiller CAPE with Grok...")
    const shillerCAPE = await fetchShillerCAPEWithGrok()

    return {
      fedFundsRate: Number.parseFloat(fedFunds.observations?.[0]?.value || "5.33"),
      junkSpread: Number.parseFloat(junkSpread.observations?.[0]?.value || "3.5"),
      yieldCurve: Number.parseFloat(yieldCurve.observations?.[0]?.value || "0.25"),
      debtToGDP: Number.parseFloat(debtToGDP.observations?.[0]?.value || "123"),
      tedSpread: Number.parseFloat(tedSpread.observations?.[0]?.value || "0.25"),
      dxyIndex: Number.parseFloat(dxy.observations?.[0]?.value || "103"),
      ismPMI: 48, // Will be overridden by AI fallback
      fedReverseRepo: Number.parseFloat(rrp.observations?.[0]?.value || "450"),
      shillerCAPE,
      yieldCurve10Y: Number.parseFloat(treasury10Y.observations?.[0]?.value || "4.5"),
    }
  } catch (error) {
    console.error("[v0] FRED API error:", error instanceof Error ? error.message : String(error))
    const shillerCAPE = await fetchShillerCAPEWithGrok()

    return {
      fedFundsRate: 5.33,
      junkSpread: 3.5,
      yieldCurve: 0.25,
      debtToGDP: 123,
      tedSpread: 0.25,
      dxyIndex: 103,
      ismPMI: 48,
      fedReverseRepo: 450,
      shillerCAPE,
      yieldCurve10Y: 4.5,
    }
  }
}

async function fetchAlphaVantageIndicators() {
  const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY

  if (!ALPHA_VANTAGE_API_KEY) {
    return {
      vix: 18,
      vxn: 19,
      rvx: 20,
      atr: 35,
      ltv: 0.12,
      spotVol: 0.22,
      nvidiaPrice: 800,
      nvidiaMomentum: 50,
      soxIndex: 5000,
      mag7Concentration: 55,
    }
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
    const nvidiaChange = Number.parseFloat(nvidiaData?.["Global Quote"]?.["09. change"] || "0")
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
      vix: 18,
      vxn: 19,
      rvx: 20,
      atr: 35,
      ltv: 0.12,
      spotVol: 0.22,
      nvidiaPrice,
      nvidiaMomentum,
      soxIndex,
      mag7Concentration,
    }
  } catch (error) {
    console.error("[v0] Alpha Vantage error:", error)
    return {
      vix: 18,
      vxn: 19,
      rvx: 20,
      atr: 35,
      ltv: 0.12,
      spotVol: 0.22,
      nvidiaPrice: 800,
      nvidiaMomentum: 50,
      soxIndex: 5000,
      mag7Concentration: 55,
    }
  }
}

async function fetchApifyYahooFinance() {
  try {
    console.log("[v0] CCPI: Attempting to fetch from Apify Yahoo Finance...")

    const result = await fetchApifyYahooFinanceUtil("SPY")

    console.log(`[v0] CCPI: Apify data source: ${result.dataSource}`)
    if (result.actorUsed) {
      console.log(`[v0] CCPI: Successfully used actor: ${result.actorUsed}`)
    }

    if (!result.data) {
      console.warn("[v0] CCPI: Apify returned no data, using baseline")
      return {
        spxPE: 22.5,
        spxPS: 2.8,
        dataSource: result.dataSource || "baseline-apify-no-data",
        etfFlows: -2.0,
      }
    }

    const data = result.data

    return {
      spxPE: data.forwardPE || data.trailingPE || 22.5,
      spxPS: data.priceToSales || 2.8,
      dataSource: result.dataSource || "apify-live",
      actorUsed: result.actorUsed,
      etfFlows: data.netInflows || -2.0,
      marketCap: data.marketCap,
      volume: data.volume,
      price: data.currentPrice,
    }
  } catch (error) {
    console.error("[v0] CCPI: Apify fetch error:", error instanceof Error ? error.message : String(error))
    return {
      spxPE: 22.5,
      spxPS: 2.8,
      dataSource: "baseline-apify-error",
      etfFlows: -2.0,
    }
  }
}

async function fetchAAIISentiment() {
  const fgRes = await fetch("https://api.alternative.me/fng/?limit=1", { signal: AbortSignal.timeout(10000) })
  if (fgRes.ok) {
    const fgData = await fgRes.json()
    if (fgData?.data?.[0]) {
      return {
        fearGreed: Number.parseInt(fgData.data[0].value),
        dataSource: "fear-greed-live",
      }
    }
  }

  return {
    fearGreed: null,
    dataSource: "baseline",
  }
}

async function computeMomentumPillar(data: Awaited<ReturnType<typeof fetchMarketData>>): Promise<number> {
  let totalScore = 0
  const indicators = []

  // Indicator 1: NVIDIA Momentum Score (Weight: 6/100)
  const nvidiaScore = (() => {
    const momentum = data.nvidiaMomentum || 50
    if (momentum < 20) return 6 // Severe weakness = max danger
    if (momentum < 40) return 4
    if (momentum > 80) return 3 // Overheating = moderate danger
    if (momentum > 60) return 1
    return 0 // Healthy range = low risk
  })()
  totalScore += nvidiaScore
  indicators.push({ name: "NVIDIA Momentum", score: nvidiaScore, weight: 6 })

  // Indicator 2: SOX Semiconductor Index (Weight: 6/100)
  const soxScore = (() => {
    const soxDeviation = ((data.soxIndex - 5000) / 5000) * 100
    // SOX scoring: Chip sector health signals tech sector strength
    // Strong chips (>5500, +10%) = 0 risk
    // Baseline (5000) = low risk (2 points)
    // Weak chips (4500, -10%) = medium risk (6 points)
    // Chip crash (<4250, -15%) = high risk (6 points)
    if (soxDeviation < -15) return 6 // Chip sector collapse
    if (soxDeviation < -10) return 4 // Significant weakness
    if (soxDeviation < -5) return 2 // Mild weakness
    return 0 // Strong or neutral chips = low crash risk
  })()
  totalScore += soxScore
  indicators.push({ name: "SOX Index", score: soxScore, weight: 6 })

  // Indicator 3: QQQ Daily Return (Weight: 8/100) - 5× downside amplifier
  const qqqReturnScore = (() => {
    const ret = data.qqqDailyReturn
    if (ret <= -6) return 8 // Crash day
    if (ret <= -3) return 6
    if (ret <= -1.5) return 4
    if (ret <= -1) return 2
    return 0 // Flat or up = low risk
  })()
  totalScore += qqqReturnScore
  indicators.push({ name: "QQQ Daily Return", score: qqqReturnScore, weight: 8 })

  // Indicator 4: QQQ Consecutive Down Days (Weight: 5/100)
  const consecDownScore = (() => {
    if (data.qqqConsecDown >= 5) return 5
    if (data.qqqConsecDown >= 3) return 3
    if (data.qqqConsecDown >= 2) return 2
    return 0
  })()
  totalScore += consecDownScore
  indicators.push({ name: "QQQ Consecutive Down Days", score: consecDownScore, weight: 5 })

  // Indicator 5: QQQ Below 20-Day SMA (Weight: 5/100)
  const sma20Score = (() => {
    if (data.qqqBelowSMA20 && data.qqqSMA20Proximity >= 100) return 5
    if (data.qqqSMA20Proximity >= 50) return 3
    if (data.qqqSMA20Proximity >= 25) return 1
    return 0
  })()
  totalScore += sma20Score
  indicators.push({ name: "QQQ Below SMA20", score: sma20Score, weight: 5 })

  // Indicator 6: QQQ Below 50-Day SMA (Weight: 7/100)
  const sma50Score = (() => {
    if (data.qqqBelowSMA50 && data.qqqSMA50Proximity >= 100) return 7
    if (data.qqqSMA50Proximity >= 50) return 5
    if (data.qqqSMA50Proximity >= 25) return 2
    return 0
  })()
  totalScore += sma50Score
  indicators.push({ name: "QQQ Below SMA50", score: sma50Score, weight: 7 })

  // Indicator 7: QQQ Below 200-Day SMA (Weight: 10/100)
  const sma200Score = (() => {
    if (data.qqqBelowSMA200 && data.qqqSMA200Proximity >= 100) return 10
    if (data.qqqSMA200Proximity >= 50) return 7
    if (data.qqqSMA200Proximity >= 25) return 3
    return 0
  })()
  totalScore += sma200Score
  indicators.push({ name: "QQQ Below SMA200", score: sma200Score, weight: 10 })

  // Indicator 8: QQQ Below Bollinger Band (Weight: 6/100)
  const bollingerScore = (() => {
    if (data.qqqBelowBollinger && data.qqqBollingerProximity >= 100) return 6
    if (data.qqqBollingerProximity >= 50) return 4
    if (data.qqqBollingerProximity >= 25) return 2
    return 0
  })()
  totalScore += bollingerScore
  indicators.push({ name: "QQQ Bollinger Band", score: bollingerScore, weight: 6 })

  // Indicator 9: VIX Fear Gauge (Weight: 9/100)
  const vixScore = (() => {
    if (data.vix > 35) return 9
    if (data.vix > 25) return 6
    if (data.vix > 20) return 4
    if (data.vix > 15) return 2
    return 0
  })()
  totalScore += vixScore
  indicators.push({ name: "VIX", score: vixScore, weight: 9 })

  // Indicator 10: VXN Nasdaq Volatility (Weight: 7/100)
  const vxnScore = (() => {
    if (data.vxn > 35) return 7
    if (data.vxn > 25) return 5
    if (data.vxn > 20) return 3
    return 0
  })()
  totalScore += vxnScore
  indicators.push({ name: "VXN", score: vxnScore, weight: 7 })

  // Indicator 11: RVX Russell 2000 Volatility (Weight: 5/100)
  const rvxScore = (() => {
    if (data.rvx > 35) return 5
    if (data.rvx > 25) return 3
    return 0
  })()
  totalScore += rvxScore
  indicators.push({ name: "RVX", score: rvxScore, weight: 5 })

  // Indicator 12: VIX Term Structure (Weight: 6/100)
  const vixTermScore = (() => {
    if (data.vixTermInverted || data.vixTermStructure < 0.8) return 6
    if (data.vixTermStructure < 1.2) return 3
    return 0
  })()
  totalScore += vixTermScore
  indicators.push({ name: "VIX Term Structure", score: vixTermScore, weight: 6 })

  console.log("[v0] Pillar 1 - Momentum & Technical (35% weight):", totalScore)
  console.log("[v0] Indicator Breakdown:", indicators)
  console.log("[v0] Total Indicators in Pillar 1: 12 (removed Yield Curve duplicate - kept in Pillar 2)")

  // Return score capped at 100
  return Math.min(100, Math.max(0, totalScore))
}

async function computeRiskAppetitePillar(data: Awaited<ReturnType<typeof fetchMarketData>>): Promise<number> {
  // Pillar 2: Risk Appetite & Volatility (30% weight) - 8 indicators with explicit weights

  let totalScore = 0
  const indicators = []

  // Indicator 1: Put/Call Ratio (Weight: 18/100)
  const putCallScore = (() => {
    const ratio = data.putCallRatio
    if (ratio < 0.6) return 18 // Extreme complacency
    if (ratio < 0.7) return 14
    if (ratio < 0.9) return 10
    if (ratio > 1.3) return 8 // Extreme fear (contrarian)
    if (ratio > 1.1) return 4
    return 0
  })()
  totalScore += putCallScore
  indicators.push({ name: "Put/Call Ratio", score: putCallScore, weight: 18 })

  // Indicator 2: Fear & Greed Index (Weight: 15/100)
  const fearGreedScore = (() => {
    if (data.fearGreedIndex === null) return 0
    if (data.fearGreedIndex > 80) return 15 // Extreme greed
    if (data.fearGreedIndex > 70) return 12
    if (data.fearGreedIndex > 60) return 8
    if (data.fearGreedIndex < 20) return 8 // Extreme fear (contrarian)
    if (data.fearGreedIndex < 30) return 4
    return 0
  })()
  totalScore += fearGreedScore
  indicators.push({ name: "Fear & Greed Index", score: fearGreedScore, weight: 15 })

  // Indicator 3: AAII Bullish Sentiment (Weight: 16/100)
  const aaiiScore = (() => {
    const bullish = data.aaiiBullish || 35
    if (bullish > 55) return 16 // Retail euphoria
    if (bullish > 50) return 12
    if (bullish > 45) return 8
    if (bullish < 25) return 6 // Extreme pessimism (contrarian)
    if (bullish < 30) return 3
    return 0
  })()
  totalScore += aaiiScore
  indicators.push({ name: "AAII Bullish", score: aaiiScore, weight: 16 })

  // Indicator 4: SPY Short Interest Ratio (Weight: 13/100)
  const shortInterestScore = (() => {
    const short = data.shortInterest || 2.5
    if (short < 1.5) return 13 // Extreme complacency
    if (short < 2.0) return 10
    if (short < 3.0) return 6
    if (short > 8.0) return 8 // High positioning (contrarian)
    if (short > 6.0) return 4
    return 0
  })()
  totalScore += shortInterestScore
  indicators.push({ name: "Short Interest", score: shortInterestScore, weight: 13 })

  // Indicator 5: ATR - Average True Range (Weight: 5/100) - Moved from Pillar 1
  const atrScore = (() => {
    if (data.atr > 50) return 5
    if (data.atr > 40) return 3
    if (data.atr > 30) return 1
    return 0
  })()
  totalScore += atrScore
  indicators.push({ name: "ATR", score: atrScore, weight: 5 })

  // Indicator 6: LTV - Long-term Volatility (Weight: 5/100) - Moved from Pillar 1
  const ltvScore = (() => {
    if (data.ltv > 0.2) return 5
    if (data.ltv > 0.15) return 3
    if (data.ltv > 0.12) return 1
    return 0
  })()
  totalScore += ltvScore
  indicators.push({ name: "LTV", score: ltvScore, weight: 5 })

  // Indicator 7: Bullish Percent Index (Weight: 5/100) - Moved from Pillar 1
  const bullishPercentScore = (() => {
    if (data.bullishPercent > 70) return 5 // Overbought danger
    if (data.bullishPercent > 60) return 3
    if (data.bullishPercent < 30) return 4 // Oversold panic
    if (data.bullishPercent < 40) return 2
    return 0
  })()
  totalScore += bullishPercentScore
  indicators.push({ name: "Bullish Percent", score: bullishPercentScore, weight: 5 })

  // Indicator 8: Yield Curve (10Y-2Y) (Weight: 8/100)
  const yieldCurveScore = (() => {
    if (data.yieldCurve < -1.0) return 8 // Deep inversion
    if (data.yieldCurve < -0.5) return 6
    if (data.yieldCurve < -0.2) return 4
    if (data.yieldCurve < 0) return 2
    return 0
  })()
  totalScore += yieldCurveScore
  indicators.push({ name: "Yield Curve", score: yieldCurveScore, weight: 8 })

  console.log("[v0] Pillar 2 - Risk Appetite & Volatility:", totalScore)
  console.log("[v0] Indicator Breakdown:", indicators)

  // Return score capped at 100
  return Math.min(100, Math.max(0, totalScore))
}

async function computeValuationPillar(data: Awaited<ReturnType<typeof fetchMarketData>>): Promise<number> {
  let totalScore = 0
  const indicators = []

  // Indicator 1: S&P 500 Forward P/E (Weight: 18/100)
  const spxPEScore = (() => {
    if (data.spxPE > 30) return 18 // Extreme overvaluation
    if (data.spxPE > 25) return 14
    if (data.spxPE > 22) return 10 // Current: 22.5
    if (data.spxPE > 18) return 6
    return 2
  })()
  totalScore += spxPEScore
  indicators.push({ name: "S&P 500 Forward P/E", score: spxPEScore, weight: 18 })

  // Indicator 2: S&P 500 Price-to-Sales (Weight: 12/100)
  const spxPSScore = (() => {
    if (data.spxPS > 3.5) return 12 // Extreme
    if (data.spxPS > 3.0) return 10
    if (data.spxPS > 2.5) return 7 // Current: 2.8
    if (data.spxPS > 2.0) return 4
    return 0
  })()
  totalScore += spxPSScore
  indicators.push({ name: "S&P 500 Price-to-Sales", score: spxPSScore, weight: 12 })

  // Indicator 3: Buffett Indicator (Market Cap / GDP) (Weight: 16/100)
  const buffettScore = (() => {
    const buffett = data.buffettIndicator || 180
    if (buffett > 200) return 16 // Danger: >200%
    if (buffett > 180) return 13
    if (buffett > 150) return 9 // Warning: 150-180%
    if (buffett > 120) return 5 // Fair: 120-150%
    return 0 // Undervalued: <120%
  })()
  totalScore += buffettScore
  indicators.push({ name: "Buffett Indicator", score: buffettScore, weight: 16 })

  // Indicator 4: QQQ Forward P/E (AI-Specific Valuation) (Weight: 16/100)
  const qqqPEScore = (() => {
    if (data.qqqPE > 40) return 16 // Bubble territory
    if (data.qqqPE > 35) return 13
    if (data.qqqPE > 30) return 10
    if (data.qqqPE > 25) return 6 // Current: 25.8
    return 2
  })()
  totalScore += qqqPEScore
  indicators.push({ name: "QQQ Forward P/E", score: qqqPEScore, weight: 16 })

  // Indicator 5: Magnificent 7 Concentration (Crash Contagion Risk) (Weight: 15/100)
  const mag7Score = (() => {
    if (data.mag7Concentration > 65) return 15 // Extreme concentration
    if (data.mag7Concentration > 60) return 12
    if (data.mag7Concentration > 55) return 9
    if (data.mag7Concentration > 50) return 6
    if (data.mag7Concentration > 45) return 3 // Current: 48.2%
    return 0
  })()
  totalScore += mag7Score
  indicators.push({ name: "Magnificent 7 Concentration", score: mag7Score, weight: 15 })

  // Indicator 6: Shiller CAPE Ratio (10-Year Cyclical Valuation) (Weight: 13/100)
  const shillerScore = (() => {
    if (data.shillerCAPE > 35) return 13 // Historic overvaluation
    if (data.shillerCAPE > 30) return 10 // Current: 32.4
    if (data.shillerCAPE > 25) return 7
    if (data.shillerCAPE > 20) return 4
    return 0
  })()
  totalScore += shillerScore
  indicators.push({ name: "Shiller CAPE Ratio", score: shillerScore, weight: 13 })

  // Indicator 7: Equity Risk Premium (Earnings Yield - 10Y Treasury) (Weight: 10/100)
  const erpScore = (() => {
    if (data.equityRiskPremium < 1.5) return 10 // Severely overpriced
    if (data.equityRiskPremium < 2.0) return 8
    if (data.equityRiskPremium < 3.0) return 5
    if (data.equityRiskPremium < 4.0) return 2
    return 0 // Attractive: >4%
  })()
  totalScore += erpScore
  indicators.push({ name: "Equity Risk Premium", score: erpScore, weight: 10 })

  console.log("[v0] Pillar 3 - Valuation & Market Structure:", totalScore)
  console.log("[v0] Indicator Breakdown:", indicators)

  // Return score capped at 100
  return Math.min(100, Math.max(0, totalScore))
}

async function computeMacroPillar(data: Awaited<ReturnType<typeof fetchMarketData>>): Promise<number> {
  let totalScore = 0
  const indicators = []

  // Indicator 1: TED Spread - Banking System Stress (Weight: 15/100)
  const tedSpreadScore = (() => {
    if (data.tedSpread > 1.0) return 15 // Extreme banking stress
    if (data.tedSpread > 0.75) return 12
    if (data.tedSpread > 0.5) return 9
    if (data.tedSpread > 0.35) return 5
    return 0
  })()
  totalScore += tedSpreadScore
  indicators.push({ name: "TED Spread", score: tedSpreadScore, weight: 15 })

  // Indicator 2: US Dollar Index (DXY) - Tech Headwind (Weight: 14/100)
  const dxyScore = (() => {
    if (data.dxyIndex > 115) return 14 // Very strong dollar hurts tech
    if (data.dxyIndex > 110) return 11
    if (data.dxyIndex > 105) return 7
    if (data.dxyIndex > 100) return 3
    return 0
  })()
  totalScore += dxyScore
  indicators.push({ name: "US Dollar Index", score: dxyScore, weight: 14 })

  // Indicator 3: ISM Manufacturing PMI - Economic Leading (Weight: 18/100)
  const ismScore = (() => {
    if (data.ismPMI < 42) return 18 // Deep contraction
    if (data.ismPMI < 46) return 14
    if (data.ismPMI < 50) return 10 // Contraction
    if (data.ismPMI < 52) return 4
    return 0
  })()
  totalScore += ismScore
  indicators.push({ name: "ISM Manufacturing PMI", score: ismScore, weight: 18 })

  // Indicator 4: Fed Funds Rate - Restrictive Policy (Weight: 17/100)
  const fedFundsScore = (() => {
    if (data.fedFundsRate > 6.0) return 17 // Extremely restrictive
    if (data.fedFundsRate > 5.5) return 14
    if (data.fedFundsRate > 5.0) return 10
    if (data.fedFundsRate > 4.5) return 7
    if (data.fedFundsRate > 4.0) return 3
    return 0
  })()
  totalScore += fedFundsScore
  indicators.push({ name: "Fed Funds Rate", score: fedFundsScore, weight: 17 })

  // Indicator 5: Fed Reverse Repo - Liquidity Conditions (Weight: 13/100)
  const rrpScore = (() => {
    if (data.fedReverseRepo > 2000) return 13 // Extreme liquidity drain
    if (data.fedReverseRepo > 1500) return 10
    if (data.fedReverseRepo > 1000) return 7
    if (data.fedReverseRepo > 500) return 3
    return 0
  })()
  totalScore += rrpScore
  indicators.push({ name: "Fed Reverse Repo", score: rrpScore, weight: 13 })

  // Indicator 6: Junk Bond Spread - Credit Stress (Weight: 12/100)
  const junkSpreadScore = (() => {
    if (data.junkSpread > 10) return 12 // Severe credit stress
    if (data.junkSpread > 8) return 10
    if (data.junkSpread > 6) return 7
    if (data.junkSpread > 5) return 4
    if (data.junkSpread > 3.5) return 2
    return 0
  })()
  totalScore += junkSpreadScore
  indicators.push({ name: "Junk Bond Spread", score: junkSpreadScore, weight: 12 })

  // Indicator 7: US Debt-to-GDP Ratio - Fiscal Burden (Weight: 11/100)
  const debtScore = (() => {
    if (data.debtToGDP > 130) return 11 // Fiscal crisis risk
    if (data.debtToGDP > 120) return 9
    if (data.debtToGDP > 110) return 6
    if (data.debtToGDP > 100) return 3
    return 0
  })()
  totalScore += debtScore
  indicators.push({ name: "US Debt-to-GDP", score: debtScore, weight: 11 })

  console.log("[v0] Pillar 4 - Macro (20% weight):", totalScore)
  console.log("[v0] Indicator Breakdown:", indicators)

  // Return score capped at 100
  return Math.min(100, Math.max(0, totalScore))
}

function calculateCrashAmplifiers(data: Awaited<ReturnType<typeof fetchMarketData>>) {
  const bonuses: Array<{ reason: string; points: number }> = []
  let totalBonus = 0

  // QQQ drops ≥6% in 1 day → +25
  if (data.qqqDailyReturn <= -6) {
    bonuses.push({ reason: `QQQ crashed ${Math.abs(data.qqqDailyReturn).toFixed(1)}% in one day`, points: 25 })
    totalBonus += 25
  }

  // QQQ drops ≥9% in 1 day → +40 (replaces +25)
  else if (data.qqqDailyReturn <= -9) {
    bonuses.push({
      reason: `QQQ crashed ${Math.abs(data.qqqDailyReturn).toFixed(1)}% in one day (EXTREME)`,
      points: 40,
    })
    totalBonus += 40
  }

  // QQQ below 50-Day SMA → +20
  if (data.qqqBelowSMA50) {
    bonuses.push({ reason: "QQQ broken below 50-day SMA", points: 20 })
    totalBonus += 20
  }

  // VIX > 35 → +20
  if (data.vix > 35) {
    bonuses.push({ reason: `VIX spiked to ${data.vix.toFixed(1)} (panic level)`, points: 20 })
    totalBonus += 20
  }

  // Put/Call > 1.3 → +15
  if (data.putCallRatio > 1.3) {
    bonuses.push({ reason: `Put/Call ratio ${data.putCallRatio.toFixed(2)} (extreme hedging)`, points: 15 })
    totalBonus += 15
  }

  // Yield Curve inverts → +15
  if (data.yieldCurve < 0) {
    bonuses.push({ reason: `Yield curve inverted at ${data.yieldCurve.toFixed(2)}%`, points: 15 })
    totalBonus += 15
  }

  // Cap total bonus at +100
  if (totalBonus > 100) {
    totalBonus = 100
    bonuses.push({ reason: "⚠️ Bonus capped at maximum +100", points: 0 })
  }

  return { bonuses, totalBonus }
}

function computeCertaintyScore(
  pillars: Record<string, number>,
  data: Awaited<ReturnType<typeof fetchMarketData>>,
  canaryCount: number,
): number {
  const values = Object.values(pillars)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)

  const varianceAlignment = Math.max(0, 100 - stdDev * 3.0)
  const canaryAgreement = Math.min(100, (canaryCount / 15) * 100)

  return Math.round(varianceAlignment * 0.7 + canaryAgreement * 0.3)
}

function determineRegime(ccpi: number, canaryCount: number) {
  if (ccpi >= 80) {
    return { level: 5, name: "Crash Watch", color: "red", description: "Extreme risk across multiple pillars" }
  } else if (ccpi >= 60) {
    return { level: 4, name: "High Alert", color: "orange", description: "Elevated risk signals" }
  } else if (ccpi >= 40) {
    return { level: 3, name: "Elevated Risk", color: "yellow", description: "Caution warranted" }
  } else if (ccpi >= 20) {
    return { level: 2, name: "Normal", color: "lightgreen", description: "Market conditions normal" }
  } else {
    return { level: 1, name: "Low Risk", color: "green", description: "Healthy market conditions" }
  }
}

function getPlaybook(regime: ReturnType<typeof determineRegime>) {
  return {
    bias: "Risk-On",
    strategies: ["Maintain exposure", "Use cash-secured puts"],
    allocation: {
      equities: "60-80%",
      defensive: "5-10%",
      cash: "10-20%",
      alternatives: "5-10%",
    },
  }
}

function generateWeeklySummary(
  ccpi: number,
  confidence: number,
  regime: ReturnType<typeof determineRegime>,
  pillars: Record<string, number>,
  data: Awaited<ReturnType<typeof fetchMarketData>>,
  canaries: Array<{ signal: string; pillar: string; severity: "high" | "medium" | "low" }>,
) {
  return {
    headline: `CCPI at ${ccpi} with ${confidence}% confidence`,
    bullets: [
      `Momentum pillar at ${pillars.momentum}/100`,
      `Risk Appetite pillar at ${pillars.riskAppetite}/100`,
      `${canaries.length} active warning signals`,
    ],
  }
}

async function generateCanarySignals(data: Awaited<ReturnType<typeof fetchMarketData>>) {
  const canaries: Array<{
    signal: string
    pillar: string
    severity: "high" | "medium" | "low"
    indicatorWeight: number
    pillarWeight: number
    impactScore: number
  }> = []

  // Pillar weights in the CCPI calculation
  const pillarWeights = {
    "Momentum & Technical": 0.35,
    "Risk Appetite & Volatility": 0.3,
    "Valuation & Market Structure": 0.15,
    Macro: 0.2,
  }

  // 1. QQQ Daily Return (Weight: 8/100 in Pillar 1)
  if (data.qqqDailyReturn <= -6) {
    canaries.push({
      signal: `QQQ crashed ${Math.abs(data.qqqDailyReturn).toFixed(1)}% - Momentum loss`,
      pillar: "Momentum & Technical",
      severity: "high",
      indicatorWeight: 8,
      pillarWeight: 35,
      impactScore: 8 * 0.35,
    })
  } else if (data.qqqDailyReturn <= -3) {
    canaries.push({
      signal: `QQQ dropped ${Math.abs(data.qqqDailyReturn).toFixed(1)}% - Sharp decline`,
      pillar: "Momentum & Technical",
      severity: "medium",
      indicatorWeight: 8,
      pillarWeight: 35,
      impactScore: 8 * 0.35,
    })
  }

  // 2. QQQ Consecutive Down Days (Weight: 5/100 in Pillar 1)
  if (data.qqqConsecDown >= 5) {
    canaries.push({
      signal: `${data.qqqConsecDown} consecutive down days - Trend break`,
      pillar: "Momentum & Technical",
      severity: "high",
      indicatorWeight: 5,
      pillarWeight: 35,
      impactScore: 5 * 0.35,
    })
  } else if (data.qqqConsecDown >= 3) {
    canaries.push({
      signal: `${data.qqqConsecDown} consecutive down days`,
      pillar: "Momentum & Technical",
      severity: "medium",
      indicatorWeight: 5,
      pillarWeight: 35,
      impactScore: 5 * 0.35,
    })
  }

  // 3. QQQ Below 20-Day SMA (Weight: 5/100 in Pillar 1)
  if (data.qqqBelowSMA20 && data.qqqSMA20Proximity >= 100) {
    canaries.push({
      signal: "QQQ breached 20-day SMA - Short-term support lost",
      pillar: "Momentum & Technical",
      severity: "high",
      indicatorWeight: 5,
      pillarWeight: 35,
      impactScore: 5 * 0.35,
    })
  } else if (data.qqqSMA20Proximity >= 50) {
    canaries.push({
      signal: `QQQ approaching 20-day SMA (${data.qqqSMA20Proximity.toFixed(0)}% proximity)`,
      pillar: "Momentum & Technical",
      severity: "medium",
      indicatorWeight: 5,
      pillarWeight: 35,
      impactScore: 5 * 0.35,
    })
  }

  // 4. QQQ Below 50-Day SMA (Weight: 7/100 in Pillar 1)
  if (data.qqqBelowSMA50 && data.qqqSMA50Proximity >= 100) {
    canaries.push({
      signal: "QQQ breached 50-day SMA - Medium-term trend broken",
      pillar: "Momentum & Technical",
      severity: "high",
      indicatorWeight: 7,
      pillarWeight: 35,
      impactScore: 7 * 0.35,
    })
  } else if (data.qqqSMA50Proximity >= 50) {
    canaries.push({
      signal: `QQQ approaching 50-day SMA (${data.qqqSMA50Proximity.toFixed(0)}% proximity)`,
      pillar: "Momentum & Technical",
      severity: "medium",
      indicatorWeight: 7,
      pillarWeight: 35,
      impactScore: 7 * 0.35,
    })
  }

  // 5. QQQ Below 200-Day SMA (Weight: 10/100 in Pillar 1)
  if (data.qqqBelowSMA200 && data.qqqSMA200Proximity >= 100) {
    canaries.push({
      signal: "QQQ breached 200-day SMA - Long-term bull market in question",
      pillar: "Momentum & Technical",
      severity: "high",
      indicatorWeight: 10,
      pillarWeight: 35,
      impactScore: 10 * 0.35,
    })
  } else if (data.qqqSMA200Proximity >= 50) {
    canaries.push({
      signal: `QQQ approaching 200-day SMA (${data.qqqSMA200Proximity.toFixed(0)}% proximity)`,
      pillar: "Momentum & Technical",
      severity: "medium",
      indicatorWeight: 10,
      pillarWeight: 35,
      impactScore: 10 * 0.35,
    })
  }

  // 6. QQQ Below Bollinger Band (Weight: 6/100 in Pillar 1)
  if (data.qqqBelowBollinger && data.qqqBollingerProximity >= 100) {
    canaries.push({
      signal: "QQQ breached lower Bollinger Band - Oversold territory",
      pillar: "Momentum & Technical",
      severity: "high",
      indicatorWeight: 6,
      pillarWeight: 35,
      impactScore: 6 * 0.35,
    })
  } else if (data.qqqBollingerProximity >= 50) {
    canaries.push({
      signal: `QQQ approaching Bollinger Band (${data.qqqBollingerProximity.toFixed(0)}% proximity)`,
      pillar: "Momentum & Technical",
      severity: "medium",
      indicatorWeight: 6,
      pillarWeight: 35,
      impactScore: 6 * 0.35,
    })
  }

  // 7. VIX (Weight: 9/100 in Pillar 1)
  if (data.vix > 35) {
    canaries.push({
      signal: `VIX at ${data.vix.toFixed(1)} - Extreme fear`,
      pillar: "Momentum & Technical",
      severity: "high",
      indicatorWeight: 9,
      pillarWeight: 35,
      impactScore: 9 * 0.35,
    })
  } else if (data.vix > 25) {
    canaries.push({
      signal: `VIX at ${data.vix.toFixed(1)} - Elevated fear`,
      pillar: "Momentum & Technical",
      severity: "medium",
      indicatorWeight: 9,
      pillarWeight: 35,
      impactScore: 9 * 0.35,
    })
  }

  // 8. VXN (Weight: 7/100 in Pillar 1)
  if (data.vxn > 35) {
    canaries.push({
      signal: `VXN at ${data.vxn.toFixed(1)} - Nasdaq panic`,
      pillar: "Momentum & Technical",
      severity: "high",
      indicatorWeight: 7,
      pillarWeight: 35,
      impactScore: 7 * 0.35,
    })
  } else if (data.vxn > 25) {
    canaries.push({
      signal: `VXN at ${data.vxn.toFixed(1)} - Nasdaq volatility elevated`,
      pillar: "Momentum & Technical",
      severity: "medium",
      indicatorWeight: 7,
      pillarWeight: 35,
      impactScore: 7 * 0.35,
    })
  }

  // 9. RVX (Weight: 5/100 in Pillar 1)
  if (data.rvx > 35) {
    canaries.push({
      signal: `RVX at ${data.rvx.toFixed(1)} - Small-cap stress`,
      pillar: "Momentum & Technical",
      severity: "high",
      indicatorWeight: 5,
      pillarWeight: 35,
      impactScore: 5 * 0.35,
    })
  } else if (data.rvx > 25) {
    canaries.push({
      signal: `RVX at ${data.rvx.toFixed(1)} - Small-cap volatility rising`,
      pillar: "Momentum & Technical",
      severity: "medium",
      indicatorWeight: 5,
      pillarWeight: 35,
      impactScore: 5 * 0.35,
    })
  }

  // 10. VIX Term Structure (Weight: 6/100 in Pillar 1)
  if (data.vixTermInverted || data.vixTermStructure < 0.8) {
    canaries.push({
      signal: `VIX term structure inverted (${data.vixTermStructure.toFixed(2)}) - Immediate fear`,
      pillar: "Momentum & Technical",
      severity: "high",
      indicatorWeight: 6,
      pillarWeight: 35,
      impactScore: 6 * 0.35,
    })
  } else if (data.vixTermStructure < 1.2) {
    canaries.push({
      signal: `VIX term structure flattening (${data.vixTermStructure.toFixed(2)})`,
      pillar: "Momentum & Technical",
      severity: "medium",
      indicatorWeight: 6,
      pillarWeight: 35,
      impactScore: 6 * 0.35,
    })
  }

  // 11. ATR (Weight: 5/100 in Pillar 2)
  if (data.atr > 50) {
    canaries.push({
      signal: `ATR at ${data.atr.toFixed(1)} - Extreme volatility`,
      pillar: "Risk Appetite & Volatility",
      severity: "high",
      indicatorWeight: 5,
      pillarWeight: 30,
      impactScore: 5 * 0.3,
    })
  } else if (data.atr > 40) {
    canaries.push({
      signal: `ATR at ${data.atr.toFixed(1)} - Elevated volatility`,
      pillar: "Risk Appetite & Volatility",
      severity: "medium",
      indicatorWeight: 5,
      pillarWeight: 30,
      impactScore: 5 * 0.3,
    })
  }

  // 12. LTV (Weight: 5/100 in Pillar 2)
  if (data.ltv > 0.2) {
    canaries.push({
      signal: `Long-term volatility at ${(data.ltv * 100).toFixed(1)}% - Sustained instability`,
      pillar: "Risk Appetite & Volatility",
      severity: "high",
      indicatorWeight: 5,
      pillarWeight: 30,
      impactScore: 5 * 0.3,
    })
  } else if (data.ltv > 0.15) {
    canaries.push({
      signal: `Long-term volatility at ${(data.ltv * 100).toFixed(1)}% - Rising`,
      pillar: "Risk Appetite & Volatility",
      severity: "medium",
      indicatorWeight: 5,
      pillarWeight: 30,
      impactScore: 5 * 0.3,
    })
  }

  // 13. Bullish Percent (Weight: 5/100 in Pillar 2)
  if (data.bullishPercent > 70) {
    canaries.push({
      signal: `Bullish Percent at ${data.bullishPercent}% - Overbought danger`,
      pillar: "Risk Appetite & Volatility",
      severity: "high",
      indicatorWeight: 5,
      pillarWeight: 30,
      impactScore: 5 * 0.3,
    })
  } else if (data.bullishPercent > 60) {
    canaries.push({
      signal: `Bullish Percent at ${data.bullishPercent}% - Elevated optimism`,
      pillar: "Risk Appetite & Volatility",
      severity: "medium",
      indicatorWeight: 5,
      pillarWeight: 30,
      impactScore: 5 * 0.3,
    })
  }

  // 14. Put/Call Ratio (Weight: 18/100 in Pillar 2)
  if (data.putCallRatio < 0.6) {
    canaries.push({
      signal: `Put/Call at ${data.putCallRatio.toFixed(2)} - Extreme complacency`,
      pillar: "Risk Appetite & Volatility",
      severity: "high",
      indicatorWeight: 18,
      pillarWeight: 30,
      impactScore: 18 * 0.3,
    })
  } else if (data.putCallRatio < 0.85) {
    canaries.push({
      signal: `Put/Call at ${data.putCallRatio.toFixed(2)} - Low hedging activity`,
      pillar: "Risk Appetite & Volatility",
      severity: "medium",
      indicatorWeight: 18,
      pillarWeight: 30,
      impactScore: 18 * 0.3,
    })
  }

  // 15. Fear & Greed (Weight: 15/100 in Pillar 2)
  if (data.fearGreedIndex !== null) {
    if (data.fearGreedIndex > 80) {
      canaries.push({
        signal: `Fear & Greed at ${data.fearGreedIndex} - Extreme greed`,
        pillar: "Risk Appetite & Volatility",
        severity: "high",
        indicatorWeight: 15,
        pillarWeight: 30,
        impactScore: 15 * 0.3,
      })
    } else if (data.fearGreedIndex > 70) {
      canaries.push({
        signal: `Fear & Greed at ${data.fearGreedIndex} - Elevated greed`,
        pillar: "Risk Appetite & Volatility",
        severity: "medium",
        indicatorWeight: 15,
        pillarWeight: 30,
        impactScore: 15 * 0.3,
      })
    }
  }

  // 16. AAII Bullish (Weight: 16/100 in Pillar 2)
  const aaiiBullish = data.aaiiBullish || 35
  if (aaiiBullish > 55) {
    canaries.push({
      signal: `AAII Bullish at ${aaiiBullish}% - Retail euphoria`,
      pillar: "Risk Appetite & Volatility",
      severity: "high",
      indicatorWeight: 16,
      pillarWeight: 30,
      impactScore: 16 * 0.3,
    })
  } else if (aaiiBullish > 45) {
    canaries.push({
      signal: `AAII Bullish at ${aaiiBullish}% - Elevated retail optimism`,
      pillar: "Risk Appetite & Volatility",
      severity: "medium",
      indicatorWeight: 16,
      pillarWeight: 30,
      impactScore: 16 * 0.3,
    })
  }

  // 17. Short Interest (Weight: 13/100 in Pillar 2)
  const shortInterest = data.shortInterest || 2.5
  if (shortInterest < 1.5) {
    canaries.push({
      signal: `Short Interest at ${shortInterest.toFixed(1)}% - Extreme complacency`,
      pillar: "Risk Appetite & Volatility",
      severity: "high",
      indicatorWeight: 13,
      pillarWeight: 30,
      impactScore: 13 * 0.3,
    })
  } else if (shortInterest < 2.5) {
    canaries.push({
      signal: `Short Interest at ${shortInterest.toFixed(1)}% - Low positioning`,
      pillar: "Risk Appetite & Volatility",
      severity: "medium",
      indicatorWeight: 13,
      pillarWeight: 30,
      impactScore: 13 * 0.3,
    })
  }

  // 18. ETF Flows (Weight: 8/100 in Pillar 2)
  if (data.etfFlows !== undefined) {
    if (data.etfFlows < -3.0) {
      canaries.push({
        signal: `ETF outflows at $${Math.abs(data.etfFlows).toFixed(1)}B - Capital flight`,
        pillar: "Risk Appetite & Volatility",
        severity: "high",
        indicatorWeight: 8,
        pillarWeight: 30,
        impactScore: 8 * 0.3,
      })
    } else if (data.etfFlows < -1.5) {
      canaries.push({
        signal: `ETF outflows at $${Math.abs(data.etfFlows).toFixed(1)}B - Selling pressure`,
        pillar: "Risk Appetite & Volatility",
        severity: "medium",
        indicatorWeight: 8,
        pillarWeight: 30,
        impactScore: 8 * 0.3,
      })
    }
  }

  // 19. Yield Curve (Weight: 10/100 in Pillar 1, but also 8/100 in Pillar 2)
  // Note: Yield Curve is in Pillar 1, but the risk appetite pillar also considers it.
  // We'll use Pillar 1's weight here as it's primarily a momentum/macro indicator.
  if (data.yieldCurve < -1.0) {
    canaries.push({
      signal: `Yield curve inverted ${Math.abs(data.yieldCurve).toFixed(2)}% - Deep inversion`,
      pillar: "Momentum & Technical",
      severity: "high",
      indicatorWeight: 10,
      pillarWeight: 35,
      impactScore: 10 * 0.35,
    })
  } else if (data.yieldCurve < -0.2) {
    canaries.push({
      signal: `Yield curve inverted ${Math.abs(data.yieldCurve).toFixed(2)}%`,
      pillar: "Momentum & Technical",
      severity: "medium",
      indicatorWeight: 10,
      pillarWeight: 35,
      impactScore: 10 * 0.35,
    })
  }

  // 20. S&P 500 P/E (Weight: 18/100 in Pillar 3)
  if (data.spxPE > 30) {
    canaries.push({
      signal: `S&P 500 P/E at ${data.spxPE.toFixed(1)} - Extreme overvaluation`,
      pillar: "Valuation & Market Structure",
      severity: "high",
      indicatorWeight: 18,
      pillarWeight: 15,
      impactScore: 18 * 0.15,
    })
  } else if (data.spxPE > 22) {
    canaries.push({
      signal: `S&P 500 P/E at ${data.spxPE.toFixed(1)} - Above historical average`,
      pillar: "Valuation & Market Structure",
      severity: "medium",
      indicatorWeight: 18,
      pillarWeight: 15,
      impactScore: 18 * 0.15,
    })
  }

  // 21. S&P 500 P/S (Weight: 12/100 in Pillar 3)
  if (data.spxPS > 3.5) {
    canaries.push({
      signal: `S&P 500 P/S at ${data.spxPS.toFixed(1)} - Extremely expensive`,
      pillar: "Valuation & Market Structure",
      severity: "high",
      indicatorWeight: 12,
      pillarWeight: 15,
      impactScore: 12 * 0.15,
    })
  } else if (data.spxPS > 2.5) {
    canaries.push({
      signal: `S&P 500 P/S at ${data.spxPS.toFixed(1)} - Elevated valuation`,
      pillar: "Valuation & Market Structure",
      severity: "medium",
      indicatorWeight: 12,
      pillarWeight: 15,
      impactScore: 12 * 0.15,
    })
  }

  // 22. Buffett Indicator (Weight: 16/100 in Pillar 3)
  const buffett = data.buffettIndicator || 180
  if (buffett > 200) {
    canaries.push({
      signal: `Buffett Indicator at ${buffett.toFixed(0)}% - Significantly overvalued`,
      pillar: "Valuation & Market Structure",
      severity: "high",
      indicatorWeight: 16,
      pillarWeight: 15,
      impactScore: 16 * 0.15,
    })
  } else if (buffett > 150) {
    canaries.push({
      signal: `Buffett Indicator at ${buffett.toFixed(0)}% - Above fair value`,
      pillar: "Valuation & Market Structure",
      severity: "medium",
      indicatorWeight: 16,
      pillarWeight: 15,
      impactScore: 16 * 0.15,
    })
  }

  // 23. Fed Funds Rate (Weight: 17/100 in Pillar 4)
  if (data.fedFundsRate > 6.0) {
    canaries.push({
      signal: `Fed Funds at ${data.fedFundsRate.toFixed(2)}% - Extremely restrictive`,
      pillar: "Macro",
      severity: "high",
      indicatorWeight: 17,
      pillarWeight: 20,
      impactScore: 17 * 0.2,
    })
  } else if (data.fedFundsRate > 5.0) {
    canaries.push({
      signal: `Fed Funds at ${data.fedFundsRate.toFixed(2)}% - Restrictive policy`,
      pillar: "Macro",
      severity: "medium",
      indicatorWeight: 17,
      pillarWeight: 20,
      impactScore: 17 * 0.2,
    })
  }

  // 24. Junk Spread (Weight: 12/100 in Pillar 4)
  if (data.junkSpread > 8) {
    canaries.push({
      signal: `Junk Bond Spread at ${data.junkSpread.toFixed(2)}% - Severe credit stress`,
      pillar: "Macro",
      severity: "high",
      indicatorWeight: 12,
      pillarWeight: 20,
      impactScore: 12 * 0.2,
    })
  } else if (data.junkSpread > 5) {
    canaries.push({
      signal: `Junk Bond Spread at ${data.junkSpread.toFixed(2)}% - Credit tightening`,
      pillar: "Macro",
      severity: "medium",
      indicatorWeight: 12,
      pillarWeight: 20,
      impactScore: 12 * 0.2,
    })
  }

  // 25. Debt-to-GDP (Weight: 11/100 in Pillar 4)
  if (data.debtToGDP > 130) {
    canaries.push({
      signal: `US Debt-to-GDP at ${data.debtToGDP.toFixed(0)}% - Fiscal crisis risk`,
      pillar: "Macro",
      severity: "high",
      indicatorWeight: 11,
      pillarWeight: 20,
      impactScore: 11 * 0.2,
    })
  } else if (data.debtToGDP > 110) {
    canaries.push({
      signal: `US Debt-to-GDP at ${data.debtToGDP.toFixed(0)}% - Elevated fiscal burden`,
      pillar: "Macro",
      severity: "medium",
      indicatorWeight: 11,
      pillarWeight: 20,
      impactScore: 11 * 0.2,
    })
  }

  // NVIDIA Momentum (Weight: 6/100 in Pillar 1)
  if (data.nvidiaMomentum < 20) {
    canaries.push({
      signal: `NVIDIA momentum at ${data.nvidiaMomentum} - AI sector weakness`,
      pillar: "Momentum & Technical",
      severity: "high",
      indicatorWeight: 6,
      pillarWeight: 35,
      impactScore: 6 * 0.35,
    })
  } else if (data.nvidiaMomentum < 40) {
    canaries.push({
      signal: `NVIDIA momentum at ${data.nvidiaMomentum} - Tech leadership fading`,
      pillar: "Momentum & Technical",
      severity: "medium",
      indicatorWeight: 6,
      pillarWeight: 35,
      impactScore: 6 * 0.35,
    })
  }

  // SOX Index (Weight: 6/100 in Pillar 1)
  const soxDeviation = ((data.soxIndex - 5000) / 5000) * 100
  if (soxDeviation < -15) {
    canaries.push({
      signal: `SOX down ${Math.abs(soxDeviation).toFixed(1)}% - Chip sector crash`,
      pillar: "Momentum & Technical",
      severity: "high",
      indicatorWeight: 6,
      pillarWeight: 35,
      impactScore: 6 * 0.35,
    })
  } else if (soxDeviation < -10) {
    canaries.push({
      signal: `SOX down ${Math.abs(soxDeviation).toFixed(1)}% - Semiconductor weakness`,
      pillar: "Momentum & Technical",
      severity: "medium",
      indicatorWeight: 6,
      pillarWeight: 35,
      impactScore: 6 * 0.35,
    })
  }

  // TED Spread (Weight: 15/100 in Pillar 4)
  if (data.tedSpread > 1.0) {
    canaries.push({
      signal: `TED Spread at ${data.tedSpread.toFixed(2)}% - Banking system stress`,
      pillar: "Macro",
      severity: "high",
      indicatorWeight: 15,
      pillarWeight: 20,
      impactScore: 15 * 0.2,
    })
  } else if (data.tedSpread > 0.5) {
    canaries.push({
      signal: `TED Spread at ${data.tedSpread.toFixed(2)}% - Credit market tension`,
      pillar: "Macro",
      severity: "medium",
      indicatorWeight: 15,
      pillarWeight: 20,
      impactScore: 15 * 0.2,
    })
  }

  // DXY Dollar Index (Weight: 14/100 in Pillar 4)
  if (data.dxyIndex > 115) {
    canaries.push({
      signal: `Dollar Index at ${data.dxyIndex.toFixed(1)} - Extreme dollar strength hurts tech`,
      pillar: "Macro",
      severity: "high",
      indicatorWeight: 14,
      pillarWeight: 20,
      impactScore: 14 * 0.2,
    })
  } else if (data.dxyIndex > 105) {
    canaries.push({
      signal: `Dollar Index at ${data.dxyIndex.toFixed(1)} - Strong dollar headwind`,
      pillar: "Macro",
      severity: "medium",
      indicatorWeight: 14,
      pillarWeight: 20,
      impactScore: 14 * 0.2,
    })
  }

  // ISM PMI (Weight: 18/100 in Pillar 4)
  if (data.ismPMI < 46) {
    canaries.push({
      signal: `ISM PMI at ${data.ismPMI.toFixed(1)} - Manufacturing contraction`,
      pillar: "Macro",
      severity: "high",
      indicatorWeight: 18,
      pillarWeight: 20,
      impactScore: 18 * 0.2,
    })
  } else if (data.ismPMI < 50) {
    canaries.push({
      signal: `ISM PMI at ${data.ismPMI.toFixed(1)} - Weak manufacturing`,
      pillar: "Macro",
      severity: "medium",
      indicatorWeight: 18,
      pillarWeight: 20,
      impactScore: 18 * 0.2,
    })
  }

  // Fed Reverse Repo (Weight: 13/100 in Pillar 4)
  if (data.fedReverseRepo > 2000) {
    canaries.push({
      signal: `Fed RRP at $${data.fedReverseRepo.toFixed(0)}B - Severe liquidity drain`,
      pillar: "Macro",
      severity: "high",
      indicatorWeight: 13,
      pillarWeight: 20,
      impactScore: 13 * 0.2,
    })
  } else if (data.fedReverseRepo > 1000) {
    canaries.push({
      signal: `Fed RRP at $${data.fedReverseRepo.toFixed(0)}B - Tight liquidity conditions`,
      pillar: "Macro",
      severity: "medium",
      indicatorWeight: 13,
      pillarWeight: 20,
      impactScore: 13 * 0.2,
    })
  }

  // QQQ P/E (Weight: 16/100 in Pillar 3)
  if (data.qqqPE > 40) {
    canaries.push({
      signal: `QQQ P/E at ${data.qqqPE.toFixed(1)} - AI bubble territory`,
      pillar: "Valuation & Market Structure",
      severity: "high",
      indicatorWeight: 16,
      pillarWeight: 15,
      impactScore: 16 * 0.15,
    })
  } else if (data.qqqPE > 30) {
    canaries.push({
      signal: `QQQ P/E at ${data.qqqPE.toFixed(1)} - Tech overvaluation`,
      pillar: "Valuation & Market Structure",
      severity: "medium",
      indicatorWeight: 16,
      pillarWeight: 15,
      impactScore: 16 * 0.15,
    })
  }

  // Mag7 Concentration (Weight: 15/100 in Pillar 3)
  if (data.mag7Concentration > 65) {
    canaries.push({
      signal: `Mag7 at ${data.mag7Concentration.toFixed(1)}% of QQQ - Extreme concentration risk`,
      pillar: "Valuation & Market Structure",
      severity: "high",
      indicatorWeight: 15,
      pillarWeight: 15,
      impactScore: 15 * 0.15,
    })
  } else if (data.mag7Concentration > 55) {
    canaries.push({
      signal: `Mag7 at ${data.mag7Concentration.toFixed(1)}% of QQQ - High concentration`,
      pillar: "Valuation & Market Structure",
      severity: "medium",
      indicatorWeight: 15,
      pillarWeight: 15,
      impactScore: 15 * 0.15,
    })
  }

  // Shiller CAPE (Weight: 13/100 in Pillar 3)
  if (data.shillerCAPE > 35) {
    canaries.push({
      signal: `Shiller CAPE at ${data.shillerCAPE.toFixed(1)} - Historic overvaluation`,
      pillar: "Valuation & Market Structure",
      severity: "high",
      indicatorWeight: 13,
      pillarWeight: 15,
      impactScore: 13 * 0.15,
    })
  } else if (data.shillerCAPE > 28) {
    canaries.push({
      signal: `Shiller CAPE at ${data.shillerCAPE.toFixed(1)} - Elevated cyclical valuation`,
      pillar: "Valuation & Market Structure",
      severity: "medium",
      indicatorWeight: 13,
      pillarWeight: 15,
      impactScore: 13 * 0.15,
    })
  }

  // Equity Risk Premium (Weight: 10/100 in Pillar 3)
  if (data.equityRiskPremium < 1.5) {
    canaries.push({
      signal: `Equity Risk Premium at ${data.equityRiskPremium.toFixed(2)}% - Stocks vs bonds severely overpriced`,
      pillar: "Valuation & Market Structure",
      severity: "high",
      indicatorWeight: 10,
      pillarWeight: 15,
      impactScore: 10 * 0.15,
    })
  } else if (data.equityRiskPremium < 3.0) {
    canaries.push({
      signal: `Equity Risk Premium at ${data.equityRiskPremium.toFixed(2)}% - Low compensation for equity risk`,
      pillar: "Valuation & Market Structure",
      severity: "medium",
      indicatorWeight: 10,
      pillarWeight: 15,
      impactScore: 10 * 0.15,
    })
  }

  return canaries.sort((a, b) => {
    // First sort by severity: high before medium
    if (a.severity === "high" && b.severity !== "high") return -1
    if (a.severity !== "high" && b.severity === "high") return 1

    // Within same severity, sort by impact score descending
    return b.impactScore - a.impactScore
  })
}
