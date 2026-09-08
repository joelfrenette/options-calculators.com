import { Resend } from "resend"
import { resolveApiKey } from "@/lib/api-keys"
import { buildResearchReport, tickerSummaryLine } from "@/lib/reports/from-research-queue"
import { buildReportPdf } from "@/lib/reports/pdf"
import { buildReportPptx } from "@/lib/reports/pptx"
import { reportSlug } from "@/lib/reports/types"
import type { RecapItem, ResearchRow } from "./types"

/**
 * The morning digest email (RESEARCH_QUEUE_DESIGN.md §Phase 3, extended
 * 2026-09-07): a per-ticker SUMMARY for the whole active watchlist in the body,
 * plus a PDF and a PowerPoint attached for each ticker that CHANGED overnight.
 *
 * Why not attach every ticker: a watchlist can hold 50 names, and two files each
 * is 100 attachments — well past the provider's size cap. So the body always
 * summarises every ticker, the documents cover the ones that moved (the reader's
 * action list), and every report is downloadable per-card on the queue page.
 * That split is the owner's stated design: the site is the home for the full set,
 * the email is the nudge.
 *
 * `to` is always the owner's own address, passed by the cron from the row — never
 * a recipient from a request body, so this can never become an open mailer.
 */

/** Cap on how many changed tickers get documents attached, to stay under the
 *  provider's total-size limit (2 files each). The body still lists them all. */
const MAX_ATTACH_TICKERS = 8

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)
}

interface DigestAttachment {
  filename: string
  content: Buffer
}

/**
 * Build one PDF + one PPTX for each changed ticker, capped. Each file is built
 * independently; a builder that throws for one ticker drops only that file and
 * never sinks the whole digest.
 */
async function buildDigestAttachments(
  rows: ResearchRow[],
  changed: Set<string>,
): Promise<{ attachments: DigestAttachment[]; attachedTickers: string[]; omitted: number }> {
  const changedRows = rows.filter((r) => changed.has(r.ticker) && r.recommendation)
  const take = changedRows.slice(0, MAX_ATTACH_TICKERS)
  const omitted = changedRows.length - take.length

  const attachments: DigestAttachment[] = []
  const attachedTickers: string[] = []

  for (const row of take) {
    const payload = buildResearchReport(row)
    if (!payload) continue
    const slug = reportSlug(payload)
    const [pdfR, pptxR] = await Promise.allSettled([buildReportPdf(payload), buildReportPptx(payload)])
    let any = false
    if (pdfR.status === "fulfilled") {
      attachments.push({ filename: `${slug}.pdf`, content: pdfR.value })
      any = true
    }
    if (pptxR.status === "fulfilled") {
      attachments.push({ filename: `${slug}.pptx`, content: pptxR.value })
      any = true
    }
    if (any) attachedTickers.push(row.ticker)
  }

  return { attachments, attachedTickers, omitted }
}

function buildHtml(
  summary: string,
  items: RecapItem[],
  rows: ResearchRow[],
  attachedTickers: string[],
  omitted: number,
): string {
  const active = rows.filter((r) => r.recommendation)

  const changes = items.length
    ? `<h3 style="margin:18px 0 6px;font-size:14px;color:#0f172a">What changed overnight</h3>
       <ul style="padding-left:18px;color:#334155;margin:0">${items.map((i) => `<li style="margin:4px 0">${escapeHtml(i.detail)}</li>`).join("")}</ul>`
    : `<p style="color:#475569;margin:12px 0 0">No changes overnight.</p>`

  const watchlist = active.length
    ? `<h3 style="margin:20px 0 6px;font-size:14px;color:#0f172a">Your watchlist — all ${active.length} tickers</h3>
       <ul style="padding-left:18px;color:#334155;margin:0">${active.map((r) => `<li style="margin:5px 0">${escapeHtml(tickerSummaryLine(r))}</li>`).join("")}</ul>`
    : ""

  const attachNote = attachedTickers.length
    ? `<p style="color:#475569;font-size:13px;margin:16px 0 0">Attached: a PDF and a PowerPoint for ${attachedTickers.map(escapeHtml).join(", ")}${omitted > 0 ? ` (and ${omitted} more changed ticker${omitted === 1 ? "" : "s"} not attached to keep this email light)` : ""}. Every ticker's full report is viewable and downloadable on the Research Queue page.</p>`
    : `<p style="color:#475569;font-size:13px;margin:16px 0 0">No documents attached this morning. Every ticker's full report is viewable and downloadable on the Research Queue page.</p>`

  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:620px;line-height:1.55;color:#0f172a">
    <h2 style="margin:0 0 8px;font-size:18px">Research Queue — morning digest</h2>
    <p style="color:#475569;margin:0 0 4px">${escapeHtml(summary)}</p>
    ${changes}
    ${watchlist}
    ${attachNote}
    <p style="color:#94a3b8;font-size:12px;margin-top:18px">The numbers are computed from current prices and the options chain; the strategy and the read are written over them. IV rank is an estimate until an IV history builds. Point-in-time — not advice.</p>
  </div>`
}

function buildText(summary: string, items: RecapItem[], rows: ResearchRow[]): string {
  const active = rows.filter((r) => r.recommendation)
  const changes = items.length ? items.map((i) => `- ${i.detail}`).join("\n") : "No changes overnight."
  const watchlist = active.map((r) => `- ${tickerSummaryLine(r)}`).join("\n")
  return `Research Queue — morning digest\n\n${summary}\n\nWhat changed overnight:\n${changes}\n\nYour watchlist (${active.length}):\n${watchlist}\n\nFull per-ticker reports are on the Research Queue page.`
}

export async function sendDigestEmail(
  to: string,
  summary: string,
  items: RecapItem[],
  rows: ResearchRow[],
  changed: Set<string>,
): Promise<boolean> {
  const key = resolveApiKey("RESEND_API_KEY")
  if (!key) return false

  const { attachments, attachedTickers, omitted } = await buildDigestAttachments(rows, changed)
  const html = buildHtml(summary, items, rows, attachedTickers, omitted)
  const text = buildText(summary, items, rows)

  try {
    const { error } = await new Resend(key).emails.send({
      from: "Options Calculator <noreply@options-calculators.com>",
      to,
      subject: `Research Queue — morning digest (${new Date().toUTCString().replace("GMT", "UTC")})`,
      html,
      text,
      attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })),
    })
    return !error
  } catch {
    return false
  }
}
