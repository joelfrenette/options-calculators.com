import { NextResponse } from "next/server"
import { fetchMarketBreadth as fetchMarketBreadthData } from "@/lib/market-breadth"
import { fetchVIXTermStructure } from "@/lib/vix-term-structure"
import { fetchQQQTechnicals as fetchQQQTechnicalsData } from '@/lib/qqq-technicals'
import { 
  scrapeBuffettIndicator,
  scrapePutCallRatio,
  scrapeAAIISentiment,
  scrapeShortInterest
} from '@/lib/scraping-bee'
import { fetchApifyYahooFinance as fetchApifyYahooFinanceUtil } from '@/lib/apify-yahoo-finance'
import { 
  fetchShillerCAPEWithGrok,
  fetchShortInterestWithGrok,
  fetchMag7ConcentrationWithGrok,
  fetchQQQPEWithGrok
} from '@/lib/grok-market-data'

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
    // Fetch market data
    const data = await fetchMarketData()
    
    // Compute 4 new pillar scores
    const momentum = await computeMomentumPillar(data)      // NEW: Pillar 1 - Momentum & Technical (40%)
    const riskAppetite = await computeRiskAppetitePillar(data) // NEW: Pillar 2 - Risk Appetite (30%)
    const valuation = await computeValuationPillar(data)    // NEW: Pillar 3 - Valuation (20%)
    const macro = await computeMacroPillar(data)           // NEW: Pillar 4 - Macro (10%)
    
    let baseCCPI = Math.round(
      momentum * 0.35 +      // Updated from 0.40 to 0.35
      riskAppetite * 0.30 +
      valuation * 0.15 +     // Updated from 0.20 to 0.15
      macro * 0.20           // Updated from 0.10 to 0.20
    )
    
    const crashAmplifiers = calculateCrashAmplifiers(data)
    const finalCCPI = Math.min(100, baseCCPI + crashAmplifiers.totalBonus)
    
    console.log("[v0] CCPI v2.0 Calculation:")
    console.log("  Base CCPI:", baseCCPI)
    console.log("  Crash Amplifiers:", crashAmplifiers.bonuses)
    console.log("  Total Bonus:", crashAmplifiers.totalBonus)
    console.log("  Final CCPI:", finalCCPI)
    
    // Generate canary signals and other metadata
    const canaries = await generateCanarySignals(data)
    const confidence = computeCertaintyScore({ momentum, riskAppetite, valuation, macro }, data, canaries.length)
    const regime = determineRegime(finalCCPI, canaries.length)
    const playbook = getPlaybook(regime)
    const summary = generateWeeklySummary(finalCCPI, confidence, regime, { momentum, riskAppetite, valuation, macro }, data, canaries)
    
    return NextResponse.json({
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
        momentum,        // Pillar 1: 40% weight
        riskAppetite,   // Pillar 2: 30% weight
        valuation,      // Pillar 3: 20% weight
        macro           // Pillar 4: 10% weight
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
        equityRiskPremium: data.equityRiskPremium
      },
      canaries,
      activeCanaries: canaries.filter(c => c.severity === 'high' || c.severity === 'medium').length,
      totalIndicators: canaries.length, // Dynamic count based on actual canaries generated
      apiStatus: data.apiStatus,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("[v0] CCPI GET Error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

async function fetchMarketData() {
  const apiStatus: APIStatusTracker = {
    technical: { live: false, source: 'baseline', lastUpdated: new Date().toISOString() },
    vixTerm: { live: false, source: 'baseline', lastUpdated: new Date().toISOString() },
    fred: { live: false, source: 'baseline', lastUpdated: new Date().toISOString() },
    alphaVantage: { live: false, source: 'baseline', lastUpdated: new Date().toISOString() },
    apify: { live: false, source: 'baseline', lastUpdated: new Date().toISOString() },
    fearGreed: { live: false, source: 'baseline', lastUpdated: new Date().toISOString() },
    buffett: { live: false, source: 'baseline', lastUpdated: new Date().toISOString() },
    putCall: { live: false, source: 'baseline', lastUpdated: new Date().toISOString() },
    aaii: { live: false, source: 'baseline', lastUpdated: new Date().toISOString() },
    shortInterest: { live: false, source: 'baseline', lastUpdated: new Date().toISOString() }
  }
  
  const results = await Promise.allSettled([
    fetchQQQTechnicalsData(),
    fetchVIXTermStructure(),
    fetchFREDIndicators(),
    fetchAlphaVantageIndicators(),
    fetchApifyYahooFinanceUtil('SPY'),
    fetchApifyYahooFinanceUtil('QQQ'),
    fetchAAIISentiment(),
    scrapeBuffettIndicator(),
    scrapePutCallRatio(),
    scrapeAAIISentiment(),
    scrapeShortInterest(),
    // Fetch QQQ PE and Mag7 Concentration with Grok
    fetchQQQPEWithGrok(),
    fetchMag7ConcentrationWithGrok()
  ])
  
  const qqqData = results[0].status === 'fulfilled' ? results[0].value : null
  const vixTermData = results[1].status === 'fulfilled' ? results[1].value : null
  const fredData = results[2].status === 'fulfilled' ? results[2].value : null
  const alphaVantageData = results[3].status === 'fulfilled' ? results[3].value : null
  const apifyData = results[4].status === 'fulfilled' ? results[4].value : null
  const qqqFundamentals = results[5].status === 'fulfilled' ? results[5].value : null
  const sentimentData = results[6].status === 'fulfilled' ? results[6].value : null
  const buffettData = results[7].status === 'fulfilled' ? results[7].value : { ratio: 180, status: 'baseline' }
  const putCallData = results[8].status === 'fulfilled' ? results[8].value : { ratio: 0.95, status: 'baseline' }
  const aaiData = results[9].status === 'fulfilled' ? results[9].value : { bullish: 35, bearish: 30, neutral: 35, spread: 5, status: 'baseline' }
  const shortInterestData = results[10].status === 'fulfilled' ? results[10].value : { spyShortRatio: 2.5, status: 'baseline' }
  
  // Use Grok-fetched QQQ PE and Mag7 Concentration
  const qqqPE = results[11].status === 'fulfilled' ? results[11].value : null
  const mag7Concentration = results[12].status === 'fulfilled' ? results[12].value : null
  
  // Update API status
  apiStatus.technical = {
    live: qqqData?.source === 'live',
    source: qqqData?.source || 'baseline',
    lastUpdated: new Date().toISOString()
  }
  
  apiStatus.vixTerm = {
    live: vixTermData?.source === 'live',
    source: vixTermData?.source || 'baseline',
    lastUpdated: new Date().toISOString()
  }
  
  apiStatus.fred = {
    live: results[2].status === 'fulfilled',
    source: results[2].status === 'fulfilled' ? 'FRED API' : 'baseline',
    lastUpdated: new Date().toISOString()
  }
  
  apiStatus.alphaVantage = {
    live: results[3].status === 'fulfilled',
    source: results[3].status === 'fulfilled' ? 'Alpha Vantage API' : 'baseline',
    lastUpdated: new Date().toISOString()
  }
  
  apiStatus.apify = {
    live: apifyData?.dataSource && !apifyData.dataSource.includes('baseline'),
    source: apifyData?.dataSource || 'baseline',
    lastUpdated: new Date().toISOString()
  }
  
  apiStatus.fearGreed = {
    live: sentimentData?.dataSource && !sentimentData.dataSource.includes('baseline') && !sentimentData.dataSource.includes('failed'),
    source: sentimentData?.dataSource || 'baseline',
    lastUpdated: new Date().toISOString()
  }
  
  apiStatus.buffett = {
    live: buffettData.status === 'live',
    source: buffettData.status === 'live' ? 'ScrapingBee' : 'baseline',
    lastUpdated: new Date().toISOString()
  }
  
  apiStatus.putCall = {
    live: putCallData.status === 'live',
    source: putCallData.status === 'live' ? 'ScrapingBee' : 'baseline',
    lastUpdated: new Date().toISOString()
  }
  
  apiStatus.aaii = {
    live: aaiData.status === 'live',
    source: aaiData.status === 'live' ? 'ScrapingBee' : 'baseline',
    lastUpdated: new Date().toISOString()
  }
  
  apiStatus.shortInterest = {
    live: shortInterestData.status === 'live',
    source: shortInterestData.status === 'live' ? 'ScrapingBee' : 'baseline',
    lastUpdated: new Date().toISOString()
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
    
    // Volatility
    vix: alphaVantageData?.vix || 18,
    vxn: alphaVantageData?.vxn || 19,
    rvx: alphaVantageData?.rvx || 20,
    atr: alphaVantageData?.atr || 35,
    ltv: alphaVantageData?.ltv || 0.12,
    spotVol: alphaVantageData?.spotVol || 0.22,
    vixTermStructure: vixTermData?.termStructure || 1.5,
    vixTermInverted: vixTermData?.isInverted || false,
    highLowIndex: undefined,
    bullishPercent: 58,
    
    // Valuation
    spxPE: apifyData?.spxPE || 22.5,
    spxPS: apifyData?.spxPS || 2.8,
    qqqPE: qqqPE || qqqFundamentals?.data?.forwardPE || qqqFundamentals?.data?.trailingPE || 32,
    mag7Concentration: mag7Concentration || alphaVantageData?.mag7Concentration || 55,
    shillerCAPE: fredData?.shillerCAPE || 30,
    equityRiskPremium: calculateEquityRiskPremium(apifyData?.spxPE || 22.5, fredData?.yieldCurve10Y || 4.5),
    
    // Macro
    fedFundsRate: fredData?.fedFundsRate || 5.33,
    junkSpread: fredData?.junkSpread || 3.5,
    yieldCurve: fredData?.yieldCurve || 0.25,
    debtToGDP: fredData?.debtToGDP || 123, // Added Debt-to-GDP to data object
    
    // Sentiment
    putCallRatio: putCallData.ratio,
    fearGreedIndex: sentimentData?.fearGreed || null,
    etfFlows: apifyData?.etfFlows,
    shortInterest: shortInterestData.spyShortRatio,
    
    // AI Structural
    aiCapexGrowth: 40,
    aiRevenueGrowth: 15,
    gpuPricingPremium: 20,
    aiJobPostingsGrowth: -5,
    
    // New indicators
    buffettIndicator: buffettData.ratio,
    aaiiBullish: aaiData.bullish,
    aaiiBearish: aaiData.bearish,
    aaiiSpread: aaiData.spread,
    
    // Phase 1 indicators
    nvidiaPrice: fredData?.nvidiaPrice || 800,
    nvidiaMomentum: fredData?.nvidiaMomentum || 50,
    soxIndex: alphaVantageData?.soxIndex || 5000,
    tedSpread: fredData?.tedSpread || 0.25,
    dxyIndex: fredData?.dxyIndex || 103,
    ismPMI: fredData?.ismPMI || 48,
    fedReverseRepo: fredData?.fedReverseRepo || 450,
    
    apiStatus
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
      yieldCurve10Y: 4.5
    }
  }
  
  try {
    const baseUrl = 'https://api.stlouisfed.org/fred/series/observations'
    
    const [
      fedFundsRes, junkSpreadRes, yieldCurveRes, debtToGDPRes, tedSpreadRes, 
      dxyRes, ismRes, rrpRes, treasury10YRes
    ] = await Promise.all([
      fetch(`${baseUrl}?series_id=DFF&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${baseUrl}?series_id=BAMLH0A0HYM2&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${baseUrl}?series_id=T10Y2Y&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${baseUrl}?series_id=GFDEGDQ188S&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${baseUrl}?series_id=TEDRATE&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${baseUrl}?series_id=DTWEXBGS&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${baseUrl}?series_id=MANEMP&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${baseUrl}?series_id=RRPONTSYD&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${baseUrl}?series_id=DGS10&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, { signal: AbortSignal.timeout(10000) })
    ])
    
    const [
      fedFunds, junkSpread, yieldCurve, debtToGDP, tedSpread, 
      dxy, ism, rrp, treasury10Y
    ] = await Promise.all([
      fedFundsRes.json(),
      junkSpreadRes.json(),
      yieldCurveRes.json(),
      debtToGDPRes.json(),
      tedSpreadRes.json(),
      dxyRes.json(),
      ismRes.json(),
      rrpRes.json(),
      treasury10YRes.json()
    ])
    
    console.log("[v0] FRED: Attempting to fetch Shiller CAPE with Grok...")
    const shillerCAPE = await fetchShillerCAPEWithGrok()
    
    return {
      fedFundsRate: parseFloat(fedFunds.observations[0]?.value || '5.33'),
      junkSpread: parseFloat(junkSpread.observations[0]?.value || '3.5'),
      yieldCurve: parseFloat(yieldCurve.observations[0]?.value || '0.25'),
      debtToGDP: parseFloat(debtToGDP.observations[0]?.value || '123'),
      tedSpread: parseFloat(tedSpread.observations[0]?.value || '0.25'),
      dxyIndex: parseFloat(dxy.observations[0]?.value || '103'),
      ismPMI: parseFloat(ism.observations[0]?.value || '48'),
      fedReverseRepo: parseFloat(rrp.observations[0]?.value || '450'),
      shillerCAPE, // Use Grok-fetched value
      yieldCurve10Y: parseFloat(treasury10Y.observations[0]?.value || '4.5')
    }
  } catch (error) {
    console.error("[v0] FRED API error:", error)
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
      yieldCurve10Y: 4.5
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
      mag7Concentration: 55
    }
  }
  
  try {
    const [nvidiaRes, soxRes, aaplRes, msftRes, googlRes, amznRes, metaRes, tslaRes] = await Promise.all([
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=NVDA&apikey=${ALPHA_VANTAGE_API_KEY}`, { signal: AbortSignal.timeout(10000) }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SOXX&apikey=${ALPHA_VANTAGE_API_KEY}`, { signal: AbortSignal.timeout(10000) }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${ALPHA_VANTAGE_API_KEY}`, { signal: AbortSignal.timeout(10000) }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=MSFT&apikey=${ALPHA_VANTAGE_API_KEY}`, { signal: AbortSignal.timeout(10000) }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=GOOGL&apikey=${ALPHA_VANTAGE_API_KEY}`, { signal: AbortSignal.timeout(10000) }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AMZN&apikey=${ALPHA_VANTAGE_API_KEY}`, { signal: AbortSignal.timeout(10000) }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=META&apikey=${ALPHA_VANTAGE_API_KEY}`, { signal: AbortSignal.timeout(10000) }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=TSLA&apikey=${ALPHA_VANTAGE_API_KEY}`, { signal: AbortSignal.timeout(10000) })
    ])
    
    const [nvidiaData, soxData, aaplData, msftData, googlData, amznData, metaData, tslaData] = await Promise.all([
      nvidiaRes.json(),
      soxRes.json(),
      aaplRes.json(),
      msftRes.json(),
      googlRes.json(),
      amznRes.json(),
      metaRes.json(),
      tslaRes.json()
    ])
    
    const nvidiaPrice = parseFloat(nvidiaData?.['Global Quote']?.['05. price'] || '800')
    const nvidiaChange = parseFloat(nvidiaData?.['Global Quote']?.['09. change'] || '0')
    const nvidiaMomentum = nvidiaChange > 0 ? 100 : 0
    const soxIndex = parseFloat(soxData?.['Global Quote']?.['05. price'] || '5000')
    
    // This is a proxy based on stock price strength
    const mag7Avg = [aaplData, msftData, googlData, amznData, metaData, tslaData, nvidiaData]
      .map(d => parseFloat(d?.['Global Quote']?.['10. change percent']?.replace('%', '') || '0'))
      .reduce((a, b) => a + b, 0) / 7
    
    // Higher = more concentrated (using simplified proxy)
    const mag7Concentration = 55 + (mag7Avg > 0 ? 5 : -5)
    
    console.log(`[v0] Alpha Vantage Phase 2: NVDA=${nvidiaPrice}, SOX=${soxIndex}, Mag7=${mag7Concentration.toFixed(1)}%`)
    
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
      mag7Concentration
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
      mag7Concentration: 55
    }
  }
}

async function fetchApifyYahooFinance() {
  try {
    console.log("[v0] CCPI: Attempting to fetch from Apify Yahoo Finance...")
    
    const result = await fetchApifyYahooFinanceUtil('SPY')
    
    console.log(`[v0] CCPI: Apify data source: ${result.dataSource}`)
    if (result.actorUsed) {
      console.log(`[v0] CCPI: Successfully used actor: ${result.actorUsed}`)
    }
    
    if (!result.data) {
      console.warn("[v0] CCPI: Apify returned no data, using baseline")
      return {
        spxPE: 22.5,
        spxPS: 2.8,
        dataSource: result.dataSource || 'baseline-apify-no-data',
        etfFlows: -2.0
      }
    }
    
    const data = result.data
    
    return {
      spxPE: data.forwardPE || data.trailingPE || 22.5,
      spxPS: data.priceToSales || 2.8,
      dataSource: result.dataSource || 'apify-live',
      actorUsed: result.actorUsed,
      etfFlows: data.netInflows || -2.0,
      marketCap: data.marketCap,
      volume: data.volume,
      price: data.currentPrice
    }
  } catch (error) {
    console.error("[v0] CCPI: Apify fetch error:", error instanceof Error ? error.message : String(error))
    return {
      spxPE: 22.5,
      spxPS: 2.8,
      dataSource: 'baseline-apify-error',
      etfFlows: -2.0
    }
  }
}

async function fetchAAIISentiment() {
  try {
    const fgRes = await fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(10000) })
    if (fgRes.ok) {
      const fgData = await fgRes.json()
      if (fgData?.data?.[0]) {
        return {
          fearGreed: parseInt(fgData.data[0].value),
          dataSource: 'fear-greed-live'
        }
      }
    }
  } catch (error) {
    // Fall through to baseline
  }
  
  return {
    fearGreed: null,
    dataSource: 'baseline'
  }
}

async function computeMomentumPillar(data: Awaited<ReturnType<typeof fetchMarketData>>): Promise<number> {
  let score = 0
  
  // QQQ Daily Return (5× downside amplifier)
  if (data.qqqDailyReturn < -6) score += 50
  else if (data.qqqDailyReturn < -3) score += 35
  else if (data.qqqDailyReturn < -1.5) score += 20
  else if (data.qqqDailyReturn < -1) score += 10
  
  // QQQ Consecutive Down Days
  if (data.qqqConsecDown >= 5) score += 20
  else if (data.qqqConsecDown >= 3) score += 12
  else if (data.qqqConsecDown >= 2) score += 6
  
  // QQQ Below SMAs (trend breaks)
  if (data.qqqBelowSMA200) score += 25
  if (data.qqqBelowSMA50) score += 18
  if (data.qqqBelowSMA20) score += 12
  
  // SMA Proximity (approaching danger)
  score += (data.qqqSMA20Proximity / 100) * 8
  score += (data.qqqSMA50Proximity / 100) * 12
  score += (data.qqqSMA200Proximity / 100) * 15
  
  // Bollinger Band breach
  if (data.qqqBelowBollinger) score += 15
  score += (data.qqqBollingerProximity / 100) * 10
  
  // VIX (fear gauge)
  if (data.vix > 35) score += 30
  else if (data.vix > 25) score += 20
  else if (data.vix > 20) score += 12
  else if (data.vix > 15) score += 6
  
  // VXN (Nasdaq volatility)
  if (data.vxn > 35) score += 25
  else if (data.vxn > 25) score += 18
  else if (data.vxn > 20) score += 10
  
  // RVX (Russell volatility)
  if (data.rvx > 35) score += 20
  else if (data.rvx > 25) score += 12
  
  // VIX Term Structure (backwardation = immediate fear)
  if (data.vixTermInverted) score += 20
  else if (data.vixTermStructure < 0.8) score += 12
  else if (data.vixTermStructure < 1.2) score += 6
  
  // ATR (volatility expansion)
  if (data.atr > 50) score += 15
  else if (data.atr > 40) score += 10
  else if (data.atr > 30) score += 5
  
  // LTV (long-term volatility)
  if (data.ltv > 0.20) score += 12
  else if (data.ltv > 0.15) score += 8
  else if (data.ltv > 0.12) score += 4
  
  // Bullish Percent (overbought = danger)
  if (data.bullishPercent > 70) score += 15
  else if (data.bullishPercent > 60) score += 10
  else if (data.bullishPercent < 30) score += 5  // Oversold (contrarian)
  
  if (data.nvidiaMomentum > 80) score += 10
  else if (data.nvidiaMomentum < 20) score += 25  // Falling NVDA = tech crash risk
  
  // Comparing to historical baseline of 5000
  const soxDeviation = ((data.soxIndex - 5000) / 5000) * 100
  if (soxDeviation < -15) score += 30  // Major chip selloff
  else if (soxDeviation < -10) score += 20
  else if (soxDeviation < -5) score += 10
  
  console.log("[v0] Pillar 1 - Momentum & Technical (35% weight):", score)
  return Math.min(100, Math.max(0, score))
}

async function computeRiskAppetitePillar(data: Awaited<ReturnType<typeof fetchMarketData>>): Promise<number> {
  let score = 0
  
  // Put/Call Ratio (complacency = danger)
  if (data.putCallRatio < 0.6) score += 35  // Extreme complacency
  else if (data.putCallRatio < 0.7) score += 25
  else if (data.putCallRatio < 0.85) score += 15
  else if (data.putCallRatio > 1.3) score += 10  // Extreme fear (contrarian)
  
  // Fear & Greed Index
  if (data.fearGreedIndex !== null) {
    if (data.fearGreedIndex > 80) score += 25
    else if (data.fearGreedIndex > 75) score += 18
    else if (data.fearGreedIndex < 20) score += 12  // Contrarian
  }
  
  // AAII Sentiment (retail euphoria = danger)
  const aaiiBullish = data.aaiiBullish || 35
  if (aaiiBullish > 55) score += 30
  else if (aaiiBullish > 50) score += 22
  else if (aaiiBullish > 45) score += 12
  else if (aaiiBullish < 25) score += 8  // Contrarian
  
  // Short Interest (low = complacency)
  const shortInterest = data.shortInterest || 2.5
  if (shortInterest < 1.5) score += 30
  else if (shortInterest < 2.0) score += 20
  else if (shortInterest < 2.5) score += 10
  
  // Tech ETF Flows (outflows = danger)
  if (data.etfFlows !== undefined) {
    if (data.etfFlows < -3.0) score += 25
    else if (data.etfFlows < -1.5) score += 15
    else if (data.etfFlows < -0.5) score += 8
  }
  
  // Junk Bond Spread (credit stress)
  if (data.junkSpread > 10) score += 40
  else if (data.junkSpread > 8) score += 30
  else if (data.junkSpread > 6) score += 20
  else if (data.junkSpread > 5) score += 12
  else if (data.junkSpread > 3.5) score += 6
  
  // Yield Curve (moved from macro to risk appetite)
  if (data.yieldCurve < -1.0) score += 30
  else if (data.yieldCurve < -0.5) score += 22
  else if (data.yieldCurve < -0.2) score += 15
  else if (data.yieldCurve < 0) score += 10
  
  console.log("[v0] Pillar 2 - Risk Appetite & Volatility:", score)
  return Math.min(100, Math.max(0, score))
}

async function computeValuationPillar(data: Awaited<ReturnType<typeof fetchMarketData>>): Promise<number> {
  let score = 0
  
  // S&P 500 Forward P/E
  const peDeviation = (data.spxPE - 16) / 16
  if (data.spxPE > 30) score += 45
  else if (data.spxPE > 25) score += 35
  else if (data.spxPE > 22) score += 25
  else if (data.spxPE > 18) score += 15
  else score += Math.min(30, peDeviation * 80)
  
  // S&P 500 Price-to-Sales
  if (data.spxPS > 3.5) score += 30
  else if (data.spxPS > 3.0) score += 22
  else if (data.spxPS > 2.5) score += 15
  else if (data.spxPS > 2.0) score += 8
  
  // Buffett Indicator (Market Cap / GDP)
  const buffett = data.buffettIndicator || 180
  if (buffett > 200) score += 40
  else if (buffett > 180) score += 30
  else if (buffett > 150) score += 20
  else if (buffett > 120) score += 10
  
  
  // QQQ Forward P/E (AI-specific valuation)
  if (data.qqqPE > 40) score += 35
  else if (data.qqqPE > 35) score += 28
  else if (data.qqqPE > 30) score += 20
  else if (data.qqqPE > 25) score += 12
  
  // Magnificent 7 Concentration
  if (data.mag7Concentration > 65) score += 40
  else if (data.mag7Concentration > 60) score += 32
  else if (data.mag7Concentration > 55) score += 22
  else if (data.mag7Concentration > 50) score += 12
  
  // Shiller CAPE Ratio
  if (data.shillerCAPE > 35) score += 35
  else if (data.shillerCAPE > 30) score += 28
  else if (data.shillerCAPE > 25) score += 18
  else if (data.shillerCAPE > 20) score += 8
  
  // Equity Risk Premium (lower = more overvalued)
  if (data.equityRiskPremium < 1.5) score += 40
  else if (data.equityRiskPremium < 2.0) score += 32
  else if (data.equityRiskPremium < 3.0) score += 22
  else if (data.equityRiskPremium < 4.0) score += 10
  
  console.log("[v0] Pillar 3 - Valuation & Market Structure:", score)
  return Math.min(100, Math.max(0, score))
}

async function computeMacroPillar(data: Awaited<ReturnType<typeof fetchMarketData>>): Promise<number> {
  let score = 0
  
  // Fed Funds Rate (restrictive policy)
  if (data.fedFundsRate > 6.0) score += 40
  else if (data.fedFundsRate > 5.5) score += 32
  else if (data.fedFundsRate > 5.0) score += 25
  else if (data.fedFundsRate > 4.5) score += 18
  else if (data.fedFundsRate > 4.0) score += 12
  
  // US Debt-to-GDP
  if (data.debtToGDP > 130) score += 35
  else if (data.debtToGDP > 120) score += 28
  else if (data.debtToGDP > 110) score += 20
  else if (data.debtToGDP > 100) score += 12
  
  if (data.tedSpread > 1.0) score += 40  // Extreme banking stress
  else if (data.tedSpread > 0.75) score += 30
  else if (data.tedSpread > 0.50) score += 20
  else if (data.tedSpread > 0.35) score += 10
  
  if (data.dxyIndex > 115) score += 35  // Very strong dollar
  else if (data.dxyIndex > 110) score += 28
  else if (data.dxyIndex > 105) score += 20
  else if (data.dxyIndex > 100) score += 10
  
  if (data.ismPMI < 42) score += 40  // Deep contraction
  else if (data.ismPMI < 46) score += 30
  else if (data.ismPMI < 50) score += 20  // Contraction
  else if (data.ismPMI < 52) score += 5
  
  // High RRP = tight liquidity
  if (data.fedReverseRepo > 2000) score += 30  // Extreme liquidity drain
  else if (data.fedReverseRepo > 1500) score += 22
  else if (data.fedReverseRepo > 1000) score += 15
  else if (data.fedReverseRepo > 500) score += 8
  
  console.log("[v0] Pillar 4 - Macro Economic (20% weight):", score)
  return Math.min(100, Math.max(0, score))
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
    bonuses.push({ reason: `QQQ crashed ${Math.abs(data.qqqDailyReturn).toFixed(1)}% in one day (EXTREME)`, points: 40 })
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

function computeCertaintyScore(pillars: Record<string, number>, data: Awaited<ReturnType<typeof fetchMarketData>>, canaryCount: number): number {
  const values = Object.values(pillars)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  
  const varianceAlignment = Math.max(0, 100 - (stdDev * 3.0))
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
      alternatives: "5-10%"
    }
  }
}

function generateWeeklySummary(
  ccpi: number,
  confidence: number,
  regime: ReturnType<typeof determineRegime>,
  pillars: Record<string, number>,
  data: Awaited<ReturnType<typeof fetchMarketData>>,
  canaries: Array<{ signal: string; pillar: string; severity: "high" | "medium" | "low" }>
) {
  return {
    headline: `CCPI at ${ccpi} with ${confidence}% confidence`,
    bullets: [
      `Momentum pillar at ${pillars.momentum}/100`,
      `Risk Appetite pillar at ${pillars.riskAppetite}/100`,
      `${canaries.length} active warning signals`
    ]
  }
}

async function generateCanarySignals(data: Awaited<ReturnType<typeof fetchMarketData>>) {
  const canaries: Array<{ signal: string; pillar: string; severity: "high" | "medium" | "low" }> = []
  
  
  // 1. QQQ Daily Return
  if (data.qqqDailyReturn <= -6) {
    canaries.push({ signal: `QQQ crashed ${Math.abs(data.qqqDailyReturn).toFixed(1)}% - Momentum loss`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.qqqDailyReturn <= -3) {
    canaries.push({ signal: `QQQ dropped ${Math.abs(data.qqqDailyReturn).toFixed(1)}% - Sharp decline`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 2. QQQ Consecutive Down Days
  if (data.qqqConsecDown >= 5) {
    canaries.push({ signal: `${data.qqqConsecDown} consecutive down days - Trend break`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.qqqConsecDown >= 3) {
    canaries.push({ signal: `${data.qqqConsecDown} consecutive down days`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 3. QQQ Below 20-Day SMA
  if (data.qqqBelowSMA20 && data.qqqSMA20Proximity >= 100) {
    canaries.push({ signal: "QQQ breached 20-day SMA - Short-term support lost", pillar: "Momentum & Technical", severity: "high" })
  } else if (data.qqqSMA20Proximity >= 50) {
    canaries.push({ signal: `QQQ approaching 20-day SMA (${data.qqqSMA20Proximity.toFixed(0)}% proximity)`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 4. QQQ Below 50-Day SMA
  if (data.qqqBelowSMA50 && data.qqqSMA50Proximity >= 100) {
    canaries.push({ signal: "QQQ breached 50-day SMA - Medium-term trend broken", pillar: "Momentum & Technical", severity: "high" })
  } else if (data.qqqSMA50Proximity >= 50) {
    canaries.push({ signal: `QQQ approaching 50-day SMA (${data.qqqSMA50Proximity.toFixed(0)}% proximity)`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 5. QQQ Below 200-Day SMA
  if (data.qqqBelowSMA200 && data.qqqSMA200Proximity >= 100) {
    canaries.push({ signal: "QQQ breached 200-day SMA - Long-term bull market in question", pillar: "Momentum & Technical", severity: "high" })
  } else if (data.qqqSMA200Proximity >= 50) {
    canaries.push({ signal: `QQQ approaching 200-day SMA (${data.qqqSMA200Proximity.toFixed(0)}% proximity)`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 6. QQQ Below Bollinger Band
  if (data.qqqBelowBollinger && data.qqqBollingerProximity >= 100) {
    canaries.push({ signal: "QQQ breached lower Bollinger Band - Oversold territory", pillar: "Momentum & Technical", severity: "high" })
  } else if (data.qqqBollingerProximity >= 50) {
    canaries.push({ signal: `QQQ approaching Bollinger Band (${data.qqqBollingerProximity.toFixed(0)}% proximity)`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 7. VIX (Fear Gauge)
  if (data.vix > 35) {
    canaries.push({ signal: `VIX at ${data.vix.toFixed(1)} - Extreme fear`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.vix > 25) {
    canaries.push({ signal: `VIX at ${data.vix.toFixed(1)} - Elevated fear`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 8. VXN (Nasdaq Volatility)
  if (data.vxn > 35) {
    canaries.push({ signal: `VXN at ${data.vxn.toFixed(1)} - Nasdaq panic`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.vxn > 25) {
    canaries.push({ signal: `VXN at ${data.vxn.toFixed(1)} - Nasdaq volatility elevated`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 9. RVX (Russell 2000 Volatility)
  if (data.rvx > 35) {
    canaries.push({ signal: `RVX at ${data.rvx.toFixed(1)} - Small-cap stress`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.rvx > 25) {
    canaries.push({ signal: `RVX at ${data.rvx.toFixed(1)} - Small-cap volatility rising`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 10. VIX Term Structure
  if (data.vixTermInverted || data.vixTermStructure < 0.8) {
    canaries.push({ signal: `VIX term structure inverted (${data.vixTermStructure.toFixed(2)}) - Immediate fear`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.vixTermStructure < 1.2) {
    canaries.push({ signal: `VIX term structure flattening (${data.vixTermStructure.toFixed(2)})`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 11. ATR - Average True Range
  if (data.atr > 50) {
    canaries.push({ signal: `ATR at ${data.atr.toFixed(1)} - Extreme volatility`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.atr > 40) {
    canaries.push({ signal: `ATR at ${data.atr.toFixed(1)} - Elevated volatility`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 12. LTV - Long-term Volatility
  if (data.ltv > 0.20) {
    canaries.push({ signal: `Long-term volatility at ${(data.ltv * 100).toFixed(1)}% - Sustained instability`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.ltv > 0.15) {
    canaries.push({ signal: `Long-term volatility at ${(data.ltv * 100).toFixed(1)}% - Rising`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 13. Bullish Percent Index
  if (data.bullishPercent > 70) {
    canaries.push({ signal: `Bullish Percent at ${data.bullishPercent}% - Overbought danger`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.bullishPercent > 60) {
    canaries.push({ signal: `Bullish Percent at ${data.bullishPercent}% - Elevated optimism`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  
  // 14. Put/Call Ratio
  if (data.putCallRatio < 0.6) {
    canaries.push({ signal: `Put/Call at ${data.putCallRatio.toFixed(2)} - Extreme complacency`, pillar: "Risk Appetite & Volatility", severity: "high" })
  } else if (data.putCallRatio < 0.85) {
    canaries.push({ signal: `Put/Call at ${data.putCallRatio.toFixed(2)} - Low hedging activity`, pillar: "Risk Appetite & Volatility", severity: "medium" })
  }
  
  // 15. Fear & Greed Index
  if (data.fearGreedIndex !== null) {
    if (data.fearGreedIndex > 80) {
      canaries.push({ signal: `Fear & Greed at ${data.fearGreedIndex} - Extreme greed`, pillar: "Risk Appetite & Volatility", severity: "high" })
    } else if (data.fearGreedIndex > 70) {
      canaries.push({ signal: `Fear & Greed at ${data.fearGreedIndex} - Elevated greed`, pillar: "Risk Appetite & Volatility", severity: "medium" })
    }
  }
  
  // 16. AAII Bullish Sentiment
  const aaiiBullish = data.aaiiBullish || 35
  if (aaiiBullish > 55) {
    canaries.push({ signal: `AAII Bullish at ${aaiiBullish}% - Retail euphoria`, pillar: "Risk Appetite & Volatility", severity: "high" })
  } else if (aaiiBullish > 45) {
    canaries.push({ signal: `AAII Bullish at ${aaiiBullish}% - Elevated retail optimism`, pillar: "Risk Appetite & Volatility", severity: "medium" })
  }
  
  // 17. SPY Short Interest Ratio
  const shortInterest = data.shortInterest || 2.5
  if (shortInterest < 1.5) {
    canaries.push({ signal: `Short Interest at ${shortInterest.toFixed(1)}% - Extreme complacency`, pillar: "Risk Appetite & Volatility", severity: "high" })
  } else if (shortInterest < 2.5) {
    canaries.push({ signal: `Short Interest at ${shortInterest.toFixed(1)}% - Low positioning`, pillar: "Risk Appetite & Volatility", severity: "medium" })
  }
  
  // 18. Tech ETF Flows
  if (data.etfFlows !== undefined) {
    if (data.etfFlows < -3.0) {
      canaries.push({ signal: `ETF outflows at $${Math.abs(data.etfFlows).toFixed(1)}B - Capital flight`, pillar: "Risk Appetite & Volatility", severity: "high" })
    } else if (data.etfFlows < -1.5) {
      canaries.push({ signal: `ETF outflows at $${Math.abs(data.etfFlows).toFixed(1)}B - Selling pressure`, pillar: "Risk Appetite & Volatility", severity: "medium" })
    }
  }
  
  // 19. Yield Curve (10Y-2Y)
  if (data.yieldCurve < -1.0) {
    canaries.push({ signal: `Yield curve inverted ${Math.abs(data.yieldCurve).toFixed(2)}% - Deep inversion`, pillar: "Risk Appetite & Volatility", severity: "high" })
  } else if (data.yieldCurve < -0.2) {
    canaries.push({ signal: `Yield curve inverted ${Math.abs(data.yieldCurve).toFixed(2)}%`, pillar: "Risk Appetite & Volatility", severity: "medium" })
  }
  
  
  // 20. S&P 500 Forward P/E
  if (data.spxPE > 30) {
    canaries.push({ signal: `S&P 500 P/E at ${data.spxPE.toFixed(1)} - Extreme overvaluation`, pillar: "Valuation & Market Structure", severity: "high" })
  } else if (data.spxPE > 22) {
    canaries.push({ signal: `S&P 500 P/E at ${data.spxPE.toFixed(1)} - Above historical average`, pillar: "Valuation & Market Structure", severity: "medium" })
  }
  
  // 21. S&P 500 Price-to-Sales
  if (data.spxPS > 3.5) {
    canaries.push({ signal: `S&P 500 P/S at ${data.spxPS.toFixed(1)} - Extremely expensive`, pillar: "Valuation & Market Structure", severity: "high" })
  } else if (data.spxPS > 2.5) {
    canaries.push({ signal: `S&P 500 P/S at ${data.spxPS.toFixed(1)} - Elevated valuation`, pillar: "Valuation & Market Structure", severity: "medium" })
  }
  
  // 22. Buffett Indicator (Market Cap / GDP)
  const buffett = data.buffettIndicator || 180
  if (buffett > 200) {
    canaries.push({ signal: `Buffett Indicator at ${buffett.toFixed(0)}% - Significantly overvalued`, pillar: "Valuation & Market Structure", severity: "high" })
  } else if (buffett > 150) {
    canaries.push({ signal: `Buffett Indicator at ${buffett.toFixed(0)}% - Above fair value`, pillar: "Valuation & Market Structure", severity: "medium" })
  }
  
  
  // 23. Fed Funds Rate
  if (data.fedFundsRate > 6.0) {
    canaries.push({ signal: `Fed Funds at ${data.fedFundsRate.toFixed(2)}% - Extremely restrictive`, pillar: "Macro", severity: "high" })
  } else if (data.fedFundsRate > 5.0) {
    canaries.push({ signal: `Fed Funds at ${data.fedFundsRate.toFixed(2)}% - Restrictive policy`, pillar: "Macro", severity: "medium" })
  }
  
  // 24. Junk Bond Spread
  if (data.junkSpread > 8) {
    canaries.push({ signal: `Junk Bond Spread at ${data.junkSpread.toFixed(2)}% - Severe credit stress`, pillar: "Macro", severity: "high" })
  } else if (data.junkSpread > 5) {
    canaries.push({ signal: `Junk Bond Spread at ${data.junkSpread.toFixed(2)}% - Credit tightening`, pillar: "Macro", severity: "medium" })
  }
  
  // 25. US Debt-to-GDP Ratio
  if (data.debtToGDP > 130) {
    canaries.push({ signal: `US Debt-to-GDP at ${data.debtToGDP.toFixed(0)}% - Fiscal crisis risk`, pillar: "Macro", severity: "high" })
  } else if (data.debtToGDP > 110) {
    canaries.push({ signal: `US Debt-to-GDP at ${data.debtToGDP.toFixed(0)}% - Elevated fiscal burden`, pillar: "Macro", severity: "medium" })
  }
  
  
  // NVIDIA Momentum (Pillar 1)
  if (data.nvidiaMomentum < 20) {
    canaries.push({ signal: `NVIDIA momentum at ${data.nvidiaMomentum} - AI sector weakness`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.nvidiaMomentum < 40) {
    canaries.push({ signal: `NVIDIA momentum at ${data.nvidiaMomentum} - Tech leadership fading`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // SOX Semiconductor Index (Pillar 1)
  const soxDeviation = ((data.soxIndex - 5000) / 5000) * 100
  if (soxDeviation < -15) {
    canaries.push({ signal: `SOX down ${Math.abs(soxDeviation).toFixed(1)}% - Chip sector crash`, pillar: "Momentum & Technical", severity: "high" })
  } else if (soxDeviation < -10) {
    canaries.push({ signal: `SOX down ${Math.abs(soxDeviation).toFixed(1)}% - Semiconductor weakness`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // TED Spread (Pillar 4)
  if (data.tedSpread > 1.0) {
    canaries.push({ signal: `TED Spread at ${data.tedSpread.toFixed(2)}% - Banking system stress`, pillar: "Macro", severity: "high" })
  } else if (data.tedSpread > 0.50) {
    canaries.push({ signal: `TED Spread at ${data.tedSpread.toFixed(2)}% - Credit market tension`, pillar: "Macro", severity: "medium" })
  }
  
  // DXY Dollar Index (Pillar 4)
  if (data.dxyIndex > 115) {
    canaries.push({ signal: `Dollar Index at ${data.dxyIndex.toFixed(1)} - Extreme dollar strength hurts tech`, pillar: "Macro", severity: "high" })
  } else if (data.dxyIndex > 105) {
    canaries.push({ signal: `Dollar Index at ${data.dxyIndex.toFixed(1)} - Strong dollar headwind`, pillar: "Macro", severity: "medium" })
  }
  
  // ISM PMI (Pillar 4)
  if (data.ismPMI < 46) {
    canaries.push({ signal: `ISM PMI at ${data.ismPMI.toFixed(1)} - Manufacturing contraction`, pillar: "Macro", severity: "high" })
  } else if (data.ismPMI < 50) {
    canaries.push({ signal: `ISM PMI at ${data.ismPMI.toFixed(1)} - Weak manufacturing`, pillar: "Macro", severity: "medium" })
  }
  
  // Fed Reverse Repo (Pillar 4)
  if (data.fedReverseRepo > 2000) {
    canaries.push({ signal: `Fed RRP at $${data.fedReverseRepo.toFixed(0)}B - Severe liquidity drain`, pillar: "Macro", severity: "high" })
  } else if (data.fedReverseRepo > 1000) {
    canaries.push({ signal: `Fed RRP at $${data.fedReverseRepo.toFixed(0)}B - Tight liquidity conditions`, pillar: "Macro", severity: "medium" })
  }
  
  
  // QQQ P/E Ratio
  if (data.qqqPE > 40) {
    canaries.push({ signal: `QQQ P/E at ${data.qqqPE.toFixed(1)} - AI bubble territory`, pillar: "Valuation & Market Structure", severity: "high" })
  } else if (data.qqqPE > 30) {
    canaries.push({ signal: `QQQ P/E at ${data.qqqPE.toFixed(1)} - Tech overvaluation`, pillar: "Valuation & Market Structure", severity: "medium" })
  }
  
  // Mag7 Concentration
  if (data.mag7Concentration > 65) {
    canaries.push({ signal: `Mag7 at ${data.mag7Concentration.toFixed(1)}% of QQQ - Extreme concentration risk`, pillar: "Valuation & Market Structure", severity: "high" })
  } else if (data.mag7Concentration > 55) {
    canaries.push({ signal: `Mag7 at ${data.mag7Concentration.toFixed(1)}% of QQQ - High concentration`, pillar: "Valuation & Market Structure", severity: "medium" })
  }
  
  // Shiller CAPE
  if (data.shillerCAPE > 35) {
    canaries.push({ signal: `Shiller CAPE at ${data.shillerCAPE.toFixed(1)} - Historic overvaluation`, pillar: "Valuation & Market Structure", severity: "high" })
  } else if (data.shillerCAPE > 28) {
    canaries.push({ signal: `Shiller CAPE at ${data.shillerCAPE.toFixed(1)} - Elevated cyclical valuation`, pillar: "Valuation & Market Structure", severity: "medium" })
  }
  
  // Equity Risk Premium
  if (data.equityRiskPremium < 1.5) {
    canaries.push({ signal: `Equity Risk Premium at ${data.equityRiskPremium.toFixed(2)}% - Stocks vs bonds severely overpriced`, pillar: "Valuation & Market Structure", severity: "high" })
  } else if (data.equityRiskPremium < 3.0) {
    canaries.push({ signal: `Equity Risk Premium at ${data.equityRiskPremium.toFixed(2)}% - Low compensation for equity risk`, pillar: "Valuation & Market Structure", severity: "medium" })
  }
  
  return canaries
}
