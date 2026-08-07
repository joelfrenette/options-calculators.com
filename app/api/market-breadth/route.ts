import { NextResponse } from "next/server"
import { fetchMarketBreadth } from "@/lib/market-breadth"

// Market Breadth (High-Low Index) API
// Implements strict fallback chain: Polygon.io → FMP → Alpha Vantage
// Returns ratio of new highs / (new highs + new lows)

export async function GET() {
  try {
    console.log('[v0] Market breadth API called')
    
    const result = await fetchMarketBreadth()

    // NOTE: this route is pending a deletion decision — lib/market-breadth is
    // deprecated (breadth was replaced by VIX term structure in CCPI) and only
    // returns a zeroed baseline. Type-only fix: MarketBreadthData has no
    // highLowIndex field, so compute it here from highs/lows (baseline 0.45 when
    // there is no data). Do not extend this route.
    const totalHighsLows = result.newHighs + result.newLows
    const highLowIndex = totalHighsLows > 0 ? result.newHighs / totalHighsLows : 0.45

    return NextResponse.json({
      value: highLowIndex,
      unit: "ratio",
      highs: result.newHighs,
      lows: result.newLows,
      total: totalHighsLows,
      date: result.timestamp.split('T')[0],
      source: result.source,
      threshold: highLowIndex < 0.30 ? "weak" : highLowIndex > 0.60 ? "strong" : "neutral",
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
