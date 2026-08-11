import { NextResponse } from "next/server"
import { streamText, convertToModelMessages, type UIMessage } from "ai"
import { isDryRun, dryRunPayload } from "@/lib/dry-run"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { resolveApiKey } from "@/lib/api-keys"
import { recordAiCall } from "@/lib/metered-fetch"
import { ensureBudgetGuardFresh } from "@/lib/budget-guard"
import { TOTAL_SCORED_INDICATORS } from "@/lib/ccpi/scoring"

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

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { messages, ccpiContext }: { messages: UIMessage[]; ccpiContext: any } = await req.json()

    // A pillar is null when under 40 of its 100 weight came from live or AI
    // data — the composite renormalizes over the pillars that scored. Rendering
    // that as "0/100" told the model MAXIMUM crash signal, the exact opposite
    // of "we don't know", and it then reasoned and advised from there.
    const pillarLine = (label: string, score: number | null | undefined) =>
      `  * ${label}: ${score === null || score === undefined ? "insufficient data — excluded from the composite" : `${score}/100`}`

    const unscoredPillars = ccpiContext
      ? ["momentum", "riskAppetite", "valuation", "macro"].filter((k) => ccpiContext.pillars?.[k] == null)
      : []

    const systemPrompt = `You are a professional financial analyst AI assistant specializing in the CCPI (Comprehensive Crash & Correction Prediction Index). You help options traders understand market crash risk and make informed decisions.

## CCPI METHODOLOGY:
The CCPI aggregates ${TOTAL_SCORED_INDICATORS} scored market indicators across 4 weighted pillars:
- **Pillar 1: Momentum & Technical (35%)** - Price trends, moving averages (QQQ 20/50-day SMA), market breadth
- **Pillar 2: Risk Appetite & Volatility (30%)** - VIX levels, put/call ratios, credit spreads, AAII sentiment
- **Pillar 3: Valuation & Market Structure (15%)** - S&P P/E, CAPE, Buffett Indicator, Mag7 concentration, equity risk premium
- **Pillar 4: Macro (20%)** - ISM PMI, yield curve, US Debt-to-GDP, Dollar Index

CCPI Score Interpretation:
- 0-19: Low Risk - Markets healthy, risk-on strategies appropriate
- 20-39: Normal - Typical conditions, balanced approach
- 40-59: Caution - Elevated risk, consider defensive positioning
- 60-79: High Alert - Significant crash probability, reduce exposure
- 80-100: Crash Watch - Imminent correction likely, maximum defense

Certainty Score: Measures signal consistency (how many indicators agree). Higher = more confidence in the CCPI reading.

## CURRENT MARKET DATA:
${
  ccpiContext
    ? `
- CCPI Score: ${ccpiContext.ccpi ?? "unavailable"}/100 (${ccpiContext.regime?.name || "Unknown"} regime)
- Certainty Score: ${ccpiContext.certainty ?? "unavailable"}%
- Active Warning Signals: ${ccpiContext.activeWarnings ?? "unavailable"} of ${ccpiContext.totalIndicators ?? TOTAL_SCORED_INDICATORS}
- Pillar Scores:
${pillarLine("Momentum & Technical", ccpiContext.pillars?.momentum)}
${pillarLine("Risk Appetite & Volatility", ccpiContext.pillars?.riskAppetite)}
${pillarLine("Valuation & Market Structure", ccpiContext.pillars?.valuation)}
${pillarLine("Macro", ccpiContext.pillars?.macro)}${
        unscoredPillars.length > 0
          ? `
- DATA GAP: ${unscoredPillars.length} of 4 pillars could not be scored. Say so when the user asks about them or about the composite, and do not infer a reading for them. A pillar marked "insufficient data" is UNKNOWN, not zero and not healthy.`
          : ""
      }
${ccpiContext.crashAmplifiers?.length > 0 ? `- Crash Amplifiers Active: ${ccpiContext.crashAmplifiers.join(", ")}` : ""}
${
  ccpiContext.activeSignals?.length > 0
    ? `- Key Active Signals: ${ccpiContext.activeSignals
        .slice(0, 5)
        .map((s: any) => s.name || s)
        .join(", ")}`
    : ""
}
`
    : "No CCPI data available currently."
}

## RESPONSE GUIDELINES:
- Be concise but thorough
- Reference specific CCPI data when relevant
- Provide actionable insights for options traders
- Explain technical concepts clearly
- If asked about specific strategies, relate them to the current CCPI level
- Never give specific trade recommendations, only educational guidance`

    const prompt = convertToModelMessages(messages)

    // Budget guard (E-5): refresh before spending, so `config.key()` below
    // resolves to "" for guarded providers once the kill switch has tripped.
    await ensureBudgetGuardFresh()

    // P2-4. The dry run returns plain JSON rather than a stream, and that is
    // the honest shape: there is no stream, because there is no model. A probe
    // that returned an empty UI-message stream would be asserting that the
    // streaming path works when nothing streamed. What this DOES cover is the
    // part of the route that has actually been wrong before — the system-prompt
    // build, where P6-19 found pillars rendered as "0/100" to the model, and
    // the budget-guard refresh above it. The streaming transport itself stays
    // unverified and is recorded as such.
    if (isDryRun(req, { messages, ccpiContext })) {
      return NextResponse.json({
        ...dryRunPayload("/api/ccpi/chat", "providerConfigs chain (streamText)", systemPrompt.length),
        streams: true,
        note: "Request path exercised; no model was called, so no stream was opened and no content was generated.",
      })
    }

    let lastError: Error | null = null

    for (const config of providerConfigs) {
      if (!config.key()) continue

      const started = Date.now()
      try {
        console.log(`[AI] Trying ${config.name} for CCPI chat...`)
        const provider = config.create()
        const model = provider(config.model)

        const result = streamText({
          model,
          system: systemPrompt,
          messages: prompt,
          temperature: 0.7,
          // ai v5 renamed this from `maxTokens`. Under the old name the option
          // was silently dropped, so a chat turn on a paid fallback had no
          // output ceiling at all — a real spend leak, not just a type error.
          maxOutputTokens: 1000,
          abortSignal: req.signal,
        })

        console.log(`[AI] Success with ${config.name}`)

        // Spend accounting (E-5). `usage` resolves only when the stream ends,
        // so this is deliberately not awaited — the response must go out now.
        void Promise.resolve(result.usage)
          .then((usage) =>
            recordAiCall({
              provider: config.name,
              model: config.model,
              route: "/api/ccpi/chat",
              ms: Date.now() - started,
              ok: true,
              usage,
            }),
          )
          .catch(() =>
            recordAiCall({
              provider: config.name,
              model: config.model,
              route: "/api/ccpi/chat",
              ms: Date.now() - started,
              ok: false,
              usage: null,
            }),
          )

        return result.toUIMessageStreamResponse()
      } catch (error) {
        console.error(`[AI] ${config.name} failed:`, error instanceof Error ? error.message : error)
        recordAiCall({
          provider: config.name,
          model: config.model,
          route: "/api/ccpi/chat",
          ms: Date.now() - started,
          ok: false,
          usage: null,
        })
        lastError = error instanceof Error ? error : new Error(String(error))
        // Continue to next provider
      }
    }

    throw lastError || new Error("No AI providers available")
  } catch (error) {
    console.error("[AI] CCPI chat error:", error)
    return new Response(JSON.stringify({ error: "Failed to process chat request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
