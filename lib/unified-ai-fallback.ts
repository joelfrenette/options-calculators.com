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
  fetchYieldCurveWithOpenAI
} from './openai-market-data'

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
  fetchYieldCurveWithAnthropic
} from './anthropic-market-data'

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
  fetchYieldCurveWithGroqLLM
} from './groq-llm-market-data'

import {
  fetchShillerCAPEWithGrok,
  fetchShortInterestWithGrok,
  fetchMag7ConcentrationWithGrok,
  fetchQQQPEWithGrok
} from './grok-market-data'

import { fetchMarketDataWithGrok } from './grok-market-data'

/**
 * Unified AI Fallback System
 * Hierarchy: OpenAI GPT-4o → Anthropic Claude → Groq Llama → Grok xAI → Baseline Value
 * 
 * This ensures CCPI never uses stale baseline data without attempting
 * to fetch live data from FOUR independent AI models first.
 */

export async function fetchWithAIFallback(
  indicatorName: string,
  openaiFunc: () => Promise<number | null>,
  anthropicFunc: () => Promise<number | null>,
  groqLLMFunc: () => Promise<number | null>,
  grokFunc: () => Promise<number | null>,
  baselineValue: number
): Promise<{ value: number; source: 'openai' | 'anthropic' | 'groq' | 'grok' | 'baseline' }> {
  console.log(`[v0] AI Fallback: Fetching ${indicatorName}...`)
  
  // Try OpenAI GPT-4o first
  try {
    const openaiValue = await openaiFunc()
    if (openaiValue !== null && !isNaN(openaiValue) && openaiValue > 0) {
      console.log(`[v0] ✓ ${indicatorName}: Using OpenAI GPT-4o (${openaiValue})`)
      return { value: openaiValue, source: 'openai' }
    }
  } catch (error) {
    // Silently continue to next fallback
  }
  
  // Fallback to Anthropic Claude
  try {
    const anthropicValue = await anthropicFunc()
    if (anthropicValue !== null && !isNaN(anthropicValue) && anthropicValue > 0) {
      console.log(`[v0] ⚠ ${indicatorName}: Falling back to Anthropic Claude (${anthropicValue})`)
      return { value: anthropicValue, source: 'anthropic' }
    }
  } catch (error) {
    // Silently continue to next fallback
  }
  
  // Fallback to Groq Llama
  try {
    const groqValue = await groqLLMFunc()
    if (groqValue !== null && !isNaN(groqValue) && groqValue > 0) {
      console.log(`[v0] ⚠ ${indicatorName}: Falling back to Groq Llama (${groqValue})`)
      return { value: groqValue, source: 'groq' }
    }
  } catch (error) {
    // Silently continue to next fallback
  }
  
  // Fallback to Grok xAI
  try {
    const grokValue = await grokFunc()
    if (grokValue !== null && !isNaN(grokValue) && grokValue > 0) {
      console.log(`[v0] ⚠ ${indicatorName}: Falling back to Grok xAI (${grokValue})`)
      return { value: grokValue, source: 'grok' }
    }
  } catch (error) {
    console.warn(`[v0] All AI providers failed for ${indicatorName}`)
  }
  
  // Last resort: baseline value
  console.warn(`[v0] ❌ ${indicatorName}: Using baseline value (${baselineValue})`)
  return { value: baselineValue, source: 'baseline' }
}

// Specific indicator functions with full AI fallback chain

export async function getShillerCAPE(): Promise<{ value: number; source: 'openai' | 'anthropic' | 'groq' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'Shiller CAPE',
    fetchShillerCAPEWithOpenAI,
    fetchShillerCAPEWithAnthropic,
    fetchShillerCAPEWithGroqLLM,
    fetchShillerCAPEWithGrok,
    30
  )
}

export async function getShortInterest(): Promise<{ value: number; source: 'openai' | 'anthropic' | 'groq' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'Short Interest',
    fetchShortInterestWithOpenAI,
    fetchShortInterestWithAnthropic,
    fetchShortInterestWithGroqLLM,
    fetchShortInterestWithGrok,
    1.8
  )
}

export async function getMag7Concentration(): Promise<{ value: number; source: 'openai' | 'anthropic' | 'groq' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'Mag7 Concentration',
    fetchMag7ConcentrationWithOpenAI,
    fetchMag7ConcentrationWithAnthropic,
    fetchMag7ConcentrationWithGroqLLM,
    fetchMag7ConcentrationWithGrok,
    55
  )
}

