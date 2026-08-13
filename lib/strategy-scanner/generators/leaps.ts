// ========== LEAPS GENERATOR ==========
//
// Split out of `app/api/strategy-scanner/route.ts` (P6-13) unchanged.
//
// Fully trend-gated: a deep-ITM call at ~0.8 delta over thirteen months is stock
// replacement, so buying it is buying the year.
import { calculateDelta as bsDelta, calculateOptionPrice } from "@/lib/black-scholes"
import { COMPANY_NAMES, RISK_FREE_RATE, getIVData, getStockPrice } from "../market-data"
import { type ExclusionContext, entryExclusionReasons, fetchTrendProfile } from "../entry-exclusions"
import { PRICING_PROVENANCE, getNextFriday, round2 } from "../pricing"

export const LEAPS_TICKERS = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "META",
  "JPM",
  "V",
  "MA",
  "JNJ",
  "UNH",
  "PFE",
  "ABBV",
  "PG",
  "KO",
  "PEP",
  "WMT",
  "COST",
  "XOM",
  "CVX",
  "HD",
  "LOW",
]

const fundamentals: Record<
  string,
  { epsGrowth: number; debtEquity: number; priceBook: number; sector: string; rating: string }
> = {
  AAPL: { epsGrowth: 12.5, debtEquity: 1.8, priceBook: 45, sector: "Technology", rating: "Buy" },
  MSFT: { epsGrowth: 15.2, debtEquity: 0.35, priceBook: 12, sector: "Technology", rating: "Strong Buy" },
  GOOGL: { epsGrowth: 18.3, debtEquity: 0.1, priceBook: 6.5, sector: "Technology", rating: "Buy" },
  AMZN: { epsGrowth: 25.1, debtEquity: 0.55, priceBook: 8.2, sector: "Consumer Discretionary", rating: "Strong Buy" },
  META: { epsGrowth: 22.4, debtEquity: 0.15, priceBook: 7.8, sector: "Technology", rating: "Buy" },
  JPM: { epsGrowth: 8.5, debtEquity: 1.2, priceBook: 1.8, sector: "Financials", rating: "Buy" },
  V: { epsGrowth: 14.2, debtEquity: 0.55, priceBook: 14, sector: "Financials", rating: "Strong Buy" },
  JNJ: { epsGrowth: 5.5, debtEquity: 0.35, priceBook: 5.8, sector: "Healthcare", rating: "Hold" },
  UNH: { epsGrowth: 13.8, debtEquity: 0.7, priceBook: 6.2, sector: "Healthcare", rating: "Strong Buy" },
  PG: { epsGrowth: 6.2, debtEquity: 0.65, priceBook: 7.5, sector: "Consumer Staples", rating: "Buy" },
  KO: { epsGrowth: 4.8, debtEquity: 1.7, priceBook: 10.5, sector: "Consumer Staples", rating: "Hold" },
  WMT: { epsGrowth: 7.5, debtEquity: 0.45, priceBook: 5.2, sector: "Consumer Staples", rating: "Buy" },
  XOM: { epsGrowth: 3.2, debtEquity: 0.2, priceBook: 2.1, sector: "Energy", rating: "Hold" },
  HD: { epsGrowth: 9.8, debtEquity: 0.95, priceBook: 18, sector: "Consumer Discretionary", rating: "Buy" },
}

export async function generateLEAPS(tickers: string[], ctx: ExclusionContext): Promise<any[]> {
  const leaps: any[] = []
  const expDate = getNextFriday(400) // ~13 months out

  const dte = 400

  for (const ticker of tickers) {
    try {
      const quote = await getStockPrice(ticker)
      if (!quote) continue
      // Entry exclusions (P7-32) — deep-ITM long calls are stock replacement — you are buying the year.
      const trend = await fetchTrendProfile(ticker)
      const excluded = entryExclusionReasons(trend, { spike: true, trend: true }, ctx.benchmarkReturn12m, ctx.maxDayMovePercent)
      if (excluded.length > 0) {
        ctx.excluded.push({ ticker, reasons: excluded })
        continue
      }
      const price = quote.price
      const ivData = await getIVData(ticker, price)
      if (!ivData) continue

      // `fundamentals` is a hand-maintained table with no refresh date and no
      // source. Only surfaced for tickers actually present in it — the previous
      // default handed every unlisted ticker 8% EPS growth, 0.8 D/E and a "Hold"
      // rating, then printed those invented figures in the reason string.
      const fund = fundamentals[ticker] ?? null

      // Deep ITM call for stock replacement
      const strike = Math.round((price * 0.8) / 5) * 5
      const bs = {
        stockPrice: price,
        strikePrice: strike,
        timeToExpiry: dte / 365,
        volatility: ivData.atmIV,
        riskFreeRate: RISK_FREE_RATE,
      }
      // Premium was intrinsic + a flat 8% of spot; delta was 0.75 + random()*0.15
      // and was also printed into the reason sentence and used as a user filter
      // (AUDIT_BACKLOG P1-5). Both now come from Black-Scholes at measured IV.
      const premium = calculateOptionPrice(bs, true)
      const delta = bsDelta(bs, true)
      if (premium === null || delta === null || !(premium > 0)) continue

      const intrinsic = Math.max(0, price - strike)
      const extrinsic = premium - intrinsic

      leaps.push({
        ticker,
        company: COMPANY_NAMES[ticker] || ticker,
        type: "call",
        strike,
        currentPrice: round2(price),
        expiration: expDate,
        dte,
        premium: round2(premium),
        delta: Math.round(delta * 1000) / 1000,
        atmIV: Math.round(ivData.atmIV * 1000) / 10,
        intrinsicValue: round2(intrinsic),
        extrinsicValue: round2(extrinsic),
        breakeven: round2(strike + premium),
        epsGrowth: fund?.epsGrowth ?? null,
        debtToEquity: fund?.debtEquity ?? null,
        priceToBook: fund?.priceBook ?? null,
        // Was a price-derived string ("$1T+" if price > 300) — share price says
        // nothing about market cap. Withheld until getCompanyProfile is wired in.
        marketCap: null,
        sector: fund?.sector ?? null,
        analystRating: fund?.rating ?? null,
        leverageRatio: round2(price / premium),
        annualizedCost: round2((extrinsic / price) * 100 * (365 / dte)),
        signal: null, // was derived from the unsourced analyst rating
        reason: `${delta.toFixed(2)} delta at ${(ivData.atmIV * 100).toFixed(0)}% ATM IV. $${extrinsic.toFixed(2)} time value = ${((extrinsic / price) * 100 * (365 / dte)).toFixed(1)}% annualized cost of leverage.`,
        ...PRICING_PROVENANCE,
      })
    } catch (err) {
      console.error(`[LEAPS] Error for ${ticker}:`, err)
    }
  }

  return leaps
}
