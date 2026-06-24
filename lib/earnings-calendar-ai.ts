// Shared AI helpers for the earnings/economic calendar.
// Used by both /api/earnings-calendar (when ?skipAI is omitted) and the
// progressive /api/earnings-calendar/insights endpoint.
//
// All calls route through generateWithFallback (lib/ai-providers) which uses
// the OpenRouter-free-first AI chain — so these are now actually live AI calls
// (the prior local helper passed bare string model IDs that silently failed).

import { generateWithFallback } from "@/lib/ai-providers"

const EARNINGS_FALLBACK = (ticker: string) =>
  `Watch for volatility expansion before ${ticker} earnings. Consider premium selling if IV is elevated.`

const ECONOMIC_FALLBACK = () =>
  `Economic data release may increase market volatility. Consider SPY or QQQ options for directional plays.`

// Per-call AbortController timeout so a slow OpenRouter free model can't
// block the parent /insights request past Vercel's 60s function limit.
async function callAI(prompt: string, maxTokens = 100, timeoutMs = 18_000): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const { text } = await generateWithFallback({
      prompt,
      maxTokens,
      temperature: 0.4,
      abortSignal: controller.signal,
    })
    return text.trim()
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    if (controller.signal.aborted) {
      console.log(`[v0] Calendar AI timeout after ${timeoutMs}ms — falling back`)
    } else {
      console.log("[v0] Calendar AI error:", msg)
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function generateEarningsExplainer(
  ticker: string,
  company: string,
  estimate: string,
): Promise<string> {
  const prompt = `You are an options trading expert. In 1-2 sentences, explain the options trading opportunity for ${ticker} (${company}) with EPS estimate ${estimate}. Focus on IV levels, expected move, and potential strategies like selling premium or buying straddles. Be concise and actionable for beginner traders.`
  return (await callAI(prompt, 120)) || EARNINGS_FALLBACK(ticker)
}

export async function generateEconomicExplainer(
  event: string,
  impact: string,
  forecast: string,
): Promise<string> {
  const prompt = `You are an options trading expert. In 1-2 sentences, explain how the ${event} economic release (Impact: ${impact}, Forecast: ${forecast}) affects options trading. Focus on which sectors/ETFs might move, volatility implications, and potential strategies. Be concise and actionable for beginner traders.`
  return (await callAI(prompt, 120)) || ECONOMIC_FALLBACK()
}

export async function generateWeeklyInsights(
  earnings: Array<{ symbol?: string; ticker?: string }>,
  economicEvents: Array<{ event?: string; name?: string; impact?: string; importance?: number }>,
  weekLabel: string,
): Promise<{ earningsInsights: any[]; economicInsights: any[] }> {
  const earningsInsights: any[] = []
  const economicInsights: any[] = []

  const majorTickers = earnings
    .filter((e) =>
      ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "CRM", "ZS", "AVGO", "COST", "ADBE", "ORCL"].includes(
        (e.symbol || e.ticker) ?? "",
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
    "tradingTips": ["Trading approach"]
  },
  "topEconomicPlay": {
    "title": "Top Economic Event",
    "summary": "Analysis of the most market-moving event",
    "watchPoints": ["What to watch"],
    "tradingTips": ["Trading approach"]
  }
}

Be specific, actionable, and focused on options trading strategies. Respond with ONLY the JSON, no preamble.`

  // 500 max tokens is plenty for the three-section JSON and keeps the call
  // well under the 18s per-call timeout above. (Was 900 — was timing out on
  // OpenRouter free reasoning models.)
  const result = await callAI(prompt, 500, 25_000)

  if (result) {
    try {
      // Tolerate models that wrap the JSON in prose or code fences.
      const m = result.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(m ? m[0] : result)
      if (parsed.weeklyOverview) earningsInsights.push({ id: "weekly-overview", ...parsed.weeklyOverview })
      if (parsed.topEarningsPlay) earningsInsights.push({ id: "top-earnings", ...parsed.topEarningsPlay })
      if (parsed.topEconomicPlay) economicInsights.push({ id: "top-economic", ...parsed.topEconomicPlay })
    } catch {
      /* fall through to baseline */
    }
  }

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
