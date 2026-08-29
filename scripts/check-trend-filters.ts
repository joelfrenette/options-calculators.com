/**
 * The CSP entry filters compute what they claim, and decline when they cannot.
 *
 * Run: node scripts/check-trend-filters.ts
 *
 * WHY THIS FILE EXISTS. These four gates REMOVE candidates from a money
 * decision. A sign error or an off-by-one window would not throw, would not
 * change any other PASS line, and would show up only as a scanner that quietly
 * returns the wrong stocks — the audit's own lesson from the yield curve, where
 * the series was right, the sign convention was wrong, and it took a test with
 * real numbers in it to see (P6-21). Reading a comparison is not verifying it.
 *
 * The assertions below use worked numbers, not shapes.
 */

import {
  RELAXED_DEEP_DECLINE_PCT,
  RELAXED_MILD_DOWN_MIN_CAP,
  SESSIONS_PER_MONTH,
  SESSIONS_PER_YEAR,
  isStage4Decline,
  momentum12m1,
  moveInAtrUnits,
  relativeReturnPoints,
  relaxedDownYearAdmitted,
  relaxedDownYearVerdict,
  sessionMovePercent,
  trailingReturnPercent,
} from "../lib/trend-filters.ts"

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

const near = (a: number | null, b: number, tol = 1e-9) => a !== null && Math.abs(a - b) < tol

// ------------------------------------------------------------- session move

check("a 10% up session reads as +10", near(sessionMovePercent(110, 100), 10), String(sessionMovePercent(110, 100)))
check("a 10% down session reads as −10", near(sessionMovePercent(90, 100), -10), String(sessionMovePercent(90, 100)))
check("an unchanged session is 0, not null", sessionMovePercent(100, 100) === 0)

// The sign matters: this gate exists to exclude UP days. A gate written on the
// absolute move would also drop a stock that fell 12%, which is the setup a put
// seller is looking for, not one to avoid.
check(
  "the move keeps its sign, so a −12% day is not confused with a +12% day",
  sessionMovePercent(88, 100) !== sessionMovePercent(112, 100),
  `${sessionMovePercent(88, 100)} vs ${sessionMovePercent(112, 100)}`,
)

check(
  "a missing or non-positive prior close declines rather than dividing",
  sessionMovePercent(110, null) === null &&
    sessionMovePercent(110, 0) === null &&
    sessionMovePercent(null, 100) === null &&
    sessionMovePercent(110, -5) === null,
)

// -------------------------------------------------------------- ATR context

// A $10 stock moving 10% is $1. Against an ATR of $0.25 that is 4 ATRs.
check("a 10% move on a $10 stock with $0.25 ATR is 4 ATRs", near(moveInAtrUnits(10, 10, 0.25), 4), String(moveInAtrUnits(10, 10, 0.25)))
// The same 10% on a stock that routinely swings that much is 1 ATR — the whole
// point of the measure.
check("the same 10% where ATR is $1 is 1 ATR", near(moveInAtrUnits(10, 10, 1), 1), String(moveInAtrUnits(10, 10, 1)))
check("ATR units are magnitude, so a down move is positive", near(moveInAtrUnits(-10, 10, 0.25), 4))
check("a zero or missing ATR declines", moveInAtrUnits(10, 10, 0) === null && moveInAtrUnits(10, 10, null) === null)

// ----------------------------------------------------------- trailing year

/** A series that rises 1 point per session, oldest first. */
const rising = (n: number, start = 100) => Array.from({ length: n }, (_, i) => start + i)

{
  // 253 bars: index 0 = 100, index 252 = 352. The window looks back exactly
  // SESSIONS_PER_YEAR bars from the last one, i.e. 352 vs 100 = +252%.
  const s = rising(SESSIONS_PER_YEAR + 1)
  check("a full year of history returns the 252-session change", near(trailingReturnPercent(s), 252), String(trailingReturnPercent(s)))
}

{
  // ONE bar short. This is the assertion that matters most: the baseline must
  // be the bar 252 back, never "the first bar available". Falling back to the
  // array's start would report a 251-session change under a 12-month label —
  // the same class of defect as counting back N rows on an economic series.
  const s = rising(SESSIONS_PER_YEAR)
  check(
    "one bar short of a year declines instead of shortening the window",
    trailingReturnPercent(s) === null,
    String(trailingReturnPercent(s)),
  )
}

