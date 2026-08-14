import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isAuthenticated, isPasswordHashed } from "@/lib/auth"
import { API_KEY_ALIASES, getDisabledServices, hasRawKey, resolveApiKey } from "@/lib/api-keys"
import { ROUTE_CONTRACTS, type RouteContract, errorShape, routesByRequiredKey } from "@/lib/api-contracts"
import { getSeriesCoverage } from "@/lib/market-series"
import { FRED_SERIES } from "@/lib/market-snapshot"
import { getStaleUniverseMembers } from "@/lib/market-closes"
import { BREADTH_UNIVERSE, BREADTH_UNIVERSE_AS_OF } from "@/lib/breadth-universe"
import { BUDGET_ENV_NAMES } from "@/lib/budget-env"
import { REFERENCE_DRAWDOWNS } from "@/lib/ccpi/drawdowns"

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

/**
 * Per-series store coverage, with the consequence spelled out rather than left
 * for the reader to work out: how many reference drawdowns each series can
 * actually be scored against. A series with 800 points covers nothing, and
 * "800 points stored" on its own reads like success.
 */
async function seriesCoverageReport() {
  const rows = await Promise.all(FRED_SERIES.map((s) => getSeriesCoverage(`fred:${s.id}`)))
  return rows.filter(Boolean).map((r) => {
    const cov = r!.earliest ? REFERENCE_DRAWDOWNS.filter((d) => d.peak >= r!.earliest!).length : 0
    return {
      series: r!.series,
      points: r!.points,
      earliest: r!.earliest,
      latest: r!.latest,
      drawdownsTestable: `${cov} of ${REFERENCE_DRAWDOWNS.length}`,
    }
  })
}

/**
 * How much of the CCPI is actually being measured, per pillar.
 *
 * P7-69. Measured on staging 2026-08-14: Valuation `scoredMax=0` and Risk
 * Appetite `scoredMax=24`, both under `MIN_SCORED_MAX`, so the headline index
 * was computed over **55 of the 100 points of pillar weight** — and nothing
 * failed, nothing warned, and the entire signal was a `certainty: 56` sitting
 * in a JSON payload beside a confident-looking score.
 *
 * The scoring was right. `scorePillar` excludes anything not `live`,
 * `MIN_SCORED_MAX` refuses to publish a pillar under 40, and the composite
 * renormalises over what survived. Every piece of machinery the audit built for
 * this case did its job. What did not exist was anything that SAID SO.
 *
 * That is the same shape as `budgetEnvReport` above: a state the code handles
 * correctly and no one is told about, whose cause is usually a dashboard
 * setting rather than a bug. Here the causes were `APIFY_API_TOKEN` unset and
 * three ScrapingBee scrapes falling through to the LLM chain — both visible in
 * `apiStatus`, neither surfaced anywhere a person looks.
 *
 * A dropped pillar is reported `degraded`, not `fail`: refusing to score on
 * absent data is correct behaviour, and marking it a failure would train the
 * reader to ignore this block. `fail` is reserved for the case that cannot be
 * intentional — no pillar scoring at all, which is the 503 state.
 */
async function ccpiPillarCoverage(origin: string) {
  const PILLARS = ["momentum", "riskAppetite", "valuation", "macro"] as const
  try {
    // No cookie: /api/ccpi is public. Forwarding the admin session here would
    // be a credential sent where it is not needed, and the probe above already
    // showed how easily that goes cross-host (see `originFrom`).
    const res = await fetch(`${origin}/api/ccpi`, {
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    })
    if (!res.ok) {
      return { status: "blocked" as Status, detail: `/api/ccpi answered ${res.status}`, pillars: [], certainty: null }
    }
    const body = await res.json()
    const prov = body?.provenance ?? {}
    const pillars = PILLARS.map((key) => {
      const b = prov[key] ?? {}
      const scoredMax = typeof b.scoredMax === "number" ? b.scoredMax : null
      return {
        pillar: key,
        scoredMax,
        liveMax: typeof b.liveMax === "number" ? b.liveMax : null,
        // Weight dropped for being AI-estimated, which is a different fact from
        // weight that has no source at all (P6-34).
        aiMax: typeof b.aiMax === "number" ? b.aiMax : null,
        scored: typeof body?.pillars?.[key] === "number",
        excluded: Array.isArray(b.excluded) ? b.excluded : [],
      }
    })
    const dropped = pillars.filter((p) => !p.scored).map((p) => p.pillar)
    const certainty = typeof body?.certainty === "number" ? body.certainty : null
    const status: Status = dropped.length === PILLARS.length ? "fail" : dropped.length > 0 ? "degraded" : "pass"
    return {
      status,
      detail:
        dropped.length === 0
          ? null
          : `${dropped.join(", ")} reported no score — the composite is renormalised over the rest. Check apiStatus for the provider behind each excluded input.`,
      certainty,
      pillars,
    }
  } catch (e) {
    return {
      status: "blocked" as Status,
      detail: `could not read /api/ccpi: ${e instanceof Error ? e.message : String(e)}`,
      certainty: null,
      pillars: [],
    }
  }
}

