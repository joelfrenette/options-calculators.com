/**
 * Verifies lib/remediation.ts classifies every failure mode the health-check
 * endpoint can actually emit, and routes each one to the right person.
 *
 * Run: node scripts/check-remediation.ts
 *
 * Each case below is a synthetic `HealthResult` whose `detail` string is copied
 * verbatim from a template in app/api/admin/run-health-checks/route.ts — if that
 * endpoint changes its wording, these cases stop matching and this script fails,
 * which is the point. Invariants asserted for every case:
 *   1. the expected owner (owner / claude / upstream),
 *   2. `steps` is non-empty — a remediation with no next step is not a remediation,
 *   3. owner === "claude" implies a self-contained `claudePrompt`,
 *   4. `headline` and `why` are non-empty.
 *
 * It also asserts the alias table mirrored in lib/remediation.ts still matches
 * API_KEY_ALIASES in lib/api-keys.ts, since the missing-key remediation names
 * the exact env-var spellings the owner has to set.
 */

import { diagnose, KEY_ALIASES, type HealthResult, type KeySummary, type RemediationOwner } from "../lib/remediation.ts"
import { API_KEY_ALIASES } from "../lib/api-keys.ts"

let failures = 0
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
}

/** Minimal result; each case overrides only what matters to its branch. */
function result(over: Partial<HealthResult>): HealthResult {
  return {
    path: "/api/vix",
    method: "GET",
    status: "fail",
    httpStatus: null,
    latencyMs: 120,
    budgetMs: 8000,
    overBudget: false,
    tabs: ["risk-management"],
    detail: null,
    ...over,
  }
}

const KEYS: KeySummary[] = [
  {
    name: "FMP_API_KEY",
    aliases: ["FMP_API_KEY"],
    resolvedVia: "FMP_API_KEY",
    configured: true,
    disabled: false,
    gates: ["/api/fmp-proxy"],
  },
  {
    // Was TWELVE_DATA_API_KEY; swapped to APIFY when that provider was purged
    // (2026-08-29 admin audit). APIFY has the same two-alias shape, so it still
    // exercises the "key set under the non-canonical spelling" path (P0-5).
    name: "APIFY_API_TOKEN",
    aliases: ["APIFY_API_TOKEN", "APIFY_API_KEY"],
    resolvedVia: "APIFY_API_KEY",
    configured: true,
    disabled: false,
    gates: ["/api/apify-proxy"],
  },
]

interface Case {
  label: string
  input: HealthResult
  ctx?: { keys?: KeySummary[] }
  owner: RemediationOwner
  /** Substring the `why` or `steps` must mention, proving the branch is specific. */
  mentions?: string
}

