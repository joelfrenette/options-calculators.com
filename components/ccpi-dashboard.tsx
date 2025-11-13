"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, TrendingDown, Activity, DollarSign, Users, Database, RefreshCw, Download, Settings } from 'lucide-react'
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
  const [activeView, setActiveView] = useState<"ai" | "broad">("ai")

  useEffect(() => {
    fetchData()
    fetchHistory()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/ccpi")
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error("[v0] Failed to fetch CCPI data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async () => {
    try {
      const response = await fetch("/api/ccpi/history")
      const result = await response.json()
      setHistory(result)
    } catch (error) {
      console.error("[v0] Failed to fetch CCPI history:", error)
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-gray-600">Computing CCPI scores...</p>
        </div>
      </div>
    )
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

  const pillarData = [
    { name: "Valuation", value: data.pillars.valuation, icon: DollarSign },
    { name: "Technical", value: data.pillars.technical, icon: Activity },
    { name: "Macro", value: data.pillars.macro, icon: TrendingDown },
    { name: "Sentiment", value: data.pillars.sentiment, icon: Users },
    { name: "Flows", value: data.pillars.flows, icon: TrendingDown },
    { name: "Structural", value: data.pillars.structural, icon: Database }
  ]

  const zone = getRegimeZone(data.ccpi)
  const ccpiScore = data.ccpi

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "ai" | "broad")}>
            <TabsList>
              <TabsTrigger value="ai">AI Sector Focus</TabsTrigger>
              <TabsTrigger value="broad">Broader Market</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
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
            <h3 className="text-sm font-semibold mb-2 text-gray-700">CCPI Historical Scale</h3>
            <p className="text-xs text-gray-500 mb-3">
              Visual representation of crash risk zones from low risk to crash watch
            </p>
            
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
              <p className="text-5xl font-bold mb-2" style={{ color: data.regime.color }}>
                {data.ccpi}
              </p>
              <p className="text-xs text-gray-500">0 = No risk, 100 = Imminent crash</p>
            </div>
            
            <div className="text-center p-6 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Certainty Score</p>
              <p className="text-5xl font-bold mb-2 text-blue-600">{data.certainty}</p>
              <p className="text-xs text-gray-500">Signal consistency & alignment</p>
            </div>
            
            <div className="text-center p-6 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Current Regime</p>
              <p className="text-2xl font-bold mb-1" style={{ color: data.regime.color }}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pillar Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Six Pillar Breakdown</CardTitle>
            <CardDescription>Individual stress scores (0-100) across all risk dimensions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pillarData}>
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

        {/* Canaries in the Coal Mine */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Canaries in the Coal Mine
            </CardTitle>
            <CardDescription>Top warning signals currently active</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.canaries.map((canary, i) => {
                const severityColor = {
                  high: "bg-red-100 text-red-800 border-red-300",
                  medium: "bg-orange-100 text-orange-800 border-orange-300",
                  low: "bg-yellow-100 text-yellow-800 border-yellow-300"
                }[canary.severity]
                
                return (
                  <div key={i} className={`p-3 rounded border ${severityColor}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {canary.pillar}
                      </Badge>
                      <Badge variant={canary.severity === "high" ? "destructive" : "secondary"} className="text-xs">
                        {canary.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{canary.signal}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historical Chart */}
      <Card>
        <CardHeader>
          <CardTitle>CCPI & Certainty History (24 Months)</CardTitle>
          <CardDescription>Track score evolution and regime transitions over time</CardDescription>
        </CardHeader>
        <CardContent>
          {history && (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={history.history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <ReferenceLine y={20} stroke="#84cc16" strokeDasharray="3 3" label="Normal" />
                <ReferenceLine y={40} stroke="#eab308" strokeDasharray="3 3" label="Caution" />
                <ReferenceLine y={60} stroke="#f97316" strokeDasharray="3 3" label="High Alert" />
                <ReferenceLine y={80} stroke="#dc2626" strokeDasharray="3 3" label="Crash Watch" />
                <Line type="monotone" dataKey="ccpi" stroke="#3b82f6" strokeWidth={2} name="CCPI Score" />
                <Line type="monotone" dataKey="certainty" stroke="#8b5cf6" strokeWidth={2} name="Certainty Score" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Options Playbook */}
      <Card>
        <CardHeader>
          <CardTitle>Options & Risk Management Playbook</CardTitle>
          <CardDescription>Regime-based trading strategies and portfolio allocation guidance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">Trading Bias</h4>
                <Badge variant="secondary" className="text-sm">
                  {data.playbook.bias}
                </Badge>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h5 className="text-sm font-semibold mb-2 text-gray-700">Suggested Strategies:</h5>
                <ul className="space-y-2">
                  {data.playbook.strategies.map((strategy, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-primary font-bold mt-0.5">→</span>
                      <span>{strategy}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Portfolio Allocation Guidelines</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(data.playbook.allocation).map(([key, value]) => (
                  <div key={key} className="p-3 bg-gray-50 rounded-lg border">
                    <p className="text-xs text-gray-600 mb-1 capitalize">{key}</p>
                    <p className="text-sm font-bold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                <strong>Educational Only:</strong> This playbook provides general strategy ideas based on the current CCPI regime. 
                It is not personalized financial advice. Options trading involves substantial risk of loss. Always conduct your own 
                due diligence and consult with qualified financial professionals before making investment decisions.
              </p>
            </div>
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
