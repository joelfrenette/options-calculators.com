/**
 * Every API route that calls out has a deadline on the call.
 *
 * Run: node scripts/check-route-timeouts.ts
 *
 * WHY THIS FILE EXISTS. P0-4 has been open since Phase 0 with the fix "a shared
 * `fetchWithTimeout` helper; enforce presence via the contract tests". The helper
 * was never built and the enforcement never written, so the count drifted for
 * four phases with nobody able to say what it was. A hung upstream ties the
 * serverless function up until the platform kills it: the caller waits, the
 * budget is spent, and the response never says which upstream stalled.
 *
 * **The row's own figure was wrong, in the safe direction.** It recorded "40 of
 * 61 routes have no timeout/abort wiring". Measured 2026-08-11: 35 routes make
 * outbound calls, 26 were already wired, 9 were not. The nine now use
 * `lib/fetch-timeout.ts`. This check is what keeps that true — a number nobody
 * recomputes is a number that drifts, which is the standing lesson of this audit
 * and cost P0-4 four phases of being unactionable.
 *
 * SCOPE IS STRUCTURAL (P6-75). The route set is `walk(app/api)` filtered on the
 * filename `route.ts` — file layout, which no edit to a route's contents can
 * switch off. **Both counts are asserted, not printed** (P6-77): a scan that
 * silently stops seeing outbound calls would otherwise report the same PASS line
 * as a clean one, and "0 routes without timeouts" is exactly what you get when
 * you find 0 routes.
 *
 * WHAT IT CANNOT DO. It proves a deadline is WIRED, not that the deadline is
 * sensible — a 10-minute timeout passes. It also cannot see a fetch inside a
 * `lib/` module a route calls; those are covered only where the lib itself was
 * already wired. Recorded rather than implied away.
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const rel = (p: string) => relative(ROOT, p).split(sep).join("/")

/** Asserted, not printed. Update deliberately when the route set really changes. */
const EXPECTED_ROUTES = 60
const MIN_OUTBOUND_ROUTES = 30

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (e === "route.ts") out.push(full)
  }
  return out
}

const stripComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " " + "\n".repeat((m.match(/\n/g) || []).length))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")

const ROUTES = walk(join(ROOT, "app", "api"))

check(`scope: ${EXPECTED_ROUTES} route files on disk`, ROUTES.length === EXPECTED_ROUTES, `${ROUTES.length}`)

const OUTBOUND = /\bfetch\s*\(|meteredFetch|fetchWithTimeout/
const DEADLINE = /AbortSignal\.timeout|AbortController|fetchWithTimeout|meteredFetch|signal\s*:/

const outbound: string[] = []
const naked: string[] = []

for (const r of ROUTES) {
  const src = stripComments(readFileSync(r, "utf8"))
  if (!OUTBOUND.test(src)) continue
  outbound.push(rel(r))
  if (!DEADLINE.test(src)) naked.push(rel(r))
}

check(
  `scope: at least ${MIN_OUTBOUND_ROUTES} routes make outbound calls`,
  outbound.length >= MIN_OUTBOUND_ROUTES,
  `${outbound.length} of ${ROUTES.length}`,
)

check(
  "every route that calls out has a deadline on the call",
  naked.length === 0,
  naked.length ? naked.join(", ") : `${outbound.length} outbound routes, all wired`,
)

if (failures > 0) {
  console.error(`\n${failures} route-timeout check(s) failed.`)
  process.exit(1)
}