export async function getQQQPE(): Promise<{ value: number; source: 'openai' | 'anthropic' | 'groq' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'QQQ P/E',
    fetchQQQPEWithOpenAI,
    fetchQQQPEWithAnthropic,
    fetchQQQPEWithGroqLLM,
    fetchQQQPEWithGrok,
    32
  )
}

export async function getBuffettIndicator(): Promise<{ value: number; source: 'openai' | 'anthropic' | 'groq' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'Buffett Indicator',
    fetchBuffettIndicatorWithOpenAI,
    fetchBuffettIndicatorWithAnthropic,
    fetchBuffettIndicatorWithGroqLLM,
    async () => await fetchMarketDataWithGrok("Buffett Indicator (Market Cap to GDP ratio)", "Current percentage"),
    180
  )
}

export async function getPutCallRatio(): Promise<{ value: number; source: 'openai' | 'anthropic' | 'groq' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'Put/Call Ratio',
    fetchPutCallRatioWithOpenAI,
    fetchPutCallRatioWithAnthropic,
    fetchPutCallRatioWithGroqLLM,
    async () => await fetchMarketDataWithGrok("CBOE Put/Call Ratio", "Current equity put/call ratio"),
    0.95
  )
}

export async function getAAIIBullish(): Promise<{ value: number; source: 'openai' | 'anthropic' | 'groq' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'AAII Bullish %',
    fetchAAIIBullishWithOpenAI,
    fetchAAIIBullishWithAnthropic,
    fetchAAIIBullishWithGroqLLM,
    async () => await fetchMarketDataWithGrok("AAII Bullish Sentiment Percentage", "Current bullish investor percentage"),
    35
  )
}

export async function getVIX(): Promise<{ value: number; source: 'openai' | 'anthropic' | 'groq' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'VIX',
    fetchVIXWithOpenAI,
    fetchVIXWithAnthropic,
    fetchVIXWithGroqLLM,
    async () => await fetchMarketDataWithGrok("CBOE Volatility Index (VIX)", "Current VIX level"),
    18
  )
}

export async function getNVIDIAPrice(): Promise<{ value: number; source: 'openai' | 'anthropic' | 'groq' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'NVIDIA Price',
    fetchNVIDIAPriceWithOpenAI,
    fetchNVIDIAPriceWithAnthropic,
    fetchNVIDIAPriceWithGroqLLM,
    async () => await fetchMarketDataWithGrok("NVIDIA (NVDA) stock price", "Current NVDA price in USD"),
    800
  )
}

export async function getSOXIndex(): Promise<{ value: number; source: 'openai' | 'anthropic' | 'groq' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'SOX Index',
    fetchSOXIndexWithOpenAI,
    fetchSOXIndexWithAnthropic,
    fetchSOXIndexWithGroqLLM,
    async () => await fetchMarketDataWithGrok("PHLX Semiconductor Index (SOX)", "Current SOX index level"),
    5000
  )
}

export async function getISMPMI(): Promise<{ value: number; source: 'openai' | 'anthropic' | 'groq' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'ISM PMI',
    fetchISMPMIWithOpenAI,
    fetchISMPMIWithAnthropic,
    fetchISMPMIWithGroqLLM,
    async () => await fetchMarketDataWithGrok("ISM Manufacturing PMI", "Current ISM PMI value"),
    48
  )
}

export async function getSPXPE(): Promise<{ value: number; source: 'openai' | 'anthropic' | 'groq' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'S&P 500 P/E',
    fetchSPXPEWithOpenAI,
    fetchSPXPEWithAnthropic,
    fetchSPXPEWithGroqLLM,
    async () => await fetchMarketDataWithGrok("S&P 500 Forward P/E", "Current S&P 500 forward P/E ratio"),
    22.5
  )
}

export async function getFearGreed(): Promise<{ value: number; source: 'openai' | 'anthropic' | 'groq' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'Fear & Greed Index',
    fetchFearGreedWithOpenAI,
    fetchFearGreedWithAnthropic,
    fetchFearGreedWithGroqLLM,
    async () => await fetchMarketDataWithGrok("CNN Fear & Greed Index", "Current index value (0-100)"),
    50
  )
}

export async function getYieldCurve(): Promise<{ value: number; source: 'openai' | 'anthropic' | 'groq' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'Yield Curve (10Y-2Y)',
    fetchYieldCurveWithOpenAI,
    fetchYieldCurveWithAnthropic,
    fetchYieldCurveWithGroqLLM,
    async () => await fetchMarketDataWithGrok("10-Year minus 2-Year Treasury Spread", "Current spread in percentage"),
    0.25
  )
}
