import { sma, bollinger } from "@/lib/indicators"

export async function fetchQQQTechnicals() {
  const POLYGON_API_KEY = process.env.POLYGON_API_KEY
  
  if (!POLYGON_API_KEY) {
    console.warn("[v0] POLYGON_API_KEY not set, using baseline values")
    return {
      dailyReturn: 0.0,
      consecutiveDaysDown: 0,
      belowSMA20: false,
      belowSMA50: false,
      belowSMA200: false,
      belowBollingerBand: false,
      sma20Proximity: 0,
      sma50Proximity: 0,
      sma200Proximity: 0,
      bollingerProximity: 0,
      source: "baseline"
    }
  }
  
  try {
    const today = new Date()
    const pastDate = new Date(today)
    pastDate.setDate(today.getDate() - 300) // Increased from 250 to 300 days
    
    const fromDate = pastDate.toISOString().split('T')[0]
    const toDate = today.toISOString().split('T')[0]
    
    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/QQQ/range/1/day/${fromDate}/${toDate}?adjusted=true&sort=asc&limit=300&apiKey=${POLYGON_API_KEY}`,
      { signal: AbortSignal.timeout(15000) } // Increased timeout from 10s to 15s
    )
    
    if (!response.ok) {
      throw new Error(`Polygon API failed: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.results || data.results.length === 0) {
      throw new Error("No QQQ data returned")
    }
    
    const sortedResults = data.results.sort((a: any, b: any) => a.t - b.t) // Sort by timestamp to ensure chronological order
    const prices = sortedResults.map((r: any) => r.c) // closing prices
    const currentPrice = prices[prices.length - 1]
    const prevClose = prices[prices.length - 2]
    
    console.log(`[v0] QQQ Data: Fetched ${prices.length} days of historical data`)
    console.log(`[v0] QQQ Current Price: $${currentPrice.toFixed(2)}`)
    
    const dailyReturn = ((currentPrice - prevClose) / prevClose) * 100
    
    let consecutiveDaysDown = 0
    for (let i = prices.length - 1; i > 0; i--) {
      const dayChange = ((prices[i] - prices[i-1]) / prices[i-1]) * 100
      if (dayChange < -1) {
        consecutiveDaysDown++
      } else {
        break
      }
    }
    
    // SMA/Bollinger internals now come from the shared lib/indicators.ts
    // (Phase 4). The lib returns null on short history, which maps 1:1 onto
    // this module's existing hasSMA* guards — external behavior (currentPrice
    // fallbacks, danger heuristics, return shape) is unchanged.
    const sma20Value = sma(prices, 20)
    const sma50Value = sma(prices, 50)
    const sma200Value = sma(prices, 200)
    const hasSMA20 = sma20Value !== null
    const hasSMA50 = sma50Value !== null
    const hasSMA200 = sma200Value !== null
    const sma20 = sma20Value ?? currentPrice
    const sma50 = sma50Value ?? currentPrice
    const sma200 = sma200Value ?? currentPrice

    console.log(`[v0] Calculated SMAs: 20d=$${sma20.toFixed(2)}, 50d=$${sma50.toFixed(2)}, 200d=$${sma200.toFixed(2)}`)

    const bands = bollinger(prices, 20, 2)
    const bollingerLower = bands?.lower ?? sma20
    const bollingerUpper = bands?.upper ?? sma20
    const belowBollingerBand = bands !== null && currentPrice < bands.lower
    
    const belowSMA20 = hasSMA20 ? currentPrice < sma20 : false
    const belowSMA50 = hasSMA50 ? currentPrice < sma50 : false
    const belowSMA200 = hasSMA200 ? currentPrice < sma200 : false
    
    console.log(`[v0] SMA Breaches: 20d=${belowSMA20} (${currentPrice.toFixed(2)} vs ${sma20.toFixed(2)}), 50d=${belowSMA50} (${currentPrice.toFixed(2)} vs ${sma50.toFixed(2)}), 200d=${belowSMA200} (${currentPrice.toFixed(2)} vs ${sma200.toFixed(2)})`)
    
    let sma20Proximity = 0
    if (hasSMA20) {
      const distanceFromSMA20 = ((currentPrice - sma20) / sma20) * 100
      if (distanceFromSMA20 <= 0) {
        sma20Proximity = 100
      } else if (distanceFromSMA20 < 5) {
        sma20Proximity = 100 - (distanceFromSMA20 / 5 * 100)
      }
    }
    
    let sma50Proximity = 0
    if (hasSMA50) {
      const distanceFromSMA50 = ((currentPrice - sma50) / sma50) * 100
      if (distanceFromSMA50 <= 0) {
        sma50Proximity = 100
      } else if (distanceFromSMA50 < 8) {
        sma50Proximity = 100 - (distanceFromSMA50 / 8 * 100)
      }
    }
    
    let sma200Proximity = 0
    if (hasSMA200) {
      const distanceFromSMA200 = ((currentPrice - sma200) / sma200) * 100
      if (distanceFromSMA200 <= 0) {
        sma200Proximity = 100
      } else if (distanceFromSMA200 < 10) {
        sma200Proximity = 100 - (distanceFromSMA200 / 10 * 100)
      }
    }
    
    let bollingerProximity = 0
    if (hasSMA20) {
      const distanceFromLower = ((currentPrice - bollingerLower) / bollingerLower) * 100
      if (distanceFromLower <= 0) {
        bollingerProximity = 100
      } else if (distanceFromLower < 3) {
        bollingerProximity = 100 - (distanceFromLower / 3 * 100)
      }
    }

    console.log("[v0] QQQ Technicals (LIVE DATA):", {
      currentPrice: currentPrice.toFixed(2),
      dailyReturn: dailyReturn.toFixed(2) + "%",
      consecutiveDaysDown,
      sma20: hasSMA20 ? sma20.toFixed(2) : "N/A",
      sma50: hasSMA50 ? sma50.toFixed(2) : "N/A",
      sma200: hasSMA200 ? sma200.toFixed(2) : "N/A",
      bollingerLower: bollingerLower.toFixed(2),
      bollingerUpper: bollingerUpper.toFixed(2),
      belowSMA20: belowSMA20 ? "YES (bearish)" : "NO (bullish)",
      belowSMA50: belowSMA50 ? "YES (bearish)" : "NO (bullish)",
      belowSMA200: belowSMA200 ? "YES (bearish)" : "NO (bullish)",
      belowBollingerBand: belowBollingerBand ? "YES (oversold)" : "NO",
      sma20Proximity: sma20Proximity.toFixed(1) + "% danger",
      sma50Proximity: sma50Proximity.toFixed(1) + "% danger",
      sma200Proximity: sma200Proximity.toFixed(1) + "% danger",
      bollingerProximity: bollingerProximity.toFixed(1) + "% danger",
      dataQuality: `${hasSMA20 ? '20d✓' : '20d✗'} ${hasSMA50 ? '50d✓' : '50d✗'} ${hasSMA200 ? '200d✓' : '200d✗'}`
    })
    
    return {
      dailyReturn: parseFloat(dailyReturn.toFixed(2)),
      consecutiveDaysDown,
      belowSMA20,
      belowSMA50,
      belowSMA200,
      belowBollingerBand,
      sma20Proximity: parseFloat(sma20Proximity.toFixed(1)),
      sma50Proximity: parseFloat(sma50Proximity.toFixed(1)),
      sma200Proximity: parseFloat(sma200Proximity.toFixed(1)),
      bollingerProximity: parseFloat(bollingerProximity.toFixed(1)),
      currentPrice: parseFloat(currentPrice.toFixed(2)),
      sma20: parseFloat(sma20.toFixed(2)),
      sma50: parseFloat(sma50.toFixed(2)),
      sma200: parseFloat(sma200.toFixed(2)),
      bollingerLower: parseFloat(bollingerLower.toFixed(2)),
      bollingerUpper: parseFloat(bollingerUpper.toFixed(2)),
      source: "live"
    }
  } catch (error) {
    console.error("[v0] QQQ Technicals error:", error)
    console.warn("[v0] Falling back to baseline QQQ values")
    
    return {
      dailyReturn: 0.0,
      consecutiveDaysDown: 0,
      belowSMA20: false,
      belowSMA50: false,
      belowSMA200: false,
      belowBollingerBand: false,
      sma20Proximity: 0,
      sma50Proximity: 0,
      sma200Proximity: 0,
      bollingerProximity: 0,
      source: "baseline"
    }
  }
}
