/**
 * Reference-vector check for lib/black-scholes.ts.
 * Run: node scripts/check-black-scholes.ts
 *
 * Standalone (no test runner installed yet — Phase 4 adds one and these vectors
 * move into lib/__tests__/). Exits non-zero on failure so CI can gate on it.
 */
import {
  calculateCallDelta,
  calculateOptionPrice,
  calculatePutDelta,
  estimateImpliedVolatility,
  expectedMove,
  probabilityBetween,
  probabilityITM,
} from "../lib/black-scholes.ts"

let failures = 0

function near(label: string, actual: number | null, expected: number, tol: number) {
  const ok = actual !== null && Math.abs(actual - expected) <= tol
  if (!ok) failures++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got ${actual === null ? "null" : actual.toFixed(6)}, want ${expected} ±${tol}`)
}

function isNull(label: string, actual: unknown) {
  const ok = actual === null
  if (!ok) failures++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got ${actual}, want null`)
}

// --- Hull, Options Futures & Other Derivatives: S=42 K=40 r=10% sigma=20% T=0.5
// Published values: call 4.76, put 0.81
const hull = { stockPrice: 42, strikePrice: 40, timeToExpiry: 0.5, volatility: 0.2, riskFreeRate: 0.1 }
near("Hull call price", calculateOptionPrice(hull, true), 4.76, 0.01)
near("Hull put price", calculateOptionPrice(hull, false), 0.81, 0.01)

// --- Put-call parity: C - P = S·e^(-qT) - K·e^(-rT)
const call = calculateOptionPrice(hull, true)!
const put = calculateOptionPrice(hull, false)!
const parity = hull.stockPrice - hull.strikePrice * Math.exp(-hull.riskFreeRate * hull.timeToExpiry)
near("put-call parity", call - put, parity, 1e-6)

// --- Delta relationship: callDelta - putDelta = e^(-qT) = 1 with no dividend
const cd = calculateCallDelta(hull)!
const pd = calculatePutDelta(hull)!
near("callDelta - putDelta", cd - pd, 1, 1e-9)
near("Hull call delta", cd, 0.7791, 0.0005)

// --- Dividend yield must actually be applied (regression: it was accepted and ignored)
const withDiv = { ...hull, dividendYield: 0.03 }
near("call delta w/ 3% div < without", calculateCallDelta(withDiv)! < cd ? 1 : 0, 1, 0)
near("callDelta - putDelta w/ div = e^(-qT)", calculateCallDelta(withDiv)! - calculatePutDelta(withDiv)!,
  Math.exp(-0.03 * 0.5), 1e-9)

// --- Deep ITM / OTM boundaries
near("deep ITM call delta → 1", calculateCallDelta({ ...hull, strikePrice: 1 })!, 1, 1e-4)
near("deep OTM call delta → 0", calculateCallDelta({ ...hull, strikePrice: 5000 })!, 0, 1e-4)
near("deep OTM put delta → 0", calculatePutDelta({ ...hull, strikePrice: 1 })!, 0, 1e-4)

// --- Probability: ATM ITM probability sits just under 0.5 for a put with positive drift
near("P(ITM) call + P(ITM) put = 1", probabilityITM(hull, true)! + probabilityITM(hull, false)!, 1, 1e-9)

// --- probabilityBetween is a proper probability and monotone in width
const base = { stockPrice: 100, timeToExpiry: 0.25, volatility: 0.3, riskFreeRate: 0.045 }
const narrow = probabilityBetween(base, 95, 105)!
const wide = probabilityBetween(base, 80, 120)!
near("narrow band < wide band", narrow < wide ? 1 : 0, 1, 0)
near("full range → 1", probabilityBetween(base, 0.01, 100000)!, 1, 1e-3)
isNull("inverted band → null", probabilityBetween(base, 120, 80))

// --- IV round-trip: price at a known vol, solve back to it
const target = 0.37
const priced = calculateOptionPrice({ ...base, strikePrice: 105, volatility: target }, true)!
near("IV round-trip", estimateImpliedVolatility(100, 105, 0.25, priced, true, 0.045), target, 1e-4)
isNull("IV below intrinsic → null", estimateImpliedVolatility(100, 50, 0.25, 1, true, 0.045))

// --- expectedMove: 1 sigma = S·sigma·sqrt(T)
near("expectedMove 100 @ 30% 1y", expectedMove(100, 0.3, 1), 30, 1e-9)
near("expectedMove scales with sqrt(T)", expectedMove(100, 0.3, 0.25)!, 15, 1e-9)

// --- Degenerate inputs must return null, never a plausible number
isNull("zero time → null", calculateOptionPrice({ ...hull, timeToExpiry: 0 }, true))
isNull("zero vol → null", calculateCallDelta({ ...hull, volatility: 0 }))
isNull("negative price → null", calculateOptionPrice({ ...hull, stockPrice: -1 }, true))
isNull("NaN vol → null", calculatePutDelta({ ...hull, volatility: Number.NaN }))

console.log(failures === 0 ? "\nAll black-scholes reference checks passed." : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
