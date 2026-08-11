/**
 * Allocation checks — lib/allocation.ts.
 *
 * Run: node scripts/check-allocation.ts
 *
 * WHY THIS FILE EXISTS. The same defect appeared five separate times on this
 * site: a cash figure and a stocks/exposure figure were both stored, and they
 * drifted apart. The CCPI dashboard had a five-column split whose columns never
 * summed to 100 and an options card claiming "cash 5-10%" beside "exposure
 * 90-100%"; market sentiment had two tables that disagreed with each other in
 * the same component, one of which was never even rendered; panic-euphoria
 * still has a three-column table running 90 to 115.
 *
 * Storing only cash makes the arithmetic impossible to get wrong, and these
 * checks make it impossible to reintroduce a second stored half without the
 * suite noticing.
 *
 * What this canNOT verify: whether 35% cash is the right answer at CCPI 45.
 * That is a judgement call, and no check can settle it. What it verifies is
 * that whatever the figures are, they are internally consistent, ordered the
 * way the underlying gauge runs, and never silently benign when data is
 * missing.
 */

import {
  CCPI_ALLOCATION,
  SENTIMENT_ALLOCATION,
  type AllocationScale,
  bandForScore,
  formatPct,
  stocksFor,
} from "../lib/allocation.ts"

let failures = 0
function check(name: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`)
  } else {
    failures++
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

const SCALES: ReadonlyArray<[string, AllocationScale]> = [
  ["CCPI", CCPI_ALLOCATION],
  ["Sentiment", SENTIMENT_ALLOCATION],
]

// ---------------------------------------------------------------------------
// 1. The invariant the whole module exists to guarantee.
// ---------------------------------------------------------------------------
for (const [label, scale] of SCALES) {
  for (const band of scale.bands) {
    const stocks = stocksFor(band)
    check(
      `${label} ${band.range} ${band.level}: stocks + cash === 100`,
      stocks + band.cash === 100,
      `${stocks}% + ${band.cash}%`,
    )
  }
}

// ---------------------------------------------------------------------------
// 2. Exact figures, not ranges. A fractional percent is a range in disguise.
// ---------------------------------------------------------------------------
for (const [label, scale] of SCALES) {
  check(
    `${label} bands all carry a whole-number cash percent`,
    scale.bands.every((b) => Number.isInteger(b.cash) && b.cash >= 0 && b.cash <= 100),
    scale.bands.map((b) => `${b.cash}`).join(", "),
  )
}

// ---------------------------------------------------------------------------
// 3. Cash must rise with the score, or the gauge contradicts its own direction.
//    Both scales are defined so that a higher score means more caution.
// ---------------------------------------------------------------------------
for (const [label, scale] of SCALES) {
  let monotonic = true
  for (let i = 1; i < scale.bands.length; i++) {
    if (scale.bands[i].cash <= scale.bands[i - 1].cash) monotonic = false
  }
  check(`${label} cash rises with every band`, monotonic, scale.bands.map((b) => `${b.cash}%`).join(" < "))
}

// ---------------------------------------------------------------------------
// 4. Bands must tile their scale with no gap and no overlap. A gap means some
//    score silently renders no allocation at all.
// ---------------------------------------------------------------------------
for (const [label, scale] of SCALES) {
  const bands = scale.bands
  check(`${label} first band starts at 0`, bands[0].min === 0, `${bands[0].min}`)
  check(`${label} last band ends at 100`, bands[bands.length - 1].max === 100, `${bands[bands.length - 1].max}`)

  let contiguous = true
  for (let i = 1; i < bands.length; i++) {
    if (bands[i].min !== bands[i - 1].max + 1) contiguous = false
  }
  check(`${label} bands are contiguous`, contiguous)

  let everyScoreMapped = true
  for (let score = 0; score <= 100; score++) {
    if (bandForScore(bands, score) === null) everyScoreMapped = false
  }
  check(`${label} every score 0-100 maps to exactly one band`, everyScoreMapped)

  check(
    `${label} each band's displayed range matches its bounds`,
    bands.every((b) => b.range === `${b.min}-${b.max}`),
  )
}

// ---------------------------------------------------------------------------
// 5. Missing data is missing — never the benign first band (the P6-30 rule).
// ---------------------------------------------------------------------------
check("a null score yields no band", bandForScore(CCPI_ALLOCATION.bands, null) === null)
check("an undefined score yields no band", bandForScore(CCPI_ALLOCATION.bands, undefined) === null)
check("NaN yields no band", bandForScore(CCPI_ALLOCATION.bands, Number.NaN) === null)
check("Infinity yields no band", bandForScore(CCPI_ALLOCATION.bands, Number.POSITIVE_INFINITY) === null)
check("an out-of-range score yields no band", bandForScore(CCPI_ALLOCATION.bands, 101) === null)

// ---------------------------------------------------------------------------
// 6. The two scales are distinct questions, and each says so.
// ---------------------------------------------------------------------------
check(
  "each scale states the question its score answers",
  SCALES.every(([, s]) => typeof s.question === "string" && s.question.trim().length > 0),
)
check(
  "the two scales ask different questions",
  CCPI_ALLOCATION.question !== SENTIMENT_ALLOCATION.question,
)
check("every band carries a stance line", SCALES.every(([, s]) => s.bands.every((b) => b.stance.trim().length > 0)))

// ---------------------------------------------------------------------------
// 7. Spot values, so a wholesale renumbering has to be deliberate.
// ---------------------------------------------------------------------------
check("CCPI 34 is Normal at 20% cash", bandForScore(CCPI_ALLOCATION.bands, 34)?.cash === 20)
check("CCPI 95 is Crash Watch at 75% cash", bandForScore(CCPI_ALLOCATION.bands, 95)?.cash === 75)
check("Sentiment 87 is Extreme Greed at 70% cash", bandForScore(SENTIMENT_ALLOCATION.bands, 87)?.cash === 70)
check("formatPct renders a whole percent", formatPct(65) === "65%")

console.log(failures === 0 ? "\nAll allocation checks passed." : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
