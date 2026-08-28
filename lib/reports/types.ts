/**
 * The normalized shape any page hands the report-email pipeline.
 *
 * One page's job is to fill this in; the pipeline (Excel + PDF + HTML email)
 * consumes it and never needs to know which page it came from. The rule the
 * whole audit runs on applies here too: a missing cell is null and renders
 * "—", never 0 or an invented value.
 */

export type CellValue = string | number | null

export interface ReportColumn {
  /** Machine key, matched against each row object. */
  key: string
  /** Column header shown in the email, Excel and PDF. */
  label: string
  /** Rendering hint. "number"/"currency"/"percent" right-align and format. */
  format?: "text" | "number" | "currency" | "percent"
}

export interface ReportPayload {
  /** e.g. "Cash-Secured Put Scan". Becomes the email subject and doc title. */
  title: string
  /** One sentence under the title — what this report is. */
  description: string
  /** 2-4 sentences a human reads first. The page composes this from its data. */
  executiveSummary: string
  /** ISO 8601. The pipeline stamps every surface with it. */
  generatedAt: string
  columns: ReportColumn[]
  /** Each row is keyed by column.key; a missing key renders "—". */
  rows: Array<Record<string, CellValue>>
  /**
   * How many rows lead the email body as cards (default 3). The rows are used
   * in the order given — the PAGE decides ranking before handing them over.
   */
  topN?: number
  /** Optional context line, e.g. the filters the scan used. */
  subtitle?: string
  /**
   * Column keys to FEATURE in the email's top-N cards, in order. The first
   * becomes the big labelled value beside the title; the rest become labelled
   * stat cells; unlisted columns drop to the card's fine-print line. The
   * identity (first) column is always the card title and is ignored here.
   * Excel and PDF are unaffected — they always show every column.
   */
  highlightKeys?: string[]
}

/** A safe filename stem from the title + timestamp, e.g. cash-secured-put-scan-2026-08-27-1431. */
export function reportSlug(payload: ReportPayload): string {
  const t = payload.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const d = new Date(payload.generatedAt)
  const pad = (n: number) => String(n).padStart(2, "0")
  const stamp = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`
  return `${t || "report"}-${stamp}`
}

/** Human-readable UTC stamp for the email/doc footers. */
export function reportStamp(payload: ReportPayload): string {
  return `${new Date(payload.generatedAt).toUTCString().replace("GMT", "UTC")}`
}

/** Format one cell for display, honouring the null-is-"—" rule. */
export function formatCell(value: CellValue, format: ReportColumn["format"]): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "number" && !Number.isFinite(value)) return "—"
  if (typeof value === "number") {
    if (format === "currency") return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    if (format === "percent") return `${(Math.round(value * 100) / 100).toFixed(2)}%`
    if (format === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
  }
  return String(value)
}
