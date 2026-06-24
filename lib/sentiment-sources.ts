// ============================================================================
// Real social-sentiment data sources
// Every function returns a 0-100 score where HIGHER = MORE BULLISH.
// On any failure they return score: -1 ("No data") — NEVER a fabricated value.
// ============================================================================
import { resolveApiKey } from "@/lib/api-keys"

const BULLISH_WORDS = [
  "moon",
  "bull",
  "bullish",
  "calls",
  "rally",
  "pump",
  "rocket",
  "gain",
  "gains",
  "yolo",
  "buy",
  "long",
  "breakout",
  "surge",
  "up",
  "green",
  "ath",
  "squeeze",
]
const BEARISH_WORDS = [
  "crash",
  "dump",
  "bear",
  "bearish",
  "puts",
  "short",
  "down",
  "drop",
  "fall",
  "recession",
  "sell",
  "red",
  "tank",
  "collapse",
  "fear",
  "bubble",
  "rug",
  "bagholder",
]

function keywordScore(texts: string[]): { score: number; bullish: number; bearish: number } {
  let bullish = 0
  let bearish = 0
  for (const raw of texts) {
    const t = (raw || "").toLowerCase()
    for (const w of BULLISH_WORDS) if (t.includes(w)) bullish++
    for (const w of BEARISH_WORDS) if (t.includes(w)) bearish++
  }
  const total = bullish + bearish
  // 50 is only used as the mathematical midpoint when there is genuine data but
  // it is perfectly balanced — callers still treat total===0 as "no data".
  const score = total > 0 ? Math.round((bullish / total) * 100) : 50
  return { score, bullish, bearish }
}

// ============================================================================
// TWITTER / X — real recent tweets for $SPY cashtag via Apify tweet scraper.
// Uses the run-sync endpoint so we get items back in one call within budget.
// If the actor does not finish in time, we return -1 ("No data") — never fake.
// ============================================================================
export async function getTwitterSentiment(): Promise<{
  score: number
  source: string
  tweets: number
}> {
  const token = resolveApiKey("APIFY_API_TOKEN") // alias-aware + respects DISABLED_APIS
  if (!token) {
    console.log("[v0] Source (Twitter): APIFY token not set or disabled")
    return { score: -1, source: "unavailable", tweets: 0 }
  }
  try {
    console.log("[v0] Source (Twitter): Fetching $SPY tweets via Apify...")
    const actorId = "apidojo~tweet-scraper"
    const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=45`

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        searchTerms: ["$SPY", "stock market"],
        sort: "Latest",
        maxItems: 40,
        tweetLanguage: "en",
      }),
      // Hard ceiling slightly above the actor timeout so we always return cleanly
      signal: AbortSignal.timeout(50000),
    })

    if (!res.ok) {
      console.log("[v0] Source (Twitter): HTTP", res.status)
      return { score: -1, source: "http_error", tweets: 0 }
    }

    const items = await res.json()
    if (!Array.isArray(items) || items.length === 0) {
      console.log("[v0] Source (Twitter): no tweets returned")
      return { score: -1, source: "no_tweets", tweets: 0 }
    }

    // Actor field is usually `text` (fallback to `full_text`/`content`)
    const texts = items.map((t: any) => t.text || t.full_text || t.content || "")
    const { score, bullish, bearish } = keywordScore(texts)
    if (bullish + bearish === 0) {
      console.log("[v0] Source (Twitter): no directional keywords")
      return { score: -1, source: "no_signal", tweets: items.length }
    }
    console.log(`[v0] ✓ Source (Twitter): ${score}/100 (${bullish}B/${bearish}Be over ${items.length} tweets)`)
    return { score, source: "apify_twitter", tweets: items.length }
  } catch (err) {
    console.log("[v0] Source (Twitter) error:", err instanceof Error ? err.message : "Unknown")
    return { score: -1, source: "error", tweets: 0 }
  }
}

// ============================================================================
// FINNHUB — aggregate news sentiment for SPY (bullishPercent + companyNews tone)
// ============================================================================
export async function getFinnhubNewsSentiment(): Promise<{
  score: number
  source: string
  detail: string
}> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) {
    console.log("[v0] Source (Finnhub): FINNHUB_API_KEY not set")
    return { score: -1, source: "unavailable", detail: "no_key" }
  }
  try {
    console.log("[v0] Source (Finnhub): Fetching company news for SPY...")
    const to = new Date().toISOString().split("T")[0]
    const from = new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0]
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=SPY&from=${from}&to=${to}&token=${key}`,
      { signal: AbortSignal.timeout(12000) },
    )
    if (!res.ok) {
      console.log("[v0] Source (Finnhub): HTTP", res.status)
      return { score: -1, source: "http_error", detail: String(res.status) }
    }
    const articles = await res.json()
    if (!Array.isArray(articles) || articles.length === 0) {
      return { score: -1, source: "no_news", detail: "empty" }
    }
    const headlines = articles.slice(0, 60).map((a: any) => `${a.headline || ""} ${a.summary || ""}`)
    const { score, bullish, bearish } = keywordScore(headlines)
    if (bullish + bearish === 0) return { score: -1, source: "no_signal", detail: "neutral" }
    console.log(`[v0] ✓ Source (Finnhub): ${score}/100 over ${articles.length} articles`)
    return { score, source: "finnhub_news", detail: `${articles.length} articles` }
  } catch (err) {
    console.log("[v0] Source (Finnhub) error:", err instanceof Error ? err.message : "Unknown")
    return { score: -1, source: "error", detail: "exception" }
  }
}

