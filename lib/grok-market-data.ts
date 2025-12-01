import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"

// Use environment variables directly - priority: Groq > OpenAI > xAI
function getAIProvider() {
  // For market data, prefer xAI/Grok as it's trained on real-time data
  if (process.env.XAI_API_KEY) {
    return {
      provider: createOpenAI({
        apiKey: process.env.XAI_API_KEY,
        baseURL: "https://api.x.ai/v1",
      }),
      model: "grok-2-latest",
      name: "xAI",
    }
  }
  if (process.env.GROQ_API_KEY) {
    return {
      provider: createOpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
      }),
      model: "llama-3.3-70b-versatile",
      name: "Groq",
    }
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      }),
      model: "gpt-4o-mini",
      name: "OpenAI",
    }
  }
  return null
}

export async function fetchMarketDataWithGrok(indicatorName: string, context?: string): Promise<number | null> {
  try {
    const ai = getAIProvider()
    if (!ai) {
      console.log(`[AI] No provider available for market data fetch`)
      return null
    }

    console.log(`[AI] ${ai.name}: Fetching ${indicatorName}...`)

    const prompt = `You are a financial data assistant. Provide ONLY the current numeric value for the following market indicator. Do not include any explanation, just the number.

Indicator: ${indicatorName}
${context ? `Context: ${context}` : ""}

Examples:
- "Shiller CAPE ratio" → "32.5"
- "S&P 500 Forward P/E" → "22.3"
- "SPY short interest ratio" → "1.8"

Respond with ONLY the number, nothing else.`

    let text = ""
    try {
      const { text: responseText } = await generateText({
        model: ai.provider(ai.model),
        prompt,
        maxTokens: 50,
        temperature: 0.1,
      })
      text = responseText
    } catch (sdkError) {
      const errorMsg = sdkError instanceof Error ? sdkError.message : String(sdkError)
      console.log(`[AI] ${ai.name}: SDK error occurred: ${errorMsg.substring(0, 100)}`)
      return null
    }

    const value = Number.parseFloat(text.trim())

    if (isNaN(value)) {
      console.error(`[AI] ${ai.name}: Could not parse value from response: "${text}"`)
      return null
    }

    console.log(`[AI] ${ai.name}: Successfully fetched ${indicatorName} = ${value}`)
    return value
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[AI] Error fetching ${indicatorName}:`, errorMsg)
    return null
  }
}

// Specific helper functions for common indicators
export async function fetchShillerCAPEWithGrok(): Promise<number> {
  const value = await fetchMarketDataWithGrok(
    "Shiller CAPE ratio (cyclically adjusted price-to-earnings ratio for S&P 500)",
    "Current value as of today",
  )
  return value || 30 // Fallback to baseline if AI fails
}

export async function fetchShortInterestWithGrok(): Promise<number> {
  const value = await fetchMarketDataWithGrok(
    "SPY ETF short interest ratio as percentage of float",
    "Current short interest percentage",
  )
  return value || 1.2 // Fallback to baseline if AI fails
}

export async function fetchMag7ConcentrationWithGrok(): Promise<number> {
  const value = await fetchMarketDataWithGrok(
    "Magnificent 7 stocks (AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META) market cap as percentage of QQQ ETF",
    "Current concentration percentage",
  )
  return value || 55 // Fallback to baseline if AI fails
}

export async function fetchQQQPEWithGrok(): Promise<number> {
  const value = await fetchMarketDataWithGrok(
    "QQQ ETF forward price-to-earnings ratio",
    "Current forward P/E for Invesco QQQ Trust",
  )
  return value || 32 // Fallback to baseline if AI fails
}
