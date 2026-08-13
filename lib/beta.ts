// Beta, computed from prices rather than typed in (P7-21).
//
// WHY THIS FILE EXISTS. `/api/strategy-scanner` shipped ~25 hardcoded beta
// values — `KO: 0.55`, `PG: 0.42` — with no source, no as-of date, and a
// `|| 0.7` for anything not in the table. They sat in a column users read as
// market data, and they drove three separate things: the strategy branch, the
// ranking score, and the human-readable reason string. A number that was true
// on the day someone typed it and has been drifting ever since.
//
// Beta needs no new API. It is the slope of a stock's daily returns regressed
// on the benchmark's, and E-7b/E-7c already store daily closes for the universe
// and for SPY. This is arithmetic on data the site already has.
//
// IMPORT-FREE on purpose so `scripts/check-beta.ts` can load it under node's
// type stripping. Do not add imports — see lib/ccpi/scoring.ts,
// lib/headline-sentiment.ts and components/scanner/fundamental-metrics.ts for
// the same constraint and the reason it exists.

export interface BetaResult {
  /** Slope of stock returns regressed on benchmark returns. */
  beta: number
  /** Number of paired daily returns used. */
  observations: number
  /**
   * R², how much of the stock's variance the benchmark explains. Reported
   * because a beta from an unrelated series is still a number: a slope with an
   * R² near zero is arithmetic, not a relationship, and the caller deserves to
   * be able to tell the difference.
   */
  rSquared: number
  /** Oldest and newest day in the paired window, so the figure can be dated. */
  from: string
  to: string
}

/** Simple daily returns from a close series ordered OLDEST FIRST. */
export function dailyReturns(closes: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]
    const cur = closes[i]
    if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev <= 0) {
      // A gap makes the NEXT return meaningless too, so it is dropped rather
      // than bridged. Bridging would invent a day of price action.
      out.push(Number.NaN)
      continue
    }
    out.push(cur / prev - 1)
  }
  return out
}

/**
 * Beta of `stock` against `benchmark`, from date-aligned closes.
 *
 * ALIGNMENT IS BY DATE, NEVER BY POSITION. This is the P6-16 rule — the one
 * that cost the project a fabricated CPI reading — restated for prices: two
 * series with different holiday coverage or a missing bar will silently
 * mis-pair if you zip them by index, and every returned number will look
 * perfectly reasonable. Only days present in BOTH series contribute.
 *
 * Returns null rather than a number when there is not enough overlap. A beta
 * from 12 observations is not a small beta, it is not a beta.
 */
export function computeBeta(
  stock: { day: string; close: number }[],
  benchmark: { day: string; close: number }[],
  minObservations = 120,
): BetaResult | null {
  if (!Array.isArray(stock) || !Array.isArray(benchmark)) return null

  const byDay = new Map<string, number>()
  for (const b of benchmark) {
    if (Number.isFinite(b?.close) && b.close > 0) byDay.set(b.day, b.close)
  }

  // Intersect on date, then sort oldest-first so the return series is ordered.
  const paired = stock
    .filter((s) => Number.isFinite(s?.close) && s.close > 0 && byDay.has(s.day))
    .map((s) => ({ day: s.day, s: s.close, b: byDay.get(s.day) as number }))
    .sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : 0))

  if (paired.length < minObservations + 1) return null

  const rs = dailyReturns(paired.map((p) => p.s))
  const rb = dailyReturns(paired.map((p) => p.b))

  // Drop any pair where either side is not finite, so one bad bar costs two
  // observations rather than poisoning the whole regression.
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i < rs.length; i++) {
    if (Number.isFinite(rs[i]) && Number.isFinite(rb[i])) {
      ys.push(rs[i])
      xs.push(rb[i])
    }
  }
  const n = xs.length
  if (n < minObservations) return null

  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n

  let cov = 0
  let varX = 0
  let varY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    cov += dx * dy
    varX += dx * dx
    varY += dy * dy
  }

  // A benchmark that never moved has no slope to measure. This cannot happen
  // with real index data and is guarded anyway, because dividing by it would
  // produce Infinity and Infinity formats as a number on a page.
  if (varX <= 0) return null

  const beta = cov / varX
  if (!Number.isFinite(beta)) return null

  const rSquared = varY > 0 ? (cov * cov) / (varX * varY) : 0

  return {
    beta,
    observations: n,
    rSquared,
    from: paired[0].day,
    to: paired[paired.length - 1].day,
  }
}

/**
 * R² below which a beta must be shown WITH its R², not suppressed.
 *
 * The first draft of this constant suppressed the beta entirely below 0.1, on
 * the reasoning that a slope the benchmark barely explains is not a stability
 * reading. **Measuring it against the real store proved that backwards.**
 *
 * Over the full stored history: QQQ β=1.26 R²=0.90, AAPL 1.17/0.52, NVDA
 * 2.13/0.50, MSFT 1.13/0.48 — textbook. And KO β=0.257 R²=0.070. Suppressing KO
 * would have hidden the true answer, which is *"this barely tracks the market"*
 * — the single most useful thing a calendar-spread screen can know about a
 * candidate. A low-R² low-beta name is not an unmeasurable stock; it is a
 * decoupled one, and the regression said so correctly.
 *
 * So the beta always shows. Below this threshold the caller must publish the R²
 * beside it, so "0.26" is never read as "tracks the market at a quarter of its
 * amplitude" when it means "mostly does its own thing".
 */
export const R_SQUARED_NEEDS_DISCLOSURE = 0.3

/**
 * WINDOW CHOICE IS A JUDGEMENT, AND IT MOVES THE NUMBER.
 *
 * Measured on the store: KO is β=0.257 (R² 0.070) over five years and β=−0.022
 * (R² 0.000) over the trailing two. Both are correct regressions of the same
 * stock on the same benchmark. The hardcoded `KO: 0.55` that P7-21 is replacing
 * matches neither.
 *
 * That spread is largest for exactly the low-beta defensive names this scanner
 * selects, so the window is not a detail — it is the answer. It is stated in
 * the payload beside every beta rather than left implicit.
 */
export const DEFAULT_BETA_WINDOW_DAYS = 1250
