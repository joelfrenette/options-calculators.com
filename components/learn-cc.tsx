"use client"

import { StrategyLearnPage } from "@/components/strategy-learn-page"

// Covered Call
// Position: long 100 shares + short 1 call.
// Per-contract P&L at expiration (vs. the cost basis where you bought shares):
//   (min(S, K) - costBasis + premium) * 100
// For the diagram we treat the entry stock price as the cost basis so the
// shape is clean: the position rises with the stock up to the strike, then
// caps; downside is the stock falling minus the premium cushion.

export function LearnCC() {
  const costBasis = 50
  const strike = 55
  const premium = 1.5
  // Per-contract P&L (dollars), with stock entered at costBasis and one
  // covered call sold at the strike for `premium` per share.
  const payoff = (price: number) => {
    const sharesPnL = (Math.min(price, strike) - costBasis) * 100
    const callPremium = premium * 100
    return Math.round(sharesPnL + callPremium)
  }

  return (
    <StrategyLearnPage
      title="Covered Call"
      shortName="CC"
      oneLiner="Earn rental income on shares you already own."
      bias="neutral-to-bullish"
      complexity="Beginner"
      prerequisites={["You must already own at least 100 shares of the stock"]}
      whatItIs="A Covered Call combines two positions: you own 100 shares of a stock, and you sell one call option against those shares. The buyer pays you a premium up front for the right to BUY your shares from you at a chosen price (the strike) by a chosen date. It's 'covered' because if the buyer exercises, you already own the shares ready to deliver — no scramble. In return, you cap your upside above the strike."
      steps={[
        "Own 100 shares of a stock you don't mind selling at a higher price.",
        "Pick a strike price ABOVE the current price — usually one you'd be happy to sell at.",
        "Pick an expiration date 1-6 weeks out.",
        "Sell one call contract at that strike. The buyer pays you the premium immediately.",
        "If the stock stays BELOW the strike at expiration, the call expires worthless. You keep the shares AND the premium. Repeat next week.",
        "If the stock is ABOVE the strike at expiration, your shares are 'called away' — sold at the strike. You keep the premium AND the gain up to the strike, but you miss any upside beyond it.",
      ]}
      payoff={{
        payoff,
        minPrice: 35,
        maxPrice: 70,
        breakevens: [costBasis - premium],
        strikes: [{ price: strike, label: "Strike" }],
        currentPrice: 50,
        maxProfit: (strike - costBasis + premium) * 100,
        maxLoss: (costBasis - premium) * 100, // stock goes to $0
      }}
      formulas={[
        { label: "Max profit", value: "(strike − cost basis + premium) × 100", tone: "good" },
        { label: "Max loss", value: "(cost basis − premium) × 100  (if stock goes to $0)", tone: "bad" },
        { label: "Breakeven", value: "cost basis − premium", tone: "neutral" },
      ]}
      whenToUse={[
        "You own shares already and want extra income on them.",
        "You think the stock will trade sideways or rise slowly through expiration.",
        "Implied volatility is decent so the premium is worth giving up the upside above the strike.",
        "You'd be content selling the shares at the strike if called away.",
      ]}
      risks={[
        "Capped upside — if the stock rockets past your strike, you miss the rally above it.",
        "You still own the stock; if the stock crashes, the small premium barely cushions the loss.",
        "Early assignment is possible if a juicy dividend is upcoming and the call is in-the-money.",
        "Selling too close to the current price (low strike) gives more premium but lots of called-away risk.",
      ]}
      example={{
        setup:
          "You bought 100 shares of MSFT at $50 a year ago. It's now back at $50 after a flat year. There's a $55 strike call expiring in 30 days, paying $1.50/share in premium.",
        walkthrough: [
          "Sell one $55 call for $1.50 → broker credits you $150 immediately.",
          "If MSFT is below $55 at expiration: call expires worthless. You keep $150 and the shares. Repeat.",
          "If MSFT closes at $55: shares sold at $55. Your gain = $5/share stock + $1.50 premium = $650 per contract.",
          "If MSFT rockets to $70: shares STILL sold at $55. You earned $650 but missed the $15 extra rally — $1,500 in missed upside.",
        ],
        outcome:
          "Best month: shares cooperate and stay below the strike. You collect $150 — that's a 3% monthly yield on $5,000 of shares, or roughly 36% annualized on the strategy. Worst case: the stock crashes; you still own it, but $150 cushions a bit.",
      }}
      relatedTools={[
        {
          label: "Greeks Calculator",
          description: "Calculate Delta and Theta on the call you plan to sell.",
        },
        {
          label: "ROI Calculator",
          description: "Annualize the call premium relative to the share cost.",
        },
        {
          label: "The Wheel",
          description: "Sell CSPs → get assigned → sell Covered Calls. The Wheel page ties it all together.",
        },
        {
          label: "Collars",
          description: "Add a protective put under the covered call to cap downside too.",
        },
      ]}
    />
  )
}
