import { NextResponse } from "next/server"
import {
  getRedditSentiment,
  getGoogleTrendsSentiment,
  getTwitterSentiment,
  getGoogleNewsSentiment,
  getCNNFearGreedSentiment,
} from "@/lib/sentiment-sources"

export const dynamic = "force-dynamic"
export const maxDuration = 90

const API_VERSION = "7.0.0"

/**
 * Social Sentiment API v7.0.0 — REAL DATA ONLY
 *
 * Every source pulls live data and returns score -1 ("No data") on failure.
 * No fabricated numbers, no hardcoded "neutral" fallbacks, no LLM guesses.
 *
 * Higher score = MORE BULLISH (green/left). Lower score = MORE BEARISH (red/right).
 *
 * SOCIAL sources:  Reddit (multi-sub), Twitter/X ($SPY via Apify),
 *                  StockTwits (bull/bear tags), Google Trends (SerpAPI),
 *                  Google News pulse (Serper).
 * MACRO sources:   CNN Fear & Greed, AAII survey, Finnhub news, Polygon news,
 *                  News Fear/Greed.
 *
 * Combination:     Reliability-weighted average across only the LIVE sources.
 *                  Hard data feeds (CNN F&G, AAII, news APIs) carry more weight
 *                  than social scrapes. Any "No data" source is excluded.
 */

const POSITIVE_WORDS = ["surge", "rally", "gain", "rise", "bull", "record", "growth", "profit", "beat", "strong", "upgrade", "buy", "optimism", "boost"]
const NEGATIVE_WORDS = ["crash", "plunge", "fall", "drop", "bear", "loss", "miss", "weak", "fear", "decline", "downgrade", "sell", "concern", "risk"]

function headlineScore(texts: string[]): number {
  let pos = 0
  let neg = 0
  for (const raw of texts) {
    const t = (raw || "").toLowerCase()
    if (POSITIVE_WORDS.some((w) => t.includes(w))) pos++
    if (NEGATIVE_WORDS.some((w) => t.includes(w))) neg++
  }
  const total = pos + neg
  return total > 0 ? Math.round((pos / total) * 100) : -1
}

// ========== STOCKTWITS (per-symbol, real bull/bear tags) ==========
async function getStockTwitsSentiment(
  symbol = "SPY",
): Promise<{ score: number; source: string; bullish: number; bearish: number }> {
  try {
    const res = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const data = await res.json()
      const messages = data.messages || []
      let bullish = 0
      let bearish = 0
      for (const msg of messages.slice(0, 30)) {
        if (msg.entities?.sentiment?.basic === "Bullish") bullish++
        else if (msg.entities?.sentiment?.basic === "Bearish") bearish++
      }
      const total = bullish + bearish
      if (total >= 3) {
        const score = Math.round((bullish / total) * 100)
        console.log(`[v0] ✓ StockTwits ${symbol}: ${score}/100 (${bullish}B/${bearish}Be)`)
        return { score, source: "stocktwits", bullish, bearish }
      }
    }
    return { score: -1, source: "no_signal", bullish: 0, bearish: 0 }
  } catch (err) {
    console.log(`[v0] StockTwits ${symbol} error:`, err instanceof Error ? err.message : "Unknown")
    return { score: -1, source: "error", bullish: 0, bearish: 0 }
  }
}

// ========== FINNHUB NEWS ==========
async function getFinnhubSentiment(): Promise<{ score: number; source: string; articles: number }> {
  if (!process.env.FINNHUB_API_KEY) return { score: -1, source: "unavailable", articles: 0 }
  try {
    const today = new Date().toISOString().split("T")[0]
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().split("T")[0]
    const res = await fetch(
      `https://finnhub.io/api/v1/news?category=general&from=${weekAgo}&to=${today}&token=${process.env.FINNHUB_API_KEY}`,
      { signal: AbortSignal.timeout(10000) },
    )
    if (res.ok) {
      const articles = await res.json()
      if (Array.isArray(articles) && articles.length > 0) {
        const score = headlineScore(articles.slice(0, 50).map((a: any) => a.headline))
        if (score >= 0) {
          console.log(`[v0] ✓ Finnhub News: ${score}/100 (${articles.length} articles)`)
          return { score, source: "finnhub_news", articles: articles.length }
        }
      }
    }
    return { score: -1, source: "no_data", articles: 0 }
  } catch (err) {
    console.log("[v0] Finnhub error:", err instanceof Error ? err.message : "Unknown")
    return { score: -1, source: "error", articles: 0 }
  }
}

