/**
 * No file in `components/` is unreachable from the rest of the codebase.
 *
 * Run: node scripts/check-dead-components.ts
 *
 * WHY THIS FILE EXISTS, AND WHY `check-dead-exports.ts` DID NOT COVER IT.
 * That check's scope is `walk(lib/)`, stated in its own header. `components/`
 * appears in it only as a *referrer* set — a place where a lib export can be
 * used. So a component that nothing imports is invisible to it, and to every
 * other check in the suite: the provenance rules read a component's labels
 * without asking whether a user can reach the component, and the PASS count is
 * identical either way.
 *
 * P7-27 found four such files — 1,548 lines — by asking the question directly:
 *
 *   - `components/earnings-plays-scanner.tsx` (410 lines)
 *   - `components/wheel-strategy-planner.tsx` (490 lines)
 *   - `components/wheel-strategy-screener.tsx` (325 lines)
 *   - `components/high-iv-watchlist.tsx` (323 lines)
 *
 * None of the four appears in `app/page.tsx`'s tab switch, in any nav list, or
 * in any import anywhere. Three of them are the tabs P7-26 was written about,
 * and its commit message says the "Cached" badge defect was live "on three
 * public tabs". It was not on any tab. The fix was correct as a source change
 * and the finding's premise was wrong for the second time in one commit —
 * which is the argument for a rule rather than another careful reading.
 *
 * The deployed bundle is the independent confirmation: `page-*.js` on
 * www.options-calculators.com contains "Cached reading from" (the
 * market-sentiment half of the same commit) and does NOT contain "Fetched this
 * session" (the three scanners' new badge). The build tree-shook them out.
 *
 * WHAT IT CANNOT DO. It answers "does any other source file import this module
 * or name one of its exports", nothing more. A component reachable only through
 * a runtime-computed specifier would read as dead here; none exists today, and
 * the honest response to one appearing is a KNOWN_DEAD entry with the reason,
 * not a wider scope.
 *
 * SCOPE IS STRUCTURAL (P6-75). The file set is `walk(components/)` filtered on
 * extension — file layout, not a keyword — and its size is asserted (P6-77), so
 * a walk that starts returning nothing fails loudly instead of passing quietly.
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { basename, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const rel = (p: string) => relative(ROOT, p).split(sep).join("/")

/**
 * Floors, not exact counts: `components/` grows and shrinks legitimately. They
 * exist so a scope collapse cannot report the same PASS line as a clean run.
 */
const MIN_COMPONENT_FILES = 60
const MIN_REFERRER_FILES = 100

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
  // ONE pass, alternation ordered by position — NOT block-then-line. A `/*`
  // inside a LINE comment (a glob path, say) otherwise reads as a block opener
  // and eats everything to the next `*/`; that hid ~70 lines of
  // wheel-scanner.tsx from four checks. The `[^:]` guard keeps `https://` from
  // reading as a comment.
  src.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m, pre) =>
    m.startsWith("/*") ? " " + "\n".repeat((m.match(/\n/g) || []).length) : (pre ?? ""),
  )

const isSource = (p: string) => p.endsWith(".ts") || p.endsWith(".tsx")

const COMPONENT_FILES = walk(join(ROOT, "components"), (p) => isSource(p) && !p.endsWith(".d.ts"))

/** Every file that could reach a component. */
const ALL_SOURCE = [
  ...walk(join(ROOT, "app"), isSource),
  ...walk(join(ROOT, "components"), isSource),
  ...walk(join(ROOT, "lib"), (p) => p.endsWith(".ts")),
  ...walk(join(ROOT, "hooks"), isSource),
]

check(
  "scope: components/ resolves to a plausible file set",
  COMPONENT_FILES.length >= MIN_COMPONENT_FILES,
  `${COMPONENT_FILES.length} files, floor ${MIN_COMPONENT_FILES}`,
)

check(
  "scope: the referrer set is plausible",
  ALL_SOURCE.length >= MIN_REFERRER_FILES,
  `${ALL_SOURCE.length} files, floor ${MIN_REFERRER_FILES}`,
)

/**
 * Import matching keys off the basename, which is only sound while basenames
 * are unique — so that premise is asserted rather than assumed. If two files
 * ever share a name, this check would start scoring one live because the other
 * is imported, and the PASS line would not change.
 */
const byBase = new Map<string, string[]>()
for (const f of COMPONENT_FILES) {
  const b = basename(f).replace(/\.tsx?$/, "")
  byBase.set(b, [...(byBase.get(b) ?? []), f])
}
const collisions = [...byBase.entries()].filter(([, fs]) => fs.length > 1)
check(
  "every component basename is unique, so import matching is unambiguous",
  collisions.length === 0,
  collisions.length ? collisions.map(([b]) => b).join(", ") : `${byBase.size} distinct names`,
)

