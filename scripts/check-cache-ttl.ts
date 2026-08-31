/**
 * A cache that serves data must compare a stored time against the clock.
 *
 * WHAT THIS EXISTS TO STOP. On 2026-08-30 a single sweep found NINE localStorage
 * caches that served a reading without ever checking its age:
 *
 *   1  lib/ccpi/cache.ts        `cachedAt` written since the file was created
 *                               and never once read
 *   2-7 six *-scanner.tsx       no age check at all, and the stored timestamp
 *                               was `new Date().toLocaleString()` — a locale
 *                               DISPLAY string that could not have supported
 *                               one even if someone had tried
 *   8  market-sentiment.tsx     ISO timestamp written, read, DISPLAYED, and
 *                               never compared; the serve decision checked the
 *                               payload's shape and a CACHE_VERSION instead
 *   9  social-sentiment.tsx     epoch timestamp read only for "last updated";
 *                               the serve decision was `if (cached)`
 *
 * Six of those were scanner tables — strike, max profit, max loss, probability
 * of profit — every figure computed off an underlying price that had since
 * moved, rendered identically whether the scan was thirty seconds or thirty
 * days old. The owner sizes six-figure positions from them.
 *
 * The shape is always the same and always quiet: a timestamp IS stored, often
 * IS read, and is used for the label rather than the decision. Nothing fails.
 * The reading is real — it is simply no longer true, which is why none of the
 * data-integrity rules already in this suite caught it. They ask whether a
 * number was measured, not whether it still holds.
 *
 * THE RULE. Every file that reads a cache and serves it must also compare a
 * stored time against `Date.now()`. Derived structurally: a file is in scope
 * because it calls `localStorage.getItem`, not because of anything it says.
 *
 * `components/scanner/scan-cache.ts` is the model — it had `isCacheValid()` and
 * removed expired entries before any of this was written. It is the CSP wheel
 * scanner's cache, the most consequential one in the app, and it was the one
 * already done right.
 *
 * Run: node scripts/check-cache-ttl.ts
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

const ROOT = join(import.meta.dirname, "..")
const rel = (p: string) => p.slice(ROOT.length + 1).replace(/\\/g, "/")

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e.startsWith(".")) continue
    const full = join(dir, e)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(full)) out.push(full)
  }
  return out
}

/** Comment-strip, so an example in a doc block is never mistaken for code. */
const code = (src: string) =>
  src.replace(/(?<!\*)\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m, pre) =>
    m.startsWith("/*") ? " " : (pre ?? ""),
  )

const SOURCES = [...walk(join(ROOT, "lib")), ...walk(join(ROOT, "components")), ...walk(join(ROOT, "app"))]

const readers = SOURCES.map((f) => ({ file: rel(f), src: code(readFileSync(f, "utf8")) })).filter((f) =>
  /localStorage\.getItem\s*\(/.test(f.src),
)

// SIX files call localStorage.getItem, not the nine defects listed above, and
// the difference is the point: the six *-scanner.tsx components now go through
// lib/scanner-cache.ts and no longer touch localStorage themselves. Six copies
// of an expiry rule became one, so six potential defects became one file to get
// right.
//
//   lib/ccpi/cache.ts                      CCPI snapshot, 4h
//   lib/scanner-cache.ts                   shared scanner helper, 30m
//   components/scanner/scan-cache.ts       CSP wheel scanner — the model
//   components/scanner/use-wheel-scanner.ts  reads raw only to log; serves via
//                                            loadFromCache, which expires
//   components/market-sentiment.tsx        Fear & Greed, 4h
//   components/social-sentiment.tsx        social sentiment, 4h
const EXPECTED_READERS = 6
check(
  "scope: every file reading localStorage is in scope",
  readers.length === EXPECTED_READERS,
  `${readers.length} file(s), want ${EXPECTED_READERS} — ${readers.map((r) => r.file).join(", ")}`,
)

/**
 * Evidence that this file compares a stored time against the clock.
 *
 * Deliberately broad — the nine defects differed in how they stored time (ISO
 * string, epoch number, locale string) and the fixes differ accordingly. What
 * they have in common after the fix is a comparison against `Date.now()` or a
 * named validity helper. A file doing something cleverer will still match one
 * of these; a file doing nothing will match none.
 */
const COMPARES_AGE =
  /Date\.now\(\)\s*-|-\s*Date\.now\(\)|Date\.parse\(|isCacheValid\s*\(|loadScanFromCache\s*\(|loadFromCache\s*\(|hasFreshCache\s*\(/

const unguarded = readers.filter((r) => !COMPARES_AGE.test(r.src)).map((r) => r.file)

check(
  "every cache reader compares a stored time against the clock",
  unguarded.length === 0,
  unguarded.length === 0
    ? `${readers.length} reader(s) all check age`
    : `${unguarded.join(", ")} — serve a cached reading without checking whether it is still current`,
)

// A guard whose evidence pattern stops matching would pass every file silently,
// which is this suite's own recurring defect (see CHECK_INTEGRITY.md). Assert
// that the pattern still recognises something.
const guarded = readers.length - unguarded.length
check(
  "scope: the age-check pattern still matches",
  guarded >= EXPECTED_READERS,
  `${guarded} reader(s) matched — if this collapses, the pattern broke, not the code`,
)

console.log(
  failures === 0
    ? `\nAll cache-TTL checks passed — ${readers.length} cache reader(s), all age-checked.`
    : `\n${failures} cache-TTL check(s) FAILED.`,
)
process.exit(failures === 0 ? 0 : 1)
