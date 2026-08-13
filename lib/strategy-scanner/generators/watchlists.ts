/**
 * The two ungated scanners: the high-IV watchlist and the earnings plays.
 *
 * Split out of `app/api/strategy-scanner/route.ts` (P6-13) unchanged, including
 * the fact that neither takes an `ExclusionContext`. That is deliberate and
 * recorded in `../entry-exclusions`: the tabs that read these were deleted in
 * P7-27 as unreachable, and adding a gate to a generator with no reader is the
 * dead-code trap that finding was about. They still answer `type=all`.
 *
 * What both generators mostly do now is WITHHOLD. Every `null` below replaced a
 * number that had no source — an IV rank derived from a fabricated IV, a 70%
 * "historical beat rate" identical on every ticker, a strategy recommendation
 * keyed off both.
 */
import { calculateOptionPrice, expectedMove as bsExpectedMove } from "@/lib/black-scholes"
import {
  RISK_FREE_RATE,
  getCompanyProfile,
  getIVData,
  getStockPrice,
  getUpcomingEarnings,
} from "../market-data"
import { PRICING_PROVENANCE, formatDate, round2 } from "../pricing"

export async function generateHighIVWatchlist(tickers: string[]) {
  const candidates = []

  for (const ticker of tickers) {
    const quote = await getStockPrice(ticker)
    if (!quote) continue
    const price = quote.price

    const [ivData, profile] = await Promise.all([getIVData(ticker, price), getCompanyProfile(ticker)])
    if (!ivData) continue

    candidates.push({
      ticker,
      company: profile?.name || ticker,
      price: Math.round(price * 100) / 100,
      // ivRank / ivPercentile need 52 weeks of IV history this route does not
      // fetch. The old values were (fabricatedIV/60)*100 and ivRank+5 (P1-1).
      // Without them there is no honest "is IV high for THIS stock" verdict,
      // so the recommendation is withheld rather than guessed.
      ivRank: null,
      ivPercentile: null,
      atmIV: Math.round(ivData.atmIV * 1000) / 10,
      ivSampleSize: ivData.sampleSize,
      ivExpiration: ivData.expiration,
      historicalIV: null,
      hvRatio: null,
      catalyst: null,
      daysToEvent: null,
      recommendation: null,
      reason: `ATM IV ${(ivData.atmIV * 100).toFixed(1)}% at ${ivData.expiration} (${ivData.sampleSize} contracts). IV rank requires history not yet collected.`,
      ...PRICING_PROVENANCE,
    })
  }

  // Ranked by absolute measured IV — the only IV fact available. This is not the
  // same as "IV is high relative to its own history"; the UI must not claim it is.
  return candidates.sort((a, b) => b.atmIV - a.atmIV)
}

export async function generateEarningsPlays() {
  const earnings = await getUpcomingEarnings()
  const plays = []

  const majorTickers = [
    "AAPL",
    "MSFT",
    "NVDA",
    "GOOGL",
    "AMZN",
    "META",
    "TSLA",
    "CRM",
    "AVGO",
    "COST",
    "LULU",
    "DOCU",
    "MDB",
    "SNOW",
    "ZM",
    "ADBE",
    "ORCL",
    "INTC",
  ]

  for (const earning of earnings.slice(0, 30)) {
    const ticker = earning.symbol
    if (!majorTickers.includes(ticker)) continue

    const quote = await getStockPrice(ticker)
    if (!quote) continue
    const price = quote.price

    const [ivData, profile] = await Promise.all([getIVData(ticker, price), getCompanyProfile(ticker)])
    if (!ivData) continue

    const earningsDate = earning.date
    const daysToEarnings = Math.ceil((new Date(earningsDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

    if (daysToEarnings < 1 || daysToEarnings > 14) continue

    // One-session expected move: S · IV · √(1/365). The straddle is priced from
    // the model at the ATM strike rather than the previous `expectedMove * 1.1`.
    //
    // P7-13: computed by `expectedMove` in lib/black-scholes.ts rather than
    // inline. Same formula, but the library returns null on non-positive price,
    // IV or time instead of producing a number from them — and `ivData.atmIV`
    // is upstream data, so "0" is a state this loop can actually reach.
    const expectedMove = bsExpectedMove(price, ivData.atmIV, 1 / 365)
    if (expectedMove === null) continue
    const expectedMovePercent = (expectedMove / price) * 100
    const atmStrike = Math.round(price / 5) * 5
    const straddleParams = {
      stockPrice: price,
      strikePrice: atmStrike,
      timeToExpiry: Math.max(daysToEarnings, 1) / 365,
      volatility: ivData.atmIV,
      riskFreeRate: RISK_FREE_RATE,
    }
    const callLeg = calculateOptionPrice(straddleParams, true)
    const putLeg = calculateOptionPrice(straddleParams, false)
    const straddlePrice = callLeg !== null && putLeg !== null ? callLeg + putLeg : null

    // Strategy selection previously keyed off the fabricated ivRank. Without IV
    // history there is no basis to call IV "elevated", so no strategy or
    // conviction is asserted — the measured expected move is shown instead.
    const strategy = null
    const signal = null

    plays.push({
      ticker,
      company: profile?.name || ticker,
      earningsDate: formatDate(earningsDate),
      earningsTime: earning.hour === 1 ? "BMO" : "AMC",
      daysToEarnings,
      price: Math.round(price * 100) / 100,
      expectedMove: Math.round(expectedMove * 100) / 100,
      expectedMovePercent: Math.round(expectedMovePercent * 10) / 10,
      ivRank: null,
      atmIV: Math.round(ivData.atmIV * 1000) / 10,
      // Was a hardcoded 70% "historical beat rate" for every ticker, and an
      // avg post-earnings move of expectedMove × 1.2. Neither had a source (P1-9).
      historicalBeat: null,
      avgPostEarningsMove: null,
      straddlePrice: round2(straddlePrice),
      strategy,
      direction: null,
      signal,
      thesis: `${(ivData.atmIV * 100).toFixed(0)}% ATM IV implies a ±$${expectedMove.toFixed(2)} (${expectedMovePercent.toFixed(1)}%) one-day move.`,
      ...PRICING_PROVENANCE,
    })
  }

  return plays.sort((a, b) => a.daysToEarnings - b.daysToEarnings)
}
