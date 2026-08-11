/**
 * No exported symbol in `lib/` is referenced only by its own file.
 *
 * Run: node scripts/check-dead-exports.ts
 *
 * WHY THIS FILE EXISTS. Phase 7.3 asks which of the audit's lenses can honestly
 * become a rule. This is the one that can, and it is the highest-yield lens the
 * audit has that no check covers: **dead code is where defects wait, and three
 * of the audit's P1s were dormant when found.**
 *
 *   - P6-72: `lib/grok-market-data.ts` held four helpers ending `return value ||
 *     30 / 1.2 / 55 / 32` — P6-34's decision bypassed in a module nobody had
 *     re-read — and one of them labelled an LLM answer `status: "live"`.
 *   - P6-81: a second, uncalled Fear & Greed implementation inside
 *     `/api/market-sentiment` counted one instrument three times, a worse
 *     version of the defect its live sibling had been fixed for that morning.
 *   - P7-4: `validateCCPICalculation` returned `true` — "valid" — for a
 *     composite it could not compute, and nothing called it.
 *
 * **Dead code makes no claims, so no provenance rule can see it.** Rules 1-13
 * ask whether a label matches the code behind it; an unreferenced function has
 * no label and no user, and passes every one of them. P6-82 swept for this by
 * hand and deleted four exports. A hand sweep rots in a release, which is the
 * same argument that produced check-provenance.ts in the first place.
 *
 * WHAT IT CANNOT DO, stated here rather than left implicit. It answers "is this
 * symbol referenced anywhere else in the repo", nothing more. It cannot tell a
 * dead export from a live one that is *wrong*, and it cannot see dead code
 * inside a live function — P6-81's implementation was a module-level function in
 * a route file, which this rule does not scope (route files legitimately export
 * only their handlers, so every internal helper would look dead). **The lens is
 * wider than the rule; the rest is recorded as a limit in AUDIT_BACKLOG rather
 * than pretended away.**
 *
 * SCOPE IS STRUCTURAL (P6-75). The file set is `walk(lib/)` filtered on `.ts` —
 * file layout, not a keyword — and both the file count and the export count are
 * asserted (P6-77), so a scope collapse fails loudly instead of passing quietly.
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const rel = (p: string) => relative(ROOT, p).split(sep).join("/")

/**
 * Floors, not exact counts: `lib/` grows and shrinks legitimately. They exist so
 * that a scope collapse — a walk that starts returning nothing — cannot report
 * the same PASS line as a clean run.
 */
const MIN_LIB_FILES = 40
const MIN_EXPORTS = 200

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

function walk(dir: string, match: (p: string) => boolean): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    if (e === "node_modules" || e === ".next" || e === ".git" || e === ".claude") continue
    const full = join(dir, e)
    if (statSync(full).isDirectory()) out.push(...walk(full, match))
    else if (match(full)) out.push(full)
  }
  return out
}

const stripComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " " + "\n".repeat((m.match(/\n/g) || []).length))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")

const LIB_FILES = walk(join(ROOT, "lib"), (p) => p.endsWith(".ts") && !p.endsWith(".d.ts"))

/** Every file that could reference a lib symbol. */
const ALL_SOURCE = [
  ...walk(join(ROOT, "app"), (p) => p.endsWith(".ts") || p.endsWith(".tsx")),
  ...walk(join(ROOT, "components"), (p) => p.endsWith(".ts") || p.endsWith(".tsx")),
  ...walk(join(ROOT, "lib"), (p) => p.endsWith(".ts")),
  ...walk(join(ROOT, "scripts"), (p) => p.endsWith(".ts")),
  ...walk(join(ROOT, "hooks"), (p) => p.endsWith(".ts") || p.endsWith(".tsx")),
]

check(
  `scope: lib/ resolves to a plausible file set`,
  LIB_FILES.length >= MIN_LIB_FILES,
  `${LIB_FILES.length} files, floor ${MIN_LIB_FILES}`,
)

