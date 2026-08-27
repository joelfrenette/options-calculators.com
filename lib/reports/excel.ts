import ExcelJS from "exceljs"
import { type ReportPayload, formatCell } from "./types"

/**
 * The report as an .xlsx buffer: a titled header block, the exec summary,
 * then the full result table with typed, formatted columns. Numbers stay
 * NUMERIC in the cells (Excel formats them) — only genuinely missing values
 * become the "—" string, so the sheet stays sortable and chartable.
 */
export async function buildReportExcel(payload: ReportPayload): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Options-Calculators.com"
  wb.created = new Date(payload.generatedAt)
  const ws = wb.addWorksheet("Report", { views: [{ state: "frozen", ySplit: 6 }] })

  const lastCol = Math.max(payload.columns.length, 1)
  const span = ws.getColumn(lastCol).letter

  ws.mergeCells(`A1:${span}1`)
  ws.getCell("A1").value = payload.title
  ws.getCell("A1").font = { size: 16, bold: true }

  ws.mergeCells(`A2:${span}2`)
  ws.getCell("A2").value = payload.description
  ws.getCell("A2").font = { size: 11, color: { argb: "FF666666" } }

  ws.mergeCells(`A3:${span}3`)
  ws.getCell("A3").value = `Generated ${new Date(payload.generatedAt).toUTCString().replace("GMT", "UTC")}`
  ws.getCell("A3").font = { size: 10, color: { argb: "FF888888" } }

  ws.mergeCells(`A4:${span}5`)
  ws.getCell("A4").value = payload.executiveSummary
  ws.getCell("A4").font = { size: 11 }
  ws.getCell("A4").alignment = { wrapText: true, vertical: "top" }

  // Header row (row 6).
  const headerRow = ws.getRow(6)
  payload.columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = c.label
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } }
    cell.alignment = { horizontal: c.format && c.format !== "text" ? "right" : "left" }
  })
  headerRow.commit()

  // Data rows.
  payload.rows.forEach((row, r) => {
    const xr = ws.getRow(7 + r)
    payload.columns.forEach((c, i) => {
      const cell = xr.getCell(i + 1)
      const raw = row[c.key]
      if (raw === null || raw === undefined || raw === "" || (typeof raw === "number" && !Number.isFinite(raw))) {
        cell.value = "—"
        cell.alignment = { horizontal: "right" }
      } else if (typeof raw === "number") {
        cell.value = raw
        if (c.format === "currency") cell.numFmt = '"$"#,##0.00'
        else if (c.format === "percent") cell.numFmt = '0.00"%"'
        cell.alignment = { horizontal: "right" }
      } else {
        cell.value = raw
      }
    })
    if (r % 2 === 1) xr.eachCell((cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } }))
    xr.commit()
  })

  // Column widths from the longest formatted value.
  payload.columns.forEach((c, i) => {
    const header = c.label.length
    const widest = payload.rows.reduce((m, row) => Math.max(m, formatCell(row[c.key], c.format).length), header)
    ws.getColumn(i + 1).width = Math.min(Math.max(widest + 2, 10), 44)
  })

  // AutoFilter across the header row so every column gets a filter dropdown
  // (owner ask 2026-08-27). Range spans the header and all data rows.
  const lastRow = 6 + payload.rows.length
  ws.autoFilter = {
    from: { row: 6, column: 1 },
    to: { row: Math.max(6, lastRow), column: payload.columns.length },
  }

  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out)
}
