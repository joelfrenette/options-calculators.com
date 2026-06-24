"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import {
  DollarSign,
  Shield,
  Target,
  TrendingUp,
  Activity,
  Clock,
  Calculator,
  RefreshCw,
  BarChart2,
  Loader2,
  Info,
} from "lucide-react"
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { TradeWalkthroughModal, type WalkthroughSetup } from "@/components/trade-walkthrough-modal"

// Strategy configurations
const STRATEGIES = {
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
      maxProfit: "Call Strike – Stock Price + Put Premium",
      maxLoss: "Stock Price – Put Strike – Net Premium",
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

function sample(minPrice: number, maxPrice: number, steps: number, payoff: (s: number) => number) {
  return Array.from({ length: steps }, (_, i) => {
    const x = minPrice + ((maxPrice - minPrice) * i) / (steps - 1)
    return { x: Math.round(x * 100) / 100, y: Math.round(payoff(x) * 100) / 100 }
  })
}

// Bull put spread (credit): short put K_short, long put K_long (K_long < K_short).
// Net credit = c. P&L per contract:
//   if S >= K_short: +c × 100  (max profit)
//   if S <= K_long:  (K_long - K_short + c) × 100 (max loss, negative)
//   between: linear interpolation
function generateCreditSpreadPayoff() {
  const K_short = 100
  const K_long = 95
  const credit = 1.5 // $ per share
  const payoff = (S: number) => {
    if (S >= K_short) return credit * 100
    if (S <= K_long) return (K_long - K_short + credit) * 100
    return (S - K_short + credit) * 100
  }
  return sample(85, 115, 100, payoff)
}

// Iron Condor: bull put spread + bear call spread. Net credit = c.
// Profit zone is between the two short strikes; max loss = wing width − c.
function generateIronCondorPayoff() {
  const putShort = 95,
    putLong = 90 // bull put spread
  const callShort = 105,
    callLong = 110 // bear call spread
  const credit = 2.0
  const payoff = (S: number) => {
    const putPnL = S >= putShort ? 0 : Math.max(S - putShort, putLong - putShort)
    const callPnL = S <= callShort ? 0 : -Math.min(S - callShort, callLong - callShort)
    return (credit + putPnL + callPnL) * 100
  }
  return sample(85, 115, 100, payoff)
}

// Calendar spread (call). Pay a debit; max profit at the short strike at
// the front-month expiration (short call expires worthless, long call retains
// time value). The at-front-expiration profile is the difference between the
// long call's value (intrinsic + remaining time premium, simplified) and the
// short call's intrinsic value. We use a simple BS approximation where the
// long call's residual time value is modeled as a normal-like bump.
function generateCalendarPayoff() {
  const K = 100
  const debit = 2.0
  const remainingTV = 4.0 // approx long call extrinsic at short expiry
  const payoff = (S: number) => {
    const shortIntrinsic = Math.max(0, S - K)
    // Long call value at short expiry ≈ intrinsic + time premium that decays
    // with |S - K| (peaked at K). A Gaussian centered at K models this well.
    const longTimePremium = remainingTV * Math.exp(-Math.pow(S - K, 2) / (2 * 5 * 5))
    const longTotal = Math.max(0, S - K) + longTimePremium
    return (longTotal - shortIntrinsic - debit) * 100
  }
  return sample(85, 115, 100, payoff)
}

// Long Call Butterfly: long 1 call K1, short 2 calls K2, long 1 call K3 (K1<K2<K3).
// Net debit = d. Max profit at K2 = (K2 - K1 - d) × 100. Max loss = d × 100.
function generateButterflyPayoff() {
  const K1 = 95,
    K2 = 100,
    K3 = 105
  const debit = 1.0
  const c = (S: number, k: number) => Math.max(0, S - k)
  const payoff = (S: number) => (c(S, K1) - 2 * c(S, K2) + c(S, K3) - debit) * 100
  return sample(85, 115, 100, payoff)
}

// Collar: long 100 shares at entry P0, long put K_p, short call K_c (K_p < P0 < K_c).
// Net cost of options = debit (small or zero).
function generateCollarPayoff() {
  const entry = 100
  const K_put = 95
  const K_call = 110
  const netDebit = 0.5 // cost of put minus premium of call
  const payoff = (S: number) => {
    const stockPnL = S - entry
    const putPayoff = Math.max(0, K_put - S)
    const callObligation = Math.max(0, S - K_call)
    return (stockPnL + putPayoff - callObligation - netDebit) * 100
  }
  return sample(80, 130, 100, payoff)
}

// Diagonal call spread: long deep-ITM long-dated call (LEAPS) + short
// near-dated OTM call. At short expiry the long call still has time value;
// we model intrinsic + remaining time premium with a Gaussian centered near
// its strike. (PMCC is a specific case of this with K_long deep ITM.)
function generateDiagonalPayoff() {
  const K_long = 90
  const longCost = 12 // premium paid for the long
  const K_short = 105
  const shortPremium = 1.5
  const remainingTV = 3.5
  const payoff = (S: number) => {
    const longTotal = Math.max(0, S - K_long) + remainingTV * Math.exp(-Math.pow(S - K_long, 2) / (2 * 12 * 12))
    const shortObligation = Math.max(0, S - K_short)
    return (longTotal - longCost - shortObligation + shortPremium) * 100
  }
  return sample(75, 125, 100, payoff)
}

// Long straddle: long 1 call + long 1 put, both at K. Cost = total premium p.
function generateStraddlePayoff() {
  const K = 100
  const totalPremium = 5
  const payoff = (S: number) => (Math.max(0, S - K) + Math.max(0, K - S) - totalPremium) * 100
  return sample(80, 120, 100, payoff)
}

// The Wheel — there's no single-expiration payoff (it's a cycle), so we
// show the most pedagogically useful slice: a single cash-secured put
// (the entry leg). Capped upside = premium; downside = stock falls below
// strike, partially cushioned by premium.
function generateWheelPayoff() {
  const K = 50
  const premium = 2 // $ per share for the put
  const payoff = (S: number) => (premium - Math.max(0, K - S)) * 100
  return sample(30, 70, 100, payoff)
}

interface StrategySetup {
  ticker: string
  setup: string
  credit: string
  pop: string
  direction: string
  signal: string
}

interface OptionsStrategyToolboxProps {
  strategy: keyof typeof STRATEGIES
}

export function OptionsStrategyToolbox({ strategy = "credit-spreads" }: OptionsStrategyToolboxProps) {
  const config = STRATEGIES[strategy]

  const [setups, setSetups] = useState<StrategySetup[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [lastScanned, setLastScanned] = useState<Date | null>(null)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)
  const [walkthroughSetup, setWalkthroughSetup] = useState<WalkthroughSetup | null>(null)

  // The example cards are static teaching examples drawn from the strategy
  // config (not live scanner output). Scanned results, when present, refresh them.
  const exampleSetups: StrategySetup[] = setups.length > 0 ? setups : config.setups

  if (!config) {
    return <div className="p-8 text-center text-gray-500">Strategy not found</div>
  }

  const handleRefreshSetups = async () => {
    setIsScanning(true)
    try {
      const response = await fetch("/api/strategy-scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, strategyName: config.name }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.setups && data.setups.length > 0) {
          setSetups(data.setups)
          setLastScanned(new Date())
        }
      }
    } catch (error) {
      console.error("Error scanning for setups:", error)
    } finally {
      setIsScanning(false)
    }
  }

  const getPayoffChartData = (payoffData: { x: number; y: number }[]) => {
    return payoffData.map((point) => ({
      x: point.x,
      profit: point.y > 0 ? point.y : 0,
      loss: point.y < 0 ? point.y : 0,
      y: point.y,
    }))
  }

  const InfoTooltip = ({ content }: { content: string }) => {
    if (!tooltipsEnabled) return null
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-gray-400 cursor-help inline ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-white text-gray-900 border shadow-lg p-3 z-50">
          <p className="text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-sky-100 to-teal-50 border-b border-sky-200">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <h1 className="text-3xl md:text-4xl font-bold text-navy-900" style={{ color: "#1E3A8A" }}>
                    {config.name}
                  </h1>
                  <Badge className={config.badgeColor}>{config.badge}</Badge>
                  <InfoTooltip
                    content={`${config.name}: ${config.tagline}. This page shows you how to set up and manage ${config.name.toLowerCase()} trades with real-time market examples.`}
                  />
                </div>
                <p className="text-lg text-teal-700">{config.tagline}</p>
              </div>
              <div className="flex items-center gap-2">
                <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
                <RefreshButton onClick={handleRefreshSetups} disabled={isScanning} />
              </div>
            </div>
            {lastScanned && (
              <p className="text-xs text-teal-600 mt-2">Last scanned: {lastScanned.toLocaleTimeString()}</p>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Main Content: Payoff Diagram + Stats */}
          <div className="grid lg:grid-cols-5 gap-6 mb-8">
            {/* Payoff Diagram */}
            <Card className="lg:col-span-2 shadow-sm">
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                  Payoff Diagram
                  <InfoTooltip content="This chart shows your profit (green) and loss (red) at different stock prices at expiration. The horizontal axis is the stock price, vertical axis is your profit/loss in dollars per contract." />
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={getPayoffChartData(config.payoff)}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="x" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v > 0 ? `+${v}` : v)} />
                      <ReferenceLine y={0} stroke="#9CA3AF" strokeWidth={2} />
                      <defs>
                        <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#10B981" stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#EF4444" stopOpacity={0.1} />
                          <stop offset="100%" stopColor="#EF4444" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="profit"
                        stroke="none"
                        fill="url(#profitGradient)"
                        fillOpacity={1}
                        isAnimationActive={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="loss"
                        stroke="none"
                        fill="url(#lossGradient)"
                        fillOpacity={1}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="y"
                        stroke="#374151"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded" />
                    <span>Profit Zone</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-500 rounded" />
                    <span>Loss Zone</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Key Stats */}
            <Card className="lg:col-span-3 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center" style={{ color: "#1E3A8A" }}>
                  Strategy Characteristics
                  <InfoTooltip content="These are the key numbers that define this strategy. Understanding these helps you know what to expect from the trade - your potential profit, risk, and ideal market conditions." />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 text-green-700 mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-xs font-medium">Max Profit</span>
                      <InfoTooltip content="The maximum amount you can make on this trade if everything goes perfectly. For credit strategies, this is the premium you collect upfront. For debit strategies, it's calculated based on strike width minus cost." />
                    </div>
                    <p className="text-sm font-semibold text-green-900">{config.stats.maxProfit}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2 text-red-700 mb-1">
                      <Shield className="h-4 w-4" />
                      <span className="text-xs font-medium">Max Loss</span>
                      <InfoTooltip content="The worst-case scenario - the most you can lose on this trade. This is your defined risk. Knowing this BEFORE you enter helps you size positions properly and sleep at night." />
                    </div>
                    <p className="text-sm font-semibold text-red-900">{config.stats.maxLoss}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 text-blue-700 mb-1">
                      <Target className="h-4 w-4" />
                      <span className="text-xs font-medium">Probability of Profit</span>
                      <InfoTooltip content="The statistical likelihood you'll make money on this trade. Higher probability (70%+) usually means smaller profits per trade. Lower probability strategies can pay more but lose more often. Balance this with your risk tolerance." />
                    </div>
                    <p className="text-sm font-semibold text-blue-900">{config.stats.probability}</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2 text-purple-700 mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-xs font-medium">Best Market</span>
                      <InfoTooltip content="The market conditions where this strategy performs best. Some strategies need trending markets, others need range-bound (sideways) markets. Using the right strategy for current conditions dramatically improves your odds." />
                    </div>
                    <p className="text-sm font-semibold text-purple-900">{config.stats.bestMarket}</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center gap-2 text-orange-700 mb-1">
                      <Activity className="h-4 w-4" />
                      <span className="text-xs font-medium">Ideal IV Rank</span>
                      <InfoTooltip content="IV Rank shows how expensive options are compared to the past year (0-100%). For SELLING options: higher IV (>50%) is better - you collect more premium. For BUYING options: lower IV (<30%) is better - options are cheaper." />
                    </div>
                    <p className="text-sm font-semibold text-orange-900">{config.stats.idealIV}</p>
                  </div>
                  <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                    <div className="flex items-center gap-2 text-teal-700 mb-1">
                      <Clock className="h-4 w-4" />
                      <span className="text-xs font-medium">Typical DTE</span>
                      <InfoTooltip content="Days to Expiration - how long until the options expire. Shorter DTE (7-21 days) = faster time decay, but less room for error. Longer DTE (30-60 days) = more flexibility, but ties up capital longer. Match DTE to your trading style." />
                    </div>
                    <p className="text-sm font-semibold text-teal-900">{config.stats.typicalDTE}</p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-700 mb-1">
                    <Calculator className="h-4 w-4 mr-2" />
                    <span className="text-xs font-medium">Breakeven</span>
                    <InfoTooltip content="The stock price where you neither make nor lose money at expiration. For credit strategies, you want the stock to stay AWAY from this price. For debit strategies, you need the stock to move PAST this price to profit." />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{config.stats.breakeven}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Best Current Setups */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-8 bg-teal-500 rounded" />
              <h2 className="text-xl font-bold" style={{ color: "#1E3A8A" }}>
                Example Setups (For Learning)
              </h2>
              <InfoTooltip content="These are illustrative teaching examples — not live trade recommendations. Each example shows a realistic ticker, the specific options to trade, premium, and probability of profit. Click Run Scenario for a step-by-step walkthrough of how to place the trade. Always do your own research before trading." />
              {isScanning && (
                <Badge className="bg-teal-100 text-teal-700 ml-2">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  AI Scanning Markets...
                </Badge>
              )}
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {exampleSetups.map((setup, idx) => (
                <Card
                  key={idx}
                  className={`shadow-md hover:shadow-lg transition-shadow ${isScanning ? "opacity-50" : ""}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl font-bold" style={{ color: "#1E3A8A" }}>
                        {setup.ticker}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {setup.direction}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-3 font-medium">{setup.setup}</p>
                    <div className="flex justify-between text-sm mb-4">
                      <div className="flex items-center">
                        <span className="text-gray-500">Premium:</span>
                        <span className="ml-1 font-semibold text-green-600">{setup.credit}</span>
                        <InfoTooltip content="The money you collect (credit) or pay (debit) to enter this trade. Credit = you get paid upfront. Debit = you pay to open. This is your max profit for credit trades." />
                      </div>
                      <div className="flex items-center">
                        <span className="text-gray-500">POP:</span>
                        <span className="ml-1 font-semibold text-blue-600">{setup.pop}</span>
                        <InfoTooltip content="Probability of Profit - the statistical chance this trade makes any money at all. 70% POP means 7 out of 10 similar trades historically made money." />
                      </div>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => setWalkthroughSetup(setup)}
                          className="w-full text-white bg-[#0D9488] hover:bg-[#0F766E]"
                        >
                          Run Scenario
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Step-by-step walkthrough: how to place {setup.setup} on {setup.ticker} in thinkorswim.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* AI Trade Ideas */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-8 bg-teal-500 rounded" />
              <h2 className="text-xl font-bold" style={{ color: "#1E3A8A" }}>
                <BarChart2 className="h-5 w-5 inline mr-2 text-teal-600" />
                AI Trade Ideas & Adjustments This Week
              </h2>
              <InfoTooltip content="Our AI analyzes current market conditions and provides context for why these setups make sense now. Use these insights to understand the 'why' behind each trade idea." />
            </div>
            <div className="space-y-3">
              <div className="border rounded-lg shadow-sm bg-white">
                <div className="px-4 py-3 hover:no-underline">
                  <span className="font-semibold flex items-center" style={{ color: "#1E3A8A" }}>
                    Market Outlook Impact
                    <InfoTooltip content="How current market conditions (volatility, trend, news) affect this strategy. Understanding market context helps you pick the right strategy and timing." />
                  </span>
                </div>
                <div className="px-4 pb-4">
                  <p className="text-gray-700 leading-relaxed">{config.insights.outlook}</p>
                </div>
              </div>
              <div className="border rounded-lg shadow-sm bg-white">
                <div className="px-4 py-3 hover:no-underline">
                  <span className="font-semibold flex items-center" style={{ color: "#1E3A8A" }}>
                    Entry Rules I'm Using
                    <InfoTooltip content="Specific criteria that must be met before entering a trade. Following strict entry rules prevents impulsive trades and improves long-term results. Only trade when ALL your rules are satisfied." />
                  </span>
                </div>
                <div className="px-4 pb-4">
                  <ul className="space-y-2">
                    {config.insights.entryRules.map((rule, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-700">
                        <span className="text-teal-500 mt-1">•</span>
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="border rounded-lg shadow-sm bg-white">
                <div className="px-4 py-3 hover:no-underline">
                  <span className="font-semibold flex items-center" style={{ color: "#1E3A8A" }}>
                    Adjustment Triggers
                    <InfoTooltip content="When and how to modify a trade that's moving against you. Good traders don't just enter trades - they have a plan for what to do when things don't go as expected. These are your 'if this happens, do that' rules." />
                  </span>
                </div>
                <div className="px-4 pb-4">
                  <ul className="space-y-2">
                    {config.insights.adjustments.map((adj, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-700">
                        <span className="text-teal-500 mt-1">•</span>
                        {adj}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Banner */}
          <div className="rounded-xl p-6 text-center relative overflow-hidden" style={{ backgroundColor: "#CCFBF1" }}>
            <div className="relative z-10">
              <RefreshCw className="h-10 w-10 mx-auto mb-3 text-teal-600" />
              <p className="text-lg font-semibold" style={{ color: "#1E3A8A" }}>
                Master every strategy with precision — calculate, execute, win.
              </p>
              <p className="text-sm text-teal-700 mt-2">
                Use our professional-grade calculators to optimize your {config.name.toLowerCase()} trades.
              </p>
            </div>
          </div>
        </div>
      </div>

      <TradeWalkthroughModal
        open={walkthroughSetup !== null}
        onClose={() => setWalkthroughSetup(null)}
        setup={walkthroughSetup}
        strategyKey={strategy}
        strategyName={config.name}
        typicalDTE={config.stats.typicalDTE}
      />
    </TooltipProvider>
  )
}
