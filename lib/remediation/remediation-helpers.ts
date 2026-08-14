/**
 * Pure helpers for the remediation engine. Split from lib/remediation.ts
 * (P6-13); see that file's header for the module's contract and constraints.
 */

import type { HealthResult, DiagnoseContext, RemediationLink } from "./remediation-types.ts"
import { KEY_ALIASES, PROVIDERS, PATH_HINTS } from "./remediation-providers.ts"

// -------------------------------------------------------------------- helpers

/**
 * "/api/vix" -> "app/api/vix/route.ts" — the file a code fix would touch.
 *
 * P7-9 un-exported this when everything lived in one file. The P6-13 split
 * re-exports it out of necessity — the branches module is its real consumer —
 * which is a different situation from the one P7-9 fixed: the export now has a
 * genuine importer, not a same-named stranger in check-provenance.ts.
 */
export function routeFile(path: string): string {
  return `app${path}/route.ts`
}

/** "HTTP 410: Legacy Endpoint" -> 410. Null when the detail is not an HTTP one. */
export function parseHttpStatus(detail: string): number | null {
  const m = /^HTTP (\d{3})\b/.exec(detail)
  if (!m) return null
  const code = Number(m[1])
  return Number.isFinite(code) ? code : null
}

/** The message the provider sent back, when the endpoint captured one. */
export function upstreamMessage(detail: string): string | null {
  const m = /^HTTP \d{3}: (.+)$/.exec(detail)
  return m ? m[1] : null
}

/** Canonical key names this route depends on: report first, then ctx, then path. */
export function keysForRoute(result: HealthResult, ctx?: DiagnoseContext): string[] {
  if (result.missingKeys?.length) return result.missingKeys
  const gated = (ctx?.keys ?? []).filter((k) => k.gates.includes(result.path)).map((k) => k.name)
  if (gated.length) return gated
  const hint = PATH_HINTS.find(([frag]) => result.path.startsWith(frag))
  return hint ? [hint[1]] : []
}

/** Every accepted env-var spelling for a canonical key name. */
export function aliasesFor(name: string, ctx?: DiagnoseContext): string[] {
  const fromCtx = ctx?.keys?.find((k) => k.name === name)
  if (fromCtx?.aliases.length) return fromCtx.aliases
  return KEY_ALIASES[name] ?? [name]
}

export function providerLinks(names: string[], includeStatus: boolean): RemediationLink[] {
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
export function nameList(names: string[]): string {
  return names.length ? names.join(", ") : "the provider key for this route"
}

/** Header every claudePrompt starts with, so the prompt stands alone. */
export function promptHeader(result: HealthResult): string {
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
