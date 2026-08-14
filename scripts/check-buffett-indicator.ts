/**
 * The Buffett Indicator refuses rather than guesses, and its units are right.
 *
 * Run: node scripts/check-buffett-indicator.ts
 *
 * WHY THIS FILE EXISTS (P7-73, then P7-73a). FRED publishes both halves of a
 * Buffett Indicator and since the 2026-08-14 owner decision the CCPI scores
 * this basis through its own recalibrated ladder — but the two halves are in
 * DIFFERENT UNITS (millions vs billions) and the FRED numerator is a DIFFERENT
 * MEASUREMENT (nonfinancial corporate equities, not the total market cap the
 * retired scrape used).
 *
 * Either of those, unnoticed, produces a number that renders and scores. The
 * first is out by 1000×; the second is out by ~34 percentage points and crosses
 * a band boundary. So both are pinned here with real measured values, not
 * invented fixtures.
 */

import { computeBuffettIndicator, observationGapDays } from "../lib/ccpi/buffett-indicator.ts"
import { BUFFETT_BANDS, BUFFETT_BASIS, BUFFETT_MAX, scoreBuffett, buffettCanarySeverity } from "../lib/ccpi/buffett-bands.ts"

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
  real !== null && real.basis === BUFFETT_BASIS,
  real ? real.basis : "null",
)

/**
 * P7-73a: the FRED basis IS wired into scoring now, through a ladder
 * recalibrated for this series' own history (>210/>195/>150/>120 — see
 * lib/ccpi/buffett-bands.ts and CCPI_DESIGN §8b). What stays pinned is the
 * DIVERGENCE: the two bases still measure different things, and the old
 * total-market-cap ladder must never be fed this series. The GuruFocus figure
 * observed on staging the week of the decision read 183.8 — under this ladder
 * that would be 9 points, under its own retired ladder 13, and this series
 * reads 218.1 → 16. Any future "simplification" that reunifies the ladders
 * has to get past these assertions.
 */
const GURUFOCUS_OBSERVED = 183.8
const OLD_TOTAL_MARKET_BAND = (v: number) => (v > 200 ? 16 : v > 180 ? 13 : v > 150 ? 9 : v > 120 ? 5 : 0)
check(
  "the recalibrated ladder puts today's FRED reading in the top band",
  real !== null && scoreBuffett(real.percent) === BUFFETT_MAX,
  real ? `${real.percent}% → ${scoreBuffett(real.percent)} of ${BUFFETT_MAX}` : "null",
)
check(
  "the two bases still disagree — the scraped figure lands two rungs lower on this ladder",
  scoreBuffett(GURUFOCUS_OBSERVED) === 9 && OLD_TOTAL_MARKET_BAND(GURUFOCUS_OBSERVED) === 13,
  `183.8 → ${scoreBuffett(GURUFOCUS_OBSERVED)} pts on the FRED ladder vs ${OLD_TOTAL_MARKET_BAND(GURUFOCUS_OBSERVED)} on the retired one`,
)
check(
  "210 exactly is NOT in the top band — the cutoffs are exclusive",
  scoreBuffett(210) === 13,
  `210 → ${scoreBuffett(210)}`,
)
check("no reading scores null, never zero", scoreBuffett(null) === null)
check(
  "the ladder's cutoffs strictly descend and its top points equal BUFFETT_MAX",
  BUFFETT_BANDS.every((b, i) => i === 0 || b.above < BUFFETT_BANDS[i - 1].above) &&
    BUFFETT_BANDS[0].points === BUFFETT_MAX,
  BUFFETT_BANDS.map((b) => `>${b.above}=${b.points}`).join(" "),
)
check(
  "canary severity agrees with the scoring ladder at both rungs it uses",
  buffettCanarySeverity(BUFFETT_BANDS[0].above + 1) === "high" &&
    buffettCanarySeverity(BUFFETT_BANDS[2].above + 1) === "medium" &&
    buffettCanarySeverity(BUFFETT_BANDS[3].above + 1) === null &&
    buffettCanarySeverity(null) === null,
  "high above the top cutoff, medium above the third, nothing below, null in null out",
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
