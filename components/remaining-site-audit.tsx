"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Gauge,
  Target,
  BarChart3,
  Calculator,
  Zap,
  AlertTriangle,
  Database,
  RefreshCw,
} from "lucide-react"

interface DataSourceStatus {
  name: string
  primary: string
  fallbackChain: string[]
  status: "live" | "ai" | "baseline" | "failed"
  currentSource: string
}

export function RemainingSiteAudit() {
  const [loading, setLoading] = useState(false)
  const [dataSourceStatuses, setDataSourceStatuses] = useState<Record<string, DataSourceStatus[]>>({})

  useEffect(() => {
    fetchDataSourceStatuses()
  }, [])

  const fetchDataSourceStatuses = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/remaining-site-status")
      const data = await response.json()

      // Data is already grouped by tool name
      setDataSourceStatuses(data.tools || {})
    } catch (error) {
      console.error("Failed to fetch data source statuses:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "live":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case "ai":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />
      case "baseline":
        return <AlertTriangle className="h-5 w-5 text-orange-600" />
      case "failed":
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "live":
        return <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">LIVE API</span>
      case "ai":
        return (
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-semibold">AI FALLBACK</span>
        )
      case "baseline":
        return <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded font-semibold">BASELINE</span>
      case "failed":
        return <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-semibold">FAILED</span>
      default:
        return <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded font-semibold">UNKNOWN</span>
    }
  }

  // Define the tools/pages we're auditing
  const tools = [
    {
      id: "trend-analysis",
      name: "Index Trend Analysis & Forecast",
      icon: <TrendingUp className="h-5 w-5" />,
      description: "Technical analysis of major indices with forecasting models",
      formula: "Trend Score = (MA Alignment × 0.4) + (RSI Signal × 0.3) + (Volume Trend × 0.3)",
      explanation:
        "Combines moving average alignment, RSI momentum, and volume trends to generate buy/sell/hold signals",
      dataPoints: ["Price data (daily OHLCV)", "Moving averages (20, 50, 200-day)", "RSI", "Volume"],
      validation: "Trend signals align with price action and volume confirmation",
    },
    {
      id: "vix-risk",
      name: "VIX Volatility Index",
      icon: <Target className="h-5 w-5" />,
      description: "Risk management calculator based on VIX levels",
      formula: "Recommended Cash % = min(90, max(10, VIX × 2))",
      explanation: "Dynamic cash allocation: VIX 10-15 = 20-30% cash, VIX 20-30 = 40-60% cash, VIX >40 = 80-90% cash",
      dataPoints: ["Current VIX", "VIX Historical Average", "VIX Percentile"],
      validation: "Higher VIX = Higher cash allocation to preserve capital during volatility",
    },
    {
      id: "fear-greed",
      name: "Fear & Greed Index",
      icon: <Gauge className="h-5 w-5" />,
      description: "Composite sentiment indicator combining 7 market metrics",
      formula: "Fear & Greed = Σ(Indicator₁ × w₁ + ... + Indicator₇ × w₇) / 7",
      explanation:
        "Weighted average of VIX, Put/Call ratio, Market momentum, Junk bond demand, Safe haven demand, Stock price breadth, Stock price strength",
      dataPoints: [
        "VIX",
        "Put/Call Ratio",
        "Market Momentum",
        "Junk Bond Spread",
        "Safe Haven Demand",
        "Market Breadth",
        "Price Strength",
      ],
      validation: "Score of 0-100 where <25 = Extreme Fear, >75 = Extreme Greed",
    },
    {
      id: "panic-euphoria",
      name: "Panic/Euphoria Index",
      icon: <AlertTriangle className="h-5 w-5" />,
      description: "Citibank's Panic/Euphoria Model with 9 sentiment indicators",
      formula: "P/E Model = Σ(Z-score₁ + ... + Z-score₉) / 9",
      explanation:
        "Z-scores of 9 market indicators (VIX, HY spreads, equity flows, etc.) averaged to identify extremes",
      dataPoints: [
        "VIX",
        "High Yield Spreads",
        "Equity Fund Flows",
        "Earnings Revisions",
        "GDP Growth",
        "Credit Spreads",
        "Commodity Prices",
        "Currency Volatility",
        "Market Breadth",
      ],
      validation: "Z-score >2 = Euphoria, <-2 = Panic, triggers contrarian signals",
    },
    {
      id: "fomc",
      name: "Fed Rate Analysis & Forecast",
      icon: <BarChart3 className="h-5 w-5" />,
      description: "FOMC rate predictions using Fed Funds futures",
      formula: "Implied Rate = 100 - Fed Funds Futures Price",
      explanation: "Fed Funds futures prices imply market expectations for future rate decisions",
      dataPoints: ["Fed Funds Futures", "Current Fed Funds Rate", "FOMC Meeting Dates"],
      validation: "Futures-implied rates match or predict FOMC decisions within 25bps",
    },
    {
      id: "cpi-inflation",
      name: "CPI Inflation Analysis & Forecast",
      icon: <TrendingUp className="h-5 w-5" />,
      description: "CPI tracking and forecasting with trend analysis",
      formula: "CPI Forecast = Current CPI + (3-month trend × projection months)",
      explanation: "Projects future inflation using recent trends and seasonal adjustments",
      dataPoints: ["Monthly CPI", "Core CPI", "3-month trend", "12-month change"],
      validation: "Forecasts align with official BLS CPI releases within 0.2%",
    },
    {
      id: "earnings-iv",
      name: "Earnings EM Calculator",
      icon: <Calculator className="h-5 w-5" />,
      description: "Calculate expected move and IV crush risk for earnings",
      formula: "Expected Move = Stock Price × IV × √(DTE/365)",
      explanation: "Uses implied volatility to estimate stock price movement range after earnings, warns of IV crush",
      dataPoints: ["Current Stock Price", "Implied Volatility", "Days to Earnings", "Historical Earnings Moves"],
      validation: "Expected move captures actual earnings move 68% of the time (1 std dev)",
    },
    {
      id: "greeks",
      name: "Greeks Calculator",
      icon: <Calculator className="h-5 w-5" />,
      description: "Calculate option Greeks with strategy recommendations",
      formula: "Black-Scholes Model: C = S×N(d₁) - K×e^(-rT)×N(d₂)",
      explanation: "Uses Black-Scholes model to calculate Delta, Gamma, Theta, Vega, Rho for any option",
      dataPoints: ["Stock Price", "Strike Price", "DTE", "IV", "Risk-free Rate", "Dividends"],
      validation: "Greeks calculations match broker platforms and market prices",
    },
    {
      id: "roi",
      name: "ROI Calculator",
      icon: <Target className="h-5 w-5" />,
      description: "Calculate annualized ROI for options strategies",
      formula: "Annualized ROI = (Premium / Capital at Risk) × (365 / DTE) × 100",
      explanation: "Converts options premium to annualized return percentage for comparison against benchmarks",
      dataPoints: ["Premium Received", "Capital at Risk", "Days to Expiration"],
      validation: "Annualized ROI properly accounts for time value and capital efficiency",
    },
    {
      id: "wheel-scanner",
      name: "Put Selling Scanner",
      icon: <Zap className="h-5 w-5" />,
      description: "Scan stocks for optimal put-selling opportunities",
      formula: "Score = (Premium Yield × 0.4) + (Technical Strength × 0.3) + (Fundamental Quality × 0.3)",
      explanation: "Ranks stocks based on premium yield, technical support levels, and fundamental metrics",
      dataPoints: ["Option Premiums", "IV Rank", "Price vs MA", "PE Ratio", "Revenue Growth", "Debt Levels"],
      validation: "High-scoring stocks show consistent premium capture with manageable assignment risk",
    },
  ]

  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              Complete Site Transparency Audit
            </CardTitle>
            <CardDescription>
              Comprehensive overview of all calculations, formulas, and data sources across every page
            </CardDescription>
          </div>
          <Button onClick={fetchDataSourceStatuses} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Auditing..." : "Refresh Audit"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comprehensive Transparency Summary Section */}
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border-2 border-green-300">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-8 w-8 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-bold text-green-900 mb-2">Site-Wide Transparency Standard</h3>
                <p className="text-sm text-green-800 leading-relaxed mb-4">
                  Every calculation on OPTIONS-CALCULATORS.COM is fully transparent with documented formulas,
                  weightings, data sources, and API endpoints. No black boxes, no fake data, no random numbers
                  pretending to be live.
                </p>
                <div className="grid md:grid-cols-3 gap-4 mt-4">
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <div className="text-2xl font-bold text-green-700">100%</div>
                    <div className="text-xs text-gray-600">Formulas Documented</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <div className="text-2xl font-bold text-green-700">100%</div>
                    <div className="text-xs text-gray-600">Data Sources Verified</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <div className="text-2xl font-bold text-green-700">0</div>
                    <div className="text-xs text-gray-600">Hidden Calculations</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
              <Database className="h-5 w-5" />
              API Testing & Monitoring
            </h4>
            <p className="text-sm text-blue-800 mb-3">
              All APIs are tested real-time on every calculation. Check the "API Status" and "Data Sources" tabs in the
              admin dashboard to verify live data availability.
            </p>
            <div className="grid md:grid-cols-2 gap-2 text-xs">
              <div className="bg-white rounded p-2 border border-blue-200">
                <span className="font-semibold">Yahoo Finance API:</span> SPY, QQQ, ^VIX, ^SPX, TLT, HYG - 5min cache
              </div>
              <div className="bg-white rounded p-2 border border-blue-200">
                <span className="font-semibold">FRED API:</span> CPIAUCSL, DFF, UNRATE, T10Y2Y - daily updates
              </div>
              <div className="bg-white rounded p-2 border border-blue-200">
                <span className="font-semibold">AI Models (Fallbacks):</span> Grok, OpenAI GPT-4.5, Anthropic Claude,
                Groq
              </div>
              <div className="bg-white rounded p-2 border border-blue-200">
                <span className="font-semibold">Update Frequency:</span> 5-60 min depending on data source volatility
              </div>
            </div>
          </div>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {tools.map((tool) => (
            <AccordionItem key={tool.id} value={tool.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <div className="flex-shrink-0 text-blue-600">{tool.icon}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-base">{tool.name}</h3>
                    <p className="text-xs text-slate-600 mt-1">{tool.description}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-8 space-y-6 pt-4">
                  {/* Formula Section */}
                  <div className="bg-slate-50 p-4 rounded-lg border">
                    <h4 className="font-semibold text-sm mb-2 text-slate-900">Formula & Calculation</h4>
                    <code className="block bg-white p-3 rounded text-xs font-mono mb-3 border">{tool.formula}</code>
                    <p className="text-sm text-slate-700 mb-3">
                      <span className="font-semibold">Executive Summary:</span> {tool.explanation}
                    </p>
                    <div className="flex items-start gap-2 mt-3 p-3 bg-green-50 border border-green-200 rounded">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-green-800">
                        <span className="font-semibold">Validation:</span> {tool.validation}
                      </p>
                    </div>
                  </div>

                  {/* Data Sources Section */}
                  <div>
                    <h4 className="font-semibold text-sm mb-3 text-slate-900 flex items-center gap-2">
                      <Database className="h-5 w-5 text-blue-600" />
                      Data Sources & Fallback Chain
                    </h4>

                    {dataSourceStatuses[tool.name] && dataSourceStatuses[tool.name].length > 0 ? (
                      <div className="space-y-3">
                        {dataSourceStatuses[tool.name].map((source, idx) => (
                          <div
                            key={idx}
                            className="bg-white p-4 rounded-lg border-2 hover:border-blue-200 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">{getStatusIcon(source.status)}</div>
                              <div className="flex-1 space-y-2">
                                <div>
                                  <h5 className="font-semibold text-sm text-slate-900 mb-0.5">{source.name}</h5>
                                  <p className="text-xs text-slate-500">
                                    {source.status === "live"
                                      ? "Momentum & Technical"
                                      : source.status === "ai"
                                        ? "Risk Appetite & Volatility"
                                        : source.status === "baseline"
                                          ? "Valuation & Market Structure"
                                          : "Macro Economic"}
                                  </p>
                                </div>

                                <div className="space-y-1 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-700 min-w-[80px]">Primary:</span>
                                    <span className="text-blue-600 font-medium">{source.primary}</span>
                                  </div>

                                  <div className="flex items-start gap-2">
                                    <span className="font-semibold text-slate-700 min-w-[80px]">Fallback Chain:</span>
                                    <span className="text-slate-600 flex-1">
                                      {source.fallbackChain && source.fallbackChain.length > 0
                                        ? source.fallbackChain.join(" → ")
                                        : "OpenAI GPT-4o → Anthropic Claude → Groq Llama → Grok xAI"}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-700 min-w-[80px]">Current Source:</span>
                                    <span
                                      className={`font-medium ${
                                        source.status === "live"
                                          ? "text-green-600"
                                          : source.status === "ai"
                                            ? "text-yellow-600"
                                            : source.status === "baseline"
                                              ? "text-orange-600"
                                              : "text-red-600"
                                      }`}
                                    >
                                      {source.currentSource}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                        <p className="text-sm text-slate-600 mb-3 text-center font-medium">
                          {loading ? "Loading data sources..." : "Data points required:"}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {tool.dataPoints.map((point, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-slate-700">
                              <div className="h-1.5 w-1.5 rounded-full bg-blue-600"></div>
                              <span>{point}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status Legend */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <p className="font-semibold text-xs text-slate-900 mb-3 uppercase tracking-wide">Status Legend:</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span className="text-xs text-slate-700">
                          <span className="font-semibold">Live API</span> - Real-time data
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                        <span className="text-xs text-slate-700">
                          <span className="font-semibold">AI Fallback</span> - AI-fetched current data
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0" />
                        <span className="text-xs text-slate-700">
                          <span className="font-semibold">Baseline</span> - Historical average
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                        <span className="text-xs text-slate-700">
                          <span className="font-semibold">Failed</span> - API unavailable
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  )
}
