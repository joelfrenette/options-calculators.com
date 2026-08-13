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

// ---------------------------------------------------------------------------
// The server scanner's policy table describes its own call sites (P7-32).
// ---------------------------------------------------------------------------
//
// `/api/strategy-scanner` publishes `entryExclusionPolicy` — which strategies
// are trend-gated, which are spike-gated, which are ungated. That is a CLAIM
// about the code in the same file, and the audit's first failure shape is a
// label naming something the code does not do. The claim is also the one most
// likely to rot: adding a gate to a generator is a two-line edit that leaves
// the published list stale and every test passing.
//
// So the lists are compared against the actual `entryExclusionReasons(...)`
// call sites, derived from the generator each one sits in.

const routeSrc = readFileSync(join(ROOT, "app/api/strategy-scanner/route.ts"), "utf8")

/** Generator function name → the policy literal at its exclusion call site. */
const callSites = new Map<string, { spike: boolean; trend: boolean }>()
{
  const genRe = /async function (generate\w+)\(/g
  const bounds: Array<{ name: string; at: number }> = []
  for (const m of routeSrc.matchAll(genRe)) bounds.push({ name: m[1], at: m.index ?? 0 })
  for (let i = 0; i < bounds.length; i++) {
    const start = bounds[i].at
    const end = i + 1 < bounds.length ? bounds[i + 1].at : routeSrc.length
    const body = routeSrc.slice(start, end)
    // The loop-level gate only. The bull-put leg's second call inside
    // generateCreditSpreads is asserted separately below, because a policy
    // table that flattened a two-leg strategy to one row would be the thing
    // this check exists to catch.
    const m = /entryExclusionReasons\(\s*trend,\s*\{\s*spike:\s*(true|false),\s*trend:\s*(true|false)\s*\}/.exec(body)
    if (m) callSites.set(bounds[i].name, { spike: m[1] === "true", trend: m[2] === "true" })
  }
}

const EXPECTED_GATED_GENERATORS = 7
check(
  `scope: ${callSites.size} gated generator(s) in the scanner route`,
  callSites.size === EXPECTED_GATED_GENERATORS,
  callSites.size ? [...callSites.keys()].join(", ") : "none — the derivation collapsed",
)

/** Published strategy key → the generator that serves it. */
const STRATEGY_TO_GENERATOR: Record<string, string> = {
  "credit-spreads": "generateCreditSpreads",
  "iron-condors": "generateIronCondors",
  "calendar-spreads": "generateCalendarSpreads",
  butterflies: "generateButterflies",
  leaps: "generateLEAPS",
  zebra: "generateZEBRA",
  wheel: "generateWheelCandidates",
  "high-iv": "generateHighIVWatchlist",
  earnings: "generateEarningsPlays",
}

const listFromPolicy = (field: string): string[] => {
  const m = new RegExp(`${field}:\\s*\\[([^\\]]*)\\]`).exec(routeSrc)
  if (!m) return []
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])
}

const spikeClaimed = listFromPolicy("spikeGatedStrategies")
const ungatedClaimed = listFromPolicy("ungated")

check(
  `the policy claims ${spikeClaimed.length} spike-gated strategy(ies)`,
  spikeClaimed.length > 0,
  spikeClaimed.join(", "),
)

for (const strategy of spikeClaimed) {
  const gen = STRATEGY_TO_GENERATOR[strategy.split(" ")[0]]
  const site = gen ? callSites.get(gen) : undefined
  check(`"${strategy}" is spike-gated in code`, site?.spike === true, gen ? `${gen} → ${JSON.stringify(site)}` : "unmapped")
}

for (const strategy of ungatedClaimed) {
  const gen = STRATEGY_TO_GENERATOR[strategy]
  const isUngated = gen !== undefined && !callSites.has(gen)
  check(
    `"${strategy}" is genuinely ungated`,
    isUngated,
    gen === undefined ? "unmapped" : isUngated ? `${gen} has no exclusion call site` : `${gen} HAS a gate the policy denies`,
  )
}

/**
 * The trend list is checked in the strict direction: every generator the code
 * trend-gates must be claimed, and nothing else may be. Claiming MORE than the
 * code does is the failure that matters — it tells a reader a dog was filtered
 * out when it was not.
 */
const trendInCode = [...callSites.entries()].filter(([, p]) => p.trend).map(([name]) => name)
const trendClaimedGenerators = listFromPolicy("trendGatedStrategies")
  .map((s) => STRATEGY_TO_GENERATOR[s.split(" ")[0]])
  .filter((g): g is string => g !== undefined)

check(
  "every trend-gated generator is claimed by the policy",
  trendInCode.every((g) => trendClaimedGenerators.includes(g)),
  `code: ${trendInCode.join(", ")} | claimed: ${trendClaimedGenerators.join(", ")}`,
)
check(
  "the policy claims no trend gate the code does not have",
  trendClaimedGenerators.every((g) => trendInCode.includes(g) || g === "generateCreditSpreads"),
  "credit-spreads is exempt here because its trend gate is on the bull-put LEG, asserted next",
)

check(
  "the bull-put leg carries its own trend gate",
  /bullPutExcluded\s*=\s*entryExclusionReasons\(\s*trend,\s*\{\s*spike:\s*false,\s*trend:\s*true\s*\}/.test(routeSrc),
  "a bear call profits from the decline these gates reject — the legs cannot share one policy",
)

if (failures > 0) {
  console.error(`\n${failures} playbook-rule check(s) failed.`)
  process.exit(1)
}
