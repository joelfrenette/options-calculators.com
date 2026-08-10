/**
 * Lead-time scorer checks — lib/ccpi/lead-time.ts.
 *
 * Run: node scripts/check-lead-time.ts
 *
 * WHY THIS EXISTS. This module decides which signals earn weight in the
 * redesigned CCPI, so a bug here does not produce a wrong number on a page — it
 * produces a wrong INDICATOR SET, silently and permanently. The properties
 * asserted below are the ones that make it trustworthy: it refuses when it
 * cannot see enough history, it never counts an event it has no data for as a
 * miss, missing data breaks an episode rather than extending it, and a signal
 * that fires constantly is punished rather than rewarded.
 */

import { scoreLeadTime, proposedWeight, sweepLeadWindows, type SignalObservation } from "../lib/ccpi/lead-time.ts"

let failures = 0
function check(name: string, passed: boolean, detail = "") {
  if (passed) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`)
  else { failures++; console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`) }
}

const DAY = 86400000
function day(iso: string, offset = 0): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + offset * DAY).toISOString().slice(0, 10)
}
/** Daily observations across a range, firing on the given inclusive date spans. */
function series(fromISO: string, days: number, firingSpans: Array<[string, string]>): SignalObservation[] {
  const out: SignalObservation[] = []
  for (let i = 0; i < days; i++) {
    const d = day(fromISO, i)
    out.push({ day: d, firing: firingSpans.some(([a, b]) => d >= a && d <= b) })
  }
  return out
}

const EVENTS = [
  { id: "e1", peak: "2011-01-01" },
  { id: "e2", peak: "2013-01-01" },
  { id: "e3", peak: "2015-01-01" },
  { id: "e4", peak: "2017-01-01" },
]

// ---------------------------------------------------------------------------
// 1. THE REFUSAL. Not enough runway must never produce a score.
// ---------------------------------------------------------------------------
const shortWindow = scoreLeadTime(series("2016-11-01", 90, []), EVENTS)
check("too little history → insufficient-history", shortWindow.verdict === "insufficient-history")
check("...and it says why", (shortWindow.reason ?? "").includes("runway"), shortWindow.reason ?? "null")
check("...and reports no hit rate rather than 0", shortWindow.hitRate === null)
check("...and proposedWeight refuses too, with null not 0", proposedWeight(shortWindow) === null)
check("empty observations → insufficient-history", scoreLeadTime([], EVENTS).verdict === "insufficient-history")

// ---------------------------------------------------------------------------
// 2. Events outside the window are UNCOVERED, never missed.
// ---------------------------------------------------------------------------
const late = scoreLeadTime(series("2014-01-01", 1200, []), EVENTS)
check("events before the window are uncovered", late.uncoveredEventIds.includes("e1"))
check("...and are not counted as misses", !late.missedEventIds.includes("e1"))
check("events with runway are covered", late.coveredEventIds.includes("e3") || late.coveredEventIds.includes("e4"))

// ---------------------------------------------------------------------------
// 3. A perfect signal: one episode shortly before each peak, nothing else.
// ---------------------------------------------------------------------------
const perfect = scoreLeadTime(
  series("2010-01-01", 2800, [
    ["2010-11-01", "2010-11-20"],
    ["2012-11-01", "2012-11-20"],
    ["2014-11-01", "2014-11-20"],
    ["2016-11-01", "2016-11-20"],
  ]),
  EVENTS,
)
check("a perfect signal scores", perfect.verdict === "scored", perfect.reason ?? "")
check("...hit rate 100%", perfect.hitRate === 1, String(perfect.hitRate))
check("...with a ~61 day median lead", perfect.medianLeadDays === 61, String(perfect.medianLeadDays))
check("...and no false positives", perfect.falsePositives === 0, String(perfect.falsePositives))
check("...earning real weight", (proposedWeight(perfect) ?? 0) > 1, String(proposedWeight(perfect)))

