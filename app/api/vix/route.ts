import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Fetch VIX data from Yahoo Finance API
    const response = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1d", {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    if (!response.ok) {
      throw new Error("Failed to fetch VIX data")
    }

    const data = await response.json()
    const quote = data.chart.result[0].meta.regularMarketPrice

    return NextResponse.json({
      vix: quote,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Error fetching VIX data:", error)
    return NextResponse.json({ error: "Failed to fetch VIX data" }, { status: 500 })
  }
}
