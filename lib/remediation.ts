/**
 * Remediation engine — turns one health-check result into concrete next steps.
 *
 * Owner's requirement (2026-08-07): "when we get fails or errors, we immediately
 * need next steps either for me, or for you — I need to know exactly what to do
 * to remedy or fix the failure, error or warning."
 *
 * INPUT CONTRACT: `HealthResult` mirrors the `Result` interface in
 * app/api/admin/run-health-checks/route.ts, and every branch below is keyed off
 * a `detail` string that endpoint can actually emit. The full set it produces:
 *
 *   skipped  "<the contract's `skip` reason>"
 *   blocked  "Disabled via DISABLED_APIS: X, Y"
 *   blocked  "Key(s) not configured: X, Y"
 *   blocked  "Auth-gated route and no session cookie was forwarded."
 *   fail     "Response was not JSON (first 120 chars: …)"
 *   fail     "HTTP <code>" or "HTTP <code>: <error>"
 *   fail     "HTTP 200 with an error body: <error>"
 *   fail     "Response did not match its contract"  (+ schemaIssues)
 *   fail     "Timed out after <n>ms"
 *   fail     "Request threw: <err>"
 *   degraded "Took <n>ms against a <n>ms budget"
 *   pass     null | "HTTP <code> is a declared-OK response for this route"
 *
 * Nothing else is classified, because nothing else can be produced. A detail the
 * endpoint gains later falls through to `unknown()`, which says so honestly
 * rather than guessing — the same "missing data is null, never invented"
 * discipline CLAUDE.md applies to market data.
 *
 * PURITY: no I/O, no React, no imports. Safe to call from a route, a server
 * component, a client component or a plain Node script.
 */

// ---------------------------------------------------------------- input types

export type ProbeStatus = "pass" | "fail" | "degraded" | "skipped" | "blocked"

/** Mirrors `Result` in app/api/admin/run-health-checks/route.ts. */
export interface HealthResult {
  path: string
  method: string
  status: ProbeStatus
  httpStatus: number | null
  latencyMs: number | null
  budgetMs: number
  overBudget: boolean
  tabs: string[]
  detail: string | null
  schemaIssues?: string[]
  missingKeys?: string[]
}

/** Mirrors one entry of the health report's `keys` array. */
export interface KeySummary {
  name: string
  aliases: string[]
  /** Which alias spelling is actually set in the environment, if any. */
  resolvedVia: string | null
  configured: boolean
  disabled: boolean
  gates: string[]
}

export interface DiagnoseContext {
  keys?: KeySummary[]
}

// --------------------------------------------------------------- output types

/**
 * Who has to act:
 *   owner    — Joel: a dashboard, a billing page, an env var, a decision.
 *   claude   — a code change in this repo.
 *   upstream — nobody here: the provider is having a moment. Wait, re-check.
 */
export type RemediationOwner = "owner" | "claude" | "upstream"

export interface RemediationLink {
  label: string
  url: string
}

export interface Remediation {
  owner: RemediationOwner
  confidence: "certain" | "likely"
  /** One line, plain English, no jargon. */
  headline: string
  /** What the symptom actually means. */
  why: string
  /** Ordered, concrete, copy-pasteable where possible. Never empty. */
  steps: string[]
  /** Self-contained prompt the owner can paste into Claude Code. */
  claudePrompt?: string
  links?: RemediationLink[]
  /** True when a code change alone deterministically fixes it. */
  autoFixable: boolean
}

// ----------------------------------------------------------------- reference data

/**
 * Mirrors API_KEY_ALIASES in lib/api-keys.ts. Duplicated rather than imported so
 * this module stays dependency-free (lib/api-keys.ts reads process.env at module
 * scope). scripts/check-remediation.ts asserts the two tables stay identical.
 */
