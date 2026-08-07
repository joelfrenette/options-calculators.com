import { NextResponse } from "next/server"
import { sma, rsi as calcRSI, macd as calcMACD, bollinger as calcBollinger, atr as calcATR } from "@/lib/indicators"

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

// 320 calendar days ≈ 220 trading bars. Previously 180 (~124 bars), which is
// fewer than the 200 bars the "200-day MA" needs — so calculateMA's short-series
// fallback returned the LAST CLOSE as the "200-day MA" on every request, and the
// highest-weighted signal in determineTrend compared the price to itself
// (AUDIT_BACKLOG Phase 3, P0). lib/qqq-technicals.ts already fetches 300 days
// for the same reason.
async function fetchHistoricalData(symbol: string, days = 320) {
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

// All indicators come from the shared lib/indicators.ts (Phase 4 extraction).
// Every one of them returns null on insufficient history — the old local
// copies' fallbacks (last close AS the MA, bands collapsed to the last price,
// zeros from a degenerate <26-bar MACD signal) are gone: null propagates and
// each consumer below treats "unknown" as a non-vote / null response field.

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

/**
 * The MACD term of the momentum composite, normalized by price
 * (FORMULAS.md §1): the old `macd * 3` was in RAW price points, so for
 * SPX-priced series it pinned at ±15 and carried no information. Now the MACD
 * line is expressed as a % of price before weighting; cap stays ±15.
 * Null MACD (insufficient history) contributes 0.
 */
function macdContribution(macdLine: number | null, price: number): number {
  if (macdLine === null || price <= 0) return 0
  const macdPct = (macdLine / price) * 100
  return Math.max(-15, Math.min(15, macdPct * 3))
}

function calculateMomentumStrength(
  prices: number[],
  volumes: number[],
  rsi: number | null,
  macd: number | null,
): number {
  // Price momentum (rate of change over 20 days) — guard <20 bars (was NaN)
  const priceChange =
    prices.length >= 20
      ? ((prices[prices.length - 1] - prices[prices.length - 20]) / prices[prices.length - 20]) * 100
      : 0

  // Calculate volume trend
  const recentVolume = volumes.slice(-10).reduce((sum, v) => sum + v, 0) / 10
  const olderVolume = volumes.slice(-30, -10).reduce((sum, v) => sum + v, 0) / 20
  const volumeTrend = olderVolume > 0 ? ((recentVolume - olderVolume) / olderVolume) * 100 : 0

  // Combine indicators into strength score (0-100, where higher = more bullish)
  let strength = 50 // neutral baseline

  // RSI contribution (±20 points) — null RSI (insufficient history) contributes 0
  if (rsi !== null) {
    if (rsi > 50) strength += ((rsi - 50) / 50) * 20
    else if (rsi < 50) strength -= ((50 - rsi) / 50) * 20
  }

  // MACD contribution (±15 points), normalized by price — see macdContribution
  strength += macdContribution(macd, prices[prices.length - 1] ?? 0)

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
  ma20: number | null,
  ma50: number | null,
  ma200: number | null,
  rsi: number | null,
  macd: { macd: number; signal: number; histogram: number } | null,
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

  // MA alignment (3 points). Any null MA = alignment unknown → contributes 0
  // points either way (the old fallback compared the price to itself and
  // always voted). The denominator keeps its 3 points, dragging confidence
  // toward Neutral — fail-safe for short histories.
  if (ma20 !== null && ma50 !== null && ma200 !== null) {
    if (currentPrice > ma20 && ma20 > ma50 && ma50 > ma200) bullishSignals += 3
    else if (currentPrice < ma20 && ma20 < ma50 && ma50 < ma200) bearishSignals += 3
  }
  totalSignals += 3

  // RSI (1 point) — null = no vote
  if (rsi !== null) {
    if (rsi > 55) bullishSignals++
    else if (rsi < 45) bearishSignals++
  }
  totalSignals++

  // MACD (2 points) — null = no vote. `histogram > 0` was the same condition
  // as `macd > signal` stated twice (histogram ≡ macd − signal), so the
  // redundant clause is dropped (FORMULAS.md §1).
  if (macd !== null) {
    if (macd.macd > macd.signal) bullishSignals += 2
    else if (macd.macd < macd.signal) bearishSignals += 2
  }
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
      // No explicit day-count override: the 180 previously passed here silently
      // defeated the 320-day default the fetch window was raised to (~220
      // trading bars, enough for the 200-day MA — see fetchHistoricalData).
      const historical = await fetchHistoricalData(item.symbol)

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

      // Calculate all indicators (lib/indicators.ts — null on short history;
      // nulls propagate to the response instead of masquerading as prices)
      const highsArr = historical.map((h: any) => h.high)
      const lowsArr = historical.map((h: any) => h.low)
      const ma20 = sma(prices, 20)
      const ma50 = sma(prices, 50)
      const ma200 = sma(prices, 200)
      const rsi = calcRSI(prices)
      const macd = calcMACD(prices)
      const atr = calcATR(highsArr, lowsArr, prices)
      const momentumStrength = calculateMomentumStrength(prices, volumes, rsi, macd?.macd ?? null)
      const { support, resistance, allSupport, allResistance } = calculateSupportResistance(historical, currentPrice)
      const trendAnalysis = determineTrend(currentPrice, ma20, ma50, ma200, rsi, macd, momentumStrength, volumeRatio)
      // Null ATR (needs 15 bars — practically unreachable with the 320-day
      // fetch) → 0-width volatility term: targets collapse to support/
      // resistance geometry, and the response's `atr` field stays null.
      const priceTargets = calculatePriceTargets(
        currentPrice,
        trendAnalysis.trend,
        atr ?? 0,
        support,
        resistance,
        momentumStrength,
      )

      const priceChange =
        prices.length >= 20
          ? ((prices[prices.length - 1] - prices[prices.length - 20]) / prices[prices.length - 20]) * 100
          : 0
      const recentVolume = volumes.slice(-10).reduce((sum: number, v: number) => sum + v, 0) / 10
      const olderVolume = volumes.slice(-30, -10).reduce((sum: number, v: number) => sum + v, 0) / 20
      const volumeTrend = olderVolume > 0 ? ((recentVolume - olderVolume) / olderVolume) * 100 : 0

      const indicatorContributions = {
        rsi: {
          value: rsi,
          contribution: rsi === null ? 0 : rsi > 50 ? ((rsi - 50) / 50) * 20 : -((50 - rsi) / 50) * 20,
          weight: 20,
        },
        macd: {
          value: macd?.macd ?? null,
          // Normalized by price — mirrors calculateMomentumStrength exactly
          contribution: macdContribution(macd?.macd ?? null, currentPrice),
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
        const bollingerBands = calcBollinger(pricesUpToIndex, 20, 2)
        return {
          // Null MAs/bands (not enough bars yet at that point in time) render
          // as chart gaps — the old fallback drew a fake "MA" hugging the price.
          date: h.date,
          price: h.price,
          ma20: sma(pricesUpToIndex, 20),
          ma50: sma(pricesUpToIndex, 50),
          ma200: sma(pricesUpToIndex, 200),
          bollingerUpper: bollingerBands?.upper ?? null,
          bollingerLower: bollingerBands?.lower ?? null,
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
        macd: macd?.macd ?? null,
        macdSignal: macd?.signal ?? null,
        macdHistogram: macd?.histogram ?? null,
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
