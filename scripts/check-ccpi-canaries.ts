/**
 * CCPI canary checks — lib/ccpi/canaries.ts.
 *
 * Run: node scripts/check-ccpi-canaries.ts
 *
 * WHY THIS EXISTS. The canary thresholds used to live inside the CCPI route,
 * reading the assembly layer's values directly. That layer substitutes
 * constants for anything it cannot fetch, so a canary could fire on a number
 * the market never produced — and one did: `buffettIndicator || 180` sat above
 * its own 150 threshold and pushed "Above fair value" as a warning on every
 * load with no data behind it (P6-31). Thirty-one more inputs had the same
 * exposure with the constant hidden upstream (P6-32).
 *
 * Two sweeps missed this by reading code. The property that catches it is
 * mechanical and cheap to assert: NULL IN, NOTHING OUT. So the first check
 * below is the whole point of the file — an entirely empty market produces
 * zero warnings and names every indicator it could not check.
 */

import { generateCanarySignals, SOX_REFERENCE_LEVEL, type CanaryInputs } from "../lib/ccpi/canaries.ts"
import { PILLAR_WEIGHTS, SOX_REFERENCE_LEVEL as SCORING_SOX_REF } from "../lib/ccpi/scoring.ts"

const PILLAR_PCT = {
  momentum: PILLAR_WEIGHTS.momentum * 100,
  riskAppetite: PILLAR_WEIGHTS.riskAppetite * 100,
  valuation: PILLAR_WEIGHTS.valuation * 100,
  macro: PILLAR_WEIGHTS.macro * 100,
}

