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

  // Build both independently. The Excel path is robust; the PDF path depends on
  // pdfkit's fonts being traced into the serverless bundle (next.config.mjs).
  // If the PDF ever fails to build, the email still goes with the Excel and the
  // body — a report with one attachment beats no report at all — and the body
  // says the PDF could not be generated rather than pretending it is attached.
  const [excelR, pdfR] = await Promise.allSettled([buildReportExcel(payload), buildReportPdf(payload)])
  if (excelR.status !== "fulfilled") {
    return { ok: false, error: `Could not build the report: ${excelR.reason instanceof Error ? excelR.reason.message : String(excelR.reason)}` }
  }
  const excel = excelR.value
  const pdf = pdfR.status === "fulfilled" ? pdfR.value : null

  const slug = reportSlug(payload)
  const attachments = [{ filename: `${slug}.xlsx`, content: excel }]
  if (pdf) attachments.push({ filename: `${slug}.pdf`, content: pdf })

  const html = pdf
    ? buildReportEmailHtml(payload)
    : buildReportEmailHtml(payload).replace(
        "print-ready.",
        "print-ready. (The PDF could not be generated this time; the Excel above has the full table.)",
      )

  try {
    const { error } = await new Resend(key).emails.send({
      from: "Options Calculator <noreply@options-calculators.com>",
      to,
      subject: `${payload.title} — ${new Date(payload.generatedAt).toUTCString().replace("GMT", "UTC")}`,
      html,
      text: buildReportEmailText(payload),
      attachments,
    })
    if (error) return { ok: false, error: typeof error === "string" ? error : (error.message ?? "Send failed") }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" }
  }
}
