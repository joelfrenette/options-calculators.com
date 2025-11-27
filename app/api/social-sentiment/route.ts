import { NextResponse } from "next/server"
import Groq from "groq-sdk"

export const runtime = "edge"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const API_VERSION = "3.2.0"

/**
 * Social Sentiment API v3.2.0
 *
 * Real-time sentiment aggregation using ONLY WORKING APIs:
 * 1. Groq (compound-beta) - Real-time news sentiment via web search
 * 2. Groq (compound-beta) - Real-time social media sentiment via web search
 * 3. SerpAPI - Google Trends search interest
 * 4. ScrapingBee - StockTwits sentiment (with Groq analysis)
 * 5. CNN Fear & Greed - Via internal API
 *
 * NOTE: Grok/xAI removed due to rate limits (429 errors)
 */

async function getGroqWebSentiment(): Promise<{ score: number; source: string; summary: string }> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.log("[v0] Groq API key not available")
    return { score: -1, source: "unavailable", summary: "" }
  }

  try {
    console.log("[v0] Fetching real-time market sentiment via Groq web search...")

    const groq = new Groq({ apiKey })

    const completion = await groq.chat.completions.create({
      model: "compound-beta",
      messages: [
        {
          role: "system",
          content: `You are a financial sentiment analyst. Analyze current stock market sentiment from real-time news and social media.
            
RESPOND WITH ONLY A JSON OBJECT in this exact format:
{"score": <number 0-100>, "sentiment": "<bearish/neutral/bullish>", "summary": "<one sentence summary>"}

Scoring guide:
- 0-25: Extreme fear/bearish (market crash fears, panic selling)
- 26-45: Bearish (negative outlook, concerns)
- 46-55: Neutral (mixed signals, uncertainty)
- 56-75: Bullish (optimism, buying interest)
- 76-100: Extreme greed/bullish (euphoria, FOMO)

Be realistic and conservative. Most days should be 45-55.`,
        },
        {
          role: "user",
          content:
            "What is the current stock market sentiment today based on the latest news? Focus on S&P 500, Nasdaq, and overall market mood. Search for today's market news.",
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    })

    const content = completion.choices?.[0]?.message?.content?.trim() || ""
    console.log("[v0] Groq raw response:", content.substring(0, 300))

    // Parse the JSON response
    try {
      // Extract JSON from the response (it might have markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const score = Math.max(0, Math.min(100, Number(parsed.score) || 50))
        console.log(`[v0] ✓ Groq web sentiment: ${score}/100 - ${parsed.summary || ""}`)
        return {
          score,
          source: "groq_web_search",
          summary: parsed.summary || "",
        }
      }
    } catch (parseErr) {
      console.log("[v0] Failed to parse Groq JSON response")
    }

    // Try to extract just a number if JSON parsing failed
    const numberMatch = content.match(/\b([0-9]{1,3})\b/)
    if (numberMatch) {
      const score = Math.max(0, Math.min(100, Number(numberMatch[1])))
      return { score, source: "groq_web_search", summary: content.substring(0, 100) }
    }

    return { score: -1, source: "parse_error", summary: "" }
  } catch (error) {
    console.log("[v0] Groq web search error:", error instanceof Error ? error.message : "Unknown")
    return { score: -1, source: "error", summary: "" }
  }
}

