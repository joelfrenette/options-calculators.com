/**
 * The Panic/Euphoria composite counts measurements, not formulas.
 *
 * Run: node scripts/check-panic-composite.ts
 *
 * WHY THIS FILE EXISTS (P6-8). The composite is an equal-weight mean over the
 * components that have a score. Two of them had no source:
 *
 *   - `investorIntelligence` is `100 − ((VIX − 10) / 40) × 60`, clamped. A pure,
 *     monotonic function of VIX under a survey's name. It cannot disagree with
 *     VIX at any level, ever, so it is not a second piece of evidence — it is
 *     one vote counted twice.
 *   - `marginDebt` is `700 + spxMomentum*5 − (vix−15)*3` whenever FRED's
 *     BOGZ1FL663067003Q does not answer. The comment said "used only when the
 *     real series is unavailable", **and that described the DISPLAY, never the
 *     score**: `marginScore` was computed unconditionally and was never null.
 *
 * `syntheticComponents` disclosed both, and disclosure is a different fact from
 * exclusion. A reader can accept a labelled proxy as a data point; inside an
 * average it is not one. This is the Phase 6 synthesis's first cause verbatim —
 * a proxy is a labelling problem until it enters a mean, then it is an
 * arithmetic one.
 *
 * THE THIRD RULE IS THE ONE THAT NEARLY GOT AWAY. Removing a score server-side
 * does nothing if the client recomputes it. `components/panic-euphoria.tsx` read
 * `value={data.componentScores?.marginDebt ?? (data.marginDebt - 700) / 150}`,
 * so the moment the route started returning null the `??` answered it by
 * deriving the score on the client from the synthetic proxy — silently undoing
 * the fix in the only place a user looks, with no type error, because the client
 * type declared the field `number`. **Introducing a null is half a change; the
 * other half is every guard downstream of it** (P6-34, and P6-14 before it).
 * So every score bar's fallback is asserted to be `null`.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const ROUTE = "app/api/panic-euphoria/route.ts"
const VIEW = "components/panic-euphoria.tsx"

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

const routeSrc = readFileSync(join(ROOT, ROUTE), "utf8")
const viewSrc = readFileSync(join(ROOT, VIEW), "utf8")

// ---------------------------------------------------------------------------
// The composite's membership, derived from the array itself.
// ---------------------------------------------------------------------------

const block = /const componentScores = \[([\s\S]*?)\]\s*\.filter/.exec(routeSrc)
check(
  "the componentScores array is findable",
  block !== null,
  block ? "" : "was it renamed? this check cannot see a composite it cannot parse",
)

const members = block
  ? block[1]
      .split(",")
      .map((s) => s.replace(/\/\/[^\n]*/g, "").trim())
      .filter((s) => s.length > 0)
  : []

const EXPECTED_MEMBERS = 7
check(
  `scope: ${members.length} component(s) can score`,
  members.length === EXPECTED_MEMBERS,
  members.join(", ") || "none — a collapsed derivation is not a clean run",
)

/**
 * Scores whose input is a formula over VIX/SPX rather than a fetched series.
 * A name here must NOT appear in the composite.
 */
const SOURCELESS = ["iiScore", "aaiiScore"]
for (const banned of SOURCELESS) {
  check(
    `${banned} does not vote in the composite`,
    !members.includes(banned),
    banned === "iiScore"
      ? "investorIntelligence is a pure function of VIX — one vote counted twice"
      : "aaiiBullish is investorIntelligence × 0.9 (P6-61)",
  )
}

check(
  "iiScore is not computed at all — an unused score invites re-adding it",
  !/\bconst\s+iiScore\s*=/.test(routeSrc),
  "the display value investorIntelligence stays; the score does not",
)

// ---------------------------------------------------------------------------
// marginScore votes only when FRED answered.
// ---------------------------------------------------------------------------

check(
  "marginScore starts as null rather than as the proxy's value",
  /let marginScore:\s*number \| null\s*=\s*null/.test(routeSrc),
  "it was `= normalize(marginDebt, …)`, so the proxy voted on every request FRED missed",
)
/**
 * Exactly one assignment, and it is the FRED branch. The declaration reads
 * `let marginScore: number | null = null`, whose `=` follows the type
 * annotation rather than the bare name — the first draft of this assertion
 * expected two and failed on correct code, which is the cheap kind of wrong
 * and still had to be looked at before being believed.
 */
const marginAssignments = (routeSrc.match(/^\s*marginScore\s*=/gm) || []).length
check(
  "marginScore is assigned exactly once, in the branch that also sets marginIsLive",
  marginAssignments === 1,
  `${marginAssignments} assignment(s) outside the declaration`,
)
check(
  "the FRED branch sets both the score and the live flag",
  /marginScore = \(marginReal\.pct - 0\.5\) \* 2\s*\n\s*marginIsLive = true/.test(routeSrc),
  "a score without its flag would report a measured value as synthetic, or the reverse",
)
check(
  "the emitted marginDebt score survives being null",
  /marginDebt: marginScore !== null \? Math\.round\(marginScore \* 100\) \/ 100 : null/.test(routeSrc),
  "Math.round(null * 100) is 0, which on a -1..1 panic scale is a confident NEUTRAL",
)

