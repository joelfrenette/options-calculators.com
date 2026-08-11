import { NextResponse } from "next/server"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { resolveApiKey } from "@/lib/api-keys"
import { recordAiCall } from "@/lib/metered-fetch"
import { ensureBudgetGuardFresh } from "@/lib/budget-guard"
import { TOTAL_SCORED_INDICATORS } from "@/lib/ccpi/scoring"
import { isDryRun, dryRunPayload } from "@/lib/dry-run"

const OPENROUTER_FREE_MODEL = process.env.OPENROUTER_FREE_MODEL || "openrouter/free"

const providerConfigs = [
  {
    // PRIMARY — OpenRouter free model ($0 per token).
    name: "OpenRouter (free)",
    key: () => resolveApiKey("OPENROUTER_API_KEY"),
    create: () =>
      createOpenAI({
        apiKey: resolveApiKey("OPENROUTER_API_KEY"),
        baseURL: "https://openrouter.ai/api/v1",
      }),
    model: OPENROUTER_FREE_MODEL,
  },
  {
    name: "Groq",
    key: () => resolveApiKey("GROQ_API_KEY"),
    create: () =>
      createOpenAI({
        apiKey: resolveApiKey("GROQ_API_KEY"),
        baseURL: "https://api.groq.com/openai/v1",
      }),
    model: "llama-3.3-70b-versatile",
  },
  {
    name: "Google",
    key: () => resolveApiKey("GOOGLE_AI_API_KEY"),
    create: () => createGoogleGenerativeAI({ apiKey: resolveApiKey("GOOGLE_AI_API_KEY") }),
    model: "gemini-2.0-flash",
  },
  // --- paid fallbacks; disable via DISABLED_APIS to guarantee $0 ---
  {
    name: "OpenAI",
    key: () => resolveApiKey("OPENAI_API_KEY"),
    create: () => createOpenAI({ apiKey: resolveApiKey("OPENAI_API_KEY") }),
    model: "gpt-4o-mini",
  },
  {
    name: "xAI",
    key: () => resolveApiKey("XAI_API_KEY"),
    create: () =>
      createOpenAI({
        apiKey: resolveApiKey("XAI_API_KEY"),
        baseURL: "https://api.x.ai/v1",
      }),
    model: "grok-2-latest",
  },
  {
    name: "Anthropic",
    key: () => resolveApiKey("ANTHROPIC_API_KEY"),
    create: () => createAnthropic({ apiKey: resolveApiKey("ANTHROPIC_API_KEY") }),
    model: "claude-3-5-sonnet-20241022",
  },
]

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const ccpi = body.ccpi ?? 0
    const certainty = body.certainty ?? body.confidence ?? 0
    const activeCanaries =
      body.activeCanaries ?? (body.canaries ? body.canaries.filter((c: any) => c.active).length : 0)
    // The canary-array length is NOT the indicator count — that substitution is
    // what narrated "3 of 12" against a 29-indicator index (P6-19), and it was
    // still sitting here as the fallback. The count is derived from the weight
    // tables, so fall back to that; the client sends null when the payload
    // carried no count (P7-2), which is what makes this reachable at all.
    const totalIndicators =
      typeof body.totalIndicators === "number" ? body.totalIndicators : TOTAL_SCORED_INDICATORS
    const regime = body.regime ?? { name: "Unknown", description: "Unknown" }
    // Pillars arrive null when too little of their weight was live/AI-sourced.
    // `?? { …: 0 }` and a bare `${pillars.momentum}/100` both told the model a
    // hard zero — maximum crash signal — for a pillar that was never scored.
    const pillars = body.pillars ?? { momentum: null, riskAppetite: null, valuation: null, macro: null }
    const pillarLine = (label: string, score: number | null | undefined, weight: string) =>
      `  * ${label}: ${score === null || score === undefined ? `insufficient data — excluded from the composite (Weight: ${weight})` : `${score}/100 (Weight: ${weight})`}`
    const unscoredPillars = ["momentum", "riskAppetite", "valuation", "macro"].filter((k) => pillars[k] == null)

    const prompt = `You are a professional financial analyst providing an executive summary for the CCPI (Comprehensive Crash & Correction Prediction Index).

## CCPI METHODOLOGY CONTEXT:
The CCPI is a proprietary market crash prediction index that aggregates ${TOTAL_SCORED_INDICATORS} scored market indicators across 4 weighted pillars:
- **Pillar 1: Momentum & Technical (35%)** - Tracks price trends, moving averages, breadth indicators
- **Pillar 2: Risk Appetite & Volatility (30%)** - Measures VIX, put/call ratios, credit spreads, investor sentiment
- **Pillar 3: Valuation & Market Structure (15%)** - Analyzes P/E ratios, CAPE, market concentration, equity risk premium
- **Pillar 4: Macro (20%)** - Evaluates economic indicators like ISM PMI, yield curves, debt levels

The final CCPI score is calculated as: Σ(Pillar Score × Weight), ranging from 0-100 where:
- 0-19: Low Risk (markets healthy)
- 20-39: Normal (typical market conditions)
- 40-59: Caution (elevated risk, defensive positioning recommended)
- 60-79: High Alert (significant crash probability)
- 80-100: Crash Watch (imminent correction likely)

## CERTAINTY SCORE METHODOLOGY:
The ${certainty}% certainty score measures signal consistency and alignment:
- It calculates how many indicators agree directionally within each pillar
- Higher certainty = more indicators pointing in the same direction = higher confidence in the CCPI reading
- Lower certainty = mixed signals = less confidence, more uncertainty in market direction

## CURRENT MARKET DATA:
- CCPI Score: ${ccpi}/100
- Certainty Score: ${certainty}%
- Active Warning Signals: ${activeCanaries} of ${totalIndicators} indicators triggered
- Market Regime: ${regime.name} (${regime.description})
- Pillar Scores:
${pillarLine("Momentum & Technical", pillars.momentum, "35%")}
${pillarLine("Risk Appetite & Volatility", pillars.riskAppetite, "30%")}
${pillarLine("Valuation & Market Structure", pillars.valuation, "15%")}
${pillarLine("Macro", pillars.macro, "20%")}${
      unscoredPillars.length > 0
        ? `