// ============================================================================
// POLYGON — ticker news tone for SPY (uses publisher insights when present)
// ============================================================================
export async function getPolygonNewsSentiment(): Promise<{
  score: number
  source: string
  detail: string
}> {
  const key = process.env.POLYGON_API_KEY
  if (!key) {
    console.log("[v0] Source (Polygon): POLYGON_API_KEY not set")
    return { score: -1, source: "unavailable", detail: "no_key" }
  }
  try {
    console.log("[v0] Source (Polygon): Fetching ticker news for SPY...")
    const res = await fetch(
      `https://api.polygon.io/v2/reference/news?ticker=SPY&limit=50&order=desc&sort=published_utc&apiKey=${key}`,
      { signal: AbortSignal.timeout(12000) },
    )
    if (!res.ok) {
      console.log("[v0] Source (Polygon): HTTP", res.status)
      return { score: -1, source: "http_error", detail: String(res.status) }
    }
    const data = await res.json()
    const articles: any[] = data?.results || []
    if (articles.length === 0) return { score: -1, source: "no_news", detail: "empty" }

    // Prefer Polygon's own per-article insights sentiment when available
    let pos = 0
    let neg = 0
    let insightCount = 0
    for (const a of articles) {
      const insights: any[] = a.insights || []
      for (const ins of insights) {
        if (ins.sentiment === "positive") pos++
        else if (ins.sentiment === "negative") neg++
        if (ins.sentiment) insightCount++
      }
    }

    if (insightCount > 0 && pos + neg > 0) {
      const score = Math.round((pos / (pos + neg)) * 100)
      console.log(`[v0] ✓ Source (Polygon): ${score}/100 from ${insightCount} insights`)
      return { score, source: "polygon_insights", detail: `${insightCount} insights` }
    }

    // Fall back to keyword scoring of titles/descriptions
    const texts = articles.map((a) => `${a.title || ""} ${a.description || ""}`)
    const { score, bullish, bearish } = keywordScore(texts)
    if (bullish + bearish === 0) return { score: -1, source: "no_signal", detail: "neutral" }
    console.log(`[v0] ✓ Source (Polygon): ${score}/100 over ${articles.length} articles (keywords)`)
    return { score, source: "polygon_news", detail: `${articles.length} articles` }
  } catch (err) {
    console.log("[v0] Source (Polygon) error:", err instanceof Error ? err.message : "Unknown")
    return { score: -1, source: "error", detail: "exception" }
  }
}

// ============================================================================
// GOOGLE NEWS — market headline pulse via Serper (serper.dev /news)
// ============================================================================
export async function getGoogleNewsSentiment(): Promise<{
  score: number
  source: string
  detail: string
}> {
  const key = process.env.SERPER_API_KEY
  if (!key) {
    console.log("[v0] Source (GoogleNews): SERPER_API_KEY not set")
    return { score: -1, source: "unavailable", detail: "no_key" }
  }
  try {
    console.log("[v0] Source (GoogleNews): Fetching market headlines via Serper...")
    const res = await fetch("https://google.serper.dev/news", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: "stock market", gl: "us", hl: "en", num: 40, tbs: "qdr:d" }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) {
      console.log("[v0] Source (GoogleNews): HTTP", res.status)
      return { score: -1, source: "http_error", detail: String(res.status) }
    }
    const data = await res.json()
    const news: any[] = data?.news || []
    if (news.length === 0) return { score: -1, source: "no_news", detail: "empty" }
    const texts = news.map((n) => `${n.title || ""} ${n.snippet || ""}`)
    const { score, bullish, bearish } = keywordScore(texts)
    if (bullish + bearish === 0) return { score: -1, source: "no_signal", detail: "neutral" }
    console.log(`[v0] ✓ Source (GoogleNews): ${score}/100 over ${news.length} headlines`)
    return { score, source: "google_news", detail: `${news.length} headlines` }
  } catch (err) {
    console.log("[v0] Source (GoogleNews) error:", err instanceof Error ? err.message : "Unknown")
    return { score: -1, source: "error", detail: "exception" }
  }
}

