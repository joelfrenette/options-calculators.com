/**
 * Cash vs stocks, for every gauge on the site that recommends a split.
 *
 * ## One number per level, not a range
 *
 * These were ranges ("cash 5-10%") until the 2026-08-10 UAT. A range reads as
 * precision it does not have and cannot be drawn to scale — "90-95% stocks
 * beside 5-10% cash" has no single proportion to render, so the reader has to
 * do the arithmetic the page should have done. **Each level now carries one
 * exact cash figure**, taken as the midpoint of the range it replaced and
 * rounded to the nearest 5.
 *
 * ## Cash is stored, stocks is derived
 *
 * Before this file existed the site carried five allocation tables:
 *
 * 1. the CCPI dashboard's five-column split (shares / LEAPS / short options /
 *    hedges / cash) whose columns never summed to 100,
 * 2. the CCPI options-strategy card's "cash 5-10% beside exposure 90-100%",
 *    which sums to 110,
 * 3. market sentiment's `getTradeRecommendations`, the one live table that was
 *    internally consistent,
 * 4. market sentiment's `getPortfolioAllocation`, a three-way split summing to
 *    between 85 and 110 that **was never rendered** — dead code contradicting
 *    (3) in the same component, and
 * 5. `components/panic-euphoria.tsx`'s three-column split, running 90 to 115.
 *
 * The pattern is the same every time: **both halves of a complementary pair
 * were stored, so they were free to drift, and they did.** The fix is
 * structural rather than a one-time correction — cash is the only stored figure
 * anywhere in this file, and stocks is always computed from it.
 *
 * "Stocks" means everything deployed — shares, ETFs, LEAPS and option
 * positions. That is the house convention: positions are shares/LEAPS/options/
 * cash only, there are no separate asset classes, and diversification is
 * expressed through sectors and indexes such as GDX, XLU and SPY.
 *
 * ## The two band sets are not interchangeable
 *
 * They are keyed to different gauges that run in opposite directions, so a
 * reader comparing "cash %" across the two pages is comparing two different
 * questions. Each set states its own, and the UI should print it:
 *
 * - `CCPI_ALLOCATION` — keyed to crash risk, 0 calm to 100 crash watch.
 * - `SENTIMENT_ALLOCATION` — keyed to fear and greed, 0 extreme fear to 100
 *   extreme greed. Cash rises with *greed* here, which is why its calmest band
 *   still holds more cash than the CCPI calmest band does.
 * - `PANIC_EUPHORIA_ALLOCATION` — keyed to panic and euphoria, −1 to +1. Panic
 *   is a *buy* signal, so this scale's low end is its most deployed state.
 *
 * Dependency-free so check scripts can load it directly.
 */

export interface AllocationBand {
  /** The score range as displayed. Free text, because the scales are not all 0-100. */
  range: string
  min: number
  max: number
  level: string
  /** The only stored allocation figure, as a whole percent. Stocks is derived. */
  cash: number
  /** One line on what the split is for at this level. */
  stance: string
}

export interface AllocationScale {
  /** What the score means, so a reader is never comparing two unlike "cash %" figures. */
  question: string
  /** Inclusive domain of the underlying gauge. Not every scale runs 0-100. */
  domain: { min: number; max: number }
  bands: readonly AllocationBand[]
}

/** Crash risk: 0 is calm, 100 is crash watch. Cash rises with risk. */
export const CCPI_ALLOCATION_BANDS: readonly AllocationBand[] = [
  {
    range: "0-19",
    min: 0,
    max: 19,
    level: "Low Risk",
    cash: 10,
    stance: "Fully deployed. Hold only the cash you need to act on a pullback.",
  },
  {
    range: "20-39",
    min: 20,
    max: 39,
    level: "Normal",
    cash: 20,
    stance: "Standard positioning with a working cash reserve.",
  },
  {
    range: "40-59",
    min: 40,
    max: 59,
    level: "Caution",
    cash: 35,
    stance: "Trim into strength and let cash build.",
  },
  {
    range: "60-79",
    min: 60,
    max: 79,
    level: "High Alert",
    cash: 55,
    stance: "Cash is the larger half. Keep only high-conviction and defensive names.",
  },
  {
    range: "80-100",
    min: 80,
    max: 100,
    level: "Crash Watch",
    cash: 75,
    stance: "Capital preservation. Deploy again only after the regime downgrades.",
  },
]

export const CCPI_ALLOCATION: AllocationScale = {
  question: "How much crash risk is the CCPI reading right now?",
  domain: { min: 0, max: 100 },
  bands: CCPI_ALLOCATION_BANDS,
}

