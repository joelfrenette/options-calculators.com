import { NextResponse } from "next/server"
import { resolveApiKey } from "@/lib/api-keys"
import {
  generateEarningsExplainer as aiEarningsExplainer,
  generateEconomicExplainer as aiEconomicExplainer,
  generateWeeklyInsights as aiWeeklyInsights,
} from "@/lib/earnings-calendar-ai"
import { generateCuratedEconomicEvents } from "@/lib/economic-events"
import { fetchWithTimeout } from "@/lib/fetch-timeout"

export const maxDuration = 90

// Get current week range (Mon-Fri, or next week if Sat/Sun)
function getCurrentWeekRange(): { start: Date; end: Date; label: string } {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sunday, 6 = Saturday

  let start: Date
  let end: Date

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    // Weekend - show next week
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 2
    start = new Date(now)
    start.setDate(now.getDate() + daysUntilMonday)
    start.setHours(0, 0, 0, 0)

    end = new Date(start)
    end.setDate(start.getDate() + 4) // Friday
    end.setHours(23, 59, 59, 999)
  } else {
    // Weekday - show this week (Mon-Fri)
    const daysFromMonday = dayOfWeek - 1
    start = new Date(now)
    start.setDate(now.getDate() - daysFromMonday)
    start.setHours(0, 0, 0, 0)

    end = new Date(start)
    end.setDate(start.getDate() + 4)
    end.setHours(23, 59, 59, 999)
  }

  const label = `${start.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`

  return { start, end, label }
}

// Fetch earnings from Finnhub (primary source)
async function fetchFinnhubEarnings(startDate: string, endDate: string) {
  const apiKey = resolveApiKey("FINNHUB_API_KEY")
  if (!apiKey) return null

  try {
    const res = await fetchWithTimeout(
      `https://finnhub.io/api/v1/calendar/earnings?from=${startDate}&to=${endDate}&token=${apiKey}`,
      { next: { revalidate: 1800 } },
    )
    if (!res.ok) {
      console.error("[v0] Finnhub earnings failed:", res.status)
      return null
    }
    const data = await res.json()
    return data.earningsCalendar || []
  } catch (error) {
    console.error("[v0] Finnhub earnings error:", error)
    return null
  }
}

async function fetchPolygonEarnings(startDate: string, endDate: string) {
  const apiKey = resolveApiKey("POLYGON_API_KEY")
  if (!apiKey) return null

  try {
    // Polygon uses a different endpoint structure
    const res = await fetchWithTimeout(
      `https://api.polygon.io/vX/reference/financials?filing_date.gte=${startDate}&filing_date.lte=${endDate}&limit=50&apiKey=${apiKey}`,
      { next: { revalidate: 1800 } },
    )
    if (!res.ok) {
      console.error("[v0] Polygon earnings failed:", res.status)
      return null
    }
    const data = await res.json()
    // Transform Polygon data to match our format
    return (data.results || []).map((r: any) => ({
      symbol: r.tickers?.[0] || "N/A",
      date: r.filing_date,
      epsActual: r.financials?.income_statement?.basic_earnings_per_share?.value,
    }))
  } catch (error) {
    console.error("[v0] Polygon earnings error:", error)
    return null
  }
}

// Curated macro events moved to @/lib/economic-events so /api/landmine-check
// can share the same calendar.

// AI helpers (per-row explainers + weekly insights) live in
// @/lib/earnings-calendar-ai so they can be reused by /api/earnings-calendar/insights
// for the progressive load path.
const generateEarningsExplainer = aiEarningsExplainer
const generateEconomicExplainer = aiEconomicExplainer

const generateWeeklyInsights = aiWeeklyInsights

