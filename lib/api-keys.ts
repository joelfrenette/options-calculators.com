// Secure API key resolution utilities.
// Keys are read from environment variables only (Edge-runtime safe).
//
// Several services have historically been referenced under more than one
// env-var spelling. To stop features from silently failing when only one
// spelling is set, every key is resolved through its full alias list.

// A module-level `ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ||
// "default-32-char-encryption-key!"` was deleted here. Nothing in this file
// ever read it — one occurrence, the declaration itself.
//
// It was never a live vulnerability: `lib/key-store.ts`, which actually
// encrypts admin-pasted credentials, reads `process.env.ENCRYPTION_KEY`
// directly and returns null below 16 characters, and `lib/auth.ts` throws
// rather than signing sessions with a default. **Both of those guards were
// written specifically to avoid this constant** — key-store's comment says so.
//
// Which is the point. A previous pass found the hazard, routed around it, and
// left it sitting in a file named `api-keys.ts` for the next person to reach
// for. That is P6-72's lesson on a credential: **a decision enforced where the
// defect was found is not enforced where the defect lives.**

// Canonical key name -> all accepted env-var spellings (checked in order).
export const API_KEY_ALIASES: Record<string, string[]> = {
  // Market & economic data
  POLYGON_API_KEY: ["POLYGON_API_KEY"],
  FRED_API_KEY: ["FRED_API_KEY"],
  // Twelve Data + SerpAPI purged 2026-08-29 (admin audit): registered/probed/
  // costed but called nowhere — Twelve Data's QQQ-technicals job moved to
  // Polygon, SerpAPI's Google-Trends job moved to Serper.
  FMP_API_KEY: ["FMP_API_KEY"],
  ALPHA_VANTAGE_API_KEY: ["ALPHA_VANTAGE_API_KEY"],
  FINNHUB_API_KEY: ["FINNHUB_API_KEY"],
  APIFY_API_TOKEN: ["APIFY_API_TOKEN", "APIFY_API_KEY"],
  // Congressional trading data. The three routes that use it were calling
  // Quiver unauthenticated and getting a permanent 401 — see AUDIT_BACKLOG P6-1.
  QUIVER_API_KEY: ["QUIVER_API_KEY", "QUIVER_QUANT_API_KEY"],
  // Scraping & search
  SCRAPINGBEE_API_KEY: ["SCRAPINGBEE_API_KEY"],
  SERPER_API_KEY: ["SERPER_API_KEY"],
  // Email
  RESEND_API_KEY: ["RESEND_API_KEY"],
  // AI / LLM providers
  ANTHROPIC_API_KEY: ["ANTHROPIC_API_KEY"],
  GROQ_API_KEY: ["GROQ_API_KEY"],
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
  // `Number("")` is 0, not NaN — so a DEFINED-BUT-BLANK env var used to set the
  // monthly budget target to $0 rather than falling back to 40. That is the
  // most likely way for this variable to be malformed: Vercel hands you an
  // empty string whenever a variable exists with no value, which is exactly the
  // state a half-finished dashboard edit leaves behind.
  //
  // The consequence was not cosmetic. A $0 target makes the E-5 budget guard
  // treat any spend at all as a breach, so it would kill the metered keys and
  // the site would degrade for a reason nothing on screen explains.
  //
  // Found by writing the first assertion this function has ever had (P6-86).
  const raw = process.env.MONTHLY_BUDGET_TARGET?.trim()
  if (!raw) return 40
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 40
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
function isBudgetKilled(name: string): boolean {
  if (budgetSnapshot === null || !budgetSnapshot.tripped) return false
  return budgetSnapshot.guardedKeys.includes(name.toUpperCase())
}

// --- Admin-managed key overrides (P4-4) -----------------------------------
//
// Same arrangement as the budget-guard snapshot above, and for the same reason:
// `resolveApiKey` is synchronous and this file must stay import-free, so the
// storage lives here and lib/key-store.ts (which owns the AES-256-GCM crypto
// and all Supabase I/O, and is Node-runtime only) pushes decrypted values in.
//
// The snapshot is empty on a cold serverless instance. instrumentation.ts warms
// it at boot and a stale read triggers a background refresh, so a key pasted in
// the admin is live within roughly the cache TTL — not instantly. The admin UI
// states that rather than implying otherwise.

interface KeyOverrideSnapshot {
  /** Canonical key name -> decrypted value. Never logged, never serialized out. */
  values: Record<string, string>
  fetchedAt: number
}

let overrideSnapshot: KeyOverrideSnapshot | null = null

export function setKeyOverrideSnapshot(next: KeyOverrideSnapshot): void {
  overrideSnapshot = next
}

export function getKeyOverrideSnapshot(): KeyOverrideSnapshot | null {
  return overrideSnapshot
}

/** The admin-set value for a key, or "" when there isn't one. */
function getKeyOverride(name: string): string {
  if (overrideSnapshot === null) return ""
  return overrideSnapshot.values[name.toUpperCase()] ?? ""
}

/** Is this key currently supplied by an admin override rather than the env? */
function isOverridden(name: string): boolean {
  return getKeyOverride(name).length > 0
}

// Backwards-compatible interface (kept for existing imports).
export interface ApiKeyConfig {
  POLYGON_API_KEY?: string
  FMP_API_KEY?: string
  FRED_API_KEY?: string
  APIFY_API_TOKEN?: string
  RESEND_API_KEY?: string
  SERPER_API_KEY?: string
}

// Resolve a key by canonical name.
//
// Precedence, and the order matters:
//   1. DISABLED_APIS      — manual kill switch, always wins
//   2. budget guard       — automatic kill switch (E-5), always wins
//   3. admin override     — pasted in the admin (P4-4)
//   4. environment vars   — checked through the full alias list
//
// The two kill switches come FIRST on purpose: pasting a key in the admin must
// never be able to defeat a cost or safety cutoff. An override beats the env
// var because the person who just pasted a key expects it to be the one used —
// the reverse would silently ignore their change, which is worse than useless.
//
// Returns "" when nothing resolves, so callers see an unconfigured service and
// take their existing free/local fallback path.
export function resolveApiKey(name: string): string {
  if (isServiceDisabled(name)) return ""
  if (isBudgetKilled(name)) return ""

  const override = getKeyOverride(name)
  if (override) return override

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
function isKeyConfigured(name: string): boolean {
  return resolveApiKey(name).length > 0
}

// Is a raw key present, ignoring the kill switches? Lets the dashboard tell
// "disabled but key still set" apart from "no key at all". Counts an admin
// override as present — from the operator's point of view the credential
// exists, it just came from the admin instead of the environment.
export function hasRawKey(name: string): boolean {
  if (isOverridden(name)) return true
  const aliases = API_KEY_ALIASES[name] ?? [name]
  return aliases.some((alias) => !!process.env[alias])
}

/** Where a key's value comes from, for the admin panel. */
export type KeySource = "admin" | "env" | "none"

export function getKeySource(name: string): KeySource {
  if (isOverridden(name)) return "admin"
  const aliases = API_KEY_ALIASES[name] ?? [name]
  return aliases.some((alias) => !!process.env[alias]) ? "env" : "none"
}

// For the admin UI - presence map across every service the app uses.
export function getConfiguredKeys(): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const name of Object.keys(API_KEY_ALIASES)) {
    result[name] = isKeyConfigured(name)
  }
  return result
}

