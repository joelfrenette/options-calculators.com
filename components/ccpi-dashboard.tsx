"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, TrendingDown, Activity, DollarSign, Users, Database, RefreshCw, Download, Settings, Layers, Target, Briefcase, PieChart, TrendingUp } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts"

interface CCPIData {
  ccpi: number
  certainty: number
  pillars: {
    valuation: number
    technical: number
    macro: number
    sentiment: number
    flows: number
    structural: number
    // Added qqqTechnicals to interface
    qqqTechnicals?: number
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
  timestamp: string
  score?: number // Added score to interface to align with new components
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
        totalIndicators: 23
      })
      console.log("[v0] Pillar Breakdown (weighted contribution to CCPI):")
      console.log("  Valuation:", result.pillars.valuation, "× 22% =", (result.pillars.valuation * 0.22).toFixed(1))
      console.log("  Technical:", result.pillars.technical, "× 20% =", (result.pillars.technical * 0.20).toFixed(1))
      console.log("  Macro:", result.pillars.macro, "× 18% =", (result.pillars.macro * 0.18).toFixed(1))
      console.log("  Sentiment:", result.pillars.sentiment, "× 18% =", (result.pillars.sentiment * 0.18).toFixed(1))
      console.log("  Flows:", result.pillars.flows, "× 12% =", (result.pillars.flows * 0.12).toFixed(1))
      console.log("  Structural:", result.pillars.structural, "× 10% =", (result.pillars.structural * 0.10).toFixed(1))
      
      const calculatedCCPI = 
        result.pillars.valuation * 0.22 +
        result.pillars.technical * 0.20 +
        result.pillars.macro * 0.18 +
        result.pillars.sentiment * 0.18 +
        result.pillars.flows * 0.12 +
        result.pillars.structural * 0.10
      console.log("  Calculated CCPI:", calculatedCCPI.toFixed(1), "| API CCPI:", result.ccpi)
      
      setData(result)
    } catch (error) {
      console.error("[v0] CCPI API error:", error)
      setError(error instanceof Error ? error.message : "Failed to load CCPI data")
    } finally {
      setLoading(false)
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

  // Updated pillarData to include QQQ Technicals and renumbered
  const pillarData = [
    { name: "Pillar 1 - QQQ Momentum", value: data.pillars.qqqTechnicals || 0, icon: Activity },
    { name: "Pillar 2 - Valuation", value: data.pillars.valuation, icon: DollarSign },
    { name: "Pillar 3 - Technical", value: data.pillars.technical, icon: Activity },
    { name: "Pillar 4 - Macro", value: data.pillars.macro, icon: TrendingDown },
    { name: "Pillar 5 - Sentiment", value: data.pillars.sentiment, icon: Users },
    { name: "Pillar 6 - Flows", value: data.pillars.flows, icon: TrendingDown }
  ]

  const pillarChartData = pillarData.map((pillar, index) => ({
    name: `Pillar ${index + 1}`,
    fullName: pillar.name,
    value: pillar.value,
    icon: pillar.icon
  }))

  const zone = getRegimeZone(data.ccpi)
  const ccpiScore = data.ccpi

  return (
    <div className="space-y-6">

      {/* Main CCPI Score Card */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-xl">CCPI: Crash & Correction Prediction Index</CardTitle>
                <CardDescription>AI-led market correction early warning oracle for options traders</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            
            <div className="pt-8">
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
              <p className="text-5xl font-bold mb-2 text-blue-600">{data.certainty}%</p>
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
          
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-sm mb-2 text-blue-900">Weekly Outlook</h4>
            <p className="text-sm text-blue-800 mb-3 font-medium">{data.summary.headline}</p>
            <ul className="space-y-1">
              {data.summary.bullets.map((bullet, i) => (
                <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-red-50">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Canaries in the Coal Mine - Active Warning Signals
            </div>
            <span className="text-2xl font-bold text-red-600">
              {data.canaries.filter(c => c.severity === "high" || c.severity === "medium").length}
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

      {/* Market Indicators Breakdown - Full Width */}
      {data.indicators && Object.keys(data.indicators).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Market Indicators Breakdown</CardTitle>
            <CardDescription>
              Professional indicators used in CCPI formula with current values, thresholds, and pillar weights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-cyan-600" />
                    Pillar 1 - QQQ Momentum (30% weight)
                  </h3>
                  <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.qqqTechnicals || 0)}/100</span>
                </div>
                <div className="space-y-6">
                  
                  {/* QQQ Daily Return */}
                  {data.indicators?.qqqDailyReturn !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">QQQ Daily Return (5× downside amplifier)</span>
                        <span className="font-bold">{data.indicators.qqqDailyReturn}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden bg-gray-200">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        {/* Position indicator at the correct spot on the gradient */}
                        <div 
                          className="absolute top-0 bottom-0 w-1 bg-black"
                          style={{ 
                            left: `${Math.min(100, Math.max(0, ((parseFloat(data.indicators.qqqDailyReturn) + 2) / 4) * 100))}%` 
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Down: &lt;-1%</span>
                        <span>Flat: -0.5% to +0.5%</span>
                        <span>Up: &gt;+1%</span>
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
                      <div className="relative w-full h-3 rounded-full overflow-hidden bg-gray-200">
                        <div 
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                          style={{ 
                            width: `${Math.min(100, (data.indicators.qqqConsecDown / 5) * 100)}%` 
                          }}
                        />
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
                      <div className="relative w-full h-3 rounded-full overflow-hidden bg-gray-200">
                        <div 
                          className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                          style={{ 
                            width: `${data.indicators?.qqqSMA20Proximity || 0}%`
                          }}
                        />
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
                      <div className="relative w-full h-3 rounded-full overflow-hidden bg-gray-200">
                        <div 
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                          style={{ 
                            width: `${data.indicators?.qqqSMA50Proximity || 0}%`
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Healthy: 0-1 days</span>
                        <span>Warning: 2-3 days</span>
                        <span>Danger: 4+ days</span>
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
                      <div className="relative w-full h-3 rounded-full overflow-hidden bg-gray-200">
                        <div 
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                          style={{ 
                            width: `${data.indicators?.qqqSMA200Proximity || 0}%`
                          }}
                        />
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
                      <div className="relative w-full h-3 rounded-full overflow-hidden bg-gray-200">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: data.indicators.qqqBelowBollinger ? '100%' : '0%' 
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
                        <span className="font-medium">QQQ Death Cross (SMA50 &lt; SMA200)</span>
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
                </div>
              </div>

              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                    Pillar 2 - Valuation Stress (20% weight)
                  </h3>
                  <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.valuation)}/100</span>
                </div>
                <div className="space-y-6">
                  
                  {/* Buffett Indicator */}
                  {data.indicators.buffettIndicator !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Buffett Indicator (Market Cap / GDP)</span>
                        <span className="font-bold">{data.indicators.buffettIndicator}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, (data.indicators.buffettIndicator / 200) * 100)}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Undervalued: &lt;80%</span>
                        <span>Fair: 80-120%</span>
                        <span>Overvalued: &gt;120%</span>
                      </div>
                    </div>
                  )}

                  {/* S&P 500 Forward P/E */}
                  {data.indicators.spxPE !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">S&P 500 Forward P/E</span>
                        <span className="font-bold">{data.indicators.spxPE.toFixed(1)}x</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, (data.indicators.spxPE / 30) * 100)}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Cheap: &lt;15x</span>
                        <span>Fair: 15-20x</span>
                        <span>Expensive: &gt;20x</span>
                      </div>
                    </div>
                  )}

                  {/* S&P 500 Price-to-Sales */}
                  {data.indicators.spxPS !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">S&P 500 Price-to-Sales</span>
                        <span className="font-bold">{data.indicators.spxPS.toFixed(2)}x</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, (data.indicators.spxPS / 4) * 100)}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Cheap: &lt;1.5x</span>
                        <span>Normal: 1.5-2.5x</span>
                        <span>Expensive: &gt;2.5x</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Pillar 3 - Technical Fragility */}
              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-600" />
                    Pillar 3 - Technical Fragility (12% weight)
                  </h3>
                  <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.technical)}/100</span>
                </div>
                <div className="space-y-6">
                  {/* VIX (Volatility Index) */}
                  {data.indicators.vix !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">VIX (Volatility Index)</span>
                        <span className="font-bold">{data.indicators.vix.toFixed(2)}</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 via-orange-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, (data.indicators.vix / 50) * 100)}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Low: &lt;15</span>
                        <span>Elevated: 20-30</span>
                        <span>High: &gt;30</span>
                      </div>
                    </div>
                  )}

                  {/* VXN (Nasdaq Volatility) */}
                  {data.indicators.vxn !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">VXN (Nasdaq Volatility)</span>
                        <span className="font-bold">{data.indicators.vxn.toFixed(2)}</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 via-orange-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, (data.indicators.vxn / 50) * 100)}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Low: &lt;18</span>
                        <span>Elevated: 25-35</span>
                        <span>High: &gt;35</span>
                      </div>
                    </div>
                  )}

                  {/* VIX Term Structure */}
                  {data.indicators.vixTermStructure !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">VIX Term Structure</span>
                        <span className="font-bold">
                          {data.indicators.vixTermInverted ? 'INVERTED' : data.indicators.vixTermStructure.toFixed(2)}
                        </span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-yellow-500 to-orange-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: data.indicators.vixTermInverted ? '0%' : `${Math.min(100, (data.indicators.vixTermStructure / 3) * 100)}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Inverted: &lt;0</span>
                        <span>Normal: 1-2</span>
                        <span>Steep: &gt;2.5</span>
                      </div>
                    </div>
                  )}

                  {/* High-Low Index */}
                  {data.indicators.highLowIndex !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">High-Low Index</span>
                        <span className="font-bold">{data.indicators.highLowIndex.toFixed(1)}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${data.indicators.highLowIndex}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Weak: &lt;30%</span>
                        <span>Neutral: 30-70%</span>
                        <span>Strong: &gt;70%</span>
                      </div>
                    </div>
                  )}

                  {/* Bullish Percent Index */}
                  {data.indicators.bullishPercent !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Bullish Percent Index</span>
                        <span className="font-bold">{data.indicators.bullishPercent.toFixed(1)}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${data.indicators.bullishPercent}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Oversold: &lt;30%</span>
                        <span>Neutral: 30-70%</span>
                        <span>Overbought: &gt;70%</span>
                      </div>
                    </div>
                  )}

                  {/* Left Tail Volatility */}
                  {data.indicators.leftTailVol !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Left Tail Volatility (14-day)</span>
                        <span className="font-bold">{data.indicators.leftTailVol.toFixed(2)}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, (data.indicators.leftTailVol / 5) * 100)}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Low: &lt;1%</span>
                        <span>Elevated: 2-3%</span>
                        <span>High: &gt;3%</span>
                      </div>
                    </div>
                  )}

                  {/* ATR (Average True Range) */}
                  {data.indicators.atr !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">ATR (14-day) - Daily Trading Range</span>
                        <span className="font-bold">{data.indicators.atr.toFixed(2)}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, (data.indicators.atr / 5) * 100)}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Calm: &lt;1.5%</span>
                        <span>Normal: 1.5-3%</span>
                        <span>Volatile: &gt;3%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Pillar 4 - Macro & Liquidity Risk */}
              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                    Pillar 4 - Macro & Liquidity Risk (12% weight)
                  </h3>
                  <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.macro)}/100</span>
                </div>
                <div className="space-y-6">
                  {/* Fed Funds Rate */}
                  {data.indicators.fedFundsRate !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Fed Funds Rate</span>
                        <span className="font-bold">{data.indicators.fedFundsRate.toFixed(2)}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, (data.indicators.fedFundsRate / 6) * 100)}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Low: &lt;2%</span>
                        <span>Neutral: 2-4%</span>
                        <span>High: &gt;4%</span>
                      </div>
                    </div>
                  )}

                  {/* Junk Bond Spread */}
                  {data.indicators.junkSpread !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Junk Bond Spread (High Yield - Treasury)</span>
                        <span className="font-bold">{data.indicators.junkSpread.toFixed(2)}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, (data.indicators.junkSpread / 8) * 100)}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Tight: &lt;3%</span>
                        <span>Normal: 3-5%</span>
                        <span>Wide: &gt;5%</span>
                      </div>
                    </div>
                  )}

                  {/* Yield Curve (10Y-2Y) */}
                  {data.indicators.yieldCurve !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Yield Curve (10Y - 2Y Treasury)</span>
                        <span className="font-bold">
                          {data.indicators.yieldCurve > 0 ? '+' : ''}{data.indicators.yieldCurve.toFixed(2)}%
                        </span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.max(0, Math.min(100, ((data.indicators.yieldCurve + 1) / 3) * 100))}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Inverted: &lt;-0.5%</span>
                        <span>Flat: -0.5 to +0.5%</span>
                        <span>Normal: &gt;+1%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Pillar 5 - Sentiment & Media Feedback */}
              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5 text-orange-600" />
                    Pillar 5 - Sentiment & Media Feedback (12% weight)
                  </h3>
                  <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.sentiment)}/100</span>
                </div>
                <div className="space-y-6">
                  {/* AAII Bullish Sentiment */}
                  {data.indicators.aaiiBullish !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">AAII Bullish Sentiment</span>
                        <span className="font-bold">{data.indicators.aaiiBullish.toFixed(1)}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${data.indicators.aaiiBullish}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Bearish: &lt;25%</span>
                        <span>Neutral: 25-45%</span>
                        <span>Bullish: &gt;45%</span>
                      </div>
                    </div>
                  )}

                  {/* AAII Bearish Sentiment */}
                  {data.indicators.aaiiBearish !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">AAII Bearish Sentiment</span>
                        <span className="font-bold">{data.indicators.aaiiBearish.toFixed(1)}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, (data.indicators.aaiiBearish / 60) * 100)}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Low Fear: &lt;20%</span>
                        <span>Neutral: 20-35%</span>
                        <span>High Fear: &gt;35%</span>
                      </div>
                    </div>
                  )}

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
                          marginLeft: `${Math.min(100, (data.indicators.putCallRatio / 1.5) * 100)}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Complacent: &lt;0.7</span>
                        <span>Normal: 0.7-1.0</span>
                        <span>Fearful: &gt;1.0</span>
                      </div>
                    </div>
                  )}

                  {/* Fear & Greed Index */}
                  {data.indicators.fearGreedIndex !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Fear & Greed Index</span>
                        <span className="font-bold">{data.indicators.fearGreedIndex}</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${data.indicators.fearGreedIndex}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Extreme Fear: &lt;25</span>
                        <span>Neutral: 45-55</span>
                        <span>Extreme Greed: &gt;75</span>
                      </div>
                    </div>
                  )}

                  {/* Risk Appetite Index */}
                  {data.indicators.riskAppetite !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Risk Appetite Index</span>
                        <span className="font-bold">{data.indicators.riskAppetite}</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${data.indicators.riskAppetite}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Risk Off: &lt;30</span>
                        <span>Neutral: 30-70</span>
                        <span>Risk On: &gt;70</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Pillar 6 - Capital Flows & Positioning */}
              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Database className="h-5 w-5 text-green-600" />
                    Pillar 6 - Capital Flows & Positioning (11% weight)
                  </h3>
                  <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.flows)}/100</span>
                </div>
                <div className="space-y-6">
                  {/* QQQ Options Flow (Call/Put Ratio) */}
                  {data.indicators.qqqOptionsFlow !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">QQQ Options Call/Put Volume Ratio</span>
                        <span className="font-bold">{data.indicators.qqqOptionsFlow.toFixed(2)}</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, (data.indicators.qqqOptionsFlow / 2) * 100)}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Bearish: &lt;0.8</span>
                        <span>Neutral: 0.8-1.2</span>
                        <span>Bullish: &gt;1.5</span>
                      </div>
                    </div>
                  )}

                  {/* Short Interest */}
                  {data.indicators.shortInterest !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">QQQ Short Interest (% of Float)</span>
                        <span className="font-bold">{data.indicators.shortInterest.toFixed(2)}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, (data.indicators.shortInterest / 5) * 100)}%`
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Low: &lt;1%</span>
                        <span>Moderate: 1-2%</span>
                        <span>High: &gt;2%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Options Strategy Guide card */}
      {data && (
        <Card>
          <CardHeader className="bg-muted/50">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Options Strategy Guide by CCPI Crash Risk Level
            </CardTitle>
            <CardDescription>Complete trading playbook across all crash risk regimes</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              
              {/* CCPI 0-19: Low Risk */}
              <div className={`rounded-lg border-2 ${data.ccpi <= 19 ? 'border-green-500 bg-green-50/50' : 'border-gray-200'} p-4`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-700">CCPI: 0-19</span>
                      <span className="text-sm font-bold text-green-700">Low Risk</span>
                    </div>
                    <p className="text-xs text-gray-600">Market shows minimal crash signals. Safe to deploy capital with aggressive strategies.</p>
                  </div>
                  <span className="px-3 py-1 text-xs font-bold bg-green-100 text-green-800 rounded">TRENDING BUY</span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">CCPI</div>
                    <div className="font-bold text-blue-600">0-19%</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">EXPOSURE</div>
                    <div className="font-bold text-purple-600">80-100%</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">POSITION SIZE</div>
                    <div className="font-bold">Large (5-10%)</div>
                  </div>
                </div>
                
                <div className="text-sm">
                  <div className="font-semibold text-gray-700 mb-2">TOP STRATEGIES:</div>
                  <ul className="space-y-1 text-xs text-gray-600">
                    <li>• Sell cash-secured puts at 20-30 delta on SPY/QQQ</li>
                    <li>• Run the wheel strategy on tier traders (NVDA, MSFT, AAPL)</li>
                    <li>• Long ITM LEAPS on 70+ delta for portfolio leverage</li>
                  </ul>
                </div>
              </div>

              {/* CCPI 20-39: Normal */}
              <div className={`rounded-lg border-2 ${data.ccpi >= 20 && data.ccpi <= 39 ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200'} p-4`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-700">CCPI: 20-39</span>
                      <span className="text-sm font-bold text-blue-700">Normal</span>
                    </div>
                    <p className="text-xs text-gray-600">Standard market conditions. Deploy capital with normal risk management protocols.</p>
                  </div>
                  <span className="px-3 py-1 text-xs font-bold bg-gray-100 text-gray-700 rounded">BUY</span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">CCPI</div>
                    <div className="font-bold text-blue-600">15-25%</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">EXPOSURE</div>
                    <div className="font-bold text-purple-600">70-85%</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">POSITION SIZE</div>
                    <div className="font-bold">Medium (3-5%)</div>
                  </div>
                </div>
                
                <div className="text-sm">
                  <div className="font-semibold text-gray-700 mb-2">TOP STRATEGIES:</div>
                  <ul className="space-y-1 text-xs text-gray-600">
                    <li>• Balanced put selling at 20-30 delta on SPY/QQQ</li>
                    <li>• Consider calls for existing positions (45-50 DTE)</li>
                    <li>• Set put spreads over 30-45 calendar days</li>
                  </ul>
                </div>
              </div>

              {/* CCPI 40-59: Hold */}
              <div className={`rounded-lg border-2 ${data.ccpi >= 40 && data.ccpi <= 59 ? 'border-green-500 bg-green-50/50' : 'border-gray-200'} p-4`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-700">CCPI: 40-59</span>
                      <span className="text-sm font-bold text-green-700">Hold</span>
                    </div>
                    <p className="text-xs text-gray-600">Mild signal appearing. Reduce exposure and focus on defensive positioning.</p>
                  </div>
                  <span className="px-3 py-1 text-xs font-bold bg-green-100 text-green-800 rounded">HOLD</span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">CCPI</div>
                    <div className="font-bold text-blue-600">30-40%</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">EXPOSURE</div>
                    <div className="font-bold text-purple-600">50-70%</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">POSITION SIZE</div>
                    <div className="font-bold">Small (1-3%)</div>
                  </div>
                </div>
                
                <div className="text-sm">
                  <div className="font-semibold text-gray-700 mb-2">TOP STRATEGIES:</div>
                  <ul className="space-y-1 text-xs text-gray-600">
                    <li>• VIX to defined-risk strategies (e.g. spreads, iron condors)</li>
                    <li>• Increase VIX call hedges (2-3 month expiry)</li>
                    <li>• Sell put close ratio to avoid assignment</li>
                  </ul>
                </div>
              </div>

              {/* CCPI 60-79: High Alert */}
              <div className={`rounded-lg border-2 ${data.ccpi >= 60 && data.ccpi <= 79 ? 'border-orange-500 bg-orange-50/50' : 'border-gray-200'} p-4`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-700">CCPI: 60-79</span>
                      <span className="text-sm font-bold text-orange-700">High Alert</span>
                    </div>
                    <p className="text-xs text-gray-600">Reduced mode signals. Protect capital and prepare for volatility expansion.</p>
                  </div>
                  <span className="px-3 py-1 text-xs font-bold bg-orange-100 text-orange-800 rounded">CAUTION</span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">CCPI</div>
                    <div className="font-bold text-blue-600">50-60%</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">EXPOSURE</div>
                    <div className="font-bold text-purple-600">30-50%</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">POSITION SIZE</div>
                    <div className="font-bold">Very Small (0.5-1%)</div>
                  </div>
                </div>
                
                <div className="text-sm">
                  <div className="font-semibold text-gray-700 mb-2">TOP STRATEGIES:</div>
                  <ul className="space-y-1 text-xs text-gray-600">
                    <li>• Buy puts back / close insurance (45-60 DTE)</li>
                    <li>• If new position, buy at-the-money protective puts</li>
                    <li>• Close or rollout short option immediately</li>
                  </ul>
                </div>
              </div>

              {/* CCPI 80-100: Crash Watch */}
              <div className={`rounded-lg border-2 ${data.ccpi >= 80 ? 'border-red-500 bg-red-50/50' : 'border-gray-200'} p-4`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-700">CCPI: 80-100</span>
                      <span className="text-sm font-bold text-red-700">Crash Watch</span>
                    </div>
                    <p className="text-xs text-gray-600">Extreme crash risk. Sell all risky capital positions. Prioritize capital preservation.</p>
                  </div>
                  <span className="px-3 py-1 text-xs font-bold bg-red-100 text-red-800 rounded">VIGILANCE</span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">CCPI</div>
                    <div className="font-bold text-blue-600">70-80%</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">EXPOSURE</div>
                    <div className="font-bold text-purple-600">10-30%</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">POSITION SIZE</div>
                    <div className="font-bold">Minimal (0-0.5%)</div>
                  </div>
                </div>
                
                <div className="text-sm">
                  <div className="font-semibold text-gray-700 mb-2">TOP STRATEGIES:</div>
                  <ul className="space-y-1 text-xs text-gray-600">
                    <li>• Aggressive long puts on SPY/QQQ (10-60 DTE)</li>
                    <li>• VIX tail spread to capitalize on volatility spike</li>
                    <li>• Inverse ETFs (SQQQ, SH) at 3-month+ positions</li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                <strong>Note:</strong> The CCPI is most effective when used with technical analysis and portfolio stress testing. OCP scores above 60 historically precede significant drawdowns within 1-4 weeks. Important proper sizing and risk off entries regardless of individual stock circumstances. Consult with a financial advisor for personalized advice.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Portfolio Allocation card */}
      {data && (
        <Card>
          <CardHeader className="bg-muted/50">
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Portfolio Allocation by CCPI Crash Risk Level
            </CardTitle>
            <CardDescription>Recommended asset class diversification across crash risk regimes</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              
              {/* CCPI 0-19: Low Risk */}
              <div className={`rounded-lg border-2 ${data.ccpi <= 19 ? 'border-green-500 bg-green-50/50' : 'border-gray-200'} p-4`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-700">CCPI: 0-19</span>
                      <span className="text-sm font-bold text-green-700">Low Risk</span>
                    </div>
                    <p className="text-xs text-gray-600">Aggressive growth allocation with maximum equity exposure</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-5 gap-3 mb-3 text-sm">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">STOCKS/ETFS</div>
                    <div className="font-bold text-green-700">55-65%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">OPTIONS</div>
                    <div className="font-bold text-purple-700">15-20%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">TECH/CRYPTO</div>
                    <div className="font-bold text-blue-700">8-12%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">BONDS/CASH</div>
                    <div className="font-bold text-gray-700">5-8%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">CASH RESERVE</div>
                    <div className="font-bold text-gray-700">5-10%</div>
                  </div>
                </div>
                
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>• Deploy 70%+ into aggressive long-term growth stocks</li>
                  <li>• Allocate 15-20% to options strategies for leverage and yield</li>
                  <li>• Hold 8-15% for payments across BTC/ETH</li>
                  <li>• Minimal cash reserves (~5 low risk environment)</li>
                  <li>• Keep good execution (3-5%) for insurance policy</li>
                </ul>
              </div>

              {/* CCPI 20-39: Normal */}
              <div className={`rounded-lg border-2 ${data.ccpi >= 20 && data.ccpi <= 39 ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200'} p-4`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-700">CCPI: 20-39</span>
                      <span className="text-sm font-bold text-blue-700">Normal</span>
                    </div>
                    <p className="text-xs text-gray-600">Balanced allocation with standard risk management</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-5 gap-3 mb-3 text-sm">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">STOCKS/ETFS</div>
                    <div className="font-bold text-blue-700">45-55%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">OPTIONS</div>
                    <div className="font-bold text-purple-700">10-15%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">TECH/CRYPTO</div>
                    <div className="font-bold text-blue-700">5-8%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">BONDS/CASH</div>
                    <div className="font-bold text-gray-700">5-8%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">CASH RESERVE</div>
                    <div className="font-bold text-gray-700">15-25%</div>
                  </div>
                </div>
                
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>• Core equity exposure via diversified ETFs and blue chips</li>
                  <li>• Use options for income generation and tactical positioning</li>
                  <li>• Reduce crypto exposure to 5-8% of portfolio</li>
                  <li>• Modest bond/cash layer (15-25%) for downside cushion</li>
                  <li>• Keep options exposure &lt;15% to manage vol</li>
                </ul>
              </div>

              {/* CCPI 40-59: Caution */}
              <div className={`rounded-lg border-2 ${data.ccpi >= 40 && data.ccpi <= 59 ? 'border-green-500 bg-green-50/50' : 'border-gray-200'} p-4`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-700">CCPI: 40-59</span>
                      <span className="text-sm font-bold text-green-700">Caution</span>
                    </div>
                    <p className="text-xs text-gray-600">Defensive tilt with elevated cash and hedges</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-5 gap-3 mb-3 text-sm">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">STOCKS/ETFS</div>
                    <div className="font-bold text-green-700">30-40%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">OPTIONS</div>
                    <div className="font-bold text-purple-700">8-12%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">TECH/CRYPTO</div>
                    <div className="font-bold text-blue-700">3-5%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">BONDS/CASH</div>
                    <div className="font-bold text-gray-700">10-15%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">CASH RESERVE</div>
                    <div className="font-bold text-gray-700">30-40%</div>
                  </div>
                </div>
                
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>• Reduce equity exposure to strictly only</li>
                  <li>• SOE options allocation toward hedges and tail spreads</li>
                  <li>• Trim crypto to absolute minimum (3-5% max)</li>
                  <li>• Increase govt/short (10-15%) as safe haven</li>
                  <li>• Build substantial cash position (30%+) for stability</li>
                </ul>
              </div>

              {/* CCPI 60-79: High Alert */}
              <div className={`rounded-lg border-2 ${data.ccpi >= 60 && data.ccpi <= 79 ? 'border-orange-500 bg-orange-50/50' : 'border-gray-200'} p-4`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-700">CCPI: 60-79</span>
                      <span className="text-sm font-bold text-orange-700">High Alert</span>
                    </div>
                    <p className="text-xs text-gray-600">Capital preservation mode with heavy defensive positioning</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-5 gap-3 mb-3 text-sm">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">STOCKS/ETFS</div>
                    <div className="font-bold text-orange-700">15-25%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">OPTIONS</div>
                    <div className="font-bold text-purple-700">10-15%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">TECH/CRYPTO</div>
                    <div className="font-bold text-blue-700">0-2%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">BONDS/CASH</div>
                    <div className="font-bold text-gray-700">10-20%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">CASH RESERVE</div>
                    <div className="font-bold text-gray-700">50-60%</div>
                  </div>
                </div>
                
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>• Minimal equity exposure - only defensive sectors (utilities, staples)</li>
                  <li>• Options portfolio entirely in crash protective hedges (puts/VIX)</li>
                  <li>• Exit nearly all crypto exposure due to crash risk</li>
                  <li>• Build aggressive flight: 10-20% to protect from crashes</li>
                  <li>• Hold 50-60% cash to deploy after market correction</li>
                </ul>
              </div>

              {/* CCPI 80-100: Crash Watch */}
              <div className={`rounded-lg border-2 ${data.ccpi >= 80 ? 'border-red-500 bg-red-50/50' : 'border-gray-200'} p-4`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-700">CCPI: 80-100</span>
                      <span className="text-sm font-bold text-red-700">Crash Watch</span>
                    </div>
                    <p className="text-xs text-gray-600">Maximum defense - cash out and wait for reset only</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-5 gap-3 mb-3 text-sm">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">STOCKS/ETFS</div>
                    <div className="font-bold text-red-700">5-10%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">OPTIONS</div>
                    <div className="font-bold text-purple-700">10-15%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">TECH/CRYPTO</div>
                    <div className="font-bold text-blue-700">0%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">BONDS/CASH</div>
                    <div className="font-bold text-gray-700">20-25%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">CASH RESERVE</div>
                    <div className="font-bold text-gray-700">70-80%</div>
                  </div>
                </div>
                
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>• Liquidate nearly all equity exposure immediately</li>
                  <li>• Options used exclusively for tail risk hedges and vol spreads</li>
                  <li>• Zero crypto/risky assets - too volatile during crash events</li>
                  <li>• Heavy treasury/safe 20-25% exposure</li>
                  <li>• Hold 70-80% cash to deploy after market reset (20-30% drops)</li>
                </ul>
              </div>

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                <strong>Note:</strong> These allocations represent baseline guidelines for crash risk management. Always size based on your personal risk tolerance, time horizon, and financial goals. CPF areas above 60 warrant significant defensive posturing regardless of individual circumstances. Consult with a financial advisor for personalized advice.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