export const KEY_ALIASES: Record<string, string[]> = {
  POLYGON_API_KEY: ["POLYGON_API_KEY"],
  FRED_API_KEY: ["FRED_API_KEY"],
  TWELVE_DATA_API_KEY: ["TWELVE_DATA_API_KEY", "TWELVEDATA_API_KEY"],
  FMP_API_KEY: ["FMP_API_KEY"],
  ALPHA_VANTAGE_API_KEY: ["ALPHA_VANTAGE_API_KEY"],
  FINNHUB_API_KEY: ["FINNHUB_API_KEY"],
  APIFY_API_TOKEN: ["APIFY_API_TOKEN", "APIFY_API_KEY"],
  QUIVER_API_KEY: ["QUIVER_API_KEY", "QUIVER_QUANT_API_KEY"],
  SCRAPINGBEE_API_KEY: ["SCRAPINGBEE_API_KEY"],
  SERPER_API_KEY: ["SERPER_API_KEY"],
  SERPAPI_KEY: ["SERPAPI_KEY"],
  RESEND_API_KEY: ["RESEND_API_KEY"],
  OPENAI_API_KEY: ["OPENAI_API_KEY"],
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
  TWELVE_DATA_API_KEY: { label: "Twelve Data", dashboard: "https://twelvedata.com/account", status: "https://status.twelvedata.com" },
  FMP_API_KEY: { label: "Financial Modeling Prep", dashboard: "https://site.financialmodelingprep.com/developer/docs/dashboard" },
  ALPHA_VANTAGE_API_KEY: { label: "Alpha Vantage", dashboard: "https://www.alphavantage.co/support/#api-key" },
  FINNHUB_API_KEY: { label: "Finnhub", dashboard: "https://finnhub.io/dashboard", status: "https://status.finnhub.io" },
  APIFY_API_TOKEN: { label: "Apify", dashboard: "https://console.apify.com/account/integrations", status: "https://status.apify.com" },
  QUIVER_API_KEY: { label: "Quiver Quantitative", dashboard: "https://www.quiverquant.com/pricing/" },
  SCRAPINGBEE_API_KEY: { label: "ScrapingBee", dashboard: "https://app.scrapingbee.com/account/dashboard" },
  SERPER_API_KEY: { label: "Serper", dashboard: "https://serper.dev/dashboard" },
  SERPAPI_KEY: { label: "SerpApi", dashboard: "https://serpapi.com/dashboard" },
  RESEND_API_KEY: { label: "Resend", dashboard: "https://resend.com/api-keys", status: "https://resend-status.com" },
  OPENAI_API_KEY: { label: "OpenAI", dashboard: "https://platform.openai.com/account/billing", status: "https://status.openai.com" },
  ANTHROPIC_API_KEY: { label: "Anthropic", dashboard: "https://console.anthropic.com/settings/billing", status: "https://status.anthropic.com" },
  GROQ_API_KEY: { label: "Groq", dashboard: "https://console.groq.com/keys", status: "https://groqstatus.com" },
  XAI_API_KEY: { label: "xAI", dashboard: "https://console.x.ai" },
  GOOGLE_AI_API_KEY: { label: "Google AI Studio", dashboard: "https://aistudio.google.com/app/apikey" },
  OPENROUTER_API_KEY: { label: "OpenRouter", dashboard: "https://openrouter.ai/credits", status: "https://status.openrouter.ai" },
  PERPLEXITY_API_KEY: { label: "Perplexity", dashboard: "https://www.perplexity.ai/settings/api" },
}

const VERCEL_ENV: RemediationLink = {
  label: "Vercel → Project → Settings → Environment Variables",
  url: "https://vercel.com/docs/projects/environment-variables",
}
const VERCEL_PROTECTION: RemediationLink = {
  label: "Vercel Deployment Protection settings",
  url: "https://vercel.com/docs/deployment-protection",
}
const VERCEL_BYPASS: RemediationLink = {
  label: "Protection Bypass for Automation (how it works)",
  url: "https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation",
}

/**
 * Path fragments that identify a provider when the result carries no key info
 * (`missingKeys` is only populated on a `blocked` result). Used only as a
 * fallback after ctx.keys.
 */
