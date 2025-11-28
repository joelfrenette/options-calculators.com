import { type NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

// Strategy-specific scanning prompts
const STRATEGY_PROMPTS: Record<string, string> = {
  "credit-spreads": `You are an options trading expert. Scan the current market for the best credit spread opportunities. Focus on:
- Bull put spreads on strong stocks with support
- Bear call spreads on weak stocks with resistance
- IV Rank > 40, liquid options
Return 3 high-probability setups.`,

  "iron-condors": `You are an options trading expert. Find the best iron condor setups in the current market. Focus on:
- Range-bound ETFs and indices
- High IV Rank > 50
- Stocks consolidating between clear support/resistance
Return 3 high-probability neutral setups.`,

  "calendar-spreads": `You are an options trading expert. Find optimal calendar spread opportunities. Focus on:
- Stocks with upcoming catalysts but low current IV
- Expected IV expansion scenarios
- Stable price action near a key strike
Return 3 time decay plays.`,

  butterflies: `You are an options trading expert. Find the best butterfly spread setups. Focus on:
- Stocks approaching key price levels
- Earnings plays for pinning scenarios
- Low cost, high reward potential
Return 3 precision targeting setups.`,

  collars: `You are an options trading expert. Find stocks ideal for collar strategies. Focus on:
- Quality dividend stocks with appreciated gains
- Stocks needing downside protection
- Good premium on covered calls
Return 3 portfolio protection setups.`,

  diagonals: `You are an options trading expert. Find optimal diagonal spread opportunities. Focus on:
- Stocks with moderate directional bias
- Calendar + spread combination potential
- IV differential between expirations
Return 3 directional income setups.`,

  "straddles-strangles": `You are an options trading expert. Find the best straddle/strangle opportunities. Focus on:
- Pre-earnings high IV plays (sell premium)
- Breakout setups (buy premium)
- Binary event plays
Return 3 volatility plays.`,

  "wheel-strategy": `You are an options trading expert. Find the best stocks for the wheel strategy. Focus on:
- Quality stocks you'd want to own
- Strong fundamentals, dividend payers
- Good put premium, stock near support
Return 3 income generation candidates.`,
}

export async function POST(request: NextRequest) {
  try {
    const { strategy, strategyName } = await request.json()

    const systemPrompt = STRATEGY_PROMPTS[strategy] || STRATEGY_PROMPTS["credit-spreads"]

    const userPrompt = `Based on current market conditions (late November 2025, VIX around 18-22, markets near all-time highs), provide 3 specific ${strategyName} trade setups.

For each setup, provide in this EXACT JSON format:
{
  "setups": [
    {
      "ticker": "SYMBOL",
      "setup": "Specific strikes and structure (e.g., '545/540 Put Credit Spread' or '550/545-580/585 Iron Condor')",
      "credit": "$X.XX",
      "pop": "XX%",
      "direction": "Bullish/Bearish/Neutral"
    }
  ]
}

Use realistic current prices for major ETFs and stocks:
- SPY: ~$595
- QQQ: ~$510
- IWM: ~$235
- AAPL: ~$235
- NVDA: ~$145
- MSFT: ~$430
- AMZN: ~$210
- META: ~$580
- GOOGL: ~$175
- TSLA: ~$350

Return ONLY valid JSON, no other text.`

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    const content = completion.choices[0]?.message?.content || ""

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0])
      return NextResponse.json(data)
    }

    // Fallback with default setups if parsing fails
    return NextResponse.json({
      setups: [
        { ticker: "SPY", setup: `595/590 ${strategyName}`, credit: "$2.35", pop: "72%", direction: "Neutral" },
        { ticker: "QQQ", setup: `510/505 ${strategyName}`, credit: "$2.10", pop: "70%", direction: "Neutral" },
        { ticker: "IWM", setup: `235/230 ${strategyName}`, credit: "$1.85", pop: "68%", direction: "Neutral" },
      ],
    })
  } catch (error) {
    console.error("Strategy scanner error:", error)
    return NextResponse.json({ error: "Failed to scan for setups" }, { status: 500 })
  }
}
