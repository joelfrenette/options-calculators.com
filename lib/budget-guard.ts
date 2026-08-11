/**
 * Budget guard with auto-shutoff — AUDIT_BACKLOG E-5.
 *
 * WHAT IT GUARDS. Only pay-per-use providers can run a bill up. Flat-plan
 * vendors (Polygon, FMP, TwelveData, Apify, ScrapingBee, SerpAPI) throttle when
 * you exceed the plan; they do not bill more. Free tiers rate-limit. So the
 * guard polices exactly the `per-token` / `per-call` entries in lib/api-costs.ts
 * — in practice the LLM keys.
 *
 * HOW SPEND IS COMPUTED. From the durable Supabase `api_calls` ledger, summed
 * through the `api_spend_daily` view: tokens actually used x list price from
 * lib/api-costs.ts. It is an ESTIMATE of vendor list price, not a bill, and it
 * is labeled as such everywhere it surfaces. It will differ from the vendor's
 * invoice — for cached-token discounts, negotiated rates, per-request search
 * fees, and anything spent outside this app on the same key.
 *
 * DAY BOUNDARIES ARE UTC, because `api_spend_daily` buckets with
 * date_trunc('day', ts) in the database's UTC timezone. A "daily" cap therefore
 * resets at 00:00 UTC, not in Joel's local time. Consistent, and stated so
 * nobody reads a mid-evening reset as a bug.
 *
 * FAIL-OPEN, DELIBERATELY. If Supabase is unreachable or unconfigured, the
 * guard reports `unknown` and does NOT cut off the app. A metering outage
 * taking down the site would be a worse failure than a day of overspend, and
 * the provider-side hard caps (the layer-1 control Joel sets in each vendor
 * console) are the real backstop. Every unknown is surfaced in the admin panel
 * rather than being silently treated as $0.
 *
 * WHERE THE PIECES LIVE. The synchronous snapshot that `resolveApiKey` reads is
 * stored in lib/api-keys.ts, not here, because that file must stay import-free
 * (scripts/check-remediation.ts loads it under bare node, which resolves
 * neither the "@/" alias nor a transitive import chain). This module owns every
 * async read and write and pushes its results into that snapshot.
 */

import { API_COSTS, getMeteredKeys } from "@/lib/api-costs"
import { getMeteringSupabaseConfig } from "@/lib/metered-fetch"
// The synchronous snapshot lives in api-keys.ts because `resolveApiKey` must
// read it without an await and that file has to stay import-free — see the
// "Budget guard (E-5)" block there for the full reason.
import { clearBudgetKillSnapshot, getBudgetKillSnapshot, setBudgetKillSnapshot } from "@/lib/api-keys"

// ------------------------------------------------------------------ config

/** Default hard stops, overridable per environment. */
const DEFAULT_DAILY_HARD_STOP = 50
const DEFAULT_MONTHLY_HARD_STOP = 100

function readBudget(envName: string, fallback: number): number {
  // A budget of 0 is meaningful ("cut off immediately"), so 0 must be accepted
  // when it is genuinely CONFIGURED — and that is precisely what made the old
  // version dangerous. `Number("")` is 0, not NaN, so a DEFINED-BUT-BLANK
  // `DAILY_HARD_STOP` or `MONTHLY_HARD_STOP` read as a deliberate "cut off
  // immediately" and killed every metered API on the first cent of spend.
  //
  // Worse here than in `getMonthlyBudgetTarget` (P6-86): that one sets a
  // reporting target, this one is the hard stop. An empty string is the most
  // likely malformed value for an env var — Vercel produces one whenever a
  // variable exists with no value — so the single most probable operator
  // mistake took the site's paid data offline with nothing on screen to explain
  // it. Trim first, treat blank as unset, and only then let 0 mean zero.
  const raw = process.env[envName]?.trim()
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function getDailyHardStop(): number {
  return readBudget("DAILY_BUDGET_HARD_STOP", DEFAULT_DAILY_HARD_STOP)
}

function getMonthlyHardStop(): number {
  return readBudget("MONTHLY_BUDGET_HARD_STOP", DEFAULT_MONTHLY_HARD_STOP)
}

/**
 * Providers the guard cuts off when it trips: the canonical key names whose
 * billing model can actually overspend. Flat and free keys are left alone —
 * disabling Polygon on a budget breach would break the scanners while saving
 * nothing.
 */
export function getGuardedKeys(): string[] {
  return getMeteredKeys()
}

/** Ledger `provider` tag -> canonical key name, for attributing spend. */
const PROVIDER_TO_KEY: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  xai: "XAI_API_KEY",
  groq: "GROQ_API_KEY",
  google: "GOOGLE_AI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
  polygon: "POLYGON_API_KEY",
  fmp: "FMP_API_KEY",
  finnhub: "FINNHUB_API_KEY",
}

export function providerToKey(provider: string): string | null {
  return PROVIDER_TO_KEY[provider.toLowerCase()] ?? null
}

// ------------------------------------------------------------------- types