const PATH_HINTS: [string, string][] = [
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

// -------------------------------------------------------------------- helpers

/**
 * "/api/vix" -> "app/api/vix/route.ts" — the file a code fix would touch.
 *
 * P7-9: un-exported. It is used only inside this module, and the `export` was
 * load-bearing in the wrong direction — scripts/check-provenance.ts happens to
 * declare a local `const routeFile` for an unrelated absolute path, which the
 * dead-export check counted as a reference until it learned to tell a referrer
 * from a same-named declaration.
 */
function routeFile(path: string): string {
  return `app${path}/route.ts`
}

/** "HTTP 410: Legacy Endpoint" -> 410. Null when the detail is not an HTTP one. */
function parseHttpStatus(detail: string): number | null {
  const m = /^HTTP (\d{3})\b/.exec(detail)
  if (!m) return null
  const code = Number(m[1])
  return Number.isFinite(code) ? code : null
}

/** The message the provider sent back, when the endpoint captured one. */
function upstreamMessage(detail: string): string | null {
  const m = /^HTTP \d{3}: (.+)$/.exec(detail)
  return m ? m[1] : null
}

/** Canonical key names this route depends on: report first, then ctx, then path. */
function keysForRoute(result: HealthResult, ctx?: DiagnoseContext): string[] {
  if (result.missingKeys?.length) return result.missingKeys
  const gated = (ctx?.keys ?? []).filter((k) => k.gates.includes(result.path)).map((k) => k.name)
  if (gated.length) return gated
  const hint = PATH_HINTS.find(([frag]) => result.path.startsWith(frag))
  return hint ? [hint[1]] : []
}

/** Every accepted env-var spelling for a canonical key name. */
function aliasesFor(name: string, ctx?: DiagnoseContext): string[] {
  const fromCtx = ctx?.keys?.find((k) => k.name === name)
  if (fromCtx?.aliases.length) return fromCtx.aliases
  return KEY_ALIASES[name] ?? [name]
}

function providerLinks(names: string[], includeStatus: boolean): RemediationLink[] {
  const links: RemediationLink[] = []
  for (const name of names) {
    const p = PROVIDERS[name]
    if (!p) continue
    links.push({ label: `${p.label} — account & billing`, url: p.dashboard })
    if (includeStatus && p.status) links.push({ label: `${p.label} — status page`, url: p.status })
  }
  return links
}

/** "POLYGON_API_KEY, FRED_API_KEY" or a readable stand-in. */
function nameList(names: string[]): string {
  return names.length ? names.join(", ") : "the provider key for this route"
}

/** Header every claudePrompt starts with, so the prompt stands alone. */
function promptHeader(result: HealthResult): string {
  const tabs = result.tabs.length ? result.tabs.join(", ") : "none (ops-only route)"
  return [
    `The admin health check (/api/admin/run-health-checks) reported this:`,
    `  route:      ${result.method} ${result.path}`,
    `  status:     ${result.status}`,
    `  http:       ${result.httpStatus ?? "none"}`,
    `  latency:    ${result.latencyMs ?? "n/a"}ms against a ${result.budgetMs}ms budget`,
    `  detail:     ${result.detail ?? "(none)"}`,
    `  tabs hit:   ${tabs}`,
  ].join("\n")
}

// ------------------------------------------------------------------ branches

function healthy(result: HealthResult): Remediation {
  const declaredOk = (result.detail ?? "").includes("is a declared-OK response")
  return {
    owner: "owner",
    confidence: "certain",
    headline: "No action needed — this route is working.",
    why: declaredOk
      ? `${result.path} answered ${result.httpStatus}, which its contract declares as a legitimate answer (e.g. a cache miss), in ${result.latencyMs ?? "?"}ms.`
      : `${result.path} answered ${result.httpStatus ?? 200} in ${result.latencyMs ?? "?"}ms, inside its ${result.budgetMs}ms budget, and the body matched its contract.`,
    steps: ["Nothing to do."],
    autoFixable: false,
  }
}

function skipped(result: HealthResult): Remediation {
  return {
    owner: "owner",
    confidence: "certain",
    headline: "No action needed — this route is deliberately not probed.",
    why: `The contract in lib/api-contracts.ts marks ${result.path} as skipped: ${result.detail ?? "no reason recorded"}. A skip is a decision, not a failure — but it also means this route has no automated verification (AUDIT_BACKLOG P2-4).`,
    steps: [
      "Nothing to do right now.",
      "If you want coverage here, the fix is a dry-run mode on the route so a probe costs nothing (AUDIT_BACKLOG P2-4).",
    ],
    autoFixable: false,
  }
}

function killSwitch(result: HealthResult, detail: string, ctx?: DiagnoseContext): Remediation {
  const names = detail.replace(/^Disabled via DISABLED_APIS:\s*/, "").split(/,\s*/).filter(Boolean)
  const keys = names.length ? names : keysForRoute(result, ctx)
  const tabs = result.tabs.length ? result.tabs.join(", ") : "no public tab"
  return {
    owner: "owner",
    confidence: "certain",
    headline: `Switched off on purpose — ${nameList(keys)} is in DISABLED_APIS.`,
    why: `This is the cost kill switch, not a defect. DISABLED_APIS makes resolveApiKey() return an empty string for ${nameList(keys)}, so the app behaves as if the key were never set and ${result.path} falls back to its free/local path. Affected tab(s): ${tabs}.`,
    steps: [
      "Decide first: re-enabling this restarts paid calls to the provider. Check the Costs tab before you flip it.",
      "Open Vercel → your project → Settings → Environment Variables → DISABLED_APIS.",
      `Remove ${nameList(keys)} from the comma-separated list (delete the variable entirely to re-enable everything).`,
      "Redeploy — environment variables are read at request time, but the change only reaches a running deployment after a redeploy.",
      "Re-run the health check; this route should move from blocked to pass.",
    ],
    links: [VERCEL_ENV, ...providerLinks(keys, false)],
    autoFixable: false,
  }
}

function missingKey(result: HealthResult, detail: string, ctx?: DiagnoseContext): Remediation {
  const names = detail.replace(/^Key\(s\) not configured:\s*/, "").split(/,\s*/).filter(Boolean)
  const keys = names.length ? names : keysForRoute(result, ctx)
  const spellings = keys.map((k) => {
    const all = aliasesFor(k, ctx)
    return all.length > 1 ? `${all[0]} (also accepted: ${all.slice(1).join(", ")})` : all[0]
  })
  const tabs = result.tabs.length ? result.tabs.join(", ") : "no public tab"
  return {
    owner: "owner",
    confidence: "certain",
    headline: `Not configured — ${nameList(keys)} is missing from the environment.`,
    why: `The route is not broken; it has no credential to call its provider with. The health check separates this from a failure precisely so "${nameList(keys)} is unset" does not read as "the site is on fire". Affected tab(s): ${tabs}.`,
    steps: [
      `Get the key from the provider dashboard (link below) for: ${nameList(keys)}.`,
      "Open Vercel → your project → Settings → Environment Variables.",
      `Add it under the canonical name — ${spellings.join("; ")}. Any listed alias also resolves, but prefer the canonical spelling so every route sees it.`,
      "Set it for the environment you are testing (Preview for staging, Production for www) — a Production-only variable leaves staging blocked.",
      "Redeploy that environment, then re-run the health check.",
    ],
    links: [VERCEL_ENV, ...providerLinks(keys, false)],
    autoFixable: false,
  }
}

function sessionExpired(result: HealthResult, viaBlocked: boolean): Remediation {
  return {
    owner: "owner",
    confidence: "certain",
    headline: "Your admin session is not reaching this route — log in again.",
    why: viaBlocked
      ? `${result.path} is auth-gated and the probe had no admin-session cookie to forward, so it was not called at all.`
      : `${result.path} answered 401. The health check forwards your own admin-session cookie, but only to the same host it is running on — so a preview deployment probing itself works, while a cross-host probe does not. A 401 here almost always means the session expired mid-run.`,
    steps: [
      "Open /login on the SAME host you are running the health check from (staging probes staging, production probes production).",
      "Log in as admin.",
      "Return to the admin Health tab and re-run the check.",
      "If it 401s again immediately, the admin-session cookie is not being set — check that the login POST returned 200 and that the cookie's domain matches the host.",
    ],
    autoFixable: false,
  }
}

function planOrPermission(result: HealthResult, code: number, detail: string, ctx?: DiagnoseContext): Remediation {
  const keys = keysForRoute(result, ctx)
  const msg = upstreamMessage(detail)
  return {
    owner: "owner",
    confidence: "certain",
    headline:
      code === 402
        ? `The provider is refusing to bill — payment or credit needed for ${nameList(keys)}.`
        : `The provider rejected the key's permissions — plan or scope problem on ${nameList(keys)}.`,
    why: `${result.path} got HTTP ${code}${msg ? ` ("${msg}")` : ""}. That is the upstream saying the credential is valid but not entitled: out of credit, past quota, wrong plan tier, or the key lacks the scope for this endpoint. No code change makes an unentitled key entitled.`,
    steps: [
      `Open the ${keys.length ? nameList(keys) : "provider"} dashboard (link below) and check: balance/credit, current plan tier, and this key's permissions.`,
      "Confirm the plan actually includes the endpoint this route calls — providers often gate individual endpoints, not the whole API.",
      "Top up, upgrade, or regenerate the key with the right scope.",
      "If you regenerate: update the value in Vercel → Settings → Environment Variables and redeploy.",
      "Re-run the health check to confirm.",
    ],
    links: [...providerLinks(keys, false), VERCEL_ENV],
    claudePrompt: `${promptHeader(result)}\n\nHTTP ${code} means the provider says this key is not entitled to the endpoint. Joel is checking the plan/billing side. Meanwhile: read ${routeFile(result.path)} and tell me (a) exactly which upstream endpoint it calls, (b) whether that endpoint is on a paid tier, and (c) whether the route degrades honestly when the provider refuses — per CLAUDE.md, missing data must be null and surfaced as "insufficient data", never 0 or an invented constant.`,
    autoFixable: false,
  }
}

function gone(result: HealthResult, detail: string, ctx?: DiagnoseContext): Remediation {
  const keys = keysForRoute(result, ctx)
  const msg = upstreamMessage(detail)
  return {
    owner: "owner",
    confidence: "certain",
    headline: "Decision needed: this provider endpoint is not on your plan (or no longer exists).",
    why: `${result.path} got HTTP 410 Gone${msg ? ` ("${msg}")` : ""}. Observed live this session on the FMP route. A 410 is not transient and not a bug in our code — the provider has retired the endpoint or fenced it behind a tier you are not on. Retrying will never succeed.`,
    steps: [
      `Open the ${nameList(keys)} dashboard and confirm whether the endpoint exists on a higher tier.`,
      "Then choose one of two paths — this is a decision only you can make:",
      "  (a) UPGRADE — pay for the tier that includes it, and keep the route.",
      `  (b) RETIRE — delete the route. ${result.tabs.length ? `Note that ${result.tabs.join(", ")} depends on it.` : "No public tab depends on it (AUDIT_BACKLOG P2-3 already lists the orphan proxies as deletion candidates)."}`,
      "Tell Claude which path you picked — the prompt below covers (b).",
    ],
    links: providerLinks(keys, false),
    claudePrompt: `${promptHeader(result)}\n\nHTTP 410 means the provider no longer serves this endpoint on our plan. Joel has decided to RETIRE this route rather than upgrade.\n\nPlease: (1) confirm nothing in the repo consumes ${result.path} (grep components/, app/, lib/); (2) delete ${routeFile(result.path)}; (3) remove its entry from lib/api-contracts.ts and from the KNOWN_ROUTES list in app/api/admin/run-health-checks/route.ts; (4) if no other route needs ${nameList(keys)}, note that the key can be removed from Vercel; (5) run pnpm check:contracts, which will fail on any drift between the contract registry and the routes on disk. Do not push to main — staging first, per CLAUDE.md.`,
    autoFixable: false,
  }
}

function rateLimited(result: HealthResult, detail: string, ctx?: DiagnoseContext): Remediation {
  const keys = keysForRoute(result, ctx)
  const msg = upstreamMessage(detail)
  return {
    owner: "claude",
    confidence: "certain",
    headline: "Rate limited — stop probing now, then fix the call volume in code.",
    why: `${result.path} got HTTP 429${msg ? ` ("${msg}")` : ""}: the provider is throttling us. Two separate causes look identical here — the health check itself fanning out too fast, or the route making too many upstream calls per request. Hammering it again makes the throttle window longer, and on metered providers it still costs money.`,
    steps: [
      "Stop re-running the full health check for a few minutes — each run is real upstream traffic.",
      "Re-run just this route (the Health panel's path filter) rather than everything, to see whether it recovers on its own.",
      `Check the ${nameList(keys)} dashboard for the plan's requests-per-minute limit and today's usage.`,
      "If usage is nowhere near the limit, the burst is ours — that is a code fix (caching / lower concurrency / backoff). Use the prompt below.",
      "If usage is at the limit, it is a plan decision: upgrade the tier or cut the call volume.",
    ],
    links: providerLinks(keys, false),
    claudePrompt: `${promptHeader(result)}\n\nHTTP 429 = rate limited. Please look at ${routeFile(result.path)} and: (1) count the upstream calls one request makes (fan-out across tickers is the usual culprit); (2) add a short-TTL cache so repeated requests do not re-hit the provider; (3) add retry-with-exponential-backoff that honors the Retry-After header instead of failing immediately; (4) cap concurrency on any Promise.all fan-out. Keys must resolve through resolveApiKey() in lib/api-keys.ts so DISABLED_APIS still applies. Do not invent placeholder values when a call is dropped — return null and let the UI render "insufficient data" (CLAUDE.md).`,
    autoFixable: true,
  }
}

function serverError(result: HealthResult, code: number, detail: string, ctx?: DiagnoseContext): Remediation {
  const keys = keysForRoute(result, ctx)
  const msg = upstreamMessage(detail)
  const gateway = code === 502 || code === 503 || code === 504
  return {
    owner: "upstream",
    confidence: "likely",
    headline: gateway
      ? "Probably the provider having a moment — wait a few minutes and re-check."
      : "Server error — re-check in a few minutes before treating it as a code bug.",
    why: `${result.path} answered HTTP ${code}${msg ? ` ("${msg}")` : ""}. A single 5xx is most often a transient upstream failure, and re-running is cheaper than investigating. It becomes our bug when it repeats — an unhandled throw inside the route surfaces as a 500 too.`,
    steps: [
      "Wait 3-5 minutes and re-run just this route from the Health panel's path filter.",
      `If it recovers, no action — log it and move on.${keys.length ? ` (Provider status page below covers ${nameList(keys)}.)` : ""}`,
      "If it fails twice in a row, it is ours: check the Vercel runtime logs for this deployment and find the throw.",
      "Then hand it to Claude with the prompt below, including the stack trace from the logs.",
    ],
    links: [
      ...providerLinks(keys, true),
      { label: "Vercel runtime logs for this deployment", url: "https://vercel.com/docs/observability/runtime-logs" },
    ],
    claudePrompt: `${promptHeader(result)}\n\nThis route returned HTTP ${code} on two consecutive runs, so it is not transient. Please read ${routeFile(result.path)} and find what throws. Specifically: (1) is every outbound fetch wrapped with a timeout and a try/catch? (2) does an upstream failure produce a real 5xx with an { error } body, or does it leak an unhandled rejection? (3) does any partial failure path invent a value instead of returning null? Per CLAUDE.md: errors use real HTTP error statuses, and missing data is null, never 0 or a constant. Paste of the Vercel runtime log will follow.`,
    autoFixable: false,
  }
}

function notFound(result: HealthResult, detail: string): Remediation {
  const msg = upstreamMessage(detail)
  return {
    owner: "claude",
    confidence: "likely",
    headline: "The route or its canary parameters are wrong — a code/contract fix.",
    why: `${result.path} answered 404${msg ? ` ("${msg}")` : ""}. Either the handler is not deployed at that path, or the canary request in lib/api-contracts.ts asks for something the route cannot serve. Precedent: the yahoo-proxy canary sent "symbol" when the route takes "endpoint" + "ticker", and a working route was reported broken.`,
    steps: [
      "Open the route in a browser on the same host to see whether the path exists at all.",
      "Compare the canary query in lib/api-contracts.ts with the parameters the handler actually reads.",
      "Hand it to Claude with the prompt below.",
    ],
    claudePrompt: `${promptHeader(result)}\n\nA 404 here means either the handler is missing or the health-check canary is wrong. Please: (1) confirm ${routeFile(result.path)} exists and exports the ${result.method} handler; (2) read which query params it actually requires; (3) compare against the canary declared for ${result.path} in lib/api-contracts.ts and fix whichever side is wrong (the yahoo-proxy entry is the precedent — the canary was wrong, not the route); (4) if the route genuinely no longer exists, remove its contract entry and its line in KNOWN_ROUTES in app/api/admin/run-health-checks/route.ts. Then run pnpm check:contracts.`,
    autoFixable: true,
  }
}

function badRequest(result: HealthResult, code: number, detail: string): Remediation {
  const msg = upstreamMessage(detail)
  return {
    owner: "claude",
    confidence: "likely",
    headline: "The probe is asking wrongly, or the route validates too strictly.",
    why: `${result.path} answered HTTP ${code}${msg ? ` ("${msg}")` : ""} — the route rejected the canary request itself. That is a mismatch between lib/api-contracts.ts and the handler's own parameter validation, not an upstream problem.`,
    steps: [
      "Compare the canary query/body in lib/api-contracts.ts against what the handler validates.",
      "Decide which side is wrong — the same class of mistake as the yahoo-proxy canary.",
      "Hand it to Claude with the prompt below.",
    ],
    claudePrompt: `${promptHeader(result)}\n\nHTTP ${code} on the health-check canary. Please read ${routeFile(result.path)}, list the parameters it requires and validates, compare them with the canary declared for ${result.path} in lib/api-contracts.ts, and fix whichever is wrong. Keep the canary side-effect free and cheap. Then run pnpm check:contracts.`,
    autoFixable: true,
  }
}

function otherClientError(result: HealthResult, code: number, detail: string): Remediation {
  const msg = upstreamMessage(detail)
  return {
    owner: "claude",
    confidence: "likely",
    headline: `Unexpected HTTP ${code} — needs a look at the route.`,
    why: `${result.path} answered HTTP ${code}${msg ? ` ("${msg}")` : ""}, which its contract does not declare as acceptable. A 4xx that is a legitimate answer (a cache miss, for example) belongs in the contract's okStatuses; anything else is a defect.`,
    steps: [
      "Re-run just this route to confirm it is reproducible.",
      "Decide whether this status is a legitimate answer for this route (then it belongs in okStatuses) or a real failure.",
      "Hand it to Claude with the prompt below.",
    ],
    claudePrompt: `${promptHeader(result)}\n\nHTTP ${code} is not in this route's contract. Please read ${routeFile(result.path)} and the entry for ${result.path} in lib/api-contracts.ts, and tell me whether ${code} is a legitimate answer for this route. If it is, add it to okStatuses with a comment explaining why (the ccpi/cache 404 entry is the pattern). If it is not, fix the route. Per CLAUDE.md, errors must use real HTTP error statuses.`,
    autoFixable: true,
  }
}

function errorBody(result: HealthResult, detail: string): Remediation {
  const msg = detail.replace(/^HTTP 200 with an error body:\s*/, "")
  return {
    owner: "claude",
    confidence: "certain",
    headline: "The route reports failure with a success status — a house-rule violation.",
    why: `${result.path} answered HTTP 200 carrying { error: "${msg}" }. Any caller checking res.ok sees success and renders an empty tab as though the data genuinely were empty. CLAUDE.md is explicit: error responses use real HTTP error statuses, never 200 with an { error } body. This is AUDIT_BACKLOG P2-1 / P1-11.`,
    steps: [
      "No dashboard action — this is a code fix.",
      "Copy the prompt below into Claude Code.",
      `The file to change is ${routeFile(result.path)}.`,
      "After the fix, re-run the health check: the route may then legitimately report a 5xx, which points at the real upstream problem the 200 was hiding.",
    ],
    claudePrompt: `${promptHeader(result)}\n\nThis route answers HTTP 200 with an { error } body, which violates the CLAUDE.md rule that error responses use real HTTP error statuses. Please fix ${routeFile(result.path)}: return a real 5xx (or the appropriate 4xx) when the upstream fails, keeping the { error } body for the message. Check whether any component consuming this route relies on the 200 (grep for the path under components/ and app/) and update it to handle the error status. Do not substitute a fallback constant for the missing data — null, and the UI renders "insufficient data" (CLAUDE.md). This is AUDIT_BACKLOG P2-1; /api/form-144, /api/politician-spotlight and /api/top-performers had the same defect.`,
    autoFixable: true,
  }
}

function contractDrift(result: HealthResult): Remediation {
  const issues = result.schemaIssues ?? []
  return {
    owner: "claude",
    confidence: "certain",
    headline: "The response and its contract disagree — check BOTH before assuming the route broke.",
    why: `${result.path} answered ${result.httpStatus ?? 200} but the body did not match the zod schema in lib/api-contracts.ts${issues.length ? `: ${issues.join("; ")}` : "."} Two very different causes look identical: the route drifted, or the contract was over-specified. Live precedent this session — /api/vix returns vix as a NUMBER, and the object-only schema failed a perfectly working route. Check the contract first.`,
    steps: [
      "No dashboard action — this is a code fix.",
      `Look at the raw response yourself: open ${result.path} on the same host and compare it with the reported issues.`,
      "Copy the prompt below into Claude Code.",
    ],
    claudePrompt: `${promptHeader(result)}\n\nSchema issues reported:\n${issues.length ? issues.map((i) => `  - ${i}`).join("\n") : "  (none captured)"}\n\nPlease check BOTH directions before changing anything:\n(1) Did ${routeFile(result.path)} change shape and break its consumers? Then fix the route.\n(2) Or is the schema for ${result.path} in lib/api-contracts.ts over-specified — asserting fields no consumer actually reads? Then loosen the schema. The /api/vix entry is the precedent: production returns vix as a number, the schema demanded an object, and a working route was scored as failing.\nDecide by reading the components that consume this route and asserting only the fields they depend on — that is the stated schema philosophy at the top of lib/api-contracts.ts. Then run pnpm check:contracts.`,
    autoFixable: true,
  }
}

function notJson(result: HealthResult, detail: string): Remediation {
  const snippet = /first 120 chars: ([\s\S]*)\)$/.exec(detail)?.[1] ?? ""
  const looksHtml = /<!doctype|<html|<head|<body/i.test(snippet)
  const looksAuthWall = /authentication required|vercel|sso|log in|sign in/i.test(snippet)

  if (looksHtml || looksAuthWall) {
    return {
      owner: "owner",
      confidence: looksHtml && looksAuthWall ? "certain" : "likely",
      headline: "Something is serving a login page in front of this deployment.",
      why: `${result.path} returned HTML, not JSON${snippet ? ` (starts: "${snippet.slice(0, 80)}")` : ""}. Observed live this session: Vercel Deployment Protection intercepts server-to-server fetches to preview URLs with an HTML auth wall, so every probe gets the same interstitial regardless of whether the route works. The route was never reached.`,
      steps: [
        "Open Vercel → your project → Settings → Deployment Protection.",
        "Either: set Vercel Authentication to Disabled for the Preview environment (simplest for staging),",
        "or: enable Protection Bypass for Automation — Vercel then injects VERCEL_AUTOMATION_BYPASS_SECRET, which the health check already forwards as the x-vercel-protection-bypass header (see the probe() function).",
        "Redeploy so the deployment picks up the setting / the injected secret.",
        "Re-run the health check — if it was the auth wall, every route flips at once.",
      ],
      links: [VERCEL_PROTECTION, VERCEL_BYPASS],
      autoFixable: false,
    }
  }

  return {
    owner: "claude",
    confidence: "likely",
    headline: "The route returned something that is not JSON.",
    why: `${result.path} answered HTTP ${result.httpStatus ?? "?"} with a body that failed JSON.parse${snippet ? ` (starts: "${snippet.slice(0, 80)}")` : ""}. Every contracted route is declared to answer JSON, so this is a route defect — commonly an unhandled crash rendering a framework error page, or a raw upstream body passed straight through.`,
    steps: [
      "Re-run just this route to confirm it is reproducible.",
      "Check the Vercel runtime logs for a crash at the same timestamp.",
      "Copy the prompt below into Claude Code.",
    ],
    claudePrompt: `${promptHeader(result)}\n\nBody started with: ${snippet ? `"${snippet}"` : "(not captured)"}\n\nThe response was not JSON. Please read ${routeFile(result.path)} and find where a non-JSON body can escape: an unhandled throw rendering an error page, a passthrough of a raw upstream body, or a redirect. Every response must be NextResponse.json with a real HTTP status (CLAUDE.md). Fix it and confirm the contract in lib/api-contracts.ts still describes the shape.`,
    autoFixable: true,
  }
}

