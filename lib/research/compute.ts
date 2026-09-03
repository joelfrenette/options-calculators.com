// Research Queue — the COMPUTE step (RESEARCH_QUEUE_DESIGN.md).
//
// Every numeric field of an OptionsRecommendation is produced here, from this
// app's audited primitives: Polygon price + ATM IV, lib/black-scholes.ts for
// deltas / option price / probability. The LLM never sees a number it did not
// get from this file. A value that cannot be measured is null, never guessed.

import { meteredFetch } from "@/lib/metered-fetch"
import { resolveApiKey } from "@/lib/api-keys"
import { getStockPrice, getIVData } from "@/lib/strategy-scanner/market-data"
import { calculatePutDelta, calculateCallDelta, calculateOptionPrice } from "@/lib/black-scholes"
import { sma } from "@/lib/indicators"
import type { WheelProfile } from "./types"

const RISK_FREE = 0.045

export interface ComputedNumbers {
  price: number | null
  asOf: string | null
  atmIvPct: number | null
  realizedVolPct: number | null
  return12mPct: number | null
  sma200: number | null
  ivRank: number | null
  ivRankIsEstimate: boolean
  ivRankNote: string | null

  cspStrikeLow: number | null
  cspStrikeHigh: number | null
  cspDte: number | null
  cspCredit: number | null
  cspProbabilityOfProfit: number | null
  cspBreakeven: number | null
  cspAnnualizedReturnPct: number | null
  cspCapitalRequired: number | null

  leapsStrike: number | null
  leapsDte: number | null
  leapsBuyBelowPrice: number | null

  ccStrike: number | null
  ccCredit: number | null
}

/** Round a strike to a sensible increment for the price level. */
function strikeStep(price: number): number {
  if (price >= 200) return 5
  if (price >= 50) return 2.5
  if (price >= 20) return 1
  return 0.5
}

/**
 * Find the strike whose option delta is closest to `targetDelta` (a positive
 * magnitude), by scanning candidate strikes around the money. Returns the strike
 * and the delta actually achieved, or null if nothing usable.
 */
function strikeForDelta(
  price: number,
  ivDecimal: number,
  dte: number,
  targetDelta: number,
  isCall: boolean,
): { strike: number; delta: number } | null {
  const step = strikeStep(price)
  const t = dte / 365
  let best: { strike: number; delta: number } | null = null
  // Puts sit below the money, calls above — scan a wide band either way.
  for (let k = price * 0.4; k <= price * 1.3; k += step) {
    const strike = Math.round(k / step) * step
    const params = { stockPrice: price, strikePrice: strike, timeToExpiry: t, volatility: ivDecimal, riskFreeRate: RISK_FREE }
    const d = isCall ? calculateCallDelta(params) : calculatePutDelta(params)
    if (d === null) continue
    const mag = Math.abs(d)
    if (best === null || Math.abs(mag - targetDelta) < Math.abs(best.delta - targetDelta)) {
      best = { strike, delta: mag }
    }
  }
  return best
}