export interface SpendWindow {
  /** Priced spend in USD, or null when the ledger could not be read. */
  usd: number | null
  /** Calls whose model had no price on file — spend NOT included in `usd`. */
  unpricedCalls: number
  /** Per-provider breakdown, priced USD only. */
  byProvider: Record<string, number>
}

export interface SpendReport {
  /** UTC day the daily window covers, YYYY-MM-DD. */
  day: string
  /** UTC month the monthly window covers, YYYY-MM. */
  month: string
  daily: SpendWindow
  monthly: SpendWindow
  dailyHardStop: number
  monthlyHardStop: number
  /** True when a threshold is breached. False when under; null when unknown. */
  breached: boolean | null
  /** Which threshold broke, when one did. */
  breachReason: "daily" | "monthly" | null
  /** Why spend is unknown, when it is. */
  unavailableReason: string | null
}

export interface BudgetState {
  tripped: boolean
  reason: string | null
  spendUsd: number | null
  thresholdUsd: number | null
  trippedAt: string | null
  clearedAt: string | null
  clearedBy: string | null
  updatedAt: string | null
}

interface SpendRow {
  day: string
  provider: string
  calls: number
  cost_usd: string | number | null
  unpriced_calls: number
}

// --------------------------------------------------------------- utilities

/** UTC day string (YYYY-MM-DD) — must match the view's date_trunc bucket. */
function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** UTC month string (YYYY-MM). */
function utcMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7)
}

/** First UTC day of the current month (YYYY-MM-01). */
function utcMonthStart(now = new Date()): string {
  return `${utcMonth(now)}-01`
}

