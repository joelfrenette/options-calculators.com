// Single source of truth for API cost tracking and the cost-optimization plan.
// Monthly costs are ESTIMATES based on each vendor's published 2026 pricing —
// adjust `monthlyCost` to your actual plan if it differs.

export type CostStatus = "keep-paid" | "keep-free" | "downgrade" | "eliminate"

/**
 * How a vendor actually bills, which is what decides whether it can run away.
 *
 *   flat      — fixed subscription. One more call costs $0 at the margin; going
 *               over the plan quota throttles or 429s, it does not bill more.
 *   free      — free tier, $0 marginal, rate-limited rather than billed.
 *   per-token — pay-per-use LLM. THE ONLY CATEGORY THAT CAN OVERSPEND, and so
 *               the only one the budget guard (E-5) actually needs to police.
 *   per-call  — pay-per-request with no plan ceiling.
 *
 * Nothing here is `per-call` today. If a vendor is moved to that model, give it
 * a real `perCall` price — do not leave it undefined and let the guard read the
 * spend as $0.
 */
export type BillingModel = "flat" | "free" | "per-token" | "per-call"

export interface ApiCost {
  key: string // canonical key name (matches lib/api-keys.ts)
  vendor: string
  category: "Market & Economic Data" | "Scraping & Search" | "Email" | "AI / LLM Providers"
  monthlyCost: number // current estimated USD/month
  targetCost: number // USD/month after optimization
  status: CostStatus
  billing: BillingModel
  provides: string
  replacement: string // free/cheaper alternative, or "" if none
}