// ---------------------------------------------------------------------------
// 4. THE POINT OF THE WHOLE MODULE: a noisy signal must be punished.
// ---------------------------------------------------------------------------
const noisy = scoreLeadTime(
  series("2010-01-01", 2800, [
    ["2010-11-01", "2010-11-20"], ["2012-11-01", "2012-11-20"],
    ["2014-11-01", "2014-11-20"], ["2016-11-01", "2016-11-20"],
    ["2011-06-01", "2011-06-20"], ["2011-09-01", "2011-09-20"],
    ["2013-06-01", "2013-06-20"], ["2013-09-01", "2013-09-20"],
    ["2015-06-01", "2015-06-20"], ["2015-09-01", "2015-09-20"],
  ]),
  EVENTS,
)
check("a noisy signal still hits every event", noisy.hitRate === 1, String(noisy.hitRate))
check("...but its false positives are counted", noisy.falsePositives === 6, String(noisy.falsePositives))
check(
  "...and it is ranked BELOW the clean signal despite the identical hit rate",
  (proposedWeight(noisy) ?? 1) < (proposedWeight(perfect) ?? 0),
  `${proposedWeight(noisy)} vs ${proposedWeight(perfect)}`,
)

// A signal that is always on catches everything and is worth nothing.
const alwaysOn = scoreLeadTime(series("2010-01-01", 2800, [["2010-01-01", "2017-12-31"]]), EVENTS)
// This assertion was written the other way round first — "an always-on signal
// hits everything" — and the module disagreed. The module was right. One
// permanently-firing episode begins years before every peak, so its lead
// exceeds the 180-day window and it is credited with NOTHING. That is the
// correct treatment of a signal that is always on: it warns of nothing, and a
// hit rate of 1 would have been the flattering answer.
check("an always-on signal is ONE episode, not many", alwaysOn.episodes.length === 1, String(alwaysOn.episodes.length))
check("...whose start predates every peak by more than the window", alwaysOn.hitEventIds.length === 0)
check("...so it earns a hit rate of 0, not 1", alwaysOn.hitRate === 0, String(alwaysOn.hitRate))
check("...and no lead time at all", alwaysOn.medianLeadDays === null, String(alwaysOn.medianLeadDays))

// ---------------------------------------------------------------------------
// 5. Episodes: persistence, and missing data breaking a run.
// ---------------------------------------------------------------------------
const blip = scoreLeadTime(series("2010-01-01", 2800, [["2010-11-01", "2010-11-01"]]), EVENTS)
check("a one-day blip is not an episode", blip.episodes.length === 0, String(blip.episodes.length))

const withGap: SignalObservation[] = series("2010-01-01", 2800, [["2010-11-01", "2010-11-20"]])
for (const o of withGap) if (o.day >= "2010-11-08" && o.day <= "2010-11-10") o.firing = null
const gapped = scoreLeadTime(withGap, EVENTS)
check(
  "missing data BREAKS an episode rather than extending it through the gap",
  gapped.episodes.length === 2,
  `${gapped.episodes.length} episodes`,
)

// ---------------------------------------------------------------------------
// 6. A signal that only ever fires AFTER the peak is coincident, not leading.
// ---------------------------------------------------------------------------
const lagging = scoreLeadTime(
  series("2010-01-01", 2800, [
    ["2011-01-10", "2011-01-30"], ["2013-01-10", "2013-01-30"],
    ["2015-01-10", "2015-01-30"], ["2017-01-10", "2017-01-30"],
  ]),
  EVENTS,
)
check("a signal that fires only after the peak hits nothing", lagging.hitEventIds.length === 0)
check("...and every one of those episodes is a false positive", lagging.falsePositives === lagging.episodes.length)
check("...so its weight collapses", (proposedWeight(lagging) ?? 1) === 0, String(proposedWeight(lagging)))

