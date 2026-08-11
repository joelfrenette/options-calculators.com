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

export const getCachedData = loadCCPIFromCache
export const setCachedData = saveCCPIToCache

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
// What survives is the one cache with a reader: `saveCCPIToCache` /
// `loadCCPIFromCache` (plus the `getCachedData` / `setCachedData` aliases
// hooks/use-ccpi-data.ts imports) and the `hasFreshCache` age check.

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

export function hasFreshCache(maxAgeMinutes = 5): boolean {
  const cached = loadCCPIFromCache()
  if (!cached) return false
  return isCacheFresh(cached.cachedAt, maxAgeMinutes)
}
