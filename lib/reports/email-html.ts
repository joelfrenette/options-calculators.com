import { type ReportPayload, formatCell, reportStamp } from "./types"

/**
 * The report as a visually formatted HTML email. Email clients are hostile to
 * modern CSS, so this is deliberately table-based, inline-styled, and free of
 * fl/grid/webfonts. It carries: a header, the exec summary, the description,
 * the TOP N results as cards (Rank · leading value · the rest of the row), and
 * a line naming the two attachments, all date/time stamped.
 */

const INK = "#12171A"
const SOFT = "#4A5058"
const FAINT = "#788683"
const ACCENT = "#0F766E"
const RULE = "#E4E9E6"
const PAPER = "#F6F8F7"

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function topCards(payload: ReportPayload): string {
  const n = payload.topN ?? 3
  const top = payload.rows.slice(0, n)
  if (top.length === 0) {
    return `<p style="margin:0;color:${SOFT};font-size:14px;">The scan returned no results.</p>`
  }
  const [first, ...rest] = payload.columns
  const byKey = new Map(payload.columns.map((c) => [c.key, c]))
  // The card's featured metrics. When a page names highlightKeys, those become
  // big labelled stat cells; the lead number (right of the title) is the first
  // highlight, or the first non-identity column if none are named. Everything
  // not featured drops to the fine-print line.
  const hlKeys = (payload.highlightKeys ?? []).filter((k) => byKey.has(k) && k !== first.key)
  const leadKey = hlKeys[0] ?? rest[0]?.key
  const leadCol = leadKey ? byKey.get(leadKey) : undefined
  const chipKeys = hlKeys.slice(1)
  const detailCols = rest.filter((c) => c.key !== leadKey && !chipKeys.includes(c.key))

  return top
    .map((row, i) => {
      const leadVal = leadCol ? formatCell(row[leadCol.key], leadCol.format) : ""
      const chips = chipKeys
        .map((k) => {
          const c = byKey.get(k)!
          return `<td style="padding:8px 10px 0 0;vertical-align:top;">
                    <div style="font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:${FAINT};">${esc(c.label)}</div>
                    <div style="font-size:15px;font-weight:bold;color:${INK};">${esc(formatCell(row[c.key], c.format))}</div>
                  </td>`
        })
        .join("")
      const detail = detailCols
        .map((c) => `<span style="color:${FAINT};">${esc(c.label)}</span> <strong style="color:${INK};">${esc(formatCell(row[c.key], c.format))}</strong>`)
        .join(`<span style="color:${RULE};padding:0 8px;">·</span>`)
      return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
        <tr>
          <td style="background:#ffffff;border:1px solid ${RULE};border-radius:10px;padding:14px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;">
                  <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;background:${ACCENT};color:#ffffff;border-radius:999px;font-size:13px;font-weight:bold;">${i + 1}</span>
                  <span style="font-size:17px;font-weight:bold;color:${INK};padding-left:10px;">${esc(formatCell(row[first.key], first.format))}</span>
                </td>
                ${leadCol ? `<td align="right" style="vertical-align:middle;"><span style="font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:${FAINT};display:block;">${esc(leadCol.label)}</span><span style="font-size:19px;font-weight:bold;color:${ACCENT};">${esc(leadVal)}</span></td>` : ""}
              </tr>
              ${chips ? `<tr><td colspan="2" style="padding-top:10px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${chips}</tr></table></td></tr>` : ""}
              ${detail ? `<tr><td colspan="2" style="padding-top:10px;font-size:12px;line-height:1.6;border-top:1px solid ${PAPER};margin-top:6px;">${detail}</td></tr>` : ""}
            </table>
          </td>
        </tr>
      </table>`
    })
    .join("")
}

export function buildReportEmailHtml(payload: ReportPayload): string {
  const n = payload.topN ?? 3
  const shown = Math.min(n, payload.rows.length)
  const more = payload.rows.length - shown
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:${PAPER};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">
        <tr><td style="padding:0 8px 16px;">
          <span style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${FAINT};">Options-Calculators.com</span>
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid ${RULE};border-radius:14px;padding:28px;">
          <h1 style="margin:0 0 4px;font-size:23px;color:${INK};">${esc(payload.title)}</h1>
          <p style="margin:0;font-size:14px;color:${SOFT};">${esc(payload.description)}</p>
          ${payload.subtitle ? `<p style="margin:6px 0 0;font-size:12px;color:${FAINT};">${esc(payload.subtitle)}</p>` : ""}
          <p style="margin:6px 0 20px;font-size:12px;color:${FAINT};">Generated ${esc(reportStamp(payload))}</p>

          <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${FAINT};margin-bottom:6px;">Executive summary</div>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:${INK};">${esc(payload.executiveSummary)}</p>

          <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${FAINT};margin-bottom:10px;">Top ${shown} ${shown === 1 ? "result" : "results"}</div>
          ${topCards(payload)}
          ${more > 0 ? `<p style="margin:4px 0 0;font-size:13px;color:${SOFT};">…and ${more} more in the attached files.</p>` : ""}

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid ${RULE};">
            <tr><td style="padding-top:16px;">
              <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${FAINT};margin-bottom:8px;">Attached</div>
              <p style="margin:0;font-size:13px;color:${SOFT};line-height:1.7;">
                &#128196; <strong style="color:${INK};">Excel</strong> — the full ${payload.rows.length}-row table, sortable.<br>
                &#128196; <strong style="color:${INK};">PDF</strong> — the same report, print-ready.
              </p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 8px 0;">
          <p style="margin:0;font-size:11px;color:${FAINT};line-height:1.6;">
            Sent because you asked for this report from your account. Figures are point-in-time as of the stamp above and are educational, not advice.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function buildReportEmailText(payload: ReportPayload): string {
  const n = payload.topN ?? 3
  const top = payload.rows.slice(0, n)
  const lines = top.map((row, i) => {
    const parts = payload.columns.map((c) => `${c.label}: ${formatCell(row[c.key], c.format)}`)
    return `${i + 1}. ${parts.join(" · ")}`
  })
  return [
    payload.title,
    payload.description,
    `Generated ${reportStamp(payload)}`,
    "",
    "EXECUTIVE SUMMARY",
    payload.executiveSummary,
    "",
    `TOP ${top.length}`,
    ...lines,
    payload.rows.length > top.length ? `…and ${payload.rows.length - top.length} more in the attached Excel and PDF.` : "",
    "",
    "Attached: an Excel workbook and a PDF of the full report.",
  ].join("\n")
}
