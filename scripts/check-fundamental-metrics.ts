/**
 * The Sell Put scanner's Step 3 arithmetic does what its comments claim.
 *
 * Run: node scripts/check-fundamental-metrics.ts
 *
 * WHY THIS FILE EXISTS. Every null-integrity fix this audit made to the
 * fundamental scan — P6-24's "a partial year is not a year", the unknown-equity
 * D/E, the unmeasured market cap that used to render "$0.0B" — was written
 * inside an async loop that fetches three Polygon endpoints per ticker. **None
 * of it could be asserted.** The scan's correctness rested entirely on the
 * comments recording it, and the Phase 7 synthesis's fourth shape is exactly
 * that: an untested claim in a comment is a constraint nobody tests.
 *
 * P6-13's split moved the arithmetic into the import-free
 * `components/scanner/fundamental-metrics.ts`, which this file can load. The
 * audit's own measured highest-yield technique is "write an assertion for
 * anything untested" — it found a real defect four times out of four — so this
 * is that technique applied to the scanner's money math.
 *
 * WHAT IT CANNOT DO. It asserts the DERIVATION, not the data. Polygon can still
 * report a wrong net income and every check here will pass; what it prevents is
 * a missing input being turned into a confident number, which is the failure
 * this codebase actually commits.
 *
 * The premium estimate is asserted for SHAPE only — the clamp bounds, the
 * earnings bump window, the ATR fallback — because 0.4 and the 7-day reference
 * expiry are heuristic parameters, not quantities with a right answer. Pinning
 * them as if they were measured would be the same over-claim the audit removes.
 */

import {
  deriveFundamentals,
  estimatePremium,
  extractEarningsData,
  sortQuarterRows,
} from "../components/scanner/fundamental-metrics.ts"

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

/** A quarterly filing with the fields the derivation reads. */
function quarter(opts: {
  end: string
  netIncome?: number | null
  eps?: number | null
  equity?: number | null
  liabilities?: number | null
  basicShares?: number
}) {
  const income: Record<string, { value: unknown }> = {}
  if (opts.netIncome !== undefined && opts.netIncome !== null) {
    income.net_income_loss = { value: opts.netIncome }
  }
  if (opts.eps !== undefined && opts.eps !== null) {
    income.diluted_earnings_per_share = { value: opts.eps }
  }
  if (opts.basicShares !== undefined) income.basic_average_shares = { value: opts.basicShares }

  const balance: Record<string, { value: unknown }> = {}
  if (opts.equity !== undefined && opts.equity !== null) balance.equity = { value: opts.equity }
  if (opts.liabilities !== undefined && opts.liabilities !== null) {
    balance.liabilities = { value: opts.liabilities }
  }

  return { end_date: opts.end, financials: { income_statement: income, balance_sheet: balance } }
}

/** Four complete, profitable quarters with a clean balance sheet. */
const FOUR_GOOD = [
  quarter({ end: "2026-06-30", netIncome: 400, eps: 1.0, equity: 2000, liabilities: 1000, basicShares: 400 }),
  quarter({ end: "2026-03-31", netIncome: 300, eps: 0.75 }),
  quarter({ end: "2025-12-31", netIncome: 200, eps: 0.5 }),
  quarter({ end: "2025-09-30", netIncome: 100, eps: 0.25 }),
]

// ---------------------------------------------------------------------------
// Ordering. The derivation reads qRows[0] as "the latest filing", so a scan
// that received rows in filing order rather than reverse-chronological order
// would read a year-old balance sheet as current.
// ---------------------------------------------------------------------------

const shuffled = [FOUR_GOOD[2], FOUR_GOOD[0], FOUR_GOOD[3], FOUR_GOOD[1]]
const sorted = sortQuarterRows(shuffled)
check(
  "quarters sort newest-first regardless of arrival order",
  sorted.map((r) => r.end_date).join(",") === "2026-06-30,2026-03-31,2025-12-31,2025-09-30",
  sorted.map((r) => r.end_date).join(","),
)
check(
  "rows with no financials block are dropped before sorting",
  sortQuarterRows([...shuffled, { end_date: "2026-09-30" }]).length === 4,
)

