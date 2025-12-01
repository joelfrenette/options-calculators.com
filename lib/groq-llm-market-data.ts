import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"

// Create Groq provider with direct API key
function getGroqProvider() {
  if (!process.env.GROQ_API_KEY) {
    return null
  }
  return createOpenAI({
    apiKey: process.env.GROQ_API_KEY,
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

    const { text } = await generateText({
      model: "llama-3.3-70b-versatile",
      prompt: `You are a financial data expert. Provide ONLY the current numeric value for: ${indicator}.
      
Specific requirement: ${specificData}

CRITICAL RULES:
- Return ONLY a single number, no text, no units, no explanation
- Use the most recent available data (within last 24 hours if possible)
- If data is unavailable, return "null"
- Examples: "34.5" or "150" or "0.89" or "null"

Value:`,
      maxTokens: 50,
      temperature: 0.1,
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

export async function fetchShillerCAPEWithGroqLLM(): Promise<number | null> {
  console.log(`[v0] Groq LLM: Fetching Shiller CAPE ratio...`)
  return fetchMarketDataWithGroqLLM(
    "Shiller CAPE ratio (cyclically adjusted price-to-earnings ratio for S&P 500)",
    "Current CAPE ratio value",
  )
}

export async function fetchShortInterestWithGroqLLM(): Promise<number | null> {
  console.log(`[v0] Groq LLM: Fetching SPY short interest...`)
  return fetchMarketDataWithGroqLLM(
    "SPY ETF short interest ratio as percentage of float",
    "Current short interest percentage",
  )
}

export async function fetchMag7ConcentrationWithGroqLLM(): Promise<number | null> {
  console.log(`[v0] Groq LLM: Fetching Mag7 concentration...`)
  return fetchMarketDataWithGroqLLM(
    "Magnificent 7 stocks (AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META) market cap as percentage of QQQ ETF",
    "Current percentage concentration",
  )
}

export async function fetchQQQPEWithGroqLLM(): Promise<number | null> {
  console.log(`[v0] Groq LLM: Fetching QQQ P/E...`)
  return fetchMarketDataWithGroqLLM("QQQ ETF forward price-to-earnings ratio", "Current forward P/E ratio")
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

export async function fetchISMPMIWithGroqLLM(): Promise<number | null> {
  console.log(`[v0] Groq LLM: Fetching ISM PMI...`)
  return fetchMarketDataWithGroqLLM("ISM Manufacturing PMI", "Current ISM PMI value")
}

export async function fetchSPXPEWithGroqLLM(): Promise<number | null> {
  console.log(`[v0] Groq LLM: Fetching S&P 500 P/E...`)
  return fetchMarketDataWithGroqLLM("S&P 500 Forward P/E", "Current S&P 500 forward P/E ratio")
}

export async function fetchFearGreedWithGroqLLM(): Promise<number | null> {
  console.log(`[v0] Groq LLM: Fetching Fear & Greed...`)
  return fetchMarketDataWithGroqLLM("CNN Fear & Greed Index", "Current index value (0-100)")
}

export async function fetchYieldCurveWithGroqLLM(): Promise<number | null> {
  console.log(`[v0] Groq LLM: Fetching Yield Curve...`)
  return fetchMarketDataWithGroqLLM("10-Year minus 2-Year Treasury Spread", "Current spread in percentage")
}