function timedOut(result: HealthResult): Remediation {
  return {
    owner: "claude",
    confidence: "certain",
    headline: "The route never answered — it needs caching or a smaller fan-out.",
    why: `${result.path} was aborted after ${result.latencyMs ?? "?"}ms. The probe's hard ceiling is twice the ${result.budgetMs}ms budget (minimum 20s), so this route did not merely run slow — it produced nothing. In production the user sees a spinner that never resolves.`,
    steps: [
      "No dashboard action — this is a code fix.",
      "Re-run just this route once to rule out a one-off upstream stall.",
      "Copy the prompt below into Claude Code.",
    ],
    claudePrompt: `${promptHeader(result)}\n\nThe probe aborted this route before it answered. Please read ${routeFile(result.path)} and reduce the wall-clock cost: (1) is there an unbounded fan-out (one upstream call per ticker/date) that can be narrowed or batched? (2) does every outbound fetch carry its own AbortSignal.timeout, so one slow provider cannot hold the whole response? (3) can the result be cached — the response is the same for every visitor for at least a few minutes in most of these routes; (4) if the latency is genuinely inherent, say so and raise budgetMs for ${result.path} in lib/api-contracts.ts with a comment recording the measured time, rather than leaving a permanent red mark. Partial results must be honest: omit what could not be fetched rather than filling it in (CLAUDE.md).`,
    autoFixable: true,
  }
}

