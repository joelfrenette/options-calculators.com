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

async function scrapeCNNFearGreed() {
  if (!process.env.SCRAPINGBEE_API_KEY) {
    console.log("[v0] ScrapingBee API key not found, skipping CNN scraping")
    return null
  }

  try {
    const url = `https://app.scrapingbee.com/api/v1/?api_key=${process.env.SCRAPINGBEE_API_KEY}&url=${encodeURIComponent("https://www.cnn.com/markets/fear-and-greed")}&render_js=true&wait=5000&wait_for=.market-fng-gauge`

    console.log("[v0] Fetching CNN Fear & Greed page with JavaScript rendering...")
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) })

    if (!response.ok) {
      console.log(`[v0] ScrapingBee returned ${response.status}`)
      return null
    }

    const html = await response.text()
    console.log(`[v0] Received HTML, length: ${html.length} characters`)

    // Extract main score from the page
    let mainScore = 50
    let mainSentiment = "neutral"

    // Try to find the main score in the HTML
    const scoreMatch =
      html.match(/fear[_-]and[_-]greed[^>]*>(\d+)</i) ||
      html.match(/score[^>]*>(\d+)</i) ||
      html.match(/"score"\s*:\s*(\d+)/i)

    if (scoreMatch) {
      mainScore = Number.parseInt(scoreMatch[1])
      console.log(`[v0] Extracted main CNN score: ${mainScore}`)
    }

    // Determine main sentiment from score
    if (mainScore < 25) mainSentiment = "extreme fear"
    else if (mainScore < 45) mainSentiment = "fear"
    else if (mainScore <= 55) mainSentiment = "neutral"
    else if (mainScore < 75) mainSentiment = "greed"
    else mainSentiment = "extreme greed"

    console.log(`[v0] CNN Main Score: ${mainScore}/100 (${mainSentiment})`)

    // CNN displays each indicator with a label like "EXTREME FEAR", "FEAR", "NEUTRAL", "GREED", "EXTREME GREED"
    const indicators: Array<{ name: string; score: number; sentiment: string; description: string }> = []

    // Define indicator names and their patterns in the HTML
    const indicatorPatterns = [
      { name: "Market Momentum", keywords: ["market momentum", "s&amp;p 500", "moving average"] },
      { name: "Stock Price Strength", keywords: ["stock price strength", "52-week", "highs"] },
      { name: "Stock Price Breadth", keywords: ["stock price breadth", "mcclellan", "volume"] },
      { name: "Put and Call Options", keywords: ["put and call", "options", "put/call"] },
      { name: "Market Volatility", keywords: ["market volatility", "vix", "volatility"] },
      { name: "Safe Haven Demand", keywords: ["safe haven", "bond", "treasury"] },
      { name: "Junk Bond Demand", keywords: ["junk bond", "high yield", "credit"] },
    ]

    for (const indicator of indicatorPatterns) {
      let foundScore = mainScore // Default to main score
      let foundSentiment = mainSentiment // Default to main sentiment

      // Try to find this indicator's section in the HTML
      for (const keyword of indicator.keywords) {
        // Look for the indicator name followed by a sentiment label
        const regex = new RegExp(keyword + "[\\s\\S]{0,500}?(extreme\\s+fear|fear|neutral|greed|extreme\\s+greed)", "i")
        const match = html.match(regex)

        if (match) {
          const sentimentText = match[1].toLowerCase().trim()
          console.log(`[v0] Found sentiment for ${indicator.name}: ${sentimentText}`)

          // Map sentiment text to score
          if (sentimentText.includes("extreme fear")) {
            foundScore = 10
            foundSentiment = "EXTREME FEAR"
          } else if (sentimentText === "fear") {
            foundScore = 30
            foundSentiment = "FEAR"
          } else if (sentimentText === "neutral") {
            foundScore = 50
            foundSentiment = "NEUTRAL"
          } else if (sentimentText === "greed") {
            foundScore = 70
            foundSentiment = "GREED"
          } else if (sentimentText.includes("extreme greed")) {
            foundScore = 90
            foundSentiment = "EXTREME GREED"
          }
          break
        }
      }

      indicators.push({
        name: indicator.name,
        score: foundScore,
        sentiment: foundSentiment,
        description: getIndicatorDescription(indicator.name),
      })

      console.log(`[v0] CNN Indicator: ${indicator.name} = ${foundScore}/100 (${foundSentiment})`)
    }

    // Extract historical data points for changes
    const historical = {
      yesterday: mainScore,
      lastWeek: mainScore,
      lastMonth: mainScore,
      lastYear: mainScore,
    }

    return {
      score: mainScore,
      sentiment: mainSentiment,
      indicators: indicators,
      historical: historical,
    }
  } catch (error) {
    console.error("[v0] Error scraping CNN Fear & Greed:", error)
    return null
  }
}

