/**
 * lib/indicators.ts — the single shared technical-indicator library.
 *
 * Phase 4 extraction (AUDIT_PLAN.md §Phase 4, FORMULAS.md §1): replaces the four
 * duplicated indicator suites in components/wheel-scanner.tsx,
 * app/api/trend-analysis/route.ts, lib/qqq-technicals.ts and
 * app/api/market-sentiment/route.ts.
 *
 * Contract: pure functions, no I/O. Every function returns `null` — never 0,
 * never a fabricated value — when the input series is too short to compute the
 * indicator. Callers MUST handle null explicitly (fail-safe gates, "—" display).
 * This kills the SMA-returns-0 boundary that made `sma50 > sma200` always true
 * for IPOs (a false Golden Cross, FORMULAS.md §1).
 *
 * Checked by scripts/check-indicators.ts (run via `pnpm check:formulas`).
 */

/**
 * Simple moving average of the LAST `period` values.
 *
 * Reference: arithmetic mean; standard definition.
 * @returns null when `values.length < period` (the old copies returned 0,
 * which poisoned every `price > sma` and golden-cross comparison).
 */
export function sma(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null
  let sum = 0
  for (let i = values.length - period; i < values.length; i++) sum += values[i]
  return sum / period
}

/**
 * Exponential moving average over the full series.
 *
 * Reference: k = 2/(period+1), seeded with the SMA of the first `period`
 * values (the standard seed; Appel's convention for MACD components).
 * @returns null when `values.length < period`.
 */
export function ema(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null
  const k = 2 / (period + 1)
  let e = 0
  for (let i = 0; i < period; i++) e += values[i]
  e /= period
  for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k)
  return e
}

/**
 * Relative Strength Index with WILDER's smoothing.
 *
 * Reference: Wilder, *New Concepts in Technical Trading Systems* (1978):
 * seed avgGain/avgLoss with the SMA of the first `period` gains/losses, then
 * smooth as (prev·(period−1) + current)/period over the REST OF THE SERIES.
 * Replaces the one-shot Cutler-style variant (backlog S-2) that averaged only
 * the last 14 changes — StockCharts vector: Cutler 30.22 vs Wilder 37.79.
 *
 * Boundary: a flat series (avgGain = avgLoss = 0) returns 50 (neutral), not
 * the old copies' 100 ("max overbought").
 * @returns null when `values.length < period + 1`.
 */
export function rsi(values: number[], period = 14): number | null {
  if (period <= 0 || values.length < period + 1) return null

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1]
    if (change > 0) avgGain += change
    else avgLoss -= change
  }
  avgGain /= period
  avgLoss /= period

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

  if (avgGain === 0 && avgLoss === 0) return 50 // flat series → neutral
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

/**
 * MACD(12, 26, 9).
 *
 * Reference: Appel — MACD line = EMA12 − EMA26; signal = EMA9 of the MACD
 * SERIES (not a scaled copy of the current value, see backlog S-1);
 * histogram = MACD − signal.
 *
 * Computed in a single O(n) pass with running EMA12/EMA26 (the old copies
 * re-sliced the array at every bar — O(n²)). EMAs are SMA-seeded, and the
 * signal EMA is seeded with the SMA of the first 9 MACD values, so 26 bars
 * for the first MACD value + 8 more for the signal seed = 34 bars minimum.
 * @returns null when `values.length < 34`.
 */
