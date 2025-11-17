import { NextResponse } from "next/server"

// Macro Indicators API - USD Index, M2, Unemployment, Debt-to-GDP
// Uses FRED and Alpha Vantage APIs

export async function GET() {
  const FRED_API_KEY = process.env.FRED_API_KEY
  const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY

  if (!FRED_API_KEY || !ALPHA_VANTAGE_API_KEY) {
    console.log("[v0] Macro Indicators: Missing API keys")
    return NextResponse.json({
      status: "No API Keys",
      data: null,
      message: "FRED_API_KEY or ALPHA_VANTAGE_API_KEY not configured"
    })
  }

  try {
    // Fetch USD Index (DXY) from Alpha Vantage
    const dxyRes = await fetch(
      `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=EUR&apikey=${ALPHA_VANTAGE_API_KEY}`,
      { signal: AbortSignal.timeout(10000) }
    )

    // Fetch FRED indicators
    const [m2Res, unempRes, debtRes] = await Promise.all([
      fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=M2SL&api_key=${FRED_API_KEY}&file_type=json&limit=2&sort_order=desc`,
        { signal: AbortSignal.timeout(10000) }
      ),
      fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=UNRATE&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`,
        { signal: AbortSignal.timeout(10000) }
      ),
      fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=GFDEGDQ188S&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`,
        { signal: AbortSignal.timeout(10000) }
      )
    ])

    if (!m2Res.ok || !unempRes.ok || !debtRes.ok) {
      throw new Error("FRED API error")
    }

    const dxyData = dxyRes.ok ? await dxyRes.json() : null
    const m2Data = await m2Res.json()
    const unempData = await unempRes.json()
    const debtData = await debtRes.json()

    // Calculate M2 growth rate (YoY)
    const m2Latest = parseFloat(m2Data.observations[0]?.value || "0")
    const m2Previous = parseFloat(m2Data.observations[1]?.value || "0")
    const m2Growth = m2Previous > 0 ? ((m2Latest - m2Previous) / m2Previous * 100).toFixed(2) : "0"

    const dxyValue = dxyData?.["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"] 
      ? (1 / parseFloat(dxyData["Realtime Currency Exchange Rate"]["5. Exchange Rate"]) * 100).toFixed(2)
      : null

    return NextResponse.json({
      status: "success",
      timestamp: new Date().toISOString(),
      data: {
        usd_index: dxyValue ? parseFloat(dxyValue) : null,
        m2_money_supply: {
          value: m2Latest,
          growth_rate_yoy: parseFloat(m2Growth),
          unit: "billions_usd"
        },
        unemployment_rate: {
          value: parseFloat(unempData.observations[0]?.value || "0"),
          unit: "percent"
        },
        debt_to_gdp: {
          value: parseFloat(debtData.observations[0]?.value || "0"),
          unit: "percent"
        },
        interpretation: {
          dollar_strength: dxyValue && parseFloat(dxyValue) > 105 ? "Strong" : dxyValue && parseFloat(dxyValue) > 100 ? "Moderate" : "Weak",
          money_supply: parseFloat(m2Growth) > 10 ? "Inflationary" : parseFloat(m2Growth) > 5 ? "Moderate" : "Tight",
          labor_market: parseFloat(unempData.observations[0]?.value || "0") < 4 ? "Strong" : "Weakening",
          fiscal_health: parseFloat(debtData.observations[0]?.value || "0") > 120 ? "High Risk" : "Manageable"
        }
      }
    })
  } catch (error) {
    console.error("[v0] Macro Indicators error:", error)
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to fetch macro indicators",
        error: String(error)
      },
      { status: 500 }
    )
  }
}
