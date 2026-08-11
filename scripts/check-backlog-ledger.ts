/**
 * Assertions that AUDIT_BACKLOG.md's status record stays machine-readable.
 *
 * Run: node scripts/check-backlog-ledger.ts
 *
 * WHY THIS FILE EXISTS. Phase 7 opens with "work the backlog by severity", and
 * on 2026-08-11 that instruction had no reliable input: closure was recorded in
 * fourteen different vocabularies scattered across 864 lines, the file carried
 * three separate summary lines that disagreed with each other and with the rows,
 * and the four statuses defined in its own header were used by exactly zero rows.
 * P6-66 had already shipped two rows for one finding that contradicted each other.
 *
 * The §STATUS LEDGER is now the single place a status lives. This script keeps it
 * honest in the two ways a script can:
 *
 *   1. COVERAGE, both directions. Every finding ID that appears in a table in this
 *      file has a ledger row, and every ledger row names an ID the file mentions.
 *      A new finding added without a ledger row fails the suite; so does a ledger
 *      row for an ID nobody wrote down.
 *   2. VOCABULARY AND SHAPE. Statuses come from the four the header defines.
 *      No ID is listed twice. Severities are P0-P3 or an explicit em dash.
 *
 * WHAT IT CANNOT DO, stated here rather than left implicit (the standing rule from
 * the Phase 6 synthesis): **it cannot tell whether a status is true.** `fixed` in
 * the ledger means the record says fixed. Nothing here re-reads the code. Phase 7.4
 * confirms an item before working it.
 *
 * SCOPE IS STRUCTURAL, NOT TEXTUAL (P6-75). The finding-ID set is derived from the
 * first cell of every markdown table row in the file — a structural position — never
 * from prose keywords, which is how rule 13 silently stopped covering a file when
 * someone reworded a console.log. The counts are asserted, not merely printed
 * (P6-77): a ledger that quietly stops covering half the findings would otherwise
 * report exactly the same PASS lines as one that covers all of them.
 */

import { readFileSync } from "node:fs"

const BACKLOG = "AUDIT_BACKLOG.md"

/**
 * Baselines. These exist so that a ledger which stops covering findings, or a
 * findings set that quietly shrinks, fails loudly instead of passing quietly.
 * Update them deliberately in the same commit that changes the counts.
 */
const EXPECTED_LEDGER_ROWS = 213
const EXPECTED_OPEN = 42
const EXPECTED_FIXED = 164
const EXPECTED_WONTFIX = 7
const EXPECTED_VERIFIED_OK = 0

/**
 * IDs reachable from a table's first cell. The remainder of the ledger (213 - 203)
 * is sub-items that exist only inside a parent row's prose — E-6a..E-6d, E-7a/b/d,
 * E-8a/c/d. Asserted so that findings cannot quietly stop being table rows.
 */
const EXPECTED_TABLE_IDS = 203

/**
 * Table rows whose first cell is deliberately not a finding ID: they record a piece
 * of work or a triage pass rather than a defect. Listed explicitly and size-asserted
 * so that a NEW unnumbered finding row cannot slip in unnoticed — which is exactly
 * how the P6-89 regression sat in this file for two days with no ID at all.
 */
const NARRATIVE_ROWS = [
  "—",
  "Migrations 0009 + 0010",
  "**Legacy S-item triage**",
]

const VALID_STATUS = new Set(["open", "fixed", "wontfix", "verified-ok"])
const VALID_SEV = new Set(["P0", "P1", "P2", "P3", "—"])

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

const text = readFileSync(BACKLOG, "utf8")
const lines = text.split(/\r?\n/)

// ---------------------------------------------------------------------------
// Locate the ledger section by heading, not by line number.
// ---------------------------------------------------------------------------

const ledgerStart = lines.findIndex((l) => l.startsWith("## STATUS LEDGER"))
check("the STATUS LEDGER section exists", ledgerStart !== -1)
if (ledgerStart === -1) process.exit(1)

let ledgerEnd = lines.length
for (let i = ledgerStart + 1; i < lines.length; i++) {
  if (lines[i].startsWith("## ")) {
    ledgerEnd = i
    break
  }
}

// ---------------------------------------------------------------------------
// Parse. A finding ID is <prefix>-<number><optional letter suffix>, where the
// prefix names a phase: S (seeded), P0..P9 (phases), A (admin audit), E (enhancement).
// ---------------------------------------------------------------------------

const ID = /\b(?:S|P[0-9]|A|E)-\d+[a-z]?\b/g

/** The first cell of a markdown table row, or null if the line is not one. */
function firstCell(line: string): string | null {
  if (!line.startsWith("|")) return null
  const cells = line.split("|")
  if (cells.length < 4) return null // separator rows and stray pipes
  const cell = cells[1].trim()
  if (cell === "" || /^:?-{2,}:?$/.test(cell)) return null
  return cell
}

type LedgerRow = { id: string; sev: string; status: string; line: number }
const ledger: LedgerRow[] = []
const ledgerDupes: string[] = []
const seenLedger = new Set<string>()

for (let i = ledgerStart; i < ledgerEnd; i++) {
  const cells = lines[i].split("|")
  const cell = firstCell(lines[i])
  if (cell === null) continue
  if (cell === "ID") continue
  const ids = cell.match(ID)
  if (!ids || ids.length !== 1 || ids[0] !== cell) continue // header/prose rows in the section
  const id = ids[0]
  if (seenLedger.has(id)) ledgerDupes.push(id)
  seenLedger.add(id)
  ledger.push({
    id,
    sev: (cells[2] ?? "").trim(),
    status: (cells[3] ?? "").trim().replace(/\*\*/g, "").replace(/\s*—.*$/, "").trim(),
    line: i + 1,
  })
}

