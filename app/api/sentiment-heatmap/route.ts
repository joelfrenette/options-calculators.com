import { NextResponse } from "next/server"

export async function GET() {
  try {
    const indices = [
      { ticker: "QQQ", sector: "Nasdaq-100 ETF", category: "index" },
      { ticker: "SPY", sector: "S&P 500 ETF", category: "index" },
      { ticker: "^SPX", sector: "S&P 500 Index", category: "index" },
    ]

    const allTickers = indices

    // Fetch real market data for each ticker
    const sentimentPromises = allTickers.map(async (item) => {
      try {
        // Fetch 30 days of historical data
        const endDate = Math.floor(Date.now() / 1000)
        const startDate = endDate - 30 * 24 * 60 * 60

        const response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${item.ticker}?interval=1d&period1=${startDate}&period2=${endDate}`,
          { next: { revalidate: 300 } },
        )

        if (!response.ok) {
          throw new Error(`Failed to fetch ${item.ticker}`)
        }

        const data = await response.json()
        const result = data.chart?.result?.[0]

        if (!result) {
          throw new Error(`No data for ${item.ticker}`)
        }

        const meta = result.meta
        const closes = result.indicators?.quote?.[0]?.close || []
        const volumes = result.indicators?.quote?.[0]?.volume || []
        const highs = result.indicators?.quote?.[0]?.high || []
        const lows = result.indicators?.quote?.[0]?.low || []

        // Calculate real sentiment based on technical indicators
        const currentPrice = meta.regularMarketPrice
        const priceChange = meta.regularMarketChangePercent || 0

        // Calculate momentum (last 5 days vs previous 5 days)
        const recentPrices = closes.slice(-10).filter((p: number) => p !== null)
        const recent5 = recentPrices.slice(-5)
        const previous5 = recentPrices.slice(0, 5)
        const recentAvg = recent5.reduce((a: number, b: number) => a + b, 0) / recent5.length
        const previousAvg = previous5.reduce((a: number, b: number) => a + b, 0) / previous5.length
        const momentum = ((recentAvg - previousAvg) / previousAvg) * 100

        // Calculate RSI (Relative Strength Index)
        const changes = []
        for (let i = 1; i < recentPrices.length; i++) {
          changes.push(recentPrices[i] - recentPrices[i - 1])
        }
        const gains = changes.filter((c: number) => c > 0)
        const losses = changes.filter((c: number) => c < 0).map((c: number) => Math.abs(c))
        const avgGain = gains.length > 0 ? gains.reduce((a: number, b: number) => a + b, 0) / 14 : 0
        const avgLoss = losses.length > 0 ? losses.reduce((a: number, b: number) => a + b, 0) / 14 : 0
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
        const rsi = 100 - 100 / (1 + rs)

        // Calculate volume trend (recent vs average)
        const recentVolumes = volumes.slice(-5).filter((v: number) => v !== null && v > 0)
        const avgVolume =
          volumes.filter((v: number) => v !== null && v > 0).reduce((a: number, b: number) => a + b, 0) / volumes.length
        const recentVolume = recentVolumes.reduce((a: number, b: number) => a + b, 0) / recentVolumes.length
        const volumeTrend = ((recentVolume - avgVolume) / avgVolume) * 100

        // Calculate sentiment score (0-100)
        // Factors: price change (40%), momentum (30%), RSI (20%), volume (10%)
        let sentimentScore = 50 // Neutral baseline

        // Price change contribution (-5% to +5% maps to 0-100)
        sentimentScore += (priceChange / 5) * 20

        // Momentum contribution
        sentimentScore += (momentum / 10) * 15

        // RSI contribution (30-70 range)
        sentimentScore += ((rsi - 50) / 20) * 10

        // Volume contribution
        sentimentScore += (volumeTrend / 50) * 5

        // Clamp to 0-100
        sentimentScore = Math.max(0, Math.min(100, sentimentScore))

        // Calculate bullish/bearish split
        const bullishScore = Math.round(sentimentScore)
        const bearishScore = 100 - bullishScore
        const netSentiment = Math.round((bullishScore - bearishScore) * 0.5)

        // Use actual trading volume as "social volume"
        const volume = Math.round(recentVolume / 1000) // Convert to thousands

        return {
          ...item,
          bullishScore,
          bearishScore,
          netSentiment,
          volume,
          priceChange: Math.round(priceChange * 10) / 10,
          rsi: Math.round(rsi),
          momentum: Math.round(momentum * 10) / 10,
        }
      } catch (error) {
        console.error(`Error fetching sentiment for ${item.ticker}:`, error)
        // Return neutral sentiment if fetch fails
        return {
          ...item,
          bullishScore: 50,
          bearishScore: 50,
          netSentiment: 0,
          volume: 0,
          priceChange: 0,
          rsi: 50,
          momentum: 0,
        }
      }
    })

    const sentimentData = await Promise.all(sentimentPromises)

    return NextResponse.json({
      data: sentimentData,
      lastUpdated: new Date().toISOString(),
      dataSource: "Yahoo Finance Technical Analysis",
    })
  } catch (error) {
    console.error("Error fetching sentiment heatmap:", error)
    return NextResponse.json({ error: "Failed to fetch sentiment data" }, { status: 500 })
  }
}
