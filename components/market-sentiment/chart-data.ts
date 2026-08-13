/**
 * Which stored series backs each Fear & Greed indicator's sparkline.
 *
 * Split out of `components/market-sentiment.tsx` (P6-13). ONE mechanical change:
 * it read `marketData` from the component's closure and now takes it as a
 * parameter. The body is otherwise identical, including the empty returns —
 * an indicator with no series gets no chart rather than a synthesised one.
 */
import type { MarketData } from "./market-data"

export const getChartDataForIndicator = (marketData: MarketData | null, indicatorName: string): { data: number[]; dates: string[]; label: string } => {
  console.log("[v0] Getting chart data for indicator:", indicatorName)

  if (!marketData?.chartData) {
    console.log("[v0] No chartData available in marketData")
    return { data: [], dates: [], label: "" }
  }

  const { spy, vix, date: dates } = marketData.chartData

  console.log(
    "[v0] Available chart data - SPY points:",
    spy?.length,
    "VIX points:",
    vix?.length,
    "Dates:",
    dates?.length,
  )

  switch (indicatorName.toLowerCase().replace(/\s/g, "")) {
    case "marketmomentum":
      // SPY price (momentum)
      return { data: spy || [], dates: dates || [], label: "S&P 500 Price" }

    case "stockpricestrength":
      // SPY percentage change from 52-week average
      if (spy && spy.length > 0) {
        const avg52Week = spy.slice(-252).reduce((a, b) => a + b, 0) / Math.min(spy.length, 252)
        const strengthData = spy.map((price) => ((price - avg52Week) / avg52Week) * 100)
        return { data: strengthData, dates: dates || [], label: "% from 52-week avg" }
      }
      return { data: [], dates: [], label: "" }

    case "stockpricebreadth":
      // Volume-based breadth indicator
      if (spy && spy.length > 1) {
        const breadthData = spy.map((price, i) => {
          if (i === 0) return 50
          const change = ((price - spy[i - 1]) / spy[i - 1]) * 100
          return 50 + change * 5 // Scale to 0-100
        })
        return { data: breadthData, dates: dates || [], label: "Market Breadth Score" }
      }
      return { data: [], dates: [], label: "" }

    case "putandcalloptions":
      // VIX-based options sentiment (inverted - high VIX = fear = low score)
      if (vix && vix.length > 0) {
        const optionsData = vix.map((v) => Math.max(0, Math.min(100, 100 - v * 2)))
        return { data: optionsData, dates: dates || [], label: "Options Sentiment" }
      }
      return { data: [], dates: [], label: "" }

    case "marketvolatility":
      // Raw VIX
      return { data: vix || [], dates: dates || [], label: "VIX Level" }

    case "safehavendemand":
      // Inverse of SPY volatility (stable = high score = greed)
      if (spy && spy.length > 5) {
        const volatilityData = spy.map((price, i) => {
          if (i < 5) return 50
          const recentPrices = spy.slice(Math.max(0, i - 5), i + 1)
          const volatility = Math.max(...recentPrices) - Math.min(...recentPrices)
          const percentVolatility = (volatility / price) * 100
          return Math.max(0, Math.min(100, 100 - percentVolatility * 10))
        })
        return { data: volatilityData, dates: dates || [], label: "Safe Haven Score" }
      }
      return { data: [], dates: [], label: "" }

    case "junkbonddemand":
      // Based on SPY trend (uptrend = junk bond demand = greed)
      if (spy && spy.length > 10) {
        const junkBondData = spy.map((price, i) => {
          if (i < 10) return 50
          const ma10 = spy.slice(i - 10, i).reduce((a, b) => a + b, 0) / 10
          const trendStrength = ((price - ma10) / ma10) * 100
          return Math.max(0, Math.min(100, 50 + trendStrength * 5))
        })
        return { data: junkBondData, dates: dates || [], label: "Junk Bond Demand" }
      }
      return { data: [], dates: [], label: "" }

    default:
      return { data: [], dates: [], label: "" }
  }
}
