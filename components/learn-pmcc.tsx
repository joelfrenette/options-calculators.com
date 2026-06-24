"use client"

import { StrategyLearnPage } from "@/components/strategy-learn-page"

// Poor Man's Covered Call (PMCC) — a diagonal call spread.
// Long: deep ITM LEAPS call.  Short: near-term OTM call (sold for premium).
// The exact payoff at the short call's expiration depends on the LEAPS's
// remaining time value at that date — that's why PMCC requires more care.
// For the diagram we model the position's INTRINSIC value at the short
// call's expiration: long_intrinsic - long_premium - max(0, S - short_K)*100 + short_premium*100.

export function LearnPMCC() {
  const longStrike = 80 // deep ITM LEAPS
  const longPremium = 25 // paid for the LEAPS
  const shortStrike = 105 // OTM short call
  const shortPremium = 2 // collected for the short call
  // Intrinsic-value approximation at short expiration:
  //   value of long LEAPS approx = max(0, S - longStrike)
  //   minus what you paid for it
  //   minus payout on the short call
  //   plus premium collected on the short call
  const payoff = (price: number) => {
    const longVal = Math.max(0, price - longStrike) * 100
    const longCost = longPremium * 100
    const shortPayout = Math.max(0, price - shortStrike) * 100
    const shortCredit = shortPremium * 100
    return Math.round(longVal - longCost - shortPayout + shortCredit)
  }

  return (
    <StrategyLearnPage
      title="Poor Man's Covered Call"
      shortName="PMCC"
      oneLiner="Run a Covered Call without owning 100 shares — use a LEAPS as your stock substitute."
      bias="neutral-to-bullish"
      complexity="Intermediate"
      prerequisites={[
        "Understand Covered Calls first",
        "Understand LEAPS first",
      ]}
      whatItIs="A Poor Man's Covered Call (PMCC) is a Covered Call where instead of owning 100 actual shares, you own a deep in-the-money LEAPS call as your 'stock substitute'. You sell short-term out-of-the-money calls against that LEAPS for income — just like a normal CC. The 'poor man' part is the capital savings: you might pay $2,500 for the LEAPS instead of $15,000 for 100 shares, and still collect similar weekly/monthly call premium."
      steps={[
        "Pick a stock you're bullish on for 1+ years.",
        "Buy one deep ITM LEAPS call (12+ months out, strike 20-30% below current price). This is your 'stock'.",
        "Sell one short-term OTM call (1-6 weeks out) at a strike ABOVE your LEAPS strike. Collect the premium.",
        "If the stock stays below the short strike at expiration, the short call expires worthless. You keep the premium. Sell another short call. Repeat.",
        "If the stock rises above the short strike, you may need to 'roll' the short call up and out (close current short, sell another at a higher strike or later expiration). The LEAPS gain usually offsets the short call loss.",
        "Manage the LEAPS itself: roll it to a later expiration when it has ~6 months left or whenever its Delta drops below 0.70.",
      ]}
      payoff={{
        payoff,
        minPrice: 60,
        maxPrice: 140,
        breakevens: [longStrike + longPremium - shortPremium],
        strikes: [
          { price: longStrike, label: "LEAPS" },
          { price: shortStrike, label: "Short" },
        ],
        currentPrice: 100,
        maxProfit: (shortStrike - longStrike - longPremium + shortPremium) * 100,
        maxLoss: (longPremium - shortPremium) * 100, // stock to zero, only if LEAPS is held to expiry
      }}
      formulas={[
        {
          label: "Max profit",
          value: "(short strike − LEAPS strike − net debit) × 100",
          tone: "good",
        },
        {
          label: "Max loss",
          value: "net debit × 100  (only realized if stock crashes AND you hold the LEAPS to expiry)",
          tone: "bad",
        },
        { label: "Breakeven", value: "LEAPS strike + net debit", tone: "neutral" },
        { label: "Net debit", value: "long premium − short premium  (what you paid up front)", tone: "neutral" },
      ]}
      whenToUse={[
        "You want Covered Call income but don't want to tie up $10K+ buying 100 shares.",
        "You have a bullish 1-2 year view on the underlying.",
        "Implied volatility on the long-dated LEAPS is reasonable (not spiked).",
        "You're willing to actively manage — PMCC needs more attention than a plain CC.",
      ]}
      risks={[
        "If the stock crashes, you lose value on the LEAPS faster than 100 shares would lose value (no recovery time to wait out).",
        "If the stock rockets above your short strike, profits cap and you may have to roll the short call repeatedly to avoid assignment.",
        "Time decay on the LEAPS is small but it's there — a flat stock for a long time slowly bleeds value.",
        "If the short call gets assigned and your broker exercises your LEAPS to deliver shares, you may lose extrinsic value on the LEAPS. Many traders avoid this by closing the short call before expiration if it's in-the-money.",
        "Wider bid-ask spreads on LEAPS make entry and exit more expensive.",
      ]}
      example={{
        setup:
          "AAPL is trading at $100. Buying 100 shares costs $10,000. A Jan 2027 $80 LEAPS call costs $25/share = $2,500. You can sell a 30-day $105 call for $2.00 of premium.",
        walkthrough: [
          "Buy one $80 LEAPS call (Jan 2027) for $2,500. This is your 'stock'.",
          "Sell one 30-day $105 call for $2.00 → broker credits $200. Total cash out: $2,500 − $200 = $2,300.",
          "If AAPL is below $105 at 30 days: short call expires worthless. Keep $200. Sell another short call. Repeat for ~$200/month → $2,400/yr on $2,300 capital = ~104% gross yield (before adjusting for the LEAPS decay).",
          "If AAPL closes at $110 at 30 days: short call assigned. Your LEAPS is worth roughly ($110 − $80) × 100 = $3,000 intrinsic. Short call payout = ($110 − $105) × 100 = $500. Net: $3,000 − $500 − $2,300 entry + $200 short premium ≈ $400 profit (8.7% on $2,300).",
          "If AAPL crashes to $70 in 30 days: short call expires worthless (+$200). LEAPS is roughly worth $10 of extrinsic value left = $1,000. Loss ≈ $2,300 − $1,000 + $200 = $1,100 paper loss (vs. $3,000 on 100 shares).",
        ],
        outcome:
          "PMCC magnifies BOTH yield-on-capital and losses vs. a plain Covered Call. The right stock makes it shine. The wrong stock will hurt much faster than holding shares.",
      }}
      relatedTools={[
        {
          label: "LEAPS Scanner",
          description: "Find liquid deep-ITM LEAPS to use as the long leg of a PMCC.",
        },
        {
          label: "Diagonals",
          description: "PMCC is one type of diagonal spread — see the full family of long-dated/short-dated combos.",
        },
        {
          label: "Greeks Calculator",
          description: "Verify your LEAPS Delta is high (typically > 0.75) so the position tracks the stock closely.",
        },
        {
          label: "Covered Call",
          description: "Compare PMCC to a regular Covered Call — same idea, very different capital requirements.",
        },
      ]}
    />
  )
}