let failures = 0
function check(name: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`)
  } else {
    failures++
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

const ALL_NULL: CanaryInputs = {
  qqqDailyReturn: null,
  qqqConsecDown: null,
  qqqBelowSMA20: null,
  qqqSMA20Proximity: null,
  qqqBelowSMA50: null,
  qqqSMA50Proximity: null,
  qqqBelowSMA200: null,
  qqqSMA200Proximity: null,
  qqqBelowBollinger: null,
  qqqBollingerProximity: null,
  vix: null,
  vixTermStructure: null,
  nvidiaMomentum: null,
  soxIndex: null,
  putCallRatio: null,
  fearGreedIndex: null,
  aaiiBullish: null,
  shortInterest: null,
  etfFlows: null,
  spxPE: null,
  spxPS: null,
  buffettIndicator: null,
  qqqPE: null,
  mag7Concentration: null,
  shillerCAPE: null,
  equityRiskPremium: null,
  fedFundsRate: null,
  junkSpread: null,
  debtToGDP: null,
  yieldCurve: null,
  tedSpread: null,
  dxyIndex: null,
  ismPMI: null,
  fedReverseRepo: null,
}

const INDICATOR_COUNT = 30 // 34 fields; the four breach/proximity pairs share one gate each

// ---------------------------------------------------------------------------
// 1. THE REGRESSION: no data must produce no warnings.
// ---------------------------------------------------------------------------
const empty = generateCanarySignals(ALL_NULL, PILLAR_PCT)
check("an entirely unavailable market produces ZERO canaries", empty.canaries.length === 0, `${empty.canaries.length} fired`)
check(
  "every indicator is reported as suppressed rather than silently skipped",
  empty.suppressed.length === INDICATOR_COUNT,
  `${empty.suppressed.length} of ${INDICATOR_COUNT}`,
)
check("suppressed names are unique", new Set(empty.suppressed).size === empty.suppressed.length)

// The exact defect: 180 was the old fallback and it is above the 150 threshold.
const buffettOnly = generateCanarySignals({ ...ALL_NULL, buffettIndicator: 180 }, PILLAR_PCT)
check(
  "Buffett 180 DOES fire when measured — the threshold itself is unchanged",
  buffettOnly.canaries.length === 1 && buffettOnly.canaries[0].signal.includes("Above fair value"),
  buffettOnly.canaries[0]?.signal ?? "none",
)
check(
  "...and fires NOT AT ALL when unavailable, which is the fix",
  generateCanarySignals(ALL_NULL, PILLAR_PCT).canaries.some((c) => c.signal.includes("Buffett")) === false,
)
check("Buffett is named in suppressed when null", empty.suppressed.includes("Buffett Indicator"))

// The two other P6-31 constants, pinned at the values they used to default to.
check(
  "short interest 2.5 (the old fallback) sits exactly on its own boundary",
  generateCanarySignals({ ...ALL_NULL, shortInterest: 2.5 }, PILLAR_PCT).canaries.length === 0,
)
check(
  "short interest 2.4 does fire",
  generateCanarySignals({ ...ALL_NULL, shortInterest: 2.4 }, PILLAR_PCT).canaries.length === 1,
)
check(
  "AAII 35 (the old fallback) is below its threshold and stays quiet",
  generateCanarySignals({ ...ALL_NULL, aaiiBullish: 35 }, PILLAR_PCT).canaries.length === 0,
)
check(
  "AAII 56 fires as retail euphoria",
  generateCanarySignals({ ...ALL_NULL, aaiiBullish: 56 }, PILLAR_PCT).canaries[0]?.severity === "high",
)

// ---------------------------------------------------------------------------
// 2. Non-finite input is missing input, not a number.
// ---------------------------------------------------------------------------
check("NaN is treated as missing", generateCanarySignals({ ...ALL_NULL, vix: Number.NaN }, PILLAR_PCT).canaries.length === 0)
check("NaN is reported as suppressed", generateCanarySignals({ ...ALL_NULL, vix: Number.NaN }, PILLAR_PCT).suppressed.includes("VIX"))
check(
  "Infinity is treated as missing",
  generateCanarySignals({ ...ALL_NULL, spxPE: Number.POSITIVE_INFINITY }, PILLAR_PCT).canaries.length === 0,
)

// ---------------------------------------------------------------------------
// 3. Paired inputs share a gate — half a reading is not a reading.
// ---------------------------------------------------------------------------
check(
  "a breach flag without its proximity produces nothing",
  generateCanarySignals({ ...ALL_NULL, qqqBelowSMA200: true }, PILLAR_PCT).canaries.length === 0,
)
check(
  "a proximity without its breach flag produces nothing",
  generateCanarySignals({ ...ALL_NULL, qqqSMA200Proximity: 100 }, PILLAR_PCT).canaries.length === 0,
)
check(
  "both together do fire",
  generateCanarySignals({ ...ALL_NULL, qqqBelowSMA200: true, qqqSMA200Proximity: 100 }, PILLAR_PCT).canaries.length === 1,
)
check(
  "a false breach flag with high proximity is the 'approaching' warning, not the breach",
  generateCanarySignals({ ...ALL_NULL, qqqBelowSMA200: false, qqqSMA200Proximity: 60 }, PILLAR_PCT).canaries[0]?.severity ===
    "medium",
)

// ---------------------------------------------------------------------------
// 4. Ordering and impact scoring survived the move out of the route.
// ---------------------------------------------------------------------------
const mixed = generateCanarySignals({
  ...ALL_NULL,
  vix: 40, // high, momentum weight 13
  spxPE: 25, // medium, valuation weight 18
  fedFundsRate: 6.5, // high, macro weight 15
}, PILLAR_PCT)
check("three inputs produce three canaries", mixed.canaries.length === 3, String(mixed.canaries.length))
check("high severity sorts before medium", mixed.canaries[2].severity === "medium")
check(
  "within a severity, higher impact score sorts first",
  mixed.canaries[0].impactScore >= mixed.canaries[1].impactScore,
  `${mixed.canaries[0].impactScore.toFixed(2)} >= ${mixed.canaries[1].impactScore.toFixed(2)}`,
)
check(
  "impact score is indicator weight x pillar share",
  Math.abs(mixed.canaries.find((c) => c.signal.includes("VIX"))!.impactScore - 13 * (35 / 100)) < 1e-9,
)
check(
  "three of 30 measured leaves 27 suppressed",
  mixed.suppressed.length === INDICATOR_COUNT - 3,
  `${mixed.suppressed.length}`,
)

// ---------------------------------------------------------------------------
// 5. Boundaries — a threshold is exclusive, so equality must not fire.
// ---------------------------------------------------------------------------
check("VIX exactly 25 does not fire", generateCanarySignals({ ...ALL_NULL, vix: 25 }, PILLAR_PCT).canaries.length === 0)
check("VIX 25.1 fires medium", generateCanarySignals({ ...ALL_NULL, vix: 25.1 }, PILLAR_PCT).canaries[0]?.severity === "medium")
check("VIX 35.1 fires high", generateCanarySignals({ ...ALL_NULL, vix: 35.1 }, PILLAR_PCT).canaries[0]?.severity === "high")
check(
  "a normal yield curve raises no inversion warning",
  generateCanarySignals({ ...ALL_NULL, yieldCurve: 0.44 }, PILLAR_PCT).canaries.length === 0,
)
check(
  "an inverted curve does (10Y-2Y convention, P6-21)",
  generateCanarySignals({ ...ALL_NULL, yieldCurve: -1.2 }, PILLAR_PCT).canaries[0]?.severity === "high",
)

// ---------------------------------------------------------------------------
// 6. ETF flows are informational — weight 0, never scored.
// ---------------------------------------------------------------------------
const etf = generateCanarySignals({ ...ALL_NULL, etfFlows: -4 }, PILLAR_PCT)
check("ETF outflows fire a canary", etf.canaries.length === 1)
check("...with zero indicator weight", etf.canaries[0].indicatorWeight === 0)
check("...and therefore zero impact score", etf.canaries[0].impactScore === 0)

// ---------------------------------------------------------------------------
// 7. SOX: the canary must state the level it measures against (P6-33).
// ---------------------------------------------------------------------------
check(
  "the two SOX reference constants cannot drift apart",
  SOX_REFERENCE_LEVEL === SCORING_SOX_REF,
  `${SOX_REFERENCE_LEVEL} vs ${SCORING_SOX_REF}`,
)
const sox = generateCanarySignals({ ...ALL_NULL, soxIndex: 4200 }, PILLAR_PCT)
check("a 16% shortfall fires high", sox.canaries[0]?.severity === "high", sox.canaries[0]?.signal ?? "none")
check(
  "...and the wording names the reference rather than implying a market move",
  sox.canaries[0]?.signal.includes(String(SOX_REFERENCE_LEVEL)) === true,
  sox.canaries[0]?.signal ?? "none",
)
check(
  "...and does not claim the index 'fell', which it never measured",
  /down \d/.test(sox.canaries[0]?.signal ?? "") === false,
  sox.canaries[0]?.signal ?? "none",
)
check("SOX at the reference level fires nothing", generateCanarySignals({ ...ALL_NULL, soxIndex: 5000 }, PILLAR_PCT).canaries.length === 0)

console.log(failures === 0 ? "\nAll CCPI canary checks passed." : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