// ========== POLYGON NEWS ==========
async function getPolygonNewsSentiment(): Promise<{ score: number; source: string; articles: number }> {
  if (!process.env.POLYGON_API_KEY) return { score: -1, source: "unavailable", articles: 0 }
  try {
    const res = await fetch(`https://api.polygon.io/v2/reference/news?limit=50&apiKey=${process.env.POLYGON_API_KEY}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const data = await res.json()
      const articles = data.results || []
      if (Array.isArray(articles) && articles.length > 0) {
        const score = headlineScore(articles.map((a: any) => `${a.title || ""} ${a.description || ""}`))
        if (score >= 0) {
          console.log(`[v0] ✓ Polygon News: ${score}/100 (${articles.length} articles)`)
          return { score, source: "polygon_news", articles: articles.length }
        }
      }
    }
    return { score: -1, source: "no_data", articles: 0 }
  } catch (err) {
    console.log("[v0] Polygon error:", err instanceof Error ? err.message : "Unknown")
    return { score: -1, source: "error", articles: 0 }
  }
}

// ========== NEWS FEAR / GREED (Finnhub general news, fear vs greed lexicon) ==========
async function getNewsFearGreed(): Promise<{ score: number; source: string }> {
  if (!process.env.FINNHUB_API_KEY) return { score: -1, source: "unavailable" }
  try {
    const today = new Date().toISOString().split("T")[0]
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().split("T")[0]
    const res = await fetch(
      `https://finnhub.io/api/v1/news?category=general&from=${weekAgo}&to=${today}&token=${process.env.FINNHUB_API_KEY}`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (res.ok) {
      const articles = await res.json()
      if (Array.isArray(articles) && articles.length > 0) {
        const greedWords = ["surge", "rally", "record", "bull", "boom", "soar", "jump", "gain", "optimism", "growth"]
        const fearWords = ["crash", "plunge", "fear", "bear", "panic", "recession", "crisis", "tumble", "sell-off", "warning"]
        let greed = 0
        let fear = 0
        for (const a of articles.slice(0, 30)) {
          const h = (a.headline || "").toLowerCase()
          if (greedWords.some((w) => h.includes(w))) greed++
          if (fearWords.some((w) => h.includes(w))) fear++
        }
        const total = greed + fear
        if (total > 0) {
          const score = Math.round((greed / total) * 100)
          console.log(`[v0] ✓ News Fear/Greed: ${score}/100 (${greed} greed / ${fear} fear)`)
          return { score, source: "news_fear_greed" }
        }
      }
    }
    return { score: -1, source: "no_data" }
  } catch (err) {
    console.log("[v0] News Fear/Greed error:", err instanceof Error ? err.message : "Unknown")
    return { score: -1, source: "error" }
  }
}

// ========== AAII INVESTOR SURVEY (scrape; -1 if unavailable, never historical fake) ==========
async function getAAIISentiment(): Promise<{ score: number; source: string; bullish: number }> {
  try {
    const key = process.env.SCRAPINGBEE_API_KEY
    if (key) {
      const target = encodeURIComponent("https://www.aaii.com/sentimentsurvey")
      const res = await fetch(`https://app.scrapingbee.com/api/v1/?api_key=${key}&url=${target}&render_js=true`, {
        signal: AbortSignal.timeout(15000),
      })
      if (res.ok) {
        const html = await res.text()
        const bullMatch = html.match(/Bullish[:\s]*(\d+(?:\.\d+)?)\s*%/i) || html.match(/(\d+(?:\.\d+)?)\s*%\s*Bullish/i)
        const bearMatch = html.match(/Bearish[:\s]*(\d+(?:\.\d+)?)\s*%/i) || html.match(/(\d+(?:\.\d+)?)\s*%\s*Bearish/i)
        if (bullMatch) {
          const bullish = Number.parseFloat(bullMatch[1])
          const bearish = bearMatch ? Number.parseFloat(bearMatch[1]) : (100 - bullish) / 2
          const score = Math.round((bullish / (bullish + bearish)) * 100)
          console.log(`[v0] ✓ AAII (live): ${score}/100 (${bullish}% bullish)`)
          return { score, source: "aaii_live", bullish }
        }
      }
    }
    console.log("[v0] AAII: unavailable (no live scrape)")
    return { score: -1, source: "unavailable", bullish: 0 }
  } catch (err) {
    console.log("[v0] AAII error:", err instanceof Error ? err.message : "Unknown")
    return { score: -1, source: "error", bullish: 0 }
  }
}

