/**
 * Beta is a regression, and it refuses rather than guesses.
 *
 * Run: node scripts/check-beta.ts
 *
 * WHY THIS FILE EXISTS (P7-21). `/api/strategy-scanner` shipped ~25 hardcoded
 * betas with no source and a `|| 0.7` for anything absent, in a column users
 * read as market data. `lib/beta.ts` computes them from stored closes instead.
 * These assertions pin the two things that make that an improvement rather than
 * a different guess: the arithmetic is right, and it says no when it should.
 *
 * The cases with known answers are constructed, not sampled — a series that is
 * exactly 2× the benchmark must return exactly 2.0, and a check that only
 * compares against live data can never tell a correct implementation from a
 * consistent one.
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  computeBeta,
  dailyReturns,
  DEFAULT_BETA_WINDOW_DAYS,
  R_SQUARED_NEEDS_DISCLOSURE,
} from "../lib/beta.ts"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps

/** Every file under `dir` matching `match`, recursively. */
function walk(dir: string, match: (p: string) => boolean): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full, match))
    else if (match(full)) out.push(full)
  }
  return out
}

/** N trading days as YYYY-MM-DD, oldest first. Weekends are irrelevant here. */
function days(n: number, start = "2025-01-01"): string[] {
  const out: string[] = []
  const d = new Date(start + "T00:00:00Z")
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

/** A benchmark that wanders deterministically — no Math.random (it is banned). */
function benchmarkSeries(n: number): { day: string; close: number }[] {
  const ds = days(n)
  let price = 100
  return ds.map((day, i) => {
    price *= 1 + Math.sin(i * 1.7) * 0.01
    return { day, close: price }
  })
}

/** A stock whose daily return is exactly `k ×` the benchmark's. */
function leveredSeries(bench: { day: string; close: number }[], k: number) {
  const rb = dailyReturns(bench.map((b) => b.close))
  let price = 50
  const out = [{ day: bench[0].day, close: price }]
  for (let i = 0; i < rb.length; i++) {
    price *= 1 + k * rb[i]
    out.push({ day: bench[i + 1].day, close: price })
  }
  return out
}

// --------------------------------------------------------------- returns

check("returns are close-to-close, oldest first", (() => {
  const r = dailyReturns([100, 110, 99])
  return near(r[0], 0.1) && near(r[1], -0.1)
})())
check("a single close yields no returns", dailyReturns([100]).length === 0)
check("an empty series yields no returns", dailyReturns([]).length === 0)
check(
  "a zero or negative previous close does not divide",
  Number.isNaN(dailyReturns([0, 100])[0]) && Number.isNaN(dailyReturns([-5, 100])[0]),
  "a 0 close would produce Infinity, and Infinity renders as a number on a page",
)

// ------------------------------------------------------------ known betas

const bench = benchmarkSeries(400)

for (const k of [0.5, 1.0, 1.5, 2.0]) {
  const r = computeBeta(leveredSeries(bench, k), bench)
  check(
    `a stock levered exactly ${k}× the benchmark has beta ${k}`,
    r !== null && near(r.beta, k, 1e-6),
    r ? `${r.beta.toFixed(6)} over ${r.observations} obs, R²=${r.rSquared.toFixed(4)}` : "null",
  )
  check(
    `…and R² is 1 for a perfectly levered series (k=${k})`,
    r !== null && near(r.rSquared, 1, 1e-6),
    r ? r.rSquared.toFixed(6) : "null",
  )
}

const self = computeBeta(bench, bench)
check("the benchmark against itself has beta 1", self !== null && near(self.beta, 1, 1e-9), `${self?.beta}`)

const inverse = computeBeta(leveredSeries(bench, -1), bench)
check(
  "an inverse fund has beta -1, not |beta| 1",
  inverse !== null && near(inverse.beta, -1, 1e-6),
  `${inverse?.beta.toFixed(6)} — a sign lost here would rank a short fund as defensive`,
)

// --------------------------------------------------------------- refusals

check(
  "too few paired observations returns null, not a small beta",
  computeBeta(leveredSeries(bench, 1).slice(0, 60), bench.slice(0, 60)) === null,
  "a beta from 60 days is not a small beta, it is not a beta",
)
check("an empty stock series returns null", computeBeta([], bench) === null)
check("an empty benchmark returns null", computeBeta(leveredSeries(bench, 1), []) === null)
check(
  "a motionless benchmark returns null rather than dividing by zero",
  computeBeta(
    leveredSeries(bench, 1),
    bench.map((b) => ({ day: b.day, close: 100 })),
  ) === null,
  "varX = 0 would yield Infinity",
)
check(
  "non-array inputs return null rather than throwing",
  computeBeta(null as never, bench) === null && computeBeta(bench, undefined as never) === null,
)

// ------------------------------------------------------- date alignment

/**
 * THE ONE THAT MATTERS. Two series with different holiday coverage mis-pair if
 * zipped by index, and every resulting number looks reasonable. This is P6-16's
 * rule — never count back N rows on a series — restated for prices.
 */
const shifted = leveredSeries(bench, 2)
const benchWithHoliday = bench.filter((_, i) => i !== 100)
const aligned = computeBeta(shifted, benchWithHoliday)
check(
  "a missing benchmark day is dropped, not silently mis-paired",
  aligned !== null && near(aligned.beta, 2, 0.05),
  aligned ? `${aligned.beta.toFixed(4)} with ${aligned.observations} obs` : "null",
)
check(
  "the gap costs observations rather than accuracy",
  aligned !== null && aligned.observations < (computeBeta(shifted, bench)?.observations ?? 0),
  "if the count did not drop, the missing day was bridged rather than skipped",
)

const disjoint = computeBeta(
  leveredSeries(bench, 1).map((s) => ({ day: `19${s.day.slice(2)}`, close: s.close })),
  bench,
)
check(
  "series with no overlapping dates return null, not a beta of the wrong pairs",
  disjoint === null,
  "index-zipping would have happily returned 1.0 here",
)

// ----------------------------------------------------------- provenance

const r2 = computeBeta(leveredSeries(bench, 1), bench)
check(
  "the window is dated, so the figure can be shown with an as-of",
  r2 !== null && /^\d{4}-\d{2}-\d{2}$/.test(r2.from) && /^\d{4}-\d{2}-\d{2}$/.test(r2.to) && r2.from < r2.to,
  r2 ? `${r2.from} → ${r2.to}` : "null",
)
check(
  "the R² disclosure threshold is a real threshold, not zero",
  R_SQUARED_NEEDS_DISCLOSURE > 0 && R_SQUARED_NEEDS_DISCLOSURE < 1,
  `${R_SQUARED_NEEDS_DISCLOSURE} — below it the beta must be shown WITH its R², not suppressed`,
)
check(
  "the default window is long enough to be a beta at all",
  DEFAULT_BETA_WINDOW_DAYS >= 500,
  `${DEFAULT_BETA_WINDOW_DAYS} trading days — measured on the store, KO is 0.257 over five years and −0.022 over two`,
)

/**
 * Beta is a valid regression coefficient at ANY R². The first draft suppressed
 * it below 0.1, which would have hidden the most useful fact a stability screen
 * can learn — that a candidate barely tracks the market. Pinned so the
 * suppression cannot come back as a tidy-up.
 */
const decoupled = (() => {
  // A stock driven by an INCOMMENSURABLE frequency. The first attempt lagged the
  // benchmark by two days and the check caught it at R²=0.91 — a lagged sine is
  // still a sine, so the fixture did not build the thing it claimed to. Worth
  // leaving recorded: **a negative test that does not produce the negative
  // condition proves nothing**, and it looked entirely reasonable.
  const b = benchmarkSeries(400)
  const ds = b.map((x) => x.day)
  let price = 40
  const out = [{ day: ds[0], close: price }]
  for (let i = 1; i < ds.length; i++) {
    price *= 1 + Math.sin(i * 0.37) * 0.009
    out.push({ day: ds[i], close: price })
  }
  return computeBeta(out, b)
})()
check(
  "a decoupled stock still returns a beta rather than null",
  decoupled !== null,
  decoupled ? `β=${decoupled.beta.toFixed(3)}, R²=${decoupled.rSquared.toFixed(3)}` : "null — suppression is back",
)
check(
  "…and its low R² is reported so the caller can disclose it",
  decoupled !== null && decoupled.rSquared < R_SQUARED_NEEDS_DISCLOSURE,
  decoupled ? decoupled.rSquared.toFixed(4) : "n/a",
)

// ------------------------------------------------- the call site (P7-21)

/**
 * The arithmetic being right is half of it. The other half is that the route
 * stopped carrying 25 hand-typed constants, and that the NULL a regression
 * returns does not become a number on the way to the screen.
 *
 * `beta` fed three things: the strategy branch, the ranking score, and the
 * reason string. Each had to learn about absence separately — P6-34's rule that
 * introducing a null is half a change, arriving for the fourth time.
 */
/**
 * Comments stripped before scanning. SIXTH instance of "a check that names its
 * own findings will match itself": the rule banning `STOCK_BETAS[ticker] ||`
 * matched the comment written to record that the idiom was removed. One
 * alternation pass, ordered by position — block-then-line eats a line comment
 * containing a glob and everything after it.
 */
/**
 * The scanner's own source, wherever it now lives.
 *
 * P6-13 split `app/api/strategy-scanner/route.ts` into `lib/strategy-scanner/`,
 * and every beta assertion below lives in the calendar-spread generator, which
 * moved. Pointing this at the route file alone would have left nine PASS lines
 * reading exactly as they do now while asserting nothing — the failure CLAUDE.md
 * describes as a check that stops COVERING rather than stops running.
 *
 * So the set is derived from disk, and its size is asserted below.
 */
const SCANNER_FILES = [
  join(ROOT, "app/api/strategy-scanner/route.ts"),
  ...walk(join(ROOT, "lib/strategy-scanner"), (p) => p.endsWith(".ts")),
]
const routeRaw = SCANNER_FILES.map((f) => readFileSync(f, "utf8")).join("\n")
const routeSrc = routeRaw.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m, pre) =>
  m.startsWith("/*") ? " " + "\n".repeat((m.match(/\n/g) || []).length) : (pre ?? ""),
)

