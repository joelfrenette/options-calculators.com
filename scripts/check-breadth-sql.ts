/**
 * The two breadth definitions cannot drift apart again.
 *
 * Run: node scripts/check-breadth-sql.ts
 *
 * WHY THIS FILE EXISTS (P7-55). `compute_breadth` (the daily cron) and
 * `compute_breadth_range` (history and backfills) both answer "% of the universe
 * above its 200-day average" from the same table, and they disagreed by one
 * member for seven months.
 *
 * The range function windows correctly by date. The daily function ranked
 * `row_number() ... order by day desc` and qualified any ticker with 200 stored
 * rows **regardless of when those rows were** — so delisted MMC (1,111 rows
 * ending 2026-01-13) qualified on every run, its January close of 182.70
 * compared against its own January 200-day average of 205.44, voting "below" in
 * a reading published for August. A permanent one-way drag on a live money
 * surface.
 *
 * **The disagreement was in the API response the whole time**: `/api/breadth`
 * returned `sample: 99` for every historical day and `sampleSize: 100` for
 * today, in one payload. Nobody read down the column.
 *
 * WHAT THIS CHECK CAN AND CANNOT DO, stated plainly. It reads the migration
 * SQL as text. **It cannot run the database** — no check script here can, and
 * pretending otherwise would be the "assertion that cannot fail" this project
 * has caught itself writing four times. What it pins is that the freshness and
 * span conditions are still WRITTEN, and that nobody re-adds a qualification
 * rule with no date constraint. The live numbers were verified by probing
 * production after applying, and that evidence lives in the migration header.
 */

import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const MIGRATIONS = join(ROOT, "supabase", "migrations")

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

/**
 * The LATEST definition of each function wins, exactly as it does in Postgres:
 * migrations replay in order, so the last file to define `compute_breadth` is
 * the one running. Reading every file and asserting over all of them would fail
 * on the superseded 0010 — a check that cannot tolerate its own history is one
 * somebody deletes.
 */
const files = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()

check(
  `scope: ${files.length} migration file(s)`,
  files.length >= 10,
  `${files.length} — a collapsed read must fail, not pass`,
)

function latestDefinitionOf(fnName: string): { file: string; body: string } | null {
  let found: { file: string; body: string } | null = null
  for (const f of files) {
    const src = readFileSync(join(MIGRATIONS, f), "utf8")
    const re = new RegExp(`create or replace function public\\.${fnName}\\b[\\s\\S]*?\\$function\\$;`, "i")
    const m = re.exec(src)
    if (m) found = { file: f, body: m[0] }
  }
  return found
}

const daily = latestDefinitionOf("compute_breadth")
const range = latestDefinitionOf("compute_breadth_range")

check("a definition of compute_breadth exists", daily !== null, daily?.file ?? "none found")
check("a definition of compute_breadth_range exists", range !== null, range?.file ?? "none found")

if (daily) {
  check(
    "compute_breadth requires a RECENT latest row",
    /latest_day\s*>=\s*l\.d\s*-\s*\d+/.test(daily.body),
    `${daily.file} — without it, a delisted ticker qualifies forever on its last 200 rows`,
  )
  check(
    "compute_breadth bounds the span of its 200 rows",
    /oldest_of_200\s*>=\s*l\.d\s*-\s*\d+/.test(daily.body),
    "a ticker that goes dark and resumes is fresh, but its 200-day average would straddle the gap",
  )
  check(
    "compute_breadth still requires 200 observations",
    /n\s*>=\s*200/.test(daily.body),
    "the freshness rule replaces nothing; a short window is still not a 200-day average",
  )
  check(
    "universe_size reports the qualified set, not every ticker ever stored",
    !/count\(distinct ticker\)::int from eligible/.test(daily.body),
    "counting rows in the table is how a delisted member stayed in the denominator",
  )
  check(
    "index ETFs stay excluded from the constituent set",
    /ticker not in \('SPY', 'QQQ'\)/.test(daily.body),
    "0012's fix must survive 0013 — a later definition silently drops an earlier one",
  )
}

if (range) {
  check(
    "compute_breadth_range still windows by date",
    /rows between 199 preceding and current row/.test(range.body),
    `${range.file} — this is the definition that was always right`,
  )
  check(
    "compute_breadth_range still requires 200 observations",
    /n\s*>=\s*200/.test(range.body),
  )
}

/**
 * The two must agree about who is eligible. They are separate SQL bodies, which
 * is the structural reason they were able to disagree at all; the honest thing
 * a text check can assert is that the exclusion list matches.
 */
if (daily && range) {
  const eligibilityOf = (body: string) => /ticker not in \(([^)]*)\)/.exec(body)?.[1]?.replace(/\s+/g, "") ?? null
  check(
    "both functions exclude the same tickers",
    eligibilityOf(daily.body) !== null && eligibilityOf(daily.body) === eligibilityOf(range.body),
    `daily ${eligibilityOf(daily.body)} vs range ${eligibilityOf(range.body)}`,
  )
}

if (failures > 0) {
  console.error(`\n${failures} breadth-SQL check(s) failed.`)
  process.exit(1)
}