// ---------------------------------------------------------------------------
// The four-quarter TTM gate. This is P6-24's rule and the one most likely to be
// "simplified" back: a two-quarter sum labelled trailing-twelve-month
// understates earnings and inflates every ratio derived from it.
// ---------------------------------------------------------------------------

const good = deriveFundamentals(FOUR_GOOD, { shares_outstanding: 1000 }, 50)
check("four reported quarters sum to a TTM net income", good.netIncome === 1000, `${good.netIncome}`)
check("four reported quarters sum to a TTM EPS", good.eps === 2.5, `${good.eps}`)
check("ttmQuarters reports how many of the four reported", good.ttmQuarters === 4, `${good.ttmQuarters}`)

for (const n of [1, 2, 3]) {
  const partial = deriveFundamentals(FOUR_GOOD.slice(0, n), { shares_outstanding: 1000 }, 50)
  check(
    `${n} quarter(s) of history yields a NULL TTM net income, not a short sum`,
    partial.netIncome === null,
    `${partial.netIncome}`,
  )
}

const oneGap = [
  FOUR_GOOD[0],
  quarter({ end: "2026-03-31", eps: 0.75 }), // net income absent
  FOUR_GOOD[2],
  FOUR_GOOD[3],
]
check(
  "four rows with one unreported net income still yields NULL",
  deriveFundamentals(oneGap, { shares_outstanding: 1000 }, 50).netIncome === null,
)
check(
  "a NaN net income is not a number for this purpose",
  deriveFundamentals(
    [quarter({ end: "2026-06-30", netIncome: Number.NaN, equity: 100, liabilities: 50 }), ...FOUR_GOOD.slice(1)],
    { shares_outstanding: 1000 },
    50,
  ).netIncome === null,
)

// EPS falls back to netIncome/shares ONLY when the TTM is itself complete.
const epsGap = [
  quarter({ end: "2026-06-30", netIncome: 400, equity: 2000, liabilities: 1000 }),
  quarter({ end: "2026-03-31", netIncome: 300 }),
  quarter({ end: "2025-12-31", netIncome: 200 }),
  quarter({ end: "2025-09-30", netIncome: 100 }),
]
const derivedEps = deriveFundamentals(epsGap, { shares_outstanding: 1000 }, 50)
check(
  "EPS falls back to a COMPLETE TTM net income over shares",
  derivedEps.eps === 1,
  `${derivedEps.eps}`,
)
check(
  "EPS stays null when the fallback's own TTM is incomplete",
  deriveFundamentals(epsGap.slice(0, 3), { shares_outstanding: 1000 }, 50).eps === null,
)

// ---------------------------------------------------------------------------
// Missing is null, never a flattering zero. Each of these rendered a confident
// number in production before the Phase 6 sweep.
// ---------------------------------------------------------------------------

const noBalance = deriveFundamentals(
  [quarter({ end: "2026-06-30", netIncome: 400, eps: 1.0 }), ...FOUR_GOOD.slice(1)],
  { shares_outstanding: 1000 },
  50,
)
check("unknown equity gives a NULL debt-to-equity, not 0 (= 'no debt')", noBalance.debtToEquity === null)
check("unknown equity gives a NULL ROE, not 0%", noBalance.roe === null)
check("unknown equity is reported as null, not 0", noBalance.stockholdersEquity === null)

check("a complete balance sheet gives a real D/E", good.debtToEquity === 0.5, `${good.debtToEquity}`)
check("a complete TTM and equity give a real ROE", good.roe === 50, `${good.roe}%`)

const zeroEquity = deriveFundamentals(
  [quarter({ end: "2026-06-30", netIncome: 400, eps: 1.0, equity: 0, liabilities: 1000 }), ...FOUR_GOOD.slice(1)],
  { shares_outstanding: 1000 },
  50,
)
check("zero equity does not divide — D/E is null", zeroEquity.debtToEquity === null)
check("zero equity does not divide — ROE is null", zeroEquity.roe === null)

const noShares = deriveFundamentals(FOUR_GOOD.slice(1), {}, 50)
check(
  "an unmeasurable market cap is NULL, not $0",
  noShares.marketCap === null,
  `${noShares.marketCap}`,
)
check("market cap is price × shares when shares are known", good.marketCap === 50000, `${good.marketCap}`)
check(
  "market cap falls back to the snapshot's own figure when shares are unknown",
  deriveFundamentals(FOUR_GOOD.slice(1), { market_cap: 12345 }, 50).marketCap === 12345,
)

