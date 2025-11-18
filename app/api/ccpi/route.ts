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
    console.log("[v0] CCPI: Starting data fetch...")
    
    // Fetch market data
    const data = await fetchMarketData()
    console.log("[v0] CCPI: Market data fetched successfully")
    
    // Compute 4 new pillar scores
    console.log("[v0] CCPI: Computing pillars...")
    const momentum = await computeMomentumPillar(data)      // NEW: Pillar 1 - Momentum & Technical (40%)
    const riskAppetite = await computeRiskAppetitePillar(data) // NEW: Pillar 2 - Risk Appetite (30%)
    const valuation = await computeValuationPillar(data)    // NEW: Pillar 3 - Valuation (20%)
    const macro = await computeMacroPillar(data)           // NEW: Pillar 4 - Macro (10%)
    console.log("[v0] CCPI: Pillars computed successfully")
    
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
  const apifySpyData = results[4].status === 'fulfilled' ? results[4].value : null // Renamed for clarity
  const apifyQqqData = results[5].status === 'fulfilled' ? results[5].value : null // Renamed for clarity
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
    live: (apifySpyData?.dataSource && !apifySpyData.dataSource.includes('baseline')) || (apifyQqqData?.dataSource && !apifyQqqData.dataSource.includes('baseline')),
    source: apifySpyData?.dataSource || apifyQqqData?.dataSource || 'baseline',
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
    highLowIndex: undefined, // Not fetched
    bullishPercent: 58, // Baseline
    
    // Valuation
    spxPE: apifySpyData?.spxPE || 22.5,
    spxPS: apifySpyData?.spxPS || 2.8,
    qqqPE: qqqPE || apifyQqqData?.data?.forwardPE || apifyQqqData?.data?.trailingPE || 32,
    mag7Concentration: mag7Concentration || alphaVantageData?.mag7Concentration || 55,
    shillerCAPE: fredData?.shillerCAPE || 30,
    equityRiskPremium: calculateEquityRiskPremium(apifySpyData?.spxPE || 22.5, fredData?.yieldCurve10Y || 4.5),
    
    // Macro
    fedFundsRate: fredData?.fedFundsRate || 5.33,
    junkSpread: fredData?.junkSpread || 3.5,
    yieldCurve: fredData?.yieldCurve || 0.25,
    debtToGDP: fredData?.debtToGDP || 123, // Added Debt-to-GDP to data object
    
    // Sentiment
    putCallRatio: putCallData.ratio,
    fearGreedIndex: sentimentData?.fearGreed || null,
    etfFlows: apifySpyData?.etfFlows, // Using SPY ETF flows
    shortInterest: shortInterestData.spyShortRatio,
    
    // AI Structural
    aiCapexGrowth: 40, // Baseline
    aiRevenueGrowth: 15, // Baseline
    gpuPricingPremium: 20, // Baseline
    aiJobPostingsGrowth: -5, // Baseline
    
    // New indicators
    buffettIndicator: buffettData.ratio,
    aaiiBullish: aaiData.bullish,
    aaiiBearish: aaiData.bearish,
    aaiiSpread: aaiData.spread,
    
    // Phase 1 indicators
    nvidiaPrice: alphaVantageData?.nvidiaPrice || 800, // Fetch from AlphaVantage
    nvidiaMomentum: alphaVantageData?.nvidiaMomentum || 50, // Fetch from AlphaVantage
    soxIndex: alphaVantageData?.soxIndex || 5000, // Fetch from AlphaVantage
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
    console.warn("[v0] FRED_API_KEY not set. Using baseline FRED data.")
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
    const shillerCAPE = await fetchShillerCAPEWithGrok() // Still try to fetch this if FRED fails
    
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
    console.warn("[v0] ALPHA_VANTAGE_API_KEY not set. Using baseline Alpha Vantage data.")
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
    // Fetch individual MAG7 components and SOXX/NVDA for their prices and changes
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

    // Handle potential API errors by checking the response structure
    const parseQuote = (data: any, symbol: string, defaultValue: any) => {
      if (data && data['Global Quote'] && Object.keys(data['Global Quote']).length > 0) {
        return data['Global Quote']
      } else {
        console.warn(`[v0] Alpha Vantage: Failed to parse GLOBAL_QUOTE for ${symbol}. Using baseline.`, data)
        return null
      }
    }

    const nvidiaQuote = parseQuote(nvidiaData, 'NVDA', {})
    const soxQuote = parseQuote(soxData, 'SOXX', {})
    const aaplQuote = parseQuote(aaplData, 'AAPL', {})
    const msftQuote = parseQuote(msftData, 'MSFT', {})
    const googlQuote = parseQuote(googlData, 'GOOGL', {})
    const amznQuote = parseQuote(amznData, 'AMZN', {})
    const metaQuote = parseQuote(metaData, 'META', {})
    const tslaQuote = parseQuote(tslaData, 'TSLA', {})

    const nvidiaPrice = parseFloat(nvidiaQuote?.['05. price'] || '800')
    const nvidiaChangePercent = parseFloat(nvidiaQuote?.['10. change percent']?.replace('%', '') || '0')
    // Simple momentum: 100 if positive change, 0 if negative (can be improved)
    const nvidiaMomentum = nvidiaChangePercent > 0 ? 100 : (nvidiaChangePercent < 0 ? 0 : 50) 
    const soxIndex = parseFloat(soxQuote?.['05. price'] || '5000')
    
    const mag7Components = [aaplQuote, msftQuote, googlQuote, amznQuote, metaQuote, tslaQuote, nvidiaQuote]
    
    // Calculate average change percent for MAG7 (excluding NVDA for this calculation if it's handled separately)
    const mag7AvgChangePercent = mag7Components
      .filter(q => q !== null) // Ensure quote exists
      .map(q => parseFloat(q?.['10. change percent']?.replace('%', '') || '0'))
      .reduce((a, b) => a + b, 0) / mag7Components.filter(q => q !== null).length;
    
    // This is a proxy based on stock price strength.
    // A higher value means more stocks in MAG7 are performing well relative to the index.
    // We'll use a baseline and adjust. This needs more rigorous definition.
    // For now, let's say if mag7AvgChangePercent is positive, concentration is slightly higher, if negative, slightly lower.
    // This is a weak proxy and ideally should be market cap weighted.
    const mag7Concentration = 55 + (mag7AvgChangePercent > 0.5 ? 5 : (mag7AvgChangePercent < -0.5 ? -5 : 0));
    
    console.log(`[v0] Alpha Vantage Phase 2: NVDA=${nvidiaPrice}, SOX=${soxIndex}, Mag7 Avg Change=${mag7AvgChangePercent.toFixed(2)}%, Mag7 Concentration Proxy=${mag7Concentration.toFixed(1)}%`)
    
    return {
      // These are placeholders, actual VIX, VXN, etc., should ideally come from a dedicated source or other APIs.
      // Alpha Vantage has VIX, but it's often delayed or requires a different call.
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
    
    // Fetch data for SPY (as before)
    const spyResult = await fetchApifyYahooFinanceUtil('SPY')
    
    console.log(`[v0] CCPI: Apify SPY data source: ${spyResult.dataSource}`)
    if (spyResult.actorUsed) {
      console.log(`[v0] CCPI: SPY Apify successfully used actor: ${spyResult.actorUsed}`)
    }
    
    let spyData = {
      spxPE: 22.5,
      spxPS: 2.8,
      dataSource: spyResult.dataSource || 'baseline-apify-no-data-spy',
      etfFlows: -2.0 // Default value
    };
    
    if (spyResult.data) {
      spyData = {
        spxPE: spyResult.data.forwardPE || spyResult.data.trailingPE || 22.5,
        spxPS: spyResult.data.priceToSales || 2.8,
        dataSource: spyResult.dataSource || 'apify-live-spy',
        actorUsed: spyResult.actorUsed,
        etfFlows: spyResult.data.netInflows || -2.0,
        marketCap: spyResult.data.marketCap,
        volume: spyResult.data.volume,
        price: spyResult.data.currentPrice
      };
    } else {
      console.warn("[v0] CCPI: Apify returned no data for SPY, using baseline.")
    }
    
    // Fetch data for QQQ as well
    const qqqResult = await fetchApifyYahooFinanceUtil('QQQ')
    console.log(`[v0] CCPI: Apify QQQ data source: ${qqqResult.dataSource}`)
    if (qqqResult.actorUsed) {
      console.log(`[v0] CCPI: QQQ Apify successfully used actor: ${qqqResult.actorUsed}`)
    }

    let qqqData = {
      forwardPE: 32, // Default value
      trailingPE: 32, // Default value
      dataSource: qqqResult.dataSource || 'baseline-apify-no-data-qqq',
    };

    if (qqqResult.data) {
      qqqData = {
        forwardPE: qqqResult.data.forwardPE || 32,
        trailingPE: qqqResult.data.trailingPE || 32,
        dataSource: qqqResult.dataSource || 'apify-live-qqq',
        actorUsed: qqqResult.actorUsed,
      };
    } else {
      console.warn("[v0] CCPI: Apify returned no data for QQQ, using baseline.")
    }

    return {
      ...spyData, // Includes spxPE, spxPS, etfFlows, dataSource for SPY
      qqqData,    // Includes qqqPE (forwardPE/trailingPE) for QQQ
    };
    
  } catch (error) {
    console.error("[v0] CCPI: Apify fetch error:", error instanceof Error ? error.message : String(error))
    return {
      spxPE: 22.5,
      spxPS: 2.8,
      dataSource: 'baseline-apify-error',
      etfFlows: -2.0,
      qqqData: { forwardPE: 32, trailingPE: 32, dataSource: 'baseline-apify-error' }
    }
  }
}

