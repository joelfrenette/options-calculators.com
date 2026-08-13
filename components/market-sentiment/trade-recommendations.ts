/**
 * The allocation and strategy copy shown for each sentiment band.
 *
 * Split out of `components/market-sentiment.tsx` (P6-13) unchanged. Positions
 * are shares/LEAPS/options/cash and diversification is expressed through
 * sectors and indexes — the house allocation rule, which is why no separate
 * asset class appears anywhere below.
 */

export const getTradeRecommendations = (level: string | null) => {
  if (level === "Extreme Fear") {
    return {
      level: "Extreme Fear",
      positionSize: "Larger positions (3-5% per trade)",
      strategies: [
        "Aggressive cash-secured puts on quality stocks",
        "Sell puts 10-20% OTM for premium collection",
        "Consider LEAPS calls on beaten-down stocks",
        "Wheel strategy on high-quality names",
      ],
      riskManagement: [
        "This is a buying opportunity - deploy capital aggressively",
        "Focus on stocks you want to own long-term",
        "Use 30-45 DTE for optimal theta decay",
        "Keep some cash for potential further drops",
      ],
      coachTips:
        "Top coaches recommend being greedy when others are fearful. This is prime time for put selling on quality stocks.",
    }
  } else if (level === "Fear") {
    return {
      level: "Fear",
      positionSize: "Standard positions (2-3% per trade)",
      strategies: [
        "Moderate cash-secured put selling",
        "Sell puts 5-15% OTM",
        "Credit spreads for defined risk",
        "Iron condors on high IV stocks",
      ],
      riskManagement: [
        "Good environment for premium selling",
        "Maintain diversification across sectors",
        "Use 30-45 DTE for balance of premium and time",
        "Be selective with underlying stocks",
      ],
      coachTips:
        "Market showing some fear - favorable for options sellers. Focus on quality underlyings and maintain discipline.",
    }
  } else if (level === "Neutral") {
    return {
      level: "Neutral",
      positionSize: "Conservative positions (1-2% per trade)",
      strategies: [
        "Balanced approach to put selling",
        "Sell puts 5-10% OTM",
        "Credit spreads for better risk/reward",
        "Focus on earnings plays with defined risk",
      ],
      riskManagement: [
        "Market is balanced - be selective",
        "Reduce position sizes slightly",
        "Consider taking profits early (50% max profit)",
        "Increase cash reserves for opportunities",
      ],
      coachTips: "Neutral market conditions - maintain discipline and don't force trades. Wait for better setups.",
    }
  } else if (level === "Greed") {
    return {
      level: "Greed",
      positionSize: "Small positions (0.5-1% per trade)",
      strategies: [
        "Reduce new put selling significantly",
        "Focus on credit spreads with tight strikes",
        "Consider bear call spreads",
        "Take profits on existing positions early",
      ],
      riskManagement: [
        "Market showing greed - be cautious",
        "Reduce overall exposure and position sizes",
        "Build cash reserves for future opportunities",
        "Consider closing profitable trades early",
      ],
      coachTips:
        "Greed levels rising - time to be defensive. Top coaches recommend reducing exposure and building cash.",
    }
  } else {
    return {
      level: "Extreme Greed",
      positionSize: "Minimal positions (0.25-0.5% per trade)",
      strategies: [
        "STOP opening new put positions",
        "Close existing positions for profits",
        "Consider protective puts on long holdings",
        "Focus on bear call spreads if trading",
      ],
      riskManagement: [
        "Extreme greed - high risk of correction",
        "Build maximum cash reserves",
        "Close profitable trades immediately",
        "Prepare for volatility expansion",
      ],
      coachTips:
        "DANGER ZONE - Extreme greed often precedes corrections. Top coaches recommend maximum cash and minimal exposure.",
    }
  }
}

