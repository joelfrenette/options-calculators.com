/**
 * Component state that is written and never read.
 *
 * Run: node scripts/check-write-only-state.ts
 *
 * WHY THIS FILE EXISTS. P7-16. `components/ccpi-dashboard.tsx` held
 * `fromCache` and `cacheTimestamp`, wrote them at four sites, and read them at
 * none — so the CCPI tab could show a snapshot of any age with nothing on
 * screen saying it was cached or when it was taken. The component KNEW; it
 * simply never said.
 *
 * That is the shape worth guarding, and it is specific to this project's
 * failure mode. Write-only state is normally a tidiness issue. Here it is a
 * **provenance** issue: the values that go unread are disproportionately the
 * ones describing where the data came from and how old it is — `isLiveData`,
 * `fromCache`, `lastUpdated`, `dataSource`. The component computes its own
 * honesty and then discards it.
 *
 * WHAT IS CHECKED. For every `const [x, setX] = useState(…)` in a `.tsx` file,
 * `x` must appear somewhere other than its own declaration. The setter is not
 * enough: calling `setX` is writing, not reading.
 *
 * WHAT IT CANNOT DO. It counts identifier occurrences within one file, so a
 * value read only in a child via a prop it is passed to is seen (the pass IS an
 * occurrence), but a value read through an alias is not distinguished. It also
 * cannot judge whether a read is meaningful — a value logged and nothing else
 * counts as read. Recorded rather than implied.
 *
 * THE RATCHET. Fourteen instances existed when this rule was written, and
 * deleting or wiring all fourteen in the commit that introduces it would be a
 * large unreviewable sweep across nine components — the same argument that made
 * `check-dead-exports` a ratchet. Each is listed with what it is, so the list
 * is a work queue rather than an excuse. **Anything not on it fails.**
 *
 * SCOPE IS STRUCTURAL (P6-75) and asserted (P6-77).
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const rel = (p: string) => relative(ROOT, p).split(sep).join("/")

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
  src.replace(/(?<!\*)\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m, pre) =>
    m.startsWith("/*") ? " " + "\n".repeat((m.match(/\n/g) || []).length) : (pre ?? ""),
  )

const FILES = [
  ...walk(join(ROOT, "components"), (p) => p.endsWith(".tsx")),
  ...walk(join(ROOT, "app"), (p) => p.endsWith(".tsx")),
]

const MIN_FILES = 80
check(`scope: ${FILES.length} .tsx file(s)`, FILES.length >= MIN_FILES, `${FILES.length}, floor ${MIN_FILES}`)

/**
 * The measured state on 2026-08-12, each with what it actually is. Deleting an
 * entry never fails, so this can only shrink.
 *
 * The `isLiveData` group is the reason this rule earns its place: six scanners
 * each set it from real payload data (`data.isLive`) and none render it, so
 * every one of them knows whether its numbers are live and does not say.
 * `market-sentiment.tsx` carries the P7-16 trio verbatim — the same defect
 * fixed in ccpi-dashboard, still present in a second component.
 */
const KNOWN: ReadonlySet<string> = new Set([
  // Redundant rather than concealing: this dashboard renders provenance from
  // `data.dataSources` instead, so the state is dead weight, not a silence.
  "components/insider-trading-dashboard.tsx:dataSource",
  // Not yet individually diagnosed.
  "components/api-keys-manager.tsx:loading",
  "components/social-sentiment.tsx:loadingProgress",
  "components/social-sentiment.tsx:loadingSource",
  "components/zebra-scanner.tsx:trendFilter",
])
const KNOWN_BASELINE = 5

check(
  `the known write-only list still holds ${KNOWN_BASELINE} entries`,
  KNOWN.size === KNOWN_BASELINE,
  `${KNOWN.size} — if you wired or deleted one, drop its line AND this number together`,
)

const USE_STATE = /const\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*(set[A-Za-z_$][\w$]*)\s*\]\s*=\s*useState/g

let pairs = 0
const writeOnly: string[] = []

for (const f of FILES) {
  const src = stripComments(readFileSync(f, "utf8"))
  USE_STATE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = USE_STATE.exec(src)) !== null) {
    pairs++
    const value = m[1]
    // The declaration itself contributes exactly one occurrence.
    const occurrences = (src.match(new RegExp(`\\b${value}\\b`, "g")) || []).length
    if (occurrences <= 1) writeOnly.push(`${rel(f)}:${value}`)
  }
}

check(
  `scope: ${pairs} useState pair(s) examined`,
  pairs > 100,
  `${pairs} — a collapse here would look like a clean run`,
)

const fresh = writeOnly.filter((w) => !KNOWN.has(w))
check(
  "no NEW write-only component state has appeared",
  fresh.length === 0,
  fresh.length ? fresh.join(", ") : `${pairs} pairs; ${writeOnly.length} known write-only, 0 new`,
)

const cleared = [...KNOWN].filter((k) => !writeOnly.includes(k))
if (cleared.length) {
  console.log(
    `NOTE  ${cleared.length} known entr(ies) are now read or gone — ` +
      `remove them from KNOWN and lower the baseline: ${cleared.join(", ")}`,
  )
}

if (failures > 0) {
  console.error(`\n${failures} write-only-state check(s) failed.`)
  process.exit(1)
}
