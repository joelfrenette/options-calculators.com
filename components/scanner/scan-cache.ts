// Same-day localStorage cache for scanner results (valid until the next trading
// day, 9:30 AM ET). Extracted verbatim from components/wheel-scanner.tsx (Phase 4).

export const CACHE_VERSION = "v3" // v3: quarterly-financials scan (real profitable-quarters count, TTM ROE/EPS, 12-stop market-cap floor)

// Check if it's a weekday (Monday-Friday)
const isWeekday = (date: Date): boolean => {
  const day = date.getDay()
  return day >= 1 && day <= 5 // Monday = 1, Friday = 5
}

// Get today's market open time (9:30 AM ET)
const getMarketOpenTime = (): Date => {
  const now = new Date()
  const etDate = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  etDate.setHours(9, 30, 0, 0)
  return etDate
}

// Check if cache is valid (same day, after 9:30 AM ET, weekday)
const isCacheValid = (cacheTimestamp: number): boolean => {
  const now = new Date()
  const etNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const cacheDate = new Date(cacheTimestamp)
  const cacheEtDate = new Date(cacheDate.toLocaleString("en-US", { timeZone: "America/New_York" }))

  console.log(`[v0] Cache validation check:`)
  console.log(`  - Current ET time: ${etNow.toLocaleString()}`)
  console.log(`  - Cache ET time: ${cacheEtDate.toLocaleString()}`)
  console.log(
    `  - Current day of week: ${etNow.getDay()} (${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][etNow.getDay()]})`,
  )

  // Check if it's a weekday
  if (!isWeekday(etNow)) {
    console.log("[v0] ❌ Cache check: Not a weekday, cache invalid")
    return false
  }

  // Check if cache is from today (in ET timezone)
  const isSameDay =
    cacheEtDate.getFullYear() === etNow.getFullYear() &&
    cacheEtDate.getMonth() === etNow.getMonth() &&
    cacheEtDate.getDate() === etNow.getDate()

  console.log(`  - Is same day? ${isSameDay}`)

  // Don't check if we're past market open or if cache was created after market open
  // This allows cache to work all day long once created
  const isValid = isSameDay

  console.log(`  - Cache valid? ${isValid} (only checking same day + weekday)`)

  return isValid
}

// Generate cache key from filter parameters
export const generateCacheKey = (params: {
  minVolume: number
  maxDebtToEquity: number
  minROE: number
  minProfitableQuarters: number
  minMarketCapCategory: number
  tickers: string
}): string => {
  return `fundamental_scan_${CACHE_VERSION}_${params.minVolume}_${params.maxDebtToEquity}_${params.minROE}_${params.minProfitableQuarters}_${params.minMarketCapCategory}_${params.tickers.replace(/[^a-zA-Z,]/g, "").substring(0, 50)}`
}

/**
 * Cache keys this module owns, by prefix.
 *
 * Listed rather than pattern-matched on `_scan_` alone, so a future key named
 * `something_scan_…` cannot be swept away by a helper that never heard of it.
 * The per-tab caches (`leaps-scanner-cache` and friends) are NOT here: they are
 * written by the scanner tabs, carry no version segment, and are none of this
 * module's business.
 */
const OWNED_PREFIXES = ["fundamental_scan_", "technical_scan_"] as const

/**
 * Is this a cache key from a SUPERSEDED version of the scanner? (S-16)
 *
 * `loadFromCache` evicts only the key it just missed on, so every bump of
 * `CACHE_VERSION` orphans the previous version's entries — they are never read
 * again, never expire, and never get removed. A full scan result is large and
 * localStorage is a ~5MB budget shared with everything else on the origin, so
 * the accumulation ends in a quota error on an unrelated write.
 *
 * Pure and exported so `scripts/check-scan-cache.ts` can assert it without a
 * browser. The version segment is matched structurally — `v` followed by
 * digits, immediately after a known prefix — never by string-containment,
 * because `v3` appears inside plenty of ticker lists.
 */
export const isSupersededCacheKey = (key: string, currentVersion: string = CACHE_VERSION): boolean => {
  for (const prefix of OWNED_PREFIXES) {
    if (!key.startsWith(prefix)) continue
    const rest = key.slice(prefix.length)
    const m = /^v(\d+)_/.exec(rest)
    if (!m) return false // owned prefix but no version segment: not ours to judge
    return `v${m[1]}` !== currentVersion
  }
  return false
}

/**
 * Remove every superseded-version entry this module owns.
 *
 * Called once when the scanner mounts. Reads the key list first and deletes
 * afterwards, because `localStorage.removeItem` during a `key(i)` walk
 * reindexes the store and silently skips entries.
 */
export const pruneSupersededCaches = (): number => {
  if (typeof window === "undefined" || !window.localStorage) return 0
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && isSupersededCacheKey(key)) doomed.push(key)
    }
    for (const key of doomed) localStorage.removeItem(key)
    if (doomed.length > 0) {
      console.log(`[v0] Pruned ${doomed.length} scan cache entr(ies) from superseded versions: ${doomed.join(", ")}`)
    }
    return doomed.length
  } catch (err) {
    console.error("[v0] Error pruning superseded caches:", err)
    return 0
  }
}

export const saveToCache = (key: string, data: any): void => {
  try {
    const cacheData = {
      timestamp: Date.now(),
      data: data,
    }
    localStorage.setItem(key, JSON.stringify(cacheData))
    console.log(`[v0] Saved to cache: ${key}`)
  } catch (err) {
    console.error("[v0] Error saving to cache:", err)
  }
}

// Load from cache
export const loadFromCache = (key: string): any | null => {
  try {
    console.log(`[v0] 🔍 loadFromCache() called with key: ${key}`)
    const cached = localStorage.getItem(key)

    if (!cached) {
      console.log(`[v0] ❌ No cache found in localStorage for key: ${key}`)
      return null
    }

    console.log(`[v0] ✅ Found cache data in localStorage`)
    const cacheData = JSON.parse(cached)
    console.log(`[v0] Cache timestamp: ${new Date(cacheData.timestamp).toLocaleString()}`)

    if (!isCacheValid(cacheData.timestamp)) {
      console.log(`[v0] ❌ Cache expired/invalid - removing from localStorage`)
      localStorage.removeItem(key)
      return null
    }

    console.log(`[v0] ✅✅✅ Cache is valid! Returning cached data`)
    return cacheData.data
  } catch (err) {
    console.error("[v0] ❌ Error loading from cache:", err)
    return null
  }
}
