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

/**
 * The chain's result. `value` is null when no provider produced a plausible
 * reading — there is no baseline constant any more (P6-34). Callers must tier
 * `"unavailable"` as `baseline`, which excludes it from scoring and suppresses
 * it from the canaries; the alternative, substituting a number, is the defect
 * this audit spent a fortnight removing from everywhere else.
 */
export interface AIFallbackResult {
  value: number | null
  source: AiSource | "unavailable"
}

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

async function fetchWithAIFallback(
  indicatorName: string,
  grokFunc: () => Promise<number | null>,
  groqLLMFunc: () => Promise<number | null>,
  anthropicFunc: () => Promise<number | null>,
  openaiFunc: () => Promise<number | null>,
  range: PlausibleRange,
): Promise<AIFallbackResult> {
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

  // Last resort used to be a hardcoded baseline. It is now nothing (P6-34).
  // A constant standing in for a market reading is the defect this whole audit
  // has been chasing: it scored, it fired canaries, and it was indistinguishable
  // from data downstream. `null` with source "unavailable" tiers as baseline,
  // which is excluded from scoring and suppressed from canaries.
  console.warn(`[v0] ❌ ${indicatorName}: no source produced a value — reporting unavailable`)
  return { value: null, source: "unavailable" }
}

export async function getBuffettIndicator(): Promise<AIFallbackResult> {
  return fetchWithAIFallback(
    "Buffett Indicator",
    async () => await fetchMarketDataWithGrok("Buffett Indicator (Market Cap to GDP ratio)", "Current percentage"),
    fetchBuffettIndicatorWithGroqLLM,
    fetchBuffettIndicatorWithAnthropic,
    fetchBuffettIndicatorWithOpenAI,
    { min: 50, max: 300 },
  )
}

export async function getPutCallRatio(): Promise<AIFallbackResult> {
  return fetchWithAIFallback(
    "Put/Call Ratio",
    async () => await fetchMarketDataWithGrok("CBOE Put/Call Ratio", "Current equity put/call ratio"),
    fetchPutCallRatioWithGroqLLM,
    fetchPutCallRatioWithAnthropic,
    fetchPutCallRatioWithOpenAI,
    { min: 0.3, max: 2.5 },
  )
}

export async function getAAIIBullish(): Promise<AIFallbackResult> {
  return fetchWithAIFallback(
    "AAII Bullish %",
    async () =>
      await fetchMarketDataWithGrok("AAII Bullish Sentiment Percentage", "Current bullish investor percentage"),
    fetchAAIIBullishWithGroqLLM,
    fetchAAIIBullishWithAnthropic,
    fetchAAIIBullishWithOpenAI,
    { min: 5, max: 80 },
  )
}

export async function getVIX(): Promise<AIFallbackResult> {
  return fetchWithAIFallback(
    "VIX",
    async () => await fetchMarketDataWithGrok("CBOE Volatility Index (VIX)", "Current VIX level"),
    fetchVIXWithGroqLLM,
    fetchVIXWithAnthropic,
    fetchVIXWithOpenAI,
    { min: 5, max: 100 },
  )
}

export async function getNVIDIAPrice(): Promise<AIFallbackResult> {
  return fetchWithAIFallback(
    "NVIDIA Price",
    async () => await fetchMarketDataWithGrok("NVIDIA (NVDA) stock price", "Current NVDA price in USD"),
    fetchNVIDIAPriceWithGroqLLM,
    fetchNVIDIAPriceWithAnthropic,
    fetchNVIDIAPriceWithOpenAI,
    { min: 10, max: 5000 },
  )
}

export async function getSOXIndex(): Promise<AIFallbackResult> {
  return fetchWithAIFallback(
    "SOX Index",
    async () => await fetchMarketDataWithGrok("PHLX Semiconductor Index (SOX)", "Current SOX index level"),
    fetchSOXIndexWithGroqLLM,
    fetchSOXIndexWithAnthropic,
    fetchSOXIndexWithOpenAI,
    { min: 1000, max: 20000 },
  )
}

/**
 * REMOVED 2026-08-14 (P7-89): getShillerCAPE, getShortInterest,
 * getMag7Concentration, getQQQPE and getISMPMI — their indicators were dropped
 * from the weights (LLM-only, never scored), so recalling them burned five
 * model calls per uncached load for numbers nothing consumed. Their
 * per-provider fetchers go with them.
 *
 * REMOVED 2026-08-10 (P6-34): getSPXPE, getFearGreed and getYieldCurve.
 *
 * All three were exported and never called, and all three asked an LLM for a
 * figure the site already sources properly — S&P forward P/E from FMP/Apify,
 * the Fear & Greed index from CNN, and the 10Y-2Y spread from FRED DGS10/DGS2
 * through lib/yield-curve.ts, which owns that sign convention (P6-21). Their
 * baselines were 22.5, 50 and 0.25: on the Fear & Greed scale 50 is a real
 * NEUTRAL reading, which is the P6-18 defect sitting in a function nobody ran.
 * Dead code that would have been wrong the moment someone called it.
 */
