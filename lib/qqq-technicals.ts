export async function fetchQQQTechnicals() {
  const POLYGON_API_KEY = process.env.POLYGON_API_KEY
  
  if (!POLYGON_API_KEY) {
    console.warn("[v0] POLYGON_API_KEY not set, using baseline values")
    return {
      dailyReturn: 0.0,
      consecutiveDaysDown: 0,
      belowSMA20: false,
      belowSMA50: false,
      deathCross: false,
      belowBollingerBand: false,
      source: "baseline"
    }
  }
  
  try {
    const today = new Date()
    const pastDate = new Date(today)
    pastDate.setDate(today.getDate() - 250)
    
    const fromDate = pastDate.toISOString().split('T')[0]
    const toDate = today.toISOString().split('T')[0]
    
    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/QQQ/range/1/day/${fromDate}/${toDate}?adjusted=true&sort=asc&limit=250&apiKey=${POLYGON_API_KEY}`,
      { signal: AbortSignal.timeout(10000) }
    )
    
    if (!response.ok) {
      throw new Error(`Polygon API failed: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.results || data.results.length === 0) {
      throw new Error("No QQQ data returned")
    }
    
    const prices = data.results.map((r: any) => r.c) // closing prices
    const currentPrice = prices[prices.length - 1]
    const prevClose = prices[prices.length - 2]
    
    console.log(`[v0] QQQ Data: Fetched ${prices.length} days of historical data`)
    
    // Calculate 1-day % return
    const dailyReturn = ((currentPrice - prevClose) / prevClose) * 100
    
    // Calculate consecutive down days (>1% drops)
    let consecutiveDaysDown = 0
    for (let i = prices.length - 1; i > 0; i--) {
      const dayChange = ((prices[i] - prices[i-1]) / prices[i-1]) * 100
      if (dayChange < -1) {
        consecutiveDaysDown++
      } else {
        break
      }
    }
    
    let sma20 = currentPrice
    let sma50 = currentPrice
    let sma200 = currentPrice
    let hasSMA20 = false
    let hasSMA50 = false
    let hasSMA200 = false
    
    if (prices.length >= 20) {
      sma20 = prices.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20
      hasSMA20 = true
    }
      
    if (prices.length >= 50) {
      sma50 = prices.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50
      hasSMA50 = true
    }
      
    if (prices.length >= 200) {
      sma200 = prices.slice(-200).reduce((a: number, b: number) => a + b, 0) / 200
      hasSMA200 = true
    }
    
    let bollingerLower = sma20
    let bollingerUpper = sma20
    let belowBollingerBand = false
    
    if (hasSMA20) {
      const last20Prices = prices.slice(-20)
      // Calculate standard deviation
      const squaredDiffs = last20Prices.map((price: number) => Math.pow(price - sma20, 2))
      const variance = squaredDiffs.reduce((a: number, b: number) => a + b, 0) / 20
      const stdDev = Math.sqrt(variance)
      
      bollingerLower = sma20 - (2 * stdDev)
      bollingerUpper = sma20 + (2 * stdDev)
      belowBollingerBand = currentPrice < bollingerLower
    }
    
    const belowSMA20 = hasSMA20 ? currentPrice < sma20 : false
    const belowSMA50 = hasSMA50 ? currentPrice < sma50 : false
    const deathCross = (hasSMA50 && hasSMA200) ? sma50 < sma200 : false
    
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
      deathCross: deathCross ? "YES (bearish)" : "NO (bullish)",
      belowBollingerBand: belowBollingerBand ? "YES (oversold)" : "NO",
      dataQuality: `${hasSMA20 ? '20d✓' : '20d✗'} ${hasSMA50 ? '50d✓' : '50d✗'} ${hasSMA200 ? '200d✓' : '200d✗'}`
    })
    
    return {
      dailyReturn: parseFloat(dailyReturn.toFixed(2)),
      consecutiveDaysDown,
      belowSMA20,
      belowSMA50,
      deathCross,
      belowBollingerBand,
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
      deathCross: false,
      belowBollingerBand: false,
      source: "baseline"
    }
  }
}
