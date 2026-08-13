/**
 * Options structures suggested for the next FOMC meeting's predicted move.
 *
 * Split out of `components/fomc-predictions.tsx` (P6-13). ONE mechanical
 * change: it was an arrow constant inside the component and is now a function
 * taking the same two arguments it always took.
 *
 * Positions are shares/LEAPS/options/cash and diversification runs through
 * sectors and indexes — the house allocation rule.
 */
import type { NextMeeting, OptionsStrategy } from "./fomc-types"

export const generateOptionsStrategies = (meeting: NextMeeting, currentRate: number): OptionsStrategy[] => {
  const strategies: OptionsStrategy[] = []

  if (meeting.prediction === "CUT") {
    // Rate cut expected - bullish for stocks, bearish for dollar
    strategies.push({
      name: "Long Calls on SPY",
      ticker: "SPY",
      type: "Directional Bullish",
      rationale: `${Math.abs(meeting.predictionBps)}bp rate cut expected with ${meeting.confidence}% confidence. Rate cuts typically boost equity markets, especially large caps.`,
      entry: "Buy ATM or slightly OTM calls (0.45-0.55 delta)",
      target: `+3-5% move in SPY within ${meeting.daysUntil} days`,
      stopLoss: "Exit if SPY breaks below recent support or loses 50% of premium",
      timeframe: `${meeting.daysUntil} days until announcement`,
      risk: "Limited to premium paid. Consider spreading to reduce cost.",
    })

    strategies.push({
      name: "Bull Call Spread on QQQ",
      ticker: "QQQ",
      type: "Defined Risk Bullish",
      rationale:
        "Tech stocks benefit most from rate cuts due to lower discount rates on future earnings. Spread reduces cost and defines risk.",
      entry: "Buy ATM call, sell call 5-7% OTM",
      target: "Max profit if QQQ rallies above short strike by expiration",
      stopLoss: "Exit at 50% loss or if QQQ breaks key support",
      timeframe: "30-45 DTE, hold through announcement",
      risk: "Limited to net debit paid. Max profit = strike width - debit.",
    })

    strategies.push({
      name: "Long Calls on IWM",
      ticker: "IWM",
      type: "Directional Bullish",
      rationale:
        "Small caps carry more floating-rate debt than large caps, so they benefit most directly when rates fall. Historically strong reaction to cut cycles.",
      entry: "Buy slightly OTM calls (0.40-0.50 delta)",
      target: "+4-6% rally in small caps",
      stopLoss: "Exit if IWM breaks below support or loses 40% of premium",
      timeframe: `Hold through ${meeting.date} announcement`,
      risk: "Limited to premium. Small caps can be volatile around Fed decisions.",
    })

    strategies.push({
      name: "Long Calls on XLF",
      ticker: "XLF",
      type: "Sector Play",
      rationale:
        "Financial stocks often rally on initial rate cut as it signals economic support. Banks benefit from steeper yield curve.",
      entry: "Buy slightly OTM calls (0.40-0.50 delta)",
      target: "+4-6% move in financials sector",
      stopLoss: "Exit if XLF fails to hold above 50-day MA",
      timeframe: "Through FOMC announcement + 1 week",
      risk: "Moderate. Financials can be volatile on Fed decisions.",
    })
  } else if (meeting.prediction === "HIKE") {
    // Rate hike expected - bearish for stocks, bullish for dollar
    strategies.push({
      name: "Bear Put Spread on SPY",
      ticker: "SPY",
      type: "Defined Risk Bearish",
      rationale: `${meeting.predictionBps}bp rate hike expected with ${meeting.confidence}% confidence. Hikes typically pressure equity valuations and increase recession risk.`,
      entry: "Buy ATM put, sell put 5% OTM",
      target: "Max profit if SPY drops below short strike",
      stopLoss: "Exit at 50% loss or if SPY breaks above resistance",
      timeframe: `${meeting.daysUntil} days until announcement`,
      risk: "Limited to net debit. Max profit = strike width - debit.",
    })

    strategies.push({
      name: "Long Puts on QQQ",
      ticker: "QQQ",
      type: "Directional Bearish",
      rationale:
        "Growth/tech stocks most vulnerable to rate hikes. Higher rates increase discount rates on future earnings, pressuring valuations.",
      entry: "Buy ATM or slightly ITM puts (0.50-0.60 delta)",
      target: "-4-7% decline in QQQ",
      stopLoss: "Exit if QQQ holds above key support or loses 50% of premium",
      timeframe: "30-45 DTE, hold through announcement",
      risk: "Limited to premium. Tech can be highly volatile.",
    })

    strategies.push({
      name: "Long Calls on XLP (Consumer Staples)",
      ticker: "XLP",
      type: "Defensive Sector Play",
      rationale:
        "Rate hikes increase recession risk. Money rotates into defensive staples with pricing power when growth expectations fall.",
      entry: "Buy ATM calls on XLP",
      target: "+3-5% relative outperformance in staples",
      stopLoss: "Exit if XLP breaks below support",
      timeframe: `Through ${meeting.date} + 1 week`,
      risk: "Limited to premium. Defensive sectors move slowly; size accordingly.",
    })

    strategies.push({
      name: "Short Calls on XLF (Covered)",
      ticker: "XLF",
      type: "Income Strategy",
      rationale:
        "If holding financial stocks, sell OTM calls to generate income. Rate hikes help banks but market may already price this in.",
      entry: "Sell calls 5-7% OTM (0.20-0.30 delta)",
      target: "Collect premium if XLF stays below strike",
      stopLoss: "Buy back if XLF rallies strongly or at 200% loss",
      timeframe: "Expiration after FOMC meeting",
      risk: "Caps upside. Requires stock ownership or margin.",
    })
  } else {
    // No change expected - neutral strategies
    strategies.push({
      name: "Iron Condor on SPY",
      ticker: "SPY",
      type: "Neutral Income",
      rationale: `${meeting.confidence}% probability of no rate change. Market likely to stay range-bound. Sell premium on both sides.`,
      entry: "Sell OTM call spread + OTM put spread (16-20 delta)",
      target: "Collect premium if SPY stays within range",
      stopLoss: "Exit at 2x credit received or if SPY breaks out",
      timeframe: `${meeting.daysUntil} days, close before announcement`,
      risk: "Defined risk. Max loss = strike width - credit received.",
    })

    strategies.push({
      name: "Short Straddle on VIX",
      ticker: "VIX",
      type: "Volatility Play",
      rationale:
        "If no change expected, volatility should decline post-announcement. Sell straddle to profit from vol crush.",
      entry: "Sell ATM call and put on VIX or VXX",
      target: "Profit from volatility decline after FOMC",
      stopLoss: "Exit if VIX spikes above 25 or at 150% loss",
      timeframe: "Close day after FOMC announcement",
      risk: "High risk. VIX can spike unexpectedly. Use small size.",
    })

    strategies.push({
      name: "Calendar Spread on QQQ",
      ticker: "QQQ",
      type: "Time Decay Play",
      rationale:
        "Sell near-term options, buy longer-term at same strike. Profit from time decay if market stays flat.",
      entry: "Sell options expiring before FOMC, buy options expiring after",
      target: "Profit from faster decay of short-term options",
      stopLoss: "Exit if QQQ moves >3% in either direction",
      timeframe: "Front month expires before FOMC",
      risk: "Limited risk to net debit. Profits if underlying stays near strike.",
    })

    strategies.push({
      name: "Covered Calls on Holdings",
      ticker: "Portfolio",
      type: "Income Generation",
      rationale: "If holding stocks and expecting range-bound market, sell OTM calls to generate income.",
      entry: "Sell calls 5-10% OTM on existing positions",
      target: "Collect premium if stocks stay below strikes",
      stopLoss: "Buy back if position rallies strongly",
      timeframe: "30-45 DTE",
      risk: "Caps upside. Requires stock ownership.",
    })
  }

  return strategies
}