- DATA GAP: ${unscoredPillars.length} of 4 pillars could not be scored. State this in the summary and do not infer a reading for them. "Insufficient data" means UNKNOWN — not zero, and not healthy.`
        : ""
    }

## YOUR TASK:
Write a comprehensive 2-3 sentence executive summary that:
1. States the CCPI score and what risk zone it falls in (Low Risk/Normal/Caution/High Alert/Crash Watch)
2. Explains the ${certainty}% certainty score means ${certainty >= 70 ? "high signal agreement - strong confidence in the reading" : certainty >= 50 ? "moderate signal alignment - reasonable confidence but some mixed signals" : "low signal consistency - significant uncertainty, mixed market signals"}
3. Identifies which pillar(s) are driving the score (highest scoring pillars = most concerning)
4. Provides specific, actionable guidance for options traders based on this data

Make it professional, data-driven, and immediately actionable for sophisticated traders. Focus on what the numbers mean and what traders should DO.`

    // Budget guard (E-5): refresh before spending, so `config.key()` below
    // resolves to "" for guarded providers once the kill switch has tripped.
    await ensureBudgetGuardFresh()

    // P2-4. The dry run stops HERE — after body parsing, the null-aware pillar
    // rendering and the budget-guard refresh, and before any provider is
    // touched. It deliberately sits AFTER `ensureBudgetGuardFresh()`, because a
    // guard that fails to refresh is exactly the kind of silent spend-control
    // break this route had no test for at all.
    if (isDryRun(request, body)) {
      return NextResponse.json(dryRunPayload("/api/ccpi/executive-summary", "providerConfigs chain", prompt.length))
    }

    let lastError: Error | null = null

    for (const config of providerConfigs) {
      if (!config.key()) continue

      const started = Date.now()
      // The call is metered exactly once. Without this the "empty response"
      // throw below would fall into the catch and log a second row for the
      // same call, inflating both the count and the cost.
      let metered = false
      try {
        console.log(`[AI] Trying ${config.name} for executive summary...`)
        const provider = config.create()
        const model = provider(config.model)

        const result = await generateText({
          model,
          prompt,
          temperature: 0.7,
          // ai v5 renamed this from `maxTokens`. Under the old name the option
          // was silently dropped, so output length was unbounded on the paid
          // fallbacks — a real spend leak, not just a type error.
          maxOutputTokens: 300,
          abortSignal: AbortSignal.timeout(30000),
        })
        const text = result.text

        recordAiCall({
          provider: config.name,
          model: config.model,
          route: "/api/ccpi/executive-summary",
          ms: Date.now() - started,
          ok: true,
          usage: result.usage,
        })
        metered = true

        if (!text || text.trim().length === 0) {
          throw new Error("AI returned empty response")
        }

        console.log(`[AI] Success with ${config.name}`)
        return NextResponse.json({ summary: text.trim(), provider: config.name })
      } catch (error) {
        console.error(`[AI] ${config.name} failed:`, error instanceof Error ? error.message : error)
        if (!metered) {
          recordAiCall({
            provider: config.name,
            model: config.model,
            route: "/api/ccpi/executive-summary",
            ms: Date.now() - started,
            ok: false,
            usage: null,
          })
        }
        lastError = error instanceof Error ? error : new Error(String(error))
        // Continue to next provider
      }
    }

    throw lastError || new Error("No AI providers available")
  } catch (error) {
    console.error("[AI] Executive summary error:", error)

    // This used to return, at HTTP 200, a `summary` reading "CCPI analysis is
    // currently being generated. The market data has been successfully loaded."
    // Both halves were false: every provider had already failed and nothing was
    // still generating, and it asserted success inside the error path.
    //
    // It landed in the field the dashboard renders AS the executive summary,
    // beneath a line reading "Generated by Grok xAI" — so a failure produced a
    // reassuring sentence with a model's name under it. No status code is worth
    // that; returning 503 with no summary lets the page show nothing, which is
    // what actually happened.
    return NextResponse.json(
      {
        error: "AI generation temporarily unavailable",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    )
  }
}
