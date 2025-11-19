import { generateText } from 'ai'

async function fetchMarketDataWithOpenAI(
  indicator: string,
  specificData: string = "Current value"
): Promise<number | null> {
  try {
    const { text } = await generateText({
      model: 'openai/gpt-4o',
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
    
    const value = parseFloat(text.trim())
    if (!isNaN(value) && value > 0) {
      console.log(`[v0] OpenAI: Successfully fetched ${indicator} = ${value}`)
      return value
    }
    
    return null
  } catch (error) {
    // Check for rate limit errors
    if (error instanceof Error && (
      error.message.includes('429') || 
      error.message.includes('rate') || 
      error.message.includes('quota')
    )) {
      // Silently return null for rate limits
      return null
    }
    // Log other errors
    console.error(`[v0] OpenAI error for ${indicator}:`, error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function fetchShillerCAPEWithOpenAI(): Promise<number | null> {
  console.log(`[v0] OpenAI: Fetching Shiller CAPE ratio (cyclically adjusted price-to-earnings ratio for S&P 500)...`)
  return fetchMarketDataWithOpenAI("Shiller CAPE ratio (cyclically adjusted price-to-earnings ratio for S&P 500)", "Current CAPE ratio value")
}

export async function fetchShortInterestWithOpenAI(): Promise<number | null> {
  console.log(`[v0] OpenAI: Fetching SPY ETF short interest ratio as percentage of float...`)
  return fetchMarketDataWithOpenAI("SPY ETF short interest ratio as percentage of float", "Current short interest percentage")
}

export async function fetchMag7ConcentrationWithOpenAI(): Promise<number | null> {
  console.log(`[v0] OpenAI: Fetching Magnificent 7 stocks (AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META) market cap as percentage of QQQ ETF...`)
  return fetchMarketDataWithOpenAI("Magnificent 7 stocks (AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META) market cap as percentage of QQQ ETF", "Current percentage concentration")
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

export async function fetchSPXPEWithOpenAI(): Promise<number | null> {
  console.log(`[v0] OpenAI: Fetching S&P 500 Forward P/E...`)
  return fetchMarketDataWithOpenAI("S&P 500 Forward P/E", "Current S&P 500 forward P/E ratio")
}

export async function fetchFearGreedWithOpenAI(): Promise<number | null> {
  console.log(`[v0] OpenAI: Fetching CNN Fear & Greed Index...`)
  return fetchMarketDataWithOpenAI("CNN Fear & Greed Index", "Current index value (0-100)")
}

export async function fetchYieldCurveWithOpenAI(): Promise<number | null> {
  console.log(`[v0] OpenAI: Fetching 10-Year minus 2-Year Treasury Spread...`)
  return fetchMarketDataWithOpenAI("10-Year minus 2-Year Treasury Spread", "Current spread in percentage")
}