const CASES: Case[] = [
  // ------------------------------------------------------------ blocked modes
  {
    label: "blocked / DISABLED_APIS kill switch",
    input: result({
      path: "/api/apify-proxy",
      status: "blocked",
      detail: "Disabled via DISABLED_APIS: APIFY_API_TOKEN",
      missingKeys: ["APIFY_API_TOKEN"],
      latencyMs: null,
    }),
    owner: "owner",
    mentions: "DISABLED_APIS",
  },
  {
    label: "blocked / key not configured",
    input: result({
      path: "/api/apify-proxy",
      status: "blocked",
      detail: "Key(s) not configured: APIFY_API_TOKEN",
      missingKeys: ["APIFY_API_TOKEN"],
      latencyMs: null,
    }),
    owner: "owner",
    // The missing-key remediation must name every accepted alias.
    mentions: "APIFY_API_KEY",
  },
  {
    label: "blocked / auth-gated with no session cookie",
    input: result({
      path: "/api/admin/usage",
      status: "blocked",
      detail: "Auth-gated route and no session cookie was forwarded.",
      latencyMs: null,
      tabs: [],
    }),
    owner: "owner",
    mentions: "/login",
  },

  // --------------------------------------------------------------- HTTP modes
  {
    label: "HTTP 401 / admin session expired",
    input: result({ path: "/api/admin/api-keys", status: "fail", httpStatus: 401, detail: "HTTP 401: Unauthorized", tabs: [] }),
    owner: "owner",
    mentions: "/login",
  },
  {
    label: "HTTP 402 / payment required at the provider",
    input: result({ path: "/api/fmp-proxy", status: "fail", httpStatus: 402, detail: "HTTP 402", tabs: [] }),
    ctx: { keys: KEYS },
    owner: "owner",
    mentions: "billing",
  },
  {
    label: "HTTP 403 / plan or scope refused",
    input: result({ path: "/api/polygon-proxy", status: "fail", httpStatus: 403, detail: "HTTP 403: Forbidden" }),
    owner: "owner",
    mentions: "plan",
  },
  {
    label: "HTTP 410 / provider retired the endpoint (live FMP case)",
    input: result({ path: "/api/fmp-proxy", status: "fail", httpStatus: 410, detail: "HTTP 410: Legacy Endpoint", tabs: [] }),
    ctx: { keys: KEYS },
    owner: "owner",
    mentions: "RETIRE",
  },
  {
    label: "HTTP 429 / rate limited",
    input: result({ path: "/api/polygon-tickers", status: "fail", httpStatus: 429, detail: "HTTP 429: Too Many Requests" }),
    owner: "claude",
    mentions: "backoff",
  },
  {
    label: "HTTP 500 / transient upstream first",
    input: result({ path: "/api/congress-trades", status: "fail", httpStatus: 500, detail: "HTTP 500: fetch failed" }),
    owner: "upstream",
    mentions: "few minutes",
  },
  {
    label: "HTTP 503 / gateway-class upstream failure",
    input: result({ path: "/api/insider-trading", status: "fail", httpStatus: 503, detail: "HTTP 503" }),
    owner: "upstream",
    mentions: "status page",
  },
  {
    label: "HTTP 404 / route missing or canary wrong",
    input: result({ path: "/api/yahoo-proxy", status: "fail", httpStatus: 404, detail: "HTTP 404: Not Found", tabs: [] }),
    owner: "claude",
    mentions: "canary",
  },
  {
    label: "HTTP 400 / canary parameters rejected",
    input: result({ path: "/api/yahoo-proxy", status: "fail", httpStatus: 400, detail: "HTTP 400: missing ticker", tabs: [] }),
    owner: "claude",
    mentions: "lib/api-contracts.ts",
  },
  {
    label: "HTTP 418 / undeclared client status",
    input: result({ path: "/api/ccpi/cache", status: "fail", httpStatus: 418, detail: "HTTP 418" }),
    owner: "claude",
    mentions: "okStatuses",
  },

  // ------------------------------------------------------------- body / shape
  {
    label: "HTTP 200 with an error body (CLAUDE.md violation)",
    input: result({
      path: "/api/form-144",
      status: "fail",
      httpStatus: 200,
      detail: 'HTTP 200 with an error body: fetch failed',
      tabs: ["form-144"],
    }),
    owner: "claude",
    mentions: "real HTTP error statuses",
  },
  {
    label: "contract mismatch / check BOTH directions (live /api/vix case)",
    input: result({
      path: "/api/vix",
      status: "fail",
      httpStatus: 200,
      detail: "Response did not match its contract",
      schemaIssues: ["vix: Expected object, received number"],
    }),
    owner: "claude",
    mentions: "over-specified",
  },
  {
    label: "not JSON / HTML auth wall (live Vercel Authentication case)",
    input: result({
      path: "/api/vix",
      status: "fail",
      httpStatus: 401,
      detail:
        'Response was not JSON (first 120 chars: <!doctype html><html><head><title>Authentication Required</title></head><body>Vercel Authentication)',
    }),
    owner: "owner",
    mentions: "Deployment Protection",
  },
  {
    label: "not JSON / genuine non-JSON body",
    input: result({
      path: "/api/vix",
      status: "fail",
      httpStatus: 500,
      detail: "Response was not JSON (first 120 chars: Internal Server Error)",
    }),
    owner: "claude",
    mentions: "NextResponse.json",
  },

  // ----------------------------------------------------------------- latency
  {
    label: "timed out",
    input: result({
      path: "/api/social-sentiment",
      status: "fail",
      detail: "Timed out after 90000ms",
      latencyMs: 90000,
      budgetMs: 45000,
      overBudget: true,
    }),
    owner: "claude",
    mentions: "cache",
  },
  {
    label: "degraded / over latency budget (live earnings-calendar ~33s case)",
    input: result({
      path: "/api/earnings-calendar",
      status: "degraded",
      httpStatus: 200,
      detail: "Took 33120ms against a 20000ms budget",
      latencyMs: 33120,
      budgetMs: 20000,
      overBudget: true,
      tabs: ["earnings-calendar"],
    }),
    owner: "claude",
    mentions: "33",
  },

  // --------------------------------------------------------------- transport
  {
    label: "request threw / TLS interception on this workstation",
    input: result({
      path: "/api/congress-trades",
      status: "fail",
      detail: "Request threw: TypeError: fetch failed (UNABLE_TO_VERIFY_LEAF_SIGNATURE)",
    }),
    owner: "owner",
    mentions: "staging",
  },
  {
    label: "request threw / nothing listening",
    input: result({
      path: "/api/vix",
      status: "fail",
      detail: "Request threw: TypeError: fetch failed ECONNREFUSED",
    }),
    owner: "owner",
    mentions: "pnpm dev",
  },
  {
    label: "request threw / unclassified transport error",
    input: result({ path: "/api/vix", status: "fail", detail: "Request threw: TypeError: network error" }),
    owner: "upstream",
  },

  // ------------------------------------------------------------ benign / keys
  {
    label: "pass / no action needed",
    input: result({ status: "pass", httpStatus: 200, detail: null }),
    owner: "owner",
    mentions: "Nothing to do",
  },
  {
    label: "pass / declared-OK non-200",
    input: result({ path: "/api/ccpi/cache", status: "pass", httpStatus: 404, detail: "HTTP 404 is a declared-OK response for this route" }),
    owner: "owner",
    mentions: "Nothing to do",
  },
  {
    label: "skipped / deliberately not probed",
    input: result({
      path: "/api/ccpi/chat",
      status: "skipped",
      detail: "Spends an LLM call on every probe.",
      latencyMs: null,
    }),
    owner: "owner",
  },
  {
    label: "alias mismatch on a passing route (AUDIT_BACKLOG P0-5)",
    input: result({ path: "/api/apify-proxy", status: "pass", httpStatus: 200, detail: null, tabs: [] }),
    ctx: { keys: KEYS },
    owner: "owner",
    mentions: "APIFY_API_KEY",
  },
  {
    label: "unrecognised detail admits it has no rule",
    input: result({ status: "fail", detail: "Something nobody has seen before" }),
    owner: "claude",
    mentions: "no branch",
  },
]