const MIN_SCANNER_FILES = 8
check(
  `scope: ${SCANNER_FILES.length} strategy-scanner source file(s)`,
  SCANNER_FILES.length >= MIN_SCANNER_FILES,
  `floor ${MIN_SCANNER_FILES} — the route plus lib/strategy-scanner/**`,
)
check(
  "the calendar-spread generator is inside the scanned set",
  SCANNER_FILES.some((f) => f.replace(/\\/g, "/").endsWith("generators/calendar-spreads.ts")),
  "every beta assertion below reads that file; without it they all pass vacuously",
)

check(
  "the hardcoded beta table is gone",
  !/const STOCK_BETAS/.test(routeSrc),
  "25 hand-typed constants with no source and no as-of date",
)
check(
  "no `|| 0.7` beta fallback survives",
  !/STOCK_BETAS\[ticker\]\s*\|\|/.test(routeSrc),
  "the invented default for any ticker not in the table",
)
check(
  "the route computes betas from the store",
  /betasForTickers\(tickers\.slice\(0, 25\)\)/.test(routeSrc),
  "one benchmark fetch for the batch",
)
check(
  "an unmeasurable beta stays null rather than defaulting",
  /const beta = betaResult\?\.beta \?\? null/.test(routeSrc),
)
check(
  "the signal branch handles a null beta explicitly",
  /} else if \(beta === null\) \{/.test(routeSrc),
  "`null < 0.6` is false, so the right answer by coercion is still not a decision",
)
check(
  "the quality score does not award points for an absent beta",
  /beta === null \? 0 : \(1\.5 - beta\) \* 20/.test(routeSrc),
  "`1.5 - 0` would have granted 30 points to a stock with no measurable beta",
)
check(
  "the reason string omits the beta clause rather than printing 0.00",
  /beta === null\s*\n\s*\? "beta unavailable"/.test(routeSrc),
  "on this scale 0.00 reads as perfectly market-neutral — the best thing a candidate can be",
)
check(
  "a low R² is disclosed in the reason the user reads",
  /SPY explains only/.test(routeSrc),
  "0.26 must not read as 'a quarter of the market's amplitude' when it means 'mostly does its own thing'",
)
check(
  "every beta ships with its window and benchmark",
  /betaProvenance:/.test(routeSrc) && /observations: betaResult\.observations/.test(routeSrc),
  "a beta without its window is the same claim the hardcoded table was making",
)

if (failures > 0) {
  console.error(`\n${failures} beta check(s) failed.`)
  process.exit(1)
}
