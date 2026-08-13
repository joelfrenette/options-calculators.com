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
 *
 * LINE-PRESERVING (P7-5). This used to collapse a block comment to a single
 * space, which shifted every line after it. Every `file:line` this script has
 * ever printed for a file with a block comment above the hit named the wrong
 * line — and on a project whose stated method is "follow a label to the code
 * behind it", a check that points at the wrong line is worse than one that
 * prints no line at all: the reader looks, sees nothing wrong, and concludes
 * the finding is stale. Found while widening rule 12 (P7-3), when four of the
 * eleven new hits pointed at `</CardHeader>` and a chart axis.
 *
 * A block comment is now replaced by its own newlines, so offsets are exact.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " " + "\n".repeat((m.match(/\n/g) || []).length))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
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

// ---------------------------------------------------------------------------
// 0. The checks below only mean anything over the set they actually cover.
// ---------------------------------------------------------------------------
//
// P6-75: rule 13 silently stopped covering a file and went on reporting PASS,
// because its scope came from a keyword that a reworded log line removed. The
// only symptom was a printed count dropping from 12 to 11 — printed, never
// asserted, and therefore never read.
//
// **The PASS-count discipline in CLAUDE.md catches a check that stops RUNNING.
// It cannot catch one that keeps running over a shrunken set, because the count
// of PASS lines is identical.** These floors close that gap for this file: they
// are deliberately loose (a real refactor may move files around) but they make
// a scope collapse impossible to miss. Raise them when the codebase grows; a
// floor that has drifted far below reality is only half a guard.
const FLOORS: ReadonlyArray<[string, number, number]> = [
  ["components/*.tsx", COMPONENT_FILES.length, 80],
  ["app/**/*.tsx", APP_FILES.length, 1],
]
for (const [label, actual, floor] of FLOORS) {
  check(
    `scope: ${label} resolves to a plausible file set`,
    actual >= floor,
    `${actual} file(s), floor ${floor}`,
  )
}

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

// ---------------------------------------------------------------------------
// 6. No API route ships a ticker with a price attached.
// ---------------------------------------------------------------------------
//
// P6-52. `/api/strategy-scanner`'s POST handler returned three invented trade
// setups at HTTP 200 — SPY 595/590 for $2.35 at 72% POP, and two more — under
// its own comment, "Since AI functionality is not used, we return default
// setups". A component then rendered them and stamped "Last scanned: <time>".
//
// The rule is deliberately blunt: a route's job is to fetch or compute, so a
// literal symbol sitting next to a literal price in a route file is either
// fabricated output or a prompt anchoring a model to stale prices. The
// strategy-scanner had both, and the prompt's "SPY: ~$595" was what made the
// fabricated numbers look plausible.
//
// Components are exempt: static teaching examples live there on purpose, and
// they are labelled where they render.

/**
 * Route-side source. Rules 6, 7 and 9 all read it.
 *
 * NOT just `app/api`. P6-13 split the 1,808-line strategy-scanner route into
 * `lib/strategy-scanner/`, and rule 7 — which pairs a field the route hardcodes
 * to null against any UI control still filtering on it — reads three of its
 * withheld fields (`priceStability`, `historicalVolatility`, `ivSkew`) out of
 * the calendar-spread generator that moved. A walk left at `app/api` would keep
 * printing the same PASS line while no longer covering the code that produced
 * the finding.
 *
 * The rule's own rationale extends cleanly: it says a ROUTE's job is to fetch or
 * compute, and a module that exists only to be a route's body has the same job.
 */
