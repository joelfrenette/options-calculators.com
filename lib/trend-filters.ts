/**
 * Entry filters for selling cash-secured puts: the two things the owner does
 * not want to sell a put into.
 *
 *   1. A stock that just ripped. A +10% session comes with an IV spike, so the
 *      put premium looks rich — but if the pop is post-earnings the crush lands
 *      within a day, leaving a collapsing premium against a full retracement of
 *      downside. The strike is also chosen off the inflated price, so a strike
 *      that looked 10% out of the money sits at the money after the retrace.
 *   2. A stock that has fallen for a year, especially while the market rose.
 *      Assignment means owning it.
 *
 * WHY EVERY FUNCTION HERE CAN RETURN NULL. The scanner's standing convention
 * (components/scanner/technical-criteria.ts) is that a null indicator means
 * insufficient history and the gate FAILS-SAFE — a stock whose 12-month return
 * cannot be measured must not pass a filter that exists to measure it. A
 * newly-listed ticker has no year to look back on, and that is a verdict, not a
 * pass. None of these ever returns 0 for "unknown"; on a return series 0 means
 * "flat over the year", which is a real and different reading.
 *
 * IMPORT-FREE ON PURPOSE. `scripts/check-trend-filters.ts` loads this under
 * node's type stripping, where `@/…` aliases do not resolve. That is also why
 * the moving averages arrive as NUMBERS rather than being computed here: the
 * house rule is that `lib/indicators.ts` owns `sma`, and the call site already
 * imports it. Do not add imports, and do not re-implement an indicator here.
 */

/** ~21 trading days in a month, ~252 in a year. The conventional counts. */
export const SESSIONS_PER_MONTH = 21
export const SESSIONS_PER_YEAR = 252

/**
 * The big-up-day threshold: one range, one default, one owner.
 *
 * WHY IT LIVES HERE. It shipped in three places at once — a 3-25 slider in the
 * Sell Put scanner's Step 4 card, a dropdown of eight fixed steps in the six
 * server-driven tabs, and a clamp in `/api/strategy-scanner` — and three copies
 * of a number is two chances to disagree. It is the same shape as the Yahoo URL
 * written fifteen times (P7-28): nothing was wrong yet, and nothing structural
 * stopped it from going wrong.
 *
 * `DEFAULT` is the owner's 10%. `MIN` is 3 because below that a normal session
 * in a volatile name would exclude it; `MAX` is 25 because a move that large is
 * excluded by every sane setting and a higher ceiling is a control with no
 * effect.
 */
export const MAX_DAY_MOVE = { MIN: 3, MAX: 25, DEFAULT: 10, STEP: 1 } as const

/**
 * Relaxed-pass down-year grading (owner 2026-08-29).
 *
 * The STRICT Step 4 gate rejects ANY negative trailing year — unchanged. The
 * RELAXED Step 5 pass instead GRADES it, because a binary down-year gate could
 * not tell a mega-cap down 3% from a broken stock down 40%, and on a
 * down-breadth day it emptied Step 5 entirely (the owner ran the scanner and
 * got zero relaxed results while AMZN / NVDA / CSCO sat excluded). The relaxed
 * grade keeps the genuine damage out while letting a large, reliable name in a
 * mild pullback surface as the low-risk put it actually is.
 *
 * DEEP: a trailing year worse than this stays HARD-excluded even in the relaxed
 * pass. Stage 4 (price below a FALLING 150-session average) already catches the
 * STRUCTURAL downtrend at any magnitude; this is the magnitude backstop for a
 * steep drop that has not yet rolled its 150-day average over.
 *
 * MILD_MIN_CAP: a mildly-down name (between DEEP and 0) earns the relaxed pass
 * only when it is at least this large — the "reliable large company" the owner
 * will happily own at the strike, not a small cap that merely happens to be
 * down a little. Above this line and not Stage 4, a mild decline is a pullback,
 * not a knife.
 */
export const RELAXED_DEEP_DECLINE_PCT = -20
export const RELAXED_MILD_DOWN_MIN_CAP = 20_000_000_000

/**
 * The graded down-year verdict for the relaxed pass. Pure so it is tested with
 * worked numbers in scripts/check-trend-filters.ts, the same way every other
 * gate in this file is — a mis-set threshold here silently changes which stocks
 * a put seller is shown.
 *
 * Only `not-down` and `mild-large` are ADMITTED to the relaxed pass. The other
 * three are held out: `deep` (worse than the deep threshold), `mild-small` (a
 * mild decline but not a large, reliable name), and `unmeasurable` (no trailing
 * year — cannot be judged mild, so fails safe).
 *
 * Boundaries, stated so the check can pin them: exactly the deep threshold is
 * NOT deep (−20% admits for a large cap); exactly the cap floor IS large.
 */
export type RelaxedDownYearVerdict = "not-down" | "mild-large" | "mild-small" | "deep" | "unmeasurable"

export function relaxedDownYearVerdict(
  return12m: number | null,
  marketCap: number | null,
): RelaxedDownYearVerdict {
  if (return12m === null) return "unmeasurable"
  if (return12m >= 0) return "not-down"
  if (return12m < RELAXED_DEEP_DECLINE_PCT) return "deep"
  return (marketCap ?? 0) >= RELAXED_MILD_DOWN_MIN_CAP ? "mild-large" : "mild-small"
}

/** Whether a relaxed down-year verdict keeps the stock in the relaxed pass. */
export function relaxedDownYearAdmitted(verdict: RelaxedDownYearVerdict): boolean {
  return verdict === "not-down" || verdict === "mild-large"
}