// ----------------------------------------------------------------------------
// Server-side ScrapingBee helper — calls the upstream API directly (no relative
// fetch) so it works inside route handlers. Returns HTML string or null.
// ----------------------------------------------------------------------------
async function scrapeBeeHtml(targetUrl: string, renderJs = true): Promise<string | null> {
  const key = resolveApiKey("SCRAPINGBEE_API_KEY") // respects DISABLED_APIS kill switch
  if (!key) return null
  try {
    const params = new URLSearchParams({
      api_key: key,
      url: targetUrl,
      render_js: renderJs ? "true" : "false",
      premium_proxy: "true",
      country_code: "us",
      block_resources: "false",
      timeout: "20000",
    })
    const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params.toString()}`, {
      headers: { Accept: "text/html, application/json, */*" },
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) {
      console.log("[v0] ScrapingBee HTTP", res.status, "for", targetUrl)
      return null
    }
    return await res.text()
  } catch (err) {
    console.log("[v0] ScrapingBee error:", err instanceof Error ? err.message : "Unknown")
    return null
  }
}

// ============================================================================
// AAII INVESTOR SURVEY — bullish vs bearish % scraped via ScrapingBee.
// Score = bullish / (bullish + bearish) * 100.
// ============================================================================
export async function getAAIISentiment(): Promise<{
  score: number
  source: string
  detail: string
}> {
  const html = await scrapeBeeHtml("https://www.aaii.com/sentimentsurvey", true)
  if (!html) return { score: -1, source: "unavailable", detail: "no_html" }
  try {
    const bull = html.match(/Bullish[:\s]+(\d+\.?\d*)%/i)
    const bear = html.match(/Bearish[:\s]+(\d+\.?\d*)%/i)
    if (!bull || !bear) {
      console.log("[v0] Source (AAII): could not parse percentages")
      return { score: -1, source: "parse_failed", detail: "no_match" }
    }
    const bullish = Number.parseFloat(bull[1])
    const bearish = Number.parseFloat(bear[1])
    if (bullish + bearish <= 0) return { score: -1, source: "no_signal", detail: "zero" }
    const score = Math.round((bullish / (bullish + bearish)) * 100)
    console.log(`[v0] ✓ Source (AAII): ${score}/100 (bull ${bullish}% / bear ${bearish}%)`)
    return { score, source: "aaii_survey", detail: `bull ${bullish}% / bear ${bearish}%` }
  } catch (err) {
    console.log("[v0] Source (AAII) error:", err instanceof Error ? err.message : "Unknown")
    return { score: -1, source: "error", detail: "exception" }
  }
}

// ============================================================================
// CNN FEAR & GREED INDEX — 0-100 where higher = greed/bullish (already aligned).
// Tries CNN's public JSON endpoint first, then ScrapingBee as a fallback.
// ============================================================================
export async function getCNNFearGreedSentiment(): Promise<{
  score: number
  source: string
  detail: string
}> {
  // 1) Direct JSON endpoint (no key needed, but CNN sometimes blocks datacenters)
  try {
    console.log("[v0] Source (CNN F&G): Trying CNN JSON endpoint...")
    const res = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const data = await res.json()
      const val = Number(data?.fear_and_greed?.score)
      if (Number.isFinite(val) && val >= 0 && val <= 100) {
        const rating = data?.fear_and_greed?.rating || ""
        console.log(`[v0] ✓ Source (CNN F&G): ${Math.round(val)}/100 (${rating})`)
        return { score: Math.round(val), source: "cnn_fear_greed", detail: rating }
      }
    } else {
      console.log("[v0] Source (CNN F&G): JSON HTTP", res.status)
    }
  } catch (err) {
    console.log("[v0] Source (CNN F&G) JSON error:", err instanceof Error ? err.message : "Unknown")
  }

  // 2) ScrapingBee fallback against the same endpoint
  const html = await scrapeBeeHtml("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", false)
  if (html) {
    try {
      const json = JSON.parse(html)
      const val = Number(json?.fear_and_greed?.score)
      if (Number.isFinite(val) && val >= 0 && val <= 100) {
        const rating = json?.fear_and_greed?.rating || ""
        console.log(`[v0] ✓ Source (CNN F&G via Bee): ${Math.round(val)}/100 (${rating})`)
        return { score: Math.round(val), source: "cnn_fear_greed_scraped", detail: rating }
      }
    } catch {
      const m = html.match(/"score"\s*:\s*([\d.]+)/)
      if (m) {
        const val = Math.round(Number.parseFloat(m[1]))
        if (val >= 0 && val <= 100) {
          console.log(`[v0] ✓ Source (CNN F&G via Bee regex): ${val}/100`)
          return { score: val, source: "cnn_fear_greed_scraped", detail: "regex" }
        }
      }
    }
  }

  console.log("[v0] Source (CNN F&G): unavailable")
  return { score: -1, source: "unavailable", detail: "all_failed" }
}
