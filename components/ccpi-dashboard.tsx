"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, TrendingDown, Activity, DollarSign, Users, Database, RefreshCw, Download, Settings, Layers, Info } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface CCPIData {
  ccpi: number
  baseCCPI?: number
  crashAmplifiers?: Array<{ reason: string; points: number }>
  totalBonus?: number
  certainty: number
  pillars: {
    momentum: number        // NEW: Pillar 1 - Momentum & Technical (40%)
    riskAppetite: number   // NEW: Pillar 2 - Risk Appetite (30%)
    valuation: number      // NEW: Pillar 3 - Valuation (20%)
    macro: number          // Pillar 4 - Macro (10%)
  }
  regime: {
    level: number
    name: string
    color: string
    description: string
  }
  playbook: {
    bias: string
    strategies: string[]
    allocation: Record<string, string>
  }
  summary: {
    headline: string
    bullets: string[]
  }
  canaries: Array<{
    signal: string
    pillar: string
    severity: "high" | "medium" | "low"
  }>
  indicators?: Record<string, any>
  apiStatus?: Record<string, { live: boolean; source: string }> // Updated for clarity
  timestamp: string
}

interface HistoricalData {
  history: Array<{
    date: string
    ccpi: number
    certainty: number
  }>
}

export function CcpiDashboard() {
  const [data, setData] = useState<CCPIData | null>(null)
  const [history, setHistory] = useState<HistoricalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [executiveSummary, setExecutiveSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const getReadableColor = (colorName: string): string => {
    const colorMap: Record<string, string> = {
      'green': '#16a34a',      // Green for low risk
      'lime': '#65a30d',       // Lime for normal
      'yellow': '#f97316',     // Orange instead of yellow for better readability
      'orange': '#f97316',     // Orange for caution
      'red': '#dc2626'         // Red for high alert/crash watch
    }
    return colorMap[colorName] || '#6b7280' // Default to gray if color not found
  }

  const getBarColor = (percentage: number): string => {
    if (percentage <= 33) return '#22c55e' // green-500
    if (percentage <= 66) return '#eab308' // yellow-500
    return '#ef4444' // red-500
  }

  const getStatusBadge = (live: boolean, source: string) => {
    if (live) {
      return <Badge className="ml-2 bg-green-500 text-white text-xs flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-white"></span>
        Live
      </Badge>
    } else if (source.includes('baseline') || source.includes('fallback') || source.includes('historical')) {
      return <Badge className="ml-2 bg-amber-500 text-white text-xs flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-white"></span>
        Baseline
      </Badge>
    } else {
      return <Badge className="ml-2 bg-red-500 text-white text-xs flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-white"></span>
        Failed
      </Badge>
    }
  }

  useEffect(() => {
    fetchData()
    fetchHistory()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/ccpi")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      
      console.log("[v0] CCPI Data Loaded:", {
        ccpi: result.ccpi,
        certainty: result.certainty,
        regime: result.regime.name,
        pillars: result.pillars,
        activeCanaries: result.canaries.filter((c: any) => c.severity === 'high' || c.severity === 'medium').length,
        totalIndicators: 25 // Adjusted from 23 to 25 as per update
      })
      console.log("[v0] Pillar Breakdown (weighted contribution to CCPI):")
      console.log("  Momentum:", result.pillars.momentum, "× 40% =", (result.pillars.momentum * 0.40).toFixed(1))
      console.log("  Risk Appetite:", result.pillars.riskAppetite, "× 30% =", (result.pillars.riskAppetite * 0.30).toFixed(1))
      console.log("  Valuation:", result.pillars.valuation, "× 20% =", (result.pillars.valuation * 0.20).toFixed(1))
      console.log("  Macro:", result.pillars.macro, "× 10% =", (result.pillars.macro * 0.10).toFixed(1))

      const calculatedCCPI = 
        result.pillars.momentum * 0.40 +
        result.pillars.riskAppetite * 0.30 +
        result.pillars.valuation * 0.20 +
        result.pillars.macro * 0.10
      console.log("  Calculated CCPI:", calculatedCCPI.toFixed(1), "| API CCPI:", result.ccpi)
      
      setData(result)
      
      await fetchExecutiveSummary(result)
    } catch (error) {
      console.error("[v0] CCPI API error:", error)
      setError(error instanceof Error ? error.message : "Failed to load CCPI data")
    } finally {
      setLoading(false)
    }
  }

  const fetchExecutiveSummary = async (ccpiData: CCPIData) => {
    try {
      setSummaryLoading(true)
      const response = await fetch("/api/ccpi/executive-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ccpi: ccpiData.ccpi,
          certainty: ccpiData.certainty,
          activeCanaries: ccpiData.canaries.filter(c => c.severity === 'high' || c.severity === 'medium').length,
          totalIndicators: 25, // Adjusted from 23 to 25 as per update
          regime: ccpiData.regime,
          pillars: ccpiData.pillars
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        setExecutiveSummary(result.summary)
        console.log("[v0] Grok executive summary generated:", result.summary)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch executive summary:", error)
      // Silently fail - we'll show the default summary
    } finally {
      setSummaryLoading(false)
    }
  }

  const fetchHistory = async () => {
    try {
      const response = await fetch("/api/ccpi/history")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      setHistory(result)
    } catch (error) {
      console.error("[v0] Failed to fetch CCPI history:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-gray-600">Computing CCPI scores...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="outline" onClick={fetchData} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!data) {
    return null // Should not happen if loading/error handled
  }

  const getRegimeColor = (level: number) => {
    if (level >= 80) return "bg-red-600"
    if (level >= 60) return "bg-orange-500"
    if (level >= 40) return "bg-yellow-500"
    if (level >= 20) return "bg-lime-500"
    return "bg-green-600"
  }

  const getRegimeZone = (ccpi: number) => {
    if (ccpi >= 80) return { color: "red", label: "CRASH WATCH" }
    if (ccpi >= 60) return { color: "orange", label: "HIGH ALERT" }
    if (ccpi >= 40) return { color: "yellow", label: "CAUTION" }
    if (ccpi >= 20) return { color: "lightgreen", label: "NORMAL" }
    return { color: "green", label: "LOW RISK" }
  }

  const getIndicatorStatus = (value: number, thresholds: { low: number, high: number, ideal?: number }) => {
    if (thresholds.ideal !== undefined) {
      const deviation = Math.abs(value - thresholds.ideal)
      if (deviation < 5) return { color: "bg-green-500", status: "Normal" }
      if (deviation < 15) return { color: "bg-yellow-500", status: "Elevated" }
      return { color: "bg-red-500", status: "Warning" }
    }
    if (value <= thresholds.low) return { color: "bg-green-500", status: "Low Risk" }
    if (value <= thresholds.high) return { color: "bg-yellow-500", status: "Moderate" }
    return { color: "bg-red-500", status: "High Risk" }
  }

  const pillarData = [
    { name: "Pillar 1 - Momentum & Technical", value: data.pillars.momentum, weight: "40%", icon: Activity },
    { name: "Pillar 2 - Risk Appetite & Volatility", value: data.pillars.riskAppetite, weight: "30%", icon: TrendingDown },
    { name: "Pillar 3 - Valuation", value: data.pillars.valuation, weight: "20%", icon: DollarSign },
    { name: "Pillar 4 - Macro", value: data.pillars.macro, weight: "10%", icon: Users }
  ]

  const pillarChartData = pillarData.map((pillar, index) => ({
    name: `Pillar ${index + 1}`,
    fullName: pillar.name,
    value: pillar.value,
    weight: pillar.weight,
    icon: pillar.icon
  }))

  const zone = getRegimeZone(data.ccpi)
  const ccpiScore = data.ccpi

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Main CCPI Score Card */}
      <Card className="border-2 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">CCPI: Crash & Correction Prediction Index</CardTitle>
              <CardDescription>AI-led market correction early warning oracle for options traders</CardDescription>
            </div>
            <Badge variant={zone.color === "red" ? "destructive" : "secondary"} className="text-lg px-4 py-2">
              {zone.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            
            
            
            <div className="pt-16">
              <div className="relative">
                {/* Gradient bar */}
                <div className="h-16 bg-gradient-to-r from-green-600 via-[20%] via-lime-500 via-[40%] via-yellow-500 via-[60%] via-orange-500 via-[80%] via-red-500 to-[100%] to-red-700 rounded-lg shadow-inner" />
                
                {/* Zone labels */}
                <div className="absolute inset-0 flex items-center justify-between px-4 text-white text-xs font-bold">
                  <div className="text-center">
                    <div>LOW</div>
                    <div>RISK</div>
                    <div className="text-[10px]">0-19</div>
                  </div>
                  <div className="text-center">
                    <div>NORMAL</div>
                    <div className="text-[10px]">20-39</div>
                  </div>
                  <div className="text-center text-gray-800">
                    <div>CAUTION</div>
                    <div className="text-[10px]">40-59</div>
                  </div>
                  <div className="text-center">
                    <div>HIGH</div>
                    <div>ALERT</div>
                    <div className="text-[10px]">60-79</div>
                  </div>
                  <div className="text-center">
                    <div>CRASH</div>
                    <div>WATCH</div>
                    <div className="text-[10px]">80-100</div>
                  </div>
                </div>
                
                {/* Pointer indicator */}
                <div
                  className="absolute top-0 bottom-0 w-2 bg-black shadow-lg transition-all duration-500"
                  style={{ left: `calc(${ccpiScore}% - 4px)` }}
                >
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <div className="bg-black text-white px-4 py-2 rounded-lg shadow-xl text-center">
                      <div className="text-xs font-semibold">TODAY</div>
                      <div className="text-2xl font-bold">{ccpiScore}</div>
                      <div className="text-xs">{zone.label}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">CCPI Score</p>
              <p className="text-5xl font-bold mb-2" style={{ color: getReadableColor(data.regime.color) }}>
                {data.ccpi}
              </p>
              <p className="text-xs text-gray-500">0 = No risk, 100 = Imminent crash</p>
            </div>
            
            <div className="text-center p-6 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Certainty Score</p>
              <div className="flex items-center justify-center gap-2">
                <p className="text-5xl font-bold text-blue-600">{data.certainty}%</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-gray-400 hover:text-gray-600">
                        <Info className="h-5 w-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs p-3">
                      <p className="font-semibold mb-2">Certainty Calculation</p>
                      <p className="text-xs leading-relaxed">
                        Based on pillar alignment variance ({Math.round((100 - (Math.max(...Object.values(data.pillars)) - Math.min(...Object.values(data.pillars)))) / 100 * 70)}% weight) 
                        and canary agreement ({Math.round((data.canaries.filter(c => c.severity === 'high' || c.severity === 'medium').length / 15) * 30)}% weight), 
                        adjusted for historical accuracy (82% backtest).
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-gray-500">Signal consistency & alignment</p>
            </div>
            
            <div className="text-center p-6 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Current Regime</p>
              <p className="text-2xl font-bold mb-1" style={{ color: getReadableColor(data.regime.color) }}>
                {data.regime.name}
              </p>
              <p className="text-xs text-gray-600 px-2">{data.regime.description}</p>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-base text-blue-900 flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                Weekly Output - Executive Summary
              </h4>
              {summaryLoading && (
                <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
              )}
            </div>
            
            {/* AI-Generated Executive Summary */}
            {executiveSummary ? (
              <div className="mb-4 p-4 bg-white rounded-lg border border-blue-200 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                    <span className="text-white font-bold text-xs">AI</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 leading-relaxed">{executiveSummary}</p>
                    <p className="text-xs text-gray-500 mt-2 italic">Generated by Grok xAI - grok-2-latest</p>
                  </div>
                </div>
              </div>
            ) : (
              summaryLoading && (
                <div className="mb-4 p-4 bg-white rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-600 italic">Generating AI executive summary...</p>
                </div>
              )
            )}
            
            {/* Original Summary */}
            <div className="space-y-2">
              <p className="text-sm text-blue-800 font-medium">{data.summary.headline}</p>
              <ul className="space-y-1">
                {data.summary.bullets.map((bullet, i) => (
                  <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {data.totalBonus && data.totalBonus > 0 && (
        <Card className="border-2 border-red-600 bg-gradient-to-r from-red-50 to-orange-50 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="h-6 w-6 text-red-600 animate-pulse" />
              🚨 CRASH AMPLIFIERS ACTIVE +{data.totalBonus} BONUS POINTS
            </CardTitle>
            <CardDescription className="text-red-700 font-medium">
              Multiple extreme crash signals detected - CCPI boosted from {data.baseCCPI} to {data.ccpi}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.crashAmplifiers?.map((amp, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border-2 border-red-300">
                  <span className="text-sm font-semibold text-red-900">{amp.reason}</span>
                  <Badge className="bg-red-600 text-white text-base font-bold">+{amp.points}</Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-red-100 border-2 border-red-400 rounded-lg">
              <p className="text-sm text-red-900 font-bold">
                ⚠️ CRASH AMPLIFIERS = Short-term (1-14 day) indicators that trigger 10%+ corrections.
                Maximum bonus capped at +100 points to prevent over-signaling.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-red-50">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Canaries in the Coal Mine - Active Warning Signals
            </div>
            <span className="text-2xl font-bold text-red-600">
              {data.canaries.filter(canary => canary.severity === "high" || canary.severity === "medium").length}/25
            </span>
          </CardTitle>
          <CardDescription>Executive summary of medium and high severity red flags across all indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {data.canaries
              .filter(canary => canary.severity === "high" || canary.severity === "medium")
              .map((canary, i) => {
                const severityConfig = {
                  high: {
                    bgColor: "bg-red-100",
                    textColor: "text-red-900",
                    borderColor: "border-red-400",
                    badgeColor: "bg-red-600 text-white",
                    label: "HIGH RISK"
                  },
                  medium: {
                    bgColor: "bg-yellow-100",
                    textColor: "text-yellow-900",
                    borderColor: "border-yellow-400",
                    badgeColor: "bg-yellow-600 text-white",
                    label: "MEDIUM RISK"
                  }
                }[canary.severity]
                
                return (
                  <div key={i} className={`flex-1 min-w-[280px] p-4 rounded-lg border-2 ${severityConfig.bgColor} ${severityConfig.borderColor}`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Badge variant="outline" className="text-xs font-semibold">
                        {canary.pillar}
                      </Badge>
                      <Badge className={`text-xs font-bold ${severityConfig.badgeColor}`}>
                        {severityConfig.label}
                      </Badge>
                    </div>
                    <p className={`text-sm font-semibold ${severityConfig.textColor}`}>{canary.signal}</p>
                  </div>
                )
              })}
          </div>
          {data.canaries.filter(c => c.severity === "high" || c.severity === "medium").length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-green-700 font-medium">No medium or high severity warnings detected</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pillar Breakdown */}
        

        {/* Canaries in the Coal Mine */}
        
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CCPI v2.0: Four Pillar Breakdown (Optimized for Crash Prediction)</CardTitle>
          <CardDescription>
            Individual stress scores across momentum, risk appetite, valuation, and macro dimensions
          </CardDescription>
        </CardHeader>
        <CardContent>
          
          {/* Reorganized indicators into new CCPI v2.0 pillar structure */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pt-12">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-cyan-600" />
                Pillar 1 - Momentum & Technical (35% weight)
              </h3>
              <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.momentum)}/100</span>
            </div>
            <div className="space-y-6">
              
              {/* NVIDIA Momentum Score */}
              {data.indicators?.nvidiaPrice !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">NVIDIA Momentum Score (AI Bellwether)</span>
                    <span className="font-bold">${data.indicators.nvidiaPrice.toFixed(0)} | {data.indicators.nvidiaMomentum}/100</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${data.indicators.nvidiaMomentum}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Falling: {'<'}20 (Tech crash risk)</span>
                    <span>Neutral: 40-60</span>
                    <span>Strong: {'>'}80</span>
                  </div>
                </div>
              )}

              {/* SOX Semiconductor Index */}
              {data.indicators?.soxIndex !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">SOX Semiconductor Index (Chip Sector Health)</span>
                    <span className="font-bold">{data.indicators.soxIndex.toFixed(0)}</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, Math.max(0, ((data.indicators.soxIndex - 4000) / 2000) * 100))}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Weak: {'<'}4500</span>
                    <span>Baseline: 5000</span>
                    <span>Strong: {'>'}5500</span>
                  </div>
                </div>
              )}

              {/* QQQ Daily Return */}
              {data.indicators?.qqqDailyReturn !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">QQQ Daily Return (5× downside amplifier)</span>
                    <span className="font-bold">{data.indicators.qqqDailyReturn}</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, Math.max(0, (parseFloat(data.indicators.qqqDailyReturn) + 2) / 4 * 100))}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Down: {'<'}-1%</span>
                    <span className="text-yellow-600">Flat: -1% to +1%</span>
                    <span>Up: {'>'} +1%</span>
                  </div>
                </div>
              )}

              {/* Consecutive Down Days */}
              {data.indicators?.qqqConsecDown !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">QQQ Consecutive Down Days</span>
                    <span className="font-bold">{data.indicators.qqqConsecDown} days</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, (data.indicators.qqqConsecDown / 5) * 100)}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Healthy: 0-1 days</span>
                    <span>Warning: 2-3 days</span>
                    <span>Danger: 4+ days</span>
                  </div>
                </div>
              )}

              {/* Below SMA20 */}
              {data.indicators?.qqqBelowSMA20 !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">QQQ Below 20-Day SMA</span>
                    <div className="flex items-center gap-2">
                      {data.indicators?.qqqSMA20Proximity !== undefined && (
                        <span className="text-xs font-semibold text-orange-600">
                          {data.indicators.qqqSMA20Proximity.toFixed(0)}% proximity
                        </span>
                      )}
                      <span className={`font-bold ${data.indicators.qqqBelowSMA20 ? 'text-red-600' : 'text-green-600'}`}>
                        {data.indicators.qqqBelowSMA20 ? 'YES' : 'NO'}
                      </span>
                    </div>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${data.indicators?.qqqSMA20Proximity || 0}%`
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Safe: 0% (far above)</span>
                    <span>Warning: 50%</span>
                    <span>Danger: 100% (breached)</span>
                  </div>
                </div>
              )}

              {/* Below SMA50 */}
              {data.indicators?.qqqBelowSMA50 !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">QQQ Below 50-Day SMA</span>
                    <div className="flex items-center gap-2">
                      {data.indicators?.qqqSMA50Proximity !== undefined && (
                        <span className="text-xs font-semibold text-orange-600">
                          {data.indicators.qqqSMA50Proximity.toFixed(0)}% proximity
                        </span>
                      )}
                      <span className={`font-bold ${data.indicators.qqqBelowSMA50 ? 'text-red-600' : 'text-green-600'}`}>
                        {data.indicators.qqqBelowSMA50 ? 'YES' : 'NO'}
                      </span>
                    </div>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${data.indicators?.qqqSMA50Proximity || 0}%`
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Safe: 0% (far above)</span>
                    <span>Warning: 50%</span>
                    <span>Danger: 100% (breached)</span>
                  </div>
                </div>
              )}

              {data.indicators?.qqqBelowSMA200 !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">QQQ Below 200-Day SMA</span>
                    <div className="flex items-center gap-2">
                      {data.indicators?.qqqSMA200Proximity !== undefined && (
                        <span className="text-xs font-semibold text-orange-600">
                          {data.indicators.qqqSMA200Proximity.toFixed(0)}% proximity
                        </span>
                      )}
                      <span className={`font-bold ${data.indicators.qqqBelowSMA200 ? 'text-red-600' : 'text-green-600'}`}>
                        {data.indicators.qqqBelowSMA200 ? 'YES' : 'NO'}
                      </span>
                    </div>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${data.indicators?.qqqSMA200Proximity || 0}%`
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Safe: 0% (far above)</span>
                    <span>Warning: 50%</span>
                    <span>Danger: 100% (breached)</span>
                  </div>
                </div>
              )}

              {/* Below Bollinger Band (Lower) */}
              {data.indicators?.qqqBelowBollinger !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">QQQ Below Bollinger Band (Lower)</span>
                    <div className="flex items-center gap-2">
                      {data.indicators?.qqqBollingerProximity !== undefined && (
                        <span className="text-xs font-semibold text-orange-600">
                          {data.indicators.qqqBollingerProximity.toFixed(0)}% proximity
                        </span>
                      )}
                      <span className={`font-bold ${data.indicators.qqqBelowBollinger ? 'text-red-600' : 'text-green-600'}`}>
                        {data.indicators.qqqBelowBollinger ? 'YES - OVERSOLD' : 'NO'}
                      </span>
                    </div>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${data.indicators?.qqqBollingerProximity || 0}%`
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Safe: 0% (at middle band)</span>
                    <span>Warning: 50%</span>
                    <span>Oversold: 100% (breached)</span>
                  </div>
                </div>
              )}

              {/* Death Cross */}
              {data.indicators?.qqqDeathCross !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">QQQ Death Cross (SMA50 {'<'} SMA200)</span>
                    <span className={`font-bold ${data.indicators.qqqDeathCross ? 'text-red-600' : 'text-green-600'}`}>
                      {data.indicators.qqqDeathCross ? 'YES - DANGER' : 'NO'}
                    </span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: data.indicators.qqqDeathCross ? '100%' : '0%' 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Golden Cross: Bullish</span>
                    <span>Death Cross: Bearish</span>
                  </div>
                </div>
              )}

              {/* VIX */}
              {data.indicators.vix !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">VIX (Fear Gauge)</span>
                    <span className="font-bold">{data.indicators.vix.toFixed(1)}</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, (data.indicators.vix / 50) * 100)}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Calm: {'<'}15</span>
                    <span className="text-yellow-600">Elevated: 15-25</span>
                    <span>Fear: {'>'}25</span>
                  </div>
                </div>
              )}

              {/* VXN */}
              {data.indicators.vxn !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">VXN (Nasdaq Volatility)</span>
                    <span className="font-bold">{data.indicators.vxn.toFixed(1)}</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, (data.indicators.vxn / 50) * 100)}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Calm: {'<'}15</span>
                    <span className="text-yellow-600">Elevated: 15-25</span>
                    <span>Panic: {'>'}35</span>
                  </div>
                </div>
              )}

              {/* RVX */}
              {data.indicators.rvx !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">RVX (Russell 2000 Volatility)</span>
                    <span className="font-bold">{data.indicators.rvx.toFixed(1)}</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, (data.indicators.rvx / 50) * 100)}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Low: {'<'}18</span>
                    <span className="text-yellow-600">Normal: 18-25</span>
                    <span>High: {'>'}30</span>
                  </div>
                </div>
              )}

              {/* VIX Term Structure */}
              {data.indicators.vixTermStructure !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">VIX Term Structure (Spot/1M)</span>
                    <span className="font-bold">{data.indicators.vixTermStructure.toFixed(2)}</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, Math.max(0, (2.0 - data.indicators.vixTermStructure) / 1.5 * 100))}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Contango: {'>'}1.5 (Safe)</span>
                    <span className="text-yellow-600">Normal: 1.0-1.2</span>
                    <span className="text-red-600">Backwardation: {'<'}1.0 (FEAR)</span>
                  </div>
                </div>
              )}

              {/* ATR - Average True Range */}
              {data.indicators.atr !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">ATR - Average True Range</span>
                    <span className="font-bold">{data.indicators.atr.toFixed(1)}</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, (data.indicators.atr / 60) * 100)}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Low Vol: {'<'}25</span>
                    <span className="text-yellow-600">Normal: 25-40</span>
                    <span>High Vol: {'>'}50</span>
                  </div>
                </div>
              )}

              {/* LTV - Long-term Volatility */}
              {data.indicators.ltv !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">LTV - Long-term Volatility</span>
                    <span className="font-bold">{(data.indicators.ltv * 100).toFixed(1)}%</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, (data.indicators.ltv / 0.3) * 100)}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Stable: {'<'}10%</span>
                    <span className="text-yellow-600">Normal: 10-15%</span>
                    <span>Elevated: {'>'}20%</span>
                  </div>
                </div>
              )}

              {/* High-Low Index (Market Breadth) */}
              {data.indicators.highLowIndex !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">High-Low Index (Market Breadth)</span>
                    <span className="font-bold">{data.indicators.highLowIndex}%</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${data.indicators.highLowIndex}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Weak: {'<'}30% (bearish)</span>
                    <span className="text-yellow-600">Neutral: 30-50%</span>
                    <span>Strong: {'>'}70% (bullish)</span>
                  </div>
                </div>
              )}

              {/* Bullish Percent Index */}
              {data.indicators.bullishPercent !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Bullish Percent Index</span>
                    <span className="font-bold">{data.indicators.bullishPercent}%</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${data.indicators.bullishPercent}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Oversold: {'<'}30%</span>
                    <span className="text-yellow-600">Normal: 30-50%</span>
                    <span>Overbought: {'>'}70%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 mt-12 border-t pt-12">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-orange-600" />
                Pillar 2 - Risk Appetite & Volatility (30% weight)
              </h3>
              <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.riskAppetite)}/100</span>
            </div>
            <div className="space-y-6">
              
              {/* Put/Call Ratio */}
              {data.indicators.putCallRatio !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Put/Call Ratio</span>
                    <span className="font-bold">{data.indicators.putCallRatio.toFixed(2)}</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, Math.max(0, (1.6 - data.indicators.putCallRatio) / 1.5 * 100))}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Safe: {'>'}1.1 (Hedging)</span>
                    <span className="text-yellow-600">Caution: 0.9-1.1</span>
                    <span className="text-red-600">Danger: {'<'}0.7 (Complacency)</span>
                  </div>
                </div>
              )}

              {/* Fear & Greed Index */}
              {data.indicators.fearGreedIndex !== undefined && data.indicators.fearGreedIndex !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Fear & Greed Index</span>
                    <span className="font-bold">{data.indicators.fearGreedIndex}</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${data.indicators.fearGreedIndex}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Fear: {'<'}30</span>
                    <span className="text-yellow-600">Neutral: 30-60</span>
                    <span>Greed: {'>'}70</span>
                  </div>
                </div>
              )}

              {/* AAII Bullish Sentiment */}
              {data.indicators.aaiiBullish !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">AAII Bullish Sentiment</span>
                    <span className="font-bold">{data.indicators.aaiiBullish.toFixed(0)}%</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, Math.max(0, ((data.indicators.aaiiBullish - 20) / 0.4)))}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Safe: {'<'}30%</span>
                    <span className="text-yellow-600">Warning: 30-40%</span>
                    <span className="text-red-600">Danger: {'>'}50%</span>
                  </div>
                </div>
              )}

              {/* Short Interest */}
              {data.indicators.shortInterest !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">SPY Short Interest Ratio</span>
                    <span className="font-bold">{(data.indicators.shortInterest * 100).toFixed(1)}%</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, Math.max(0, (0.15 - data.indicators.shortInterest) / 0.15 * 100))}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Safe: {'>'}15% (Positioned)</span>
                    <span className="text-yellow-600">Caution: 5-15%</span>
                    <span className="text-red-600">Danger: {'<'}1.5% (Complacency)</span>
                  </div>
                </div>
              )}

              {/* Tech ETF Flows */}
              {data.indicators.etfFlows !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Tech ETF Flows (Weekly)</span>
                    <span className="font-bold">${data.indicators.etfFlows}B</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, Math.max(0, ((data.indicators.etfFlows + 5) / 10) * 100))}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Outflows: {'<'}-$2B</span>
                    <span className="text-yellow-600">Neutral: -$2B to +$2B</span>
                    <span>Inflows: {'>'} $2B</span>
                  </div>
                </div>
              )}

              {/* ATR - Average True Range */}
              {data.indicators.atr !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">ATR - Average True Range</span>
                    <span className="font-bold">{data.indicators.atr.toFixed(1)}</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, (data.indicators.atr / 60) * 100)}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Low Vol: {'<'}25</span>
                    <span className="text-yellow-600">Normal: 25-40</span>
                    <span>High Vol: {'>'}50</span>
                  </div>
                </div>
              )}

              {/* LTV - Long-term Volatility */}
              {data.indicators.ltv !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">LTV - Long-term Volatility</span>
                    <span className="font-bold">{(data.indicators.ltv * 100).toFixed(1)}%</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, (data.indicators.ltv / 0.3) * 100)}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Stable: {'<'}10%</span>
                    <span className="text-yellow-600">Normal: 10-15%</span>
                    <span>Elevated: {'>'}20%</span>
                  </div>
                </div>
              )}

              {/* Bullish Percent Index */}
              {data.indicators.bullishPercent !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Bullish Percent Index</span>
                    <span className="font-bold">{data.indicators.bullishPercent}%</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${data.indicators.bullishPercent}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Oversold: {'<'}30%</span>
                    <span className="text-yellow-600">Normal: 30-50%</span>
                    <span>Overbought: {'>'}70%</span>
                  </div>
                </div>
              )}

              {/* Yield Curve - moved to Risk Appetite */}
              {data.indicators.yieldCurve !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Yield Curve (10Y-2Y)</span>
                    <span className="font-bold">{data.indicators.yieldCurve.toFixed(2)}%</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, Math.max(0, 100 - ((data.indicators.yieldCurve + 1) / 2) * 100))}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Normal: {'>'}0.5%</span>
                    <span className="text-yellow-600">Flat: 0-0.5%</span>
                    <span>Inverted: {'<'}0%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 mt-12 border-t pt-12">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                Pillar 3 - Valuation (15% weight)
              </h3>
              <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.valuation)}/100</span>
            </div>
            <div className="space-y-6">
              
              {/* S&P 500 P/E */}
              {data.indicators.spxPE !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">S&P 500 Forward P/E</span>
                    <span className="font-bold">{data.indicators.spxPE}</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, ((data.indicators.spxPE - 10) / 15) * 100)}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Historical Median: 16</span>
                    <span>Current: {data.indicators.spxPE}</span>
                  </div>
                </div>
              )}

              {/* P/S Ratio */}
              {data.indicators.spxPS !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">S&P 500 Price-to-Sales</span>
                    <span className="font-bold">{data.indicators.spxPS}</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, ((data.indicators.spxPS - 1) / 2) * 100)}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Normal: {'<'}2.5</span>
                    <span>Elevated: {'>'}3.0</span>
                  </div>
                </div>
              )}

              {/* Buffett Indicator */}
              {data.indicators.buffettIndicator !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Buffett Indicator (Market Cap / GDP)</span>
                    <span className="font-bold">{data.indicators.buffettIndicator.toFixed(0)}%</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, Math.max(0, ((data.indicators.buffettIndicator - 80) / 1.6)))}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Undervalued: {'<'}120%</span>
                    <span>Fair: 120-150%</span>
                    <span>Warning: 150-180%</span>
                    <span className="text-red-600">Danger: {'>'}200%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 mt-12 border-t pt-12">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                Pillar 4 - Macro (20% weight)
              </h3>
              <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.macro)}/100</span>
            </div>
            <div className="space-y-6">
              
              {/* TED Spread */}
              {data.indicators?.tedSpread !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">TED Spread (Banking System Stress)</span>
                    <span className="font-bold">{data.indicators.tedSpread.toFixed(2)}%</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, (data.indicators.tedSpread / 1.5) * 100)}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Normal: {'<'}0.35%</span>
                    <span>Warning: 0.5-0.75%</span>
                    <span>Crisis: {'>'}1.0%</span>
                  </div>
                </div>
              )}

              {/* US Dollar Index (DXY) */}
              {data.indicators?.dxyIndex !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">US Dollar Index (DXY) - Tech Headwind</span>
                    <span className="font-bold">{data.indicators.dxyIndex.toFixed(1)}</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, Math.max(0, ((data.indicators.dxyIndex - 90) / 30) * 100))}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Weak: {'<'}95</span>
                    <span>Normal: 100-105</span>
                    <span>Strong: {'>'}110 (Hurts tech)</span>
                  </div>
                </div>
              )}

              {/* ISM Manufacturing PMI */}
              {data.indicators?.ismPMI !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">ISM Manufacturing PMI (Economic Leading)</span>
                    <span className="font-bold">{data.indicators.ismPMI.toFixed(1)}</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, Math.max(0, ((data.indicators.ismPMI - 40) / 20) * 100))}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Contraction: {'<'}50</span>
                    <span>Neutral: 50</span>
                    <span>Expansion: {'>'}52</span>
                  </div>
                </div>
              )}

              {/* Fed Funds Rate */}
              {data.indicators.fedFundsRate !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Fed Funds Rate</span>
                    <span className="font-bold">{data.indicators.fedFundsRate}%</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, (data.indicators.fedFundsRate / 6) * 100)}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Accommodative: {'<'}2%</span>
                    <span className="text-yellow-600">Neutral: 2-4%</span>
                    <span>Restrictive: {'>'}4.5%</span>
                  </div>
                </div>
              )}

              {/* Fed Reverse Repo */}
              {data.indicators?.fedReverseRepo !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Fed Reverse Repo (Liquidity Conditions)</span>
                    <span className="font-bold">${data.indicators.fedReverseRepo.toFixed(0)}B</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, (data.indicators.fedReverseRepo / 2500) * 100)}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Loose: {'<'}500B</span>
                    <span>Normal: 1000B</span>
                    <span>Tight: {'>'}2000B</span>
                  </div>
                </div>
              )}

              {/* Junk Bond Spread - moved to Macro */}
              {data.indicators.junkSpread !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Junk Bond Spread</span>
                    <span className="font-bold">{data.indicators.junkSpread.toFixed(2)}%</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, ((data.indicators.junkSpread - 2) / 8) * 100)}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Tight: {'<'}3%</span>
                    <span className="text-yellow-600">Normal: 3-5%</span>
                    <span>Wide: {'>'}6%</span>
                  </div>
                </div>
              )}

              {/* US Debt-to-GDP */}
              {data.indicators.debtToGDP !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">US Debt-to-GDP Ratio</span>
                    <span className="font-bold">{data.indicators.debtToGDP.toFixed(1)}%</span>
                  </div>
                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                    <div className="absolute inset-0 bg-gray-200" style={{ 
                      marginLeft: `${Math.min(100, Math.max(0, ((data.indicators.debtToGDP - 60) / 80) * 100))}%` 
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Healthy: {'<'}90%</span>
                    <span className="text-yellow-600">Elevated: 100-120%</span>
                    <span className="text-red-600">Danger: {'>'}130%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-sm mb-3 text-blue-900">CCPI Formula Weights</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-blue-700">Technical & Price:</span>
                <span className="font-bold text-blue-900">35%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-700">Risk Appetite:</span>
                <span className="font-bold text-blue-900">30%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-700">Valuation:</span>
                <span className="font-bold text-blue-900">15%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-700">Macro:</span>
                <span className="font-bold text-blue-900">20%</span>
              </div>
            </div>
            <p className="text-xs text-blue-700 mt-3">
              Final CCPI = Σ(Pillar Score × Weight). Phase 1 enhanced with AI sector indicators (NVDA, SOX) and macro leading indicators (TED, DXY, ISM, RRP).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Options Strategy Guide by CCPI Crash Risk Level */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-900">
            Options Strategy Guide by CCPI Crash Risk Level
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">Complete trading playbook across all crash risk regimes</p>
        </CardHeader>
        <CardContent className="pt-4 pb-4">
          <div className="space-y-2">
            {[
              {
                range: "0-19",
                level: "Low Risk",
                signal: "STRONG BUY",
                description: "Market shows minimal crash signals. Safe to deploy capital with aggressive strategies.",
                guidance: {
                  cashAllocation: "5-10%",
                  marketExposure: "90-100%",
                  positionSize: "Large (5-10%)",
                  strategies: [
                    "Sell cash-secured puts on quality names at 30-delta",
                    "Run the wheel strategy on tech leaders (NVDA, MSFT, AAPL)",
                    "Long ITM LEAPS calls (70-80 delta) for portfolio leverage",
                    "Aggressive short strangles on high IV stocks",
                    "Credit spreads in earnings season"
                  ]
                }
              },
              {
                range: "20-39",
                level: "Normal",
                signal: "BUY",
                description: "Standard market conditions. Deploy capital with normal risk management protocols.",
                guidance: {
                  cashAllocation: "15-25%",
                  marketExposure: "70-85%",
                  positionSize: "Medium (3-5%)",
                  strategies: [
                    "Balanced put selling at 20-30 delta on SPY/QQQ",
                    "Covered calls on existing positions (40-45 DTE)",
                    "Bull put spreads with 1.5-2x credit/risk ratio",
                    "Diagonal calendar spreads for income + upside",
                    "Protective puts on core holdings (10% allocation)"
                  ]
                }
              },
              {
                range: "40-59",
                level: "Caution",
                signal: "HOLD",
                description: "Mixed signals appearing. Reduce exposure and focus on defensive positioning.",
                guidance: {
                  cashAllocation: "30-40%",
                  marketExposure: "50-70%",
                  positionSize: "Small (1-3%)",
                  strategies: [
                    "Shift to defined-risk strategies only (spreads, iron condors)",
                    "Increase VIX call hedges (2-3 month expiry)",
                    "Roll out short puts to avoid assignment",
                    "Close winning trades early (50-60% max profit)",
                    "Buy protective puts on concentrated positions"
                  ]
                }
              },
              {
                range: "60-79",
                level: "High Alert",
                signal: "CAUTION",
                description: "Multiple crash signals active. Preserve capital and prepare for volatility expansion.",
                guidance: {
                  cashAllocation: "50-60%",
                  marketExposure: "30-50%",
                  positionSize: "Very Small (0.5-1%)",
                  strategies: [
                    "Buy VIX calls for crash insurance (60-90 DTE)",
                    "Long put spreads on QQQ/SPY at-the-money",
                    "Close all naked short options immediately",
                    "Tactical long volatility trades (VXX calls)",
                    "Gold miners (GDX) call options as diversification"
                  ]
                }
              },
              {
                range: "80-100",
                level: "Crash Watch",
                signal: "SELL/HEDGE",
                description: "Extreme crash risk. Full defensive positioning required. Prioritize capital preservation.",
                guidance: {
                  cashAllocation: "70-80%",
                  marketExposure: "10-30%",
                  positionSize: "Minimal (0.25-0.5%)",
                  strategies: [
                    "Aggressive long puts on SPY/QQQ (30-60 DTE)",
                    "VIX call spreads to capitalize on volatility spike",
                    "Inverse ETFs (SQQQ, SH) or long put options",
                    "Close ALL short premium positions",
                    "Tail risk hedges: deep OTM puts on major indices"
                  ]
                }
              }
            ].map((item, index) => {
              const isCurrent =
                data.ccpi >= Number.parseInt(item.range.split("-")[0]) &&
                data.ccpi <= Number.parseInt(item.range.split("-")[1])

              return (
                <div
                  key={index}
                  className={`p-4 rounded-lg border transition-colors ${
                    isCurrent ? "border-green-500 bg-green-100 shadow-md ring-2 ring-green-300" : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-mono text-sm font-bold text-gray-900">CCPI: {item.range}</span>
                        <span
                          className={`ml-3 font-bold text-sm ${
                            index === 0
                              ? "text-green-600"
                              : index === 1
                                ? "text-lime-600"
                                : index === 2
                                  ? "text-yellow-600"
                                  : index === 3
                                    ? "text-orange-600"
                                    : "text-red-600"
                          }`}
                        >
                          {item.level}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isCurrent && (
                          <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">
                            CURRENT
                          </span>
                        )}
                        <span
                          className={`px-3 py-1 text-xs font-bold rounded-full ${
                            item.signal === "STRONG BUY"
                              ? "bg-green-100 text-green-800"
                              : item.signal === "BUY"
                                ? "bg-green-100 text-green-700"
                                : item.signal === "HOLD"
                                  ? "bg-gray-100 text-gray-700"
                                  : item.signal === "CAUTION"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-red-100 text-red-700"
                          }`}
                        >
                          {item.signal}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 italic">{item.description}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                      <div className="text-xs font-semibold text-blue-900 uppercase mb-1">Cash</div>
                      <div className="text-lg font-bold text-blue-900">{item.guidance.cashAllocation}</div>
                    </div>
                    <div className="p-3 bg-purple-50 rounded border border-purple-200">
                      <div className="text-xs font-semibold text-purple-900 uppercase mb-1">Exposure</div>
                      <div className="text-lg font-bold text-purple-900">{item.guidance.marketExposure}</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded border border-gray-300">
                      <div className="text-xs font-semibold text-gray-900 uppercase mb-1">Position Size</div>
                      <div className="text-sm font-bold text-gray-900">{item.guidance.positionSize}</div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-xs font-bold text-gray-900 uppercase mb-2">Top Strategies</div>
                    <div className="space-y-1">
                      {item.guidance.strategies.slice(0, 3).map((strategy, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-primary mt-1 flex-shrink-0">•</span>
                          <span>{strategy}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800 leading-relaxed">
              <strong>Note:</strong> The CCPI is most effective when used with technical analysis and portfolio stress testing.
              CCPI scores above 60 historically precede significant drawdowns within 1-6 months. Always maintain proper position
              sizing and use defined-risk strategies during elevated CCPI regimes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Allocation by CCPI Crash Risk Level */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-900">Portfolio Allocation by CCPI Crash Risk Level</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Recommended asset class diversification across crash risk regimes
          </p>
        </CardHeader>
        <CardContent className="pt-4 pb-4">
          <div className="space-y-2">
            {[
              {
                range: "0-19",
                level: "Low Risk",
                data: {
                  stocks: "55-65%",
                  options: "15-20%",
                  crypto: "8-12%",
                  gold: "3-5%",
                  cash: "5-10%",
                  description: "Aggressive growth allocation with maximum equity exposure",
                  rationale: [
                    "Deploy capital aggressively into quality tech growth stocks",
                    "Allocate 15-20% to options strategies for leverage and income",
                    "Hold 8-12% crypto for asymmetric upside (BTC/ETH)",
                    "Minimal cash reserves needed in low-risk environment",
                    "Small gold allocation (3-5%) as insurance policy"
                  ]
                }
              },
              {
                range: "20-39",
                level: "Normal",
                data: {
                  stocks: "45-55%",
                  options: "12-15%",
                  crypto: "5-8%",
                  gold: "5-8%",
                  cash: "15-25%",
                  description: "Balanced allocation with standard risk management",
                  rationale: [
                    "Core equity exposure via diversified ETFs and blue chips",
                    "Use options for income generation and tactical positioning",
                    "Reduce crypto exposure to 5-8% of portfolio",
                    "Increase gold/silver to 5-8% for diversification",
                    "Build cash reserves to 15-25% for opportunities"
                  ]
                }
              },
              {
                range: "40-59",
                level: "Caution",
                data: {
                  stocks: "30-40%",
                  options: "8-12%",
                  crypto: "3-5%",
                  gold: "10-15%",
                  cash: "30-40%",
                  description: "Defensive tilt with elevated cash and hedges",
                  rationale: [
                    "Reduce equity exposure to highest-quality names only",
                    "Shift options allocation toward hedges and put spreads",
                    "Trim crypto to minimal allocation (3-5%)",
                    "Increase gold/silver to 10-15% as safe haven",
                    "Build substantial cash position (30-40%) for volatility"
                  ]
                }
              },
              {
                range: "60-79",
                level: "High Alert",
                data: {
                  stocks: "15-25%",
                  options: "10-15%",
                  crypto: "0-2%",
                  gold: "15-20%",
                  cash: "50-60%",
                  description: "Capital preservation mode with heavy defensive positioning",
                  rationale: [
                    "Minimal equity exposure - only defensive sectors (utilities, staples)",
                    "Options portfolio entirely hedges and volatility plays",
                    "Exit nearly all crypto exposure due to crash risk",
                    "Gold allocation 15-20% as primary safe haven asset",
                    "Hold 50-60% cash to deploy after market correction"
                  ]
                }
              },
              {
                range: "80-100",
                level: "Crash Watch",
                data: {
                  stocks: "5-10%",
                  options: "10-15%",
                  crypto: "0%",
                  gold: "20-25%",
                  cash: "70-80%",
                  description: "Maximum defense - cash and hard assets only",
                  rationale: [
                    "Liquidate nearly all equity exposure immediately",
                    "Options used exclusively for tail risk hedges and put spreads",
                    "Zero crypto exposure - too correlated with risk assets",
                    "Maximum gold/precious metals allocation (20-25%)",
                    "Hold 70-80% cash reserves to deploy after crash"
                  ]
                }
              }
            ].map((item, index) => {
              const isCurrent =
                data.ccpi >= Number.parseInt(item.range.split("-")[0]) &&
                data.ccpi <= Number.parseInt(item.range.split("-")[1])

              return (
                <div
                  key={index}
                  className={`p-4 rounded-lg border transition-colors ${
                    isCurrent ? "border-green-500 bg-green-100 shadow-md ring-2 ring-green-300" : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-mono text-sm font-bold text-gray-900">CCPI {item.range}</span>
                        <span
                          className={`ml-3 font-bold text-sm ${
                            index === 0
                              ? "text-green-600"
                              : index === 1
                                ? "text-lime-600"
                                : index === 2
                                  ? "text-yellow-600"
                                  : index === 3
                                    ? "text-orange-600"
                                    : "text-red-600"
                          }`}
                        >
                          {item.level}
                        </span>
                      </div>
                      {isCurrent && (
                        <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">CURRENT</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 italic">{item.data.description}</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                      <div className="text-xs font-semibold text-blue-900 uppercase mb-1">Stocks/ETFs</div>
                      <div className="text-lg font-bold text-blue-900">{item.data.stocks}</div>
                    </div>
                    <div className="p-3 bg-purple-50 rounded border border-purple-200">
                      <div className="text-xs font-semibold text-purple-900 uppercase mb-1">Options</div>
                      <div className="text-lg font-bold text-purple-900">{item.data.options}</div>
                    </div>
                    <div className="p-3 bg-orange-50 rounded border border-orange-200">
                      <div className="text-xs font-semibold text-orange-900 uppercase mb-1">BTC/Crypto</div>
                      <div className="text-lg font-bold text-orange-900">{item.data.crypto}</div>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                      <div className="text-xs font-semibold text-yellow-900 uppercase mb-1">Gold/Silver</div>
                      <div className="text-lg font-bold text-yellow-900">{item.data.gold}</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded border border-gray-300">
                      <div className="text-xs font-semibold text-gray-900 uppercase mb-1">Cash Reserve</div>
                      <div className="text-lg font-bold text-gray-900">{item.data.cash}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {item.data.rationale.map((point, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-primary mt-1 flex-shrink-0">•</span>
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800 leading-relaxed">
              <strong>Note:</strong> These allocations represent baseline guidelines for crash risk management. Always adjust
              based on your personal risk tolerance, time horizon, and financial goals. CCPI levels above 60 warrant significant
              defensive positioning regardless of individual circumstances. Consult with a financial advisor for personalized advice.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Export Controls */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const summary = `CCPI Weekly Outlook\n\n${data.summary.headline}\n\n${data.summary.bullets.join('\n')}\n\nCCPI Score: ${data.ccpi}\nCertainty: ${data.certainty}\nRegime: ${data.regime.name}\n\nGenerated: ${new Date(data.timestamp).toLocaleString()}`
            navigator.clipboard.writeText(summary)
            alert("Summary copied to clipboard!")
          }}
        >
          Copy Summary
        </Button>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {data.apiStatus && Object.keys(data.apiStatus).length > 0 && (
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              API Data Source Status
            </CardTitle>
            <CardDescription>Real-time tracking of data sources and API availability across the entire platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* CCPI Data Sources */}
              <div>
                <h4 className="font-semibold text-sm text-blue-900 mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  CCPI Calculator Data Sources
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.apiStatus?.technical && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div>
                        <span className="text-sm font-medium text-gray-900">QQQ Technicals</span>
                        <p className="text-xs text-gray-500">{data.apiStatus.technical.source}</p>
                      </div>
                      {getStatusBadge(data.apiStatus.technical.live, data.apiStatus.technical.source)}
                    </div>
                  )}
                  {data.apiStatus?.vixTerm && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div>
                        <span className="text-sm font-medium text-gray-900">VIX Term Structure</span>
                        <p className="text-xs text-gray-500">{data.apiStatus.vixTerm.source}</p>
                      </div>
                      {getStatusBadge(data.apiStatus.vixTerm.live, data.apiStatus.vixTerm.source)}
                    </div>
                  )}
                  {data.apiStatus?.fred && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div>
                        <span className="text-sm font-medium text-gray-900">FRED Macro</span>
                        <p className="text-xs text-gray-500">{data.apiStatus.fred.source}</p>
                      </div>
                      {getStatusBadge(data.apiStatus.fred.live, data.apiStatus.fred.source)}
                    </div>
                  )}
                  {data.apiStatus?.alphaVantage && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div>
                        <span className="text-sm font-medium text-gray-900">Alpha Vantage</span>
                        <p className="text-xs text-gray-500">{data.apiStatus.alphaVantage.source}</p>
                      </div>
                      {getStatusBadge(data.apiStatus.alphaVantage.live, data.apiStatus.alphaVantage.source)}
                    </div>
                  )}
                  {data.apiStatus?.apify && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div>
                        <span className="text-sm font-medium text-gray-900">Apify Yahoo</span>
                        <p className="text-xs text-gray-500">{data.apiStatus.apify.source}</p>
                      </div>
                      {getStatusBadge(data.apiStatus.apify.live, data.apiStatus.apify.source)}
                    </div>
                  )}
                  {data.apiStatus?.fearGreed && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div>
                        <span className="text-sm font-medium text-gray-900">Fear & Greed</span>
                        <p className="text-xs text-gray-500">{data.apiStatus.fearGreed.source}</p>
                      </div>
                      {getStatusBadge(data.apiStatus.fearGreed.live, data.apiStatus.fearGreed.source)}
                    </div>
                  )}
                  {data.apiStatus?.buffett && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div>
                        <span className="text-sm font-medium text-gray-900">Buffett Indicator</span>
                        <p className="text-xs text-gray-500">{data.apiStatus.buffett.source}</p>
                      </div>
                      {getStatusBadge(data.apiStatus.buffett.live, data.apiStatus.buffett.source)}
                    </div>
                  )}
                  {data.apiStatus?.putCall && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div>
                        <span className="text-sm font-medium text-gray-900">Put/Call Ratio</span>
                        <p className="text-xs text-gray-500">{data.apiStatus.putCall.source}</p>
                      </div>
                      {getStatusBadge(data.apiStatus.putCall.live, data.apiStatus.putCall.source)}
                    </div>
                  )}
                  {data.apiStatus?.aaii && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div>
                        <span className="text-sm font-medium text-gray-900">AAII Sentiment</span>
                        <p className="text-xs text-gray-500">{data.apiStatus.aaii.source}</p>
                      </div>
                      {getStatusBadge(data.apiStatus.aaii.live, data.apiStatus.aaii.source)}
                    </div>
                  )}
                  {data.apiStatus?.shortInterest && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div>
                        <span className="text-sm font-medium text-gray-900">Short Interest</span>
                        <p className="text-xs text-gray-500">{data.apiStatus.shortInterest.source}</p>
                      </div>
                      {getStatusBadge(data.apiStatus.shortInterest.live, data.apiStatus.shortInterest.source)}
                    </div>
                  )}
                </div>
              </div>

              {/* Legend with traffic light style */}
              <div className="mt-4 p-4 bg-white border border-blue-200 rounded-lg">
                <p className="text-sm font-semibold text-gray-900 mb-3">Legend: Data Source Status</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-3 p-2 bg-green-50 rounded border border-green-200">
                    <span className="h-4 w-4 rounded-full bg-green-500 flex-shrink-0"></span>
                    <div>
                      <p className="text-sm font-semibold text-green-900">Live</p>
                      <p className="text-xs text-green-700">Real-time API data</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-amber-50 rounded border border-amber-200">
                    <span className="h-4 w-4 rounded-full bg-amber-500 flex-shrink-0"></span>
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Baseline</p>
                      <p className="text-xs text-amber-700">Historical average/fallback</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-red-50 rounded border border-red-200">
                    <span className="h-4 w-4 rounded-full bg-red-500 flex-shrink-0"></span>
                    <div>
                      <p className="text-sm font-semibold text-red-900">Failed</p>
                      <p className="text-xs text-red-700">API unavailable</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Quality Warning */}
              {Object.values(data.apiStatus).some((status: any) => !status.live) && (
                <div className="p-3 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                  <p className="text-sm text-yellow-900 font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Data Quality Notice
                  </p>
                  <p className="text-xs text-yellow-800 mt-1">
                    Some APIs are using baseline/fallback data. CCPI scores may differ from production if live APIs are unavailable.
                    Check your environment variables and API keys to ensure all integrations are properly configured.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
