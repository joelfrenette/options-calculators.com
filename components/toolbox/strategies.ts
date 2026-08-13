/**
 * The nine LEARN strategies: what each one is, when it applies, and the
 * illustrative setups shown beside it.
 *
 * Split out of `components/options-strategy-toolbox.tsx` (P6-13) unchanged.
 *
 * THESE SETUPS ARE TEACHING EXAMPLES AND ARE LABELLED AS SUCH WHERE THEY
 * RENDER. That is the whole of P6-52: the Scan button used to replace them with
 * three invented trades served at HTTP 200 and stamp a scan time beside them,
 * which made the page less honest on refresh than at rest. The route now
 * answers 501 and these stay put.
 */
import {
  generateButterflyPayoff,
  generateCalendarPayoff,
  generateCollarPayoff,
  generateCreditSpreadPayoff,
  generateDiagonalPayoff,
  generateIronCondorPayoff,
  generateStraddlePayoff,
  generateWheelPayoff,
} from "./payoffs"

export const STRATEGIES = {
  "credit-spreads": {
    name: "Credit Spreads",
    tagline: "Collect Premium with Defined Risk",
    badge: "Income Strategy",
    badgeColor: "bg-green-100 text-green-800",
    stats: {
      maxProfit: "Credit Received",
      maxLoss: "Spread Width – Credit",
      probability: "65–80%",
      bestMarket: "Directional bias, moderate IV",
      idealIV: ">40",
      typicalDTE: "30–45 days",
      breakeven: "Strike ± Credit",
    },
    payoff: generateCreditSpreadPayoff(),
    setups: [
      {
        ticker: "SPY",
        setup: "545/540 Put Credit Spread",
        credit: "$2.15",
        pop: "72%",
        direction: "Bullish",
        signal: "Strong",
      },
      {
        ticker: "QQQ",
        setup: "470/465 Put Credit Spread",
        credit: "$1.85",
        pop: "68%",
        direction: "Bullish",
        signal: "Moderate",
      },
      {
        ticker: "IWM",
        setup: "220/225 Call Credit Spread",
        credit: "$1.95",
        pop: "70%",
        direction: "Bearish",
        signal: "Weak",
      },
    ],
    insights: {
      outlook:
        "A credit spread is two options at once: you SELL one option (collect cash) and BUY another at a worse strike (a safety net). The cash you collect is your max profit. The gap between the two strikes minus your credit is your max loss. It's a defined-risk way to make money when you think a stock will stay above (bull put spread) or below (bear call spread) a level — without needing it to actually MOVE there. You don't even need direction; you just need it NOT to go against you too hard.",
      entryRules: [
        "Only enter when IV Rank is above 40 (options expensive = good premiums to sell)",
        "Pick the short strike with about a 30% chance of finishing in-the-money (Delta ~ 0.30)",
        "Collect at least 1/3 of the strike width as credit (so $5-wide spread → $1.65+ credit)",
        "Avoid earnings week unless you specifically want the volatility crush",
        "Check the calendar — Fed meetings and CPI releases inside your window add risk",
      ],
      adjustments: [
        "Close the spread once you've captured 50% of the max profit — don't get greedy",
        "If the stock moves against you, you can 'roll' the spread out in time for more credit",
        "If the spread is worth 2x what you collected, take the loss and walk away",
        "If you're wrong on direction, you can add the OPPOSITE spread to turn it into an Iron Condor",
      ],
    },
  },
  "iron-condors": {
    name: "Iron Condors",
    tagline: "The King of High-Probability Income Trades",
    badge: "Income Strategy",
    badgeColor: "bg-green-100 text-green-800",
    stats: {
      maxProfit: "Net Credit Received",
      maxLoss: "Wing Width – Credit",
      probability: "70–85%",
      bestMarket: "Range-bound, high IV",
      idealIV: ">50",
      typicalDTE: "30–60 days",
      breakeven: "±8–12% from current price",
    },
    payoff: generateIronCondorPayoff(),
    setups: [
      {
        ticker: "SPY",
        setup: "550/545 – 580/585",
        credit: "$3.20",
        pop: "78%",
        direction: "Neutral",
        signal: "Strong",
      },
      {
        ticker: "QQQ",
        setup: "460/455 – 490/495",
        credit: "$2.85",
        pop: "75%",
        direction: "Neutral",
        signal: "Moderate",
      },
      { ticker: "IWM", setup: "210/205 – 230/235", credit: "$2.40", pop: "76%", direction: "Neutral", signal: "Weak" },
    ],
    insights: {
      outlook:
        "An Iron Condor is two credit spreads stacked: a bull put spread BELOW the stock and a bear call spread ABOVE it. You collect premium from BOTH and profit if the stock just stays inside the range. It's the classic 'I don't care which way it goes, I just don't want it to move much' trade. Best in choppy, range-bound markets with high implied volatility (so the premium is rich).",
      entryRules: [
        "Only enter when IV Rank is above 50 (rich premium pays for both spreads)",
        "Place the short strikes at about 16 Delta — that's roughly 1 standard deviation out, ~84% probability of expiring worthless",
        "Use $5-wide wings for SPY / QQQ; $2.50 for smaller-priced ETFs",
        "Collect at least 1/3 of the wing width as credit (so $5 wing → $1.65+ total)",
        "Check for earnings or Fed events INSIDE your expiration window — a big surprise breaks the range",
      ],
      adjustments: [
        "Close the entire condor at 50% of max profit — sitting in a winning trade past 50% is bad risk/reward",
        "If one side is being tested by price, ROLL the untested side closer to the stock for extra credit",
        "If a side is breached (stock blew through it), close that side; let the other side decay",
        "If still in your expected range near expiration but profit isn't there yet, roll the whole condor 30 days out",
      ],
    },
  },
  "calendar-spreads": {
    name: "Calendar Spreads",
    tagline: "Profit from Time Decay Differential",
    badge: "Time Decay Play",
    badgeColor: "bg-blue-100 text-blue-800",
    stats: {
      maxProfit: "Varies (at short strike at expiration)",
      maxLoss: "Net Debit Paid",
      probability: "50–65%",
      bestMarket: "Low IV, expecting IV rise",
      idealIV: "<30 (buying low IV)",
      typicalDTE: "Front: 30 days, Back: 60+ days",
      breakeven: "Near short strike price",
    },
    payoff: generateCalendarPayoff(),
    setups: [
      {
        ticker: "AAPL",
        setup: "190 Call Calendar (Dec/Jan)",
        credit: "$3.50 debit",
        pop: "55%",
        direction: "Neutral",
        signal: "Strong",
      },
      {
        ticker: "MSFT",
        setup: "420 Put Calendar (Dec/Jan)",
        credit: "$4.20 debit",
        pop: "52%",
        direction: "Neutral",
        signal: "Moderate",
      },
      {
        ticker: "NVDA",
        setup: "480 Call Calendar (Dec/Jan)",
        credit: "$8.50 debit",
        pop: "50%",
        direction: "Neutral",
        signal: "Weak",
      },
    ],
    insights: {
      outlook:
        "A Calendar Spread is two options at the same strike but DIFFERENT expirations: you sell a short-term one and buy a longer-term one. You profit when the short option decays faster than the long one (time-decay edge). Best when the stock stays near the strike AND volatility rises later. Think of it as 'I want time to be on my side, and I expect volatility to come back to life.'",
      entryRules: [
        "Enter when IV Rank is below 30 — you're buying cheap volatility",
        "Pick strikes near the current stock price (At-The-Money)",
        "Short the near-term option (20-30 days to expiration); buy the far-term option (50-60 DTE)",
        "Make sure there are NO earnings between the two expiration dates",
        "Look for stocks that have been quiet — flat trading ranges",
      ],
      adjustments: [
        "Close once you've made 25-50% of the debit you paid",
        "If the stock moves sharply away from your strike, close — the calendar dies when price runs",
        "If a direction becomes clear, convert to a diagonal (different strikes on the two legs)",
        "After the short expires, if the stock is still at your target, sell a new short to roll the trade forward",
      ],
    },
  },
  butterflies: {
    name: "Butterfly Spreads",
    tagline: "Precise Strike, Maximum Reward-to-Risk",
    badge: "Precision Strategy",
    badgeColor: "bg-purple-100 text-purple-800",
    stats: {
      maxProfit: "Wing Width – Debit (at middle strike)",
      maxLoss: "Net Debit Paid",
      probability: "30–50%",
      bestMarket: "Expecting pin to specific price",
      idealIV: ">40 (selling middle)",
      typicalDTE: "14–30 days",
      breakeven: "Middle Strike ± Debit",
    },
    payoff: generateButterflyPayoff(),
    setups: [
      {
        ticker: "SPY",
        setup: "565/570/575 Call Butterfly",
        credit: "$1.20 debit",
        pop: "35%",
        direction: "Bullish Target",
        signal: "Strong",
      },
      {
        ticker: "TSLA",
        setup: "240/250/260 Put Butterfly",
        credit: "$2.50 debit",
        pop: "32%",
        direction: "Bearish Target",
        signal: "Moderate",
      },
      {
        ticker: "AMD",
        setup: "135/140/145 Call Butterfly",
        credit: "$1.80 debit",
        pop: "38%",
        direction: "Bullish Target",
        signal: "Weak",
      },
    ],
    insights: {
      outlook:
        "A Butterfly is three strikes: buy 1 wing-low + sell 2 middle + buy 1 wing-high. Tiny cost to enter, huge payout if the stock pins right at the middle strike at expiration, and nothing lost beyond the entry cost if it doesn't. It's a 'sniper trade' — you need a real opinion on WHERE the stock will be on a specific date. When you're right, payoffs of 3-5x what you risked are common; when you're wrong, you just lose the small debit.",
      entryRules: [
        "Have a concrete price target — the middle strike is where you think the stock will pin at expiration",
        "Enter 2-3 weeks before expiration (the magic of butterflies only works close to expiry)",
        "Risk only 1-2% of your portfolio on any single butterfly — they fail often, win big",
        "Wider wings = higher probability but smaller payoff; narrower wings = lottery ticket",
        "Try a 'broken-wing' butterfly (one wing wider than the other) to add a directional lean",
      ],
      adjustments: [
        "Close at 50% of max profit — butterflies that go all the way to expiration are rare",
        "If your price target changes, exit the trade and put on a new butterfly at the new target",
        "Add a second butterfly at a different middle strike to cover a range instead of a single point",
        "If the stock blows past either wing, close — the butterfly can't recover",
      ],
    },
  },
  collars: {
    name: "Collars",
    tagline: "Insurance for Your Stock Positions",
    badge: "Hedged Strategy",
    badgeColor: "bg-yellow-100 text-yellow-800",
    stats: {
      maxProfit: "Call Strike – Stock Price – Net Premium Paid",
      maxLoss: "Stock Price – Put Strike + Net Premium Paid",
      probability: "High protection, capped upside",
      bestMarket: "Uncertain, want protection",
      idealIV: "Any (hedging priority)",
      typicalDTE: "30–90 days",
      breakeven: "Stock price ± net premium",
    },
    payoff: generateCollarPayoff(),
    setups: [
      {
        ticker: "AAPL",
        setup: "Buy 185 Put, Sell 200 Call",
        credit: "$0.50 credit",
        pop: "Protected",
        direction: "Hedge Long",
        signal: "Strong",
      },
      {
        ticker: "NVDA",
        setup: "Buy 460 Put, Sell 520 Call",
        credit: "$2.00 debit",
        pop: "Protected",
        direction: "Hedge Long",
        signal: "Moderate",
      },
      {
        ticker: "MSFT",
        setup: "Buy 400 Put, Sell 440 Call",
        credit: "$0.80 credit",
        pop: "Protected",
        direction: "Hedge Long",
        signal: "Weak",
      },
    ],
    insights: {
      outlook:
        "A Collar wraps a stock you already own with TWO options at once: you buy a protective put (sets a floor — you can't lose below it) and you sell a covered call (sets a ceiling — you cap the upside). The call's premium helps pay for the put, so the protection is cheap or even free. Use it when you want to LOCK IN gains on a winning stock before earnings, a Fed meeting, or any event that could move it sharply.",
      entryRules: [
        "Only collar shares you'd be OK selling if the call gets exercised",
        "Set the put strike at your 'I can't afford to lose more than this' level",
        "Set the call strike at a price you'd happily take profits at",
        "Try to structure so the put cost equals the call premium — zero net cost ('free collar')",
        "Use it before known events (earnings, FOMC) when you want certainty for a couple of weeks",
      ],
      adjustments: [
        "If the stock rallies hard toward the call strike, roll the call UP and OUT to keep capturing upside",
        "If the stock just sits, roll the put down and out for a credit — recoup some hedging cost",
        "If you decide you're now strongly bullish, remove the collar (cost: lose the protection)",
        "If risk goes up (volatility spikes), add MORE collars on additional positions",
      ],
    },
  },
  diagonals: {
    name: "Diagonal Spreads",
    tagline: "Calendar Meets Vertical for Directional Edge",
    badge: "Directional Income",
    badgeColor: "bg-indigo-100 text-indigo-800",
    stats: {
      maxProfit: "Complex (time + directional move)",
      maxLoss: "Net Debit Paid",
      probability: "55–70%",
      bestMarket: "Slow directional move expected",
      idealIV: "Buy low IV back month, sell high IV front",
      typicalDTE: "Front: 30 days, Back: 60-90 days",
      breakeven: "Varies by strikes and time",
    },
    payoff: generateDiagonalPayoff(),
    setups: [
      {
        ticker: "GOOGL",
        setup: "Buy Jan 175C, Sell Dec 180C",
        credit: "$4.20 debit",
        pop: "62%",
        direction: "Bullish",
        signal: "Strong",
      },
      {
        ticker: "META",
        setup: "Buy Jan 560C, Sell Dec 580C",
        credit: "$8.50 debit",
        pop: "58%",
        direction: "Bullish",
        signal: "Moderate",
      },
      {
        ticker: "AMZN",
        setup: "Buy Jan 200P, Sell Dec 195P",
        credit: "$3.80 debit",
        pop: "60%",
        direction: "Bearish",
        signal: "Weak",
      },
    ],
    insights: {
      outlook:
        "A Diagonal Spread is a calendar spread with DIFFERENT strikes — long a far-month option, short a near-month option at a different strike. It combines time decay (from the short) with directional bias (from picking different strikes). The Poor Man's Covered Call (PMCC) is the most popular diagonal: long a deep-ITM LEAPS, short a near-term OTM call repeatedly for income. Great for slow, grinding directional moves.",
      entryRules: [
        "Buy the back-month option deep in-the-money or at-the-money — that's your 'stock substitute'",
        "Sell the front-month option out-of-the-money in the direction you're leaning",
        "Try to collect 30-50% of what you paid for the long leg in the very first short sale",
        "Stick to liquid stocks (tight bid-ask spreads) — diagonals need active management",
        "Avoid having earnings BETWEEN the two expirations — the volatility crush is unpredictable",
      ],
      adjustments: [
        "Once the short option has lost 50% of its value, buy it back and sell a new one further out",
        "If the stock moves a lot, slide the front-month strike up or down to keep collecting premium",
        "Close the whole thing at 50% profit on your original debit",
        "If you expect a big move, simplify to a vertical spread (same expiration)",
      ],
    },
  },
  "straddles-strangles": {
    name: "Straddles & Strangles",
    tagline: "Profit from Big Moves in Either Direction",
    badge: "Volatility Play",
    badgeColor: "bg-red-100 text-red-800",
    stats: {
      maxProfit: "Unlimited (big move either direction)",
      maxLoss: "Total Premium Paid",
      probability: "35–50%",
      bestMarket: "Expecting big move, low IV",
      idealIV: "<30 (buying cheap volatility)",
      typicalDTE: "30–60 days",
      breakeven: "Strike ± Total Premium (straddle)",
    },
    payoff: generateStraddlePayoff(),
    setups: [
      {
        ticker: "TSLA",
        setup: "250 Straddle (Dec)",
        credit: "$18.00 debit",
        pop: "42%",
        direction: "Big Move",
        signal: "Strong",
      },
      {
        ticker: "NVDA",
        setup: "475/485 Strangle (Dec)",
        credit: "$12.50 debit",
        pop: "45%",
        direction: "Big Move",
        signal: "Moderate",
      },
      {
        ticker: "COIN",
        setup: "280 Straddle (Dec)",
        credit: "$22.00 debit",
        pop: "40%",
        direction: "Big Move",
        signal: "Weak",
      },
    ],
    insights: {
      outlook:
        "A Straddle is a long call AND a long put at the SAME strike, both bought together. A Strangle is the same idea but with the call OTM above and the put OTM below — cheaper to enter, needs a bigger move to win. Both profit when the stock moves BIG in either direction. You're buying volatility, so they're best entered when volatility is cheap (low IV Rank) and a catalyst is approaching (earnings, FDA decision, Fed meeting).",
      entryRules: [
        "Only buy when IV Rank is below 30 — options must be cheap or you can't make the math work",
        "You MUST have a real catalyst on the calendar (earnings, FDA, court ruling, Fed)",
        "Use a Straddle for maximum sensitivity to small moves; a Strangle for lower cost",
        "Position size knowing the worst case is 100% loss of the premium you paid",
        "Enter 1-2 weeks BEFORE the catalyst so you also benefit from rising IV (vega)",
      ],
      adjustments: [
        "If one side doubles in value (big move already happened), sell HALF — your free ride covers what's left",
        "If IV jumps a lot before the event, you can close for a profit BEFORE the event hits",
        "If the move is clearly one direction, sell the losing side to recover some cost",
        "Never let a straddle sit through expiration — sell or roll once the catalyst is past",
      ],
    },
  },
  "wheel-strategy": {
    name: "The Wheel Strategy",
    tagline: "Systematic Income from Stocks You Want to Own",
    badge: "Premium Strategy",
    badgeColor: "bg-emerald-100 text-emerald-800",
    stats: {
      maxProfit: "Continuous premium + stock appreciation",
      maxLoss: "Stock goes to zero (like owning stock)",
      probability: "High income, varies on capital gains",
      bestMarket: "Neutral to bullish on quality stocks",
      idealIV: ">30 (better premium)",
      typicalDTE: "30–45 days per cycle",
      breakeven: "Put strike – cumulative premiums",
    },
    payoff: generateWheelPayoff(),
    setups: [
      {
        ticker: "AMD",
        setup: "Sell 130 Put (30 DTE)",
        credit: "$2.80",
        pop: "75%",
        direction: "Wheel Entry",
        signal: "Strong",
      },
      {
        ticker: "SOFI",
        setup: "Sell 14 Put (30 DTE)",
        credit: "$0.45",
        pop: "72%",
        direction: "Wheel Entry",
        signal: "Moderate",
      },
      {
        ticker: "PLTR",
        setup: "Sell 65 Put (30 DTE)",
        credit: "$1.90",
        pop: "70%",
        direction: "Wheel Entry",
        signal: "Weak",
      },
    ],
    insights: {
      outlook:
        "The Wheel is the 'get paid to wait' strategy. Step 1: pick a stock you'd genuinely want to own. Step 2: sell a cash-secured put — somebody pays you cash for the promise to buy that stock at a lower price. Step 3: if the stock stays above your strike, the put expires worthless and you keep the cash — repeat. Step 4: if the stock falls and you get assigned, you own 100 shares at a price you chose. Step 5: now sell covered calls on those shares for more cash, until the stock rallies and the shares get called away. Then start over. Done well, you collect 1-2% per month on the capital — about 12-24% per year, without ever needing the stock to soar.",
      entryRules: [
        "Pick stocks you genuinely want to own — quality companies you'd hold for years",
        "Sell puts at a strike where you'd actually be happy buying — usually a recent support level",
        "Aim for roughly 1-2% premium per month relative to the cash you've set aside",
        "ALWAYS have the full cash sitting aside — strike price × 100 per contract",
        "Start with big, liquid names (e.g. SPY, AAPL, KO) before trying smaller stocks",
      ],
      adjustments: [
        "If the stock drops near your strike before expiration, you can 'roll' the put — buy back the existing one and sell a new one further out and lower, to avoid assignment at a bad price",
        "If you get assigned (now own shares), don't panic — immediately start selling covered calls",
        "Sell covered calls at a strike ABOVE your cost basis so any assignment is profitable",
        "If the stock rallies hard, roll the covered call up and out — capture more upside before shares get called away",
      ],
    },
  },
}

// ===========================================================================
// Payoff diagram generators
//
// Each returns Array<{ x: priceAtExpiration, y: pnlPerContract }> using the
// canonical at-expiration payoff for one contract (×100 share multiplier).
// All math here is textbook — no curves are fabricated.
//
// Reference numbers used: $100 stock so the shape is easy to read; you can
// rescale by changing the strikes inside each function. Strike spacing
// reflects how the strategy is typically constructed.
// ===========================================================================

// `kinks` are the strikes (payoff corners): they are merged into the sample set
// so every kink lands exactly on a sample and the chart spline can't round it off.
