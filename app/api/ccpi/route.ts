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
    const technical = await computeTechnicalPillar(data)
    const fundamental = await computeFundamentalPillar(data)
    const macro = await computeMacroPillar(data)
    const sentiment = await computeSentimentPillar(data)
    
    // Calculate weighted CCPI score
    const ccpiScore = Math.round(
      technical * 0.35 +
      fundamental * 0.25 +
      macro * 0.30 +
      sentiment * 0.10
    )
    
    // Generate canary signals and other metadata
    const canaries = await generateCanarySignals(data)
    const confidence = computeCertaintyScore({ technical, fundamental, macro, sentiment }, data, canaries.length)
    const regime = determineRegime(ccpiScore, canaries.length)
    const playbook = getPlaybook(regime)
    const summary = generateWeeklySummary(ccpiScore, confidence, regime, { technical, fundamental, macro, sentiment }, data, canaries)
    
    return NextResponse.json({
      ccpi: ccpiScore, // Changed from ccpiScore to ccpi
      confidence,
      certainty: confidence,
      regime,
      playbook,
      summary,
      pillars: {
        technical,
        fundamental,
        macro,
        sentiment
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
        aiJobPostingsGrowth: data.aiJobPostingsGrowth
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
    fetchApifyYahooFinance(),
    fetchAAIISentiment(),
    scrapeBuffettIndicator(),
    scrapePutCallRatio(),
    scrapeAAIISentiment(),
    scrapeShortInterest()
  ])
  
  const qqqData = results[0].status === 'fulfilled' ? results[0].value : null
  const vixTermData = results[1].status === 'fulfilled' ? results[1].value : null
  const fredData = results[2].status === 'fulfilled' ? results[2].value : null
  const alphaVantageData = results[3].status === 'fulfilled' ? results[3].value : null
  const apifyData = results[4].status === 'fulfilled' ? results[4].value : null
  const sentimentData = results[5].status === 'fulfilled' ? results[5].value : null
  const buffettData = results[6].status === 'fulfilled' ? results[6].value : { ratio: 180, status: 'baseline' }
  const putCallData = results[7].status === 'fulfilled' ? results[7].value : { ratio: 0.95, status: 'baseline' }
  const aaiData = results[8].status === 'fulfilled' ? results[8].value : { bullish: 35, bearish: 30, neutral: 35, spread: 5, status: 'baseline' }
  const shortInterestData = results[9].status === 'fulfilled' ? results[9].value : { spyShortRatio: 2.5, status: 'baseline' }
  
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
    
    apiStatus
  }
}

