import { NextResponse } from "next/server"
import { generateWithFallback as sharedGenerate } from "@/lib/ai-providers"
import { meteredFetch } from "@/lib/metered-fetch"

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

// REAL sentiment first (P6-11 rebuild, Joel-approved 2026-08-08): StockTwits'
// public symbol stream is free, needs no key, and every message can carry an
// author-tagged Bullish/Bearish label — measured opinions, not a model's
// impression. The AI path below survives only as a fallback and each row says
// which source produced it.
async function analyzeStockTwits(ticker: string): Promise<{
  bullishScore: number
  bearishScore: number
  netSentiment: number
  volume: number
} | null> {
  try {
    const res = await meteredFetch(
      "stocktwits",
      `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(ticker)}.json`,
      {
        headers: { "User-Agent": "options-calculators.com contact@options-calculators.com" },
        signal: AbortSignal.timeout(10000),
        // 15-minute cache: sentiment does not move faster than that, and the
        // public API allows ~200 req/hr — caching keeps us far under it.
        next: { revalidate: 900 },
        routeTag: "/api/sentiment-heatmap",
      },
    )
    if (!res.ok) return null
    const json = await res.json()
    const messages: any[] = Array.isArray(json?.messages) ? json.messages : []

    let bullish = 0
    let bearish = 0
    for (const m of messages) {
      const tag = m?.entities?.sentiment?.basic
      if (tag === "Bullish") bullish++
      else if (tag === "Bearish") bearish++
    }
    const tagged = bullish + bearish
    // Fewer than 5 author-tagged messages is not a measurable signal — return
    // null and let the caller fall back (labeled), rather than presenting a
    // 2-message sample as a percentage.
    if (tagged < 5) return null

    const bullishScore = Math.round((bullish / tagged) * 100)
    return {
      bullishScore,
      bearishScore: 100 - bullishScore,
      netSentiment: Math.round((bullishScore - (100 - bullishScore)) * 0.5),
      volume: messages.length, // messages in the stream window, a real count
    }
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const indices = [
      { ticker: "QQQ", sector: "Nasdaq-100 ETF", category: "index" },
      { ticker: "SPY", sector: "S&P 500 ETF", category: "index" },
      { ticker: "SPX", sector: "S&P 500 Index", category: "index" },
    ]

    const sentimentPromises = indices.map(async (item) => {
      // Measured first, model impression second — and the row says which.
      const measured = await analyzeStockTwits(item.ticker)
      if (measured) {
        return { ...item, ...measured, source: "stocktwits" as const }
      }
      const sentiment = await analyzeSentimentWithAI(item.ticker, item.sector)
      return {
        ...item,
        bullishScore: sentiment.bullishScore,
        bearishScore: sentiment.bearishScore,
        netSentiment: sentiment.netSentiment,
        volume: sentiment.volume,
        source: "ai-estimate" as const,
      }
    })

    const sentimentData = await Promise.all(sentimentPromises)
    const measuredCount = sentimentData.filter((d) => d.source === "stocktwits").length

    return NextResponse.json({
      data: sentimentData,
      lastUpdated: new Date().toISOString(),
      // Honest provenance (P6-11). Per-row `source` says which path produced
      // it; the top-level string describes the mix actually used this response.
      dataSource:
        measuredCount === sentimentData.length
          ? "StockTwits author-tagged message sentiment (measured)"
          : measuredCount > 0
            ? `StockTwits author-tagged sentiment for ${measuredCount}/${sentimentData.length} symbols; rest AI-estimated (labeled per row)`
            : "AI-estimated sentiment (model impression — no live social/news feed available)",
      estimated: measuredCount < sentimentData.length,
    })
  } catch (error) {
    console.error("[v0] Error fetching sentiment heatmap:", error)
    return NextResponse.json({ error: "Failed to fetch sentiment data" }, { status: 500 })
  }
}
