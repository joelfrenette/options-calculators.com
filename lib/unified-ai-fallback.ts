import {
  fetchShillerCAPEWithOpenAI,
  fetchShortInterestWithOpenAI,
  fetchMag7ConcentrationWithOpenAI,
  fetchQQQPEWithOpenAI,
  fetchBuffettIndicatorWithOpenAI,
  fetchPutCallRatioWithOpenAI,
  fetchAAIIBullishWithOpenAI,
  fetchVIXWithOpenAI,
  fetchNVIDIAPriceWithOpenAI,
  fetchSOXIndexWithOpenAI,
  fetchISMPMIWithOpenAI,
  fetchSPXPEWithOpenAI,
  fetchFearGreedWithOpenAI,
  fetchYieldCurveWithOpenAI,
} from "./openai-market-data"

import {
  fetchShillerCAPEWithAnthropic,
  fetchShortInterestWithAnthropic,
  fetchMag7ConcentrationWithAnthropic,
  fetchQQQPEWithAnthropic,
  fetchBuffettIndicatorWithAnthropic,
  fetchPutCallRatioWithAnthropic,
  fetchAAIIBullishWithAnthropic,
  fetchVIXWithAnthropic,
  fetchNVIDIAPriceWithAnthropic,
  fetchSOXIndexWithAnthropic,
  fetchISMPMIWithAnthropic,
  fetchSPXPEWithAnthropic,
  fetchFearGreedWithAnthropic,
  fetchYieldCurveWithAnthropic,
} from "./anthropic-market-data"

import {
  fetchShillerCAPEWithGroqLLM,
  fetchShortInterestWithGroqLLM,
  fetchMag7ConcentrationWithGroqLLM,
  fetchQQQPEWithGroqLLM,
  fetchBuffettIndicatorWithGroqLLM,
  fetchPutCallRatioWithGroqLLM,
  fetchAAIIBullishWithGroqLLM,
  fetchVIXWithGroqLLM,
  fetchNVIDIAPriceWithGroqLLM,
  fetchSOXIndexWithGroqLLM,
  fetchISMPMIWithGroqLLM,
  fetchSPXPEWithGroqLLM,
  fetchFearGreedWithGroqLLM,
  fetchYieldCurveWithGroqLLM,
} from "./groq-llm-market-data"

import { fetchMarketDataWithGrok } from "./grok-market-data"

/**
 * Unified AI Fallback System - OPTIMIZED FOR SPEED
 * Hierarchy: Grok xAI (FASTEST) → Groq Llama (FAST) → Anthropic Claude → OpenAI GPT-4o → Baseline
 *
 * Prioritizes speed while maintaining accuracy with multiple fallbacks.
 */

export async function fetchWithAIFallback(
  indicatorName: string,
  grokFunc: () => Promise<number | null>,
  groqLLMFunc: () => Promise<number | null>,
  anthropicFunc: () => Promise<number | null>,
  openaiFunc: () => Promise<number | null>,
  baselineValue: number,
): Promise<{ value: number; source: "grok" | "groq" | "anthropic" | "openai" | "baseline" }> {
  console.log(`[v0] AI Fallback: Fetching ${indicatorName}...`)

  try {
    const grokValue = await grokFunc()
    if (grokValue !== null && !isNaN(grokValue) && grokValue > 0) {
      console.log(`[v0] ✓ ${indicatorName}: Using Grok xAI (${grokValue})`)
      return { value: grokValue, source: "grok" }
    }
  } catch (error) {
    // Silently continue to next fallback
  }

  try {
    const groqLLMValue = await groqLLMFunc()
    if (groqLLMValue !== null && !isNaN(groqLLMValue) && groqLLMValue > 0) {
      console.log(`[v0] ⚠ ${indicatorName}: Falling back to Groq Llama (${groqLLMValue})`)
      return { value: groqLLMValue, source: "groq" }
    }
  } catch (error) {
    // Silently continue to next fallback
  }

  // Fallback to Anthropic Claude (SLOWER - typically 5-8 seconds)
  try {
    const anthropicValue = await anthropicFunc()
    if (anthropicValue !== null && !isNaN(anthropicValue) && anthropicValue > 0) {
      console.log(`[v0] ⚠ ${indicatorName}: Falling back to Anthropic Claude (${anthropicValue})`)
      return { value: anthropicValue, source: "anthropic" }
    }
  } catch (error) {
    // Silently continue to next fallback
  }

  // Fallback to OpenAI GPT-4o (SLOWEST - typically 10-15 seconds)
  try {
    const openaiValue = await openaiFunc()
    if (openaiValue !== null && !isNaN(openaiValue) && openaiValue > 0) {
      console.log(`[v0] ⚠ ${indicatorName}: Falling back to OpenAI GPT-4o (${openaiValue})`)
      return { value: openaiValue, source: "openai" }
    }
  } catch (error) {
    console.warn(`[v0] All AI providers failed for ${indicatorName}`)
  }

  // Last resort: baseline value
  console.warn(`[v0] ❌ ${indicatorName}: Using baseline value (${baselineValue})`)
  return { value: baselineValue, source: "baseline" }
}

