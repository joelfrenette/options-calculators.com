/**
 * The seven Fear & Greed component scores, each 0-100.
 *
 * Split out of `app/api/market-sentiment/route.ts` (P6-13) unchanged. These are
 * pure arithmetic over already-fetched inputs, which is the reason they are
 * worth having on their own: nothing in this file reaches the network, so what
 * each score does with an extreme or a boundary value can be read directly.
 */


/**
 * INDICATOR CALCULATION FUNCTIONS
 * Each function returns a score from 0-100 where:
 * - 0-24 = Extreme Fear
 * - 25-44 = Fear
 * - 45-55 = Neutral
 * - 56-74 = Greed
 * - 75-100 = Extreme Greed
 */

export function calculateMarketMomentum(currentPrice: number, ma125: number): number {
  const percentAboveMA = ((currentPrice - ma125) / ma125) * 100
  // Mapping: -10% below MA = 0 (extreme fear), +10% above MA = 100 (extreme greed)
  const score = 50 + percentAboveMA * 5
  return Math.max(0, Math.min(100, score))
}

export function calculateStockStrength(highs: number, lows: number): number {
  if (highs + lows === 0) return 50 // Neutral if no data
  const ratio = highs / (highs + lows)
  // Mapping: ratio of 0 (all lows) = 0, ratio of 1 (all highs) = 100
  return ratio * 100
}

export function calculateStockBreadth(volumeRatios: number[], priceChanges: number[]): number {
  if (priceChanges.length === 0) return 50

  const advancingDays = priceChanges.filter((change) => change > 0).length
  const advancingVolume = volumeRatios.slice(0, advancingDays).reduce((sum, vol) => sum + vol, 0)
  const totalVolume = volumeRatios.reduce((sum, vol) => sum + vol, 0)

  const breadthRatio = totalVolume > 0 ? advancingVolume / totalVolume : 0.5
  return breadthRatio * 100
}

export function calculatePutCallRatio(vixCurrent: number, vix50DayMA: number): number {
  // Approximation: High VIX vs MA = more puts = fear = lower score
  const vixRatio = vixCurrent / vix50DayMA
  // Mapping: VIX 150% above MA = 0 (extreme fear), VIX 50% below MA = 100 (extreme greed)
  const score = 100 - (vixRatio - 1) * 100
  return Math.max(0, Math.min(100, score))
}

/**
 * Market Volatility, mapped from the VIX LEVEL: 10 → 100 (calm/greed),
 * 40 → 0 (stressed/fear), clamped.
 *
 * This function used to take a `vix50DayMA` parameter, compute
 * `percentAboveMA` from it, never use the result, and carry the comment
 * "Mapping: VIX +50% above MA = 0 ... VIX -50% below MA = 100" — describing a
 * VIX-versus-its-average calculation the body does not perform. Three ways of
 * saying the same thing: a dead parameter, a dead variable, and a comment
 * documenting the intent rather than the code.
 *
 * **The comment was describing CNN's actual method.** CNN's Market Volatility
 * component compares VIX to its 50-day moving average; this maps the raw level,
 * so a persistently high-VIX regime reads as fear here and as neutral for CNN
 * once the average catches up. The level map is KEPT — changing a live score
 * needs evidence that the alternative is better, not just that a stale comment
 * preferred it — and the divergence is disclosed with the rest of the
 * CNN-methodology caveats (P6-59). Deleting the parameter is what stops the
 * next reader believing the average is involved.
 */
export function calculateMarketVolatility(vixCurrent: number): number {
  const score = 100 - ((vixCurrent - 10) / 30) * 100
  return Math.max(0, Math.min(100, score))
}

export function calculateSafeHavenDemand(spyReturn: number, tltReturn: number): number {
  if (isNaN(spyReturn) || isNaN(tltReturn) || !isFinite(spyReturn) || !isFinite(tltReturn)) {
    console.log("[v0] Safe Haven data is invalid (NaN), using neutral score 50")
    return 50
  }
  const spread = spyReturn - tltReturn
  // Mapping: Bonds outperform by 10% = 0 (extreme fear), Stocks outperform by 10% = 100 (extreme greed)
  const score = 50 + spread * 5
  return Math.max(0, Math.min(100, score))
}

export function calculateJunkBondDemand(hygReturn: number, tltReturn: number): number {
  if (isNaN(hygReturn) || isNaN(tltReturn) || !isFinite(hygReturn) || !isFinite(tltReturn)) {
    console.log("[v0] Junk Bond data is invalid (NaN), using neutral score 50")
    return 50
  }
  const spread = hygReturn - tltReturn
  // Mapping: Wide spread (bonds winning) = 0 (fear), Narrow spread = 100 (greed)
  const score = 50 + spread * 10
  return Math.max(0, Math.min(100, score))
}
