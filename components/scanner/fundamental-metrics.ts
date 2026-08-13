// The Step 3 scan's arithmetic, separated from its fetching (P6-13).
//
// WHY THIS FILE EXISTS, beyond module size. Every one of the null-integrity
// fixes this audit made to the Sell Put scanner lives in the ~140 lines below —
// a partial TTM is null rather than a short sum, unknown equity is null rather
// than a flattering zero D/E, an unmeasured market cap is null rather than a
// confident "$0.0B" — and all of them sat inside an async loop that fetches
// three Polygon endpoints per ticker. **Nothing could assert any of it.** The
// audit's own measured highest-yield technique is "write an assertion for
// anything untested"; this file is what makes that possible here, and
// scripts/check-fundamental-metrics.ts is the assertion.
//
// THIS FILE MUST STAY IMPORT-FREE at runtime. Check scripts load it under
// node's native type stripping, where `@/…` aliases do not resolve. `import
// type` is erased before execution and is therefore safe; a value import is
// not. Do not "tidy" one in — see the same constraint on lib/ccpi/scoring.ts
// and lib/headline-sentiment.ts.
//
// Extracted verbatim from the scan loop: same expressions, same order, same
// null rules. The comments moved with the code they explain, because each of
// them records a defect that was live in production.

/** A Polygon quarterly financials row, as much of it as this file reads. */
export interface QuarterRow {
  financials?: {
    income_statement?: Record<string, { value?: unknown } | undefined>
    balance_sheet?: Record<string, { value?: unknown } | undefined>
  }
  end_date?: string
  shares_outstanding?: number
}

export interface DerivedFundamentals {
  /** Consecutive profitable quarters counted back from the most recent filing. */
  profitableQuarters: number
  /** How many of the four TTM quarters actually reported. */
  ttmQuarters: number
  /** Per-quarter TTM EPS, one entry per row examined; null where unreported. */
  quarterEPS: (number | null)[]
  netIncome: number | null
  stockholdersEquity: number | null
  totalLiabilities: number | null
  sharesOutstanding: number
  eps: number | null
  marketCap: number | null
  peRatio: number | null
  debtToEquity: number | null
  /** Percent. */
  roe: number | null
}

const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null

/** Quarterly filings, most recent first (sorted defensively by period end). */
export function sortQuarterRows(rows: unknown[]): QuarterRow[] {
  return (rows as QuarterRow[])
    .filter((r) => r?.financials)
    .sort((a, b) => String(b.end_date || "").localeCompare(String(a.end_date || "")))
}

