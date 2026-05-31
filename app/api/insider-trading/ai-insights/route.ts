import { generateWithFallback } from "@/lib/ai-providers"

export const dynamic = "force-dynamic"
export const maxDuration = 30

interface Trade {
  date: string
  type: string
  owner: string
  role: string
  category: string
  ticker: string
  shares: string
  price: string
  value: string
  notes: string
}

// Parse a value string like "$22M" / "$50K" / "$15K-$50K" into an approximate USD number
function parseValueToUsd(valueStr: string): number {
  if (!valueStr) return 0
  // For ranges, take the upper bound (after the last dash)
  const part = valueStr.includes("-") ? valueStr.split("-").pop()! : valueStr
  const cleaned = part.replace(/[$,\s]/g, "")
  const num = Number.parseFloat(cleaned.replace(/[KMB]/gi, ""))
  if (isNaN(num)) return 0
  if (/B/i.test(cleaned)) return num * 1_000_000_000
  if (/M/i.test(cleaned)) return num * 1_000_000
  if (/K/i.test(cleaned)) return num * 1_000
  return num
}

// Build a deterministic aggregation so the AI reasons over clean, pre-computed signals
function aggregateByTicker(trades: Trade[]) {
  const map: Record<
    string,
    {
      ticker: string
      insiderBuys: number
      insiderSells: number
      congressBuys: number
      congressSells: number
      buyValue: number
      sellValue: number
      owners: Set<string>
    }
  > = {}

  for (const t of trades) {
    const ticker = (t.ticker || "").toUpperCase()
    if (!ticker || ticker === "—" || ticker === "N/A") continue

    if (!map[ticker]) {
      map[ticker] = {
        ticker,
        insiderBuys: 0,
        insiderSells: 0,
        congressBuys: 0,
        congressSells: 0,
        buyValue: 0,
        sellValue: 0,
        owners: new Set(),
      }
    }

    const entry = map[ticker]
    const isBuy = (t.type || "").toLowerCase().includes("buy")
    const isSell = (t.type || "").toLowerCase().includes("sell")
    const value = parseValueToUsd(t.value)

    if (t.category === "congressional") {
      if (isBuy) entry.congressBuys++
      else if (isSell) entry.congressSells++
    } else {
      if (isBuy) entry.insiderBuys++
      else if (isSell) entry.insiderSells++
    }

    if (isBuy) entry.buyValue += value
    else if (isSell) entry.sellValue += value

    if (t.owner) entry.owners.add(t.owner)
  }

  return Object.values(map).map((e) => ({
    ticker: e.ticker,
    insiderBuys: e.insiderBuys,
    insiderSells: e.insiderSells,
    congressBuys: e.congressBuys,
    congressSells: e.congressSells,
    totalBuyValue: Math.round(e.buyValue),
    totalSellValue: Math.round(e.sellValue),
    uniqueActors: e.owners.size,
    // A ticker is "cross-confirmed" when BOTH insiders and politicians traded it the same direction
    crossBuying: (e.insiderBuys > 0 && e.congressBuys > 0),
    crossSelling: (e.insiderSells > 0 && e.congressSells > 0),
  }))
}