export const API_COSTS: ApiCost[] = [
  // Market & economic data
  {
    key: "POLYGON_API_KEY",
    vendor: "Polygon.io",
    category: "Market & Economic Data",
    monthlyCost: 29,
    targetCost: 29,
    status: "keep-paid",
    billing: "flat",
    provides: "Live options chains, Greeks, stock quotes, OHLCV — powers the scanners",
    replacement: "No good free source for live options chains",
  },
  {
    key: "FRED_API_KEY",
    vendor: "FRED (Federal Reserve)",
    category: "Market & Economic Data",
    monthlyCost: 0,
    targetCost: 0,
    status: "keep-free",
    billing: "free",
    provides: "Fed Funds, CPI, VIX, yield curve, jobs, credit spreads",
    replacement: "Already free & unlimited",
  },
  {
    key: "TWELVE_DATA_API_KEY",
    vendor: "TwelveData",
    category: "Market & Economic Data",
    monthlyCost: 79,
    targetCost: 0,
    status: "eliminate",
    billing: "flat",
    provides: "RSI, MACD, SMA, Bollinger, OHLCV",
    replacement: "Computed locally from Polygon OHLCV (simple formulas)",
  },
  {
    key: "FMP_API_KEY",
    vendor: "Financial Modeling Prep",
    category: "Market & Economic Data",
    monthlyCost: 19,
    targetCost: 0,
    status: "downgrade",
    billing: "flat",
    provides: "Fundamentals, valuation ratios (P/E, P/S)",
    replacement: "Free tier (250 calls/day) covers scanner fundamentals",
  },
  {
    key: "ALPHA_VANTAGE_API_KEY",
    vendor: "Alpha Vantage",
    category: "Market & Economic Data",
    monthlyCost: 0,
    targetCost: 0,
    status: "eliminate",
    billing: "free",
    provides: "VIX, VXN, ATR, SMA",
    replacement: "Redundant with FRED (VIX) + local calc",
  },
  {
    key: "FINNHUB_API_KEY",
    vendor: "Finnhub",
    category: "Market & Economic Data",
    monthlyCost: 0,
    targetCost: 0,
    status: "keep-free",
    billing: "free",
    provides: "Earnings, insider transactions, news",
    replacement: "Free tier (60 calls/min) is sufficient",
  },
  {
    key: "APIFY_API_TOKEN",
    vendor: "Apify",
    category: "Market & Economic Data",
    monthlyCost: 29,
    targetCost: 0,
    status: "eliminate",
    billing: "flat",
    provides: "Yahoo Finance scraping (S&P 500 P/E, P/S)",
    replacement: "FMP free / Finnhub free / Yahoo proxy",
  },
  // Scraping & search
  {
    key: "SCRAPINGBEE_API_KEY",
    vendor: "ScrapingBee",
    category: "Scraping & Search",
    monthlyCost: 49,
    targetCost: 0,
    status: "eliminate",
    billing: "flat",
    provides: "Social/market sentiment scraping (CNN, etc.)",
    replacement: "CNN direct API + Alternative.me (sentiment is nice-to-have)",
  },
  {
    key: "SERPER_API_KEY",
    vendor: "Serper.dev",
    category: "Scraping & Search",
    monthlyCost: 0,
    targetCost: 0,
    status: "keep-free",
    billing: "free",
    provides: "Google search / news",
    replacement: "Free tier (2,500/mo) is sufficient",
  },
  {
    key: "SERPAPI_KEY",
    vendor: "SerpAPI.com",
    category: "Scraping & Search",
    monthlyCost: 75,
    targetCost: 0,
    status: "eliminate",
    billing: "flat",
    provides: "Google Trends fear/greed search volume",
    replacement: "Not must-keep; Serper.dev free can cover if needed",
  },
  // Email
  {
    key: "RESEND_API_KEY",
    vendor: "Resend",
    category: "Email",
    monthlyCost: 0,
    targetCost: 0,
    status: "keep-free",
    billing: "free",
    provides: "Password-reset email",
    replacement: "Free tier (100/day) is sufficient",
  },
  // AI / LLM providers
  {
    key: "GROQ_API_KEY",
    vendor: "Groq",
    category: "AI / LLM Providers",
    monthlyCost: 0,
    targetCost: 0,
    status: "keep-free",
    billing: "free",
    provides: "Primary AI (fast, free tier)",
    replacement: "Free — primary AI summary provider",
  },
  {
    key: "GOOGLE_AI_API_KEY",
    vendor: "Google Gemini",
    category: "AI / LLM Providers",
    monthlyCost: 0,
    targetCost: 0,
    status: "keep-free",
    billing: "free",
    provides: "Secondary AI (free tier)",
    replacement: "Free — backup AI summary provider",
  },
  {
    key: "OPENAI_API_KEY",
    vendor: "OpenAI",
    category: "AI / LLM Providers",
    monthlyCost: 5,
    targetCost: 0,
    status: "eliminate",
    billing: "per-token",
    provides: "AI fallback (pay-per-use)",
    replacement: "Groq + Gemini free cover AI summaries",
  },
  {
    key: "ANTHROPIC_API_KEY",
    vendor: "Anthropic",
    category: "AI / LLM Providers",
    monthlyCost: 5,
    targetCost: 0,
    status: "eliminate",
    billing: "per-token",
    provides: "AI fallback (pay-per-use)",
    replacement: "Groq + Gemini free cover AI summaries",
  },
  {
    key: "XAI_API_KEY",
    vendor: "xAI Grok",
    category: "AI / LLM Providers",
    monthlyCost: 5,
    targetCost: 0,
    status: "eliminate",
    billing: "per-token",
    provides: "AI fallback (pay-per-use)",
    replacement: "Groq + Gemini free cover AI summaries",
  },
  {
    key: "OPENROUTER_API_KEY",
    vendor: "OpenRouter",
    category: "AI / LLM Providers",
    monthlyCost: 5,
    targetCost: 0,
    status: "eliminate",
    billing: "per-token",
    provides: "AI aggregator fallback (pay-per-use)",
    replacement: "Groq + Gemini free cover AI summaries",
  },
  {
    key: "PERPLEXITY_API_KEY",
    vendor: "Perplexity",
    category: "AI / LLM Providers",
    monthlyCost: 5,
    targetCost: 0,
    status: "eliminate",
    billing: "per-token",
    provides: "Search-augmented AI fallback (pay-per-use)",
    replacement: "Groq + Gemini free cover AI summaries",
  },
]

