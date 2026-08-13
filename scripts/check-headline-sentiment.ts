/**
 * The headline scorer cannot be inverted by a substring. (P7-47)
 *
 * Run: node scripts/check-headline-sentiment.ts
 *
 * WHY THIS FILE EXISTS. `keywordScore` matched with `String.includes`, over a
 * list containing `ath`, `up`, `gain`, `calls`, `red`, `long` and `fall`. On
 * real headlines that did not approximate sentiment — **it reversed it**:
 *
 *   "Death cross forms as S&P 500 breaks support"  → 100/100 BULLISH
 *   "Ford recalls 100,000 trucks"                  → 100/100 BULLISH
 *   "Analysts warn against prolonged downturn"     →  75/100 BULLISH
 *
 * `ath` in "de-ATH", `calls` in "re-CALLS", `gain` in "a-GAIN-st", `long` in
 * "pro-LONG-ed", `up` in "s-UP-port", `red` in "p-RED-icted". The single most
 * bearish phrase in technical analysis scored maximum bullish, on a live
 * indicator carrying 0.08 of the social-sentiment composite and labelled
 * "Market headline pulse".
 *
 * WHY IT COULD NOT BE WRITTEN BEFORE. The scorer lived in
 * `lib/sentiment-sources.ts`, which imports `@/lib/api-keys` and so cannot be
 * loaded by any check script. Phase 7.0's lesson applied a third time: the
 * import graph had been deciding what gets tested. It is in the import-free
 * `lib/headline-sentiment.ts` now.
 *
 * WHAT THIS CANNOT DO. It cannot tell you the word lists are *good* — they are
 * crude retail vocabulary and always were. It pins that they are not
 * CROSS-CUTTING: that a word only fires on itself.
 */

import { keywordScore } from "../lib/headline-sentiment.ts"

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

/** The three headlines measured against the broken implementation. */
const REGRESSIONS: Array<{ text: string; wasScore: number }> = [
  { text: "Death cross forms as S&P 500 breaks support", wasScore: 100 },
  { text: "Ford recalls 100,000 trucks", wasScore: 100 },
  { text: "Analysts warn against prolonged downturn", wasScore: 75 },
]

// ALL THREE must now register NOTHING, and the first draft of this check
// asserted otherwise — it expected "Death cross" and "prolonged downturn" to
// come out BEARISH. They do not, and the code is right: none of those headlines
// contains a word from the lists. "downturn" is not "down", "death" is not a
// word in either list, and the bearishness a human reads is not vocabulary the
// scorer has. Asserting a bearish score there would have been asserting an
// ability the lists do not have — the same over-claim this audit exists to
// remove, committed inside a check written to remove it.
for (const r of REGRESSIONS) {
  const { bullish, bearish } = keywordScore([r.text])
  check(
    `"${r.text.slice(0, 42)}…" registers no sentiment at all`,
    bullish === 0 && bearish === 0,
    `was ${r.wasScore}/100 BULLISH under substring matching, now ${bullish}B/${bearish}Be`,
  )
}

// --------------------------------------------------------- the collisions

/**
 * Each pair is (text, word-it-used-to-trigger). None may register anything:
 * the headline contains no sentiment word, only a string that contains one.
 */
const COLLISIONS: Array<[string, string]> = [
  ["Supply chain disruption widens", "up (in supply)"],
  ["Fed credited with steadying markets", "red (in credited)"],
  ["Shortage of chips persists", "short (in shortage)"],
  ["Company announces buyback programme", "buy — legitimately present, kept"],
  ["Weather delays shipments", "ath (in weather)"],
  ["Alongside the rally, volumes fell", "long (in alongside)"],
]

for (const [text, note] of COLLISIONS) {
  const { bullish, bearish } = keywordScore([text])
  // "buyback" genuinely contains the standalone-ish word `buy`? No — \bbuy\b
  // does not match "buyback", so this one must also register nothing. It is in
  // the list precisely to prove the boundary is on BOTH sides.
  const expectQuiet = !/rally|fell/i.test(text)
  if (expectQuiet) {
    check(`"${text}" registers nothing`, bullish === 0 && bearish === 0, `${note} → ${bullish}B/${bearish}Be`)
  }
}

// The one above that DOES contain real words, to prove the check is not simply
// asserting silence everywhere.
{
  const { bullish, bearish } = keywordScore(["Alongside the rally, volumes fell"])
  check(
    "a headline with a genuine word still registers it",
    bullish === 1 && bearish === 0,
    `"rally" matches; "fell" does NOT, because the list holds "fall" — ${bullish}B/${bearish}Be. ` +
      `"Alongside" no longer fires \blong\b, which is the whole fix.`,
  )
}

// ------------------------------------------------------- no double-counting

{
  const { bullish } = keywordScore(["Stocks bullish as bulls charge higher"])
  check(
    "stem pairs no longer double-count",
    bullish === 1,
    `bull/bullish both fired under substring matching; now ${bullish} (only \\bbullish\\b matches — "bulls" is plural and not in the list)`,
  )
}

// ------------------------------------------------------------- the basics

check("a plainly bullish headline scores above 50", keywordScore(["Stocks rally on strong gains"]).score > 50)
check("a plainly bearish headline scores below 50", keywordScore(["Market crash fears as stocks tank"]).score < 50)
check(
  "no sentiment words gives the documented midpoint with zero counts",
  keywordScore(["Quarterly filing submitted to regulator"]).bullish === 0 &&
    keywordScore(["Quarterly filing submitted to regulator"]).bearish === 0 &&
    keywordScore(["Quarterly filing submitted to regulator"]).score === 50,
  "callers treat bullish+bearish===0 as no-data; the 50 is never published on its own",
)
check("an empty input is handled", keywordScore([]).bullish === 0 && keywordScore([""]).bearish === 0)

if (failures > 0) {
  console.error(`\n${failures} headline-sentiment check(s) failed.`)
  process.exit(1)
}
