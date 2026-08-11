/**
 * Invariant checks for the CCPI scoring core (lib/ccpi/scoring.ts) and the
 * VIX term-structure ratio convention (lib/vix-term.ts).
 *
 * Run: node scripts/check-ccpi-scoring.ts
 *
 * Covers the AUDIT_BACKLOG Phase 3 cluster: P3-10 (scale), P3-12 (provenance
 * renormalization), P3-13 (certainty, playbook, amplifier ordering, yield
 * curve scored once), P3-14 (term-structure inversion).
 */
import {
  MOMENTUM_WEIGHTS,
  RISK_APPETITE_WEIGHTS,
  VALUATION_WEIGHTS,
  MACRO_WEIGHTS,
  MIN_SCORED_MAX,
  computeMomentumPillar,
  computeRiskAppetitePillar,
  computeValuationPillar,
  computeMacroPillar,
  computeBaseCCPI,
  calculateCrashAmplifiers,
  computeCertainty,
  determineRegime,
  getPlaybook,
  type Tier,
  type MomentumInputs,
  type MomentumTiers,
  type RiskAppetiteInputs,
  type RiskAppetiteTiers,
  type ValuationInputs,
  type ValuationTiers,
  type MacroInputs,
  type MacroTiers,
  type PillarResults,
} from "../lib/ccpi/scoring.ts"
import { computeTermStructure } from "../lib/vix-term.ts"

let failures = 0
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
}

const allTiers = <K extends string>(weights: ReadonlyArray<{ key: K }>, tier: Tier): Record<K, Tier> =>
  Object.fromEntries(weights.map((w) => [w.key, tier])) as Record<K, Tier>

// ---------------------------------------------------------------------------
// 1. Every pillar's WEIGHTS sum to exactly 100 (P3-10)
// ---------------------------------------------------------------------------
const sum = (ws: ReadonlyArray<{ max: number }>) => ws.reduce((s, w) => s + w.max, 0)
check("MOMENTUM_WEIGHTS sum to 100", sum(MOMENTUM_WEIGHTS) === 100, `${sum(MOMENTUM_WEIGHTS)}`)
check("RISK_APPETITE_WEIGHTS sum to 100", sum(RISK_APPETITE_WEIGHTS) === 100, `${sum(RISK_APPETITE_WEIGHTS)}`)
check("VALUATION_WEIGHTS sum to 100", sum(VALUATION_WEIGHTS) === 100, `${sum(VALUATION_WEIGHTS)}`)
check("MACRO_WEIGHTS sum to 100", sum(MACRO_WEIGHTS) === 100, `${sum(MACRO_WEIGHTS)}`)