async function fetchFREDIndicators() {
  const FRED_API_KEY = process.env.FRED_API_KEY
  
  if (!FRED_API_KEY) {
    return { 
      fedFundsRate: 5.33, 
      junkSpread: 3.5, 
      yieldCurve: 0.25,
      debtToGDP: 123 // Added baseline for Debt-to-GDP
    }
  }
  
  try {
    const baseUrl = 'https://api.stlouisfed.org/fred/series/observations'
    const [fedFundsRes, junkSpreadRes, yieldCurveRes, debtToGDPRes] = await Promise.all([
      fetch(`${baseUrl}?series_id=DFF&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${baseUrl}?series_id=BAMLH0A0HYM2&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${baseUrl}?series_id=T10Y2Y&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${baseUrl}?series_id=GFDEGDQ188S&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, { signal: AbortSignal.timeout(10000) })
    ])
    
    const [fedFunds, junkSpread, yieldCurve, debtToGDP] = await Promise.all([
      fedFundsRes.json(),
      junkSpreadRes.json(),
      yieldCurveRes.json(),
      debtToGDPRes.json()
    ])
    
    return {
      fedFundsRate: parseFloat(fedFunds.observations[0]?.value || '5.33'),
      junkSpread: parseFloat(junkSpread.observations[0]?.value || '3.5'),
      yieldCurve: parseFloat(yieldCurve.observations[0]?.value || '0.25'),
      debtToGDP: parseFloat(debtToGDP.observations[0]?.value || '123') // Parse Debt-to-GDP
    }
  } catch (error) {
    return { 
      fedFundsRate: 5.33, 
      junkSpread: 3.5, 
      yieldCurve: 0.25,
      debtToGDP: 123
    }
  }
}

async function fetchAlphaVantageIndicators() {
  // Placeholder - returns baseline values
  return {
    vix: 18,
    vxn: 19,
    rvx: 20,
    atr: 35,
    ltv: 0.12,
    spotVol: 0.22
  }
}

async function fetchApifyYahooFinance() {
  return {
    spxPE: 22.5,
    spxPS: 2.8,
    dataSource: 'baseline',
    etfFlows: -2.0 // Example value for etfFlows
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

async function computeTechnicalPillar(data: Awaited<ReturnType<typeof fetchMarketData>>): Promise<number> {
  let score = 0
  
  // QQQ Price Action
  if (data.qqqDailyReturn < -1) {
    score += Math.min(20, Math.abs(data.qqqDailyReturn) * 5 * 2)
  }
  if (data.qqqConsecDown >= 4) score += 12
  else if (data.qqqConsecDown === 3) score += 8
  
  // SMA Proximity
  score += (data.qqqSMA20Proximity / 100) * 10
  score += (data.qqqSMA50Proximity / 100) * 6
  score += (data.qqqSMA200Proximity / 100) * 4
  score += (data.qqqBollingerProximity / 100) * 8
  
  // VIX
  if (data.vix > 35) score += 25
  else if (data.vix > 25) score += 18
  else if (data.vix > 20) score += 12
  
  // VIX Term Structure
  if (data.vixTermInverted) score += 15
  else if (data.vixTermStructure < 0.5) score += 10
  
  return Math.min(100, Math.max(0, score))
}

async function computeFundamentalPillar(data: Awaited<ReturnType<typeof fetchMarketData>>): Promise<number> {
  let score = 0
  
  // P/E Ratio
  const peDeviation = (data.spxPE - 16) / 16
  score += Math.min(40, peDeviation * 80)
  
  // P/S Ratio
  if (data.spxPS > 3.5) score += 25
  else if (data.spxPS > 3.0) score += 20
  else if (data.spxPS > 2.5) score += 15
  
  // Buffett Indicator scoring (15% weight in Fundamental pillar)
  const buffett = data.buffettIndicator || 180
  if (buffett > 200) score += 35 // Severely overvalued
  else if (buffett > 180) score += 28 // Very overvalued
  else if (buffett > 150) score += 20 // Overvalued
  else if (buffett > 120) score += 10 // Fairly valued
  // else: undervalued = 0 points
  
  return Math.min(100, Math.max(0, score))
}

async function computeMacroPillar(data: Awaited<ReturnType<typeof fetchMarketData>>): Promise<number> {
  let score = 0
  console.log("[v0] Macro Pillar Input:", { 
    fedFundsRate: data.fedFundsRate, 
    junkSpread: data.junkSpread, 
    yieldCurve: data.yieldCurve,
    debtToGDP: data.debtToGDP // Added to logging
  })
  
  // Fed Funds Rate - Higher rates = More restrictive policy = Higher crash risk
  if (data.fedFundsRate > 6.0) score += 35
  else if (data.fedFundsRate > 5.5) score += 30
  else if (data.fedFundsRate > 5.0) score += 25  // Current: 5.33 hits here
  else if (data.fedFundsRate > 4.5) score += 20
  else if (data.fedFundsRate > 4.0) score += 15
  else if (data.fedFundsRate > 3.5) score += 10
  
  // Junk Spreads - Higher spreads = Credit stress = Higher crash risk
  if (data.junkSpread > 10) score += 40
  else if (data.junkSpread > 8) score += 35
  else if (data.junkSpread > 6) score += 28
  else if (data.junkSpread > 5) score += 22
  else if (data.junkSpread > 4) score += 16
  else if (data.junkSpread > 3.0) score += 10  // Current: 3.5 hits here
  else if (data.junkSpread > 2.5) score += 5
  
  // Yield Curve - Inverted = Recession warning, but flat/positive during high rates also risky
  if (data.yieldCurve < -1.0) score += 35  // Deep inversion
  else if (data.yieldCurve < -0.5) score += 30
  else if (data.yieldCurve < -0.2) score += 20
  else if (data.yieldCurve < 0) score += 12
  else if (data.yieldCurve < 0.5) score += 8  // Current: 0.25 hits here - flat curve still concerning
  else if (data.yieldCurve < 1.0) score += 4
  
  // Historical context: >100% is concerning, >120% is dangerous, >130% is extreme
  if (data.debtToGDP > 130) score += 35  // Extreme debt levels
  else if (data.debtToGDP > 120) score += 28  // Very high debt (current: 123)
  else if (data.debtToGDP > 110) score += 20  // High debt
  else if (data.debtToGDP > 100) score += 12  // Elevated debt
  else if (data.debtToGDP > 90) score += 5   // Moderate debt
  // else: healthy debt levels = 0 points
  
  console.log("[v0] Macro Pillar Score:", score)
  return Math.min(100, Math.max(0, score))
}

async function computeSentimentPillar(data: Awaited<ReturnType<typeof fetchMarketData>>): Promise<number> {
  let score = 0
  
  // Put/Call Ratio
  if (data.putCallRatio !== undefined) {
    if (data.putCallRatio < 0.6) score += 30 // Extreme complacency (danger)
    else if (data.putCallRatio < 0.7) score += 22 // Complacency
    else if (data.putCallRatio < 0.85) score += 12 // Low hedging
    else if (data.putCallRatio > 1.3) score += 15 // Extreme fear (contrarian)
    else if (data.putCallRatio > 1.1) score += 8 // Elevated fear
    // else: normal = 0 points
  }
  
  // Fear & Greed
  if (data.fearGreedIndex !== null && data.fearGreedIndex !== undefined) {
    if (data.fearGreedIndex > 75) score += 20
    else if (data.fearGreedIndex < 25) score += 15
  }
  
  // AAII Sentiment scoring (10% weight)
  const aaiiBullish = data.aaiiBullish || 35
  if (aaiiBullish > 55) score += 30 // Extreme optimism (danger)
  else if (aaiiBullish > 50) score += 22 // High optimism
  else if (aaiiBullish > 45) score += 12 // Elevated optimism
  else if (aaiiBullish < 25) score += 8 // Extreme pessimism (contrarian)
  else if (aaiiBullish < 30) score += 4 // Pessimism
  // else: neutral = 0 points
  
  // Short Interest scoring (10% weight)
  const shortInterest = data.shortInterest || 2.5
  if (shortInterest < 1.5) score += 30 // Very low shorts (complacency danger)
  else if (shortInterest < 2.0) score += 20 // Low shorts
  else if (shortInterest < 2.5) score += 10 // Below average
  else if (shortInterest > 4.0) score += 8 // High shorts (contrarian)
  else if (shortInterest > 3.5) score += 4 // Elevated shorts
  // else: normal = 0 points
  
  return Math.min(100, Math.max(0, score))
}

async function generateCanarySignals(data: Awaited<ReturnType<typeof fetchMarketData>>) {
  const canaries: Array<{ signal: string; pillar: string; severity: "high" | "medium" | "low" }> = []
  
  // PILLAR 1: TECHNICAL & PRICE ACTION
  
  // QQQ Daily Return
  if (data.qqqDailyReturn < -3.0) {
    canaries.push({
      signal: `QQQ crashed ${Math.abs(data.qqqDailyReturn).toFixed(1)}% - Major sell-off`,
      pillar: "Technical & Price Action",
      severity: "high"
    })
  } else if (data.qqqDailyReturn < -1.5) {
    canaries.push({
      signal: `QQQ dropped ${Math.abs(data.qqqDailyReturn).toFixed(1)}% today`,
      pillar: "Technical & Price Action",
      severity: "medium"
    })
  }
  
  // Consecutive Down Days
  if (data.qqqConsecDown >= 5) {
    canaries.push({
      signal: `QQQ down ${data.qqqConsecDown} consecutive days - Sustained selling pressure`,
      pillar: "Technical & Price Action",
      severity: "high"
    })
  } else if (data.qqqConsecDown >= 3) {
    canaries.push({
      signal: `QQQ down ${data.qqqConsecDown} days in a row - Building weakness`,
      pillar: "Technical & Price Action",
      severity: "medium"
    })
  }
  
  // SMA Breaches
  if (data.qqqBelowSMA200) {
    canaries.push({
      signal: "QQQ broken below 200-day SMA - Long-term trend bearish",
      pillar: "Technical & Price Action",
      severity: "high"
    })
  }
  
  if (data.qqqBelowSMA50) {
    canaries.push({
      signal: "QQQ below 50-day SMA - Intermediate trend weakening",
      pillar: "Technical & Price Action",
      severity: "medium"
    })
  }
  
  if (data.qqqBelowSMA20) {
    canaries.push({
      signal: "QQQ below 20-day SMA - Short-term momentum negative",
      pillar: "Technical & Price Action",
      severity: "medium"
    })
  }
  
  // SMA Proximity Warnings
  if (data.qqqSMA20Proximity >= 90 && !data.qqqBelowSMA20) {
    canaries.push({
      signal: `QQQ within ${(100 - data.qqqSMA20Proximity).toFixed(0)}% of 20-day SMA - Critical support test`,
      pillar: "Technical & Price Action",
      severity: "medium"
    })
  }
  
  if (data.qqqSMA50Proximity >= 85 && !data.qqqBelowSMA50) {
    canaries.push({
      signal: `QQQ approaching 50-day SMA (${(100 - data.qqqSMA50Proximity).toFixed(0)}% away)`,
      pillar: "Technical & Price Action",
      severity: "medium"
    })
  }
  
  // Bollinger Band
  if (data.qqqBelowBollinger) {
    canaries.push({
      signal: "QQQ breached lower Bollinger Band - Extreme oversold",
      pillar: "Technical & Price Action",
      severity: "high"
    })
  }
  
  // VIX Warnings
  if (data.vix > 35) {
    canaries.push({
      signal: `VIX spiked to ${data.vix.toFixed(1)} - Panic selling active`,
      pillar: "Technical & Price Action",
      severity: "high"
    })
  } else if (data.vix > 25) {
    canaries.push({
      signal: `VIX elevated at ${data.vix.toFixed(1)} - Fear building`,
      pillar: "Technical & Price Action",
      severity: "medium"
    })
  } else if (data.vix > 20) {
    canaries.push({
      signal: `VIX at ${data.vix.toFixed(1)} - Above comfort zone`,
      pillar: "Technical & Price Action",
      severity: "medium"
    })
  }
  
  // VIX Term Structure
  if (data.vixTermInverted) {
    canaries.push({
      signal: "VIX term structure inverted - Immediate crash fear",
      pillar: "Technical & Price Action",
      severity: "high"
    })
  } else if (data.vixTermStructure < 0.8) {
    canaries.push({
      signal: `VIX term structure flattening (${data.vixTermStructure.toFixed(2)}) - Near-term stress`,
      pillar: "Technical & Price Action",
      severity: "medium"
    })
  }
  
  // VXN (Nasdaq volatility)
  if (data.vxn > data.vix + 5) {
    canaries.push({
      signal: `VXN ${data.vxn.toFixed(1)} significantly above VIX - Tech sector under pressure`,
      pillar: "Technical & Price Action",
      severity: "medium"
    })
  }
  
  // PILLAR 2: FUNDAMENTAL & VALUATION
  
  // P/E Ratio
  if (data.spxPE > 30) {
    canaries.push({
      signal: `S&P 500 P/E at ${data.spxPE} - Extreme overvaluation (historical avg: 16)`,
      pillar: "Fundamental & Valuation",
      severity: "high"
    })
  } else if (data.spxPE > 25) {
    canaries.push({
      signal: `S&P 500 P/E at ${data.spxPE} - Elevated valuation risk`,
      pillar: "Fundamental & Valuation",
      severity: "medium"
    })
  }
  
  // P/S Ratio
  if (data.spxPS > 3.5) {
    canaries.push({
      signal: `S&P 500 P/S at ${data.spxPS} - Sales multiples stretched`,
      pillar: "Fundamental & Valuation",
      severity: "high"
    })
  } else if (data.spxPS > 3.0) {
    canaries.push({
      signal: `S&P 500 P/S at ${data.spxPS} - Above historical norms`,
      pillar: "Fundamental & Valuation",
      severity: "medium"
    })
  }
  
  // Buffett Indicator
  const buffett = data.buffettIndicator || 180
  if (buffett > 200) {
    canaries.push({
      signal: `Buffett Indicator at ${buffett}% - Market cap severely above GDP (danger >200%)`,
      pillar: "Fundamental & Valuation",
      severity: "high"
    })
  } else if (buffett > 180) {
    canaries.push({
      signal: `Buffett Indicator at ${buffett}% - Market cap elevated vs GDP (warning >180%)`,
      pillar: "Fundamental & Valuation",
      severity: "medium"
    })
  }
  
  // PILLAR 3: MACRO ECONOMIC
  
  // Fed Funds Rate
  if (data.fedFundsRate > 6.0) {
    canaries.push({
      signal: `Fed Funds at ${data.fedFundsRate}% - Extremely restrictive policy`,
      pillar: "Macro Economic",
      severity: "high"
    })
  } else if (data.fedFundsRate > 5.5) {
    canaries.push({
      signal: `Fed Funds at ${data.fedFundsRate}% - Tight monetary policy stress`,
      pillar: "Macro Economic",
      severity: "medium"
    })
  } else if (data.fedFundsRate > 5.0) {
    canaries.push({
      signal: `Fed Funds at ${data.fedFundsRate}% - Restrictive territory`,
      pillar: "Macro Economic",
      severity: "medium"
    })
  }
  
  // Junk Spreads
  if (data.junkSpread > 8.0) {
    canaries.push({
      signal: `Junk spreads blowing out to ${data.junkSpread.toFixed(1)}% - Credit crisis warning`,
      pillar: "Macro Economic",
      severity: "high"
    })
  } else if (data.junkSpread > 6.0) {
    canaries.push({
      signal: `Junk spreads widening to ${data.junkSpread.toFixed(1)}% - Credit stress building`,
      pillar: "Macro Economic",
      severity: "medium"
    })
  } else if (data.junkSpread > 5.0) {
    canaries.push({
      signal: `Junk spreads at ${data.junkSpread.toFixed(1)}% - Above normal levels`,
      pillar: "Macro Economic",
      severity: "medium"
    })
  }
  
  // Yield Curve
  if (data.yieldCurve < -1.0) {
    canaries.push({
      signal: `Yield curve deeply inverted at ${data.yieldCurve.toFixed(2)}% - Severe recession signal`,
      pillar: "Macro Economic",
      severity: "high"
    })
  } else if (data.yieldCurve < -0.5) {
    canaries.push({
      signal: `Yield curve inverted at ${data.yieldCurve.toFixed(2)}% - Recession warning`,
      pillar: "Macro Economic",
      severity: "high"
    })
  } else if (data.yieldCurve < -0.2) {
    canaries.push({
      signal: `Yield curve inverted at ${data.yieldCurve.toFixed(2)}% - Economic slowdown signal`,
      pillar: "Macro Economic",
      severity: "medium"
    })
  }
  
  // Debt-to-GDP Ratio
  const debtToGDP = data.debtToGDP || 123
  if (debtToGDP > 130) {
    canaries.push({
      signal: `US Debt-to-GDP at ${debtToGDP.toFixed(1)}% - Extreme fiscal stress (danger >130%)`,
      pillar: "Macro Economic",
      severity: "high"
    })
  } else if (debtToGDP > 120) {
    canaries.push({
      signal: `US Debt-to-GDP at ${debtToGDP.toFixed(1)}% - High debt burden (warning >120%)`,
      pillar: "Macro Economic",
      severity: "medium"
    })
  } else if (debtToGDP > 110) {
    canaries.push({
      signal: `US Debt-to-GDP at ${debtToGDP.toFixed(1)}% - Elevated debt levels (watch >110%)`,
      pillar: "Macro Economic",
      severity: "medium"
    })
  }
  
  // PILLAR 4: SENTIMENT & SOCIAL
  
  // Put/Call Ratio
  const putCall = data.putCallRatio || 0.95
  if (putCall < 0.6) {
    canaries.push({
      signal: `Put/Call ratio ${putCall.toFixed(2)} - Extreme complacency, very low hedging`,
      pillar: "Sentiment & Social",
      severity: "high"
    })
  } else if (putCall < 0.7) {
    canaries.push({
      signal: `Put/Call ratio ${putCall.toFixed(2)} - Low put protection shows complacency`,
      pillar: "Sentiment & Social",
      severity: "medium"
    })
  }
  
  // Fear & Greed Index
  if (data.fearGreedIndex !== null && data.fearGreedIndex !== undefined) {
    if (data.fearGreedIndex > 80) {
      canaries.push({
        signal: `Fear & Greed at ${data.fearGreedIndex} - Extreme greed territory`,
        pillar: "Sentiment & Social",
        severity: "high"
      })
    } else if (data.fearGreedIndex > 75) {
      canaries.push({
        signal: `Fear & Greed at ${data.fearGreedIndex} - High greed levels`,
        pillar: "Sentiment & Social",
        severity: "medium"
      })
    } else if (data.fearGreedIndex < 20) {
      canaries.push({
        signal: `Fear & Greed at ${data.fearGreedIndex} - Extreme fear (contrarian buy signal)`,
        pillar: "Sentiment & Social",
        severity: "medium"
      })
    }
  }
  
  // Bullish Percent
  if (data.bullishPercent > 70) {
    canaries.push({
      signal: `Bullish Percent at ${data.bullishPercent}% - Overbought market`,
      pillar: "Sentiment & Social",
      severity: "medium"
    })
  }
  
  // Short Interest
  const shortInterest = data.shortInterest || 2.5
  if (shortInterest < 1.5) {
    canaries.push({
      signal: `Short interest ${shortInterest.toFixed(1)} - Extremely low hedging, no fear in market`,
      pillar: "Sentiment & Social",
      severity: "high"
    })
  } else if (shortInterest < 2.0) {
    canaries.push({
      signal: `Short interest ${shortInterest.toFixed(1)} - Low short positioning shows complacency`,
      pillar: "Sentiment & Social",
      severity: "medium"
    })
  }
  
  // ETF Flows
  if (data.etfFlows !== undefined) {
    if (data.etfFlows < -3.0) {
      canaries.push({
        signal: `Tech ETF outflows of $${Math.abs(data.etfFlows).toFixed(1)}B - Institutional selling`,
        pillar: "Sentiment & Social",
        severity: "high"
      })
    } else if (data.etfFlows < -1.5) {
      canaries.push({
        signal: `Tech ETF outflows of $${Math.abs(data.etfFlows).toFixed(1)}B - Rotation out of tech`,
        pillar: "Sentiment & Social",
        severity: "medium"
      })
    }
  }
  
  // AAII Sentiment
  const aaiiBullish = data.aaiiBullish || 35
  if (aaiiBullish > 55) {
    canaries.push({
      signal: `AAII ${aaiiBullish}% bullish - Retail investors in euphoria (danger >50%)`,
      pillar: "Sentiment & Social",
      severity: "high"
    })
  } else if (aaiiBullish > 50) {
    canaries.push({
      signal: `AAII ${aaiiBullish}% bullish - Elevated retail optimism (warning >45%)`,
      pillar: "Sentiment & Social",
      severity: "medium"
    })
  }
  
  return canaries.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 }
    return severityOrder[b.severity] - severityOrder[a.severity]
  })
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
      `Technical pillar at ${pillars.technical}/100`,
      `Fundamental pillar at ${pillars.fundamental}/100`,
      `${canaries.length} active warning signals`
    ]
  }
}
