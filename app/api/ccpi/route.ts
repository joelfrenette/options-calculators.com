import { NextResponse } from "next/server"

// This API endpoint now integrates Buffett Indicator, Put/Call Ratio, VIX suite, 
// sentiment surveys, and other professional indicators into the pillar scoring

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date")
  
  try {
    // Fetch external data for indicator calculations
    const data = await fetchMarketIndicators()
    
    const valuation = await computeValuationStress(data)
    const technical = await computeTechnicalFragility(data)
    const macro = await computeMacroLiquidityRisk(data)
    const sentiment = await computeSentimentFeedback(data)
    const flows = await computeCapitalFlowsPositioning(data)
    const structural = await computeStructuralAltData(data)
    
    const pillars = {
      valuation,
      technical,
      macro,
      sentiment,
      flows,
      structural
    }
    
    const weights = {
      valuation: 0.22,  // Buffett Indicator, P/E, P/S
      technical: 0.20,  // VIX suite, Bollinger, ATR, High-Low
      macro: 0.18,      // Fed policy, junk spreads, rates
      sentiment: 0.18,  // AAII, Put/Call, social sentiment
      flows: 0.12,      // ETF flows, positioning
      structural: 0.10  // AI-specific data
    }
    
    const ccpi = Math.round(
      pillars.valuation * weights.valuation +
      pillars.technical * weights.technical +
      pillars.macro * weights.macro +
      pillars.sentiment * weights.sentiment +
      pillars.flows * weights.flows +
      pillars.structural * weights.structural
    )
    
    const certainty = computeCertaintyScore(pillars, data)
    const regime = determineRegime(ccpi)
    const playbook = getPlaybook(regime)
    const canaries = getTopCanaries(pillars, data)
    
    const summary = generateWeeklySummary(ccpi, certainty, regime, pillars, data, canaries)
    
    const snapshot = {
      buffettIndicator: data.buffettIndicator,
      spxPE: data.spxPE,
      spxPS: data.spxPS,
      vix: data.vix,
      vxn: data.vxn,
      highLowIndex: data.highLowIndex,
      bullishPercent: data.bullishPercent,
      ltv: data.ltv,
      atr: data.atr,
      fedFundsRate: data.fedFundsRate,
      junkSpread: data.junkSpread,
      yieldCurve: data.yieldCurve,
      aaiiBullish: data.aaiiBullish,
      aaiiBearish: data.aaiiBearish,
      putCallRatio: data.putCallRatio,
      fearGreedIndex: data.fearGreedIndex,
      riskAppetite: data.riskAppetite,
      etfFlows: data.etfFlows,
      shortInterest: data.shortInterest
    }
    
    return NextResponse.json({
      ccpi,
      certainty,
      pillars,
      regime,
      playbook,
      summary,
      canaries,
      indicators: snapshot,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("[v0] CCPI API error:", error)
    return NextResponse.json(
      { error: "Failed to compute CCPI" },
      { status: 500 }
    )
  }
}

async function fetchMarketIndicators() {
  // In production, fetch from actual APIs (FRED, Yahoo, etc.)
  // For now, using realistic values that would come from these sources
  
  return {
    // Valuation indicators
    buffettIndicator: 180, // % - Stock Market Cap / GDP (over 120% is warning)
    spxPE: 22.5,           // S&P 500 forward P/E
    spxPS: 2.8,            // S&P 500 price-to-sales
    
    // Technical indicators
    vix: 18.2,             // CBOE VIX
    vxn: 19.5,             // Nasdaq 100 volatility
    rvx: 20.1,             // Russell 2000 volatility
    atr: 42.3,             // S&P 500 ATR (14-day)
    highLowIndex: 0.42,    // % of stocks at 52-week highs vs lows (0-1)
    bullishPercent: 58,    // Bullish Percent Index (NYSE)
    
    // Macro indicators
    fedFundsRate: 4.5,     // %
    junkSpread: 3.8,       // High-yield spread over Treasuries (bp)
    yieldCurve: 0.15,      // 10Y-2Y spread (negative = inverted)
    
    // Sentiment indicators
    aaiiBullish: 42,       // AAII Bulls %
    aaiiBearish: 28,       // AAII Bears %
    putCallRatio: 0.72,    // CBOE Put/Call ratio (equity only)
    fearGreedIndex: 58,    // CNN Fear & Greed (0-100)
    
    // Flow indicators
    etfFlows: -1.8,        // Billions in tech ETFs (weekly)
    shortInterest: 16.5,   // % short interest in tech
    
    // Additional volatility metrics
    ltv: 0.12,             // Left Tail Volatility (crash probability)
    spotVol: 0.22,         // CBOE SPOTVOL
    
    // Risk appetite
    riskAppetite: 35,      // State Street RAI proxy (-100 to +100)
    
    snapshot: {} as Record<string, any> // Will populate with all values
  }
}

async function computeValuationStress(data: Awaited<ReturnType<typeof fetchMarketIndicators>>): Promise<number> {
  let score = 0
  
  // Buffett Indicator (Stock Market Cap / GDP)
  // Normal: 80-120%, Warning: 120-160%, Extreme: >160%
  if (data.buffettIndicator > 200) score += 40
  else if (data.buffettIndicator > 160) score += 30
  else if (data.buffettIndicator > 120) score += 20
  else if (data.buffettIndicator < 80) score -= 10
  
  // S&P 500 P/E Ratio
  // Historical median ~16, current elevated
  const peDeviation = (data.spxPE - 16) / 16
  score += Math.min(30, peDeviation * 50)
  
  // Price-to-Sales
  // Elevated P/S indicates stretched valuations
  if (data.spxPS > 3.0) score += 15
  else if (data.spxPS > 2.5) score += 10
  
  data.snapshot.buffettIndicator = data.buffettIndicator
  data.snapshot.spxPE = data.spxPE
  data.snapshot.spxPS = data.spxPS
  
  return Math.min(100, Math.max(0, score))
}

async function computeTechnicalFragility(data: Awaited<ReturnType<typeof fetchMarketIndicators>>): Promise<number> {
  let score = 0
  
  // VIX Level (volatility fear gauge)
  // Low: <15 (complacency), Normal: 15-25, Elevated: 25-35, Crisis: >35
  if (data.vix > 35) score += 35
  else if (data.vix > 25) score += 25
  else if (data.vix > 20) score += 15
  else if (data.vix < 12) score += 10 // Complacency risk
  
  // VXN (Nasdaq volatility) - tech stress
  if (data.vxn > data.vix + 5) score += 10 // Tech leading volatility
  
  // High-Low Index (market breadth)
  // Low values = narrow leadership = fragile rally
  if (data.highLowIndex < 0.3) score += 20
  else if (data.highLowIndex > 0.7) score -= 10 // Healthy breadth
  
  // Bullish Percent Index
  // >70 = overbought, <30 = oversold
  if (data.bullishPercent > 70) score += 15
  else if (data.bullishPercent < 30) score += 10 // Extreme weakness
  
  // ATR (Average True Range) - volatility expansion
  if (data.atr > 50) score += 15
  else if (data.atr > 40) score += 8
  
  // Left Tail Volatility (black swan probability priced in)
  if (data.ltv > 0.15) score += 20
  else if (data.ltv > 0.10) score += 10
  
  data.snapshot.vix = data.vix
  data.snapshot.vxn = data.vxn
  data.snapshot.highLowIndex = data.highLowIndex
  data.snapshot.bullishPercent = data.bullishPercent
  data.snapshot.atr = data.atr
  data.snapshot.ltv = data.ltv
  
  return Math.min(100, Math.max(0, score))
}

async function computeMacroLiquidityRisk(data: Awaited<ReturnType<typeof fetchMarketIndicators>>): Promise<number> {
  let score = 0
  
  // Fed Funds Rate (restrictive policy)
  if (data.fedFundsRate > 5.0) score += 25
  else if (data.fedFundsRate > 4.0) score += 15
  else if (data.fedFundsRate < 2.0) score -= 10 // Accommodative
  
  // Junk Bond Spreads (credit stress)
  // Normal: 3-5%, Stress: 5-8%, Crisis: >8%
  if (data.junkSpread > 8) score += 35
  else if (data.junkSpread > 5) score += 20
  else if (data.junkSpread > 3.5) score += 10
  
  // Yield Curve (recession indicator)
  // Inverted (<0) signals recession risk
  if (data.yieldCurve < -0.5) score += 25
  else if (data.yieldCurve < 0) score += 15
  else if (data.yieldCurve > 1.0) score -= 10 // Healthy steepness
  
  data.snapshot.fedFundsRate = data.fedFundsRate
  data.snapshot.junkSpread = data.junkSpread
  data.snapshot.yieldCurve = data.yieldCurve
  
  return Math.min(100, Math.max(0, score))
}

async function computeSentimentFeedback(data: Awaited<ReturnType<typeof fetchMarketIndicators>>): Promise<number> {
  let score = 0
  
  // AAII Investor Sentiment (contrarian indicator)
  // Extreme bulls (>50%) or extreme bears (>40%) signal turning points
  if (data.aaiiBullish > 55) score += 20 // Euphoria warning
  else if (data.aaiiBullish < 25) score += 15 // Extreme fear
  
  if (data.aaiiBearish > 40) score += 15 // Excessive pessimism (contrarian bullish)
  else if (data.aaiiBearish < 20) score += 10 // Complacency
  
  // Put/Call Ratio (hedging activity)
  // Low ratio (<0.7) = complacency, High ratio (>1.2) = fear
  if (data.putCallRatio < 0.6) score += 20 // Extreme complacency
  else if (data.putCallRatio < 0.8) score += 10
  else if (data.putCallRatio > 1.2) score += 15 // Panic
  
  // Fear & Greed Index
  // Extreme Greed (>75) or Extreme Fear (<25)
  if (data.fearGreedIndex > 75) score += 15
  else if (data.fearGreedIndex < 25) score += 10
  
  // Risk Appetite Index (institutional positioning)
  // High positive = aggressive, negative = defensive
  if (data.riskAppetite > 60) score += 15
  else if (data.riskAppetite < -30) score += 10
  
  data.snapshot.aaiiBullish = data.aaiiBullish
  data.snapshot.aaiiBearish = data.aaiiBearish
  data.snapshot.putCallRatio = data.putCallRatio
  data.snapshot.fearGreedIndex = data.fearGreedIndex
  data.snapshot.riskAppetite = data.riskAppetite
  
  return Math.min(100, Math.max(0, score))
}

async function computeCapitalFlowsPositioning(data: Awaited<ReturnType<typeof fetchMarketIndicators>>): Promise<number> {
  let score = 0
  
  // ETF Flows (capital allocation trends)
  // Large outflows signal distribution
  if (data.etfFlows < -5) score += 30
  else if (data.etfFlows < -2) score += 20
  else if (data.etfFlows < 0) score += 10
  
  // Short Interest (positioning)
  // Very low short interest = complacency
  if (data.shortInterest < 15) score += 15
  else if (data.shortInterest > 25) score += 10 // Crowded shorts
  
  // Put/Call Ratio (already in sentiment, but affects positioning too)
  if (data.putCallRatio < 0.7) score += 15 // Under-hedged
  
  data.snapshot.etfFlows = data.etfFlows
  data.snapshot.shortInterest = data.shortInterest
  
  return Math.min(100, Math.max(0, score))
}

async function computeStructuralAltData(data: Awaited<ReturnType<typeof fetchMarketIndicators>>): Promise<number> {
  // AI-specific structural indicators
  // This remains custom for AI sector analysis
  
  const capexGrowth = 40
  const revenueGrowth = 15
  const gpuPremium = 0.2
  const jobPostingGrowth = -5
  
  let score = 25
  const growthGap = capexGrowth - revenueGrowth
  if (growthGap > 20) score += 30
  score += gpuPremium * 100
  if (jobPostingGrowth < 0) score += 20
  
  return Math.min(100, score)
}

function computeCertaintyScore(
  pillars: Record<string, number>,
  data: Awaited<ReturnType<typeof fetchMarketIndicators>>
): number {
  const values = Object.values(pillars)
  const mean = values.reduce((a, b) => a + b) / values.length
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  
  const alignment = Math.max(0, 100 - stdDev * 2)
  
  // Cross-validate: VIX should align with other stress metrics
  const vixImpliedStress = (data.vix / 40) * 100 // VIX as % of extreme level
  const pillarMeanStress = mean
  const crossValidation = 100 - Math.abs(vixImpliedStress - pillarMeanStress)
  
  const extremeCount = values.filter(v => v > 70 || v < 30).length
  const clusterBonus = (extremeCount / values.length) * 20
  
  return Math.min(100, Math.round((alignment * 0.6) + (crossValidation * 0.2) + (clusterBonus * 0.2)))
}

function getTopCanaries(
  pillars: Record<string, number>,
  data: Awaited<ReturnType<typeof fetchMarketIndicators>>
): Array<{
  signal: string
  pillar: string
  severity: "high" | "medium" | "low"
}> {
  const canaries = []
  
  
  // ===== PILLAR 1: VALUATION STRESS INDICATORS =====
  
  // Buffett Indicator warning - measures total stock market value vs GDP
  if (data.buffettIndicator > 120) {
    canaries.push({
      signal: `Buffett Indicator at ${data.buffettIndicator}% - total stock market cap is ${((data.buffettIndicator / 100) - 1).toFixed(0)}x larger than the entire US economy (GDP). Safe zone is 80-120%. At current levels, Warren Buffett's favorite valuation metric signals stocks are overpriced and vulnerable to correction.`,
      pillar: "Valuation Stress",
      severity: data.buffettIndicator > 160 ? "high" as const : "medium" as const
    })
  }
  
  // S&P 500 Forward P/E - compares stock prices to expected earnings
  const peMedian = 16
  const peDeviation = ((data.spxPE - peMedian) / peMedian) * 100
  if (data.spxPE > peMedian * 1.15) { // 15% above historical median
    canaries.push({
      signal: `S&P 500 Forward P/E at ${data.spxPE.toFixed(1)}x - investors are paying ${peDeviation.toFixed(0)}% more for each dollar of future earnings than the historical average of ${peMedian}x. This means stocks are expensive relative to their profit potential, making them vulnerable if earnings disappoint.`,
      pillar: "Valuation Stress",
      severity: data.spxPE > 25 ? "high" as const : "medium" as const
    })
  }
  
  // Price-to-Sales ratio - how much investors pay per dollar of revenue
  if (data.spxPS > 2.3) {
    const psNormal = 2.0
    const psDeviation = ((data.spxPS - psNormal) / psNormal * 100)
    canaries.push({
      signal: `S&P 500 Price-to-Sales at ${data.spxPS.toFixed(2)}x - market is valuing each dollar of company revenue at $${data.spxPS.toFixed(2)}, which is ${psDeviation.toFixed(0)}% above normal levels (~$2.00). Elevated P/S ratios signal stretched valuations where investors may be overpaying for growth, vulnerable to revenue miss.`,
      pillar: "Valuation Stress",
      severity: data.spxPS > 2.8 ? "high" as const : "medium" as const
    })
  }
  
  // ===== PILLAR 2: TECHNICAL FRAGILITY INDICATORS =====
  
  // VIX (Volatility Index) - the "fear gauge"
  if (data.vix > 20) {
    canaries.push({
      signal: `VIX at ${data.vix.toFixed(1)} - the market's "fear gauge" is ${((data.vix / 15) * 100 - 100).toFixed(0)}% above normal levels (baseline ~15). Options traders are pricing in larger-than-normal daily swings. Expect higher options premiums and increased portfolio volatility.`,
      pillar: "Technical Fragility",
      severity: data.vix > 30 ? "high" as const : "medium" as const
    })
  }
  
  // VXN (Nasdaq Volatility) - tech sector stress indicator
  if (data.vxn > data.vix + 3) {
    canaries.push({
      signal: `VXN at ${data.vxn.toFixed(1)} vs VIX ${data.vix.toFixed(1)} - Nasdaq volatility is ${(data.vxn - data.vix).toFixed(1)} points higher than broad market volatility. Tech stocks are showing elevated stress and fear, often a precursor to sector rotation or tech selloff.`,
      pillar: "Technical Fragility",
      severity: data.vxn > data.vix + 5 ? "high" as const : "medium" as const
    })
  }
  
  // High-Low Index (Market Breadth)
  if (data.highLowIndex < 0.40) {
    canaries.push({
      signal: `High-Low Index at ${(data.highLowIndex * 100).toFixed(0)}% - only ${(data.highLowIndex * 100).toFixed(0)}% of stocks are participating in the market rally (healthy breadth = >50%). A narrow rally led by a few mega-cap stocks creates a fragile foundation where index gains mask underlying weakness.`,
      pillar: "Technical Fragility",
      severity: data.highLowIndex < 0.30 ? "high" as const : "medium" as const
    })
  }
  
  // Bullish Percent Index - measures overbought/oversold conditions
  if (data.bullishPercent > 65) {
    canaries.push({
      signal: `Bullish Percent Index at ${data.bullishPercent}% - ${data.bullishPercent}% of stocks are on point-and-figure buy signals (normal range: 30-70%). Above 70% signals an overbought market where most stocks have already made their move, leaving limited upside and high reversal risk.`,
      pillar: "Technical Fragility",
      severity: data.bullishPercent > 70 ? "high" as const : "medium" as const
    })
  }
  
  // Left Tail Volatility (Crash Probability)
  if (data.ltv > 0.08) {
    canaries.push({
      signal: `Left Tail Volatility at ${(data.ltv * 100).toFixed(1)}% - options market is pricing in ${(data.ltv * 100).toFixed(1)}% probability of a sharp downside crash move. Put options are unusually expensive as institutional traders hedge against tail risk. This elevated crash insurance cost often precedes volatility events.`,
      pillar: "Technical Fragility",
      severity: data.ltv > 0.12 ? "high" as const : "medium" as const
    })
  }
  
  // ATR (Average True Range) - volatility expansion indicator
  if (data.atr > 38) {
    canaries.push({
      signal: `ATR (14-day) at ${data.atr.toFixed(1)} - daily trading range has expanded ${((data.atr / 30) * 100 - 100).toFixed(0)}% above normal (baseline ~30). Wider daily swings mean more intraday volatility, making option premiums expensive and requiring wider stop losses for swing trades.`,
      pillar: "Technical Fragility",
      severity: data.atr > 45 ? "high" as const : "medium" as const
    })
  }
  
  // ===== PILLAR 3: MACRO & LIQUIDITY RISK INDICATORS =====
  
  // Fed Funds Rate - restrictive monetary policy
  if (data.fedFundsRate > 4.25) {
    canaries.push({
      signal: `Fed Funds Rate at ${data.fedFundsRate.toFixed(2)}% - the Federal Reserve is maintaining restrictive policy with rates at ${data.fedFundsRate.toFixed(1)}%, making borrowing expensive for companies and consumers. High rates typically pressure valuations, especially for growth stocks that depend on cheap capital.`,
      pillar: "Macro & Liquidity Risk",
      severity: data.fedFundsRate > 5.0 ? "high" as const : "medium" as const
    })
  }
  
  // Junk Bond Spreads - credit market stress indicator
  if (data.junkSpread > 3.5) {
    canaries.push({
      signal: `High-Yield Spread at ${data.junkSpread.toFixed(1)}% - risky corporate bonds now yield ${data.junkSpread.toFixed(1)}% more than safe Treasury bonds (normal: 3-5%). Widening spreads mean bond investors see rising default risk and are demanding higher compensation. Credit stress often leads stock market weakness.`,
      pillar: "Macro & Liquidity Risk",
      severity: data.junkSpread > 5.0 ? "high" as const : "medium" as const
    })
  }
  
  // Yield Curve (10Y-2Y spread) - recession indicator
  if (data.yieldCurve < 0) {
    const inversionMonths = Math.abs(data.yieldCurve * 100)
    canaries.push({
      signal: `Yield Curve Inverted at ${(data.yieldCurve * 100).toFixed(0)} basis points - 10-year Treasury yields are ${inversionMonths.toFixed(0)}bp below 2-year yields. An inverted curve has preceded every recession in the past 50 years, typically by 6-18 months. Bond market is pricing in economic slowdown ahead.`,
      pillar: "Macro & Liquidity Risk",
      severity: data.yieldCurve < -0.3 ? "high" as const : "medium" as const
    })
  }
  
  // ===== PILLAR 4: SENTIMENT & MEDIA FEEDBACK INDICATORS =====
  
  // AAII Bullish Sentiment - retail investor optimism
  if (data.aaiiBullish > 45) {
    canaries.push({
      signal: `AAII Bullish Sentiment at ${data.aaiiBullish}% - ${data.aaiiBullish}% of retail investors surveyed are bullish (historical average ~38%). Extreme optimism above 50% often marks market tops as sentiment becomes overly enthusiastic with "everyone already in" and no new buyers to push prices higher.`,
      pillar: "Sentiment & Media Feedback",
      severity: data.aaiiBullish > 52 ? "high" as const : "medium" as const
    })
  }
  
  // AAII Bearish Sentiment - excessive pessimism (contrarian bullish)
  if (data.aaiiBearish > 35) {
    canaries.push({
      signal: `AAII Bearish Sentiment at ${data.aaiiBearish}% - ${data.aaiiBearish}% of retail investors are bearish (historical average ~30%). While this seems negative, extreme bearishness can be contrarian bullish as it means sentiment is overly pessimistic and poised to reverse when conditions improve.`,
      pillar: "Sentiment & Media Feedback",
      severity: data.aaiiBearish > 40 ? "medium" as const : "low" as const
    })
  }
  
  // Put/Call Ratio - hedging and complacency indicator
  if (data.putCallRatio < 0.75 || data.putCallRatio > 1.1) {
    const isComplacent = data.putCallRatio < 0.75
    if (isComplacent) {
      canaries.push({
        signal: `Put/Call Ratio at ${data.putCallRatio.toFixed(2)} - for every protective put bought, ${(1/data.putCallRatio).toFixed(1)} bullish calls are traded. This extreme ratio shows dangerous complacency where traders are under-hedged. Market is vulnerable to sudden reversals when optimism is this high.`,
        pillar: "Sentiment & Media Feedback",
        severity: data.putCallRatio < 0.65 ? "high" as const : "medium" as const
      })
    } else {
      canaries.push({
        signal: `Put/Call Ratio at ${data.putCallRatio.toFixed(2)} - heavy put buying relative to calls (normal ~0.7-1.0) signals defensive positioning and potential panic. While high put/call can mark bottoms, it also shows traders are hedging aggressively against downside.`,
        pillar: "Sentiment & Media Feedback",
        severity: "medium" as const
      })
    }
  }
  
  // Fear & Greed Index - composite sentiment measure
  if (data.fearGreedIndex > 70 || data.fearGreedIndex < 30) {
    const isGreedy = data.fearGreedIndex > 70
    if (isGreedy) {
      canaries.push({
        signal: `Fear & Greed Index at ${data.fearGreedIndex} - market sentiment is in "Extreme Greed" territory (>75). This composite of 7 indicators shows investors are overly optimistic and risk-seeking, historically associated with market tops and near-term pullbacks.`,
        pillar: "Sentiment & Media Feedback",
        severity: "high" as const
      })
    } else {
      canaries.push({
        signal: `Fear & Greed Index at ${data.fearGreedIndex} - market sentiment shows "Extreme Fear" (<25). While concerning, extreme fear can mark bottoms as pessimism becomes overdone and creates buying opportunities for contrarian traders.`,
        pillar: "Sentiment & Media Feedback",
        severity: "medium" as const
      })
    }
  }
  
  // Risk Appetite Index - institutional positioning
  if (data.riskAppetite > 50 || data.riskAppetite < -20) {
    const isAggressive = data.riskAppetite > 50
    if (isAggressive) {
      canaries.push({
        signal: `Risk Appetite Index at ${data.riskAppetite} - institutional investors are positioned very aggressively (>50 on -100 to +100 scale). High institutional risk-taking often occurs late in bull markets when smart money may be setting up to reduce exposure.`,
        pillar: "Sentiment & Media Feedback",
        severity: "medium" as const
      })
    } else {
      canaries.push({
        signal: `Risk Appetite Index at ${data.riskAppetite} - institutional money is defensively positioned (negative reading). Professional traders are reducing risk exposure, which can signal they see trouble ahead or are protecting gains.`,
        pillar: "Sentiment & Media Feedback",
        severity: "medium" as const
      })
    }
  }
  
  // ===== PILLAR 5: CAPITAL FLOWS & POSITIONING INDICATORS =====
  
  // Tech ETF Flows - institutional money movement
  if (data.etfFlows < -1.0) {
    canaries.push({
      signal: `Tech ETF Outflows at $${Math.abs(data.etfFlows).toFixed(1)}B weekly - institutional money is exiting technology sector via ETFs at a rate of $${Math.abs(data.etfFlows).toFixed(1)} billion per week. Large sustained outflows often precede sector corrections as smart money reduces exposure before retail investors.`,
      pillar: "Capital Flows & Positioning",
      severity: data.etfFlows < -3.0 ? "high" as const : "medium" as const
    })
  } else if (data.etfFlows > 3.0) {
    canaries.push({
      signal: `Tech ETF Inflows at $${data.etfFlows.toFixed(1)}B weekly - massive institutional buying into tech sector ($${data.etfFlows.toFixed(1)}B/week). While bullish short-term, extremely large inflows can signal FOMO and late-stage buying that exhausts buying power.`,
      pillar: "Capital Flows & Positioning",
      severity: "medium" as const
    })
  }
  
  // Short Interest - positioning and squeeze potential
  if (data.shortInterest < 15) {
    canaries.push({
      signal: `Short Interest at ${data.shortInterest.toFixed(1)}% - only ${data.shortInterest.toFixed(1)}% of shares are sold short, well below historical average (18-22%). Very low short interest shows complacency with few traders positioned for downside, reducing potential for short-squeeze rallies and leaving market vulnerable to selling.`,
      pillar: "Capital Flows & Positioning",
      severity: "medium" as const
    })
  } else if (data.shortInterest > 24) {
    canaries.push({
      signal: `Short Interest at ${data.shortInterest.toFixed(1)}% - heavy short positioning (>${data.shortInterest.toFixed(1)}% of shares). High shorts can fuel explosive rallies if shorts are forced to cover, but also signals many professional traders see downside ahead.`,
      pillar: "Capital Flows & Positioning",
      severity: "medium" as const
    })
  }
  
  // ===== PILLAR 6: STRUCTURAL INDICATORS (AI-SPECIFIC) =====
  
  // Note: These use hardcoded values since they're alt data, but we check them
  const capexGrowth = 40
  const revenueGrowth = 15
  const gpuPremium = 0.2
  const jobPostingGrowth = -5
  
  const capexRevenueGap = capexGrowth - revenueGrowth
  if (capexRevenueGap > 20) {
    canaries.push({
      signal: `AI CapEx growing ${capexGrowth}% while revenue grows ${revenueGrowth}% - companies are investing ${capexRevenueGap}% faster in AI infrastructure than they're generating revenue from it. This ${capexRevenueGap}-point gap signals potential overinvestment bubble where spending outpaces actual profitable use cases.`,
      pillar: "Structural",
      severity: "high" as const
    })
  }
  
  if (gpuPremium > 0.15) {
    canaries.push({
      signal: `GPU Pricing Premium at ${(gpuPremium * 100).toFixed(0)}% - AI chips trading ${(gpuPremium * 100).toFixed(0)}% above normal pricing due to supply constraints. Elevated premiums signal overheated demand that may not be sustainable, creating risk if demand cools or supply catches up.`,
      pillar: "Structural",
      severity: "medium" as const
    })
  }
  
  if (jobPostingGrowth < -3) {
    canaries.push({
      signal: `AI Job Postings declining ${Math.abs(jobPostingGrowth)}% - hiring demand for AI roles is falling ${Math.abs(jobPostingGrowth)}% year-over-year. Declining job postings can signal companies are pulling back on AI initiatives, potentially indicating the hype cycle is cooling.`,
      pillar: "Structural",
      severity: "medium" as const
    })
  }
  
  return canaries
    .sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 }
      return severityOrder[b.severity] - severityOrder[a.severity]
    })
}