function overBudget(result: HealthResult): Remediation {
  return {
    owner: "claude",
    confidence: "certain",
    headline: "Answers correctly, but too slowly — cache it or raise the documented budget.",
    why: `${result.path} took ${result.latencyMs ?? "?"}ms against a ${result.budgetMs}ms budget. The data is correct; the wait is the defect. Live precedent this session: /api/earnings-calendar answered in roughly 33s against a 20s budget — a real user-facing stall, not a measurement artefact.`,
    steps: [
      "No dashboard action — this is a code fix or a budget decision.",
      "Re-run just this route once: a single slow run can be an upstream hiccup rather than a trend.",
      "If it is consistently slow, copy the prompt below into Claude Code.",
      `Decide honestly: either make it faster, or raise budgetMs for ${result.path} in lib/api-contracts.ts and record the measured number in a comment. A budget nobody believes is worse than no budget.`,
    ],
    claudePrompt: `${promptHeader(result)}\n\nThis route answers correctly but over budget (${result.latencyMs ?? "?"}ms vs ${result.budgetMs}ms). Please read ${routeFile(result.path)} and: (1) identify the dominant cost — usually a per-item fan-out of upstream calls; (2) add a short-TTL cache if the payload is the same for all visitors (note AUDIT_BACKLOG P2-2: a module-level variable is NOT a cache on Vercel — each invocation may get a fresh isolate, so use a shared store); (3) narrow or batch the fan-out; (4) if the latency is inherent to the provider, do not pretend otherwise — raise budgetMs in lib/api-contracts.ts with a comment stating the measured latency and why. /api/earnings-calendar at ~33s against a 20s budget is the live example.`,
    autoFixable: true,
  }
}

