// Secure API key resolution utilities.
// Keys are read from environment variables only (Edge-runtime safe).
//
// Several services have historically been referenced under more than one
// env-var spelling. To stop features from silently failing when only one
// spelling is set, every key is resolved through its full alias list.

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-32-char-encryption-key!" // 32 chars

// Canonical key name -> all accepted env-var spellings (checked in order).
export const API_KEY_ALIASES: Record<string, string[]> = {
  // Market & economic data
  POLYGON_API_KEY: ["POLYGON_API_KEY"],
  FRED_API_KEY: ["FRED_API_KEY"],
  TWELVE_DATA_API_KEY: ["TWELVE_DATA_API_KEY", "TWELVEDATA_API_KEY"],
  FMP_API_KEY: ["FMP_API_KEY"],
  ALPHA_VANTAGE_API_KEY: ["ALPHA_VANTAGE_API_KEY"],
  FINNHUB_API_KEY: ["FINNHUB_API_KEY"],
  APIFY_API_TOKEN: ["APIFY_API_TOKEN", "APIFY_API_KEY"],
  // Scraping & search
  SCRAPINGBEE_API_KEY: ["SCRAPINGBEE_API_KEY"],
  SERPER_API_KEY: ["SERPER_API_KEY"],
  SERPAPI_KEY: ["SERPAPI_KEY"],
  // Email
  RESEND_API_KEY: ["RESEND_API_KEY"],
  // AI / LLM providers
  OPENAI_API_KEY: ["OPENAI_API_KEY"],
  ANTHROPIC_API_KEY: ["ANTHROPIC_API_KEY"],
  GROQ_API_KEY: ["GROQ_API_KEY"],
  XAI_API_KEY: ["XAI_API_KEY", "GROK_XAI_API_KEY"],
  GOOGLE_AI_API_KEY: ["GOOGLE_AI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
  OPENROUTER_API_KEY: ["OPENROUTER_API_KEY"],
  PERPLEXITY_API_KEY: ["PERPLEXITY_API_KEY"],
}

export type ApiKeyName = keyof typeof API_KEY_ALIASES

// Backwards-compatible interface (kept for existing imports).
export interface ApiKeyConfig {
  POLYGON_API_KEY?: string
  TWELVE_DATA_API_KEY?: string
  TWELVEDATA_API_KEY?: string
  FMP_API_KEY?: string
  FRED_API_KEY?: string
  APIFY_API_TOKEN?: string
  RESEND_API_KEY?: string
  SERPER_API_KEY?: string
}

// Resolve a key by canonical name, falling back through every known alias.
export function resolveApiKey(name: string): string {
  const aliases = API_KEY_ALIASES[name] ?? [name]
  for (const alias of aliases) {
    const value = process.env[alias]
    if (value) return value
  }
  return ""
}

// Simple getter (alias-aware). Returns "" and warns if not configured.
export function getApiKey(keyName: string): string {
  const value = resolveApiKey(keyName)
  if (!value) {
    console.warn(`[API Keys] ${keyName} not found in environment variables`)
  }
  return value
}

// Is a given service configured (any alias present)?
export function isKeyConfigured(name: string): boolean {
  return resolveApiKey(name).length > 0
}

// For the admin UI - presence map across every service the app uses.
export function getConfiguredKeys(): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const name of Object.keys(API_KEY_ALIASES)) {
    result[name] = isKeyConfigured(name)
  }
  return result
}
