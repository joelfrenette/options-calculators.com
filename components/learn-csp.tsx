"use client"

import { StrategyLearnPage } from "@/components/strategy-learn-page"

// Cash-Secured Put
// Black-Scholes payoff at expiration for a short put:
//   P&L = premium - max(0, K - S) all multiplied by 100 for one contract.
// We render in per-share dollars (multiplying by 100 outside the diagram
// would inflate axes); the example uses concrete numbers per contract.

export function LearnCSP() {
  const strike = 50
  const premium = 2 // $2/share = $200 per contract
  // Per-contract dollars: (premium * 100) - max(0, K - S) * 100
  const payoff = (price: number) =>
    Math.round(premium * 100 - Math.max(0, strike - price) * 100)

  return (
    <StrategyLearnPage
      title="Cash-Secured Put"
      shortName="CSP"
      oneLiner="Get paid to wait for a stock you want to buy at a lower price."
      bias="neutral-to-bullish"
      complexity="Beginner"
      prerequisites={["Foundation for The Wheel strategy"]}
      whatItIs="A Cash-Secured Put is a promise: you agree to buy 100 shares of a stock at a chosen price (the 'strike') if the stock falls to or below that price by a chosen date. In return for that promise, the buyer of the put pays you cash up front, called the premium. 'Cash-secured' means you set aside enough cash to actually buy the shares if assigned — so this is not borrowed money."
      steps={[
        "Pick a stock you would be happy to OWN. This matters: if the stock drops to your strike, you will own it.",
        "Pick a strike price you'd be happy to BUY at. Usually below the current price.",
        "Set aside (strike × 100) dollars in cash for that one contract. Example: $50 strike means $5,000 cash held aside.",
        "Sell one put contract at that strike for a date 1-6 weeks out. The buyer pays you the premium immediately.",
        "If the stock stays ABOVE your strike at expiration, the put expires worthless — you keep the cash and the premium. You can repeat.",
        "If the stock is BELOW your strike at expiration, you're 'assigned' — you must buy 100 shares at the strike (cash you'd already set aside). Your effective cost basis is strike minus the premium you collected.",
      ]}
      payoff={{
        payoff,
        minPrice: 30,
        maxPrice: 70,
        breakevens: [strike - premium],
        strikes: [{ price: strike, label: "Strike" }],
        currentPrice: 55,
        maxProfit: premium * 100,
        maxLoss: (strike - premium) * 100, // stock goes to $0
      }}
      formulas={[
        { label: "Max profit", value: "premium × 100  (if stock stays above strike)", tone: "good" },
        { label: "Max loss", value: "(strike − premium) × 100  (if stock goes to $0)", tone: "bad" },
        { label: "Breakeven", value: "strike − premium", tone: "neutral" },
      ]}
      whenToUse={[
        "You'd be happy to OWN the stock at the strike price (this is the most important rule).",
        "The stock is liquid and has weekly or monthly options.",
        "Implied volatility (IV) is moderate-to-high, so premium is meaningful relative to capital.",
        "You have the cash to back the trade — no margin needed.",
      ]}
      risks={[
        "If the stock falls hard, you'll be assigned shares at a price higher than the market — paper loss until the stock recovers.",
        "Opportunity cost: the cash sits as collateral and can't be used for anything else.",
        "You collect a fixed premium but take all the downside if the stock crashes — limited upside, large downside.",
        "Earnings releases can move the stock past your strike before you can react.",
      ]}
      example={{
        setup:
          "AAPL is trading at $55. You'd be happy to own it at $50. There's a $50 strike put expiring in 30 days, paying $2.00/share in premium.",
        walkthrough: [
          "Set aside $5,000 in cash (50 × 100 shares).",
          "Sell one $50 put for $2 → broker credits you $200 immediately.",
          "If AAPL is above $50 at expiration: the put expires worthless. You keep $200. Annualized return ≈ ($200 / $5,000) × (365 / 30) ≈ 48.7%.",
          "If AAPL is at $47 at expiration: you're assigned. You buy 100 shares at $50 ($5,000), but you keep the $200 premium. Effective cost basis = $48/share. The shares are worth $4,700, so you have an unrealized loss of $300 ($4,700 − $5,000 + $200).",
        ],
        outcome:
          "Best case you collect $200 and walk away. Worst case you own a stock you wanted anyway, at $48 net — and can start selling Covered Calls against it (that's how The Wheel begins).",
      }}
      relatedTools={[
        {
          label: "Sell Put Scanner",
          description: "Find live CSP opportunities filtered by capital, market cap, fundamentals — uses Polygon options data.",
        },
        {
          label: "Greeks Calculator",
          description: "Compute Delta, Theta and breakeven for a specific put before you sell.",
        },
        {
          label: "ROI Calculator",
          description: "Annualize the premium return to compare across different strikes and durations.",
        },
        {
          label: "The Wheel",
          description: "Once you understand CSPs, learn how they combine with Covered Calls into the full Wheel.",
        },
      ]}
    />
  )
}