export function deriveFundamentals(
  qRows: QuarterRow[],
  tickerData: { shares_outstanding?: number; weighted_shares_outstanding?: number; market_cap?: number } | null | undefined,
  currentPrice: number,
): DerivedFundamentals {
  const latestFinancials = qRows[0]?.financials || {}
  const income_statement = latestFinancials.income_statement || {}
  const balance_sheet = latestFinancials.balance_sheet || {}

  // Count CONSECUTIVE profitable quarters starting from the most recent
  // filing — this is what the "Min Profitable Quarters" slider now gates on.
  let profitableQuarters = 0
  for (const row of qRows) {
    const ni = finite(row.financials?.income_statement?.net_income_loss?.value)
    if (ni !== null && ni > 0) profitableQuarters++
    else break
  }

  // TTM figures — FOUR quarters, each of them actually reported.
  //
  // This used to read "graceful when fewer exist": `qRows.slice(0, 4)` summed
  // with `|| 0` per quarter, so a company with two filings on record produced a
  // TWO-quarter sum labelled trailing-twelve-month. That understates earnings
  // and inflates every P/E, EPS and ROE derived from it — and the shorter the
  // history, the more confident and the more wrong the number looked. A partial
  // year is not a year, so it is null.
  const ttmRows = qRows.slice(0, 4)
  const ttmQuarters = ttmRows.length
  const quarterlyNetIncome = ttmRows.map((row) => row.financials?.income_statement?.net_income_loss?.value)
  const netIncome: number | null =
    ttmQuarters === 4 && quarterlyNetIncome.every((v) => finite(v) !== null)
      ? (quarterlyNetIncome as number[]).reduce((sum, v) => sum + v, 0)
      : null

  // Balance-sheet legs: absent is unknown, not zero. `total_liabilities || 0`
  // reported a company with no balance sheet as debt-free.
  const stockholdersEquity = finite(balance_sheet.equity?.value)
  const totalLiabilities = finite(balance_sheet.liabilities?.value)

  // Extract shares outstanding from multiple possible sources
  const basic_shares = finite(income_statement.basic_average_shares?.value) ?? 0
  const sharesOutstanding =
    tickerData?.shares_outstanding ||
    tickerData?.weighted_shares_outstanding ||
    qRows[0]?.shares_outstanding ||
    basic_shares ||
    0

  // TTM EPS = sum of the last 4 quarterly EPS figures. Same rule as net income:
  // a quarter with no reported EPS used to contribute 0, turning three quarters
  // of earnings into a "twelve-month" total.
  const quarterEPS = ttmRows.map((row) => {
    const is = row.financials?.income_statement || {}
    return finite(is.diluted_earnings_per_share?.value ?? is.basic_earnings_per_share?.value)
  })
  let eps: number | null =
    ttmQuarters === 4 && quarterEPS.every((v) => v !== null)
      ? (quarterEPS as number[]).reduce((a, b) => a + b, 0)
      : null
  if (eps === null && sharesOutstanding > 0 && netIncome !== null && netIncome !== 0) {
    // Derivable from a complete TTM net income, which is itself already gated
    // on four reported quarters.
    eps = netIncome / sharesOutstanding
  }

  // Calculate Market Cap: Price × Shares Outstanding
  let marketCap: number | null = null
  if (sharesOutstanding > 0) {
    marketCap = currentPrice * sharesOutstanding
  } else if (tickerData?.market_cap) {
    marketCap = tickerData.market_cap
  } else if (netIncome !== null && netIncome > 0 && eps !== null && eps > 0) {
    // Fallback: estimate from financials (PE ratio method)
    marketCap = (currentPrice / eps) * netIncome
  }

  // Calculate PE Ratio — null when neither route has complete inputs.
  let peRatio: number | null = null
  if (eps !== null && eps > 0) {
    peRatio = currentPrice / eps
  } else if (marketCap !== null && marketCap > 0 && netIncome !== null && netIncome > 0) {
    // Fallback: use market cap / net income as approximation
    peRatio = marketCap / netIncome
  }

  // Debt-to-Equity. Unknown equity gave 0, which reads as "no debt" — the most
  // flattering possible value for a company we know nothing about.
  const debtToEquity: number | null =
    stockholdersEquity !== null && stockholdersEquity > 0 && totalLiabilities !== null
      ? totalLiabilities / stockholdersEquity
      : null

  // ROE needs a complete TTM net income AND positive equity.
  const roe: number | null =
    netIncome !== null && stockholdersEquity !== null && stockholdersEquity > 0
      ? (netIncome / stockholdersEquity) * 100
      : null

  return {
    profitableQuarters,
    ttmQuarters,
    quarterEPS,
    netIncome,
    stockholdersEquity,
    totalLiabilities,
    sharesOutstanding,
    eps,
    marketCap,
    peRatio,
    debtToEquity,
    roe,
  }
}

/**
 * The earnings date, from the one place that reads it. (S-17)
 *
 * THERE WERE TWO OF THESE, AND THEY DISAGREED. An inline block in the scan loop
 * tried four snapshot fields — `earnings.announcement_date`, `earnings_date`,
 * `next_earnings_date`, `results.earnings.date` — and formatted as "Nov 5".
 * This function tried ONLY `next_earnings_date` and formatted as "11/5/2026".
 * The row then took `inline || fromThisFunction` for the DISPLAYED date, so the
 * same column rendered two different formats depending on which field happened
 * to carry the date.
 *
 * The part that mattered was downstream. `premiumMultiplier` — the earnings
 * bump applied to the estimated premium — read the NARROW result, while the
 * table displayed the WIDE one. A ticker whose date came from
 * `announcement_date` therefore showed "Earnings in 3d" beside a premium
 * estimate computed as though there were no earnings at all. Two numbers on one
 * row, derived from two different answers to the same question.
 *
 * One extraction now, one format, one answer.
 *
 * `now` is a parameter so the result is a function of its inputs — a date
 * helper that reads the clock cannot be asserted, and "days to earnings" is
 * exactly the kind of arithmetic that is wrong by one and looks right.
 */
