import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

interface YahooQuote {
  regularMarketPrice: number
  regularMarketChange: number
  regularMarketChangePercent: number
  regularMarketVolume: number
  averageDailyVolume10Day: number
}

async function fetchYahooQuote(symbol: string): Promise<YahooQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`
    const response = await fetch(url, { next: { revalidate: 300 } })
    const data = await response.json()

    console.log(`[v0] Fetching quote for ${symbol}`)

    if (data.chart?.result?.[0]?.meta) {
      const meta = data.chart.result[0].meta
      const currentPrice = meta.regularMarketPrice || 0
      let change = meta.regularMarketChange || 0
      let changePercent = meta.regularMarketChangePercent || 0

      if (change === 0 && currentPrice > 0) {
        const previousClose = meta.previousClose || meta.chartPreviousClose
        if (previousClose && previousClose > 0) {
          change = currentPrice - previousClose
          changePercent = (change / previousClose) * 100
          console.log(`[v0] ${symbol} - Calculated change from previousClose: ${previousClose}`)
        } else {
          // Fallback: use last close from historical data
          const closes = data.chart.result[0].indicators?.quote?.[0]?.close || []
          const validCloses = closes.filter((c: number) => c && c > 0)
          if (validCloses.length >= 2) {
            const lastClose = validCloses[validCloses.length - 2]
            change = currentPrice - lastClose
            changePercent = (change / lastClose) * 100
            console.log(`[v0] ${symbol} - Calculated change from last historical close: ${lastClose}`)
          }
        }
      }

      console.log(`[v0] ${symbol} raw data:`, {
        price: currentPrice,
        change: change,
        changePercent: changePercent,
        previousClose: meta.previousClose,
      })

      return {
        regularMarketPrice: currentPrice,
        regularMarketChange: change,
        regularMarketChangePercent: changePercent,
        regularMarketVolume: meta.regularMarketVolume || 0,
        averageDailyVolume10Day: meta.averageDailyVolume10Day || 0,
      }
    }
    console.log(`[v0] ${symbol} - No data in response`)
    return null
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error)
    return null
  }
}

async function fetchHistoricalData(symbol: string, days = 180) {
  try {
    const endDate = Math.floor(Date.now() / 1000)
    const startDate = endDate - days * 24 * 60 * 60
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${startDate}&period2=${endDate}`

    const response = await fetch(url, { next: { revalidate: 3600 } })
    const data = await response.json()

    if (data.chart?.result?.[0]) {
      const result = data.chart.result[0]
      const timestamps = result.timestamp || []
      const quotes = result.indicators?.quote?.[0] || {}
      const closes = quotes.close || []
      const highs = quotes.high || []
      const lows = quotes.low || []
      const volumes = quotes.volume || []

      const prices = timestamps.map((ts: number, i: number) => ({
        date: new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        timestamp: ts,
        price: closes[i] || 0,
        high: highs[i] || 0,
        low: lows[i] || 0,
        volume: volumes[i] || 0,
      }))

      return prices.filter((p: any) => p.price > 0)
    }
    return []
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error)
    return []
  }
}

function calculateMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0
  const slice = prices.slice(-period)
  return slice.reduce((sum, price) => sum + price, 0) / period
}

function calculateBollingerBands(
  prices: number[],
  period = 20,
  stdDev = 2,
): { upper: number; middle: number; lower: number } {
  if (prices.length < period) {
    const lastPrice = prices[prices.length - 1] || 0
    return { upper: lastPrice, middle: lastPrice, lower: lastPrice }
  }

  const slice = prices.slice(-period)
  const middle = slice.reduce((sum, price) => sum + price, 0) / period

  // Calculate standard deviation
  const squaredDiffs = slice.map((price) => Math.pow(price - middle, 2))
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / period
  const standardDeviation = Math.sqrt(variance)

  const upper = middle + stdDev * standardDeviation
  const lower = middle - stdDev * standardDeviation

  return { upper, middle, lower }
}