check("an empty series declines", trailingReturnPercent([]) === null)
check("a flat year is 0, which is not the same as unknown", near(trailingReturnPercent(Array(SESSIONS_PER_YEAR + 1).fill(50)), 0))

{
  // A falling series must produce a NEGATIVE return — the direction the
  // "down on the year" gate keys off.
  const falling = Array.from({ length: SESSIONS_PER_YEAR + 1 }, (_, i) => 500 - i)
  const r = trailingReturnPercent(falling)
  check("a year of decline is negative", r !== null && r < 0, String(r))
}

// -------------------------------------------------------------- momentum 12-1

{
  const s = rising(SESSIONS_PER_YEAR + 1)
  // Stops one month early: index 252−21 = 231 → value 331, against 100.
  check("12-1 momentum stops one month back", near(momentum12m1(s), 231), String(momentum12m1(s)))
  check(
    "12-1 momentum differs from the plain 12-month return",
    momentum12m1(s) !== trailingReturnPercent(s),
    `${momentum12m1(s)} vs ${trailingReturnPercent(s)}`,
  )
}

check("12-1 momentum declines without a full year", momentum12m1(rising(SESSIONS_PER_YEAR)) === null)

// ------------------------------------------------------------------ Stage 4

check(
  "below a FALLING average is Stage 4",
  isStage4Decline(90, 100, 110) === true,
  "price 90, MA 100, MA a month ago 110",
)
check(
  "below a RISING average is NOT Stage 4 — that is a pullback inside an advance",
  isStage4Decline(90, 100, 95) === false,
  "price 90, MA 100, MA a month ago 95",
)
check("above the average is not Stage 4 whatever the slope", isStage4Decline(120, 100, 110) === false)
check("a flat average is not a decline", isStage4Decline(90, 100, 100) === false)
check(
  "a missing average declines rather than guessing",
  isStage4Decline(90, null, 110) === null && isStage4Decline(90, 100, null) === null && isStage4Decline(null, 100, 110) === null,
)

// ------------------------------------------------------- relative strength

check("outperformance is positive", near(relativeReturnPoints(12, 5), 7))
check("underperformance is negative", near(relativeReturnPoints(-3, 5), -8))
check(
  "falling less than a falling market is OUTPERFORMANCE",
  near(relativeReturnPoints(-5, -20), 15),
  "the clause that separates 'it fell' from 'it fell while the market rose'",
)
check("a missing benchmark declines rather than comparing against zero", relativeReturnPoints(-5, null) === null)

// ------------------------------------------------------------- subsumption
//
// technical-criteria.ts documents that while `excludeDownYear` is on and the
// benchmark's year is positive, `excludeBenchmarkLaggard` cannot reject
// anything the first did not. That claim is load-bearing — it is why both gates
// ship defaulted ON without the second being dead weight in every market — so
// it is asserted rather than left as a comment that can quietly go stale.

{
  const bench = 8 // a positive benchmark year
  let counterexample: number | null = null
  for (let r = -50; r <= 50; r += 0.5) {
    const failsYear = r < 0
    const rel = relativeReturnPoints(r, bench)
    const failsLaggard = rel === null || rel < 0
    // A stock the laggard gate rejects but the year gate keeps would make the
    // second gate independently useful in a rising market.
    if (failsLaggard && !failsYear) counterexample = r
  }
  check(
    "with a POSITIVE benchmark year the laggard gate is not subsumed",
    counterexample !== null,
    `e.g. a stock up ${counterexample}% still trails a benchmark up ${bench}% — the gates are not redundant`,
  )
}

{
  const bench = -20 // the market itself fell
  const rel = relativeReturnPoints(-5, bench)
  check(
    "with a NEGATIVE benchmark year the two gates disagree, which is the case that motivates both",
    rel !== null && rel > 0,
    `down 5% against a market down ${Math.abs(bench)}% outperforms by ${rel} points, yet fails "down on the year"`,
  )
}

// -------------------------------------------- relaxed-pass down-year grading