async function fetchAAIISentiment() {
  try {
    // Attempt to fetch Fear & Greed Index first
    const fgRes = await fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(10000) })
    if (fgRes.ok) {
      const fgData = await fgRes.json()
      if (fgData?.data?.[0]) {
        // Successfully fetched Fear & Greed
        return {
          fearGreed: parseInt(fgData.data[0].value),
          dataSource: 'fear-greed-live'
        }
      }
    }
  } catch (error) {
    console.warn("[v0] Failed to fetch Fear & Greed Index:", error)
    // Fall through to baseline if Fear & Greed fails
  }
  
  // If Fear & Greed failed or returned no data, try to fetch AAII data directly
  try {
    const aaiiRes = await fetch('https://api.aaii.com/v1/sentimentsurvey/latest?format=json', { // Example URL, may need actual API key/endpoint
      headers: {
        'Authorization': `Bearer ${process.env.AAII_API_KEY}` // Assuming an API key is needed
      },
      signal: AbortSignal.timeout(10000) 
    });
    
    if (aaiiRes.ok) {
      const aaiiData = await aaiiRes.json();
      if (aaiiData?.data?.[0]) {
        return {
          fearGreed: null, // Not fetched
          fearGreedDataSource: 'baseline',
          aaiiBullish: aaiiData.data[0].bullishPercentage,
          aaiiBearish: aaiiData.data[0].bearishPercentage,
          aaiiSpread: aaiiData.data[0].bullishPercentage - aaiiData.data[0].bearishPercentage,
          dataSource: 'aaii-live',
          status: 'live' // Add status for clarity
        };
      }
    }
  } catch (error) {
    console.warn("[v0] Failed to fetch AAII Sentiment:", error)
  }

  // If both fail, return baseline
  return {
    fearGreed: null,
    dataSource: 'baseline',
    aaiiBullish: 35, // Baseline values
    aaiiBearish: 30,
    aaiiSpread: 5,
    status: 'baseline'
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
  
  // NVIDIA Momentum (new indicator)
  if (data.nvidiaMomentum > 80) score += 10
  else if (data.nvidiaMomentum < 20) score += 25  // Falling NVDA = tech crash risk
  
  // Comparing SOX Index to a baseline (e.g., 5000)
  const soxBaseline = 5000;
  const soxDeviation = ((data.soxIndex - soxBaseline) / soxBaseline) * 100;
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
  else score += Math.min(30, peDeviation * 80) // Simple scaling for lower P/Es
  
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
  
  // TED Spread (banking system stress)
  if (data.tedSpread > 1.0) score += 40  // Extreme banking stress
  else if (data.tedSpread > 0.75) score += 30
  else if (data.tedSpread > 0.50) score += 20
  else if (data.tedSpread > 0.35) score += 10
  
  // DXY Dollar Index (strong dollar = headwind for global trade/tech)
  if (data.dxyIndex > 115) score += 35  // Very strong dollar
  else if (data.dxyIndex > 110) score += 28
  else if (data.dxyIndex > 105) score += 20
  else if (data.dxyIndex > 100) score += 10
  
  // ISM PMI (manufacturing health)
  if (data.ismPMI < 42) score += 40  // Deep contraction
  else if (data.ismPMI < 46) score += 30
  else if (data.ismPMI < 50) score += 20  // Contraction
  else if (data.ismPMI < 52) score += 5
  
  // Fed Reverse Repo (liquidity drain)
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
  
  // Yield Curve inverts (< 0) → +15
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
  
  // Lower standard deviation means pillars are aligned, increasing certainty.
  // Higher canary count also indicates more signals, potentially lowering certainty on the *overall* market health.
  // We'll use a scale where low stdDev and low canaryCount contribute to higher certainty.
  
  // Certainty from pillar alignment (higher score if std dev is low)
  const varianceAlignment = Math.max(0, 100 - (stdDev * 3.0)) // Adjust multiplier as needed
  
  // Certainty from canary agreement (higher score if fewer high-risk canaries)
  // Let's assume a maximum of ~15 canaries would be concerning.
  const canaryAgreement = Math.min(100, (15 - canaryCount) / 15 * 100) // More canaries = less certainty
  
  // Combine scores, giving more weight to pillar alignment
  return Math.round(varianceAlignment * 0.7 + canaryAgreement * 0.3)
}

