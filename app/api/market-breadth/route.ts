import { NextResponse } from "next/server"
import { fetchMarketBreadth } from "@/lib/market-breadth"

// Market Breadth (High-Low Index) API
// Implements strict fallback chain: Polygon.io → FMP → Alpha Vantage
// Returns ratio of new highs / (new highs + new lows)

export async function GET() {
  try {
    console.log('[v0] Market breadth API called')
    
    const result = await fetchMarketBreadth()
    
    return NextResponse.json({
      value: result.highLowIndex,
      unit: "ratio",
      highs: result.newHighs,
      lows: result.newLows,
      total: result.newHighs + result.newLows,
      date: result.timestamp.split('T')[0],
      source: result.source,
      threshold: result.highLowIndex < 0.30 ? "weak" : result.highLowIndex > 0.60 ? "strong" : "neutral",
      baseline: 0.45,
      lastFetched: result.timestamp,
      stale: result.source === "baseline"
    })
  } catch (error) {
    console.error('[v0] Market breadth API error:', error)
    return NextResponse.json(
      { 
        error: "Failed to fetch market breadth data",
        value: 0.42,
        source: "baseline-error",
        stale: true
      },
      { status: 200 } // Return 200 with baseline data instead of 500
    )
  }
}
