/**
 * CCPI certainty ceilings, computed from the real weight tables.
 *
 * Run: node scripts/ccpi-certainty-ceiling.ts
 *
 * WHY THIS FILE EXISTS. P6-35 published three ceiling figures — 81 / 62 / 59 —
 * describing how much of the CCPI can ever be measured under different outage
 * conditions. They were computed by hand and afterwards read as facts. This
 * script recomputes them from the weight tables, and the result is worth
 * stating precisely, because the obvious guess was wrong:
 *
 *   - **81 is correct** and unchanged.
 *   - **62 is correct as a SPECIFICATION and was never what production did.**
 *     Until 2026-08-11, `scrapePutCallRatio` and `scrapeAAIISentiment`
 *     self-reported `status: "live"` for LLM answers (P6-72, P6-74), so 55 of
 *     Risk Appetite's 100 points counted as measured. The real reported figure
 *     with ScrapingBee off was **79**, and the pillar did not drop out. The
 *     backlog's 62 described the intended behaviour of code that was not
 *     behaving that way.
 *   - **59 is obsolete.** It described "Alpha Vantage also down", and the
 *     VIX-derived put/call branch that distinction depended on is deleted.
 *
 * So the defect did not make the ceiling wrong — it made the LIVE READING
 * higher than the ceiling allowed, which is worse and harder to notice: an
 * index reporting 79% measured when 62% was the honest maximum, with its
 * largest pillar kept alive by two guesses. The historical scenario below is
 * retained so that gap stays visible.
 *
 * That is the P6-70 lesson generalised: **a number in a document is a claim
 * until something recomputes it** — including when recomputing vindicates it.
 * This script is the something. It drives the same weights `computeCertainty`
 * uses, so the ceilings move when a weight table or a data path changes.
 *
 * WHAT IT CANNOT TELL YOU: whether an indicator's live path actually works
 * today. The scenarios below encode which sources are ASSUMED reachable; they
 * are documented per scenario and are the input, not the output.
 */

import {
  MACRO_WEIGHTS,
  MOMENTUM_WEIGHTS,
  PILLAR_WEIGHTS,
  RISK_APPETITE_WEIGHTS,
  VALUATION_WEIGHTS,
  MIN_SCORED_MAX,
  type WeightEntry,
} from "../lib/ccpi/scoring.ts"

/**
 * Indicators with NO code path that can ever reach tier `live` — the LLM chain
 * is their only source (P6-35, unchanged by this session). Listing them here
 * rather than inferring keeps the assumption visible.
 */
// P7-89 emptied this set: the five LLM-only inputs were dropped from the
// weights outright, and soxIndex gained a measured source (Yahoo ^SOX). Kept
// as a set rather than deleted so the next never-live input has somewhere to
// be declared — an empty set here is a claim the suite verifies, not a shrug.
const NEVER_LIVE = new Set<string>([])

/** Indicators whose only live source is ScrapingBee. */
// buffettIndicator left this set in P7-73a: it comes from FRED now and does
// not touch ScrapingBee at all.
const SCRAPINGBEE_ONLY = new Set(["putCallRatio", "aaiiBullish"])

/** Indicators whose only live source is CNN. */
const CNN_ONLY = new Set(["fearGreedIndex"])

interface Scenario {
  name: string
  note: string
  scrapingBee: boolean
  cnn: boolean
  /** Historical scenarios only: keys that used to be counted live despite being AI-sourced. */
  countAiAsLive?: string[]
}

const SCENARIOS: Scenario[] = [
  {
    name: "Everything reachable",
    note: "ScrapingBee and CNN both up. 100 since P7-89: every input in the weight tables now has a live path — the ceiling below 100 WAS the six LLM-only inputs, and they are gone.",
    scrapingBee: true,
    cnn: true,
  },
  {
    name: "ScrapingBee off",
    note: "putCallRatio and aaiiBullish fall to ai-estimate (buffettIndicator left this list in P7-73a — it is FRED now). Risk Appetite keeps only Fear & Greed's 30 points, under MIN_SCORED_MAX, so the pillar drops out.",
    scrapingBee: false,
    cnn: true,
  },
  {
    name: "ScrapingBee and CNN off",
    note: "Risk Appetite loses every one of its three inputs.",
    scrapingBee: false,
    cnn: false,
  },
  // The fourth, HISTORICAL scenario — "ScrapingBee off, BEFORE P6-72/P6-74",
  // published 79 — was retired by P7-89. It modelled two scrapes self-reporting
  // "live" against the OLD weight tables; against the rescaled tables the same
  // lie computes the same 100 as everything-up, so the scenario can no longer
  // express the defect it existed to document. The record stays in the P6-35 /
  // P6-76 rows: production reported 79% measured when 62% was the honest
  // maximum, and the gap was two LLM guesses counted as measurements.
]

