import { generateText } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { resolveApiKey } from "@/lib/api-keys"
import { recordAiCall } from "@/lib/metered-fetch"

const MODEL = "claude-haiku-4-5"

// Keys resolve through lib/api-keys.ts, not process.env directly. Reading the
// env var here bypassed DISABLED_APIS — and would have bypassed the E-5 budget
// guard too, leaving a paid provider reachable after the kill switch tripped.
function getAnthropicProvider() {
  const apiKey = resolveApiKey("ANTHROPIC_API_KEY")
  if (!apiKey) {
    return null
  }
  return createAnthropic({ apiKey })
}

async function fetchMarketDataWithAnthropic(indicator: string, specificData = "Current value"): Promise<number | null> {
  // Hoisted above the try so the catch can report how long the failed call
  // took. A failure with no duration cannot be told apart from one that never
  // left the process.
  const started = Date.now()
  try {
    const anthropic = getAnthropicProvider()
    if (!anthropic) {
      console.log(`[v0] Anthropic: No API key available`)
      return null
    }
    const result = await generateText({
      model: anthropic(MODEL),
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
      provider: "anthropic",
      model: MODEL,
      route: "lib/anthropic-market-data",
      ms: Date.now() - started,
      ok: true,
      usage: result.usage,
    })

    const value = Number.parseFloat(text.trim())
    if (!isNaN(value) && value > 0) {
      console.log(`[v0] Anthropic: Successfully fetched ${indicator} = ${value}`)
      return value
    }

    return null
  } catch (error) {
    // EVERY failure is recorded. This catch used to `return null` without
    // metering at all, so a provider that never once succeeded left no trace
    // in the ledger — indistinguishable from a provider that was never tried.
    // The rate-limit branch below silences the CONSOLE, which is a log-noise
    // decision; it must not silence the accounting record. `error_class` tells
    // the two apart properly (rate_limit vs auth vs model_not_found).
    recordAiCall({
      provider: "anthropic",
      model: MODEL,
      route: "lib/anthropic-market-data",
      ms: Date.now() - started,
      ok: false,
      usage: null,
      error,
    })

    // Rate limits are expected traffic, not an incident: keep them out of the
    // console, but they are already on the row above.
    if (
      error instanceof Error &&
      (error.message.includes("429") || error.message.includes("rate") || error.message.includes("quota"))
    ) {
      return null
    }
    console.error(`[v0] Anthropic error for ${indicator}:`, error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function fetchBuffettIndicatorWithAnthropic(): Promise<number | null> {
  console.log(`[v0] Anthropic: Fetching Buffett Indicator...`)
  return fetchMarketDataWithAnthropic("Buffett Indicator (Market Cap to GDP ratio)", "Current percentage")
}

export async function fetchPutCallRatioWithAnthropic(): Promise<number | null> {
  console.log(`[v0] Anthropic: Fetching Put/Call Ratio...`)
  return fetchMarketDataWithAnthropic("CBOE Put/Call Ratio", "Current equity put/call ratio")
}

export async function fetchAAIIBullishWithAnthropic(): Promise<number | null> {
  console.log(`[v0] Anthropic: Fetching AAII Bullish %...`)
  return fetchMarketDataWithAnthropic("AAII Bullish Sentiment Percentage", "Current bullish investor percentage")
}

export async function fetchVIXWithAnthropic(): Promise<number | null> {
  console.log(`[v0] Anthropic: Fetching VIX...`)
  return fetchMarketDataWithAnthropic("CBOE Volatility Index (VIX)", "Current VIX level")
}

export async function fetchNVIDIAPriceWithAnthropic(): Promise<number | null> {
  console.log(`[v0] Anthropic: Fetching NVIDIA price...`)
  return fetchMarketDataWithAnthropic("NVIDIA (NVDA) stock price", "Current NVDA price in USD")
}

export async function fetchSOXIndexWithAnthropic(): Promise<number | null> {
  console.log(`[v0] Anthropic: Fetching SOX Index...`)
  return fetchMarketDataWithAnthropic("PHLX Semiconductor Index (SOX)", "Current SOX index level")
}

// Removed 2026-08-10 (P6-34): the S&P P/E, Fear & Greed and yield-curve
// fetchers. Their only caller was lib/unified-ai-fallback.ts, whose three
// getters were themselves never called, and all three figures have a real
// source in the app.