// The scenario that motivated the grade: a mega-cap down a few percent is a
// pullback the owner wants shown; a stock down 40%, or a small cap down a
// little, is not. These assertions pin the verdicts with worked numbers so a
// changed threshold cannot silently re-empty (or flood) Step 5.
{
  const bigCap = 100_000_000_000 // $100B — AMZN/NVDA/CSCO class
  const smallCap = 5_000_000_000 // $5B

  check(
    "a mega-cap down 3% is admitted (mild-large)",
    relaxedDownYearVerdict(-3, bigCap) === "mild-large" && relaxedDownYearAdmitted("mild-large"),
    relaxedDownYearVerdict(-3, bigCap),
  )
  check(
    "a stock down 40% is held out (deep), whatever its size",
    relaxedDownYearVerdict(-40, bigCap) === "deep" && !relaxedDownYearAdmitted("deep"),
    relaxedDownYearVerdict(-40, bigCap),
  )
  check(
    "a small cap down 5% is held out (mild-small)",
    relaxedDownYearVerdict(-5, smallCap) === "mild-small" && !relaxedDownYearAdmitted("mild-small"),
    relaxedDownYearVerdict(-5, smallCap),
  )
  check(
    "a name up on the year is not-down (admitted)",
    relaxedDownYearVerdict(8, smallCap) === "not-down" && relaxedDownYearAdmitted("not-down"),
    relaxedDownYearVerdict(8, smallCap),
  )
  check(
    "an unmeasurable trailing year fails safe (held out)",
    relaxedDownYearVerdict(null, bigCap) === "unmeasurable" && !relaxedDownYearAdmitted("unmeasurable"),
    relaxedDownYearVerdict(null, bigCap),
  )
  check(
    "exactly the deep threshold is NOT deep — a large cap at −20% is admitted",
    relaxedDownYearVerdict(RELAXED_DEEP_DECLINE_PCT, bigCap) === "mild-large",
    `verdict at ${RELAXED_DEEP_DECLINE_PCT}% = ${relaxedDownYearVerdict(RELAXED_DEEP_DECLINE_PCT, bigCap)}`,
  )
  check(
    "just past the deep threshold IS deep",
    relaxedDownYearVerdict(RELAXED_DEEP_DECLINE_PCT - 0.01, bigCap) === "deep",
    relaxedDownYearVerdict(RELAXED_DEEP_DECLINE_PCT - 0.01, bigCap),
  )
  check(
    "exactly the cap floor counts as large",
    relaxedDownYearVerdict(-5, RELAXED_MILD_DOWN_MIN_CAP) === "mild-large",
    relaxedDownYearVerdict(-5, RELAXED_MILD_DOWN_MIN_CAP),
  )
  check(
    "a null market cap on a mild decline is treated as small (held out)",
    relaxedDownYearVerdict(-5, null) === "mild-small",
    relaxedDownYearVerdict(-5, null),
  )

  // The thresholds are OWNER-TUNABLE (the Step 5 sliders pass them in). A
  // looser deep cutoff must admit a steeper decline; a higher cap floor must
  // demote a name that qualified at a lower one — otherwise the sliders would
  // move the label but not the decision.
  check(
    "a looser deep cutoff (−35%) admits a −30% large cap that is deep at default",
    relaxedDownYearVerdict(-30, bigCap) === "deep" && relaxedDownYearVerdict(-30, bigCap, -35) === "mild-large",
    `default ${relaxedDownYearVerdict(-30, bigCap)} vs at −35% ${relaxedDownYearVerdict(-30, bigCap, -35)}`,
  )
  check(
    "a higher cap floor ($50B) demotes a $15B mild decline that passed at $10B",
    relaxedDownYearVerdict(-5, 15_000_000_000) === "mild-large" &&
      relaxedDownYearVerdict(-5, 15_000_000_000, RELAXED_DEEP_DECLINE_PCT, 50_000_000_000) === "mild-small",
    relaxedDownYearVerdict(-5, 15_000_000_000, RELAXED_DEEP_DECLINE_PCT, 50_000_000_000),
  )
}

// --------------------------------------------------------------- constants

check(
  "the session constants are the conventional ones",
  SESSIONS_PER_MONTH === 21 && SESSIONS_PER_YEAR === 252,
  `${SESSIONS_PER_MONTH} per month, ${SESSIONS_PER_YEAR} per year`,
)

if (failures > 0) {
  console.error(`\n${failures} trend-filter check(s) failed.`)
  process.exit(1)
}
