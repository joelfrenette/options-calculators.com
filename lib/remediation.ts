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
 * PURITY: no I/O, no React, no env reads, no imports from outside
 * lib/remediation/. Safe to call from a route, a server component, a client
 * component or a plain Node script. Split across lib/remediation/ (P6-13) with
 * EXPLICIT `.ts` extensions on the internal imports — that is what keeps
 * scripts/check-remediation.ts able to load this module under plain node
 * (native type stripping resolves `.ts`, never extensionless), and the
 * tsconfig.json note records that allowImportingTsExtensions builds clean on
 * Vercel. KEY_ALIASES stays duplicated from lib/api-keys.ts rather than
 * imported (that module reads process.env at module scope); the check script
 * asserts the two tables stay identical.
 */

export type {
  ProbeStatus,
  HealthResult,
  KeySummary,
  DiagnoseContext,
  RemediationOwner,
  RemediationLink,
  Remediation,
} from "./remediation/remediation-types.ts"
export { KEY_ALIASES, PROVIDERS } from "./remediation/remediation-providers.ts"

import type { HealthResult, DiagnoseContext, Remediation } from "./remediation/remediation-types.ts"
import { parseHttpStatus } from "./remediation/remediation-helpers.ts"
import {
  healthy,
  skipped,
  killSwitch,
  missingKey,
  sessionExpired,
  planOrPermission,
  gone,
  rateLimited,
  serverError,
  notFound,
  badRequest,
  otherClientError,
  errorBody,
  contractDrift,
  notJson,
  timedOut,
  overBudget,
  threw,
  aliasMismatch,
  unknown,
} from "./remediation/remediation-branches.ts"

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
