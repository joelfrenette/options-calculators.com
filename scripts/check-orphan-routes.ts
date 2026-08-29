/**
 * No API route is reachable only from the infrastructure that audits it. (P0-1)
 *
 * Run: node scripts/check-orphan-routes.ts
 *
 * WHY THIS FILE EXISTS, AND WHY GREP SAID THE OPPOSITE. Six routes have had no
 * feature caller since Phase 0. A plain search for `/api/<name>` finds two to
 * four hits for every one of them and makes them look live — but every hit is
 * one of four infrastructure lists:
 *
 *   - `app/api/admin/run-health-checks/route.ts` — pings every route by name
 *   - `lib/api-contracts.ts` — one entry per route, enforced by check:contracts
 *   - `lib/remediation.ts` — maps routes to the API key they need
 *   - explanatory comments naming the route
 *
 * **The audit infrastructure is what makes the dead surface look alive.** That
 * is the same shape as `check-dead-exports` reporting a clean `lib/` because
 * its own allowlist named all 51 dead symbols, and as P7-27's four components
 * whose only mentions were in SITE_MAP and the backlog. Third instance now, so
 * it gets a rule: **a referrer that is itself an audit artefact is not a
 * referrer.**
 *
 * WHAT IT CANNOT DO. It answers "does any non-infrastructure file mention this
 * route path". A route reached only through a runtime-computed string would
 * read as orphaned; none exists today, and the honest response to one appearing
 * is a KNOWN_ORPHAN entry with the reason, not a wider exclusion list.
 *
 * SCOPE IS STRUCTURAL (P6-75): the route set is `walk(app/api)` filtered on
 * `route.ts`, and both it and the referrer set are size-asserted (P6-77).
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const rel = (p: string) => relative(ROOT, p).split(sep).join("/")

const MIN_ROUTES = 40
const MIN_REFERRERS = 100

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

function walk(dir: string, match: (p: string) => boolean): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    if (e === "node_modules" || e === ".next" || e === ".git" || e === ".claude") continue
    const full = join(dir, e)
    if (statSync(full).isDirectory()) out.push(...walk(full, match))
    else if (match(full)) out.push(full)
  }
  return out
}

const stripComments = (src: string): string =>
  // ONE pass, alternation ordered by position. The `[^:]` guard matters here
  // more than usual: every string this file cares about starts `/api/`, and a
  // naive line-comment pattern would treat `https://` as a comment opener.
  src.replace(/(?<!\*)\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m, pre) =>
    m.startsWith("/*") ? " " + "\n".repeat((m.match(/\n/g) || []).length) : (pre ?? ""),
  )

const ROUTE_FILES = walk(join(ROOT, "app", "api"), (p) => p.endsWith("route.ts"))
check(`scope: ${ROUTE_FILES.length} route file(s)`, ROUTE_FILES.length >= MIN_ROUTES, `floor ${MIN_ROUTES}`)

/** `app/api/foo/bar/route.ts` → `/api/foo/bar` */
const routePath = (file: string): string => "/" + rel(file).replace(/^app\//, "").replace(/\/route\.ts$/, "")

/**
 * Files whose mention of a route is bookkeeping, not use.
 *
 * Listed explicitly and size-asserted, because this is the list that decides
 * what "referenced" means — exactly the kind of content-decided scope that
 * P6-75 and the dead-export allowlist both got wrong by being implicit.
 */
const INFRASTRUCTURE = [
  "app/api/admin/run-health-checks/route.ts",
  "lib/api-contracts.ts",
  "lib/remediation.ts",
]
const EXPECTED_INFRASTRUCTURE = 3
check(
  `the infrastructure list still holds ${EXPECTED_INFRASTRUCTURE} file(s)`,
  INFRASTRUCTURE.length === EXPECTED_INFRASTRUCTURE,
  INFRASTRUCTURE.join(", "),
)

const SELF = join(ROOT, "scripts", "check-orphan-routes.ts")
const REFERRERS = [
  ...walk(join(ROOT, "app"), (p) => p.endsWith(".ts") || p.endsWith(".tsx")),
  ...walk(join(ROOT, "components"), (p) => p.endsWith(".ts") || p.endsWith(".tsx")),
  ...walk(join(ROOT, "lib"), (p) => p.endsWith(".ts")),
  ...walk(join(ROOT, "hooks"), (p) => p.endsWith(".ts") || p.endsWith(".tsx")),
].filter((p) => p !== SELF && !INFRASTRUCTURE.includes(rel(p)))

check(`scope: ${REFERRERS.length} candidate referrer(s)`, REFERRERS.length >= MIN_REFERRERS, `floor ${MIN_REFERRERS}`)

const sourceByFile = new Map<string, string>()
for (const f of REFERRERS) sourceByFile.set(f, stripComments(readFileSync(f, "utf8")))

/**
 * `vercel.json` IS a caller.
 *
 * A cron entry is the only thing that ever invokes `/api/cron/*` — no
 * application code fetches them, by design — so leaving the deploy config out
 * of the referrer set reported live scheduled jobs as orphans. Found by running
 * this check for the first time, which is the argument for running a new rule
 * before trusting its list.
 *
 * Not comment-stripped: it is JSON, and the stripper would mangle any `//`
 * inside a URL.
 */
try {
  sourceByFile.set(join(ROOT, "vercel.json"), readFileSync(join(ROOT, "vercel.json"), "utf8"))
} catch {
  // No vercel.json is a valid state for a local checkout; the cron routes then
  // report as orphans, which is honest rather than silently forgiven.
}

/**
 * Does `src` reference exactly this route, and not merely a longer one that
 * starts with it?
 *
 * A plain `src.includes(path)` scores `/api/breadth` as referenced by any file
 * mentioning `/api/breadth-backtest`, and `/api/scraping-bee` by any file
 * mentioning `/api/scraping-bee/diagnostics`. Both pairs exist here, so the
 * naive form would have reported two routes live on the strength of their own
 * siblings — a check quietly excusing the exact thing it was written to find.
 *
 * Found by an injection test that failed to fail: renaming the only caller of
 * `/api/federal-money` to `/api/federal-moneyXX` left the substring intact, so
 * the route still read as referenced. The injection was useless AND the check
 * was wrong, and only running it surfaced either.
 *
 * The character after the path must not continue it — no word character, no
 * hyphen, no slash.
 */
const referencesPath = (src: string, path: string): boolean => {
  let from = 0
  for (;;) {
    const at = src.indexOf(path, from)
    if (at === -1) return false
    const next = src[at + path.length]
    if (next === undefined || !/[\w\-/]/.test(next)) return true
    from = at + 1
  }
}

const orphans: string[] = []
for (const file of ROUTE_FILES) {
  const path = routePath(file)
  let referenced = false
  for (const [other, src] of sourceByFile) {
    // A route never counts as its own referrer, and neither does a nested
    // route counting its parent — `/api/scraping-bee/diagnostics` mentioning
    // `/api/scraping-bee` would otherwise keep the parent alive.
    if (other === file) continue
    if (rel(other).startsWith(rel(file).replace(/\/route\.ts$/, "/"))) continue
    if (referencesPath(src, path)) {
      referenced = true
      break
    }
  }
  if (!referenced) orphans.push(path)
}

// ---------------------------------------------------------------------------
// The ratchet.
// ---------------------------------------------------------------------------
//
// Six today. Deleting them is a keep-or-delete call per route that belongs to
// the owner — two are proxies with live API keys behind them — so this records
// the measured state and refuses to let it grow, exactly as
// `check-dead-components` does. Removing an entry never fails.
// P0-1 listed six. Running this check found TWELVE — the triage had been done
// with grep, and grep counts comments. The five it missed are annotated below.
//
// "Orphan" here means "no feature calls it", NOT "dead". Several of these are
// operator tools invoked by typing the URL with a query string, which is a
// legitimate design this check cannot distinguish from abandonment — so they
// are recorded with what they are, and the keep-or-delete call stays the
// owner's.
const KNOWN_ORPHANS: ReadonlySet<string> = new Set([
  // P0-1's original six, all confirmed 2026-08-12: every mention is the health
  // check, the contracts table, the remediation map, or a comment.
  "/api/yahoo-proxy",
  "/api/apify-proxy",
  "/api/google-trends",
  "/api/serper-finance",
  "/api/macro-indicators",
  "/api/scraping-bee",
  "/api/scraping-bee/diagnostics",
  // Found by this check, missed by the grep triage.
  "/api/admin/ccpi-backtest", // admin tool; `/api/ccpi-signals` names it in a comment only
  "/api/auth/reset-password", // no UI wired to it yet
  "/api/breadth", // E-7e; invoked by hand with ?backfill=
  "/api/breadth-backtest", // E-7e; same
  "/api/cron/quiver-probe", // run by hand; `lib/quiver.ts` cites its results in a comment
  // P7-75. Operator tool, invoked by typing the URL: it answers whether THIS
  // deployment can reach the free data sources directly, which decides whether
  // SCRAPINGBEE_API_KEY and FMP_API_KEY are worth paying for. Deliberately has
  // no feature caller — a tab rendering it would spend outbound requests on
  // every page load to answer a question asked twice a year.
  "/api/admin/source-probe",
  // 2026-08-29 admin audit: its only caller was the "APIs" tab (vendor-endpoint
  // reachability probe), folded away because the Health tab already probes
  // every /api route and exercises the same vendors. The route is retained —
  // admin-gated, harmless, re-wireable — but is now deliberately caller-less.
  "/api/admin/api-status",
])

const KNOWN_ORPHAN_BASELINE = 14

check(
  `the known-orphan list still holds ${KNOWN_ORPHAN_BASELINE} entries`,
  KNOWN_ORPHANS.size === KNOWN_ORPHAN_BASELINE,
  `${KNOWN_ORPHANS.size} — deleting a route means dropping its line AND this number together`,
)

const fresh = orphans.filter((o) => !KNOWN_ORPHANS.has(o))
check(
  "no NEW route has lost its last feature caller",
  fresh.length === 0,
  fresh.length ? fresh.join(", ") : `${ROUTE_FILES.length} routes, ${orphans.length} known-orphan, 0 new`,
)

const cleared = [...KNOWN_ORPHANS].filter((k) => !orphans.includes(k))
if (cleared.length) {
  console.log(
    `NOTE  ${cleared.length} known-orphan route(s) are now called or deleted — ` +
      `remove them from KNOWN_ORPHANS and lower the baseline: ${cleared.join(", ")}`,
  )
}

if (failures > 0) {
  console.error(`\n${failures} orphan-route check(s) failed.`)
  process.exit(1)
}
