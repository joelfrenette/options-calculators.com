import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY || 'gen-lang-client-0100065741'
})

export async function fetchMarketDataWithGemini(indicatorName: string, context?: string): Promise<number | null> {
  try {
    console.log(`[v0] Google Gemini: Fetching ${indicatorName}...`)
    
    const prompt = `You are a financial data assistant with access to real-time market data. Provide ONLY the current numeric value for the following market indicator. Do not include any explanation, units, or currency symbols - just the raw number.

Indicator: ${indicatorName}
${context ? `Context: ${context}` : ''}

Examples:
- "Shiller CAPE ratio" → "32.5"
- "S&P 500 Forward P/E" → "22.3"
- "SPY short interest ratio" → "1.8"
- "VIX index" → "18.5"
- "NVIDIA stock price" → "875.25"

Respond with ONLY the number, nothing else.`

    const { text } = await generateText({
      model: google('gemini-2.0-flash-exp'),
      prompt,
      maxTokens: 50,
      temperature: 0.1 // Low temperature for factual data
    })
    
    const value = parseFloat(text.trim().replace(/[^0-9.-]/g, ''))
    
    if (isNaN(value)) {
      console.error(`[v0] Google Gemini: Could not parse value from response: "${text}"`)
      return null
    }
    
    console.log(`[v0] Google Gemini: Successfully fetched ${indicatorName} = ${value}`)
    return value
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isRateLimitError = errorMessage.includes('429') || 
                            errorMessage.includes('RESOURCE_EXHAUSTED') || 
                            errorMessage.includes('quota')
    
    if (isRateLimitError) {
      // Silently return null for rate limit errors - fallback will handle it
      return null
    }
    
    // Only log non-rate-limit errors
    console.error(`[v0] Google Gemini: Error fetching ${indicatorName}:`, errorMessage)
    return null
  }
}

// Specific helper functions for ALL CCPI indicators
export async function fetchShillerCAPEWithGemini(): Promise<number | null> {
  return await fetchMarketDataWithGemini(
    "Shiller CAPE ratio (cyclically adjusted price-to-earnings ratio for S&P 500)",
    "Current value as of today"
  )
}

export async function fetchShortInterestWithGemini(): Promise<number | null> {
  return await fetchMarketDataWithGemini(
    "SPY ETF short interest ratio as percentage of float",
    "Current short interest percentage"
  )
}

export async function fetchMag7ConcentrationWithGemini(): Promise<number | null> {
  return await fetchMarketDataWithGemini(
    "Magnificent 7 stocks (AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META) market cap as percentage of S&P 500",
    "Current concentration percentage"
  )
}

export async function fetchQQQPEWithGemini(): Promise<number | null> {
  return await fetchMarketDataWithGemini(
    "QQQ ETF forward price-to-earnings ratio",
    "Current forward P/E for Invesco QQQ Trust"
  )
}

export async function fetchBuffettIndicatorWithGemini(): Promise<number | null> {
  return await fetchMarketDataWithGemini(
    "Buffett Indicator (Total US Market Cap divided by GDP as percentage)",
    "Current Wilshire 5000 to GDP ratio"
  )
}

export async function fetchPutCallRatioWithGemini(): Promise<number | null> {
  return await fetchMarketDataWithGemini(
    "CBOE total put/call ratio",
    "Current equity put/call volume ratio"
  )
}

export async function fetchAAIIBullishWithGemini(): Promise<number | null> {
  return await fetchMarketDataWithGemini(
    "AAII investor sentiment survey bullish percentage",
    "Current percentage of bullish individual investors"
  )
}

export async function fetchVIXWithGemini(): Promise<number | null> {
  return await fetchMarketDataWithGemini(
    "CBOE Volatility Index (VIX)",
    "Current VIX spot price"
  )
}

export async function fetchNVIDIAPriceWithGemini(): Promise<number | null> {
  return await fetchMarketDataWithGemini(
    "NVIDIA (NVDA) stock price",
    "Current NVDA stock price in USD"
  )
}

export async function fetchSOXIndexWithGemini(): Promise<number | null> {
  return await fetchMarketDataWithGemini(
    "PHLX Semiconductor Sector Index (SOX)",
    "Current SOX index level"
  )
}

export async function fetchISMPMIWithGemini(): Promise<number | null> {
  return await fetchMarketDataWithGemini(
    "ISM Manufacturing PMI (Purchasing Managers Index)",
    "Current ISM manufacturing index value"
  )
}

export async function fetchSPXPEWithGemini(): Promise<number | null> {
  return await fetchMarketDataWithGemini(
    "S&P 500 forward price-to-earnings ratio",
    "Current S&P 500 forward P/E multiple"
  )
}

export async function fetchFearGreedWithGemini(): Promise<number | null> {
  return await fetchMarketDataWithGemini(
    "CNN Fear & Greed Index",
    "Current market sentiment index (0-100 scale)"
  )
}

export async function fetchYieldCurveWithGemini(): Promise<number | null> {
  return await fetchMarketDataWithGemini(
    "US Treasury 10-Year minus 2-Year yield spread",
    "Current 10Y-2Y spread in basis points"
  )
}
