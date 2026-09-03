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

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")

/** Every file under `dir` matching `match`, recursively. */
function walkDir(dir: string, match: (p: string) => boolean): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkDir(full, match))
    else if (match(full)) out.push(full)
  }
  return out
}

const IMPL = "components/scanner/technical-criteria.ts"
const PAGE = "components/learn-csp.tsx"
/**
 * The Step 4 surface, which is now TWO files.
 *
 * P7-45's module-size work moved the entry-exclusion block out of the card into
 * `entry-exclusion-controls.tsx`, and this check failed on all four controls
 * the moment it did — correctly. **A refactor that relocates a user-facing
 * label is indistinguishable from one that deletes it, to any check pinned to a
 * single path.** So the set is a list, and its size is asserted: adding a third
 * file must be deliberate, and dropping to one must be too.
 */
const CARD_FILES = [
  "components/scanner/step4-technical-card.tsx",
  "components/scanner/entry-exclusion-controls.tsx",
]
const EXPECTED_CARD_FILES = 2

/**
 * The Sell Put scanner's hook, which is now TWO files, for the same reason and
 * by the same route as the card above.
 *
 * P6-13's module-size work moved every Step 4 slider, toggle and exclusion
 * default out of `use-wheel-scanner.ts` into `use-technical-filters.ts`, and
 * both assertions that read the hook source failed the moment it did — "all
 * four exclusions still default ON" reported **0 of 4**, which is what deleting
 * the four defaults outright would also report. That is the same lesson the
 * card list already carries, arriving a second time in the same directory: a
 * check pinned to one path cannot tell a relocation from a deletion. Listing
 * the set and asserting its size is what makes the next move deliberate.
 */
const HOOK_FILES = [
  "components/scanner/use-wheel-scanner.ts",
  "components/scanner/use-technical-filters.ts",
]
const EXPECTED_HOOK_FILES = 2

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

check(
  `scope: ${CARD_FILES.length} Step 4 file(s)`,
  CARD_FILES.length === EXPECTED_CARD_FILES,
  CARD_FILES.join(", "),
)

check(
  `scope: ${HOOK_FILES.length} Sell Put hook file(s)`,
  HOOK_FILES.length === EXPECTED_HOOK_FILES,
  HOOK_FILES.join(", "),
)

const implSrc = readFileSync(join(ROOT, IMPL), "utf8")
const pageSrc = readFileSync(join(ROOT, PAGE), "utf8")
const cardSrc = CARD_FILES.map((f) => readFileSync(join(ROOT, f), "utf8")).join("\n")

/**
 * The gate keys, read out of `cspEntryGates` itself rather than out of the
 * label map — the map is prose and could be edited to match the page, which
 * would defeat the whole check. The keys are the code.
 */
const gateBlock = implSrc.slice(implSrc.indexOf("export const cspEntryGates"))
const gateKeys = [...gateBlock.slice(0, gateBlock.indexOf("})")).matchAll(/^\s{2}(\w+Check):/gm)].map((m) => m[1])

const EXPECTED_GATES = 4
// Of the four gates, TWO default ON — the real CSP guardrails: big up day
// (don't sell a put into a spike) and Stage 4 (a falling knife). Down-year and
// benchmark-laggard both default OFF:
//   - benchmark-laggard OFF (owner 2026-08-29): over-excludes on a down tape;
//     the relaxed pass shows relative strength as the soft Beat-SPY column.
//   - down-year OFF (owner 2026-08-31): a bargain is often down on the year,
//     which is the whole CSP thesis — being paid to own a quality name at a
//     pullback. Excluding down-year removed exactly those candidates and was
//     half of why Step 4 returned zero. Stage 4 still guards the falling knives.
// (Above-200-SMA, a separate technical-filter default in the same hook, also
// moved to OFF the same day for the same reason; pinned by its own assertion
// below rather than left as an unenforced comment.)
const EXPECTED_DEFAULT_ON = 2
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
  check(`"${control}" exists in the Step 4 surface`, cardSrc.includes(control))
}

/**
 * TWO of the four gates default ON — the real CSP guardrails the page says the
 * scanner applies for the reader (big up day, Stage 4). Down-year and
 * benchmark-laggard default OFF by design, so the page copy must say TWO; the
 * assertions below pin every half.
 */
