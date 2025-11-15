import { NextResponse } from "next/server"
import { fetchQQQTechnicals } from '@/lib/qqq-technicals'

// QQQ Technicals API - Live data from Polygon.io
// Tracks QQQ momentum crashes and trendline breaks

export async function GET() {
  try {
    const qqqData = await fetchQQQTechnicals()
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      ...qqqData
    })
  } catch (error) {
    console.error("[v0] QQQ Technicals API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch QQQ technicals" },
      { status: 500 }
    )
  }
}
