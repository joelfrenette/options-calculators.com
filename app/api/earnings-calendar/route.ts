import { NextResponse } from "next/server"
import { generateText } from "ai"

const AI_MODELS = ["openai/gpt-4o-mini", "anthropic/claude-3-haiku-20240307", "xai/grok-2-1212"]

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
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(
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
  const apiKey = process.env.POLYGON_API_KEY
  if (!apiKey) return null

  try {
    // Polygon uses a different endpoint structure
    const res = await fetch(
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

function generateCuratedEconomicEvents(startDate: Date, endDate: Date): any[] {
  const events: any[] = []
  const current = new Date(startDate)

  // Standard economic calendar events by day of week and date
  while (current <= endDate) {
    const dayOfWeek = current.getDay()
    const dayOfMonth = current.getDate()
    const dateStr = current.toISOString().split("T")[0]

    // Thursday - Weekly Jobless Claims
    if (dayOfWeek === 4) {
      events.push({
        date: dateStr,
        time: "8:30 AM ET",
        event: "Initial Jobless Claims",
        agency: "Dept. of Labor",
        impact: "Med",
        forecast: "~220K",
        previous: "~215K",
      })
    }

    // First Friday - Jobs Report (NFP)
    if (dayOfWeek === 5 && dayOfMonth <= 7) {
      events.push({
        date: dateStr,
        time: "8:30 AM ET",
        event: "Non-Farm Payrolls",
        agency: "BLS",
        impact: "High",
        forecast: "TBD",
        previous: "TBD",
      })
      events.push({
        date: dateStr,
        time: "8:30 AM ET",
        event: "Unemployment Rate",
        agency: "BLS",
        impact: "High",
        forecast: "TBD",
        previous: "TBD",
      })
    }

    // Mid-month CPI (around 10th-15th)
    if (dayOfMonth >= 10 && dayOfMonth <= 15 && dayOfWeek >= 2 && dayOfWeek <= 4) {
      const hasInflationEvent = events.some((e) => e.event.includes("CPI"))
      if (!hasInflationEvent) {
        events.push({
          date: dateStr,
          time: "8:30 AM ET",
          event: "Consumer Price Index (CPI)",
          agency: "BLS",
          impact: "High",
          forecast: "TBD",
          previous: "TBD",
        })
      }
    }

    // FOMC meetings (typically mid-month, check for Dec 17-18, Jan, etc.)
    const month = current.getMonth()
    if (
      (month === 11 && (dayOfMonth === 17 || dayOfMonth === 18)) || // December FOMC
      (month === 0 && (dayOfMonth === 28 || dayOfMonth === 29)) // January FOMC
    ) {
      events.push({
        date: dateStr,
        time: "2:00 PM ET",
        event: dayOfMonth === 18 || dayOfMonth === 29 ? "FOMC Rate Decision" : "FOMC Meeting Day 1",
        agency: "Federal Reserve",
        impact: "High",
        forecast: "TBD",
        previous: "TBD",
      })
    }

    current.setDate(current.getDate() + 1)
  }

  return events
}

async function generateWithFallback(prompt: string, maxTokens = 100): Promise<string | null> {
  for (const model of AI_MODELS) {
    try {
      console.log(`[v0] Trying AI model: ${model}`)
      const { text } = await generateText({
        model: model as any,
        prompt,
        maxTokens,
      })
      console.log(`[v0] AI success with ${model}`)
      return text.trim()
    } catch (error) {
      console.error(`[v0] AI error (${model}):`, error instanceof Error ? error.message : error)
      continue
    }
  }
  console.log("[v0] All AI models failed, returning null")
  return null
}

// Generate AI explainer for an earnings event
async function generateEarningsExplainer(ticker: string, company: string, estimate: string): Promise<string> {
  const prompt = `You are an options trading expert. In 1-2 sentences, explain the options trading opportunity for ${ticker} (${company}) with EPS estimate ${estimate}. Focus on IV levels, expected move, and potential strategies like selling premium or buying straddles. Be concise and actionable for beginner traders.`

  const result = await generateWithFallback(prompt, 100)
  return (
    result || `Watch for volatility expansion before ${ticker} earnings. Consider premium selling if IV is elevated.`
  )
}

// Generate AI explainer for an economic event
async function generateEconomicExplainer(event: string, impact: string, forecast: string): Promise<string> {
  const prompt = `You are an options trading expert. In 1-2 sentences, explain how the ${event} economic release (Impact: ${impact}, Forecast: ${forecast}) affects options trading. Focus on which sectors/ETFs might move, volatility implications, and potential strategies. Be concise and actionable for beginner traders.`

  const result = await generateWithFallback(prompt, 100)
  return (
    result || `Economic data release may increase market volatility. Consider SPY or QQQ options for directional plays.`
  )
}

// Generate deep AI insights for the week
async function generateWeeklyInsights(
  earnings: any[],
  economicEvents: any[],
  weekLabel: string,
): Promise<{ earningsInsights: any[]; economicInsights: any[] }> {
  const earningsInsights: any[] = []
  const economicInsights: any[] = []

  const majorTickers = earnings
    .filter((e) =>
      ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "CRM", "ZS", "AVGO", "COST", "ADBE", "ORCL"].includes(
        e.symbol || e.ticker,
      ),
    )
    .slice(0, 5)

  const highImpactEvents = economicEvents.filter((e) => e.impact === "High" || e.importance === 3).slice(0, 5)

  const prompt = `You are an expert options trading analyst. Generate a trading insight for the week of ${weekLabel}.

Upcoming major earnings: ${majorTickers.map((e) => e.symbol || e.ticker).join(", ") || "Light earnings week"}
Upcoming high-impact economic events: ${highImpactEvents.map((e) => e.event || e.name).join(", ") || "No major events"}

Provide a JSON response with this structure:
{
  "weeklyOverview": {
    "title": "Weekly Trading Theme",
    "summary": "2-3 sentence overview of what options traders should expect this week",
    "watchPoints": ["3 key things to watch"],
    "tradingTips": ["3 actionable trading tips for options traders"]
  },
  "topEarningsPlay": {
    "title": "Top Earnings Play",
    "summary": "Analysis of the most important earnings event",
    "watchPoints": ["What to watch"],
    "tradingTips": ["How to trade it"]
  },
  "topEconomicPlay": {
    "title": "Key Economic Event",
    "summary": "Analysis of the most important economic event",
    "watchPoints": ["What to watch"],
    "tradingTips": ["How to trade it"]
  }
}

Be specific, actionable, and focused on options trading strategies.`

  const result = await generateWithFallback(prompt, 800)

  if (result) {
    try {
      const parsed = JSON.parse(result)

      if (parsed.weeklyOverview) {
        earningsInsights.push({
          id: "weekly-overview",
          ...parsed.weeklyOverview,
        })
      }

      if (parsed.topEarningsPlay) {
        earningsInsights.push({
          id: "top-earnings",
          ...parsed.topEarningsPlay,
        })
      }

      if (parsed.topEconomicPlay) {
        economicInsights.push({
          id: "top-economic",
          ...parsed.topEconomicPlay,
        })
      }
    } catch {
      // JSON parsing failed, use fallbacks
    }
  }

  // Fallback static insights if AI fails
  if (earningsInsights.length === 0) {
    earningsInsights.push({
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
    })
  }

  if (economicInsights.length === 0) {
    economicInsights.push({
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
    })
  }

  return { earningsInsights, economicInsights }
}

export async function GET() {
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

        // Generate AI explainer - with fallback
        let aiExplainer = ""
        try {
          aiExplainer = await generateEarningsExplainer(ticker, company, estimate)
        } catch {
          aiExplainer = `Watch for volatility expansion before ${ticker} earnings. Consider premium selling if IV is elevated.`
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
        try {
          aiExplainer = await generateEconomicExplainer(e.event, e.impact, e.forecast || "—")
        } catch {
          aiExplainer = `Economic data release may increase market volatility. Consider SPY or QQQ options for directional plays.`
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

    // Generate AI insights for the week
    let earningsInsights: any[] = []
    let economicInsights: any[] = []

    try {
      const insights = await generateWeeklyInsights(earnings, economicEvents, label)
      earningsInsights = insights.earningsInsights
      economicInsights = insights.economicInsights
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

    return NextResponse.json({
      success: true,
      dateRange: label,
      lastUpdated: new Date().toISOString(),
      dataSources: {
        earnings: "Static Fallback",
        economic: "Curated Calendar",
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