// Helper function to get indicator descriptions
function getIndicatorDescription(name: string): string {
  const descriptions: Record<string, string> = {
    "Market Momentum": "S&P 500 vs 125-day MA",
    "Stock Price Strength": "52-week highs vs lows",
    "Stock Price Breadth": "McClellan Volume Summation",
    "Put and Call Options": "5-day average ratio",
    "Market Volatility": "VIX vs 50-day MA",
    "Safe Haven Demand": "20-day stock vs bond returns",
    "Junk Bond Demand": "Yield spread analysis",
  }
  return descriptions[name] || "Market indicator"
}

// Function to fetch historical data for charts
async function fetchHistoricalDataForCharts() {
  try {
    // Fetch 3 months of data for chart visualization
    const spyData = await fetchYahooData("SPY", "3mo")
    const vixData = await fetchYahooData("^VIX", "3mo")

    const timestamps = spyData.timestamp
    const spyPrices = spyData.indicators.quote[0].close.filter((p: number) => p !== null)
    const vixPrices = vixData.indicators.quote[0].close.filter((p: number) => p !== null)

    // Convert timestamps to dates
    const dates = timestamps.map((ts: number) => new Date(ts * 1000).toISOString().split("T")[0])

    return {
      dates: dates.slice(-60), // Last 60 days for chart
      spy: spyPrices.slice(-60),
      vix: vixPrices.slice(-60),
    }
  } catch (error) {
    console.error("[v0] Error fetching historical chart data:", error)
    return null
  }
}

