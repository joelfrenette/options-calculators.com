/**
 * AAII survey parsing checks — lib/aaii-sentiment.ts.
 *
 * Run: node scripts/check-aaii-sentiment.ts
 *
 * WHY THIS EXISTS. The old parser ran two independent regexes over the whole
 * aaii.com page and paired whatever each matched first. That page is a chart
 * script carrying ~121 tooltip strings of historical weeks, so "first bullish"
 * and "first bearish" came from different records — the fixtures below are cut
 * from the real page, where the third bullish tooltip reads 50.0% while the
 * third bearish reads 0.0%. The old code only failed closed by accident: the
 * very first tooltip is 0.0%, which its range check rejected. Reorder the page
 * and it publishes a two-weeks-apart pair labelled `aaii_live`.
 *
 * A percentage pair is not reviewable by reading — it needs a fixture with the
 * real page's ordering in it.
 */

import { parseAAII } from "../lib/aaii-sentiment.ts"

let failures = 0
function check(name: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`)
  } else {
    failures++
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

// ---------------------------------------------------------------------------
// 1. THE REGRESSION: real page ordering, cut from www.aaii.com/sentimentsurvey.
// ---------------------------------------------------------------------------
const REAL_PAGE_HEAD = [
  'var AX = "bullish: 0.0%<br> neutral: 0.0%<br> bearish: 0.0%";',
  'var AY = "bullish: 50.0%<br> neutral: 0.0%<br> bearish: 50.0%";',
  'var AZ = "bullish: 36.8%<br> neutral: 31.6%<br> bearish: 31.6%";',
  'var BA = "bullish: 27.8%<br> neutral: 30.0%<br> bearish: 42.2%";',
].join("\n")

// The page carries several valid, undated records. There is no way to know
// which week is current, so the honest answer is no reading at all.
const real = parseAAII(REAL_PAGE_HEAD)
check("real page: several undated records → null, not a guess", real === null, real ? `score ${real.score}` : "null")

// The old defect: bullish from one record, bearish from another.
const MISMATCHED = 'bullish: 36.8%<br> neutral: 31.6%<br> bearish: 31.6%\n... 40 weeks later ...\nbearish: 12.0%'
const mismatched = parseAAII(MISMATCHED)
check(
  "a later stray 'bearish' cannot displace the co-located one",
  mismatched !== null && mismatched.score === 54,
  mismatched ? `score ${mismatched.score}` : "null",
)

// One record repeated (page header + chart series) is still one record.
const REPEATED = 'bullish: 36.8% neutral: 31.6% bearish: 31.6%\n\nbullish: 36.8% neutral: 31.6% bearish: 31.6%'
check("the same record twice is one reading, not ambiguity", parseAAII(REPEATED)?.score === 54)

// Two genuinely different weeks are ambiguous.
const TWO_WEEKS = 'bullish: 36.8% neutral: 31.6% bearish: 31.6%\n\nbullish: 27.8% neutral: 30.0% bearish: 42.2%'
check("two distinct weeks → null", parseAAII(TWO_WEEKS) === null)

// ---------------------------------------------------------------------------
// 2. Placeholder and incoherent records assert nothing.
// ---------------------------------------------------------------------------
check("0/0/0 placeholder → null", parseAAII("bullish: 0.0% neutral: 0.0% bearish: 0.0%") === null)
check("50/0/50 placeholder sums to 100 but is a real shape", parseAAII("bullish: 50.0% neutral: 0.0% bearish: 50.0%")?.score === 50)
check("sum 80 → null", parseAAII("bullish: 30% neutral: 20% bearish: 30%") === null)
check("sum 120 → null", parseAAII("bullish: 50% neutral: 40% bearish: 30%") === null)
check("sum 99 is inside rounding tolerance", parseAAII("bullish: 33% neutral: 33% bearish: 33%")?.score === 50)
check("sum 101 is inside rounding tolerance", parseAAII("bullish: 34% neutral: 33% bearish: 34%")?.score === 50)

// ---------------------------------------------------------------------------
// 3. Missing / malformed input asserts nothing.
// ---------------------------------------------------------------------------
check("empty page → null", parseAAII("") === null)
check("bullish alone → null", parseAAII("bullish: 36.8%") === null)
check("bullish + bearish without neutral → null", parseAAII("bullish: 40% bearish: 30%") === null)
check("wrong order (bearish first) → null", parseAAII("bearish: 31.6% neutral: 31.6% bullish: 36.8%") === null)
check(
  "records more than 40 chars apart do not pair",
  parseAAII(`bullish: 36.8%${" ".repeat(60)}neutral: 31.6% bearish: 31.6%`) === null,
)
check("over 100% → null", parseAAII("bullish: 140% neutral: -40% bearish: 0%") === null)

// ---------------------------------------------------------------------------
// 4. A valid reading still reads correctly.
// ---------------------------------------------------------------------------
const bullWeek = parseAAII("Bullish: 55.0% Neutral: 25.0% Bearish: 20.0%")
check("bullish week scores above 50", bullWeek?.score === 73, String(bullWeek?.score))
const bearWeek = parseAAII("Bullish: 20.0% Neutral: 25.0% Bearish: 55.0%")
check("bearish week scores below 50", bearWeek?.score === 27, String(bearWeek?.score))
check("source label is aaii_live on success", bearWeek?.source === "aaii_live")

console.log(failures === 0 ? "\nAll AAII sentiment checks passed." : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
