// ========== BUTTERFLY GENERATOR ==========
//
// Split out of `app/api/strategy-scanner/route.ts` (P6-13) unchanged.
//
// Both structures here were entirely invented before Phase 1: the standard
// butterfly's cost was a flat 35% of the wing with max profit, max loss and both
// breakevens derived from it, and the broken-wing's "credit" was the literal
// -0.5 on every ticker. Both are now priced leg by leg off measured ATM IV.
import { calculateOptionPrice, probabilityBetween } from "@/lib/black-scholes"
import { COMPANY_NAMES, RISK_FREE_RATE, getIVData, getStockPrice } from "../market-data"
import { type ExclusionContext, entryExclusionReasons, fetchTrendProfile } from "../entry-exclusions"
import { PRICING_PROVENANCE, getNextFriday, round2 } from "../pricing"

export const BUTTERFLY_TICKERS = [
  "SPY",
  "QQQ",
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "META",
  "NVDA",
  "AMD",
  "TSLA",
  "JPM",
  "BAC",
  "GS",
  "XOM",
  "CVX",
]

export async function generateButterflies(tickers: string[], ctx: ExclusionContext): Promise<any[]> {
  const butterflies: any[] = []
  const expDate = getNextFriday(35)

  const dte = 35

  for (const ticker of tickers) {
    try {
      const quote = await getStockPrice(ticker)
      if (!quote) continue
      // Entry exclusions (P7-32) — neutral, pinning.
      const trend = await fetchTrendProfile(ticker)
      const excluded = entryExclusionReasons(trend, { spike: true, trend: false }, ctx.benchmarkReturn12m, ctx.maxDayMovePercent)
      if (excluded.length > 0) {
        ctx.excluded.push({ ticker, reasons: excluded })
        continue
      }
      const price = quote.price
      // Previously called as getIVData(ticker) — the price argument was omitted,
      // so the ATM strike came out NaN and this generator ALWAYS took the
      // fabricated fallback path, never the (already broken) live one.
      const ivData = await getIVData(ticker, price)
      if (!ivData) continue

      const middleStrike = Math.round(price / 5) * 5
      const wingWidth = Math.round((price * 0.03) / 5) * 5 || 5

      const leg = {
        stockPrice: price,
        timeToExpiry: dte / 365,
        volatility: ivData.atmIV,
        riskFreeRate: RISK_FREE_RATE,
      }
      const priceAt = (strike: number, isCall: boolean) => calculateOptionPrice({ ...leg, strikePrice: strike }, isCall)
      const range = { stockPrice: price, timeToExpiry: dte / 365, volatility: ivData.atmIV, riskFreeRate: RISK_FREE_RATE }
      const ivPct = Math.round(ivData.atmIV * 1000) / 10

      // ---- Standard long call butterfly: +1 lower, -2 middle, +1 upper.
      // Cost was `wingWidth * 0.35` — an invented 35% of the wing — with maxProfit,
      // maxLoss and both breakevens all derived from that constant, and a
      // riskRewardRatio hardcoded to 0.35/0.65 for every row on every ticker.
      const lowerC = priceAt(middleStrike - wingWidth, true)
      const midC = priceAt(middleStrike, true)
      const upperC = priceAt(middleStrike + wingWidth, true)
      if (lowerC !== null && midC !== null && upperC !== null) {
        const cost = lowerC - 2 * midC + upperC
        if (cost > 0) {
          const maxProfit = wingWidth - cost
          const beLow = middleStrike - wingWidth + cost
          const beHigh = middleStrike + wingWidth - cost
          const pop = probabilityBetween(range, beLow, beHigh)

          butterflies.push({
            ticker,
            company: COMPANY_NAMES[ticker] || ticker,
            type: "call",
            structure: "standard",
            lowerStrike: middleStrike - wingWidth,
            middleStrike,
            upperStrike: middleStrike + wingWidth,
            currentPrice: round2(price),
            expiration: expDate,
            dte,
            cost: round2(cost),
            maxProfit: round2(maxProfit),
            maxLoss: round2(cost),
            breakeven: { low: round2(beLow), high: round2(beHigh) },
            ivRank: null, // needs 52w IV history (P1-1/P1-3)
            ivPercentile: null,
            atmIV: ivPct,
            wingWidth: { lower: wingWidth, upper: wingWidth },
            probabilityOfProfit: pop === null ? null : Math.round(pop * 1000) / 10,
            riskRewardRatio: round2(maxProfit / cost),
            distanceToProfit: round2(((middleStrike - price) / price) * 100),
            signal: null, // was keyed off the fabricated ivRank
            reason: `Profit zone $${beLow.toFixed(2)}–$${beHigh.toFixed(2)} at ${ivPct}% ATM IV. Max profit if pinned at $${middleStrike}.`,
            ...PRICING_PROVENANCE,
          })
        }
      }

      // ---- Broken-wing put butterfly: +1 far lower, -2 middle, +1 near upper.
      // Was a flat -0.5 "credit" on every ticker regardless of price or IV.
      const bwbLowerWidth = wingWidth
      const bwbUpperWidth = wingWidth * 2
      const farP = priceAt(middleStrike - bwbUpperWidth, false)
      const midP = priceAt(middleStrike, false)
      const nearP = priceAt(middleStrike + bwbLowerWidth, false)
      if (farP !== null && midP !== null && nearP !== null) {
        const netDebit = farP - 2 * midP + nearP
        const credit = -netDebit
        const maxProfit = bwbLowerWidth + credit
        const maxLoss = bwbUpperWidth - bwbLowerWidth - credit
        const beLow = middleStrike - bwbUpperWidth + maxLoss
        const beHigh = middleStrike + bwbLowerWidth
        const pop = probabilityBetween(range, beLow, beHigh)

        if (maxProfit > 0 && maxLoss > 0) {
          butterflies.push({
            ticker,
            company: COMPANY_NAMES[ticker] || ticker,
            type: "put",
            structure: "broken-wing",
            lowerStrike: middleStrike - bwbUpperWidth,
            middleStrike,
            upperStrike: middleStrike + bwbLowerWidth,
            currentPrice: round2(price),
            expiration: expDate,
            dte,
            cost: round2(netDebit),
            maxProfit: round2(maxProfit),
            maxLoss: round2(maxLoss),
            breakeven: { low: round2(beLow), high: round2(beHigh) },
            ivRank: null,
            ivPercentile: null,
            atmIV: ivPct,
            wingWidth: { lower: bwbUpperWidth, upper: bwbLowerWidth },
            probabilityOfProfit: pop === null ? null : Math.round(pop * 1000) / 10,
            riskRewardRatio: round2(maxProfit / maxLoss),
            distanceToProfit: round2(((price - middleStrike) / price) * 100),
            signal: null,
            reason: `${credit >= 0 ? `Net credit $${credit.toFixed(2)}` : `Net debit $${netDebit.toFixed(2)}`} at ${ivPct}% ATM IV. Risk shifted below $${middleStrike - bwbUpperWidth}.`,
            ...PRICING_PROVENANCE,
          })
        }
      }
    } catch (err) {
      console.error(`[Butterfly] Error for ${ticker}:`, err)
    }
  }

  return butterflies
}