// ---------------------------------------------------------------------------
// The client renders scores, never derives them. Scope is derived from the
// call sites so a new bar is covered the moment it exists.
// ---------------------------------------------------------------------------

const bars = [...viewSrc.matchAll(/value=\{data\.componentScores\?\.(\w+)\s*\?\?\s*([^}]+)\}/g)]
check(
  `scope: ${bars.length} score bar(s) read componentScores`,
  bars.length >= 3,
  bars.map((b) => b[1]).join(", ") || "none — the idiom changed and this rule stopped covering anything",
)
for (const [, field, fallback] of bars) {
  check(
    `${field}: an absent score renders as null, not as a client-side recomputation`,
    fallback.trim() === "null",
    `fallback is \`${fallback.trim()}\` — P6-14's rule: the client must not recompute a score the server declined to give`,
  )
}

check(
  "the client type admits a null margin score",
  /marginDebt:\s*number \| null/.test(viewSrc),
  "typed `number`, the compiler never asks the question and the `??` looks unreachable",
)

// ---------------------------------------------------------------------------
// The tooltips are claims. Two of them said the row was scored.
// ---------------------------------------------------------------------------

const iiTooltip = /Investor Intelligence Survey[\s\S]{0,1200}?\/>/.exec(viewSrc)?.[0] ?? ""
check(
  "the Investor Intelligence tooltip no longer claims the row is scored",
  !/It IS scored in the composite/.test(iiTooltip),
  "it said exactly that, and stayed true only until the row stopped scoring",
)
check(
  "the Investor Intelligence tooltip says display-only",
  /DISPLAY ONLY/.test(iiTooltip),
  "the reader's only signal that a bar carries no weight",
)

// ---------------------------------------------------------------------------
// P7-54: the row measures the VIX term structure and says so.
// ---------------------------------------------------------------------------

/**
 * This one is a NAME, not a number, and the number was always right. The value
 * is `vixShortTerm / vixLongTerm` — real measured VIX history, scored as curve
 * SHAPE, which is exactly why it survived P6-8 while `investorIntelligence` did
 * not: shape can disagree with level.
 *
 * It was called `putCallRatio`, and the site contradicted itself about that.
 * `/api/market-sentiment` states in its own header that nothing in the codebase
 * sources a put/call ratio, lists it in `NOT_TRACKED`, and returns null — while
 * this route scored one. Two routes, two answers to "does this site have a
 * put/call feed", and the one that said yes was the one publishing a number.
 */
check(
  "the route publishes vixTermRatio",
  /vixTermRatio: Math\.round\(vixTermRatio \* 100\) \/ 100/.test(routeSrc),
)
check(
  "no putCallRatio field is emitted from this route",
  !/^\s*putCallRatio:/m.test(routeSrc),
  "CCPI has its own putCallRatio from a different source; this route must not add a second answer",
)
check(
  "vixTermScore votes in the composite",
  members.includes("vixTermScore"),
  "the rename must not quietly drop a real measured input",
)
check(
  "the term-structure row is no longer listed as a synthetic proxy",
  !/"putCallRatio",/.test(routeSrc),
  "a direct reading of the VIX curve is not a proxy for anything",
)

/**
 * FIFTH INSTANCE of "a check that names its own findings will match itself",
 * and the first where stripping comments does not save it.
 *
 * The previous four were comments. This one was a USER-FACING STRING: the
 * corrected tooltip read "no options flow ... is involved", and the rule banning
 * the phrase "options flow" caught the sentence written to deny it.
 *
 * Comments are still stripped, because this file has plenty. But the fix was to
 * reword the tooltip, NOT to weaken the rule into an attribution-context match —
 * a blunt rule a reader can hold in their head is worth more than a clever one,
 * and "this tab must not contain the words options flow" is a sentence anyone
 * can check by eye.
 */
const viewNoComments = viewSrc.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m, pre) =>
  m.startsWith("/*") ? " " : (pre ?? ""),
)
check(
  'no rendered label reads "Put/Call Ratio"',
  !/>Put\/Call Ratio</.test(viewNoComments),
  (/>Put\/Call Ratio</.exec(viewNoComments) ?? ["none"])[0],
)
check(
  "the tab does not claim options flow data",
  !/options flow/i.test(viewNoComments),
  "there is no options flow feed on this site",
)
check(
  "the tab does not name the CBOE put/call ratio",
  !/CBOE equity put\/call/i.test(viewNoComments),
  "a second tooltip named a source the site has never had",
)

if (failures > 0) {
  console.error(`\n${failures} panic-composite check(s) failed.`)
  process.exit(1)
}
