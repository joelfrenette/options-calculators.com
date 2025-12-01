import { generateWithFallback } from "@/lib/ai-providers"

export async function POST(request: Request) {
  try {
    const { question, context } = await request.json()

    if (!question) {
      return Response.json({ error: "Question is required" }, { status: 400 })
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

    const result = await generateWithFallback({
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
      maxTokens: 2000,
    })

    return Response.json({
      analysis: result.text,
      provider: result.provider,
      model: result.model,
    })
  } catch (error) {
    console.error("[AI] Scenario analysis error:", error instanceof Error ? error.message : error)
    return Response.json(
      {
        error: "Failed to generate scenario analysis",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
