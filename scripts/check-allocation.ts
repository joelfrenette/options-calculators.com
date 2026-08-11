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
  PANIC_EUPHORIA_ALLOCATION,
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
  ["Panic/Euphoria", PANIC_EUPHORIA_ALLOCATION],
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
// 4. Bands must tile their whole domain with no gap. A gap means some score
//    silently renders no allocation at all — and the domains differ, so this
//    is checked against each scale's own bounds rather than an assumed 0-100.
// ---------------------------------------------------------------------------
const SWEEP_STEPS = 2000
for (const [label, scale] of SCALES) {
  const bands = scale.bands
  const { min, max } = scale.domain

  check(`${label} first band starts at the domain floor`, bands[0].min === min, `${bands[0].min} vs ${min}`)
  check(
    `${label} last band ends at the domain ceiling`,
    bands[bands.length - 1].max === max,
    `${bands[bands.length - 1].max} vs ${max}`,
  )

  check(
    `${label} every band is well-formed (min <= max)`,
    bands.every((b) => b.min <= b.max),
  )

  // Ascending with no true overlap. Bands may SHARE an endpoint — bandForScore
  // takes the first match, so a boundary score resolves to the lower band —
  // but one band must never start before the previous one ends.
  let ordered = true
  for (let i = 1; i < bands.length; i++) {
    if (bands[i].min < bands[i - 1].max) ordered = false
  }
  check(`${label} bands ascend without overlapping`, ordered)

  // The real gap test: sweep the domain and confirm nothing falls through.
  let unmapped: number | null = null
  for (let i = 0; i <= SWEEP_STEPS; i++) {
    const score = min + ((max - min) * i) / SWEEP_STEPS
    if (bandForScore(bands, score) === null) {
      unmapped = score
      break
    }
  }
  check(
    `${label} every score across its domain maps to a band`,
    unmapped === null,
    unmapped === null ? `swept ${SWEEP_STEPS + 1} points in [${min}, ${max}]` : `${unmapped} maps to nothing`,
  )

  check(
    `${label} every band carries a displayed range`,
    bands.every((b) => b.range.trim().length > 0),
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
check("a score below the domain floor yields no band", bandForScore(CCPI_ALLOCATION.bands, -1) === null)
// The gap this suite found: "0-19" beside "20-39" left 19.4 matching neither.
check("a fractional score between displayed bands still maps", bandForScore(CCPI_ALLOCATION.bands, 19.4)?.level === "Low Risk")
check("a fractional score just below a boundary maps low", bandForScore(CCPI_ALLOCATION.bands, 39.9)?.level === "Normal")

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

// Panic/euphoria thresholds, locked against the if-chain they replaced.
const pe = (score: number) => bandForScore(PANIC_EUPHORIA_ALLOCATION.bands, score)?.level
check("panic −0.60 is Extreme Panic", pe(-0.6) === "Extreme Panic")
check("panic −0.45 belongs to the band starting there (Panic)", pe(-0.45) === "Panic")
check("panic −0.30 is Panic", pe(-0.3) === "Panic")
check("panic −0.17 belongs to the band starting there (Neutral)", pe(-0.17) === "Neutral/Complacent")
check("panic 0.00 is Neutral/Complacent", pe(0) === "Neutral/Complacent")
check("panic 0.41 is Euphoria, as the old if-chain had it", pe(0.41) === "Euphoria")
check("panic 0.55 is Euphoria", pe(0.55) === "Euphoria")
check("panic 0.70 is Extreme Euphoria, as the old if-chain had it", pe(0.7) === "Extreme Euphoria")
check("panic 0.85 is Extreme Euphoria", pe(0.85) === "Extreme Euphoria")
check(
  "panic is the most-deployed state on any scale",
  stocksFor(PANIC_EUPHORIA_ALLOCATION.bands[0]) === 85,
  `${stocksFor(PANIC_EUPHORIA_ALLOCATION.bands[0])}% stocks at extreme panic`,
)
check("a score outside [−1, 1] yields no band", bandForScore(PANIC_EUPHORIA_ALLOCATION.bands, 1.5) === null)

// ---------------------------------------------------------------------------
// 8. Level names are now an API, not a label.
//
//    market-sentiment.tsx and panic-euphoria.tsx look up colours, backgrounds,
//    labels and strategy copy in Record<string, string> maps keyed by these
//    exact strings. A rename here would not fail to compile — every lookup
//    would quietly fall through to the grey "no data" default and the pages
//    would render as though the gauge were unreadable. Pin them.
// ---------------------------------------------------------------------------
const levelNames = (scale: AllocationScale) => scale.bands.map((b) => b.level).join(" | ")
check(
  "CCPI level names are unchanged",
  levelNames(CCPI_ALLOCATION) === "Low Risk | Normal | Caution | High Alert | Crash Watch",
  levelNames(CCPI_ALLOCATION),
)
check(
  "Sentiment level names are unchanged (keys in market-sentiment.tsx)",
  levelNames(SENTIMENT_ALLOCATION) === "Extreme Fear | Fear | Neutral | Greed | Extreme Greed",
  levelNames(SENTIMENT_ALLOCATION),
)
check(
  "Panic/Euphoria level names are unchanged (keys in panic-euphoria.tsx)",
  levelNames(PANIC_EUPHORIA_ALLOCATION) ===
    "Extreme Panic | Panic | Neutral/Complacent | Euphoria | Extreme Euphoria",
  levelNames(PANIC_EUPHORIA_ALLOCATION),
)
check(
  "level names are unique within each scale",
  SCALES.every(([, s]) => new Set(s.bands.map((b) => b.level)).size === s.bands.length),
)

console.log(failures === 0 ? "\nAll allocation checks passed." : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