/**
 * Exported value names. Types and interfaces are excluded on purpose: an unused
 * exported type is a documentation smell, not a place a defect can hide, and
 * `import type` erasure makes reference counting unreliable for them.
 */
const EXPORT_DECL =
  /^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm

type Sym = { name: string; file: string; line: number }
const symbols: Sym[] = []

for (const f of LIB_FILES) {
  const src = stripComments(readFileSync(f, "utf8"))
  const lines = src.split("\n")
  lines.forEach((line, i) => {
    EXPORT_DECL.lastIndex = 0
    const m = EXPORT_DECL.exec(line + "\n")
    if (m) symbols.push({ name: m[1], file: f, line: i + 1 })
  })
}

check(
  `scope: ${symbols.length} exported values found in lib/`,
  symbols.length >= MIN_EXPORTS,
  `${symbols.length} exports, floor ${MIN_EXPORTS}`,
)

/**
 * Source of every candidate referrer.
 *
 * **This file is excluded from its own scan**, and that is not housekeeping.
 * The `KNOWN_DEAD` list below names all 51 symbols as string literals, so on the
 * first run every one of them was "referenced" — by the allowlist recording that
 * they are unreferenced — and the check reported a clean `lib/`. It is the
 * P6-75 shape in a new place: **a check whose scope is decided by content can be
 * switched off by writing the right content, including its own.** The defensive
 * NOTE line at the bottom is the only reason it surfaced in one run rather than
 * silently passing forever.
 */
const SELF = join(ROOT, "scripts", "check-dead-exports.ts")
const sourceByFile = new Map<string, string>()
for (const f of ALL_SOURCE) {
  if (f === SELF) continue
  sourceByFile.set(f, stripComments(readFileSync(f, "utf8")))
}

const dead: { key: string; where: string }[] = []
for (const s of symbols) {
  const word = new RegExp(`\\b${s.name.replace(/\$/g, "\\$")}\\b`)
  let referenced = false
  for (const [f, src] of sourceByFile) {
    if (f === s.file) continue
    if (word.test(src)) {
      referenced = true
      break
    }
  }
  if (!referenced) dead.push({ key: `${rel(s.file)}:${s.name}`, where: `${rel(s.file)}:${s.line} ${s.name}` })
}

// ---------------------------------------------------------------------------
// The ratchet, and why it is a ratchet rather than a zero.
// ---------------------------------------------------------------------------
//
// Turning this on as `dead.length === 0` would have required deleting 51
// exports in the commit that introduced the rule — a large, unreviewable sweep
// touching 20 modules, several of them on the auth and spend-control paths.
// The alternative usually taken, an exception list, is a rule switched off.
//
// So: the KNOWN set below is the measured state on 2026-08-11. **Anything not in
// it fails.** Deleting an entry never fails, so the debt can only shrink, and
// the list's own size is asserted so it cannot be quietly padded. This is
// honest in the way 7.3 asks for — it does not claim `lib/` is clean; it claims
// `lib/` does not get dirtier, and it says how dirty it currently is.
//
// Keyed on file:symbol, never file:line:symbol — a line number moves when
// anything above it is edited, and a guard that fires on unrelated edits gets
// deleted rather than fixed.

