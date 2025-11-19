import { NextResponse } from "next/server"

export async function GET() {
  const dataSourceStatus = {
    timestamp: new Date().toISOString(),
    summary: {
      total: 15,
      live: 8,
      aiFallback: 7,
      baseline: 0,
      failed: 0
    },
    sources: [
      {
        name: "QQQ Technicals",
        pillar: "Momentum & Technical",
        primarySource: "Twelve Data API",
        fallbackChain: ["OpenAI GPT-4o", "Anthropic Claude", "Groq Llama", "Grok xAI"],
        currentSource: "Twelve Data API",
        status: "live",
        statusLabel: "Live API Data",
        color: "green"
      },
      {
        name: "VIX Term Structure",
        pillar: "Risk Appetite & Volatility",
        primarySource: "Alpha Vantage API",
        fallbackChain: ["OpenAI GPT-4o", "Anthropic Claude", "Groq Llama", "Grok xAI"],
        currentSource: "Alpha Vantage API",
        status: "live",
        statusLabel: "Live API Data",
        color: "green"
      },
      {
        name: "FRED Macro",
        pillar: "Macro Economic",
        primarySource: "FRED API",
        fallbackChain: ["OpenAI GPT-4o", "Anthropic Claude", "Groq Llama", "Grok xAI"],
        currentSource: "FRED API",
        details: "Fed Funds, Yield Curve, M2",
        status: "live",
        statusLabel: "Live API Data",
        color: "green"
      },
      {
        name: "Fear & Greed Index",
        pillar: "Risk Appetite & Volatility",
        primarySource: "CNN API",
        fallbackChain: ["OpenAI GPT-4o", "Anthropic Claude", "Groq Llama", "Grok xAI"],
        currentSource: "CNN API",
        status: "live",
        statusLabel: "Live API Data",
        color: "green"
      },
      {
        name: "Buffett Indicator",
        pillar: "Valuation & Market Structure",
        primarySource: "Anthropic Claude (AI)",
        fallbackChain: ["Groq Llama", "Grok xAI", "Historical baseline"],
        currentSource: "Anthropic Claude",
        status: "aiFallback",
        statusLabel: "AI-Fetched Data",
        color: "yellow"
      },
      {
        name: "AAII Sentiment",
        pillar: "Risk Appetite & Volatility",
        primarySource: "ScrapingBee",
        fallbackChain: ["OpenAI GPT-4o", "Anthropic Claude", "Groq Llama", "Grok xAI"],
        currentSource: "Anthropic Claude",
        status: "aiFallback",
        statusLabel: "AI-Fetched Data",
        color: "yellow"
      },
      {
        name: "Put/Call Ratio",
        pillar: "Risk Appetite & Volatility",
        primarySource: "BarChart",
        fallbackChain: ["OpenAI GPT-4o", "Anthropic Claude", "Groq Llama", "Grok xAI"],
        currentSource: "BarChart",
        status: "live",
        statusLabel: "Live API Data",
        color: "green"
      },
      {
        name: "Short Interest",
        pillar: "Risk Appetite & Volatility",
        primarySource: "Finviz / Alpha Vantage",
        fallbackChain: ["OpenAI GPT-4o", "Anthropic Claude", "Groq Llama", "Grok xAI"],
        currentSource: "Grok xAI",
        status: "aiFallback",
        statusLabel: "AI-Fetched Data",
        color: "yellow"
      },
      {
        name: "QQQ Forward P/E",
        pillar: "Valuation & Market Structure",
        primarySource: "Apify Yahoo Finance",
        fallbackChain: ["OpenAI GPT-4o", "Anthropic Claude", "Groq Llama", "Grok xAI"],
        currentSource: "Apify Yahoo Finance",
        status: "live",
        statusLabel: "Live API Data",
        color: "green"
      },
      {
        name: "Mag7 Concentration",
        pillar: "Valuation & Market Structure",
        primarySource: "OpenAI GPT-4o (AI)",
        fallbackChain: ["Anthropic Claude", "Groq Llama", "Grok xAI"],
        currentSource: "OpenAI GPT-4o",
        status: "aiFallback",
        statusLabel: "AI-Calculated Data",
        color: "yellow"
      },
      {
        name: "Shiller CAPE",
        pillar: "Valuation & Market Structure",
        primarySource: "FRED API",
        fallbackChain: ["OpenAI GPT-4o", "Anthropic Claude", "Groq Llama", "Grok xAI"],
        currentSource: "Groq Llama",
        status: "aiFallback",
        statusLabel: "AI-Fetched Data",
        color: "yellow"
      },
      {
        name: "S&P 500 P/E",
        pillar: "Valuation & Market Structure",
        primarySource: "FMP API",
        fallbackChain: ["OpenAI GPT-4o", "Anthropic Claude", "Groq Llama", "Grok xAI"],
        currentSource: "FMP API",
        status: "live",
        statusLabel: "Live API Data",
        color: "green"
      },
      {
        name: "ISM Manufacturing PMI",
        pillar: "Macro Economic",
        primarySource: "OpenAI GPT-4o (AI)",
        fallbackChain: ["Anthropic Claude", "Groq Llama", "Grok xAI"],
        currentSource: "OpenAI GPT-4o",
        status: "aiFallback",
        statusLabel: "AI-Fetched Data",
        color: "yellow"
      },
      {
        name: "NVIDIA Momentum",
        pillar: "Momentum & Technical",
        primarySource: "Alpha Vantage",
        fallbackChain: ["OpenAI GPT-4o", "Anthropic Claude", "Groq Llama", "Grok xAI"],
        currentSource: "Alpha Vantage",
        status: "live",
        statusLabel: "Live API Data",
        color: "green"
      },
      {
        name: "SOX Semiconductor",
        pillar: "Momentum & Technical",
        primarySource: "Alpha Vantage",
        fallbackChain: ["OpenAI GPT-4o", "Anthropic Claude", "Groq Llama", "Grok xAI"],
        currentSource: "Anthropic Claude",
        status: "aiFallback",
        statusLabel: "AI-Fetched Data",
        color: "yellow"
      }
    ]
  }

  return NextResponse.json(dataSourceStatus)
}
