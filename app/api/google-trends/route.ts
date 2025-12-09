import { NextResponse } from "next/server"

// Uses Serper API (requires SERPER_API_KEY)

export async function GET() {
  const SERPER_API_KEY = process.env.SERPER_API_KEY

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

    const fearScore =
      trendsData
        .filter((t) => fearKeywords.includes(t.keyword) && t.interest !== null)
        .reduce((sum, t) => sum + (t.interest || 0), 0) / fearKeywords.length

    const greedScore =
      trendsData
        .filter((t) => greedKeywords.includes(t.keyword) && t.interest !== null)
        .reduce((sum, t) => sum + (t.interest || 0), 0) / greedKeywords.length

    const sentimentIndex = fearScore - greedScore // Positive = fear, Negative = greed

    return NextResponse.json({
      status: "success",
      timestamp: new Date().toISOString(),
      source: "serper",
      data: {
        keywords: trendsData,
        sentimentIndex,
        interpretation:
          sentimentIndex > 20
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
