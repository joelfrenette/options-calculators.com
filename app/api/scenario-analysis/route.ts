import { NextResponse } from "next/server"
import { generateWithFallback } from "@/lib/ai-providers"
import { isDryRun, dryRunPayload } from "@/lib/dry-run"

export async function POST(request: Request) {
  try {
    const { question, context } = await request.json()

    if (!question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 })
    }

    const systemPrompt = `You are an expert financial analyst specializing in options trading and market analysis.
    
You provide detailed, actionable scenario analysis based on market data and technical indicators.
Be specific with numbers, probabilities, and timeframes.
Format your response in clear sections with headers.`

    const userPrompt = `Based on the following market context, please analyze this scenario:

Question: ${question}

Market Context:
${context || "No additional context provided"}

Please provide:
1. **Direct Answer**: A clear, concise answer to the question
2. **Key Factors**: The most important factors influencing this scenario
3. **Probability Assessment**: Your estimated probability and confidence level
4. **Risk Considerations**: Key risks to monitor
5. **Actionable Recommendations**: Specific steps or strategies to consider`

    // P2-4. The dry run stops HERE — after routing, body parsing and the
    // `question` validation above, and before any provider is touched. That is
    // the whole point: the contract test now covers everything this route can
    // break at without spending a model call, and the health check no longer
    // has to mark it `skip` and verify nothing.
    if (isDryRun(request, { question, context })) {
      return NextResponse.json(
        dryRunPayload("/api/scenario-analysis", "generateWithFallback", systemPrompt.length + userPrompt.length),
      )
    }

    const result = await generateWithFallback({
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
      maxTokens: 2000,
    })

    return NextResponse.json({
      analysis: result.text,
      provider: result.provider,
      model: result.model,
    })
  } catch (error) {
    console.error("[AI] Scenario analysis error:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      {
        error: "Failed to generate scenario analysis",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
