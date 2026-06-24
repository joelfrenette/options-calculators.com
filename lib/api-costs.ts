// Single source of truth for API cost tracking and the cost-optimization plan.
// Monthly costs are ESTIMATES based on each vendor's published 2026 pricing —
// adjust `monthlyCost` to your actual plan if it differs.

export type CostStatus = "keep-paid" | "keep-free" | "downgrade" | "eliminate"

export interface ApiCost {
  key: string // canonical key name (matches lib/api-keys.ts)
  vendor: string
  category: "Market & Economic Data" | "Scraping & Search" | "Email" | "AI / LLM Providers"
  monthlyCost: number // current estimated USD/month
  targetCost: number // USD/month after optimization
  status: CostStatus
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
    provides: "Reddit/CNN social sentiment scraping",
    replacement: "Free Reddit API + Alternative.me (sentiment is nice-to-have)",
  },
  {
    key: "SERPER_API_KEY",
    vendor: "Serper.dev",
    category: "Scraping & Search",
    monthlyCost: 0,
    targetCost: 0,
    status: "keep-free",
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
    provides: "Search-augmented AI fallback (pay-per-use)",
    replacement: "Groq + Gemini free cover AI summaries",
  },
]

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
