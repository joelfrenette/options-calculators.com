/**
 * Check runner for lib/indicators.ts — the Phase 4 shared indicator library.
 *
 * Run: node scripts/check-indicators.ts   (wired into `pnpm check:formulas`)
 *
 * Verifies, against published or hand-computable vectors (FORMULAS.md §1):
 *  - Wilder RSI on the StockCharts published RSI-14 vector (the repo's old
 *    Cutler variant gave 30.22 where Wilder gives 37.79)
 *  - MACD(12,26,9) against a straightforward textbook implementation
 *  - Bollinger bands with population σ on a hand vector
 *  - ATR gap-day true range = 5.00, and Wilder ATR ≠ simple-mean ATR
 *  - null (never 0) on short inputs for every function
 *  - flat-series RSI = 50, flat-window stochastic %K = 50
 */

import { sma, ema, rsi, macd, bollinger, stochasticK, atr } from "../lib/indicators.ts"

let failures = 0
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
}

// Deterministic PRNG so the random-walk checks are reproducible.
const mulberry32 = (seed: number) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// ---------------------------------------------------------------------------
// 1. Wilder RSI vs the StockCharts published RSI-14 vector (QQQQ example).
// Published first RSI: 70.46; published final RSI: 37.79 (Wilder smoothing).
// The repo's old one-shot Cutler variant gave 30.22 on the same closes.
// ---------------------------------------------------------------------------
const stockChartsCloses = [
  44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89,
  46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64, 46.21, 46.25,
  45.71, 46.45, 45.78, 45.35, 44.03, 44.18, 44.22, 44.57, 43.42, 42.66, 43.13,
]

const firstRsi = rsi(stockChartsCloses.slice(0, 15), 14)
check(
  "Wilder RSI seed matches StockCharts (70.46)",
  firstRsi !== null && Math.abs(firstRsi - 70.46) < 0.15,
  `got ${firstRsi?.toFixed(2)}`,
)

const finalRsi = rsi(stockChartsCloses, 14)
check(
  "Wilder RSI on full StockCharts vector = 37.79",
  finalRsi !== null && Math.abs(finalRsi - 37.79) < 0.15,
  `got ${finalRsi?.toFixed(2)} (old Cutler variant gave 30.22)`,
)

// The old Cutler-style one-shot variant, re-implemented to prove the divergence.
const cutlerRsi = (closes: number[], period = 14): number => {
  const changes: number[] = []
  for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1])
  const recent = changes.slice(-period)
  const avgGain = recent.filter((c) => c > 0).reduce((a, b) => a + b, 0) / period
  const avgLoss = recent.filter((c) => c < 0).reduce((a, b) => a - b, 0) / period
  if (avgLoss === 0) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}
const cutler = cutlerRsi(stockChartsCloses)
check(
  "old Cutler variant diverges from Wilder on the same closes",
  Math.abs(cutler - 30.22) < 0.15 && finalRsi !== null && Math.abs(finalRsi - cutler) > 5,
  `Cutler ${cutler.toFixed(2)} vs Wilder ${finalRsi?.toFixed(2)}`,
)

// Flat series → 50 (neutral), not 100 ("max overbought", the old boundary bug).
check("flat-series RSI = 50", rsi(Array(100).fill(30), 14) === 50)

// ---------------------------------------------------------------------------
// 2. MACD(12,26,9) vs a straightforward textbook implementation on a long
// random walk. The textbook version recomputes the MACD series by re-slicing
// (O(n²)); the lib computes it in one pass — results must agree to 1e-9.
// ---------------------------------------------------------------------------
const textbookEma = (vals: number[], period: number): number => {
  const k = 2 / (period + 1)
  let e = vals.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < vals.length; i++) e = vals[i] * k + e * (1 - k)
  return e
}
const textbookMacd = (closes: number[]) => {
  const series: number[] = []
  for (let i = 26; i <= closes.length; i++) {
    const w = closes.slice(0, i)
    series.push(textbookEma(w, 12) - textbookEma(w, 26))
  }
  const m = series[series.length - 1]
  const signal = textbookEma(series, 9)
  return { macd: m, signal, histogram: m - signal }
}

const rand = mulberry32(20260807)
const walk: number[] = [100]
for (let i = 1; i < 400; i++) walk.push(walk[i - 1] * (1 + (rand() - 0.5) * 0.03))

const libMacd = macd(walk)
const refMacd = textbookMacd(walk)
check(
  "MACD line matches textbook on 400-bar random walk",
  libMacd !== null && Math.abs(libMacd.macd - refMacd.macd) < 1e-9,
  `Δ ${libMacd === null ? "null" : Math.abs(libMacd.macd - refMacd.macd).toExponential(2)}`,
)
check(
  "MACD signal matches textbook on 400-bar random walk",
  libMacd !== null && Math.abs(libMacd.signal - refMacd.signal) < 1e-9,
  `Δ ${libMacd === null ? "null" : Math.abs(libMacd.signal - refMacd.signal).toExponential(2)}`,
)
check(
  "MACD histogram identity holds",
  libMacd !== null && Math.abs(libMacd.histogram - (libMacd.macd - libMacd.signal)) < 1e-12,
)