function threw(result: HealthResult, detail: string): Remediation {
  const err = detail.replace(/^Request threw:\s*/, "")

  if (/UNABLE_TO_VERIFY_LEAF_SIGNATURE|CERT_|SELF_SIGNED/i.test(err)) {
    return {
      owner: "owner",
      confidence: "certain",
      headline: "TLS interception on this machine — not a defect in the site.",
      why: `The request to ${result.path} failed certificate validation (${err}). This is AUDIT_BACKLOG P2-6: outbound HTTPS from this workstation is intercepted, so no upstream-dependent route can be verified locally. It says nothing about production.`,
      steps: [
        "Do not change any code for this — nothing here is broken.",
        "Re-run the health check against https://staging.options-calculators.com instead of localhost.",
        "Treat local runs as proof of routing, auth, schema wiring and error handling only.",
      ],
      autoFixable: false,
    }
  }

  if (/ECONNREFUSED|fetch failed.*localhost|ENOTFOUND localhost/i.test(err)) {
    return {
      owner: "owner",
      confidence: "certain",
      headline: "Nothing is listening at the address being probed.",
      why: `The request to ${result.path} was refused (${err}). The health check probes its own origin, so this means the server it is running against is not up, or the origin resolved to a host that is not serving.`,
      steps: [
        "If running locally: start the dev server with `pnpm dev` and re-run.",
        "If running on a deployment: confirm the deployment finished building and is not in an error state.",
        "Check the `origin` field at the top of the health report — it tells you exactly what was probed.",
      ],
      autoFixable: false,
    }
  }

  return {
    owner: "upstream",
    confidence: "likely",
    headline: "The request never completed — re-check before digging in.",
    why: `The fetch to ${result.path} threw before any response arrived: ${err}. A transport-level throw is usually a network or DNS blip; it becomes ours if it repeats.`,
    steps: [
      "Wait a couple of minutes and re-run just this route.",
      "Check the `origin` field on the health report — a probe pointed at the wrong host throws exactly like this.",
      "If it repeats, hand it to Claude with the prompt below.",
    ],
    claudePrompt: `${promptHeader(result)}\n\nThe fetch threw before any response: ${err}. This reproduced across runs. Please check ${routeFile(result.path)} for an unhandled outbound failure, and check originFrom() in app/api/admin/run-health-checks/route.ts in case the probe is targeting the wrong host (that function already carries a comment about a previous origin-resolution defect that produced five spurious 401s).`,
    autoFixable: false,
  }
}

