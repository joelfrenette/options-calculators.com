/**
 * Contract registry for every API route in this app — Phase 2 of AUDIT_PLAN.md.
 *
 * One entry per route under app/api. Each declares:
 *   - the canary request that exercises it without side effects,
 *   - a zod schema for the success shape (the fields consumers actually read),
 *   - a latency budget,
 *   - the API keys it needs, so a failure can be attributed to a missing key
 *     rather than reported as a broken route,
 *   - which public tab breaks when it fails.
 *
 * Consumed by /api/admin/run-health-checks, which probes everything and reports
 * per-route pass/fail. Keep this file in sync with `pnpm inventory` output —
 * SITE_MAP.md §2 lists every route, and a route missing here is flagged by the
 * coverage check at the bottom of the health-check response.
 *
 * SCHEMA PHILOSOPHY: assert the fields a consumer depends on, and no more.
 * Over-specifying turns a harmless upstream addition into a false alarm; under-
 * specifying lets a route return `{}` and pass. Where a route's success shape is
 * genuinely open-ended, the schema says so rather than pretending to check it.
 */

import { z } from "zod"

/** Routes are probed with these; none mutate state. */
export type Canary = { query?: Record<string, string>; body?: unknown }

export interface RouteContract {
  path: string
  method: "GET" | "POST"
  canary?: Canary
  /** Success-shape schema. Omitted only when `skip` is set. */
  schema?: z.ZodTypeAny
  /** Soft latency budget in ms — exceeded is reported, not failed. */
  budgetMs: number
  /**
   * Non-200 statuses that are a legitimate answer rather than a failure —
   * e.g. a cache route answering 404 for "nothing cached yet". Without this the
   * health check would report a working route as broken.
   */
  okStatuses?: number[]
  /** Send the admin session cookie. Required for auth-gated routes. */
  needsAuth?: boolean
  /** Canonical key names (lib/api-keys.ts) required for a real result. */
  requires?: string[]
  /** Public tab id(s) that break if this route fails. Empty for ops-only routes. */
  tabs: string[]
  /** Set to skip probing, with the reason shown in the report. */
  skip?: string
}

// ---------------------------------------------------------------- fragments

const iso = z.string().min(4)
const num = z.number()
/** A route that returns an object we deliberately do not constrain further. */
const anyObject = z.object({}).passthrough()

/** Most routes answer either a payload or `{ error }`. Health checks treat an
 *  `error` body as a failure even when the status is 200 — several routes here
 *  return 200 with an error field, which would otherwise read as success. */
export const errorShape = z.object({ error: z.string() })

// ------------------------------------------------------------------ registry

