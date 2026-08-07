/**
 * Black-Scholes-Merton option pricing and greeks.
 *
 * Pure functions, no I/O — safe to unit-test and safe to import from both route
 * handlers and client components.
 *
 * Conventions used throughout:
 *   - `timeToExpiry` is in YEARS (days / 365).
 *   - `volatility` is a DECIMAL, not a percent: 0.30 means 30% IV.
 *   - `riskFreeRate` and `dividendYield` are continuously-compounded decimals.
 *   - Every function returns `null` when its inputs cannot produce a meaningful
 *     answer (non-positive time, non-positive vol, missing price). Callers must
 *     render "—" rather than substituting a number. Returning a plausible-looking
 *     default here is how fabricated data gets into the UI.
 *
 * Reference: Hull, *Options, Futures, and Other Derivatives*, ch. 15–19.
 */

/**
 * Standard normal CDF, Abramowitz & Stegun 26.2.17 (5-term).
 * Absolute error < 7.5e-8 — far tighter than any input precision we have.
 */
export function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - prob : prob
}

export interface BlackScholesParams {
  stockPrice: number
  strikePrice: number
  /** Years to expiration (days / 365). */
  timeToExpiry: number
  /** Implied volatility as a decimal — 0.30 = 30%. */
  volatility: number
  /** Continuously-compounded risk-free rate. Default 4.5%. */
  riskFreeRate?: number
  /** Continuous dividend yield. Default 0. */
  dividendYield?: number
}

/** True when the inputs can produce a meaningful Black-Scholes result. */
function isUsable(p: BlackScholesParams): boolean {
  return (
    Number.isFinite(p.stockPrice) &&
    Number.isFinite(p.strikePrice) &&
    Number.isFinite(p.timeToExpiry) &&
    Number.isFinite(p.volatility) &&
    p.stockPrice > 0 &&
    p.strikePrice > 0 &&
    p.timeToExpiry > 0 &&
    p.volatility > 0
  )
}

/** d1 and d2. Returns null when the inputs are degenerate. */
function dTerms(p: BlackScholesParams): { d1: number; d2: number } | null {
  if (!isUsable(p)) return null
  const { stockPrice, strikePrice, timeToExpiry, volatility, riskFreeRate = 0.045, dividendYield = 0 } = p
  const sqrtT = volatility * Math.sqrt(timeToExpiry)
  const d1 =
    (Math.log(stockPrice / strikePrice) + (riskFreeRate - dividendYield + (volatility * volatility) / 2) * timeToExpiry) /
    sqrtT
  return { d1, d2: d1 - sqrtT }
}

// ------------------------------------------------------------------- greeks

/**
 * Call delta = e^(-qT) · N(d1). Ranges 0..1.
 * The dividend discount is applied — omitting it (as an earlier revision did)
 * overstates delta on dividend payers.
 */
export function calculateCallDelta(params: BlackScholesParams): number | null {
  const d = dTerms(params)
  if (!d) return null
  const { timeToExpiry, dividendYield = 0 } = params
  return Math.exp(-dividendYield * timeToExpiry) * normalCDF(d.d1)
}

/** Put delta = -e^(-qT) · N(-d1). Ranges -1..0. */
export function calculatePutDelta(params: BlackScholesParams): number | null {
  const d = dTerms(params)
  if (!d) return null
  const { timeToExpiry, dividendYield = 0 } = params
  return -Math.exp(-dividendYield * timeToExpiry) * normalCDF(-d.d1)
}

export function calculateDelta(params: BlackScholesParams, isCall: boolean): number | null {
  return isCall ? calculateCallDelta(params) : calculatePutDelta(params)
}

/** Vega per 1 percentage-point change in IV (i.e. price change for IV 30% → 31%). */
export function calculateVega(params: BlackScholesParams): number | null {
  const d = dTerms(params)
  if (!d) return null
  const { stockPrice, timeToExpiry, dividendYield = 0 } = params
  const pdf = Math.exp((-d.d1 * d.d1) / 2) / Math.sqrt(2 * Math.PI)
  return (stockPrice * Math.exp(-dividendYield * timeToExpiry) * Math.sqrt(timeToExpiry) * pdf) / 100
}

// -------------------------------------------------------------------- price

