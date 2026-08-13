/**
 * The CCPI's two band tables still agree. (Phase 7.0, the assertion P6-85 named)
 *
 * Run: node scripts/check-ccpi-bands.ts
 *
 * WHY THIS COULD NOT BE WRITTEN BEFORE. `lib/ccpi/constants.ts` imported
 * `./constants` and `./types` without extensions, which node's native
 * type-stripping cannot resolve — so no check script could load it, and the
 * module holding the CCPI's regime boundaries was untestable **because of an
 * import style, not because of anything about the numbers**. That is what
 * AUDIT_PLAN step 7.0 means by "the constraint has been silently deciding what
 * gets tested". The extensions are on now; this is the first assertion the
 * change buys.
 *
 * WHAT IT COMPARES. Two tables describe the same 0-100 scale from different
 * files:
 *
 *   - `CCPI_THRESHOLDS` (lib/ccpi/constants.ts) — the FLOOR of each regime,
 *     read by `getRegimeZone` to colour and name the score.
 *   - `CCPI_ALLOCATION.bands` (lib/allocation.ts) — min/max/level/cash, read
 *     by the allocation panel to tell the user how much cash to hold.
 *
 * They are the audit's classic shape: **two records of one fact, in two files,
 * with nothing connecting them.** A boundary moved in one and not the other
 * gives a score labelled "High Alert" beside an allocation row for "Caution",
 * and neither file is wrong on its own terms. P6-21's yield-curve sign and
 * P6-66's two contradicting rows for one finding are the same defect in other
 * clothes.
 */

import { CCPI_THRESHOLDS } from "../lib/ccpi/constants.ts"
import { CCPI_ALLOCATION } from "../lib/allocation.ts"

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

const bands = CCPI_ALLOCATION.bands

check(
  "both tables loaded — this file could not exist before Phase 7.0",
  Object.keys(CCPI_THRESHOLDS).length > 0 && bands.length > 0,
  `${Object.keys(CCPI_THRESHOLDS).length} thresholds, ${bands.length} allocation bands`,
)

const EXPECTED_BANDS = 5
check(
  `scope: ${bands.length} allocation band(s)`,
  bands.length === EXPECTED_BANDS,
  `expected ${EXPECTED_BANDS} — a band added or dropped must be deliberate`,
)
check(
  `scope: ${Object.keys(CCPI_THRESHOLDS).length} threshold(s)`,
  Object.keys(CCPI_THRESHOLDS).length === EXPECTED_BANDS,
  "one threshold per band, or the two tables are describing different scales",
)

// ------------------------------------------------------------- coverage

const sorted = [...bands].sort((a, b) => a.min - b.min)

check("the bands start at 0", sorted[0]?.min === 0, `first band min = ${sorted[0]?.min}`)
check("the bands end at 100", sorted[sorted.length - 1]?.max === 100, `last band max = ${sorted[sorted.length - 1]?.max}`)
check(
  "the domain the scale advertises matches the bands it holds",
  CCPI_ALLOCATION.domain.min === sorted[0]?.min && CCPI_ALLOCATION.domain.max === sorted[sorted.length - 1]?.max,
  `domain ${CCPI_ALLOCATION.domain.min}-${CCPI_ALLOCATION.domain.max}`,
)

// No gaps and no overlaps. A gap means a score with no allocation advice; an
// overlap means two answers to one question, which is worse.
const seams: string[] = []
for (let i = 1; i < sorted.length; i++) {
  if (sorted[i].min !== sorted[i - 1].max + 1) {
    seams.push(`${sorted[i - 1].range} → ${sorted[i].range} (${sorted[i - 1].max} then ${sorted[i].min})`)
  }
}
check(
  "the bands tile the scale with no gap and no overlap",
  seams.length === 0,
  seams.length ? seams.join(", ") : `${sorted.map((b) => b.range).join(" · ")}`,
)

// ------------------------------------------------- thresholds vs bands

/**
 * Every threshold is the FLOOR of the band that shares its name. `getRegimeZone`
 * compares the score against these floors descending, so a threshold that does
 * not sit on a band boundary silently shifts the label relative to the cash
 * advice shown beside it.
 */
const norm = (s: string) => s.toLowerCase().replace(/[\s_]/g, "")
const bandByLevel = new Map(sorted.map((b) => [norm(b.level), b]))

for (const [key, floor] of Object.entries(CCPI_THRESHOLDS)) {
  const band = bandByLevel.get(norm(key))
  check(
    `threshold ${key} (${floor}) names a band`,
    band !== undefined,
    band ? `→ "${band.level}"` : `no allocation band called "${key}" — the two tables disagree on the regime NAMES`,
  )
  if (band) {
    check(
      `threshold ${key} sits on that band's floor`,
      band.min === floor,
      band.min === floor ? `${floor}` : `threshold says ${floor}, band "${band.level}" starts at ${band.min}`,
    )
  }
}

check(
  "every allocation band is named by a threshold",
  sorted.every((b) => Object.keys(CCPI_THRESHOLDS).some((k) => norm(k) === norm(b.level))),
  sorted
    .filter((b) => !Object.keys(CCPI_THRESHOLDS).some((k) => norm(k) === norm(b.level)))
    .map((b) => b.level)
    .join(", ") || "all five matched",
)

// ------------------------------------------------------------- monotonic

/**
 * Cash must rise with crash risk. This is the one assertion here that is about
 * meaning rather than bookkeeping: a table that tiles perfectly and matches
 * every name can still tell the user to hold LESS cash as the crash index
 * climbs, and nothing else in the suite would notice.
 */
const cashSteps = sorted.map((b) => b.cash)
const monotonic = cashSteps.every((c, i) => i === 0 || c >= cashSteps[i - 1])
check(
  "cash rises monotonically with crash risk",
  monotonic,
  `${sorted.map((b) => `${b.range}:${b.cash}%`).join(" ")}`,
)

if (failures > 0) {
  console.error(`\n${failures} CCPI band check(s) failed.`)
  process.exit(1)
}
