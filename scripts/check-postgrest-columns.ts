/**
 * Every column named in a PostgREST `select=` must exist in the schema.
 *
 * WHAT THIS EXISTS TO STOP. `lib/market-series.ts` asked for
 * `breadth_daily?select=day,pct`. The column is `pct_above_200dma`. PostgREST
 * answers an unknown column with a 400, so `res.ok` was false and
 * `getBreadthHistory` returned null — on every call, since it was written.
 *
 * Its only consumer is the Breadth-divergence Trigger row, which therefore
 * reported `no-data` permanently while 1,069 days of breadth sat in the table.
 * The owner found it in UAT and asked whether the trigger should be removed for
 * want of data. The data was there the whole time.
 *
 * WHY IT SURVIVED. The row's own explanation was CORRECT — "needs 61
 * overlapping days of SPY closes and breadth; have 0" — and the comments around
 * the signal explain at length why `no-data` is expected early on: breadth needs
 * ~280 days of closes before its first point and 60 more for the overlap. That
 * reasoning was sound and had once been true, so the row looked like a known
 * state rather than a fault. **A correct explanation for the wrong failure is
 * harder to catch than no explanation at all**, and no amount of reading the
 * signal code would have found it — the defect was one word in a URL, two files
 * away, in a function whose two sibling call sites had it right.
 *
 * SCOPE. Real tables declared with `create table` in supabase/migrations. VIEWS
 * ARE DELIBERATELY OUT — their columns come from a projection this parser would
 * have to evaluate, and a half-parsed view would produce false failures on
 * correct code, which is how a check gets deleted rather than fixed. The views
 * in use (api_calls_daily, api_usage_monthly, api_spend_daily,
 * api_provider_health) are listed as skipped and counted, so the exemption
 * cannot quietly widen.
 *
 * Run: node scripts/check-postgrest-columns.ts
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

// --------------------------------------------------------------- the schema

const MIGRATIONS = join(ROOT, "supabase", "migrations")
const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(join(MIGRATIONS, f), "utf8"))
  .join("\n")

/** table -> declared columns, from `create table [if not exists] public.<t> (...)`. */
const schema = new Map<string, Set<string>>()
for (const m of sql.matchAll(/create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
  const table = m[1]
  const body = m[2]
    // Strip SQL comments before reading column names, or a commented-out column
    // would be accepted as real.
    .replace(/--[^\n]*/g, "")
  const cols = new Set<string>()
  for (const line of body.split("\n")) {
    const col = /^\s*(\w+)\s+\w/.exec(line)
    // Skip table-level constraints, which parse as a leading keyword.
    if (col && !/^(primary|foreign|unique|check|constraint)$/i.test(col[1])) cols.add(col[1])
  }
  if (cols.size > 0) schema.set(table, cols)
}

// `alter table ... add column` moves columns too — migration 0015 added
// error_class and error_detail to api_calls this way.
for (const m of sql.matchAll(/alter table (?:if exists )?public\.(\w+)([\s\S]*?);/gi)) {
  const cols = schema.get(m[1])
  if (!cols) continue
  for (const add of m[2].matchAll(/add column (?:if not exists\s+)?(\w+)/gi)) cols.add(add[1])
}

const EXPECTED_TABLES = 10
check(
  "scope: the migration parser still finds tables",
  schema.size >= EXPECTED_TABLES,
  `${schema.size} table(s), floor ${EXPECTED_TABLES} — a parser that stops matching would pass every query`,
)

// Views: columns come from a projection, not a declaration. Named so the
// exemption is explicit and countable rather than a silent `catch`.
const VIEWS = new Set(["api_calls_daily", "api_spend_daily", "api_usage_monthly", "api_provider_health"])

// ------------------------------------------------------------- the queries

const SOURCES = [...walk(join(ROOT, "lib")), ...walk(join(ROOT, "app"))]

interface Query {
  file: string
  table: string
  cols: string[]
}
const queries: Query[] = []
for (const f of SOURCES) {
  const src = readFileSync(f, "utf8")
  for (const m of src.matchAll(/rest\/v1\/(\w+)\?[^`"']*?select=([\w,]+)/g)) {
    queries.push({ file: rel(f), table: m[1], cols: m[2].split(",").filter(Boolean) })
  }
}

const EXPECTED_QUERIES = 10
check(
  "scope: PostgREST select queries are still being found",
  queries.length >= EXPECTED_QUERIES,
  `${queries.length} query(s), floor ${EXPECTED_QUERIES}`,
)

const skipped = queries.filter((q) => VIEWS.has(q.table))
const checkable = queries.filter((q) => !VIEWS.has(q.table))

const problems: string[] = []
for (const q of checkable) {
  const cols = schema.get(q.table)
  if (!cols) {
    problems.push(`${q.file}: table "${q.table}" is not declared in supabase/migrations (and is not a listed view)`)
    continue
  }
  for (const c of q.cols) {
    if (!cols.has(c)) problems.push(`${q.file}: ${q.table}.${c} does not exist — PostgREST answers 400, the read returns null`)
  }
}

check(
  "every selected column exists in the schema",
  problems.length === 0,
  problems.length === 0
    ? `${checkable.length} query(s) verified, ${skipped.length} view query(s) skipped`
    : problems.join("; "),
)

console.log(
  failures === 0
    ? `\nAll PostgREST column checks passed — ${checkable.length} query(s) against ${schema.size} declared table(s).`
    : `\n${failures} PostgREST column check(s) FAILED.`,
)
process.exit(failures === 0 ? 0 : 1)
