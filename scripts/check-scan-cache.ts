/**
 * Superseded scanner caches are identified correctly, and only ours. (S-16)
 *
 * Run: node scripts/check-scan-cache.ts
 *
 * WHY THIS FILE EXISTS. `loadFromCache` evicts only the key it just missed on,
 * so every bump of `CACHE_VERSION` orphaned the previous version's entries:
 * never read again, never expired, never removed. A full scan result is large
 * and localStorage is a ~5MB budget shared across the whole origin, so the
 * accumulation surfaces as a quota error on some unrelated write — a failure
 * with no connection to the code that caused it.
 *
 * `pruneSupersededCaches` fixes it, and a sweep that DELETES things is exactly
 * the kind of code that needs a test with real strings in it. The dangerous
 * failure is not "misses a stale key"; it is "removes a live one". Both
 * directions are asserted below.
 *
 * The module reads `localStorage`, which does not exist here — so the pure
 * predicate is what gets tested, and `pruneSupersededCaches` is a thin
 * `typeof window` guard plus a walk over it. The limit is stated rather than
 * implied: the walk itself is not covered.
 *
 * A SECOND LIMIT, FOUND BY NEGATIVE-TESTING AND WORTH WRITING DOWN. Changing
 * `key.startsWith(prefix)` to `key.includes(prefix)` does not fail this check,
 * and no assertion here can make it. The reason is that the slice immediately
 * after uses `prefix.length` measured from index 0 — so an unanchored match
 * produces a garbage remainder that fails the `^v\d+_` test, and the predicate
 * returns `false`. It fails CLOSED: the key is kept, not deleted. For a sweep
 * whose only dangerous error is deleting a live key, that is the right
 * direction to fail in, and `"my_fundamental_scan_v1_x"` below pins the
 * property that actually matters — a foreign key is never swept — under either
 * implementation. Claiming the anchoring itself is covered would be false.
 */

import { isSupersededCacheKey, CACHE_VERSION } from "../components/scanner/scan-cache.ts"

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

check(`CACHE_VERSION is a v-prefixed number — currently ${CACHE_VERSION}`, /^v\d+$/.test(CACHE_VERSION))

// ---------------------------------------------------------------- superseded

check(
  "an older fundamental-scan key is superseded",
  isSupersededCacheKey("fundamental_scan_v1_2_3_4_5_6_AAPL,MSFT", "v3") === true,
)
check(
  "an older technical-scan key is superseded",
  isSupersededCacheKey("technical_scan_v2_60_70_2_15_false_true_AAPL", "v3") === true,
)
check(
  "a NEWER version is also superseded — the rule is 'not current', not 'older'",
  isSupersededCacheKey("fundamental_scan_v9_x", "v3") === true,
  "a downgrade leaves v9 entries behind exactly as an upgrade leaves v1 entries",
)

// --------------------------------------------------------------------- kept

check(
  "the CURRENT version is kept",
  isSupersededCacheKey(`fundamental_scan_${CACHE_VERSION}_2_3_4_5_6_AAPL`, CACHE_VERSION) === false,
)

/**
 * The keys that must never be touched. `leaps-scanner-cache` and its siblings
 * are written by the individual scanner tabs, carry no version segment, and
 * hold the rows those tabs restore on mount. A sweep that took them would look
 * to the user like every tab forgetting its results at random.
 */
const FOREIGN = [
  "leaps-scanner-cache",
  "zebra-scanner-cache",
  "earnings-plays-scanner-cache",
  "market-sentiment-cache",
  "theme",
  "fundamental_scan", // the prefix with nothing after it
  "my_fundamental_scan_v1_x", // owned prefix, but not at the start
]
for (const key of FOREIGN) {
  check(`"${key}" is left alone`, isSupersededCacheKey(key, "v3") === false)
}

check(
  "an owned prefix with no version segment is left alone",
  isSupersededCacheKey("fundamental_scan_nover_AAPL", "v3") === false,
  "unrecognised shape means 'not mine to judge', not 'delete it'",
)

/**
 * The version is matched STRUCTURALLY — `v<digits>` immediately after a known
 * prefix — never by string-containment. `v3` occurs inside ticker lists and
 * inside other numbers, and a containment test would keep a v1 key whose
 * ticker list happens to mention `v3`.
 */
check(
  "a v1 key whose payload mentions the current version is still superseded",
  isSupersededCacheKey("fundamental_scan_v1_2_3_4_5_6_ADVANCED_v3_NAMES", "v3") === true,
  "containment matching would have kept this one",
)
check(
  "a longer version number is not confused with a shorter one",
  isSupersededCacheKey("fundamental_scan_v30_x", "v3") === true && isSupersededCacheKey("fundamental_scan_v3_x", "v30") === true,
  "v3 and v30 are different versions in both directions",
)

if (failures > 0) {
  console.error(`\n${failures} scan-cache check(s) failed.`)
  process.exit(1)
}
