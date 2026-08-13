/**
 * Vertical credit spreads and iron condors.
 *
 * Split out of `app/api/strategy-scanner/route.ts` (P6-13) unchanged.
 *
 * These two share a file because they share a shape — sell a defined-risk
 * structure, price both legs off one measured ATM IV, keep the row only when
 * the modelled probability clears a floor — and because the comment that
 * matters most in this file explains a difference BETWEEN them and the rest:
 * the bull-put leg carries a trend gate the bear-call leg must not have.
 */
import { probabilityBetween } from "@/lib/black-scholes"
import {
  RISK_FREE_RATE,
  getCompanyProfile,
  getIVData,
  getStockPrice,
} from "../market-data"
import { type ExclusionContext, entryExclusionReasons, fetchTrendProfile } from "../entry-exclusions"
import { PRICING_PROVENANCE, getExpirationLabel, optionDelta, priceCreditSpread, round2 } from "../pricing"

export async function generateCreditSpreads(tickers: string[], ctx: ExclusionContext) {
  const setups = []

  for (const ticker of tickers) {
    const quote = await getStockPrice(ticker)
    if (!quote) continue // no verified price → no row (P1-9)
    // Entry exclusions (P7-32) — spike only at loop level; the bull-put branch adds the trend gates below, and the bear-call branch must NOT have them.
    const trend = await fetchTrendProfile(ticker)
    const excluded = entryExclusionReasons(trend, { spike: true, trend: false }, ctx.benchmarkReturn12m, ctx.maxDayMovePercent)
    if (excluded.length > 0) {
      ctx.excluded.push({ ticker, reasons: excluded })
      continue
    }
    const price = quote.price

    const [ivData, profile] = await Promise.all([getIVData(ticker, price), getCompanyProfile(ticker)])
    if (!ivData) continue // no measured IV → nothing here can be priced (P1-1)

    // Bull put spread (below current price)
    const putShortStrike = Math.floor((price * 0.95) / 5) * 5
    const putLongStrike = putShortStrike - 5
    const putSpread = priceCreditSpread(price, putShortStrike, putLongStrike, 30, ivData.atmIV, true)

    // THE TREND GATES APPLY TO THIS LEG AND NOT THE ONE BELOW.
    //
    // A bull put spread is a bullish bet: it pays if the stock holds above the
    // short strike, and the loss case is the stock falling. That is the same
    // exposure a cash-secured put has, so the same year-long exclusions apply.
    // The bear call spread further down profits from exactly the decline these
    // gates reject, so applying them there would remove the candidates that
    // strategy wants — the reason P7-32 refused a single shared flag across all
    // nine generators.
    const bullPutExcluded = entryExclusionReasons(trend, { spike: false, trend: true }, ctx.benchmarkReturn12m, ctx.maxDayMovePercent)
    if (bullPutExcluded.length > 0) {
      ctx.excluded.push({ ticker, reasons: bullPutExcluded.map((r) => `${r} (bull-put leg)`) })
    }

    if (bullPutExcluded.length === 0 && putSpread && putSpread.probability >= 65) {
      setups.push({
        ticker,
        company: profile?.name || ticker,
        type: "bull-put",
        shortStrike: putShortStrike,
        longStrike: putLongStrike,
        expiration: getExpirationLabel(30),
        dte: 30,
        credit: putSpread.credit,
        maxLoss: putSpread.maxLoss,
        probability: putSpread.probability,
        // ivRank removed: a true IV rank needs 52 weeks of IV history this route
        // does not fetch. The old value was (fabricatedIV/60)*100 (P1-1, P1-3).
        ivRank: null,
        atmIV: Math.round(ivData.atmIV * 1000) / 10, // percent, measured
        delta: round2(optionDelta(price, putShortStrike, 30, ivData.atmIV, false)),
        riskReward: `1:${(putSpread.maxLoss / putSpread.credit).toFixed(1)}`,
        signal: putSpread.probability >= 80 ? "strong" : putSpread.probability >= 70 ? "moderate" : "speculative",
        reason: `Short put at $${putShortStrike}, ${(ivData.atmIV * 100).toFixed(0)}% ATM IV`,
        ...PRICING_PROVENANCE,
      })
    }

    // Bear call spread (above current price) — only when IV is elevated enough
    // that selling calls is worth it. Previously gated on the fabricated ivRank;
    // now gated on measured ATM IV.
    if (ivData.atmIV >= 0.3) {
      const callShortStrike = Math.ceil((price * 1.05) / 5) * 5
      const callLongStrike = callShortStrike + 5
      const callSpread = priceCreditSpread(price, callShortStrike, callLongStrike, 30, ivData.atmIV, false)

      if (callSpread && callSpread.probability >= 65) {
        setups.push({
          ticker,
          company: profile?.name || ticker,
          type: "bear-call",
          shortStrike: callShortStrike,
          longStrike: callLongStrike,
          expiration: getExpirationLabel(30),
          dte: 30,
          credit: callSpread.credit,
          maxLoss: callSpread.maxLoss,
          probability: callSpread.probability,
          ivRank: null,
          atmIV: Math.round(ivData.atmIV * 1000) / 10,
          delta: round2(optionDelta(price, callShortStrike, 30, ivData.atmIV, true)),
          riskReward: `1:${(callSpread.maxLoss / callSpread.credit).toFixed(1)}`,
          signal: callSpread.probability >= 80 ? "strong" : callSpread.probability >= 70 ? "moderate" : "speculative",
          reason: `Short call at $${callShortStrike}, ${(ivData.atmIV * 100).toFixed(0)}% ATM IV`,
          ...PRICING_PROVENANCE,
        })
      }
    }
  }

  return setups.sort((a, b) => b.probability - a.probability)
}

