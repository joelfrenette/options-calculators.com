/**
 * The Buffett Indicator, computed from FRED instead of scraped.
 *
 * P7-73. `/api/ccpi` gets this figure from GuruFocus through ScrapingBee, and
 * ScrapingBee is unset in both environments (P7-69), so the value it scores has
 * been an LLM's recollection tiered `ai-estimate` — which does not score. FRED
 * publishes both halves of the ratio and the site already reads FRED.
 *
 * IMPORT-FREE ON PURPOSE. Same constraint as `lib/ccpi/scoring.ts` and
 * `lib/vix-term.ts`: the check scripts run under plain `node` with relative
 * `.ts` imports and cannot resolve an extensionless one, so a module they need
 * to load must have no imports at all (P7-67).
 *
 * ── THE UNIT GAP IS THE WHOLE RISK ────────────────────────────────────────────
 * `NCBEILQ027S` is in MILLIONS of dollars. `GDP` is in BILLIONS. A ratio taken
 * without converting is out by exactly 1000×, and 1000× a plausible percentage
 * is still a number — it would render, and it would score at the top band. The
 * conversion is done once, here, and asserted.
 *
 * ── AND THIS IS NOT THE SAME MEASUREMENT AS THE SCRAPED ONE ───────────────────
 * `NCBEILQ027S` is NONFINANCIAL corporate equities. GuruFocus uses TOTAL market
 * capitalisation. Measured at 2026-01: this ratio is 218.1%, the GuruFocus
 * figure was 183.8% — 34 points apart, straddling the CCPI's >200 band.
 *
 * So this value is deliberately NOT wired into the scored `buffettIndicator`.
 * The CCPI's bands (>200 / >180 / >150 / >120) were calibrated against the
 * total-market-cap basis; feeding a different series into them would shift the
 * indicator by three points and read as the market moving rather than as the
 * source changing. That is the audit's oldest failure shape — a number that is
 * fine and a noun that is false — and swapping a source under a fixed threshold
 * is how it happens by accident.
 *
 * Scoring it needs the bands re-derived from THIS series' own history, which is
 * the open question in CCPI_DESIGN.md, not a wiring job.
 */

/** Millions per billion. Named because the bug it prevents is silent. */
const MILLIONS_PER_BILLION = 1000

export interface BuffettInputs {
  /** NCBEILQ027S — nonfinancial corporate equities, MILLIONS of USD. */
  corporateEquitiesMillions: number | null
  /** GDP — nominal, BILLIONS of USD, seasonally adjusted annual rate. */
  gdpBillions: number | null
}

export interface BuffettReading {
  /** Ratio as a PERCENT, e.g. 218.1. */
  percent: number
  /**
   * Which basis produced it. The scraped figure uses `total-market-cap`; this
   * module can only ever produce `nonfinancial-corporate-equities`, and the two
   * are not interchangeable at a fixed threshold.
   */
  basis: "nonfinancial-corporate-equities"
  /** The observation dates both halves came from, so staleness is visible. */
  equitiesAsOf: string
  gdpAsOf: string
}

/**
 * @returns the ratio, or NULL when either half is missing or unusable.
 *
 * Null rather than a partial answer: a Buffett Indicator computed from one of
 * its two terms is not a smaller version of the figure, it is a different
 * quantity. Non-finite and non-positive inputs are treated as missing — a GDP
 * of zero is not an economy, it is a bad read.
 */
export function computeBuffettIndicator(
  inputs: BuffettInputs,
  equitiesAsOf: string | null,
  gdpAsOf: string | null,
): BuffettReading | null {
  const { corporateEquitiesMillions: eq, gdpBillions: gdp } = inputs
  if (eq === null || gdp === null) return null
  if (!Number.isFinite(eq) || !Number.isFinite(gdp)) return null
  if (eq <= 0 || gdp <= 0) return null
  if (!equitiesAsOf || !gdpAsOf) return null

  const equitiesBillions = eq / MILLIONS_PER_BILLION
  const percent = (equitiesBillions / gdp) * 100
  if (!Number.isFinite(percent) || percent <= 0) return null

  return {
    percent: Math.round(percent * 10) / 10,
    basis: "nonfinancial-corporate-equities",
    equitiesAsOf,
    gdpAsOf,
  }
}

/**
 * How far apart the two observation dates are, in days.
 *
 * Both series are quarterly and the Z.1 release that carries NCBEILQ027S lags
 * the GDP advance estimate, so the two halves are routinely from different
 * quarters. A caller that wants to disclose staleness needs the gap, not a
 * boolean — "current" is not a property either series has.
 */
export function observationGapDays(equitiesAsOf: string, gdpAsOf: string): number | null {
  const a = Date.parse(equitiesAsOf)
  const b = Date.parse(gdpAsOf)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.round(Math.abs(a - b) / 86_400_000)
}
