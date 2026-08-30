import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { resolveApiKey } from "@/lib/api-keys"
import { recordAiCall } from "@/lib/metered-fetch"

const MODEL = "gpt-5.4-nano"

// Keys resolve through lib/api-keys.ts, not process.env directly. Reading the
// env var here bypassed DISABLED_APIS — and would have bypassed the E-5 budget
// guard too, leaving a paid provider reachable after the kill switch tripped.
function getOpenAIProvider() {
  const apiKey = resolveApiKey("OPENAI_API_KEY")
  if (!apiKey) {
    return null
  }
  return createOpenAI({ apiKey })
}

async function fetchMarketDataWithOpenAI(indicator: string, specificData = "Current value"): Promise<number | null> {
  // Hoisted above the try so the catch can report how long the failed call
  // took. A failure with no duration cannot be told apart from one that never
  // left the process.
  const started = Date.now()
  try {
    const openai = getOpenAIProvider()
    if (!openai) {
      console.log(`[v0] OpenAI: No API key available`)
      return null
    }
    const result = await generateText({
      model: openai(MODEL),
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
      provider: "openai",
      model: MODEL,
      route: "lib/openai-market-data",
      ms: Date.now() - started,
      ok: true,
      usage: result.usage,
    })

    const value = Number.parseFloat(text.trim())
    if (!isNaN(value) && value > 0) {
      console.log(`[v0] OpenAI: Successfully fetched ${indicator} = ${value}`)
      return value
    }

    return null
  } catch (error) {
    // This was the most silent failure path in the codebase: no log, no
    // metering, just `return null`. The comment that stood here justified it —
    // "logging errors here creates noise when the fallback is working as
    // intended" — and described a chain order ("OpenAI → Anthropic → Groq →
    // Groq") that does not exist; lib/unified-ai-fallback.ts tries
    // grok → groq → anthropic → openai, and OpenAI is LAST, not first.
    //
    // Quiet logs are a defensible taste. An unrecorded failure is not: a
    // fallback "working as intended" and a fallback whose every provider is
    // dead produce the identical empty ledger, which is exactly the state that
    // let xAI fail 401 times out of 401 unnoticed. The console stays quiet;
    // the row does not.
    recordAiCall({
      provider: "openai",
      model: MODEL,
      route: "lib/openai-market-data",
      ms: Date.now() - started,
      ok: false,
      usage: null,
      error,
    })
    return null
  }
}

export async function fetchBuffettIndicatorWithOpenAI(): Promise<number | null> {
  console.log(`[v0] OpenAI: Fetching Buffett Indicator (Market Cap to GDP ratio)...`)
  return fetchMarketDataWithOpenAI("Buffett Indicator (Market Cap to GDP ratio)", "Current percentage")
}

export async function fetchPutCallRatioWithOpenAI(): Promise<number | null> {
  console.log(`[v0] OpenAI: Fetching CBOE Put/Call Ratio...`)
  return fetchMarketDataWithOpenAI("CBOE Put/Call Ratio", "Current equity put/call ratio")
}

export async function fetchAAIIBullishWithOpenAI(): Promise<number | null> {
  console.log(`[v0] OpenAI: Fetching AAII Bullish Sentiment Percentage...`)
  return fetchMarketDataWithOpenAI("AAII Bullish Sentiment Percentage", "Current bullish investor percentage")
}

export async function fetchVIXWithOpenAI(): Promise<number | null> {
  console.log(`[v0] OpenAI: Fetching CBOE Volatility Index (VIX)...`)
  return fetchMarketDataWithOpenAI("CBOE Volatility Index (VIX)", "Current VIX level")
}

export async function fetchNVIDIAPriceWithOpenAI(): Promise<number | null> {
  console.log(`[v0] OpenAI: Fetching NVIDIA (NVDA) stock price...`)
  return fetchMarketDataWithOpenAI("NVIDIA (NVDA) stock price", "Current NVDA price in USD")
}

export async function fetchSOXIndexWithOpenAI(): Promise<number | null> {
  console.log(`[v0] OpenAI: Fetching PHLX Semiconductor Index (SOX)...`)
  return fetchMarketDataWithOpenAI("PHLX Semiconductor Index (SOX)", "Current SOX index level")
}

// Removed 2026-08-10 (P6-34): the S&P P/E, Fear & Greed and yield-curve
// fetchers. Their only caller was lib/unified-ai-fallback.ts, whose three
// getters were themselves never called, and all three figures have a real
// source in the app.
