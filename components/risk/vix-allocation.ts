/**
 * The VIX bands, and the allocation each one implies.
 *
 * Split out of `components/risk-calculator.tsx` (P6-13) unchanged.
 *
 * ONE classification per reading: `getVixLevel` decides the band and
 * `getVixPortfolioAllocation` reads off it. Positions are shares/LEAPS/options/
 * cash and diversification runs through sectors and indexes — the house
 * allocation rule, which is why no separate asset class appears below.
 */

export interface VixLevel {
  range: string
  sentiment: string
  cashMin: number
  cashMax: number
  investedMin: number
  investedMax: number
  color: string
  optionsAction: string
  equityAction: string
  marginBufferPercent: number // Percentage of total cash for margin buffer
  opportunityPercent: number // Percentage of total cash for dip-buying
}

export const VIX_LEVELS: VixLevel[] = [
  {
    range: "≤ 12",
    sentiment: "Extreme Greed",
    cashMin: 40,
    cashMax: 50,
    investedMin: 50,
    investedMax: 60,
    color: "text-green-600",
    optionsAction: "Sell limited-risk spreads only",
    equityAction: "Avoid new buys; trim winners",
    marginBufferPercent: 50, // 20-25% of portfolio
    opportunityPercent: 50, // 20-25% of portfolio
  },
  {
    range: "12-15",
    sentiment: "Greed",
    cashMin: 30,
    cashMax: 40,
    investedMin: 60,
    investedMax: 70,
    color: "text-green-500",
    optionsAction: "Small size, short puts on quality stocks",
    equityAction: "Wait for pullback",
    marginBufferPercent: 55,
    opportunityPercent: 45,
  },
  {
    range: "15-20",
    sentiment: "Slight Fear",
    cashMin: 20,
    cashMax: 25,
    investedMin: 75,
    investedMax: 80,
    color: "text-yellow-600",
    optionsAction: "Regular put selling",
    equityAction: "Start small DCA",
    marginBufferPercent: 60,
    opportunityPercent: 40,
  },
  {
    range: "20-25",
    sentiment: "Fear",
    cashMin: 10,
    cashMax: 15,
    investedMin: 85,
    investedMax: 90,
    color: "text-orange-600",
    optionsAction: "Scale up short puts / strangles",
    equityAction: "Deploy dip cash (10-15%)",
    marginBufferPercent: 70,
    opportunityPercent: 30,
  },
  {
    range: "25-30",
    sentiment: "Very Fearful",
    cashMin: 5,
    cashMax: 10,
    investedMin: 90,
    investedMax: 95,
    color: "text-red-600",
    optionsAction: "Go heavier into short puts (still hedged)",
    equityAction: "Aggressive DCA, nibble growth names",
    marginBufferPercent: 80,
    opportunityPercent: 20,
  },
  {
    range: "≥ 30",
    sentiment: "Extreme Fear",
    cashMin: 0,
    cashMax: 5,
    investedMin: 95,
    investedMax: 100,
    color: "text-red-700",
    optionsAction: "Massive premiums — ladder entries carefully",
    equityAction: "Deploy remaining cash in tranches",
    marginBufferPercent: 100,
    opportunityPercent: 0,
  },
]

export function getVixLevel(vix: number): VixLevel {
  if (vix <= 12) return VIX_LEVELS[0]
  if (vix <= 15) return VIX_LEVELS[1]
  if (vix <= 20) return VIX_LEVELS[2]
  if (vix <= 25) return VIX_LEVELS[3]
  if (vix <= 30) return VIX_LEVELS[4]
  return VIX_LEVELS[5]
}

