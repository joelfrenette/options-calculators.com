import { NextResponse } from "next/server"
import { getSessionInfo } from "@/lib/auth"
import { getProfile, saveProfile } from "@/lib/research/store"
import type { WheelProfile } from "@/lib/research/types"

/**
 * One owner's wheel_profile — the premium-selling preferences the Research Queue
 * computes against (RESEARCH_QUEUE_DESIGN.md). Owner is derived from the session
 * email server-side, never the body — same discipline as /api/research-queue.
 * PATCH clamps every field to a sane range and keeps the current value for
 * anything missing or invalid, so a partial or garbled body can never corrupt
 * the profile the nightly cron reads.
 */

export const dynamic = "force-dynamic"

async function owner(): Promise<{ email: string } | { error: NextResponse }> {
  const s = await getSessionInfo()
  if (!s) return { error: NextResponse.json({ error: "Sign in required" }, { status: 401 }) }
  if (!s.email) return { error: NextResponse.json({ error: "This session has no email on file." }, { status: 400 }) }
  return { email: s.email }
}

const clampNum = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback
}
const clampInt = (v: unknown, lo: number, hi: number, fallback: number): number => Math.round(clampNum(v, lo, hi, fallback))

/** Merge a raw body over the current profile, clamping every field to a sane range. */
function merge(cur: WheelProfile, b: Record<string, unknown>): WheelProfile {
  const accountType =
    b.accountType === "401k" || b.accountType === "taxable" || b.accountType === "ira" ? b.accountType : cur.accountType

  const cspLow = clampNum(b.targetCspDeltaLow, 0.01, 0.98, cur.targetCspDelta[0])
  const cspHigh = clampNum(b.targetCspDeltaHigh, 0.02, 0.99, cur.targetCspDelta[1])
  const dteLow = clampInt(b.preferredDteLow, 1, 365, cur.preferredDte[0])
  const dteHigh = clampInt(b.preferredDteHigh, 1, 365, cur.preferredDte[1])
  const leapsLow = clampNum(b.leapsTargetDeltaLow, 0.5, 0.94, cur.leapsTargetDelta[0])
  const leapsHigh = clampNum(b.leapsTargetDeltaHigh, 0.51, 0.95, cur.leapsTargetDelta[1])

  return {
    accountType,
    willingToBeAssigned: typeof b.willingToBeAssigned === "boolean" ? b.willingToBeAssigned : cur.willingToBeAssigned,
    avoidEarningsWithinDte:
      typeof b.avoidEarningsWithinDte === "boolean" ? b.avoidEarningsWithinDte : cur.avoidEarningsWithinDte,
    maxCapitalPerTradeUsd: clampInt(b.maxCapitalPerTradeUsd, 100, 100_000_000, cur.maxCapitalPerTradeUsd),
    minIvRankForPremiumSale: clampInt(b.minIvRankForPremiumSale, 0, 100, cur.minIvRankForPremiumSale),
    // Keep low ≤ high after clamping, so an inverted pair can't be stored.
    targetCspDelta: [Math.min(cspLow, cspHigh), Math.max(cspLow, cspHigh)],
    preferredDte: [Math.min(dteLow, dteHigh), Math.max(dteLow, dteHigh)],
    leapsMinDte: clampInt(b.leapsMinDte, 90, 1095, cur.leapsMinDte),
    leapsTargetDelta: [Math.min(leapsLow, leapsHigh), Math.max(leapsLow, leapsHigh)],
  }
}

export async function GET() {
  const o = await owner()
  if ("error" in o) return o.error
  return NextResponse.json({ profile: await getProfile(o.email) })
}

export async function PATCH(request: Request) {
  const o = await owner()
  if ("error" in o) return o.error
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 })
  }
  const next = merge(await getProfile(o.email), body)
  const ok = await saveProfile(o.email, next)
  return ok
    ? NextResponse.json({ profile: next })
    : NextResponse.json({ error: "Could not save your preferences" }, { status: 502 })
}