export async function GET(request: Request) {
  // ?skipAI=true returns calendar data with empty AI fields immediately so the
  // UI can render in ~2s; the client then POSTs to /insights for the slow parts.
  const skipAI = new URL(request.url).searchParams.get("skipAI") === "true"
  try {
    const { start, end, label } = getCurrentWeekRange()
    const startDate = start.toISOString().split("T")[0]
    const endDate = end.toISOString().split("T")[0]

    console.log(`[v0] Fetching calendar data for ${startDate} to ${endDate}`)

    let finnhubEarnings = null
    let polygonEarnings = null

    try {
      finnhubEarnings = await fetchFinnhubEarnings(startDate, endDate)
      console.log(`[v0] Finnhub returned ${finnhubEarnings?.length || 0} earnings`)
    } catch (e) {
      console.error("[v0] Finnhub fetch failed:", e)
    }

    if (!finnhubEarnings || finnhubEarnings.length === 0) {
      try {
        polygonEarnings = await fetchPolygonEarnings(startDate, endDate)
        console.log(`[v0] Polygon returned ${polygonEarnings?.length || 0} earnings`)
      } catch (e) {
        console.error("[v0] Polygon fetch failed:", e)
      }
    }

    const earnings = finnhubEarnings?.length > 0 ? finnhubEarnings : polygonEarnings || []
    const earningsSource = finnhubEarnings?.length > 0 ? "Finnhub" : polygonEarnings?.length > 0 ? "Polygon" : "Static"

    console.log(`[v0] Using ${earningsSource} with ${earnings.length} earnings`)

    const economicEvents = generateCuratedEconomicEvents(start, end)
    console.log(`[v0] Generated ${economicEvents.length} economic events`)

    const normalizedEarnings = await Promise.all(
      earnings.slice(0, 15).map(async (e: any) => {
        const ticker = e.symbol || e.ticker
        const company = e.company || e.name || ticker
        const estimate = e.epsEstimate ? `EPS $${e.epsEstimate.toFixed(2)}` : e.eps ? `EPS $${e.eps}` : "EPS TBD"

        const dateObj = new Date(e.date || e.reportDate)
        const dateStr = dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

        const timing =
          e.hour === 1 ? "BMO" : e.hour === 2 ? "AMC" : e.time === "bmo" ? "BMO" : e.time === "amc" ? "AMC" : "TBD"
        const timeStr = timing === "BMO" ? "Before Market Open" : timing === "AMC" ? "After Market Close" : "TBD"

        // Generate AI explainer - skipped in fast path (filled in by /insights endpoint)
        let aiExplainer = ""
        if (!skipAI) {
          try {
            aiExplainer = await generateEarningsExplainer(ticker, company, estimate)
          } catch {
            aiExplainer = `Watch for volatility expansion before ${ticker} earnings. Consider premium selling if IV is elevated.`
          }
        }

        return {
          date: dateStr,
          time: timeStr,
          timing,
          ticker,
          company,
          aiExplainer,
          estimate,
        }
      }),
    )

    const normalizedEconomic = await Promise.all(
      economicEvents.slice(0, 10).map(async (e: any) => {
        const dateObj = new Date(e.date)
        const dateStr = dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

        let aiExplainer = ""
        if (!skipAI) {
          try {
            aiExplainer = await generateEconomicExplainer(e.event, e.impact, e.forecast || "—")
          } catch {
            aiExplainer = `Economic data release may increase market volatility. Consider SPY or QQQ options for directional plays.`
          }
        }

        return {
          date: dateStr,
          time: e.time || "TBD",
          event: e.event,
          agency: e.agency || "—",
          impact: e.impact,
          note: "",
          forecast: e.forecast || "—",
          previous: e.previous || "—",
          aiExplainer,
        }
      }),
    )

    // Generate AI insights for the week — skipped in the fast path
    // (client will POST to /api/earnings-calendar/insights after first render).
    let earningsInsights: any[] = []
    let economicInsights: any[] = []

    try {
      if (!skipAI) {
        const insights = await generateWeeklyInsights(earnings, economicEvents, label)
        earningsInsights = insights.earningsInsights
        economicInsights = insights.economicInsights
      }
    } catch (e) {
      console.error("[v0] Weekly insights generation failed:", e)
      // Use static fallbacks
      earningsInsights = [
        {
          id: "weekly-overview",
          title: "Weekly Trading Dynamics",
          summary:
            "Review the earnings calendar for premium selling opportunities. Elevated IV before announcements can offer attractive credit spreads.",
          watchPoints: ["Pre-earnings IV expansion", "Sector correlation moves", "Post-earnings IV crush"],
          tradingTips: [
            "Consider iron condors on high IV names",
            "Wait for confirmation before directional plays",
            "Size positions conservatively around events",
          ],
        },
      ]
      economicInsights = [
        {
          id: "economic-overview",
          title: "Economic Calendar Impact",
          summary:
            "Economic data releases can drive broad market moves. Monitor SPY and QQQ for volatility plays around major announcements.",
          watchPoints: ["Fed commentary and rate expectations", "Inflation data surprises", "Employment metrics"],
          tradingTips: [
            "Use straddles for binary events",
            "Consider sector rotation plays",
            "Adjust stops for increased volatility",
          ],
        },
      ]
    }

    console.log(`[v0] Returning ${normalizedEarnings.length} earnings, ${normalizedEconomic.length} economic events`)

    return NextResponse.json({
      success: true,
      dateRange: label,
      lastUpdated: new Date().toISOString(),
      dataSources: {
        earnings: earningsSource,
        economic: "Curated Calendar",
      },
      earnings: normalizedEarnings,
      economic: normalizedEconomic,
      earningsInsights,
      economicInsights,
    })
  } catch (error) {
    console.error("[v0] Earnings calendar API error:", error instanceof Error ? error.message : error)

    const { start, end, label } = getCurrentWeekRange()

    // The economic half is still real: lib/economic-events.ts derives events
    // from publication RULES (jobless claims Thursday, Employment Situation the
    // first Friday) and reads the committed FOMC schedule, so it does not need
    // the upstream that just failed. The earnings half genuinely has nothing.
    //
    // This used to go out as `success: true` with `earnings: "Static Fallback"`
    // beside an empty array — claiming the request succeeded and naming a
    // fallback that does not exist. Partial failure is reported the way
    // /api/federal-money reports it: the section that worked is returned, the
    // section that did not says so by name.
    // `success: true` is correct here and is NOT the old defect. This is a
    // PARTIAL success and it is reported the way /api/federal-money reports one:
    // the response did produce real data, and the section that failed is named
    // in its own field rather than hidden behind a global flag. The defect was
    // never the boolean — it was `earnings: "Static Fallback"` beside an empty
    // array, which asserted a fallback that does not exist and left the caller
    // unable to tell an outage from a quiet week.
    return NextResponse.json({
      success: true,
      earningsError: "The earnings feed could not be read; no earnings are shown.",
      dateRange: label,
      lastUpdated: new Date().toISOString(),
      dataSources: {
        earnings: "Unavailable",
        economic: "Derived from publication schedules",
      },
      earnings: [],
      economic: generateCuratedEconomicEvents(start, end)
        .slice(0, 5)
        .map((e) => ({
          date: new Date(e.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
          time: e.time,
          event: e.event,
          agency: e.agency,
          impact: e.impact,
          forecast: e.forecast,
          previous: e.previous,
          aiExplainer: "Economic data release may increase market volatility.",
        })),
      earningsInsights: [
        {
          id: "weekly-overview",
          title: "Weekly Trading Dynamics",
          summary: "Review the earnings calendar for premium selling opportunities.",
          watchPoints: ["Pre-earnings IV expansion", "Sector correlation moves"],
          tradingTips: ["Consider iron condors on high IV names", "Size positions conservatively"],
        },
      ],
      economicInsights: [
        {
          id: "economic-overview",
          title: "Economic Calendar Impact",
          summary: "Monitor SPY and QQQ for volatility plays around major announcements.",
          watchPoints: ["Fed commentary", "Inflation data"],
          tradingTips: ["Use straddles for binary events", "Adjust stops for volatility"],
        },
      ],
    })
  }
}
