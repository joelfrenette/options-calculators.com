export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // Calculate date range (6 months of data)
    const endDate = Math.floor(Date.now() / 1000)
    const startDate = endDate - 180 * 24 * 60 * 60 // 6 months ago

    // Fetch historical VIX data from Yahoo Finance
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?period1=${startDate}&period2=${endDate}&interval=1d`

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch VIX history")
    }

    const data = await response.json()
    const result = data.chart.result[0]

    // Extract timestamps and closing prices
    const timestamps = result.timestamp
    const closes = result.indicators.quote[0].close

    // Format data for chart
    const history = timestamps
      .map((timestamp: number, index: number) => ({
        date: new Date(timestamp * 1000).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        value: closes[index] ? Number(closes[index].toFixed(2)) : null,
      }))
      .filter((item: any) => item.value !== null)

    return Response.json({ history })
  } catch (error) {
    console.error("Error fetching VIX history:", error)
    return Response.json({ error: "Failed to fetch VIX historical data" }, { status: 500 })
  }
}