export function macd(values: number[]): { macd: number; signal: number; histogram: number } | null {
  if (values.length < 34) return null

  const k12 = 2 / 13
  const k26 = 2 / 27
  const k9 = 2 / 10

  // Seed the running EMAs with the SMAs of the first 12 / 26 values.
  let e12 = 0
  for (let i = 0; i < 12; i++) e12 += values[i]
  e12 /= 12
  for (let i = 12; i < 26; i++) e12 = values[i] * k12 + e12 * (1 - k12)

  let e26 = 0
  for (let i = 0; i < 26; i++) e26 += values[i]
  e26 /= 26

  // MACD series exists from bar 26 onward; signal EMA seeds on its first 9 values.
  let macdLine = e12 - e26
  let signal = macdLine // becomes the SMA seed below
  let seedSum = macdLine
  let seedCount = 1

  for (let i = 26; i < values.length; i++) {
    e12 = values[i] * k12 + e12 * (1 - k12)
    e26 = values[i] * k26 + e26 * (1 - k26)
    macdLine = e12 - e26

    if (seedCount < 9) {
      seedSum += macdLine
      seedCount++
      signal = seedSum / seedCount
    } else {
      signal = macdLine * k9 + signal * (1 - k9)
    }
  }

  return { macd: macdLine, signal, histogram: macdLine - signal }
}

/**
 * Bollinger Bands over the LAST `period` values.
 *
 * Reference: Bollinger, *Bollinger on Bollinger Bands* — middle = SMA(period),
 * bands at ±mult standard deviations using the POPULATION σ (divide by N),
 * which is Bollinger's published definition.
 * @returns null when `values.length < period`.
 */
export function bollinger(
  values: number[],
  period = 20,
  mult = 2,
): { upper: number; middle: number; lower: number } | null {
  const middle = sma(values, period)
  if (middle === null) return null

  let sumSq = 0
  for (let i = values.length - period; i < values.length; i++) {
    const d = values[i] - middle
    sumSq += d * d
  }
  const stdDev = Math.sqrt(sumSq / period) // population σ

  return { upper: middle + mult * stdDev, middle, lower: middle - mult * stdDev }
}

/**
 * Raw stochastic %K over the last `period` bars (no %D smoothing).
 *
 * Reference: Lane — %K = 100·(C − L_period)/(H_period − L_period).
 * Boundary: a flat window (highest high = lowest low) returns 50 (neutral).
 * @returns null when any input series is shorter than `period`.
 */
export function stochasticK(closes: number[], highs: number[], lows: number[], period = 14): number | null {
  if (period <= 0 || closes.length < period || highs.length < period || lows.length < period) return null

  const currentClose = closes[closes.length - 1]
  let highestHigh = -Infinity
  let lowestLow = Infinity
  for (let i = highs.length - period; i < highs.length; i++) {
    if (highs[i] > highestHigh) highestHigh = highs[i]
  }
  for (let i = lows.length - period; i < lows.length; i++) {
    if (lows[i] < lowestLow) lowestLow = lows[i]
  }

  if (highestHigh === lowestLow) return 50 // flat window → neutral
  return ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100
}

/**
 * Average True Range with WILDER's smoothing.
 *
 * Reference: Wilder, *New Concepts in Technical Trading Systems* (1978):
 * TR = max(H − L, |H − C_prev|, |L − C_prev|); ATR seeded with the SMA of the
 * first `period` TRs, then smoothed as (prev·(period−1) + TR)/period.
 * The old copies used a simple mean of the last 14 TRs (FORMULAS.md §1).
 * @returns null when fewer than `period + 1` bars are available (a TR needs a
 * previous close, so `period` TRs need `period + 1` bars).
 */
export function atr(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  const n = Math.min(highs.length, lows.length, closes.length)
  if (period <= 0 || n < period + 1) return null

  const trueRange = (i: number) => {
    const prevClose = closes[i - 1]
    return Math.max(highs[i] - lows[i], Math.abs(highs[i] - prevClose), Math.abs(lows[i] - prevClose))
  }

  // Seed: SMA of the first `period` true ranges (bars 1..period).
  let a = 0
  for (let i = 1; i <= period; i++) a += trueRange(i)
  a /= period

  // Wilder smoothing over the remaining bars.
  for (let i = period + 1; i < n; i++) {
    a = (a * (period - 1) + trueRange(i)) / period
  }

  return a
}
