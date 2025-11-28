import Groq from "groq-sdk"

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { question, context } = await request.json()

    const systemPrompt = `You are an expert options trading analyst. You help traders analyze market scenarios and develop trading strategies.

Your expertise includes:
- Options strategies (spreads, iron condors, straddles, wheel strategy, etc.)
- Risk management and position sizing
- Technical and fundamental analysis
- Market sentiment and volatility analysis
- Earnings and economic event trading

Guidelines:
- Be specific and actionable in your recommendations
- Always mention risk management considerations
- Use bullet points and clear formatting
- Reference specific strategies with entry/exit criteria
- Include position sizing guidance (typically 1-3% of portfolio per trade)
- Mention key metrics to watch (IV rank, delta, theta, etc.)
- Keep responses focused and practical for retail options traders`

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    const analysis = completion.choices[0]?.message?.content || "Unable to generate analysis."

    return Response.json({ analysis })
  } catch (error) {
    console.error("Scenario analysis error:", error)
    return Response.json({ error: "Failed to analyze scenario" }, { status: 500 })
  }
}