// ---------------------------------------------------------------------------
// Synthetic inputs
// ---------------------------------------------------------------------------
const maxRiskMomentum: MomentumInputs = {
  nvidiaMomentum: 10,
  soxIndex: 4000, // -20% deviation
  qqqDailyReturn: -7,
  qqqConsecDown: 6,
  qqqBelowSMA20: true,
  qqqSMA20Proximity: 100,
  qqqBelowSMA50: true,
  qqqSMA50Proximity: 100,
  qqqBelowSMA200: true,
  qqqSMA200Proximity: 100,
  qqqBelowBollinger: true,
  qqqBollingerProximity: 100,
  vix: 45,
  vixTermStructure: 0.9, // severe backwardation
}
const calmMomentum: MomentumInputs = {
  nvidiaMomentum: 50,
  soxIndex: 5200,
  qqqDailyReturn: 0.5,
  qqqConsecDown: 0,
  qqqBelowSMA20: false,
  qqqSMA20Proximity: 0,
  qqqBelowSMA50: false,
  qqqSMA50Proximity: 0,
  qqqBelowSMA200: false,
  qqqSMA200Proximity: 0,
  qqqBelowBollinger: false,
  qqqBollingerProximity: 0,
  vix: 13,
  vixTermStructure: 1.08, // normal contango
}
const maxRiskRisk: RiskAppetiteInputs = { putCallRatio: 0.5, fearGreedIndex: 85, aaiiBullish: 60, shortInterest: 1.0 }
const calmRisk: RiskAppetiteInputs = { putCallRatio: 0.95, fearGreedIndex: 50, aaiiBullish: 35, shortInterest: 3.5 }
const maxRiskValuation: ValuationInputs = {
  spxPE: 35,
  spxPS: 4,
  buffettIndicator: 210,
  qqqPE: 45,
  mag7Concentration: 70,
  shillerCAPE: 40,
  equityRiskPremium: 1.0,
}
const calmValuation: ValuationInputs = {
  spxPE: 15,
  spxPS: 1.8,
  buffettIndicator: 100,
  qqqPE: 20,
  mag7Concentration: 40,
  shillerCAPE: 18,
  equityRiskPremium: 5,
}
const maxRiskMacro: MacroInputs = {
  tedSpread: 1.5,
  dxyIndex: 120,
  ismPMI: 40,
  fedFundsRate: 6.5,
  fedReverseRepo: 2500,
  junkSpread: 12,
  debtToGDP: 140,
  yieldCurve: -1.5,
}
const calmMacro: MacroInputs = {
  tedSpread: 0.2,
  dxyIndex: 95,
  ismPMI: 55,
  fedFundsRate: 3.0,
  fedReverseRepo: 300,
  junkSpread: 3.0,
  debtToGDP: 90,
  yieldCurve: 1.0,
}

const liveMomentum = allTiers(MOMENTUM_WEIGHTS, "live") as MomentumTiers
const liveRisk = allTiers(RISK_APPETITE_WEIGHTS, "live") as RiskAppetiteTiers
const liveValuation = allTiers(VALUATION_WEIGHTS, "live") as ValuationTiers
const liveMacro = allTiers(MACRO_WEIGHTS, "live") as MacroTiers

// ---------------------------------------------------------------------------
// 2. Max-risk live inputs ⇒ every pillar = 100 and base CCPI = 100
//    (also proves each indicator's branch maximum equals its WEIGHTS max)
// ---------------------------------------------------------------------------
const maxResults: PillarResults = {
  momentum: computeMomentumPillar(maxRiskMomentum, liveMomentum),
  riskAppetite: computeRiskAppetitePillar(maxRiskRisk, liveRisk),
  valuation: computeValuationPillar(maxRiskValuation, liveValuation),
  macro: computeMacroPillar(maxRiskMacro, liveMacro),
}
check("max-risk momentum pillar = 100", maxResults.momentum.score === 100, `got ${maxResults.momentum.score}`)
check("max-risk risk-appetite pillar = 100", maxResults.riskAppetite.score === 100, `got ${maxResults.riskAppetite.score}`)
check("max-risk valuation pillar = 100", maxResults.valuation.score === 100, `got ${maxResults.valuation.score}`)
check("max-risk macro pillar = 100", maxResults.macro.score === 100, `got ${maxResults.macro.score}`)
check("max-risk base CCPI = 100", computeBaseCCPI(maxResults) === 100, `got ${computeBaseCCPI(maxResults)}`)

// ---------------------------------------------------------------------------
// 3. Calm inputs ⇒ near-0
// ---------------------------------------------------------------------------
const calmResults: PillarResults = {
  momentum: computeMomentumPillar(calmMomentum, liveMomentum),
  riskAppetite: computeRiskAppetitePillar(calmRisk, liveRisk),
  valuation: computeValuationPillar(calmValuation, liveValuation),
  macro: computeMacroPillar(calmMacro, liveMacro),
}
check("calm momentum pillar = 0", calmResults.momentum.score === 0, `got ${calmResults.momentum.score}`)
check("calm risk-appetite pillar = 0", calmResults.riskAppetite.score === 0, `got ${calmResults.riskAppetite.score}`)
check("calm valuation pillar <= 5", (calmResults.valuation.score ?? 99) <= 5, `got ${calmResults.valuation.score}`)
check("calm macro pillar = 0", calmResults.macro.score === 0, `got ${calmResults.macro.score}`)
const calmBase = computeBaseCCPI(calmResults)
check("calm base CCPI <= 2", calmBase !== null && calmBase <= 2, `got ${calmBase}`)

