import { NextResponse } from "next/server"
import { createXai } from "@ai-sdk/xai"
import { generateText } from "ai"

const xai = createXai({
  apiKey: process.env.XAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const ccpi = body.ccpi ?? 0
    const certainty = body.certainty ?? body.confidence ?? 0
    const activeCanaries =
      body.activeCanaries ?? (body.canaries ? body.canaries.filter((c: any) => c.active).length : 0)
    const totalIndicators = body.totalIndicators ?? (body.canaries ? body.canaries.length : 0)
    const regime = body.regime ?? { name: "Unknown", description: "Unknown" }
    const pillars = body.pillars ?? { momentum: 0, riskAppetite: 0, valuation: 0, macro: 0 }

    const { text } = await generateText({
      model: xai("grok-2-latest"),
      prompt: `You are a professional financial analyst providing an executive summary for the CCPI (Comprehensive Crash & Correction Prediction Index).

## CCPI METHODOLOGY CONTEXT:
The CCPI is a proprietary market crash prediction index that aggregates 34 market indicators across 4 weighted pillars:
- **Pillar 1: Momentum & Technical (35%)** - Tracks price trends, moving averages, breadth indicators
- **Pillar 2: Risk Appetite & Volatility (30%)** - Measures VIX, put/call ratios, credit spreads, investor sentiment
- **Pillar 3: Valuation & Market Structure (15%)** - Analyzes P/E ratios, CAPE, market concentration, equity risk premium
- **Pillar 4: Macro (20%)** - Evaluates economic indicators like ISM PMI, yield curves, debt levels

The final CCPI score is calculated as: Σ(Pillar Score × Weight), ranging from 0-100 where:
- 0-19: Low Risk (markets healthy)
- 20-39: Normal (typical market conditions)
- 40-59: Caution (elevated risk, defensive positioning recommended)
- 60-79: High Alert (significant crash probability)
- 80-100: Crash Watch (imminent correction likely)

## CERTAINTY SCORE METHODOLOGY:
The ${certainty}% certainty score measures signal consistency and alignment:
- It calculates how many indicators agree directionally within each pillar
- Higher certainty = more indicators pointing in the same direction = higher confidence in the CCPI reading
- Lower certainty = mixed signals = less confidence, more uncertainty in market direction

## CURRENT MARKET DATA:
- CCPI Score: ${ccpi}/100
- Certainty Score: ${certainty}%
- Active Warning Signals: ${activeCanaries} of ${totalIndicators} indicators triggered
- Market Regime: ${regime.name} (${regime.description})
- Pillar Scores:
  * Momentum & Technical: ${pillars.momentum}/100 (Weight: 35%)
  * Risk Appetite & Volatility: ${pillars.riskAppetite}/100 (Weight: 30%)
  * Valuation & Market Structure: ${pillars.valuation}/100 (Weight: 15%)
  * Macro: ${pillars.macro}/100 (Weight: 20%)

## YOUR TASK:
Write a comprehensive 2-3 sentence executive summary that:
1. States the CCPI score and what risk zone it falls in (Low Risk/Normal/Caution/High Alert/Crash Watch)
2. Explains the ${certainty}% certainty score means ${certainty >= 70 ? "high signal agreement - strong confidence in the reading" : certainty >= 50 ? "moderate signal alignment - reasonable confidence but some mixed signals" : "low signal consistency - significant uncertainty, mixed market signals"}
3. Identifies which pillar(s) are driving the score (highest scoring pillars = most concerning)
4. Provides specific, actionable guidance for options traders based on this data

Make it professional, data-driven, and immediately actionable for sophisticated traders. Focus on what the numbers mean and what traders should DO.`,
      temperature: 0.7,
      maxTokens: 300,
      abortSignal: AbortSignal.timeout(30000),
    })

    if (!text || text.trim().length === 0) {
      throw new Error("Grok returned empty response")
    }

    return NextResponse.json({ summary: text.trim() })
  } catch (error) {
    console.error("[v0] Grok executive summary error:", error)

    const fallbackMessage = "CCPI analysis is currently being generated. The market data has been successfully loaded."

    return NextResponse.json(
      {
        summary: fallbackMessage,
        error: "AI generation temporarily unavailable",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 200 },
    )
  }
}
