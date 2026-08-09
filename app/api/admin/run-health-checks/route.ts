import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isAuthenticated } from "@/lib/auth"
import { API_KEY_ALIASES, getDisabledServices, hasRawKey, resolveApiKey } from "@/lib/api-keys"
import { ROUTE_CONTRACTS, type RouteContract, errorShape, routesByRequiredKey } from "@/lib/api-contracts"

/**
 * Probes every route in lib/api-contracts.ts against its declared contract and
 * reports per-route pass/fail, latency and the reason for any failure.
 *
 * Phase 2 deliverable of AUDIT_PLAN.md; the Admin health panel (Phase 5) renders
 * this. Admin-gated because it reveals which API keys are configured and because
 * a full run makes real upstream calls that cost money.
 *
 * Query params:
 *   ?path=/api/vix     probe a single route (repeatable)
 *   ?tab=ccpi          probe only the routes backing one tab
 *   ?includeSkipped=1  report skipped routes with their reasons (no requests)
 *   ?concurrency=4     parallel probes, 1-8, default 4
 */

export const dynamic = "force-dynamic"
export const maxDuration = 300

type Status = "pass" | "fail" | "degraded" | "skipped" | "blocked"

interface Result {
  path: string
  method: string
  status: Status
  httpStatus: number | null
  latencyMs: number | null
  budgetMs: number
  overBudget: boolean
  tabs: string[]
  /** Why it failed, or why it was skipped/blocked. */
  detail: string | null
  /** zod issues, when the body parsed but did not match the contract. */
  schemaIssues?: string[]
  missingKeys?: string[]
}

/** Resolve the origin to probe. Same deployment, so relative would also work,
 *  but an absolute URL keeps this usable from a script or a cron. */
function originFrom(request: NextRequest): string {
  // The REQUEST's own origin comes first: it is the deployment being tested.
  // The first live run proved the old order wrong — NEXT_PUBLIC_BASE_URL points
  // at production, so a preview deployment probed PRODUCTION's routes (old code)
  // against the preview's contracts, and forwarded the admin cookie cross-host
  // (five spurious 401s). Env fallbacks remain only for non-HTTP callers (cron).
  const requestOrigin = new URL(request.url).origin
  if (requestOrigin && requestOrigin !== "null") return requestOrigin
  const envBase = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
  return envBase ? (envBase.startsWith("http") ? envBase : `https://${envBase}`) : "http://localhost:3000"
}

function buildUrl(origin: string, c: RouteContract): string {
  const url = new URL(c.path, origin)
  for (const [k, v] of Object.entries(c.canary?.query ?? {})) url.searchParams.set(k, v)
  return url.toString()
}

