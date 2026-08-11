/**
 * Cash vs stocks by CCPI regime — one table, used everywhere.
 *
 * Before this existed the page carried two allocation tables that disagreed:
 * the portfolio section listed a five-way split (shares / LEAPS / short options
 * / hedges / cash) whose columns did not sum to 100, and the options guide
 * listed a "cash 5-10% + exposure 90-100%" pair that summed to 95-110. Two
 * numbers describing one decision, neither derivable from the other.
 *
 * **Cash is the only stored figure. Stocks is computed as its complement**, so
 * the two halves cannot drift apart in a future edit. "Stocks" here means
 * everything deployed — shares, ETFs, LEAPS and option positions — which is the
 * house convention (positions are shares/LEAPS/options/cash only; there are no
 * separate asset classes, and diversification is expressed through sectors and
 * indexes such as GDX, XLU and SPY).
 *
 * The bands themselves are the regime thresholds already used by the CCPI zone
 * colouring, not new numbers.
 *
 * Dependency-free so check scripts can load it directly.
 */

export interface AllocationBand {
  /** Inclusive CCPI range, as displayed. */
  range: string
  min: number
  max: number
  level: string
  /** The only stored allocation figure. Stocks is derived from it. */
  cashMin: number
  cashMax: number
  /** One line on what the split is for at this level. */
  stance: string
}

export const ALLOCATION_BANDS: readonly AllocationBand[] = [
  {
    range: "0-19",
    min: 0,
    max: 19,
    level: "Low Risk",
    cashMin: 5,
    cashMax: 10,
    stance: "Fully deployed. Hold only the cash you need to act on a pullback.",
  },
  {
    range: "20-39",
    min: 20,
    max: 39,
    level: "Normal",
    cashMin: 15,
    cashMax: 25,
    stance: "Standard positioning with a working cash reserve.",
  },
  {
    range: "40-59",
    min: 40,
    max: 59,
    level: "Caution",
    cashMin: 30,
    cashMax: 40,
    stance: "Trim into strength and let cash build.",
  },
  {
    range: "60-79",
    min: 60,
    max: 79,
    level: "High Alert",
    cashMin: 50,
    cashMax: 60,
    stance: "Cash is the larger half. Keep only high-conviction and defensive names.",
  },
  {
    range: "80-100",
    min: 80,
    max: 100,
    level: "Crash Watch",
    cashMin: 70,
    cashMax: 80,
    stance: "Capital preservation. Deploy again only after the regime downgrades.",
  },
]

/** Stocks is always the complement of cash — never stored, so it cannot drift. */
export function stocksRange(band: AllocationBand): { min: number; max: number } {
  return { min: 100 - band.cashMax, max: 100 - band.cashMin }
}

export function formatRange(min: number, max: number): string {
  return `${min}-${max}%`
}

/**
 * The band a score falls in, or `null` when there is no score.
 *
 * Never defaults to a band. A missing CCPI is not "Low Risk" — that is the
 * P6-30 defect (a dead feed rendering as a benign state) in allocation form.
 */
export function bandForScore(score: number | null | undefined): AllocationBand | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null
  return ALLOCATION_BANDS.find((b) => score >= b.min && score <= b.max) ?? null
}