// ------------------------------------------------- per-token pricing (E-5)
//
// The budget guard needs a marginal price, not a monthly plan estimate. For
// LLMs that price is per token, and it depends on the MODEL, not the vendor —
// gpt-4o-mini and a frontier model on the same key differ by ~100x. So prices
// are keyed by the exact model id requested in lib/ai-providers.ts,
// app/api/ccpi/chat and app/api/ccpi/executive-summary.
//
// These are published list prices, recorded by hand — they are ESTIMATES and
// are labeled as such everywhere they surface. An unknown model is priced
// `null`, never 0 (house rule: missing data is null). The guard counts those
// calls separately as "unpriced" so a model swap can never silently read as
// $0 spend.

/** Date the prices below were last checked against vendor pricing pages. */
export const TOKEN_PRICES_AS_OF = "2026-08-07"

export interface TokenPrice {
  /** USD per 1,000,000 input tokens. */
  inputPerM: number
  /** USD per 1,000,000 output tokens. */
  outputPerM: number
  /** Why this is 0, for the free-tier entries. */
  note?: string
}

export const MODEL_TOKEN_PRICES: Record<string, TokenPrice> = {
  // Free tiers — $0 marginal. Rate-limited, not billed.
  "openrouter/free": { inputPerM: 0, outputPerM: 0, note: "OpenRouter free auto-router; capped by request count, not billed" },
  "llama-3.3-70b-versatile": { inputPerM: 0, outputPerM: 0, note: "Groq free tier" },
  "gemini-2.0-flash": { inputPerM: 0, outputPerM: 0, note: "Google AI Studio free tier" },
  "gemini-2.0-flash-exp": { inputPerM: 0, outputPerM: 0, note: "Google AI Studio free tier" },
  // Pay-per-use. These are the ones that can run a bill up.
  "gpt-4o-mini": { inputPerM: 0.15, outputPerM: 0.6 },
  "claude-3-5-sonnet-20241022": { inputPerM: 3, outputPerM: 15 },
  "grok-2-latest": { inputPerM: 2, outputPerM: 10 },
  "llama-3.1-sonar-large-128k-online": {
    inputPerM: 1,
    outputPerM: 1,
    note: "Perplexity also charges a per-request search fee not captured here — treat as a floor",
  },
}

export interface AiCallCost {
  /** USD for this call, or null when the model has no price on file. */
  usd: number | null
  /** True when the model was not in MODEL_TOKEN_PRICES. */
  unpriced: boolean
}

/**
 * Marginal USD cost of one LLM call.
 *
 * Returns `{ usd: null, unpriced: true }` for a model we have no price for —
 * the caller must surface that rather than treating it as free. A paid model
 * silently costed at $0 is exactly the failure this guard exists to prevent
 * (e.g. someone points OPENROUTER_FREE_MODEL at a paid slug).
 */
export function estimateAiCallCost(model: string, inputTokens: number, outputTokens: number): AiCallCost {
  const price = MODEL_TOKEN_PRICES[model]
  if (!price) return { usd: null, unpriced: true }
  const usd = (inputTokens / 1_000_000) * price.inputPerM + (outputTokens / 1_000_000) * price.outputPerM
  return { usd, unpriced: false }
}

/** Canonical key names whose billing can actually overspend. */
export function getMeteredKeys(): string[] {
  return API_COSTS.filter((a) => a.billing === "per-token" || a.billing === "per-call").map((a) => a.key)
}

export function getCostSummary() {
  const current = API_COSTS.reduce((sum, a) => sum + a.monthlyCost, 0)
  const target = API_COSTS.reduce((sum, a) => sum + a.targetCost, 0)
  return {
    currentMonthly: current,
    targetMonthly: target,
    monthlySavings: current - target,
    annualSavings: (current - target) * 12,
    toEliminate: API_COSTS.filter((a) => a.status === "eliminate"),
    toDowngrade: API_COSTS.filter((a) => a.status === "downgrade"),
  }
}