async function probe(c: RouteContract, origin: string, sessionCookie: string | null): Promise<Result> {
  const base: Result = {
    path: c.path,
    method: c.method,
    status: "pass",
    httpStatus: null,
    latencyMs: null,
    budgetMs: c.budgetMs,
    overBudget: false,
    tabs: c.tabs,
    detail: null,
  }

  if (c.skip) return { ...base, status: "skipped", detail: c.skip }

  // A route whose keys are absent is not broken — it is unconfigured. Reporting
  // those separately is the difference between "your site is on fire" and
  // "TWELVE_DATA_API_KEY is unset", which the old boolean status could not say.
  const missingKeys = (c.requires ?? []).filter((k) => !resolveApiKey(k))
  if (missingKeys.length > 0) {
    const disabled = getDisabledServices()
    const killed = missingKeys.filter((k) => disabled.includes(k.toUpperCase()))
    return {
      ...base,
      status: "blocked",
      missingKeys,
      detail: killed.length
        ? `Disabled via DISABLED_APIS: ${killed.join(", ")}`
        : `Key(s) not configured: ${missingKeys.join(", ")}`,
    }
  }

  if (c.needsAuth && !sessionCookie) {
    return { ...base, status: "blocked", detail: "Auth-gated route and no session cookie was forwarded." }
  }

  const headers: Record<string, string> = {}
  if (c.method === "POST") headers["content-type"] = "application/json"
  // Vercel Deployment Protection intercepts server-to-server fetches to preview
  // URLs with an HTML auth wall (observed live: every probe returned the same
  // interstitial). With "Protection Bypass for Automation" enabled, Vercel
  // injects this secret as an env var and honors it as a bypass header.
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  if (bypass) headers["x-vercel-protection-bypass"] = bypass
  // Forward the caller's own admin session so auth-gated routes are exercised
  // rather than reporting their 401 as a route failure.
  if (c.needsAuth && sessionCookie) headers.cookie = `admin-session=${sessionCookie}`

  const started = Date.now()
  try {
    const res = await fetch(buildUrl(origin, c), {
      method: c.method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: c.method === "POST" && c.canary?.body ? JSON.stringify(c.canary.body) : undefined,
      cache: "no-store",
      // Hard ceiling well above the soft budget, so a slow route is reported as
      // degraded rather than hanging the whole run.
      signal: AbortSignal.timeout(Math.max(c.budgetMs * 2, 20000)),
    })
    const latencyMs = Date.now() - started
    const overBudget = latencyMs > c.budgetMs

    let body: unknown
    const text = await res.text()
    try {
      body = JSON.parse(text)
    } catch {
      return {
        ...base,
        status: "fail",
        httpStatus: res.status,
        latencyMs,
        overBudget,
        detail: `Response was not JSON (first 120 chars: ${text.slice(0, 120)})`,
      }
    }

    const statusAccepted = res.ok || (c.okStatuses ?? []).includes(res.status)
    if (!statusAccepted) {
      const asError = errorShape.safeParse(body)
      return {
        ...base,
        status: "fail",
        httpStatus: res.status,
        latencyMs,
        overBudget,
        detail: `HTTP ${res.status}${asError.success ? `: ${asError.data.error}` : ""}`,
      }
    }

    // A declared-OK non-200 (e.g. a cache miss) is a working route; the body is
    // a status signal, not the contract shape, so schema checking stops here.
    if (!res.ok) {
      return {
        ...base,
        status: "pass",
        httpStatus: res.status,
        latencyMs,
        overBudget,
        detail: `HTTP ${res.status} is a declared-OK response for this route`,
      }
    }

    // Several routes answer 200 with an `error` field (see AUDIT_BACKLOG P1-11),
    // which a status-only check would score as a pass.
    const asError = errorShape.safeParse(body)
    if (asError.success) {
      return {
        ...base,
        status: "fail",
        httpStatus: res.status,
        latencyMs,
        overBudget,
        detail: `HTTP 200 with an error body: ${asError.data.error}`,
      }
    }

    const parsed = c.schema ? c.schema.safeParse(body) : ({ success: true } as const)
    if (!parsed.success) {
      const issues = (parsed as z.SafeParseError<unknown>).error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      return {
        ...base,
        status: "fail",
        httpStatus: res.status,
        latencyMs,
        overBudget,
        detail: "Response did not match its contract",
        schemaIssues: issues,
      }
    }

    return {
      ...base,
      status: overBudget ? "degraded" : "pass",
      httpStatus: res.status,
      latencyMs,
      overBudget,
      detail: overBudget ? `Took ${latencyMs}ms against a ${c.budgetMs}ms budget` : null,
    }
  } catch (err) {
    const latencyMs = Date.now() - started
    const timedOut = err instanceof Error && err.name === "TimeoutError"
    return {
      ...base,
      status: "fail",
      latencyMs,
      overBudget: latencyMs > c.budgetMs,
      detail: timedOut ? `Timed out after ${latencyMs}ms` : `Request threw: ${String(err)}`,
    }
  }
}