check("P/E is price over a positive EPS", good.peRatio === 20, `${good.peRatio}`)
check(
  "P/E is null when EPS is unknown and the market-cap route is unavailable too",
  noShares.peRatio === null,
  `${noShares.peRatio}`,
)

const lossMaking = deriveFundamentals(
  [
    quarter({ end: "2026-06-30", netIncome: -400, eps: -1.0, equity: 2000, liabilities: 1000 }),
    quarter({ end: "2026-03-31", netIncome: -300, eps: -0.75 }),
    quarter({ end: "2025-12-31", netIncome: -200, eps: -0.5 }),
    quarter({ end: "2025-09-30", netIncome: -100, eps: -0.25 }),
  ],
  { shares_outstanding: 1000 },
  50,
)
check("a negative EPS yields no P/E rather than a negative one", lossMaking.peRatio === null, `${lossMaking.peRatio}`)
check("a loss-making company still reports a real, negative ROE", lossMaking.roe === -50, `${lossMaking.roe}%`)

// ---------------------------------------------------------------------------
// Consecutive profitable quarters. The slider gates on CONSECUTIVE, counted back
// from the most recent filing — a company profitable in 3 of its last 4 with the
// loss most recent has ZERO, not three.
// ---------------------------------------------------------------------------

check("four profitable quarters count as four", good.profitableQuarters === 4, `${good.profitableQuarters}`)

const recentLoss = [
  quarter({ end: "2026-06-30", netIncome: -50, equity: 2000, liabilities: 1000 }),
  quarter({ end: "2026-03-31", netIncome: 300 }),
  quarter({ end: "2025-12-31", netIncome: 200 }),
  quarter({ end: "2025-09-30", netIncome: 100 }),
]
check(
  "the streak breaks at the most recent quarter — 3 profitable of 4 counts as 0",
  deriveFundamentals(recentLoss, { shares_outstanding: 1000 }, 50).profitableQuarters === 0,
)
check(
  "a break mid-history stops the count there",
  deriveFundamentals(
    [FOUR_GOOD[0], FOUR_GOOD[1], quarter({ end: "2025-12-31", netIncome: -10 }), FOUR_GOOD[3]],
    { shares_outstanding: 1000 },
    50,
  ).profitableQuarters === 2,
)
check(
  "exactly break-even is not profitable",
  deriveFundamentals(
    [quarter({ end: "2026-06-30", netIncome: 0, equity: 1, liabilities: 1 }), ...FOUR_GOOD.slice(1)],
    { shares_outstanding: 1000 },
    50,
  ).profitableQuarters === 0,
)
check(
  "an empty filing set derives nothing rather than throwing",
  deriveFundamentals([], {}, 50).profitableQuarters === 0 && deriveFundamentals([], {}, 50).roe === null,
)

// ---------------------------------------------------------------------------
// The earnings extraction (S-17). One extraction, one format, one answer — the
// defect was two of each, with the displayed date and the premium bump reading
// different fields.
// ---------------------------------------------------------------------------

const NOW = new Date("2026-08-13T12:00:00Z")
const FIELDS = [
  ["earnings.announcement_date", { ticker: { earnings: { announcement_date: "2026-08-20T00:00:00Z" } } }],
  ["earnings_date", { ticker: { earnings_date: "2026-08-20T00:00:00Z" } }],
  ["next_earnings_date", { ticker: { next_earnings_date: "2026-08-20T00:00:00Z" } }],
  ["results.earnings.date", { results: { earnings: { date: "2026-08-20T00:00:00Z" } } }],
] as const

const EXPECTED_EARNINGS_FIELDS = 4
check(
  `scope: ${FIELDS.length} snapshot field(s) can carry the earnings date`,
  FIELDS.length === EXPECTED_EARNINGS_FIELDS,
  FIELDS.map(([n]) => n).join(", "),
)

const days = new Set<number | undefined>()
for (const [name, snapshot] of FIELDS) {
  const r = extractEarningsData(snapshot, NOW)
  days.add(r.daysToEarnings)
  check(`${name} produces a date`, r.earningsDate !== undefined, r.earningsDate)
}
check(
  "all four fields produce the SAME days-to-earnings — the S-17 defect was two answers to one question",
  days.size === 1,
  `${[...days].join(" / ")} day(s)`,
)

