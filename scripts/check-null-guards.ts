/**
 * No component formats a value whose only guard is `!== undefined`.
 *
 * Run: node scripts/check-null-guards.ts
 *
 * WHY THIS FILE EXISTS. P7-17 found twelve render sites shaped like this:
 *
 *     {indicators.soxIndex !== undefined && (
 *        … {indicators.soxIndex.toFixed(0)} …
 *     )}
 *
 * `soxIndex` is `number | null`. **`null !== undefined` is true**, so the guard
 * passes and `.toFixed(0)` throws. That is a TypeError during render — the CCPI
 * tab blanks — not a wrong number, and it fires precisely when the data is
 * missing, which is the moment the page most needs to stay up.
 *
 * The pairing that produced it is the part worth guarding. P6-34 removed the
 * fabricated baseline constants from the AI fallback chain and made it return
 * `value: null`. That was correct. But **introducing a null is only half a
 * change; the second half is every guard and every formatter downstream**, and
 * those were left on `!== undefined`. The defect was armed by a fix.
 *
 * This rule is the standing form of that lesson, and it is deliberately a
 * UNIFORMITY rule rather than a bug detector: **`!= null` is never wrong, and
 * `!== undefined` is sometimes catastrophically wrong.** Requiring the former
 * everywhere means no reader — and no future edit — has to know which fields
 * are nullable today. The alternative is a rule that needs type information to
 * decide, which is a rule nobody can apply while writing the code.
 *
 * HONEST ACCOUNT OF WHAT IT FOUND ON INTRODUCTION. Four sites, and **none of
 * them was a crash**: `data.latestCitiReading` in panic-euphoria and
 * `stock.premium` / `stock.annualizedYield` / `stock.iv` in the strict scanner
 * table are all declared `?: number`, genuinely optional and never null, so
 * `!== undefined` was the correct test for them on the day it was written. They
 * were converted for conformance, not because they were broken.
 *
 * That is the point of turning it on now rather than later: the twelve real
 * crashes were fixed by hand in P7-17, and this exists so the thirteenth cannot
 * be written. A rule introduced while it still finds live bugs is a rule
 * introduced too late.
 *
 * WHAT IT CANNOT DO, stated rather than implied. It matches a formatter call on
 * a member expression and looks for that same expression's guards in the same
 * file. It cannot see a value passed into a child component and formatted
 * there, and it cannot see a formatter reached through a local alias
 * (`const v = indicators.x` then `v.toFixed()`). It catches the idiom this
 * codebase actually writes — guard and format in one JSX block — and the
 * remainder is a limit, not a claim of completeness.
 *
 * SCOPE IS STRUCTURAL (P6-75) and its size is asserted (P6-77): every `.tsx`
 * under components/ and app/, by file layout rather than by keyword.
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const rel = (p: string) => relative(ROOT, p).split(sep).join("/")

/** A floor, not an exact count: components come and go legitimately. */
const MIN_COMPONENT_FILES = 80

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
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")

const FILES = [
  ...walk(join(ROOT, "components"), (p) => p.endsWith(".tsx")),
  ...walk(join(ROOT, "app"), (p) => p.endsWith(".tsx")),
]

check(
  `scope: component set resolves`,
  FILES.length >= MIN_COMPONENT_FILES,
  `${FILES.length} .tsx files, floor ${MIN_COMPONENT_FILES}`,
)

/**
 * Number formatters. A value reaching any of these must be a number — none of
 * them exists on null, so each is a crash rather than a bad render.
 */
const FORMATTERS = ["toFixed", "toPrecision", "toLocaleString", "toExponential"]

/**
 * `foo.bar.baz.toFixed(` → `foo.bar.baz`. Deliberately only member chains:
 * a formatter on a call result (`f().toFixed()`) has no expression to guard.
 */
const CALL = new RegExp(`\\b([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)+)\\.(?:${FORMATTERS.join("|")})\\(`, "g")

type Offence = { file: string; line: number; expr: string }
const offences: Offence[] = []
let formattedCount = 0

for (const f of FILES) {
  const src = stripComments(readFileSync(f, "utf8"))
  const lines = src.split("\n")

  lines.forEach((line, i) => {
    CALL.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = CALL.exec(line)) !== null) {
      const expr = m[1]
      // Optional chaining at the call site already handles both states.
      if (line.includes(`${expr}?.`)) continue
      formattedCount++

      const esc = expr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const undefinedGuard = new RegExp(`${esc}\\s*!==\\s*undefined`).test(src)
      const nullSafe =
        new RegExp(`${esc}\\s*!=\\s*null`).test(src) ||
        new RegExp(`${esc}\\s*!==\\s*null`).test(src) ||
        new RegExp(`${esc}\\s*\\?\\?`).test(src) ||
        new RegExp(`${esc}\\?\\.`).test(src) ||
        new RegExp(`Number\\.isFinite\\(\\s*${esc}`).test(src) ||
        new RegExp(`typeof\\s+${esc}\\s*===\\s*["']number["']`).test(src)

      // The offence is specifically "guarded, but with the wrong test".
      // An unguarded formatter is a different (and much louder) bug that this
      // rule deliberately does not claim to police — see the header.
      if (undefinedGuard && !nullSafe) {
        offences.push({ file: rel(f), line: i + 1, expr })
      }
    }
  })
}

check(
  `scope: ${formattedCount} formatter call(s) on member expressions were examined`,
  formattedCount > 0,
  `${formattedCount} — zero would mean the matcher stopped matching, not that the code got safer`,
)

check(
  "no formatter is guarded only by `!== undefined`",
  offences.length === 0,
  offences.length
    ? offences.map((o) => `${o.file}:${o.line} ${o.expr}`).join(", ")
    : `${formattedCount} formatter call(s) across ${FILES.length} files, all null-safe`,
)

if (failures > 0) {
  console.error(`\n${failures} null-guard check(s) failed.`)
  process.exit(1)
}