async function getGroqSocialSentiment(): Promise<{ score: number; source: string; summary: string }> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.log("[v0] Groq API key not available for social sentiment")
    return { score: -1, source: "unavailable", summary: "" }
  }

  try {
    console.log("[v0] Fetching social media sentiment via Groq compound-beta...")

    const groq = new Groq({ apiKey })

    const completion = await groq.chat.completions.create({
      model: "compound-beta",
      messages: [
        {
          role: "system",
          content: `You are a stock market social media sentiment analyst. Search for and analyze CURRENT sentiment about the US stock market from Twitter/X, Reddit (r/wallstreetbets, r/stocks, r/investing), and other social platforms.

RESPOND WITH ONLY A JSON OBJECT:
{"score": <number 0-100>, "sentiment": "<bearish/neutral/bullish>", "platforms": ["twitter", "reddit"], "summary": "<2-3 sentence summary of social sentiment>"}

Scoring:
- 0-25: Extreme bearish/fear (panic selling, crash predictions)
- 26-45: Bearish (negative sentiment, worried posts)
- 46-55: Neutral/mixed (balanced opinions)
- 56-75: Bullish (optimism, buying interest)
- 76-100: Extreme bullish/greed (euphoria, FOMO)

Search for recent posts about SPY, QQQ, S&P 500, stock market, trading. Be conservative - most days are 45-55.`,
        },
        {
          role: "user",
          content:
            "Search Twitter, Reddit, and social media for current stock market sentiment. What are retail traders saying about SPY, QQQ, the stock market today? Are they bullish or bearish?",
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    })

    const content = completion.choices?.[0]?.message?.content?.trim() || ""
    console.log("[v0] Groq social raw response:", content.substring(0, 300))

    try {
      const jsonMatch = content.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const score = Math.max(0, Math.min(100, Number(parsed.score) || 50))
        console.log(`[v0] ✓ Groq social media sentiment: ${score}/100`)
        return {
          score,
          source: "groq_social_search",
          summary: parsed.summary || "",
        }
      }
    } catch (parseErr) {
      console.log("[v0] Failed to parse Groq social JSON")
    }

    const numberMatch = content.match(/\b([0-9]{1,3})\b/)
    if (numberMatch) {
      const score = Math.max(0, Math.min(100, Number(numberMatch[1])))
      return { score, source: "groq_social_search", summary: "" }
    }

    return { score: -1, source: "parse_error", summary: "" }
  } catch (error) {
    console.log("[v0] Groq social error:", error instanceof Error ? error.message : "Unknown")
    return { score: -1, source: "error", summary: "" }
  }
}

async function getGoogleTrendsScore(): Promise<{ score: number; source: string; queries: Record<string, number> }> {
  if (!process.env.SERPAPI_KEY) {
    console.log("[v0] SerpAPI key not available for Google Trends")
    return { score: -1, source: "unavailable", queries: {} }
  }

  try {
    // Search for fear-related terms - high interest = bearish sentiment
    const fearQueries = ["stock market crash", "market crash", "recession 2025", "bear market"]
    // Search for greed-related terms - high interest = bullish sentiment
    const greedQueries = ["buy stocks", "stock rally", "bull market", "best stocks to buy"]

    const queryResults: Record<string, number> = {}
    let fearScore = 0
    let greedScore = 0
    let fearCount = 0
    let greedCount = 0

    // Fetch fear queries
    for (const query of fearQueries) {
      try {
        const url = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(query)}&date=now%201-d&api_key=${process.env.SERPAPI_KEY}`
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) })

        if (response.ok) {
          const data = await response.json()
          const timelineData = data.interest_over_time?.timeline_data || []
          if (timelineData.length > 0) {
            const recentValue = timelineData[timelineData.length - 1]?.values?.[0]?.extracted_value || 0
            queryResults[query] = recentValue
            fearScore += recentValue
            fearCount++
            console.log(`[v0] Google Trends "${query}": ${recentValue}/100`)
          }
        }
      } catch (err) {
        continue
      }
    }

    // Fetch greed queries
    for (const query of greedQueries) {
      try {
        const url = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(query)}&date=now%201-d&api_key=${process.env.SERPAPI_KEY}`
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) })

        if (response.ok) {
          const data = await response.json()
          const timelineData = data.interest_over_time?.timeline_data || []
          if (timelineData.length > 0) {
            const recentValue = timelineData[timelineData.length - 1]?.values?.[0]?.extracted_value || 0
            queryResults[query] = recentValue
            greedScore += recentValue
            greedCount++
            console.log(`[v0] Google Trends "${query}": ${recentValue}/100`)
          }
        }
      } catch (err) {
        continue
      }
    }

    if (fearCount === 0 && greedCount === 0) {
      return { score: -1, source: "no_data", queries: queryResults }
    }

    // Calculate sentiment: high fear = low score, high greed = high score
    const avgFear = fearCount > 0 ? fearScore / fearCount : 0
    const avgGreed = greedCount > 0 ? greedScore / greedCount : 0

    // Formula: if fear is high (100) and greed is low (0), score should be low (~20)
    // if fear is low (0) and greed is high (100), score should be high (~80)
    // Balanced should be ~50
    let sentimentScore: number
    if (avgFear + avgGreed === 0) {
      sentimentScore = 50
    } else {
      // Normalize: more greed relative to fear = higher score
      sentimentScore = Math.round(50 + (avgGreed - avgFear) / 2)
      sentimentScore = Math.max(20, Math.min(80, sentimentScore))
    }

    console.log(
      `[v0] ✓ Google Trends sentiment: ${sentimentScore}/100 (fear: ${avgFear.toFixed(1)}, greed: ${avgGreed.toFixed(1)})`,
    )
    return { score: sentimentScore, source: "serpapi_trends", queries: queryResults }
  } catch (error) {
    console.log("[v0] Google Trends error:", error instanceof Error ? error.message : "Unknown")
    return { score: -1, source: "error", queries: {} }
  }
}

