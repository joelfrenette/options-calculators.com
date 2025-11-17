import { NextResponse } from "next/server"

// Reddit WallStreetBets Sentiment API
// Tracks comment volume and sentiment on r/wallstreetbets

export async function GET() {
  try {
    // Using Reddit JSON API (no auth required for public data)
    const subreddit = "wallstreetbets"
    const response = await fetch(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CCPIBot/1.0)"
        },
        signal: AbortSignal.timeout(10000)
      }
    )

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status}`)
    }

    const data = await response.json()
    const posts = data.data.children.map((child: any) => child.data)

    // Analyze sentiment from post titles
    const bearishKeywords = ["crash", "dump", "bear", "puts", "short", "down", "drop", "fall", "recession"]
    const bullishKeywords = ["moon", "bull", "calls", "rally", "pump", "up", "rocket", "gain", "yolo"]

    let bearishCount = 0
    let bullishCount = 0
    let totalComments = 0
    let totalScore = 0

    posts.forEach((post: any) => {
      const title = post.title.toLowerCase()
      totalComments += post.num_comments || 0
      totalScore += post.score || 0

      bearishKeywords.forEach(keyword => {
        if (title.includes(keyword)) bearishCount++
      })

      bullishKeywords.forEach(keyword => {
        if (title.includes(keyword)) bullishCount++
      })
    })

    const avgCommentsPerPost = totalComments / posts.length
    const avgScore = totalScore / posts.length
    const sentimentRatio = bullishCount / (bearishCount + bullishCount + 1) // +1 to avoid division by zero
    const activityLevel = avgCommentsPerPost > 500 ? "Very High" : avgCommentsPerPost > 250 ? "High" : avgCommentsPerPost > 100 ? "Moderate" : "Low"

    return NextResponse.json({
      status: "success",
      timestamp: new Date().toISOString(),
      data: {
        subreddit,
        posts_analyzed: posts.length,
        total_comments: totalComments,
        avg_comments_per_post: Math.round(avgCommentsPerPost),
        avg_score: Math.round(avgScore),
        sentiment: {
          bullish_mentions: bullishCount,
          bearish_mentions: bearishCount,
          sentiment_ratio: sentimentRatio.toFixed(2),
          interpretation: sentimentRatio > 0.6 ? "Bullish" : sentimentRatio > 0.4 ? "Neutral" : "Bearish"
        },
        activity_level: activityLevel,
        risk_signal: activityLevel === "Very High" && sentimentRatio > 0.7 ? "Euphoria Warning" : "Normal"
      }
    })
  } catch (error) {
    console.error("[v0] Reddit sentiment error:", error)
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to fetch Reddit sentiment data",
        error: String(error)
      },
      { status: 500 }
    )
  }
}
