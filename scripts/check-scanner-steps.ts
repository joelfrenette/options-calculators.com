/**
 * The scanner's step numbers come from one place.
 *
 * Run: node scripts/check-scanner-steps.ts
 *
 * WHY THIS FILE EXISTS (AUDIT_BACKLOG S-18). The four scanner steps were
 * written as literal "Step N" strings in roughly ninety places, and they had
 * drifted. The instance that reached a user: `loadPreFilteredTickers` is the
 * handler behind the button reading **"Scan for Potential Stocks (Step 2)"**,
 * and on failure it set the error **"Step 1 failed"**. The technical-analysis
 * handler logged itself as "Step 3" against its own Step 4 button, and a
 * comment called the fundamental scan "Step 2".
 *
 * Nothing breaks when a number is off by one, which is precisely why they
 * drifted and why only a check will hold them.
 *
 * WHAT IS IN SCOPE, AND WHAT IS DELIBERATELY NOT. This is the honest part.
 *
 *   IN: every string a user or a log reader sees — card headings, buttons,
 *   `setError` text, notice cards, results-table titles, and the `console.log`
 *   lines in the scan handlers. All of them now interpolate
 *   `components/scanner/steps.ts`.
 *
 *   OUT: comments, and only comments. **A comment cannot interpolate a
 *   constant** — there is no expression to evaluate — so no check can source
 *   one, and rewriting them into code would be worse prose for no reader.
 *   Every remaining comment mention was instead read by hand against the
 *   canonical order; two were wrong and were corrected (`use-wheel-scanner.ts`
 *   called the fundamental scan "Step 2"; `fundamental-scan.ts` logged itself
 *   as Step 2 in a file whose own header says Step 3). One that LOOKS wrong is
 *   correct and is left alone: `minMarketCapCategory` is annotated "Step 3
 *   market-cap floor" while indexing `PRE_FILTER_MARKET_CAP_TIERS`, which
 *   `constants.ts` calls "the Step 2 pre-filter slider" — the ladder is shared
 *   between a Step 2 slider and a Step 3 floor, so both comments are right.
 *
 *   OUT: `components/wheel-strategy-planner.tsx` and
 *   `components/options-strategy-toolbox.tsx`. Those number steps 1-4 as well —
 *   Sell Cash-Secured Puts, Get Assigned, Sell Covered Calls, Repeat — which is
 *   the wheel STRATEGY lifecycle, a different sequence sharing the phrasing.
 *   Folding them in would force "Step 3" to mean both "Fundamental Criteria"
 *   and "Sell Covered Calls".
 *
 * SCOPE IS STRUCTURAL (P6-75) and asserted (P6-77): the guarded file list is
 * explicit and its size is checked, so a file cannot drop out of coverage
 * without the count moving.
 */

import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

/**
 * Every scanner source, plus the shell that hosts them.
 *
 * DERIVED from the directory rather than listed, so a new scanner file is in
 * scope the moment it exists — the first version of this check named six files
 * by hand and therefore did not cover `scanner-notices.tsx`, which carries
 * eight user-visible step labels, or the three results tables. A hand list
 * covers what its author remembered, which is the same weakness as the hand
 * sweep it was written to replace.
 */
const GUARDED = [
  ...readdirSync(join(ROOT, "components", "scanner"))
    .filter((f) => /\.tsx?$/.test(f) && f !== "steps.ts")
    .map((f) => `components/scanner/${f}`),
  "components/wheel-scanner.tsx",
]
// 17 → 18 when P7-32 added `entry-exclusion-notice.tsx`, → 19 when P7-45 split
// `entry-exclusion-controls.tsx` out of the Step 4 card. Both bumps are the
// guard working as designed: a new file in this directory enters scope
// silently, and the assertion is what makes "silently" mean "with a deliberate
// edit here". The second fired on a REFACTOR, which is the case worth noting —
// **to a size check, moving code is indistinguishable from adding it**, so a
// module-size cleanup will trip every derived-set assertion it touches. That is
// the cost of the guard, and it is the right cost.
const EXPECTED_GUARDED = 19

check(
  `scope: ${GUARDED.length} file(s) guarded`,
  GUARDED.length === EXPECTED_GUARDED,
  `${GUARDED.length}, expected ${EXPECTED_GUARDED} — removing a file from this list must be deliberate`,
)

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

/** A literal step number inside a setError(...) call, anywhere in the scanner. */
const SET_ERROR_STEP = /setError\((?:[^)]*?)Step\s+\d/

let sources = 0
for (const relPath of GUARDED) {
  let src: string
  try {
    src = readFileSync(join(ROOT, relPath), "utf8")
  } catch {
    check(`${relPath}: readable`, false, "file missing — was it renamed?")
    continue
  }
  sources++
  const code = stripComments(src)

  // 1. No hardcoded step number in an error a user can see.
  check(
    `${relPath}: no literal step number in setError`,
    !SET_ERROR_STEP.test(code),
    SET_ERROR_STEP.exec(code)?.[0] ?? "none",
  )

  // 2. No literal step number in JSX text.
  //
  //    Only `.tsx` files are scanned, and that is structural rather than a
  //    convenience: JSX cannot exist in a `.ts` file, so a rendered label
  //    cannot either. The first draft scanned every guarded file and filtered
  //    `console.` line by line, which flagged three MULTI-LINE console.log
  //    calls in use-wheel-scanner.ts — their continuation lines carry the step
  //    number but not the `console.` token. A line-based filter cannot see a
  //    call that spans lines; a file-extension rule does not have to.
  //    `.ts` files remain covered by the setError assertion above.
  if (relPath.endsWith(".tsx")) {
    const jsxLiterals = code
      .split("\n")
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => /Step\s+\d/.test(line) && !/console\.\w+\(/.test(line))
    check(
      `${relPath}: no literal step number in a rendered label`,
      jsxLiterals.length === 0,
      jsxLiterals.length ? jsxLiterals.map((l) => `${l.n}: ${l.line.slice(0, 60)}`).join(" | ") : "none",
    )
  }
}

check(`scope: all ${EXPECTED_GUARDED} guarded file(s) were read`, sources === EXPECTED_GUARDED, `${sources}`)

/** The single source itself must still declare all four steps. */
const stepsSrc = readFileSync(join(ROOT, "components", "scanner", "steps.ts"), "utf8")
for (const key of ["dollarFilter", "preFilter", "fundamentals", "technical"]) {
  check(`steps.ts declares ${key}`, new RegExp(`\\b${key}:\\s*\\{`).test(stepsSrc))
}

if (failures > 0) {
  console.error(`\n${failures} scanner-step check(s) failed.`)
  process.exit(1)
}
