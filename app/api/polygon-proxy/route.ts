export const runtime = "edge"

const FETCH_TIMEOUT_MS = 15000 // 15 second timeout

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

import { getApiKey } from "@/lib/api-keys"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint")
  const ticker = searchParams.get("ticker")

  if (!endpoint) {
    return Response.json({ error: "Missing endpoint" }, { status: 400 })
  }

  if (endpoint !== "options-chain" && endpoint !== "options-chain-snapshot" && !ticker) {
    return Response.json({ error: "Missing ticker" }, { status: 400 })
  }

  const apiKey = getApiKey("POLYGON_API_KEY")

  if (!apiKey) {
    return Response.json({ error: "Polygon API key not configured" }, { status: 500 })
  }

  try {
    let url = ""

    if (endpoint === "quote") {
      url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${apiKey}`
    } else if (endpoint === "snapshot") {
      url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${apiKey}`
    } else if (endpoint === "financials") {
      url = `https://api.polygon.io/vX/reference/financials?ticker=${ticker}&limit=1&apiKey=${apiKey}`
    } else if (endpoint === "options") {
      url = `https://api.polygon.io/v3/snapshot/options/${ticker}?apiKey=${apiKey}`
    } else if (endpoint === "options-snapshot") {
      // Get the underlying ticker from query params (e.g., TSLA, AAPL, etc.)
      const underlying = searchParams.get("underlying")

      if (!underlying) {
        return Response.json({ error: "Missing underlying ticker for options-snapshot" }, { status: 400 })
      }

      // Correct format: /v3/snapshot/options/{underlyingAsset}/{optionContract}
      url = `https://api.polygon.io/v3/snapshot/options/${underlying}/${ticker}?apiKey=${apiKey}`
    } else if (endpoint === "options-chain-snapshot") {
      const expiryDate = searchParams.get("expiry_date")
      const optionType = searchParams.get("option_type") || "put"

      if (!ticker || !expiryDate) {
        return Response.json({ error: "Missing ticker or expiry_date for options-chain-snapshot" }, { status: 400 })
      }

      // Use the snapshot endpoint that returns all options with greeks and quotes
      url = `https://api.polygon.io/v3/snapshot/options/${ticker}?expiration_date=${expiryDate}&contract_type=${optionType}&limit=250&apiKey=${apiKey}`
    } else if (endpoint === "options-chain") {
      const expiryDate = searchParams.get("expiry_date")
      const optionType = searchParams.get("option_type") || "put"

      if (!ticker || !expiryDate) {
        return Response.json({ error: "Missing ticker or expiry_date for options-chain" }, { status: 400 })
      }

      url = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${ticker}&contract_type=${optionType}&expiration_date=${expiryDate}&limit=250&apiKey=${apiKey}`
    } else if (endpoint === "aggregates") {
      const toDate = new Date().toISOString().split("T")[0]
      const fromDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${fromDate}/${toDate}?adjusted=true&sort=asc&limit=300&apiKey=${apiKey}`
    }

    console.log("[v0] Polygon API request:", url.replace(apiKey, "API_KEY"))

    const response = await fetchWithTimeout(url)

    if (!response.ok) {
      const contentType = response.headers.get("content-type") || ""

      const errorText = await response.text()

      if (response.status === 429) {
        console.error("[v0] Polygon API rate limit hit for", ticker, "-", errorText.substring(0, 100))
        return Response.json({ error: "Rate limit exceeded", ticker, status: 429 }, { status: 429 })
      }

      console.error("[v0] Polygon API error:", response.status, errorText.substring(0, 200))

      return Response.json(
        {
          error: `Polygon API error: ${response.status}`,
          details: errorText.substring(0, 200),
          ticker,
          status: response.status,
        },
        { status: response.status },
      )
    }

    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[v0] Polygon proxy error for ${ticker} (${endpoint}):`, errorMessage)
    return Response.json(
      {
        error: "Failed to fetch from Polygon API",
        details: errorMessage,
        ticker,
        endpoint,
      },
      { status: 500 },
    )
  }
}