// ---------------------------------------------------------------------------
// 4. Baseline-tier exclusion renormalizes (P3-12): baseline half the momentum
//    weight, feed max-risk values to the live half ⇒ pillar still reads 100.
// ---------------------------------------------------------------------------
// Baseline out qqqSMA200(15) + vix(13) + qqqDailyReturn(12) + qqqSMA50(10) = 50
const halfBaselined: MomentumTiers = {
  ...liveMomentum,
  qqqSMA200: "baseline",
  vix: "baseline",
  qqqDailyReturn: "baseline",
  qqqSMA50: "baseline",
}
const renormed = computeMomentumPillar(maxRiskMomentum, halfBaselined)
check("half-baselined pillar renormalizes to 100", renormed.score === 100, `got ${renormed.score} (scoredMax ${renormed.scoredMax})`)
check("half-baselined scoredMax = 50", renormed.scoredMax === 50)
check(
  "excluded list names the baselined inputs",
  ["qqqSMA200", "vix", "qqqDailyReturn", "qqqSMA50"].every((k) => renormed.excluded.includes(k)),
  renormed.excluded.join(","),
)

// Below MIN_SCORED_MAX ⇒ null, not a number built on air
const mostlyBaselined = allTiers(MOMENTUM_WEIGHTS, "baseline") as MomentumTiers
mostlyBaselined.vix = "live" // only 13 of 100 scored
const starved = computeMomentumPillar(maxRiskMomentum, mostlyBaselined)
check(`scoredMax < ${MIN_SCORED_MAX} ⇒ pillar reports null`, starved.score === null, `scoredMax ${starved.scoredMax}`)

// Null input value (Fear & Greed unavailable) is excluded AND renormalized
const fgNull = computeRiskAppetitePillar({ ...maxRiskRisk, fearGreedIndex: null }, liveRisk)
check("null F&G excluded and renormalized (still 100 at max risk)", fgNull.score === 100, `got ${fgNull.score}`)
check("null F&G reduces scoredMax to 76", fgNull.scoredMax === 76, `got ${fgNull.scoredMax}`)

// P7-10: the same contract for nvidiaMomentum, which was `number` until Alpha
// Vantage's failure path was found to be handing over a defaulted 50.
//
// The tier gate ALREADY excluded it when Alpha Vantage was down, so this is not
// re-testing the gate — it asserts the value path independently. A null must be
// excluded even when the tier says "live", because those are two different
// claims: the tier says where a reading came from, the value says whether there
// is one. P6-34's soxIndex and P6-18's Fear & Greed established the rule; this
// input was written before it and missed by P6-4, which fixed the identical
// idiom for AAII in the same route.
const nvNull = computeMomentumPillar({ ...maxRiskMomentum, nvidiaMomentum: null }, liveMomentum)
check(
  "null NVDA momentum excluded and renormalized (still 100 at max risk)",
  nvNull.score === 100,
  `got ${nvNull.score}`,
)
check(
  `null NVDA momentum reduces scoredMax by its weight (9)`,
  nvNull.scoredMax === 100 - 9,
  `got ${nvNull.scoredMax}`,
)
check(
  "null NVDA momentum is named in the excluded list",
  nvNull.excluded.includes("nvidiaMomentum"),
  nvNull.excluded.join(", ") || "(none)",
)
// A null must NOT read as a calm reading: 50 scores 0 points, so a fallback to
// 50 and a genuine absence would both leave the pillar at the same score while
// meaning opposite things. Only the scoredMax distinguishes them.
const nvFifty = computeMomentumPillar({ ...maxRiskMomentum, nvidiaMomentum: 50 }, liveMomentum)
check(
  "a 50 reading and a null are told apart by scoredMax, not by score",
  nvFifty.scoredMax === 100 && nvNull.scoredMax === 91,
  `50 ⇒ ${nvFifty.scoredMax}, null ⇒ ${nvNull.scoredMax}`,
)