check("no earnings field at all leaves the date undefined", extractEarningsData({}, NOW).earningsDate === undefined)
check(
  "no earnings field at all leaves daysToEarnings undefined, not 0",
  extractEarningsData({}, NOW).daysToEarnings === undefined,
)
check(
  "a past earnings date yields a negative day count rather than being suppressed",
  (extractEarningsData({ ticker: { earnings_date: "2026-08-01T00:00:00Z" } }, NOW).daysToEarnings ?? 0) < 0,
)

// ---------------------------------------------------------------------------
// The premium ESTIMATE. Shape only — see the header.
// ---------------------------------------------------------------------------

const base = estimatePremium(100, 2, 2, undefined)
check("the put strike is 5% below spot", base.putStrike === 95, `${base.putStrike}`)
check("no earnings inside 14 days means no premium bump", base.premiumMultiplier === 1, `${base.premiumMultiplier}`)

check("earnings at 14 days out is the bottom of the bump", estimatePremium(100, 2, 2, 14).premiumMultiplier === 1.5)
check("earnings today is the top of the bump", estimatePremium(100, 2, 2, 0).premiumMultiplier === 1.8)
check("earnings 15 days out is outside the window", estimatePremium(100, 2, 2, 15).premiumMultiplier === 1)
check(
  "earnings already past is outside the window — no bump for a date that has gone",
  estimatePremium(100, 2, 2, -1).premiumMultiplier === 1,
)
check(
  "the bump rises monotonically as earnings approach",
  [14, 10, 7, 3, 0].every((d, i, a) =>
    i === 0 ? true : estimatePremium(100, 2, 2, d).premiumMultiplier > estimatePremium(100, 2, 2, a[i - 1]).premiumMultiplier,
  ),
)

check(
  "an unknown ATR falls through to the atrPercent placeholder rather than zeroing the premium",
  estimatePremium(100, null, 2.5).estimatedPremium > 0,
  `${estimatePremium(100, null, 2.5).estimatedPremium}`,
)
check(
  "a null ATR and the equivalent dollar ATR give the same premium",
  Math.abs(estimatePremium(100, null, 2.5, undefined).estimatedPremium - estimatePremium(100, 2.5, 2.5, undefined).estimatedPremium) < 1e-9,
)

check(
  "the yield clamp holds at the top — an extreme ATR cannot report more than 5%",
  estimatePremium(100, 50, 50, 0).finalYield === 5,
  `${estimatePremium(100, 50, 50, 0).finalYield}`,
)
check(
  "the yield clamp holds at the bottom — a near-zero ATR cannot report less than 0.5%",
  estimatePremium(100, 0.001, 0.001, undefined).finalYield === 0.5,
  `${estimatePremium(100, 0.001, 0.001, undefined).finalYield}`,
)
/**
 * A zero price does not divide, and that is the good half.
 *
 * The other half is P7-51, recorded rather than fixed here because it changes a
 * money surface: the 0.5% floor applies to a row with NO inputs at all. A
 * ticker whose snapshot carries neither a live nor a previous close reaches this
 * function with `currentPrice = 0`, fails on volume and incomplete fundamentals
 * (two failures, so it is a NEAR MISS and does appear in the relaxed Step 4
 * table), and renders a $0.00 strike beside a **0.50% yield** — a clamp bound
 * presented in the column where a measurement goes. This assertion pins the
 * current behaviour so the number is at least written down; whether the floor
 * should apply to an empty row is the owner's call.
 */
const emptyRow = estimatePremium(0, 0, 2.5, undefined)
check(
  "a zero price cannot divide — the yield is finite",
  Number.isFinite(emptyRow.finalYield),
  `${emptyRow.finalYield}`,
)
check(
  "P7-51, pinned not blessed: an all-inputs-missing row still reports the 0.5% clamp floor",
  emptyRow.finalYield === 0.5 && emptyRow.putStrike === 0 && emptyRow.estimatedPremium === 0,
  `strike $${emptyRow.putStrike}, premium $${emptyRow.estimatedPremium}, yield ${emptyRow.finalYield}%`,
)

if (failures > 0) {
  console.error(`\n${failures} fundamental-metrics check(s) failed.`)
  process.exit(1)
}