function toNumber(value: string | number | null): number {
  if (value === null) return 0
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

// ------------------------------------------------------------ spend reader

/**
 * Read daily + month-to-date spend from the Supabase ledger.
 *
 * Returns nulls (never zeros) when the ledger cannot be read — the difference
 * between "spent nothing" and "don't know" is the whole point of the panel.
 */
export async function getSpendReport(now = new Date()): Promise<SpendReport> {
  const day = utcDay(now)
  const month = utcMonth(now)
  const dailyHardStop = getDailyHardStop()
  const monthlyHardStop = getMonthlyHardStop()

  const empty = (reason: string): SpendReport => ({
    day,
    month,
    daily: { usd: null, unpricedCalls: 0, byProvider: {} },
    monthly: { usd: null, unpricedCalls: 0, byProvider: {} },
    dailyHardStop,
    monthlyHardStop,
    breached: null,
    breachReason: null,
    unavailableReason: reason,
  })

  const cfg = getMeteringSupabaseConfig()
  if (!cfg) {
    return empty("Supabase metering is not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).")
  }

  let rows: SpendRow[]
  try {
    // Month-to-date covers the daily window too — one query, filtered twice.
    const res = await fetch(
      `${cfg.url}/rest/v1/api_spend_daily` +
        `?select=day,provider,calls,cost_usd,unpriced_calls` +
        `&day=gte.${utcMonthStart(now)}&order=day.desc`,
      {
        headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    )
    if (!res.ok) {
      return empty(`Supabase spend query failed: HTTP ${res.status} ${res.statusText}`)
    }
    const body = await res.json()
    if (!Array.isArray(body)) return empty("Supabase spend query returned an unexpected shape.")
    rows = body as SpendRow[]
  } catch (err) {
    return empty(`Supabase spend query failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  const sum = (subset: SpendRow[]): SpendWindow => {
    const byProvider: Record<string, number> = {}
    let usd = 0
    let unpricedCalls = 0
    for (const row of subset) {
      const cost = toNumber(row.cost_usd)
      usd += cost
      unpricedCalls += row.unpriced_calls ?? 0
      byProvider[row.provider] = (byProvider[row.provider] ?? 0) + cost
    }
    return { usd, unpricedCalls, byProvider }
  }

  const daily = sum(rows.filter((r) => r.day === day))
  const monthly = sum(rows)

  const dailyBreached = (daily.usd ?? 0) >= dailyHardStop
  const monthlyBreached = (monthly.usd ?? 0) >= monthlyHardStop

  return {
    day,
    month,
    daily,
    monthly,
    dailyHardStop,
    monthlyHardStop,
    breached: dailyBreached || monthlyBreached,
    // Daily reported first: it is the tighter, faster-moving signal.
    breachReason: dailyBreached ? "daily" : monthlyBreached ? "monthly" : null,
    unavailableReason: null,
  }
}

// ------------------------------------------------------------- kill flag io

const BUDGET_STATE_URL = "/rest/v1/budget_state?id=eq.1"

const UNKNOWN_STATE: BudgetState = {
  tripped: false,
  reason: null,
  spendUsd: null,
  thresholdUsd: null,
  trippedAt: null,
  clearedAt: null,
  clearedBy: null,
  updatedAt: null,
}

/** Read the durable kill flag. Returns null when the ledger is unreachable. */
export async function readBudgetState(): Promise<BudgetState | null> {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return null
  try {
    const res = await fetch(`${cfg.url}${BUDGET_STATE_URL}&select=*`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    })
    if (!res.ok) return null
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return null
    const r = rows[0]
    return {
      tripped: r.tripped === true,
      reason: r.reason ?? null,
      spendUsd: r.spend_usd === null || r.spend_usd === undefined ? null : Number(r.spend_usd),
      thresholdUsd: r.threshold_usd === null || r.threshold_usd === undefined ? null : Number(r.threshold_usd),
      trippedAt: r.tripped_at ?? null,
      clearedAt: r.cleared_at ?? null,
      clearedBy: r.cleared_by ?? null,
      updatedAt: r.updated_at ?? null,
    }
  } catch {
    return null
  }
}

async function patchBudgetState(patch: Record<string, unknown>): Promise<boolean> {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return false
  try {
    const res = await fetch(`${cfg.url}${BUDGET_STATE_URL}`, {
      method: "PATCH",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Trip the kill flag. Idempotent — re-tripping keeps the original timestamp. */
export async function tripBudgetGuard(args: {
  reason: "daily" | "monthly" | "manual"
  spendUsd: number | null
  thresholdUsd: number | null
}): Promise<boolean> {
  const existing = await readBudgetState()
  if (existing?.tripped) return true
  const ok = await patchBudgetState({
    tripped: true,
    reason: args.reason,
    spend_usd: args.spendUsd,
    threshold_usd: args.thresholdUsd,
    tripped_at: new Date().toISOString(),
    cleared_at: null,
    cleared_by: null,
  })
  if (ok) invalidateGuardCache()
  return ok
}

/** Clear the kill flag (admin re-enable). */
export async function clearBudgetGuard(clearedBy: string): Promise<boolean> {
  const ok = await patchBudgetState({
    tripped: false,
    reason: null,
    cleared_at: new Date().toISOString(),
    cleared_by: clearedBy,
  })
  if (ok) invalidateGuardCache()
  return ok
}

// ----------------------------------------------------------- sync snapshot
//
// `resolveApiKey` is synchronous and called from everywhere, so it cannot await
// a Supabase read. It consults the cached snapshot in lib/budget-guard-state.ts
// instead; this section is what keeps that snapshot current.
//
// The snapshot starts EMPTY on every cold serverless instance, and an empty
// snapshot fails open. That is a deliberate, bounded hole: a brand-new instance
// may serve a few calls before its first refresh lands. It is closed for the
// path that actually spends money — generateWithFallback / streamWithFallback
// and both CCPI AI routes await `ensureBudgetGuardFresh()` before touching any
// provider — so the hole only ever applies to keys that cannot bill per call.

const CACHE_TTL_MS = 60_000

let inFlight: Promise<void> | null = null

function invalidateGuardCache(): void {
  clearBudgetKillSnapshot()
}

function snapshotIsFresh(): boolean {
  const snap = getBudgetKillSnapshot()
  return snap !== null && Date.now() - snap.fetchedAt < CACHE_TTL_MS
}

/** Test seam + cron hook: force the next read to hit Supabase. */
export function resetBudgetGuardCache(): void {
  invalidateGuardCache()
  inFlight = null
}

async function refresh(): Promise<void> {
  const state = await readBudgetState()
  // A failed read leaves the previous snapshot in place rather than clearing
  // it: a tripped guard must not un-trip because Supabase blipped.
  if (state !== null) {
    setBudgetKillSnapshot({ tripped: state.tripped, guardedKeys: getGuardedKeys(), fetchedAt: Date.now() })
  }
}

/**
 * Refresh the snapshot if it is missing or stale, then report whether the guard
 * is tripped. Await this before spending — it is the accurate check.
 * Concurrent callers share one in-flight request.
 */
export async function ensureBudgetGuardFresh(): Promise<boolean> {
  if (!snapshotIsFresh()) {
    inFlight ??= refresh().finally(() => {
      inFlight = null
    })
    await inFlight
  }
  return getBudgetKillSnapshot()?.tripped ?? false
}

/**
 * Synchronous best-effort read. Prefer `ensureBudgetGuardFresh()` anywhere you
 * can await. Returns false (fail open) when nothing has been cached yet.
 */
export function isBudgetGuardTrippedSync(): boolean {
  return getBudgetKillSnapshot()?.tripped ?? false
}

/** What the admin panel shows: state + freshness, with unknowns as unknowns. */
export async function getGuardStatus(): Promise<{
  state: BudgetState
  stateAvailable: boolean
  spend: SpendReport
  guardedKeys: string[]
  guardedVendors: string[]
}> {
  const [state, spend] = await Promise.all([readBudgetState(), getSpendReport()])
  const guardedKeys = getGuardedKeys()
  return {
    state: state ?? UNKNOWN_STATE,
    stateAvailable: state !== null,
    spend,
    guardedKeys,
    guardedVendors: API_COSTS.filter((a) => guardedKeys.includes(a.key)).map((a) => a.vendor),
  }
}