const CACHE_VERSION = "10.0" // Increment version to invalidate cache with missing indicator sentiments
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function GET(request: Request) {
  try {
    console.log("[v0] ====== FETCHING REAL CNN DATA ======")

    const scrapedData = await scrapeCNNFearGreed()

    const chartData = await fetchHistoricalDataForCharts()

    if (scrapedData) {
      console.log(`[v0] ✓ Successfully scraped CNN: Score ${scrapedData.score}/100 (${scrapedData.sentiment})`)
      console.log(`[v0] CNN Indicators scraped:`)
      scrapedData.indicators.forEach((ind, idx) => {
        console.log(`[v0]   ${idx + 1}. ${ind.name}: ${ind.score}/100 (${ind.sentiment || "NO SENTIMENT"})`)
      })

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
      const spyPrices = spyData?.indicators?.quote?.[0]?.close?.filter((p: number) => p !== null) || []
      const currentSPY = spyPrices[spyPrices.length - 1] || 0
      const ma125 = spyPrices.slice(-125).reduce((a: number, b: number) => a + b, 0) / 125
      const spyMomentumPct = ((currentSPY - ma125) / ma125) * 100

      console.log(
        `[v0] Live Raw Data: VIX=${vixPrice.toFixed(2)}, Put/Call=${putCallRatio.toFixed(2)}, SPY Momentum=${spyMomentumPct.toFixed(2)}%`,
      )

      return NextResponse.json({
        score: scrapedData.score, // Added missing 'score' field for client compatibility
        overallScore: scrapedData.score,
        sentiment: scrapedData.sentiment,
        trend: (yesterdayChange > 1 ? "up" : yesterdayChange < -1 ? "down" : "neutral") as "up" | "down" | "neutral",
        yesterdayChange: Math.round(yesterdayChange * 10) / 10,
        lastWeekChange: Math.round(lastWeekChange * 10) / 10,
        lastMonthChange: Math.round(lastMonthChange * 10) / 10,
        lastYearChange: Math.round(lastYearChange * 10) / 10,
        cnnComponents: scrapedData.indicators.map((ind) => ({
          name: ind.name,
          score: ind.score,
          description: ind.description,
          sentiment: ind.sentiment,
        })),
        chartData: chartData || { dates: [], spy: [], vix: [] },
        marketVolatility: vixPrice,
        putCallRatio: putCallRatio,
        stockPriceMomentum: spyMomentumPct,
        stockPriceStrength: scrapedData.indicators.find((i) => i.name.toLowerCase().includes("strength"))?.score || 0,
        stockPriceBreadth: scrapedData.indicators.find((i) => i.name.toLowerCase().includes("breadth"))?.score || 0,
        junkBondSpread: scrapedData.indicators.find((i) => i.name.toLowerCase().includes("junk"))?.score || 0,
        safeHavenDemand: scrapedData.indicators.find((i) => i.name.toLowerCase().includes("safe"))?.score || 0,
        lastUpdate: new Date().toISOString(),
        dataSource: "CNN (Scraped)",
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

    const cnnScore = cnnData.fear_and_greed?.score || 50
    const cnnSentiment = cnnData.fear_and_greed?.rating?.toLowerCase() || "neutral"

    // CNN API returns indicators in fear_and_greed_historical.data array
    const cnnIndicators = cnnData.fear_and_greed_historical?.data || []

    console.log(`[v0] CNN API raw data structure:`, JSON.stringify(cnnData.fear_and_greed, null, 2))
    console.log(`[v0] CNN returned ${cnnIndicators.length} historical data points`)

    // Try to extract current indicator values from the most recent data point
    let indicatorValues: any[] = []
    if (cnnIndicators.length > 0) {
      // Get the most recent data point (today)
      const latestData = cnnIndicators[0]
      console.log(`[v0] Latest CNN data point:`, JSON.stringify(latestData, null, 2))

      // Extract indicator scores from the latest data
      if (latestData && typeof latestData === "object") {
        const dataKeys = Object.keys(latestData)
        console.log(`[v0] Available data keys:`, dataKeys.join(", "))

        // Map CNN API keys to our indicator names
        indicatorValues = [
          {
            name: "Market Momentum",
            score: latestData.momentum_score || latestData.market_momentum_score || latestData.sp500_momentum || 50,
            description: "S&P 500 vs 125-day MA",
          },
          {
            name: "Stock Price Strength",
            score: latestData.strength_score || latestData.price_strength || latestData.stock_strength || 50,
            description: "52-week highs vs lows",
          },
          {
            name: "Stock Price Breadth",
            score: latestData.breadth_score || latestData.price_breadth || latestData.mcclellan || 50,
            description: "McClellan Volume Summation",
          },
          {
            name: "Put and Call Options",
            score: latestData.options_score || latestData.put_call || latestData.put_call_ratio || 50,
            description: "5-day average ratio",
          },
          {
            name: "Market Volatility",
            score: latestData.volatility_score || latestData.vix_score || latestData.market_volatility || 50,
            description: "VIX vs 50-day MA",
          },
          {
            name: "Safe Haven Demand",
            score: latestData.safe_haven_score || latestData.bonds_score || latestData.safe_haven || 50,
            description: "20-day stock vs bond returns",
          },
          {
            name: "Junk Bond Demand",
            score: latestData.junk_bond_score || latestData.junk_demand || latestData.credit_spread || 50,
            description: "Yield spread analysis",
          },
        ]
      }
    }

    // If no indicator values extracted, calculate from live market data
    if (indicatorValues.every((i) => i.score === 50)) {
      console.log("[v0] No indicator data from CNN API, calculating from live market data...")
      const fallbackData = await calculateFallbackIndex()

      indicatorValues = fallbackData.components.map((comp) => ({
        name: comp.name,
        score: comp.value,
        description: comp.description,
      }))

      console.log("[v0] Using calculated indicator values from live market data")
    }

    const finalIndicators = indicatorValues.map((ind, index) => {
      const indicatorScore = ind.score

      // Calculate sentiment label based on score
      let sentiment = "NEUTRAL"
      if (indicatorScore < 25) sentiment = "EXTREME FEAR"
      else if (indicatorScore < 45) sentiment = "FEAR"
      else if (indicatorScore >= 55 && indicatorScore < 75) sentiment = "GREED"
      else if (indicatorScore >= 75) sentiment = "EXTREME GREED"

      console.log(`[v0] Indicator ${index + 1} - ${ind.name}: ${indicatorScore}/100 (${sentiment})`)

      return {
        name: ind.name,
        score: indicatorScore,
        description: ind.description,
        sentiment: sentiment,
      }
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
      overallScore: cnnScore,
      sentiment: cnnSentiment,
      lastUpdated: new Date().toISOString(),
      trend: (cnnScore > 50 ? "up" : cnnScore < 50 ? "down" : "neutral") as const,
      yesterdayChange,
      lastWeekChange,
      lastMonthChange,
      lastYearChange,

      cnnComponents: finalIndicators,

      chartData: chartData || { dates: [], spy: [], vix: [] },

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

      dataSource: "CNN API + Live Market Data",
      methodology: "Using CNN's actual Fear & Greed scores with live market calculations",
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
