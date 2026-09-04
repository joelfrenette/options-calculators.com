// Research Queue — Supabase persistence (RLS deny-all + service key, the house
// pattern). Keyed by owner email so the admin (no members row) and members share
// one model. All server-side; never reached from the client.

import { getMeteringSupabaseConfig } from "@/lib/metered-fetch"
import {
  DEFAULT_WHEEL_PROFILE,
  type OptionsRecommendation,
  type Recap,
  type RecapItem,
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
  sharesHeld?: number,
  costBasis?: number | null,
): Promise<ResearchRow | null> {
  const c = cfg()
  if (!c) return null
  try {
    const res = await fetch(`${c.url}/rest/v1/${TABLE}?on_conflict=owner_email,ticker`, {
      method: "POST",
      headers: headers(c.key, { Prefer: "resolution=merge-duplicates,return=representation" }),
      // Only send shares_held/cost_basis when the caller supplied them. A plain
      // re-research or a one-click ResearchButton (ticker only) must NOT clobber
      // a position already stored on the row; on a merge, columns absent from the
      // payload are left untouched, and on a fresh row they take the table
      // defaults (P2 fix — the CC-vs-exit read depends on shares surviving).
      body: JSON.stringify({
        owner_email: email,
        ticker: ticker.toUpperCase(),
        status: "pending",
        ...(sharesHeld !== undefined ? { shares_held: sharesHeld } : {}),
        ...(costBasis !== undefined ? { cost_basis: costBasis } : {}),
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
  email: string,
  rec: OptionsRecommendation,
  prev: OptionsRecommendation | null,
): Promise<boolean> {
  const c = cfg()
  if (!c) return false
  try {
    // Scope by owner_email too, so the ownership invariant lives at the data
    // layer like every other mutation here, not only in the caller (P3 fix).
    const res = await fetch(`${c.url}/rest/v1/${TABLE}?id=eq.${id}&owner_email=eq.${enc(email)}`, {
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

/**
 * Every non-archived, non-paused row across ALL owners, oldest-first, for the
 * nightly refresh (Phase 3). The caller groups by owner and caps per owner.
 */
export async function listActiveForRefresh(): Promise<ResearchRow[]> {
  const c = cfg()
  if (!c) return []
  try {
    const res = await fetch(
      `${c.url}/rest/v1/${TABLE}?status=not.in.(archived,paused)&order=owner_email.asc,created_at.asc`,
      { headers: headers(c.key), signal: AbortSignal.timeout(10000), cache: "no-store" },
    )
    if (!res.ok) return []
    const rows = (await res.json()) as DbRow[]
    return Array.isArray(rows) ? rows.map(toRow) : []
  } catch {
    return []
  }
}

/** Upsert one owner's latest morning recap (one row per owner). */
export async function saveRecap(
  email: string,
  recap: { summary: string; items: RecapItem[]; isLlm: boolean },
): Promise<boolean> {
  const c = cfg()
  if (!c) return false
  try {
    const res = await fetch(`${c.url}/rest/v1/research_recap?on_conflict=owner_email`, {
      method: "POST",
      headers: headers(c.key, { Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        owner_email: email,
        generated_at: new Date().toISOString(),
        summary: recap.summary,
        items: recap.items,
        is_llm: recap.isLlm,
      }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

/** One owner's latest morning recap, or null when none has been written yet. */
export async function getRecap(email: string): Promise<Recap | null> {
  const c = cfg()
  if (!c) return null
  try {
    const res = await fetch(`${c.url}/rest/v1/research_recap?owner_email=eq.${enc(email)}&limit=1`, {
      headers: headers(c.key),
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    })
    if (!res.ok) return null
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return null
    const r = rows[0]
    return {
      ownerEmail: r.owner_email,
      generatedAt: r.generated_at,
      summary: r.summary ?? "",
      items: Array.isArray(r.items) ? r.items : [],
      isLlm: !!r.is_llm,
    }
  } catch {
    return null
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

/** Upsert one owner's wheel profile (one row per owner, keyed by owner_email). */
export async function saveProfile(email: string, p: WheelProfile): Promise<boolean> {
  const c = cfg()
  if (!c) return false
  try {
    const res = await fetch(`${c.url}/rest/v1/wheel_profile?on_conflict=owner_email`, {
      method: "POST",
      headers: headers(c.key, { Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        owner_email: email,
        account_type: p.accountType,
        willing_to_be_assigned: p.willingToBeAssigned,
        avoid_earnings_within_dte: p.avoidEarningsWithinDte,
        max_capital_per_trade_usd: p.maxCapitalPerTradeUsd,
        min_iv_rank_for_premium_sale: p.minIvRankForPremiumSale,
        target_csp_delta_low: p.targetCspDelta[0],
        target_csp_delta_high: p.targetCspDelta[1],
        preferred_dte_low: p.preferredDte[0],
        preferred_dte_high: p.preferredDte[1],
        leaps_min_dte: p.leapsMinDte,
        leaps_target_delta_low: p.leapsTargetDelta[0],
        leaps_target_delta_high: p.leapsTargetDelta[1],
        updated_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}
