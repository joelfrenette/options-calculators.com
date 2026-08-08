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

// --- Cost controls (no-infra kill switch) ---------------------------------
// Set DISABLED_APIS in the environment to a comma-separated list of canonical
// key names (e.g. "TWELVE_DATA_API_KEY,APIFY_API_TOKEN"). Disabled services
// resolve to an empty key, so the app behaves as if unconfigured and falls
// back to its free/local path — letting you stop paying for an API without
// deleting its key.
export function getDisabledServices(): string[] {
  return (process.env.DISABLED_APIS ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
}

export function isServiceDisabled(name: string): boolean {
  return getDisabledServices().includes(name.toUpperCase())
}

// Monthly budget target (USD) for the cost dashboard. Default $40.
export function getMonthlyBudgetTarget(): number {
  const raw = Number(process.env.MONTHLY_BUDGET_TARGET)
  return Number.isFinite(raw) && raw >= 0 ? raw : 40
}

// --- Budget guard (E-5) ---------------------------------------------------
//
// A second, automatic kill switch on top of DISABLED_APIS. DISABLED_APIS is a
// deliberate env-var decision that needs a redeploy; this one flips by itself
// when metered spend breaches a threshold, and flips back from the admin Health
// tab. It only ever cuts off keys that can actually overspend (the per-token /
// per-call entries in lib/api-costs.ts) — killing flat-rate Polygon on a budget
// breach would break the scanners and save nothing.
//
// THE SNAPSHOT LIVES HERE, not in lib/budget-guard.ts, and that is deliberate.
// `resolveApiKey` is synchronous and cannot await a Supabase read, so it needs
// a cached answer. This file must also stay IMPORT-FREE: scripts/check-
// remediation.ts loads it under bare node, which resolves neither the "@/"
// alias nor a transitive import chain (and tsconfig forbids the ".ts"-suffixed
// relative form that would). So api-keys.ts owns the storage — it already owns
// key availability — and lib/budget-guard.ts, which does all the I/O, pushes
// state in via setBudgetKillSnapshot().

interface BudgetKillSnapshot {
  tripped: boolean
  /** Canonical key names the guard cuts off. Travels with the snapshot so this
   *  file needs no knowledge of lib/api-costs.ts pricing. */
  guardedKeys: string[]
  /** Epoch ms of the read that produced this snapshot. */
  fetchedAt: number
}

let budgetSnapshot: BudgetKillSnapshot | null = null

export function setBudgetKillSnapshot(next: BudgetKillSnapshot): void {
  budgetSnapshot = next
}

export function getBudgetKillSnapshot(): BudgetKillSnapshot | null {
  return budgetSnapshot
}

export function clearBudgetKillSnapshot(): void {
  budgetSnapshot = null
}

/**
 * Is a key currently cut off by the budget guard?
 *
 * False when nothing has been cached yet — a cold serverless instance fails
 * OPEN by design (a metering outage must not take the site down). The accurate
 * check is `ensureBudgetGuardFresh()`, which the AI paths await before spending;
 * this is the belt-and-braces layer for every other caller.
 *
 * A stale "tripped" deliberately does NOT expire on TTL: it stays tripped until
 * a successful refresh says otherwise, because staying off is the safe
 * direction for a spend control.
 */
export function isBudgetKilled(name: string): boolean {
  if (budgetSnapshot === null || !budgetSnapshot.tripped) return false
  return budgetSnapshot.guardedKeys.includes(name.toUpperCase())
}

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
// Returns "" if the service has been disabled via DISABLED_APIS (manual kill
// switch) or cut off by the budget guard (automatic kill switch, E-5). Callers
// see an unconfigured service and take their existing free/local fallback path.
export function resolveApiKey(name: string): string {
  if (isServiceDisabled(name)) return ""
  if (isBudgetKilled(name)) return ""
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

// Is a given service configured (any alias present)? Respects the kill switch.
export function isKeyConfigured(name: string): boolean {
  return resolveApiKey(name).length > 0
}

// Is a raw key present, ignoring the kill switch? Lets the dashboard tell
// "disabled but key still set" apart from "no key at all".
export function hasRawKey(name: string): boolean {
  const aliases = API_KEY_ALIASES[name] ?? [name]
  return aliases.some((alias) => !!process.env[alias])
}

// For the admin UI - presence map across every service the app uses.
export function getConfiguredKeys(): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const name of Object.keys(API_KEY_ALIASES)) {
    result[name] = isKeyConfigured(name)
  }
  return result
}
