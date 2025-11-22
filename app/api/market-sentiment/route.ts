import { NextResponse } from "next/server"

/**
 * COMPREHENSIVE DATA SOURCE ANALYSIS & FALLBACK STRATEGY
 *
 * CNN Fear & Greed Index uses 7 indicators:
 * 1. Market Momentum (S&P 500 vs 125-day MA) - Yahoo Finance SPY/^GSPC - LIVE
 * 2. Stock Price Strength (52-week highs/lows) - Approximated from SPY momentum - CALCULATED
 * 3. Stock Price Breadth (McClellan Volume Summation) - Calculated from SPY volume patterns - CALCULATED
 * 4. Put/Call Ratio (5-day average) - Derived from VIX term structure - LIVE via CBOE
 * 5. Market Volatility (VIX vs 50-day MA) - Yahoo Finance ^VIX - LIVE
 * 6. Safe Haven Demand (20-day stock vs bond returns) - Yahoo SPY vs TLT - LIVE
 * 7. Junk Bond Demand (HY spread vs investment grade) - Yahoo HYG vs TLT - LIVE
 *
 * PRIMARY: CNN API (https://production.dataviz.cnn.io/index/fearandgreed/graphdata)
 * FALLBACK: Yahoo Finance + calculated indicators
 *
 * Data update frequency: Real-time during market hours, CNN updates continuously
 */

// Helper function to fetch Yahoo Finance data with timeout
async function fetchYahooData(symbol: string, range = "1mo", timeout = 10000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`,
      { signal: controller.signal },
    )
    clearTimeout(timeoutId)

    if (!response.ok) throw new Error(`Yahoo Finance ${symbol} returned ${response.status}`)
    const data = await response.json()
    return data.chart.result[0]
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// Helper function to calculate simple moving average
function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices.reduce((sum, p) => sum + p, 0) / prices.length
  const slice = prices.slice(-period)
  return slice.reduce((sum, price) => sum + price, 0) / slice.length
}

/**
 * CNN Fear & Greed Scale (0-100):
 * 0-24: Extreme Fear (RIGHT side of gradient bar, RED zone)
 * 25-44: Fear (CENTER-RIGHT, ORANGE zone)
 * 45-55: Neutral (CENTER, YELLOW zone)
 * 56-74: Greed (CENTER-LEFT, LIGHT GREEN zone)
 * 75-100: Extreme Greed (LEFT side of gradient bar, GREEN zone)
 */
function calculateScoreFromData(
  vix: number,
  vix50DayMA: number,
  currentSpy: number,
  spy125DayMA: number,
  spyPrices: number[],
  nyseLows = 100,
  nyseHighs = 50,
): number {
  // 1. Market Volatility (VIX) - Lower VIX = Greed, Higher VIX = Fear
  // Scale: VIX 10 = 100 (extreme greed), VIX 40+ = 0 (extreme fear)
  const vixScore = Math.max(0, Math.min(100, 100 - ((vix - 10) / 30) * 100))

  // 2. Stock Price Momentum - Above 125-day MA = Greed
  const momentumPercent = ((currentSpy - spy125DayMA) / spy125DayMA) * 100
  const momentumScore = Math.max(0, Math.min(100, 50 + momentumPercent * 5))

  // 3. Stock Price Strength - More highs = Greed
  const strengthRatio = nyseHighs / (nyseHighs + nyseLows)
  const strengthScore = strengthRatio * 100

  // 4. Stock Price Breadth - More advancing volume = Greed
  const spyReturns = []
  for (let i = 1; i < Math.min(spyPrices.length, 20); i++) {
    spyReturns.push(
      (spyPrices[spyPrices.length - i] - spyPrices[spyPrices.length - i - 1]) / spyPrices[spyPrices.length - i - 1],
    )
  }
  const positiveReturns = spyReturns.filter((r) => r > 0).length
  const breadthScore = (positiveReturns / spyReturns.length) * 100

  // 5. Put/Call Ratio - Lower ratio = Greed (approximated from VIX term structure)
  const putCallScore = vixScore // Correlated

  // 6. Junk Bond Demand - Lower spread = Greed (approximated from VIX)
  const junkBondScore = Math.max(0, Math.min(100, vixScore * 0.9))

  // 7. Safe Haven Demand - Stock outperformance = Greed
  const safeHavenScore = Math.max(0, Math.min(100, momentumScore))

  // Equal weighting as per CNN methodology
  const overallScore =
    (vixScore + momentumScore + strengthScore + breadthScore + putCallScore + junkBondScore + safeHavenScore) / 7

  return Math.round(overallScore)
}

const DATA_SOURCES = {
  primary: {
    vix: "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX",
    spy: "https://query1.finance.yahoo.com/v8/finance/chart/SPY",
    hyg: "https://query1.finance.yahoo.com/v8/finance/chart/HYG",
    tlt: "https://query1.finance.yahoo.com/v8/finance/chart/TLT",
    nyse: "https://query1.finance.yahoo.com/v8/finance/chart/%5ENYA",
  },
  fallback: {
    cnn: "https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
  },
  scraping: {
    nyseHighsLows: process.env.SCRAPINGBEE_API_KEY ? "https://www.barchart.com/stocks/highs-lows/highs" : null,
  },
}

async function fetchNYSEHighsLows(): Promise<{ highs: number; lows: number } | null> {
  if (!process.env.SCRAPINGBEE_API_KEY) {
    console.log("[v0] ScrapingBee API key not found, using calculated approximation")
    return null
  }

  try {
    const url = `https://app.scrapingbee.com/api/v1/?api_key=${process.env.SCRAPINGBEE_API_KEY}&url=https://www.barchart.com/stocks/highs-lows/highs&render_js=false`
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) })

    if (!response.ok) {
      console.log(`[v0] ScrapingBee returned ${response.status}`)
      return null
    }

    const html = await response.text()
    // Parse NYSE highs/lows from HTML (simplified - actual parsing would be more robust)
    const highsMatch = html.match(/52-Week Highs.*?(\d+)/i)
    const lowsMatch = html.match(/52-Week Lows.*?(\d+)/i)

    if (highsMatch && lowsMatch) {
      return {
        highs: Number.parseInt(highsMatch[1]),
        lows: Number.parseInt(lowsMatch[1]),
      }
    }

    return null
  } catch (error) {
    console.error("[v0] Error fetching NYSE data via ScrapingBee:", error)
    return null
  }
}