const KNOWN_DEAD: ReadonlySet<string> = new Set([
  "lib/ai-providers.ts:streamWithFallback",
  "lib/ai-providers.ts:getProviderStatus",
  "lib/allocation.ts:CCPI_ALLOCATION_BANDS",
  "lib/allocation.ts:SENTIMENT_ALLOCATION_BANDS",
  "lib/allocation.ts:PANIC_EUPHORIA_ALLOCATION_BANDS",
  "lib/api-keys.ts:isBudgetKilled",
  "lib/api-keys.ts:getKeyOverride",
  "lib/api-keys.ts:isOverridden",
  "lib/api-keys.ts:isKeyConfigured",
  "lib/api-usage.ts:recordApiUsage",
  "lib/api-usage.ts:getServiceUsage",
  "lib/auth.ts:isPasswordHashed",
  "lib/auth.ts:getSession",
  "lib/breadth-backtest.ts:SURVIVORSHIP_WARNING",
  "lib/budget-guard.ts:getDailyHardStop",
  "lib/budget-guard.ts:getMonthlyHardStop",
  "lib/budget-guard.ts:providerToKey",
  "lib/budget-guard.ts:utcDay",
  "lib/budget-guard.ts:utcMonth",
  "lib/budget-guard.ts:isBudgetGuardTrippedSync",
  "lib/ccpi/api.ts:cacheCCPIToServer",
  "lib/ccpi/cache.ts:clearCCPICache",
  "lib/ccpi/cache.ts:loadHistoryFromCache",
  "lib/ccpi/cache.ts:saveSummaryToCache",
  "lib/ccpi/cache.ts:loadSummaryFromCache",
  "lib/ccpi/cache.ts:isCacheFresh",
  "lib/ccpi/calculations.ts:getBarColor",
  "lib/ccpi/calculations.ts:getRegimeColor",
  "lib/ccpi/calculations.ts:getIndicatorStatus",
  "lib/ccpi/logger.ts:logCCPIDataLoaded",
  "lib/ccpi/logger.ts:logPillarBreakdown",
  "lib/ccpi/logger.ts:logCacheOperation",
  "lib/ccpi/logger.ts:logExecutiveSummary",
  "lib/ccpi/progress.ts:startProgressSimulation",
  "lib/ccpi/progress.ts:completeProgress",
  "lib/key-store.ts:reloadKeyOverrides",
  "lib/login-rate-limit.ts:getMaxFailures",
  "lib/login-rate-limit.ts:getWindowMinutes",
  "lib/market-snapshot.ts:CHART_TICKERS",
  "lib/market-snapshot.ts:STORED_TICKERS",
  "lib/market-snapshot.ts:VIX_TERM_SERIES",
  "lib/market-snapshot.ts:computeVixTermStructure",
  "lib/quiver.ts:QUIVER_DATASETS",
  "lib/quiver.ts:isQuiverConfigured",
  "lib/sentiment-sources.ts:getTwitterSentiment",
  "lib/sentiment-sources.ts:getFinnhubNewsSentiment",
  "lib/serper-finance.ts:fetchSerperQuote",
  "lib/serper-finance.ts:fetchSerperNews",
  "lib/serper-finance.ts:isSerperAvailable",
  "lib/unified-ai-fallback.ts:fetchWithAIFallback",
  "lib/yoy.ts:monthsBack",
])

const KNOWN_DEAD_BASELINE = 51

check(
  `the known-dead list still holds ${KNOWN_DEAD_BASELINE} entries`,
  KNOWN_DEAD.size === KNOWN_DEAD_BASELINE,
  `${KNOWN_DEAD.size} — if you deleted an export, drop its line AND this number together`,
)

const fresh = dead.filter((d) => !KNOWN_DEAD.has(d.key))
check(
  "no NEW unreferenced export has appeared in lib/",
  fresh.length === 0,
  fresh.length
    ? fresh.map((d) => d.where).join(", ")
    : `${symbols.length} exports across ${LIB_FILES.length} files; ${dead.length} known-dead, 0 new`,
)

const cleared = [...KNOWN_DEAD].filter((k) => !dead.some((d) => d.key === k))
if (cleared.length) {
  console.log(
    `NOTE  ${cleared.length} known-dead export(s) are now referenced or deleted — ` +
      `remove them from KNOWN_DEAD and lower the baseline: ${cleared.join(", ")}`,
  )
}

if (failures > 0) {
  console.error(`\n${failures} dead-export check(s) failed.`)
  process.exit(1)
}
