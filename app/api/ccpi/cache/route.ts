import { NextResponse } from "next/server"

let cachedCCPIData: any = null
let cacheTimestamp: string | null = null
const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes

export async function GET() {
  try {
    // Return cached data if available and fresh
    if (cachedCCPIData && cacheTimestamp) {
      const age = Date.now() - new Date(cacheTimestamp).getTime()
      if (age < CACHE_DURATION_MS) {
        console.log("[v0] CCPI Cache: Serving cached data from", cacheTimestamp)
        return NextResponse.json({
          ...cachedCCPIData,
          cachedAt: cacheTimestamp,
          cacheAge: Math.round(age / 1000) + "s",
        })
      }
    }

    // No cache or expired
    console.log("[v0] CCPI Cache: No valid cache available")
    return NextResponse.json({ cached: false }, { status: 404 })
  } catch (error) {
    console.error("[v0] CCPI Cache error:", error)
    return NextResponse.json({ error: "Cache retrieval failed" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    cachedCCPIData = data
    cacheTimestamp = new Date().toISOString()
    console.log("[v0] CCPI Cache: Data cached at", cacheTimestamp)

    return NextResponse.json({
      success: true,
      cachedAt: cacheTimestamp,
    })
  } catch (error) {
    console.error("[v0] CCPI Cache save error:", error)
    return NextResponse.json({ error: "Cache save failed" }, { status: 500 })
  }
}
