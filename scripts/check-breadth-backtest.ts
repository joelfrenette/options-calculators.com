/**
 * Breadth lead-time backtest checks — E-7e.
 *
 * The harness that decides whether breadth may ever earn CCPI scoring weight
 * has to be able to say NO. These checks pin the ways it must refuse:
 * insufficient history is not a pass, a signal that never fires is not a lead,
 * and an episode the stored series cannot see is not evidence either way.
 *
 * Run: node scripts/check-breadth-backtest.ts
 */

import {
  runBreadthBacktest,
  findTriggerDays,
  daysBetween,
  DEFAULT_SIGNAL,
  type BreadthPoint,
  type DrawdownEpisode,
} from "../lib/breadth-backtest.ts"

let failures = 0
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ""}`)
  } else {
    failures++
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`)
  }
}

/** Consecutive daily points starting at `start`, one per calendar day. */
function series(start: string, pcts: number[]): BreadthPoint[] {
  const t0 = new Date(`${start}T00:00:00Z`).getTime()
  return pcts.map((pct, i) => ({ day: new Date(t0 + i * 86400000).toISOString().slice(0, 10), pct }))
}

// ---------------------------------------------------------------------------
// 1. Date arithmetic
// ---------------------------------------------------------------------------
check("daysBetween counts forward", daysBetween("2026-01-01", "2026-01-31") === 30)
check("daysBetween is negative backwards", daysBetween("2026-01-31", "2026-01-01") === -30)
check("daysBetween crosses a leap day", daysBetween("2024-02-28", "2024-03-01") === 2)

// ---------------------------------------------------------------------------
// 2. Trigger detection
// ---------------------------------------------------------------------------
const cfg = { threshold: 50, sustainDays: 3, lookbackDays: 180, horizonDays: 180 }

check(
  "a run shorter than sustainDays does not fire",
  findTriggerDays(series("2026-01-01", [40, 40, 60, 60]), cfg).length === 0,
)

const oneRun = findTriggerDays(series("2026-01-01", [60, 40, 40, 40, 40, 60]), cfg)
check("a sustained run fires exactly once", oneRun.length === 1, `got ${oneRun.length}`)
check(
  "the firing is credited to the day the run STARTED",
  oneRun[0] === "2026-01-02",
  `got ${oneRun[0]} (crediting the completion day would understate lead by sustainDays-1)`,
)

const twoRuns = findTriggerDays(series("2026-01-01", [40, 40, 40, 60, 40, 40, 40]), cfg)
check("separate runs fire separately", twoRuns.length === 2, `got ${twoRuns.length}`)

// A signal that is always on must not look like two thousand warnings.
const alwaysOn = findTriggerDays(series("2026-01-01", Array(200).fill(10)), cfg)
check("a permanently-true signal fires once, not once per day", alwaysOn.length === 1, `got ${alwaysOn.length}`)

// A gap must break the run rather than being read as a warning day.
const withGap: BreadthPoint[] = [
  { day: "2026-01-01", pct: 40 },
  { day: "2026-01-02", pct: 40 },
  { day: "2026-01-03", pct: Number.NaN },
  { day: "2026-01-04", pct: 40 },
]
check("a NaN point breaks the run instead of extending it", findTriggerDays(withGap, cfg).length === 0)

// ---------------------------------------------------------------------------
// 3. The refusals — the point of the harness
// ---------------------------------------------------------------------------
const episode: DrawdownEpisode[] = [
  { name: "Test drawdown", peak: "2026-07-01", trough: "2026-10-01", declinePct: -30 },
]

const empty = runBreadthBacktest([], cfg, episode)
check("no history ⇒ insufficient-history, never a pass", empty.verdict === "insufficient-history", empty.verdict)
check("no history ⇒ episode reported uncovered", empty.episodes[0].covered === false)

// 30 days of history against a 180-day lookback: not testable.
const thin = runBreadthBacktest(series("2026-06-01", Array(30).fill(20)), cfg, episode)
check(
  "a series far shorter than the lookback is insufficient, not a lead",
  thin.verdict === "insufficient-history",
  `${thin.verdict} / ${thin.episodes[0].coverageNote}`,
)

// History that ends BEFORE the peak cannot have led it.
const endsEarly = runBreadthBacktest(series("2025-01-01", Array(200).fill(20)), cfg, episode)
check(
  "history ending before the peak is uncovered",
  endsEarly.episodes[0].covered === false,
  endsEarly.episodes[0].coverageNote,
)

// Covered, but the signal never fires: healthy breadth right up to the peak.
const neverFires = runBreadthBacktest(series("2025-12-01", Array(250).fill(80)), cfg, episode)
check("covered episode reports covered", neverFires.episodes[0].covered === true, neverFires.episodes[0].coverageNote)
check(
  "a signal that never fired did NOT demonstrate lead",
  neverFires.verdict === "no-lead-demonstrated",
  neverFires.verdict,
)
check("no firing ⇒ null lead, not zero", neverFires.episodes[0].leadDays === null)

// ---------------------------------------------------------------------------
// 4. A genuine lead
// ---------------------------------------------------------------------------
// 250 days ending 2026-08-07, healthy until day 200 then deteriorating.
const healthy = Array(200).fill(80)
const weak = Array(50).fill(30)
const leading = runBreadthBacktest(series("2025-12-01", [...healthy, ...weak]), cfg, episode)
check("deterioration before the peak is detected", leading.episodes[0].firstTriggerDay !== null)
check(
  "lead time is measured from the first firing to the peak",
  leading.episodes[0].leadDays !== null && leading.episodes[0].leadDays > 0,
  `lead ${leading.episodes[0].leadDays} days from ${leading.episodes[0].firstTriggerDay}`,
)
check("all testable episodes led ⇒ lead-demonstrated", leading.verdict === "lead-demonstrated", leading.verdict)

// ---------------------------------------------------------------------------
// 5. Provenance and the scoring gate travel with every result
// ---------------------------------------------------------------------------
check("survivorship bias is stated on every result", empty.survivorshipWarning.includes("2026 membership"))
check(
  "the scoring gate is restated so a verdict cannot read as authorisation",
  leading.scoringGate.includes("not a grant"),
)
check("the config used is echoed back", leading.config.threshold === cfg.threshold)
check("defaults are the documented ones", DEFAULT_SIGNAL.threshold === 50 && DEFAULT_SIGNAL.sustainDays === 3)

console.log(
  failures === 0 ? "\nAll breadth-backtest checks passed." : `\n${failures} breadth-backtest check(s) FAILED.`,
)
process.exit(failures === 0 ? 0 : 1)
