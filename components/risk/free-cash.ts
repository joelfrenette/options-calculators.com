/**
 * Where you actually stand against the band's cash target.
 *
 * P7-79. The Risk Calculator took ONE input — portfolio value — and multiplied
 * it by the band percentage. That produces a TARGET and never a measurement: it
 * never asked what you hold, so it could not say whether you were on it.
 *
 * The cited framework's own metric is
 *
 *     Cash Allocation % = Free Liquid Cash ÷ Current Account Value × 100
 *
 * where **Free Liquid Cash excludes collateral pledged against open
 * cash-secured puts**. That exclusion is the whole point of the metric. Someone
 * holding $30,000 cash against $20,000 of pledged collateral has $10,000 free.
 * The account shows 30%; the deployable figure is 10%. Against a 15-25% target
 * the first reads comfortably on target and the second reads badly under — and
 * only the second is true.
 *
 * IMPORT-FREE, so a check script can load it under plain `node` (P7-67).
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ───────────────────────────────────────
 * It does not clamp. Committed collateral exceeding cash on hand is arithmetic
 * that should be impossible in a real brokerage account, so if it appears it is
 * either a typo or something genuinely wrong — either way the honest response is
 * to report a negative free-cash figure and let the reader see it, not to floor
 * it at zero and render a calm 0%.
 */

export interface FreeCashInputs {
  /** Total account value. NULL when not entered. */
  accountValue: number | null
  /** Cash showing in the account, before collateral. NULL when not entered. */
  cashOnHand: number | null
  /** Cash pledged against open cash-secured puts. NULL when not entered. */
  committedCollateral: number | null
}

export type FreeCashStanding = "under" | "within" | "over"

export interface FreeCashPosition {
  /** Cash on hand minus committed collateral. May be negative — see the header. */
  freeCash: number
  /** Free cash as a percentage of account value. */
  freeCashPercent: number
  /** Where that sits against the band's target range. */
  standing: FreeCashStanding
  /** Percentage points away from the nearest edge of the target; 0 when within. */
  distanceFromTarget: number
  /**
   * TRUE when committed collateral exceeds cash on hand. Not an error this
   * module resolves — it is reported so the UI can say so plainly.
   */
  overCommitted: boolean
}

/**
 * @returns the position, or NULL when it cannot be computed.
 *
 * Null rather than a partial answer: a free-cash percentage with a missing
 * denominator is not a smaller version of the figure, it is a different
 * quantity. A zero or negative account value is treated as missing — an account
 * worth nothing has no allocation.
 */
export function computeFreeCashPosition(
  inputs: FreeCashInputs,
  targetMin: number,
  targetMax: number,
): FreeCashPosition | null {
  const { accountValue, cashOnHand, committedCollateral } = inputs
  if (accountValue === null || cashOnHand === null || committedCollateral === null) return null
  if (!Number.isFinite(accountValue) || !Number.isFinite(cashOnHand) || !Number.isFinite(committedCollateral)) {
    return null
  }
  if (accountValue <= 0) return null
  // Negative inputs are a typo, not a position.
  if (cashOnHand < 0 || committedCollateral < 0) return null

  const freeCash = cashOnHand - committedCollateral
  const freeCashPercent = (freeCash / accountValue) * 100
  if (!Number.isFinite(freeCashPercent)) return null

  const rounded = Math.round(freeCashPercent * 10) / 10
  const standing: FreeCashStanding = rounded < targetMin ? "under" : rounded > targetMax ? "over" : "within"
  const distanceFromTarget =
    standing === "under"
      ? Math.round((targetMin - rounded) * 10) / 10
      : standing === "over"
        ? Math.round((rounded - targetMax) * 10) / 10
        : 0

  return {
    freeCash,
    freeCashPercent: rounded,
    standing,
    distanceFromTarget,
    overCommitted: committedCollateral > cashOnHand,
  }
}

/**
 * Plain-language reading of the standing, naming the target it was measured
 * against so the sentence stands on its own.
 *
 * "Under" is stated as holding LESS cash than the band calls for, which on this
 * framework means more deployed — not a warning in itself. The copy deliberately
 * does not tell anyone what to do about it.
 */
export function describeStanding(position: FreeCashPosition, targetMin: number, targetMax: number): string {
  const pct = `${position.freeCashPercent}%`
  const target = `${targetMin}-${targetMax}%`
  if (position.overCommitted) {
    return `Committed collateral exceeds cash on hand, so free cash is negative (${pct}). Check the two figures.`
  }
  if (position.standing === "within") return `Free cash ${pct} is inside this band's ${target} target.`
  if (position.standing === "under") {
    return `Free cash ${pct} is ${position.distanceFromTarget} points below this band's ${target} target — more deployed than the framework calls for.`
  }
  return `Free cash ${pct} is ${position.distanceFromTarget} points above this band's ${target} target — more held back than the framework calls for.`
}