function stripJson(raw: string): string {
  let s = raw.trim()
  // Remove code fences if present
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  // Grab the outermost JSON object
  const first = s.indexOf("{")
  const last = s.lastIndexOf("}")
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1)
  }
  return s
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const trades: Trade[] = Array.isArray(body.trades) ? body.trades : []

    if (trades.length === 0) {
      return Response.json({ success: false, error: "No trades provided" }, { status: 400 })
    }

    const aggregates = aggregateByTicker(trades)
      .sort((a, b) => b.totalBuyValue + b.totalSellValue - (a.totalBuyValue + a.totalSellValue))
      .slice(0, 12)

    const systemPrompt = `You are a sharp financial analyst specializing in insider and congressional trading signals for options traders.
You read pre-aggregated trading data and produce concise, high-signal generalizations.
You are speculative but responsible: you connect dots between insider/politician flows and possible catalysts (earnings, legislation, court cases, M&A, regulatory decisions), while making clear these are hypotheses, not confirmed facts.
You NEVER claim certainty about illegal insider information. You frame unusual patterns as "worth watching" signals.
Respond with VALID JSON ONLY — no markdown, no commentary outside the JSON.`

    const userPrompt = `Here is aggregated insider + congressional trading activity for the recent period (values in USD):

${JSON.stringify(aggregates, null, 2)}

Analyze this data and identify the most interesting CORRELATIONS and ACTIONABLE generalizations. Prioritize:
1. Tickers where BOTH corporate insiders AND politicians traded the same direction (cross-confirmed signals).
2. Unusual clustering of buying or selling (multiple actors, large dollar value).
3. Plausible catalysts that could explain the flow (earnings, pending legislation, court cases, regulatory rulings, defense/energy policy) — clearly labeled as hypotheses.

Return JSON in EXACTLY this shape:
{
  "summary": "2-3 sentence plain-English overview of the most important theme in the data",
  "signals": [
    {
      "ticker": "XYZ",
      "direction": "Bullish" | "Bearish" | "Neutral",
      "confidence": "High" | "Medium" | "Low",
      "headline": "Short punchy headline, e.g. 'Unusual cross-buying in XYZ'",
      "rationale": "2-3 sentences explaining the pattern and a plausible (clearly hypothetical) catalyst, in the style of: 'Unusual buying in XYZ this month from both insiders and politicians, which may align with a pending catalyst — worth watching as a potential bullish setup.'",
      "optionsIdea": "One concrete options strategy idea tied to the signal (e.g. 'Bull call spread 30-45 DTE')",
      "sources": ["Insider", "Congressional"]
    }
  ]
}

Provide 3-5 signals max, ordered by importance. Keep it tight and specific to the tickers in the data.`

    const result = await generateWithFallback({
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.6,
      maxTokens: 1500,
      preferredProvider: "openai",
    })

    let parsed: any = null
    try {
      parsed = JSON.parse(stripJson(result.text))
    } catch (err) {
      console.error("[v0] AI insights JSON parse failed:", err)
    }

    if (!parsed || !Array.isArray(parsed.signals)) {
      return Response.json({
        success: true,
        summary:
          "AI returned an unstructured response. Showing computed aggregates instead — review tickers with the largest combined buy/sell value below.",
        signals: aggregates.slice(0, 4).map((a) => ({
          ticker: a.ticker,
          direction: a.totalBuyValue >= a.totalSellValue ? "Bullish" : "Bearish",
          confidence: a.crossBuying || a.crossSelling ? "Medium" : "Low",
          headline:
            a.crossBuying
              ? `Cross-buying in ${a.ticker}`
              : a.crossSelling
                ? `Cross-selling in ${a.ticker}`
                : `Notable activity in ${a.ticker}`,
          rationale: `${a.uniqueActors} actor(s) traded ${a.ticker}. Buy value ~$${a.totalBuyValue.toLocaleString()}, sell value ~$${a.totalSellValue.toLocaleString()}. Worth watching for a catalyst.`,
          optionsIdea: a.totalBuyValue >= a.totalSellValue ? "Consider a bull call spread 30-45 DTE" : "Consider a bear put spread 30-45 DTE",
          sources: [
            ...(a.insiderBuys + a.insiderSells > 0 ? ["Insider"] : []),
            ...(a.congressBuys + a.congressSells > 0 ? ["Congressional"] : []),
          ],
        })),
        provider: result.provider,
        model: result.model,
        aggregates,
        generatedAt: new Date().toISOString(),
      })
    }

    return Response.json({
      success: true,
      summary: parsed.summary || "",
      signals: parsed.signals,
      provider: result.provider,
      model: result.model,
      aggregates,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Insider AI insights error:", error instanceof Error ? error.message : error)
    return Response.json(
      { success: false, error: "Failed to generate AI insights" },
      { status: 500 },
    )
  }
}