/**
 * The three budget limits, as the DEPLOYMENT actually resolves them (P6-86).
 *
 * `scripts/check-budget-env.ts` and `lib/budget-env.ts` pin the CODE: a blank
 * variable falls back to the default while a configured "0" is honoured as
 * zero, and the two are distinguished. None of that says anything about what is
 * in Vercel, and the difference matters most in the one case the code cannot
 * see — a variable that EXISTS WITH NO VALUE. `Number("")` is `0`, not `NaN`,
 * so before P7-43 that shape read as a deliberate "cut off immediately" and
 * killed every metered API on the first cent of spend, with nothing on screen
 * to explain it. Vercel produces exactly that shape whenever a variable is
 * created and left empty.
 *
 * The finding was closed as "the owner will check the dashboard". A dashboard
 * check is a point-in-time answer to a question that can change silently, which
 * is the shape of every other finding in this audit. So it is reported here on
 * every health-check run instead.
 *
 * NO VALUES ARE RETURNED, only the state. A budget ceiling is not a credential,
 * but there is no reason to publish it either, and `state` is the whole of what
 * anyone needs to act on:
 *
 *   `unset`      — absent. The default applies. Correct and intended.
 *   `configured` — present with a parseable, non-negative number.
 *   `BLANK`      — present and empty. The operator error this exists to catch.
 *   `unparseable`— present but not a number; falls back, which hides a typo.
 */
function budgetEnvReport() {
  const entries = (Object.entries(BUDGET_ENV_NAMES) as [string, string][]).map(([key, name]) => {
    const raw = process.env[name]
    const trimmed = raw?.trim()
    let state: "unset" | "configured" | "BLANK" | "unparseable"
    if (raw === undefined) state = "unset"
    else if (!trimmed) state = "BLANK"
    else {
      const n = Number(trimmed)
      state = Number.isFinite(n) && n >= 0 ? "configured" : "unparseable"
    }
    return { key, name, state }
  })

  const bad = entries.filter((e) => e.state === "BLANK" || e.state === "unparseable")
  return {
    status: bad.length === 0 ? ("ok" as const) : ("misconfigured" as const),
    note:
      bad.length === 0
        ? `All ${entries.length} budget variables are either unset (default applies) or hold a usable number.`
        : `${bad.map((e) => `${e.name} is ${e.state}`).join("; ")}. A blank variable is not the same as an unset one to an operator reading the dashboard, and it used to mean "spend zero".`,
    vars: entries,
  }
}

/**
 * Breadth-universe members whose stored history has stopped advancing.
 *
 * P7-40 found `MMC` seven months after it went dark, by hand, with a query
 * somebody had to think of running. The failure was invisible precisely because
 * the system degraded well: breadth divides only by tickers holding a full
 * 200-day window, so the published percentage stayed correct while
 * `sample_size` quietly read 99/100.
 *
 * `status` is the part worth reading. `unavailable` means the store could not
 * be reached — NOT that everything is fine — because "no stale members found"
 * and "never looked" must not render as the same line. That distinction is the
 * one this audit has had to make in a dozen other places.
 *
 * MMC was removed from the universe on 2026-08-13 (owner's decision), so the
 * list is 99 and `sample_size` can now reach `universe_size`. Keeping it had
 * been the conservative choice — removing a member changes what the percentage
 * is a percentage of — but the paragraph above records why that reasoning was
 * wrong: **the denominator had already moved.** A delisted member is excluded
 * from every window whether or not the constant still names it, so the constant
 * was not protecting the denominator, only hiding that it had changed.
 * `lib/breadth-universe.ts` now carries `BREADTH_UNIVERSE_REMOVED` so an
 * absence has to be written down.
 */
