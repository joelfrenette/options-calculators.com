// CCPI Caching Utilities
// Handles localStorage operations for CCPI data

import type { CCPIData } from "./types"
import { CACHE_KEYS } from "./constants"

/**
 * Saves CCPI data to localStorage
 */
export function saveCCPIToCache(data: CCPIData): boolean {
  try {
    const cachedData = {
      ...data,
      cachedAt: new Date().toISOString(),
    }
    localStorage.setItem(CACHE_KEYS.CCPI_DATA, JSON.stringify(cachedData))
    console.log("[v0] CCPI data saved to localStorage")
    return true
  } catch (error) {
    console.error("[v0] Failed to save to localStorage:", error)
    return false
  }
}

/**
 * Loads CCPI data from localStorage
 */
export function loadCCPIFromCache(): CCPIData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.CCPI_DATA)
    if (!cached) return null

    const parsedCache = JSON.parse(cached) as CCPIData
    console.log("[v0] CCPI: Loaded from localStorage", parsedCache.timestamp)
    return parsedCache
  } catch (error) {
    console.error("[v0] Failed to parse cached CCPI data:", error)
    return null
  }
}

// P7-14. `getCachedData` / `setCachedData` deleted here. They were pure aliases
// of `loadCCPIFromCache` / `saveCCPIToCache` above, and their only importer was
// hooks/use-ccpi-data.ts, which was unreachable. Two names for one function is
// how a codebase ends up with half its call sites on each.

// P7-9. FIVE FUNCTIONS DELETED HERE, in three separate decisions.
//
// `clearCCPICache` — no caller. There is no "clear cache" control anywhere in
// the dashboard or the admin panel; the CCPI entry is overwritten on every
// successful fetch and expires by age through `hasFreshCache`.
//
// `saveSummaryToCache` / `loadSummaryFromCache` — a matched pair with no caller
// on either side. The executive summary is fetched from
// /api/ccpi/executive-summary each time the dashboard needs it.
//
// `saveHistoryToCache` / `loadHistoryFromCache` — **a write-only cache, and the
// reason to delete the WRITE as well as the read.** The dashboard called
// `saveHistoryToCache(result)` on every history fetch and nothing ever read the
// key back, so each visit serialised the full history series into localStorage
// to be read by nobody. That is not merely dead weight: localStorage is a
// per-origin quota shared with the CCPI snapshot that IS read, and the largest
// unread writer is the one most likely to push the quota over and make
// `saveCCPIToCache` start failing. Deleting only the dead reader would have
// left the cost and removed the evidence.
//
// What survives is the one cache with a reader — `saveCCPIToCache` /
// `loadCCPIFromCache`, which components/ccpi-dashboard.tsx imports directly —
// and `hasFreshCache`, which is kept DELIBERATELY DEAD. See below.

/**
 * Checks if cached data is fresh (within specified minutes)
 */
function isCacheFresh(cachedAt: string | undefined, maxAgeMinutes = 5): boolean {
  if (!cachedAt) return false

  const cacheTime = new Date(cachedAt).getTime()
  const now = Date.now()
  const ageMinutes = (now - cacheTime) / (1000 * 60)

  return ageMinutes < maxAgeMinutes
}

/**
 * Whether the cached CCPI snapshot is younger than `maxAgeMinutes`.
 *
 * **P7-14: kept with no caller, on purpose, and allowlisted in
 * scripts/check-dead-exports.ts with this reason.** Its only importer was the
 * unreachable `hooks/use-ccpi-data.ts`, so deleting it would have been
 * consistent with every other decision in this phase — except that it is the
 * one piece of machinery the LIVE path is missing.
 *
 * components/ccpi-dashboard.tsx loads `loadCCPIFromCache()` unconditionally, at
 * any age, and holds `fromCache` and `cacheTimestamp` in state that nothing
 * renders. So the CCPI tab can show an arbitrarily old snapshot with nothing on
 * screen saying it is cached or when it was taken (P7-16). Deleting the age
 * check would remove the tool for that fix and leave the gap.
 *
 * This is the exception the KNOWN_DEAD comment describes: an export with no
 * caller YET, listed with its reason rather than swept. If P7-16 is resolved
 * some other way, delete this and drop the allowlist entry together.
 */
export function hasFreshCache(maxAgeMinutes = 5): boolean {
  const cached = loadCCPIFromCache()
  if (!cached) return false
  return isCacheFresh(cached.cachedAt, maxAgeMinutes)
}
