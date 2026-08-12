/**
 * No scored CCPI input is assembled with a numeric default.
 *
 * Run: node scripts/check-ccpi-defaults.ts
 *
 * WHY THIS FILE EXISTS. P7-10, P7-17 and P7-18 removed twenty-two fabricated
 * constants from the `/api/ccpi` assembly layer — `tedSpread ?? 0.25`,
 * `dxyIndex ?? 103`, `nvidiaMomentum ?? 50`, `qqqBelowSMA20 || false`, and the
 * rest. Every one of them reached the screen as a measurement, and the QQQ pair
 * reached the SCORE as a calm reading.
 *
 * A re-verification pass then put one back — `tedSpread ?? 0.25` — and ran the
 * whole suite. **Nothing failed.** Not the scoring tests, which exercise the
 * pure function and would still see a number arrive; not check-provenance,
 * which reads UI copy. Twenty-one instances fixed and no guard against the
 * twenty-second.
 *
 * That is the gap this closes, and it is worth being precise about why the
 * other checks could not: `computeMacroPillar(d, tiers)` is given a number and
 * has no way to know the number was invented one function earlier. The tier
 * says "baseline", which correctly excludes it from SCORING — and the display
 * reads the raw value, which is where the fabrication lands. **The defect lives
 * in the gap between the two, so it has to be checked where it is written.**
 *
 * WHY THIS IS A RATCHET AND NOT A SWEEP. AUDIT_PLAN 7.4 says plainly: "Do not
 * sweep for `|| <const>` — it found the early Phase 6 defects and missed every
 * one of the fifty-one." That is guidance about DISCOVERY, and it is right: as
 * a search this pattern is nearly worthless. As a regression guard over a
 * known, enumerated field set it is the opposite — it cannot find anything new,
 * and it cannot let a fixed one come back.
 *
 * SCOPE IS STRUCTURAL (P6-75) and asserted (P6-77): the field list is derived
 * from the WEIGHTS tables in lib/ccpi/scoring.ts — the same tables the scoring
 * core uses — so an indicator is guarded the moment it is given a weight, and
 * the count is checked so the list cannot quietly shrink.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

const scoringSrc = readFileSync(join(ROOT, "lib", "ccpi", "scoring.ts"), "utf8")
const routeSrc = readFileSync(join(ROOT, "app", "api", "ccpi", "route.ts"), "utf8")

/** Every key named in a WEIGHTS table — the scored indicators, by definition. */
const weightKeys = [...scoringSrc.matchAll(/\{\s*key:\s*"([A-Za-z0-9]+)"/g)].map((m) => m[1])
const uniqueKeys = [...new Set(weightKeys)]

const EXPECTED_KEYS = 29
check(
  `scope: ${uniqueKeys.length} scored indicator(s) derived from the WEIGHTS tables`,
  uniqueKeys.length === EXPECTED_KEYS,
  `${uniqueKeys.length}, expected ${EXPECTED_KEYS} — a weight was added or removed; update deliberately`,
)

/**
 * The four SMA/Bollinger weights score a PAIR of inputs whose field names differ
 * from the weight key (`qqqSMA20` scores `qqqBelowSMA20` + `qqqSMA20Proximity`).
 * Expanded explicitly, and the expansion's size is asserted too.
 */
const PAIR_FIELDS: Record<string, string[]> = {
  qqqSMA20: ["qqqBelowSMA20", "qqqSMA20Proximity"],
  qqqSMA50: ["qqqBelowSMA50", "qqqSMA50Proximity"],
  qqqSMA200: ["qqqBelowSMA200", "qqqSMA200Proximity"],
  qqqBollinger: ["qqqBelowBollinger", "qqqBollingerProximity"],
}
check(
  "scope: the 4 pair weights expand to 8 input fields",
  Object.keys(PAIR_FIELDS).length === 4 && Object.values(PAIR_FIELDS).flat().length === 8,
)

const guardedFields = uniqueKeys.flatMap((k) => PAIR_FIELDS[k] ?? [k])

/**
 * A numeric or boolean literal default on an assembly line for a scored field.
 * Matches `field: <anything> ?? 3.5`, `field: <anything> || 0` and
 * `field: <anything> || false` — the three forms every removed instance took.
 */
const offenders: string[] = []
for (const field of guardedFields) {
  const re = new RegExp(`^\\s*${field}:\\s*[^,\\n]*?(?:\\?\\?|\\|\\|)\\s*(-?\\d+(?:\\.\\d+)?|false|true)\\s*,?\\s*$`, "gm")
  for (const m of routeSrc.matchAll(re)) {
    offenders.push(`${field} → ${m[0].trim()}`)
  }
}

check(
  `no scored CCPI input carries a literal default (${guardedFields.length} field(s) checked)`,
  offenders.length === 0,
  offenders.length ? offenders.join(" | ") : `${guardedFields.length} fields, all null-through`,
)

if (failures > 0) {
  console.error(`\n${failures} CCPI-default check(s) failed.`)
  process.exit(1)
}
