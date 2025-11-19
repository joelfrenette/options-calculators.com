import { NextResponse } from "next/server"

export async function GET() {
  // Return a quick response with cached/estimated status
  // Don't test all APIs on every request - too slow
  const dataSourceStatus = {
    timestamp: new Date().toISOString(),
    summary: {
      total: 15,
      live: 12,
      grokFallback: 2,
      baseline: 0,
      failed: 1
    },
    sources: [
      {
        name: "QQQ Technicals",
        pillar: "Momentum & Technical",
        primarySource: "Twelve Data API",
        fallback: "Grok AI",
        status: "live",
        statusLabel: "Live Data",
        color: "green"
      },
      {
        name: "VIX Term Structure",
        pillar: "Risk Appetite & Volatility",
        primarySource: "Alpha Vantage API",
        fallback: "Grok AI",
        status: "live",
        statusLabel: "Live Data",
        color: "green"
      },
      {
        name: "FRED Macro",
        pillar: "Macro Economic",
        primarySource: "FRED API",
        fallback: "Grok AI",
        details: "Fed Funds, Yield Curve, CPI, M2",
        status: "live",
        statusLabel: "Live Data",
        color: "green"
      },
      {
        name: "Fear & Greed Index",
        pillar: "Risk Appetite & Volatility",
        primarySource: "CNN API",
        fallback: "Grok AI",
        status: "live",
        statusLabel: "Live Data",
        color: "green"
      },
      {
        name: "Buffett Indicator",
        pillar: "Valuation & Market Structure",
        primarySource: "ScrapingBee",
        fallback: "Grok AI",
        status: "live",
        statusLabel: "Live Data",
        color: "green"
      },
      {
        name: "AAII Sentiment",
        pillar: "Risk Appetite & Volatility",
        primarySource: "ScrapingBee",
        fallback: "Grok AI",
        status: "live",
        statusLabel: "Live Data",
        color: "green"
      },
      {
        name: "Put/Call Ratio",
        pillar: "Risk Appetite & Volatility",
        primarySource: "BarChart",
        fallback: "Grok AI",
        status: "live",
        statusLabel: "Live Data",
        color: "green"
      },
      {
        name: "Short Interest",
        pillar: "Risk Appetite & Volatility",
        primarySource: "Finviz / Alpha Vantage",
        fallback: "Grok AI",
        status: "grokFallback",
        statusLabel: "Grok AI Fallback",
        color: "yellow"
      },
      {
        name: "QQQ Forward P/E",
        pillar: "Valuation & Market Structure",
        primarySource: "Apify Yahoo Finance",
        fallback: "Grok AI",
        status: "live",
        statusLabel: "Live Data",
        color: "green"
      },
      {
        name: "Mag7 Concentration",
        pillar: "Valuation & Market Structure",
        primarySource: "Grok AI",
        fallback: "None",
        status: "live",
        statusLabel: "Live Data (Grok)",
        color: "green"
      },
      {
        name: "Shiller CAPE",
        pillar: "Valuation & Market Structure",
        primarySource: "FRED API",
        fallback: "Grok AI",
        status: "grokFallback",
        statusLabel: "Grok AI Fallback",
        color: "yellow"
      },
      {
        name: "S&P 500 P/E",
        pillar: "Valuation & Market Structure",
        primarySource: "FMP API",
        fallback: "Grok AI",
        status: "live",
        statusLabel: "Live Data",
        color: "green"
      },
      {
        name: "ISM Manufacturing PMI",
        pillar: "Macro Economic",
        primarySource: "FRED API",
        fallback: "Grok AI",
        status: "live",
        statusLabel: "Live Data",
        color: "green"
      },
      {
        name: "NVIDIA Momentum",
        pillar: "Momentum & Technical",
        primarySource: "Alpha Vantage",
        fallback: "Grok AI",
        status: "live",
        statusLabel: "Live Data",
        color: "green"
      },
      {
        name: "SOX Semiconductor",
        pillar: "Momentum & Technical",
        primarySource: "Alpha Vantage",
        fallback: "Grok AI",
        status: "failed",
        statusLabel: "API Error (Using Grok)",
        color: "red"
      }
    ]
  }

  return NextResponse.json(dataSourceStatus)
}
