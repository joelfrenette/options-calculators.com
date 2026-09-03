// Research Queue — Supabase persistence (RLS deny-all + service key, the house
// pattern). Keyed by owner email so the admin (no members row) and members share
// one model. All server-side; never reached from the client.

import { getMeteringSupabaseConfig } from "@/lib/metered-fetch"
import {
  DEFAULT_WHEEL_PROFILE,
  type OptionsRecommendation,
  type ResearchRow,
  type ResearchStatus,
  type WheelProfile,
} from "./types"

function cfg() {
  return getMeteringSupabaseConfig()
}
function headers(key: string, extra: Record<string, string> = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra }
}

const TABLE = "research_queue"

interface DbRow {
  id: number
  owner_email: string
  ticker: string
  status: ResearchStatus
  shares_held: number
  cost_basis: number | null
  recommendation: OptionsRecommendation | null
  researched_at: string | null
  created_at: string
}

function toRow(r: DbRow): ResearchRow {
  return {
    id: r.id,
    ownerEmail: r.owner_email,
    ticker: r.ticker,
    status: r.status,
    sharesHeld: r.shares_held ?? 0,
    costBasis: r.cost_basis,
    recommendation: r.recommendation,
    researchedAt: r.researched_at,
    createdAt: r.created_at,
  }
}

const enc = encodeURIComponent

/** Every queued ticker for one owner, newest first. */
export async function listQueue(email: string): Promise<ResearchRow[]> {
  const c = cfg()
  if (!c) return []
  try {
    const res = await fetch(
      `${c.url}/rest/v1/${TABLE}?owner_email=eq.${enc(email)}&order=created_at.desc`,
      { headers: headers(c.key), signal: AbortSignal.timeout(8000), cache: "no-store" },
    )
    if (!res.ok) return []
    const rows = (await res.json()) as DbRow[]
    return Array.isArray(rows) ? rows.map(toRow) : []
  } catch {
    return []
  }
}

/** Add a ticker (or reset an existing one to pending). Upsert on (owner,ticker). */
export async function enqueueTicker(
  email: string,
  ticker: string,
  sharesHeld: number,
  costBasis: number | null,
): Promise<ResearchRow | null> {
  const c = cfg()
  if (!c) return null
  try {
    const res = await fetch(`${c.url}/rest/v1/${TABLE}?on_conflict=owner_email,ticker`, {
      method: "POST",
      headers: headers(c.key, { Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify({
        owner_email: email,
        ticker: ticker.toUpperCase(),
        status: "pending",
        shares_held: sharesHeld,
        cost_basis: costBasis,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const rows = (await res.json()) as DbRow[]
    return Array.isArray(rows) && rows.length ? toRow(rows[0]) : null
  } catch {
    return null
  }
}

/** Store a completed recommendation, carrying the prior one into prev_. */
export async function saveRecommendation(
  id: number,
  rec: OptionsRecommendation,
  prev: OptionsRecommendation | null,
): Promise<boolean> {
  const c = cfg()
  if (!c) return false
  try {
    const res = await fetch(`${c.url}/rest/v1/${TABLE}?id=eq.${id}`, {
      method: "PATCH",
      headers: headers(c.key, { Prefer: "return=minimal" }),
      body: JSON.stringify({
        status: "researched",
        recommendation: rec,
        prev_recommendation: prev,
        researched_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function setStatus(id: number, email: string, status: ResearchStatus): Promise<boolean> {
  const c = cfg()
  if (!c) return false
  try {
    const res = await fetch(`${c.url}/rest/v1/${TABLE}?id=eq.${id}&owner_email=eq.${enc(email)}`, {
      method: "PATCH",
      headers: headers(c.key, { Prefer: "return=minimal" }),
      body: JSON.stringify({ status }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Remove a ticker from an owner's queue. */
export async function removeTicker(id: number, email: string): Promise<boolean> {
  const c = cfg()
  if (!c) return false
  try {
    const res = await fetch(`${c.url}/rest/v1/${TABLE}?id=eq.${id}&owner_email=eq.${enc(email)}`, {
      method: "DELETE",
      headers: headers(c.key, { Prefer: "return=minimal" }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

/** One owner's wheel profile, or the defaults when none is stored yet. */
export async function getProfile(email: string): Promise<WheelProfile> {
  const c = cfg()
  if (!c) return DEFAULT_WHEEL_PROFILE
  try {
    const res = await fetch(
      `${c.url}/rest/v1/wheel_profile?owner_email=eq.${enc(email)}&limit=1`,
      { headers: headers(c.key), signal: AbortSignal.timeout(6000), cache: "no-store" },
    )
    if (!res.ok) return DEFAULT_WHEEL_PROFILE
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return DEFAULT_WHEEL_PROFILE
    const p = rows[0]
    return {
      accountType: p.account_type ?? DEFAULT_WHEEL_PROFILE.accountType,
      willingToBeAssigned: p.willing_to_be_assigned ?? true,
      avoidEarningsWithinDte: p.avoid_earnings_within_dte ?? true,
      maxCapitalPerTradeUsd: Number(p.max_capital_per_trade_usd ?? DEFAULT_WHEEL_PROFILE.maxCapitalPerTradeUsd),
      minIvRankForPremiumSale: Number(p.min_iv_rank_for_premium_sale ?? DEFAULT_WHEEL_PROFILE.minIvRankForPremiumSale),
      targetCspDelta: [Number(p.target_csp_delta_low ?? 0.16), Number(p.target_csp_delta_high ?? 0.3)],
      preferredDte: [Number(p.preferred_dte_low ?? 30), Number(p.preferred_dte_high ?? 45)],
      leapsMinDte: Number(p.leaps_min_dte ?? 365),
      leapsTargetDelta: [Number(p.leaps_target_delta_low ?? 0.7), Number(p.leaps_target_delta_high ?? 0.8)],
    }
  } catch {
    return DEFAULT_WHEEL_PROFILE
  }
}
