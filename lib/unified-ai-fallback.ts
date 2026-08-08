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
import { getMeteringSupabaseConfig } from "./metered-fetch"

/**
 * Unified AI Fallback System - OPTIMIZED FOR SPEED
 * Hierarchy: Grok xAI (FASTEST) → Groq Llama (FAST) → Anthropic Claude → OpenAI GPT-4o → Baseline
 *
 * Prioritizes speed while maintaining accuracy with multiple fallbacks.
 */

/**
 * Per-metric plausibility window. The previous acceptance filter was `value > 0`,
 * which (a) rejected legitimately negative/zero series like the 10Y-2Y yield
 * curve, and (b) accepted wildly hallucinated positives (AUDIT P3-15). Each
 * getter now declares the range a sane value for its metric must fall in.
 */
export interface PlausibleRange {
  min: number
  max: number
}

function isPlausible(value: number | null, range: PlausibleRange): value is number {
  return value !== null && Number.isFinite(value) && value >= range.min && value <= range.max
}

// --- E-7a: Supabase TTL cache -----------------------------------------------
//
// These indicators move daily at most, but the LLM chain below used to run on
// EVERY request that needed one — the site's largest recurring AI spend. A
// fresh estimate is now written to `ai_estimates` and served for TTL hours.
//
// Honesty rules: only LIVE model answers are cached (a baseline is never
// written, so cache hits are always real estimates); the original source tag
// is preserved so tier attribution is identical fresh or cached; a failed
// cache read/write silently falls through to the live chain — the cache can
// only ever save calls, never change results.

const AI_ESTIMATE_TTL_HOURS = (() => {
  const raw = Number(process.env.AI_ESTIMATE_TTL_HOURS)
  return Number.isFinite(raw) && raw > 0 ? raw : 18
})()

type AiSource = "grok" | "groq" | "anthropic" | "openai"

async function readCachedEstimate(
  key: string,
  range: PlausibleRange,
): Promise<{ value: number; source: AiSource } | null> {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return null
  try {
    const since = new Date(Date.now() - AI_ESTIMATE_TTL_HOURS * 3600_000).toISOString()
    const res = await fetch(
      `${cfg.url}/rest/v1/ai_estimates?key=eq.${encodeURIComponent(key)}&updated_at=gte.${since}&select=value,source`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }, signal: AbortSignal.timeout(4000), cache: "no-store" },
    )
    if (!res.ok) return null
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return null
    const value = Number(rows[0].value)
    // Re-validate against the plausibility window — a range tightened since
    // the row was written must invalidate stale cache, not resurrect it.
    if (!isPlausible(value, range)) return null
    const source = rows[0].source as AiSource
    if (!["grok", "groq", "anthropic", "openai"].includes(source)) return null
    return { value, source }
  } catch {
    return null
  }
}

function writeCachedEstimate(key: string, value: number, source: AiSource): void {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return
  try {
    void fetch(`${cfg.url}/rest/v1/ai_estimates?on_conflict=key`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ key, value, source, updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(4000),
    }).catch(() => {})
  } catch {
    /* cache write is best-effort */
  }
}

export async function fetchWithAIFallback(
  indicatorName: string,
  grokFunc: () => Promise<number | null>,
  groqLLMFunc: () => Promise<number | null>,
  anthropicFunc: () => Promise<number | null>,
  openaiFunc: () => Promise<number | null>,
  range: PlausibleRange,
  baselineValue: number,
): Promise<{ value: number; source: "grok" | "groq" | "anthropic" | "openai" | "baseline" }> {
  // Cache first (E-7a): a fresh-enough live estimate serves every request in
  // the TTL window instead of re-running the LLM chain per view.
  const cached = await readCachedEstimate(indicatorName, range)
  if (cached) {
    console.log(`[v0] ✓ ${indicatorName}: cached ${cached.source} estimate (${cached.value})`)
    return cached
  }

  console.log(`[v0] AI Fallback: Fetching ${indicatorName}...`)

  try {
    const grokValue = await grokFunc()
    if (isPlausible(grokValue, range)) {
      console.log(`[v0] ✓ ${indicatorName}: Using Grok xAI (${grokValue})`)
      writeCachedEstimate(indicatorName, grokValue, "grok")
      return { value: grokValue, source: "grok" }
    }
  } catch (error) {
    // Silently continue to next fallback
  }

  try {
    const groqLLMValue = await groqLLMFunc()
    if (isPlausible(groqLLMValue, range)) {
      console.log(`[v0] ⚠ ${indicatorName}: Falling back to Groq Llama (${groqLLMValue})`)
      writeCachedEstimate(indicatorName, groqLLMValue, "groq")
      return { value: groqLLMValue, source: "groq" }
    }
  } catch (error) {
    // Silently continue to next fallback
  }

  // Fallback to Anthropic Claude (SLOWER - typically 5-8 seconds)
  try {
    const anthropicValue = await anthropicFunc()
    if (isPlausible(anthropicValue, range)) {
      console.log(`[v0] ⚠ ${indicatorName}: Falling back to Anthropic Claude (${anthropicValue})`)
      writeCachedEstimate(indicatorName, anthropicValue, "anthropic")
      return { value: anthropicValue, source: "anthropic" }
    }
  } catch (error) {
    // Silently continue to next fallback
  }

  // Fallback to OpenAI GPT-4o (SLOWEST - typically 10-15 seconds)
  try {
    const openaiValue = await openaiFunc()
    if (isPlausible(openaiValue, range)) {
      console.log(`[v0] ⚠ ${indicatorName}: Falling back to OpenAI GPT-4o (${openaiValue})`)
      writeCachedEstimate(indicatorName, openaiValue, "openai")
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
    { min: 5, max: 60 },
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
    { min: 0.2, max: 20 },
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
    { min: 20, max: 80 },
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
    { min: 10, max: 60 },
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
    { min: 50, max: 300 },
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
    { min: 0.3, max: 2.5 },
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
    { min: 5, max: 80 },
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
    { min: 5, max: 100 },
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
    { min: 10, max: 5000 },
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
    { min: 1000, max: 20000 },
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
    { min: 30, max: 70 },
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
    { min: 5, max: 50 },
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
    { min: 0, max: 100 },
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
    { min: -3, max: 3 },
    0.25,
  )
}
