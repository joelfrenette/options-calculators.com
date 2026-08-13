/**
 * AUDIT_BACKLOG.md has exactly one record of what is open: the §STATUS LEDGER.
 *
 * Run: node scripts/check-open-summaries.ts
 *
 * WHY THIS FILE EXISTS. CLAUDE.md has said "do not add a summary line of what is
 * still open" since Phase 7.1, in writing, because the file had already carried
 * three such summaries and all three had drifted — one still listing P6-29,
 * S-11 and S-14 as "remaining" the day after each was fixed.
 *
 * A FOURTH was written anyway, on the same day as the ledger that makes it
 * unnecessary, and by 2026-08-12 it disagreed with the ledger in six places and
 * with itself in one: a P3 heading claiming eleven items above a list of
 * thirteen. **A rule with no check is a preference**, which is this project's
 * own repeated finding, applied here to its own documentation.
 *
 * WHAT COUNTS AS A VIOLATION. A heading or bolded label that pairs a severity or
 * an open/remaining word with a COUNT, outside the ledger section. Not prose
 * that mentions a finding, not the ledger's own totals line, and not the counts
 * inside a narrative row — those describe a moment and are dated. The thing
 * being banned is a standing tally that the next edit will silently invalidate.
 *
 * WHAT IT CANNOT DO, stated rather than implied: it matches shapes, not
 * meaning. A summary written as flowing prose with the numbers spelled out
 * ("four P1 items remain") passes. It catches the form the file has actually
 * produced four times, which is a heading with a number after a dash.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const BACKLOG = "AUDIT_BACKLOG.md"

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

const lines = readFileSync(join(ROOT, BACKLOG), "utf8").split(/\r?\n/)

const ledgerStart = lines.findIndex((l) => l.startsWith("## STATUS LEDGER"))
check("the STATUS LEDGER section is present", ledgerStart !== -1)
if (ledgerStart === -1) process.exit(1)

/**
 * The ledger's own totals line is the ONE permitted tally, and it is permitted
 * because `check-backlog-ledger.ts` recomputes it from the rows. Its line
 * number is found rather than assumed, so this exemption cannot be smuggled
 * onto some other line by moving text around.
 */
const totalsLine = lines.findIndex((l) => /^\d+ findings recorded · \*\*/.test(l))
check(
  "the ledger's totals line is the one permitted tally",
  totalsLine !== -1 && totalsLine > ledgerStart,
  totalsLine === -1 ? "not found — has it been reworded?" : `line ${totalsLine + 1}`,
)

/**
 * A standing tally: a bolded label or heading naming a severity or an
 * open/remaining word, followed by a count.
 *
 * `P1 — 4.` · `**P2 — 6.**` · `### Still open — 12` · `**Remaining: 5**`
 */
// The separator must be an em-dash, a colon, or a SPACED hyphen. An unspaced
// hyphen between a letter and a digit is a finding ID, and the first version of
// this pattern read `P2-4` and `P7-21` as tallies of 4 and 21 — a check whose
// false positives outnumber its findings is one somebody deletes rather than
// fixes.
const TALLY =
  /^\s*(?:#{1,6}\s*)?\*{0,2}\s*(?:P[0-3]\b|open|still open|remaining|outstanding|unresolved)[^\n]{0,40}?(?:—|:|\s-\s)\s*\*{0,2}\s*\d+/i

const offences: string[] = []
lines.forEach((line, i) => {
  if (i === totalsLine) return
  if (!TALLY.test(line)) return
  // Table rows are findings, not summaries — a row's first cell is an ID and
  // its severity cell legitimately reads "P1".
  if (line.trim().startsWith("|")) return
  offences.push(`line ${i + 1}: ${line.trim().slice(0, 70)}`)
})

check(
  "no standing open-list tally outside the ledger",
  offences.length === 0,
  offences.length
    ? offences.join(" · ")
    : "the ledger is the only record of what is open — four hand-maintained summaries have drifted here",
)

/**
 * The countless form of the same thing.
 *
 * `**Open, in priority order:** P6-29, S-11 and S-14` carries no number, so the
 * tally rule above cannot see it — and both instances in this file listed
 * findings that had since been fixed. They sit inside DATED phase narratives,
 * where a record of what was open at the time is legitimate history; what is
 * not legitimate is the present tense, which is what makes a reader treat a
 * 2026-08-11 list as today's.
 *
 * So the requirement is not deletion but DATING: an "Open…" label naming finding
 * IDs must say when it was true, or point at the ledger.
 */
const OPEN_LABEL = /^\s*\*{0,2}(?:Open|Still open|Remaining|Outstanding)\b[^\n]{0,60}?:/i
const ID_IN = /\b(?:S|P[0-9]|A|E)-\d+[a-z]?\b/

/**
 * The ledger SECTION, not everything after it.
 *
 * The first version of this rule skipped `i >= ledgerStart`, which meant it
 * scanned 136 lines of a 2,900-line file and printed PASS — a check covering
 * five percent of its subject, indistinguishable from one covering all of it.
 * The scope size is asserted below for that reason (P6-77).
 */
let ledgerEnd = lines.length
for (let i = ledgerStart + 1; i < lines.length; i++) {
  if (lines[i].startsWith("## ")) {
    ledgerEnd = i
    break
  }
}

const scanned = lines.length - (ledgerEnd - ledgerStart)
check(
  `scope: ${scanned} line(s) scanned outside the ledger section`,
  scanned > lines.length * 0.8,
  `${scanned} of ${lines.length} — a rule that scans only the header passes for the wrong reason`,
)

const undated: string[] = []
lines.forEach((line, i) => {
  if (i >= ledgerStart && i < ledgerEnd) return
  if (line.trim().startsWith("|")) return
  if (!OPEN_LABEL.test(line)) return
  // The IDs may run onto the following lines, as both instances here do.
  const window = lines.slice(i, i + 4).join(" ")
  if (!ID_IN.test(window)) return
  if (/as of|at the time|§STATUS LEDGER|see the ledger|historical/i.test(window)) return
  undated.push(`line ${i + 1}: ${line.trim().slice(0, 60)}`)
})

check(
  "every open-list inside a phase narrative is dated or points at the ledger",
  undated.length === 0,
  undated.length
    ? undated.join(" · ")
    : "a past-tense record of what was open is history; the same words in the present tense are a second answer to 'what is open'",
)

/**
 * The deletion note itself must survive. Without it the next contributor sees a
 * file with no summary, writes the fifth, and hits a check whose reason is
 * nowhere in the document it guards.
 */
check(
  "the file records WHY the by-severity list was deleted",
  lines.some((l) => l.includes("The by-severity list that used to sit here")),
  "a rule whose rationale is only in a script is a rule that gets argued with",
)

if (failures > 0) {
  console.error(`\n${failures} open-summary check(s) failed.`)
  process.exit(1)
}