/** Module specifiers: `from "…"`, `import("…")`, `require("…")`. */
const SPECIFIER = /(?:from|import|require)\s*\(?\s*["'`]([^"'`]+)["'`]/g

/** Exported value names — the same declaration forms check-dead-exports uses. */
const EXPORT_DECL = /^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm

const SELF = join(ROOT, "scripts", "check-dead-components.ts")
const sourceByFile = new Map<string, string>()
const specifiersByFile = new Map<string, string[]>()
for (const f of ALL_SOURCE) {
  if (f === SELF) continue
  const src = stripComments(readFileSync(f, "utf8"))
  sourceByFile.set(f, src)
  const specs: string[] = []
  SPECIFIER.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = SPECIFIER.exec(src)) !== null) specs.push(m[1])
  specifiersByFile.set(f, specs)
}

/**
 * A file that DECLARES its own symbol of the same name is not a referrer — it
 * is a second implementation. Carried over from check-dead-exports, where
 * omitting it hid a diverged twin (P7-9).
 */
const declaresOwn = (src: string, name: string): boolean =>
  new RegExp(
    `(?:^|\\n)\\s*(?:export\\s+)?(?:async\\s+)?(?:function|const|let|class)\\s+${name.replace(/\$/g, "\\$")}\\b`,
  ).test(src)

const dead: { key: string; where: string }[] = []

for (const f of COMPONENT_FILES) {
  const base = basename(f).replace(/\.tsx?$/, "")
  const src = sourceByFile.get(f) ?? ""
  const exported = [...src.matchAll(EXPORT_DECL)].map((m) => m[1])

  let referenced = false
  for (const [other, otherSrc] of sourceByFile) {
    if (other === f) continue

    // Structural first: an import specifier that resolves to this file. A
    // directory import (`@/components/ccpi`) resolves to that folder's
    // index file, so it counts for an index too.
    const specs = specifiersByFile.get(other) ?? []
    const imported = specs.some((s) => {
      const norm = s.replace(/\.tsx?$/, "")
      return norm.endsWith(`/${base}`) || norm === `./${base}` || (base === "index" && norm.endsWith(`/${basename(join(f, ".."))}`))
    })
    if (imported) {
      referenced = true
      break
    }

    // Then by name, for anything reached without a literal specifier.
    for (const sym of exported) {
      if (!new RegExp(`\\b${sym.replace(/\$/g, "\\$")}\\b`).test(otherSrc)) continue
      if (declaresOwn(otherSrc, sym)) continue
      referenced = true
      break
    }
    if (referenced) break
  }

  if (!referenced) {
    const lines = readFileSync(f, "utf8").split("\n").length
    dead.push({ key: rel(f), where: `${rel(f)} (${lines} lines)` })
  }
}

// ---------------------------------------------------------------------------
// The ratchet, and why it is a ratchet rather than a zero.
// ---------------------------------------------------------------------------
//
// The same reasoning as check-dead-exports: turning this on as
// `dead.length === 0` would mean deleting or wiring up 1,548 lines of feature
// code in the commit that introduces the rule, and the four scanners are a
// rebuild-or-retire decision the owner has not made. An exception list with no
// baseline is a rule switched off; a measured baseline that can only shrink is
// not. Deleting an entry never fails.
//
// Keyed on path, never path:line.
const KNOWN_DEAD: ReadonlySet<string> = new Set([
  // Four feature components, no import and no tab-switch case (P7-27). Whether
  // they are wired up or deleted is the owner's call; until then this records
  // that they are unreachable rather than letting them read as shipped.
  "components/earnings-plays-scanner.tsx",
  "components/high-iv-watchlist.tsx",
  "components/wheel-strategy-planner.tsx",
  "components/wheel-strategy-screener.tsx",
  // Two pieces of scaffolding, kept because removing generated UI primitives
  // and a theme wrapper is unrelated churn on a branch awaiting UAT.
  "components/theme-provider.tsx",
  "components/ui/progress.tsx",
])

const KNOWN_DEAD_BASELINE = 6

check(
  `the known-dead list still holds ${KNOWN_DEAD_BASELINE} entries`,
  KNOWN_DEAD.size === KNOWN_DEAD_BASELINE,
  `${KNOWN_DEAD.size} — if you deleted or wired one up, drop its line AND this number together`,
)

const fresh = dead.filter((d) => !KNOWN_DEAD.has(d.key))
check(
  "no NEW unreachable component has appeared",
  fresh.length === 0,
  fresh.length
    ? fresh.map((d) => d.where).join(", ")
    : `${COMPONENT_FILES.length} components, ${dead.length} known-dead, 0 new`,
)

const cleared = [...KNOWN_DEAD].filter((k) => !dead.some((d) => d.key === k))
if (cleared.length) {
  console.log(
    `NOTE  ${cleared.length} known-dead component(s) are now referenced or deleted — ` +
      `remove them from KNOWN_DEAD and lower the baseline: ${cleared.join(", ")}`,
  )
}

if (failures > 0) {
  console.error(`\n${failures} dead-component check(s) failed.`)
  process.exit(1)
}
