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
// P7-9. THREE SCRAPERS DELETED HERE: getTwitterSentiment (Apify $SPY tweets),
// getFinnhubNewsSentiment (Finnhub company-news for SPY) and
// getPolygonNewsSentiment (Polygon ticker news for SPY).
//
// None of the three had a caller. /api/social-sentiment is the only importer
// of this module and it imports two functions: getGoogleNewsSentiment and
// getCNNFearGreedSentiment. Its Finnhub and Polygon inputs come from its own
// local implementations, which read DIFFERENT corpora — Finnhub general news
// rather than SPY company news, and a Polygon call that prefers the
// publisher-insight sentiment. So these were not "the shared version" of
// anything; they were an older, diverged second answer to the same question,
// which is the shape S-11 already deleted one scraper from.
//
// All three also returned `score: -1` as their "no data" sentinel, in a field
// whose live range is 0-100. CLAUDE.md requires null for missing data
// precisely because a magic number survives one arithmetic step and stops
// being recognisable: a -1 folded into any weighted average lands inside the
// valid range and reads as a real bearish reading.
//
// getPolygonNewsSentiment is also the finding that exposed a false negative in
// scripts/check-dead-exports.ts — see the note there.
// ============================================================================

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
// AAII INVESTOR SURVEY — REMOVED with the Social Sentiment pillar (S-11).
// This was a second, unimported copy of the scrape, and it carried the same
// defect: two independent regexes over the page, pairing a "Bullish" and a
// "Bearish" that need not come from the same week. Nothing consumed it.
// ============================================================================

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
