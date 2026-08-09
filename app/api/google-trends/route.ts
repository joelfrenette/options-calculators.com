import { NextResponse } from "next/server"
import { resolveApiKey } from "@/lib/api-keys"

// Uses Serper API (requires SERPER_API_KEY)

export async function GET() {
  const SERPER_API_KEY = resolveApiKey("SERPER_API_KEY")

  if (!SERPER_API_KEY) {
    console.log("[v0] Google Trends: No SERPER_API_KEY found, returning fallback data")
    return NextResponse.json({
      status: "No API Key",
      data: null,
      message: "SERPER_API_KEY environment variable not configured",
    })
  }

  try {
    // Google search keywords for market sentiment
    const keywords = ["stock market crash", "recession", "buy the dip", "stock market bubble"]

    const trendsData = await Promise.all(
      keywords.map(async (keyword) => {
        try {
          // Use Serper to get search results count/relevance as a proxy for interest
          const response = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: {
              "X-API-KEY": SERPER_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              q: keyword,
              num: 10,
              gl: "us",
              hl: "en",
              tbs: "qdr:w", // Last week
            }),
            signal: AbortSignal.timeout(10000),
          })

          if (!response.ok) {
            throw new Error(`Serper API error: ${response.status}`)
          }

          const data = await response.json()

          // Use number of organic results and news results as interest indicator
          const organicCount = data.organic?.length || 0
          const newsCount = data.news?.length || 0
          const totalRelevance = organicCount + newsCount

          // Normalize to 0-100 scale (max 20 results = 100)
          const interestScore = Math.min(100, Math.round((totalRelevance / 20) * 100))

          return {
            keyword,
            interest: interestScore,
            trend: interestScore > 50 ? "High" : interestScore > 25 ? "Moderate" : "Low",
            resultsFound: totalRelevance,
          }
        } catch (error) {
          console.error(`[v0] Serper error for "${keyword}":`, error)
          return {
            keyword,
            interest: null,
            trend: "Unknown",
            error: String(error),
          }
        }
      }),
    )

    // Calculate fear index (higher values = more fear)
    const fearKeywords = ["stock market crash", "recession"]
    const greedKeywords = ["buy the dip"]

    // Average over the keywords that actually returned, not over the keywords
    // requested. Dividing the sum by `fearKeywords.length` meant one missing
    // keyword halved the fear score — a data gap read as calm markets.
    const meanInterest = (keywords: string[]): number | null => {
      const values = trendsData
        .filter((t) => keywords.includes(t.keyword) && t.interest !== null)
        .map((t) => Number(t.interest))
        .filter((v) => Number.isFinite(v))
      if (values.length === 0) return null
      return values.reduce((sum, v) => sum + v, 0) / values.length
    }

    const fearScore = meanInterest(fearKeywords)
    const greedScore = meanInterest(greedKeywords)

    // Positive = fear, Negative = greed. Null when either side has no data —
    // a one-sided difference is not a sentiment reading.
    const sentimentIndex = fearScore === null || greedScore === null ? null : fearScore - greedScore

    return NextResponse.json({
      status: "success",
      timestamp: new Date().toISOString(),
      source: "serper",
      data: {
        keywords: trendsData,
        fearScore,
        greedScore,
        sentimentIndex,
        // Null index has no interpretation. Every comparison below is false
        // against null, so a missing index used to fall through to "Greed".
        interpretation:
          sentimentIndex === null
            ? null
            : sentimentIndex > 20
              ? "High Fear"
              : sentimentIndex > 0
                ? "Moderate Fear"
                : sentimentIndex > -20
                  ? "Neutral"
                  : "Greed",
      },
    })
  } catch (error) {
    console.error("[v0] Serper Trends error:", error)
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to fetch Google search data via Serper",
        error: String(error),
      },
      { status: 500 },
    )
  }
}
