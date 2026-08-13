/**
 * Headline sentiment from a keyword list. (P7-47)
 *
 * IMPORT-FREE ON PURPOSE. It lived in `lib/sentiment-sources.ts`, which imports
 * `@/lib/api-keys` and therefore cannot be loaded by any check script — so the
 * scorer behind a public indicator was unassertable, and stayed wrong for as
 * long as nobody read it closely. That is the Phase 7.0 pattern again: the
 * import graph deciding what gets tested. Do not add imports here.
 *
 * The word lists are retail//social vocabulary and are deliberately crude; what
 * they must not be is CROSS-CUTTING, which is what substring matching made them.
 */

const BULLISH_WORDS = [
  "moon",
  "bull",
  "bullish",
  "calls",
  "rally",
  "pump",
  "rocket",
  "gain",
  "gains",
  "yolo",
  "buy",
  "long",
  "breakout",
  "surge",
  "up",
  "green",
  "ath",
  "squeeze",
]
const BEARISH_WORDS = [
  "crash",
  "dump",
  "bear",
  "bearish",
  "puts",
  "short",
  "down",
  "drop",
  "fall",
  "recession",
  "sell",
  "red",
  "tank",
  "collapse",
  "fear",
  "bubble",
  "rug",
  "bagholder",
]

/**
 * Word-boundary matchers, built once.
 *
 * P7-47. This used `t.includes(w)`, and substring matching on a list containing
 * `ath`, `up`, `gain`, `calls`, `red` and `long` did not approximate headline
 * sentiment — **it could invert it**. Measured against the real lists before
 * the fix:
 *
 *   "Death cross forms as S&P 500 breaks support"   → 100/100 BULLISH
 *   "Ford recalls 100,000 trucks"                   → 100/100 BULLISH
 *   "Analysts warn against prolonged downturn"      →  75/100 BULLISH
 *
 * `ath` inside "de**ath**", `calls` inside "re**calls**", `gain` inside
 * "a**gain**st", `long` inside "pro**long**ed", `up` inside "s**up**port",
 * `red` inside "p**red**icted". The most bearish headline in finance scored
 * maximum bullish.
 *
 * It also double-counted every stem pair — `bull` and `bullish` both fired on
 * "bullish", as did `bear`/`bearish` and `gain`/`gains` — so an emphatic
 * headline weighed twice. **Word boundaries fix both classes at once**:
 * `\bbull\b` does not match "bullish", so the pair stops colliding without the
 * lists needing to change.
 *
 * The indicator carries 0.08 of the social-sentiment composite and is labelled
 * "Market headline pulse". A number that can be exactly inverted is not a pulse.
 */
const BULLISH_RE = BULLISH_WORDS.map((w) => new RegExp(`\\b${w}\\b`, "i"))
const BEARISH_RE = BEARISH_WORDS.map((w) => new RegExp(`\\b${w}\\b`, "i"))

export function keywordScore(texts: string[]): { score: number; bullish: number; bearish: number } {
  let bullish = 0
  let bearish = 0
  for (const raw of texts) {
    const t = raw || ""
    for (const re of BULLISH_RE) if (re.test(t)) bullish++
    for (const re of BEARISH_RE) if (re.test(t)) bearish++
  }
  const total = bullish + bearish
  // 50 is only used as the mathematical midpoint when there is genuine data but
  // it is perfectly balanced — callers still treat total===0 as "no data".
  const score = total > 0 ? Math.round((bullish / total) * 100) : 50
  return { score, bullish, bearish }
}
