/**
 * Per-band trade guidance: the recommendations for the current level, and the
 * full table of every level at once.
 *
 * Split out of `components/panic-euphoria.tsx` (P6-13). ONE mechanical change:
 * both were arrow constants inside the component and are now functions taking
 * the same arguments they always took.
 *
 * Positions are shares/LEAPS/options/cash and diversification runs through
 * sectors and indexes - the house allocation rule.
 */

export const getTradeRecommendations = (level: string | null, aboveMA: boolean) => {
  if (level === "Extreme Panic") {
    return {
      level: "Extreme Panic",
      signal: "STRONG BUY",
      confidence: "Very High",
      strategies: [
        "Aggressive cash-secured put selling on quality mega-caps",
        "Sell 30-45 DTE puts 10-20% OTM for maximum premium",
        "LEAPS calls on beaten-down dividend aristocrats",
        "Wheel strategy on highest conviction names (AAPL, MSFT, JPM)",
      ],
      riskManagement: [
        "Historical data shows >95% probability of gains within 12 months",
        "This is a generational buying opportunity - deploy capital aggressively",
        "Keep 10-15% cash reserve for potential further drops",
        "Focus on stocks you want to own long-term at these prices",
      ],
      coachTips:
        "EXTREME PANIC DETECTED - History shows these signals are rare and incredibly profitable. Last extreme readings: 2009 (Financial Crisis), 2020 (COVID Crash). Official Citi data: >95% probability of positive returns within 1 year from extreme panic levels.",
    }
  }

  // Panic (Contrarian Bullish)
  if (level === "Panic") {
    return {
      level: "Panic",
      signal: "BUY",
      confidence: "High",
      strategies: [
        "Aggressive put selling on quality stocks during weakness",
        "Sell 30-45 DTE puts 5-15% OTM",
        "Credit spreads for defined risk with higher probability",
        "Accumulate shares via cash-secured puts",
      ],
      riskManagement: [
        "SPX above 200-week MA confirms long-term uptrend intact",
        "Historical data shows strong positive returns after panic signals",
        "Signals can be early - market may continue down 1-3 months",
        "Build positions gradually over 4-8 weeks",
      ],
      coachTips:
        "Market showing panic while long-term trend remains intact. Historical avg returns: 6mo: +8.2%, 12mo: +15.7%. Be patient - best opportunities may be 4-6 weeks away.",
    }
  }

  // Neutral/Complacent
  if (level === "Neutral/Complacent") {
    return {
      level: "Neutral/Complacent",
      signal: "HOLD",
      confidence: "Moderate",
      strategies: [
        "Balanced approach - no urgency",
        "Selective put selling on pullbacks",
        "Tight credit spreads for defined risk",
        "Take profits on existing positions",
      ],
      riskManagement: [
        "Market neither panicked nor euphoric",
        "Wait for better setups - patience is key",
        "Reduce position sizes and exposure",
        "Build cash reserves for future opportunities",
      ],
      coachTips: "Neutral conditions - no compelling signal. Wait for panic (buy signal) or euphoria (avoid risk).",
    }
  }

  // Euphoria
  if (level === "Euphoria") {
    return {
      level: "Euphoria",
      signal: "CAUTION/SELL",
      confidence: "High",
      strategies: [
        "Reduce new position size by 50%",
        "Consider hedging long positions",
        "Take profits on highly appreciated assets",
        "Avoid chasing momentum",
      ],
      riskManagement: [
        "Market showing significant optimism - risk of correction",
        "Consider building cash reserves",
        "Be prepared for increased volatility",
      ],
      coachTips: "Euphoria detected. Market is elevated; consider reducing risk and building cash.",
    }
  }

  // Extreme Euphoria
  return {
    level: "Extreme Euphoria",
    signal: "STRONG SELL",
    confidence: "Very High",
    strategies: [
      "STOP new buying immediately",
      "Close profitable positions early",
      "Consider protective puts on long holdings",
      "Focus on bear call spreads if trading",
    ],
    riskManagement: [
      "Market showing extreme euphoria - high risk of sharp correction",
      "Official Citi data: >80% probability of lower prices within 12 months",
      "Build maximum cash reserves",
      "Prepare for significant volatility",
    ],
    coachTips:
      "EXTREME EUPHORIA WARNING - Market exuberance suggests sharp correction ahead. Historical pattern: >80% chance of lower prices within 1 year from extreme euphoria levels (official Citi data).",
  }
}

export const getAllLevelGuidance = () => {
  return [
    {
      range: "≤ -0.45",
      level: "Extreme Panic",
      description: "Rare generational buying opportunity (>95% win rate)",
      signal: "STRONG BUY",
      guidance: getTradeRecommendations("Extreme Panic", true),
    },
    {
      range: "-0.45 to -0.17",
      level: "Panic",
      description: "High probability contrarian bullish setup",
      signal: "BUY",
      guidance: getTradeRecommendations("Panic", true),
    },
    {
      range: "-0.17 to +0.41",
      level: "Neutral/Complacent",
      description: "Market lacks extreme sentiment; wait for better setups",
      signal: "HOLD",
      guidance: getTradeRecommendations("Neutral/Complacent", true),
    },
    {
      range: "+0.41 to +0.70",
      level: "Euphoria",
      description: "Significant optimism, elevated risk",
      signal: "CAUTION/SELL",
      guidance: getTradeRecommendations("Euphoria", true),
    },
    {
      range: "≥ +0.70",
      level: "Extreme Euphoria",
      description: "Excessive optimism (>80% chance of lower prices in 1yr)",
      signal: "STRONG SELL",
      guidance: getTradeRecommendations("Extreme Euphoria", true),
    },
  ]
}
