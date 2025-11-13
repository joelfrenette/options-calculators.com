export const runtime = "edge"

import { getApiKey } from "@/lib/api-keys"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint")
  const symbol = searchParams.get("symbol")

  if (!endpoint || !symbol) {
    return Response.json({ error: "Missing endpoint or symbol" }, { status: 400 })
  }

  const TWELVE_DATA_API_KEY = getApiKey("TWELVE_DATA_API_KEY")

  if (!TWELVE_DATA_API_KEY) {
    return Response.json({ error: "TwelveData API key not configured" }, { status: 500 })
  }

  try {
    const url = `https://api.twelvedata.com/${endpoint}?symbol=${symbol}&apikey=${TWELVE_DATA_API_KEY}`

    console.log("[v0] Twelve Data API request:", url.replace(TWELVE_DATA_API_KEY, "API_KEY"))

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Twelve Data API error:", response.status, errorText)
      return Response.json(
        { error: `API request failed: ${response.status}`, details: errorText },
        { status: response.status },
      )
    }

    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error("[v0] Twelve Data proxy error:", error)
    return Response.json(
      { error: "Failed to fetch data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
