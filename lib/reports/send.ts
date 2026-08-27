import { Resend } from "resend"
import { resolveApiKey } from "@/lib/api-keys"
import { type ReportPayload, reportSlug } from "./types"
import { buildReportExcel } from "./excel"
import { buildReportPdf } from "./pdf"
import { buildReportEmailHtml, buildReportEmailText } from "./email-html"

/**
 * Build the Excel + PDF + HTML email for one ReportPayload and send it, with
 * both files attached, to `to`. The route decides `to` — always the signed-in
 * user's own email, never an address from the request body, so this can never
 * be turned into a mailer for arbitrary recipients.
 */
export async function sendReportEmail(
  payload: ReportPayload,
  to: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = resolveApiKey("RESEND_API_KEY")
  if (!key) return { ok: false, error: "Email is not configured (RESEND_API_KEY)" }

  let excel: Buffer, pdf: Buffer
  try {
    ;[excel, pdf] = await Promise.all([buildReportExcel(payload), buildReportPdf(payload)])
  } catch (e) {
    return { ok: false, error: `Could not build the report files: ${e instanceof Error ? e.message : String(e)}` }
  }

  const slug = reportSlug(payload)
  try {
    const { error } = await new Resend(key).emails.send({
      from: "Options Calculator <noreply@options-calculators.com>",
      to,
      subject: `${payload.title} — ${new Date(payload.generatedAt).toUTCString().replace("GMT", "UTC")}`,
      html: buildReportEmailHtml(payload),
      text: buildReportEmailText(payload),
      attachments: [
        { filename: `${slug}.xlsx`, content: excel },
        { filename: `${slug}.pdf`, content: pdf },
      ],
    })
    if (error) return { ok: false, error: typeof error === "string" ? error : (error.message ?? "Send failed") }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" }
  }
}
