import { NextResponse } from "next/server"

// This API endpoint computes the CCPI score and all pillar scores
// In production, you would fetch real data from external APIs
// For now, we use realistic mock data that simulates various market conditions

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date") // Optional: for historical lookups
  
  try {
    // Simulate fetching and computing pillar scores
    // Each pillar score is 0-100
    const pillars = {
      valuation: await computeValuationStress(),
      technical: await computeTechnicalFragility(),
      macro: await computeMacroLiquidityRisk(),
      sentiment: await computeSentimentFeedback(),
      flows: await computeCapitalFlowsPositioning(),
      structural: await computeStructuralAltData()
    }
    
    // Compute CCPI as weighted average
    const weights = {
      valuation: 0.20,
      technical: 0.20,
      macro: 0.15,
      sentiment: 0.15,
      flows: 0.15,
      structural: 0.15
    }
    
    const ccpi = Math.round(
      pillars.valuation * weights.valuation +
      pillars.technical * weights.technical +
      pillars.macro * weights.macro +
      pillars.sentiment * weights.sentiment +
      pillars.flows * weights.flows +
      pillars.structural * weights.structural
    )
    
    // Compute certainty score based on pillar alignment
    const certainty = computeCertaintyScore(pillars)
    
    // Get top warning signals
    const canaries = getTopCanaries(pillars)
    
    // Determine regime and playbook
    const regime = determineRegime(ccpi)
    const playbook = getPlaybook(regime)
    
    // Generate weekly summary
    const summary = generateWeeklySummary(ccpi, certainty, regime, pillars)
    
    return NextResponse.json({
      ccpi,
      certainty,
      pillars,
      regime,
      playbook,
      summary,
      canaries,
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

// Pillar computation functions (mock data for now)
async function computeValuationStress(): Promise<number> {
  // In production: fetch P/E, P/S ratios for AI basket
  // Compare to historical averages, compute stress score
  // High multiples = high score
  
  const aiPERatio = 45 // Example: current AI basket forward P/E
  const historicalMedian = 25
  const stdevs = (aiPERatio - historicalMedian) / 10
  
  return Math.min(100, Math.max(0, 50 + stdevs * 15))
}

async function computeTechnicalFragility(): Promise<number> {
  // In production: fetch moving averages, RSI, volatility for AI names
  // Death crosses, overbought RSI, vol spikes = high score
  
  const deathCrossCount = 2 // Number of AI names with death cross
  const avgRSI = 58 // Average RSI of AI basket
  const vixLevel = 18
  
  let score = 30
  score += deathCrossCount * 15
  if (avgRSI > 70) score += 20
  if (vixLevel > 25) score += 15
  
  return Math.min(100, score)
}

async function computeMacroLiquidityRisk(): Promise<number> {
  // In production: fetch rates, credit spreads, policy signals
  // Higher rates, wider spreads, hawkish policy = high score
  
  const fedFundsRate = 4.5
  const creditSpread = 1.2 // Example spread
  const regulatoryRisk = 0.3 // 0-1 scale from sentiment
  
  let score = 20
  if (fedFundsRate > 4) score += 20
  score += creditSpread * 10
  score += regulatoryRisk * 30
  
  return Math.min(100, score)
}

async function computeSentimentFeedback(): Promise<number> {
  // In production: fetch social sentiment, news tone, influencer activity
  // Euphoria followed by cooling, or panic narratives = high score
  
  const socialSentiment = 0.6 // -1 to 1, positive is bullish
  const narrativeShift = -0.3 // Recent change in sentiment
  const viralNegativeContent = 0.4 // 0-1 scale
  
  let score = 40
  if (socialSentiment > 0.8) score += 20 // Extreme euphoria
  score += Math.abs(narrativeShift) * 50 // Rapid shifts
  score += viralNegativeContent * 40
  
  return Math.min(100, score)
}

async function computeCapitalFlowsPositioning(): Promise<number> {
  // In production: fetch ETF flows, put/call ratios, short interest
  // Overcrowded longs, low put buying = high crash risk
  
  const etfOutflows = -2.5 // Billions, negative = outflows
  const putCallRatio = 0.7 // Low = bullish positioning
  const shortInterest = 15 // Percent
  
  let score = 35
  if (etfOutflows < -1) score += 15
  if (putCallRatio < 0.8) score += 20 // Complacent
  score += (20 - shortInterest) // Low short interest = high score
  
  return Math.min(100, score)
}

async function computeStructuralAltData(): Promise<number> {
  // In production: fetch data center buildout, GPU pricing, job postings
  // Capex exceeding revenue growth, buildout saturation = high score
  
  const capexGrowth = 40 // Percent
  const revenueGrowth = 15 // Percent
  const gpuPremium = 0.2 // Price above MSRP as ratio
  const jobPostingGrowth = -5 // Percent, negative = declining
  
  let score = 25
  const growthGap = capexGrowth - revenueGrowth
  if (growthGap > 20) score += 30
  score += gpuPremium * 100 // Scarcity indicates demand
  if (jobPostingGrowth < 0) score += 20
  
  return Math.min(100, score)
}

function computeCertaintyScore(pillars: Record<string, number>): number {
  const values = Object.values(pillars)
  const mean = values.reduce((a, b) => a + b) / values.length
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  
  // High certainty when pillars are aligned (low std dev) and consistent
  const alignment = Math.max(0, 100 - stdDev * 2)
  
  // Additional certainty from extreme clustering
  const extremeCount = values.filter(v => v > 70 || v < 30).length
  const clusterBonus = (extremeCount / values.length) * 20
  
  return Math.min(100, Math.round(alignment + clusterBonus))
}

function getTopCanaries(pillars: Record<string, number>): Array<{
  signal: string
  pillar: string
  severity: "high" | "medium" | "low"
}> {
  const canaries = []
  
  if (pillars.valuation > 65) {
    canaries.push({
      signal: "AI mega cap P/E ratios 80% above 5-year median",
      pillar: "Valuation Stress",
      severity: "high" as const
    })
  }
  
  if (pillars.technical > 60) {
    canaries.push({
      signal: "3 major AI names showing death cross pattern (50-day below 200-day MA)",
      pillar: "Technical Fragility",
      severity: "high" as const
    })
  }
  
  if (pillars.macro > 50) {
    canaries.push({
      signal: "Fed funds rate holding at restrictive levels, credit spreads widening",
      pillar: "Macro & Liquidity Risk",
      severity: "medium" as const
    })
  }
  
  if (pillars.sentiment > 55) {
    canaries.push({
      signal: "AI social media engagement down 40% from peak, negative sentiment rising",
      pillar: "Sentiment & Media Feedback",
      severity: "medium" as const
    })
  }
  
  if (pillars.flows > 50) {
    canaries.push({
      signal: "Tech ETF outflows accelerating, put/call ratios remain complacent",
      pillar: "Capital Flows & Positioning",
      severity: "medium" as const
    })
  }
  
  if (pillars.structural > 60) {
    canaries.push({
      signal: "Data center capex growth exceeding AI revenue growth by 25 percentage points",
      pillar: "Structural & Alt Data",
      severity: "high" as const
    })
  }
  
  return canaries.slice(0, 5) // Top 5
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
  pillars: Record<string, number>
): {
  headline: string
  bullets: string[]
} {
  const confidencePercent = certainty
  const riskPercent = ccpi
  
  let headline = ""
  if (ccpi >= 80) {
    headline = `This week, we see a ${riskPercent} percent crash risk signal and we are ${confidencePercent} percent confident in that assessment.`
  } else if (ccpi >= 60) {
    headline = `This week, we observe a ${riskPercent} percent elevated correction risk and we are ${confidencePercent} percent confident in this reading.`
  } else if (ccpi >= 40) {
    headline = `This week, the CCPI reads ${ccpi}, signaling moderate caution, with ${confidencePercent} percent confidence.`
  } else {
    headline = `This week, the CCPI reads ${ccpi}, indicating relatively low crash risk, with ${confidencePercent} percent confidence.`
  }
  
  const bullets = []
  
  // Top valuation/technical reasons
  const topPillars = Object.entries(pillars)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  
  topPillars.forEach(([pillar, score]) => {
    if (score > 60) {
      const pillarName = pillar.charAt(0).toUpperCase() + pillar.slice(1)
      bullets.push(`${pillarName} stress elevated at ${Math.round(score)}/100, indicating concerning conditions in this area.`)
    }
  })
  
  if (bullets.length === 0) {
    bullets.push("Most indicators remain within normal ranges with no extreme signals.")
  }
  
  return { headline, bullets }
}
