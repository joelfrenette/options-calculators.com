import { NextResponse } from "next/server"

/**
 * Historical CCPI series for charting — deliberately empty.
 *
 * P1-14, closed 2026-08-11. The header comment used to read "For now, we
 * generate realistic mock historical data", above ~40 commented-out lines that
 * built two years of weekly `Math.random()` regimes. The code had been dead
 * for a long time; the comment had not, and it described this file as a mock
 * generator to anyone who opened it. A comment is a claim about the code, and
 * this one was false in the direction that matters — it made an honest empty
 * response look like a placeholder for fabricated data someone was about to
 * switch back on.
 *
 * The route returns an empty history and says why. Real history needs the
 * stored series E-7 is building; until it exists, the chart has nothing to draw
 * and the notice says so rather than a curve saying otherwise.
 */
export async function GET() {
  try {
    return NextResponse.json({
      history: [],
      notice: "Historical CCPI data requires database implementation. Currently showing real-time data only.",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("CCPI history API error:", error)
    return NextResponse.json({ error: "Failed to fetch CCPI history" }, { status: 500 })
  }
}