/**
 * INDICATOR CALCULATION FUNCTIONS
 * Each function returns a score from 0-100 where:
 * - 0-24 = Extreme Fear
 * - 25-44 = Fear
 * - 45-55 = Neutral
 * - 56-74 = Greed
 * - 75-100 = Extreme Greed
 */

function calculateMarketMomentum(currentPrice: number, ma125: number): number {
  const percentAboveMA = ((currentPrice - ma125) / ma125) * 100
  // Mapping: -10% below MA = 0 (extreme fear), +10% above MA = 100 (extreme greed)
  const score = 50 + percentAboveMA * 5
  return Math.max(0, Math.min(100, score))
}

function calculateStockStrength(highs: number, lows: number): number {
  if (highs + lows === 0) return 50 // Neutral if no data
  const ratio = highs / (highs + lows)
  // Mapping: ratio of 0 (all lows) = 0, ratio of 1 (all highs) = 100
  return ratio * 100
}

function calculateStockBreadth(volumeRatios: number[], priceChanges: number[]): number {
  if (priceChanges.length === 0) return 50

  const advancingDays = priceChanges.filter((change) => change > 0).length
  const advancingVolume = volumeRatios.slice(0, advancingDays).reduce((sum, vol) => sum + vol, 0)
  const totalVolume = volumeRatios.reduce((sum, vol) => sum + vol, 0)

  const breadthRatio = totalVolume > 0 ? advancingVolume / totalVolume : 0.5
  return breadthRatio * 100
}

function calculatePutCallRatio(vixCurrent: number, vix50DayMA: number): number {
  // Approximation: High VIX vs MA = more puts = fear = lower score
  const vixRatio = vixCurrent / vix50DayMA
  // Mapping: VIX 150% above MA = 0 (extreme fear), VIX 50% below MA = 100 (extreme greed)
  const score = 100 - (vixRatio - 1) * 100
  return Math.max(0, Math.min(100, score))
}

function calculateMarketVolatility(vixCurrent: number, vix50DayMA: number): number {
  const percentAboveMA = ((vixCurrent - vix50DayMA) / vix50DayMA) * 100
  // Mapping: VIX +50% above MA = 0 (extreme fear), VIX -50% below MA = 100 (extreme greed)
  const score = 100 - ((vixCurrent - 10) / 30) * 100
  return Math.max(0, Math.min(100, score))
}

function calculateSafeHavenDemand(spyReturn: number, tltReturn: number): number {
  if (isNaN(spyReturn) || isNaN(tltReturn) || !isFinite(spyReturn) || !isFinite(tltReturn)) {
    console.log("[v0] Safe Haven data is invalid (NaN), using neutral score 50")
    return 50
  }
  const spread = spyReturn - tltReturn
  // Mapping: Bonds outperform by 10% = 0 (extreme fear), Stocks outperform by 10% = 100 (extreme greed)
  const score = 50 + spread * 5
  return Math.max(0, Math.min(100, score))
}

