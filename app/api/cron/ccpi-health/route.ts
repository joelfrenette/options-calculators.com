import { NextResponse } from "next/server"
import { checkCronAuth } from "@/lib/cron-auth"
import { runCcpiHealthCheck } from "@/lib/ccpi/alert"

/**
 * Nightly CCPI health check + alerting (Plan A / P7-69).
 *
 * Runs the same scoring spine as /api/ccpi, stores the day's score, and emails
 * the owner ONLY when a pillar has dropped below the scored-weight floor, the
 * regime just worsened, or certainty fell under the floor. Same CRON_SECRET
 * gate and error-status discipline as every other cron: 503 when the secret is
 * unconfigured, 401 when the bearer token is wrong.
 *
 * Scheduled after market-snapshot (21:30 UTC weekdays) so the FRED store and
 * closes it reads are the freshest of the day.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function GET(request: Request) {
  const auth = checkCronAuth(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const result = await runCcpiHealthCheck()
  return NextResponse.json({ ok: true, ...result })
}
