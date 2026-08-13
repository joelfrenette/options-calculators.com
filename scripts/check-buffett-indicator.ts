/**
 * The Buffett Indicator refuses rather than guesses, and its units are right.
 *
 * Run: node scripts/check-buffett-indicator.ts
 *
 * WHY THIS FILE EXISTS (P7-73). `/api/ccpi` scores a Buffett Indicator scraped
 * from GuruFocus, and ScrapingBee is unset in both environments (P7-69), so the
 * scored value has been an LLM's recollection. FRED publishes both halves and
 * the site already reads FRED — but the two halves are in DIFFERENT UNITS
 * (millions vs billions) and the FRED numerator is a DIFFERENT MEASUREMENT
 * (nonfinancial corporate equities, not total market cap).
 *
 * Either of those, unnoticed, produces a number that renders and scores. The
 * first is out by 1000×; the second is out by ~34 percentage points and crosses
 * a band boundary. So both are pinned here with real measured values, not
 * invented fixtures.
 */

import { computeBuffettIndicator, observationGapDays } from "../lib/ccpi/buffett-indicator.ts"

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

// Real observations, read from FRED on 2026-08-14 rather than remembered.
const EQUITIES_MILLIONS = 69_511_628 // NCBEILQ027S, 2026-01-01
const GDP_BILLIONS = 31_865.721 // GDP, 2026-01-01

// ---------------------------------------------------------------- units

const real = computeBuffettIndicator(
  { corporateEquitiesMillions: EQUITIES_MILLIONS, gdpBillions: GDP_BILLIONS },
  "2026-01-01",
  "2026-01-01",
)

check("a real pair produces a reading", real !== null)
check(
  "the millions/billions conversion is applied",
  real !== null && real.percent > 100 && real.percent < 400,
  real ? `${real.percent}%` : "null",
)
check(
  "the reading matches the hand-computed ratio",
  real !== null && Math.abs(real.percent - 218.1) < 0.15,
  real ? `${real.percent}% vs 218.1% expected` : "null",
)

/**
 * The 1000× trap, stated as a test rather than a comment.
 *
 * Skipping the conversion gives 218,100% — which is not obviously absurd to a
 * threshold ladder that tops out at ">200". It would score 16 of 16 and read as
 * the most extreme overvaluation ever recorded.
 */
const unconverted = (EQUITIES_MILLIONS / GDP_BILLIONS) * 100
check(
  "an unconverted ratio would have been catastrophically wrong, and is not what we return",
  unconverted > 100_000 && real !== null && real.percent < 400,
  `unconverted ${Math.round(unconverted)}% vs returned ${real?.percent}%`,
)

// ---------------------------------------------------------------- refusal

const NULL_CASES: Array<[string, Parameters<typeof computeBuffettIndicator>]> = [
  ["no equities reading", [{ corporateEquitiesMillions: null, gdpBillions: GDP_BILLIONS }, "2026-01-01", "2026-01-01"]],
  ["no GDP reading", [{ corporateEquitiesMillions: EQUITIES_MILLIONS, gdpBillions: null }, "2026-01-01", "2026-01-01"]],
  ["zero GDP", [{ corporateEquitiesMillions: EQUITIES_MILLIONS, gdpBillions: 0 }, "2026-01-01", "2026-01-01"]],
  ["negative equities", [{ corporateEquitiesMillions: -1, gdpBillions: GDP_BILLIONS }, "2026-01-01", "2026-01-01"]],
  [
    "NaN GDP",
    [{ corporateEquitiesMillions: EQUITIES_MILLIONS, gdpBillions: Number.NaN }, "2026-01-01", "2026-01-01"],
  ],
  ["no equities date", [{ corporateEquitiesMillions: EQUITIES_MILLIONS, gdpBillions: GDP_BILLIONS }, null, "2026-01-01"]],
  ["no GDP date", [{ corporateEquitiesMillions: EQUITIES_MILLIONS, gdpBillions: GDP_BILLIONS }, "2026-01-01", null]],
]
for (const [label, args] of NULL_CASES) {
  check(`${label} returns null, not a partial ratio`, computeBuffettIndicator(...args) === null)
}

// ---------------------------------------------------------------- provenance

check(
  "the reading names its basis, so it cannot be mistaken for the scraped figure",
  real !== null && real.basis === "nonfinancial-corporate-equities",
  real ? real.basis : "null",
)

/**
 * The reason this is not wired into scoring, pinned so a future session cannot
 * quietly wire it. The CCPI bands are >200 / >180 / >150 / >120 and were
 * calibrated for the total-market-cap basis; the GuruFocus figure observed on
 * staging the same week read 183.8 and scored 13 of 16. This series reads 218.1
 * and would score 16 — a three-point move that is entirely a change of source.
 */
const GURUFOCUS_OBSERVED = 183.8
const band = (v: number) => (v > 200 ? 16 : v > 180 ? 13 : v > 150 ? 9 : v > 120 ? 5 : 0)
check(
  "the two bases do NOT agree, which is why this one does not score",
  real !== null && band(real.percent) !== band(GURUFOCUS_OBSERVED),
  real ? `FRED ${real.percent}% → ${band(real.percent)} pts vs GuruFocus ${GURUFOCUS_OBSERVED}% → ${band(GURUFOCUS_OBSERVED)} pts` : "null",
)

// ---------------------------------------------------------------- staleness

check(
  "an observation gap is reported in days, not as a boolean",
  observationGapDays("2026-01-01", "2025-10-01") === 92,
  String(observationGapDays("2026-01-01", "2025-10-01")),
)
check("an unparseable date gives null rather than 0 days", observationGapDays("not-a-date", "2026-01-01") === null)

if (failures > 0) {
  console.error(`\n${failures} Buffett Indicator check(s) failed.`)
  process.exit(1)
}
console.log("\nAll Buffett Indicator checks passed.")
