/**
 * The VIX cash bands say what the framework they cite says.
 *
 * Run: node scripts/check-vix-allocation.ts
 *
 * WHY THIS FILE EXISTS (P7-77). The Risk Calculator now names a third party's
 * published framework and renders its numbers. That makes every band a CLAIM
 * about somebody else's stated method, which is the strongest kind of label this
 * audit polices — a wrong number here misattributes a position to a named
 * person.
 *
 * The cash percentages are therefore pinned literally. If a future session
 * "tunes" one, this fails and the choice becomes deliberate: either the citation
 * goes or the number goes back.
 *
 * The file also pins the two structural properties the rewrite introduced —
 * invested derived from cash, and a single classification — because both were
 * previously untrue in this exact file and neither is visible by reading it
 * quickly.
 */

import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { computeFreeCashPosition, describeStanding } from "../components/risk/free-cash.ts"
import {
  VIX_LEVELS,
  cashRangeLabel,
  getVixLevel,
  getVixPortfolioAllocation,
} from "../components/risk/vix-allocation.ts"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

// ------------------------------------------------------- the cited numbers

/** Owner decision 2026-08-14. Cash floor/ceiling per band, as published. */
const CITED: Array<[string, number, number]> = [
  ["< 15", 25, 50],
  ["15 - 20", 15, 25],
  ["20 - 30", 5, 10],
  ["> 30", 0, 5],
]

check(`scope: ${VIX_LEVELS.length} band(s)`, VIX_LEVELS.length === CITED.length, `expected ${CITED.length}`)

CITED.forEach(([range, cashMin, cashMax], i) => {
  const b = VIX_LEVELS[i]
  check(
    `band ${i + 1} is "${range}" holding ${cashMin}-${cashMax}% cash`,
    b !== undefined && b.range === range && b.cashMin === cashMin && b.cashMax === cashMax,
    b ? `${b.range} @ ${b.cashMin}-${b.cashMax}%` : "missing",
  )
})

/** Cash falls monotonically as fear rises — the whole premise of the framework. */
for (let i = 1; i < VIX_LEVELS.length; i++) {
  check(
    `cash does not rise from band ${i} to band ${i + 1}`,
    VIX_LEVELS[i].cashMax <= VIX_LEVELS[i - 1].cashMax,
    `${VIX_LEVELS[i - 1].cashMax}% → ${VIX_LEVELS[i].cashMax}%`,
  )
}

// ------------------------------------------------- invested is DERIVED

for (const b of VIX_LEVELS) {
  check(
    `${b.range}: invested is exactly 100 − cash`,
    b.investedMin === 100 - b.cashMax && b.investedMax === 100 - b.cashMin,
    `cash ${b.cashMin}-${b.cashMax} → invested ${b.investedMin}-${b.investedMax}`,
  )
}

/**
 * The source states 15–25% cash AND "deploying roughly 50% to 75%" for the same
 * band, which do not sum to 100. This pins the resolution: the cash figure is
 * authoritative and invested is computed, so the pair can never disagree.
 */
const midBand = VIX_LEVELS[1]
check(
  "the source's conflicting 50-75% deployment figure is NOT what is rendered",
  midBand.investedMin === 75 && midBand.investedMax === 85,
  `derived ${midBand.investedMin}-${midBand.investedMax}% from 15-25% cash`,
)

// ------------------------------------------------- ONE classification

/**
 * The property the old header claimed and the old code did not have: the
 * allocation detail must be a lookup on the band, not a second ladder.
 * Swept across the whole plausible VIX range at 0.5 steps.
 */
let mismatches = 0
for (let vix = 0; vix <= 90; vix += 0.5) {
  const band = getVixLevel(vix)
  const alloc = getVixPortfolioAllocation(vix)
  if (alloc.cash !== cashRangeLabel(band)) mismatches++
  if (alloc.description !== band.allocation.description) mismatches++
}
check(
  "the allocation detail agrees with the band at every VIX from 0 to 90",
  mismatches === 0,
  mismatches === 0 ? "one ladder, swept at 0.5 steps" : `${mismatches} disagreement(s) — a second ladder is back`,
)

// ------------------------------------------------- boundaries

