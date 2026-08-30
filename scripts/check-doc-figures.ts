/**
 * The numbers written in prose still match the code.
 *
 * Run: node scripts/check-doc-figures.ts
 *
 * WHY THIS FILE EXISTS. AUDIT_PLAN.md step 7.5 asks for a standing guard and
 * names the gap precisely: "the ceilings are pinned
 * (scripts/ccpi-certainty-ceiling.ts) but **prose figures elsewhere are not**."
 *
 * It was not a hypothetical. CLAUDE.md's verification rule — the one that tells
 * the next session to COUNT THE PASS LINES because a script that stops running
 * is indistinguishable from one that passes — carried "formulas 514" while the
 * suite had grown to 581 over one session's work. A rule that quotes a stale
 * number teaches the reader to expect the wrong thing, and this one is the rule
 * that exists to catch silent breakage.
 *
 * WHAT IS ACTUALLY DERIVED, AND WHAT IS ONLY PINNED. This distinction is the
 * honest part of the file and is not hidden in a variable name:
 *
 *   - `routes` and `contracts` are DERIVED — counted from app/api on disk and
 *     from lib/api-contracts.ts — so the prose is compared against reality.
 *   - `formulas`, `remediation` and `typecheckKnown` are PASS/error counts that
 *     only a full run produces. They cannot be derived here without this check
 *     executing the suite it belongs to. They are PINNED instead: the number in
 *     the doc must equal the number in BASELINES below, so prose and constant
 *     have to move in the same commit.
 *
 * Pinning is weaker than deriving and is not dressed up as equivalent. It
 * converts "the doc drifted and nobody noticed" into "the doc and the constant
 * disagree, loudly" — which is the same trade `KNOWN_DEAD_BASELINE` makes in
 * check-dead-exports.ts, for the same reason.
 *
 * SCOPE IS STRUCTURAL (P6-75) and its size is asserted (P6-77): the figure list
 * is a literal table, and its length is checked, so a figure cannot be dropped
 * from coverage without the count moving.
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")

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

/**
 * PASS/error counts that only a run produces. Update these in the same commit
 * that changes the suite, exactly as you would `KNOWN_DEAD_BASELINE`.
 *
 * `formulas` COUNTS THIS FILE'S OWN PASS LINES. Wiring the check in moved the
 * number it pins from 581 to 590 on the first run, which is not a quirk to work
 * around: a check that adds assertions changes the count the next reader is
 * told to expect, and that is precisely the drift being guarded. Adding any
 * future check will do the same, and the failure will say so by name.
 */
const BASELINES = {
  // 1154 → 1183 (29 ai-error-class) → 1191 (8 AI-tab liveness)
  // → 1195 (4 model-price-coverage), 2026-08-30.
  // 1128 → 1137 (9 graded-down-year assertions) → 1139 (2 tunable-threshold)
  // → 1140 (laggard-default-off split) → 1154 (14 market-hours assertions),
  // 2026-08-29. Moved with the CLAUDE.md prose below.
  formulas: 1195,
  remediation: 31,
  typecheckKnown: 0,
} as const

// --------------------------------------------------------------- derived

const ROUTE_FILES = walk(join(ROOT, "app", "api"), (p) => p.endsWith(`${"route"}.ts`))
const routeCount = ROUTE_FILES.length

const contractsSrc = readFileSync(join(ROOT, "lib", "api-contracts.ts"), "utf8")
/**
 * Every contract entry names a `path`, so counting the key counts the entries.
 *
 * NOT anchored to line start, and that is the whole note: the first version of
 * this was `/^\s*path:/gm` and reported **51 against the suite's authoritative
 * 60**, because nine contracts are written inline (`{ path: "/api/x", method:
 * … }`) with the key after the brace. A derivation that quietly undercounts is
 * worse than no derivation — it asserts a wrong figure with a PASS beside it —
 * so the parity check below exists to catch exactly that, and did.
 */
const contractPathCount = (contractsSrc.match(/\bpath:\s*["'`]/g) || []).length

check(
  `derived: ${routeCount} route file(s) on disk`,
  routeCount >= 40,
  `${routeCount} — a floor, so a walk that stops walking cannot pass`,
)
check(
  `derived: ${contractPathCount} contract entr(ies) declare a path`,
  contractPathCount >= 40,
  `${contractPathCount}`,
)
check(
  "every route on disk has a contract entry (count parity)",
  contractPathCount === routeCount,
  `${routeCount} routes vs ${contractPathCount} contracts`,
)

// ------------------------------------------------------------ doc figures

type Figure = {
  /** Doc-relative path. */
  file: string
  /** What the number means, for the failure message. */
  label: string
  /** Must capture the number in group 1. */
  pattern: RegExp
  expected: number
  /** True when `expected` came from the filesystem rather than from BASELINES. */
  derived: boolean
}

const FIGURES: Figure[] = [
  {
    file: "CLAUDE.md",
    label: "formulas PASS baseline",
    pattern: /Current baselines:\s*\*\*formulas\s+(\d+)\*\*/,
    expected: BASELINES.formulas,
    derived: false,
  },
  {
    file: "CLAUDE.md",
    label: "contract route count",
    pattern: /contracts\s+(\d+)\s+routes/,
    expected: routeCount,
    derived: true,
  },
  {
    file: "CLAUDE.md",
    label: "contract count",
    pattern: /contracts\s+\d+\s+routes\s*\/\s*(\d+)\s+contracts/,
    expected: contractPathCount,
    derived: true,
  },
  {
    file: "CLAUDE.md",
    label: "remediation PASS baseline",
    pattern: /remediation\s+(\d+)\./,
    expected: BASELINES.remediation,
    derived: false,
  },
  {
    file: "CLAUDE.md",
    label: "known typecheck errors",
    pattern: /(\d+)\s+known errors remain/,
    expected: BASELINES.typecheckKnown,
    derived: false,
  },
]

const EXPECTED_FIGURES = 5
check(
  `scope: ${FIGURES.length} prose figure(s) are pinned`,
  FIGURES.length === EXPECTED_FIGURES,
  `${FIGURES.length}, expected ${EXPECTED_FIGURES} — dropping a figure from this table must be deliberate`,
)

for (const f of FIGURES) {
  let src: string
  try {
    src = readFileSync(join(ROOT, f.file), "utf8")
  } catch {
    check(`${f.file}: readable`, false, "file missing")
    continue
  }
  const m = f.pattern.exec(src)
  if (!m) {
    // A figure that vanished from the prose is a failure, not a pass. The rule
    // it belongs to is load-bearing; deleting the number is how it stops being.
    check(`${f.file}: ${f.label} is stated`, false, `pattern did not match — was the sentence reworded or removed?`)
    continue
  }
  const found = Number(m[1])
  check(
    `${f.file}: ${f.label} is ${f.expected}${f.derived ? " (derived)" : " (pinned)"}`,
    found === f.expected,
    found === f.expected ? `${found}` : `doc says ${found}, code says ${f.expected}`,
  )
}

if (failures > 0) {
  console.error(`\n${failures} doc-figure check(s) failed.`)
  process.exit(1)
}
