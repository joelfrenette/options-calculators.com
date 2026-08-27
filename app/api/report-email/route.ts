import { NextResponse } from "next/server"
import { getSessionInfo } from "@/lib/auth"
import { sendReportEmail } from "@/lib/reports/send"
import { validateReportPayload } from "@/lib/reports/validate"

/**
 * Email one report (Excel + PDF + formatted body) to the SIGNED-IN user.
 *
 * Any authenticated session (admin or member) may email a report — it is a
 * feature of the club, not an admin action. The recipient is ALWAYS the
 * session's own email, taken server-side; the request body carries the report
 * DATA but never an address, so this cannot be pointed at a stranger. The
 * page composes the ReportPayload (its columns, its ranking, its summary);
 * this route validates the shape, caps the size, and sends.
 */

export const dynamic = "force-dynamic"

// Guard against a page (or a tampered client) shipping a giant table through
// email. 500 rows and 40 columns is far past any real scan.
const MAX_ROWS = 500
const MAX_COLS = 40

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }
  if (!session.email) {
    return NextResponse.json(
      { error: "This session has no email on file, so there is nowhere to send the report." },
      { status: 400 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 })
  }

  const parsed = validateReportPayload(body, { maxRows: MAX_ROWS, maxCols: MAX_COLS })
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const result = await sendReportEmail(parsed.payload, session.email)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }
  return NextResponse.json({ ok: true, sentTo: session.email })
}
