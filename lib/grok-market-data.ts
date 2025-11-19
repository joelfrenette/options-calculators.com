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

    let text = ''
    try {
      const { text: responseText } = await generateText({
        model: xai('grok-2-latest'),
        prompt,
        maxTokens: 50,
        temperature: 0.1
      })
      text = responseText
    } catch (sdkError) {
      // SDK may throw errors but still return data - try to extract from error message
      const errorMsg = sdkError instanceof Error ? sdkError.message : String(sdkError)
      console.log(`[v0] Grok: SDK error occurred (continuing anyway): ${errorMsg.substring(0, 100)}`)
      
      // If the error is just about JSON parsing but we got the text, ignore it
      if (errorMsg.includes('JSON') || errorMsg.includes('json')) {
        // This is likely a false alarm from the SDK - the text might still be in the response
        throw sdkError // Re-throw to be caught by outer catch
      }
      
      return null
    }
    
    const value = parseFloat(text.trim())
    
    if (isNaN(value)) {
      console.error(`[v0] Grok: Could not parse value from response: "${text}"`)
      return null
    }
    
    console.log(`[v0] Grok: Successfully fetched ${indicatorName} = ${value}`)
    return value
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    if (!errorMsg.includes('JSON') && !errorMsg.includes('json')) {
      console.error(`[v0] Grok: Error fetching ${indicatorName}:`, errorMsg)
    }
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
