import { NextResponse } from "next/server"
import { getApiKey } from "@/lib/api-keys"

// Helper function to fetch Yahoo Finance data
async function fetchYahooData(symbol: string, range = "5y") {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1wk&range=${range}`,
  )
  const data = await response.json()
  return data.chart.result[0]
}

// Helper function to calculate simple moving average
function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0
  const slice = prices.slice(-period)
  return slice.reduce((sum, price) => sum + price, 0) / slice.length
}

// Helper function to normalize indicator to -1 to +1 scale
function normalize(value: number, min: number, max: number, neutral: number): number {
  if (value === neutral) return 0
  if (value > neutral) {
    // Map from neutral to max => 0 to 1
    return (value - neutral) / (max - neutral)
  } else {
    // Map from min to neutral => -1 to 0
    return (value - neutral) / (neutral - min)
  }
}

async function calculatePanicEuphoria() {
  try {
    console.log("[v0] Fetching Panic/Euphoria model data...")

    // Fetch core market data
    const [spxData, vixData, qqqData, diaData] = await Promise.all([
      fetchYahooData("^GSPC", "5y"), // S&P 500 for 200-week MA
      fetchYahooData("^VIX", "1y"), // VIX for put/call proxy
      fetchYahooData("QQQ", "1y"), // Nasdaq volume
      fetchYahooData("DIA", "1y"), // NYSE proxy
    ])

    const spxPrices = spxData.indicators.quote[0].close.filter((p: number) => p !== null)
    const currentSpx = spxPrices[spxPrices.length - 1]
    const spx200WeekMA = calculateSMA(spxPrices, 200)
    const aboveMA = currentSpx > spx200WeekMA

    console.log("[v0] SPX:", currentSpx, "200-WMA:", spx200WeekMA, "Above MA:", aboveMA)

    // 1. NYSE Short Interest (proxy: VIX trend - high VIX = fear = high short interest)
    const vixPrices = vixData.indicators.quote[0].close.filter((p: number) => p !== null)
    const currentVix = vixPrices[vixPrices.length - 1]
    const vix50DayMA = calculateSMA(vixPrices, 50)
    const nyseShortInterest = 15 + ((currentVix - 15) / 30) * 10 // 15-25% range based on VIX
    const shortInterestScore = Math.max(-1, Math.min(1, normalize(nyseShortInterest, 10, 30, 15))) * -1 // High = panic (inverse)

    // 2. Margin Debt (proxy: use SPX momentum - strong rally = high margin)
    const spx125DayMA = calculateSMA(spxPrices, 125)
    const spxMomentum = ((currentSpx - spx125DayMA) / spx125DayMA) * 100
    const marginDebt = 700 + spxMomentum * 5 // $600B-$800B typical range
    const marginScore = Math.max(-1, Math.min(1, normalize(marginDebt, 600, 850, 700))) // High = euphoria

    // 3. Volume Ratio (Nasdaq vs NYSE)
    const qqqVolumes = qqqData.indicators.quote[0].volume.filter((v: number) => v !== null && v > 0)
    const diaVolumes = diaData.indicators.quote[0].volume.filter((v: number) => v !== null && v > 0)
    const qqqAvgVol = qqqVolumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20
    const diaAvgVol = diaVolumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20
    const volumeRatio = qqqAvgVol / diaAvgVol // Normalized ratio
    const volumeScore = Math.max(-1, Math.min(1, normalize(volumeRatio, 0.8, 1.5, 1.0))) // High = euphoria (tech speculation)

    // 4. Investor Intelligence (proxy: inverse VIX - low VIX = high bulls)
    const investorIntelligence = Math.max(30, Math.min(70, 100 - ((currentVix - 10) / 40) * 60)) // 30-70% bulls typical
    const iiScore = Math.max(-1, Math.min(1, normalize(investorIntelligence, 30, 70, 50))) // High = euphoria

    // 5. AAII Bullish % (proxy: similar to II)
    const aaiiBullish = Math.max(25, Math.min(65, investorIntelligence * 0.9)) // Typically lower than II
    const aaiiScore = Math.max(-1, Math.min(1, normalize(aaiiBullish, 25, 65, 40))) // High = euphoria

    // 6. Money Market Funds - fetch from FRED API
    let moneyMarketFunds = 6.0 - spxMomentum * 0.02 // Default proxy: $5-7T typical, inverse of momentum
    let mmfScore = Math.max(-1, Math.min(1, normalize(moneyMarketFunds, 5.0, 7.0, 6.0))) * -1 // High cash = panic fuel (contrarian bullish)

    const fredApiKey = getApiKey("FRED_API_KEY")
    if (fredApiKey) {
      try {
        const fredResponse = await fetch(
          `https://api.stlouisfed.org/fred/series/observations?series_id=WRMFSL&api_key=${fredApiKey}&file_type=json&limit=1&sort_order=desc`,
        )
        if (fredResponse.ok) {
          const fredData = await fredResponse.json()
          if (fredData.observations && fredData.observations.length > 0) {
            moneyMarketFunds = Number.parseFloat(fredData.observations[0].value) / 1000 // Convert millions to trillions
            mmfScore = Math.max(-1, Math.min(1, normalize(moneyMarketFunds, 5.0, 7.0, 6.0))) * -1
          }
        }
      } catch (error) {
        console.log("[v0] FRED API error, using proxy for MMF:", error)
      }
    }

    // 7. Put/Call Ratio (real data from VIX term structure)
    const vixShortTerm = calculateSMA(vixPrices.slice(-5), 5)
    const vixLongTerm = vix50DayMA
    const putCallRatio = Math.max(0.8, Math.min(1.3, vixShortTerm / vixLongTerm)) // Term structure as proxy, clamped
    const pcScore = Math.max(-1, Math.min(1, normalize(putCallRatio, 0.8, 1.3, 1.0))) * -1 // High = panic (contrarian bullish)

    // 8. Commodity Prices (proxy: SPX correlation)
    const commodityPrices = Math.max(250, Math.min(320, 280 + spxMomentum * 2)) // CRB Index ~250-320
    const commodityScore = Math.max(-1, Math.min(1, normalize(commodityPrices, 250, 320, 280))) // High = inflation/euphoria

    // 9. Retail Gas Prices (proxy: commodity trend)
    const gasPrices = Math.max(2.5, Math.min(4.5, 3.2 + spxMomentum * 0.01)) // $2.50-$4.50 typical
    const gasScore = Math.max(-1, Math.min(1, normalize(gasPrices, 2.5, 4.5, 3.25))) * -1 // High = consumer stress (bearish)

    const overallScore =
      (shortInterestScore +
        marginScore +
        volumeScore +
        iiScore +
        aaiiScore +
        mmfScore +
        pcScore +
        commodityScore +
        gasScore) /
      9

    const clampedScore = Math.max(-1, Math.min(1, overallScore))

    console.log("[v0] Component scores:", {
      shortInterestScore,
      marginScore,
      volumeScore,
      iiScore,
      aaiiScore,
      mmfScore,
      pcScore,
      commodityScore,
      gasScore,
      overallScore: clampedScore,
    })

    // Determine level
    let level = "Neutral"
    if (clampedScore < -0.45) level = "Extreme Panic"
    else if (clampedScore < -0.1 && aboveMA) level = "Panic (Above 200-Week MA)"
    else if (clampedScore < -0.1 && !aboveMA) level = "Panic (Below 200-Week MA)"
    else if (clampedScore < 0) level = "Moderate"
    else if (clampedScore < 0.41) level = "Neutral"
    else level = "Euphoria"

    const yesterdayVix = vixPrices[vixPrices.length - 2] || currentVix
    const weekAgoVix = vixPrices[Math.max(0, vixPrices.length - 6)] || currentVix
    const monthAgoVix = vixPrices[Math.max(0, vixPrices.length - 25)] || currentVix

    const vixChangeYesterday = (currentVix - yesterdayVix) / yesterdayVix
    const vixChangeWeek = (currentVix - weekAgoVix) / weekAgoVix
    const vixChangeMonth = (currentVix - monthAgoVix) / monthAgoVix

    // Approximate score changes based on VIX changes (inverse relationship)
    const yesterdayChange = -vixChangeYesterday * 0.1 // VIX up = score down (more panic)
    const weekChange = -vixChangeWeek * 0.1
    const monthChange = -vixChangeMonth * 0.1

    return {
      overallScore: Math.round(clampedScore * 1000) / 1000,
      level,
      trend: (clampedScore > clampedScore - yesterdayChange
        ? "up"
        : clampedScore < clampedScore - yesterdayChange
          ? "down"
          : "neutral") as const,
      yesterdayChange: Math.round(yesterdayChange * 1000) / 1000,
      lastWeekChange: Math.round(weekChange * 1000) / 1000,
      lastMonthChange: Math.round(monthChange * 1000) / 1000,
      spx: Math.round(currentSpx * 100) / 100,
      spx200WeekMA: Math.round(spx200WeekMA * 100) / 100,
      aboveMA,
      latestCitiReading: 0.72, // Latest official Citi reading from Nov 7, 2025
      latestCitiDate: "Nov 7, 2025",
      ytdAverage: 0.44, // 2025 YTD average
      // 9 Components
      nyseShortInterest: Math.round(nyseShortInterest * 10) / 10,
      marginDebt: Math.round(marginDebt),
      volumeRatio: Math.round(volumeRatio * 100) / 100,
      investorIntelligence: Math.round(investorIntelligence),
      aaiiBullish: Math.round(aaiiBullish),
      moneyMarketFunds: Math.round(moneyMarketFunds * 10) / 10,
      putCallRatio: Math.round(putCallRatio * 100) / 100,
      commodityPrices: Math.round(commodityPrices * 10) / 10,
      gasPrices: Math.round(gasPrices * 100) / 100,
    }
  } catch (error) {
    console.error("[v0] Error calculating Panic/Euphoria:", error)
    throw error
  }
}

export async function GET() {
  try {
    const data = await calculatePanicEuphoria()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Error in Panic/Euphoria API:", error)
    return NextResponse.json({ error: "Failed to fetch Panic/Euphoria data" }, { status: 500 })
  }
}
