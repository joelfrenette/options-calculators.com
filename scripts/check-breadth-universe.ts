/**
 * The breadth universe is the size it says it is, and every absence is recorded.
 *
 * Run: node scripts/check-breadth-universe.ts
 *
 * WHY THIS FILE EXISTS. Breadth is "% of THIS list above its own 200-DMA", so
 * the list IS the denominator. A name that quietly stops resolving upstream is
 * excluded from every window from then on, and the percentage goes on looking
 * exactly as reasonable as before — there is no value that looks wrong when the
 * denominator moves.
 *
 * MMC is the case. Polygon has 404'd it since 2026-01-13. It was deliberately
 * left in the array to avoid changing what the percentage was a percentage of —
 * **and that did not work, because the denominator had already changed.**
 * `sample_size` had been reading 99 against a `universe_size` of 100 on every
 * row for seven months. Keeping the constant did not preserve the denominator;
 * it only stopped the denominator being visible. The owner's decision
 * (2026-08-13) was to drop to 99 and state it.
 *
 * So the size is asserted against the RECORD of removals rather than against a
 * bare baseline: `BREADTH_UNIVERSE.length + BREADTH_UNIVERSE_REMOVED.length`
 * must equal the original 100. A name can only leave the list by being written
 * down, which is the difference between a shrinking universe and a typo.
 */

import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  BREADTH_UNIVERSE,
  BREADTH_UNIVERSE_AS_OF,
  BREADTH_UNIVERSE_REMOVED,
} from "../lib/breadth-universe.ts"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

/** The universe as originally constructed. Members leave only via the record. */
const ORIGINAL_SIZE = 100

check(
  `scope: ${BREADTH_UNIVERSE.length} member(s) in the universe`,
  BREADTH_UNIVERSE.length > 50,
  `${BREADTH_UNIVERSE.length} — a collapsed list would make every breadth reading meaningless while still producing a percentage`,
)

check(
  "every absence from the original 100 is recorded with a reason",
  BREADTH_UNIVERSE.length + BREADTH_UNIVERSE_REMOVED.length === ORIGINAL_SIZE,
  `${BREADTH_UNIVERSE.length} listed + ${BREADTH_UNIVERSE_REMOVED.length} recorded as removed = ${
    BREADTH_UNIVERSE.length + BREADTH_UNIVERSE_REMOVED.length
  }, expected ${ORIGINAL_SIZE} — a name cannot leave silently`,
)

for (const r of BREADTH_UNIVERSE_REMOVED) {
  check(
    `${r.ticker}: removal carries a reason and a date`,
    typeof r.reason === "string" && r.reason.length > 10 && /^\d{4}-\d{2}-\d{2}$/.test(r.since),
    `${r.since} — ${r.reason}`,
  )
  check(
    `${r.ticker}: is actually out of the universe`,
    !BREADTH_UNIVERSE.includes(r.ticker),
    "recorded as removed while still in the list is the worst of both",
  )
}

check("no ticker appears twice", new Set(BREADTH_UNIVERSE).size === BREADTH_UNIVERSE.length)
check(
  "every ticker looks like a ticker",
  BREADTH_UNIVERSE.every((t) => /^[A-Z][A-Z.]{0,5}$/.test(t)),
  BREADTH_UNIVERSE.filter((t) => !/^[A-Z][A-Z.]{0,5}$/.test(t)).join(", ") || "all well-formed",
)
check(
  "the as-of date travels with the list",
  /^\d{4}-\d{2}$/.test(BREADTH_UNIVERSE_AS_OF),
  BREADTH_UNIVERSE_AS_OF,
)

// ---------------------------------------------------------------------------
// Nothing publishes a hardcoded universe size. The whole point of dropping to
// 99 is that the number a reader sees is the length of the actual list.
// ---------------------------------------------------------------------------

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(e.name)) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(e.name)) out.push(full)
  }
  return out
}

const consumers = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "components"))]
check(
  `scope: ${consumers.length} file(s) scanned for a hardcoded universe size`,
  consumers.length > 50,
  `${consumers.length} — a collapsed walk must fail, not pass`,
)

const offenders: string[] = []
for (const file of consumers) {
  const src = readFileSync(file, "utf8")
  // `universeSize: 100` or `universe_size: 99` written as a literal rather than
  // derived from the array.
  const m = /universe_?[Ss]ize:\s*(\d+)/.exec(src)
  if (m) offenders.push(`${file.slice(ROOT.length + 1).replace(/\\/g, "/")}: ${m[0]}`)
}
check(
  "no route or component writes the universe size as a literal",
  offenders.length === 0,
  offenders.join("; ") || "all derive it from BREADTH_UNIVERSE.length",
)

if (failures > 0) {
  console.error(`\n${failures} breadth-universe check(s) failed.`)
  process.exit(1)
}