/** Trailing daily closes from Polygon, for realized vol + trend levels. */
async function dailyCloses(ticker: string): Promise<number[] | null> {
  const key = resolveApiKey("POLYGON_API_KEY")
  if (!key) return null
  try {
    const to = new Date()
    const from = new Date(to.getTime() - 400 * 86400_000)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const res = await meteredFetch(
      "polygon",
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${iso(from)}/${iso(to)}?adjusted=true&sort=asc&limit=400&apiKey=${key}`,
      { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000), routeTag: "research-queue" },
    )
    if (!res.ok) return null
    const data = await res.json()
    const bars: unknown[] = Array.isArray(data.results) ? data.results : []
    const closes = bars
      .map((b) => (b as { c?: number })?.c)
      .filter((c): c is number => typeof c === "number" && c > 0)
    return closes.length >= 30 ? closes : null
  } catch {
    return null
  }
}

/** Annualised realized volatility (decimal) from daily log returns. */
function realizedVol(closes: number[]): number | null {
  const window = closes.slice(-63) // ~one quarter
  if (window.length < 20) return null
  const rets: number[] = []
  for (let i = 1; i < window.length; i++) rets.push(Math.log(window[i] / window[i - 1]))
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1)
  const daily = Math.sqrt(variance)
  return Number.isFinite(daily) ? daily * Math.sqrt(252) : null
}

/**
 * IV-rank ESTIMATE from IV-vs-realized-vol, until a true IV history exists
 * (the daily-ATM-IV cron, Phase 3 of the design). Elevated IV over realized vol
 * favours selling premium; this maps the ratio to a 0–100 estimate and SAYS it
 * is an estimate. Never presented as a measured rank.
 */
function ivRankEstimate(atmIv: number, rv: number | null): number | null {
  if (!rv || rv <= 0) return null
  const ratio = atmIv / rv
  // ratio 0.7 → ~15, 1.0 → ~40, 1.3 → ~70, 1.6+ → ~90. Linear, clamped.
  const est = 40 + (ratio - 1) * 100
  return Math.max(0, Math.min(100, Math.round(est)))
}

export async function computeNumbers(
  ticker: string,
  profile: WheelProfile,
  sharesHeld: number,
): Promise<ComputedNumbers> {
  const empty: ComputedNumbers = {
    price: null, asOf: null, atmIvPct: null, realizedVolPct: null, return12mPct: null, sma200: null,
    ivRank: null, ivRankIsEstimate: true, ivRankNote: null,
    cspStrikeLow: null, cspStrikeHigh: null, cspDte: null, cspCredit: null,
    cspProbabilityOfProfit: null, cspBreakeven: null, cspAnnualizedReturnPct: null, cspCapitalRequired: null,
    leapsStrike: null, leapsDte: null, leapsBuyBelowPrice: null, ccStrike: null, ccCredit: null,
  }

  const [priceRes, closes] = await Promise.all([getStockPrice(ticker), dailyCloses(ticker)])
  const price = priceRes?.price ?? (closes ? closes[closes.length - 1] : null)
  if (!price || price <= 0) return empty

  const iv = await getIVData(ticker, price)
  const rv = closes ? realizedVol(closes) : null
  const sma200 = closes ? sma(closes, 200) : null
  const return12m =
    closes && closes.length >= 252 ? ((price - closes[closes.length - 252]) / closes[closes.length - 252]) * 100 : null

  const out: ComputedNumbers = {
    ...empty,
    price,
    asOf: priceRes?.asOf ?? null,
    atmIvPct: iv ? Math.round(iv.atmIV * 1000) / 10 : null,
    realizedVolPct: rv !== null ? Math.round(rv * 1000) / 10 : null,
    return12mPct: return12m !== null ? Math.round(return12m * 10) / 10 : null,
    sma200: sma200 !== null ? Math.round(sma200 * 100) / 100 : null,
  }

  if (!iv) {
    // No IV = no honest option pricing. Price/trend still returned for the rating.
    out.ivRankNote = "no ATM IV available from the options chain"
    return out
  }

  out.ivRank = ivRankEstimate(iv.atmIV, rv)
  out.ivRankIsEstimate = true
  out.ivRankNote = "estimate from IV-vs-realized-vol; true IV rank pending an IV history"

  const cspDte = Math.round((profile.preferredDte[0] + profile.preferredDte[1]) / 2)
  // Low strike = deeper-OTM / safer (lower delta magnitude); High = richer premium.
  const lowPut = strikeForDelta(price, iv.atmIV, cspDte, profile.targetCspDelta[0], false)
  const highPut = strikeForDelta(price, iv.atmIV, cspDte, profile.targetCspDelta[1], false)
  if (lowPut && highPut) {
    // Floor the safe end at a support level when we have one, so the band is
    // tied to a technical level rather than delta alone.
    const support = sma200
    out.cspStrikeLow = support && support < lowPut.strike ? Math.min(lowPut.strike, support) : lowPut.strike
    out.cspStrikeHigh = highPut.strike
    out.cspDte = cspDte
    // Price and credit for the RICHER (high-delta) short put — the one actually sold.
    const t = cspDte / 365
    const putPrice = calculateOptionPrice(
      { stockPrice: price, strikePrice: highPut.strike, timeToExpiry: t, volatility: iv.atmIV, riskFreeRate: RISK_FREE },
      false,
    )
    if (putPrice !== null && putPrice > 0) {
      out.cspCredit = Math.round(putPrice * 100) / 100
      out.cspProbabilityOfProfit = Math.round((1 - highPut.delta) * 100)
      out.cspBreakeven = Math.round((highPut.strike - putPrice) * 100) / 100
      out.cspCapitalRequired = Math.round(highPut.strike * 100)
      const premium = putPrice * 100
      const roc = (premium / (highPut.strike * 100)) * (365 / cspDte) * 100
      out.cspAnnualizedReturnPct = Math.round(roc * 10) / 10
    }
  }

  // LEAPS — a deep-ITM call at the profile's target delta, and the pullback
  // price that makes it attractive (a dip toward the 200-DMA, else -8%).
  const leapsDelta = (profile.leapsTargetDelta[0] + profile.leapsTargetDelta[1]) / 2
  const leaps = strikeForDelta(price, iv.atmIV, profile.leapsMinDte, leapsDelta, true)
  if (leaps) {
    out.leapsStrike = leaps.strike
    out.leapsDte = profile.leapsMinDte
    out.leapsBuyBelowPrice = Math.round((sma200 && sma200 < price ? sma200 : price * 0.92) * 100) / 100
  }

  // Covered call — only meaningful if shares are held. A ~0.25Δ OTM call, kept
  // above the cost basis so a called-away exit is still a gain.
  if (sharesHeld > 0) {
    const cc = strikeForDelta(price, iv.atmIV, cspDte, 0.25, true)
    if (cc) {
      out.ccStrike = cc.strike
      const t = cspDte / 365
      const callPrice = calculateOptionPrice(
        { stockPrice: price, strikePrice: cc.strike, timeToExpiry: t, volatility: iv.atmIV, riskFreeRate: RISK_FREE },
        true,
      )
      out.ccCredit = callPrice !== null && callPrice > 0 ? Math.round(callPrice * 100) / 100 : null
    }
  }

  return out
}
