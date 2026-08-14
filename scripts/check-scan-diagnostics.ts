/**
 * Every scan bucket has a label, and every label has a bucket.
 *
 * Run: node scripts/check-scan-diagnostics.ts
 *
 * WHY THIS FILE EXISTS (P7-53). The Step 3 scan built its rejection and skip
 * buckets as an object literal, and the notice card rendered their names as a
 * chain of `{reason === "x" && "…"}` expressions in another file. Nothing
 * connected the two, and BOTH directions were already broken:
 *
 *   - A bucket with no label rendered an EMPTY heading beside a live count. JSX
 *     `&&` chains have no `else`, so the failure mode is a blank space.
 *   - A label with no bucket never rendered. `fundamentalsIncomplete` had a
 *     written, carefully-worded label and was unreachable, because it is a
 *     `failedFilters` tag and was never a bucket key.
 *
 * The second one had teeth: a ticker whose ROE could not be computed went into
 * the `roe` bucket, so the notice asserted **"ROE below Min ROE %"** about a
 * company whose earnings never reported — a measured claim about an unmeasured
 * thing, which is the audit's first failure shape. P6-24 had fixed that exact
 * sentence in the log line and left the bucket pointing at the wrong label.
 *
 * SCOPE IS STRUCTURAL (P6-75). The bucket keys are read from the SCAN's own
 * source — the `emptyBuckets(...)` call sites and every `Buckets.<key>.push`
 * in the file — not from the label map, because reading the map and comparing
 * it to itself is the shape that made `check-dead-exports` report a clean `lib/`.
 * Both set sizes are asserted (P6-77).
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { REJECTION_REASONS, SKIP_REASONS, emptyBuckets } from "../components/scanner/scan-diagnostics.ts"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const SCAN = "components/scanner/fundamental-scan.ts"
const NOTICE = "components/scanner/scanner-notices.tsx"

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

const scanSrc = readFileSync(join(ROOT, SCAN), "utf8")
const noticeRaw = readFileSync(join(ROOT, NOTICE), "utf8")

/**
 * ONE alternation pass, ordered by position — never block-then-line, which eats
 * a line comment containing a glob path and everything after it.
 */
const stripComments = (src: string): string =>
  src.replace(/(?<!\*)\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m, pre) =>
    m.startsWith("/*") ? " " + "\n".repeat((m.match(/\n/g) || []).length) : (pre ?? ""),
  )

/**
 * FOURTH INSTANCE of the rule already in the tooling notes: **a check that names
 * its own findings will match itself.** The first run of "the notice card no
 * longer hardcodes reason names" FAILED — on the doc comment inside
 * `scanner-notices.tsx` that explains the `reason === "…"` chain was removed.
 * The sentence recording the fix was the only remaining instance of the defect.
 *
 * Comments are stripped before the notice card is scanned, so prose describing
 * the old shape can stay where it is useful.
 */
const noticeSrc = stripComments(noticeRaw)

const EXPECTED_REJECTION_REASONS = 7
const EXPECTED_SKIP_REASONS = 5

const rejectionKeys = Object.keys(REJECTION_REASONS)
const skipKeys = Object.keys(SKIP_REASONS)

check(
  `scope: ${rejectionKeys.length} rejection reason(s)`,
  rejectionKeys.length === EXPECTED_REJECTION_REASONS,
  rejectionKeys.join(", "),
)
check(`scope: ${skipKeys.length} skip reason(s)`, skipKeys.length === EXPECTED_SKIP_REASONS, skipKeys.join(", "))

// ---------------------------------------------------------------------------
// Every label is non-empty and distinct. A blank label is the exact failure the
// old `&&` chain produced silently.
// ---------------------------------------------------------------------------

for (const [key, label] of [...Object.entries(REJECTION_REASONS), ...Object.entries(SKIP_REASONS)]) {
  check(`${key} has a non-empty label`, typeof label === "string" && label.trim().length > 0, label)
}
const allLabels = [...Object.values(REJECTION_REASONS), ...Object.values(SKIP_REASONS)]
check(
  "no two reasons share a label",
  new Set(allLabels).size === allLabels.length,
  `${new Set(allLabels).size} distinct of ${allLabels.length}`,
)

// ---------------------------------------------------------------------------
// The scan's bucket keys, read from the scan. Derived from the `.push` call
// sites — a structural position — so a bucket that stops being written to, or
// one written to under a name nobody defined, is visible here.
// ---------------------------------------------------------------------------

const pushed = (obj: string): string[] => [
  ...new Set([...scanSrc.matchAll(new RegExp(`\\b${obj}\\.(\\w+)\\.push\\(`, "g"))].map((m) => m[1])),
]

const rejectionPushed = pushed("rejectionBuckets")
const skipPushed = pushed("skipBuckets")

check(
  `scope: ${rejectionPushed.length} rejection bucket(s) are written to in ${SCAN}`,
  rejectionPushed.length > 0,
  rejectionPushed.join(", ") || "none — the derivation collapsed, which is not a clean run",
)
check(
  `scope: ${skipPushed.length} skip bucket(s) are written to in ${SCAN}`,
  skipPushed.length > 0,
  skipPushed.join(", ") || "none — the derivation collapsed, which is not a clean run",
)

