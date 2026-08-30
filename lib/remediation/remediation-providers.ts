/**
 * Reference data for the remediation engine: key aliases, provider dashboards,
 * Vercel doc links and route-to-key path hints. Split from lib/remediation.ts
 * (P6-13); see that file's header for the module's contract and constraints.
 */

import type { RemediationLink } from "./remediation-types.ts"

// ----------------------------------------------------------------- reference data

/**
 * Mirrors API_KEY_ALIASES in lib/api-keys.ts. Duplicated rather than imported so
 * this module stays dependency-free (lib/api-keys.ts reads process.env at module
 * scope). scripts/check-remediation.ts asserts the two tables stay identical.
 */
export const KEY_ALIASES: Record<string, string[]> = {
  POLYGON_API_KEY: ["POLYGON_API_KEY"],
  FRED_API_KEY: ["FRED_API_KEY"],
  FMP_API_KEY: ["FMP_API_KEY"],
  ALPHA_VANTAGE_API_KEY: ["ALPHA_VANTAGE_API_KEY"],
  FINNHUB_API_KEY: ["FINNHUB_API_KEY"],
  APIFY_API_TOKEN: ["APIFY_API_TOKEN", "APIFY_API_KEY"],
  QUIVER_API_KEY: ["QUIVER_API_KEY", "QUIVER_QUANT_API_KEY"],
  SCRAPINGBEE_API_KEY: ["SCRAPINGBEE_API_KEY"],
  SERPER_API_KEY: ["SERPER_API_KEY"],
  RESEND_API_KEY: ["RESEND_API_KEY"],
  ANTHROPIC_API_KEY: ["ANTHROPIC_API_KEY"],
  GROQ_API_KEY: ["GROQ_API_KEY"],
  XAI_API_KEY: ["XAI_API_KEY", "GROK_XAI_API_KEY"],
  GOOGLE_AI_API_KEY: ["GOOGLE_AI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
  OPENROUTER_API_KEY: ["OPENROUTER_API_KEY"],
  PERPLEXITY_API_KEY: ["PERPLEXITY_API_KEY"],
}

interface Provider {
  label: string
  /** Where the owner manages the key, plan and billing. */
  dashboard: string
  /** Public status page, when the provider publishes one. */
  status?: string
}

/** Canonical key name -> where the owner goes to fix a plan/billing problem. */
export const PROVIDERS: Record<string, Provider> = {
  POLYGON_API_KEY: { label: "Polygon.io", dashboard: "https://polygon.io/dashboard", status: "https://status.polygon.io" },
  FRED_API_KEY: { label: "FRED (St. Louis Fed)", dashboard: "https://fredaccount.stlouisfed.org/apikeys" },
  FMP_API_KEY: { label: "Financial Modeling Prep", dashboard: "https://site.financialmodelingprep.com/developer/docs/dashboard" },
  ALPHA_VANTAGE_API_KEY: { label: "Alpha Vantage", dashboard: "https://www.alphavantage.co/support/#api-key" },
  FINNHUB_API_KEY: { label: "Finnhub", dashboard: "https://finnhub.io/dashboard", status: "https://status.finnhub.io" },
  APIFY_API_TOKEN: { label: "Apify", dashboard: "https://console.apify.com/account/integrations", status: "https://status.apify.com" },
  QUIVER_API_KEY: { label: "Quiver Quantitative", dashboard: "https://www.quiverquant.com/pricing/" },
  SCRAPINGBEE_API_KEY: { label: "ScrapingBee", dashboard: "https://app.scrapingbee.com/account/dashboard" },
  SERPER_API_KEY: { label: "Serper", dashboard: "https://serper.dev/dashboard" },
  RESEND_API_KEY: { label: "Resend", dashboard: "https://resend.com/api-keys", status: "https://resend-status.com" },
  ANTHROPIC_API_KEY: { label: "Anthropic", dashboard: "https://console.anthropic.com/settings/billing", status: "https://status.anthropic.com" },
  GROQ_API_KEY: { label: "Groq", dashboard: "https://console.groq.com/keys", status: "https://groqstatus.com" },
  XAI_API_KEY: { label: "xAI", dashboard: "https://console.x.ai" },
  GOOGLE_AI_API_KEY: { label: "Google AI Studio", dashboard: "https://aistudio.google.com/app/apikey" },
  OPENROUTER_API_KEY: { label: "OpenRouter", dashboard: "https://openrouter.ai/credits", status: "https://status.openrouter.ai" },
  PERPLEXITY_API_KEY: { label: "Perplexity", dashboard: "https://www.perplexity.ai/settings/api" },
}

export const VERCEL_ENV: RemediationLink = {
  label: "Vercel → Project → Settings → Environment Variables",
  url: "https://vercel.com/docs/projects/environment-variables",
}
export const VERCEL_PROTECTION: RemediationLink = {
  label: "Vercel Deployment Protection settings",
  url: "https://vercel.com/docs/deployment-protection",
}
export const VERCEL_BYPASS: RemediationLink = {
  label: "Protection Bypass for Automation (how it works)",
  url: "https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation",
}

/**
 * Path fragments that identify a provider when the result carries no key info
 * (`missingKeys` is only populated on a `blocked` result). Used only as a
 * fallback after ctx.keys.
 */
export const PATH_HINTS: [string, string][] = [
  ["/api/polygon", "POLYGON_API_KEY"],
  ["/api/apify", "APIFY_API_TOKEN"],
  ["/api/scraping-bee", "SCRAPINGBEE_API_KEY"],
  // (both twelvedata proxy routes were retired in the admin cleanup — S-20/P2-3:
  // duplicates of each other, zero consumers, provider kill-switched)
  ["/api/serper-finance", "SERPER_API_KEY"],
  ["/api/google-trends", "SERPER_API_KEY"],
  ["/api/congress-trades", "QUIVER_API_KEY"],
  ["/api/politician-spotlight", "QUIVER_API_KEY"],
  ["/api/top-performers", "QUIVER_API_KEY"],
  ["/api/macro-indicators", "FRED_API_KEY"],
  ["/api/cpi-inflation", "FRED_API_KEY"],
  ["/api/fomc-predictions", "FRED_API_KEY"],
  ["/api/jobs-report", "FRED_API_KEY"],
  ["/api/panic-euphoria", "FRED_API_KEY"],
  ["/api/insider", "FINNHUB_API_KEY"],
  ["/api/landmine-check", "FINNHUB_API_KEY"],
  ["/api/earnings-calendar", "FINNHUB_API_KEY"],
  ["/api/ai-status", "OPENROUTER_API_KEY"],
]