export const ROUTE_CONTRACTS: RouteContract[] = [
  // ============================================ DECIDE / ANALYZE (10 tabs)
  {
    path: "/api/ccpi",
    method: "GET",
    schema: z
      .object({
        ccpi: num.min(0).max(100).optional(),
        pillars: anyObject.optional(),
        dataSourceStatus: anyObject.optional(),
      })
      .passthrough(),
    budgetMs: 15000,
    requires: ["FRED_API_KEY", "ALPHA_VANTAGE_API_KEY"],
    tabs: ["ccpi"],
  },
  {
    path: "/api/ccpi/history",
    method: "GET",
    schema: anyObject,
    budgetMs: 3000,
    tabs: ["ccpi"],
  },
  {
    path: "/api/ccpi/cache",
    method: "GET",
    schema: anyObject,
    // 404 `{cached:false}` is this route's cache-miss signal, not a failure.
    okStatuses: [404],
    budgetMs: 2000,
    tabs: ["ccpi"],
  },
  {
    path: "/api/ccpi/executive-summary",
    method: "POST",
    skip: "Spends an LLM call on every probe. Covered by /api/ai-status instead.",
    budgetMs: 30000,
    tabs: ["ccpi"],
  },
  {
    path: "/api/ccpi/chat",
    method: "POST",
    skip: "Spends an LLM call on every probe.",
    budgetMs: 30000,
    tabs: ["ccpi"],
  },
  {
    path: "/api/earnings-calendar",
    method: "GET",
    // Probe the way the UI actually calls it. components/earnings-economic-calendar.tsx
    // requests `?skipAI=true` and fills the explainers in afterwards via
    // /insights. Without the flag the probe took the slow path — up to 25 LLM
    // calls — and reported 20.7s against a 20s budget as "degraded", measuring
    // a path no user ever hits while spending real money on every run. The
    // sibling /insights entry is skipped for exactly that reason. Precedent:
    // the yahoo-proxy canary below, where the canary was wrong, not the route.
    canary: { query: { skipAI: "true" } },
    schema: anyObject,
    // The fast path targets ~2s; this leaves headroom without hiding a regression.
    budgetMs: 10000,
    requires: ["FINNHUB_API_KEY", "POLYGON_API_KEY"],
    tabs: ["earnings-calendar"],
  },
  {
    path: "/api/earnings-calendar/insights",
    method: "POST",
    skip: "Spends an LLM call on every probe.",
    budgetMs: 60000,
    tabs: ["earnings-calendar"],
  },
  {
    path: "/api/trend-analysis",
    method: "GET",
    // The component reads `indices` and renders one card per entry, so an empty
    // array is a real failure even though the request succeeded.
    schema: z.object({ indices: z.array(anyObject).min(1), lastUpdated: iso }),
    budgetMs: 12000,
    tabs: ["trend-analysis"],
  },
  {
    path: "/api/vix",
    method: "GET",
    // Live run 2026-08-07: production returns `vix` as a NUMBER; the original
    // object-only schema was over-specified and failed a working route.
    schema: z.object({ vix: z.union([z.number(), anyObject]), timestamp: iso }),
    budgetMs: 8000,
    tabs: ["risk-management"],
  },
  {
    path: "/api/vix-history",
    method: "GET",
    schema: anyObject,
    budgetMs: 8000,
    tabs: ["risk-management"],
  },
  {
    path: "/api/market-sentiment",
    method: "GET",
    schema: anyObject,
    budgetMs: 20000,
    requires: ["SCRAPINGBEE_API_KEY"],
    tabs: ["market-sentiment"],
  },
  {
    path: "/api/sentiment-heatmap",
    method: "GET",
    schema: anyObject,
    budgetMs: 10000,
    tabs: ["market-sentiment"],
  },
  {
    path: "/api/panic-euphoria",
    method: "GET",
    schema: anyObject,
    budgetMs: 20000,
    requires: ["FRED_API_KEY"],
    tabs: ["panic-euphoria"],
  },
  {
    path: "/api/social-sentiment",
    method: "GET",
    schema: z
      .object({
        success: z.boolean(),
        indicators: z.array(anyObject),
        sources_available: num,
        sources_total: num,
      })
      .passthrough(),
    budgetMs: 45000,
    requires: ["FINNHUB_API_KEY", "POLYGON_API_KEY"],
    tabs: ["social-sentiment"],
  },
  {
    path: "/api/fomc-predictions",
    method: "GET",
    schema: z
      .object({
        currentRate: num,
        nextMeeting: z.object({ date: z.string(), daysUntil: num }).passthrough(),
      })
      .passthrough(),
    budgetMs: 12000,
    requires: ["FRED_API_KEY"],
    tabs: ["fomc-predictions"],
  },
  {
    path: "/api/cpi-inflation",
    method: "GET",
    schema: z
      .object({ currentCPI: num, previousCPI: num, chartData: z.array(anyObject) })
      .passthrough(),
    budgetMs: 12000,
    requires: ["FRED_API_KEY"],
    tabs: ["cpi-inflation"],
  },
  {
    path: "/api/jobs-report",
    method: "GET",
    schema: z.object({ current: anyObject }).passthrough(),
    budgetMs: 12000,
    requires: ["FRED_API_KEY"],
    tabs: ["jobs"],
  },

  // ==================================================== FIND / SCAN (7 tabs)
  {
    path: "/api/polygon-tickers",
    method: "GET",
    canary: { query: { minMarketCap: "2", minVolume: "2", limit: "5" } },
    schema: anyObject,
    budgetMs: 25000,
    requires: ["POLYGON_API_KEY"],
    tabs: ["wheel-scanner"],
  },
  {
    path: "/api/polygon-proxy",
    method: "GET",
    canary: { query: { endpoint: "snapshot", ticker: "AAPL" } },
    schema: anyObject,
    budgetMs: 15000,
    requires: ["POLYGON_API_KEY"],
    tabs: ["wheel-scanner"],
  },
  {
    path: "/api/landmine-check",
    method: "GET",
    canary: { query: { tickers: "AAPL" } },
    schema: anyObject,
    budgetMs: 12000,
    requires: ["FINNHUB_API_KEY"],
    tabs: ["wheel-scanner"],
  },
  {
    path: "/api/time-server",
    method: "GET",
    schema: anyObject,
    budgetMs: 6000,
    tabs: ["wheel-scanner"],
  },
  {
    // Rebuilt in Phase 1. Rows are omitted when their measured inputs are
    // unavailable, so an empty array is a legitimate answer — but `provenance`
    // and `assumptions` must always be present, because they are what tells the
    // UI these are modelled values rather than quotes.
    path: "/api/strategy-scanner",
    method: "GET",
    canary: { query: { type: "credit-spreads", tickers: "AAPL,MSFT" } },
    schema: z
      .object({
        timestamp: iso,
        provenance: z.object({
          underlyingPrice: z.string(),
          impliedVolatility: z.string(),
          premiumsGreeksProbabilities: z.string(),
        }),
        assumptions: z.object({ riskFreeRate: num, atmBand: num }),
        creditSpreads: z.array(anyObject),
      })
      .passthrough(),
    budgetMs: 45000,
    requires: ["POLYGON_API_KEY"],
    tabs: [
      "calendar-spread-scanner",
      "credit-spread-scanner",
      "iron-condor-scanner",
      "butterfly-scanner",
      "leaps-scanner",
      "zebra-scanner",
      "wheel-strategy",
    ],
  },

  // ==================================================== FIND / COPY (8 tabs)
  {
    path: "/api/insider-trading",
    method: "GET",
    schema: anyObject,
    budgetMs: 20000,
    requires: ["FINNHUB_API_KEY"],
    tabs: ["insiders"],
  },
  {
    path: "/api/insider-trading/ai-insights",
    method: "POST",
    skip: "Spends an LLM call on every probe.",
    budgetMs: 30000,
    tabs: ["insiders"],
  },
  {
    path: "/api/insider-clusters",
    method: "GET",
    schema: anyObject,
    budgetMs: 20000,
    requires: ["FINNHUB_API_KEY"],
    tabs: ["insider-clusters"],
  },
  { path: "/api/form-144", method: "GET", schema: anyObject, budgetMs: 20000, tabs: ["form-144"] },
  // All three read the same Quiver Quantitative congressional feed. Declaring
  // the key means one missing credential reports as one blocked cause across
  // three routes, instead of three unexplained 502s (AUDIT_BACKLOG P6-1).
  {
    path: "/api/congress-trades",
    method: "GET",
    schema: anyObject,
    budgetMs: 20000,
    requires: ["QUIVER_API_KEY"],
    tabs: ["congress-feed"],
  },
  {
    path: "/api/politician-spotlight",
    method: "GET",
    schema: anyObject,
    budgetMs: 20000,
    requires: ["QUIVER_API_KEY"],
    tabs: ["politician-spotlight"],
  },
  {
    path: "/api/top-performers",
    method: "GET",
    schema: anyObject,
    budgetMs: 20000,
    requires: ["QUIVER_API_KEY"],
    tabs: ["top-performers"],
  },
  {
    path: "/api/hedge-fund-13f",
    method: "GET",
    schema: anyObject,
    budgetMs: 25000,
    tabs: ["hedge-fund-13f"],
  },
  {
    path: "/api/smart-money-etfs",
    method: "GET",
    schema: anyObject,
    budgetMs: 20000,
    requires: ["POLYGON_API_KEY"],
    tabs: ["smart-money-etfs"],
  },

  // ================================================================== LEARN
  {
    path: "/api/scenario-analysis",
    method: "POST",
    skip: "Spends an LLM call on every probe.",
    budgetMs: 30000,
    tabs: [],
  },

  // ============================================================ OPS / ADMIN
  {
    path: "/api/data-source-status",
    method: "GET",
    schema: anyObject,
    budgetMs: 5000,
    tabs: [],
    // Also gained isAuthenticated() in the same pass (A-5/A-9) — it enumerates
    // the provider stack, so it must not answer unauthenticated callers.
    needsAuth: true,
  },
  // Gained isAuthenticated() in the admin hardening pass (A-9: it discloses
  // which API keys are configured), so the probe must forward the cookie.
  { path: "/api/ai-status", method: "GET", schema: anyObject, budgetMs: 10000, tabs: [], needsAuth: true },
  // Admin routes are session-gated; the probe forwards the caller's cookie, so
  // without needsAuth they would all report a 401 as a route failure.
  { path: "/api/admin/api-keys", method: "GET", schema: anyObject, budgetMs: 5000, tabs: [], needsAuth: true },
  { path: "/api/admin/usage", method: "GET", schema: anyObject, budgetMs: 5000, tabs: [], needsAuth: true },
  {
    path: "/api/admin/api-status",
    method: "GET",
    skip: "Probes every upstream provider itself; running it from the health check would double every provider's call volume.",
    budgetMs: 60000,
    tabs: [],
  },
  {
    path: "/api/admin/run-health-checks",
    method: "GET",
    skip: "This endpoint. Probing itself would recurse.",
    budgetMs: 300000,
    tabs: [],
  },
  { path: "/api/admin/ads", method: "GET", schema: anyObject, budgetMs: 5000, tabs: [], needsAuth: true },
  { path: "/api/admin/backup", method: "GET", schema: anyObject, budgetMs: 15000, tabs: [], needsAuth: true },
  // Budget guard (E-5). GET is read-only — spend vs hard stops plus the kill-flag
  // state — so it is safe to probe. The POST side (clear / trip) is not probed:
  // it mutates the switch that cuts off every paid API.
  {
    path: "/api/admin/budget-guard",
    method: "GET",
    schema: anyObject,
    budgetMs: 10000,
    tabs: [],
    needsAuth: true,
  },
  // Breadth (E-6a). GET is a read-only Supabase view; 503 is the honest
  // "warming up / not configured" answer, not a failure.
  {
    path: "/api/breadth",
    method: "GET",
    schema: anyObject,
    okStatuses: [503],
    budgetMs: 10000,
    tabs: [],
  },
  {
    path: "/api/cron/breadth",
    method: "GET",
    skip: "CRON_SECRET-authenticated pipeline; a probe would spend Polygon calls and write to the closes store.",
    budgetMs: 300000,
    tabs: [],
  },
  {
    path: "/api/cron/fred-snapshot",
    method: "GET",
    skip: "CRON_SECRET-authenticated pipeline; a probe would spend ~17 FRED calls and write to the market_series store.",
    budgetMs: 300000,
    tabs: [],
  },
  {
    path: "/api/cron/quiver-probe",
    method: "GET",
    skip: "CRON_SECRET-gated operator probe; each run spends ~8 metered Quiver calls.",
    budgetMs: 120000,
    tabs: [],
  },
  {
    path: "/api/cron/budget-guard",
    method: "GET",
    skip: "Vercel Cron endpoint, authenticated with CRON_SECRET rather than the admin cookie — the health check has no way to present it, and a probe could trip the shutoff for real.",
    budgetMs: 30000,
    tabs: [],
  },
  {
    path: "/api/auth/login",
    method: "POST",
    // Now also counts against the per-IP brute-force limit (P4-3), so probing
    // it would spend the admin's own allowance and could lock the health check
    // out of the very session it depends on.
    skip: "Authentication side effects, and each probe consumes a rate-limit attempt.",
    budgetMs: 5000,
    tabs: [],
  },
  { path: "/api/auth/logout", method: "POST", skip: "Authentication side effects.", budgetMs: 5000, tabs: [] },
  {
    path: "/api/auth/reset-password",
    method: "POST",
    // No longer sends anything: P4-2 replaced the fake reset with an honest 501
    // carrying the real recovery procedure. Safe to probe, and worth probing —
    // a 200 here would mean the theatre came back.
    schema: z.object({ error: z.string(), recovery: z.array(z.string()) }).passthrough(),
    okStatuses: [501],
    budgetMs: 5000,
    tabs: [],
  },

  // ======================================= UNREFERENCED (AUDIT_BACKLOG P0-1)
  // Deployed surface with no in-repo consumer. Probed so the health check can
  // say whether each one still works — a dead route that also 500s is an easy
  // delete; a dead route that works needs an owner or a deletion decision.
  // /api/qqq-technicals and /api/market-breadth were retired in Phase 5b;
  // lib/qqq-technicals.ts survives because /api/ccpi imports it directly.
  {
    path: "/api/macro-indicators",
    method: "GET",
    schema: anyObject,
    budgetMs: 15000,
    requires: ["FRED_API_KEY"],
    tabs: [],
  },
  {
    path: "/api/yahoo-proxy",
    // Takes `endpoint` + `ticker`, not `symbol` — an earlier canary sent the
    // wrong parameter and this route reported a 400 as if it were broken.
    method: "GET",
    canary: { query: { endpoint: "quote", ticker: "AAPL" } },
    schema: anyObject,
    budgetMs: 12000,
    tabs: [],
  },
  {
    path: "/api/apify-proxy",
    method: "GET",
    schema: anyObject,
    budgetMs: 25000,
    requires: ["APIFY_API_TOKEN"],
    tabs: [],
  },
  {
    path: "/api/google-trends",
    method: "GET",
    canary: { query: { q: "SPY" } },
    schema: anyObject,
    budgetMs: 15000,
    requires: ["SERPER_API_KEY"],
    tabs: [],
  },
  {
    path: "/api/serper-finance",
    method: "GET",
    // The route reads `ticker`, not `q` — the copied google-trends canary sent
    // the wrong param name, so the health check probed it into its own 400
    // guard and reported a working route as failing.
    canary: { query: { ticker: "SPY", endpoint: "quote" } },
    schema: anyObject,
    budgetMs: 15000,
    requires: ["SERPER_API_KEY"],
    tabs: [],
  },
  {
    path: "/api/scraping-bee",
    method: "GET",
    skip: "Billed per request against a small free quota; /api/scraping-bee/diagnostics below already covers it.",
    budgetMs: 25000,
    tabs: [],
  },
  {
    path: "/api/scraping-bee/diagnostics",
    method: "GET",
    schema: anyObject,
    budgetMs: 20000,
    requires: ["SCRAPINGBEE_API_KEY"],
    tabs: [],
  },
]

/** Canonical key -> the routes that need it, for the health report's key panel. */
export function routesByRequiredKey(): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const c of ROUTE_CONTRACTS) {
    for (const k of c.requires ?? []) (out[k] ??= []).push(c.path)
  }
  return out
}

export function getContract(path: string): RouteContract | undefined {
  return ROUTE_CONTRACTS.find((c) => c.path === path)
}
