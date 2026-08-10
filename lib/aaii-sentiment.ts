/**
 * AAII investor-sentiment survey parsing.
 *
 * Dependency-free on purpose: `scripts/check-aaii-sentiment.ts` loads this
 * module directly under node's type stripping, which cannot resolve `@/...`
 * imports (see the check-suite note in AUDIT_BACKLOG / CLAUDE.md).
 */

export interface AAIIReading {
  score: number
  source: string
  bullish: number
}

const TRIPLE =
  /bullish\s*:?\s*(\d+(?:\.\d+)?)\s*%[\s\S]{0,40}?neutral\s*:?\s*(\d+(?:\.\d+)?)\s*%[\s\S]{0,40}?bearish\s*:?\s*(\d+(?:\.\d+)?)\s*%/gi

/**
 * Extracts THE AAII weekly reading from a page — and only when the page
 * contains exactly one.
 *
 * Two separate rules, both learned from the live page.
 *
 * 1. The three percentages must come from ONE record. The previous
 *    implementation ran two independent regexes across the whole document and
 *    paired whatever each matched first; www.aaii.com/sentimentsurvey carries
 *    ~121 chart-tooltip strings of history, so "first bullish" and "first
 *    bearish" were routinely from different weeks. It failed closed only by
 *    accident — the first tooltip reads 0.0%, which the range check rejected.
 *    A record is valid only if bullish/neutral/bearish sit adjacent and sum to
 *    100 (±1 for rounding); placeholder rows like 0/0/0 fail that test.
 *
 * 2. An undated reading is not a current reading. The page's tooltips carry no
 *    date, so with several valid records on the page there is no way to tell
 *    which week is this week — and "probably the first one" is exactly the kind
 *    of guess that gets published as live data. When the page yields more than
 *    one distinct valid record, this returns null and the caller reports the
 *    indicator as unavailable. That is the honest answer for the free scrape
 *    path; a dated feed (Nasdaq Data Link) is what would make AAII real again.
 */
export function parseAAII(html: string): AAIIReading | null {
  const seen = new Map<string, AAIIReading>()

  for (const m of html.matchAll(TRIPLE)) {
    const bullish = Number.parseFloat(m[1])
    const neutral = Number.parseFloat(m[2])
    const bearish = Number.parseFloat(m[3])
    if (![bullish, neutral, bearish].every((v) => Number.isFinite(v) && v >= 0 && v <= 100)) continue

    if (Math.abs(bullish + neutral + bearish - 100) > 1) continue
    if (bullish + bearish === 0) continue

    seen.set(`${bullish}/${neutral}/${bearish}`, {
      score: Math.round((bullish / (bullish + bearish)) * 100),
      source: "aaii_live",
      bullish,
    })
  }

  if (seen.size !== 1) return null
  return seen.values().next().value ?? null
}
