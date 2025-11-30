import { NextResponse } from "next/server"

/**
 * SERPAPI Google Finance API Proxy
 *
 * Provides stock data from Google Finance as a fallback source when:
 * - Polygon.io rate limits are hit
 * - TwelveData fails
 * - Yahoo Finance authentication issues
 *
 * Endpoints:
 * - quote: Real-time stock price, previous close, day range, year range
 * - financials: Income statement, balance sheet, cash flow data
 * - summary: Company info, key stats (P/E, market cap, dividend yield)
 * - graph: Historical price data at various intervals
 *
 * Documentation: https://serpapi.com/google-finance-api
 */

const FETCH_TIMEOUT_MS = 15000

async function fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`)
    }
    throw error
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint") // quote, financials, summary, graph
  const ticker = searchParams.get("ticker")
  const window = searchParams.get("window") // For graph: 1D, 5D, 1M, 6M, YTD, 1Y, 5Y, MAX

  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker parameter" }, { status: 400 })
  }

  const SERPAPI_KEY = process.env.SERPAPI_KEY

  if (!SERPAPI_KEY) {
    console.log("[v0] SERPAPI Finance: No SERPAPI_KEY found")
    return NextResponse.json(
      {
        error: "SERPAPI_KEY not configured",
        status: "no_api_key",
      },
      { status: 500 },
    )
  }

  try {
    // Build the SERPAPI Google Finance URL
    // Base parameters for Google Finance engine
    const baseParams = new URLSearchParams({
      engine: "google_finance",
      q: `${ticker}:NASDAQ`, // Try NASDAQ first, will auto-resolve
      api_key: SERPAPI_KEY,
    })

    // For markets endpoint (detailed quote data)
    if (endpoint === "quote" || endpoint === "summary" || !endpoint) {
      const url = `https://serpapi.com/search.json?${baseParams.toString()}`
      console.log("[v0] SERPAPI Finance quote request for:", ticker)

      const response = await fetchWithTimeout(url)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] SERPAPI Finance error:", response.status, errorText.substring(0, 200))
        return NextResponse.json(
          {
            error: `SERPAPI error: ${response.status}`,
            details: errorText.substring(0, 200),
          },
          { status: response.status },
        )
      }

      const data = await response.json()

      // Transform SERPAPI response to standard format
      const summary = data.summary || {}
      const marketData = data.market || {}
      const about = data.about || []

      return NextResponse.json({
        status: "success",
        source: "serpapi_google_finance",
        ticker: ticker.toUpperCase(),
        data: {
          // Price data
          price: summary.stock_price || null,
          currency: summary.currency || "USD",
          priceChange: summary.price_movement?.value || null,
          priceChangePercent: summary.price_movement?.percentage || null,

          // Key stats
          previousClose: summary.previous_close || null,
          dayRange: {
            low: summary.range?.[0] || null,
            high: summary.range?.[1] || null,
          },
          yearRange: {
            low: summary.year_range?.[0] || null,
            high: summary.year_range?.[1] || null,
          },
          marketCap: summary.market_cap || null,
          peRatio: summary.pe_ratio || null,
          dividendYield: summary.dividend_yield || null,
          volume: summary.volume || null,
          avgVolume: summary.average_volume || null,

          // Company info
          companyName: data.title || ticker,
          exchange: data.exchange || null,
          description: about.find((a: any) => a.label === "Description")?.value || null,
          ceo: about.find((a: any) => a.label === "CEO")?.value || null,
          headquarters: about.find((a: any) => a.label === "Headquarters")?.value || null,
          employees: about.find((a: any) => a.label === "Employees")?.value || null,

          // Market status
          marketStatus: marketData.trading || null,
          afterHoursPrice: marketData.post_market?.price || null,
          afterHoursChange: marketData.post_market?.price_movement?.value || null,
        },
        raw: data, // Include raw response for debugging
      })
    }

    // For financials endpoint (income statement, balance sheet, cash flow)
    if (endpoint === "financials") {
      // Add financials parameter
      baseParams.append("window", "MAX") // Get full history for financials
      const url = `https://serpapi.com/search.json?${baseParams.toString()}`
      console.log("[v0] SERPAPI Finance financials request for:", ticker)

      const response = await fetchWithTimeout(url)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] SERPAPI Finance financials error:", response.status)
        return NextResponse.json(
          {
            error: `SERPAPI financials error: ${response.status}`,
            details: errorText.substring(0, 200),
          },
          { status: response.status },
        )
      }

      const data = await response.json()
      const financials = data.financials || {}

      return NextResponse.json({
        status: "success",
        source: "serpapi_google_finance",
        ticker: ticker.toUpperCase(),
        data: {
          incomeStatement: financials.income_statement || null,
          balanceSheet: financials.balance_sheet || null,
          cashFlow: financials.cash_flow || null,
          quarterly: financials.quarterly || null,
          annual: financials.annual || null,
        },
        raw: data,
      })
    }

    // For graph/historical data endpoint
    if (endpoint === "graph" || endpoint === "history") {
      const graphWindow = window || "1Y" // Default to 1 year
      baseParams.set("window", graphWindow)
      const url = `https://serpapi.com/search.json?${baseParams.toString()}`
      console.log("[v0] SERPAPI Finance graph request for:", ticker, "window:", graphWindow)

      const response = await fetchWithTimeout(url)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] SERPAPI Finance graph error:", response.status)
        return NextResponse.json(
          {
            error: `SERPAPI graph error: ${response.status}`,
            details: errorText.substring(0, 200),
          },
          { status: response.status },
        )
      }

      const data = await response.json()
      const graph = data.graph || []

      // Transform graph data to OHLCV format
      const prices = graph.map((point: any) => ({
        date: point.date,
        price: point.price,
        volume: point.volume || null,
      }))

      return NextResponse.json({
        status: "success",
        source: "serpapi_google_finance",
        ticker: ticker.toUpperCase(),
        window: graphWindow,
        data: {
          prices,
          count: prices.length,
          startDate: prices[0]?.date || null,
          endDate: prices[prices.length - 1]?.date || null,
        },
        raw: data,
      })
    }

    return NextResponse.json(
      {
        error: "Invalid endpoint. Use: quote, summary, financials, or graph",
        validEndpoints: ["quote", "summary", "financials", "graph"],
      },
      { status: 400 },
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[v0] SERPAPI Finance error for ${ticker}:`, errorMessage)
    return NextResponse.json(
      {
        error: "Failed to fetch from SERPAPI Google Finance",
        details: errorMessage,
        ticker,
      },
      { status: 500 },
    )
  }
}