/** Every ID named in the first cell of a table row OUTSIDE the ledger. */
const found = new Map<string, number>()
const unnumbered: { cell: string; line: number }[] = []

// A FINDINGS TABLE is one whose header row's first column is literally `ID`.
// Everything else in this file — the severity legend, the 7.3 limits table, any
// future comparison table — is prose in a grid and is skipped.
//
// This is deliberately a STRUCTURAL test (P6-75): the marker is the table's own
// header cell, a position, not a keyword appearing somewhere nearby. Widening
// the scan to every table instead was tried first and immediately produced eight
// false "unnumbered finding" reports from a table of lenses — a check that cries
// wolf on prose is a check somebody deletes.
let inFindingsTable = false

for (let i = 0; i < lines.length; i++) {
  if (i >= ledgerStart && i < ledgerEnd) continue
  const cell = firstCell(lines[i])
  // A blank line does NOT end the table. Three Wave-3 findings (P6-24, P6-25,
  // P6-26) are separated from their header by blank lines, which is sloppy
  // markdown that renders fine and would otherwise have dropped three real
  // findings out of scope — the exact failure this check exists to catch,
  // committed by the check itself. Only real prose, or a new heading, ends it.
  if (!lines[i].startsWith("|")) {
    if (lines[i].trim() !== "") inFindingsTable = false
    continue
  }
  if (cell === null) continue // separator row: leave the flag as it is
  if (cell === "ID") {
    inFindingsTable = true
    continue
  }
  if (!inFindingsTable) continue
  const ids = cell.match(ID)
  if (!ids) {
    if (!NARRATIVE_ROWS.includes(cell)) unnumbered.push({ cell, line: i + 1 })
    continue
  }
  for (const id of ids) if (!found.has(id)) found.set(id, i + 1)
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

check(
  `the ledger holds ${EXPECTED_LEDGER_ROWS} findings`,
  ledger.length === EXPECTED_LEDGER_ROWS,
  `${ledger.length} rows`,
)

check("no finding is listed twice in the ledger", ledgerDupes.length === 0, ledgerDupes.join(", "))

const badStatus = ledger.filter((r) => !VALID_STATUS.has(r.status))
check(
  "every status is one of open / fixed / wontfix / verified-ok",
  badStatus.length === 0,
  badStatus.map((r) => `${r.id}="${r.status}" (line ${r.line})`).join("; "),
)

const badSev = ledger.filter((r) => !VALID_SEV.has(r.sev.replace(/\*\*/g, "").trim()))
check(
  "every severity is P0-P3 or an explicit em dash",
  badSev.length === 0,
  badSev.map((r) => `${r.id}="${r.sev}"`).join("; "),
)

// Coverage, direction 1: every finding in the file has a ledger row.
const missing = [...found.keys()].filter((id) => !seenLedger.has(id))
check(
  "every finding ID in the file has a ledger row",
  missing.length === 0,
  missing.map((id) => `${id} (line ${found.get(id)})`).join(", "),
)

// Coverage, direction 2: every ledger row names an ID the file actually mentions.
// Prose-only sub-items (E-6a, E-7d …) are legitimate, so this checks the whole text
// rather than only the table cells.
const phantom = ledger.filter((r) => !new RegExp(`\\b${r.id}\\b`).test(
  lines.filter((_, i) => i < ledgerStart || i >= ledgerEnd).join("\n"),
))
check(
  "every ledger row names a finding the file mentions",
  phantom.length === 0,
  phantom.map((r) => r.id).join(", "),
)

// A finding row with no ID at all is invisible to every pass over this file.
check(
  "no table row records a finding without an ID",
  unnumbered.length === 0,
  unnumbered.map((u) => `line ${u.line}: "${u.cell.slice(0, 48)}"`).join("; "),
)

check(
  `${EXPECTED_TABLE_IDS} findings are reachable from a table's first cell`,
  found.size === EXPECTED_TABLE_IDS,
  `${found.size}`,
)

check(
  `the narrative-row list still holds ${NARRATIVE_ROWS.length} entries`,
  NARRATIVE_ROWS.length === 3,
  `${NARRATIVE_ROWS.length}`,
)

// Status distribution. A shift here means real movement or a real mistake; either
// way it should be a deliberate edit to this file, not a silent drift in that one.
const tally = (s: string) => ledger.filter((r) => r.status === s).length
const dist = {
  open: tally("open"),
  fixed: tally("fixed"),
  wontfix: tally("wontfix"),
  "verified-ok": tally("verified-ok"),
}

check(`open count is ${EXPECTED_OPEN}`, dist.open === EXPECTED_OPEN, `${dist.open}`)
check(`fixed count is ${EXPECTED_FIXED}`, dist.fixed === EXPECTED_FIXED, `${dist.fixed}`)
check(`wontfix count is ${EXPECTED_WONTFIX}`, dist.wontfix === EXPECTED_WONTFIX, `${dist.wontfix}`)
check(
  `verified-ok count is ${EXPECTED_VERIFIED_OK}`,
  dist["verified-ok"] === EXPECTED_VERIFIED_OK,
  `${dist["verified-ok"]}`,
)

check(
  "the four status counts account for every ledger row",
  dist.open + dist.fixed + dist.wontfix + dist["verified-ok"] === ledger.length,
)

console.log(
  `\nBacklog ledger: ${ledger.length} findings — ${dist.open} open, ${dist.fixed} fixed, ` +
    `${dist.wontfix} wontfix, ${dist["verified-ok"]} verified-ok. ` +
    `${found.size} distinct IDs found in the finding tables.`,
)

if (failures > 0) {
  console.error(`\n${failures} backlog-ledger check(s) failed.`)
  process.exit(1)
}
