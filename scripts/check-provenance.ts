/**
 * Provenance checks — does a label match what the code behind it does?
 *
 * Run: node scripts/check-provenance.ts
 *
 * WHY THIS FILE EXISTS. Phase 6 spent its last day finding the same defect on
 * fourteen tabs, and not one of them was a wrong number. Every one was a NOUN:
 *
 *   - `insiders` headed hardcoded prose "AI Insights" and, under it, asserted
 *     that named real people had sold stock "this week" (P6-42).
 *   - `fomc-predictions` claimed CME FedWatch methodology and Fed Funds futures
 *     over a rule-based tally that reads no futures, and displayed its own
 *     output as an "Implied Rate" (P6-45).
 *   - Nine LEARN tabs shared one heading, "AI Trade Ideas & Adjustments This
 *     Week", over a static object literal (P6-46).
 *   - `jobs` and `fomc-predictions` were "AI-Powered" while importing no model
 *     at all — that one oversold and undersold at the same time (P6-48).
 *   - Four Refresh buttons took a click and did nothing (P6-38).
 *
 * The audit's earlier sweeps all grepped for `|| <const>`, so none of these
 * were ever going to turn up: the numbers were fine. What was wrong was the
 * word attached to them. A number can be checked against a source; a noun
 * asserting WHERE a number came from can only be checked against the code, and
 * nothing here was doing that until this file.
 *
 * The sweep that found them was manual, which means it would rot within a
 * release. These checks are the mechanical version.
 *
 * WHAT THIS CANNOT VERIFY. Whether a model's answer is any good, whether a
 * heuristic is well-tuned, or whether prose is true in general. It verifies one
 * thing only, and verifies it exactly: if the UI names a source, that source
 * has to be reachable from the code that renders it.
 *
 * Comments are stripped before matching, deliberately. Every fix in P6-38..P6-48
 * left the false string in a comment explaining why it was wrong, and a checker
 * that could not tell those apart would fail on its own documentation.
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const rel = (p: string) => relative(ROOT, p).split(sep).join("/")

let failures = 0
function check(name: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`)
  } else {
    failures++
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function walk(dir: string, match: (p: string) => boolean): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    if (e === "node_modules" || e === ".next" || e === ".git") continue
    const full = join(dir, e)
    if (statSync(full).isDirectory()) out.push(...walk(full, match))
    else if (match(full)) out.push(full)
  }
  return out
}

/**
 * Strip comments so a fix's own explanation cannot trip the rule it documents.
 *
 * Block comments go first (this also takes JSX `{/* ... *␘/}` wrappers, whose
 * braces are left behind harmlessly). Line comments only count when `//` is not
 * preceded by `:`, so a `https://` inside a string does not swallow the rest of
 * the line — the one case that would cause a silent MISS rather than a false
 * alarm, which is the direction that matters here.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1")
}

const read = (p: string) => readFileSync(p, "utf8")
const code = (p: string) => stripComments(read(p))

// ---------------------------------------------------------------------------
// 1. A control that takes a click must do something.
// ---------------------------------------------------------------------------
//
// P6-38: three tabs rendered `<RefreshButton />` with no handler and one passed
// `onClick={() => {}}`, which is worse because it reads as wired. RefreshButton
// runs `onClick || onRefresh` and silently returns when neither exists, so all
// four painted an enabled button that swallowed the click. From the user's side
// that is indistinguishable from a fetch that failed quietly.

const COMPONENT_FILES = walk(join(ROOT, "components"), (p) => p.endsWith(".tsx"))
const APP_FILES = walk(join(ROOT, "app"), (p) => p.endsWith(".tsx"))
const UI_FILES = [...COMPONENT_FILES, ...APP_FILES]

const deadRefresh: string[] = []
for (const f of UI_FILES) {
  const src = code(f)
  // No props at all, or a handler whose body is empty.
  if (/<RefreshButton\s*\/>/.test(src)) deadRefresh.push(`${rel(f)} (no handler)`)
  if (/<RefreshButton[^>]*on(?:Click|Refresh)=\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/.test(src)) {
    deadRefresh.push(`${rel(f)} (empty handler)`)
  }
}
check(
  "no RefreshButton is rendered without a working handler",
  deadRefresh.length === 0,
  deadRefresh.length ? deadRefresh.join(", ") : "every usage passes a real handler",
)

// ---------------------------------------------------------------------------
// 2. An AI claim must have a model behind it.
// ---------------------------------------------------------------------------
//
// The rule: if a component's rendered text says AI, then some route it fetches
// must be able to reach a provider — directly, or through one hop into lib/.
// `/api/earnings-calendar/insights` is the reason the hop exists: it imports
// lib/earnings-calendar-ai.ts and nothing else that looks like a model.

const AI_CLAIM =
  /\bAI[- ](?:Powered|Generated|Insights?|Analysis|Summary|Trade)\b|\bAI (?:Insights?|Analysis|Summary|Executive|Smart)\b|\bOur AI\b|\bAI analyzes\b/i

const PROVIDER_MARKER =
  /anthropic|openai|api\.groq|api\.x\.ai|\bxai\b|openrouter|generativelanguage|perplexity|unified-ai-fallback|ai-providers|generateWithFallback|earnings-calendar-ai/i

/** Routes a UI file fetches, as repo paths. */
function fetchedRoutes(src: string): string[] {
  const out = new Set<string>()
  for (const m of src.matchAll(/["'`](\/api\/[a-zA-Z0-9/_-]+)/g)) out.add(m[1])
  return [...out]
}

/** Can this route reach a model, following one hop into lib/? */
function routeReachesModel(apiPath: string): boolean {
  const routeFile = join(ROOT, apiPath.replace(/^\//, "").split("/").join(sep), "route.ts")
  let src: string
  try {
    src = code(routeFile)
  } catch {
    return false
  }
  if (PROVIDER_MARKER.test(src)) return true
  // One hop: any @/lib module this route imports.
  for (const m of src.matchAll(/from\s+["']@\/(lib\/[a-zA-Z0-9/_-]+)["']/g)) {
    try {
      if (PROVIDER_MARKER.test(code(join(ROOT, m[1].split("/").join(sep) + ".ts")))) return true
    } catch {
      /* module may be .tsx or absent; a miss here just means "not proven" */
    }
  }
  return false
}

const unbackedClaims: string[] = []
const backedClaims: string[] = []
for (const f of UI_FILES) {
  const src = code(f)
  if (!AI_CLAIM.test(src)) continue
  // A component may render the claim while a child does the fetching, so the
  // dialog component counts as a model path for whoever embeds it.
  const embedsAiDialog = /RunScenarioInAIDialog|CcpiChatModal/.test(src)
  const routes = fetchedRoutes(src)
  const backed = embedsAiDialog || routes.some(routeReachesModel)
  if (backed) backedClaims.push(rel(f))
  else unbackedClaims.push(`${rel(f)} (fetches: ${routes.join(", ") || "nothing"})`)
}
check(
  "every AI claim in the UI has a model behind it",
  unbackedClaims.length === 0,
  unbackedClaims.length ? unbackedClaims.join("; ") : `${backedClaims.length} claim(s), all backed`,
)

// ---------------------------------------------------------------------------
// 3. Nothing claims market-implied rates, because nothing prices futures.
// ---------------------------------------------------------------------------
//
// P6-45. The FOMC route said four times that it uses CME FedWatch methodology
// and Fed Funds futures. It reads neither: FRED DFF is the realized overnight
// rate, and the probabilities come from an integer hawkish/dovish tally. The
// tab then displayed that tally's output as an "Implied Rate" — in rates,
// "implied" means market-implied, so the word itself was the false claim.
//
// This check has no allowlist on purpose. If a futures source is ever bought,
// the honest way to re-enable the wording is to delete this block in the same
// commit that wires the feed — which forces the claim and the capability to
// land together.

const FUTURES_SOURCE = /cmegroup\.com\/.*api|fedwatch.*api|quandl|CME_FF|fed_funds_futures/i
const anyFuturesFeed = walk(join(ROOT, "app", "api"), (p) => p.endsWith(".ts")).some((p) =>
  FUTURES_SOURCE.test(code(p)),
)

// Two kinds of line mention futures and are not the defect, so both are skipped.
//
// A NEGATED line is the fix itself — "no Fed Funds futures are read" has to be
// sayable. (The `i` flag here is load-bearing: the first version of this rule
// omitted it and flagged its own fix, because the sentence begins "No".)
//
// A REFERRAL line points the user AT the real CME tool, which is the honest
// move once you have admitted you are not it. The defect was claiming to BE
// FedWatch; naming FedWatch as the better source is the opposite.
const NEGATED = /\bnot\b|\bno\b|never|does not|rather than/i
const REFERRAL = /cmegroup\.com/i
const futuresClaims: string[] = []
for (const f of [...UI_FILES, ...walk(join(ROOT, "app", "api"), (p) => p.endsWith(".ts"))]) {
  for (const line of code(f).split("\n")) {
    if (!/Fed Funds futures|FedWatch methodology|market-implied|rate implied by/i.test(line)) continue
    if (NEGATED.test(line) || REFERRAL.test(line)) continue
    futuresClaims.push(`${rel(f)}: ${line.trim().slice(0, 80)}`)
  }
}
check(
  "no unqualified Fed Funds futures / FedWatch / market-implied claim",
  futuresClaims.length === 0 || anyFuturesFeed,
  futuresClaims.length ? futuresClaims.join("; ") : "none — and no futures feed is wired, so none may be claimed",
)

// ---------------------------------------------------------------------------
// 4. Retired claims stay retired.
// ---------------------------------------------------------------------------
//
// Each of these was removed for a recorded reason. They are pinned by exact
// string because each one is cheap to reintroduce by copy-paste from an older
// component, and each was live in production for months before anyone read the
// code behind it.

const RETIRED: ReadonlyArray<[string, string]> = [
  ["pre-qualified for active options markets", "P6-44 — nothing queries options availability"],
  ["Recommended Strategies This Week", "P6-47 — a fixed list, and the CCPI selects no trades"],
  ["AI Trade Ideas & Adjustments This Week", "P6-46 — static object literal on nine tabs"],
  ["AI Insights: Insider Activity", "P6-42 — the section under it was fabricated"],
  ["AI-Powered Employment Forecasts", "P6-48 — /api/jobs-report imports no model"],
  ["AI-powered predictions using Fed Funds futures", "P6-45 — no model and no futures"],
  ["Sell cash-secured puts on quality stocks", "P6-47 — the CCPI reads nothing about any ticker"],
]

for (const [phrase, why] of RETIRED) {
  const hits = UI_FILES.concat(walk(join(ROOT, "app", "api"), (p) => p.endsWith(".ts"))).filter((f) =>
    code(f).includes(phrase),
  )
  check(`retired: "${phrase}"`, hits.length === 0, hits.length ? `back in ${hits.map(rel).join(", ")}` : why)
}

// ---------------------------------------------------------------------------
// 5. A synthesized price must stay distinguishable from a quoted one.
// ---------------------------------------------------------------------------
//
// P6-43. The scanner computes a premium from a fixed 35% IV when Polygon's
// snapshot is quiet, and tracked that in a local it only ever logged — so the
// results table rendered a fabricated premium exactly as it renders a real
// quote, in a table whose default sort is the yield computed from it.

const enrichment = code(join(ROOT, "components", "scanner", "enrichment.ts"))
check(
  "the scanner records priceSource on the row, not just in a log line",
  /priceSource,/.test(enrichment) || /priceSource:/.test(enrichment),
  "a source the row does not carry cannot reach the table",
)
check(
  "a synthesized price is labelled 'synthesized', not 'estimated (market closed)'",
  enrichment.includes('"synthesized"') && !enrichment.includes("estimated (market closed)"),
  "any snapshot failure lands there — a rate limit is not a closed market",
)
for (const table of ["strict-results-table.tsx", "relaxed-results-table.tsx"]) {
  const src = code(join(ROOT, "components", "scanner", table))
  check(
    `${table} distinguishes synthesized rows`,
    src.includes('priceSource === "synthesized"'),
    "renders est. markers off the row's own source",
  )
}

console.log(failures === 0 ? "\nAll provenance checks passed." : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
