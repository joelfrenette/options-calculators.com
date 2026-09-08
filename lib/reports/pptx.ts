import pptxgen from "pptxgenjs"
import { type ReportPayload, formatCell, reportStamp } from "./types"

/**
 * The report as a PowerPoint (.pptx) buffer, via pptxgenjs — pure JS (it writes
 * an OOXML zip), no headless Office, so it builds and runs on Vercel serverless
 * for the same reason @react-pdf/renderer was chosen over Puppeteer for the PDF.
 *
 * Layout mirrors the PDF and the email: a title slide, then the executive
 * summary, then the table paged across slides so a long table never overflows a
 * single slide. Every cell honours the null-is-"—" rule through `formatCell`.
 */

const TEAL = "0F766E"
const INK = "12171A"
const SOFT = "4A5058"
const FAINT = "788683"
const ALT = "F3F4F6"

const ROWS_PER_SLIDE = 14

export async function buildReportPptx(payload: ReportPayload): Promise<Buffer> {
  const pptx = new pptxgen()
  pptx.author = "Options-Calculators.com"
  pptx.company = "Options-Calculators.com"
  pptx.title = payload.title
  pptx.layout = "LAYOUT_WIDE" // 13.33 x 7.5 in

  // --- Title slide ---------------------------------------------------------
  const title = pptx.addSlide()
  title.background = { color: "FFFFFF" }
  title.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.35, h: 7.5, fill: { color: TEAL } })
  title.addText(payload.title, { x: 0.9, y: 2.2, w: 11.5, h: 1.2, fontSize: 40, bold: true, color: INK, fontFace: "Arial" })
  title.addText(payload.description, { x: 0.9, y: 3.4, w: 11.5, h: 0.8, fontSize: 18, color: SOFT, fontFace: "Arial" })
  if (payload.subtitle) {
    title.addText(payload.subtitle, { x: 0.9, y: 4.1, w: 11.5, h: 0.5, fontSize: 14, color: FAINT, fontFace: "Arial" })
  }
  title.addText(`Generated ${reportStamp(payload)}`, { x: 0.9, y: 6.7, w: 11.5, h: 0.4, fontSize: 11, color: FAINT, fontFace: "Arial" })

  // --- Executive summary slide --------------------------------------------
  const summary = pptx.addSlide()
  summary.background = { color: "FFFFFF" }
  summary.addText("Executive summary", { x: 0.6, y: 0.5, w: 12, h: 0.5, fontSize: 13, bold: true, color: FAINT, charSpacing: 2, fontFace: "Arial" })
  summary.addText(payload.executiveSummary, { x: 0.6, y: 1.1, w: 12.1, h: 5.8, fontSize: 16, color: INK, lineSpacingMultiple: 1.3, valign: "top", fontFace: "Arial" })

  // --- Table slides (paged) ------------------------------------------------
  const header = payload.columns.map((c) => ({
    text: c.label,
    options: { bold: true, color: "FFFFFF", fill: { color: TEAL }, align: (c.format && c.format !== "text" ? "right" : "left") as "left" | "right", fontFace: "Arial", fontSize: 12 },
  }))

  const pages = Math.max(1, Math.ceil(payload.rows.length / ROWS_PER_SLIDE))
  for (let p = 0; p < pages; p++) {
    const slice = payload.rows.slice(p * ROWS_PER_SLIDE, (p + 1) * ROWS_PER_SLIDE)
    const slide = pptx.addSlide()
    slide.background = { color: "FFFFFF" }
    const heading = pages > 1 ? `Details (${p + 1}/${pages})` : "Details"
    slide.addText(heading, { x: 0.6, y: 0.4, w: 12, h: 0.5, fontSize: 13, bold: true, color: FAINT, charSpacing: 2, fontFace: "Arial" })

    const body = slice.map((row, i) =>
      payload.columns.map((c) => ({
        text: formatCell(row[c.key], c.format),
        options: {
          color: INK,
          fill: { color: i % 2 === 1 ? ALT : "FFFFFF" },
          align: (c.format && c.format !== "text" ? "right" : "left") as "left" | "right",
          fontFace: c.format && c.format !== "text" ? "Consolas" : "Arial",
          fontSize: 12,
        },
      })),
    )

    slide.addTable([header, ...body], {
      x: 0.6,
      y: 1.0,
      w: 12.1,
      border: { type: "solid", color: "E4E9E6", pt: 0.5 },
      autoPage: false,
    })
    slide.addText(`Options-Calculators.com · ${payload.title}`, { x: 0.6, y: 7.05, w: 12.1, h: 0.35, fontSize: 9, color: FAINT, align: "center", fontFace: "Arial" })
  }

  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer
  return out
}
