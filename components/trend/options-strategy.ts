/**
 * The per-ticker option structure suggested for the current trend.
 *
 * Split out of `components/trend-analysis.tsx` (P6-13). ONE mechanical change:
 * it was an arrow constant inside the component and is now a function taking
 * the same two arguments.
 */
import type { TrendData } from "./trend-types"

export const getOptionsStrategy = (ticker: string, item: TrendData) => {
  const strategies = {
    SPY: {
      bullish: {
        name: "SPY Bull Call Spread",
        description: `SPY is the most liquid options market. With ${item.trendConfidence.toFixed(0)}% bullish confidence, consider buying ATM calls at $${item.currentPrice.toFixed(2)} and selling OTM calls at $${item.resistance.toFixed(2)}. Target 30-45 DTE for optimal theta decay balance.`,
      },
      bearish: {
        name: "SPY Bear Put Spread",
        description: `SPY's high liquidity makes it ideal for put spreads. With ${item.trendConfidence.toFixed(0)}% bearish confidence, buy ATM puts at $${item.currentPrice.toFixed(2)} and sell OTM puts at $${item.support.toFixed(2)}. Consider weekly options for faster profits.`,
      },
      neutral: {
        name: "SPY Iron Condor",
        description: `SPY's tight bid-ask spreads are perfect for iron condors. Sell call spreads above $${item.resistance.toFixed(2)} and put spreads below $${item.support.toFixed(2)}. Target 30-45 DTE with 1 standard deviation wings.`,
      },
    },
    SPX: {
      bullish: {
        name: "SPX Bull Call Spread (Cash-Settled)",
        description: `SPX offers cash-settled, European-style options with tax advantages (60/40 treatment). With ${item.trendConfidence.toFixed(0)}% bullish confidence, buy calls at $${item.currentPrice.toFixed(2)} and sell at $${item.resistance.toFixed(2)}. No assignment risk - perfect for larger accounts.`,
      },
      bearish: {
        name: "SPX Bear Put Spread (Cash-Settled)",
        description: `SPX's cash settlement eliminates assignment risk. With ${item.trendConfidence.toFixed(0)}% bearish confidence, structure put spreads at $${item.currentPrice.toFixed(2)}/$${item.support.toFixed(2)}. Enjoy favorable tax treatment on gains.`,
      },
      neutral: {
        name: "SPX Iron Condor (Tax-Advantaged)",
        description: `SPX iron condors offer 60/40 tax treatment and no assignment risk. Sell premium outside support ($${item.support.toFixed(2)}) and resistance ($${item.resistance.toFixed(2)}). Ideal for consistent income with tax benefits.`,
      },
    },
    QQQ: {
      bullish: {
        name: "QQQ Bull Call Spread (Tech Focus)",
        description: `QQQ tracks Nasdaq-100 with heavy tech exposure. With ${item.trendConfidence.toFixed(0)}% bullish confidence, buy calls at $${item.currentPrice.toFixed(2)} and sell at $${item.resistance.toFixed(2)}. Higher volatility means larger premiums - perfect for tech rallies.`,
      },
      bearish: {
        name: "QQQ Bear Put Spread (Tech Hedge)",
        description: `QQQ's tech concentration makes it volatile during selloffs. With ${item.trendConfidence.toFixed(0)}% bearish confidence, structure put spreads at $${item.currentPrice.toFixed(2)}/$${item.support.toFixed(2)}. Great for hedging tech-heavy portfolios.`,
      },
      neutral: {
        name: "QQQ Iron Condor (High Premium)",
        description: `QQQ's higher IV means bigger premiums for iron condors. Sell call spreads above $${item.resistance.toFixed(2)} and put spreads below $${item.support.toFixed(2)}. Wider wings recommended due to tech volatility.`,
      },
    },
  }

  const tickerStrategies = strategies[ticker as keyof typeof strategies]
  if (item.trend === "Bullish") return tickerStrategies.bullish
  if (item.trend === "Bearish") return tickerStrategies.bearish
  return tickerStrategies.neutral
}