/** liveMax for one pillar under a scenario: the weight that can reach `live`. */
function liveMaxFor(weights: ReadonlyArray<WeightEntry>, s: Scenario): number {
  let live = 0
  for (const { key, max } of weights) {
    if (s.countAiAsLive?.includes(key)) {
      live += max
      continue
    }
    if (NEVER_LIVE.has(key)) continue
    if (SCRAPINGBEE_ONLY.has(key) && !s.scrapingBee) continue
    if (CNN_ONLY.has(key) && !s.cnn) continue
    live += max
  }
  return live
}

const PILLARS: Array<[string, ReadonlyArray<WeightEntry>, number]> = [
  ["momentum", MOMENTUM_WEIGHTS, PILLAR_WEIGHTS.momentum],
  ["riskAppetite", RISK_APPETITE_WEIGHTS, PILLAR_WEIGHTS.riskAppetite],
  ["valuation", VALUATION_WEIGHTS, PILLAR_WEIGHTS.valuation],
  ["macro", MACRO_WEIGHTS, PILLAR_WEIGHTS.macro],
]

/**
 * The figures AUDIT_BACKLOG (P6-35, P6-76) states in prose.
 *
 * Pinning them here is the whole point of the exercise. P6-70 and P6-76 both
 * found backlog numbers that had never been recomputed — one wrong (a breadth
 * trough dated October when it is late September), one right but describing
 * behaviour the code was not exhibiting. In both cases the document was read as
 * evidence when it was only ever a claim.
 *
 * With these assertions the prose and the arithmetic cannot drift apart
 * silently: change a weight table or a data path and the suite fails here,
 * naming the figure that needs updating in the backlog. **That is the same
 * structural move as lib/allocation.ts storing only cash — one source, and the
 * other side derived rather than restated.**
 */
const PUBLISHED: Record<string, number> = {
  // Post-P7-89 figures. The pre-rescale ceilings — 81 / 62 / 55, and the
  // historical 79 — are preserved in the P6-35/P6-76 backlog rows as the
  // record of the old weight tables.
  "Everything reachable": 100,
  "ScrapingBee off": 79,
  "ScrapingBee and CNN off": 70,
}

let failures = 0
function assertCeiling(name: string, computed: number): void {
  const published = PUBLISHED[name]
  if (published === undefined) {
    failures++
    console.log(`FAIL  ${name}: computed ${computed}, but no published figure is pinned`)
    return
  }
  if (published !== computed) {
    failures++
    console.log(
      `FAIL  ${name}: computed ${computed}, AUDIT_BACKLOG says ${published} — update the backlog (P6-35/P6-76) or the assumptions here`,
    )
    return
  }
  console.log(`PASS  ceiling "${name}" = ${computed}, matching AUDIT_BACKLOG`)
}

console.log("CCPI certainty ceilings — computed from the live weight tables\n")
console.log(`MIN_SCORED_MAX = ${MIN_SCORED_MAX} (a pillar below this reports null)\n`)

for (const s of SCENARIOS) {
  let certainty = 0
  const rows: string[] = []
  for (const [name, weights, share] of PILLARS) {
    const liveMax = liveMaxFor(weights, s)
    certainty += (liveMax / 100) * share
    const dropped = liveMax < MIN_SCORED_MAX
    rows.push(
      `    ${name.padEnd(13)} liveMax ${String(liveMax).padStart(3)}/100  ` +
        `share ${(share * 100).toFixed(0).padStart(2)}%  ${dropped ? "<- BELOW MIN_SCORED_MAX, pillar reports null" : ""}`,
    )
  }
  const computed = Math.round(certainty * 100)
  console.log(`  ${s.name}: certainty ${computed}`)
  rows.forEach((r) => console.log(r))
  console.log(`    ${s.note}`)
  assertCeiling(s.name, computed)
  console.log("")
}

// A pinned figure whose scenario has been renamed or removed fails too —
// otherwise the record could keep an entry nothing computes, which is the exact
// state P6-76 found the backlog in.
for (const name of Object.keys(PUBLISHED)) {
  if (!SCENARIOS.some((s) => s.name === name)) {
    failures++
    console.log(`FAIL  pinned figure for "${name}" has no matching scenario`)
  }
}

console.log(
  "Note: certainty counts LIVE weight only. A pillar that drops out for being below\n" +
    "MIN_SCORED_MAX still contributes 0 to certainty either way — the two mechanisms are\n" +
    "separate, and a low certainty does not by itself mean a pillar was dropped.",
)

console.log(failures === 0 ? "\nAll CCPI certainty ceilings match the record." : `\n${failures} CEILING CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
process.exit(failures === 0 ? 0 : 1)
