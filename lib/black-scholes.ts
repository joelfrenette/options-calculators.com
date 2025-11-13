// Black-Scholes options pricing model for calculating Delta when Greeks aren't available
// Delta represents the rate of change of option price relative to underlying asset price

// Standard normal cumulative distribution function
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - prob : prob
}

interface BlackScholesParams {
  stockPrice: number // Current price of underlying stock
  strikePrice: number // Strike price of the option
  timeToExpiry: number // Time to expiration in years (days/365)
  volatility: number // Implied volatility (0.30 = 30%)
  riskFreeRate?: number // Risk-free interest rate (default 5%)
  dividendYield?: number // Dividend yield (default 0%)
}

export function calculatePutDelta(params: BlackScholesParams): number {
  const { stockPrice, strikePrice, timeToExpiry, volatility, riskFreeRate = 0.05, dividendYield = 0 } = params

  // Handle edge cases
  if (timeToExpiry <= 0) return strikePrice > stockPrice ? -1 : 0
  if (volatility <= 0) return strikePrice > stockPrice ? -1 : 0

  // Calculate d1 for Black-Scholes
  const d1 =
    (Math.log(stockPrice / strikePrice) +
      (riskFreeRate - dividendYield + (volatility * volatility) / 2) * timeToExpiry) /
    (volatility * Math.sqrt(timeToExpiry))

  // Put delta = -N(-d1) * e^(-dividendYield * timeToExpiry)
  // For simplicity with no dividends: Put delta = N(d1) - 1
  const putDelta = normalCDF(d1) - 1

  return putDelta
}

// Estimate implied volatility from option price using Newton-Raphson method
export function estimateImpliedVolatility(
  stockPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  optionPrice: number,
  isPut = true,
  riskFreeRate = 0.05,
): number {
  // Start with an initial guess based on the option's moneyness
  let volatility = 0.3 // Start at 30% IV

  const maxIterations = 20
  const tolerance = 0.0001

  for (let i = 0; i < maxIterations; i++) {
    const theoreticalPrice = calculateOptionPrice(
      stockPrice,
      strikePrice,
      timeToExpiry,
      volatility,
      riskFreeRate,
      isPut,
    )
    const diff = theoreticalPrice - optionPrice

    if (Math.abs(diff) < tolerance) {
      return volatility
    }

    // Vega (derivative of price with respect to volatility)
    const vega = calculateVega(stockPrice, strikePrice, timeToExpiry, volatility, riskFreeRate)

    if (vega === 0) break

    // Newton-Raphson update
    volatility = volatility - diff / vega
    volatility = Math.max(0.01, Math.min(2, volatility)) // Clamp between 1% and 200%
  }

  return volatility
}

function calculateOptionPrice(
  stockPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number,
  isPut: boolean,
): number {
  const d1 =
    (Math.log(stockPrice / strikePrice) + (riskFreeRate + (volatility * volatility) / 2) * timeToExpiry) /
    (volatility * Math.sqrt(timeToExpiry))
  const d2 = d1 - volatility * Math.sqrt(timeToExpiry)

  if (isPut) {
    return strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(-d2) - stockPrice * normalCDF(-d1)
  } else {
    return stockPrice * normalCDF(d1) - strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(d2)
  }
}

function calculateVega(
  stockPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number,
): number {
  const d1 =
    (Math.log(stockPrice / strikePrice) + (riskFreeRate + (volatility * volatility) / 2) * timeToExpiry) /
    (volatility * Math.sqrt(timeToExpiry))

  const vega = (stockPrice * Math.sqrt(timeToExpiry) * Math.exp((-d1 * d1) / 2)) / Math.sqrt(2 * Math.PI)

  return vega / 100 // Return vega per 1% change in IV
}