export async function getShillerCAPE(): Promise<{
  value: number
  source: "grok" | "groq" | "anthropic" | "openai" | "baseline"
}> {
  return fetchWithAIFallback(
    "Shiller CAPE",
    async () => await fetchMarketDataWithGrok("Shiller CAPE", "Current CAPE ratio"),
    fetchShillerCAPEWithGroqLLM,
    fetchShillerCAPEWithAnthropic,
    fetchShillerCAPEWithOpenAI,
    30,
  )
}

export async function getShortInterest(): Promise<{
  value: number
  source: "grok" | "groq" | "anthropic" | "openai" | "baseline"
}> {
  return fetchWithAIFallback(
    "Short Interest",
    async () => await fetchMarketDataWithGrok("Short Interest", "Current short interest level"),
    fetchShortInterestWithGroqLLM,
    fetchShortInterestWithAnthropic,
    fetchShortInterestWithOpenAI,
    1.8,
  )
}

export async function getMag7Concentration(): Promise<{
  value: number
  source: "grok" | "groq" | "anthropic" | "openai" | "baseline"
}> {
  return fetchWithAIFallback(
    "Mag7 Concentration",
    async () => await fetchMarketDataWithGrok("Mag7 Concentration", "Current concentration level"),
    fetchMag7ConcentrationWithGroqLLM,
    fetchMag7ConcentrationWithAnthropic,
    fetchMag7ConcentrationWithOpenAI,
    55,
  )
}

export async function getQQQPE(): Promise<{
  value: number
  source: "grok" | "groq" | "anthropic" | "openai" | "baseline"
}> {
  return fetchWithAIFallback(
    "QQQ P/E",
    async () => await fetchMarketDataWithGrok("QQQ P/E", "Current QQQ P/E ratio"),
    fetchQQQPEWithGroqLLM,
    fetchQQQPEWithAnthropic,
    fetchQQQPEWithOpenAI,
    32,
  )
}

export async function getBuffettIndicator(): Promise<{
  value: number
  source: "grok" | "groq" | "anthropic" | "openai" | "baseline"
}> {
  return fetchWithAIFallback(
    "Buffett Indicator",
    async () => await fetchMarketDataWithGrok("Buffett Indicator (Market Cap to GDP ratio)", "Current percentage"),
    fetchBuffettIndicatorWithGroqLLM,
    fetchBuffettIndicatorWithAnthropic,
    fetchBuffettIndicatorWithOpenAI,
    180,
  )
}

export async function getPutCallRatio(): Promise<{
  value: number
  source: "grok" | "groq" | "anthropic" | "openai" | "baseline"
}> {
  return fetchWithAIFallback(
    "Put/Call Ratio",
    async () => await fetchMarketDataWithGrok("CBOE Put/Call Ratio", "Current equity put/call ratio"),
    fetchPutCallRatioWithGroqLLM,
    fetchPutCallRatioWithAnthropic,
    fetchPutCallRatioWithOpenAI,
    0.95,
  )
}

