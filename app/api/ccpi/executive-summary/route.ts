import { NextResponse } from "next/server"
import { createXai } from "@ai-sdk/xai"
import { generateText } from "ai"

const xai = createXai({
  apiKey: process.env.XAI_API_KEY
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { ccpi, certainty, activeCanaries, totalIndicators, regime, pillars } = body
    
    const { text } = await generateText({
      model: xai('grok-2-latest'),
      prompt: `You are a professional financial analyst providing executive summaries for the CCPI (Crash & Correction Prediction Index).

Given the following market data:
- CCPI Score: ${ccpi}/100 (0 = No risk, 100 = Imminent crash)
- Certainty Score: ${certainty}%
- Active Warning Signals: ${activeCanaries} of ${totalIndicators} indicators triggered
- Market Regime: ${regime.name} (${regime.description})
- Pillar Scores:
  * Momentum & Technical: ${pillars.momentum}/100
  * Risk Appetite & Volatility: ${pillars.riskAppetite}/100
  * Valuation: ${pillars.valuation}/100
  * Macro: ${pillars.macro}/100

Write a single, comprehensive sentence (maximum 50 words) that:
1. States the CCPI crash prediction score
2. Mentions the certainty level
3. Briefly explains the key active warning signals driving the score
4. Provides actionable context for options traders

Make it concise, professional, and immediately actionable. Do NOT use bullet points, headers, or multiple sentences. Return ONLY the single executive summary sentence.`,
      temperature: 0.7,
      maxTokens: 150
    })
    
    return NextResponse.json({ summary: text.trim() })
  } catch (error) {
    console.error("[v0] Grok executive summary error:", error)
    return NextResponse.json(
      { error: "Failed to generate executive summary", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
