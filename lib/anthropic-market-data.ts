import { generateText } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"

// Function to create Anthropic provider with direct API key
function getAnthropicProvider() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null
  }
  return createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
}

async function fetchMarketDataWithAnthropic(indicator: string, specificData = "Current value"): Promise<number | null> {
  try {
    const anthropic = getAnthropicProvider()
    if (!anthropic) {
      console.log(`[v0] Anthropic: No API key available`)
      return null
    }

    const { text } = await generateText({
      model: anthropic("claude-3-5-sonnet-20241022"),
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
      console.log(`[v0] Anthropic: Successfully fetched ${indicator} = ${value}`)
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
    console.error(`[v0] Anthropic error for ${indicator}:`, error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function fetchShillerCAPEWithAnthropic(): Promise<number | null> {
  console.log(`[v0] Anthropic: Fetching Shiller CAPE ratio...`)
  return fetchMarketDataWithAnthropic(
    "Shiller CAPE ratio (cyclically adjusted price-to-earnings ratio for S&P 500)",
    "Current CAPE ratio value",
  )
}

export async function fetchShortInterestWithAnthropic(): Promise<number | null> {
  console.log(`[v0] Anthropic: Fetching SPY short interest...`)
  return fetchMarketDataWithAnthropic(
    "SPY ETF short interest ratio as percentage of float",
    "Current short interest percentage",
  )
}

export async function fetchMag7ConcentrationWithAnthropic(): Promise<number | null> {
  console.log(`[v0] Anthropic: Fetching Mag7 concentration...`)
  return fetchMarketDataWithAnthropic(
    "Magnificent 7 stocks (AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META) market cap as percentage of QQQ ETF",
    "Current percentage concentration",
  )
}

export async function fetchQQQPEWithAnthropic(): Promise<number | null> {
  console.log(`[v0] Anthropic: Fetching QQQ P/E...`)
  return fetchMarketDataWithAnthropic("QQQ ETF forward price-to-earnings ratio", "Current forward P/E ratio")
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

export async function fetchISMPMIWithAnthropic(): Promise<number | null> {
  console.log(`[v0] Anthropic: Fetching ISM PMI...`)
  return fetchMarketDataWithAnthropic("ISM Manufacturing PMI", "Current ISM PMI value")
}

export async function fetchSPXPEWithAnthropic(): Promise<number | null> {
  console.log(`[v0] Anthropic: Fetching S&P 500 P/E...`)
  return fetchMarketDataWithAnthropic("S&P 500 Forward P/E", "Current S&P 500 forward P/E ratio")
}

export async function fetchFearGreedWithAnthropic(): Promise<number | null> {
  console.log(`[v0] Anthropic: Fetching Fear & Greed...`)
  return fetchMarketDataWithAnthropic("CNN Fear & Greed Index", "Current index value (0-100)")
}

export async function fetchYieldCurveWithAnthropic(): Promise<number | null> {
  console.log(`[v0] Anthropic: Fetching Yield Curve...`)
  return fetchMarketDataWithAnthropic("10-Year minus 2-Year Treasury Spread", "Current spread in percentage")
}
