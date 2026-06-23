import { NextResponse } from "next/server"

export async function GET() {
  const aiProviders = [
    {
      name: "OpenAI GPT-4o",
      priority: 1,
      speed: "Fastest",
      hasKey: !!process.env.OPENAI_API_KEY,
      status: process.env.OPENAI_API_KEY ? "online" : "offline",
      endpoint: "api.openai.com",
      usedFor: ["All CCPI indicators", "Primary AI fallback"],
      averageLatency: "1.2s"
    },
    {
      name: "Anthropic Claude",
      priority: 2,
      speed: "Fast",
      hasKey: !!process.env.ANTHROPIC_API_KEY,
      status: process.env.ANTHROPIC_API_KEY ? "online" : "offline",
      endpoint: "api.anthropic.com",
      usedFor: ["Secondary AI fallback", "Market data validation"],
      averageLatency: "1.8s"
    },
    {
      name: "Groq Llama",
      priority: 3,
      speed: "Medium",
      hasKey: !!process.env.GROQ_API_KEY,
      status: process.env.GROQ_API_KEY ? "online" : "offline",
      endpoint: "api.groq.com",
      usedFor: ["Tertiary AI fallback", "High-speed inference"],
      averageLatency: "2.5s"
    },
    {
      name: "Grok xAI",
      priority: 4,
      speed: "Standard",
      hasKey: !!process.env.XAI_API_KEY || !!process.env.GROK_XAI_API_KEY,
      status: (process.env.XAI_API_KEY || process.env.GROK_XAI_API_KEY) ? "online" : "offline",
      endpoint: "api.x.ai",
      usedFor: ["Real-time data extraction", "Market data fetch"],
      averageLatency: "3.2s"
    },
    {
      name: "Google Gemini",
      priority: 5,
      speed: "Fast",
      hasKey: !!process.env.GOOGLE_AI_API_KEY || !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      status: (process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) ? "online" : "offline",
      endpoint: "generativelanguage.googleapis.com",
      usedFor: ["AI fallback chain", "CCPI summaries & chat"],
      averageLatency: "1.5s"
    },
    {
      name: "OpenRouter",
      priority: 6,
      speed: "Standard",
      hasKey: !!process.env.OPENROUTER_API_KEY,
      status: process.env.OPENROUTER_API_KEY ? "online" : "offline",
      endpoint: "openrouter.ai",
      usedFor: ["Aggregator fallback", "CCPI summaries & chat"],
      averageLatency: "2.8s"
    },
    {
      name: "Perplexity",
      priority: 7,
      speed: "Standard",
      hasKey: !!process.env.PERPLEXITY_API_KEY,
      status: process.env.PERPLEXITY_API_KEY ? "online" : "offline",
      endpoint: "api.perplexity.ai",
      usedFor: ["Search-augmented fallback"],
      averageLatency: "3.0s"
    }
  ]

  const summary = {
    total: aiProviders.length,
    online: aiProviders.filter(p => p.status === "online").length,
    offline: aiProviders.filter(p => p.status === "offline").length
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    summary,
    providers: aiProviders
  })
}
