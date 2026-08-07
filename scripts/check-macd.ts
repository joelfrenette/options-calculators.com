/**
 * Demonstrates the MACD defect fixed in components/wheel-scanner.tsx (AUDIT_BACKLOG S-1)
 * and checks the replacement behaves like a real signal line.
 *
 * Run: node scripts/check-macd.ts
 *
 * The scanner's calculateMACD/calculateEMA are closures inside the component, so
 * they are re-implemented here verbatim. Phase 4 extracts them to lib/indicators.ts
 * and these become real unit tests.
 */

const ema = (prices: number[], period: number): number => {
  if (prices.length === 0) return 0
  const k = 2 / (period + 1)
  let e = prices[0]
  for (let i = 1; i < prices.length; i++) e = prices[i] * k + e * (1 - k)
  return e
}

/** The old implementation: signal = macd * 0.9 */
const macdOld = (closes: number[]) => {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 }
  const macd = ema(closes, 12) - ema(closes, 26)
  const signal = macd * 0.9
  return { macd, signal, histogram: macd - signal }
}

/** The fix: signal = 9-period EMA of the MACD series */
const macdNew = (closes: number[]) => {
  if (closes.length < 34) return { macd: 0, signal: 0, histogram: 0 }
  const series: number[] = []
  for (let i = 26; i <= closes.length; i++) {
    const w = closes.slice(0, i)
    series.push(ema(w, 12) - ema(w, 26))
  }
  const macd = series[series.length - 1]
  const signal = ema(series, 9)
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

// 2. The new signal is NOT a restatement of the sign — it disagrees somewhere.
let disagreements = 0
for (let n = 34; n <= series.length; n++) {
  const w = series.slice(0, n)
  const { macd, signal } = macdNew(w)
  if (macd > signal !== macd > 0) disagreements++
}
check("new signal disagrees with sign(macd) somewhere", disagreements > 0, `${disagreements} bars differ`)

// 3. On a steady uptrend the MACD line leads the signal line (bullish crossover state).
const up = Array.from({ length: 120 }, (_, i) => 100 + i)
const upRes = macdNew(up)
check("steady uptrend → macd above signal", upRes.macd > upRes.signal, `macd ${upRes.macd.toFixed(4)} vs signal ${upRes.signal.toFixed(4)}`)

// 4. On a steady downtrend the MACD line lags the signal line.
const down = Array.from({ length: 120 }, (_, i) => 220 - i)
const downRes = macdNew(down)
check("steady downtrend → macd below signal", downRes.macd < downRes.signal, `macd ${downRes.macd.toFixed(4)} vs signal ${downRes.signal.toFixed(4)}`)

// 5. Histogram identity holds.
check("histogram = macd - signal", Math.abs(upRes.histogram - (upRes.macd - upRes.signal)) < 1e-12)

// 6. Guard: too little history returns zeros rather than a half-seeded signal.
check("under 34 bars → zeros", macdNew(series.slice(0, 30)).signal === 0)

console.log(failures === 0 ? "\nAll MACD checks passed." : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
