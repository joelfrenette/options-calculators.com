import type { CellValue, ReportColumn, ReportPayload } from "./types"

/**
 * Validate and normalize an untrusted ReportPayload from the request body.
 * The client composes this, so nothing here is trusted: the timestamp is
 * re-stamped server-side, strings are length-capped, and only string/number/
 * null cells survive (an object or function in a cell is dropped to null, the
 * missing-data value). Keeps the Excel/PDF/email builders from ever seeing a
 * shape they cannot render.
 */

const MAX_STR = 2000

function str(v: unknown, cap = MAX_STR): string {
  return typeof v === "string" ? v.slice(0, cap) : ""
}

function cell(v: unknown): CellValue {
  if (v === null || v === undefined) return null
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  if (typeof v === "string") return v.slice(0, 200)
  return null
}

export function validateReportPayload(
  body: unknown,
  limits: { maxRows: number; maxCols: number },
): { ok: true; payload: ReportPayload } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Report payload must be an object" }
  const b = body as Record<string, unknown>

  const title = str(b.title, 120).trim()
  if (!title) return { ok: false, error: "Report title is required" }

  const rawCols = Array.isArray(b.columns) ? b.columns : []
  if (rawCols.length === 0) return { ok: false, error: "Report needs at least one column" }
  if (rawCols.length > limits.maxCols) return { ok: false, error: `Too many columns (max ${limits.maxCols})` }

  const columns: ReportColumn[] = []
  const seen = new Set<string>()
  for (const c of rawCols) {
    if (!c || typeof c !== "object") continue
    const cc = c as Record<string, unknown>
    const key = str(cc.key, 60).trim()
    const label = str(cc.label, 60).trim() || key
    if (!key || seen.has(key)) continue
    seen.add(key)
    const fmt = cc.format
    const format =
      fmt === "number" || fmt === "currency" || fmt === "percent" || fmt === "text" ? fmt : "text"
    columns.push({ key, label, format })
  }
  if (columns.length === 0) return { ok: false, error: "No valid columns in the report" }

  const rawRows = Array.isArray(b.rows) ? b.rows : []
  if (rawRows.length > limits.maxRows) return { ok: false, error: `Too many rows (max ${limits.maxRows})` }
  const rows = rawRows.slice(0, limits.maxRows).map((r) => {
    const out: Record<string, CellValue> = {}
    const rr = r && typeof r === "object" ? (r as Record<string, unknown>) : {}
    for (const c of columns) out[c.key] = cell(rr[c.key])
    return out
  })

  const topNRaw = typeof b.topN === "number" && Number.isFinite(b.topN) ? Math.floor(b.topN) : 3
  const topN = Math.min(Math.max(topNRaw, 1), 10)

  return {
    ok: true,
    payload: {
      title,
      description: str(b.description, 300).trim() || title,
      executiveSummary: str(b.executiveSummary, 2000).trim() || "No summary was provided for this report.",
      subtitle: str(b.subtitle, 200).trim() || undefined,
      // Re-stamped server-side: a report is stamped when it is SENT, and a
      // client clock is not evidence of when that was.
      generatedAt: new Date().toISOString(),
      columns,
      rows,
      topN,
    },
  }
}
