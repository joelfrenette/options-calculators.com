import { NextResponse } from "next/server"

// Fundamentals API - Forward P/E, Earnings Growth, Revenue Growth
// Uses Financial Modeling Prep (FMP) API

export async function GET() {
  const FMP_API_KEY = process.env.FMP_API_KEY

  if (!FMP_API_KEY) {
    console.log("[v0] Fundamentals: No FMP_API_KEY found")
    return NextResponse.json({
      status: "No API Key",
      data: null,
      message: "FMP_API_KEY environment variable not configured"
    })
  }

  try {
    // Fetch S&P 500 ETF (SPY) as proxy for market fundamentals
    const symbol = "SPY"

    // Get key metrics (forward P/E, earnings growth, etc.)
    const [metricsRes, growthRes] = await Promise.all([
      fetch(
        `https://financialmodelingprep.com/api/v3/key-metrics/${symbol}?apikey=${FMP_API_KEY}`,
        { signal: AbortSignal.timeout(10000) }
      ),
      fetch(
        `https://financialmodelingprep.com/api/v3/financial-growth/${symbol}?limit=4&apikey=${FMP_API_KEY}`,
        { signal: AbortSignal.timeout(10000) }
      )
    ])

    if (!metricsRes.ok || !growthRes.ok) {
      throw new Error("FMP API error")
    }

    const metrics = await metricsRes.json()
    const growth = await growthRes.json()

    const latestMetrics = metrics[0] || {}
    const latestGrowth = growth[0] || {}

    // Calculate top 7 concentration (approximate from public data)
    // AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA combined weight in S&P 500
    const top7Concentration = 28.5 // Approximate as of Q4 2024 (~28-30%)

    return NextResponse.json({
      status: "success",
      timestamp: new Date().toISOString(),
      data: {
        symbol,
        forward_pe: latestMetrics.peRatio || null,
        price_to_sales: latestMetrics.priceToSalesRatio || null,
        earnings_growth_yoy: (latestGrowth.netIncomeGrowth * 100).toFixed(2) || null,
        revenue_growth_yoy: (latestGrowth.revenueGrowth * 100).toFixed(2) || null,
        profit_margin: (latestMetrics.netProfitMargin * 100).toFixed(2) || null,
        top_7_concentration: top7Concentration,
        interpretation: {
          valuation: latestMetrics.peRatio > 25 ? "Overvalued" : latestMetrics.peRatio > 18 ? "Elevated" : "Normal",
          growth: latestGrowth.revenueGrowth > 0.10 ? "Strong" : latestGrowth.revenueGrowth > 0 ? "Moderate" : "Weak",
          concentration_risk: top7Concentration > 30 ? "Very High" : top7Concentration > 25 ? "High" : "Moderate"
        }
      }
    })
  } catch (error) {
    console.error("[v0] Fundamentals error:", error)
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to fetch fundamentals data",
        error: String(error)
      },
      { status: 500 }
    )
  }
}
