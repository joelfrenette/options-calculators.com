import { streamText, convertToModelMessages, type UIMessage } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

const providerConfigs = [
  {
    name: "Groq",
    key: () => process.env.GROQ_API_KEY,
    create: () =>
      createOpenAI({
        apiKey: process.env.GROQ_API_KEY!,
        baseURL: "https://api.groq.com/openai/v1",
      }),
    model: "llama-3.3-70b-versatile",
  },
  {
    name: "OpenAI",
    key: () => process.env.OPENAI_API_KEY,
    create: () => createOpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
    model: "gpt-4o-mini",
  },
  {
    name: "Google",
    key: () => process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    create: () => createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! }),
    model: "gemini-2.0-flash-exp",
  },
  {
    name: "xAI",
    key: () => process.env.XAI_API_KEY,
    create: () =>
      createOpenAI({
        apiKey: process.env.XAI_API_KEY!,
        baseURL: "https://api.x.ai/v1",
      }),
    model: "grok-2-latest",
  },
  {
    name: "Anthropic",
    key: () => process.env.ANTHROPIC_API_KEY,
    create: () => createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }),
    model: "claude-3-5-sonnet-20241022",
  },
  {
    name: "OpenRouter",
    key: () => process.env.OPENROUTER_API_KEY,
    create: () =>
      createOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY!,
        baseURL: "https://openrouter.ai/api/v1",
      }),
    model: "meta-llama/llama-3.3-70b-instruct",
  },
]

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { messages, ccpiContext }: { messages: UIMessage[]; ccpiContext: any } = await req.json()

    const systemPrompt = `You are a professional financial analyst AI assistant specializing in the CCPI (Comprehensive Crash & Correction Prediction Index). You help options traders understand market crash risk and make informed decisions.

## CCPI METHODOLOGY:
The CCPI aggregates 34 market indicators across 4 weighted pillars:
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
- CCPI Score: ${ccpiContext.ccpi}/100 (${ccpiContext.regime?.name || "Unknown"} regime)
- Certainty Score: ${ccpiContext.certainty}%
- Active Warning Signals: ${ccpiContext.activeWarnings} of ${ccpiContext.totalIndicators}
- Pillar Scores:
  * Momentum & Technical: ${ccpiContext.pillars?.momentum || 0}/100
  * Risk Appetite & Volatility: ${ccpiContext.pillars?.riskAppetite || 0}/100
  * Valuation & Market Structure: ${ccpiContext.pillars?.valuation || 0}/100
  * Macro: ${ccpiContext.pillars?.macro || 0}/100
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

    let lastError: Error | null = null

    for (const config of providerConfigs) {
      if (!config.key()) continue

      try {
        console.log(`[AI] Trying ${config.name} for CCPI chat...`)
        const provider = config.create()
        const model = provider(config.model)

        const result = streamText({
          model,
          system: systemPrompt,
          messages: prompt,
          temperature: 0.7,
          maxTokens: 1000,
          abortSignal: req.signal,
        })

        console.log(`[AI] Success with ${config.name}`)
        return result.toUIMessageStreamResponse()
      } catch (error) {
        console.error(`[AI] ${config.name} failed:`, error instanceof Error ? error.message : error)
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
