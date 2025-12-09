/**
 * Serper Google Search Finance Utility Functions
 *
 * Provides helper functions to fetch stock data from Google Search
 * via Serper as a fallback when primary sources fail.
 *
 * Use cases:
 * - Stock price quotes when Polygon/TwelveData fail
 * - Stock news and sentiment
 * - Market data as secondary source
 */

const SERPER_BASE_URL = "https://google.serper.dev"
const FETCH_TIMEOUT_MS = 12000

interface SerperQuoteResponse {
  status: string
  source: string
  ticker: string
  data: {
    title: string
    description: string | null
    price: string | null
    change: string | null
    marketCap: string | null
    peRatio: string | null
    dividendYield: string | null
    relatedNews: Array<{ title: string; link: string; snippet: string }>
  }
}

interface SerperNewsResponse {
  status: string
  source: string
  ticker: string
  data: {
    news: Array<{
      title: string
      link: string
      snippet: string
      date: string
      source: string
      imageUrl?: string
    }>
    count: number
  }
}

/**
 * Fetch stock quote from Serper Google Search
 * Returns standardized quote data or null if failed
 */
export async function fetchSerperQuote(ticker: string): Promise<SerperQuoteResponse | null> {
  const SERPER_API_KEY = process.env.SERPER_API_KEY

  if (!SERPER_API_KEY) {
    console.log("[v0] Serper: No API key configured")
    return null
  }

  try {
    const response = await fetch(`${SERPER_BASE_URL}/search`, {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: `${ticker} stock price today`,
        gl: "us",
        hl: "en",
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (!response.ok) {
      console.error(`[v0] Serper quote error for ${ticker}:`, response.status)
      return null
    }

    const data = await response.json()

    // Extract stock data from knowledge graph or answer box
    const knowledgeGraph = data.knowledgeGraph || {}
    const answerBox = data.answerBox || {}

    return {
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
        relatedNews:
          data.organic?.slice(0, 5).map((r: any) => ({
            title: r.title,
            link: r.link,
            snippet: r.snippet,
          })) || [],
      },
    }
  } catch (error) {
    console.error(`[v0] Serper quote error for ${ticker}:`, error)
    return null
  }
}

/**
 * Fetch stock news from Serper Google News
 */
export async function fetchSerperNews(ticker: string): Promise<SerperNewsResponse | null> {
  const SERPER_API_KEY = process.env.SERPER_API_KEY

  if (!SERPER_API_KEY) {
    console.log("[v0] Serper: No API key configured")
    return null
  }

  try {
    const response = await fetch(`${SERPER_BASE_URL}/news`, {
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
      console.error(`[v0] Serper news error for ${ticker}:`, response.status)
      return null
    }

    const data = await response.json()

    return {
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
    }
  } catch (error) {
    console.error(`[v0] Serper news error for ${ticker}:`, error)
    return null
  }
}

/**
 * Check if Serper is configured and available
 */
export function isSerperAvailable(): boolean {
  return !!process.env.SERPER_API_KEY
}