for (const key of rejectionPushed) {
  check(
    `rejectionBuckets.${key} has a label — an unlabelled bucket renders a blank heading`,
    rejectionKeys.includes(key),
    rejectionKeys.includes(key) ? REJECTION_REASONS[key as keyof typeof REJECTION_REASONS] : "NOT IN REJECTION_REASONS",
  )
}
for (const key of skipPushed) {
  check(
    `skipBuckets.${key} has a label`,
    skipKeys.includes(key),
    skipKeys.includes(key) ? SKIP_REASONS[key as keyof typeof SKIP_REASONS] : "NOT IN SKIP_REASONS",
  )
}

/**
 * The other direction. `fundamentalsIncomplete` is the reason this half exists:
 * a label nobody can reach is indistinguishable from one that renders fine,
 * because neither produces an error.
 *
 * `thinFinancials` is a legitimate exception and is named rather than pattern-
 * matched: it is a WARNING pushed alongside a ticker that continues to be
 * scanned, so it is written to in the same file but never in a `return null`
 * path. It still has to be a real key with a real label — which is what the
 * loops above assert — so exempting it here costs nothing.
 */
const UNREACHABLE_OK: string[] = []
for (const key of [...rejectionKeys, ...skipKeys]) {
  if (UNREACHABLE_OK.includes(key)) continue
  const written = rejectionPushed.includes(key) || skipPushed.includes(key)
  check(
    `"${key}" is actually written to by the scan — a label with no bucket never renders`,
    written,
    written ? "" : "defined and unreachable, which is how fundamentalsIncomplete hid",
  )
}

// ---------------------------------------------------------------------------
// The scan builds its buckets FROM the maps, so a key cannot be invented in the
// object literal that used to live there.
// ---------------------------------------------------------------------------

check(
  "the scan derives its rejection buckets from REJECTION_REASONS",
  /rejectionBuckets\s*=\s*emptyBuckets\(REJECTION_REASONS\)/.test(scanSrc),
  "a hand-written object literal is how the two sides drifted apart",
)
check(
  "the scan derives its skip buckets from SKIP_REASONS",
  /skipBuckets\s*=\s*emptyBuckets\(SKIP_REASONS\)/.test(scanSrc),
)
check(
  "emptyBuckets produces one empty array per label",
  (() => {
    const b = emptyBuckets(REJECTION_REASONS)
    return (
      Object.keys(b).length === rejectionKeys.length &&
      Object.values(b).every((v) => Array.isArray(v) && v.length === 0)
    )
  })(),
)

// ---------------------------------------------------------------------------
// The notice card renders from the maps rather than re-listing them.
// ---------------------------------------------------------------------------

check(
  "the notice card imports the shared reason maps",
  /from "\.\/scan-diagnostics"/.test(noticeSrc),
  NOTICE,
)
check(
  "the notice card no longer hardcodes reason names",
  !/reason === "\w+" &&/.test(noticeSrc),
  (/reason === "(\w+)"/.exec(noticeSrc)?.[0] ?? "none") + " — a per-reason literal is the drift this check removes",
)
check(
  "an unlabelled bucket falls back to its raw key rather than rendering blank",
  /labels\[reason\]\s*\?\?\s*reason/.test(noticeSrc),
  "blank is invisible; an ugly key is not",
)

// ---------------------------------------------------------------------------
// P7-51: no price is a skip, and it must not reach the row builder.
// ---------------------------------------------------------------------------

check(
  "a ticker with no usable price is skipped before any filter runs (P7-51)",
  /!Number\.isFinite\(currentPrice\)\s*\|\|\s*currentPrice\s*<=\s*0/.test(scanSrc) &&
    /skipBuckets\.noPrice\.push\(/.test(scanSrc),
  "currentPrice 0 used to reach the relaxed table as a $0.00 strike at the clamp's 0.50% floor",
)
check(
  "the no-price guard sits BEFORE the price-cap filter",
  scanSrc.indexOf("skipBuckets.noPrice.push(") < scanSrc.indexOf("rejectionBuckets.priceCap.push("),
  "0 > priceCap is false, so a zero price passes the cap and every filter after it",
)
check(
  "an unknown ROE is not reported as an ROE below the minimum (P7-53)",
  /rejectionBuckets\.fundamentalsIncomplete\.push\(`\$\{ticker\}\(ROE unknown\)`\)/.test(scanSrc),
  "the roe bucket's label makes a measured claim about an unmeasured company",
)
check(
  "an unknown market cap is not reported as a market cap below the minimum",
  /rejectionBuckets\.fundamentalsIncomplete\.push\(`\$\{ticker\}\(market cap unknown\)`\)/.test(scanSrc),
)

if (failures > 0) {
  console.error(`\n${failures} scan-diagnostics check(s) failed.`)
  process.exit(1)
}
