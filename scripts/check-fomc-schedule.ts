/**
 * FOMC schedule checks — S-3.
 *
 * lib/economic-events.ts used to infer FOMC dates from
 * `month === 11 && day === 17|18`, the December 2024 meeting hardcoded as a
 * recurrence. It therefore announced a rate decision every 18 December and
 * 29 January forever and produced nothing for the other six meetings a year —
 * feeding /api/landmine-check, whose job is warning a trader off opening a
 * position in front of an event.
 *
 * These checks pin the committed list's shape and the window helper. They
 * cannot verify the dates against federalreserve.gov — that is a human
 * maintenance task — but they catch the mechanical ways a hand-kept schedule
 * rots: out-of-order entries, a decision day before its start day, a meeting
 * that is not two days, and duplicates.
 *
 * Run: node scripts/check-fomc-schedule.ts
 */

import { FOMC_MEETINGS, FOMC_SCHEDULE_THROUGH, fomcMeetingsBetween } from "../lib/fomc-schedule.ts"

let failures = 0
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
}

const iso = /^\d{4}-\d{2}-\d{2}$/
const dayMs = 86400000
const at = (d: string) => new Date(`${d}T00:00:00Z`).getTime()

check("the schedule is not empty", FOMC_MEETINGS.length > 0, `${FOMC_MEETINGS.length} meetings`)

check(
  "every date is a plain ISO day",
  FOMC_MEETINGS.every((m) => iso.test(m.start) && iso.test(m.end)),
)

check(
  "the decision day never precedes day 1",
  FOMC_MEETINGS.every((m) => at(m.end) >= at(m.start)),
)

// Every FOMC meeting in this list is a two-day meeting; a one-day entry means
// somebody pasted the decision date into both columns.
const notTwoDay = FOMC_MEETINGS.filter((m) => at(m.end) - at(m.start) !== dayMs)
check("every meeting spans exactly two days", notTwoDay.length === 0, notTwoDay.map((m) => m.label).join(", "))

const sorted = [...FOMC_MEETINGS].every(
  (m, i, arr) => i === 0 || at(arr[i - 1].end) < at(m.start),
)
check("meetings are chronological and non-overlapping", sorted)

const labels = new Set(FOMC_MEETINGS.map((m) => m.label))
check("no duplicate labels", labels.size === FOMC_MEETINGS.length)
const ends = new Set(FOMC_MEETINGS.map((m) => m.end))
check("no duplicate decision days", ends.size === FOMC_MEETINGS.length)

check(
  "FOMC_SCHEDULE_THROUGH is the last decision day",
  FOMC_SCHEDULE_THROUGH === FOMC_MEETINGS[FOMC_MEETINGS.length - 1].end,
  FOMC_SCHEDULE_THROUGH,
)

// The Fed holds eight scheduled meetings a year. A year that shows fewer is
// usually a transcription gap rather than a change of policy.
const byYear = new Map<string, number>()
for (const m of FOMC_MEETINGS) byYear.set(m.end.slice(0, 4), (byYear.get(m.end.slice(0, 4)) ?? 0) + 1)
const fullYears = [...byYear.entries()].filter(([y]) => y !== "2024" && y !== "2027")
check(
  "complete years carry the usual eight meetings",
  fullYears.every(([, n]) => n === 8),
  fullYears.map(([y, n]) => `${y}:${n}`).join(" "),
)

// ---------------------------------------------------------------------------
// Window helper — what the economic calendar actually calls
// ---------------------------------------------------------------------------
const inMarch2026 = fomcMeetingsBetween("2026-03-01", "2026-03-31")
check("March 2026 returns exactly its one meeting", inMarch2026.length === 1 && inMarch2026[0].end === "2026-03-18", inMarch2026.map((m) => m.label).join(","))

check("a window with no meeting returns nothing", fomcMeetingsBetween("2026-02-01", "2026-02-28").length === 0)

// Inclusive on both ends: a window that starts ON the decision day must still
// warn about it, or the landmine check goes quiet on the very day it matters.
check(
  "a window starting on the decision day still includes it",
  fomcMeetingsBetween("2026-03-18", "2026-03-25").some((m) => m.end === "2026-03-18"),
)
check(
  "a window ending on day 1 still includes the meeting",
  fomcMeetingsBetween("2026-03-01", "2026-03-17").some((m) => m.start === "2026-03-17"),
)

// The old date arithmetic would have fired here and must no longer be implied:
// 18 December and 29 January are only meetings in the years the Fed says so.
check(
  "18 Dec 2026 is a decision day only because the list says so",
  fomcMeetingsBetween("2026-12-18", "2026-12-18").length === 0,
  "the 2026 December meeting is the 15-16th",
)

console.log(failures === 0 ? "\nAll FOMC schedule checks passed." : `\n${failures} FOMC schedule check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
