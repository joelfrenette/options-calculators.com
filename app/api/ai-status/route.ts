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
      usedFor: ["Final AI fallback", "Real-time data extraction"],
      averageLatency: "3.2s"
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
