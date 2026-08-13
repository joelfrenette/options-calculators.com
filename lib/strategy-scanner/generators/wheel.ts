/**
 * Cash-secured put candidates for the wheel.
 *
 * Split out of `app/api/strategy-scanner/route.ts` (P6-13) unchanged.
 *
 * Fully trend-gated, and it is the clearest case for why: assignment on a short
 * put means owning the stock, so a year of decline is the market disagreeing
 * with the position you would end up holding.
 */
import { calculateOptionPrice } from "@/lib/black-scholes"
import { RISK_FREE_RATE, getCompanyProfile, getIVData, getStockPrice } from "../market-data"
import { type ExclusionContext, entryExclusionReasons, fetchTrendProfile } from "../entry-exclusions"
import { PRICING_PROVENANCE, round2 } from "../pricing"

export async function generateWheelCandidates(tickers: string[], ctx: ExclusionContext) {
  const candidates = []

  for (const ticker of tickers) {
    const quote = await getStockPrice(ticker)
    if (!quote) continue
    // Entry exclusions (P7-32) — short put — assignment means ownership.
    const trend = await fetchTrendProfile(ticker)
    const excluded = entryExclusionReasons(trend, { spike: true, trend: true }, ctx.benchmarkReturn12m, ctx.maxDayMovePercent)
    if (excluded.length > 0) {
      ctx.excluded.push({ ticker, reasons: excluded })
      continue
    }
    const price = quote.price

    const [ivData, profile] = await Promise.all([getIVData(ticker, price), getCompanyProfile(ticker)])
    if (!ivData) continue

    const putStrike = Math.floor((price * 0.92) / 5) * 5
    const dte = 30
    // A cash-secured put is a single short leg, not a spread. Price it directly
    // rather than through the spread helper.
    const putPremium = calculateOptionPrice(
      {
        stockPrice: price,
        strikePrice: putStrike,
        timeToExpiry: dte / 365,
        volatility: ivData.atmIV,
        riskFreeRate: RISK_FREE_RATE,
      },
      false,
    )
    if (putPremium === null || !(putPremium > 0)) continue

    const cashRequired = putStrike * 100
    const periodReturn = (putPremium * 100) / cashRequired
    const annualizedReturn = periodReturn * (365 / dte) * 100

    // Market-cap tiers only — this is a SIZE band, not a fundamentals grade. The
    // field was previously called "fundamentals" and rendered as an A+/B grade,
    // implying balance-sheet analysis that never happened.
    // Null cap means unknown size, not the smallest band: `|| 0` fell through
    // every threshold and labelled the ticker "small-cap".
    const marketCap = profile?.marketCap ?? null
    const sizeTier =
      marketCap === null
        ? null
        : marketCap > 100000
          ? "mega-cap"
          : marketCap > 50000
            ? "large-cap"
            : marketCap > 10000
              ? "mid-cap"
              : "small-cap"

    candidates.push({
      ticker,
      company: profile?.name || ticker,
      price: Math.round(price * 100) / 100,
      putStrike,
      putPremium: round2(putPremium),
      putDte: dte,
      annualizedReturn: Math.round(annualizedReturn * 10) / 10,
      ivRank: null,
      atmIV: Math.round(ivData.atmIV * 1000) / 10,
      divYield: null, // never sourced; was hardcoded 0, indistinguishable from a real 0%
      cashRequired,
      // Conviction previously keyed off the market-cap grade plus a fabricated
      // premium. Withheld until real fundamentals are wired (S-15 / Phase 3).
      signal: null,
      sizeTier,
      fundamentals: null,
      reason: `${annualizedReturn.toFixed(1)}% annualized at $${putStrike} on ${(ivData.atmIV * 100).toFixed(0)}% ATM IV (${sizeTier}).`,
      ...PRICING_PROVENANCE,
    })
  }

  return candidates.sort((a, b) => b.annualizedReturn - a.annualizedReturn)
}
