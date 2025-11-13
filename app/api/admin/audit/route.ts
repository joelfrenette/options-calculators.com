import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  // Construct base URL from request headers (works in both development and production)
  const protocol = request.headers.get("x-forwarded-proto") || "http"
  const host = request.headers.get("host") || "localhost:3000"
  const baseUrl = `${protocol}://${host}`

  const checks = []

  // Check VIX data calculation
  try {
    const vixResponse = await fetch(`${baseUrl}/api/vix`)
    const vixData = await vixResponse.json()

    checks.push({
      name: "VIX Data Source",
      status: vixData.vix && vixData.vix > 0 ? "pass" : "fail",
      message: vixData.vix ? `Current VIX: ${vixData.vix.toFixed(2)}` : "No VIX data",
      details: "Source: FRED API (Federal Reserve Economic Data)",
    })
  } catch {
    checks.push({
      name: "VIX Data Source",
      status: "fail",
      message: "Failed to fetch VIX data",
      details: "Check FRED API key and connection",
    })
  }

  // Check Market Sentiment calculations
  try {
    const sentimentResponse = await fetch(`${baseUrl}/api/market-sentiment`)
    const sentimentData = await sentimentResponse.json()

    const hasValidData =
      sentimentData.fearGreedIndex && sentimentData.fearGreedIndex >= 0 && sentimentData.fearGreedIndex <= 100

    checks.push({
      name: "Fear & Greed Index",
      status: hasValidData ? "pass" : "fail",
      message: hasValidData ? `Current Index: ${sentimentData.fearGreedIndex}` : "Invalid data range",
      details:
        "Combines 7 indicators: Put/Call, VIX, Market Momentum, Safe Haven Demand, Junk Bond Demand, Market Breadth, Stock Price Strength",
    })
  } catch {
    checks.push({
      name: "Fear & Greed Index",
      status: "fail",
      message: "Failed to calculate index",
      details: "Check market data sources",
    })
  }

  // Check Panic/Euphoria Model
  try {
    const panicResponse = await fetch(`${baseUrl}/api/panic-euphoria`)
    const panicData = await panicResponse.json()

    checks.push({
      name: "Panic/Euphoria Model",
      status: panicData.model && panicData.model.overall ? "pass" : "fail",
      message: panicData.model?.overall ? `Current Score: ${panicData.model.overall}` : "No model data",
      details: "Citibank model using 9 technical indicators",
    })
  } catch {
    checks.push({
      name: "Panic/Euphoria Model",
      status: "fail",
      message: "Failed to calculate model",
      details: "Check technical indicator data sources",
    })
  }

  // Check FOMC Predictions
  try {
    const fomcResponse = await fetch(`${baseUrl}/api/fomc-predictions`)
    const fomcData = await fomcResponse.json()

    checks.push({
      name: "FOMC Rate Predictions",
      status: fomcData.predictions && fomcData.predictions.length > 0 ? "pass" : "fail",
      message: fomcData.predictions?.[0] ? `Next meeting probability calculated` : "No prediction data",
      details: "Based on Fed Funds futures market data",
    })
  } catch {
    checks.push({
      name: "FOMC Rate Predictions",
      status: "fail",
      message: "Failed to fetch predictions",
      details: "Check futures data source",
    })
  }

  // Check Trend Analysis
  try {
    const trendResponse = await fetch(`${baseUrl}/api/trend-analysis`)
    const trendData = await trendResponse.json()

    checks.push({
      name: "Trend Analysis Calculations",
      status: trendData.forecast ? "pass" : "fail",
      message: trendData.forecast ? "Technical indicators calculated" : "No trend data",
      details: "Uses SMA, EMA, RSI, MACD, Bollinger Bands, Stochastic, ATR from TwelveData API",
    })
  } catch {
    checks.push({
      name: "Trend Analysis Calculations",
      status: "fail",
      message: "Failed to calculate trends",
      details: "Check TwelveData API connection",
    })
  }

  // Summary
  const passCount = checks.filter((c) => c.status === "pass").length
  const totalCount = checks.length

  return NextResponse.json({
    summary: {
      total: totalCount,
      passed: passCount,
      failed: totalCount - passCount,
      percentage: Math.round((passCount / totalCount) * 100),
    },
    checks,
    timestamp: new Date().toISOString(),
  })
}
