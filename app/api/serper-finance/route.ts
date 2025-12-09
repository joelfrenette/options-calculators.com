import { NextResponse } from "next/server"

/**
 * Serper Google Finance/Search API Proxy
 *
 * Provides stock data from Google Search as a fallback source when:
 * - Polygon.io rate limits are hit
 * - TwelveData fails
 * - Other finance APIs have issues
 *
 * Endpoints:
 * - quote: Real-time stock price from Google search
 * - news: Stock-related news articles
 *
 * Documentation: https://serper.dev/
 */

const FETCH_TIMEOUT_MS = 15000

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint") // quote, news
  const ticker = searchParams.get("ticker")

  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker parameter" }, { status: 400 })
  }

  const SERPER_API_KEY = process.env.SERPER_API_KEY

  if (!SERPER_API_KEY) {
    console.log("[v0] Serper Finance: No SERPER_API_KEY found")
    return NextResponse.json(
      {
        error: "SERPER_API_KEY not configured",
        status: "no_api_key",
      },
      { status: 500 },
    )
  }

  try {
    // For quote endpoint - search for stock price
    if (endpoint === "quote" || endpoint === "summary" || !endpoint) {
      console.log("[v0] Serper Finance quote request for:", ticker)

      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": SERPER_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: `${ticker} stock price`,
          gl: "us",
          hl: "en",
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] Serper Finance error:", response.status, errorText.substring(0, 200))
        return NextResponse.json(
          {
            error: `Serper error: ${response.status}`,
            details: errorText.substring(0, 200),
          },
          { status: response.status },
        )
      }

      const data = await response.json()

      // Extract stock data from knowledge graph or answer box
      const knowledgeGraph = data.knowledgeGraph || {}
      const answerBox = data.answerBox || {}

      return NextResponse.json({
        status: "success",
        source: "serper_google_search",
        ticker: ticker.toUpperCase(),
        data: {
          title: knowledgeGraph.title || answerBox.title || `${ticker.toUpperCase()} Stock`,
          description: knowledgeGraph.description || answerBox.snippet || null,
          price: answerBox.answer || knowledgeGraph.attributes?.Price || null,
          change: knowledgeGraph.attributes?.Change || null,
          marketCap: knowledgeGraph.attributes?.["Market cap"] || null,
          peRatio: knowledgeGraph.attributes?.["P/E ratio"] || null,
          dividendYield: knowledgeGraph.attributes?.["Dividend yield"] || null,
          // Include organic results for additional context
          relatedNews:
            data.organic?.slice(0, 5).map((r: any) => ({
              title: r.title,
              link: r.link,
              snippet: r.snippet,
            })) || [],
        },
        raw: data,
      })
    }

    // For news endpoint
    if (endpoint === "news") {
      console.log("[v0] Serper Finance news request for:", ticker)

      const response = await fetch("https://google.serper.dev/news", {
        method: "POST",
        headers: {
          "X-API-KEY": SERPER_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: `${ticker} stock`,
          gl: "us",
          hl: "en",
          num: 10,
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] Serper Finance news error:", response.status)
        return NextResponse.json(
          {
            error: `Serper news error: ${response.status}`,
            details: errorText.substring(0, 200),
          },
          { status: response.status },
        )
      }

      const data = await response.json()

      return NextResponse.json({
        status: "success",
        source: "serper_google_news",
        ticker: ticker.toUpperCase(),
        data: {
          news:
            data.news?.map((article: any) => ({
              title: article.title,
              link: article.link,
              snippet: article.snippet,
              date: article.date,
              source: article.source,
              imageUrl: article.imageUrl,
            })) || [],
          count: data.news?.length || 0,
        },
        raw: data,
      })
    }

    return NextResponse.json(
      {
        error: "Invalid endpoint. Use: quote, summary, or news",
        validEndpoints: ["quote", "summary", "news"],
      },
      { status: 400 },
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[v0] Serper Finance error for ${ticker}:`, errorMessage)
    return NextResponse.json(
      {
        error: "Failed to fetch from Serper",
        details: errorMessage,
        ticker,
      },
      { status: 500 },
    )
  }
}
