/**
 * Model output and formatting for /api/strategy-scanner.
 *
 * Split out of `app/api/strategy-scanner/route.ts` (P6-13) unchanged. Every
 * function here is DERIVED, never measured — the measured inputs come from
 * `./market-data`. `PRICING_PROVENANCE` is the constant that says so on every
 * row the route emits, and it is in this file rather than that one for exactly
 * that reason: it describes what the model did with the data, not the data.
 *
 * The option math itself is `lib/black-scholes.ts` and is never re-implemented
 * here (house rule; P7-12 removed the last duplicate).
 */
import { calculateDelta as bsDelta, calculateOptionPrice, probabilityOTM } from "@/lib/black-scholes"
import { RISK_FREE_RATE } from "./market-data"

/**
 * Option delta from Black-Scholes N(d1).
 *
 * Replaces a linear approximation `0.5 + moneyness / (2·IV·√t)` that had no
 * drift term and clipped at ±1 (AUDIT_BACKLOG P1-8).
 *
 * @param iv implied volatility as a DECIMAL (0.28 = 28%)
 */
export function optionDelta(
  stockPrice: number,
  strikePrice: number,
  daysToExpiry: number,
  iv: number,
  isCall: boolean,
): number | null {
  return bsDelta(
    {
      stockPrice,
      strikePrice,
      timeToExpiry: daysToExpiry / 365,
      volatility: iv,
      riskFreeRate: RISK_FREE_RATE,
    },
    isCall,
  )
}

/**
 * Vertical credit spread priced from Black-Scholes off measured IV.
 *
 * The previous implementation invented the credit as
 * `width × (IV/100) × √(dte/365) × (1 − 2·otm%) × 0.3` — the 0.3 and the linear
 * OTM haircut had no basis — and derived "probability" from the linear delta,
 * then clamped it into 50–95 so a computed sub-50% probability displayed as 50%
 * (AUDIT_BACKLOG P1-7).
 *
 * Now: price both legs, credit = short leg − long leg, and probability of profit
 * = the risk-neutral probability the short strike expires out of the money.
 * Returns null if any leg cannot be priced.
 *
 * Note this is a *theoretical* mid price, not a live quote — it will differ from
 * a fillable bid/ask by the spread. Callers must label it accordingly.
 */
export function priceCreditSpread(
  stockPrice: number,
  shortStrike: number,
  longStrike: number,
  dte: number,
  iv: number,
  isPut: boolean,
): { credit: number; maxLoss: number; probability: number } | null {
  const timeToExpiry = dte / 365
  const common = { stockPrice, timeToExpiry, volatility: iv, riskFreeRate: RISK_FREE_RATE }

  const shortLeg = calculateOptionPrice({ ...common, strikePrice: shortStrike }, !isPut)
  const longLeg = calculateOptionPrice({ ...common, strikePrice: longStrike }, !isPut)
  const pop = probabilityOTM({ ...common, strikePrice: shortStrike }, !isPut)
  if (shortLeg === null || longLeg === null || pop === null) return null

  const credit = shortLeg - longLeg
  // A non-positive credit means the structure is not a credit spread at these
  // strikes — drop it rather than flooring it to a token $0.10 as before.
  if (!(credit > 0)) return null

  const width = Math.abs(shortStrike - longStrike)
  return {
    credit: Math.round(credit * 100) / 100,
    maxLoss: Math.round((width - credit) * 100) / 100,
    probability: Math.round(pop * 100),
  }
}

/**
 * Field-level provenance stamped onto every setup priced by this route.
 *
 * Replaces the old single `isLive` boolean, which was sourced from "did the
 * stock-price fetch return 200" and rendered as a green "Live Data" badge over
 * tables whose other columns were fabricated (AUDIT_BACKLOG P1-10).
 *
 * `priceSource` and `ivSource` are measured; `pricingModel` is derived. Rows
 * only exist at all when both measured inputs were obtained, so these are
 * constants rather than per-row flags — but they are explicit in the payload so
 * the UI states what the numbers are rather than implying a live quote.
 */
export const PRICING_PROVENANCE = {
  priceSource: "polygon:prev-close",
  ivSource: "polygon:options-snapshot",
  pricingModel: "black-scholes",
  /** True only for values read from a venue. Model output is not a quote. */
  isLive: false,
  quoteType: "theoretical-mid",
} as const

/** Round to 2dp, preserving null so "no value" never becomes 0. */
export function round2(v: number | null): number | null {
  return v === null ? null : Math.round(v * 100) / 100
}

// Helper functions
export function getNextFriday(daysAhead: number): string {
  const date = new Date()
  date.setDate(date.getDate() + daysAhead)
  while (date.getDay() !== 5) {
    date.setDate(date.getDate() + 1)
  }
  return date.toISOString().split("T")[0]
}

export function getExpirationLabel(daysAhead: number): string {
  const date = new Date()
  date.setDate(date.getDate() + daysAhead)
  while (date.getDay() !== 5) {
    date.setDate(date.getDate() + 1)
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
