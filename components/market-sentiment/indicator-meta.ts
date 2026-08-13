/**
 * Per-indicator tooltip copy, and the two functions that turn a score into a
 * word and a colour.
 *
 * Split out of `components/market-sentiment.tsx` (P6-13) unchanged.
 *
 * `getIndicatorSentiment` returning "NO DATA" for null rather than a band is
 * the whole point of the pair: a missing component and a genuinely neutral one
 * must not read the same, which is what a 50 would have done.
 */
import { SENTIMENT_ALLOCATION, bandForScore } from "@/lib/allocation"

export const cnnComponentTooltips: Record<string, { title: string; description: string; impact: string; dataSource: string }> =
  {
    marketmomentum: {
      title: "Market Momentum",
      description:
        "Measures whether the S&P 500 is trading above or below its 125-day moving average. When the market stays above this average, it signals positive momentum and investor confidence.",
      impact:
        "If the S&P 500 is far above its 125-day average, this indicator shows high scores (greed). If it's below, it shows low scores (fear). Each 1% above the average adds 5 points to the score.",
      dataSource: "Live S&P 500 price via Yahoo Finance API compared to its 125-day historical average",
    },
    stockpricestrength: {
      title: "Stock Price Strength",
      description:
        "Compares the number of stocks hitting 52-week highs versus 52-week lows on the New York Stock Exchange. This shows whether more stocks are strengthening or weakening.",
      impact:
        "High ratio of new highs to new lows indicates market strength (scores 75-100 = extreme greed). Low ratio or more new lows indicates weakness (scores 0-25 = extreme fear). Equal highs and lows scores 50 (neutral).",
      dataSource: "NYSE advance/decline data approximated from S&P 500 constituent momentum",
    },
    stockpricebreadth: {
      title: "Stock Price Breadth",
      description:
        "Uses the McClellan Volume Summation Index to measure whether trading volume is flowing into advancing stocks or declining stocks across the market.",
      impact:
        "Positive breadth (volume in advancing stocks) scores high 75-100 showing broad participation and greed. Negative breadth (volume in declining stocks) scores low 0-25 showing widespread fear. Zero scores 50 (neutral).",
      dataSource: "Calculated from NYSE advance/decline volume data approximated from major indices",
    },
    putandcalloptions: {
      title: "Put and Call Options",
      description:
        "Compares the volume of put options (bets that stocks will fall) to call options (bets that stocks will rise) over a 5-day period. This reveals what options traders expect.",
      impact:
        "Low put/call ratio (more calls than puts) scores 75-100 indicating traders expect gains (greed). High put/call ratio (more puts) scores 0-25 showing traders expect losses (fear). Ratio of 1.0 scores 50 (neutral).",
      dataSource: "Live put/call ratio calculated from CBOE options data via Yahoo Finance",
    },
    marketvolatility: {
      title: "Market Volatility (VIX)",
      description:
        "Compares the current VIX (market fear gauge) to its 50-day moving average. VIX measures expected volatility in stock prices based on options pricing.",
      impact:
        "VIX far below its 50-day average scores high 75-100 (low volatility = greed). VIX far above its average scores low 0-25 (high volatility = fear). VIX at its average scores 50 (neutral).",
      dataSource: "Live VIX index (^VIX) via Yahoo Finance compared to 50-day historical average",
    },
    safehavendemand: {
      title: "Safe Haven Demand",
      description:
        "Compares 20-day returns of stocks (SPY) versus bonds (TLT). When investors are fearful, they sell stocks and buy safe bonds, causing bonds to outperform.",
      impact:
        "Stocks strongly outperforming bonds scores 75-100 (risk-on = greed). Bonds outperforming stocks scores 0-25 (risk-off = fear). Equal performance scores 50 (neutral).",
      dataSource: "Live 20-day returns for SPY (stocks) and TLT (bonds) via Yahoo Finance",
    },
    junkbonddemand: {
      title: "Junk Bond Demand",
      description:
        "Measures the yield spread between high-yield (junk) bonds and safe Treasury bonds. When investors are greedy, they buy riskier junk bonds, narrowing the spread.",
      impact:
        "Narrow spread (junk bonds in demand) scores 75-100 indicating risk appetite (greed). Wide spread (investors avoiding junk) scores 0-25 showing risk aversion (fear). Normal spread scores 50.",
      dataSource: "Live high-yield corporate bond ETF (HYG) performance via Yahoo Finance",
    },
  }

export const componentTooltips = {
  momentum: cnnComponentTooltips.marketmomentum,
  strength: cnnComponentTooltips.stockpricestrength,
  stockBreadth: cnnComponentTooltips.stockpricebreadth,
  putCall: cnnComponentTooltips.putandcalloptions,
  vix: cnnComponentTooltips.marketvolatility,
  safeHaven: cnnComponentTooltips.safehavendemand,
  junkBond: cnnComponentTooltips.junkbonddemand,
}

// Null has no sentiment. Every comparison here is false against null, so an
// unmeasured component used to come out labelled "NEUTRAL".
/**
 * Label for a single component indicator, on the same 0-100 fear/greed scale.
 *
 * Reads SENTIMENT_ALLOCATION rather than carrying its own thresholds. Its old
 * chain classified 45-54.99 as NEUTRAL but 55-55.99 as GREED, while the
 * headline bands put 55.5 in Neutral — a third disagreeing set of boundaries
 * on one scale. The upper-cased band level is exactly the vocabulary this
 * already used, so `getSentimentColor` keeps working unchanged.
 */
export const getIndicatorSentiment = (score: number | null): string => {
  if (score === null) return "NO DATA"
  const level = bandForScore(SENTIMENT_ALLOCATION.bands, score)?.level
  return level ? level.toUpperCase() : "NO DATA"
}

export const getSentimentColor = (sentiment: string): string => {
  switch (sentiment) {
    case "EXTREME FEAR":
      return "bg-red-500 text-white"
    case "FEAR":
      return "bg-orange-500 text-white"
    case "GREED":
      return "bg-green-500 text-white"
    case "EXTREME GREED":
      return "bg-emerald-600 text-white"
    // Grey, not the neutral-yellow every other unrecognised label got — an
    // unmeasured component must not look like a NEUTRAL reading.
    case "NO DATA":
      return "bg-gray-200 text-gray-600"
    default:
      return "bg-yellow-500 text-gray-900"
  }
}
