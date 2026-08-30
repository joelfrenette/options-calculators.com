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
  // TWELVE_DATA_API_KEY entry removed 2026-08-29 (admin audit): purged as dead —
  // its RSI/MACD/SMA/OHLCV job is computed locally from Polygon.
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
    // Joel upgraded to a paid plan 2026-08-08.
    monthlyCost: 20,
    targetCost: 20,
    status: "keep-paid",
    billing: "flat",
    provides: "Google search / news (ticker headlines, landmine checks)",
    replacement: "",
  },
  // SERPAPI_KEY entry removed 2026-08-29 (admin audit): purged as dead — its
  // Google-Trends job migrated to Serper (/api/google-trends uses SERPER_API_KEY).
  {
    key: "QUIVER_API_KEY",
    vendor: "Quiver Quantitative",
    category: "Market & Economic Data",
    // Added 2026-08-08. Tier includes: congress trading, off-exchange short
    // volume (+DPI), gov contracts, lobbying. NOT included (probed): WSB
    // mentions, insider aggregate. Joel: no tier upgrades — at budget max.
    monthlyCost: 30,
    targetCost: 30,
    status: "keep-paid",
    billing: "flat",
    provides: "Congress trades, off-exchange short volume, gov contracts, lobbying",
    replacement: "No free source for these datasets",
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
  "openai/gpt-oss-120b": { inputPerM: 0, outputPerM: 0, note: "Groq free tier" },
  "gemini-3.5-flash-lite": {
    inputPerM: 0,
    outputPerM: 0,
    note: "Google AI Studio free tier. This slug came from Google's OWN error text — gemini-2.5-flash-lite returned 'no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite' — so it is vendor-confirmed, unlike the 2.5 slug it replaces. Priced $0 for the same reason the Groq and OpenRouter entries are: the chain classifies it tier:'free' and only calls it on the free tier. Paid rates are NOT confirmed for this tier; 2.5-flash-lite was $0.10/$0.40 per 1M.",
  },
  // gemini-2.0-flash-exp price entry removed 2026-08-29 (admin audit): no code
  // ever requested that model id — a dead defensive constant.
  //
  // The six slugs this table used to carry — llama-3.3-70b-versatile,
  // gemini-2.0-flash, gpt-4o-mini, claude-3-5-sonnet-20241022, grok-2-latest —
  // were all 2024-vintage and all retired by their vendors. Prices move in the
  // SAME commit as lib/ai-providers.ts: a bumped slug against a stale table
  // records cost_known:false, which is the "unpriced" state the budget guard
  // counts as unaccounted. See the 2026-08-30 CHANGELOG entry.
  //
  // Pay-per-use. These are the ones that can run a bill up.
  "gpt-5.4-nano": { inputPerM: 0.2, outputPerM: 1.25 },
  "claude-opus-5": {
    inputPerM: 5,
    outputPerM: 25,
    note: "primary reasoning model as of 2026-08-30 — first in the chain by design, not last",
  },
  // Kept: still requested by lib/anthropic-market-data.ts, which stays on a
  // cheap model deliberately (a better model cannot recall today's VIX).
  "claude-haiku-4-5": { inputPerM: 1, outputPerM: 5 },
  // Cheap tier, used ONLY by lib/grok-market-data.ts — the number-recall path,
  // which is deliberately not on the flagship. See that file's comment.
  "grok-4.3": { inputPerM: 1.25, outputPerM: 2.5 },
  "grok-4.6": {
    inputPerM: 2,
    outputPerM: 6,
    note: "below 200K-token prompts; xAI doubles to $4/$12 for the WHOLE request once a prompt crosses 200K — not modelled here, and unreachable on these 50-token calls",
  },
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
