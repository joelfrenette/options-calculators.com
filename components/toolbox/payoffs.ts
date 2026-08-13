/**
 * Payoff curves for the strategy diagrams.
 *
 * Split out of `components/options-strategy-toolbox.tsx` (P6-13) unchanged.
 *
 * Every curve is computed from the structure rather than drawn, and `sample`'s
 * `kinks` argument is why: the strikes are merged into the sample set so each
 * payoff corner lands exactly on a point and the chart spline cannot round it
 * off into a curve the position does not have.
 */

// `kinks` are the strikes (payoff corners): they are merged into the sample set
// so every kink lands exactly on a sample and the chart spline can't round it off.
function sample(minPrice: number, maxPrice: number, steps: number, payoff: (s: number) => number, kinks: number[] = []) {
  const xs = new Set<number>()
  for (let i = 0; i < steps; i++) {
    const x = minPrice + ((maxPrice - minPrice) * i) / (steps - 1)
    xs.add(Math.round(x * 100) / 100)
  }
  for (const k of kinks) {
    if (k > minPrice && k < maxPrice) xs.add(Math.round(k * 100) / 100)
  }
  return Array.from(xs)
    .sort((a, b) => a - b)
    .map((x) => ({ x, y: Math.round(payoff(x) * 100) / 100 }))
}

// Bull put spread (credit): short put K_short, long put K_long (K_long < K_short).
// Net credit = c. P&L per contract:
//   if S >= K_short: +c × 100  (max profit)
//   if S <= K_long:  (K_long - K_short + c) × 100 (max loss, negative)
//   between: linear interpolation
export function generateCreditSpreadPayoff() {
  const K_short = 100
  const K_long = 95
  const credit = 1.5 // $ per share
  const payoff = (S: number) => {
    if (S >= K_short) return credit * 100
    if (S <= K_long) return (K_long - K_short + credit) * 100
    return (S - K_short + credit) * 100
  }
  return sample(85, 115, 100, payoff, [K_long, K_short])
}

// Iron Condor: bull put spread + bear call spread. Net credit = c.
// Profit zone is between the two short strikes; max loss = wing width − c.
export function generateIronCondorPayoff() {
  const putShort = 95,
    putLong = 90 // bull put spread
  const callShort = 105,
    callLong = 110 // bear call spread
  const credit = 2.0
  const payoff = (S: number) => {
    const putPnL = S >= putShort ? 0 : Math.max(S - putShort, putLong - putShort)
    const callPnL = S <= callShort ? 0 : -Math.min(S - callShort, callLong - callShort)
    return (credit + putPnL + callPnL) * 100
  }
  return sample(85, 115, 100, payoff, [putLong, putShort, callShort, callLong])
}

// Calendar spread (call). Pay a debit; max profit at the short strike at
// the front-month expiration (short call expires worthless, long call retains
// time value). The at-front-expiration profile is the difference between the
// long call's value (intrinsic + remaining time premium, simplified) and the
// short call's intrinsic value. We use a simple BS approximation where the
// long call's residual time value is modeled as a normal-like bump.
export function generateCalendarPayoff() {
  const K = 100
  const debit = 2.0
  const remainingTV = 4.0 // approx long call extrinsic at short expiry
  const payoff = (S: number) => {
    const shortIntrinsic = Math.max(0, S - K)
    // Long call value at short expiry ≈ intrinsic + time premium that decays
    // with |S - K| (peaked at K). A Gaussian centered at K models this well.
    const longTimePremium = remainingTV * Math.exp(-Math.pow(S - K, 2) / (2 * 5 * 5))
    const longTotal = Math.max(0, S - K) + longTimePremium
    return (longTotal - shortIntrinsic - debit) * 100
  }
  return sample(85, 115, 100, payoff, [K])
}

// Long Call Butterfly: long 1 call K1, short 2 calls K2, long 1 call K3 (K1<K2<K3).
// Net debit = d. Max profit at K2 = (K2 - K1 - d) × 100. Max loss = d × 100.
export function generateButterflyPayoff() {
  const K1 = 95,
    K2 = 100,
    K3 = 105
  const debit = 1.0
  const c = (S: number, k: number) => Math.max(0, S - k)
  const payoff = (S: number) => (c(S, K1) - 2 * c(S, K2) + c(S, K3) - debit) * 100
  return sample(85, 115, 100, payoff, [K1, K2, K3])
}

// Collar: long 100 shares at entry P0, long put K_p, short call K_c (K_p < P0 < K_c).
// Net cost of options = debit (small or zero).
export function generateCollarPayoff() {
  const entry = 100
  const K_put = 95
  const K_call = 110
  const netDebit = 0.5 // cost of put minus premium of call
  const payoff = (S: number) => {
    const stockPnL = S - entry
    const putPayoff = Math.max(0, K_put - S)
    const callObligation = Math.max(0, S - K_call)
    return (stockPnL + putPayoff - callObligation - netDebit) * 100
  }
  return sample(80, 130, 100, payoff, [K_put, K_call])
}

// Diagonal call spread: long deep-ITM long-dated call (LEAPS) + short
// near-dated OTM call. At short expiry the long call still has time value;
// we model intrinsic + remaining time premium with a Gaussian centered near
// its strike. (PMCC is a specific case of this with K_long deep ITM.)
export function generateDiagonalPayoff() {
  const K_long = 90
  const longCost = 12 // premium paid for the long
  const K_short = 105
  const shortPremium = 1.5
  const remainingTV = 3.5
  const payoff = (S: number) => {
    const longTotal = Math.max(0, S - K_long) + remainingTV * Math.exp(-Math.pow(S - K_long, 2) / (2 * 12 * 12))
    const shortObligation = Math.max(0, S - K_short)
    return (longTotal - longCost - shortObligation + shortPremium) * 100
  }
  return sample(75, 125, 100, payoff, [K_long, K_short])
}

// Long straddle: long 1 call + long 1 put, both at K. Cost = total premium p.
export function generateStraddlePayoff() {
  const K = 100
  const totalPremium = 5
  const payoff = (S: number) => (Math.max(0, S - K) + Math.max(0, K - S) - totalPremium) * 100
  return sample(80, 120, 100, payoff, [K])
}

// The Wheel — there's no single-expiration payoff (it's a cycle), so we
// show the most pedagogically useful slice: a single cash-secured put
// (the entry leg). Capped upside = premium; downside = stock falls below
// strike, partially cushioned by premium.
export function generateWheelPayoff() {
  const K = 50
  const premium = 2 // $ per share for the put
  const payoff = (S: number) => (premium - Math.max(0, K - S)) * 100
  return sample(30, 70, 100, payoff, [K])
}