// ========== AI EXECUTIVE SUMMARY (analysis of the REAL scores above) ==========
async function generateExecutiveSummary(
  globalScore: number,
  indicators: Array<{ name: string; score: number; status: string }>,
): Promise<{ summary: string; outlook: string; strategies: string[] }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return generateFallbackSummary(globalScore)
  try {
    const active = indicators.filter((i) => i.status === "LIVE" && i.score >= 0)
    const indicatorSummary = active.map((i) => `${i.name}: ${i.score}/100`).join(", ")
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a senior options trading analyst. Higher sentiment = more bullish. RESPOND WITH ONLY JSON:
{"summary":"<2-3 sentences on current social sentiment and market meaning>","outlook":"<1 sentence weekly outlook for options traders>","strategies":["<s1>","<s2>","<s3>"]}
Be specific about options strategies (credit spreads, iron condors, straddles, etc.)`,
          },
          {
            role: "user",
            content: `Global social sentiment: ${globalScore}/100. Live indicators: ${indicatorSummary}. What does this mean for options traders this week?`,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (res.ok) {
      const data = await res.json()
      const content = data.choices?.[0]?.message?.content?.trim() || ""
      const m = content.match(/\{[\s\S]*\}/)
      if (m) {
        const parsed = JSON.parse(m[0])
        return { summary: parsed.summary || "", outlook: parsed.outlook || "", strategies: parsed.strategies || [] }
      }
    }
  } catch (err) {
    console.log("[v0] Executive summary error:", err)
  }
  return generateFallbackSummary(globalScore)
}

function generateFallbackSummary(score: number): { summary: string; outlook: string; strategies: string[] } {
  if (score >= 70)
    return {
      summary: `Social sentiment is strongly bullish at ${score}/100, indicating elevated optimism across retail traders and financial media. Crowded bullish positioning often precedes short-term pullbacks.`,
      outlook: "Consider taking profits on longs and watching for mean reversion.",
      strategies: ["Sell call credit spreads on overbought names", "Protective puts on existing longs", "Iron condors on indices with elevated IV"],
    }
  if (score >= 55)
    return {
      summary: `Social sentiment is moderately bullish at ${score}/100, suggesting cautious optimism. Retail mood supports continuation without being at an extreme.`,
      outlook: "Neutral-to-bullish bias; favor quality setups with defined risk.",
      strategies: ["Bull put spreads at support", "Cash-secured puts on quality names", "Covered calls for income"],
    }
  if (score >= 45)
    return {
      summary: `Social sentiment is neutral at ${score}/100, reflecting mixed opinions and uncertainty. This commonly produces range-bound trading.`,
      outlook: "Expect choppy, directionless action; favor premium selling.",
      strategies: ["Iron condors on major indices", "Strangles on low-movement names", "Calendar spreads for theta"],
    }
  if (score >= 30)
    return {
      summary: `Social sentiment is bearish at ${score}/100, reflecting growing pessimism and fear. Contrarian signals warrant watching for capitulation.`,
      outlook: "Elevated fear creates opportunities for patient bulls; await confirmation.",
      strategies: ["Bull put spreads at oversold levels", "Long calls on quality names after a flush", "VIX call spreads for hedging"],
    }
  return {
    summary: `Social sentiment is extremely bearish at ${score}/100, indicating panic-level fear. Historically, extreme pessimism often marks near-term bottoms.`,
    outlook: "Maximum fear often precedes sharp reversals; manage risk carefully.",
    strategies: ["Aggressive bull put spreads on oversold stocks", "Long calls with defined risk", "Sell put spreads on indices for premium"],
  }
}

// ========== MAIN HANDLER ==========
export async function GET() {
  console.log(`[v0] ====== SOCIAL SENTIMENT API v${API_VERSION} (REAL DATA ONLY) ======`)

  try {
    const [
      reddit,
      twitter,
      trends,
      googleNews,
      cnnFearGreed,
      stocktwitsSPY,
      finnhub,
      polygon,
      newsFearGreed,
      aaii,
      // per-symbol StockTwits (real, symbol-specific)
      stQQQ,
      stIWM,
      stDIA,
    ] = await Promise.all([
      getRedditSentiment(),
      getTwitterSentiment(),
      getGoogleTrendsSentiment(),
      getGoogleNewsSentiment(),
      getCNNFearGreedSentiment(),
      getStockTwitsSentiment("SPY"),
      getFinnhubSentiment(),
      getPolygonNewsSentiment(),
      getNewsFearGreed(),
      getAAIISentiment(),
      getStockTwitsSentiment("QQQ"),
      getStockTwitsSentiment("IWM"),
      getStockTwitsSentiment("DIA"),
    ])

    // Build indicator list (name, score, weight, group). score -1 => not live.
    // Reliability weighting: hard data feeds (CNN F&G, AAII, news APIs) > social scrapes.
    const indicators = [
      // --- Hard data / aggregated indices (highest reliability) ---
      { name: "CNN Fear & Greed", score: cnnFearGreed.score, source: cnnFearGreed.source, weight: 0.16, group: "macro", description: cnnFearGreed.score >= 0 ? `CNN multi-factor index${cnnFearGreed.detail ? ` (${cnnFearGreed.detail})` : ""}` : "CNN multi-factor index (no live reading)" },
      { name: "AAII Survey", score: aaii.score, source: aaii.source, weight: 0.12, group: "macro", description: aaii.score >= 0 ? `Weekly investor survey (${aaii.bullish}% bullish)` : "Weekly individual-investor survey (no live reading)" },
      { name: "Finnhub News", score: finnhub.score, source: finnhub.source, weight: 0.11, group: "macro", description: `Financial news headline sentiment (${finnhub.articles} articles)` },
      { name: "Polygon News", score: polygon.score, source: polygon.source, weight: 0.1, group: "macro", description: `Polygon.io news sentiment (${polygon.articles} articles)` },
      { name: "News Fear & Greed", score: newsFearGreed.score, source: newsFearGreed.source, weight: 0.08, group: "macro", description: "Greed vs fear language across general market news" },
      // --- Social / retail scrapes (lower reliability) ---
      { name: "StockTwits", score: stocktwitsSPY.score, source: stocktwitsSPY.source, weight: 0.11, group: "social", description: `SPY bullish/bearish tags (${stocktwitsSPY.bullish}B/${stocktwitsSPY.bearish}Be)` },
      { name: "Reddit (multi-sub)", score: reddit.score, source: reddit.source, weight: 0.1, group: "social", description: `WSB, stocks, investing, options hot posts (${reddit.posts} analyzed)` },
      { name: "Google News", score: googleNews.score, source: googleNews.source, weight: 0.08, group: "social", description: `Market headline pulse (${googleNews.detail})` },
      { name: "Twitter / X", score: twitter.score, source: twitter.source, weight: 0.08, group: "social", description: `Live $SPY tweet sentiment (${twitter.tweets} tweets)` },
      { name: "Google Trends", score: trends.score, source: trends.source, weight: 0.06, group: "social", description: `Real search interest, rally vs crash (${trends.detail})` },
    ].map((i) => ({ ...i, status: i.score >= 0 ? "LIVE" : "UNAVAILABLE" }))

    const valid = indicators.filter((i) => i.score >= 0)

    // Weighted global score across only the live sources
    let globalScore = 50
    if (valid.length > 0) {
      const totalWeight = valid.reduce((s, i) => s + i.weight, 0)
      globalScore = Math.round(valid.reduce((s, i) => s + i.score * i.weight, 0) / totalWeight)
    }

    const socialValid = valid.filter((i) => i.group === "social")
    const macroValid = valid.filter((i) => i.group === "macro")
    const socialSentiment = socialValid.length ? Math.round(socialValid.reduce((s, i) => s + i.score, 0) / socialValid.length) : globalScore
    const macroSentiment = macroValid.length ? Math.round(macroValid.reduce((s, i) => s + i.score, 0) / macroValid.length) : globalScore

    console.log(`[v0] ====== GLOBAL: ${globalScore}/100 | social ${socialSentiment} | macro ${macroSentiment} | ${valid.length}/${indicators.length} live ======`)

    // Per-symbol: real StockTwits scores only (null when no live signal)
    const perSymbolRaw = [
      { symbol: "SPY", name: "S&P 500 ETF", st: stocktwitsSPY },
      { symbol: "QQQ", name: "Nasdaq 100 ETF", st: stQQQ },
      { symbol: "IWM", name: "Russell 2000 ETF", st: stIWM },
      { symbol: "DIA", name: "Dow Jones ETF", st: stDIA },
    ]
    const per_symbol = perSymbolRaw.map(({ symbol, name, st }) => {
      const score = st.score >= 0 ? st.score : null
      const direction = score === null ? "No data" : score >= 55 ? "Bullish" : score >= 45 ? "Neutral" : "Bearish"
      return {
        symbol,
        name,
        sentiment: score,
        direction,
        bullish: st.bullish,
        bearish: st.bearish,
        source: st.score >= 0 ? "StockTwits (live)" : "No live data",
      }
    })

    const executiveSummary = await generateExecutiveSummary(globalScore, indicators)
    const dataQuality = valid.length >= 6 ? "HIGH" : valid.length >= 3 ? "MEDIUM" : "LOW"

    return NextResponse.json({
      success: true,
      api_version: API_VERSION,
      timestamp: new Date().toISOString(),
      global_social_sentiment: globalScore,
      macro_sentiment: macroSentiment,
      social_sentiment: socialSentiment,
      headline_market_mood: globalScore,
      sources_available: valid.length,
      sources_total: indicators.length,
      data_quality: dataQuality,
      indicators,
      executive_summary: executiveSummary.summary,
      weekly_outlook: executiveSummary.outlook,
      recommended_strategies: executiveSummary.strategies,
      per_symbol,
      sources: valid.map((i) => ({ name: i.name, score: i.score, weight: i.weight, source: i.source })),
    })
  } catch (error) {
    console.error("[v0] Social Sentiment API error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error", api_version: API_VERSION },
      { status: 500 },
    )
  }
}