/**
 * A key that resolves only through a NON-canonical alias. Not a failure — but
 * AUDIT_BACKLOG P0-5: any route reading process.env directly (P1-12) sees
 * nothing, so the provider is half-configured.
 */
function aliasMismatch(result: HealthResult, ctx?: DiagnoseContext): Remediation | null {
  const offenders = (ctx?.keys ?? []).filter(
    (k) => k.gates.includes(result.path) && k.resolvedVia !== null && k.resolvedVia !== k.name,
  )
  if (offenders.length === 0) return null
  const names = offenders.map((k) => k.name)
  return {
    owner: "owner",
    confidence: "certain",
    headline: `Works, but half-configured — ${nameList(names)} is set under a non-canonical name.`,
    why: `${offenders
      .map((k) => `${k.name} is actually set as ${k.resolvedVia}`)
      .join("; ")}. resolveApiKey() accepts the alias so this route passes, but any code reading process.env directly sees nothing (AUDIT_BACKLOG P0-5 and P1-12). The result is a provider that works on some tabs and is silently dead on others.`,
    steps: [
      "Open Vercel → your project → Settings → Environment Variables.",
      ...offenders.map((k) => `Add ${k.name} with the same value currently under ${k.resolvedVia}, then delete ${k.resolvedVia}.`),
      "Do it in every environment where the alias is set (Production and Preview are configured separately).",
      "Redeploy, then re-run the health check — the Keys panel's 'Resolved via' column should show the canonical name with no amber flag.",
    ],
    links: [VERCEL_ENV],
    autoFixable: false,
  }
}

