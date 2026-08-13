/**
 * No single article set carries a hidden share of the sentiment composite.
 *
 * Run: node scripts/check-social-sentiment-weights.ts
 *
 * WHY THIS FILE EXISTS (P6-65). "Finnhub News" and "News Fear & Greed" are two
 * lenses over ONE Finnhub general-news article set. As separate indicator rows
 * they carried 0.11 + 0.08 = 0.19, which is **30% of the total weight resting on
 * one feed** — and it was invisible, because the table was per-indicator while
 * the risk is per-corpus. Read down the weight column: six sources, none above
 * 0.16, nothing to see. Read down the corpus column: one article set, 30%.
 *
 * **A table can hide a concentration by being sorted the wrong way**, and no
 * amount of reading the weights would have surfaced it. The corpus field is what
 * makes this checkable at all.
 *
 * WHAT IT CANNOT DO. It cannot tell whether a corpus id is honest. Labelling the
 * two Finnhub rows with different corpus ids would pass every check here — which
 * is the same limit `check-backlog-ledger` states about statuses. What it
 * prevents is the silent case: a second lens added to an existing feed, or a
 * weight nudged up, without anyone re-computing the share.
 *
 * SCOPE IS ASSERTED (P6-77): the row count and the corpus count both have
 * baselines, so a table that collapses cannot report the same PASS lines as one
 * that is intact.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  MAX_MULTI_ROW_CORPUS_SHARE,
  SENTIMENT_WEIGHTS,
  corpusShares,
  multiRowCorpora,
  totalWeight,
  weightFor,
} from "../lib/social-sentiment-weights.ts"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const ROUTE = "app/api/social-sentiment/route.ts"

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

const routeSrc = readFileSync(join(ROOT, ROUTE), "utf8")

const EXPECTED_ROWS = 6
const EXPECTED_CORPORA = 5

check(
  `scope: ${SENTIMENT_WEIGHTS.length} indicator row(s)`,
  SENTIMENT_WEIGHTS.length === EXPECTED_ROWS,
  SENTIMENT_WEIGHTS.map((w) => w.name).join(", "),
)

const shares = corpusShares()
check(
  `scope: ${Object.keys(shares).length} distinct corpus(es)`,
  Object.keys(shares).length === EXPECTED_CORPORA,
  Object.keys(shares).join(", "),
)

// ---------------------------------------------------------------------------
// Shape.
// ---------------------------------------------------------------------------

for (const row of SENTIMENT_WEIGHTS) {
  check(
    `${row.name}: weight is a positive finite number`,
    Number.isFinite(row.weight) && row.weight > 0,
    `${row.weight}`,
  )
  check(`${row.name}: names a corpus`, typeof row.corpus === "string" && row.corpus.length > 0, row.corpus)
  check(`${row.name}: group is macro or social`, row.group === "macro" || row.group === "social", row.group)
}

const names = SENTIMENT_WEIGHTS.map((w) => w.name)
check("no indicator name is listed twice", new Set(names).size === names.length)
check("the weights sum to something positive", totalWeight() > 0, `${totalWeight().toFixed(2)}`)

// ---------------------------------------------------------------------------
// The concentration cap — the finding itself.
// ---------------------------------------------------------------------------

const multi = multiRowCorpora()
check(
  `${multi.length} corpus(es) are read by more than one indicator`,
  multi.length > 0,
  multi.length ? multi.join(", ") : "none — if this ever reads zero, the corpus ids stopped distinguishing anything",
)

for (const corpus of multi) {
  const share = shares[corpus]
  check(
    `"${corpus}" is read twice and holds ${(share * 100).toFixed(1)}% of the weight (cap ${(MAX_MULTI_ROW_CORPUS_SHARE * 100).toFixed(0)}%)`,
    share <= MAX_MULTI_ROW_CORPUS_SHARE + 1e-9,
    `two lenses on one witness is not two witnesses`,
  )
}

check(
  "the Finnhub general-news corpus is below the pre-P6-65 level",
  shares["finnhub-general-news"] < 0.29,
  `${(shares["finnhub-general-news"] * 100).toFixed(1)}% now; it was 29.7% when the finding was written`,
)
check(
  "the Finnhub pair keeps its previous 11:8 ordering — the headline lens still outweighs the word count",
  (weightFor("Finnhub News") ?? 0) > (weightFor("News Fear & Greed") ?? 0),
  `${weightFor("Finnhub News")} vs ${weightFor("News Fear & Greed")}`,
)
check(
  "both Finnhub rows still declare the same corpus — renaming one would defeat the cap",
  SENTIMENT_WEIGHTS.filter((w) => w.name === "Finnhub News" || w.name === "News Fear & Greed").every(
    (w) => w.corpus === "finnhub-general-news",
  ),
)

// ---------------------------------------------------------------------------
// The route reads the table rather than re-listing it. A second copy of these
// numbers is how the first one drifted out of anyone's view.
// ---------------------------------------------------------------------------

check(
  "the route imports the shared weight table",
  /from "@\/lib\/social-sentiment-weights"/.test(routeSrc),
  ROUTE,
)
for (const row of SENTIMENT_WEIGHTS) {
  check(
    `the route reads "${row.name}" weight from the table`,
    new RegExp(`name: "${row.name.replace(/[&]/g, "&")}"[^}]*weight: w\\("${row.name}"\\)`).test(routeSrc),
  )
}
check(
  "no numeric weight literal remains in the route's indicator list",
  !/name: "[^"]+", score: [^,]+, source: [^,]+, weight: [0-9]/.test(routeSrc),
  "a literal here is a second definition of a number the table owns",
)

if (failures > 0) {
  console.error(`\n${failures} social-sentiment weight check(s) failed.`)
  process.exit(1)
}
