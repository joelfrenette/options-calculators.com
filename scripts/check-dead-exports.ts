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
  // ONE pass, alternation ordered by position — NOT block-then-line.
  //
  // Block-first was wrong and silently ate code: a LINE comment containing a
  // glob path (`// results tables live in components/scanner/*.`) has a `/*`
  // in it, which the block pattern happily treated as an opener and consumed
  // everything up to the next `*/` — 70+ lines of components/wheel-scanner.tsx
  // vanished from every scan that used this helper, and the checks reported
  // PASS on a file they could not see. Found by injecting a violation that
  // should have failed and did not.
  //
  // Alternation scans left to right, so at a `//` the line form matches first
  // and at a `/*` the block form does. The `[^:]` guard keeps `https://` from
  // reading as a comment.
  src.replace(/(?<!\*)\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m, pre) =>
    m.startsWith("/*") ? " " + "\n".repeat((m.match(/\n/g) || []).length) : (pre ?? ""),
  )

// `.tsx` added 2026-08-30, closing the other half of the hole documented in
// ALL_SOURCE below. This is the file set whose exports are CHECKED, and it
// filtered to `.ts` — so an export DEFINED in a `lib/*.tsx` was never examined
// for deadness at all. That direction fails silently, which is the dangerous
// one: the PASS line reads identically whether the check covers 103 files or
// 104 (P6-75/P6-77).
const LIB_FILES = walk(join(ROOT, "lib"), (p) => (p.endsWith(".ts") || p.endsWith(".tsx")) && !p.endsWith(".d.ts"))

/** Every file that could reference a lib symbol. */
const ALL_SOURCE = [
  ...walk(join(ROOT, "app"), (p) => p.endsWith(".ts") || p.endsWith(".tsx")),
  ...walk(join(ROOT, "components"), (p) => p.endsWith(".ts") || p.endsWith(".tsx")),
  // `.tsx` added 2026-08-30. This referrer scan filtered `lib/` to `.ts` while
  // app/, components/ and hooks/ all included `.tsx` — so an export used ONLY
  // from a `lib/*.tsx` was invisible to the reference count and read as dead.
  // `lib/scraping-bee.tsx` is the file this hid: it is the sole caller of
  // `fetchMarketDataWithGroqLLM`, and the check reported that export as newly
  // unreferenced the moment it was made public.
  //
  // A false POSITIVE is the benign direction for this particular hole, because
  // it fails loudly. The same gap in the other direction is not benign, and it
  // is still open: LIB_FILES above also filters `.ts`, so exports DEFINED in a
  // `lib/*.tsx` are not checked for deadness at all. Closing that is its own
  // change — it will surface a fresh list needing a decision each, which is the
  // P7-9 discipline, not a drive-by.
  ...walk(join(ROOT, "lib"), (p) => p.endsWith(".ts") || p.endsWith(".tsx")),
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

/**
 * A file that DECLARES its own function/const of the same name is not a
 * referrer — it is a second implementation.
 *
 * This is a false negative the rule shipped with, and P7-9 found it the only
 * way it could be found: by hand. `lib/sentiment-sources.ts` exported
 * `getPolygonNewsSentiment`, and `/api/social-sentiment` declares a LOCAL
 * `async function getPolygonNewsSentiment()` reading a different corpus and
 * calls that. The word-match saw the name in another file and scored the lib
 * export live, so the one case where a dead export is genuinely dangerous —
 * a diverged twin under the same name — was the case the check was blind to.
 *
 * Structural, not textual: it keys off a declaration form, so it cannot be
 * switched off by rewording a comment the way Rule 13's keyword scope was.
 */
const declaresOwn = (src: string, name: string): boolean =>
  new RegExp(
    `(?:^|\\n)\\s*(?:export\\s+)?(?:async\\s+)?(?:function|const|let|class)\\s+${name.replace(/\$/g, "\\$")}\\b`,
  ).test(src)

const dead: { key: string; where: string }[] = []
const shadowed: string[] = []
for (const s of symbols) {
  const word = new RegExp(`\\b${s.name.replace(/\$/g, "\\$")}\\b`)
  let referenced = false
  for (const [f, src] of sourceByFile) {
    if (f === s.file) continue
    if (!word.test(src)) continue
    if (declaresOwn(src, s.name)) {
      shadowed.push(`${rel(s.file)}:${s.name} shadowed by ${rel(f)}`)
      continue
    }
    referenced = true
    break
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

// P7-9 closed the list. All seventeen entries were decided one at a time:
// fourteen deleted, two wired to the caller that had reimplemented them
// (`streamWithFallback` into /api/ccpi/chat, `isPasswordHashed` into the admin
// health check), and one more — `getPolygonNewsSentiment` — surfaced only after
// the shadowing false negative above was fixed, then deleted with the rest.
//
// **Empty is a stronger claim than a ratchet, so the failure mode changes.**
// While the list had entries, adding one was the loud event. Now ANY new
// unreferenced export in lib/ fails the suite. If a genuinely-needed export
// lands with no caller yet, the honest move is to add it here WITH the reason
// and raise the baseline in the same commit — not to widen the scope above.
// `lib/ccpi/cache.ts:hasFreshCache` was listed here for exactly one commit.
// P7-14 kept it with no caller because it was the age check the live CCPI path
// was missing; P7-16 wired it into the dashboard header, so it came straight
// back off. That is the allowlist behaving as intended — an entry with a stated
// reason and a fix attached, not a permanent exception.
const KNOWN_DEAD: ReadonlySet<string> = new Set([])

const KNOWN_DEAD_BASELINE = 0

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

// Report what the shadow rule suppressed. A check that silently stops counting
// something is the P6-77 failure in miniature: the PASS line looks identical
// whether the rule found nothing or looked at nothing. Every line here is a
// lib export sharing a name with a local declaration elsewhere — worth a look
// even when the export is otherwise live, because that is how a diverged twin
// starts.
if (shadowed.length) {
  console.log(`NOTE  ${shadowed.length} name collision(s) ignored as non-references: ${shadowed.join(", ")}`)
}

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
