/**
 * Yield-curve orientation, in one place with one convention.
 *
 * Dependency-free so scripts/check-yield-curve.ts can exercise it directly.
 *
 * THE CONVENTION: spread = 10Y − 2Y. Positive is a normal upward-sloping
 * curve; negative is an inversion. This matches how every published 2s10s
 * figure is quoted, and matches FRED's own T10Y2Y series that the CCPI macro
 * pillar already reads — so a number from here can be compared against an
 * outside source without a sign flip.
 *
 * WHY IT IS A MODULE. /api/fomc-predictions computed the spread as 2Y − 10Y
 * while testing `spread < 0` for inversion, which is only correct for the
 * opposite orientation. With a perfectly normal curve (2Y 4.25, 10Y 4.69) the
 * Fed tab told users "Inverted (Recession Signal)". A single shared function
 * with the convention stated in its name is how that stops recurring.
 */

export interface YieldCurveRead {
  /** 10Y − 2Y in percentage points. Negative = inverted. */
  spread: number
  inverted: boolean
  /** True when the curve is close enough to flat to be worth flagging. */
  flat: boolean
  label: "Inverted (Recession Signal)" | "Flat" | "Normal"
  signal: "bearish" | "neutral"
}

/** Spread within this many points of zero reads as flat rather than sloped. */
const FLAT_BAND = 0.2

/**
 * @param tenYear  10-year constant-maturity yield, percent.
 * @param twoYear  2-year constant-maturity yield, percent.
 * @returns null when either leg is missing — an unknown curve asserts nothing.
 */
export function readYieldCurve(tenYear: number | null, twoYear: number | null): YieldCurveRead | null {
  if (tenYear === null || twoYear === null || !Number.isFinite(tenYear) || !Number.isFinite(twoYear)) {
    return null
  }
  const spread = Number((tenYear - twoYear).toFixed(4))
  const inverted = spread < 0
  const flat = !inverted && spread <= FLAT_BAND
  return {
    spread,
    inverted,
    flat,
    label: inverted ? "Inverted (Recession Signal)" : flat ? "Flat" : "Normal",
    signal: inverted ? "bearish" : "neutral",
  }
}
