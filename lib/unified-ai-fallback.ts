import { 
  fetchShillerCAPEWithGemini,
  fetchShortInterestWithGemini,
  fetchMag7ConcentrationWithGemini,
  fetchQQQPEWithGemini,
  fetchBuffettIndicatorWithGemini,
  fetchPutCallRatioWithGemini,
  fetchAAIIBullishWithGemini,
  fetchVIXWithGemini,
  fetchNVIDIAPriceWithGemini,
  fetchSOXIndexWithGemini,
  fetchISMPMIWithGemini,
  fetchSPXPEWithGemini,
  fetchFearGreedWithGemini,
  fetchYieldCurveWithGemini
} from './google-gemini-market-data'

import {
  fetchShillerCAPEWithGrok,
  fetchShortInterestWithGrok,
  fetchMag7ConcentrationWithGrok,
  fetchQQQPEWithGrok
} from './grok-market-data'

import { fetchMarketDataWithGrok } from './grok-market-data'

/**
 * Unified AI Fallback System
 * Hierarchy: Google Gemini 3 → Grok xAI → Baseline Value
 * 
 * This ensures CCPI never uses stale baseline data without attempting
 * to fetch live data from AI models first.
 */

export async function fetchWithAIFallback(
  indicatorName: string,
  geminiFunc: () => Promise<number | null>,
  grokFunc: () => Promise<number | null>,
  baselineValue: number
): Promise<{ value: number; source: 'gemini' | 'grok' | 'baseline' }> {
  console.log(`[v0] AI Fallback: Fetching ${indicatorName}...`)
  
  // Try Google Gemini first
  try {
    const geminiValue = await geminiFunc()
    if (geminiValue !== null && !isNaN(geminiValue) && geminiValue > 0) {
      console.log(`[v0] ✓ ${indicatorName}: Using Google Gemini (${geminiValue})`)
      return { value: geminiValue, source: 'gemini' }
    }
  } catch (error) {
    // No need to log here as it would be duplicate logging
  }
  
  // Fallback to Grok xAI
  try {
    const grokValue = await grokFunc()
    if (grokValue !== null && !isNaN(grokValue) && grokValue > 0) {
      console.log(`[v0] ⚠ ${indicatorName}: Falling back to Grok xAI (${grokValue})`)
      return { value: grokValue, source: 'grok' }
    }
  } catch (error) {
    console.warn(`[v0] Grok xAI failed for ${indicatorName}:`, error instanceof Error ? error.message : String(error))
  }
  
  // Last resort: baseline value
  console.warn(`[v0] ❌ ${indicatorName}: Using baseline value (${baselineValue})`)
  return { value: baselineValue, source: 'baseline' }
}

// Specific indicator functions with full AI fallback chain

export async function getShillerCAPE(): Promise<{ value: number; source: 'gemini' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'Shiller CAPE',
    fetchShillerCAPEWithGemini,
    fetchShillerCAPEWithGrok,
    30
  )
}

export async function getShortInterest(): Promise<{ value: number; source: 'gemini' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'Short Interest',
    fetchShortInterestWithGemini,
    fetchShortInterestWithGrok,
    1.8
  )
}

export async function getMag7Concentration(): Promise<{ value: number; source: 'gemini' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'Mag7 Concentration',
    fetchMag7ConcentrationWithGemini,
    fetchMag7ConcentrationWithGrok,
    55
  )
}

export async function getQQQPE(): Promise<{ value: number; source: 'gemini' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'QQQ P/E',
    fetchQQQPEWithGemini,
    fetchQQQPEWithGrok,
    32
  )
}

export async function getBuffettIndicator(): Promise<{ value: number; source: 'gemini' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'Buffett Indicator',
    fetchBuffettIndicatorWithGemini,
    async () => await fetchMarketDataWithGrok("Buffett Indicator (Market Cap to GDP ratio)", "Current percentage"),
    180
  )
}

export async function getPutCallRatio(): Promise<{ value: number; source: 'gemini' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'Put/Call Ratio',
    fetchPutCallRatioWithGemini,
    async () => await fetchMarketDataWithGrok("CBOE Put/Call Ratio", "Current equity put/call ratio"),
    0.95
  )
}

export async function getAAIIBullish(): Promise<{ value: number; source: 'gemini' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'AAII Bullish %',
    fetchAAIIBullishWithGemini,
    async () => await fetchMarketDataWithGrok("AAII Bullish Sentiment Percentage", "Current bullish investor percentage"),
    35
  )
}

export async function getVIX(): Promise<{ value: number; source: 'gemini' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'VIX',
    fetchVIXWithGemini,
    async () => await fetchMarketDataWithGrok("CBOE Volatility Index (VIX)", "Current VIX level"),
    18
  )
}

export async function getNVIDIAPrice(): Promise<{ value: number; source: 'gemini' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'NVIDIA Price',
    fetchNVIDIAPriceWithGemini,
    async () => await fetchMarketDataWithGrok("NVIDIA (NVDA) stock price", "Current NVDA price in USD"),
    800
  )
}

export async function getSOXIndex(): Promise<{ value: number; source: 'gemini' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'SOX Index',
    fetchSOXIndexWithGemini,
    async () => await fetchMarketDataWithGrok("PHLX Semiconductor Index (SOX)", "Current SOX index level"),
    5000
  )
}

export async function getISMPMI(): Promise<{ value: number; source: 'gemini' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'ISM PMI',
    fetchISMPMIWithGemini,
    async () => await fetchMarketDataWithGrok("ISM Manufacturing PMI", "Current ISM PMI value"),
    48
  )
}

export async function getSPXPE(): Promise<{ value: number; source: 'gemini' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'S&P 500 P/E',
    fetchSPXPEWithGemini,
    async () => await fetchMarketDataWithGrok("S&P 500 Forward P/E", "Current S&P 500 forward P/E ratio"),
    22.5
  )
}

export async function getFearGreed(): Promise<{ value: number; source: 'gemini' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'Fear & Greed Index',
    fetchFearGreedWithGemini,
    async () => await fetchMarketDataWithGrok("CNN Fear & Greed Index", "Current index value (0-100)"),
    50
  )
}

export async function getYieldCurve(): Promise<{ value: number; source: 'gemini' | 'grok' | 'baseline' }> {
  return fetchWithAIFallback(
    'Yield Curve (10Y-2Y)',
    fetchYieldCurveWithGemini,
    async () => await fetchMarketDataWithGrok("10-Year minus 2-Year Treasury Spread", "Current spread in percentage"),
    0.25
  )
}
