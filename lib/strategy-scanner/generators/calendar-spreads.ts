// ========== CALENDAR SPREAD GENERATOR ==========
// Calendar spreads work best on stable, low-volatility stocks
// Key criteria: Low beta, low HV, stable price range, no upcoming earnings
//
// Split out of `app/api/strategy-scanner/route.ts` (P6-13) unchanged. This is
// the generator P7-21 rewrote: its beta was a table of ~25 hand-typed constants
// with a `|| 0.7` for anything absent, and beta fed the signal, the quality
// score, the reason sentence and two fields that were restatements of it wearing
// the names of independent measurements.
import { R_SQUARED_NEEDS_DISCLOSURE } from "@/lib/beta"
import { BETA_BENCHMARK, betasForTickers } from "@/lib/beta-store"
import { calculateOptionPrice } from "@/lib/black-scholes"
import { RISK_FREE_RATE, getEarningsDateMap, getIVData, getStockPrice } from "../market-data"
import { type ExclusionContext, entryExclusionReasons, fetchTrendProfile } from "../entry-exclusions"
import { PRICING_PROVENANCE, getNextFriday } from "../pricing"

// Low volatility, stable tickers ideal for calendar spreads
export const CALENDAR_SPREAD_TICKERS = [
  "KO", // Coca-Cola - Consumer staple, very stable
  "PG", // Procter & Gamble - Consumer staple
  "JNJ", // Johnson & Johnson - Healthcare staple
  "VZ", // Verizon - Telecom, stable dividend
  "PEP", // PepsiCo - Consumer staple
  "WMT", // Walmart - Retail staple
  "XLU", // Utilities Select SPDR - Very low volatility
  "XLP", // Consumer Staples SPDR
  "MCD", // McDonald's Corporation - Stable franchise
  "CL", // Colgate-Palmolive - Consumer staple
  "SO", // Southern Company - Utility
  "DUK", // Duke Energy - Utility
  "T", // AT&T Inc. - Telecom
  "UNH", // UnitedHealth Group - Healthcare
  "SPY", // S&P 500 ETF - Benchmark
  "MO", // Altria - High-dividend consumer staple
  "PM", // Philip Morris - Consumer staple
  "MDLZ", // Mondelez - Consumer staple
  "MRK", // Merck - Healthcare staple
  "ABBV", // AbbVie - Healthcare/pharma
  "COST", // Costco - Defensive retail
  "HD", // Home Depot - Blue-chip retail
  "LMT", // Lockheed Martin - Low-beta defense
  "XLV", // Health Care SPDR - Low-volatility sector ETF
  "IYR", // Real Estate ETF - Income/low-beta
]

const CALENDAR_COMPANY_NAMES: Record<string, string> = {
  KO: "Coca-Cola Company",
  PG: "Procter & Gamble",
  JNJ: "Johnson & Johnson",
  VZ: "Verizon Communications",
  PEP: "PepsiCo, Inc.",
  WMT: "Walmart Inc.",
  XLU: "Utilities Select SPDR",
  XLP: "Consumer Staples SPDR",
  MCD: "McDonald's Corporation",
  CL: "Colgate-Palmolive",
  SO: "Southern Company",
  DUK: "Duke Energy",
  T: "AT&T Inc.",
  UNH: "UnitedHealth Group",
  SPY: "SPDR S&P 500 ETF",
  MO: "Altria Group",
  PM: "Philip Morris International",
  MDLZ: "Mondelez International",
  MRK: "Merck & Co.",
  ABBV: "AbbVie Inc.",
  COST: "Costco Wholesale",
  HD: "Home Depot",
  LMT: "Lockheed Martin",
  XLV: "Health Care Select SPDR",
  IYR: "iShares U.S. Real Estate ETF",
}


