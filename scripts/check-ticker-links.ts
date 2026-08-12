/**
 * Every user-facing ticker link is built by `lib/ticker-links.ts`, and points
 * at Yahoo's advanced chart.
 *
 * Run: node scripts/check-ticker-links.ts
 *
 * WHY THIS FILE EXISTS. The URL was hand-built in fifteen components and had
 * already diverged three ways: twelve used `/quote/${ticker}` raw,
 * `smart-money-etfs.tsx` normalised the first `.` to `-` (Yahoo's spelling for
 * class shares — `BRK.B` 404s, `BRK-B` does not) and nothing else did, and
 * `scanner/fundamental-results-table.tsx` used `/quote/${ticker}/chart`. A
 * string copied fifteen times is fourteen chances for the fifteenth to be
 * wrong, and the audit's own record is that fixing one instance of a pattern is
 * not fixing the pattern (P7-16).
 *
 * WHAT IT ENFORCES.
 *   1. No file outside the library builds a `finance.yahoo.com` page URL.
 *   2. The library points at `/chart/`, not `/quote/` — the owner asked for the
 *      advanced chart, and a silent revert to the quote page would otherwise
 *      look identical to every reader of this suite.
 *   3. The link sites still exist. A refactor that deleted every call would
 *      satisfy rule 1 perfectly, which is the P6-77 failure: a check that stops
 *      covering prints the same PASS line as one that passes.
 *
 * NOT IN SCOPE: `query1.finance.yahoo.com`, which is the DATA API — a dozen
 * routes fetch from it and none of them is a hyperlink. The host distinguishes
 * them, so the rule keys off the host rather than the word "yahoo".
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const rel = (p: string) => relative(ROOT, p).split(sep).join("/")

const OWNER = "lib/ticker-links.ts"
const MIN_CANDIDATES = 100
const MIN_CALL_SITES = 15

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
  // ONE pass, alternation ordered by position — a `/*` inside a LINE comment
  // otherwise reads as a block opener and eats the rest of the file. The
  // `[^:]` guard keeps `https://` from reading as a comment, which matters
  // more here than anywhere: this check is entirely about URLs.
  src.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m, pre) =>
    m.startsWith("/*") ? " " + "\n".repeat((m.match(/\n/g) || []).length) : (pre ?? ""),
  )

const isSource = (p: string) => p.endsWith(".ts") || p.endsWith(".tsx")

/** Everything that could build a link. Check scripts excluded — this file names the URL. */
const CANDIDATES = [
  ...walk(join(ROOT, "app"), isSource),
  ...walk(join(ROOT, "components"), isSource),
  ...walk(join(ROOT, "lib"), (p) => p.endsWith(".ts")),
  ...walk(join(ROOT, "hooks"), isSource),
].filter((p) => rel(p) !== OWNER)

check(
  `scope: ${CANDIDATES.length} candidate file(s)`,
  CANDIDATES.length >= MIN_CANDIDATES,
  `${CANDIDATES.length}, floor ${MIN_CANDIDATES} — a collapsed walk must fail, not pass`,
)

// ------------------------------------------------------------------ rule 1
//
// The page host, not the API host. `query1.finance.yahoo.com/v8/...` is data
// and legitimately appears in a dozen routes.
//
// A PATH SEGMENT IS REQUIRED, and that is not cosmetic tightening. The first
// version matched the bare host and failed on `app/api/yahoo-proxy/route.ts`,
// where `Referer: "https://finance.yahoo.com/"` and `Origin:
// "https://finance.yahoo.com"` are outbound REQUEST HEADERS impersonating a
// browser — not links, and removing them would break the proxy. Requiring at
// least one character of path after the slash separates "a page a user is sent
// to" from "a host named in a header". The residual blind spot, stated rather
// than pretended away: a link assembled from a bare-host constant plus a
// symbol appended elsewhere would pass.
const PAGE_URL = /https:\/\/finance\.yahoo\.com\/[^"'`\s]/g

const offences: string[] = []
for (const f of CANDIDATES) {
  const src = stripComments(readFileSync(f, "utf8"))
  src.split("\n").forEach((line, i) => {
    PAGE_URL.lastIndex = 0
    if (PAGE_URL.test(line)) offences.push(`${rel(f)}:${i + 1}`)
  })
}

check(
  "no hand-built finance.yahoo.com page URL outside lib/ticker-links.ts",
  offences.length === 0,
  offences.length ? offences.join(", ") : `${CANDIDATES.length} files clean`,
)

// ------------------------------------------------------------------ rule 2
const ownerSrc = readFileSync(join(ROOT, OWNER), "utf8")

check(
  "lib/ticker-links.ts points at the ADVANCED CHART, not the quote page",
  ownerSrc.includes("https://finance.yahoo.com/chart/") &&
    !stripComments(ownerSrc).includes("finance.yahoo.com/quote/"),
  "the owner asked for /chart/ — a revert to /quote/ renders identically in this suite",
)

// ------------------------------------------------------------------ rule 3
//
// Rule 1 is satisfied perfectly by a codebase with no ticker links at all, so
// the call sites are counted too.
let callSites = 0
for (const f of CANDIDATES) {
  const src = stripComments(readFileSync(f, "utf8"))
  callSites += (src.match(/\byahooChartUrl\s*\(/g) || []).length
}

check(
  `the ticker links still exist — ${callSites} call site(s)`,
  callSites >= MIN_CALL_SITES,
  `${callSites}, floor ${MIN_CALL_SITES} — rule 1 also passes on a codebase with no links left`,
)

// ------------------------------------------------------------------ behaviour
const { yahooChartUrl } = await import("../lib/ticker-links.ts")

check(
  "a plain ticker becomes the advanced-chart URL",
  yahooChartUrl("AAPL") === "https://finance.yahoo.com/chart/AAPL",
  String(yahooChartUrl("AAPL")),
)

check(
  "a class share uses Yahoo's dash spelling, every dot",
  yahooChartUrl("BRK.B") === "https://finance.yahoo.com/chart/BRK-B",
  String(yahooChartUrl("BRK.B")),
)

check(
  "an index symbol is path-safe",
  yahooChartUrl("^SPX") === "https://finance.yahoo.com/chart/%5ESPX",
  String(yahooChartUrl("^SPX")),
)

check(
  "a missing ticker is null, never a link to Yahoo's default symbol",
  yahooChartUrl("") === null && yahooChartUrl("   ") === null && yahooChartUrl(null) === null && yahooChartUrl(undefined) === null,
  "blank, whitespace, null and undefined all decline",
)

if (failures > 0) {
  console.error(`\n${failures} ticker-link check(s) failed.`)
  process.exit(1)
}