function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50

  const changes = []
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1])
  }

  const recentChanges = changes.slice(-period)
  const gains = recentChanges.filter((c) => c > 0)
  const losses = recentChanges.filter((c) => c < 0).map((c) => Math.abs(c))

  const avgGain = gains.length > 0 ? gains.reduce((sum, g) => sum + g, 0) / period : 0
  const avgLoss = losses.length > 0 ? losses.reduce((sum, l) => sum + l, 0) / period : 0

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 }

  const ema12 = calculateEMA(prices, 12)
  const ema26 = calculateEMA(prices, 26)
  const macd = ema12 - ema26

  // Calculate signal line (9-period EMA of MACD)
  const macdValues = []
  for (let i = 26; i <= prices.length; i++) {
    const slice = prices.slice(0, i)
    const e12 = calculateEMA(slice, 12)
    const e26 = calculateEMA(slice, 26)
    macdValues.push(e12 - e26)
  }
  const signal = calculateEMA(macdValues, 9)
  const histogram = macd - signal

  return { macd, signal, histogram }
}

function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0

  const multiplier = 2 / (period + 1)
  let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema
  }

  return ema
}

function calculateATR(data: any[], period = 14): number {
  if (data.length < period + 1) return 0

  const trueRanges = []
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high
    const low = data[i].low
    const prevClose = data[i - 1].price
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    trueRanges.push(tr)
  }

  const recentTR = trueRanges.slice(-period)
  return recentTR.reduce((sum, tr) => sum + tr, 0) / period
}

function calculateSupportResistance(data: any[], currentPrice: number) {
  const prices = data.map((d) => d.price)
  const highs = data.map((d) => d.high)
  const lows = data.map((d) => d.low)

  // Find recent swing highs and lows
  const swingHighs: number[] = []
  const swingLows: number[] = []

  for (let i = 5; i < data.length - 5; i++) {
    const isSwingHigh = highs[i] === Math.max(...highs.slice(i - 5, i + 6))
    const isSwingLow = lows[i] === Math.min(...lows.slice(i - 5, i + 6))

    if (isSwingHigh) swingHighs.push(highs[i])
    if (isSwingLow) swingLows.push(lows[i])
  }

  // Find nearest support and resistance
  const resistanceLevels = swingHighs.filter((h) => h > currentPrice).sort((a, b) => a - b)
  const supportLevels = swingLows.filter((l) => l < currentPrice).sort((a, b) => b - a)

  return {
    resistance: resistanceLevels[0] || currentPrice * 1.05,
    support: supportLevels[0] || currentPrice * 0.95,
    allResistance: resistanceLevels.slice(0, 3),
    allSupport: supportLevels.slice(0, 3),
  }
}

function calculateMomentumStrength(prices: number[], volumes: number[], rsi: number, macd: number): number {
  // Calculate price momentum (rate of change over 20 days)
  const priceChange = ((prices[prices.length - 1] - prices[prices.length - 20]) / prices[prices.length - 20]) * 100

  // Calculate volume trend
  const recentVolume = volumes.slice(-10).reduce((sum, v) => sum + v, 0) / 10
  const olderVolume = volumes.slice(-30, -10).reduce((sum, v) => sum + v, 0) / 20
  const volumeTrend = ((recentVolume - olderVolume) / olderVolume) * 100

  // Combine indicators into strength score (0-100, where higher = more bullish)
  let strength = 50 // neutral baseline

  // RSI contribution (±20 points)
  // RSI > 50 is bullish, adds to score; RSI < 50 is bearish, subtracts from score
  if (rsi > 50) strength += ((rsi - 50) / 50) * 20
  else if (rsi < 50) strength -= ((50 - rsi) / 50) * 20

  // MACD contribution (±15 points)
  // Positive MACD is bullish; negative is bearish
  if (macd > 0) strength += Math.min(macd * 3, 15)
  else if (macd < 0) strength -= Math.min(Math.abs(macd) * 3, 15)

  // Price momentum contribution (±10 points)
  // Positive price change is bullish; negative is bearish
  strength += Math.max(-10, Math.min(10, priceChange))

  // Volume trend contribution (±5 points)
  // Rising volume is bullish; falling volume is bearish
  strength += Math.max(-5, Math.min(5, volumeTrend / 10))

  // Return score between 0-100 (higher = more bullish)
  return Math.max(0, Math.min(100, strength))
}