/** Fear and greed: 0 is extreme fear, 100 is extreme greed. Cash rises with greed. */
export const SENTIMENT_ALLOCATION_BANDS: readonly AllocationBand[] = [
  {
    range: "0-24",
    min: 0,
    max: 24,
    level: "Extreme Fear",
    cash: 15,
    stance: "Others are fearful. Deploy into quality and keep a little dry powder.",
  },
  {
    range: "25-44",
    min: 25,
    max: 44,
    level: "Fear",
    cash: 25,
    stance: "Favourable for premium sellers. Stay selective on the underlying.",
  },
  {
    range: "45-55",
    min: 45,
    max: 55,
    level: "Neutral",
    cash: 35,
    stance: "Balanced. Do not force trades — wait for better setups.",
  },
  {
    range: "56-74",
    min: 56,
    max: 74,
    level: "Greed",
    cash: 50,
    stance: "Reduce exposure and take profits early. Build reserves.",
  },
  {
    range: "75-100",
    min: 75,
    max: 100,
    level: "Extreme Greed",
    cash: 70,
    stance: "Extreme greed often precedes corrections. Maximum cash, minimal new risk.",
  },
]

export const SENTIMENT_ALLOCATION: AllocationScale = {
  question: "How greedy or fearful is the market right now?",
  domain: { min: 0, max: 100 },
  bands: SENTIMENT_ALLOCATION_BANDS,
}

/**
 * Panic / euphoria: −1 is extreme panic, +1 is extreme euphoria. Cash rises
 * with euphoria, and panic is the *buy* signal, so the low end holds the least
 * cash of any scale on the site.
 *
 * Cash figures are the midpoints of the ranges this replaced, rounded to the
 * nearest 5 — the same rule the other two scales were converted under.
 *
 * **A boundary score belongs to the band that starts there** — see
 * `bandForScore`. The if-chain this replaced mixed `<=` and `<` between
 * branches, so two boundary values change hands: exactly −0.45 now reads Panic
 * rather than Extreme Panic, and exactly −0.17 reads Neutral rather than Panic.
 * Both are measure-zero on a continuous score, and one stated rule is worth
 * more than three unstated ones — but it is a change, so it is written down
 * rather than discovered later.
 */
export const PANIC_EUPHORIA_ALLOCATION_BANDS: readonly AllocationBand[] = [
  {
    range: "−1.00 to −0.45",
    min: -1,
    max: -0.45,
    level: "Extreme Panic",
    cash: 15,
    stance: "Rare and historically profitable. Deploy into quality, keep a working reserve.",
  },
  {
    range: "−0.45 to −0.17",
    min: -0.45,
    max: -0.17,
    level: "Panic",
    cash: 20,
    stance: "Long-term trend intact while the tape panics. Build positions gradually.",
  },
  {
    range: "−0.17 to 0.41",
    min: -0.17,
    max: 0.41,
    level: "Neutral/Complacent",
    cash: 50,
    stance: "No edge either way. Hold a real reserve and wait for a signal.",
  },
  {
    range: "0.41 to 0.70",
    min: 0.41,
    max: 0.7,
    level: "Euphoria",
    cash: 60,
    stance: "Trim winners and take profits early. The crowd is leaning one way.",
  },
  {
    range: "0.70 to 1.00",
    min: 0.7,
    max: 1,
    level: "Extreme Euphoria",
    cash: 85,
    stance: "Maximum defence. Close what is profitable and prepare for volatility.",
  },
]

export const PANIC_EUPHORIA_ALLOCATION: AllocationScale = {
  question: "Is the market panicking or euphoric right now?",
  domain: { min: -1, max: 1 },
  bands: PANIC_EUPHORIA_ALLOCATION_BANDS,
}

/** Stocks is always the complement of cash — never stored, so it cannot drift. */
export function stocksFor(band: AllocationBand): number {
  return 100 - band.cash
}

export function formatPct(value: number): string {
  return `${value}%`
}

/**
 * The band a score falls in, or `null` when there is no score.
 *
 * **Bands are selected by their lower edge: the answer is the last band whose
 * `min` the score has reached.** This matters more than it looks. Matching on
 * `min <= score <= max` instead leaves gaps wherever a scale is written the way
 * humans read it — CCPI bands display as "0-19" and "20-39", so a score of 19.4
 * satisfied neither and silently rendered no allocation at all. The check suite
 * sweeps each domain and caught exactly that.
 *
 * A consequence worth stating: a score sitting exactly on a boundary belongs to
 * the band that *starts* there, which is how the displayed ranges read. For the
 * panic/euphoria scale that differs from the mixed `<=`/`<` if-chain it
 * replaced at two measure-zero points — exactly −0.45 now reads Panic rather
 * than Extreme Panic, and exactly −0.17 reads Neutral rather than Panic.
 *
 * Never defaults to a band. A missing score is not "Low Risk" — that is the
 * P6-30 defect (a dead feed rendering as a benign state) in allocation form,
 * and a score outside the scale's domain is missing data too.
 */
export function bandForScore(
  bands: readonly AllocationBand[],
  score: number | null | undefined,
): AllocationBand | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null
  if (bands.length === 0) return null
  if (score > bands[bands.length - 1].max) return null

  let match: AllocationBand | null = null
  for (const band of bands) {
    if (score >= band.min) match = band
  }
  return match
}