// ---------------------------------------------------------------------------
// 7. PRECISION, BASE RATE AND LIFT — measured against chance, not in a vacuum.
// ---------------------------------------------------------------------------
check("a clean signal has precision 1", perfect.precision === 1, String(perfect.precision))
check("...and a lift above 1, so it beats chance", (perfect.lift ?? 0) > 1, String(perfect.lift))
check("a lagging signal has precision 0", lagging.precision === 0, String(lagging.precision))
check("...and therefore zero lift", lagging.lift === 0, String(lagging.lift))
check("precision is null when nothing scored", shortWindow.precision === null)
check("base rate is reported so precision is never read alone", perfect.baseRate !== null)
check(
  "base rate is a real fraction of observed days",
  (perfect.baseRate ?? -1) > 0 && (perfect.baseRate ?? 2) < 1,
  String(perfect.baseRate),
)

// THE FIX. Precision now counts EPISODES in-window, not events, so it is no
// longer capped at events/episodes and is comparable between signals that fire
// at very different rates.
// Two episodes before ONE event: the old hits/episodes formula capped this at
// 1/2 = 0.5 because an event can only be hit once. Counting episodes gives 1.0,
// which is the honest answer — both fired into a window that mattered.
const twoBeforeOne = scoreLeadTime(
  series("2010-01-01", 2800, [
    ["2010-09-01", "2010-09-20"], ["2010-11-01", "2010-11-20"],
    ["2012-11-01", "2012-11-20"], ["2014-11-01", "2014-11-20"], ["2016-11-01", "2016-11-20"],
  ]),
  EVENTS,
)
check(
  "precision is no longer capped by the event count",
  twoBeforeOne.precision === 1,
  `${twoBeforeOne.precision} across ${twoBeforeOne.episodes.length} episodes, ${twoBeforeOne.hitEventIds.length} events hit`,
)

// A signal at chance must earn nothing, however good its hit rate looks.
const alwaysFiring = scoreLeadTime(
  series("2010-01-01", 2800, Array.from({ length: 60 }, (_, i) => {
    const start = day("2010-01-05", i * 45)
    return [start, day(start, 5)]
  })),
  EVENTS,
)
check(
  "a signal firing constantly earns ZERO weight despite a perfect hit rate",
  proposedWeight(alwaysFiring) === 0,
  `hit ${alwaysFiring.hitRate}, lift ${alwaysFiring.lift}, weight ${proposedWeight(alwaysFiring)}`,
)
check("...because its lift is indistinguishable from chance", (alwaysFiring.lift ?? 9) < 1.2, String(alwaysFiring.lift))

// ---------------------------------------------------------------------------
// 8. The window sweep — a signal cannot hit inside a window shorter than its
//    own lead, which is why testing one window and concluding is a mistake.
// ---------------------------------------------------------------------------
const longLead = series("2010-01-01", 2800, [
  ["2009-12-01", "2009-12-20"], // ~400 days before e1 — invisible at 180
  ["2011-11-01", "2011-11-20"], // ~400 days before e2
  ["2013-11-01", "2013-11-20"],
  ["2015-11-01", "2015-11-20"],
])
const sweep = sweepLeadWindows(longLead, EVENTS, [90, 180, 365, 540])
check("the sweep returns one result per window", sweep.length === 4)
check("windows are reported alongside their results", sweep.map((x) => x.maxLeadDays).join(",") === "90,180,365,540")
const at180 = sweep.find((x) => x.maxLeadDays === 180)!.result
const at540 = sweep.find((x) => x.maxLeadDays === 540)!.result
check("a 400-day-lead signal scores ZERO at a 180-day window", at180.hitRate === 0, String(at180.hitRate))
check("...and is found at 540", (at540.hitRate ?? 0) > 0, String(at540.hitRate))
check(
  "...which is the whole argument for sweeping rather than picking one window",
  (at540.hitRate ?? 0) > (at180.hitRate ?? 1),
)

console.log(failures === 0 ? "\nAll lead-time checks passed." : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
