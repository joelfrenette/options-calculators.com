"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, TrendingDown, Activity, DollarSign, Users, Database, RefreshCw, Download, Settings, Layers } from 'lucide-react'
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
  apiStatus?: {
    qqqTechnicals: { live: boolean; source: string; lastUpdated: string }
    vixTerm: { live: boolean; source: string; lastUpdated: string }
    marketBreadth: { live: boolean; source: string; lastUpdated: string }
    fred: { live: boolean; source: string; lastUpdated: string }
    alphaVantage: { live: boolean; source: string; lastUpdated: string }
    apify: { live: boolean; source: string; lastUpdated: string }
    fmp: { live: boolean; source: string; lastUpdated: string }
    aaii: { live: boolean; source: string; lastUpdated: string }
    etfFlows: { live: boolean; source: string; lastUpdated: string }
  }
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
      return <Badge className="ml-2 bg-green-100 text-green-800 text-xs">🟢 Live</Badge>
    } else if (source.includes('baseline')) {
      return <Badge className="ml-2 bg-yellow-100 text-yellow-800 text-xs">🟡 Baseline</Badge>
    } else {
      return <Badge className="ml-2 bg-red-100 text-red-800 text-xs">🔴 Failed</Badge>
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
      {/* Header Controls */}
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {data.apiStatus && (
        <Card className="border-2 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">API Data Source Status</CardTitle>
            <CardDescription>Real-time tracking of data sources and API availability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium">QQQ Technicals</span>
                {getStatusBadge(data.apiStatus.qqqTechnicals.live, data.apiStatus.qqqTechnicals.source)}
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium">Market Breadth</span>
                {getStatusBadge(data.apiStatus.marketBreadth.live, data.apiStatus.marketBreadth.source)}
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium">VIX Term Structure</span>
                {getStatusBadge(data.apiStatus.vixTerm.live, data.apiStatus.vixTerm.source)}
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium">FRED Macro</span>
                {getStatusBadge(data.apiStatus.fred.live, data.apiStatus.fred.source)}
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium">Alpha Vantage</span>
                {getStatusBadge(data.apiStatus.alphaVantage.live, data.apiStatus.alphaVantage.source)}
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium">Apify Yahoo</span>
                {getStatusBadge(data.apiStatus.apify.live, data.apiStatus.apify.source)}
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium">FMP</span>
                {getStatusBadge(data.apiStatus.fmp.live, data.apiStatus.fmp.source)}
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium">AAII Sentiment</span>
                {getStatusBadge(data.apiStatus.aaii.live, data.apiStatus.aaii.source)}
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium">ETF Flows</span>
                {getStatusBadge(data.apiStatus.etfFlows.live, data.apiStatus.etfFlows.source)}
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <strong>Legend:</strong> 🟢 Live = Real-time API data | 🟡 Baseline = Historical average/fallback value | 🔴 Failed = API unavailable
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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
              {data.canaries.filter(c => c.severity === "high" || c.severity === "medium").length}/23
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

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Six Pillar Breakdown</CardTitle>
            <CardDescription>Individual stress scores (0-100) across all risk dimensions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pillarChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <ReferenceLine y={60} stroke="orange" strokeDasharray="3 3" label="High Risk" />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
            
            <div className="mt-4 grid grid-cols-2 gap-3">
              {pillarData.map((pillar) => {
                const Icon = pillar.icon
                const severity = pillar.value >= 70 ? "high" : pillar.value >= 50 ? "medium" : "low"
                const color = severity === "high" ? "text-red-600" : severity === "medium" ? "text-orange-500" : "text-green-600"
                
                return (
                  <div key={pillar.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${color}`} />
                      <span className="text-sm font-medium">{pillar.name}</span>
                    </div>
                    <span className={`text-sm font-bold ${color}`}>{pillar.value}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

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
                        <span className="font-bold">{data.indicators.qqqDailyReturn}</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, Math.max(0, (parseFloat(data.indicators.qqqDailyReturn) + 2) / 4 * 100))}%` 
                        }} />
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
                        {/* Gray overlay for unfilled portion */}
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, (data.indicators.buffettIndicator / 200) * 100)}%` 
                        }} />
                        {/* Threshold markers */}
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-[60%] border-r-2 border-gray-400 opacity-30" />
                          <div className="w-[20%] border-r-2 border-gray-400 opacity-30" />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Normal: &lt;120%</span>
                        <span>Warning: 120-160%</span>
                        <span>Extreme: &gt;160%</span>
                      </div>
                    </div>
                  )}

                  {/* S&P 500 P/E */}
                  {data.indicators.spxPE !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">S&P 500 Forward P/E</span>
                        <span className="font-bold">{data.indicators.spxPE}</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        {/* Gray overlay for unfilled portion */}
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
                        {/* Gray overlay for unfilled portion */}
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, ((data.indicators.spxPS - 1) / 2) * 100)}%` 
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Normal: &lt;2.5</span>
                        <span>Elevated: &gt;3.0</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-600" />
                    Pillar 3 - Technical Fragility (10% weight)
                  </h3>
                  <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.technical)}/100</span>
                </div>
                <div className="space-y-6">
                  
                  {/* VIX */}
                  {data.indicators.vix !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">VIX (Volatility Index)</span>
                        <span className="font-bold">{data.indicators.vix}</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, ((data.indicators.vix - 10) / 30) * 100)}%` 
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Calm: 10-15</span>
                        <span>Elevated: 20-30</span>
                        <span>High: &gt;30</span>
                      </div>
                    </div>
                  )}

                  {/* VXN */}
                  {data.indicators.vxn !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">VXN (Nasdaq Volatility)</span>
                        <span className="font-bold">{data.indicators.vxn}</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, ((data.indicators.vxn - 10) / 30) * 100)}%` 
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Calm: 10-15</span>
                        <span>Elevated: 20-30</span>
                        <span>High: &gt;30</span>
                      </div>
                    </div>
                  )}

                  {/* High-Low Index */}
                  {data.indicators.highLowIndex !== undefined && data.indicators.highLowIndex !== null && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">High-Low Index</span>
                        <span className="font-bold">{(data.indicators.highLowIndex * 100).toFixed(2)}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${data.indicators.highLowIndex * 100}%` 
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Weak: &lt;30%</span>
                        <span>Neutral: 30-60%</span>
                        <span>Strong: &gt;60%</span>
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
                        <span>Oversold: &lt;30%</span>
                        <span>Neutral: 30-70%</span>
                        <span>Overbought: &gt;70%</span>
                      </div>
                    </div>
                  )}

                  {/* Left Tail Volatility */}
                  {data.indicators.ltv !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Left Tail Volatility</span>
                        <span className="font-bold">{(data.indicators.ltv * 100).toFixed(2)}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, (data.indicators.ltv * 100))}%` 
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Low: &lt;10%</span>
                        <span>Elevated: 10-20%</span>
                        <span>High: &gt;20%</span>
                      </div>
                    </div>
                  )}

                  {/* ATR */}
                  {data.indicators.atr !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">ATR (Average True Range)</span>
                        <span className="font-bold">{data.indicators.atr}</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, ((data.indicators.atr - 20) / 40) * 100)}%` 
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Low: 20-30</span>
                        <span>Elevated: 40-50</span>
                        <span>High: &gt;50</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-orange-600" />
                    Pillar 4 - Macro & Liquidity Risk (10% weight)
                  </h3>
                  <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.macro)}/100</span>
                </div>
                <div className="space-y-6">
                  
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
                        <span>Accommodative: &lt;2%</span>
                        <span>Neutral: 2-4%</span>
                        <span>Restrictive: &gt;4.5%</span>
                      </div>
                    </div>
                  )}

                  {/* Junk Spread */}
                  {data.indicators.junkSpread !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Junk Bond Spread</span>
                        <span className="font-bold">{data.indicators.junkSpread}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, ((data.indicators.junkSpread - 2) / 8) * 100)}%` 
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Tight: &lt;3%</span>
                        <span>Normal: 3-5%</span>
                        <span>Wide: &gt;6%</span>
                      </div>
                    </div>
                  )}

                  {/* Yield Curve */}
                  {data.indicators.yieldCurve !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Yield Curve (10Y-2Y)</span>
                        <span className="font-bold">{data.indicators.yieldCurve}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, Math.max(0, 100 - ((data.indicators.yieldCurve + 1) / 2) * 100))}%` 
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Normal: &gt;0.5%</span>
                        <span>Flat: 0-0.5%</span>
                        <span>Inverted: &lt;0%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-600" />
                    Pillar 5 - Sentiment & Media Feedback (10% weight)
                  </h3>
                  <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.sentiment)}/100</span>
                </div>
                <div className="space-y-6">
                  
                  {/* AAII Bullish Sentiment */}
                  {data.indicators.aaiiBullish !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">AAII Bullish Sentiment</span>
                        <span className="font-bold">{data.indicators.aaiiBullish}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${data.indicators.aaiiBullish}%` 
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Bearish: &lt;30%</span>
                        <span>Neutral: 30-50%</span>
                        <span>Euphoric: &gt;50%</span>
                      </div>
                    </div>
                  )}

                  {/* AAII Bearish Sentiment */}
                  {data.indicators.aaiiBearish !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">AAII Bearish Sentiment</span>
                        <span className="font-bold">{data.indicators.aaiiBearish}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${data.indicators.aaiiBearish}%` 
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Complacent: &lt;20%</span>
                        <span>Normal: 20-35%</span>
                        <span>Fearful: &gt;35%</span>
                      </div>
                    </div>
                  )}

                  {/* Put/Call Ratio */}
                  {data.indicators.putCallRatio !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Put/Call Ratio</span>
                        <span className="font-bold">{data.indicators.putCallRatio}</span>
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
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${data.indicators.fearGreedIndex}%` 
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Fear: &lt;30</span>
                        <span>Neutral: 30-70</span>
                        <span>Greed: &gt;70</span>
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
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${data.indicators.riskAppetite}%` 
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Risk-Off: &lt;30</span>
                        <span>Neutral: 30-70</span>
                        <span>Risk-On: &gt;70</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-teal-600" />
                    Pillar 6 - Capital Flows & Positioning (10% weight)
                  </h3>
                  <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.flows)}/100</span>
                </div>
                <div className="space-y-6">
                  
                  {/* ETF Flows */}
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
                        <span>Outflows: &lt;-$2B</span>
                        <span>Neutral: -$2B to $2B</span>
                        <span>Inflows: &gt;$2B</span>
                      </div>
                    </div>
                  )}

                  {/* Short Interest */}
                  {data.indicators.shortInterest !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Short Interest (% of Float)</span>
                        <span className="font-bold">{data.indicators.shortInterest}%</span>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                        <div className="absolute inset-0 bg-gray-200" style={{ 
                          marginLeft: `${Math.min(100, (data.indicators.shortInterest / 30) * 100)}%` 
                        }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Complacent: &lt;15%</span>
                        <span>Normal: 15-20%</span>
                        <span>Hedged: &gt;20%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Updated formula weights to include QQQ Technicals and renumbered */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-sm mb-3 text-blue-900">CCPI Formula Weights</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">QQQ Technicals:</span>
                    <span className="font-bold text-blue-900">30%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">Valuation:</span>
                    <span className="font-bold text-blue-900">23%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">Technical:</span>
                    <span className="font-bold text-blue-900">12%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">Macro:</span>
                    <span className="font-bold text-blue-900">12%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">Sentiment:</span>
                    <span className="font-bold text-blue-900">12%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">Flows:</span>
                    <span className="font-bold text-blue-900">11%</span>
                  </div>
                </div>
                <p className="text-xs text-blue-700 mt-3">
                  Final CCPI = Σ(Pillar Score × Weight). Each pillar score (0-100) is calculated from multiple professional indicators with specific thresholds.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                    "Deploy capital<bos>aggressively into quality tech growth stocks",
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
    </div>
  )
}
