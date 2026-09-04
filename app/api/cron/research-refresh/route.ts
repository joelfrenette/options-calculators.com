import { NextResponse } from "next/server"
import { checkCronAuth } from "@/lib/cron-auth"
import { runResearchRefresh } from "@/lib/research/refresh"

/**
 * Nightly Research Queue refresh (RESEARCH_QUEUE_DESIGN.md §Phase 3).
 *
 * Re-researches every non-archived, non-paused queued ticker (capped per owner),
 * writes each owner's morning recap, and emails it when something changed. Same
 * CRON_SECRET gate and error-status discipline as every other cron: 503 when the
 * secret is not configured, 401 when the caller's bearer token is wrong.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: Request) {
  const auth = checkCronAuth(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const result = await runResearchRefresh()
  return NextResponse.json({ ok: true, ...result })
}
