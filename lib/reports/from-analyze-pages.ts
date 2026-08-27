import type { ReportPayload, CellValue } from "./types"

/**
 * ReportPayload mappers for ANALYZE-tab pages that carry a genuine result
 * table. Most of ANALYZE is gauges and forecasters (CCPI, VIX, Fear & Greed,
 * the sentiment and rate dashboards) — a single composite reading, not a
 * ranked list — so those do not take a report button. The economic/earnings
 * calendar is the clear table: a schedule, where "top N" means the next N
 * events chronologically.
 */

const iso = () => new Date().toISOString()
const str = (v: unknown): CellValue => (typeof v === "string" && v ? v : null)

interface EarningsEvent {
  date: string
  time: string
  timing: string
  ticker: string
  company: string
  estimate: string
}

interface EconomicEvent {
  date: string
  time: string
  event: string
  agency: string
  impact: string
  forecast: string
  previous: string
}

export function buildCalendarReport(
  earnings: EarningsEvent[],
  economic: EconomicEvent[],
  dateRange?: string,
): ReportPayload | null {
  const e = earnings ?? []
  const m = economic ?? []
  if (e.length === 0 && m.length === 0) return null

  // One chronological table across both kinds, with a Type column. The rows
  // are already in the page's date order; the pipeline's topN leads the email
  // with the nearest events.
  const rows = [
    ...e.map((x) => ({
      date: str(x.date),
      time: str(x.time),
      type: "Earnings" as CellValue,
      item: str(x.ticker),
      detail: str(x.company),
      estimate: str(x.estimate),
      reference: null as CellValue,
      impact: null as CellValue,
    })),
    ...m.map((x) => ({
      date: str(x.date),
      time: str(x.time),
      type: "Economic" as CellValue,
      item: str(x.event),
      detail: str(x.agency),
      estimate: str(x.forecast),
      reference: str(x.previous),
      impact: str(x.impact),
    })),
  ]

  return {
    title: "Earnings & Economic Calendar",
    description: "Upcoming earnings reports and scheduled economic releases.",
    executiveSummary:
      `${e.length} earnings ${e.length === 1 ? "report" : "reports"} and ${m.length} economic ` +
      `${m.length === 1 ? "release" : "releases"}${dateRange ? ` for ${dateRange}` : ""}. The economic half is ` +
      `derived from official publication schedules (jobless claims Thursday, the committed FOMC dates), so it is ` +
      `real even when the earnings feed is thin. Estimates are consensus where shown; a release is scheduled, not certain.`,
    subtitle: dateRange || undefined,
    generatedAt: iso(),
    topN: 3,
    columns: [
      { key: "date", label: "Date", format: "text" },
      { key: "time", label: "Time", format: "text" },
      { key: "type", label: "Type", format: "text" },
      { key: "item", label: "Ticker / Event", format: "text" },
      { key: "detail", label: "Company / Agency", format: "text" },
      { key: "estimate", label: "Estimate / Forecast", format: "text" },
      { key: "reference", label: "Previous", format: "text" },
      { key: "impact", label: "Impact", format: "text" },
    ],
    rows,
  }
}
