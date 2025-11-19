import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY || 'gen-lang-client-0100065741'
})

// All functions now return null immediately without making API calls
// Uncomment the actual implementation below once Gemini quota is restored

export async function fetchMarketDataWithGemini(indicatorName: string, context?: string): Promise<number | null> {
  // DISABLED: Return null immediately to skip Gemini and use Grok fallback
  return null
  
  /* DISABLED CODE - Uncomment when Gemini quota is restored
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
  */
}

// Specific helper functions for ALL CCPI indicators
export async function fetchShillerCAPEWithGemini(): Promise<number | null> {
  return null // DISABLED: await fetchMarketDataWithGemini(...)
}

export async function fetchShortInterestWithGemini(): Promise<number | null> {
  return null // DISABLED
}

export async function fetchMag7ConcentrationWithGemini(): Promise<number | null> {
  return null // DISABLED
}

export async function fetchQQQPEWithGemini(): Promise<number | null> {
  return null // DISABLED
}

export async function fetchBuffettIndicatorWithGemini(): Promise<number | null> {
  return null // DISABLED
}

export async function fetchPutCallRatioWithGemini(): Promise<number | null> {
  return null // DISABLED
}

export async function fetchAAIIBullishWithGemini(): Promise<number | null> {
  return null // DISABLED
}

export async function fetchVIXWithGemini(): Promise<number | null> {
  return null // DISABLED
}

export async function fetchNVIDIAPriceWithGemini(): Promise<number | null> {
  return null // DISABLED
}

export async function fetchSOXIndexWithGemini(): Promise<number | null> {
  return null // DISABLED
}

export async function fetchISMPMIWithGemini(): Promise<number | null> {
  return null // DISABLED
}

export async function fetchSPXPEWithGemini(): Promise<number | null> {
  return null // DISABLED
}

export async function fetchFearGreedWithGemini(): Promise<number | null> {
  return null // DISABLED
}

export async function fetchYieldCurveWithGemini(): Promise<number | null> {
  return null // DISABLED
}
