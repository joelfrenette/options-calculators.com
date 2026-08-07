"use client"

// Landmine awareness: scheduled events (earnings, CPI, FOMC, jobs) that land
// BEFORE an option's expiry. Never used to filter — display-only, so the user
// knows when a rich premium is event-driven and needs extra research.
// Extracted verbatim from components/wheel-scanner.tsx (Phase 4).

import { useState } from "react"
import type { LandmineData, QualifyingStock } from "./types"

export function useLandmines() {
  const [landmines, setLandmines] = useState<LandmineData | null>(null)

  const fetchLandmines = async (rows: QualifyingStock[]) => {
    try {
      const tickers = Array.from(new Set(rows.map((r) => r.ticker))).join(",")
      if (!tickers) return
      const expiries = rows.map((r) => r.expiryDate).filter(Boolean) as string[]
      const until = expiries.length > 0 ? [...expiries].sort()[expiries.length - 1] : ""
      const res = await fetch(`/api/landmine-check?tickers=${encodeURIComponent(tickers)}&until=${until}`)
      if (!res.ok) {
        console.error(`[v0] Landmine check HTTP ${res.status}`)
        return
      }
      const data = await res.json()
      // Merge (not replace): the strict and relaxed tables are fetched separately
      // and both stay on screen — keep earnings info for every ticker seen so far.
      setLandmines((prev) => ({
        earnings: { ...(prev?.earnings || {}), ...(data.earnings || {}) },
        macro: (data.macro?.length ?? 0) >= (prev?.macro?.length ?? 0) ? data.macro || [] : prev?.macro || [],
      }))
      console.log(
        `[v0] Landmine data loaded: earnings for ${Object.keys(data.earnings || {}).length} tickers, ${(data.macro || []).length} macro events (${data.from} → ${data.to})`,
      )
    } catch (err) {
      console.error("[v0] Landmine fetch failed:", err)
    }
  }

  // Events scheduled on or before this option row's expiry. null = data not loaded yet.
  const getLandminesForRow = (stock: QualifyingStock): string[] | null => {
    if (!landmines) return null
    if (!stock.expiryDate) return []
    const hits: string[] = []
    for (const e of landmines.earnings[stock.ticker] || []) {
      if (e.date <= stock.expiryDate) hits.push(`${stock.ticker} Earnings ${e.date} (${e.timing})`)
    }
    for (const m of landmines.macro) {
      if (m.date <= stock.expiryDate) hits.push(`${m.event} ${m.date} ${m.time} (${m.impact} impact)`)
    }
    return hits
  }

  // Used by the fundamental scan to clear stale event data before a fresh run.
  const resetLandmines = () => setLandmines(null)

  return { landmines, fetchLandmines, getLandminesForRow, resetLandmines }
}