function unknown(result: HealthResult, detail: string): Remediation {
  return {
    owner: "claude",
    confidence: "likely",
    headline: "Unrecognised failure — the remediation engine has no rule for this yet.",
    why: `${result.path} reported status "${result.status}" with detail "${detail || "(none)"}", which lib/remediation.ts does not classify. Rather than guess at a fix, it says so — an invented next step would be worse than none.`,
    steps: [
      "Re-run just this route to confirm it is reproducible.",
      "Copy the prompt below into Claude Code so the rule gets added.",
    ],
    claudePrompt: `${promptHeader(result)}\n\nlib/remediation.ts has no branch for this detail string. Please: (1) find where app/api/admin/run-health-checks/route.ts emits it; (2) work out the actual cause for ${routeFile(result.path)}; (3) add a branch to diagnose() in lib/remediation.ts with the correct owner ("owner" for a dashboard/env/billing action, "claude" for a code fix, "upstream" for wait-and-retry) and concrete steps; (4) add a case to scripts/check-remediation.ts covering it. Every branch must be reachable from a real detail string the endpoint can emit.`,
    autoFixable: false,
  }
}

// ------------------------------------------------------------------- entry point

/**
 * Classify one health-check result into a concrete set of next steps.
 *
 * `ctx.keys` is the health report's `keys` array. It is optional: without it the
 * engine still classifies every failure, it just cannot name alias mismatches or
 * look up which provider gates an un-keyed route.
 */
export function diagnose(result: HealthResult, ctx?: DiagnoseContext): Remediation {
  const detail = result.detail ?? ""

  if (result.status === "skipped") return skipped(result)

  if (result.status === "blocked") {
    if (detail.startsWith("Disabled via DISABLED_APIS")) return killSwitch(result, detail, ctx)
    if (detail.startsWith("Key(s) not configured")) return missingKey(result, detail, ctx)
    if (detail.startsWith("Auth-gated route")) return sessionExpired(result, true)
    return unknown(result, detail)
  }

  if (result.status === "pass") {
    return aliasMismatch(result, ctx) ?? healthy(result)
  }

  // Everything below is "fail" or "degraded".
  if (result.status === "degraded" || detail.startsWith("Took ")) return overBudget(result)
  if (detail.startsWith("Timed out after")) return timedOut(result)
  if (detail.startsWith("Request threw:")) return threw(result, detail)
  if (detail.startsWith("Response was not JSON")) return notJson(result, detail)
  if (detail.startsWith("HTTP 200 with an error body")) return errorBody(result, detail)
  if (detail.startsWith("Response did not match its contract")) return contractDrift(result)

  const code = parseHttpStatus(detail)
  if (code !== null) {
    if (code === 401) return sessionExpired(result, false)
    if (code === 402 || code === 403) return planOrPermission(result, code, detail, ctx)
    if (code === 410) return gone(result, detail, ctx)
    if (code === 429) return rateLimited(result, detail, ctx)
    if (code >= 500) return serverError(result, code, detail, ctx)
    if (code === 404) return notFound(result, detail)
    if (code === 400 || code === 422) return badRequest(result, code, detail)
    if (code >= 400) return otherClientError(result, code, detail)
  }

  return unknown(result, detail)
}