/**
 * Strip every configured credential out of text before it leaves the server.
 *
 * WHY THIS EXISTS (P7-71). Several routes put an API key in a URL query string
 * — Polygon and ScrapingBee both take `?apiKey=` / `?api_key=` — then echo the
 * upstream error body back to the caller as `details` or `message`. An upstream
 * that quotes the request it received quotes the key with it.
 *
 * `/api/polygon-proxy` is the one that names the problem, because it was already
 * half-solved there: the console line reads
 * `url.replace(apiKey, "API_KEY")`, so the author knew the URL carried a
 * credential — and redacted the LOG while leaving the RESPONSE untouched. The
 * sanitisation existed on the surface nobody reads and not on the one the public
 * gets.
 *
 * Redacts by VALUE, not by key name: it walks every configured credential and
 * replaces any occurrence. A route cannot forget to name its own key, and a text
 * that happens to contain someone else's is caught too.
 */
export function redactCredentials(text: string): string {
  if (!text) return text
  let out = text
  for (const name of Object.keys(API_KEY_ALIASES)) {
    const value = resolveApiKey(name)
    // Short values would match everywhere; a real credential is never this small.
    if (!value || value.length < 12) continue
    out = out.split(value).join(`[REDACTED:${name}]`)
  }
  return out
}
