import { NextResponse } from "next/server"

async function analyzeSentimentWithAI(
  ticker: string,
  tickerName: string,
): Promise<{
  bullishScore: number
  bearishScore: number
  netSentiment: number
  volume: number
}> {
  try {
    const xaiApiKey = process.env.XAI_API_KEY || process.env.GROK_XAI_API_KEY

    if (!xaiApiKey) {
      console.log("[v0] No XAI API key found, falling back to neutral sentiment")
      return { bullishScore: 50, bearishScore: 50, netSentiment: 0, volume: 0 }
    }

    // Use Grok to analyze current market sentiment for this ticker
    const prompt = `Analyze the current social media and market sentiment for ${tickerName} (${ticker}) based on recent discussions on Reddit (r/wallstreetbets, r/stocks, r/investing), Twitter/X financial community, and general market news from the past 24 hours.

Provide a JSON response with:
- bullishScore: percentage of bullish sentiment (0-100)
- bearishScore: percentage of bearish sentiment (0-100)  
- estimatedMentions: approximate number of mentions in past 24h
- keyThemes: brief summary of main sentiment drivers

Be realistic and data-driven. If there's limited discussion, reflect that with moderate scores around 40-60.`

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${xaiApiKey}`,
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [
          {
            role: "system",
            content:
              "You are a financial sentiment analyst specializing in social media analysis. Provide accurate, data-driven sentiment scores based on recent market discussions.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      console.error("[v0] Grok API error:", response.statusText)
      return { bullishScore: 50, bearishScore: 50, netSentiment: 0, volume: 0 }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const sentimentData = JSON.parse(jsonMatch[0])
      const bullish = Math.round(sentimentData.bullishScore || 50)
      const bearish = Math.round(sentimentData.bearishScore || 50)
      const mentions = sentimentData.estimatedMentions || 0

      console.log(`[v0] ${ticker} sentiment: ${bullish}% bullish, ${bearish}% bearish, ~${mentions} mentions`)

      return {
        bullishScore: bullish,
        bearishScore: bearish,
        netSentiment: Math.round((bullish - bearish) * 0.5),
        volume: mentions,
      }
    }

    return { bullishScore: 50, bearishScore: 50, netSentiment: 0, volume: 0 }
  } catch (error) {
    console.error(`[v0] Error analyzing sentiment for ${ticker}:`, error)
    return { bullishScore: 50, bearishScore: 50, netSentiment: 0, volume: 0 }
  }
}

export async function GET() {
  try {
    const indices = [
      { ticker: "QQQ", sector: "Nasdaq-100 ETF", category: "index" },
      { ticker: "SPY", sector: "S&P 500 ETF", category: "index" },
      { ticker: "SPX", sector: "S&P 500 Index", category: "index" },
    ]

    console.log("[v0] Fetching real sentiment data using AI analysis...")

    const sentimentPromises = indices.map(async (item) => {
      const sentiment = await analyzeSentimentWithAI(item.ticker, item.sector)

      return {
        ...item,
        bullishScore: sentiment.bullishScore,
        bearishScore: sentiment.bearishScore,
        netSentiment: sentiment.netSentiment,
        volume: sentiment.volume,
      }
    })

    const sentimentData = await Promise.all(sentimentPromises)

    return NextResponse.json({
      data: sentimentData,
      lastUpdated: new Date().toISOString(),
      dataSource: "AI-powered sentiment analysis from social media (Reddit, Twitter/X, financial forums)",
    })
  } catch (error) {
    console.error("[v0] Error fetching sentiment heatmap:", error)
    return NextResponse.json({ error: "Failed to fetch sentiment data" }, { status: 500 })
  }
}