export function getVixPortfolioAllocation(vixLevel: number): {
  stocks: string
  options: string
  leaps: string
  hedges: string
  cash: string
  description: string
  rationale: string[]
} {
  if (vixLevel <= 12) {
    // Extreme Greed (VIX ≤ 12)
    return {
      stocks: "35-45%",
      options: "10-15%",
      leaps: "0-5%",
      hedges: "5-10%",
      cash: "40-50%",
      description: "Maximum caution - markets at peak complacency, crashes often follow extreme lows",
      rationale: [
        "Trim equity exposure aggressively; VIX this low historically precedes sharp corrections",
        "Limit options to defined-risk spreads only; avoid naked short puts",
        "Build large cash reserves for inevitable volatility spike buying opportunities",
        "Tilt remaining equity toward defensive sectors (XLU/XLP) and carry index put hedges against sudden reversals",
        "Keep LEAPS minimal; avoid adding leverage at market peaks",
      ],
    }
  } else if (vixLevel <= 15) {
    // Greed (VIX 12-15)
    return {
      stocks: "40-50%",
      options: "10-15%",
      leaps: "3-5%",
      hedges: "5-10%",
      cash: "30-40%",
      description: "Still elevated greed - cautious deployment, wait for better risk/reward setups",
      rationale: [
        "Maintain elevated cash levels; market still pricing in low volatility",
        "Selective short puts on highest-quality names only with small position sizing",
        "Continue building cash reserves for better opportunities ahead",
        "Defensive sector weight (XLU/XLP) as portfolio stabilizer; LEAPS only as small tactical positions",
        "Focus on risk management over aggressive growth",
      ],
    }
  } else if (vixLevel <= 20) {
    // Slight Fear (VIX 15-20)
    return {
      stocks: "50-60%",
      options: "15-20%",
      leaps: "5-10%",
      hedges: "3-5%",
      cash: "20-25%",
      description: "Normal volatility environment - balanced approach with regular options selling",
      rationale: [
        "Healthy volatility levels support regular put-selling strategies",
        "Begin DCA into quality growth stocks on minor pullbacks",
        "Options premiums still attractive for income generation",
        "Maintain tactical cash buffer for opportunistic additions",
        "Diversified exposure across sectors and indexes for risk balance",
      ],
    }
  } else if (vixLevel <= 25) {
    // Fear (VIX 20-25)
    return {
      stocks: "60-70%",
      options: "15-20%",
      leaps: "5-10%",
      hedges: "0-5%",
      cash: "10-15%",
      description: "Elevated fear creates opportunities - deploy dip-buying cash on pullbacks",
      rationale: [
        "Increase equity exposure as fear rises; best buying opportunities emerge",
        "Scale up short put strategies as premiums expand significantly",
        "Deploy 10-15% of cash reserves on high-quality dip purchases",
        "Options strategies generate outsized income during volatility spikes",
        "Maintain some cash for potential further downside but start getting aggressive",
      ],
    }
  } else if (vixLevel <= 30) {
    // Very Fearful (VIX 25-30)
    return {
      stocks: "65-75%",
      options: "20-25%",
      leaps: "5-10%",
      hedges: "0-5%",
      cash: "5-10%",
      description: "High fear environment - aggressive buying of quality assets at discount prices",
      rationale: [
        "Significant market fear creates exceptional entry points for long-term holdings",
        "Heavy short put activity captures massive volatility premiums",
        "Deploy cash reserves aggressively through systematic DCA approach",
        "Focus on mega-cap tech and defensive blue chips at attractive valuations",
        "Options strategies generate outsized income during volatility spikes",
      ],
    }
  } else {
    // Extreme Fear (VIX ≥ 30)
    return {
      stocks: "70-85%",
      options: "20-30%",
      leaps: "5-10%",
      hedges: "0%",
      cash: "0-5%",
      description: "Maximum opportunity - panic creates generational buying moments",
      rationale: [
        "Deploy all remaining cash in measured tranches; these are lifetime opportunities",
        "Massive options premiums available; ladder short put entries carefully to avoid catching falling knives",
        "Buy growth stocks that sold off 40-60% from highs with strong balance sheets",
        "Market panic rarely lasts; positioning for 6-12 month recovery timeframe",
        "Keep minimal cash only for emergency margin requirements and essential liquidity",
      ],
    }
  }
}