/** Theoretical option price. Returns null on degenerate inputs. */
export function calculateOptionPrice(params: BlackScholesParams, isCall: boolean): number | null {
  const d = dTerms(params)
  if (!d) return null
  const { stockPrice, strikePrice, timeToExpiry, riskFreeRate = 0.045, dividendYield = 0 } = params
  const discountedStock = stockPrice * Math.exp(-dividendYield * timeToExpiry)
  const discountedStrike = strikePrice * Math.exp(-riskFreeRate * timeToExpiry)

  return isCall
    ? discountedStock * normalCDF(d.d1) - discountedStrike * normalCDF(d.d2)
    : discountedStrike * normalCDF(-d.d2) - discountedStock * normalCDF(-d.d1)
}

// -------------------------------------------------------------- probability

/**
 * Risk-neutral probability the option finishes in the money = N(d2) for a call,
 * N(-d2) for a put.
 *
 * Returned as a decimal 0..1. This is the *risk-neutral* probability, which is
 * what option prices imply; it is not a forecast of real-world odds, and any UI
 * showing it should say "implied", not "chance of winning".
 */
export function probabilityITM(params: BlackScholesParams, isCall: boolean): number | null {
  const d = dTerms(params)
  if (!d) return null
  return isCall ? normalCDF(d.d2) : normalCDF(-d.d2)
}

/** Complement of {@link probabilityITM} — for a short option, the probability it expires worthless. */
export function probabilityOTM(params: BlackScholesParams, isCall: boolean): number | null {
  const p = probabilityITM(params, isCall)
  return p === null ? null : 1 - p
}

/**
 * Probability the underlying finishes between two levels at expiry, under the
 * same lognormal assumption. Used for range strategies (butterflies, condors,
 * calendars) whose profit zone is bounded on both sides.
 */
export function probabilityBetween(
  params: Omit<BlackScholesParams, "strikePrice">,
  lower: number,
  upper: number,
): number | null {
  if (!(upper > lower)) return null
  const below = probabilityITM({ ...params, strikePrice: upper }, false) // P(S_T < upper)
  const belowLower = probabilityITM({ ...params, strikePrice: lower }, false) // P(S_T < lower)
  if (below === null || belowLower === null) return null
  return Math.max(0, Math.min(1, below - belowLower))
}

// ------------------------------------------------------------ expected move

/**
 * One-standard-deviation expected move in price terms: S · σ · √T.
 *
 * This is the standard options-desk approximation and replaces the ad-hoc
 * `ATR × 1.5` fudge that previously stood in for it (AUDIT_BACKLOG S-10).
 */
export function expectedMove(stockPrice: number, volatility: number, timeToExpiry: number): number | null {
  if (!(stockPrice > 0 && volatility > 0 && timeToExpiry > 0)) return null
  return stockPrice * volatility * Math.sqrt(timeToExpiry)
}

// -------------------------------------------------- implied volatility solve

/**
 * Implied volatility from an observed option price, by Newton-Raphson on vega
 * with a bisection guard.
 *
 * Returns null if it fails to converge, rather than the last iterate — a
 * non-converged value is not an IV and must not be displayed as one.
 */
export function estimateImpliedVolatility(
  stockPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  optionPrice: number,
  isCall = false,
  riskFreeRate = 0.045,
  dividendYield = 0,
): number | null {
  if (!(stockPrice > 0 && strikePrice > 0 && timeToExpiry > 0 && optionPrice > 0)) return null

  // Reject prices outside no-arbitrage bounds — no IV can reproduce them.
  const discountedStrike = strikePrice * Math.exp(-riskFreeRate * timeToExpiry)
  const discountedStock = stockPrice * Math.exp(-dividendYield * timeToExpiry)
  const intrinsic = isCall
    ? Math.max(0, discountedStock - discountedStrike)
    : Math.max(0, discountedStrike - discountedStock)
  const upperBound = isCall ? discountedStock : discountedStrike
  if (optionPrice < intrinsic || optionPrice > upperBound) return null

  let volatility = 0.3
  let low = 0.001
  let high = 5

  for (let i = 0; i < 60; i++) {
    const params: BlackScholesParams = {
      stockPrice,
      strikePrice,
      timeToExpiry,
      volatility,
      riskFreeRate,
      dividendYield,
    }
    const price = calculateOptionPrice(params, isCall)
    if (price === null) return null

    const diff = price - optionPrice
    if (Math.abs(diff) < 1e-6) return volatility

    // Keep a bracketing interval so a bad vega cannot throw us off the rails.
    if (diff > 0) high = volatility
    else low = volatility

    const vega = calculateVega(params)
    const vegaPerUnit = vega === null ? 0 : vega * 100 // convert back to per-1.0-vol
    const next = vegaPerUnit > 1e-8 ? volatility - diff / vegaPerUnit : (low + high) / 2

    volatility = next > low && next < high ? next : (low + high) / 2
  }

  return null
}
