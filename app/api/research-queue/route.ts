import { NextResponse } from "next/server"
import { getSessionInfo } from "@/lib/auth"
import { enqueueTicker, listQueue, saveRecommendation, setStatus, removeTicker, getProfile, getRecap } from "@/lib/research/store"
import { researchTicker } from "@/lib/research/run"
import type { ResearchStatus } from "@/lib/research/types"

/**
 * The ticker research queue (RESEARCH_QUEUE_DESIGN.md).
 *
 * Any authenticated session (admin or member) has its OWN queue, keyed by the
 * session email server-side — the request body never carries an owner, the same
 * discipline as the report-email route. Research reads Polygon history + the
 * options snapshot, both available when markets are closed, so unlike the
 * scanners there is no market-hours gate.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 60

const TICKER = /^[A-Z]{1,6}$/

async function owner(): Promise<{ email: string } | { error: NextResponse }> {
  const session = await getSessionInfo()
  if (!session) return { error: NextResponse.json({ error: "Sign in required" }, { status: 401 }) }
  if (!session.email) return { error: NextResponse.json({ error: "This session has no email on file." }, { status: 400 }) }
  return { email: session.email }
}

export async function GET() {
  const o = await owner()
  if ("error" in o) return o.error
  const [queue, recap] = await Promise.all([listQueue(o.email), getRecap(o.email)])
  return NextResponse.json({ queue, recap })
}

export async function POST(request: Request) {
  const o = await owner()
  if ("error" in o) return o.error

  let body: { ticker?: unknown; sharesHeld?: unknown; costBasis?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 })
  }

  const ticker = typeof body.ticker === "string" ? body.ticker.trim().toUpperCase() : ""
  if (!TICKER.test(ticker)) return NextResponse.json({ error: "Ticker must be 1–6 letters" }, { status: 400 })
  // Only carry shares/cost when the caller actually sent them, so a one-click
  // research (ticker only) never wipes a position already stored on the row.
  const sharesHeld =
    body.sharesHeld === undefined
      ? undefined
      : Number.isFinite(Number(body.sharesHeld))
        ? Math.max(0, Math.floor(Number(body.sharesHeld)))
        : 0
  const costBasis =
    body.costBasis === undefined
      ? undefined
      : Number.isFinite(Number(body.costBasis)) && Number(body.costBasis) > 0
        ? Number(body.costBasis)
        : null

  const row = await enqueueTicker(o.email, ticker, sharesHeld, costBasis)
  if (!row) return NextResponse.json({ error: "Could not queue the ticker (storage unavailable)" }, { status: 502 })

  // Research inline so the caller gets a result. Research against the STORED
  // position (row.sharesHeld), not the request, so the covered-call-vs-exit read
  // reflects the shares actually on the row. The prior recommendation is carried
  // into prev_recommendation for the morning-recap diff.
  await setStatus(row.id, o.email, "researching")
  try {
    const profile = await getProfile(o.email)
    const rec = await researchTicker(ticker, profile, row.sharesHeld)
    const saved = await saveRecommendation(row.id, o.email, rec, row.recommendation)
    if (!saved) {
      await setStatus(row.id, o.email, "failed")
      return NextResponse.json(
        { error: "Recommendation computed but could not be saved — try again." },
        { status: 502 },
      )
    }
    return NextResponse.json({ row: { ...row, status: "researched", recommendation: rec } })
  } catch (e) {
    await setStatus(row.id, o.email, "failed")
    return NextResponse.json(
      { error: `Research failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    )
  }
}

export async function PATCH(request: Request) {
  const o = await owner()
  if ("error" in o) return o.error
  let body: { id?: unknown; status?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 })
  }
  const id = Number(body.id)
  const status = body.status as ResearchStatus
  const allowed: ResearchStatus[] = ["paused", "archived", "pending"]
  if (!Number.isFinite(id) || !allowed.includes(status)) {
    return NextResponse.json({ error: "Provide a valid id and status (paused|archived|pending)" }, { status: 400 })
  }
  const ok = await setStatus(id, o.email, status)
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Update failed" }, { status: 502 })
}

export async function DELETE(request: Request) {
  const o = await owner()
  if ("error" in o) return o.error
  const { searchParams } = new URL(request.url)
  const id = Number(searchParams.get("id"))
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Provide ?id=" }, { status: 400 })
  const ok = await removeTicker(id, o.email)
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Delete failed" }, { status: 502 })
}
