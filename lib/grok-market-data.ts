import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { resolveApiKey } from "@/lib/api-keys"
import { recordAiCall } from "@/lib/metered-fetch"

// Keys resolve through lib/api-keys.ts, not process.env directly. Reading the
// env vars here bypassed DISABLED_APIS (and the XAI_API_KEY/GROK_XAI_API_KEY
// alias list was hand-duplicated) — and would have bypassed the E-5 budget
// guard too, leaving paid providers reachable after the kill switch tripped.
//
// `tag` is the canonical provider name used in the spend ledger; `name` stays
// the human label the existing logs print.
function getAIProvider() {
  // For market data, prefer xAI/Grok as it's trained on real-time data
  const xaiKey = resolveApiKey("XAI_API_KEY")
  if (xaiKey) {
    return {
      provider: createOpenAI({
        apiKey: xaiKey,
        baseURL: "https://api.x.ai/v1",
      }),
      model: "grok-2-latest",
      name: "xAI",
      tag: "xai",
    }
  }
  const groqKey = resolveApiKey("GROQ_API_KEY")
  if (groqKey) {
    return {
      provider: createOpenAI({
        apiKey: groqKey,
        baseURL: "https://api.groq.com/openai/v1",
      }),
      model: "llama-3.3-70b-versatile",
      name: "Groq",
      tag: "groq",
    }
  }
  const openaiKey = resolveApiKey("OPENAI_API_KEY")
  if (openaiKey) {
    return {
      provider: createOpenAI({ apiKey: openaiKey }),
      model: "gpt-4o-mini",
      name: "OpenAI",
      tag: "openai",
    }
  }
  return null
}

export async function fetchMarketDataWithGrok(indicatorName: string, context?: string): Promise<number | null> {
  try {
    const ai = getAIProvider()
    if (!ai) {
      console.log(`[AI] No provider available for market data fetch`)
      return null
    }

    console.log(`[AI] ${ai.name}: Fetching ${indicatorName}...`)

    const prompt = `You are a financial data assistant. Provide ONLY the current numeric value for the following market indicator. Do not include any explanation, just the number.

Indicator: ${indicatorName}
${context ? `Context: ${context}` : ""}

Examples:
- "Shiller CAPE ratio" → "32.5"
- "S&P 500 Forward P/E" → "22.3"
- "SPY short interest ratio" → "1.8"

Respond with ONLY the number, nothing else.`

    let text = ""
    const started = Date.now()
    try {
      const result = await generateText({
        model: ai.provider(ai.model),
        prompt,
        maxOutputTokens: 50,
        temperature: 0.1,
      })
      text = result.text
      recordAiCall({
        provider: ai.tag,
        model: ai.model,
        route: "lib/grok-market-data",
        ms: Date.now() - started,
        ok: true,
        usage: result.usage,
      })
    } catch (sdkError) {
      const errorMsg = sdkError instanceof Error ? sdkError.message : String(sdkError)
      console.log(`[AI] ${ai.name}: SDK error occurred: ${errorMsg.substring(0, 100)}`)
      recordAiCall({
        provider: ai.tag,
        model: ai.model,
        route: "lib/grok-market-data",
        ms: Date.now() - started,
        ok: false,
        usage: null,
        // This is the site's hottest AI path — grok is slot 1 of all six CCPI
        // fallbacks — and it is the one whose 401-of-401 failure rate went
        // unread for three weeks because this row carried no cause.
        error: sdkError,
      })
      return null
    }

    const value = Number.parseFloat(text.trim())

    if (isNaN(value)) {
      console.error(`[AI] ${ai.name}: Could not parse value from response: "${text}"`)
      return null
    }

    console.log(`[AI] ${ai.name}: Successfully fetched ${indicatorName} = ${value}`)
    return value
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[AI] Error fetching ${indicatorName}:`, errorMsg)
    return null
  }
}

// Specific helper functions for common indicators

// The four helpers that lived here — fetchShillerCAPEWithGrok,
// fetchShortInterestWithGrok, fetchMag7ConcentrationWithGrok and
// fetchQQQPEWithGrok — are deleted. Each asked an LLM to recall a published
// figure and then ended `return value || <constant>`: 30, 1.2, 55, 32. None was
// imported by anything live.
//
// This is P6-34's dead-getter cleanup, one module over. That finding removed
// getSPXPE/getFearGreed/getYieldCurve for the same reason and made
// fetchWithAIFallback stop inventing a baseline at all — but it only touched
// lib/unified-ai-fallback.ts, and the identical pattern sat here untouched.
// `|| <constant>` after an AI call is the invented-data layer wearing a
// different import path.