function determineTrend(
  currentPrice: number,
  ma20: number,
  ma50: number,
  ma200: number,
  rsi: number,
  macd: { macd: number; signal: number; histogram: number },
  momentumStrength: number,
  volumeRatio: number,
): {
  trend: string
  confidence: number
  strength: string
  signals: { bullish: number; bearish: number; total: number }
} {
  let bullishSignals = 0
  let bearishSignals = 0
  let totalSignals = 0

  // MA alignment (3 points)
  if (currentPrice > ma20 && ma20 > ma50 && ma50 > ma200) bullishSignals += 3
  else if (currentPrice < ma20 && ma20 < ma50 && ma50 < ma200) bearishSignals += 3
  totalSignals += 3

  // RSI (1 point)
  if (rsi > 55) bullishSignals++
  else if (rsi < 45) bearishSignals++
  totalSignals++

  // MACD (2 points)
  if (macd.macd > macd.signal && macd.histogram > 0) bullishSignals += 2
  else if (macd.macd < macd.signal && macd.histogram < 0) bearishSignals += 2
  totalSignals += 2

  // Momentum strength (2 points) - Fixed: now using corrected scale where higher = more bullish
  if (momentumStrength > 60) bullishSignals += 2
  else if (momentumStrength < 40) bearishSignals += 2
  totalSignals += 2

  // Volume (1 point)
  if (volumeRatio > 1.2) bullishSignals++
  else if (volumeRatio < 0.8) bearishSignals++
  totalSignals++

  const bullishConfidence = (bullishSignals / totalSignals) * 100
  const bearishConfidence = (bearishSignals / totalSignals) * 100

  let trend = "Neutral"
  let confidence = 50
  let strength = "Weak"

  if (bullishConfidence > 55) {
    // Lowered from 60 for more accurate classification
    trend = "Bullish"
    confidence = bullishConfidence
    strength = bullishConfidence > 77 ? "Strong" : bullishConfidence > 66 ? "Moderate" : "Weak"
  } else if (bearishConfidence > 55) {
    trend = "Bearish"
    confidence = bearishConfidence
    strength = bearishConfidence > 77 ? "Strong" : bearishConfidence > 66 ? "Moderate" : "Weak"
  } else {
    trend = "Neutral"
    confidence = Math.max(bullishConfidence, bearishConfidence)
    strength = "Weak"
  }

  return {
    trend,
    confidence,
    strength,
    signals: { bullish: bullishSignals, bearish: bearishSignals, total: totalSignals },
  }
}

function calculatePriceTargets(
  currentPrice: number,
  trend: string,
  atr: number,
  support: number,
  resistance: number,
  momentumStrength: number,
) {
  const volatilityMultiplier = atr / currentPrice

  if (trend === "Bullish") {
    const target1Week = currentPrice + atr * 2 * (momentumStrength / 50)
    const target1Month = resistance + (resistance - currentPrice) * 0.5
    const stopLoss = support

    return {
      target1Week: Math.min(target1Week, resistance * 0.98),
      target1Month: Math.min(target1Month, currentPrice * 1.15),
      stopLoss: Math.max(stopLoss, currentPrice * 0.95),
      confidence: momentumStrength,
    }
  } else if (trend === "Bearish") {
    const target1Week = currentPrice - atr * 2 * (momentumStrength / 50)
    const target1Month = support - (currentPrice - support) * 0.5
    const stopLoss = resistance

    return {
      target1Week: Math.max(target1Week, support * 1.02),
      target1Month: Math.max(target1Month, currentPrice * 0.85),
      stopLoss: Math.min(stopLoss, currentPrice * 1.05),
      confidence: momentumStrength,
    }
  } else {
    // Neutral trend: project modest movement based on ATR and mid-point between support/resistance
    const midPoint = (support + resistance) / 2
    const weeklyMove = atr * 1.5 // Conservative movement
    const monthlyMove = atr * 3 // Still conservative for neutral

    return {
      target1Week: midPoint > currentPrice ? currentPrice + weeklyMove : currentPrice - weeklyMove,
      target1Month: midPoint,
      stopLoss: support * 1.02,
      confidence: 50,
    }
  }
}

