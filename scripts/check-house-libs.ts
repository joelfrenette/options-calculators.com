/**
 * Option math and indicators are not re-implemented outside their libraries.
 *
 * Run: node scripts/check-house-libs.ts
 *
 * WHY THIS FILE EXISTS. CLAUDE.md states the rule and nothing enforced it:
 *
 *   "Indicators come from `lib/indicators.ts`; option math from
 *    `lib/black-scholes.ts` — never re-implement locally."
 *
 * It has been broken at least twice, and both were found by hand:
 *
 *   - P7-12: `components/greeks-calculator.tsx` declared its own `normalCDF`,
 *     `normalPDF` and `calculateGreeks`. The `normalCDF` bodies were
 *     byte-identical, so the duplication was not wrong on the day it was
 *     written — but the local theta dropped the dividend term, and the copy had
 *     no degenerate-input guard, so it would divide by zero where the library
 *     returns null.
 *   - P7-13: `/api/strategy-scanner` recomputed the expected-move formula
 *     inline instead of calling `expectedMove`.
 *
 * A house rule with no check is a suggestion. This turns it into a rule.
 *
 * WHAT IT CATCHES: a FUNCTION DECLARATION, anywhere outside the two libraries,
 * whose name matches something they export — `function normalCDF(…)` or
 * `const normalCDF = (…) => …`.
 *
 * WHAT IT DOES NOT CATCH, stated rather than implied:
 *
 *   - **A result variable is not a re-implementation.** `const rsi =
 *     calcRSI(prices)` is the correct usage and must not fail. The rule keys on
 *     the declaration FORM — a function or arrow — so an assignment from a call
 *     passes, which is why the earlier `check-dead-exports` NOTE listing `rsi`,
 *     `macd` and `atr` as name collisions was correctly a non-finding.
 *   - **Inline arithmetic.** P7-13's `price * ivData.atmIV * Math.sqrt(1/365)`
 *     has no name to match, so nothing structural can see it. Catching that
 *     needs a formula-shaped matcher, which would be a discovery sweep rather
 *     than a ratchet — and AUDIT_PLAN 7.4 is explicit about how poorly those
 *     perform. Recorded as a limit, not pretended away.
 *
 * SCOPE IS STRUCTURAL (P6-75) and asserted (P6-77): the protected name set is
 * read from the two libraries' own exports, so a new export is protected the
 * moment it exists, and the set's size is checked.
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const rel = (p: string) => relative(ROOT, p).split(sep).join("/")

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
  // ONE pass, alternation ordered by position — NOT block-then-line.
  //
  // Block-first was wrong and silently ate code: a LINE comment containing a
  // glob path (`// results tables live in components/scanner/*.`) has a `/*`
  // in it, which the block pattern happily treated as an opener and consumed
  // everything up to the next `*/` — 70+ lines of components/wheel-scanner.tsx
  // vanished from every scan that used this helper, and the checks reported
  // PASS on a file they could not see. Found by injecting a violation that
  // should have failed and did not.
  //
  // Alternation scans left to right, so at a `//` the line form matches first
  // and at a `/*` the block form does. The `[^:]` guard keeps `https://` from
  // reading as a comment.
  src.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m, pre) =>
    m.startsWith("/*") ? " " + "\n".repeat((m.match(/\n/g) || []).length) : (pre ?? ""),
  )

/** The two libraries whose names are protected, and the files that own them. */
const OWNERS = ["lib/black-scholes.ts", "lib/indicators.ts"]

const protectedNames = new Set<string>()
for (const owner of OWNERS) {
  const src = stripComments(readFileSync(join(ROOT, owner), "utf8"))
  for (const m of src.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) {
    protectedNames.add(m[1])
  }
}

const MIN_PROTECTED = 15
check(
  `scope: ${protectedNames.size} exported name(s) protected across ${OWNERS.length} librar(ies)`,
  protectedNames.size >= MIN_PROTECTED,
  `${protectedNames.size}, floor ${MIN_PROTECTED} — a collapsed read must fail, not pass`,
)

/**
 * Everything that could re-implement one. Check scripts are EXCLUDED: they
 * import the libraries to test them and legitimately alias their names, and a
 * test fixture is not a second implementation.
 */
const CANDIDATES = [
  ...walk(join(ROOT, "app"), (p) => p.endsWith(".ts") || p.endsWith(".tsx")),
  ...walk(join(ROOT, "components"), (p) => p.endsWith(".ts") || p.endsWith(".tsx")),
  ...walk(join(ROOT, "lib"), (p) => p.endsWith(".ts")),
  ...walk(join(ROOT, "hooks"), (p) => p.endsWith(".ts") || p.endsWith(".tsx")),
].filter((p) => !OWNERS.includes(rel(p)))

check(`scope: ${CANDIDATES.length} candidate file(s)`, CANDIDATES.length >= 100, `${CANDIDATES.length}`)

const offences: string[] = []
for (const f of CANDIDATES) {
  const src = stripComments(readFileSync(f, "utf8"))
  const lines = src.split("\n")
  lines.forEach((line, i) => {
    for (const name of protectedNames) {
      // A declaration, not an assignment from a call. `const rsi = calcRSI(x)`
      // is correct usage; `const rsi = (a, b) => …` and `function rsi(…)` are
      // re-implementations.
      const asFunction = new RegExp(`\\b(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*[(<]`)
      const asArrow = new RegExp(`\\b(?:const|let)\\s+${name}\\s*(?::[^=]+)?=\\s*(?:async\\s*)?\\([^)]*\\)\\s*(?::[^=]+)?=>`)
      if (asFunction.test(line) || asArrow.test(line)) {
        offences.push(`${rel(f)}:${i + 1} ${name}`)
      }
    }
  })
}

check(
  "no file outside lib/black-scholes.ts or lib/indicators.ts re-implements one of their exports",
  offences.length === 0,
  offences.length ? offences.join(", ") : `${CANDIDATES.length} files clean`,
)

if (failures > 0) {
  console.error(`\n${failures} house-library check(s) failed.`)
  process.exit(1)
}
