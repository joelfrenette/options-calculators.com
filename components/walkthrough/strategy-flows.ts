/**
 * Per-strategy walkthrough flow: the order type, the right-click path, whether
 * the structure is a vertical, and whether it opens for a credit.
 *
 * Split out of `components/trade-walkthrough-modal.tsx` (P6-13) unchanged. The
 * `vertical` flag is what decides whether the modal renders the detailed
 * SELL/BUY option-chain mockup or a generic leg ticket, so it is a claim about
 * what the reader is being shown, not a styling switch.
 */

export interface Leg {
  side: "SELL" | "BUY"
  qty: number
  strike: number | null
  right: "PUT" | "CALL" | "STOCK"
  label: string
}

// Per-strategy thinkorswim order mechanics. `vertical` flag controls whether we
// can render the detailed SELL/BUY option-chain mockup vs. a generic leg ticket.
export interface StrategyFlow {
  orderType: string
  rightClick: string
  vertical: boolean
  isCredit: boolean
  buildWhy: string
  manageTip: string
}

export const STRATEGY_FLOWS: Record<string, StrategyFlow> = {
  "credit-spreads": {
    orderType: "Vertical",
    rightClick: "Right-click the short strike → Sell → Vertical",
    vertical: true,
    isCredit: true,
    buildWhy:
      "You sell the strike closer to the money to collect premium, and buy the further strike as insurance that caps your loss.",
    manageTip: "Take profit around 50% of the credit collected; close if price threatens your short strike.",
  },
  "iron-condors": {
    orderType: "Iron Condor",
    rightClick: "Right-click a strike → Sell → Iron Condor",
    vertical: true,
    isCredit: true,
    buildWhy:
      "An iron condor is two credit spreads — a put spread below price and a call spread above. You profit if price stays between the short strikes.",
    manageTip: "Take profit near 50% of total credit; defend the tested side if price runs to a short strike.",
  },
  butterflies: {
    orderType: "Butterfly",
    rightClick: "Right-click the body strike → Buy → Butterfly",
    vertical: false,
    isCredit: false,
    buildWhy:
      "A butterfly buys the wings and sells the body (2x). It is cheap and pays the most if price pins your center strike at expiration.",
    manageTip: "These are slow movers — let theta work, and target 25–50% of max profit rather than the peak.",
  },
  "calendar-spreads": {
    orderType: "Calendar",
    rightClick: "Right-click the strike → Buy → Calendar",
    vertical: false,
    isCredit: false,
    buildWhy:
      "You sell the near-term option and buy the same strike further out. The near option decays faster, which is your edge.",
    manageTip: "Profit comes from time decay and stable price; close before the front-month expiration week.",
  },
  diagonals: {
    orderType: "Diagonal",
    rightClick: "Right-click the strike → Buy → Diagonal",
    vertical: false,
    isCredit: false,
    buildWhy:
      "A diagonal mixes a calendar and a vertical — different strikes and different expirations — for directional plus time-decay exposure.",
    manageTip: "Roll the short leg forward to keep collecting premium against your longer-dated long option.",
  },
  collars: {
    orderType: "Collar",
    rightClick: "Build legs from the chain: buy a protective put, sell a covered call",
    vertical: false,
    isCredit: false,
    buildWhy:
      "A collar protects stock you own: the long put is a floor, and selling the call pays for that protection by capping upside.",
    manageTip: "This is a protective hedge — adjust the strikes as the stock moves to keep your floor in place.",
  },
  "straddles-strangles": {
    orderType: "Straddle / Strangle",
    rightClick: "Right-click a strike → Buy → Straddle (or Strangle)",
    vertical: false,
    isCredit: false,
    buildWhy:
      "You buy both a call and a put to profit from a big move in either direction. Your enemy is time decay and falling volatility.",
    manageTip: "You need a real move to win — take profits quickly on a spike and don't hold through IV crush.",
  },
  "wheel-strategy": {
    orderType: "Cash-Secured Put",
    rightClick: "Right-click the put strike → Sell → Single",
    vertical: false,
    isCredit: true,
    buildWhy:
      "You sell a cash-secured put to get paid while waiting to buy a stock you like at a discount. If assigned, you then sell covered calls.",
    manageTip: "Only sell puts on stocks you'd happily own; take profit near 50% or roll if challenged.",
  },
}

export const DEFAULT_FLOW: StrategyFlow = STRATEGY_FLOWS["credit-spreads"]

// Extract trade legs from the human-readable setup string. Returns the legs