const hookSrc = HOOK_FILES.map((f) => readFileSync(join(ROOT, f), "utf8")).join("\n")
const guardrailGates = ["excludeBigUpDay", "excludeStage4"]
const defaultsOn = guardrailGates.filter((s) =>
  new RegExp(`\\[${s},\\s*set\\w+\\]\\s*=\\s*useState\\(true\\)`).test(hookSrc),
)
check(
  "the two guardrail exclusions still default ON",
  defaultsOn.length === EXPECTED_DEFAULT_ON,
  `${defaultsOn.length} of ${EXPECTED_DEFAULT_ON} — big up day + Stage 4, the gates the page tells the reader it applies`,
)
check(
  "the benchmark-laggard gate defaults OFF (deliberate, 2026-08-29)",
  /\[excludeBenchmarkLaggard,\s*set\w+\]\s*=\s*useState\(false\)/.test(hookSrc),
  "expected useState(false) — it over-excludes on a down tape and is soft in the relaxed pass",
)
check(
  "the down-year gate defaults OFF (deliberate, 2026-08-31)",
  /\[excludeDownYear,\s*set\w+\]\s*=\s*useState\(false\)/.test(hookSrc),
  "expected useState(false) — a bargain is often down YTD; Stage 4 still guards the falling knives",
)
check(
  "require-above-200-SMA defaults OFF (deliberate, 2026-08-31)",
  /\[requireAbove200SMA,\s*set\w+\]\s*=\s*useState\(false\)/.test(hookSrc),
  "expected useState(false) — a momentum filter; a pullback dips below the 200, which is the CSP entry, not a disqualifier",
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

/**
 * The scanner's source, wherever it now lives.
 *
 * P6-13 split the 1,808-line route into `lib/strategy-scanner/`, so eight of the
 * nine generators moved out of `app/api/strategy-scanner/route.ts` while the
 * `entryExclusionPolicy` they are checked against stayed in it. A version of
 * this check still reading only the route file would have derived ZERO call
 * sites and then compared the published policy against nothing.
 *
 * The scope assertion below is what makes that visible rather than silent.
 */
const SCANNER_FILES = [
  join(ROOT, "app/api/strategy-scanner/route.ts"),
  ...walkDir(join(ROOT, "lib/strategy-scanner"), (p) => p.endsWith(".ts")),
]
const routeSrc = SCANNER_FILES.map((f) => readFileSync(f, "utf8")).join("\n")

/** Generator function name → the policy literal at its exclusion call site. */
const callSites = new Map<string, { spike: boolean; trend: boolean }>()
// PER FILE, not over the concatenation. A generator that is the LAST one in its
// file would otherwise have a "body" running to the next file's first generator,
// and would inherit that generator's gate — an ungated scanner reading as gated,
// which is the exact direction of error this check exists to catch.
for (const file of SCANNER_FILES) {
  const src = readFileSync(file, "utf8")
  const genRe = /async function (generate\w+)\(/g
  const bounds: Array<{ name: string; at: number }> = []
  for (const m of src.matchAll(genRe)) bounds.push({ name: m[1], at: m.index ?? 0 })
  for (let i = 0; i < bounds.length; i++) {
    const start = bounds[i].at
    const end = i + 1 < bounds.length ? bounds[i + 1].at : src.length
    const body = src.slice(start, end)
    // The loop-level gate only. The bull-put leg's second call inside
    // generateCreditSpreads is asserted separately below, because a policy
    // table that flattened a two-leg strategy to one row would be the thing
    // this check exists to catch.
    const m = /entryExclusionReasons\(\s*trend,\s*\{\s*spike:\s*(true|false),\s*trend:\s*(true|false)\s*\}/.exec(body)
    if (m) callSites.set(bounds[i].name, { spike: m[1] === "true", trend: m[2] === "true" })
  }
}

const MIN_SCANNER_FILES = 8
check(
  `scope: ${SCANNER_FILES.length} strategy-scanner source file(s)`,
  SCANNER_FILES.length >= MIN_SCANNER_FILES,
  `floor ${MIN_SCANNER_FILES} — the route plus lib/strategy-scanner/**`,
)

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

// ---------------------------------------------------------------------------
// The six server-driven tabs surface what was excluded, and send the threshold.
// ---------------------------------------------------------------------------
//
// The route can exclude perfectly and the tab still be wrong in two silent
// ways: it can drop `entryExclusions` on the floor, in which case a scanner
// that returned fewer rows is indistinguishable from a market with fewer
// candidates; or it can offer a threshold control that never reaches the
// server. Both fail with no error and no changed PASS line.
//
// The tab list is DERIVED from the fetch calls, not hand-written — a
// hand-written list covers what its author remembered, which is the weakness
// `check-scanner-steps` shipped with and had to be fixed for.

const componentsDir = join(ROOT, "components")
const tabFiles = readdirSync(componentsDir).filter((f) => f.endsWith(".tsx"))
const scannerTabs = tabFiles.filter((f) =>
  /fetch\(\s*[`"']\/api\/strategy-scanner\?type=/.test(readFileSync(join(componentsDir, f), "utf8")),
)

const EXPECTED_SCANNER_TABS = 6
check(
  `scope: ${scannerTabs.length} tab(s) call /api/strategy-scanner`,
  scannerTabs.length === EXPECTED_SCANNER_TABS,
  scannerTabs.length ? scannerTabs.join(", ") : "none — the derivation collapsed",
)

for (const f of scannerTabs) {
  const src = readFileSync(join(componentsDir, f), "utf8")
  check(`${f} renders <EntryExclusionNotice>`, src.includes("<EntryExclusionNotice"))
  check(`${f} sends the threshold to the server`, /&maxDayMove=\$\{/.test(src))
  // The regression this guards is specific: a zero-argument refresh reads the
  // PREVIOUS threshold out of the closure and scans with the value the user
  // just changed away from, which looks exactly like a filter that did nothing.
  check(
    `${f} passes the new threshold explicitly, not via state`,
    /handleRefresh = async \(overrideMaxDayMove\?: number\)/.test(src) &&
      /effectiveMaxDayMove = overrideMaxDayMove \?\? maxDayMove/.test(src),
    "a refresh that takes no argument re-reads stale state",
  )
}

// ---------------------------------------------------------------------------
// One threshold, one definition (P7-34).
// ---------------------------------------------------------------------------
//
// The range, default and clamp briefly lived in three places: the route's own
// clamp, the Sell Put scanner's 3-25 slider, and the six tabs' dropdown of
// eight fixed steps. Nothing disagreed yet — which is exactly the state the
// fifteen hand-built Yahoo URLs were in before one of them diverged (P7-28).
//
// `lib/trend-filters.ts` owns it now. These assertions are the structural part:
// the number may not be re-typed anywhere else.

const trendLibSrc = readFileSync(join(ROOT, "lib/trend-filters.ts"), "utf8")

check(
  "lib/trend-filters.ts owns the threshold range and default",
  /export const MAX_DAY_MOVE = \{ MIN: \d+, MAX: \d+, DEFAULT: \d+, STEP: \d+ \}/.test(trendLibSrc),
)

// `\bresolveMaxDayMove\b`, not `resolveMaxDayMove,` — the trailing comma was
// incidental to the multi-line import block the route happened to have, and
// P6-13's split reduced that block to one symbol on one line. The comma went
// with it and this check failed on a route that still delegates correctly. A
// rule scoped by punctuation is the same defect as one scoped by prose
// (CLAUDE.md): the thing it pins is not the thing it means.
check(
  "the route delegates the clamp rather than re-implementing it",
  /\bresolveMaxDayMove\b/.test(routeSrc) && !/Math\.min\(\s*25/.test(routeSrc),
  "a second clamp in the route is a second definition of the range",
)

check(
  "the clamp still refuses 0 and NaN",
  /Number\.isFinite\(n\)/.test(trendLibSrc) &&
    /Math\.min\(MAX_DAY_MOVE\.MAX,\s*Math\.max\(MAX_DAY_MOVE\.MIN,\s*n\)\)/.test(trendLibSrc),
  "maxDayMove=0 would exclude every up day; NaN loses every comparison and disables the gate silently",
)

for (const [label, file] of [
  ["the Sell Put slider", "components/scanner/entry-exclusion-controls.tsx"],
  ["the shared tab notice", "components/scanner/entry-exclusion-notice.tsx"],
] as const) {
  const src = readFileSync(join(ROOT, file), "utf8")
  check(
    `${label} reads the shared range, not its own numbers`,
    /min=\{MAX_DAY_MOVE\.MIN\}/.test(src) && /max=\{MAX_DAY_MOVE\.MAX\}/.test(src) && /step=\{MAX_DAY_MOVE\.STEP\}/.test(src),
    file,
  )
}

check(
  "the Sell Put scanner's default comes from the shared constant",
  /useState<number\[\]>\(\[MAX_DAY_MOVE\.DEFAULT\]\)/.test(hookSrc),
  "a hardcoded 10 here and a DEFAULT of 10 there is two numbers that happen to agree",
)

if (failures > 0) {
  console.error(`\n${failures} playbook-rule check(s) failed.`)
  process.exit(1)
}