function determineRegime(ccpi: number): {
  level: number
  name: string
  color: string
  description: string
} {
  if (ccpi >= 80) {
    return {
      level: 5,
      name: "Crash Watch",
      color: "red",
      description: "Extreme risk across multiple pillars. Correction or crash increasingly likely."
    }
  } else if (ccpi >= 60) {
    return {
      level: 4,
      name: "High Alert",
      color: "orange",
      description: "Elevated risk signals. Multiple warning indicators flashing."
    }
  } else if (ccpi >= 40) {
    return {
      level: 3,
      name: "Elevated Risk",
      color: "yellow",
      description: "Caution warranted. Some metrics extended, defensive moves prudent."
    }
  } else if (ccpi >= 20) {
    return {
      level: 2,
      name: "Normal",
      color: "lightgreen",
      description: "Market conditions normal but watchful. No major red flags."
    }
  } else {
    return {
      level: 1,
      name: "Low Risk",
      color: "green",
      description: "Healthy market conditions. Low crash probability."
    }
  }
}

function getPlaybook(regime: ReturnType<typeof determineRegime>) {
  const playbooks = {
    1: {
      bias: "Risk-On / Bullish",
      strategies: [
        "Maintain or modestly increase exposure to AI leaders and proxies",
        "Use cash-secured puts on quality AI names (30-45 DTE, 0.30 delta)",
        "Sell covered calls above resistance on existing long positions",
        "Minimal index hedges, very small allocation to tail risk protection"
      ],
      allocation: {
        equities: "60-80% (focus on AI, tech, growth)",
        defensive: "5-10% (value sectors)",
        cash: "10-20%",
        alternatives: "5-10% (optional: small gold/BTC allocation)"
      }
    },
    2: {
      bias: "Neutral / Watchful",
      strategies: [
        "Keep core AI/tech exposure but avoid large new leverage",
        "Continue income strategies: covered calls and moderate put selling",
        "Wheel strategy on robust AI-adjacent names",
        "Initiate small diagonal call spreads to reduce cost",
        "Small amount of index puts or inverse ETF as low-cost tail hedge"
      ],
      allocation: {
        equities: "50-70% (balanced across sectors)",
        defensive: "10-20% (add some defensive sectors)",
        cash: "15-25%",
        alternatives: "5-10% (gold, BTC for diversification)"
      }
    },
    3: {
      bias: "Defensive / Cautious",
      strategies: [
        "Trim oversized AI positions, rotate capital to value sectors and cash",
        "Buy put spreads on AI-heavy indices or key names (30-90 DTE)",
        "Use collars on large long positions (long put + short call)",
        "Increase hedge notional to 20-40% of equity exposure",
        "Reduce use of leverage and margin"
      ],
      allocation: {
        equities: "40-60% (underweight AI/tech)",
        defensive: "20-30% (utilities, consumer staples)",
        cash: "20-30%",
        alternatives: "10-15% (gold, BTC, defensive commodities)"
      }
    },
    4: {
      bias: "Heavily Defensive / Short Bias",
      strategies: [
        "Substantially reduce net long AI exposure",
        "Large put spreads on AI names and indices",
        "Ratio put spreads, calendars, diagonals to capture volatility",
        "Strategic short calls or call spreads against extended rallies",
        "Hedge 50-100% of AI equity exposure notionally"
      ],
      allocation: {
        equities: "20-40% (defensive sectors only)",
        defensive: "30-40% (gold, bonds, defensive)",
        cash: "30-40%",
        alternatives: "10-20% (gold, BTC per risk tolerance)"
      }
    },
    5: {
      bias: "Maximum Defense / Crisis Mode",
      strategies: [
        "Very light or no net long AI exposure",
        "Deep OTM index puts or put spreads as tail risk",
        "Positions in volatility products via options structures",
        "Short or buy puts on most overextended AI names",
        "Focus on capital preservation and liquidity"
      ],
      allocation: {
        equities: "0-20% (only highest quality defensive)",
        defensive: "40-50% (gold, bonds, cash equivalents)",
        cash: "40-50%",
        alternatives: "5-10% (optional BTC lottery ticket)"
      }
    }
  }
  
  return playbooks[regime.level as keyof typeof playbooks]
}