/** Run probes with a small concurrency cap so we do not stampede upstreams. */
async function runAll(
  contracts: RouteContract[],
  origin: string,
  concurrency: number,
  sessionCookie: string | null,
): Promise<Result[]> {
  const results: Result[] = []
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, contracts.length) }, async () => {
    while (cursor < contracts.length) {
      const c = contracts[cursor++]
      results.push(await probe(c, origin, sessionCookie))
    }
  })
  await Promise.all(workers)
  return results.sort((a, b) => a.path.localeCompare(b.path))
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const paths = searchParams.getAll("path")
  const tab = searchParams.get("tab")
  const includeSkipped = searchParams.get("includeSkipped") === "1"
  const concurrency = Math.min(8, Math.max(1, Number(searchParams.get("concurrency")) || 4))

  let selected = ROUTE_CONTRACTS
  if (paths.length) selected = selected.filter((c) => paths.includes(c.path))
  if (tab) selected = selected.filter((c) => c.tabs.includes(tab))

  const origin = originFrom(request)
  const startedAt = Date.now()
  const sessionCookie = request.cookies.get("admin-session")?.value ?? null
  const results = await runAll(selected, origin, concurrency, sessionCookie)
  const visible = includeSkipped ? results : results.filter((r) => r.status !== "skipped")

  const counts = results.reduce<Record<Status, number>>(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    { pass: 0, fail: 0, degraded: 0, skipped: 0, blocked: 0 },
  )

  // Which public tabs have at least one failing dependency.
  const affectedTabs = [...new Set(results.filter((r) => r.status === "fail").flatMap((r) => r.tabs))].sort()

  // Key panel: configured, killed, or absent — plus which routes each key gates.
  const byKey = routesByRequiredKey()
  const disabled = getDisabledServices()
  const keys = Object.keys(API_KEY_ALIASES)
    .sort()
    .map((name) => ({
      name,
      aliases: API_KEY_ALIASES[name],
      /** Which alias spelling is actually set — catches AUDIT_BACKLOG P0-5. */
      resolvedVia: API_KEY_ALIASES[name].find((a) => !!process.env[a]) ?? null,
      configured: hasRawKey(name),
      disabled: disabled.includes(name.toUpperCase()),
      gates: byKey[name] ?? [],
    }))

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    origin,
    durationMs: Date.now() - startedAt,
    summary: {
      total: results.length,
      ...counts,
      /** Green only when nothing failed. Degraded and blocked are not failures. */
      healthy: counts.fail === 0,
      affectedTabs,
    },
    results: visible,
    keys,
    coverage: contractCoverage(),
  })
}

/**
 * Routes that exist on disk but have no contract entry, and vice versa.
 *
 * Without this the report reads as "everything passes" while silently ignoring
 * routes nobody wrote a contract for. The route list is committed rather than
 * read from the filesystem because route handlers are bundled at build time and
 * app/api is not enumerable at runtime on Vercel — regenerate with
 * `pnpm inventory` and paste from SITE_MAP.md §2 when routes are added.
 */
function contractCoverage() {
  const KNOWN_ROUTES = [
    "/api/admin/ads", "/api/admin/api-keys", "/api/admin/api-status",
    "/api/admin/backup", "/api/admin/budget-guard", "/api/admin/run-health-checks",
    "/api/admin/usage",
    "/api/ai-status", "/api/apify-proxy",
    "/api/auth/login", "/api/auth/logout", "/api/auth/reset-password",
    "/api/breadth", "/api/ccpi",
    "/api/ccpi/cache", "/api/ccpi/chat", "/api/ccpi/executive-summary", "/api/ccpi/history",
    "/api/breadth-backtest", "/api/congress-trades", "/api/cpi-inflation", "/api/cron/breadth", "/api/cron/budget-guard", "/api/cron/fred-snapshot", "/api/cron/market-snapshot", "/api/cron/quiver-probe",
    "/api/data-source-status",
    "/api/earnings-calendar", "/api/earnings-calendar/insights", "/api/federal-money",
    // /api/fmp-proxy retired 2026-08-07: its entire body was a hardcoded 410
    // ("requires premium subscription") with no consumer anywhere. FMP_API_KEY
    // itself is still live via lib/fmp-valuation.ts and /api/polygon-tickers.
    "/api/fomc-predictions", "/api/form-144", "/api/google-trends", "/api/hedge-fund-13f",
    "/api/insider-clusters", "/api/insider-trading", "/api/insider-trading/ai-insights",
    "/api/jobs-report", "/api/landmine-check", "/api/macro-indicators",
    "/api/market-sentiment", "/api/panic-euphoria", "/api/politician-spotlight",
    "/api/polygon-proxy", "/api/polygon-tickers",
    "/api/scenario-analysis", "/api/scraping-bee", "/api/scraping-bee/diagnostics",
    "/api/sentiment-heatmap", "/api/serper-finance", "/api/smart-money-etfs",
    "/api/social-sentiment", "/api/strategy-scanner", "/api/time-server", "/api/top-performers",
    "/api/trend-analysis", "/api/vix",
    "/api/vix-history", "/api/yahoo-proxy",
  ]
  const contracted = new Set(ROUTE_CONTRACTS.map((c) => c.path))
  return {
    routesOnDisk: KNOWN_ROUTES.length,
    contracted: contracted.size,
    missingContract: KNOWN_ROUTES.filter((r) => !contracted.has(r)),
    contractWithoutRoute: [...contracted].filter((r) => !KNOWN_ROUTES.includes(r)),
  }
}