// ---------------------------------------------------------------------------
// 5. Certainty decreases live → ai-estimate → baseline, canaries play no part
// ---------------------------------------------------------------------------
const mkResults = (tier: Tier): PillarResults => ({
  momentum: computeMomentumPillar(calmMomentum, allTiers(MOMENTUM_WEIGHTS, tier) as MomentumTiers),
  riskAppetite: computeRiskAppetitePillar(calmRisk, allTiers(RISK_APPETITE_WEIGHTS, tier) as RiskAppetiteTiers),
  valuation: computeValuationPillar(calmValuation, allTiers(VALUATION_WEIGHTS, tier) as ValuationTiers),
  macro: computeMacroPillar(calmMacro, allTiers(MACRO_WEIGHTS, tier) as MacroTiers),
})
const certLive = computeCertainty(mkResults("live"))
const certAI = computeCertainty(mkResults("ai-estimate"))
const certBaseline = computeCertainty(mkResults("baseline"))
check("all-live certainty = 100", certLive === 100, `got ${certLive}`)
// P6-34: an AI estimate of a published figure earns no certainty credit. The
// old rule gave it half, which was the same claim as scoring it, made quieter.
check("all-AI certainty = 0 — an estimate is not a measurement", certAI === 0, `got ${certAI}`)
check("all-baseline certainty = 0", certBaseline === 0, `got ${certBaseline}`)
check("live certainty is strictly above both non-live tiers", certLive > certAI && certLive > certBaseline)
check("AI and baseline are indistinguishable to certainty", certAI === certBaseline)
// computeCertainty takes only pillar provenance — there is no canary-count
// input to inflate it (the old formula ADDED certainty as canaries fired).
check("certainty has no canary-count parameter", computeCertainty.length === 1)

// ---------------------------------------------------------------------------
// 6. Amplifier ordering (P3-13): a -10% day must hit the -9 branch (+40)
// ---------------------------------------------------------------------------
const ampExtreme = calculateCrashAmplifiers({ qqqDailyReturn: -10, qqqBelowSMA50: false, vix: 20, putCallRatio: 1.0 })
check("-10% QQQ day earns the +40 EXTREME amplifier", ampExtreme.totalBonus === 40, `got ${ampExtreme.totalBonus}`)
const ampSevere = calculateCrashAmplifiers({ qqqDailyReturn: -7, qqqBelowSMA50: false, vix: 20, putCallRatio: 1.0 })
check("-7% QQQ day earns the +25 amplifier", ampSevere.totalBonus === 25, `got ${ampSevere.totalBonus}`)
// Yield curve no longer appears in the amplifiers (scored once, in Macro)
const ampFields = calculateCrashAmplifiers({ qqqDailyReturn: 0, qqqBelowSMA50: false, vix: 10, putCallRatio: 0.9 })
check("no amplifiers on a calm day", ampFields.totalBonus === 0)

// P6-20(a): the amplifiers sit outside the pillar tier system, so baseline
// constants used to reach them as real readings. A null input must be reported
// as unavailable, never scored, and never silently read as "all clear".
const ampNull = calculateCrashAmplifiers({
  qqqDailyReturn: null,
  qqqBelowSMA50: null,
  vix: null,
  putCallRatio: null,
})
check("all-null amplifier inputs earn no bonus", ampNull.totalBonus === 0, `got ${ampNull.totalBonus}`)
check(
  "all-null amplifier inputs are reported unavailable, not scored",
  ampNull.unavailableInputs.length === 4 && ampNull.bonuses.length === 0,
  `unavailable=${ampNull.unavailableInputs.join(",")} bonuses=${ampNull.bonuses.length}`,
)
// A partially-available set still scores what it can and names the rest.
const ampPartial = calculateCrashAmplifiers({
  qqqDailyReturn: null,
  qqqBelowSMA50: true,
  vix: 40,
  putCallRatio: null,
})
check(
  "available amplifier inputs still score alongside null ones",
  ampPartial.totalBonus === 40 &&
    ampPartial.unavailableInputs.join(",") === "qqqDailyReturn,putCallRatio",
  `got ${ampPartial.totalBonus} / ${ampPartial.unavailableInputs.join(",")}`,
)