function generateWeeklySummary(
  ccpi: number,
  certainty: number,
  regime: ReturnType<typeof determineRegime>,
  pillars: Record<string, number>,
  data: Awaited<ReturnType<typeof fetchMarketIndicators>>,
  canaries: Array<{ signal: string; pillar: string; severity: "high" | "medium" | "low" }>
): {
  headline: string
  bullets: string[]
} {
  const confidencePercent = certainty
  const riskPercent = ccpi
  
  const activeWarnings = canaries.filter(c => c.severity === "high" || c.severity === "medium").length
  const warningText = activeWarnings > 0 ? ` with ${activeWarnings} active warning signals` : ""
  
  let headline = ""
  if (ccpi >= 80) {
    headline = `This week, we see a ${riskPercent} percent crash risk signal${warningText} and we are ${confidencePercent} percent confident in that assessment based on professional indicators.`
  } else if (ccpi >= 60) {
    headline = `This week, we observe a ${riskPercent} percent elevated correction risk signal${warningText} and we are ${confidencePercent} percent confident in this reading from multiple sources.`
  } else if (ccpi >= 40) {
    headline = `This week, the CCPI reads ${ccpi}${warningText}, signaling moderate caution across valuation, technical, and sentiment metrics, with ${confidencePercent} percent confidence.`
  } else {
    headline = `This week, the CCPI reads ${ccpi}${warningText}, indicating relatively low crash risk based on ${confidencePercent} percent confident analysis of market indicators.`
  }
  
  const bullets = []
  
  // Specific indicator callouts
  if (data.vix > 20) {
    bullets.push(`VIX at ${data.vix} showing elevated volatility expectations and market uncertainty.`)
  }

  if (data.putCallRatio < 0.7) {
    bullets.push(`Put/Call ratio at ${data.putCallRatio} suggests investor complacency with insufficient hedging.`)
  }
  
  if (data.aaiiBullish > 50) {
    bullets.push(`AAII sentiment at ${data.aaiiBullish}% bulls indicates potential euphoria among retail investors.`)
  }
  
  if (data.highLowIndex < 0.4) {
    bullets.push(`High-Low Index at ${(data.highLowIndex * 100).toFixed(0)}% showing narrow market leadership and fragile breadth.`)
  }
  
  if (bullets.length === 0) {
    bullets.push("Most professional indicators remain within normal ranges with no extreme signals at this time.")
    bullets.push("Continue monitoring VIX, sentiment surveys, and valuation metrics for any developing stress.")
  }
  
  return { headline, bullets }
}