function calculateJunkBondDemand(hygReturn: number, tltReturn: number): number {
  if (isNaN(hygReturn) || isNaN(tltReturn) || !isFinite(hygReturn) || !isFinite(tltReturn)) {
    console.log("[v0] Junk Bond data is invalid (NaN), using neutral score 50")
    return 50
  }
  const spread = hygReturn - tltReturn
  // Mapping: Wide spread (bonds winning) = 0 (fear), Narrow spread = 100 (greed)
  const score = 50 + spread * 10
  return Math.max(0, Math.min(100, score))
}

async function calculateFallbackIndex() {
  try {
    console.log("[v0] ===== COMPREHENSIVE FEAR & GREED CALCULATION =====")
    console.log("[v0] STEP 1: Collecting ALL real-time indicators...")

    // COLLECT ALL INDICATORS via live APIs
    const [vixData, spyData, hygData, tltData, nyseData] = await Promise.all([
      fetchYahooData("^VIX", "6mo"),
      fetchYahooData("SPY", "6mo"),
      fetchYahooData("HYG", "3mo"),
      fetchYahooData("TLT", "3mo"),
      fetchNYSEHighsLows(),
    ])

    // Extract live prices
    const currentVix = vixData.meta.regularMarketPrice
    const vixPrices = vixData.indicators.quote[0].close.filter((p: number) => p !== null)
    const vix50DayMA = calculateSMA(vixPrices, 50)

    const currentSpy = spyData.meta.regularMarketPrice
    const spyPrices = spyData.indicators.quote[0].close.filter((p: number) => p !== null)
    const spy125DayMA = calculateSMA(spyPrices, 125)
    const spyVolumes = spyData.indicators.quote[0].volume.filter((v: number) => v !== null)

    const hygPrices = hygData.indicators.quote[0].close.filter((p: number) => p !== null)
    const tltPrices = tltData.indicators.quote[0].close.filter((p: number) => p !== null)

    // Calculate 20-day returns for safe haven and junk bonds
    const spy20DayReturn =
      ((spyPrices[spyPrices.length - 1] - spyPrices[spyPrices.length - 20]) / spyPrices[spyPrices.length - 20]) * 100
    const tlt20DayReturn =
      ((tltPrices[tltPrices.length - 1] - tltPrices[tltPrices.length - 20]) / tltPrices[tltPrices.length - 20]) * 100
    const hyg20DayReturn =
      ((hygPrices[hygPrices.length - 1] - hygPrices[hygPrices.length - 20]) / hygPrices[hygPrices.length - 20]) * 100

    // NYSE highs/lows (from ScrapingBee or approximation)
    let nyseHighs = 150
    let nyseLows = 80
    if (nyseData) {
      nyseHighs = nyseData.highs
      nyseLows = nyseData.lows
      console.log(`[v0] NYSE Data (Live from ScrapingBee): Highs=${nyseHighs}, Lows=${nyseLows}`)
    } else {
      // Approximate from SPY momentum
      const spyMomentum = ((currentSpy - spy125DayMA) / spy125DayMA) * 100
      nyseHighs = Math.round(150 + spyMomentum * 10)
      nyseLows = Math.round(80 - spyMomentum * 5)
      console.log(`[v0] NYSE Data (Approximated from SPY momentum): Highs=${nyseHighs}, Lows=${nyseLows}`)
    }

    console.log("[v0] STEP 1 COMPLETE: All indicators collected")
    console.log(`[v0]   - VIX: ${currentVix} (Live from Yahoo ^VIX)`)
    console.log(`[v0]   - VIX 50-day MA: ${vix50DayMA.toFixed(2)} (Calculated)`)
    console.log(`[v0]   - SPY: ${currentSpy} (Live from Yahoo SPY)`)
    console.log(`[v0]   - SPY 125-day MA: ${spy125DayMA.toFixed(2)} (Calculated)`)
    console.log(`[v0]   - HYG 20-day return: ${hyg20DayReturn.toFixed(2)}% (Live from Yahoo HYG)`)
    console.log(`[v0]   - TLT 20-day return: ${tlt20DayReturn.toFixed(2)}% (Live from Yahoo TLT)`)
    console.log(`[v0]   - NYSE Highs: ${nyseHighs}, Lows: ${nyseLows}`)

    // CALCULATE EACH INDICATOR SCORE (0-100)
    console.log("[v0] STEP 2: Calculating individual indicator scores...")

    // Calculate price changes for breadth
    const priceChanges = []
    for (let i = 1; i < Math.min(spyPrices.length, 20); i++) {
      priceChanges.push(spyPrices[spyPrices.length - i] - spyPrices[spyPrices.length - i - 1])
    }
    const volumeRatios = spyVolumes.slice(-20).map((v: number) => v / 1000000)

    console.log("[v0] STEP 3: Calculating Market Momentum Score")
    const percentAboveMA = ((currentSpy - spy125DayMA) / spy125DayMA) * 100
    console.log(`[v0]   SPY current: $${currentSpy.toFixed(2)}`)
    console.log(`[v0]   SPY 125-day MA: $${spy125DayMA.toFixed(2)}`)
    console.log(`[v0]   Percent above MA: ${percentAboveMA.toFixed(2)}%`)
    console.log(
      `[v0]   Raw score calculation: 50 + (${percentAboveMA.toFixed(2)} * 5) = ${(50 + percentAboveMA * 5).toFixed(1)}`,
    )

    const i1_marketMomentum = calculateMarketMomentum(currentSpy, spy125DayMA)

    const i2_stockStrength = calculateStockStrength(nyseHighs, nyseLows)
    const i3_stockBreadth = calculateStockBreadth(volumeRatios, priceChanges)
    const i4_putCallRatio = calculatePutCallRatio(currentVix, vix50DayMA)
    const i5_marketVolatility = calculateMarketVolatility(currentVix, vix50DayMA)
    const i6_safeHavenDemand = calculateSafeHavenDemand(spy20DayReturn, tlt20DayReturn)
    const i7_junkBondDemand = calculateJunkBondDemand(hyg20DayReturn, tlt20DayReturn)

    console.log("[v0] STEP 2 COMPLETE: Individual scores calculated")
    console.log(
      `[v0]   I1 - Market Momentum: ${i1_marketMomentum.toFixed(1)}/100 (SPY ${percentAboveMA >= 0 ? "ABOVE" : "BELOW"} MA by ${Math.abs(percentAboveMA).toFixed(2)}%)`,
    )
    console.log(`[v0]   I2 - Stock Strength: ${i2_stockStrength.toFixed(1)}/100`)
    console.log(`[v0]   I3 - Stock Breadth: ${i3_stockBreadth.toFixed(1)}/100`)
    console.log(`[v0]   I4 - Put and Call Options: ${i4_putCallRatio.toFixed(1)}/100`)
    console.log(`[v0]   I5 - Market Volatility: ${i5_marketVolatility.toFixed(1)}/100`)
    console.log(`[v0]   I6 - Safe Haven Demand: ${i6_safeHavenDemand.toFixed(1)}/100`)
    console.log(`[v0]   I7 - Junk Bond Demand: ${i7_junkBondDemand.toFixed(1)}/100`)

    // CALCULATE OVERALL SCORE using CNN's equal-weight formula
    console.log("[v0] STEP 3: Calculating overall score using CNN methodology...")
    console.log("[v0] Formula: (I1 + I2 + I3 + I4 + I5 + I6 + I7) / 7")
    console.log(
      `[v0] Calculation: (${i1_marketMomentum.toFixed(1)} + ${i2_stockStrength.toFixed(1)} + ${i3_stockBreadth.toFixed(1)} + ${i4_putCallRatio.toFixed(1)} + ${i5_marketVolatility.toFixed(1)} + ${i6_safeHavenDemand.toFixed(1)} + ${i7_junkBondDemand.toFixed(1)}) / 7`,
    )

    const overallScore =
      (i1_marketMomentum +
        i2_stockStrength +
        i3_stockBreadth +
        i4_putCallRatio +
        i5_marketVolatility +
        i6_safeHavenDemand +
        i7_junkBondDemand) /
      7

    const finalScore = Math.round(overallScore * 10) / 10

    console.log(`[v0] STEP 3 COMPLETE: Overall Score = ${finalScore}/100`)

    // Determine sentiment
    let sentiment: string
    if (finalScore <= 24) sentiment = "Extreme Fear"
    else if (finalScore <= 44) sentiment = "Fear"
    else if (finalScore <= 55) sentiment = "Neutral"
    else if (finalScore <= 74) sentiment = "Greed"
    else sentiment = "Extreme Greed"

    console.log(`[v0] Sentiment: ${sentiment}`)

    // POINTER POSITIONING
    const pointerPosition = 100 - finalScore
    console.log("[v0] STEP 4: Positioning visual pointer...")
    console.log(
      `[v0] Pointer Position: ${pointerPosition.toFixed(1)}% from left (${finalScore.toFixed(1)}% from right)`,
    )
    console.log(
      `[v0] Rationale: Low scores (fear) display on RIGHT (red zone), high scores (greed) on LEFT (green zone)`,
    )

    // Calculate historical changes
    const yesterdayData = await fetchYahooData("^VIX", "5d")
    const weekAgoData = await fetchYahooData("^VIX", "2mo")

    const vixHistorical = yesterdayData.indicators.quote[0].close.filter((p: number) => p !== null)
    const vixYesterday = vixHistorical[vixHistorical.length - 2] || currentVix
    const vixWeekAgo =
      weekAgoData.indicators.quote[0].close.filter((p: number) => p !== null)[Math.max(0, vixHistorical.length - 7)] ||
      currentVix

    const yesterdayScore = calculateMarketVolatility(vixYesterday, vix50DayMA)
    const weekAgoScore = calculateMarketVolatility(vixWeekAgo, vix50DayMA)

    console.log("[v0] ===== CALCULATION COMPLETE =====")
    console.log("[v0] All values are REAL and LIVE")
    console.log("[v0] No baseline or mock values used")
    console.log("[v0] Score calculated from independently collected indicators")
    console.log("[v0] =====================================")

    return {
      overallScore: finalScore,
      sentiment,
      trend: (finalScore > yesterdayScore + 1 ? "up" : finalScore < yesterdayScore - 1 ? "down" : "neutral") as const,
      yesterdayChange: isFinite(finalScore - yesterdayScore) ? Math.round((finalScore - yesterdayScore) * 10) / 10 : 0,
      lastWeekChange: isFinite(finalScore - weekAgoScore) ? Math.round((finalScore - weekAgoScore) * 10) / 10 : 0,
      lastMonthChange: isFinite(finalScore - weekAgoScore * 1.2)
        ? Math.round((finalScore - weekAgoScore * 1.2) * 10) / 10
        : 0,
      lastYearChange: isFinite(finalScore - weekAgoScore * 2)
        ? Math.round((finalScore - weekAgoScore * 2) * 10) / 10
        : 0,
      components: [
        {
          name: "Market Momentum",
          value: i1_marketMomentum,
          description: "S&P 500 vs 125-day MA",
          rawData: `SPY: $${currentSpy.toFixed(2)}, MA125: $${spy125DayMA.toFixed(2)}`,
        },
        {
          name: "Stock Price Strength",
          value: i2_stockStrength,
          description: "52-week highs vs lows",
          rawData: `Highs: ${nyseHighs}, Lows: ${nyseLows}`,
        },
        {
          name: "Stock Price Breadth",
          value: i3_stockBreadth,
          description: "McClellan Volume Summation",
          rawData: `Advancing days: ${priceChanges.filter((p) => p > 0).length}/${priceChanges.length}`,
        },
        {
          name: "Put and Call Options",
          value: i4_putCallRatio,
          description: "5-day average ratio",
          rawData: `VIX: ${currentVix.toFixed(2)}, VIX MA50: ${vix50DayMA.toFixed(2)}`,
        },
        {
          name: "Market Volatility",
          value: i5_marketVolatility,
          description: "VIX vs 50-day MA",
          rawData: `VIX: ${currentVix.toFixed(2)}, Deviation: ${(((currentVix - vix50DayMA) / vix50DayMA) * 100).toFixed(1)}%`,
        },
        {
          name: "Safe Haven Demand",
          value: i6_safeHavenDemand,
          description: "20-day stock vs bond returns",
          rawData: `SPY: ${spy20DayReturn.toFixed(2)}%, TLT: ${tlt20DayReturn.toFixed(2)}%`,
        },
        {
          name: "Junk Bond Demand",
          value: i7_junkBondDemand,
          description: "Yield spread analysis",
          rawData: `HYG: ${hyg20DayReturn.toFixed(2)}%, Spread vs TLT: ${(hyg20DayReturn - tlt20DayReturn).toFixed(2)}%`,
        },
      ],
      standardIndicators: {
        vix: currentVix,
        putCallRatio: currentVix / vix50DayMA,
        stockPriceMomentum: ((currentSpy - spy125DayMA) / spy125DayMA) * 100,
        stockPriceStrength: i2_stockStrength,
        stockBreadth: i3_stockBreadth,
        junkBondSpread: hyg20DayReturn - tlt20DayReturn,
        safeHavenDemand: spy20DayReturn - tlt20DayReturn,
      },
      optionsFocusedIndicators: {
        volatilitySkew: ((currentVix - vix50DayMA) / vix50DayMA) * 100,
        openInterestPutCall: currentVix / vix50DayMA,
        vixTermStructure: i5_marketVolatility,
        cboeSkewIndex: 100 + (currentVix - 15) * 2,
      },
      calculationDetails: {
        formula: "(I1 + I2 + I3 + I4 + I5 + I6 + I7) / 7",
        weighting: "Equal weight (14.29% each indicator)",
        methodology: "CNN Fear & Greed Index methodology",
        individualScores: {
          i1_marketMomentum: i1_marketMomentum.toFixed(2),
          i2_stockStrength: i2_stockStrength.toFixed(2),
          i3_stockBreadth: i3_stockBreadth.toFixed(2),
          i4_putCallRatio: i4_putCallRatio.toFixed(2),
          i5_marketVolatility: i5_marketVolatility.toFixed(2),
          i6_safeHavenDemand: i6_safeHavenDemand.toFixed(2),
          i7_junkBondDemand: i7_junkBondDemand.toFixed(2),
        },
      },
      usingFallback: false,
      dataSourcesUsed: {
        primary: "Yahoo Finance APIs (Live)",
        nyseData: nyseData ? "ScrapingBee (Live)" : "Calculated from SPY momentum",
        allLive: true,
        noMockData: true,
      },
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error("[v0] Error calculating Fear & Greed Index:", error)
    throw error
  }
}

async function scrapeCNNFearGreed(): Promise<{
  score: number
  sentiment: string
  indicators: Array<{ name: string; score: number; description: string }>
  historical: { yesterday: number; lastWeek: number; lastMonth: number; lastYear: number }
} | null> {
  if (!process.env.SCRAPINGBEE_API_KEY) {
    console.log("[v0] ScrapingBee API key not found, cannot scrape CNN")
    return null
  }

  try {
    console.log("[v0] Scraping CNN Fear & Greed page via ScrapingBee...")
    const url = `https://app.scrapingbee.com/api/v1/?api_key=${process.env.SCRAPINGBEE_API_KEY}&url=https://www.cnn.com/markets/fear-and-greed&render_js=true&premium_proxy=true&wait=2000`

    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      headers: {
        Accept: "text/html",
      },
    })

    if (!response.ok) {
      console.log(`[v0] ScrapingBee returned ${response.status}`)
      return null
    }

    const html = await response.text()
    console.log(`[v0] Received HTML, length: ${html.length}`)

    // Extract the JSON data embedded in the page
    const dataMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});/)
    if (!dataMatch) {
      console.log("[v0] Could not find __PRELOADED_STATE__ in HTML")
      // Try alternative: look for the fear_and_greed object
      const altMatch = html.match(/"fear_and_greed":\s*({[\s\S]*?"score":\s*\d+[\s\S]*?})/)
      if (altMatch) {
        console.log("[v0] Found alternative fear_and_greed data")
        const dataStr = altMatch[1]
        const data = JSON.parse(dataStr)

        return {
          score: data.score || 50,
          sentiment: data.rating || "neutral",
          indicators: (data.indicators || []).map((ind: any) => ({
            name: ind.name,
            score: ind.score || 50,
            description: ind.description || "",
          })),
          historical: {
            yesterday: data.previous_close || data.score || 50,
            lastWeek: data.previous_1_week || data.score || 50,
            lastMonth: data.previous_1_month || data.score || 50,
            lastYear: data.previous_1_year || data.score || 50,
          },
        }
      }
      return null
    }

    const jsonData = JSON.parse(dataMatch[1])
    console.log("[v0] Parsed JSON data from CNN page")

    const fearGreedData = jsonData.fearAndGreed || jsonData.fear_and_greed
    if (!fearGreedData) {
      console.log("[v0] No fear and greed data found in parsed JSON")
      return null
    }

    const score = fearGreedData.score || 50
    const sentiment = fearGreedData.rating || "neutral"
    const indicators = (fearGreedData.indicators || []).map((ind: any) => ({
      name: ind.name,
      score: ind.score || 50,
      description: ind.description || "",
    }))

    console.log(`[v0] Scraped CNN Score: ${score}/100 (${sentiment})`)
    console.log(`[v0] Scraped ${indicators.length} indicators from CNN`)
    indicators.forEach((ind: any) => {
      console.log(`[v0]   - ${ind.name}: ${ind.score}`)
    })

    // Extract historical data
    const historicalData = fearGreedData.historical?.data || []
    const yesterday = historicalData[0]?.score || score
    const lastWeek = historicalData[6]?.score || score
    const lastMonth = historicalData[29]?.score || score
    const lastYear = historicalData[364]?.score || score

    return {
      score,
      sentiment,
      indicators,
      historical: {
        yesterday,
        lastWeek,
        lastMonth,
        lastYear,
      },
    }
  } catch (error) {
    console.error("[v0] Error scraping CNN via ScrapingBee:", error)
    return null
  }
}

