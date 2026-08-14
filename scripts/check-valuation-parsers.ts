/**
 * The free valuation parsers, and the block-page detector that makes them safe.
 *
 * Run: node scripts/check-valuation-parsers.ts
 *
 * WHY THIS FILE EXISTS (P7-75). `spxPE` and `spxPS` are 30 of CCPI Valuation's
 * 100 points, and `equityRiskPremium` (10 more) is derived from the P/E. Both
 * came from Apify or FMP, and on both hosts neither answered. multpl.com
 * publishes them free — so a parser now stands between a public web page and a
 * scored crash index, which is the most consequential place a parser can stand.
 *
 * The fixtures below are REAL captures, not hand-written HTML. The AAII one
 * matters most: aaii.com answers a plain server-side fetch with HTTP 200 and an
 * Imperva interstitial, and a probe that trusted the status code reported it as
 * a working free source for one turn on exactly that evidence.
 */

import { looksBlocked, parseMultplPE, parseMultplPS } from "../lib/valuation-parsers.ts"

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

/** Real `<meta>` line from multpl.com, captured 2026-08-14. Padded to a plausible page size. */
const PAD = "x".repeat(60_000)
const MULTPL_PE_HTML =
  `<meta name="description" content="S&P 500 PE Ratio chart, historic, and current data. Current S&P 500 PE Ratio is 30.06, a change of +0.21 from previous market close." />` +
  PAD
const MULTPL_PS_HTML =
  `<meta name="description" content="S&P 500 Price to Sales Ratio chart, historic, and current data. Current S&P 500 Price to Sales Ratio is 3.85, a change of +0.03 from previous market close." />` +
  PAD

/** Real opening of the aaii.com interstitial, captured 2026-08-14. ~6 KB in the wild. */
const AAII_BLOCK_HTML = `<!DOCTYPE html>
<html>
<head>
    <noscript>
        <title>Pardon Our Interruption</title>
    </noscript>
    <meta name="robots" content="noindex, nofollow">
</head><body>${"y".repeat(5000)}</body></html>`

// ------------------------------------------------------------------ parsing

check("the S&P P/E is read from the meta description", parseMultplPE(MULTPL_PE_HTML) === 30.06, String(parseMultplPE(MULTPL_PE_HTML)))
check("the S&P P/S is read from the meta description", parseMultplPS(MULTPL_PS_HTML) === 3.85, String(parseMultplPS(MULTPL_PS_HTML)))

check(
  "the P/E parser does not pick up the P/S page's number",
  parseMultplPE(MULTPL_PS_HTML) === null,
  "each parser matches its own sentence, not any number on the page",
)
check("the P/S parser does not pick up the P/E page's number", parseMultplPS(MULTPL_PE_HTML) === null)

// ------------------------------------------------------------------ refusal

check("an empty body yields null", parseMultplPE("") === null)
check("a page without the sentence yields null", parseMultplPE(`<html>${PAD}</html>`) === null)

/**
 * The band exists to reject a bad parse, not to judge the market. A P/E of 0 is
 * a parse failure; so is 5000.
 */
const outOfBand = (v: string) =>
  `<meta content="Current S&P 500 PE Ratio is ${v}, a change of +0.01 from previous market close." />` + PAD
check("a zero P/E is rejected as a parse failure", parseMultplPE(outOfBand("0")) === null)
check("an absurd P/E is rejected as a parse failure", parseMultplPE(outOfBand("5000")) === null)
check("a plausible P/E inside the band is accepted", parseMultplPE(outOfBand("44.5")) === 44.5)

// ------------------------------------------------- the 200-is-not-an-answer case

check(
  "the aaii interstitial is detected as blocked",
  looksBlocked(AAII_BLOCK_HTML, 20_000),
  "HTTP 200 with 6 KB of 'Pardon Our Interruption'",
)
check(
  "a real page of plausible size is NOT flagged as blocked",
  !looksBlocked(MULTPL_PE_HTML, 5000),
  `${MULTPL_PE_HTML.length} bytes`,
)
check(
  "a suspiciously small body is blocked even without a known marker",
  looksBlocked("<html><body>nothing here</body></html>", 20_000),
  "vendor marker lists only catch the vendors already seen",
)
check("an empty body is blocked", looksBlocked("", 0))

/**
 * The whole point, stated as one assertion: a block page must never yield a
 * number. If this ever fails, a bot wall is feeding the crash index.
 */
const BLOCK_WITH_A_NUMBER =
  `<html><head><title>Pardon Our Interruption</title></head><body>Current S&P 500 PE Ratio is 30.06</body></html>`
check(
  "a block page containing the sentence still yields null",
  parseMultplPE(BLOCK_WITH_A_NUMBER) === null,
  "a bot wall must never feed a scored indicator",
)

if (failures > 0) {
  console.error(`\n${failures} valuation-parser check(s) failed.`)
  process.exit(1)
}
console.log("\nAll valuation-parser checks passed.")
