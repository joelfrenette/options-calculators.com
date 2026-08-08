import { NextResponse } from "next/server"
import { generateWithFallback as sharedGenerate } from "@/lib/ai-providers"

// Through the shared chain (P6-11), not a local generateText with hardcoded
// model strings. The local version tried PAID gpt-4o-mini FIRST — skipping the
// free-tier chain, the per-call metering, and the budget guard, all three.
async function generateWithFallback(prompt: string, systemPrompt: string): Promise<string | null> {
  try {
    const result = await sharedGenerate({
      prompt,
      system: systemPrompt,
      temperature: 0.3,
      maxTokens: 400,
      routeTag: "/api/sentiment-heatmap",
    })
    return result.text
  } catch {
    return null
  }
}

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
    const systemPrompt =
      "You are a financial sentiment analyst specializing in social media analysis. Provide accurate, data-driven sentiment scores based on recent market discussions. Always respond with valid JSON only."

    // The model has NO live source access — asking it for "the past 24 hours
    // of StockTwits" invited it to hallucinate specifics (P6-11). Ask for what
    // it can actually give: a general impression, stated as such.
    const prompt = `Give your best general impression of market sentiment toward ${tickerName} (${ticker}). You have no live data access — do not invent specific recent discussions; base the estimate on the security's general profile and typical sentiment drivers.

Provide a JSON response with:
- bullishScore: percentage of bullish sentiment (0-100)
- bearishScore: percentage of bearish sentiment (0-100)  
- estimatedMentions: approximate number of mentions in past 24h
- keyThemes: brief summary of main sentiment drivers

Be realistic and data-driven. If there's limited discussion, reflect that with moderate scores around 40-60.

Respond with JSON only, no markdown.`

    const content = await generateWithFallback(prompt, systemPrompt)

    if (!content) {
      console.log("[v0] All AI models failed, using neutral sentiment")
      return { bullishScore: 50, bearishScore: 50, netSentiment: 0, volume: 0 }
    }

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
      // Honest provenance (P6-11). The old string named StockTwits, news and
      // forums as sources — none are queried. These scores are a language
      // model's impression with no live source access, i.e. an estimate, and
      // are labeled as exactly that.
      dataSource: "AI-estimated sentiment (model impression — no live social/news feed is queried)",
      estimated: true,
    })
  } catch (error) {
    console.error("[v0] Error fetching sentiment heatmap:", error)
    return NextResponse.json({ error: "Failed to fetch sentiment data" }, { status: 500 })
  }
}