export async function getAAIIBullish(): Promise<{
  value: number
  source: "grok" | "groq" | "anthropic" | "openai" | "baseline"
}> {
  return fetchWithAIFallback(
    "AAII Bullish %",
    async () =>
      await fetchMarketDataWithGrok("AAII Bullish Sentiment Percentage", "Current bullish investor percentage"),
    fetchAAIIBullishWithGroqLLM,
    fetchAAIIBullishWithAnthropic,
    fetchAAIIBullishWithOpenAI,
    35,
  )
}

export async function getVIX(): Promise<{
  value: number
  source: "grok" | "groq" | "anthropic" | "openai" | "baseline"
}> {
  return fetchWithAIFallback(
    "VIX",
    async () => await fetchMarketDataWithGrok("CBOE Volatility Index (VIX)", "Current VIX level"),
    fetchVIXWithGroqLLM,
    fetchVIXWithAnthropic,
    fetchVIXWithOpenAI,
    18,
  )
}

export async function getNVIDIAPrice(): Promise<{
  value: number
  source: "grok" | "groq" | "anthropic" | "openai" | "baseline"
}> {
  return fetchWithAIFallback(
    "NVIDIA Price",
    async () => await fetchMarketDataWithGrok("NVIDIA (NVDA) stock price", "Current NVDA price in USD"),
    fetchNVIDIAPriceWithGroqLLM,
    fetchNVIDIAPriceWithAnthropic,
    fetchNVIDIAPriceWithOpenAI,
    800,
  )
}

export async function getSOXIndex(): Promise<{
  value: number
  source: "grok" | "groq" | "anthropic" | "openai" | "baseline"
}> {
  return fetchWithAIFallback(
    "SOX Index",
    async () => await fetchMarketDataWithGrok("PHLX Semiconductor Index (SOX)", "Current SOX index level"),
    fetchSOXIndexWithGroqLLM,
    fetchSOXIndexWithAnthropic,
    fetchSOXIndexWithOpenAI,
    5000,
  )
}

export async function getISMPMI(): Promise<{
  value: number
  source: "grok" | "groq" | "anthropic" | "openai" | "baseline"
}> {
  return fetchWithAIFallback(
    "ISM PMI",
    async () => await fetchMarketDataWithGrok("ISM Manufacturing PMI", "Current ISM PMI value"),
    fetchISMPMIWithGroqLLM,
    fetchISMPMIWithAnthropic,
    fetchISMPMIWithOpenAI,
    48,
  )
}

export async function getSPXPE(): Promise<{
  value: number
  source: "grok" | "groq" | "anthropic" | "openai" | "baseline"
}> {
  return fetchWithAIFallback(
    "S&P 500 P/E",
    async () => await fetchMarketDataWithGrok("S&P 500 Forward P/E", "Current S&P 500 forward P/E ratio"),
    fetchSPXPEWithGroqLLM,
    fetchSPXPEWithAnthropic,
    fetchSPXPEWithOpenAI,
    22.5,
  )
}

export async function getFearGreed(): Promise<{
  value: number
  source: "grok" | "groq" | "anthropic" | "openai" | "baseline"
}> {
  return fetchWithAIFallback(
    "Fear & Greed Index",
    async () => await fetchMarketDataWithGrok("CNN Fear & Greed Index", "Current index value (0-100)"),
    fetchFearGreedWithGroqLLM,
    fetchFearGreedWithAnthropic,
    fetchFearGreedWithOpenAI,
    50,
  )
}

export async function getYieldCurve(): Promise<{
  value: number
  source: "grok" | "groq" | "anthropic" | "openai" | "baseline"
}> {
  return fetchWithAIFallback(
    "Yield Curve (10Y-2Y)",
    async () => await fetchMarketDataWithGrok("10-Year minus 2-Year Treasury Spread", "Current spread in percentage"),
    fetchYieldCurveWithGroqLLM,
    fetchYieldCurveWithAnthropic,
    fetchYieldCurveWithOpenAI,
    0.25,
  )
}
