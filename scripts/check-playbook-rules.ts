/**
 * The teaching page describes the rules the scanner actually applies.
 *
 * Run: node scripts/check-playbook-rules.ts
 *
 * WHY THIS FILE EXISTS. `components/learn-csp.tsx` now states four entry
 * exclusions as a playbook, and `components/scanner/technical-criteria.ts`
 * implements four gates. Nothing structural connects them: deleting a gate
 * leaves the page teaching a discipline the software no longer has, and that is
 * the project's own defining failure mode — **a label naming a provenance the
 * code lacks** (Phase 6 synthesis, first of the five shapes). Fourteen tabs were
 * found where the numbers were fine and the noun was false.
 *
 * The connection this check makes is deliberately narrow, and the limit is
 * stated rather than implied: **it verifies that each gate is DESCRIBED, not
 * that the description is accurate.** It cannot read English. What it prevents
 * is the silent case — a gate removed, renamed, or added while the page carries
 * on regardless.
 *
 * SCOPE IS STRUCTURAL (P6-75). The gate list is derived from
 * `ENTRY_EXCLUSION_LABELS` in the implementation, never hand-copied here, so a
 * fifth gate fails this check the moment it lands without a playbook entry. The
 * count is asserted (P6-77) so the derivation collapsing to nothing cannot
 * report the same PASS line as a clean run.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")

const IMPL = "components/scanner/technical-criteria.ts"
const PAGE = "components/learn-csp.tsx"
const CARD = "components/scanner/step4-technical-card.tsx"

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

const implSrc = readFileSync(join(ROOT, IMPL), "utf8")
const pageSrc = readFileSync(join(ROOT, PAGE), "utf8")
const cardSrc = readFileSync(join(ROOT, CARD), "utf8")

/**
 * The gate keys, read out of `cspEntryGates` itself rather than out of the
 * label map — the map is prose and could be edited to match the page, which
 * would defeat the whole check. The keys are the code.
 */
const gateBlock = implSrc.slice(implSrc.indexOf("export const cspEntryGates"))
const gateKeys = [...gateBlock.slice(0, gateBlock.indexOf("})")).matchAll(/^\s{2}(\w+Check):/gm)].map((m) => m[1])

const EXPECTED_GATES = 4
check(
  `scope: ${gateKeys.length} entry gate(s) found in ${IMPL}`,
  gateKeys.length === EXPECTED_GATES,
  gateKeys.length ? gateKeys.join(", ") : "none — the derivation collapsed, which is not the same as a clean run",
)

/** The user-facing label for each gate, from the same file. */
const labelFor = (key: string): string | null => {
  const m = implSrc.match(new RegExp(`${key}:\\s*"([^"]+)"`))
  return m ? m[1] : null
}

for (const key of gateKeys) {
  const label = labelFor(key)
  check(`${key} has a user-facing label`, label !== null, label ?? "missing from ENTRY_EXCLUSION_LABELS")
}

/**
 * Each gate must be reachable from the teaching page.
 *
 * Matched on the label's distinctive words rather than the label verbatim,
 * because the page writes prose ("The stock is down on the year") and the
 * scanner writes a chip ("down on the year"). Requiring the exact string would
 * force the page into the chip's grammar, and a check that makes writing worse
 * gets deleted.
 */
const PLAYBOOK_TERMS: Record<string, RegExp> = {
  bigUpDayCheck: /big up day/i,
  downYearCheck: /down on the year/i,
  benchmarkCheck: /trailed SPY/i,
  stage4Check: /Stage 4/i,
}

for (const key of gateKeys) {
  const term = PLAYBOOK_TERMS[key]
  check(
    `${key} is taught in ${PAGE}`,
    term !== undefined && term.test(pageSrc),
    term === undefined
      ? "no playbook term registered — a NEW gate needs an entryRules entry and a term here"
      : `matched /${term.source}/`,
  )
}

check(
  `scope: ${Object.keys(PLAYBOOK_TERMS).length} playbook term(s) registered`,
  Object.keys(PLAYBOOK_TERMS).length === gateKeys.length,
  "a term with no gate, or a gate with no term, means one of the two moved alone",
)

/**
 * The page tells the reader which control enforces each rule. If that control
 * is not in the Step 4 card, the page is naming a button that does not exist —
 * which is P6-42's shape at a smaller scale.
 */
const enforcedBy = [...pageSrc.matchAll(/Entry exclusions → \\"([^\\"]+)\\"/g)].map((m) => m[1])
check(
  `the page names ${enforcedBy.length} enforcing control(s)`,
  enforcedBy.length === EXPECTED_GATES,
  enforcedBy.length ? enforcedBy.join(" · ") : "none parsed",
)

for (const control of enforcedBy) {
  check(`"${control}" exists in the Step 4 card`, cardSrc.includes(control))
}

/**
 * The four gates default ON. The page says the scanner applies them for the
 * reader; if they shipped defaulted off, that sentence would be false for
 * anyone who never opened Step 4.
 */
const hookSrc = readFileSync(join(ROOT, "components/scanner/use-wheel-scanner.ts"), "utf8")
const defaultsOn = ["excludeBigUpDay", "excludeDownYear", "excludeBenchmarkLaggard", "excludeStage4"].filter((s) =>
  new RegExp(`\\[${s},\\s*set\\w+\\]\\s*=\\s*useState\\(true\\)`).test(hookSrc),
)
check(
  "all four exclusions still default ON",
  defaultsOn.length === EXPECTED_GATES,
  `${defaultsOn.length} of ${EXPECTED_GATES} — the page tells the reader the scanner applies these for them`,
)

if (failures > 0) {
  console.error(`\n${failures} playbook-rule check(s) failed.`)
  process.exit(1)
}
