// ============================================================================
// Real social-sentiment data sources
// Every function returns a 0-100 score where HIGHER = MORE BULLISH.
// On any failure they return score: -1 ("No data") — NEVER a fabricated value.
// ============================================================================

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
// REDDIT — r/wallstreetbets hot posts (public JSON, no key required)
// ============================================================================
export async function getRedditSentiment(): Promise<{
  score: number
  source: string
  posts: number
}> {
  try {
    console.log("[v0] Source (Reddit): Fetching r/wallstreetbets...")
    const res = await fetch("https://www.reddit.com/r/wallstreetbets/hot.json?limit=50", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; OptionsCalcBot/1.0)" },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      console.log("[v0] Source (Reddit): HTTP", res.status)
      return { score: -1, source: "unavailable", posts: 0 }
    }
    const data = await res.json()
    const posts: any[] = data?.data?.children?.map((c: any) => c.data) || []
    if (posts.length === 0) return { score: -1, source: "no_posts", posts: 0 }

    // Weight each title by post score so popular posts count more
    const titles = posts.map((p) => p.title)
    const { score, bullish, bearish } = keywordScore(titles)
    if (bullish + bearish === 0) {
      console.log("[v0] Source (Reddit): no directional keywords found")
      return { score: -1, source: "no_signal", posts: posts.length }
    }
    console.log(`[v0] ✓ Source (Reddit): ${score}/100 (${bullish}B/${bearish}Be over ${posts.length} posts)`)
    return { score, source: "reddit_wsb", posts: posts.length }
  } catch (err) {
    console.log("[v0] Source (Reddit) error:", err instanceof Error ? err.message : "Unknown")
    return { score: -1, source: "error", posts: 0 }
  }
}

// ============================================================================
// GOOGLE TRENDS — real Interest Over Time via SerpAPI (engine=google_trends)
// Compares bullish vs bearish search interest. Higher bull share = more bullish.
// ============================================================================
export async function getGoogleTrendsSentiment(): Promise<{
  score: number
  source: string
  detail: string
}> {
  const key = process.env.SERPAPI_KEY
  if (!key) {
    console.log("[v0] Source (Trends): SERPAPI_KEY not set")
    return { score: -1, source: "unavailable", detail: "no_key" }
  }
  try {
    console.log("[v0] Source (Trends): Fetching real Google Trends via SerpAPI...")
    // Compare two terms head-to-head over the last 7 days (Trends allows comma-separated terms)
    const url =
      "https://serpapi.com/search.json?engine=google_trends" +
      "&q=" +
      encodeURIComponent("stock market rally,stock market crash") +
      "&data_type=TIMESERIES&date=now+7-d&geo=US&hl=en&api_key=" +
      key

    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) {
      console.log("[v0] Source (Trends): HTTP", res.status)
      return { score: -1, source: "http_error", detail: String(res.status) }
    }
    const data = await res.json()
    const timeline: any[] = data?.interest_over_time?.timeline_data || []
    if (timeline.length === 0) {
      console.log("[v0] Source (Trends): empty timeline")
      return { score: -1, source: "no_data", detail: "empty" }
    }

    // timeline_data[i].values = [{ query: "rally", extracted_value }, { query: "crash", ... }]
    let bullSum = 0
    let bearSum = 0
    for (const point of timeline) {
      const vals: any[] = point.values || []
      bullSum += Number(vals[0]?.extracted_value ?? vals[0]?.value ?? 0)
      bearSum += Number(vals[1]?.extracted_value ?? vals[1]?.value ?? 0)
    }
    const total = bullSum + bearSum
    if (total <= 0) return { score: -1, source: "no_interest", detail: "zero" }

    const score = Math.round((bullSum / total) * 100)
    console.log(`[v0] ✓ Source (Trends): ${score}/100 (rally ${bullSum} vs crash ${bearSum})`)
    return { score, source: "serpapi_google_trends", detail: `rally ${bullSum} / crash ${bearSum}` }
  } catch (err) {
    console.log("[v0] Source (Trends) error:", err instanceof Error ? err.message : "Unknown")
    return { score: -1, source: "error", detail: "exception" }
  }
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
  const token = process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY
  if (!token) {
    console.log("[v0] Source (Twitter): APIFY token not set")
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
