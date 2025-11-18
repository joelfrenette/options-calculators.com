import { generateText } from 'ai'
import { createXai } from '@ai-sdk/xai'

const xai = createXai({
  apiKey: process.env.XAI_API_KEY
})

export async function fetchMarketDataWithGrok(indicatorName: string, context?: string): Promise<number | null> {
  try {
    console.log(`[v0] Grok: Fetching ${indicatorName}...`)
    
    const prompt = `You are a financial data assistant. Provide ONLY the current numeric value for the following market indicator. Do not include any explanation, just the number.

Indicator: ${indicatorName}
${context ? `Context: ${context}` : ''}

Examples:
- "Shiller CAPE ratio" → "32.5"
- "S&P 500 Forward P/E" → "22.3"
- "SPY short interest ratio" → "1.8"

Respond with ONLY the number, nothing else.`

    const { text } = await generateText({
      model: xai('grok-2-latest'),
      prompt,
      maxTokens: 50,
      temperature: 0.1 // Low temperature for factual data
    })
    
    const value = parseFloat(text.trim())
    
    if (isNaN(value)) {
      console.error(`[v0] Grok: Could not parse value from response: "${text}"`)
      return null
    }
    
    console.log(`[v0] Grok: Successfully fetched ${indicatorName} = ${value}`)
    return value
    
  } catch (error) {
    console.error(`[v0] Grok: Error fetching ${indicatorName}:`, error instanceof Error ? error.message : String(error))
    return null
  }
}

// Specific helper functions for common indicators
export async function fetchShillerCAPEWithGrok(): Promise<number> {
  const value = await fetchMarketDataWithGrok(
    "Shiller CAPE ratio (cyclically adjusted price-to-earnings ratio for S&P 500)",
    "Current value as of today"
  )
  return value || 30 // Fallback to baseline if Grok fails
}

export async function fetchShortInterestWithGrok(): Promise<number> {
  const value = await fetchMarketDataWithGrok(
    "SPY ETF short interest ratio as percentage of float",
    "Current short interest percentage"
  )
  return value || 1.2 // Fallback to baseline if Grok fails
}

export async function fetchMag7ConcentrationWithGrok(): Promise<number> {
  const value = await fetchMarketDataWithGrok(
    "Magnificent 7 stocks (AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META) market cap as percentage of QQQ ETF",
    "Current concentration percentage"
  )
  return value || 55 // Fallback to baseline if Grok fails
}

export async function fetchQQQPEWithGrok(): Promise<number> {
  const value = await fetchMarketDataWithGrok(
    "QQQ ETF forward price-to-earnings ratio",
    "Current forward P/E for Invesco QQQ Trust"
  )
  return value || 32 // Fallback to baseline if Grok fails
}

export async function fetchPutCallRatioWithGrok(): Promise<number> {
  const value = await fetchMarketDataWithGrok(
    "CBOE equity put/call ratio",
    "Current put-to-call ratio for all equity options"
  )
  return value || 0.95 // Fallback to baseline
}

export async function fetchBuffettIndicatorWithGrok(): Promise<number> {
  const value = await fetchMarketDataWithGrok(
    "Buffett Indicator (Wilshire 5000 total market cap divided by US GDP)",
    "Current market cap to GDP ratio as percentage"
  )
  return value || 180 // Fallback to baseline
}

export async function fetchAAIIBullishWithGrok(): Promise<number> {
  const value = await fetchMarketDataWithGrok(
    "AAII Investor Sentiment Survey bullish percentage",
    "Current percentage of AAII members who are bullish"
  )
  return value || 35 // Fallback to baseline
}

export async function fetchFearGreedIndexWithGrok(): Promise<number> {
  const value = await fetchMarketDataWithGrok(
    "CNN Fear & Greed Index",
    "Current value from 0 (extreme fear) to 100 (extreme greed)"
  )
  return value || 50 // Fallback to baseline
}

export async function fetchSPXPEWithGrok(): Promise<number> {
  const value = await fetchMarketDataWithGrok(
    "S&P 500 forward price-to-earnings ratio",
    "Current forward P/E for S&P 500 index"
  )
  return value || 22.5 // Fallback to baseline
}

export async function fetchSPXPSWithGrok(): Promise<number> {
  const value = await fetchMarketDataWithGrok(
    "S&P 500 price-to-sales ratio",
    "Current price-to-sales for S&P 500 index"
  )
  return value || 2.8 // Fallback to baseline
}

export async function fetchVIXWithGrok(): Promise<number> {
  const value = await fetchMarketDataWithGrok(
    "CBOE Volatility Index (VIX)",
    "Current VIX spot price"
  )
  return value || 18 // Fallback to baseline
}

export async function fetchNVIDAPriceWithGrok(): Promise<number> {
  const value = await fetchMarketDataWithGrok(
    "NVIDIA (NVDA) stock price",
    "Current stock price for NVIDIA Corporation"
  )
  return value || 800 // Fallback to baseline
}

export async function fetchSOXIndexWithGrok(): Promise<number> {
  const value = await fetchMarketDataWithGrok(
    "PHLX Semiconductor Sector Index (SOX)",
    "Current SOX index value"
  )
  return value || 5000 // Fallback to baseline
}
