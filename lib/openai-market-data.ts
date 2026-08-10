import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { resolveApiKey } from "@/lib/api-keys"
import { recordAiCall } from "@/lib/metered-fetch"

const MODEL = "gpt-4o-mini"

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
  try {
    const openai = getOpenAIProvider()
    if (!openai) {
      console.log(`[v0] OpenAI: No API key available`)
      return null
    }

    const started = Date.now()
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
    // The system is designed to try OpenAI → Anthropic → Groq → Groq
    // Logging errors here creates noise when the fallback is working as intended
    return null
  }
}

export async function fetchShillerCAPEWithOpenAI(): Promise<number | null> {
  console.log(`[v0] OpenAI: Fetching Shiller CAPE ratio (cyclically adjusted price-to-earnings ratio for S&P 500)...`)
  return fetchMarketDataWithOpenAI(
    "Shiller CAPE ratio (cyclically adjusted price-to-earnings ratio for S&P 500)",
    "Current CAPE ratio value",
  )
}

export async function fetchShortInterestWithOpenAI(): Promise<number | null> {
  console.log(`[v0] OpenAI: Fetching SPY ETF short interest ratio as percentage of float...`)
  return fetchMarketDataWithOpenAI(
    "SPY ETF short interest ratio as percentage of float",
    "Current short interest percentage",
  )
}

export async function fetchMag7ConcentrationWithOpenAI(): Promise<number | null> {
  console.log(
    `[v0] OpenAI: Fetching Magnificent 7 stocks (AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META) market cap as percentage of QQQ ETF...`,
  )
  return fetchMarketDataWithOpenAI(
    "Magnificent 7 stocks (AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META) market cap as percentage of QQQ ETF",
    "Current percentage concentration",
  )
}

export async function fetchQQQPEWithOpenAI(): Promise<number | null> {
  console.log(`[v0] OpenAI: Fetching QQQ ETF forward price-to-earnings ratio...`)
  return fetchMarketDataWithOpenAI("QQQ ETF forward price-to-earnings ratio", "Current forward P/E ratio")
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

export async function fetchISMPMIWithOpenAI(): Promise<number | null> {
  console.log(`[v0] OpenAI: Fetching ISM Manufacturing PMI...`)
  return fetchMarketDataWithOpenAI("ISM Manufacturing PMI", "Current ISM PMI value")
}

// Removed 2026-08-10 (P6-34): the S&P P/E, Fear & Greed and yield-curve
// fetchers. Their only caller was lib/unified-ai-fallback.ts, whose three
// getters were themselves never called, and all three figures have a real
// source in the app.