export async function generateIronCondors(tickers: string[], ctx: ExclusionContext) {
  const setups = []

  for (const ticker of tickers) {
    const quote = await getStockPrice(ticker)
    if (!quote) continue
    // Entry exclusions (P7-32) — neutral: a fresh 10% move breaks the range premise; a year-long downtrend does not disqualify a range trade.
    const trend = await fetchTrendProfile(ticker)
    const excluded = entryExclusionReasons(trend, { spike: true, trend: false }, ctx.benchmarkReturn12m, ctx.maxDayMovePercent)
    if (excluded.length > 0) {
      ctx.excluded.push({ ticker, reasons: excluded })
      continue
    }
    const price = quote.price

    const [ivData, profile] = await Promise.all([getIVData(ticker, price), getCompanyProfile(ticker)])
    if (!ivData) continue

    // Condors want elevated IV. Gated on measured ATM IV; was the fabricated ivRank.
    if (ivData.atmIV < 0.2) continue

    const putShort = Math.floor((price * 0.93) / 5) * 5
    const putLong = putShort - 5
    const callShort = Math.ceil((price * 1.07) / 5) * 5
    const callLong = callShort + 5

    const putSpread = priceCreditSpread(price, putShort, putLong, 30, ivData.atmIV, true)
    const callSpread = priceCreditSpread(price, callShort, callLong, 30, ivData.atmIV, false)
    if (!putSpread || !callSpread) continue

    const totalCredit = putSpread.credit + callSpread.credit
    const maxLoss = 5 - totalCredit

    // Probability both short strikes expire OTM — i.e. the underlying finishes
    // inside the condor's body. Computed jointly from the terminal distribution.
    // The old code multiplied the two one-sided probabilities as if they were
    // independent events, which double-counts: they are perfectly dependent
    // (one underlying, one terminal price).
    const inRange = probabilityBetween(
      { stockPrice: price, timeToExpiry: 30 / 365, volatility: ivData.atmIV, riskFreeRate: RISK_FREE_RATE },
      putShort,
      callShort,
    )
    if (inRange === null) continue
    const probability = Math.round(inRange * 100)

    if (probability >= 55) {
      setups.push({
        ticker,
        company: profile?.name || ticker,
        putSpread: { short: putShort, long: putLong },
        callSpread: { short: callShort, long: callLong },
        expiration: getExpirationLabel(30),
        dte: 30,
        totalCredit: Math.round(totalCredit * 100) / 100,
        maxLoss: Math.round(maxLoss * 100) / 100,
        probability,
        ivRank: null,
        atmIV: Math.round(ivData.atmIV * 1000) / 10,
        expectedRange: { low: putShort, high: callShort },
        width: 5,
        signal: probability >= 70 ? "strong" : probability >= 60 ? "moderate" : "speculative",
        reason: `Range $${putShort}-$${callShort}, ${(ivData.atmIV * 100).toFixed(0)}% ATM IV`,
        ...PRICING_PROVENANCE,
      })
    }
  }

  return setups.sort((a, b) => b.probability - a.probability)
}