async function universeFreshnessReport() {
  const stale = await getStaleUniverseMembers(BREADTH_UNIVERSE)
  if (stale === null) {
    return {
      status: "unavailable" as const,
      note: "Store unreachable — this is NOT a clean result. No conclusion can be drawn about universe freshness.",
      universeSize: BREADTH_UNIVERSE.length,
      asOf: BREADTH_UNIVERSE_AS_OF,
      stale: [] as { ticker: string; lastDay: string | null; daysBehind: number | null }[],
    }
  }
  return {
    status: stale.length === 0 ? ("ok" as const) : ("stale-members" as const),
    note:
      stale.length === 0
        ? `All ${BREADTH_UNIVERSE.length} universe members have a stored close within the last 6 days.`
        : `${stale.length} of ${BREADTH_UNIVERSE.length} universe members stopped updating. A member that stops resolving upstream is silently excluded from every breadth window, so sample_size drops without the number itself ever looking wrong.`,
    universeSize: BREADTH_UNIVERSE.length,
    asOf: BREADTH_UNIVERSE_AS_OF,
    stale,
  }
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
    security: securityPosture(),
    // What the store actually HOLDS, per series (CCPI Phase 1). A backfill
    // reports rows written, which an upsert over the same 800 days inflates to
    // look identical to a 25-year load. `earliest` is the number that decides
    // which reference drawdowns are testable, so it is reported beside a count
    // of exactly that.
    seriesCoverage: await seriesCoverageReport(),
    universeFreshness: await universeFreshnessReport(),
    budgetEnv: budgetEnvReport(),
    ccpiPillarCoverage: await ccpiPillarCoverage(origin),
  })
}

/**
 * Which credential source the deployment is actually running on.
 *
 * Nothing in the app reported this. The only signal that admin auth was still
 * on the plaintext ADMIN_PASSWORD was a server-side console warning nobody
 * reads, so "did the hash migration land?" could not be answered from outside
 * the box — it had to be taken on trust. Names and booleans only; no value,
 * no prefix, no length.
 */
function securityPosture() {
  // P7-9. `hasHash` used to be its own `Boolean(process.env.ADMIN_PASSWORD_HASH)`
  // here while `lib/auth.ts` exported `isPasswordHashed()` — the same question,
  // asked twice, and the copy in this file was the one that could drift from
  // the module that actually decides which credential path runs. (It was also
  // why `isPasswordHashed` showed up as a dead export whose docstring said "for
  // the admin UI": the UI had reimplemented it.) The reader now asks the
  // verifier.
  const hasHash = isPasswordHashed()
  const hasPlaintext = Boolean(process.env.ADMIN_PASSWORD)
  return {
    adminPasswordSource: hasHash ? "hash" : hasPlaintext ? "plaintext" : "unset",
    /** Both set means the migration is half-done: delete ADMIN_PASSWORD. */
    adminPasswordPlaintextStillPresent: hasHash && hasPlaintext,
    /** A cron route answers 503 rather than 401 when this is missing. */
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    encryptionKeyConfigured: Boolean(process.env.ENCRYPTION_KEY),
    notes: [
      !hasHash && hasPlaintext
        ? "Admin auth is on the PLAINTEXT ADMIN_PASSWORD. Generate a hash with `node scripts/hash-admin-password.ts` and set ADMIN_PASSWORD_HASH."
        : null,
      hasHash && hasPlaintext
        ? "ADMIN_PASSWORD_HASH is in use, but the plaintext ADMIN_PASSWORD is still set. Delete it — it is a second, weaker key to the same door."
        : null,
      !hasHash && !hasPlaintext ? "No admin credential configured at all: login cannot succeed." : null,
      !process.env.CRON_SECRET ? "CRON_SECRET is unset — every cron route returns 503 and no snapshot will run." : null,
    ].filter(Boolean),
  }
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
    "/api/admin/backup", "/api/admin/budget-guard", "/api/admin/ccpi-backtest",
    "/api/admin/run-health-checks",
    "/api/admin/source-probe",
    "/api/admin/usage",
    "/api/ai-status", "/api/apify-proxy", "/api/ccpi-signals",
    "/api/auth/login", "/api/auth/logout", "/api/auth/reset-password",
    "/api/breadth", "/api/ccpi",
    "/api/ccpi/chat", "/api/ccpi/executive-summary", "/api/ccpi/history",
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
    "/api/serper-finance", "/api/smart-money-etfs",
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
