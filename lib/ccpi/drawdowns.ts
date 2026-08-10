/**
 * Reference drawdowns — the events every candidate indicator is scored against.
 *
 * CCPI_DESIGN.md §6 step 3. Until now these existed only as prose ("2000, 2008,
 * 2020, 2022"), which is not something a backtest can iterate over, and prose is
 * how "roughly 2008" quietly becomes a different date in each place it is used.
 *
 * Dependency-free on purpose: `scripts/check-drawdowns.ts` loads this directly
 * under node's type stripping, which cannot resolve `@/...` imports.
 *
 * ## What these dates are, and what they are not
 *
 * S&P 500 **closing** peaks and troughs. Intraday extremes differ by a few
 * tenths of a percent and by a day either side; closing prices are used because
 * that is what `market_closes` stores, so a backtest comparing against them is
 * comparing like with like.
 *
 * **These figures are recorded from reference knowledge, not computed from a
 * stored series** — the site holds 131 days of history at the time of writing.
 * `scripts/check-drawdowns.ts` therefore asserts only internal consistency
 * (ordering, sign, arithmetic). **Once ~25 years of index history is stored,
 * these should be RE-DERIVED from it and any disagreement treated as this file
 * being wrong.** A hand-entered constant is exactly what this audit has spent
 * its time removing; the difference is that this one is labelled, testable, and
 * has a defined replacement path.
 *
 * ## Why the corrections matter more than the crashes
 *
 * There are four bear markets in 25 years and eleven corrections. Statistics
 * built on four events are not statistics. A signal's false-positive rate is
 * only measurable against the full set — including the corrections it should
 * have caught and the quiet periods it should have stayed silent through.
 */

export type DrawdownSeverity = "bear" | "correction"

export interface ReferenceDrawdown {
  /** Stable identifier for use in backtest output. */
  id: string
  /** Short human label. */
  label: string
  /** Closing peak date, ISO. The date a signal must fire BEFORE to count as leading. */
  peak: string
  /** Closing trough date, ISO. */
  trough: string
  /** S&P 500 closing level at the peak. */
  peakClose: number
  /** S&P 500 closing level at the trough. */
  troughClose: number
  /** Peak-to-trough decline, percent, negative. Derived from the two closes. */
  declinePct: number
  severity: DrawdownSeverity
}

/** Bear markets: peak-to-trough decline of 20% or more. */
export const BEAR_MARKETS: readonly ReferenceDrawdown[] = [
  {
    id: "dotcom-2000",
    label: "Dot-com bust",
    peak: "2000-03-24",
    trough: "2002-10-09",
    peakClose: 1527.46,
    troughClose: 776.76,
    declinePct: -49.15,
    severity: "bear",
  },
  {
    id: "gfc-2007",
    label: "Global financial crisis",
    peak: "2007-10-09",
    trough: "2009-03-09",
    peakClose: 1565.15,
    troughClose: 676.53,
    declinePct: -56.78,
    severity: "bear",
  },
  {
    id: "covid-2020",
    label: "COVID crash",
    peak: "2020-02-19",
    trough: "2020-03-23",
    peakClose: 3386.15,
    troughClose: 2237.4,
    declinePct: -33.92,
    severity: "bear",
  },
  {
    id: "rates-2022",
    label: "2022 rate shock",
    peak: "2022-01-03",
    trough: "2022-10-12",
    peakClose: 4796.56,
    troughClose: 3577.03,
    declinePct: -25.43,
    severity: "bear",
  },
]

/** Corrections: 10% or more, but short of 20%. These carry the false-positive statistics. */
export const CORRECTIONS: readonly ReferenceDrawdown[] = [
  {
    id: "ltcm-1998",
    label: "LTCM / Russia default",
    peak: "1998-07-17",
    trough: "1998-08-31",
    peakClose: 1186.75,
    troughClose: 957.28,
    declinePct: -19.34,
    severity: "correction",
  },
  {
    id: "europe-2010",
    label: "Euro crisis / flash crash",
    peak: "2010-04-23",
    trough: "2010-07-02",
    peakClose: 1217.28,
    troughClose: 1022.58,
    declinePct: -15.99,
    severity: "correction",
  },
  {
    id: "downgrade-2011",
    label: "US credit downgrade",
    peak: "2011-04-29",
    trough: "2011-10-03",
    peakClose: 1363.61,
    troughClose: 1099.23,
    declinePct: -19.39,
    severity: "correction",
  },
  {
    id: "china-2015",
    label: "China devaluation",
    peak: "2015-05-21",
    trough: "2016-02-11",
    peakClose: 2130.82,
    troughClose: 1829.08,
    declinePct: -14.16,
    severity: "correction",
  },
  {
    id: "volmageddon-2018",
    label: "February 2018 volatility spike",
    peak: "2018-01-26",
    trough: "2018-02-08",
    peakClose: 2872.87,
    troughClose: 2581.0,
    declinePct: -10.16,
    severity: "correction",
  },
  {
    id: "q4-2018",
    label: "Q4 2018 tightening scare",
    peak: "2018-09-20",
    trough: "2018-12-24",
    peakClose: 2930.75,
    troughClose: 2351.1,
    declinePct: -19.78,
    severity: "correction",
  },
  {
    id: "rates-2023",
    label: "2023 rate backup",
    peak: "2023-07-31",
    trough: "2023-10-27",
    peakClose: 4588.96,
    troughClose: 4117.37,
    declinePct: -10.28,
    severity: "correction",
  },
]

/** Every reference event, oldest first. */
export const REFERENCE_DRAWDOWNS: readonly ReferenceDrawdown[] = [...BEAR_MARKETS, ...CORRECTIONS].sort((a, b) =>
  a.peak < b.peak ? -1 : a.peak > b.peak ? 1 : 0,
)

/**
 * Events whose peak falls inside the window a stored series actually covers.
 *
 * A backtest must never silently score against events it has no data for — that
 * is how `insufficient-history` turns into a false pass. Callers pass the
 * earliest date they hold and get back only what is genuinely testable.
 */
export function drawdownsCoveredBy(earliestStoredDay: string): ReferenceDrawdown[] {
  return REFERENCE_DRAWDOWNS.filter((d) => d.peak >= earliestStoredDay)
}

/** Trading-day-agnostic day count between two ISO dates. */
export function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(fromISO + "T00:00:00Z")
  const b = Date.parse(toISO + "T00:00:00Z")
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN
  return Math.round((b - a) / 86400000)
}
