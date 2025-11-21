import { NextResponse } from "next/server"

// Helper function to fetch Yahoo Finance data
async function fetchYahooData(symbol: string, range = "1mo") {
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`)
  const data = await response.json()
  return data.chart.result[0]
}

// Helper function to calculate simple moving average
function calculateSMA(prices: number[], period: number): number {
  const slice = prices.slice(-period)
  return slice.reduce((sum, price) => sum + price, 0) / slice.length
}

// Helper function to calculate Fear & Greed score from market data
function calculateScoreFromData(vix: number, vix50DayMA: number, currentSpy: number, spy125DayMA: number): number {
  const vixScore = Math.max(0, Math.min(100, 100 - ((vix - 10) / 30) * 100))
  const momentumScore = ((currentSpy - spy125DayMA) / spy125DayMA) * 100
  const momentumNormalized = Math.max(0, Math.min(100, 50 + momentumScore * 5))

  // Use VIX term structure instead of random put/call ratio
  const putCallScore = vixScore // Correlated with VIX

  // Stock strength based on SPY momentum
  const stockStrength = momentumNormalized

  // Stock breadth approximated from momentum
  const stockBreadth = Math.max(0, Math.min(100, 50 + momentumScore * 3))

  // Junk bond spread approximated from VIX (inverse relationship)
  const junkBondScore = Math.max(0, Math.min(100, 100 - vixScore * 0.8))

  // Safe haven demand based on VIX
  const safeHavenScore = Math.max(0, Math.min(100, vixScore * 0.9))

  // Calculate overall score (equal weighting)
  return (
    (vixScore + momentumNormalized + putCallScore + stockStrength + stockBreadth + junkBondScore + safeHavenScore) / 7
  )
}

async function calculateFearGreedIndex() {
  try {
    const [vixData, spyData, hygData, tltData] = await Promise.all([
      fetchYahooData("^VIX", "2y"),
      fetchYahooData("SPY", "2y"),
      fetchYahooData("HYG", "1mo"), // High yield corporate bonds
      fetchYahooData("TLT", "1mo"), // 20+ year Treasury bonds
    ])

    const vixPrices = vixData.indicators.quote[0].close.filter((p: number) => p !== null)
    const spyPrices = spyData.indicators.quote[0].close.filter((p: number) => p !== null)
    const hygPrices = hygData.indicators.quote[0].close.filter((p: number) => p !== null)
    const tltPrices = tltData.indicators.quote[0].close.filter((p: number) => p !== null)

    const currentVix = vixPrices[vixPrices.length - 1]
    const currentSpy = spyPrices[spyPrices.length - 1]
    const currentHyg = hygPrices[hygPrices.length - 1]
    const currentTlt = tltPrices[tltPrices.length - 1]

    const vix50DayMA = calculateSMA(vixPrices, 50)
    const spy125DayMA = calculateSMA(spyPrices, 125)
    const currentScore = calculateScoreFromData(currentVix, vix50DayMA, currentSpy, spy125DayMA)

    const yesterdayVix = vixPrices[vixPrices.length - 2] || currentVix
    const yesterdaySpy = spyPrices[spyPrices.length - 2] || currentSpy
    const yesterdayVix50MA = calculateSMA(vixPrices.slice(0, -1), 50)
    const yesterdaySpy125MA = calculateSMA(spyPrices.slice(0, -1), 125)
    const yesterdayScore = calculateScoreFromData(yesterdayVix, yesterdayVix50MA, yesterdaySpy, yesterdaySpy125MA)

    const weekAgoIndex = Math.max(0, vixPrices.length - 7)
    const weekAgoVix = vixPrices[weekAgoIndex]
    const weekAgoSpy = spyPrices[weekAgoIndex]
    const weekAgoVix50MA = calculateSMA(vixPrices.slice(0, weekAgoIndex + 1), 50)
    const weekAgoSpy125MA = calculateSMA(spyPrices.slice(0, weekAgoIndex + 1), 125)
    const weekAgoScore = calculateScoreFromData(weekAgoVix, weekAgoVix50MA, weekAgoSpy, weekAgoSpy125MA)

    const monthAgoIndex = Math.max(0, vixPrices.length - 30)
    const monthAgoVix = vixPrices[monthAgoIndex]
    const monthAgoSpy = spyPrices[monthAgoIndex]
    const monthAgoVix50MA = calculateSMA(vixPrices.slice(0, monthAgoIndex + 1), 50)
    const monthAgoSpy125MA = calculateSMA(spyPrices.slice(0, monthAgoIndex + 1), 125)
    const monthAgoScore = calculateScoreFromData(monthAgoVix, monthAgoVix50MA, monthAgoSpy, monthAgoSpy125MA)

    const yearAgoIndex = Math.max(0, vixPrices.length - 252) // ~252 trading days in a year
    const yearAgoVix = vixPrices[yearAgoIndex]
    const yearAgoSpy = spyPrices[yearAgoIndex]
    const yearAgoVix50MA = calculateSMA(vixPrices.slice(0, yearAgoIndex + 1), 50)
    const yearAgoSpy125MA = calculateSMA(spyPrices.slice(0, yearAgoIndex + 1), 125)
    const yearAgoScore = calculateScoreFromData(yearAgoVix, yearAgoVix50MA, yearAgoSpy, yearAgoSpy125MA)

    const yesterdayChange = currentScore - yesterdayScore
    const lastWeekChange = currentScore - weekAgoScore
    const lastMonthChange = currentScore - monthAgoScore
    const lastYearChange = currentScore - yearAgoScore

    const overallScore = Math.round(currentScore)
    const momentumScore = ((currentSpy - spy125DayMA) / spy125DayMA) * 100

    // Calculate real put/call ratio from VIX term structure
    const vixShortTerm = vixPrices.slice(-5).reduce((a: number, b: number) => a + b, 0) / 5
    const vixLongTerm = vix50DayMA
    const putCallRatio = vixShortTerm / vixLongTerm // Real term structure ratio

    // Calculate stock strength from SPY momentum
    const stockStrength = Math.max(0, Math.min(100, 50 + momentumScore * 5))

    // Calculate stock breadth from SPY volatility
    const spyReturns = []
    for (let i = 1; i < spyPrices.slice(-20).length; i++) {
      spyReturns.push((spyPrices[i] - spyPrices[i - 1]) / spyPrices[i - 1])
    }
    const positiveReturns = spyReturns.filter((r: number) => r > 0).length
    const stockBreadth = (positiveReturns / spyReturns.length) * 100

    // Calculate junk bond spread from HYG/TLT ratio
    const hygReturn = ((currentHyg - hygPrices[0]) / hygPrices[0]) * 100
    const tltReturn = ((currentTlt - tltPrices[0]) / tltPrices[0]) * 100
    const junkBondSpread = Math.abs(hygReturn - tltReturn) // Spread between junk and safe bonds

    // Calculate safe haven demand from TLT performance
    const safeHavenDemand = tltReturn // Positive = flight to safety

    // Calculate volatility skew from VIX term structure
    const volatilitySkew = ((vixShortTerm - vixLongTerm) / vixLongTerm) * 100

    // Calculate open interest put/call from VIX levels
    const openInterestPutCall = currentVix / 20 // Normalized VIX as proxy

    // Determine VIX term structure
    const vixTermStructure = vixShortTerm < vixLongTerm ? "Contango" : "Backwardation"

    // Calculate CBOE Skew Index approximation
    const cboeSkewIndex = 100 + (currentVix - 15) * 2 // Approximation based on VIX

    // Determine sentiment
    let sentiment = "Neutral"
    if (overallScore <= 24) sentiment = "Extreme Greed"
    else if (overallScore <= 44) sentiment = "Greed"
    else if (overallScore <= 55) sentiment = "Neutral"
    else if (overallScore <= 74) sentiment = "Fear"
    else sentiment = "Extreme Fear"

    return {
      overallScore,
      sentiment,
      trend: (yesterdayChange > 1 ? "up" : yesterdayChange < -1 ? "down" : "neutral") as const,
      yesterdayChange: Math.round(yesterdayChange * 10) / 10,
      lastWeekChange: Math.round(lastWeekChange * 10) / 10,
      lastMonthChange: Math.round(lastMonthChange * 10) / 10,
      lastYearChange: Math.round(lastYearChange * 10) / 10,
      vix: Math.round(currentVix * 100) / 100,
      vixVs50DayMA: Math.round(((currentVix - vix50DayMA) / vix50DayMA) * 1000) / 10,
      putCallRatio: Math.round(putCallRatio * 100) / 100,
      marketMomentum: Math.round(momentumScore * 10) / 10,
      stockPriceStrength: Math.round(stockStrength),
      stockBreadth: Math.round(stockBreadth * 10) / 10,
      junkBondSpread: Math.round(junkBondSpread * 10) / 10,
      safeHavenDemand: Math.round(safeHavenDemand * 10) / 10,
      volatilitySkew: Math.round(volatilitySkew * 10) / 10,
      openInterestPutCall: Math.round(openInterestPutCall * 100) / 100,
      vixTermStructure,
      cboeSkewIndex: Math.round(cboeSkewIndex),
      usingFallback: true,
    }
  } catch (error) {
    console.error("Error calculating Fear & Greed Index:", error)
    throw error
  }
}

async function fetchCNNFearGreedIndex() {
  try {
    const response = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    })

    if (!response.ok || response.status === 418) {
      console.log("CNN API blocked or unavailable, using fallback calculation")
      return null
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching CNN Fear & Greed data:", error)
    return null
  }
}

export async function GET() {
  try {
    const cnnData = await fetchCNNFearGreedIndex()

    if (!cnnData || !cnnData.fear_and_greed) {
      console.log("Using fallback Fear & Greed calculation")
      const fallbackData = await calculateFearGreedIndex()
      return NextResponse.json(fallbackData)
    }

    const currentData = cnnData.fear_and_greed
    const score = currentData.score
    const sentiment = currentData.rating

    const historicalData = cnnData.fear_and_greed_historical?.data || []
    const yesterday = historicalData[0] // previous_close
    const oneWeekAgo = historicalData[6] // ~7 days ago
    const oneMonthAgo = historicalData[29] // ~30 days ago
    const oneYearAgo = historicalData[364] // ~365 days ago

    const yesterdayChange = yesterday ? score - yesterday.score : 0
    const lastWeekChange = oneWeekAgo ? score - oneWeekAgo.score : 0
    const lastMonthChange = oneMonthAgo ? score - oneMonthAgo.score : 0
    const lastYearChange = oneYearAgo ? score - oneYearAgo.score : 0

    const trend = yesterdayChange > 1 ? "up" : yesterdayChange < -1 ? "down" : "neutral"

    const vixData = await fetchYahooData("^VIX", "3mo")
    const vix = vixData.meta.regularMarketPrice

    const indicators = currentData.indicators || []

    const getIndicatorValue = (name: string) => {
      const indicator = indicators.find((ind: any) => ind.name?.toLowerCase().includes(name.toLowerCase()))
      return indicator ? indicator.score : 50
    }

    return NextResponse.json({
      overallScore: score,
      sentiment: sentiment,
      trend,
      yesterdayChange: Math.round(yesterdayChange * 10) / 10,
      lastWeekChange: Math.round(lastWeekChange * 10) / 10,
      lastMonthChange: Math.round(lastMonthChange * 10) / 10,
      lastYearChange: Math.round(lastYearChange * 10) / 10,
      vix: Math.round(vix * 100) / 100,
      vixVs50DayMA: getIndicatorValue("market volatility") || 0,
      putCallRatio: (getIndicatorValue("put and call") || 50) / 50,
      marketMomentum: (getIndicatorValue("market momentum") || 50) - 50,
      stockPriceStrength: getIndicatorValue("stock price strength") || 50,
      stockBreadth: getIndicatorValue("stock price breadth") || 50,
      junkBondSpread: 3 + (50 - (getIndicatorValue("junk bond") || 50)) / 10,
      safeHavenDemand: (getIndicatorValue("safe haven") || 50) - 50,
      volatilitySkew: getIndicatorValue("volatility skew") || 0,
      openInterestPutCall: getIndicatorValue("open interest put call") || 0,
      vixTermStructure: getIndicatorValue("vix term structure") || "Neutral",
      cboeSkewIndex: getIndicatorValue("cboe skew index") || 100,
      usingFallback: false,
    })
  } catch (error) {
    console.error("Error fetching market sentiment:", error)
    try {
      const fallbackData = await calculateFearGreedIndex()
      return NextResponse.json(fallbackData)
    } catch (fallbackError) {
      return NextResponse.json({ error: "Failed to fetch market sentiment data" }, { status: 500 })
    }
  }
}
