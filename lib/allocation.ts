/**
 * Cash vs stocks, for every gauge on the site that recommends a split.
 *
 * ## Why this is one file and not one per component
 *
 * Before this existed the site carried four allocation tables:
 *
 * 1. the CCPI dashboard's five-column split (shares / LEAPS / short options /
 *    hedges / cash) whose columns never summed to 100,
 * 2. the CCPI options-strategy card's "cash 5-10% beside exposure 90-100%",
 *    which sums to 110,
 * 3. market sentiment's `getTradeRecommendations`, the one live table that was
 *    internally consistent, and
 * 4. market sentiment's `getPortfolioAllocation`, a three-way split that summed
 *    to between 85 and 110 **and was never rendered** — dead code carrying
 *    numbers that disagreed with (3) in the same component.
 *
 * The pattern is the same every time: **both halves of a complementary pair were
 * stored, so they were free to drift, and they did.** The fix is structural
 * rather than a one-time correction of the numbers — cash is the only stored
 * figure anywhere in this file, and stocks is always computed from it.
 *
 * "Stocks" means everything deployed — shares, ETFs, LEAPS and option positions.
 * That is the house convention: positions are shares/LEAPS/options/cash only,
 * there are no separate asset classes, and diversification is expressed through
 * sectors and indexes such as GDX, XLU and SPY.
 *
 * ## The two band sets are not interchangeable
 *
 * They are keyed to different gauges that run in opposite directions, so a
 * reader comparing "cash %" across the two pages is comparing two different
 * questions. Each set states its own, and the UI should print it:
 *
 * - `CCPI_ALLOCATION_BANDS` — keyed to crash risk, 0 calm to 100 crash watch.
 * - `SENTIMENT_ALLOCATION_BANDS` — keyed to fear and greed, 0 extreme fear to
 *   100 extreme greed. Cash rises with *greed* here, which is why its low band
 *   still holds more cash than the CCPI low band does.
 *
 * Dependency-free so check scripts can load it directly.
 */

export interface AllocationBand {
  /** Inclusive score range, as displayed. */
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

export interface AllocationScale {
  /** What the score means, so a reader is never comparing two unlike "cash %" figures. */
  question: string
  bands: readonly AllocationBand[]
}

/** Crash risk: 0 is calm, 100 is crash watch. Cash rises with risk. */
export const CCPI_ALLOCATION_BANDS: readonly AllocationBand[] = [
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

export const CCPI_ALLOCATION: AllocationScale = {
  question: "How much crash risk is the CCPI reading right now?",
  bands: CCPI_ALLOCATION_BANDS,
}

/**
 * Fear and greed: 0 is extreme fear, 100 is extreme greed. Cash rises with greed.
 *
 * Cash figures are the ones the live market-sentiment table already showed. Its
 * pairs were internally consistent; deriving stocks keeps them that way.
 */
export const SENTIMENT_ALLOCATION_BANDS: readonly AllocationBand[] = [
  {
    range: "0-24",
    min: 0,
    max: 24,
    level: "Extreme Fear",
    cashMin: 10,
    cashMax: 20,
    stance: "Others are fearful. Deploy into quality and keep a little dry powder.",
  },
  {
    range: "25-44",
    min: 25,
    max: 44,
    level: "Fear",
    cashMin: 20,
    cashMax: 30,
    stance: "Favourable for premium sellers. Stay selective on the underlying.",
  },
  {
    range: "45-55",
    min: 45,
    max: 55,
    level: "Neutral",
    cashMin: 30,
    cashMax: 40,
    stance: "Balanced. Do not force trades — wait for better setups.",
  },
  {
    range: "56-74",
    min: 56,
    max: 74,
    level: "Greed",
    cashMin: 40,
    cashMax: 60,
    stance: "Reduce exposure and take profits early. Build reserves.",
  },
  {
    range: "75-100",
    min: 75,
    max: 100,
    level: "Extreme Greed",
    cashMin: 60,
    cashMax: 80,
    stance: "Extreme greed often precedes corrections. Maximum cash, minimal new risk.",
  },
]

export const SENTIMENT_ALLOCATION: AllocationScale = {
  question: "How greedy or fearful is the market right now?",
  bands: SENTIMENT_ALLOCATION_BANDS,
}

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
 * Never defaults to a band. A missing score is not "Low Risk" — that is the
 * P6-30 defect (a dead feed rendering as a benign state) in allocation form.
 */
export function bandForScore(
  bands: readonly AllocationBand[],
  score: number | null | undefined,
): AllocationBand | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null
  return bands.find((b) => score >= b.min && score <= b.max) ?? null
}
