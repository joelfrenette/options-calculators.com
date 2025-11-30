/**
 * SERPAPI Google Finance Utility Functions
 *
 * Provides helper functions to fetch stock data from Google Finance
 * via SERPAPI as a fallback when primary sources fail.
 *
 * Use cases:
 * - Stock price quotes when Polygon/TwelveData fail
 * - Fundamental data (P/E, market cap) when FMP fails
 * - Historical price data as secondary source
 */

const SERPAPI_BASE_URL = "https://serpapi.com/search.json"
const FETCH_TIMEOUT_MS = 12000

interface SerpApiQuoteResponse {
  status: string
  source: string
  ticker: string
  data: {
    price: number | null
    currency: string
    priceChange: number | null
    priceChangePercent: number | null
    previousClose: number | null
    dayRange: { low: number | null; high: number | null }
    yearRange: { low: number | null; high: number | null }
    marketCap: string | null
    peRatio: number | null
    dividendYield: string | null
    volume: number | null
    avgVolume: number | null
    companyName: string
    exchange: string | null
  }
}

interface SerpApiHistoricalResponse {
  status: string
  source: string
  ticker: string
  window: string
  data: {
    prices: Array<{ date: string; price: number; volume: number | null }>
    count: number
    startDate: string | null
    endDate: string | null
  }
}

/**
 * Fetch stock quote from SERPAPI Google Finance
 * Returns standardized quote data or null if failed
 */
export async function fetchSerpApiQuote(ticker: string): Promise<SerpApiQuoteResponse | null> {
  const SERPAPI_KEY = process.env.SERPAPI_KEY

  if (!SERPAPI_KEY) {
    console.log("[v0] SERPAPI: No API key configured")
    return null
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    // Try with exchange suffix (NASDAQ is most common for US stocks)
    const exchanges = ["NASDAQ", "NYSE", ""]

    for (const exchange of exchanges) {
      const query = exchange ? `${ticker}:${exchange}` : ticker
      const url = `${SERPAPI_BASE_URL}?engine=google_finance&q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}`

      try {
        const response = await fetch(url, { signal: controller.signal })
        clearTimeout(timeoutId)

        if (!response.ok) continue

        const data = await response.json()

        // Check if we got valid data
        if (data.summary?.stock_price) {
          const summary = data.summary || {}
          const about = data.about || []

          return {
            status: "success",
            source: "serpapi_google_finance",
            ticker: ticker.toUpperCase(),
            data: {
              price: Number.parseFloat(summary.stock_price) || null,
              currency: summary.currency || "USD",
              priceChange: summary.price_movement?.value ? Number.parseFloat(summary.price_movement.value) : null,
              priceChangePercent: summary.price_movement?.percentage
                ? Number.parseFloat(summary.price_movement.percentage)
                : null,
              previousClose: summary.previous_close ? Number.parseFloat(summary.previous_close) : null,
              dayRange: {
                low: summary.range?.[0] ? Number.parseFloat(summary.range[0]) : null,
                high: summary.range?.[1] ? Number.parseFloat(summary.range[1]) : null,
              },
              yearRange: {
                low: summary.year_range?.[0] ? Number.parseFloat(summary.year_range[0]) : null,
                high: summary.year_range?.[1] ? Number.parseFloat(summary.year_range[1]) : null,
              },
              marketCap: summary.market_cap || null,
              peRatio: summary.pe_ratio ? Number.parseFloat(summary.pe_ratio) : null,
              dividendYield: summary.dividend_yield || null,
              volume: summary.volume ? Number.parseInt(summary.volume.replace(/,/g, "")) : null,
              avgVolume: summary.average_volume ? Number.parseInt(summary.average_volume.replace(/,/g, "")) : null,
              companyName: data.title || ticker,
              exchange: data.exchange || exchange || null,
            },
          }
        }
      } catch (err) {
        // Continue to next exchange
        continue
      }
    }

    console.log(`[v0] SERPAPI: No data found for ${ticker} on any exchange`)
    return null
  } catch (error) {
    console.error(`[v0] SERPAPI quote error for ${ticker}:`, error)
    return null
  }
}

/**
 * Fetch historical price data from SERPAPI Google Finance
 * @param ticker Stock symbol
 * @param window Time window: 1D, 5D, 1M, 6M, YTD, 1Y, 5Y, MAX
 */
export async function fetchSerpApiHistory(
  ticker: string,
  window: "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y" | "MAX" = "1Y",
): Promise<SerpApiHistoricalResponse | null> {
  const SERPAPI_KEY = process.env.SERPAPI_KEY

  if (!SERPAPI_KEY) {
    console.log("[v0] SERPAPI: No API key configured")
    return null
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const url = `${SERPAPI_BASE_URL}?engine=google_finance&q=${encodeURIComponent(ticker)}&window=${window}&api_key=${SERPAPI_KEY}`

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`[v0] SERPAPI history error for ${ticker}:`, response.status)
      return null
    }

    const data = await response.json()
    const graph = data.graph || []

    if (graph.length === 0) {
      console.log(`[v0] SERPAPI: No historical data for ${ticker}`)
      return null
    }

    const prices = graph.map((point: any) => ({
      date: point.date,
      price: Number.parseFloat(point.price) || 0,
      volume: point.volume ? Number.parseInt(point.volume.replace(/,/g, "")) : null,
    }))

    return {
      status: "success",
      source: "serpapi_google_finance",
      ticker: ticker.toUpperCase(),
      window,
      data: {
        prices,
        count: prices.length,
        startDate: prices[0]?.date || null,
        endDate: prices[prices.length - 1]?.date || null,
      },
    }
  } catch (error) {
    console.error(`[v0] SERPAPI history error for ${ticker}:`, error)
    return null
  }
}

/**
 * Check if SERPAPI is configured and available
 */
export function isSerpApiAvailable(): boolean {
  return !!process.env.SERPAPI_KEY
}