export async function GET() {
  try {
    const indices = [
      { name: "SPY", symbol: "SPY" },
      { name: "SPX", symbol: "^SPX" },
      { name: "QQQ", symbol: "QQQ" },
    ]

    const processSymbol = async (item: { name: string; symbol: string }) => {
      console.log(`[v0] Processing ${item.name} (${item.symbol})`)

      const quote = await fetchYahooQuote(item.symbol)
      const historical = await fetchHistoricalData(item.symbol, 180)

      if (!quote || historical.length === 0) {
        console.log(`[v0] ${item.name} - No quote or historical data available`)
        return null
      }

      console.log(`[v0] ${item.name} final quote:`, {
        currentPrice: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
      })

      const prices = historical.map((h: any) => h.price)
      const volumes = historical.map((h: any) => h.volume)
      const currentPrice = quote.regularMarketPrice

      let currentVolume = quote.regularMarketVolume
      let avgVolume = quote.averageDailyVolume10Day

      // If current volume is 0 (market closed), use the most recent historical volume
      if (currentVolume === 0 && volumes.length > 0) {
        const recentVolumes = volumes.slice(-10).filter((v: number) => v > 0)
        if (recentVolumes.length > 0) {
          currentVolume = recentVolumes[recentVolumes.length - 1]
          console.log(`[v0] ${item.name} - Using last trading volume: ${currentVolume.toLocaleString()}`)
        }
      }

      // If avgVolume is 0, calculate it from historical data
      if (avgVolume === 0 && volumes.length >= 10) {
        const recentVolumes = volumes.slice(-10).filter((v: number) => v > 0)
        avgVolume = recentVolumes.reduce((sum: number, v: number) => sum + v, 0) / recentVolumes.length
        console.log(`[v0] ${item.name} - Calculated avg volume from history: ${avgVolume.toLocaleString()}`)
      }

      const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0
      console.log(
        `[v0] ${item.name} - Volume ratio: ${volumeRatio.toFixed(2)}x (${currentVolume.toLocaleString()} / ${avgVolume.toLocaleString()})`,
      )

      // Calculate all indicators
      const ma20 = calculateMA(prices, 20)
      const ma50 = calculateMA(prices, 50)
      const ma200 = calculateMA(prices, 200)
      const rsi = calculateRSI(prices)
      const macd = calculateMACD(prices)
      const atr = calculateATR(historical)
      const momentumStrength = calculateMomentumStrength(prices, volumes, rsi, macd.macd)
      const { support, resistance, allSupport, allResistance } = calculateSupportResistance(historical, currentPrice)
      const trendAnalysis = determineTrend(currentPrice, ma20, ma50, ma200, rsi, macd, momentumStrength, volumeRatio)
      const priceTargets = calculatePriceTargets(
        currentPrice,
        trendAnalysis.trend,
        atr,
        support,
        resistance,
        momentumStrength,
      )

      const priceChange = ((prices[prices.length - 1] - prices[prices.length - 20]) / prices[prices.length - 20]) * 100
      const recentVolume = volumes.slice(-10).reduce((sum, v) => sum + v, 0) / 10
      const olderVolume = volumes.slice(-30, -10).reduce((sum, v) => sum + v, 0) / 20
      const volumeTrend = ((recentVolume - olderVolume) / olderVolume) * 100

      const indicatorContributions = {
        rsi: {
          value: rsi,
          contribution: rsi > 50 ? ((rsi - 50) / 50) * 20 : -((50 - rsi) / 50) * 20,
          weight: 20,
        },
        macd: {
          value: macd.macd,
          contribution: macd.macd > 0 ? Math.min(macd.macd * 3, 15) : -Math.min(Math.abs(macd.macd) * 3, 15),
          weight: 15,
        },
        priceChange: {
          value: priceChange,
          contribution: Math.max(-10, Math.min(10, priceChange)),
          weight: 10,
        },
        volumeTrend: {
          value: volumeTrend,
          contribution: Math.max(-5, Math.min(5, volumeTrend / 10)),
          weight: 5,
        },
      }

      const historicalWithMA = historical.slice(-60).map((h: any, i: number) => {
        const pricesUpToIndex = prices.slice(0, historical.length - 60 + i + 1)
        const bollingerBands = calculateBollingerBands(pricesUpToIndex, 20, 2)
        return {
          date: h.date,
          price: h.price,
          ma20: calculateMA(pricesUpToIndex, 20),
          ma50: calculateMA(pricesUpToIndex, 50),
          ma200: calculateMA(pricesUpToIndex, 200),
          bollingerUpper: bollingerBands.upper,
          bollingerLower: bollingerBands.lower,
          forecast: null, // No forecast in historical section
          support: support,
          resistance: resistance,
        }
      })

      const lastDate = new Date(historical[historical.length - 1].timestamp * 1000)

      for (let i = 1; i <= 30; i++) {
        const forecastDate = new Date(lastDate)
        forecastDate.setDate(forecastDate.getDate() + i)

        let forecastPrice = currentPrice
        if (trendAnalysis.trend === "Bullish") {
          forecastPrice = currentPrice + ((priceTargets.target1Month - currentPrice) / 30) * i
        } else if (trendAnalysis.trend === "Bearish") {
          forecastPrice = currentPrice - ((currentPrice - priceTargets.target1Month) / 30) * i
        } else {
          // Neutral: trend toward midpoint
          const midPoint = (support + resistance) / 2
          forecastPrice = currentPrice + ((midPoint - currentPrice) / 30) * i
        }

        historicalWithMA.push({
          date: forecastDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          price: null as any, // No actual price in forecast
          ma20: null as any, // Stop 20-day MA in forecast
          ma50: null as any, // Stop 50-day MA in forecast
          ma200: null as any, // Stop 200-day MA in forecast
          bollingerUpper: null as any,
          bollingerLower: null as any,
          forecast: forecastPrice, // Show forecast line only in future
          support: support,
          resistance: resistance,
        })
      }

      return {
        name: item.name,
        symbol: item.symbol,
        currentPrice,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        ma20,
        ma50,
        ma200,
        rsi,
        macd: macd.macd,
        macdSignal: macd.signal,
        macdHistogram: macd.histogram,
        atr,
        volumeRatio,
        momentumStrength,
        support,
        resistance,
        allSupport,
        allResistance,
        trend: trendAnalysis.trend,
        trendConfidence: trendAnalysis.confidence,
        trendStrength: trendAnalysis.strength,
        trendSignals: trendAnalysis.signals,
        indicatorContributions,
        priceTarget1Week: priceTargets.target1Week,
        priceTarget1Month: priceTargets.target1Month,
        stopLoss: priceTargets.stopLoss,
        targetConfidence: priceTargets.confidence,
        historicalData: historicalWithMA,
      }
    }

    const indicesData = await Promise.all(indices.map(processSymbol))

    console.log(`[v0] Trend analysis complete. Returning ${indicesData.filter((d) => d !== null).length} indices`)

    return NextResponse.json({
      indices: indicesData.filter((d) => d !== null),
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in trend analysis:", error)
    return NextResponse.json({ error: "Failed to fetch trend analysis data" }, { status: 500 })
  }
}