function determineRegime(ccpi: number, canaryCount: number) {
  // Adjusting thresholds based on potential for higher CCPI with new pillars/weighting
  if (ccpi >= 85) { // Increased threshold for "Crash Watch"
    return { level: 5, name: "Crash Watch", color: "red", description: "Extreme risk across multiple pillars" }
  } else if (ccpi >= 65) { // Increased threshold for "High Alert"
    return { level: 4, name: "High Alert", color: "orange", description: "Elevated risk signals" }
  } else if (ccpi >= 45) { // Increased threshold for "Elevated Risk"
    return { level: 3, name: "Elevated Risk", color: "yellow", description: "Caution warranted" }
  } else if (ccpi >= 25) { // Slightly adjusted threshold for "Normal"
    return { level: 2, name: "Normal", color: "lightgreen", description: "Market conditions normal" }
  } else { // ccpi < 25
    return { level: 1, name: "Low Risk", color: "green", description: "Healthy market conditions" }
  }
}

function getPlaybook(regime: ReturnType<typeof determineRegime>) {
  // Playbook adjustments based on regime
  switch(regime.level) {
    case 5: // Crash Watch
      return {
        bias: "Strong Risk-Off",
        strategies: ["Aggressively reduce exposure", "Seek shorting opportunities", "Hold cash"],
        allocation: {
          equities: "0-20%",
          defensive: "20-40%",
          cash: "40-70%",
          alternatives: "5-10%"
        }
      };
    case 4: // High Alert
      return {
        bias: "Cautious Risk-Off",
        strategies: ["Reduce exposure", "Focus on quality", "Use stop-losses"],
        allocation: {
          equities: "30-50%",
          defensive: "15-25%",
          cash: "20-30%",
          alternatives: "5-10%"
        }
      };
    case 3: // Elevated Risk
      return {
        bias: "Neutral to Cautious",
        strategies: ["Maintain diversified exposure", "Avoid excessive leverage", "Watch risk indicators"],
        allocation: {
          equities: "50-70%",
          defensive: "10-20%",
          cash: "10-20%",
          alternatives: "5-15%"
        }
      };
    case 2: // Normal
      return {
        bias: "Risk-On",
        strategies: ["Maintain exposure", "Use cash-secured puts", "Consider growth opportunities"],
        allocation: {
          equities: "60-80%",
          defensive: "5-10%",
          cash: "10-20%",
          alternatives: "5-10%"
        }
      };
    case 1: // Low Risk
      return {
        bias: "Strong Risk-On",
        strategies: ["Invest fully", "Consider leveraged positions", "Seek alpha"],
        allocation: {
          equities: "80-90%",
          defensive: "0-5%",
          cash: "0-10%",
          alternatives: "5-10%"
        }
      };
    default: // Should not happen
      return {
        bias: "Unknown",
        strategies: [],
        allocation: { equities: "0%", defensive: "0%", cash: "0%", alternatives: "0%" }
      };
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
  const activeCanaries = canaries.filter(c => c.severity === 'high' || c.severity === 'medium').length;
  
  return {
    headline: `CCPI at ${ccpi} (${regime.name}) with ${confidence}% confidence`,
    bullets: [
      `Momentum pillar: ${pillars.momentum}/100`,
      `Risk Appetite pillar: ${pillars.riskAppetite}/100`,
      `Valuation pillar: ${pillars.valuation}/100`,
      `Macro pillar: ${pillars.macro}/100`,
      `${activeCanaries} active warning signals observed.`
    ],
    // Optionally add more details about key indicators if needed
    keyIndicators: {
      vix: data.vix,
      putCallRatio: data.putCallRatio,
      spxPE: data.spxPE,
      fedFundsRate: data.fedFundsRate,
      yieldCurve: data.yieldCurve
    }
  }
}

async function generateCanarySignals(data: Awaited<ReturnType<typeof fetchMarketData>>) {
  const canaries: Array<{ signal: string; pillar: string; severity: "high" | "medium" | "low" }> = []
  
  
  // --- Momentum & Technical Pillar ---
  // 1. QQQ Daily Return
  if (data.qqqDailyReturn <= -6) {
    canaries.push({ signal: `QQQ crashed ${Math.abs(data.qqqDailyReturn).toFixed(1)}% - Sharp momentum loss`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.qqqDailyReturn <= -3) {
    canaries.push({ signal: `QQQ dropped ${Math.abs(data.qqqDailyReturn).toFixed(1)}% - Significant decline`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 2. QQQ Consecutive Down Days
  if (data.qqqConsecDown >= 5) {
    canaries.push({ signal: `${data.qqqConsecDown} consecutive down days - Trend break imminent`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.qqqConsecDown >= 3) {
    canaries.push({ signal: `${data.qqqConsecDown} consecutive down days - Weakening trend`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 3. QQQ Below SMAs
  if (data.qqqBelowSMA200 && data.qqqSMA200Proximity >= 100) { // Breach and fully below
    canaries.push({ signal: "QQQ breached 200-day SMA - Long-term trend broken", pillar: "Momentum & Technical", severity: "high" })
  } else if (data.qqqBelowSMA200) { // Below but not necessarily a full breach yet
    canaries.push({ signal: "QQQ below 200-day SMA - Bearish signal", pillar: "Momentum & Technical", severity: "medium" })
  }
  
  if (data.qqqBelowSMA50 && data.qqqSMA50Proximity >= 100) {
    canaries.push({ signal: "QQQ breached 50-day SMA - Medium-term trend broken", pillar: "Momentum & Technical", severity: "high" })
  } else if (data.qqqBelowSMA50) {
    canaries.push({ signal: "QQQ below 50-day SMA - Bearish signal", pillar: "Momentum & Technical", severity: "medium" })
  }
  
  if (data.qqqBelowSMA20 && data.qqqSMA20Proximity >= 100) {
    canaries.push({ signal: "QQQ breached 20-day SMA - Short-term support lost", pillar: "Momentum & Technical", severity: "high" })
  } else if (data.qqqBelowSMA20) {
    canaries.push({ signal: "QQQ below 20-day SMA - Weakening short-term trend", pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 4. SMA Proximity (warning before breach)
  if (data.qqqSMA20Proximity >= 95) { // Close to breaching 20-day SMA
    canaries.push({ signal: `QQQ approaching 20-day SMA (${data.qqqSMA20Proximity.toFixed(0)}% proximity) - Risk of breach`, pillar: "Momentum & Technical", severity: "medium" })
  }
  if (data.qqqSMA50Proximity >= 95) { // Close to breaching 50-day SMA
    canaries.push({ signal: `QQQ approaching 50-day SMA (${data.qqqSMA50Proximity.toFixed(0)}% proximity) - Risk of breach`, pillar: "Momentum & Technical", severity: "medium" })
  }
  if (data.qqqSMA200Proximity >= 95) { // Close to breaching 200-day SMA
    canaries.push({ signal: `QQQ approaching 200-day SMA (${data.qqqSMA200Proximity.toFixed(0)}% proximity) - Risk of breach`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 5. QQQ Below Bollinger Band
  if (data.qqqBelowBollinger && data.qqqBollingerProximity >= 100) {
    canaries.push({ signal: "QQQ breached lower Bollinger Band - Oversold territory signal", pillar: "Momentum & Technical", severity: "high" })
  } else if (data.qqqBollingerProximity >= 75) { // Closer proximity also a warning
    canaries.push({ signal: `QQQ approaching Bollinger Band (${data.qqqBollingerProximity.toFixed(0)}% proximity) - Volatility expansion`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 6. VIX (Fear Gauge)
  if (data.vix > 35) {
    canaries.push({ signal: `VIX at ${data.vix.toFixed(1)} - Extreme fear`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.vix > 25) {
    canaries.push({ signal: `VIX at ${data.vix.toFixed(1)} - Elevated fear`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 7. VXN (Nasdaq Volatility)
  if (data.vxn > 35) {
    canaries.push({ signal: `VXN at ${data.vxn.toFixed(1)} - Nasdaq panic mode`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.vxn > 25) {
    canaries.push({ signal: `VXN at ${data.vxn.toFixed(1)} - Nasdaq volatility elevated`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 8. RVX (Russell 2000 Volatility)
  if (data.rvx > 35) {
    canaries.push({ signal: `RVX at ${data.rvx.toFixed(1)} - Small-cap crash risk`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.rvx > 25) {
    canaries.push({ signal: `RVX at ${data.rvx.toFixed(1)} - Small-cap volatility rising`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 9. VIX Term Structure
  if (data.vixTermInverted || data.vixTermStructure < 0.8) {
    canaries.push({ signal: `VIX term structure inverted (${data.vixTermStructure.toFixed(2)}) - Immediate risk`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.vixTermStructure < 1.2) {
    canaries.push({ signal: `VIX term structure flattening (${data.vixTermStructure.toFixed(2)}) - Caution advised`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 10. ATR - Average True Range
  if (data.atr > 50) {
    canaries.push({ signal: `ATR at ${data.atr.toFixed(1)} - Extreme volatility expansion`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.atr > 40) {
    canaries.push({ signal: `ATR at ${data.atr.toFixed(1)} - Elevated volatility expansion`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 11. LTV - Long-term Volatility
  if (data.ltv > 0.20) {
    canaries.push({ signal: `Long-term volatility at ${(data.ltv * 100).toFixed(1)}% - Sustained instability`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.ltv > 0.15) {
    canaries.push({ signal: `Long-term volatility at ${(data.ltv * 100).toFixed(1)}% - Rising trend`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 12. Bullish Percent Index
  if (data.bullishPercent > 70) {
    canaries.push({ signal: `Bullish Percent at ${data.bullishPercent}% - Extreme overbought conditions`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.bullishPercent > 60) {
    canaries.push({ signal: `Bullish Percent at ${data.bullishPercent}% - Elevated optimism, potential reversal`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 13. NVIDIA Momentum
  if (data.nvidiaMomentum < 20) {
    canaries.push({ signal: `NVIDIA momentum at ${data.nvidiaMomentum} - AI leadership weakness`, pillar: "Momentum & Technical", severity: "high" })
  } else if (data.nvidiaMomentum < 40) {
    canaries.push({ signal: `NVIDIA momentum at ${data.nvidiaMomentum} - Tech sector faltering`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  // 14. SOX Semiconductor Index
  const soxBaseline = 5000; // Assuming a baseline for comparison
  const soxDeviation = ((data.soxIndex - soxBaseline) / soxBaseline) * 100;
  if (soxDeviation < -15) {
    canaries.push({ signal: `SOX down ${Math.abs(soxDeviation).toFixed(1)}% from baseline - Semiconductor crash`, pillar: "Momentum & Technical", severity: "high" })
  } else if (soxDeviation < -10) {
    canaries.push({ signal: `SOX down ${Math.abs(soxDeviation).toFixed(1)}% from baseline - Semiconductor weakness`, pillar: "Momentum & Technical", severity: "medium" })
  }
  
  
  // --- Risk Appetite & Volatility Pillar ---
  // 15. Put/Call Ratio
  if (data.putCallRatio < 0.6) {
    canaries.push({ signal: `Put/Call at ${data.putCallRatio.toFixed(2)} - Extreme complacency, potential reversal`, pillar: "Risk Appetite & Volatility", severity: "high" })
  } else if (data.putCallRatio < 0.85) {
    canaries.push({ signal: `Put/Call at ${data.putCallRatio.toFixed(2)} - Low hedging activity, increasing risk`, pillar: "Risk Appetite & Volatility", severity: "medium" })
  }
  
  // 16. Fear & Greed Index
  if (data.fearGreedIndex !== null) {
    if (data.fearGreedIndex > 80) {
      canaries.push({ signal: `Fear & Greed at ${data.fearGreedIndex} - Extreme greed, market overheating`, pillar: "Risk Appetite & Volatility", severity: "high" })
    } else if (data.fearGreedIndex > 70) {
      canaries.push({ signal: `Fear & Greed at ${data.fearGreedIndex} - Elevated greed, caution advised`, pillar: "Risk Appetite & Volatility", severity: "medium" })
    } else if (data.fearGreedIndex < 20) { // Contrarian signal
       canaries.push({ signal: `Fear & Greed at ${data.fearGreedIndex} - Extreme fear, potential buying opportunity`, pillar: "Risk Appetite & Volatility", severity: "low" })
    }
  }
  
  // 17. AAII Bullish Sentiment
  const aaiiBullish = data.aaiiBullish || 35
  if (aaiiBullish > 55) {
    canaries.push({ signal: `AAII Bullish at ${aaiiBullish}% - Retail euphoria, potential reversal`, pillar: "Risk Appetite & Volatility", severity: "high" })
  } else if (aaiiBullish > 45) {
    canaries.push({ signal: `AAII Bullish at ${aaiiBullish}% - Elevated retail optimism`, pillar: "Risk Appetite & Volatility", severity: "medium" })
  } else if (aaiiBullish < 25) { // Contrarian signal
    canaries.push({ signal: `AAII Bullish at ${aaiiBullish}% - Extreme retail pessimism, potential buying opportunity`, pillar: "Risk Appetite & Volatility", severity: "low" })
  }
  
  // 18. SPY Short Interest Ratio
  const shortInterest = data.shortInterest || 2.5
  if (shortInterest < 1.5) {
    canaries.push({ signal: `Short Interest at ${shortInterest.toFixed(1)}% - Extreme complacency, potential short squeeze risk`, pillar: "Risk Appetite & Volatility", severity: "high" })
  } else if (shortInterest < 2.5) {
    canaries.push({ signal: `Short Interest at ${shortInterest.toFixed(1)}% - Low short positioning`, pillar: "Risk Appetite & Volatility", severity: "medium" })
  }
  
  // 19. Tech ETF Flows
  if (data.etfFlows !== undefined) {
    if (data.etfFlows < -3.0) {
      canaries.push({ signal: `ETF outflows at $${Math.abs(data.etfFlows).toFixed(1)}B - Capital flight from tech`, pillar: "Risk Appetite & Volatility", severity: "high" })
    } else if (data.etfFlows < -1.5) {
      canaries.push({ signal: `ETF outflows at $${Math.abs(data.etfFlows).toFixed(1)}B - Selling pressure on tech`, pillar: "Risk Appetite & Volatility", severity: "medium" })
    } else if (data.etfFlows > 3.0) { // Large inflows can also be a sign of FOMO
       canaries.push({ signal: `ETF inflows at $${data.etfFlows.toFixed(1)}B - Strong retail buying`, pillar: "Risk Appetite & Volatility", severity: "low" })
    }
  }
  
  // 20. Yield Curve (10Y-2Y)
  if (data.yieldCurve < -1.0) {
    canaries.push({ signal: `Yield curve inverted ${Math.abs(data.yieldCurve).toFixed(2)}% - Deep inversion, recession signal`, pillar: "Risk Appetite & Volatility", severity: "high" })
  } else if (data.yieldCurve < -0.2) {
    canaries.push({ signal: `Yield curve inverted ${Math.abs(data.yieldCurve).toFixed(2)}% - Significant inversion`, pillar: "Risk Appetite & Volatility", severity: "medium" })
  } else if (data.yieldCurve > 1.0) { // Steepening curve can indicate inflation fears or growth expectations
     canaries.push({ signal: `Yield curve steepening to ${data.yieldCurve.toFixed(2)}% - Inflation/growth concerns`, pillar: "Risk Appetite & Volatility", severity: "low" })
  }
  
  
  // --- Valuation & Market Structure Pillar ---
  // 21. S&P 500 Forward P/E
  if (data.spxPE > 30) {
    canaries.push({ signal: `S&P 500 P/E at ${data.spxPE.toFixed(1)} - Extreme overvaluation`, pillar: "Valuation & Market Structure", severity: "high" })
  } else if (data.spxPE > 22) {
    canaries.push({ signal: `S&P 500 P/E at ${data.spxPE.toFixed(1)} - Above historical average, expensive`, pillar: "Valuation & Market Structure", severity: "medium" })
  }
  
  // 22. S&P 500 Price-to-Sales
  if (data.spxPS > 3.5) {
    canaries.push({ signal: `S&P 500 P/S at ${data.spxPS.toFixed(1)} - Extremely expensive valuation`, pillar: "Valuation & Market Structure", severity: "high" })
  } else if (data.spxPS > 2.5) {
    canaries.push({ signal: `S&P 500 P/S at ${data.spxPS.toFixed(1)} - Elevated valuation`, pillar: "Valuation & Market Structure", severity: "medium" })
  }
  
  // 23. Buffett Indicator (Market Cap / GDP)
  const buffett = data.buffettIndicator || 180
  if (buffett > 200) {
    canaries.push({ signal: `Buffett Indicator at ${buffett.toFixed(0)}% - Market significantly overvalued relative to economy`, pillar: "Valuation & Market Structure", severity: "high" })
  } else if (buffett > 150) {
    canaries.push({ signal: `Buffett Indicator at ${buffett.toFixed(0)}% - Market above fair value`, pillar: "Valuation & Market Structure", severity: "medium" })
  }
  
  // 24. QQQ P/E Ratio
  if (data.qqqPE > 40) {
    canaries.push({ signal: `QQQ P/E at ${data.qqqPE.toFixed(1)} - AI bubble territory, high growth expectations`, pillar: "Valuation & Market Structure", severity: "high" })
  } else if (data.qqqPE > 30) {
    canaries.push({ signal: `QQQ P/E at ${data.qqqPE.toFixed(1)} - Tech sector expensive`, pillar: "Valuation & Market Structure", severity: "medium" })
  }
  
  // 25. Mag7 Concentration
  if (data.mag7Concentration > 65) {
    canaries.push({ signal: `Mag7 at ${data.mag7Concentration.toFixed(1)}% of QQQ - Extreme concentration risk, dependent on a few stocks`, pillar: "Valuation & Market Structure", severity: "high" })
  } else if (data.mag7Concentration > 55) {
    canaries.push({ signal: `Mag7 at ${data.mag7Concentration.toFixed(1)}% of QQQ - High concentration, broad market performance may lag`, pillar: "Valuation & Market Structure", severity: "medium" })
  }
  
  // 26. Shiller CAPE Ratio
  if (data.shillerCAPE > 35) {
    canaries.push({ signal: `Shiller CAPE at ${data.shillerCAPE.toFixed(1)} - Historic valuation levels, long-term risk`, pillar: "Valuation & Market Structure", severity: "high" })
  } else if (data.shillerCAPE > 28) {
    canaries.push({ signal: `Shiller CAPE at ${data.shillerCAPE.toFixed(1)} - Elevated cyclical valuation, potential for mean reversion`, pillar: "Valuation & Market Structure", severity: "medium" })
  }
  
  // 27. Equity Risk Premium
  if (data.equityRiskPremium < 1.5) {
    canaries.push({ signal: `Equity Risk Premium at ${data.equityRiskPremium.toFixed(2)}% - Stocks offer poor compensation for risk vs bonds`, pillar: "Valuation & Market Structure", severity: "high" })
  } else if (data.equityRiskPremium < 3.0) {
    canaries.push({ signal: `Equity Risk Premium at ${data.equityRiskPremium.toFixed(2)}% - Low compensation for equity risk`, pillar: "Valuation & Market Structure", severity: "medium" })
  } else if (data.equityRiskPremium > 6.0) { // High ERP can indicate fear or undervalued market
     canaries.push({ signal: `Equity Risk Premium at ${data.equityRiskPremium.toFixed(2)}% - High compensation for risk, market may be undervalued`, pillar: "Valuation & Market Structure", severity: "low" })
  }
  
  
  // --- Macro Pillar ---
  // 28. Fed Funds Rate
  if (data.fedFundsRate > 6.0) {
    canaries.push({ signal: `Fed Funds at ${data.fedFundsRate.toFixed(2)}% - Extremely restrictive policy, economic slowdown risk`, pillar: "Macro", severity: "high" })
  } else if (data.fedFundsRate > 5.0) {
    canaries.push({ signal: `Fed Funds at ${data.fedFundsRate.toFixed(2)}% - Restrictive policy, headwinds for growth`, pillar: "Macro", severity: "medium" })
  } else if (data.fedFundsRate < 2.0) { // Low rates can signal economic weakness or support asset prices
     canaries.push({ signal: `Fed Funds at ${data.fedFundsRate.toFixed(2)}% - Accommodative policy, potential asset inflation`, pillar: "Macro", severity: "low" })
  }
  
  // 29. Junk Bond Spread
  if (data.junkSpread > 8) {
    canaries.push({ signal: `Junk Bond Spread at ${data.junkSpread.toFixed(2)}% - Severe credit stress, default risk rising`, pillar: "Macro", severity: "high" })
  } else if (data.junkSpread > 5) {
    canaries.push({ signal: `Junk Bond Spread at ${data.junkSpread.toFixed(2)}% - Credit markets tightening, risk aversion`, pillar: "Macro", severity: "medium" })
  }
  
  // 30. US Debt-to-GDP Ratio
  if (data.debtToGDP > 130) {
    canaries.push({ signal: `US Debt-to-GDP at ${data.debtToGDP.toFixed(0)}% - Fiscal crisis risk, unsustainable debt burden`, pillar: "Macro", severity: "high" })
  } else if (data.debtToGDP > 110) {
    canaries.push({ signal: `US Debt-to-GDP at ${data.debtToGDP.toFixed(0)}% - Elevated fiscal burden, potential for future austerity/inflation`, pillar: "Macro", severity: "medium" })
  }
  
  // 31. TED Spread
  if (data.tedSpread > 1.0) {
    canaries.push({ signal: `TED Spread at ${data.tedSpread.toFixed(2)}% - Significant banking system stress`, pillar: "Macro", severity: "high" })
  } else if (data.tedSpread > 0.50) {
    canaries.push({ signal: `TED Spread at ${data.tedSpread.toFixed(2)}% - Credit market tension, liquidity concerns`, pillar: "Macro", severity: "medium" })
  }
  
  // 32. DXY Dollar Index
  if (data.dxyIndex > 115) {
    canaries.push({ signal: `Dollar Index at ${data.dxyIndex.toFixed(1)} - Extreme dollar strength, hurting global trade & tech stocks`, pillar: "Macro", severity: "high" })
  } else if (data.dxyIndex > 105) {
    canaries.push({ signal: `Dollar Index at ${data.dxyIndex.toFixed(1)} - Strong dollar headwind for multinationals and emerging markets`, pillar: "Macro", severity: "medium" })
  } else if (data.dxyIndex < 95) { // Weak dollar can boost commodities and global growth
     canaries.push({ signal: `Dollar Index at ${data.dxyIndex.toFixed(1)} - Weak dollar, potential tailwind for commodities`, pillar: "Macro", severity: "low" })
  }
  
  // 33. ISM PMI
  if (data.ismPMI < 46) {
    canaries.push({ signal: `ISM PMI at ${data.ismPMI.toFixed(1)} - Manufacturing in deep contraction, recession risk`, pillar: "Macro", severity: "high" })
  } else if (data.ismPMI < 50) {
    canaries.push({ signal: `ISM PMI at ${data.ismPMI.toFixed(1)} - Manufacturing in contraction, economic slowdown`, pillar: "Macro", severity: "medium" })
  } else if (data.ismPMI > 55) { // Strong PMI can indicate overheating or strong growth
     canaries.push({ signal: `ISM PMI at ${data.ismPMI.toFixed(1)} - Strong manufacturing expansion`, pillar: "Macro", severity: "low" })
  }
  
  // 34. Fed Reverse Repo
  if (data.fedReverseRepo > 2000) {
    canaries.push({ signal: `Fed RRP at $${data.fedReverseRepo.toFixed(0)}B - Severe liquidity drain from the system`, pillar: "Macro", severity: "high" })
  } else if (data.fedReverseRepo > 1000) {
    canaries.push({ signal: `Fed RRP at $${data.fedReverseRepo.toFixed(0)}B - Tight liquidity conditions`, pillar: "Macro", severity: "medium" })
  } else if (data.fedReverseRepo < 200) { // Low RRP can indicate ample liquidity
     canaries.push({ signal: `Fed RRP at $${data.fedReverseRepo.toFixed(0)}B - Ample liquidity in the system`, pillar: "Macro", severity: "low" })
  }
  
  return canaries
}
