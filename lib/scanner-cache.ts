// Age-checked localStorage for scanner results.
//
// WHAT THIS FIXES. Six scanners — butterfly, calendar-spread, credit-spread,
// iron-condor, leaps, zebra — each restored their last results on mount with
// NO AGE CHECK:
//
//     const cached = localStorage.getItem("butterfly-scanner-cache")
//     if (cached) { const { data, timestamp } = JSON.parse(cached)
//                   setSetups(data); setLastUpdated(timestamp) }
//
// So a scan from any distance in the past rendered as the current one. That is
// worse than the stale CCPI score fixed alongside it, because a CCPI score is a
// single number a reader can weigh, while these rows are TRADE CANDIDATES with
// strikes, max profit, max loss and probability attached — every one of them
// computed off an underlying price that has since moved. The owner makes
// six-figure decisions from these tables.
//
// The stored `timestamp` could not have been used for an age check even if
// someone had tried: it was `new Date().toLocaleString()`, a locale-formatted
// DISPLAY string. It renders correctly under "Last updated" and does not parse
// back reliably. So this module writes both — `savedAt` (ISO, machine-readable,
// the thing age is computed from) and `timestamp` (the display string the
// components already show).
//
// LEGACY ENTRIES ARE EXPIRED, not trusted. Anything written before this module
// has no `savedAt`, and "saved before anyone recorded when" is not evidence of
// freshness.

/**
 * Age at which a cached scan stops being served.
 *
 * Thirty minutes, and the reasoning is deliberately different from the CCPI
 * cache's four hours. That one holds a macro index that moves slowly. These
 * hold option quotes — strike-level pricing that moves continuously while the
 * market is open. The window is long enough to survive a tab switch or a
 * navigation away and back, which is the only thing this cache is actually for,
 * and short enough that it cannot carry a setup across a session break.
 *
 * Not market-hours-aware, for the same reason as the CCPI cache: an expiry that
 * depends on the clock is one whose staleness the reader has to reason about.
 */
const SCAN_CACHE_TTL_MS = 30 * 60 * 1000

export interface CachedScan<T> {
  data: T
  /** Display string the component renders under "Last updated". */
  timestamp: string
}

interface StoredScan<T> extends CachedScan<T> {
  /** ISO save time. Absent on entries written before this module existed. */
  savedAt?: string
}

/**
 * Load scan results, or null when there are none, they cannot be parsed, or
 * they have expired.
 *
 * Null on expiry is what makes this safe to drop in: every caller already
 * handles "no cache" by simply not populating the table, so an expired entry
 * takes the same path as an absent one and the user sees an empty scanner
 * rather than a stale one.
 */
export function loadScanFromCache<T>(key: string): CachedScan<T> | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null

    const parsed = JSON.parse(raw) as StoredScan<T>
    if (!parsed || parsed.data === undefined) return null

    const savedAt = parsed.savedAt ? Date.parse(parsed.savedAt) : NaN
    if (!Number.isFinite(savedAt)) return null

    if (Date.now() - savedAt > SCAN_CACHE_TTL_MS) {
      console.log(`[scanner-cache] ${key}: expired — not serving a stale scan as current`)
      return null
    }

    return { data: parsed.data, timestamp: parsed.timestamp }
  } catch {
    return null
  }
}
