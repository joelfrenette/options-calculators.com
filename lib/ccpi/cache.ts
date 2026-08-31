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
 * How long a cached CCPI reading may be served before it must be refetched.
 *
 * There was no expiry at all until 2026-08-30. `saveCCPIToCache` has always
 * stamped `cachedAt`, and NOTHING EVER READ IT: the dashboard's mount effect
 * served whatever was in localStorage and, by its own comment, would "only
 * refresh when user clicks button". A reading from any distance in the past
 * therefore rendered as the current one — a page reload did not help, because a
 * reload does not clear localStorage.
 *
 * That is the invented-data defect wearing a timestamp instead of a constant.
 * This audit has spent a fortnight removing numbers that could not be told
 * apart from measurements; a real measurement of a market that has since moved
 * is the same problem one dimension over. The owner makes six-figure decisions
 * on this score.
 *
 * Four hours is chosen to be shorter than a trading session, so a reading
 * cannot survive from the open to the close. It is deliberately NOT a
 * market-hours calculation: `lib/market-hours.ts` exists and is correct, but a
 * cache that expires differently depending on the clock is a cache whose
 * staleness the reader has to reason about, and the whole point here is that
 * they should not have to.
 *
 * TWO THRESHOLDS, TWO DIFFERENT QUESTIONS — do not collapse them.
 * {@link CACHE_FRESH_MINUTES} (5 min) answers "should the header SAY this is
 * stale", and P7-16 wired it there precisely so a cached reading stops
 * presenting itself as current. This one answers "may it be SERVED at all".
 * A reading can honestly be labelled stale and still be the best thing to show
 * while a refetch runs; it cannot honestly be shown for a whole trading day.
 * The display threshold is deliberately much tighter than the serve threshold.
 */
const CCPI_CACHE_TTL_MS = 4 * 60 * 60 * 1000

/** Shape actually written to localStorage — CCPIData plus the save stamp. */
type CachedCCPI = CCPIData & { cachedAt?: string }

/**
 * Loads CCPI data from localStorage, or null when there is none OR when what is
 * there has expired.
 *
 * Returning null on expiry is what makes this safe: the dashboard's mount
 * effect already fetches fresh data when the cache misses, so an expired entry
 * takes the same path as an absent one. No caller had to change.
 *
 * An entry with no `cachedAt` is treated as expired. Those predate this change,
 * and "written before anyone was recording when" is not evidence of freshness.
 */
export function loadCCPIFromCache(): CCPIData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.CCPI_DATA)
    if (!cached) return null

    const parsedCache = JSON.parse(cached) as CachedCCPI

    const savedAt = parsedCache.cachedAt ? Date.parse(parsedCache.cachedAt) : NaN
    if (!Number.isFinite(savedAt)) {
      console.log("[v0] CCPI: cached entry has no readable cachedAt — treating as expired")
      return null
    }
    const ageMs = Date.now() - savedAt
    if (ageMs > CCPI_CACHE_TTL_MS) {
      console.log(
        `[v0] CCPI: cached reading is ${Math.round(ageMs / 60000)} min old (TTL ${Math.round(
          CCPI_CACHE_TTL_MS / 60000,
        )} min) — refetching rather than showing a stale score as current`,
      )
      return null
    }

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
 * Age at which a cached CCPI snapshot stops counting as fresh, in minutes.
 *
 * P7-16: exported, and it is a shared number rather than a shared style. The
 * dashboard's header prints "over N min old", which is a claim about what this
 * check does. With `5` written as a default here and `5` typed into the copy,
 * changing one would have left the other asserting the old threshold — the
 * label-drifts-from-the-code shape check-provenance.ts exists to catch. One
 * constant, read by both.
 */
export const CACHE_FRESH_MINUTES = 5

/**
 * Checks if cached data is fresh (within specified minutes)
 */
function isCacheFresh(cachedAt: string | undefined, maxAgeMinutes = CACHE_FRESH_MINUTES): boolean {
  if (!cachedAt) return false

  const cacheTime = new Date(cachedAt).getTime()
  const now = Date.now()
  const ageMinutes = (now - cacheTime) / (1000 * 60)

  return ageMinutes < maxAgeMinutes
}

/**
 * Whether the cached CCPI snapshot is younger than `maxAgeMinutes`.
 *
 * P7-14 kept this with no caller — its only importer had been the unreachable
 * `hooks/use-ccpi-data.ts` — on the grounds that it was the age check the live
 * path was missing. P7-16 wired it into the CCPI dashboard header, which now
 * marks a cached reading older than {@link CACHE_FRESH_MINUTES} as stale
 * instead of presenting it as current.
 */
export function hasFreshCache(maxAgeMinutes = CACHE_FRESH_MINUTES): boolean {
  const cached = loadCCPIFromCache()
  if (!cached) return false
  return isCacheFresh(cached.cachedAt, maxAgeMinutes)
}