// ---------------------------------------------------------------------------
// 7. VIX term structure ratio convention (P3-14)
// ---------------------------------------------------------------------------
const inverted = computeTermStructure(30, 27) // ratio 0.9
check("ratio 0.9 ⇒ inverted (backwardation)", inverted.isInverted && Math.abs(inverted.termStructure - 0.9) < 1e-9)
const contango = computeTermStructure(18, 19.44) // ratio 1.08
check("ratio 1.08 ⇒ not inverted", !contango.isInverted && Math.abs(contango.termStructure - 1.08) < 1e-9)
// The old defect: calm market (low spot VIX) must NOT score term-structure risk
const calmScored = computeMomentumPillar({ ...calmMomentum, vix: 12, vixTermStructure: 1.1 }, liveMomentum)
check("calm market in contango scores 0 momentum risk", calmScored.score === 0, `got ${calmScored.score}`)

// ---------------------------------------------------------------------------
// 8. Playbook branches on regime (P3-13)
// ---------------------------------------------------------------------------
const crashPlaybook = getPlaybook(determineRegime(85))
const calmPlaybook = getPlaybook(determineRegime(10))
check("Crash Watch playbook is defensive", /defensive|risk-off/i.test(crashPlaybook.bias), crashPlaybook.bias)
check("Low Risk playbook is risk-on", /risk-on/i.test(calmPlaybook.bias), calmPlaybook.bias)
check(
  "Crash Watch and Low Risk playbooks differ",
  JSON.stringify(crashPlaybook) !== JSON.stringify(calmPlaybook),
)
check("Crash Watch deployed allocation is reduced", crashPlaybook.allocation.deployed !== calmPlaybook.allocation.deployed)
check("Crash Watch cash allocation is raised", crashPlaybook.allocation.cash !== calmPlaybook.allocation.cash)

// ---------------------------------------------------------------------------
// P6-34: a null input earns no points, independently of its tier.
//
// The tier map already excludes non-live inputs, so these assertions are belt
// and braces — deliberately. The tier and the value come from two different
// places in the assembly layer, and the whole P6-31/32 class of defect was one
// of them being right while the other was not. The scoring core should refuse
// a missing value even if a caller mislabels it "live".
// ---------------------------------------------------------------------------
const nullRisk: RiskAppetiteInputs = {
  putCallRatio: null,
  fearGreedIndex: null,
  aaiiBullish: null,
  shortInterest: null,
}
const nullRiskLive = computeRiskAppetitePillar(nullRisk, allTiers(RISK_APPETITE_WEIGHTS, "live") as RiskAppetiteTiers)
check("all-null inputs score nothing even when tiered live", nullRiskLive.rawPoints === 0, `${nullRiskLive.rawPoints}`)
check("all-null inputs earn no scored weight", nullRiskLive.scoredMax === 0, `${nullRiskLive.scoredMax}`)
check("all-null inputs report null score, not 0/100", nullRiskLive.score === null, String(nullRiskLive.score))
check("all four indicators are listed as excluded", nullRiskLive.excluded.length === 4, `${nullRiskLive.excluded.length}`)

const oneRealRisk = computeRiskAppetitePillar(
  { putCallRatio: 0.5, fearGreedIndex: null, aaiiBullish: null, shortInterest: null },
  allTiers(RISK_APPETITE_WEIGHTS, "live") as RiskAppetiteTiers,
)
check("a single live input scores its own weight", oneRealRisk.scoredMax === 29, `${oneRealRisk.scoredMax}`)
check(
  "...but 29 is below MIN_SCORED_MAX, so the pillar still refuses a number",
  oneRealRisk.score === null,
  String(oneRealRisk.score),
)

console.log(failures === 0 ? "\nAll CCPI scoring checks passed." : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