export function extractEarningsData(
  snapshot: any,
  now: Date = new Date(),
): { earningsDate: string | undefined; daysToEarnings: number | undefined } {
  const tickerData = snapshot?.ticker
  const earningsTimestamp =
    tickerData?.earnings?.announcement_date ||
    tickerData?.earnings_date ||
    tickerData?.next_earnings_date ||
    snapshot?.results?.earnings?.date
  let earningsDate: string | undefined
  let daysToEarnings: number | undefined

  if (earningsTimestamp) {
    const earnDate = new Date(earningsTimestamp)
    earningsDate = earnDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    daysToEarnings = Math.floor((earnDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // S-10, closed 2026-08-11. This was
    //   currentPrice × (atrPercent / 100) × √(daysToEarnings / 7) × 1.5
    // — an ATR-based move with a `1.5` fudge factor that has no reference
    // anywhere, presented in the table as an expected move. The standard form is
    // S · σ · √T off IMPLIED volatility, and `expectedMove` in
    // `lib/black-scholes.ts` has implemented it since Phase 1 — **its own
    // docstring already claimed it "replaces the ad-hoc ATR × 1.5 fudge", and
    // the call site was never changed.** A fix that exists, is tested, and is
    // not wired is not a fix.
    //
    // The fundamental scan has no IV: the options chain is not fetched until
    // enrichment. So this stage supplies the earnings DATE and leaves the move
    // undefined; `enrichment.ts` fills it from the measured IV it just read. An
    // unknown move stays undefined rather than falling back to a volatility
    // proxy wearing the name of an implied one — the whole labelling problem
    // this audit exists to remove.
  }

  // No `expectedMove` in this return. It was declared, never assigned, and
  // returned as `undefined` to every caller — a field that existed only to
  // carry S-10's absence. The explanation stays above; the empty field does
  // not, because a returned value nobody can ever read is the shape P7-9 was
  // about.
  return { earningsDate, daysToEarnings }
}

export interface PremiumEstimate {
  putStrike: number
  premiumMultiplier: number
  estimatedPremium: number
  /** Percent, clamped to [0.5, 5]. */
  finalYield: number
}

/**
 * The Step 3 premium ESTIMATE, labelled as such everywhere it is rendered.
 *
 * This is not a priced option — the chain is not fetched until enrichment — and
 * the numbers below (0.4, the 7-day reference expiry, the ±0.1-per-point
 * volatility adjustment) are shape parameters of a heuristic, not quoted market
 * data. They are extracted here so that at least the heuristic is pinned: the
 * clamp really does bound the yield, and an unknown ATR really does fall through
 * to the same 2.5% placeholder `atrPercent` uses rather than zeroing the premium.
 */
export function estimatePremium(
  currentPrice: number,
  atr: number | null,
  atrPercent: number,
  daysToEarnings: number | undefined,
): PremiumEstimate {
  const putStrike = currentPrice * 0.95
  const daysToExpiration = 7

  let premiumMultiplier = 1.0
  if (daysToEarnings !== undefined && daysToEarnings >= 0 && daysToEarnings <= 14) {
    premiumMultiplier = 1.5 + ((14 - daysToEarnings) / 14) * 0.3
  }

  // When ATR is unknown, derive the dollar ATR from the same 2.5% placeholder
  // atrPercent already falls back to, so the labeled estimate stays internally
  // consistent (previously null→0 zeroed it).
  const atrForEstimate = atr ?? (atrPercent / 100) * currentPrice
  const estimatedPremium = atrForEstimate * 0.4 * Math.sqrt(daysToExpiration / 7) * premiumMultiplier
  const yieldPercent = putStrike > 0 ? (estimatedPremium / putStrike) * 100 : 0
  const volatilityAdjustedYield = yieldPercent * (1 + (atrPercent - 2) * 0.1)
  const finalYield = Math.max(0.5, Math.min(5, volatilityAdjustedYield))

  return { putStrike, premiumMultiplier, estimatedPremium, finalYield }
}
