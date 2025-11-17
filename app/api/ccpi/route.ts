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
    const momentum = await computeMomentumPillar(data)      // NEW: Pillar 1 - Momentum & Technical (40%)
    const riskAppetite = await computeRiskAppetitePillar(data) // NEW: Pillar 2 - Risk Appetite (30%)
    const valuation = await computeValuationPillar(data)    // NEW: Pillar 3 - Valuation (20%)
    const macro = await computeMacroPillar(data)           // NEW: Pillar 4 - Macro (10%)
    
    let baseCCPI = Math.round(
      momentum * 0.40 +
      riskAppetite * 0.30 +
      valuation * 0.20 +
      macro * 0.10
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
  
  console.log("[v0] Pillar 1 - Momentum & Technical:", score)
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
  
  console.log("[v0] Pillar 3 - Valuation & Fundamentals:", score)
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
  
  console.log("[v0] Pillar 4 - Macro Economic:", score)
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
  
  // Pillar 1 - Momentum & Technical canaries
  if (data.qqqDailyReturn <= -6) {
    canaries.push({ signal: `QQQ crashed ${Math.abs(data.qqqDailyReturn).toFixed(1)}% - Momentum loss`, pillar: "Technical & Price Action", severity: "high" })
  } else if (data.qqqDailyReturn <= -3) {
    canaries.push({ signal: `QQQ dropped ${Math.abs(data.qqqDailyReturn).toFixed(1)}% - Sharp decline`, pillar: "Technical & Price Action", severity: "medium" })
  }
  
  if (data.qqqConsecDown >= 5) {
    canaries.push({ signal: `${data.qqqConsecDown} consecutive down days - Trend break`, pillar: "Technical & Price Action", severity: "high" })
  } else if (data.qqqConsecDown >= 3) {
    canaries.push({ signal: `${data.qqqConsecDown} consecutive down days`, pillar: "Technical & Price Action", severity: "medium" })
  }
  
  if (data.qqqBelowSMA20 && data.qqqBelowSMA50) {
    canaries.push({ signal: "QQQ below 20-day & 50-day SMA - Major support lost", pillar: "Technical & Price Action", severity: "high" })
  } else if (data.qqqBelowSMA20) {
    canaries.push({ signal: "QQQ below 20-day SMA - Momentum negative", pillar: "Technical & Price Action", severity: "medium" })
  }
  
  if (data.vix > 35) {
    canaries.push({ signal: `VIX at ${data.vix.toFixed(1)} - Extreme fear`, pillar: "Technical & Price Action", severity: "high" })
  } else if (data.vix > 25) {
    canaries.push({ signal: `VIX at ${data.vix.toFixed(1)} - Elevated fear`, pillar: "Technical & Price Action", severity: "medium" })
  } else if (data.vix > 20) {
    canaries.push({ signal: `VIX at ${data.vix.toFixed(1)} - Moderate concern`, pillar: "Technical & Price Action", severity: "low" })
  }
  
  if (data.vixTermInverted) {
    canaries.push({ signal: "VIX term structure inverted - Backwardation", pillar: "Technical & Price Action", severity: "high" })
  }
  
  // Pillar 2 - Risk Appetite canaries
  if (data.putCallRatio < 0.6) {
    canaries.push({ signal: `Put/Call at ${data.putCallRatio.toFixed(2)} - Extreme complacency`, pillar: "Sentiment & Social", severity: "high" })
  } else if (data.putCallRatio < 0.7) {
    canaries.push({ signal: `Put/Call at ${data.putCallRatio.toFixed(2)} - Low hedging`, pillar: "Sentiment & Social", severity: "medium" })
  }
  
  if (data.fearGreedIndex !== null && data.fearGreedIndex > 80) {
    canaries.push({ signal: `Fear & Greed at ${data.fearGreedIndex} - Extreme greed`, pillar: "Sentiment & Social", severity: "high" })
  }
  
  const aaiiBullish = data.aaiiBullish || 35
  if (aaiiBullish > 55) {
    canaries.push({ signal: `AAII Bullish at ${aaiiBullish}% - Retail euphoria`, pillar: "Sentiment & Social", severity: "high" })
  } else if (aaiiBullish > 50) {
    canaries.push({ signal: `AAII Bullish at ${aaiiBullish}% - Elevated optimism`, pillar: "Sentiment & Social", severity: "medium" })
  }
  
  const shortInterest = data.shortInterest || 2.5
  if (shortInterest < 1.5) {
    canaries.push({ signal: `Short Interest at ${shortInterest.toFixed(1)}% - Low positioning`, pillar: "Sentiment & Social", severity: "high" })
  }
  
  if (data.yieldCurve < -1.0) {
    canaries.push({ signal: `Yield curve inverted ${Math.abs(data.yieldCurve).toFixed(2)}% - Deep inversion`, pillar: "Fundamental & Valuation", severity: "high" })
  } else if (data.yieldCurve < -0.5) {
    canaries.push({ signal: `Yield curve inverted ${Math.abs(data.yieldCurve).toFixed(2)}%`, pillar: "Fundamental & Valuation", severity: "medium" })
  }
  
  // Pillar 3 - Valuation canaries
  if (data.spxPE > 30) {
    canaries.push({ signal: `S&P 500 P/E at ${data.spxPE.toFixed(1)} - Extreme overvaluation`, pillar: "Fundamental & Valuation", severity: "high" })
  } else if (data.spxPE > 25) {
    canaries.push({ signal: `S&P 500 P/E at ${data.spxPE.toFixed(1)} - Elevated valuation`, pillar: "Fundamental & Valuation", severity: "medium" })
  }
  
  const buffett = data.buffettIndicator || 180
  if (buffett > 200) {
    canaries.push({ signal: `Buffett Indicator at ${buffett.toFixed(0)}% - Significantly overvalued`, pillar: "Fundamental & Valuation", severity: "high" })
  } else if (buffett > 180) {
    canaries.push({ signal: `Buffett Indicator at ${buffett.toFixed(0)}% - Overvalued`, pillar: "Fundamental & Valuation", severity: "medium" })
  }
  
  // Pillar 4 - Macro canaries
  if (data.fedFundsRate > 6.0) {
    canaries.push({ signal: `Fed Funds at ${data.fedFundsRate.toFixed(2)}% - Extremely restrictive`, pillar: "Macro Economic", severity: "high" })
  } else if (data.fedFundsRate > 5.5) {
    canaries.push({ signal: `Fed Funds at ${data.fedFundsRate.toFixed(2)}% - Restrictive policy`, pillar: "Macro Economic", severity: "medium" })
  }
  
  if (data.junkSpread > 8) {
    canaries.push({ signal: `Junk Bond Spread at ${data.junkSpread.toFixed(2)}% - Credit stress`, pillar: "Macro Economic", severity: "high" })
  } else if (data.junkSpread > 6) {
    canaries.push({ signal: `Junk Bond Spread at ${data.junkSpread.toFixed(2)}% - Elevated risk`, pillar: "Macro Economic", severity: "medium" })
  }
  
  if (data.debtToGDP > 130) {
    canaries.push({ signal: `US Debt-to-GDP at ${data.debtToGDP.toFixed(0)}% - Unsustainable`, pillar: "Macro Economic", severity: "high" })
  } else if (data.debtToGDP > 120) {
    canaries.push({ signal: `US Debt-to-GDP at ${data.debtToGDP.toFixed(0)}% - Elevated`, pillar: "Macro Economic", severity: "medium" })
  }
  
  return canaries
}