// Crossover state must agree with the textbook at every window length.
let crossoverAgree = true
for (let n = 34; n <= walk.length; n += 7) {
  const w = walk.slice(0, n)
  const a = macd(w)
  const b = textbookMacd(w)
  if (a === null || a.macd > a.signal !== b.macd > b.signal) crossoverAgree = false
}
check("MACD crossover state agrees with textbook at every sampled window", crossoverAgree)

// ---------------------------------------------------------------------------
// 3. Bollinger with population σ — hand vector.
// [2,4,4,4,5,5,7,9]: mean 5, population σ exactly 2 → bands at 5 ± 4.
// ---------------------------------------------------------------------------
const bb = bollinger([2, 4, 4, 4, 5, 5, 7, 9], 8, 2)
check(
  "Bollinger population-σ hand vector (mean 5, σ 2 → 1/5/9)",
  bb !== null && Math.abs(bb.middle - 5) < 1e-12 && Math.abs(bb.upper - 9) < 1e-12 && Math.abs(bb.lower - 1) < 1e-12,
  bb === null ? "null" : `got ${bb.lower}/${bb.middle}/${bb.upper}`,
)

// ---------------------------------------------------------------------------
// 4. ATR: gap-day true range and Wilder smoothing.
// Day 0 closes at 100; day 1 gaps up to H 105 / L 103 / C 104:
// TR = max(105−103, |105−100|, |103−100|) = 5.00.
// ---------------------------------------------------------------------------
const gapAtr = atr([101, 105], [99, 103], [100, 104], 1)
check("ATR gap-day true range = 5.00", gapAtr !== null && Math.abs(gapAtr - 5) < 1e-12, `got ${gapAtr}`)

// Wilder-smoothed ATR must differ from the simple mean of the last 14 TRs
// (the old copies' method) on a volatile series.
const rand2 = mulberry32(42)
const closes2: number[] = [100]
const highs2: number[] = [101]
const lows2: number[] = [99]
for (let i = 1; i < 120; i++) {
  const c = closes2[i - 1] * (1 + (rand2() - 0.5) * 0.06)
  closes2.push(c)
  highs2.push(c * (1 + rand2() * 0.02))
  lows2.push(c * (1 - rand2() * 0.02))
}
const simpleMeanAtr = (() => {
  const trs: number[] = []
  for (let i = 1; i < closes2.length; i++) {
    const prev = closes2[i - 1]
    trs.push(Math.max(highs2[i] - lows2[i], Math.abs(highs2[i] - prev), Math.abs(lows2[i] - prev)))
  }
  return trs.slice(-14).reduce((a, b) => a + b, 0) / 14
})()
const wilderAtr = atr(highs2, lows2, closes2, 14)
check(
  "Wilder ATR diverges from simple-mean ATR on a volatile series",
  wilderAtr !== null && Math.abs(wilderAtr - simpleMeanAtr) > 1e-6,
  `Wilder ${wilderAtr?.toFixed(4)} vs simple mean ${simpleMeanAtr.toFixed(4)}`,
)

// ---------------------------------------------------------------------------
// 5. Stochastic %K hand vector and flat-window boundary.
// L14 = 90, H14 = 110, close 102 → %K = (102−90)/(110−90)·100 = 60.0.
// ---------------------------------------------------------------------------
const stochCloses = Array(13).fill(100).concat([102])
const stochHighs = Array(13).fill(110).concat([104])
const stochLows = Array(13).fill(90).concat([100])
const k = stochasticK(stochCloses, stochHighs, stochLows, 14)
check("stochastic %K hand vector = 60.0", k !== null && Math.abs(k - 60) < 1e-12, `got ${k}`)
check("flat-window stochastic %K = 50", stochasticK(Array(20).fill(5), Array(20).fill(5), Array(20).fill(5), 14) === 50)

// ---------------------------------------------------------------------------
// 6. SMA / EMA basics.
// ---------------------------------------------------------------------------
check("SMA of last 3 of [1..5] = 4", sma([1, 2, 3, 4, 5], 3) === 4)
check("EMA with exactly `period` values = their SMA (seed)", ema([1, 2, 3, 4, 5], 5) === 3)

// ---------------------------------------------------------------------------
// 7. Null (never 0) on short inputs — every function.
// ---------------------------------------------------------------------------
check("sma: short input → null", sma([1, 2, 3], 4) === null)
check("ema: short input → null", ema([1, 2, 3], 4) === null)
check("rsi: 14 values (needs 15) → null", rsi(Array(14).fill(100), 14) === null)
check("macd: 33 values (needs 34) → null", macd(walk.slice(0, 33)) === null)
check("macd: 34 values → non-null", macd(walk.slice(0, 34)) !== null)
check("bollinger: short input → null", bollinger([1, 2, 3], 20) === null)
check("stochasticK: short input → null", stochasticK([1], [1], [1], 14) === null)
check("atr: 14 bars (needs 15) → null", atr(Array(14).fill(1), Array(14).fill(1), Array(14).fill(1), 14) === null)
check("sma: empty input → null", sma([], 1) === null)

console.log(failures === 0 ? "\nAll indicator checks passed." : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
