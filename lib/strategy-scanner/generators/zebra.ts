// ========== ZEBRA GENERATOR ==========
//
// Split out of `app/api/strategy-scanner/route.ts` (P6-13) unchanged.
//
// Fully trend-gated: two long ITM calls against one short ATM call is roughly
// +100 delta, which is synthetic long stock.
import { calculateDelta as bsDelta, calculateOptionPrice } from "@/lib/black-scholes"
import { COMPANY_NAMES, RISK_FREE_RATE, getIVData, getStockPrice } from "../market-data"
import { type ExclusionContext, entryExclusionReasons, fetchTrendProfile } from "../entry-exclusions"
import { PRICING_PROVENANCE, getNextFriday, round2 } from "../pricing"

export const ZEBRA_TICKERS = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "META",
  "NVDA",
  "TSLA",
  "AMD",
  "CRM",
  "ADBE",
  "JPM",
  "V",
  "MA",
  "UNH",
  "LLY",
  "ABBV",
  "HD",
  "COST",
  "WMT",
]

export async function generateZEBRA(tickers: string[], ctx: ExclusionContext): Promise<any[]> {
  const zebras: any[] = []
  const expDate = getNextFriday(90)

  const dte = 90

  for (const ticker of tickers) {
    try {
      const quote = await getStockPrice(ticker)
      if (!quote) continue
      // Entry exclusions (P7-32) — 2 long ITM calls minus 1 short ATM is roughly +100 delta: synthetic long stock.
      const trend = await fetchTrendProfile(ticker)
      const excluded = entryExclusionReasons(trend, { spike: true, trend: true }, ctx.benchmarkReturn12m, ctx.maxDayMovePercent)
      if (excluded.length > 0) {
        ctx.excluded.push({ ticker, reasons: excluded })
        continue
      }
      const price = quote.price
      const ivData = await getIVData(ticker, price)
      if (!ivData) continue

      // ZEBRA: Buy 2 deep ITM calls, sell 1 ATM call
      const longStrike = Math.round((price * 0.85) / 5) * 5
      const shortStrike = Math.round(price / 5) * 5

      const bs = {
        stockPrice: price,
        timeToExpiry: dte / 365,
        volatility: ivData.atmIV,
        riskFreeRate: RISK_FREE_RATE,
      }
      // Legs were priced as "intrinsic + 2% of spot" and "4% of spot"; the
      // position delta was the hardcoded literal 100 with a comment asserting
      // the arithmetic rather than doing it.
      const longPremium = calculateOptionPrice({ ...bs, strikePrice: longStrike }, true)
      const shortPremium = calculateOptionPrice({ ...bs, strikePrice: shortStrike }, true)
      const longDelta = bsDelta({ ...bs, strikePrice: longStrike }, true)
      const shortDelta = bsDelta({ ...bs, strikePrice: shortStrike }, true)
      if (longPremium === null || shortPremium === null || longDelta === null || shortDelta === null) continue

      const netDebit = longPremium * 2 - shortPremium
      if (!(netDebit > 0)) continue

      // Position delta in share-equivalents: 2 long calls minus 1 short call.
      const positionDelta = (2 * longDelta - shortDelta) * 100
      const longIntrinsic = Math.max(0, price - longStrike)
      const shortIntrinsic = Math.max(0, price - shortStrike)
      const extrinsicPaid = 2 * (longPremium - longIntrinsic) - (shortPremium - shortIntrinsic)

      zebras.push({
        ticker,
        company: COMPANY_NAMES[ticker] || ticker,
        type: "call",
        longStrike,
        shortStrike,
        currentPrice: round2(price),
        expiration: expDate,
        dte,
        netDebit: round2(netDebit),
        maxProfit: "Unlimited",
        maxLoss: round2(netDebit),
        breakeven: round2(longStrike + netDebit / 2),
        delta: Math.round(positionDelta),
        atmIV: Math.round(ivData.atmIV * 1000) / 10,
        extrinsicPaid: round2(extrinsicPaid),
        // stockScore, trend and optionVolume were Math.random(). stockScore's
        // tooltip described it as measuring "revenue growth, earnings, balance
        // sheet strength, analyst ratings" (AUDIT_BACKLOG P1-4). No fundamentals
        // or volume feed is wired here, so all three are withheld.
        stockScore: null,
        optionVolume: null,
        trend: null,
        distanceToBreakeven: round2(((longStrike + netDebit / 2 - price) / price) * 100),
        leverageRatio: round2(price / netDebit),
        signal: null, // was a function of the two random values above
        reason: `${Math.round(positionDelta)} position delta for $${netDebit.toFixed(2)} debit at ${(ivData.atmIV * 100).toFixed(0)}% ATM IV. $${Math.max(0, extrinsicPaid).toFixed(2)} of time value paid.`,
        ...PRICING_PROVENANCE,
      })
    } catch (err) {
      console.error(`[ZEBRA] Error for ${ticker}:`, err)
    }
  }

  return zebras
}
