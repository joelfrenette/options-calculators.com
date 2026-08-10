/**
 * The committed FOMC meeting schedule — one copy, used by every consumer.
 *
 * WHY THIS FILE EXISTS (S-3): lib/economic-events.ts was deriving FOMC dates
 * from arithmetic —
 *
 *   (month === 11 && (day === 17 || day === 18)) ||   // "December FOMC"
 *   (month === 0  && (day === 28 || day === 29))      // "January FOMC"
 *
 * — which are the December 2024 and January 2025 meeting dates hardcoded as if
 * they recurred annually. It emitted an "FOMC Rate Decision" every 18 December
 * and every 29 January forever, and no FOMC event at all for the other six
 * meetings a year. That feeds /api/landmine-check, whose entire job is warning
 * a trader off opening a position in front of an event.
 *
 * FOMC dates are published years ahead and follow no rule a calendar can infer.
 * A committed list is the honest representation — and, like the breadth
 * universe, it is labelled with what it is so nobody mistakes it for a feed.
 *
 * MAINTENANCE: the Fed publishes the following year's dates each summer. When
 * this list runs out, consumers say so rather than guessing — see
 * `nextMeetingAfter` returning null and the 503 in /api/fomc-predictions.
 */

export interface FomcMeeting {
  /** Display label, e.g. "Jan 27-28, 2026" */
  label: string
  /** ISO date of day 1 */
  start: string
  /** ISO date of the decision day (day 2) */
  end: string
}

/** Source: federalreserve.gov calendar. Two-day meetings; decision on day 2. */
export const FOMC_MEETINGS: FomcMeeting[] = [
  { label: "Nov 6-7, 2024", start: "2024-11-06", end: "2024-11-07" },
  { label: "Dec 17-18, 2024", start: "2024-12-17", end: "2024-12-18" },
  { label: "Jan 28-29, 2025", start: "2025-01-28", end: "2025-01-29" },
  { label: "Mar 18-19, 2025", start: "2025-03-18", end: "2025-03-19" },
  { label: "May 6-7, 2025", start: "2025-05-06", end: "2025-05-07" },
  { label: "Jun 17-18, 2025", start: "2025-06-17", end: "2025-06-18" },
  { label: "Jul 29-30, 2025", start: "2025-07-29", end: "2025-07-30" },
  { label: "Sep 16-17, 2025", start: "2025-09-16", end: "2025-09-17" },
  { label: "Oct 28-29, 2025", start: "2025-10-28", end: "2025-10-29" },
  { label: "Dec 9-10, 2025", start: "2025-12-09", end: "2025-12-10" },
  { label: "Jan 27-28, 2026", start: "2026-01-27", end: "2026-01-28" },
  { label: "Mar 17-18, 2026", start: "2026-03-17", end: "2026-03-18" },
  { label: "Apr 28-29, 2026", start: "2026-04-28", end: "2026-04-29" },
  { label: "Jun 16-17, 2026", start: "2026-06-16", end: "2026-06-17" },
  { label: "Jul 28-29, 2026", start: "2026-07-28", end: "2026-07-29" },
  { label: "Sep 22-23, 2026", start: "2026-09-22", end: "2026-09-23" },
  { label: "Nov 3-4, 2026", start: "2026-11-03", end: "2026-11-04" },
  { label: "Dec 15-16, 2026", start: "2026-12-15", end: "2026-12-16" },
  { label: "Jan 26-27, 2027", start: "2027-01-26", end: "2027-01-27" },
  { label: "Mar 16-17, 2027", start: "2027-03-16", end: "2027-03-17" },
]

/** The last decision day the committed list covers. */
export const FOMC_SCHEDULE_THROUGH = FOMC_MEETINGS[FOMC_MEETINGS.length - 1].end

/**
 * Meetings whose decision day falls inside [from, to] inclusive.
 * Dates compared as ISO strings — no timezone to shift a date-only value.
 */
export function fomcMeetingsBetween(from: string, to: string): FomcMeeting[] {
  return FOMC_MEETINGS.filter((m) => m.end >= from && m.start <= to)
}
