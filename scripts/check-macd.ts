/**
 * Demonstrates the MACD defect fixed in components/wheel-scanner.tsx (AUDIT_BACKLOG S-1)
 * and checks the replacement behaves like a real signal line.
 *
 * Run: node scripts/check-macd.ts
 *
 * Phase 4: the fixed implementation now lives in lib/indicators.ts (imported
 * below) — the four per-file copies were deleted. The OLD defective variant is
 * kept inline here as the counter-example the degeneracy proof runs against.
 */

import { ema as libEma, macd as libMacd } from "../lib/indicators.ts"

/** The old first-price-seeded EMA the defective scanner used. */
const oldEma = (prices: number[], period: number): number => {
  if (prices.length === 0) return 0
  const k = 2 / (period + 1)
  let e = prices[0]
  for (let i = 1; i < prices.length; i++) e = prices[i] * k + e * (1 - k)
  return e
}

/** The old implementation: signal = macd * 0.9 */
const macdOld = (closes: number[]) => {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 }
  const macd = oldEma(closes, 12) - oldEma(closes, 26)
  const signal = macd * 0.9
  return { macd, signal, histogram: macd - signal }
}

let failures = 0
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
}

// A price series that rises, then rolls over. A real MACD signal line must cross
// the MACD line somewhere in here; sign(macd) alone cannot express that.
const series: number[] = []
for (let i = 0; i < 120; i++) {
  series.push(i < 70 ? 100 + i * 0.8 : 100 + 70 * 0.8 - (i - 70) * 1.1)
}

// 1. The old signal is degenerate: macd > signal is exactly macd > 0, always.
let oldAlwaysMatchesSign = true
for (let n = 26; n <= series.length; n++) {
  const w = series.slice(0, n)
  const { macd, signal } = macdOld(w)
  if (macd === 0) continue
  if (macd > signal !== macd > 0) oldAlwaysMatchesSign = false
}
check(
  "old signal collapses to sign(macd) at every point",
  oldAlwaysMatchesSign,
  "confirms the old MACD column carried no information beyond the MACD line's sign",
)

// 2. The lib signal is NOT a restatement of the sign — it disagrees somewhere.
let disagreements = 0
for (let n = 34; n <= series.length; n++) {
  const w = series.slice(0, n)
  const res = libMacd(w)
  if (res === null) continue
  if (res.macd > res.signal !== res.macd > 0) disagreements++
}
check("lib signal disagrees with sign(macd) somewhere", disagreements > 0, `${disagreements} bars differ`)

// 3. In a fresh uptrend the MACD line leads the signal line (bullish crossover
// state). Note: the trend must be FRESH — on a pure linear ramp the SMA-seeded
// EMAs sit exactly at steady state from the seed onward, so macd ≡ signal
// identically (correct math, but it makes a strict inequality vacuous). A flat
// stretch followed by the trend gives the signal line something to lag behind.
const up = [...Array.from({ length: 40 }, () => 100), ...Array.from({ length: 30 }, (_, i) => 100 + i)]
const upRes = libMacd(up)
check(
  "fresh uptrend → macd above signal",
  upRes !== null && upRes.macd > upRes.signal,
  upRes === null ? "null" : `macd ${upRes.macd.toFixed(4)} vs signal ${upRes.signal.toFixed(4)}`,
)

// 4. In a fresh downtrend the MACD line lags the signal line.
const down = [...Array.from({ length: 40 }, () => 220), ...Array.from({ length: 30 }, (_, i) => 220 - i)]
const downRes = libMacd(down)
check(
  "fresh downtrend → macd below signal",
  downRes !== null && downRes.macd < downRes.signal,
  downRes === null ? "null" : `macd ${downRes.macd.toFixed(4)} vs signal ${downRes.signal.toFixed(4)}`,
)

// 5. Histogram identity holds.
check(
  "histogram = macd - signal",
  upRes !== null && Math.abs(upRes.histogram - (upRes.macd - upRes.signal)) < 1e-12,
)

// 6. Guard: too little history returns null rather than a half-seeded signal
// (the lib's null-not-zero contract — callers must fail-safe).
check("under 34 bars → null", libMacd(series.slice(0, 30)) === null)

// 7. The lib EMA seeds with the SMA of the first `period` values.
check("lib EMA seed = SMA of first `period` values", libEma([1, 2, 3, 4, 5], 5) === 3)

console.log(failures === 0 ? "\nAll MACD checks passed." : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
