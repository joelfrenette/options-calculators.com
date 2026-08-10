// Macro economic calendar shared by /api/earnings-calendar and
// /api/landmine-check.
//
// S-3/S-4. What this file may and may not do:
//
//   RULE-DERIVED events are fine, because the publication RULE is the fact:
//   jobless claims every Thursday, the Employment Situation on the first
//   Friday. That is how the agencies actually schedule; deriving it is not a
//   guess.
//
//   INVENTED events and INVENTED figures are not. This module used to emit
//   jobless claims carrying `forecast: "~220K", previous: "~215K"` — numbers
//   from nowhere, rendered in a forecast column — and it inferred FOMC dates
//   from `month === 11 && day === 17|18`, the December 2024 meeting hardcoded
//   as though it recurred annually. It therefore announced an FOMC decision
//   every 18 December and 29 January forever and missed the other six meetings
//   a year, while feeding /api/landmine-check, whose whole job is warning a
//   trader off opening a position in front of an event. FOMC dates now come
//   from lib/fomc-schedule.ts, which /api/fomc-predictions also reads, so the
//   two can no longer disagree.
//
//   CPI is the awkward one: BLS publishes its dates, they cluster mid-month,
//   and no arithmetic reproduces them. It carries `approximate: true` so a
//   consumer can label it instead of presenting a guessed date as the release.
//
// forecast/previous are `string | null`. Null means nothing here sources them.

import { fomcMeetingsBetween } from "@/lib/fomc-schedule"

export interface EconomicEvent {
  date: string
  time: string
  event: string
  agency: string
  impact: "High" | "Med"
  /** Null when nothing sources it — never a plausible-looking placeholder. */
  forecast: string | null
  previous: string | null
  /** True when the DATE itself is inferred rather than published. */
  approximate?: boolean
}

export function generateCuratedEconomicEvents(startDate: Date, endDate: Date): EconomicEvent[] {
  const events: EconomicEvent[] = []
  const current = new Date(startDate)

  // Standard economic calendar events by day of week and date
  while (current <= endDate) {
    const dayOfWeek = current.getDay()
    const dayOfMonth = current.getDate()
    const dateStr = current.toISOString().split("T")[0]

    // Thursday - Weekly Jobless Claims
    if (dayOfWeek === 4) {
      events.push({
        date: dateStr,
        time: "8:30 AM ET",
        event: "Initial Jobless Claims",
        agency: "Dept. of Labor",
        impact: "Med",
        // Were "~220K" / "~215K": invented numbers in a forecast column.
        forecast: null,
        previous: null,
      })
    }

    // First Friday - Jobs Report (NFP)
    if (dayOfWeek === 5 && dayOfMonth <= 7) {
      events.push({
        date: dateStr,
        time: "8:30 AM ET",
        event: "Non-Farm Payrolls",
        agency: "BLS",
        impact: "High",
        forecast: null,
        previous: null,
      })
      events.push({
        date: dateStr,
        time: "8:30 AM ET",
        event: "Unemployment Rate",
        agency: "BLS",
        impact: "High",
        forecast: null,
        previous: null,
      })
    }

    // Mid-month CPI (around 10th-15th)
    if (dayOfMonth >= 10 && dayOfMonth <= 15 && dayOfWeek >= 2 && dayOfWeek <= 4) {
      const hasInflationEvent = events.some((e) => e.event.includes("CPI"))
      if (!hasInflationEvent) {
        events.push({
          date: dateStr,
          time: "8:30 AM ET",
          event: "Consumer Price Index (CPI)",
          agency: "BLS",
          impact: "High",
          forecast: null,
          previous: null,
          // BLS publishes CPI dates; this window is inferred, not read.
          approximate: true,
        })
      }
    }

    current.setDate(current.getDate() + 1)
  }

  // FOMC from the committed schedule, not from date arithmetic. The old rule
  // fired on 17/18 December and 28/29 January every year — the 2024/25 dates
  // frozen as a recurrence — and produced nothing for the other six meetings.
  const fromStr = startDate.toISOString().split("T")[0]
  const toStr = endDate.toISOString().split("T")[0]
  for (const meeting of fomcMeetingsBetween(fromStr, toStr)) {
    if (meeting.start >= fromStr && meeting.start <= toStr) {
      events.push({
        date: meeting.start,
        time: "N/A",
        event: "FOMC Meeting Day 1",
        agency: "Federal Reserve",
        impact: "High",
        forecast: null,
        previous: null,
      })
    }
    if (meeting.end >= fromStr && meeting.end <= toStr) {
      events.push({
        date: meeting.end,
        time: "2:00 PM ET",
        event: "FOMC Rate Decision",
        agency: "Federal Reserve",
        impact: "High",
        forecast: null,
        previous: null,
      })
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date))
  return events
}