// -------------------------------------------------------------------- run it

for (const c of CASES) {
  const r = diagnose(c.input, c.ctx)
  const haystack = `${r.headline}\n${r.why}\n${r.steps.join("\n")}\n${r.claudePrompt ?? ""}`.toLowerCase()

  const ownerOk = r.owner === c.owner
  const stepsOk = Array.isArray(r.steps) && r.steps.length > 0 && r.steps.every((s) => s.trim().length > 0)
  const promptOk = r.owner !== "claude" || (typeof r.claudePrompt === "string" && r.claudePrompt.length > 80)
  const promptSelfContained = r.claudePrompt === undefined || r.claudePrompt.includes(c.input.path)
  const proseOk = r.headline.trim().length > 0 && r.why.trim().length > 0
  const mentionOk = !c.mentions || haystack.includes(c.mentions.toLowerCase())

  check(
    c.label,
    ownerOk && stepsOk && promptOk && promptSelfContained && proseOk && mentionOk,
    [
      ownerOk ? "" : `owner ${r.owner}, expected ${c.owner}`,
      stepsOk ? "" : "steps empty",
      promptOk ? "" : 'owner "claude" without a usable claudePrompt',
      promptSelfContained ? "" : "claudePrompt does not name the route",
      proseOk ? "" : "headline or why empty",
      mentionOk ? "" : `never mentions "${c.mentions}"`,
    ]
      .filter(Boolean)
      .join("; ") || `owner=${r.owner}`,
  )
}

// Every claude-owned remediation must be actionable without this conversation:
// it has to name the file to open.
const claudeCases = CASES.filter((c) => c.owner === "claude")
const allNameAFile = claudeCases.every((c) => {
  const r = diagnose(c.input, c.ctx)
  return (r.claudePrompt ?? "").includes(".ts")
})
check("every claude prompt names a source file", allNameAFile, `${claudeCases.length} claude cases`)

// autoFixable must never be claimed for something only Joel can do.
const noFalseAutoFix = CASES.every((c) => {
  const r = diagnose(c.input, c.ctx)
  return !(r.autoFixable && r.owner === "owner")
})
check("no owner-action is marked autoFixable", noFalseAutoFix)

// The alias table is duplicated to keep lib/remediation.ts dependency-free;
// drift would make the missing-key remediation name the wrong env vars.
const canonicalNames = Object.keys(API_KEY_ALIASES).sort()
const mirroredNames = Object.keys(KEY_ALIASES).sort()
const aliasesMatch =
  canonicalNames.join(",") === mirroredNames.join(",") &&
  canonicalNames.every((n) => (API_KEY_ALIASES[n] ?? []).join(",") === (KEY_ALIASES[n] ?? []).join(","))
check(
  "KEY_ALIASES mirrors API_KEY_ALIASES in lib/api-keys.ts",
  aliasesMatch,
  aliasesMatch ? `${canonicalNames.length} keys` : "tables have drifted — update KEY_ALIASES in lib/remediation.ts",
)

// Coverage: every owner value must be exercised, or the table is not a triage.
const ownersSeen = new Set(CASES.map((c) => diagnose(c.input, c.ctx).owner))
check("all three owners are reachable", ownersSeen.size === 3, [...ownersSeen].join(", "))

console.log(
  failures === 0
    ? `\nAll ${CASES.length + 4} remediation checks passed.`
    : `\n${failures} CHECK(S) FAILED`,
)
process.exit(failures === 0 ? 0 : 1)
