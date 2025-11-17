import { NextResponse } from "next/server"

// Google Trends API - Search volume for market sentiment keywords
// Uses Google Trends API via SerpAPI (requires SERPAPI_KEY)

export async function GET() {
  const SERPAPI_KEY = process.env.SERPAPI_KEY

  if (!SERPAPI_KEY) {
    console.log("[v0] Google Trends: No SERPAPI_KEY found, returning fallback data")
    return NextResponse.json({
      status: "No API Key",
      data: null,
      message: "SERPAPI_KEY environment variable not configured"
    })
  }

  try {
    // Google Trends keywords for market sentiment
    const keywords = [
      "stock market crash",
      "recession",
      "buy the dip",
      "stock market bubble"
    ]

    const trendsData = await Promise.all(
      keywords.map(async (keyword) => {
        try {
          const response = await fetch(
            `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(keyword)}&data_type=TIMESERIES&api_key=${SERPAPI_KEY}`,
            { signal: AbortSignal.timeout(10000) }
          )

          if (!response.ok) {
            throw new Error(`Google Trends API error: ${response.status}`)
          }

          const data = await response.json()
          
          // Extract latest interest score (0-100)
          const latestScore = data.interest_over_time?.timeline_data?.[0]?.values?.[0]?.extracted_value || 0

          return {
            keyword,
            interest: latestScore,
            trend: latestScore > 50 ? "High" : latestScore > 25 ? "Moderate" : "Low"
          }
        } catch (error) {
          console.error(`[v0] Google Trends error for "${keyword}":`, error)
          return {
            keyword,
            interest: null,
            trend: "Unknown",
            error: String(error)
          }
        }
      })
    )

    // Calculate fear index (higher values = more fear)
    const fearKeywords = ["stock market crash", "recession"]
    const greedKeywords = ["buy the dip"]
    
    const fearScore = trendsData
      .filter(t => fearKeywords.includes(t.keyword) && t.interest !== null)
      .reduce((sum, t) => sum + (t.interest || 0), 0) / fearKeywords.length

    const greedScore = trendsData
      .filter(t => greedKeywords.includes(t.keyword) && t.interest !== null)
      .reduce((sum, t) => sum + (t.interest || 0), 0) / greedKeywords.length

    const sentimentIndex = fearScore - greedScore // Positive = fear, Negative = greed

    return NextResponse.json({
      status: "success",
      timestamp: new Date().toISOString(),
      data: {
        keywords: trendsData,
        sentimentIndex,
        interpretation: sentimentIndex > 20 ? "High Fear" : sentimentIndex > 0 ? "Moderate Fear" : sentimentIndex > -20 ? "Neutral" : "Greed"
      }
    })
  } catch (error) {
    console.error("[v0] Google Trends error:", error)
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to fetch Google Trends data",
        error: String(error)
      },
      { status: 500 }
    )
  }
}
