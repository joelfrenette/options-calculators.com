"use client"

import { useState, useEffect } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingDown, AlertTriangle, Activity, DollarSign, BarChart3, Users } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Download } from "lucide-react"
import { RefreshButton } from "@/components/ui/refresh-button"

interface CCPIData {
  ccpi: number
  baseCCPI?: number
  crashAmplifiers?: Array<{ reason: string; points: number }>
  totalBonus?: number
  certainty: number
  pillars: {
    momentum: number // NEW: Pillar 1 - Momentum & Technical (40%)
    riskAppetite: number // NEW: Pillar 2 - Risk Appetite (30%)
    valuation: number // NEW: Pillar 3 - Valuation (20%)
    macro: number // Pillar 4 - Macro (10%)
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
    indicatorWeight?: number
    pillarWeight?: number
    impactScore?: number
  }>
  indicators?: Record<string, any>
  apiStatus?: Record<string, { live: boolean; source: string }> // Updated for clarity
  timestamp: string
  totalIndicators?: number // Added for the canary count display
  cachedAt?: string // Added cache timestamp
  lastUpdated?: string // Added for last updated timestamp
}

interface HistoricalData {
  history: Array<{
    date: string
    ccpi: number
    certainty: number
  }>
}

export default function CcpiDashboard({ symbol = "SPY" }: { symbol?: string }) {
  const [data, setData] = useState<CCPIData | null>(null)
  const [history, setHistory] = useState<HistoricalData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [executiveSummary, setExecutiveSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const [refreshProgress, setRefreshProgress] = useState(0)
  const [refreshStatus, setRefreshStatus] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  const getReadableColor = (colorName: string): string => {
    const colorMap: Record<string, string> = {
      green: "#16a34a", // Green for low risk
      lime: "#65a30d", // Lime for normal
      yellow: "#f97316", // Orange instead of yellow for better readability
      orange: "#f97316", // Orange for caution
      red: "#dc2626", // Red for high alert/crash watch
    }
    return colorMap[colorName] || "#6b7280" // Default to gray if color not found
  }

  const getBarColor = (percentage: number): string => {
    if (percentage <= 33) return "#22c55e" // green-500
    if (percentage <= 66) return "#eab308" // yellow-500
    return "#ef4444" // red-500
  }

  const getStatusBadge = (live: boolean, source: string) => {
    if (live) {
      return (
        <Badge className="ml-2 bg-green-500 text-white text-xs flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-white"></span>
          Live
        </Badge>
      )
    } else if (source.includes("baseline") || source.includes("fallback") || source.includes("historical")) {
      return (
        <Badge className="ml-2 bg-amber-500 text-white text-xs flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-white"></span>
          Baseline
        </Badge>
      )
    } else {
      return (
        <Badge className="ml-2 bg-red-500 text-white text-xs flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-white"></span>
          Failed
        </Badge>
      )
    }
  }

  useEffect(() => {
    const loadInitialData = async () => {
      const cached = localStorage.getItem("ccpi-data")
      if (cached) {
        try {
          const parsedCache = JSON.parse(cached)
          console.log("[v0] CCPI: Loaded from localStorage", parsedCache.timestamp)
          console.log("[v0] CCPI: Cached crash amplifiers:", parsedCache.crashAmplifiers)
          console.log("[v0] CCPI: Cached totalBonus:", parsedCache.totalBonus)
          console.log("[v0] CCPI: Cached baseCCPI:", parsedCache.baseCCPI)
          setData(parsedCache)
        } catch (e) {
          console.error("[v0] Failed to parse cached CCPI data:", e)
        }
      }

      console.log("[v0] CCPI: Fetching fresh data from API...")
      await fetchCCPIData()
    }

    loadInitialData()
  }, [])

  const fetchCCPIData = async () => {
    try {
      setIsRefreshing(true)
      setLoading(true)
      setRefreshProgress(5)
      setRefreshStatus("Initializing CCPI calculation...")
      setError(null)

      // Simulate progress updates (in reality, the API would stream these)
      const progressInterval = setInterval(() => {
        setRefreshProgress((prev) => {
          if (prev >= 90) return prev
          return prev + Math.random() * 8
        })
        setRefreshStatus((prev) => {
          const messages = [
            "Fetching market data...",
            "Analyzing technical indicators...",
            "Computing sentiment metrics...",
            "Evaluating valuation signals...",
            "Processing macro indicators...",
            "Calculating CCPI score...",
          ]
          return messages[Math.floor(Math.random() * messages.length)]
        })
      }, 800)

      const response = await fetch("/api/ccpi")

      clearInterval(progressInterval)
      setRefreshProgress(100)
      setRefreshStatus("Complete!")

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      console.log("[v0] CCPI Data Loaded:", {
        ccpi: result.ccpi,
        certainty: result.certainty,
        regime: result.regime.name,
        pillars: result.pillars,
        activeCanaries: result.canaries.filter((c: any) => c.severity === "high" || c.severity === "medium").length,
        totalIndicators: result.totalIndicators || 34,
        crashAmplifiers: result.crashAmplifiers?.length || 0,
        totalBonus: result.totalBonus || 0,
      })
      console.log("[v0] CCPI: crashAmplifiers from API:", result.crashAmplifiers)
      console.log("[v0] CCPI: totalBonus from API:", result.totalBonus)
      console.log("[v0] CCPI: baseCCPI from API:", result.baseCCPI)
      console.log("[v0] Pillar Breakdown (weighted contribution to CCPI):")
      console.log("  Momentum:", result.pillars.momentum, "× 35% =", (result.pillars.momentum * 0.35).toFixed(1))
      console.log(
        "  Risk Appetite:",
        result.pillars.riskAppetite,
        "× 30% =",
        (result.pillars.riskAppetite * 0.3).toFixed(1),
      )
      console.log("  Valuation:", result.pillars.valuation, "× 15% =", (result.pillars.valuation * 0.15).toFixed(1))
      console.log("  Macro:", result.pillars.macro, "× 20% =", (result.pillars.macro * 0.2).toFixed(1))

      const calculatedCCPI =
        result.pillars.momentum * 0.35 +
        result.pillars.riskAppetite * 0.3 +
        result.pillars.valuation * 0.15 +
        result.pillars.macro * 0.2
      console.log("  Calculated CCPI:", calculatedCCPI.toFixed(1), "| API CCPI:", result.ccpi)

      const cachedData = {
        ...result,
        timestamp: new Date().toISOString(),
      }

      setData(cachedData)

      try {
        localStorage.setItem("ccpi-data", JSON.stringify(cachedData))
        console.log("[v0] CCPI data saved to localStorage")
      } catch (storageError) {
        console.error("[v0] Failed to save to localStorage:", storageError)
      }

      try {
        await fetch("/api/ccpi/cache", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cachedData),
        })
        console.log("[v0] CCPI data cached to API")
      } catch (cacheError) {
        console.error("[v0] Failed to cache CCPI data:", cacheError)
      }

      await fetchExecutiveSummary(cachedData)
    } catch (error) {
      console.error("[v0] CCPI API error:", error)
      setError(error instanceof Error ? error.message : "Failed to load CCPI data")
    } finally {
      setIsRefreshing(false)
      setLoading(false)
      setRefreshProgress(0)
      setRefreshStatus("")
    }
  }

  const fetchExecutiveSummary = async (ccpiData: CCPIData) => {
    try {
      setSummaryLoading(true)
      const response = await fetch("/api/admin/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ccpi: ccpiData.ccpi,
          certainty: ccpiData.certainty,
          activeCanaries: ccpiData.canaries.filter((c) => c.severity === "high" || c.severity === "medium").length,
          totalIndicators: ccpiData.totalIndicators || 34,
          regime: ccpiData.regime,
          pillars: ccpiData.pillars,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setExecutiveSummary(result.summary)
        console.log("[v0] Grok executive summary generated:", result.summary)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch executive summary:", error)
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

  const sortCanaries = (canaries: CCPIData["canaries"]) => {
    return [...canaries].sort((a, b) => {
      // First sort by severity: high before medium before low
      if (a.severity === "high" && b.severity !== "high") return -1
      if (a.severity !== "high" && b.severity === "high") return 1
      if (a.severity === "medium" && b.severity === "low") return -1
      if (a.severity === "low" && b.severity === "medium") return 1

      // Within same severity, sort by impact score descending
      const impactA = a.impactScore ?? 0
      const impactB = b.impactScore ?? 0
      return impactB - impactA
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-gray-600">Loading CCPI data...</p>
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
          <Button variant="outline" onClick={fetchCCPIData} className="mt-4 bg-transparent">
            {" "}
            {/* Changed to fetchCCPIData */}
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

  const getIndicatorStatus = (value: number, thresholds: { low: number; high: number; ideal?: number }) => {
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
    { name: "Pillar 1 - Momentum & Technical", value: data.pillars.momentum, weight: "35%", icon: Activity },
    {
      name: "Pillar 2 - Risk Appetite & Volatility",
      value: data.pillars.riskAppetite,
      weight: "30%",
      icon: TrendingDown,
    },
    { name: "Pillar 3 - Valuation", value: data.pillars.valuation, weight: "15%", icon: DollarSign },
    { name: "Pillar 4 - Macro", value: data.pillars.macro, weight: "20%", icon: Users },
  ]

  const pillarChartData = pillarData.map((pillar, index) => ({
    name: `Pillar ${index + 1}`,
    fullName: pillar.name,
    value: pillar.value,
    weight: pillar.weight,
    icon: pillar.icon,
  }))

  const zone = getRegimeZone(data.ccpi)
  const ccpiScore = data.ccpi

  return (
    <TooltipProvider delayDuration={300}>
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-2">
          <div
            className="h-full bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 transition-all duration-300 ease-out"
            style={{ width: `${refreshProgress}%` }}
          />
        </div>
      )}

      {isRefreshing && refreshStatus && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 text-white px-6 py-3 rounded-full shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 animate-spin" />
            <span className="font-medium">{refreshStatus}</span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Comprehensive Crash Prediction Index (CCPI)</h2>
            <p className="text-muted-foreground">Real-time market crash risk assessment across 4 key dimensions</p>
            {data?.lastUpdated && (
              <p className="text-xs text-muted-foreground mt-1">
                Last updated: {new Date(data.lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tooltips</span>
              <button
                onClick={() => setTooltipsEnabled(!tooltipsEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  tooltipsEnabled ? "bg-blue-600" : "bg-gray-300"
                }`}
                aria-label="Toggle tooltips"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    tooltipsEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <RefreshButton onClick={fetchCCPIData} isLoading={isRefreshing} loadingText="Refreshing..." />{" "}
            {/* Changed to fetchCCPIData */}
          </div>
        </div>

        {/* Original progress card removed as it's replaced by the fixed bar and status message */}

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
              <div className="pt-0">
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
                        <button className="text-gray-400 hover:text-gray-600"></button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs p-3">
                        <p className="font-semibold mb-2">Certainty Calculation</p>
                        <p className="text-xs leading-relaxed">
                          Based on pillar alignment variance (
                          {Math.round(
                            ((100 -
                              (Math.max(...Object.values(data.pillars)) - Math.min(...Object.values(data.pillars)))) /
                              100) *
                              70,
                          )}
                          % weight) and canary agreement (
                          {Math.round(
                            (data.canaries.filter((c) => c.severity === "high" || c.severity === "medium").length /
                              15) *
                              30,
                          )}
                          % weight), adjusted for historical accuracy (82% backtest).
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
                {summaryLoading && <Activity className="h-4 w-4 animate-spin text-blue-600" />}
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
                <ul className="space-y-1">{data.summary.bullets.map((bullet, i) => null)}</ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Crash Amplifiers Card - Only show if bonus > 0 */}
        {data.crashAmplifiers && data.crashAmplifiers.length > 0 && (
          <Card className="border-4 border-red-600 bg-gradient-to-r from-red-50 to-orange-50 shadow-2xl animate-pulse">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-red-700">
                <AlertTriangle className="h-6 w-6 text-red-600 animate-pulse" />🚨 CRASH AMPLIFIERS ACTIVE +
                {data.totalBonus || 0} BONUS POINTS
              </CardTitle>
              <CardDescription className="text-red-700 font-medium">
                {data.baseCCPI && data.totalBonus
                  ? `Multiple extreme crash signals detected - CCPI boosted from ${data.baseCCPI} to ${data.ccpi}`
                  : "Multiple extreme crash signals detected"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.crashAmplifiers?.map((amp, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border-2 border-red-300"
                  >
                    <span className="text-sm font-semibold text-red-900">{amp.reason}</span>
                    <Badge className="bg-red-600 text-white text-base font-bold">+{amp.points}</Badge>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-red-100 border-2 border-red-400 rounded-lg">
                <p className="text-sm text-red-900 font-bold">
                  ⚠️ CRASH AMPLIFIERS = Short-term (1-14 day) indicators that trigger 10%+ corrections. Maximum bonus
                  capped at +100 points to prevent over-signaling.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Canary Cards */}
        <Card className="border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-red-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-xl">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
                Canaries in the Coal Mine - Active Warning Signals
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-sm">
                        These are the individual signals across all pillars that are currently in warning territory,
                        automatically updating with each page load. Each canary card shows which specific indicator is
                        flashing red and contributing to crash risk.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <div className="text-3xl font-bold text-orange-600">
                {data.canaries.filter((c) => c.severity === "high" || c.severity === "medium").length}/
                {data.totalIndicators || 34}
              </div>
            </div>
            <CardDescription className="text-base mt-2">
              Last Updated: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : "Loading..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {sortCanaries(data.canaries)
                .filter((canary) => canary.severity === "high" || canary.severity === "medium")
                .map((canary, i) => {
                  const severityConfig = {
                    high: {
                      bgColor: "bg-red-100",
                      textColor: "text-red-900",
                      borderColor: "border-red-400",
                      badgeColor: "bg-red-600 text-white",
                      label: "HIGH RISK",
                    },
                    medium: {
                      bgColor: "bg-yellow-100",
                      textColor: "text-yellow-900",
                      borderColor: "border-yellow-400",
                      badgeColor: "bg-yellow-600 text-white",
                      label: "MEDIUM RISK",
                    },
                  }[canary.severity]

                  return (
                    <div
                      key={i}
                      className={`flex-1 min-w-[280px] p-4 rounded-lg border-2 ${severityConfig.bgColor} ${severityConfig.borderColor}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant="outline" className="text-xs font-semibold">
                          {canary.pillar}
                        </Badge>
                        <div className="flex items-center gap-2">
                          {canary.impactScore !== undefined && (
                            <span className="text-xs font-mono text-muted-foreground">
                              Impact: {canary.impactScore.toFixed(2)}
                            </span>
                          )}
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-md ${severityConfig.badgeColor} shadow-sm whitespace-nowrap`}
                          >
                            {severityConfig.label}
                          </span>
                        </div>
                      </div>
                      {/* Added tooltip to each canary card */}
                      <div className="flex items-start gap-2">
                        <p className={`text-sm font-semibold ${severityConfig.textColor} flex-1`}>{canary.signal}</p>
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help flex-shrink-0 mt-0.5" />
                            </TooltipTrigger>
                            <TooltipContent
                              className={`max-w-xs ${canary.severity === "high" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}
                            >
                              <p className="font-semibold mb-1">{canary.signal}</p>
                              <p className="text-sm">
                                {canary.severity === "high"
                                  ? "This indicator has breached a critical threshold, signaling elevated crash risk. Historical data shows increased volatility when this condition persists."
                                  : "This indicator is showing warning signs. While not critical yet, it suggests increasing caution and risk monitoring."}
                              </p>
                              {canary.indicatorWeight !== undefined && canary.pillarWeight !== undefined && (
                                <p className="text-xs font-medium mt-2">
                                  Indicator Weight: {canary.indicatorWeight}/100 in pillar
                                  <br />
                                  Pillar Weight: {canary.pillarWeight}% of CCPI
                                  <br />
                                  Combined Impact: {canary.impactScore?.toFixed(2)}
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
            {data.canaries.filter((c) => c.severity === "high" || c.severity === "medium").length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-green-700 font-medium">No medium or high severity warnings detected</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Four Pillars - Collapsible Breakdown */}
        <Accordion
          type="multiple"
          defaultValue={["pillar1", "pillar2", "pillar3", "pillar4"]}
          className="space-y-4 pb-6 border-b border-gray-200"
        >
          {/* Pillar 1 - Momentum & Technical */}
          <AccordionItem value="pillar1" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-10">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-cyan-600" />
                  <span className="text-lg font-semibold">Pillar 1 - Momentum & Technical</span>
                  <span className="text-sm text-gray-600">Weight: 35% | 12 indicators</span>
                </div>
                <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.momentum)}/100</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6 pt-4">
                {/* NVIDIA Momentum Score */}
                {data.indicators?.nvidiaPrice !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        NVIDIA Momentum Score (AI Bellwether)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">NVIDIA Momentum Score</p>
                              <p className="text-sm">
                                Tracks NVIDIA's price momentum as a bellwether for AI sector health and tech leadership.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{">"}80:</strong> Strong AI sector momentum, low crash risk
                                </li>
                                <li>
                                  <strong>40-60:</strong> Neutral momentum, moderate risk
                                </li>
                                <li>
                                  <strong>{"<"}20:</strong> Falling momentum, tech crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> NVIDIA weakness often precedes broader tech selloffs
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">
                        ${data.indicators.nvidiaPrice.toFixed(0)} | {data.indicators.nvidiaMomentum}/100
                      </span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${data.indicators.nvidiaMomentum}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Strong: {">"}80</span>
                      <span>Neutral: 40-60</span>
                      <span>Falling: {"<"}20 (Tech crash risk)</span>
                    </div>
                  </div>
                )}

                {/* SOX Semiconductor Index */}
                {data.indicators?.soxIndex !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        SOX Semiconductor Index (Chip Sector Health)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">SOX Semiconductor Index</p>
                              <p className="text-sm">
                                Measures the health of the semiconductor industry, a critical leading indicator for tech
                                sector performance.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{">"}5500:</strong> Strong chip sector, bullish for tech
                                </li>
                                <li>
                                  <strong>~5000:</strong> Baseline level, neutral risk
                                </li>
                                <li>
                                  <strong>{"<"}4500:</strong> Weak chip demand, tech crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Chip weakness signals broader tech sector vulnerability
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.soxIndex.toFixed(0)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${100 - Math.min(100, Math.max(0, ((data.indicators.soxIndex - 4000) / 2000) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Strong: {">"}5500</span>
                      <span>Baseline: 5000</span>
                      <span>Weak: {"<"}4500</span>
                    </div>
                  </div>
                )}

                {/* QQQ Daily Return */}
                {data.indicators?.qqqDailyReturn !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to QQQ Daily Return indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        QQQ Daily Return (5× downside amplifier)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">QQQ Daily Return</p>
                              <p className="text-sm">Tracks the daily percentage change in the Nasdaq-100 ETF (QQQ).</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{">"} +1%:</strong> Strong bullish momentum, low crash risk
                                </li>
                                <li>
                                  <strong>-1% to +1%:</strong> Neutral momentum, moderate risk
                                </li>
                                <li>
                                  <strong>{"<"} -1%:</strong> Bearish momentum, increased crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Large negative moves indicate selling pressure and risk-off
                                sentiment
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span
                        className={`font-bold ${Number.parseFloat(data.indicators.qqqDailyReturn) > 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {data.indicators.qqqDailyReturn}
                      </span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, ((Number.parseFloat(data.indicators.qqqDailyReturn) + 2) / 4) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Down: {"<"}-1%</span>
                      <span>Flat: -1% to +1%</span>
                      <span>Up: {">"} +1%</span>
                    </div>
                  </div>
                )}

                {/* Consecutive Down Days */}
                {data.indicators?.qqqConsecDown !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Consecutive Down Days indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        QQQ Consecutive Down Days
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">Consecutive Down Days</p>
                              <p className="text-sm">Counts how many trading days in a row QQQ has closed lower.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>0-1 days:</strong> Healthy market, minimal crash risk
                                </li>
                                <li>
                                  <strong>2-3 days:</strong> Warning sign, increasing risk
                                </li>
                                <li>
                                  <strong>4+ days:</strong> Dangerous selling pressure, high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Extended selling streaks often precede larger corrections or
                                crashes
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.qqqConsecDown} days</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.qqqConsecDown / 5) * 100)}%`,
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
                    {/* Added tooltip to QQQ Below 20-Day SMA indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        QQQ Below 20-Day SMA
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">20-Day Simple Moving Average</p>
                              <p className="text-sm">
                                Short-term trend indicator. Breach signals near-term momentum shift.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>Above SMA20:</strong> Bullish short-term trend, low risk
                                </li>
                                <li>
                                  <strong>Near SMA20 (50%):</strong> Testing support, moderate risk
                                </li>
                                <li>
                                  <strong>Below SMA20:</strong> Bearish short-term trend, elevated risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Breaking below 20-day SMA often triggers technical selling
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {data.indicators?.qqqSMA20Proximity !== undefined && (
                          <span className="text-xs font-semibold text-orange-600">
                            {data.indicators.qqqSMA20Proximity.toFixed(0)}% proximity
                          </span>
                        )}
                        <span
                          className={`font-bold ${data.indicators.qqqBelowSMA20 ? "text-red-600" : "text-green-600"}`}
                        >
                          {data.indicators.qqqBelowSMA20 ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${data.indicators?.qqqSMA20Proximity || 0}%`,
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
                    {/* Added tooltip to QQQ Below 50-Day SMA indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        QQQ Below 50-Day SMA
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">50-Day Simple Moving Average</p>
                              <p className="text-sm">
                                Medium-term trend indicator. Key support level watched by institutions.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>Above SMA50:</strong> Healthy medium-term trend, low risk
                                </li>
                                <li>
                                  <strong>Near SMA50 (50%):</strong> Critical support test, moderate risk
                                </li>
                                <li>
                                  <strong>Below SMA50:</strong> Broken support, high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Breaking below 50-day SMA signals weakening trend and triggers
                                institutional selling
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {data.indicators?.qqqSMA50Proximity !== undefined && (
                          <span className="text-xs font-semibold text-orange-600">
                            {data.indicators.qqqSMA50Proximity.toFixed(0)}% proximity
                          </span>
                        )}
                        <span
                          className={`font-bold ${data.indicators.qqqBelowSMA50 ? "text-red-600" : "text-green-600"}`}
                        >
                          {data.indicators.qqqBelowSMA50 ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${data.indicators?.qqqSMA50Proximity || 0}%`,
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

                {/* Below SMA200 */}
                {data.indicators?.qqqBelowSMA200 !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to QQQ Below 200-Day SMA indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        QQQ Below 200-Day SMA
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">200-Day Simple Moving Average</p>
                              <p className="text-sm">
                                Long-term trend indicator and major support/resistance. Most critical technical level.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>Above SMA200:</strong> Bull market confirmed, low crash risk
                                </li>
                                <li>
                                  <strong>Near SMA200 (50%):</strong> Major support test, elevated risk
                                </li>
                                <li>
                                  <strong>Below SMA200:</strong> Bear market territory, very high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Breaking below 200-day SMA historically precedes major market
                                crashes
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {data.indicators?.qqqSMA200Proximity !== undefined && (
                          <span className="text-xs font-semibold text-orange-600">
                            {data.indicators.qqqSMA200Proximity.toFixed(0)}% proximity
                          </span>
                        )}
                        <span
                          className={`font-bold ${data.indicators.qqqBelowSMA200 ? "text-red-600" : "text-green-600"}`}
                        >
                          {data.indicators.qqqBelowSMA200 ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${data.indicators?.qqqSMA200Proximity || 0}%`,
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
                    {/* Added tooltip to QQQ Below Bollinger Band indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        QQQ Below Bollinger Band (Lower)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">Bollinger Band (Lower)</p>
                              <p className="text-sm">
                                Volatility-based indicator showing 2 standard deviations below 20-day average.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>Above band:</strong> Normal trading, low risk
                                </li>
                                <li>
                                  <strong>Near band (50%):</strong> Approaching oversold, moderate risk
                                </li>
                                <li>
                                  <strong>Below band:</strong> Oversold/panic selling, high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Breaking below lower band signals extreme volatility and
                                potential capitulation
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {data.indicators?.qqqBollingerProximity !== undefined && (
                          <span className="text-xs font-semibold text-orange-600">
                            {data.indicators.qqqBollingerProximity.toFixed(0)}% proximity
                          </span>
                        )}
                        <span
                          className={`font-bold ${data.indicators.qqqBelowBollinger ? "text-red-600" : "text-green-600"}`}
                        >
                          {data.indicators.qqqBelowBollinger ? "YES - OVERSOLD" : "NO"}
                        </span>
                      </div>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${data.indicators?.qqqBollingerProximity || 0}%`,
                        }}
                      />
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
                      <span className="font-medium flex items-center gap-1">
                        QQQ Death Cross (SMA50 {"<"} SMA200)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-red-50 border-red-200">
                              <p className="font-semibold mb-1">Death Cross</p>
                              <p className="text-sm">
                                A death cross occurs when the 50-day moving average crosses below the 200-day moving
                                average, signaling long-term bearish momentum.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>NO (Golden Cross):</strong> 50-day above 200-day = Bullish trend, low risk
                                </li>
                                <li>
                                  <strong>YES (Death Cross):</strong> 50-day below 200-day = Bearish trend, high crash
                                  risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Death crosses historically precede extended market declines and
                                crashes
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span
                        className={`font-bold ${data.indicators.qqqDeathCross ? "text-red-600" : "text-green-600"}`}
                      >
                        {data.indicators.qqqDeathCross ? "YES - DANGER" : "NO"}
                      </span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: data.indicators.qqqDeathCross ? "100%" : "0%",
                        }}
                      />
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
                      <span className="font-medium flex items-center gap-1">
                        VIX (Fear Gauge)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">VIX - Fear Gauge</p>
                              <p className="text-sm">
                                The CBOE Volatility Index measures market expectations of 30-day forward volatility from
                                S&P 500 options.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"}15:</strong> Calm market, complacency risk
                                </li>
                                <li>
                                  <strong>15-25:</strong> Elevated fear, normal volatility
                                </li>
                                <li>
                                  <strong>{">"}25:</strong> Fear/panic mode, high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Rising VIX indicates increasing fear and crash probability
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.vix.toFixed(1)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.vix / 50) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Calm: {"<"}15</span>
                      <span>Elevated: 15-25</span>
                      <span>Fear: {">"}25</span>
                    </div>
                  </div>
                )}

                {/* VXN */}
                {data.indicators.vxn !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        VXN (Nasdaq Volatility)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">VXN - Nasdaq Volatility</p>
                              <p className="text-sm">
                                Measures expected volatility in the Nasdaq-100, tracking tech sector fear levels.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"}15:</strong> Calm tech market, low risk
                                </li>
                                <li>
                                  <strong>15-25:</strong> Elevated volatility, caution
                                </li>
                                <li>
                                  <strong>{">"}35:</strong> Tech panic mode, crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> High VXN signals tech sector instability and selloff risk
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.vxn.toFixed(1)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.vxn / 50) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Calm: {"<"}15</span>
                      <span>Elevated: 15-25</span>
                      <span>Panic: {">"}35</span>
                    </div>
                  </div>
                )}

                {/* RVX */}
                {data.indicators.rvx !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        RVX (Russell 2000 Volatility)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">RVX - Russell 2000 Volatility</p>
                              <p className="text-sm">
                                Measures expected volatility in small-cap stocks (Russell 2000), indicating broader
                                market stress.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"}18:</strong> Low small-cap volatility, stable
                                </li>
                                <li>
                                  <strong>18-25:</strong> Normal volatility range
                                </li>
                                <li>
                                  <strong>{">"}30:</strong> High stress, crash risk for small caps
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Small-cap volatility often signals broader market instability
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.rvx.toFixed(1)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.rvx / 50) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Low: {"<"}18</span>
                      <span>Normal: 18-25</span>
                      <span>High: {">"}30</span>
                    </div>
                  </div>
                )}

                {/* VIX Term Structure */}
                {data.indicators.vixTermStructure !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        VIX Term Structure (Spot/1M)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">VIX Term Structure</p>
                              <p className="text-sm">
                                Ratio of spot VIX to 1-month VIX futures. Measures market structure and fear dynamics.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{">"}1.5:</strong> Contango - calm market, low risk
                                </li>
                                <li>
                                  <strong>1.0-1.2:</strong> Normal structure, moderate risk
                                </li>
                                <li>
                                  <strong>{"<"}1.0:</strong> Backwardation - panic, high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Backwardation signals extreme fear and imminent crash risk
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.vixTermStructure.toFixed(2)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, ((2.0 - data.indicators.vixTermStructure) / 1.5) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Contango: {">"}1.5 (Safe)</span>
                      <span>Normal: 1.0-1.2</span>
                      <span className="text-red-600">Backwardation: {"<"}1.0 (FEAR)</span>
                    </div>
                  </div>
                )}

                {/* ATR - Average True Range */}
                {data.indicators.atr !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        ATR - Average True Range
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-purple-50 border-purple-200">
                              <p className="font-semibold mb-1">ATR - Average True Range</p>
                              <p className="text-sm">
                                14-day average of daily high-low price ranges measuring volatility.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"}25:</strong> Low volatility, stable market
                                </li>
                                <li>
                                  <strong>25-40:</strong> Normal volatility
                                </li>
                                <li>
                                  <strong>{">"}50:</strong> High volatility, increased crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Extreme ATR spikes often precede market corrections and crashes
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.atr.toFixed(1)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.atr / 60) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Low Vol: {"<"}25</span>
                      <span>Normal: 25-40</span>
                      <span>High Vol: {">"}50</span>
                    </div>
                  </div>
                )}

                {/* LTV - Long-term Volatility */}
                {data.indicators.ltv !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        LTV - Long-term Volatility
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-purple-50 border-purple-200">
                              <p className="font-semibold mb-1">LTV - Long-term Volatility</p>
                              <p className="text-sm">
                                90-day rolling standard deviation of returns measuring sustained instability.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"}10%:</strong> Stable, low-risk environment
                                </li>
                                <li>
                                  <strong>10-15%:</strong> Normal market volatility
                                </li>
                                <li>
                                  <strong>{">"}20%:</strong> Elevated volatility, crash risk increasing
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Sustained high LTV indicates structural instability and crash
                                vulnerability
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{(data.indicators.ltv * 100).toFixed(1)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.ltv / 0.3) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Stable: {"<"}10%</span>
                      <span>Normal: 10-15%</span>
                      <span>Elevated: {">"}20%</span>
                    </div>
                  </div>
                )}

                {/* Bullish Percent Index */}
                {data.indicators.bullishPercent !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Bullish Percent Index
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-purple-50 border-purple-200">
                              <p className="font-semibold mb-1">Bullish Percent Index</p>
                              <p className="text-sm">% of stocks with bullish Point & Figure chart patterns.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"}30%:</strong> Oversold, panic selling (potential bottom)
                                </li>
                                <li>
                                  <strong>30-50%:</strong> Normal, healthy market breadth
                                </li>
                                <li>
                                  <strong>{">"}70%:</strong> Overbought, correction risk increases
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Extreme readings ({">"}80% or {"<"}20%) often precede reversals
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.bullishPercent}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${data.indicators.bullishPercent}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Oversold: {"<"}30%</span>
                      <span>Normal: 30-50%</span>
                      <span>Overbought: {">"}70%</span>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Pillar 2 - Risk Appetite & Volatility */}
          <AccordionItem value="pillar2" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-10">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-orange-600" />
                  <span className="text-lg font-semibold">Pillar 2 - Risk Appetite & Volatility</span>
                  <span className="text-sm text-gray-600">Weight: 30% | 8 indicators</span>
                </div>
                <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.riskAppetite)}/100</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6 pt-4">
                {/* Put/Call Ratio */}
                {data.indicators.putCallRatio !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Put/Call Ratio indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Put/Call Ratio
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-orange-50 border-orange-200">
                              <p className="font-semibold mb-1">Put/Call Ratio</p>
                              <p className="text-sm">
                                Measures the volume of put options traded relative to call options.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{">"} 1.1:</strong> High put volume, indicates fear/hedging, low crash risk
                                </li>
                                <li>
                                  <strong>0.9 - 1.1:</strong> Balanced, neutral risk
                                </li>
                                <li>
                                  <strong>{"<"} 0.7:</strong> Low put volume, high call volume, indicates complacency,
                                  high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Extreme ratios can signal market tops (complacency) or bottoms
                                (fear)
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.putCallRatio.toFixed(2)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, ((1.6 - data.indicators.putCallRatio) / 1.5) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Safe: {">"}1.1 (Hedging)</span>
                      <span>Caution: 0.9-1.1</span>
                      <span>Danger: {"<"}0.7 (Complacency)</span>
                    </div>
                  </div>
                )}

                {/* Fear & Greed Index */}
                {data.indicators.fearGreedIndex !== undefined && data.indicators.fearGreedIndex !== null && (
                  <div className="space-y-2">
                    {/* Added tooltip to Fear & Greed Index */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Fear & Greed Index
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-red-50 border-red-200">
                              <p className="font-semibold mb-1">CNN Fear & Greed Index</p>
                              <p className="text-sm">Measures market sentiment based on 7 indicators.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 30 (Fear):</strong> Potential buying opportunity
                                </li>
                                <li>
                                  <strong>30-60 (Neutral):</strong> Balanced sentiment
                                </li>
                                <li>
                                  <strong>{">"} 70 (Greed):</strong> Market is overbought, high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Extreme greed often precedes market corrections
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.fearGreedIndex}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${data.indicators.fearGreedIndex}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Fear: {"<"}30</span>
                      <span>Neutral: 30-60</span>
                      <span>Greed: {">"}70</span>
                    </div>
                  </div>
                )}

                {/* AAII Bullish Sentiment */}
                {data.indicators.aaiiBullish !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to AAII Bullish Sentiment */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        AAII Bullish Sentiment
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-yellow-50 border-yellow-200">
                              <p className="font-semibold mb-1">AAII Bullish Sentiment</p>
                              <p className="text-sm">
                                Surveys individual investors' bullish/bearish outlook on stocks.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 30%:</strong> Extreme bearishness, often precedes bottoms
                                </li>
                                <li>
                                  <strong>30-40%:</strong> Cautionary bearishness, increased crash risk
                                </li>
                                <li>
                                  <strong>40-50%:</strong> Neutral
                                </li>
                                <li>
                                  <strong>{">"} 50%:</strong> Growing bullishness, elevated risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> High bullish sentiment indicates a lack of further buying power
                                and increased risk
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.aaiiBullish.toFixed(0)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, (data.indicators.aaiiBullish - 20) / 0.4))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Safe: {"<"}30%</span>
                      <span>Warning: 30-40%</span>
                      <span>Danger: {">"}50%</span>
                    </div>
                  </div>
                )}

                {/* Short Interest */}
                {data.indicators.shortInterest !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Short Interest Ratio */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        SPY Short Interest Ratio
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-orange-50 border-orange-200">
                              <p className="font-semibold mb-1">Short Interest Ratio</p>
                              <p className="text-sm">Percentage of shares sold short relative to float.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{">"} 6%:</strong> High short interest - bearish sentiment increases crash
                                  risk
                                </li>
                                <li>
                                  <strong>2-6%:</strong> Normal range
                                </li>
                                <li>
                                  <strong>{"<"} 2%:</strong> Low short interest - bullish confidence, lower crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Higher short interest indicates bearish positioning and
                                increased market stress
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.shortInterest.toFixed(1)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, (data.indicators.shortInterest / 10) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Safe: {"<"}2% (Bullish)</span>
                      <span>Danger: {">"}6% (Bearish)</span>
                    </div>
                  </div>
                )}

                {/* Tech ETF Flows */}
                {data.indicators.etfFlows !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Tech ETF Flows */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Tech ETF Flows (Weekly)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-purple-50 border-purple-200">
                              <p className="font-semibold mb-1">Tech ETF Flows</p>
                              <p className="text-sm">Weekly net inflows/outflows for technology ETFs.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{">"} +2B:</strong> Strong inflows, bullish sentiment
                                </li>
                                <li>
                                  <strong>-$2B to +$2B:</strong> Neutral
                                </li>
                                <li>
                                  <strong>{"<"} -$2B:</strong> Outflows, risk-off sentiment, increased crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Sustained outflows signal capital flight from tech, a key crash
                                driver
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">${data.indicators.etfFlows}B</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, ((data.indicators.etfFlows + 5) / 10) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Outflows: {"<"}-$2B</span>
                      <span>Neutral: -$2B to +$2B</span>
                      <span>Inflows: {">"} +$2B</span>
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
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.atr / 60) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Low Vol: {"<"}25</span>
                      <span>Normal: 25-40</span>
                      <span>High Vol: {">"}50</span>
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
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.ltv / 0.3) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Stable: {"<"}10%</span>
                      <span>Normal: 10-15%</span>
                      <span>Elevated: {">"}20%</span>
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
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${data.indicators.bullishPercent}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Oversold: {"<"}30%</span>
                      <span>Normal: 30-50%</span>
                      <span>Overbought: {">"}70%</span>
                    </div>
                  </div>
                )}

                {/* Yield Curve - moved to Risk Appetite */}
                {data.indicators.yieldCurve !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Yield Curve indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Yield Curve (10Y-2Y)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-green-50 border-green-200">
                              <p className="font-semibold mb-1">Yield Curve (10Y-2Y) Spread</p>
                              <p className="text-sm">Difference between 10-year and 2-year Treasury yields.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{">"} 0.5%:</strong> Steep curve, healthy economy, low risk
                                </li>
                                <li>
                                  <strong>0-0.5%:</strong> Flat curve, slowing growth, moderate risk
                                </li>
                                <li>
                                  <strong>{"<"} 0% (Inverted):</strong> Inverted curve, recession signal, high crash
                                  risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Inverted yield curve has historically preceded recessions and
                                market crashes
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.yieldCurve.toFixed(2)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, 100 - ((data.indicators.yieldCurve + 1) / 2) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Normal: {">"}0.5%</span>
                      <span>Flat: 0-0.5%</span>
                      <span>Inverted: {"<"}0%</span>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Pillar 3 - Valuation & Market Structure */}
          <AccordionItem value="pillar3" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-10">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <span className="text-lg font-semibold">Pillar 3 - Valuation & Market Structure</span>
                  <span className="text-sm text-gray-600">Weight: 15% | 7 indicators</span>
                </div>
                <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.valuation)}/100</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6 pt-4">
                {/* S&P 500 P/E */}
                {data.indicators.spxPE !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to S&P 500 P/E indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        S&P 500 Forward P/E
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-green-50 border-green-200">
                              <p className="font-semibold mb-1">S&P 500 Forward P/E Ratio</p>
                              <p className="text-sm">Price-to-Earnings ratio based on estimated future earnings.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 15:</strong> Undervalued, low crash risk
                                </li>
                                <li>
                                  <strong>16-20:</strong> Fair value, moderate risk
                                </li>
                                <li>
                                  <strong>{">"} 20:</strong> Overvalued, high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> High P/E ratios indicate expensive markets vulnerable to
                                corrections
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.spxPE}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, ((data.indicators.spxPE - 10) / 15) * 100)}%`,
                        }}
                      />
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
                    {/* Added tooltip to S&P 500 P/S indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        S&P 500 Price-to-Sales
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-green-50 border-green-200">
                              <p className="font-semibold mb-1">S&P 500 Price-to-Sales Ratio</p>
                              <p className="text-sm">Market capitalization relative to total company revenues.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 2.5:</strong> Undervalued, low risk
                                </li>
                                <li>
                                  <strong>2.5 - 3.0:</strong> Fair value, moderate risk
                                </li>
                                <li>
                                  <strong>{">"} 3.0:</strong> Overvalued, high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> High P/S ratios indicate markets trading at a premium to sales,
                                vulnerable to price drops
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.spxPS}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, ((data.indicators.spxPS - 1) / 2) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Normal: {"<"}2.5</span>
                      <span>Elevated: {">"}3.0</span>
                    </div>
                  </div>
                )}

                {/* Buffett Indicator */}
                {data.indicators.buffettIndicator !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Buffett Indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Buffett Indicator (Market Cap / GDP)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-red-50 border-red-200">
                              <p className="font-semibold mb-1">Buffett Indicator</p>
                              <p className="text-sm">Compares total stock market capitalization to GDP.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 120%:</strong> Undervalued, low crash risk
                                </li>
                                <li>
                                  <strong>120-150%:</strong> Fair value, moderate risk
                                </li>
                                <li>
                                  <strong>150-180%:</strong> Elevated risk
                                </li>
                                <li>
                                  <strong>{">"} 200%:</strong> Historically signifies market bubbles, extreme crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> A high Buffett Indicator suggests the market is significantly
                                overvalued relative to the economy's productive capacity
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.buffettIndicator.toFixed(0)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, (data.indicators.buffettIndicator - 80) / 1.6))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Undervalued: {"<"}120%</span>
                      <span>Fair: 120-150%</span>
                      <span>Warning: 150-180%</span>
                      <span className="text-red-600">Danger: {">"}200%</span>
                    </div>
                  </div>
                )}

                {data.indicators.qqqPE !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to QQQ P/E indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        QQQ Forward P/E (AI-Specific Valuation)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">QQQ Forward P/E Ratio</p>
                              <p className="text-sm">
                                Measures the valuation of the Nasdaq-100, often driven by tech and AI growth
                                expectations.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 25:</strong> Fairly valued or undervalued
                                </li>
                                <li>
                                  <strong>25-35:</strong> Elevated valuation, moderate risk
                                </li>
                                <li>
                                  <strong>{">"} 35:</strong> Bubble territory, very high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> High P/E in tech can lead to sharp corrections when growth
                                expectations are not met
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.qqqPE.toFixed(1)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, ((data.indicators.qqqPE - 15) / 30) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Fair: {"<"}25</span>
                      <span>Elevated: 30-35</span>
                      <span>Bubble: {">"}40</span>
                    </div>
                  </div>
                )}

                {data.indicators.mag7Concentration !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Magnificent 7 Concentration */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Magnificent 7 Concentration (Crash Contagion Risk)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-red-50 border-red-200">
                              <p className="font-semibold mb-1">Magnificent 7 Concentration</p>
                              <p className="text-sm">
                                Percentage of the S&P 500 market cap held by the 'Magnificent 7' stocks.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 50%:</strong> Diversified market, lower contagion risk
                                </li>
                                <li>
                                  <strong>55-60%:</strong> High concentration, increased contagion risk
                                </li>
                                <li>
                                  <strong>{">"} 65%:</strong> Extreme concentration, very high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> High concentration means a downturn in these stocks can
                                severely impact the entire market
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.mag7Concentration.toFixed(1)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, ((data.indicators.mag7Concentration - 40) / 30) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Diversified: {"<"}50%</span>
                      <span>High: 55-60%</span>
                      <span>Extreme: {">"}65%</span>
                    </div>
                  </div>
                )}

                {data.indicators.shillerCAPE !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Shiller CAPE Ratio */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Shiller CAPE Ratio (10-Year Cyclical Valuation)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-red-50 border-red-200">
                              <p className="font-semibold mb-1">Shiller CAPE Ratio</p>
                              <p className="text-sm">Cyclically Adjusted Price-to-Earnings ratio over 10 years.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 20:</strong> Undervalued, low risk
                                </li>
                                <li>
                                  <strong>20-30:</strong> Fair value, moderate risk
                                </li>
                                <li>
                                  <strong>30-35:</strong> Elevated valuation, high risk
                                </li>
                                <li>
                                  <strong>{">"} 35:</strong> Historically signals market tops, extreme crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> High CAPE values indicate markets trading significantly above
                                historical averages, prone to reversion
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.shillerCAPE.toFixed(1)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, ((data.indicators.shillerCAPE - 15) / 25) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Historical Avg: 16-17</span>
                      <span>Elevated: 25-30</span>
                      <span>Extreme: {">"}35</span>
                    </div>
                  </div>
                )}

                {data.indicators.equityRiskPremium !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Equity Risk Premium */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Equity Risk Premium (Earnings Yield - 10Y Treasury)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-green-50 border-green-200">
                              <p className="font-semibold mb-1">Equity Risk Premium</p>
                              <p className="text-sm">
                                The excess return investors expect for holding stocks over risk-free bonds.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{">"} 5%:</strong> Attractive returns, low risk
                                </li>
                                <li>
                                  <strong>3-4%:</strong> Fair compensation, moderate risk
                                </li>
                                <li>
                                  <strong>{"<"} 2%:</strong> Low compensation, high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Low ERP suggests stocks are overvalued relative to their risk
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.equityRiskPremium.toFixed(2)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, ((6 - data.indicators.equityRiskPremium) / 6) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Attractive: {">"}5%</span>
                      <span>Fair: 3-4%</span>
                      <span>Overvalued: {"<"}2%</span>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Pillar 4 - Macro Economic */}
          <AccordionItem value="pillar4" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  <div className="text-left">
                    <div className="font-semibold text-base">Pillar 4 - Macro</div>
                    <div className="text-xs text-muted-foreground">Weight: 20% | 7 indicators</div>
                  </div>
                </div>
                <div className="text-2xl font-bold text-purple-600">{data.pillars.macro}/100</div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6 pt-4">
                {/* TED Spread */}
                {data.indicators?.tedSpread !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to TED Spread indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        TED Spread (Banking System Stress)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-orange-50 border-orange-200">
                              <p className="font-semibold mb-1">TED Spread</p>
                              <p className="text-sm">
                                Difference between US Dollar LIBOR and US Treasury yields, indicating credit market
                                stress.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 0.35%:</strong> Low stress, stable banking
                                </li>
                                <li>
                                  <strong>0.5-0.75%:</strong> Rising stress, caution needed
                                </li>
                                <li>
                                  <strong>{">"} 1.0%:</strong> High stress, impending crisis
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Widening TED spread signals increasing fear of bank defaults
                                and credit crunch
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.tedSpread.toFixed(2)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.tedSpread / 1.5) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Normal: {"<"}0.35%</span>
                      <span>Warning: 0.5-0.75%</span>
                      <span>Crisis: {">"}1.0%</span>
                    </div>
                  </div>
                )}

                {/* US Dollar Index (DXY) */}
                {data.indicators?.dxyIndex !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to DXY Index */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        US Dollar Index (DXY) - Tech Headwind
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-green-50 border-green-200">
                              <p className="font-semibold mb-1">US Dollar Index (DXY)</p>
                              <p className="text-sm">Measures USD strength against a basket of major currencies.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 95:</strong> Weak dollar, supports asset prices
                                </li>
                                <li>
                                  <strong>95-105:</strong> Normal range
                                </li>
                                <li>
                                  <strong>{">"} 110:</strong> Strong dollar, headwinds for global growth and tech
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> A strong dollar can hurt multinational tech earnings and
                                emerging markets
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.dxyIndex.toFixed(1)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, ((data.indicators.dxyIndex - 90) / 30) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Weak: {"<"}95</span>
                      <span>Normal: 100-105</span>
                      <span>Strong: {">"}110 (Hurts tech)</span>
                    </div>
                  </div>
                )}

                {/* ISM Manufacturing PMI */}
                {data.indicators?.ismPMI !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to ISM Manufacturing PMI */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        ISM Manufacturing PMI (Economic Leading)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-gray-50 border-gray-200">
                              <p className="font-semibold mb-1">ISM Manufacturing PMI</p>
                              <p className="text-sm">Purchasing Managers' Index for the manufacturing sector.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{">"} 52:</strong> Expansion, positive economic signal
                                </li>
                                <li>
                                  <strong>50-52:</strong> Slowing growth
                                </li>
                                <li>
                                  <strong>{"<"} 50:</strong> Contraction, recessionary signal
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> A PMI below 50 often indicates weakening demand and potential
                                economic slowdown
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.ismPMI.toFixed(1)}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, 100 - ((data.indicators.ismPMI - 40) / 20) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Expansion: {">"}52</span>
                      <span>Neutral: 50</span>
                      <span>Contraction: {"<"}50</span>
                    </div>
                  </div>
                )}

                {/* Fed Funds Rate */}
                {data.indicators.fedFundsRate !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Fed Funds Rate */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Fed Funds Rate
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">Federal Funds Rate</p>
                              <p className="text-sm">
                                The target rate set by the Federal Reserve for overnight lending between banks.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 2%:</strong> Accommodative policy, supports growth
                                </li>
                                <li>
                                  <strong>2-4%:</strong> Neutral policy
                                </li>
                                <li>
                                  <strong>{">"} 4.5%:</strong> Restrictive policy, slows economy, increases crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> High rates increase borrowing costs and can trigger market
                                downturns
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.fedFundsRate}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.fedFundsRate / 6) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Accommodative: {"<"}2%</span>
                      <span>Neutral: 2-4%</span>
                      <span>Restrictive: {">"}4.5%</span>
                    </div>
                  </div>
                )}

                {/* Fed Reverse Repo */}
                {data.indicators?.fedReverseRepo !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Fed Reverse Repo */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Fed Reverse Repo (Liquidity Conditions)
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-1">Fed Reverse Repo Operations</p>
                              <p className="text-sm">Measures excess liquidity in the financial system.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} $500B:</strong> Tight liquidity, potential headwinds
                                </li>
                                <li>
                                  <strong>$500B - $1T:</strong> Normal
                                </li>
                                <li>
                                  <strong>{">"} $2T:</strong> Abundant liquidity, supports asset prices
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Declining reverse repo balances can signal tightening
                                liquidity, increasing crash risk
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">${data.indicators.fedReverseRepo.toFixed(0)}B</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, (data.indicators.fedReverseRepo / 2500) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Loose: {"<"}500B</span>
                      <span>Normal: 1000B</span>
                      <span>Tight: {">"}2000B</span>
                    </div>
                  </div>
                )}

                {/* Junk Bond Spread - moved to Macro */}
                {data.indicators.junkSpread !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to Junk Bond Spread */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        Junk Bond Spread
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-orange-50 border-orange-200">
                              <p className="font-semibold mb-1">Junk Bond Spread</p>
                              <p className="text-sm">
                                Difference between yields on high-yield (junk) bonds and risk-free Treasuries.
                              </p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 3%:</strong> Tight spread, low perceived risk, low crash risk
                                </li>
                                <li>
                                  <strong>3-6%:</strong> Normal spread, moderate risk
                                </li>
                                <li>
                                  <strong>{">"} 7%:</strong> Wide spread, high perceived risk, high crash risk
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> Widening spreads indicate investor fear of default and credit
                                tightening
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.junkSpread.toFixed(2)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, ((data.indicators.junkSpread - 2) / 8) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Tight: {"<"}3%</span>
                      <span>Normal: 3-5%</span>
                      <span>Wide: {">"}6%</span>
                    </div>
                  </div>
                )}

                {/* US Debt-to-GDP */}
                {data.indicators.debtToGDP !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to US Debt-to-GDP */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        US Debt-to-GDP Ratio
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-red-50 border-red-200">
                              <p className="font-semibold mb-1">US Debt-to-GDP Ratio</p>
                              <p className="text-sm">Total public debt as a percentage of Gross Domestic Product.</p>
                              <ul className="text-sm mt-1 space-y-1">
                                <li>
                                  <strong>{"<"} 90%:</strong> Healthy level
                                </li>
                                <li>
                                  <strong>90-120%:</strong> Elevated risk
                                </li>
                                <li>
                                  <strong>{">"} 130%:</strong> Very high risk, potential for fiscal crisis
                                </li>
                              </ul>
                              <p className="text-xs mt-2">
                                <strong>Impact:</strong> High debt levels can lead to inflation, higher interest rates,
                                and reduced fiscal flexibility
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.debtToGDP.toFixed(1)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, ((data.indicators.debtToGDP - 60) / 80) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Healthy: {"<"}90%</span>
                      <span>Elevated: 100-120%</span>
                      <span>Danger: {">"}130%</span>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* CCPI Formula Weights */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-sm mb-3 text-blue-900">CCPI Formula Weights</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Momentum & Technical:</span>
              <span className="font-bold text-blue-900">35%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Risk Appetite & Volatility:</span>
              <span className="font-bold text-blue-900">30%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Valuation & Market Structure:</span>
              <span className="font-bold text-blue-900">15%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Macro:</span>
              <span className="font-bold text-blue-900">20%</span>
            </div>
          </div>
          <p className="text-xs text-blue-700 mt-3">
            Final CCPI = Σ(Pillar Score × Weight). Pillar 3 now includes 7 valuation & market structure indicators: S&P
            P/E, S&P P/S, Buffett Indicator, QQQ P/E, Mag7 Concentration, Shiller CAPE, and Equity Risk Premium.
          </p>
        </div>

        <Accordion type="multiple" className="space-y-4 mt-8">
          {/* Portfolio Allocation by CCPI Crash Risk Level */}
          <AccordionItem value="portfolio-allocation" className="border-0">
            <Card className="shadow-sm border-gray-200">
              <AccordionTrigger className="hover:no-underline px-6 py-0">
                <CardHeader className="bg-gray-50 border-b border-gray-200 w-full py-3">
                  <CardTitle className="text-lg font-bold text-gray-900 text-left">
                    Portfolio Allocation by CCPI Crash Risk Level
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1 text-left">
                    Recommended asset class diversification across crash risk regimes
                  </p>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
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
                            "Small gold allocation (3-5%) as insurance policy",
                          ],
                        },
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
                            "Build cash reserves to 15-25% for opportunities",
                          ],
                        },
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
                            "Build substantial cash position (30-40%) for volatility",
                          ],
                        },
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
                            "Hold 50-60% cash to deploy after market correction",
                          ],
                        },
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
                            "Hold 70-80% cash reserves to deploy after crash",
                          ],
                        },
                      },
                    ].map((item, index) => {
                      const isCurrent =
                        data.ccpi >= Number.parseInt(item.range.split("-")[0]) &&
                        data.ccpi <= Number.parseInt(item.range.split("-")[1])

                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border transition-colors ${
                            isCurrent
                              ? "border-green-500 bg-green-100 shadow-md ring-2 ring-green-300"
                              : "border-gray-200 bg-white hover:bg-gray-50"
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
                                <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">
                                  CURRENT
                                </span>
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
                      <strong>Note:</strong> These allocations represent baseline guidelines for crash risk management.
                      Always adjust based on your personal risk tolerance, time horizon, and financial goals. CCPI
                      levels above 60 warrant significant defensive positioning regardless of individual circumstances.
                      Consult with a financial advisor for personalized advice.
                    </p>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          {/* Options Strategy Guide by CCPI Crash Risk Level */}
          <AccordionItem value="options-strategy" className="border-0">
            <Card className="shadow-sm border-gray-200">
              <AccordionTrigger className="hover:no-underline px-6 py-0">
                <CardHeader className="bg-gray-50 border-b border-gray-200 w-full py-3">
                  <CardTitle className="text-lg font-bold text-gray-900 text-left">
                    Options Strategy Guide by CCPI Crash Risk Level
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1 text-left">
                    Complete trading playbook across all crash risk regimes
                  </p>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-2">
                    {[
                      {
                        range: "0-19",
                        level: "Low Risk",
                        signal: "STRONG BUY",
                        description:
                          "Market shows minimal crash signals. Safe to deploy capital with aggressive strategies.",
                        guidance: {
                          cashAllocation: "5-10%",
                          marketExposure: "90-100%",
                          positionSize: "Large (5-10%)",
                          strategies: [
                            "Sell cash-secured puts on quality names at 30-delta",
                            "Run the wheel strategy on tech leaders (NVDA, MSFT, AAPL)",
                            "Long ITM LEAPS calls (70-80 delta) for portfolio leverage",
                            "Aggressive short strangles on high IV stocks",
                            "Credit spreads in earnings season",
                          ],
                        },
                      },
                      {
                        range: "20-39",
                        level: "Normal",
                        signal: "BUY",
                        description:
                          "Standard market conditions. Deploy capital with normal risk management protocols.",
                        guidance: {
                          cashAllocation: "15-25%",
                          marketExposure: "70-85%",
                          positionSize: "Medium (3-5%)",
                          strategies: [
                            "Balanced put selling at 20-30 delta on SPY/QQQ",
                            "Covered calls on existing positions (40-45 DTE)",
                            "Bull put spreads with 1.5-2x credit/risk ratio",
                            "Diagonal calendar spreads for income + upside",
                            "Protective puts on core holdings (10% allocation)",
                          ],
                        },
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
                            "Buy protective puts on concentrated positions",
                          ],
                        },
                      },
                      {
                        range: "60-79",
                        level: "High Alert",
                        signal: "CAUTION",
                        description:
                          "Multiple crash signals active. Preserve capital and prepare for volatility expansion.",
                        guidance: {
                          cashAllocation: "50-60%",
                          marketExposure: "30-50%",
                          positionSize: "Very Small (0.5-1%)",
                          strategies: [
                            "Buy VIX calls for crash insurance (60-90 DTE)",
                            "Long put spreads on QQQ/SPY at-the-money",
                            "Tactical long volatility trades (VXX calls)",
                            "Gold miners (GDX) call options as diversification",
                          ],
                        },
                      },
                      {
                        range: "80-100",
                        level: "Crash Watch",
                        signal: "SELL/HEDGE",
                        description:
                          "Extreme crash risk. Full defensive positioning required. Prioritize capital preservation.",
                        guidance: {
                          cashAllocation: "70-80%",
                          marketExposure: "10-30%",
                          positionSize: "Minimal (0.25-0.5%)",
                          strategies: [
                            "Aggressive long puts on SPY/QQQ (30-60 DTE)",
                            "VIX call spreads to capitalize on volatility spike",
                            "Inverse ETFs (SQQQ, SH) or long put options",
                            "Close ALL short premium positions",
                            "Tail risk hedges: deep OTM puts on major indices",
                          ],
                        },
                      },
                    ].map((item, index) => {
                      const isCurrent =
                        data.ccpi >= Number.parseInt(item.range.split("-")[0]) &&
                        data.ccpi <= Number.parseInt(item.range.split("-")[1])

                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border transition-colors ${
                            isCurrent
                              ? "border-green-500 bg-green-100 shadow-md ring-2 ring-green-300"
                              : "border-gray-200 bg-white hover:bg-gray-50"
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
                      <strong>Disclaimer:</strong> Options trading carries significant risk of loss. These strategies
                      are educational examples only. Past performance does not guarantee future results. Always
                      implement proper position sizing, stop losses, and risk management protocols. Consider your
                      personal risk tolerance and market conditions before trading. Not financial advice - consult a
                      licensed professional.
                    </p>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>

        {/* Export Controls */}
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const summary = `CCPI Weekly Outlook\n\n${data.summary.headline}\n\n${data.summary.bullets.join("\n")}\n\nCCPI Score: ${data.ccpi}\nCertainty: ${data.certainty}\nRegime: ${data.regime.name}\n\nGenerated: ${new Date(data.timestamp).toLocaleString()}`
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

        {/* API Data Source Status - Removed as per update */}
      </div>
    </TooltipProvider>
  )
}

export { CcpiDashboard }