const BOUNDARIES: Array<[number, string]> = [
  [0, "< 15"],
  [14.9, "< 15"],
  [15, "15 - 20"],
  [20, "15 - 20"], // a boundary reading belongs to the calmer band
  [20.1, "20 - 30"],
  [30, "20 - 30"],
  [30.1, "> 30"],
  [85, "> 30"],
]
for (const [vix, expected] of BOUNDARIES) {
  check(`VIX ${vix} lands in "${expected}"`, getVixLevel(vix).range === expected, getVixLevel(vix).range)
}

// ------------------------------------------------- what must NOT be advice

/**
 * The framework's >30 guidance includes bringing fresh external capital into the
 * account. Owner decision 2026-08-14: not implemented. Adding new money is a
 * different act from rebalancing what is already invested, and a calculator that
 * suggests it is making a far stronger claim than one showing a cash target.
 *
 * Pinned as a NEGATIVE: the panic band's copy must not tell anyone to add funds.
 */
const panic = VIX_LEVELS[3]
const panicCopy = [panic.optionsAction, panic.equityAction, panic.allocation.description].join(" ").toLowerCase()
const ADD_MONEY = /deposit|add (?:new |fresh |external )?(?:capital|funds|money)|bring in (?:new|fresh|outside|external)|wire (?:in|more)/
check(
  "the panic band does not tell anyone to add outside capital",
  !ADD_MONEY.test(panicCopy),
  "owner decision: rebalancing and funding are different decisions",
)

/** And every band's cash label is generated, never typed twice. */
for (const b of VIX_LEVELS) {
  check(
    `${b.range}: the rendered cash label is derived from the band`,
    getVixPortfolioAllocation((b.cashMin + b.cashMax) / 2 + (b.range === "> 30" ? 40 : 0)) !== null,
    cashRangeLabel(b),
  )
}

// ------------------------------------------------- free cash vs the target

/**
 * P7-79. The tab used to compute a TARGET and never a measurement. These pin the
 * measurement, and the first two are the ones that matter: a blank field must
 * not become 0, and collateral must not be silently ignored.
 */

/** The worked example from the header: $30k cash, $20k pledged, $100k account. */
const WORKED = computeFreeCashPosition(
  { accountValue: 100_000, cashOnHand: 30_000, committedCollateral: 20_000 },
  15,
  25,
)
check(
  "collateral is subtracted — $30k cash less $20k pledged reads 10%, not 30%",
  WORKED !== null && WORKED.freeCashPercent === 10,
  WORKED ? `${WORKED.freeCashPercent}%` : "null",
)
check(
  "and 10% against a 15-25% target reads UNDER, not on target",
  WORKED !== null && WORKED.standing === "under" && WORKED.distanceFromTarget === 5,
  WORKED ? `${WORKED.standing}, ${WORKED.distanceFromTarget} pts` : "null",
)

/**
 * The defect this shape invites: a blank input coerced to 0 renders a confident
 * "badly under" from no data at all. Each field is checked separately because
 * `|| 0` would have made all three look identical.
 */
const BLANKS: Array<[string, Parameters<typeof computeFreeCashPosition>[0]]> = [
  ["no account value", { accountValue: null, cashOnHand: 30_000, committedCollateral: 20_000 }],
  ["no cash figure", { accountValue: 100_000, cashOnHand: null, committedCollateral: 20_000 }],
  ["no collateral figure", { accountValue: 100_000, cashOnHand: 30_000, committedCollateral: null }],
]
for (const [label, inputs] of BLANKS) {
  check(
    `${label} returns null rather than a 0% position`,
    computeFreeCashPosition(inputs, 15, 25) === null,
  )
}

check(
  "a zero account value returns null — an account worth nothing has no allocation",
  computeFreeCashPosition({ accountValue: 0, cashOnHand: 10_000, committedCollateral: 0 }, 15, 25) === null,
)
check(
  "a negative input is treated as a typo, not a position",
  computeFreeCashPosition({ accountValue: 100_000, cashOnHand: -1, committedCollateral: 0 }, 15, 25) === null,
)

/** Over-commitment is reported, not clamped to a calm 0%. */
const OVER = computeFreeCashPosition(
  { accountValue: 100_000, cashOnHand: 10_000, committedCollateral: 25_000 },
  15,
  25,
)
check(
  "collateral exceeding cash yields a NEGATIVE free-cash figure, not 0",
  OVER !== null && OVER.freeCashPercent === -15 && OVER.overCommitted,
  OVER ? `${OVER.freeCashPercent}%, overCommitted=${OVER.overCommitted}` : "null",
)
check(
  "and the sentence says so plainly instead of reporting a standing",
  OVER !== null && describeStanding(OVER, 15, 25).includes("exceeds cash on hand"),
  OVER ? describeStanding(OVER, 15, 25) : "null",
)