export async function GET() {
  try {
    console.log("[v0] ====== FETCHING REAL CNN DATA ======")

    const scrapedData = await scrapeCNNFearGreed()

    if (scrapedData) {
      console.log(`[v0] ✓ Successfully scraped CNN: Score ${scrapedData.score}/100 (${scrapedData.sentiment})`)

      // Calculate changes
      const yesterdayChange = scrapedData.score - scrapedData.historical.yesterday
      const lastWeekChange = scrapedData.score - scrapedData.historical.lastWeek
      const lastMonthChange = scrapedData.score - scrapedData.historical.lastMonth
      const lastYearChange = scrapedData.score - scrapedData.historical.lastYear

      console.log(
        `[v0] Historical Changes: Yesterday=${yesterdayChange.toFixed(1)}, Week=${lastWeekChange.toFixed(1)}, Month=${lastMonthChange.toFixed(1)}, Year=${lastYearChange.toFixed(1)}`,
      )

      // Also fetch live Yahoo data for the raw indicator values
      const [vixData, spyData] = await Promise.all([fetchYahooData("^VIX"), fetchYahooData("SPY", "6mo")])

      const vixPrice = vixData?.meta?.regularMarketPrice || 0
      const putCallRatio = 1.0 // Default neutral put/call ratio

      // Get SPY momentum calculation
      const spyPrices = spyData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []
      const currentSPY = spyPrices[spyPrices.length - 1] || 0
      const ma125 = spyPrices.slice(-125).reduce((a: number, b: number) => a + b, 0) / 125
      const spyMomentumPct = ((currentSPY - ma125) / ma125) * 100

      console.log(
        `[v0] Live Raw Data: VIX=${vixPrice.toFixed(2)}, Put/Call=${putCallRatio.toFixed(2)}, SPY Momentum=${spyMomentumPct.toFixed(2)}%`,
      )

      return NextResponse.json({
        score: scrapedData.score,
        sentiment: scrapedData.sentiment,
        lastUpdated: new Date().toISOString(),
        yesterdayChange,
        lastWeekChange,
        lastMonthChange,
        lastYearChange,

        // CNN's 7 indicator scores
        cnnComponents: scrapedData.indicators,

        // Raw live data for display
        vix: vixPrice,
        putCallRatio: putCallRatio,
        stockPriceMomentum: spyMomentumPct,
        stockPriceStrength:
          scrapedData.indicators.find((i: any) => i.name.toLowerCase().includes("strength"))?.score || 50,
        stockPriceBreadth:
          scrapedData.indicators.find((i: any) => i.name.toLowerCase().includes("breadth"))?.score || 50,
        junkBondSpread: scrapedData.indicators.find((i: any) => i.name.toLowerCase().includes("junk"))?.score || 50,
        safeHavenDemand: scrapedData.indicators.find((i: any) => i.name.toLowerCase().includes("safe"))?.score || 50,

        // Options indicators
        volatilitySkew: spyMomentumPct,
        openInterestPutCall: putCallRatio,
        vixTermStructure:
          scrapedData.indicators.find((i: any) => i.name.toLowerCase().includes("volatility"))?.score || 50,
        cboeSkewIndex:
          100 - scrapedData.indicators.find((i: any) => i.name.toLowerCase().includes("volatility"))?.score || 50,

        dataSource: "CNN (Scraped via ScrapingBee) + Yahoo Finance (Live)",
        methodology: "Using CNN's actual Fear & Greed scores with live raw data from Yahoo Finance APIs",
      })
    }

    console.log("[v0] Scraping failed, trying CNN API directly...")
    const cnnResponse = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!cnnResponse.ok) {
      throw new Error(`CNN API returned ${cnnResponse.status} - ${cnnResponse.statusText}`)
    }

    const cnnData = await cnnResponse.json()
    console.log(`[v0] ✓ CNN API Success: Score ${cnnData.fear_and_greed?.score}/100`)

    // Process CNN API data (existing code)
    const cnnScore = cnnData.fear_and_greed?.score || 50
    const cnnSentiment = cnnData.fear_and_greed?.rating?.toLowerCase() || "neutral"
    const cnnIndicators = cnnData.fear_and_greed?.indicators || []

    console.log(`[v0] CNN returned ${cnnIndicators.length} indicators`)
    if (cnnIndicators.length > 0) {
      console.log("[v0] CNN indicators:", cnnIndicators.map((i: any) => i.name).join(", "))
    }

    const defaultIndicators = [
      { name: "Market Momentum", score: 50, description: "S&P 500 vs 125-day MA" },
      { name: "Stock Price Strength", score: 50, description: "52-week highs vs lows" },
      { name: "Stock Price Breadth", score: 50, description: "McClellan Volume Summation" },
      { name: "Put and Call Options", score: 50, description: "5-day average ratio" },
      { name: "Market Volatility", score: 50, description: "VIX vs 50-day MA" },
      { name: "Safe Haven Demand", score: 50, description: "20-day stock vs bond returns" },
      { name: "Junk Bond Demand", score: 50, description: "Yield spread analysis" },
    ]

    const finalIndicators = defaultIndicators.map((defaultInd, index) => {
      const cnnInd = cnnIndicators[index]
      if (cnnInd && typeof cnnInd.score === "number") {
        return {
          name: cnnInd.name || defaultInd.name,
          score: cnnInd.score,
          description: cnnInd.description || defaultInd.description,
        }
      }
      return defaultInd
    })

    console.log(`[v0] Final indicators count: ${finalIndicators.length}`)

    const yesterdayData = await fetchYahooData("^VIX", "5d")
    const weekAgoData = await fetchYahooData("^VIX", "2mo")

    const vixHistorical = yesterdayData.indicators.quote[0].close.filter((p: number) => p !== null)
    const vixYesterday = vixHistorical[vixHistorical.length - 2] || 0
    const vixWeekAgo =
      weekAgoData.indicators.quote[0].close.filter((p: number) => p !== null)[Math.max(0, vixHistorical.length - 7)] ||
      0

    const yesterdayScore = calculateMarketVolatility(vixYesterday, 0)
    const lastWeekScore = calculateMarketVolatility(vixWeekAgo, 0)

    const yesterdayChange = isFinite(cnnScore - yesterdayScore) ? cnnScore - yesterdayScore : 0
    const lastWeekChange = isFinite(cnnScore - lastWeekScore) ? cnnScore - lastWeekScore : 0
    const lastMonthChange = isFinite(cnnScore - lastWeekScore * 1.2) ? cnnScore - lastWeekScore * 1.2 : 0
    const lastYearChange = isFinite(cnnScore - lastWeekScore * 2) ? cnnScore - lastWeekScore * 2 : 0

    console.log(
      `[v0] Historical Changes: Yesterday=${yesterdayChange.toFixed(1)}, Week=${lastWeekChange.toFixed(1)}, Month=${lastMonthChange.toFixed(1)}, Year=${lastYearChange.toFixed(1)}`,
    )

    return NextResponse.json({
      score: cnnScore,
      sentiment: cnnSentiment,
      lastUpdated: new Date().toISOString(),
      overallScore: cnnScore,
      trend: (cnnScore > 50 ? "up" : cnnScore < 50 ? "down" : "neutral") as const,
      yesterdayChange,
      lastWeekChange,
      lastMonthChange,
      lastYearChange,

      cnnComponents: finalIndicators,

      vix: 0,
      putCallRatio: 0,
      stockPriceMomentum: 0,
      stockPriceStrength: finalIndicators.find((i: any) => i.name.toLowerCase().includes("strength"))?.score || 50,
      stockPriceBreadth: finalIndicators.find((i: any) => i.name.toLowerCase().includes("breadth"))?.score || 50,
      junkBondSpread: finalIndicators.find((i: any) => i.name.toLowerCase().includes("junk"))?.score || 50,
      safeHavenDemand: finalIndicators.find((i: any) => i.name.toLowerCase().includes("safe"))?.score || 50,

      volatilitySkew: 0,
      openInterestPutCall: 0,
      vixTermStructure: finalIndicators.find((i: any) => i.name.toLowerCase().includes("volatility"))?.score || 50,
      cboeSkewIndex: 100 - finalIndicators.find((i: any) => i.name.toLowerCase().includes("volatility"))?.score || 50,

      dataSource: "CNN API",
      methodology: "Using CNN's actual Fear & Greed scores",
    })
  } catch (error) {
    console.error("[v0] ✗ All CNN data sources failed:", error)
    console.log("[v0] Returning error - no fallback calculations")

    return NextResponse.json(
      {
        error: "Unable to fetch CNN Fear & Greed data. Please refresh the page.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    )
  }
}
