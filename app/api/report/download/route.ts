import { NextResponse } from "next/server"
import { getSessionInfo } from "@/lib/auth"
import { validateReportPayload } from "@/lib/reports/validate"
import { buildReportExcel } from "@/lib/reports/excel"
import { buildReportPdf } from "@/lib/reports/pdf"
import { reportSlug } from "@/lib/reports/types"

/**
 * Return one report as a downloadable file — the Excel or PDF the page's
 * Export menu asks for. Same gate and same size caps as /api/report-email
 * (any authed session; the body is untrusted and re-validated); the only
 * difference is the response is the FILE, streamed as an attachment, instead
 * of an email. No recipient, no Resend — the browser saves it.
 */

export const dynamic = "force-dynamic"

const MAX_ROWS = 500
const MAX_COLS = 40

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 })
  }

  const format = (body as { format?: unknown })?.format
  if (format !== "pdf" && format !== "xlsx") {
    return NextResponse.json({ error: "format must be 'pdf' or 'xlsx'" }, { status: 400 })
  }

  const parsed = validateReportPayload(body, { maxRows: MAX_ROWS, maxCols: MAX_COLS })
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const slug = reportSlug(parsed.payload)
  try {
    if (format === "xlsx") {
      const buf = await buildReportExcel(parsed.payload)
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${slug}.xlsx"`,
          "Cache-Control": "no-store",
        },
      })
    }
    const buf = await buildReportPdf(parsed.payload)
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: `Could not build the ${format.toUpperCase()} file: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