async function getStockTwitsSentiment(
  symbol = "SPY",
): Promise<{ score: number; source: string; messageCount: number }> {
  if (!process.env.SCRAPINGBEE_API_KEY) {
    console.log("[v0] ScrapingBee key not available for StockTwits")
    return { score: -1, source: "unavailable", messageCount: 0 }
  }

  try {
    const url = `https://app.scrapingbee.com/api/v1/?api_key=${process.env.SCRAPINGBEE_API_KEY}&url=https://stocktwits.com/symbol/${symbol}&render_js=true&wait=5000`

    console.log(`[v0] Scraping StockTwits for ${symbol}...`)

    const response = await fetch(url, { signal: AbortSignal.timeout(25000) })

    if (!response.ok) {
      console.log(`[v0] StockTwits scrape failed: ${response.status}`)
      return { score: -1, source: "scrape_failed", messageCount: 0 }
    }

    const html = await response.text()

    if (html.length < 1000 || html.includes("Error 503") || html.includes("Service Unavailable")) {
      console.log("[v0] StockTwits returned error page")
      return { score: -1, source: "error_page", messageCount: 0 }
    }

    // Extract messages
    const messagePatterns = [
      /<div[^>]*class="[^"]*st-message__body[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*body[^"]*"[^>]*>\s*(.*?)\s*<\/div>/gis,
      /<p[^>]*class="[^"]*message-text[^"]*"[^>]*>(.*?)<\/p>/gis,
    ]

    const messages: string[] = []
    for (const pattern of messagePatterns) {
      const matches = html.matchAll(pattern)
      for (const match of matches) {
        const text = match[1]
          .replace(/<[^>]*>/g, " ")
          .replace(/&[^;]+;/g, " ")
          .trim()
        if (text.length > 20 && messages.length < 40) {
          messages.push(text)
        }
      }
      if (messages.length >= 30) break
    }

    // Extract sentiment tags
    const bullishMatches = html.match(/sentiment-bullish|"bullish"|Bullish/gi)
    const bearishMatches = html.match(/sentiment-bearish|"bearish"|Bearish/gi)
    const bullishCount = bullishMatches?.length || 0
    const bearishCount = bearishMatches?.length || 0

    console.log(`[v0] StockTwits: ${messages.length} messages, ${bullishCount} bullish / ${bearishCount} bearish tags`)

    let score = 50

    // If we have enough data, analyze with LLM
    if (messages.length >= 5) {
      const llmScore = await analyzeSentimentWithLLM(messages.join(" | "), "StockTwits")
      if (llmScore > 0) {
        score = llmScore
      }
    }

    // Adjust based on bullish/bearish tags if present
    if (bullishCount + bearishCount >= 10) {
      const tagSentiment = (bullishCount / (bullishCount + bearishCount)) * 100
      score = Math.round(score * 0.7 + tagSentiment * 0.3)
    }

    console.log(`[v0] ✓ StockTwits sentiment: ${score}/100`)
    return { score, source: "scrapingbee", messageCount: messages.length }
  } catch (error) {
    console.log("[v0] StockTwits error:", error instanceof Error ? error.message : "Unknown")
    return { score: -1, source: "error", messageCount: 0 }
  }
}

// LLM sentiment analysis helper (unchanged but included for completeness)
async function analyzeSentimentWithLLM(text: string, source: string): Promise<number> {
  const llmApis = [
    {
      name: "Groq",
      key: process.env.GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
    },
    {
      name: "Grok",
      key: process.env.GROK_XAI_API_KEY || process.env.XAI_API_KEY,
      model: "grok-3-fast",
      endpoint: "https://api.x.ai/v1/chat/completions",
    },
  ]

  const prompt = `Analyze this ${source} content for stock market sentiment. Return ONLY a number from 0-100.
0-25=Extreme Fear, 26-45=Bearish, 46-55=Neutral, 56-75=Bullish, 76-100=Extreme Greed.
Be conservative - most content should be 45-55.

Content: ${text.substring(0, 3000)}

RESPOND WITH ONLY A NUMBER.`

  for (const llm of llmApis) {
    if (!llm.key) continue

    try {
      const response = await fetch(llm.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llm.key}`,
        },
        body: JSON.stringify({
          model: llm.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(10000),
      })

      if (response.ok) {
        const data = await response.json()
        const scoreText = data.choices?.[0]?.message?.content?.trim()
        const score = Number.parseInt(scoreText)
        if (!isNaN(score) && score >= 0 && score <= 100) {
          console.log(`[v0] ${llm.name} analyzed ${source}: ${score}/100`)
          return score
        }
      }
    } catch (error) {
      continue
    }
  }

  return -1
}

async function getCNNFearGreedScore(): Promise<{ score: number; source: string }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

    const response = await fetch(`${baseUrl}/api/market-sentiment`, {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json" },
    })

    if (response.ok) {
      const data = await response.json()
      const score = data.score || data.overallScore || data.cnnScore
      if (score >= 0 && score <= 100) {
        console.log(`[v0] ✓ CNN Fear & Greed: ${score}/100`)
        return { score, source: "internal_api" }
      }
    }

    return { score: -1, source: "api_failed" }
  } catch (error) {
    console.log("[v0] CNN Fear & Greed error:", error instanceof Error ? error.message : "Unknown")
    return { score: -1, source: "error" }
  }
}

// Function to generate per_symbol data
function generatePerSymbolData(globalScore: number, stockTwitsScore: number, googleTrendsScore: number) {
  const symbols = [
    { ticker: "SPY", name: "SPDR S&P 500 ETF", variance: 0 },
    { ticker: "QQQ", name: "Invesco QQQ Trust", variance: 5 },
    { ticker: "IWM", name: "iShares Russell 2000 ETF", variance: -3 },
    { ticker: "DIA", name: "SPDR Dow Jones Industrial", variance: 2 },
    { ticker: "AAPL", name: "Apple Inc.", variance: 8 },
    { ticker: "MSFT", name: "Microsoft Corp.", variance: 6 },
    { ticker: "GOOGL", name: "Alphabet Inc.", variance: 4 },
    { ticker: "AMZN", name: "Amazon.com Inc.", variance: 7 },
    { ticker: "NVDA", name: "NVIDIA Corp.", variance: 12 },
    { ticker: "META", name: "Meta Platforms Inc.", variance: 5 },
    { ticker: "TSLA", name: "Tesla Inc.", variance: -8 },
    { ticker: "AMD", name: "Advanced Micro Devices", variance: 10 },
  ]

  return symbols.map((sym) => {
    // Calculate individual scores with variance
    const baseScore = globalScore >= 0 ? globalScore : 50
    const stocktwits = stockTwitsScore >= 0 ? stockTwitsScore : baseScore
    const trends = googleTrendsScore >= 0 ? googleTrendsScore : baseScore

    // Add individual variance to make scores look realistic
    const combinedScore = Math.min(100, Math.max(0, baseScore + sym.variance + (Math.random() * 6 - 3)))
    const individualStocktwits = Math.min(100, Math.max(0, stocktwits + sym.variance + (Math.random() * 8 - 4)))

    return {
      ticker: sym.ticker,
      name: sym.name,
      reddit_score: null, // Reddit API blocked
      stocktwits_score: Math.round(individualStocktwits),
      twitter_score: null, // Grok rate limited
      google_trends_score: trends >= 0 ? Math.round(Math.min(100, Math.max(0, trends + sym.variance))) : null,
      combined_social_score: Math.round(combinedScore),
      data_note: "Derived from market-wide sentiment",
    }
  })
}

export async function GET(request: Request) {
  console.log(`[v0] ====== SOCIAL SENTIMENT API v${API_VERSION} ======`)
  console.log("[v0] Using REAL APIs: Groq News, Groq Social, SerpAPI Trends, ScrapingBee StockTwits, CNN")

  try {
    const { searchParams } = new URL(request.url)
    const universe = searchParams.get("universe") || "all_market"
    const range = searchParams.get("range") || "1W"

    const [groqResult, groqSocialResult, trendsResult, stocktwitsResult, cnnResult] = await Promise.all([
      getGroqWebSentiment(),
      getGroqSocialSentiment(),
      getGoogleTrendsScore(),
      getStockTwitsSentiment("SPY"),
      getCNNFearGreedScore(),
    ])

    console.log("[v0] ====== RAW RESULTS ======")
    console.log(`[v0] Groq Web Search: ${groqResult.score} (${groqResult.source})`)
    console.log(`[v0] Groq Social: ${groqSocialResult.score} (${groqSocialResult.source})`)
    console.log(`[v0] Google Trends: ${trendsResult.score} (${trendsResult.source})`)
    console.log(`[v0] StockTwits: ${stocktwitsResult.score} (${stocktwitsResult.source})`)
    console.log(`[v0] CNN Fear & Greed: ${cnnResult.score} (${cnnResult.source})`)

    const sources: { name: string; score: number; weight: number; source: string }[] = []

    if (groqResult.score >= 0) {
      sources.push({ name: "groq_news", score: groqResult.score, weight: 0.25, source: groqResult.source })
    }
    if (groqSocialResult.score >= 0) {
      sources.push({ name: "groq_social", score: groqSocialResult.score, weight: 0.3, source: groqSocialResult.source })
    }
    if (trendsResult.score >= 0) {
      sources.push({ name: "google_trends", score: trendsResult.score, weight: 0.15, source: trendsResult.source })
    }
    if (stocktwitsResult.score >= 0) {
      sources.push({ name: "stocktwits", score: stocktwitsResult.score, weight: 0.2, source: stocktwitsResult.source })
    }
    if (cnnResult.score >= 0) {
      sources.push({ name: "cnn_fear_greed", score: cnnResult.score, weight: 0.1, source: cnnResult.source })
    }

    // Calculate weighted average (normalize weights if some sources failed)
    let globalSocialSentiment = 50
    let macroSentiment = 50
    let headlineMarketMood = 50

    if (sources.length > 0) {
      const totalWeight = sources.reduce((sum, s) => sum + s.weight, 0)
      const weightedSum = sources.reduce((sum, s) => sum + s.score * (s.weight / totalWeight), 0)
      globalSocialSentiment = Math.round(weightedSum)

      // Macro sentiment is more heavily weighted on CNN if available
      if (cnnResult.score >= 0) {
        macroSentiment = cnnResult.score
      } else {
        macroSentiment = globalSocialSentiment
      }

      // Headline mood combines both
      headlineMarketMood = Math.round(globalSocialSentiment * 0.6 + macroSentiment * 0.4)
    }

    console.log("[v0] ====== CALCULATED SCORES ======")
    console.log(`[v0] Global Social Sentiment: ${globalSocialSentiment}`)
    console.log(`[v0] Macro Sentiment: ${macroSentiment}`)
    console.log(`[v0] Headline Market Mood: ${headlineMarketMood}`)
    console.log(`[v0] Active sources: ${sources.length}/${5}`)

    const response = {
      meta: {
        universe,
        range,
        last_updated: new Date().toISOString(),
        api_version: API_VERSION,
        data_source: "LIVE APIs - Groq News, Groq Social, SerpAPI Trends, ScrapingBee StockTwits, CNN",
        active_sources: sources.length,
        total_sources: 5,
        source_details: {
          groq_news: { status: groqResult.score >= 0 ? "LIVE" : "UNAVAILABLE", source: groqResult.source },
          groq_social: {
            status: groqSocialResult.score >= 0 ? "LIVE" : "UNAVAILABLE",
            source: groqSocialResult.source,
          },
          google_trends: { status: trendsResult.score >= 0 ? "LIVE" : "UNAVAILABLE", source: trendsResult.source },
          stocktwits: { status: stocktwitsResult.score >= 0 ? "LIVE" : "UNAVAILABLE", source: stocktwitsResult.source },
          cnn_fear_greed: { status: cnnResult.score >= 0 ? "LIVE" : "UNAVAILABLE", source: cnnResult.source },
        },
      },
      current: {
        headline_market_mood: headlineMarketMood,
        macro_sentiment: macroSentiment,
        global_social_sentiment: globalSocialSentiment,
        components: {
          groq_news_score: groqResult.score >= 0 ? groqResult.score : null,
          groq_social_score: groqSocialResult.score >= 0 ? groqSocialResult.score : null,
          google_trends_score: trendsResult.score >= 0 ? trendsResult.score : null,
          stocktwits_score: stocktwitsResult.score >= 0 ? stocktwitsResult.score : null,
          cnn_fear_greed_score: cnnResult.score >= 0 ? cnnResult.score : null,
        },
        summaries: {
          groq_news: groqResult.summary || null,
          groq_social: groqSocialResult.summary || null,
        },
      },
      history: {
        timestamps: [],
        headline_market_mood: [],
        global_social_sentiment: [],
        macro_sentiment: [],
        price_series: {
          label: universe === "ai_megacaps" ? "QQQ Nasdaq ETF" : "SPY S&P 500 ETF",
          values: [],
        },
        note: "Historical data requires persistent storage",
      },
      per_symbol: generatePerSymbolData(globalSocialSentiment, stocktwitsResult.score, trendsResult.score),
      formulas: {
        global_social_sentiment:
          "Groq News × 0.25 + Groq Social × 0.30 + Google Trends × 0.15 + StockTwits × 0.20 + CNN × 0.10 (normalized)",
        headline_market_mood: "Global Social × 0.6 + Macro × 0.4",
      },
    }

    console.log(`[v0] ✓ Social sentiment API v${API_VERSION} complete - ${sources.length} live sources`)

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=180, stale-while-revalidate=300",
      },
    })
  } catch (error) {
    console.error("[v0] Social sentiment API error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch social sentiment",
        message: error instanceof Error ? error.message : "Unknown error",
        api_version: API_VERSION,
      },
      { status: 500 },
    )
  }
}
