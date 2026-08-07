// Curated macro economic calendar shared by /api/earnings-calendar and
// /api/landmine-check. Pure date math — no API calls, no keys.

export interface EconomicEvent {
  date: string
  time: string
  event: string
  agency: string
  impact: "High" | "Med"
  forecast: string
  previous: string
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
        forecast: "~220K",
        previous: "~215K",
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
        forecast: "TBD",
        previous: "TBD",
      })
      events.push({
        date: dateStr,
        time: "8:30 AM ET",
        event: "Unemployment Rate",
        agency: "BLS",
        impact: "High",
        forecast: "TBD",
        previous: "TBD",
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
          forecast: "TBD",
          previous: "TBD",
        })
      }
    }

    // FOMC meetings (typically mid-month, check for Dec 17-18, Jan, etc.)
    const month = current.getMonth()
    if (
      (month === 11 && (dayOfMonth === 17 || dayOfMonth === 18)) || // December FOMC
      (month === 0 && (dayOfMonth === 28 || dayOfMonth === 29)) // January FOMC
    ) {
      events.push({
        date: dateStr,
        time: "2:00 PM ET",
        event: dayOfMonth === 18 || dayOfMonth === 29 ? "FOMC Rate Decision" : "FOMC Meeting Day 1",
        agency: "Federal Reserve",
        impact: "High",
        forecast: "TBD",
        previous: "TBD",
      })
    }

    current.setDate(current.getDate() + 1)
  }

  return events
}
