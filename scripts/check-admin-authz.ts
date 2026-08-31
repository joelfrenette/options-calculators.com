/**
 * An admin route must require ADMIN, not merely a session.
 *
 * WHAT THIS EXISTS TO STOP. Members shipped on 2026-08-27 and split one role
 * into two. `isAuthenticated()` kept its old name and quietly changed meaning:
 * it had been "is the owner signed in" and became "is ANYONE signed in".
 * `verifyAuth()` was added for the admin case and its docstring claimed "Every
 * existing /api/admin route calls this" — but only two did. The other eight
 * stayed on `isAuthenticated()` and were reachable by any member for four days:
 *
 *   api-status · backup · budget-guard · ccpi-backtest · run-health-checks
 *   source-probe · usage · api-keys (POST only)
 *
 * The middleware did not cover them. It makes a SESSION-ONLY routing decision
 * and says so in its own header, delegating role checks to the routes.
 *
 * The api-keys case was inverted and is the one worth remembering: GET required
 * admin, POST accepted any member. Writing API keys was less protected than
 * reading them. A gate added to the read path does not protect the write path,
 * and the two live twenty lines apart in the same file.
 *
 * WHY A CHECK RATHER THAN A COMMENT. There WAS a comment — `verifyAuth`'s
 * docstring asserted exactly this rule, and it was false when written or false
 * within days of it. A rule that describes other files cannot verify itself.
 *
 * Scope is structural: every `route.ts` under app/api/admin/. Nothing here
 * depends on prose, naming conventions or a hand-maintained list.
 *
 * Run: node scripts/check-admin-authz.ts
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

const ROOT = join(import.meta.dirname, "..")
const rel = (p: string) => p.slice(ROOT.length + 1).replace(/\\/g, "/")

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (e === "route.ts") out.push(full)
  }
  return out
}

/** Comment-strip, so an example inside a doc block never counts as a call. */
const code = (src: string) =>
  src.replace(/(?<!\*)\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m, pre) =>
    m.startsWith("/*") ? " " : (pre ?? ""),
  )

const ADMIN_ROUTES = walk(join(ROOT, "app", "api", "admin")).map((f) => ({
  file: rel(f),
  src: code(readFileSync(f, "utf8")),
}))

// 9 route files under app/api/admin/. A collapsed walk must fail, not pass.
const EXPECTED_ADMIN_ROUTES = 9
check(
  "scope: every app/api/admin route file is in scope",
  ADMIN_ROUTES.length === EXPECTED_ADMIN_ROUTES,
  `${ADMIN_ROUTES.length} route file(s), want ${EXPECTED_ADMIN_ROUTES}`,
)

// --- rule 1: no admin route uses the role-blind gate ------------------------

const roleBlind = ADMIN_ROUTES.filter((r) => /\bisAuthenticated\s*\(/.test(r.src)).map((r) => r.file)
check(
  "no admin route gates on isAuthenticated (which members pass)",
  roleBlind.length === 0,
  roleBlind.length === 0
    ? `${ADMIN_ROUTES.length} admin route(s) clean`
    : `${roleBlind.join(", ")} — use isAdmin() or verifyAuth()`,
)

// --- rule 2: EVERY exported handler is gated, not just the file -------------
//
// The api-keys defect was not a missing gate, it was a gate on the wrong
// handler: GET checked admin and POST did not. A file-level test would have
// passed that file. So each exported HTTP method is checked on its own.

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
const ADMIN_GATE = /\b(isAdmin|verifyAuth)\s*\(/

let handlers = 0
const ungated: string[] = []

for (const { file, src } of ADMIN_ROUTES) {
  for (const method of HTTP_METHODS) {
    const re = new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`, "g")
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) {
      handlers++
      // Slice this handler's body by brace balance so the NEXT handler's gate
      // cannot vouch for an ungated one above it.
      let i = src.indexOf("{", m.index + m[0].length - 1)
      let depth = 1
      i++
      const start = i
      while (i < src.length && depth > 0) {
        if (src[i] === "{") depth++
        else if (src[i] === "}") depth--
        i++
      }
      const body = src.slice(start, i)
      if (!ADMIN_GATE.test(body)) ungated.push(`${file}:${method}`)
    }
  }
}

// 14 exported handlers across the 9 admin route files.
const EXPECTED_HANDLERS = 14
check(
  "scope: every exported admin handler is in scope",
  handlers === EXPECTED_HANDLERS,
  `${handlers} handler(s), want ${EXPECTED_HANDLERS} — a handler added without a gate must FAIL here, not slip past a file-level test`,
)
check(
  "every admin handler checks admin, individually",
  ungated.length === 0,
  ungated.length === 0
    ? `${handlers} handler(s) all gated`
    : `${ungated.join(", ")} — an ungated handler in a gated FILE is how api-keys POST stayed member-writable`,
)

console.log(
  failures === 0
    ? `\nAll admin-authz checks passed — ${handlers} handler(s) across ${ADMIN_ROUTES.length} route file(s).`
    : `\n${failures} admin-authz check(s) FAILED.`,
)
process.exit(failures === 0 ? 0 : 1)