/**
 * The caller's threshold, clamped to the range above.
 *
 * CLAMPED, NOT TRUSTED, and NaN does not fall through. `0` would exclude every
 * stock that closed up at all, and a non-numeric value parses to `NaN`, which
 * loses every comparison — a gate that reports itself active while excluding
 * nothing. Anything unparseable returns the default rather than disabling the
 * filter.
 */
export function resolveMaxDayMove(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(n)) return MAX_DAY_MOVE.DEFAULT
  return Math.min(MAX_DAY_MOVE.MAX, Math.max(MAX_DAY_MOVE.MIN, n))
}

/**
 * Percent move of one session, `(last − prior) / prior × 100`.
 *
 * Null when either close is missing or the prior close is not positive — a
 * zero prior would divide to Infinity, which formats as a very confident
 * "Infinity%".
 */
export function sessionMovePercent(last: number | null | undefined, prior: number | null | undefined): number | null {
  if (typeof last !== "number" || typeof prior !== "number") return null
  if (!Number.isFinite(last) || !Number.isFinite(prior) || prior <= 0) return null
  return ((last - prior) / prior) * 100
}

/**
 * The session move expressed in ATR(14) units — how unusual the move is for
 * THIS stock. A 10% day in a name whose average true range is 1% of price is a
 * different event from a 10% day in one that swings 8% routinely, and the fixed
 * percentage gate cannot tell them apart. Display-only: it gives the fixed gate
 * its context rather than replacing it.
 */
export function moveInAtrUnits(
  movePercent: number | null,
  price: number | null | undefined,
  atr: number | null | undefined,
): number | null {
  if (movePercent === null) return null
  if (typeof price !== "number" || typeof atr !== "number") return null
  if (!Number.isFinite(price) || !Number.isFinite(atr) || atr <= 0 || price <= 0) return null
  return Math.abs((movePercent / 100) * price) / atr
}

/**
 * Total return over the trailing year, in percent.
 *
 * `closes` is oldest-first (Polygon aggregates are requested `sort=asc`). The
 * baseline is the close `sessions` bars back, NOT the first bar in the array —
 * counting from the array's start would silently shorten the window whenever
 * the feed returned fewer bars, and report a 4-month return under a 12-month
 * label. Fewer bars than the window means null.
 *
 * NOT a row-offset shortcut of the kind that produced the CPI defect: this is a
 * daily price series with no missing-observation convention, so bar count is
 * the window. An economic series would need date alignment (see lib/yoy.ts).
 */
export function trailingReturnPercent(closes: number[], sessions: number = SESSIONS_PER_YEAR): number | null {
  if (!Array.isArray(closes) || sessions <= 0) return null
  if (closes.length < sessions + 1) return null
  const last = closes[closes.length - 1]
  const base = closes[closes.length - 1 - sessions]
  if (typeof last !== "number" || typeof base !== "number") return null
  if (!Number.isFinite(last) || !Number.isFinite(base) || base <= 0) return null
  return ((last - base) / base) * 100
}

/**
 * 12-1 momentum: the trailing-year return that STOPS one month ago.
 *
 * Jegadeesh & Titman (1993) and every momentum factor built on it skip the most
 * recent month, because short-horizon returns reverse and including them mixes
 * a reversal signal into a trend signal. Reported alongside the plain 12-month
 * return rather than instead of it — they disagree exactly when a falling stock
 * has begun to turn, which is the case worth seeing.
 */
export function momentum12m1(closes: number[]): number | null {
  if (!Array.isArray(closes)) return null
  const need = SESSIONS_PER_YEAR + 1
  if (closes.length < need) return null
  const recent = closes[closes.length - 1 - SESSIONS_PER_MONTH]
  const base = closes[closes.length - 1 - SESSIONS_PER_YEAR]
  if (typeof recent !== "number" || typeof base !== "number") return null
  if (!Number.isFinite(recent) || !Number.isFinite(base) || base <= 0) return null
  return ((recent - base) / base) * 100
}

/**
 * Weinstein Stage 4 (decline): price below a 30-week moving average that is
 * ITSELF falling.
 *
 * 30 weeks is 150 trading sessions. The slope is the part that matters and the
 * part usually dropped: price below a RISING long MA is a pullback inside an
 * advance, which is the setup a put seller wants, while price below a FALLING
 * one is the stage Weinstein's whole method exists to keep you out of. A gate
 * built on `price < sma150` alone would reject the first and the second
 * identically.
 *
 * The two averages are passed in — the caller computes them with the house
 * `sma()` from lib/indicators.ts, `sma150Prior` being the same average as of
 * `SESSIONS_PER_MONTH` sessions earlier. Null when either is unavailable.
 */
export function isStage4Decline(
  price: number | null | undefined,
  sma150Now: number | null | undefined,
  sma150Prior: number | null | undefined,
): boolean | null {
  if (typeof price !== "number" || typeof sma150Now !== "number" || typeof sma150Prior !== "number") return null
  if (!Number.isFinite(price) || !Number.isFinite(sma150Now) || !Number.isFinite(sma150Prior)) return null
  return price < sma150Now && sma150Now < sma150Prior
}

/**
 * Relative return against the benchmark, in percentage points.
 *
 * The simple form of what IBD's RS Rating and Mansfield's Relative Performance
 * both measure. Positive = outperformed. This is the clause that separates "it
 * fell" from "it fell while the market rose": a stock down 5% in a year the
 * index fell 20% is not the laggard the plain sign test calls it.
 */
export function relativeReturnPoints(stockPercent: number | null, benchPercent: number | null): number | null {
  if (typeof stockPercent !== "number" || typeof benchPercent !== "number") return null
  if (!Number.isFinite(stockPercent) || !Number.isFinite(benchPercent)) return null
  return stockPercent - benchPercent
}