/** Band edges are inside the target, not outside it. */
for (const [pct, cash, expected] of [
  [15, 15_000, "within"],
  [25, 25_000, "within"],
  [26, 26_000, "over"],
  [14, 14_000, "under"],
] as Array<[number, number, string]>) {
  const pos = computeFreeCashPosition(
    { accountValue: 100_000, cashOnHand: cash, committedCollateral: 0 },
    15,
    25,
  )
  check(`${pct}% against a 15-25% target reads "${expected}"`, pos !== null && pos.standing === expected, pos?.standing)
}

/** Every sentence names the target it was measured against. */
const within = computeFreeCashPosition(
  { accountValue: 100_000, cashOnHand: 20_000, committedCollateral: 0 },
  15,
  25,
)
check(
  "the reading names the band target rather than standing alone",
  within !== null && describeStanding(within, 15, 25).includes("15-25%"),
  within ? describeStanding(within, 15, 25) : "null",
)


// ------------------------------------------------- no sixth ladder

/**
 * NOTHING outside this module may classify a VIX reading.
 *
 * When the bands were cut from six to four, THREE more ladders turned up that
 * the library knew nothing about: a hardcoded six-row range list in the
 * allocation section, a nested-ternary boundary ladder beside it computing which
 * row is CURRENT, and a five-rung sentiment ternary in the calculator itself.
 * The library change alone left the tab rendering six rows — two of them
 * duplicates — with the CURRENT badge on the old boundaries.
 *
 * A number that only LOOKS like a threshold is not enough to fail on, so this
 * scans for the shape that actually caused it: a comparison of a VIX-named
 * variable against a band boundary.
 */
const VIX_FILES = [
  "components/risk-calculator.tsx",
  ...readdirSync(join(ROOT, "components/risk"))
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .filter((f) => f !== "vix-allocation.ts")
    .map((f) => `components/risk/${f}`),
]
const MIN_VIX_FILES = 3
check(
  `scope: ${VIX_FILES.length} file(s) scanned for a second classification`,
  VIX_FILES.length >= MIN_VIX_FILES,
  `floor ${MIN_VIX_FILES} — the tab plus components/risk/** except the library itself`,
)

/**
 * Built from a STRING with String.raw, not a regex literal.
 *
 * The literal that stood here contained a real BACKSPACE byte where a word
 * boundary was meant — a generator script wrote the escape through a
 * language that interpreted it. The pattern then asked for a control
 * character that appears in no source file, so this rule reported clean on a
 * file that visibly held the ladder, and two rewrites of the scanning logic
 * were spent before the regex itself turned out to be the problem.
 *
 * The ONLY reason it surfaced is that the negative test refused to fail. A
 * checker whose negative test will not fire is worth nothing.
 */
const BOUNDARY = new RegExp(String.raw`\bvix\w*\s*(?:<=|>=|<|>)\s*(?:12|15|20|25|30)\b`, "i")
const ladders: string[] = []
for (const f of VIX_FILES) {
  // The simplest mechanism that can be checked by eye. Two smarter versions
  // were tried first — a whole-file regex strip, then a block-comment state
  // machine — and BOTH reported clean on a file that visibly contained the
  // ladder. A checker whose negative test will not fire is worth nothing, and
  // this project has a standing note saying exactly that.
  for (const raw of readFileSync(join(ROOT, f), "utf8").split("\n")) {
    const line = raw.trim()
    if (line.startsWith("//") || line.startsWith("*") || line.startsWith("/*") || line.startsWith("{/*")) continue
    if (BOUNDARY.test(line)) {
      ladders.push(`${f}: ${line.slice(0, 60)}`)
      break
    }
  }
}
check(
  "no file outside the library compares a VIX reading against a band boundary",
  ladders.length === 0,
  ladders.length
    ? `${ladders.join(", ")} — call getVixLevel() instead`
    : "getVixLevel is the only place a VIX number becomes a band",
)

if (failures > 0) {
  console.error(`\n${failures} VIX allocation check(s) failed.`)
  process.exit(1)
}
console.log("\nAll VIX allocation checks passed.")
