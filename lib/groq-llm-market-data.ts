import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { resolveApiKey } from "@/lib/api-keys"
import { recordAiCall } from "@/lib/metered-fetch"

const MODEL = "llama-3.3-70b-versatile"

// Keys resolve through lib/api-keys.ts, not process.env directly, so
// DISABLED_APIS applies here like everywhere else. Groq is free-tier, so this
// costs nothing at the margin — it is metered for call-volume visibility.
function getGroqProvider() {
  const apiKey = resolveApiKey("GROQ_API_KEY")
  if (!apiKey) {
    return null
  }
  return createOpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  })
}

async function fetchMarketDataWithGroqLLM(indicator: string, specificData = "Current value"): Promise<number | null> {
  try {
    const groq = getGroqProvider()
    if (!groq) {
      console.log(`[v0] Groq LLM: No API key available`)
      return null
    }

    // Use groq("model") instead of just "model" string
    const started = Date.now()
    const result = await generateText({
      model: groq(MODEL),
      prompt: `You are a financial data expert. Provide ONLY the current numeric value for: ${indicator}.
      
Specific requirement: ${specificData}

CRITICAL RULES:
- Return ONLY a single number, no text, no units, no explanation
- Use the most recent available data (within last 24 hours if possible)
- If data is unavailable, return "null"
- Examples: "34.5" or "150" or "0.89" or "null"

Value:`,
      maxOutputTokens: 50,
      temperature: 0.1,
    })
    const text = result.text

    recordAiCall({
      provider: "groq",
      model: MODEL,
      route: "lib/groq-llm-market-data",
      ms: Date.now() - started,
      ok: true,
      usage: result.usage,
    })

    const value = Number.parseFloat(text.trim())
    if (!isNaN(value) && value > 0) {
      console.log(`[v0] Groq LLM: Successfully fetched ${indicator} = ${value}`)
      return value
    }

    return null
  } catch (error) {
    // Check for rate limit errors
    if (
      error instanceof Error &&
      (error.message.includes("429") || error.message.includes("rate") || error.message.includes("quota"))
    ) {
      // Silently return null for rate limits
      return null
    }
    // Log other errors
    console.error(`[v0] Groq LLM error for ${indicator}:`, error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function fetchBuffettIndicatorWithGroqLLM(): Promise<number | null> {
  console.log(`[v0] Groq LLM: Fetching Buffett Indicator...`)
  return fetchMarketDataWithGroqLLM("Buffett Indicator (Market Cap to GDP ratio)", "Current percentage")
}

export async function fetchPutCallRatioWithGroqLLM(): Promise<number | null> {
  console.log(`[v0] Groq LLM: Fetching Put/Call Ratio...`)
  return fetchMarketDataWithGroqLLM("CBOE Put/Call Ratio", "Current equity put/call ratio")
}

export async function fetchAAIIBullishWithGroqLLM(): Promise<number | null> {
  console.log(`[v0] Groq LLM: Fetching AAII Bullish %...`)
  return fetchMarketDataWithGroqLLM("AAII Bullish Sentiment Percentage", "Current bullish investor percentage")
}

export async function fetchVIXWithGroqLLM(): Promise<number | null> {
  console.log(`[v0] Groq LLM: Fetching VIX...`)
  return fetchMarketDataWithGroqLLM("CBOE Volatility Index (VIX)", "Current VIX level")
}

export async function fetchNVIDIAPriceWithGroqLLM(): Promise<number | null> {
  console.log(`[v0] Groq LLM: Fetching NVIDIA price...`)
  return fetchMarketDataWithGroqLLM("NVIDIA (NVDA) stock price", "Current NVDA price in USD")
}

export async function fetchSOXIndexWithGroqLLM(): Promise<number | null> {
  console.log(`[v0] Groq LLM: Fetching SOX Index...`)
  return fetchMarketDataWithGroqLLM("PHLX Semiconductor Index (SOX)", "Current SOX index level")
}

// Removed 2026-08-10 (P6-34): the S&P P/E, Fear & Greed and yield-curve
// fetchers. Their only caller was lib/unified-ai-fallback.ts, whose three
// getters were themselves never called, and all three figures have a real
// source in the app.