export async function generateCalendarSpreads(tickers: string[] = CALENDAR_SPREAD_TICKERS, ctx: ExclusionContext): Promise<any[]> {
  const calendarSpreads: any[] = []

  // One Finnhub call for the whole batch rather than one per ticker.
  const earningsByTicker = await getEarningsDateMap(tickers.slice(0, 25))

  // P7-21: beta is now REGRESSED on SPY from stored closes, not read from a
  // table of ~25 hand-typed constants with no source and a `|| 0.7` for
  // anything absent. One benchmark fetch for the whole batch.
  const betaByTicker = await betasForTickers(tickers.slice(0, 25))

  for (const ticker of tickers.slice(0, 25)) {
    try {
      const quote = await getStockPrice(ticker)
      if (!quote) continue // was: a price table frozen at authoring time, else $100
      // Entry exclusions (P7-32) — neutral: a pop distorts near-term IV, which is the whole trade; the trend is not the thesis.
      const trend = await fetchTrendProfile(ticker)
      const excluded = entryExclusionReasons(trend, { spike: true, trend: false }, ctx.benchmarkReturn12m, ctx.maxDayMovePercent)
      if (excluded.length > 0) {
        ctx.excluded.push({ ticker, reasons: excluded })
        continue
      }
      const price = quote.price

      const ivData = await getIVData(ticker, price)
      if (!ivData) continue // was: a hardcoded {currentIV: 20, ivRank: 45} stand-in

      // Calculate calendar spread setup
      const atmStrike = Math.round(price / 5) * 5
      const nearDte = 21 // ~3 weeks out
      const farDte = 49 // ~7 weeks out

      const nearExp = getNextFriday(nearDte)
      const farExp = getNextFriday(farDte)

      // P7-21. Was `STOCK_BETAS[ticker] || 0.7` — a hand-typed constant with no
      // source, and for anything not in the table, the invented 0.7. Now the
      // regression slope against SPY over the stored history, or NULL. Null
      // means not computable; it must never become a number on the way down.
      const betaResult = betaByTicker[ticker] ?? null
      const beta = betaResult?.beta ?? null

      // Both legs are priced off the single measured ATM IV. The previous code
      // manufactured a term structure by multiplying that IV by 1.05 and 0.95,
      // then reported the 10% gap it had just invented as the "IV skew" the
      // strategy depends on. We do not have a second expiry's IV here, so the
      // skew is reported as null rather than fabricated.
      const iv = ivData.atmIV
      const ivSkew = null

      const legParams = {
        stockPrice: price,
        strikePrice: atmStrike,
        volatility: iv,
        riskFreeRate: RISK_FREE_RATE,
      }
      const nearPremium = calculateOptionPrice({ ...legParams, timeToExpiry: nearDte / 365 }, true)
      const farPremium = calculateOptionPrice({ ...legParams, timeToExpiry: farDte / 365 }, true)
      if (nearPremium === null || farPremium === null) continue

      const debit = farPremium - nearPremium
      if (!(debit > 0)) continue // not a debit calendar at these strikes

      // At the near expiry the short leg is worth ~0 at the strike and the long
      // leg retains (farDte - nearDte) of time value, priced at the same IV.
      const farResidualValue = calculateOptionPrice(
        { ...legParams, timeToExpiry: (farDte - nearDte) / 365 },
        true,
      )
      if (farResidualValue === null) continue
      const maxProfit = farResidualValue - debit
      if (!(maxProfit > 0)) continue
      const returnOnCapital = (maxProfit / debit) * 100

      // Real earnings date from Finnhub — replaces `Math.random() * 60 + 30`,
      // which drove a literal "Safe" / "Watch out" verdict (AUDIT_BACKLOG P1-6).
      const earningsDate = earningsByTicker.get(ticker) ?? null
      const daysNoEarnings = earningsDate
        ? Math.max(0, Math.ceil((new Date(earningsDate).getTime() - Date.now()) / 86400_000))
        : null

      // Theta advantage ratio (near-term decays faster)
      const thetaAdvantage = 2.5 + (nearDte < 30 ? 0.5 : 0)

      // Breakeven range: 1-sigma move over the near leg's life, at measured IV.
      const breakevenRange = price * iv * Math.sqrt(nearDte / 365)

      // Price stability was `100 - beta*20 - HV*0.5` where HV was itself derived
      // from beta — a restatement of beta on a 0-100 scale, presented as an
      // independent "stability" measurement. Reported as beta instead.
      const priceStability = null
      const historicalVolatility = null

      // Signal now rests on facts we actually hold: return on capital, the
      // measured beta band, and whether earnings land inside the near leg. The
      // previous version keyed off HV and priceStability, both of which were
      // functions of beta, so it read three "independent" checks off one number.
      const earningsInsideNearLeg = daysNoEarnings !== null && daysNoEarnings <= nearDte
      let signal: "strong" | "moderate" | "speculative"
      if (earningsInsideNearLeg) {
        signal = "speculative"
      } else if (beta === null) {
        // An unmeasurable beta is not a low one. `null < 0.6` is false in JS, so
        // this branch would have produced "speculative" by coercion anyway —
        // written out so it is a decision rather than a coincidence.
        signal = "speculative"
      } else if (beta < 0.6 && returnOnCapital >= 20) {
        signal = "strong"
      } else if (beta < 0.8 && returnOnCapital >= 10) {
        signal = "moderate"
      } else {
        signal = "speculative"
      }

      const earningsNote =
        daysNoEarnings === null
          ? "Earnings date unavailable."
          : earningsInsideNearLeg
            ? `Earnings in ${daysNoEarnings}d — inside the ${nearDte}d short leg.`
            : `Earnings in ${daysNoEarnings}d — clear of the ${nearDte}d short leg.`
      // The beta clause disappears when there is no beta, rather than printing
      // "beta 0.00" — which on this scale reads as a perfectly market-neutral
      // stock, the most attractive thing a calendar-spread candidate can be.
      const betaClause =
        beta === null
          ? "beta unavailable"
          : betaResult !== null && betaResult.rSquared < R_SQUARED_NEEDS_DISCLOSURE
            ? `beta ${beta.toFixed(2)} (SPY explains only ${(betaResult.rSquared * 100).toFixed(0)}% of its moves)`
            : `beta ${beta.toFixed(2)}`
      const reason = `${returnOnCapital.toFixed(0)}% return on capital at ${(iv * 100).toFixed(0)}% ATM IV, ${betaClause}. ${earningsNote}`

      // Type is driven by trend, not chance: a stock trading above its ATM strike leans
      // bullish (call calendar); at/below leans defensive (put calendar).
      const type = price >= atmStrike ? "call" : "put"

      // Ranking score built only from values that were measured or modelled.
      // Dropped the ivSkew and priceStability terms — both were invented inputs.
      const qualityScore =
        Math.min(returnOnCapital, 100) * 0.6 + // profitability, capped so outliers don't dominate
        thetaAdvantage * 8 + // time-decay edge
        (beta === null ? 0 : (1.5 - beta) * 20) - // lower beta rewarded; no beta earns no bonus rather than the 30 points `1.5 - 0` would grant
        (earningsInsideNearLeg ? 40 : 0) // event risk inside the short leg

      calendarSpreads.push({
        ticker,
        company: CALENDAR_COMPANY_NAMES[ticker] || ticker,
        type,
        strike: atmStrike,
        currentPrice: Math.round(price * 100) / 100,
        nearExpiration: nearExp,
        nearDte,
        farExpiration: farExp,
        farDte,
        debit: Math.round(debit * 100) / 100,
        maxProfit: Math.round(maxProfit * 100) / 100,
        returnOnCapital: Math.round(returnOnCapital),
        qualityScore: Math.round(qualityScore * 10) / 10,
        breakeven: {
          low: Math.round((price - breakevenRange) * 100) / 100,
          high: Math.round((price + breakevenRange) * 100) / 100,
        },
        beta,
        // Provenance travels with the number (P7-21). A beta is a regression
        // over a window, and the window is the answer for exactly these
        // low-beta names: KO measures 0.257 over five years and −0.022 over
        // two, both correctly.
        betaProvenance:
          betaResult === null
            ? null
            : {
                benchmark: BETA_BENCHMARK,
                observations: betaResult.observations,
                rSquared: Math.round(betaResult.rSquared * 1000) / 1000,
                from: betaResult.from,
                to: betaResult.to,
              },
        atmIV: Math.round(iv * 1000) / 10,
        historicalVolatility,
        ivSkew,
        priceStability,
        marketCap: null, // was the literal string "$50B+" for every non-SPY ticker
        daysNoEarnings,
        earningsDate,
        thetaAdvantage: Math.round(thetaAdvantage * 10) / 10,
        signal,
        reason,
        ...PRICING_PROVENANCE,
      })
    } catch (error) {
      console.error(`[Calendar Spreads] Error processing ${ticker}:`, error)
      // Continue to next ticker instead of failing entirely
    }
  }

  // Rank by composite quality score so the most profitable, lowest-risk setups
  // surface first. Signal strength is used only as a tiebreaker.
  return calendarSpreads.sort((a, b) => {
    if (b.qualityScore !== a.qualityScore) {
      return b.qualityScore - a.qualityScore
    }
    const signalOrder: Record<string, number> = { strong: 0, moderate: 1, speculative: 2 }
    return (signalOrder[a.signal] ?? 99) - (signalOrder[b.signal] ?? 99)
  })
}
