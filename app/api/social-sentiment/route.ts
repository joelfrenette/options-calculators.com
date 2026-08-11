import { NextResponse } from "next/server"
import { resolveApiKey } from "@/lib/api-keys"
import { generateWithFallback } from "@/lib/ai-providers"
import {
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
 * SOCIAL sources:  StockTwits (bull/bear tags), Google News pulse (Serper).
 * MACRO sources:   CNN Fear & Greed, Finnhub news, Polygon news,
 *                  News Fear/Greed.
 *
 * Combination:     Reliability-weighted average across only the LIVE sources.
 *                  Hard data feeds (CNN F&G, news APIs) carry more weight
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
//
// ONE fetch, two lenses. `getFinnhubSentiment` and `getNewsFearGreed` used to
// issue separate requests to the byte-identical URL — same endpoint, same
// `category=general`, same seven-day window — and then scored the result two
// different ways. Two HTTP calls per request against a metered free tier for
// one article list.
//
// The composite consequence mattered more. Both entered the weighted mean as
// their own indicator, 0.11 + 0.08 = 0.19 of the weight, and the second was
// named "News Fear & Greed", which conceals that it IS Finnhub's general feed.
// The source list showed six sources over five corpora. They are not scalar
// multiples of each other and can genuinely disagree — the lenses differ, one
// scoring headline tone over the top 50 and the other counting greed/fear words
// over the top 30 — so this is milder than P6-61. But two readings of one
// article set are two opinions, not two witnesses.
async function fetchFinnhubGeneralNews(): Promise<any[] | null> {
  const key = resolveApiKey("FINNHUB_API_KEY")
  if (!key) return null
  try {
    const today = new Date().toISOString().split("T")[0]
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().split("T")[0]
    const res = await fetch(
      `https://finnhub.io/api/v1/news?category=general&from=${weekAgo}&to=${today}&token=${key}`,
      { signal: AbortSignal.timeout(10000) },
    )
    if (!res.ok) return null
    const articles = await res.json()
    return Array.isArray(articles) && articles.length > 0 ? articles : null
  } catch (err) {
    console.log("[v0] Finnhub news error:", err instanceof Error ? err.message : "Unknown")
    return null
  }
}

function getFinnhubSentiment(articles: any[] | null): { score: number; source: string; articles: number } {
  if (!articles) return { score: -1, source: "unavailable", articles: 0 }
  const score = headlineScore(articles.slice(0, 50).map((a: any) => a.headline))
  if (score < 0) return { score: -1, source: "no_data", articles: 0 }
  console.log(`[v0] ✓ Finnhub News: ${score}/100 (${articles.length} articles)`)
  return { score, source: "finnhub_news", articles: articles.length }
}

// ========== POLYGON NEWS ==========
async function getPolygonNewsSentiment(): Promise<{ score: number; source: string; articles: number }> {
  if (!resolveApiKey("POLYGON_API_KEY")) return { score: -1, source: "unavailable", articles: 0 }
  try {
    const res = await fetch(`https://api.polygon.io/v2/reference/news?limit=50&apiKey=${resolveApiKey("POLYGON_API_KEY")}`, {
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

function getNewsFearGreed(articles: any[] | null): { score: number; source: string } {
  if (!articles) return { score: -1, source: "unavailable" }
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
  if (total === 0) return { score: -1, source: "no_data" }
  const score = Math.round((greed / total) * 100)
  console.log(`[v0] ✓ News Fear/Greed (same Finnhub feed): ${score}/100 (${greed} greed / ${fear} fear)`)
  return { score, source: "news_fear_greed" }
}

// ========== AAII INVESTOR SURVEY — REMOVED (S-11, owner decision 2026-08-10) ==========
// The free path read the public aaii.com page, which is a chart script holding
// ~121 undated weekly records. There is no way to tell from it which record is
// current, so the parser could only ever decline, and a pillar that can only
// decline is not a pillar. The alternative was a dated feed (Nasdaq Data Link);
// the owner chose to drop the indicator instead. Six sources remain.
//
// The weighted average divides by the weight of the LIVE sources, so removing
// AAII's 0.12 renormalises the rest on its own — no other weight changes.

// ========== AI EXECUTIVE SUMMARY (analysis of the REAL scores above) ==========
async function generateExecutiveSummary(
  globalScore: number | null,
  indicators: Array<{ name: string; score: number; status: string }>,
): Promise<{ summary: string; outlook: string; strategies: string[] }> {
  // No live source means no reading to analyse. Asking the model to interpret a
  // stand-in 50 is how a blank feed became "neutral conditions" and a strategy
  // list (same defect class as P6-19).
  if (globalScore === null) {
    return {
      summary:
        "No live sentiment source returned a reading, so there is no sentiment score to report. This is missing data, not a neutral market.",
      outlook: "No outlook — the inputs this section depends on are unavailable.",
      strategies: [],
    }
  }
  try {
    const active = indicators.filter((i) => i.status === "LIVE" && i.score >= 0)
    const indicatorSummary = active.map((i) => `${i.name}: ${i.score}/100`).join(", ")
    // Routed through the free-first AI chain (OpenRouter free -> Groq -> Gemini).
    const { text } = await generateWithFallback({
      system: `You are a senior options trading analyst. Higher sentiment = more bullish. RESPOND WITH ONLY JSON:
{"summary":"<2-3 sentences on current social sentiment and market meaning>","outlook":"<1 sentence weekly outlook for options traders>","strategies":["<s1>","<s2>","<s3>"]}
Be specific about options strategies (credit spreads, iron condors, straddles, etc.)`,
      prompt: `Global social sentiment: ${globalScore}/100. Live indicators: ${indicatorSummary}. What does this mean for options traders this week?`,
      temperature: 0.3,
      maxTokens: 300,
    })
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      const parsed = JSON.parse(m[0])
      return { summary: parsed.summary || "", outlook: parsed.outlook || "", strategies: parsed.strategies || [] }
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
      googleNews,
      cnnFearGreed,
      stocktwitsSPY,
      finnhubArticles,
      polygon,
      // per-symbol StockTwits (real, symbol-specific)
      stQQQ,
      stIWM,
      stDIA,
    ] = await Promise.all([
      getGoogleNewsSentiment(),
      getCNNFearGreedSentiment(),
      getStockTwitsSentiment("SPY"),
      fetchFinnhubGeneralNews(),
      getPolygonNewsSentiment(),
      getStockTwitsSentiment("QQQ"),
      getStockTwitsSentiment("IWM"),
      getStockTwitsSentiment("DIA"),
    ])

    // Both news lenses read the ONE article list fetched above.
    const finnhub = getFinnhubSentiment(finnhubArticles)
    const newsFearGreed = getNewsFearGreed(finnhubArticles)

    // Build indicator list (name, score, weight, group). score -1 => not live.
    // Reliability weighting: hard data feeds (CNN F&G, news APIs) > social scrapes.
    const indicators = [
      // --- Hard data / aggregated indices (highest reliability) ---
      { name: "CNN Fear & Greed", score: cnnFearGreed.score, source: cnnFearGreed.source, weight: 0.16, group: "macro", description: cnnFearGreed.score >= 0 ? `CNN multi-factor index${cnnFearGreed.detail ? ` (${cnnFearGreed.detail})` : ""}` : "CNN multi-factor index (no live reading)" },
      { name: "Finnhub News", score: finnhub.score, source: finnhub.source, weight: 0.11, group: "macro", description: `Financial news headline sentiment (${finnhub.articles} articles)` },
      { name: "Polygon News", score: polygon.score, source: polygon.source, weight: 0.1, group: "macro", description: `Polygon.io news sentiment (${polygon.articles} articles)` },
      { name: "News Fear & Greed", score: newsFearGreed.score, source: newsFearGreed.source, weight: 0.08, group: "macro", description: "Greed vs fear word counts over the SAME Finnhub general-news feed as the row above — a second lens, not a second source" },
      // --- Social / retail scrapes (lower reliability) ---
      { name: "StockTwits", score: stocktwitsSPY.score, source: stocktwitsSPY.source, weight: 0.11, group: "social", description: `SPY bullish/bearish tags (${stocktwitsSPY.bullish}B/${stocktwitsSPY.bearish}Be)` },
      { name: "Google News", score: googleNews.score, source: googleNews.source, weight: 0.08, group: "social", description: `Market headline pulse (${googleNews.detail})` },
    ].map((i) => ({ ...i, status: i.score >= 0 ? "LIVE" : "UNAVAILABLE" }))

    const valid = indicators.filter((i) => i.score >= 0)

    // Weighted global score across only the live sources. With nothing live the
    // answer is null, not 50: on a 0-100 sentiment scale 50 is a real NEUTRAL
    // reading, and it was being published as one, fed to the LLM summary, and
    // turned into "Neutral conditions - consider iron condors or strangles".
    const totalWeight = valid.reduce((s, i) => s + i.weight, 0)
    const globalScore =
      valid.length > 0 ? Math.round(valid.reduce((s, i) => s + i.score * i.weight, 0) / totalWeight) : null

    // Each band reports its OWN sources or nothing. Falling back to globalScore
    // made the macro band echo a purely social reading and vice versa.
    const socialValid = valid.filter((i) => i.group === "social")
    const macroValid = valid.filter((i) => i.group === "macro")
    const socialSentiment = socialValid.length
      ? Math.round(socialValid.reduce((s, i) => s + i.score, 0) / socialValid.length)
      : null
    const macroSentiment = macroValid.length
      ? Math.round(macroValid.reduce((s, i) => s + i.score, 0) / macroValid.length)
      : null

    console.log(`[v0] ====== GLOBAL: ${globalScore ?? "—"}/100 | social ${socialSentiment ?? "—"} | macro ${macroSentiment ?? "—"} | ${valid.length}/${indicators.length} live ======`)

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
    const dataQuality = valid.length === 0 ? "NONE" : valid.length >= 6 ? "HIGH" : valid.length >= 3 ? "MEDIUM" : "LOW"

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