const API_FILES = [
  ...walk(join(ROOT, "app", "api"), (p) => p.endsWith(".ts")),
  ...walk(join(ROOT, "lib", "strategy-scanner"), (p) => p.endsWith(".ts")),
]
const MIN_API_FILES = 60
check(
  `scope: ${API_FILES.length} route-side file(s)`,
  API_FILES.length >= MIN_API_FILES,
  `floor ${MIN_API_FILES} — app/api/** plus the modules routes delegate their bodies to`,
)
const TICKER_WITH_PRICE =
  /\bticker:\s*["'][A-Z.]{1,6}["'][^\n]*?(?:\$[0-9]|\bcredit:|\bpop:|\bpremium:|\bstrike:)|["'][A-Z]{2,5}["']\s*:\s*["']?~?\$[0-9]/

const fabricatedRows: string[] = []
for (const f of API_FILES) {
  for (const line of code(f).split("\n")) {
    if (TICKER_WITH_PRICE.test(line)) fabricatedRows.push(`${rel(f)}: ${line.trim().slice(0, 70)}`)
  }
}
check(
  "no API route ships a hardcoded ticker with a hardcoded price",
  fabricatedRows.length === 0,
  fabricatedRows.length ? fabricatedRows.join("; ") : "routes fetch or compute; they do not carry quotes",
)

// ---------------------------------------------------------------------------
// 7. A metric the route withholds has no filter control in the UI.
// ---------------------------------------------------------------------------
//
// P6-53. An earlier pass found `historicalVolatility` and `priceStability` were
// restatements of beta wearing the names of independent measurements, and
// correctly set both to null in the route. It stopped there. The calendar-spread
// scanner kept two sliders bound to them — draggable 50 to 95, filtering on
// `x !== null && ...`, which is never true — above a tooltip telling the user to
// "Look for 75% or higher" on a column rendering "not measured" on every row.
//
// Same family as the handler-less Refresh buttons: a control that accepts input
// and does nothing. It is the predictable second half of withholding a value,
// and the reason it survived is that removing a computation looks finished the
// moment the number stops being wrong.

const withheldFields: string[] = []
for (const f of API_FILES) {
  for (const m of code(f).matchAll(/const\s+(\w+)\s*(?::[^=]+)?=\s*null\b/g)) withheldFields.push(m[1])
}
const orphanControls: string[] = []
for (const field of new Set(withheldFields)) {
  const Cap = field[0].toUpperCase() + field.slice(1)
  // A slider/input state named min<Field> or max<Field> is a control over it.
  const control = new RegExp(`\\b(?:min|max)${Cap}\\b`)
  for (const f of UI_FILES) {
    if (control.test(code(f))) orphanControls.push(`${rel(f)} filters on withheld "${field}"`)
  }
}
check(
  "no UI control filters on a value the route hardcodes to null",
  orphanControls.length === 0,
  orphanControls.length ? orphanControls.join("; ") : `${new Set(withheldFields).size} withheld field(s), none driving a control`,
)

// ---------------------------------------------------------------------------
// 8. An estimated Greek is marked wherever a measured one would be.
// ---------------------------------------------------------------------------
//
// The companion to rule 5. `deltaSource` has existed on QualifyingStock since
// the Phase 4 split and no component ever read it, which is exactly how
// priceSource came to be logged and discarded — a provenance field nothing
// consumes is indistinguishable from no provenance at all.

const scannerTypes = code(join(ROOT, "components", "scanner", "types.ts"))
for (const field of ["priceSource", "deltaSource"]) {
  const declared = scannerTypes.includes(`${field}?:`) || scannerTypes.includes(`${field}:`)
  const consumed = UI_FILES.some((f) => {
    const src = code(f)
    return src.includes(`stock.${field}`) || src.includes(`s.${field}`) || src.includes(`.${field} ===`)
  })
  check(
    `${field} is read by the UI, not just declared`,
    !declared || consumed,
    declared ? (consumed ? "a renderer reads it" : "declared but nothing consumes it") : "not declared",
  )
}

// ---------------------------------------------------------------------------
// 9. A failure does not return 200.
// ---------------------------------------------------------------------------
//
// P6-56. `CLAUDE.md` has said "never 200 with an `{error}` body" since the start
// of the audit, and seven routes were doing it anyway — three of them saying so
// in a comment: "Changed from 500 to 200 to prevent error bubbling", "Return 200
// with empty arrays instead of 500". The status was downgraded on purpose, each
// time to stop something downstream from complaining.
//
// The cost is that "we found nothing" and "we never looked" become the same
// response on the wire. Seven scanner tabs render an empty array as "no
// candidates found", so a total outage read as a quiet market.
//
// This walks each `catch` block and flags a JSON response carrying an error
// marker with no 4xx/5xx status. It deliberately does NOT flag a catch that
// returns real degraded data with an honest flag — /api/time-server falls back
// to server time with `fallback: true`, and server time IS a time.

// Scoped to the response call, not the catch block. The rule's first version
// only walked `catch`, and the very next 200-on-error found in this sweep sat
// in an ordinary `if (!response.ok)` branch — the shape of the defect has
// nothing to do with exceptions.
const badStatus: string[] = []
for (const f of API_FILES) {
  const src = code(f)
  for (const m of src.matchAll(/(?:NextResponse|Response)\.json\(/g)) {
    let i = m.index! + m[0].length
    let depth = 1
    while (i < src.length && depth > 0) {
      if (src[i] === "(") depth++
      else if (src[i] === ")") depth--
      i++
    }
    const call = src.slice(m.index!, i)
    // Only a response that ADMITS failure needs an error status. A degraded
    // payload that flags itself honestly is a different thing — /api/time-server
    // falls back to server time with `fallback: true`, and server time IS a time.
    //
    // The key must sit at an object-property position — `{` or `,` before it.
    // A looser `\berror:` matched inside `console.error("… API error:", error)`,
    // so the first version of this rule failed on a route that was correct,
    // which is the failure mode that gets a check deleted rather than fixed.
    const admitsFailure = /[{,]\s*error:\s*["'`]|[{,]\s*success:\s*false/.test(call)
    if (!admitsFailure) continue

    // Three states, not two. A literal 4xx/5xx is fine. A COMPUTED status is
    // also fine and is in fact the better pattern — `{ status: response.status }`
    // and `{ status: contractsResult.httpStatus }` pass the upstream's own
    // verdict through instead of inventing one, and several routes here do
    // exactly that. Only a literal 200, or no status at all (which defaults to
    // 200), is the defect.
    const statusArg = call.match(/status:\s*([^,}\s]+)/)
    if (statusArg && statusArg[1] !== "200") continue
    badStatus.push(`${rel(f)}${statusArg ? "" : " (no status — defaults to 200)"}`)
  }
}
check(
  "no catch block returns an error body at HTTP 200",
  badStatus.length === 0,
  badStatus.length ? [...new Set(badStatus)].join(", ") : "failures carry a failure status",
)

// ---------------------------------------------------------------------------
// 10. A claim that rests on a decision is pinned to that decision's code.
// ---------------------------------------------------------------------------
//
// P6-51 is the failure this rule exists for, and it runs the opposite way to
// every other rule here. The homepage called the CCPI an "AI-powered crash
// probability model" and that was TRUE when it was written. P6-34 then removed
// ai-estimate from pillar scoring — the index got more honest — and the claim
// became false without anyone touching it. Nothing compares a sentence against
// the decision it depends on, so nothing noticed for a day.
//
// Each entry names a claim, the file it lives in, and a fact about the code
// that has to remain true for the claim to stay true. BOTH directions fail:
//
//   - the code changes and the claim goes stale  -> the dependency fails
//   - the claim is edited or removed             -> the entry is stale itself
//
// The second half matters as much as the first. A registry nobody prunes is
// the same kind of rotting record as SITE_MAP's erased ledger (P6-23).

interface PinnedClaim {
  finding: string
  claimFile: string
  /** Text that must still be present in the UI. */
  claim: string
  dependsOnFile: string
  /** Must still match in dependsOnFile for the claim to remain true. */
  dependsOn: RegExp
  why: string
}

const PINNED: PinnedClaim[] = [
  {
    finding: "P6-34",
    claimFile: "app/page.tsx",
    claim: "Only measured readings are scored",
    dependsOnFile: "lib/ccpi/scoring.ts",
    dependsOn: /tier === "baseline" \|\| tier === "ai-estimate"/,
    why: "if ai-estimate ever scores again, the homepage's headline description of the CCPI is false",
  },
  {
    finding: "P6-43",
    claimFile: "components/scanner/strict-results-table.tsx",
    claim: "computed from a fixed 35%",
    dependsOnFile: "components/scanner/enrichment.ts",
    dependsOn: /estimatedIV = 0\.35/,
    why: "the banner names a specific assumption; if the synthesis changes, the number in the copy is wrong",
  },
  {
    finding: "P6-45",
    claimFile: "components/fomc-predictions.tsx",
    claim: "It is NOT a market-implied rate",
    dependsOnFile: "app/api/fomc-predictions/route.ts",
    dependsOn: /predictionScore/,
    why: "the disclaimer describes a rule-based tally; if the route ever prices futures, it must be withdrawn",
  },
  {
    finding: "P6-58",
    claimFile: "components/market-sentiment.tsx",
    claim: "Components with no data are excluded",
    // P6-13 split the 1,140-line route into `lib/market-sentiment/`, and the
    // exclusion list moved with the fallback calculation that builds it. Third
    // registry entry repointed by today's splits (P6-66, P6-61, and this),
    // every one of them by a FAIL rather than a silent pass.
    dependsOnFile: "lib/market-sentiment/fallback-index.ts",
    dependsOn: /excludedComponents/,
    why: "the banner promises exclusion; a return to neutral-50 defaults would make it false",
  },
  {
    finding: "P6-47",
    claimFile: "components/ccpi-dashboard.tsx",
    claim: "It does not select trades",
    dependsOnFile: "components/ccpi-dashboard.tsx",
    // The owner's decision was that the CCPI band recommends nothing. If a
    // per-band strategy list returns, this sentence is the first thing it
    // contradicts.
    // Negative pin: matches only while the phrase is ABSENT. `[\s\S]` not `.`
    // — with `.` the lookahead only covers the first line and the rule passes
    // vacuously, which is a check that exists and verifies nothing.
    dependsOn: /^(?![\s\S]*Recommended Strategies)[\s\S]*$/,
    why: "owner decision: the CCPI describes conditions and selects no trades",
  },
  {
    finding: "P6-53",
    claimFile: "components/options-strategy-toolbox.tsx",
    claim: "they do not update with the market",
    dependsOnFile: "app/api/strategy-scanner/route.ts",
    dependsOn: /status: 501/,
    why: "the examples are labelled static because the scan route refuses; wiring a real scan would make the label false",
  },
  {
    finding: "P6-66",
    // P6-13 split `trend-analysis.tsx` (1,168 lines) and this sentence moved
    // with the Price Targets card it explains. A registry keyed by path rots on
    // a refactor, which is exactly what it did here — and it FAILED loudly
    // rather than passing on a file that no longer holds the claim, which is
    // the behaviour worth keeping.
    claimFile: "components/trend/price-targets-section.tsx",
    claim: "No momentum reading, so no weekly target",
    dependsOnFile: "app/api/trend-analysis/route.ts",
    dependsOn: /if \(!contributed\) return null/,
    why: "the copy explains an absent target; restoring the 50 baseline would make it unreachable and false",
  },
  {
    finding: "P6-61",
    // P6-13 split `panic-euphoria.tsx` (1,163 lines) and the AAII row moved with
    // the sentiment-scale card it sits in. Second registry entry to be repointed
    // by the same day's splits (see P6-66); both FAILED rather than silently
    // passing on a file that no longer holds the claim, which is what a
    // path-keyed registry has to do to be worth having.
    claimFile: "components/panic/sentiment-scale-section.tsx",
    claim: "DISPLAY ONLY — not scored",
    dependsOnFile: "app/api/panic-euphoria/route.ts",
    // Negative pin, and it must be one: the explanatory comment is stripped
    // before matching, so a marker inside `//` cannot be the dependency. This
    // matches only while `aaiiScore` is absent from the executable source.
    dependsOn: /^(?![\s\S]*aaiiScore)[\s\S]*$/,
    why: "the row says it is unscored; putting it back into componentScores would make that false",
  },
]

for (const p of PINNED) {
  let claimSrc = ""
  try {
    claimSrc = read(join(ROOT, p.claimFile.split("/").join(sep)))
  } catch {
    /* missing file fails below */
  }
  const claimPresent = claimSrc.includes(p.claim)
  if (!claimPresent) {
    check(
      `${p.finding}: pinned claim still exists in ${p.claimFile}`,
      false,
      `"${p.claim}" is gone — remove or update this entry so the registry does not rot`,
    )
    continue
  }
  let depSrc = ""
  try {
    depSrc = code(join(ROOT, p.dependsOnFile.split("/").join(sep)))
  } catch {
    /* missing file fails below */
  }
  check(`${p.finding}: "${p.claim}" still holds`, p.dependsOn.test(depSrc), p.why)
}

// ---------------------------------------------------------------------------
// 11. A cron backfill that clamps must say what it applied.
// ---------------------------------------------------------------------------
//
// P6-37 found four silent truncation caps in one day, each returning ok:true
// after quietly applying a limit. The worst cost an hour: `getSeriesHistory`
// asked for 20,000 rows, PostgREST returned 1,000, and the first lead-time
// backtest scored a 44-year series using four years and reported confident hit
// rates from it.
//
// The row records the fix as "caps raised to match retention, and
// /api/cron/breadth now returns backfillClamped {requested, applied} rather
// than clamping in silence". Only breadth got the second half. `fred-snapshot`
// and `market-snapshot` had their ceilings raised and went on clamping without
// a word — the same defect at a higher number, since asking for 30,000 and
// receiving 20,000 with ok:true still reads as "that is all there was".
//
// The rule: in `app/api/cron/**`, a `Math.min` on a caller-supplied backfill
// must be accompanied by a `backfillClamped` report in the same file.

const CRON_FILES = walk(join(ROOT, "app", "api", "cron"), (p) => p.endsWith(".ts"))
const silentClamps: string[] = []
for (const f of CRON_FILES) {
  const src = code(f)
  const clamps = /Math\.min\(\s*\d+\s*,[^)]*[Bb]ackfill/.test(src) || /[Bb]ackfill\s*=\s*Math\.min/.test(src)
  if (!clamps) continue
  if (!/backfillClamped/.test(src)) silentClamps.push(rel(f))
}
check(
  "every cron backfill clamp reports what it applied",
  silentClamps.length === 0,
  silentClamps.length ? silentClamps.join(", ") : `${CRON_FILES.length} cron route(s) checked`,
)

// ---------------------------------------------------------------------------
// 12. A component does not default a measurement to a number.
// ---------------------------------------------------------------------------
//
// P6-68 and P6-71. Every `|| <const>` sweep this audit ran — P6-18, P6-20,
// P6-32 — stopped at the API boundary, so the component side had never been
// looked at. It held the same defect in a different idiom: `momentumStrength ??
// 50` parked a gauge on "Neutral", `priceTarget1Week ?? 0` printed a **$0.00
// price target** in the same green as a real one, and a CCPI proximity bar
// defaulted to 0 — which its own scale labels "Safe: 0% (far above)", so
// absence rendered as reassurance.
//
// The rule targets the unambiguous case: a numeric default feeding something
// FORMATTED as a measurement — `?? 0).toFixed(`, `|| 50).toFixed(`. Layout
// arithmetic (widths, indexes, `.length ?? 0`) is untouched, and so is the
// house-correct `?? "—"` / `?? "N/A"`, which is what a missing value SHOULD
// render as.
//
// Removing a default from a non-nullable field is not busywork: it is what
// turns a future null into a type error instead of a silent zero. That is
// exactly how P6-68 became live — `?? 50` was harmless when written and became
// a defect the moment the route learned to return null.

// SCOPE WIDENED (P7-3). The original rule required `.toFixed(` immediately
// after the default, which means it only ever saw a formatted DECIMAL. An
// integer rendered straight into JSX slipped past it, and one had:
// `{data.totalIndicators || 29}` in `ccpi-dashboard.tsx`, five times, printing
// "3 of 29 warning signals active" whenever the payload omitted the count —
// while `ccpi-audit-admin.tsx` carried a comment recording that exact idiom as
// removed. **P6-71 swept all 95 components under this rule and every one of the
// five survived**, because a count has no decimal places.
//
// A denominator is as much a measurement as a price is. The second pattern
// catches `{expr || <int>}` and `{expr ?? <int>}` closing a JSX expression
// container. Layout arithmetic never appears in that position — a width or an
// array index is not a thing you render on its own — so the two patterns stay
// disjoint and neither needs an exception list.

const numericDefaults: string[] = []
for (const f of UI_FILES) {
  const src = code(f)
  src.split("\n").forEach((line, i) => {
    const formattedDecimal = /(?:\?\?|\|\|)\s*-?\d+(?:\.\d+)?\s*\)\s*\.toFixed\(/.test(line)
    // `{ … || 29}` / `{ … ?? 0}` — a defaulted number rendered as itself.
    const renderedInteger = /\{[^{}]*(?:\?\?|\|\|)\s*-?\d+(?:\.\d+)?\s*\}/.test(line)
    if (formattedDecimal || renderedInteger) {
      numericDefaults.push(`${rel(f)}:${i + 1}`)
    }
  })
}
check(
  "no component formats a defaulted number as a measurement",
  numericDefaults.length === 0,
  numericDefaults.length
    ? numericDefaults.join(", ")
    : `${UI_FILES.length} components checked, both idioms (formatted decimal and rendered integer) — missing values render "—", not a constant`,
)

// ---------------------------------------------------------------------------
// 13. An AI answer never returns a `live` status, and never carries a constant.
// ---------------------------------------------------------------------------
//
// P6-72. P6-34 was the audit's biggest decision: `ai-estimate` stopped scoring,
// and `fetchWithAIFallback` stopped inventing a baseline. It changed
// `lib/unified-ai-fallback.ts`. **The identical pattern was sitting in
// `lib/grok-market-data.ts` the whole time** — four helpers ending
// `return value || 30 / 1.2 / 55 / 32` — and, worse, `scrapePutCallRatio`
// labelled a Grok answer `status: "live"`, which `/api/ccpi` mapped straight to
// the scoring tier. A decision enforced in one module is not enforced.
//
// Two rules, both cheap:
//   (a) no `|| <number>` or `?? <number>` on the same line as a returned AI
//       value — that is the invented baseline by another name;
//   (b) no function that reads an AI provider may return `status: "live"`.

// Scope is STRUCTURAL, not keyword-based, and that distinction cost a real
// miss. This started as `PROVIDER_MARKER.test(code(f))`, and the only token
// putting `lib/scraping-bee.tsx` in scope turned out to be the string "xAI"
// inside a console.log. Rewording that log line — while fixing an unrelated
// defect three lines away — silently dropped the file out of the rule, and the
// check went on reporting PASS. The single visible symptom was the detail
// changing from "12 AI module(s) checked" to "11", which nothing reads.
//
// **A check whose scope is inferred from incidental content is a check that can
// be switched off by editing a comment.** That is the same defect this whole
// file exists to catch, turned on the file itself: the label ("AI module")
// stopped matching what the code did, and nothing noticed.
//
// A module is in scope if it CALLS a provider SDK or imports a module that
// does — both of which require an edit to the module's actual behaviour.
const AI_HELPER_IMPORT = /from\s+["'](?:\.\.?\/|@\/lib\/)(grok-market-data|unified-ai-fallback|ai-providers|earnings-calendar-ai)["']/
const AI_MODULES = walk(join(ROOT, "lib"), (p) => p.endsWith(".ts") || p.endsWith(".tsx")).filter((f) => {
  const src = code(f)
  return PROVIDER_MARKER.test(src) || AI_HELPER_IMPORT.test(src)
})
const aiConstants: string[] = []
const aiLiveClaims: string[] = []
for (const f of AI_MODULES) {
  const src = code(f)
  src.split("\n").forEach((line, i) => {
    if (/return\s+\w*[Vv]alue\s*(?:\|\||\?\?)\s*-?\d/.test(line)) aiConstants.push(`${rel(f)}:${i + 1}`)
  })
  // A module that calls a provider must not hand back a "live" tier for it.
  // `scrapeBuffettIndicator` and the CBOE branch legitimately do — they return
  // live for a SCRAPE — so this flags a live status only inside the block that
  // follows an AI call.
  //
  // The window was 8 lines when this rule was written, and that was not an
  // arbitrary choice so much as an unexamined one: it was wide enough for
  // `scrapePutCallRatio`, the case in hand. `scrapeAAIISentiment` has 16 lines
  // between its Grok call and its `status: "live"` — because it derives two
  // more figures in between — so the rule missed a live instance of exactly
  // what it was written to catch, in the same file, and a human found it.
  // 30 lines covers every current call site with room to spare.
  const lines = src.split("\n")
  lines.forEach((line, i) => {
    if (!/WithGrok\(|fetchMarketDataWithGrok\(|generateWithFallback\(/.test(line)) return
    const window = lines.slice(i, i + 30).join("\n")
    if (/status:\s*["']live["']/.test(window)) aiLiveClaims.push(`${rel(f)}:${i + 1}`)
  })
}
// The count that P6-75 quietly changed from 12 to 11 is now asserted, not just
// printed. This is the specific instance the floors above generalise.
check(
  "scope: the AI-module set has not collapsed",
  AI_MODULES.length >= 8,
  `${AI_MODULES.length} module(s) reach a provider — a sudden drop means the scope rule broke, not that the code got safer`,
)
check(
  "no AI helper returns a hardcoded constant when the model fails",
  aiConstants.length === 0,
  aiConstants.length ? aiConstants.join(", ") : `${AI_MODULES.length} AI module(s) checked`,
)
check(
  "no AI answer is handed back with a live status",
  aiLiveClaims.length === 0,
  aiLiveClaims.length ? aiLiveClaims.join(", ") : "AI values are tiered ai-estimate, which does not score (P6-34)",
)

console.log(failures === 0 ? "\nAll provenance checks passed." : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
