"use client"

import { StrategyLearnPage } from "@/components/strategy-learn-page"

// LEAPS — Long-term Equity AnticiPation Securities.
// Per-contract P&L at expiration for a long call (the standard LEAPS use case):
//   max(0, S - K) * 100 - premium * 100

export function LearnLEAPS() {
  const strike = 100
  // 15% of the $120 spot used in the example below. The steps quote a 15-30%
  // range: the comment, the steps and the example previously gave three
  // different figures (18-25%, 20-30%, and an example at 15%), so the tab
  // taught a rule its own worked example broke.
  const premium = 18
  const payoff = (price: number) => Math.round(Math.max(0, price - strike) * 100 - premium * 100)

  return (
    <StrategyLearnPage
      title="LEAPS"
      shortName="Long-Term Options"
      oneLiner="Stock-replacement bets that last a year or more, with much less money down."
      bias="bullish"
      complexity="Intermediate"
      prerequisites={["Understand basic calls and puts before using LEAPS"]}
      whatItIs="LEAPS stands for 'Long-term Equity AnticiPation Securities' — it's just the name for any option contract with more than nine months until expiration. Most strategies use one-month or two-month options; LEAPS go out 1 to 2+ years. Traders use them mainly as a 'stock replacement': buy a deep in-the-money LEAPS call instead of the actual stock to capture most of the upside while putting up far less capital."
      steps={[
        "Choose a stock you're bullish on for 1-2+ years.",
        "Pick a deep in-the-money (ITM) call — strike price usually 15-30% BELOW the current stock price. The example below uses a $100 strike against a $120 stock, the shallow end of that range.",
        "Pick an expiration 1+ years out (12-24 months is typical).",
        "Pay the premium up front. A deep ITM LEAPS typically costs 15-30% of the stock's price per share — much less than buying shares outright.",
        "As the stock rises, the LEAPS call rises roughly dollar-for-dollar (its Delta is close to 1.0).",
        "At expiration, exercise it (buy shares at the strike) or sell it. Most traders sell to close before expiration to avoid assignment.",
      ]}
      payoff={{
        payoff,
        minPrice: 60,
        maxPrice: 180,
        breakevens: [strike + premium],
        strikes: [{ price: strike, label: "Strike" }],
        currentPrice: 120,
        maxProfit: "unlimited",
        maxLoss: premium * 100,
      }}
      formulas={[
        { label: "Max profit", value: "unlimited (rises with stock above strike + premium)", tone: "good" },
        { label: "Max loss", value: "premium × 100  (the entire amount paid)", tone: "bad" },
        { label: "Breakeven", value: "strike + premium", tone: "neutral" },
      ]}
      whenToUse={[
        "You have a strong 1-2 year bullish view on a stock or ETF.",
        "You want stock-like exposure with less cash tied up.",
        "Implied volatility is LOW (LEAPS are expensive when IV is high).",
        // The range has to be derived from the cost band stated in `steps`, not
        // asserted separately: at 15-30% of share price the exposure per dollar
        // is 1/0.30 to 1/0.15, i.e. ~3-7×. This line used to say "3-5×" while
        // the worked example below runs at $1,800 for $12,000 of stock — 6.7×,
        // outside the range the page itself taught.
        "You want leverage without margin — a deep ITM LEAPS controls roughly 3-7× the stock exposure per dollar (the inverse of the 15-30% cost band above), and cannot be margin-called. The example below is at the cheap end of that band, so it runs near 7×.",
      ]}
      risks={[
        "Time decay (theta) is small day-to-day but real — your LEAPS slowly bleeds value if the stock doesn't move.",
        "Volatility crush: if IV drops sharply, the LEAPS loses value even if the stock is flat.",
        "Total loss possible — unlike stock, the LEAPS expires. If the stock drops below the strike at expiration, you lose 100% of the premium.",
        "Less liquid than near-term options — wider bid-ask spreads.",
      ]}
      example={{
        setup:
          "SPY is trading at $120. You're bullish for the next 12-18 months. You consider buying 100 shares ($12,000) — or one deep ITM LEAPS call instead.",
        walkthrough: [
          "Buy one Jan 2027 $100 strike call for $18.00 → costs $1,800 (vs. $12,000 for 100 shares).",
          "If SPY is at $150 at expiration: call is worth ($150 − $100) × 100 = $5,000. Profit = $5,000 − $1,800 = $3,200. That's a 178% return on the LEAPS vs. 25% on the shares — same dollar move, much more leverage.",
          "If SPY is at $115 at expiration: call is worth ($115 − $100) × 100 = $1,500. Loss = $1,500 − $1,800 = −$300. Shares bought at $120 would be worth $11,500 — a $500 loss. Here the LEAPS actually lost LESS in dollars, because you only ever put $1,800 at risk.",
          "If SPY is at $95 at expiration: call expires worthless. Loss = the full $1,800. Shares would still be worth $9,500 (a $2,500 paper loss).",
        ],
        outcome:
          "LEAPS multiply gains AND losses. Use them when conviction is high and you understand you can lose the entire premium. Most professionals roll their LEAPS to a later expiration when they have 6 months or fewer left.",
      }}
      relatedTools={[
        {
          label: "LEAPS Scanner",
          description: "Find deep-ITM LEAPS candidates filtered by Delta, days-to-expiration, and liquidity.",
        },
        {
          label: "Greeks Calculator",
          description: "Compute the Delta and Vega of a specific LEAPS so you understand its sensitivity.",
        },
        {
          label: "PMCC",
          description: "Pair a LEAPS with a short-term covered call → 'Poor Man's Covered Call' for income.",
        },
        {
          label: "ZEBRA",
          description: "An advanced LEAPS variant — Zero Extrinsic Back-Ratio: same Delta as 100 shares, cheaper.",
        },
      ]}
    />
  )
}
