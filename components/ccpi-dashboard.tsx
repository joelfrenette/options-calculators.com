"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, AlertTriangle, Activity, DollarSign, BarChart3 } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Download } from "lucide-react"
import { RefreshButton } from "@/components/ui/refresh-button"

// Helper component for tooltips with descriptions
const InfoTooltip = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="text-gray-400 hover:text-gray-600 focus:outline-none">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs bg-white border-gray-200 shadow-lg">
        <p className="font-semibold mb-1">{title}</p>
        {children}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

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
    console.log("[v0] CCPI Dashboard mounted")
    loadFromLocalStorage()
    fetchHistory()
    fetchData()
  }, [])

  const loadFromLocalStorage = () => {
    try {
      const cached = localStorage.getItem("ccpi-data")
      if (cached) {
        const parsedData = JSON.parse(cached)
        console.log("[v0] CCPI: Loaded from localStorage", parsedData.cachedAt)
        setData(parsedData)
        const cacheAge = Date.now() - new Date(parsedData.cachedAt).getTime()
        const minutesOld = Math.floor(cacheAge / 60000)
        console.log(`[v0] CCPI: Cache is ${minutesOld} minutes old`)
      } else {
        console.log("[v0] CCPI: No cached data in localStorage")
        setError("No cached data available. Loading fresh data...")
      }
    } catch (error) {
      console.error("[v0] CCPI localStorage load error:", error)
      setError("Loading fresh data...")
    }
  }

  const fetchData = async () => {
    try {
      setIsRefreshing(true)
      if (!data) {
        setLoading(true)
      }
      setRefreshProgress(5)
      setRefreshStatus("Initializing CCPI calculation...")
      setError(null)

      // Simulate progress updates (in reality, the API would stream these)
      const progressInterval = setInterval(() => {
        setRefreshProgress((prev) => {
          if (prev >= 90) return prev
          return prev + Math.random() * 8
        })
        // Update status messages during fetch
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
        totalIndicators: 34,
      })
      console.log("[v0] Pillar Breakdown (weighted contribution to CCPI):")
      console.log("  Momentum:", result.pillars.momentum, "× 40% =", (result.pillars.momentum * 0.4).toFixed(1))
      console.log(
        "  Risk Appetite:",
        result.pillars.riskAppetite,
        "× 30% =",
        (result.pillars.riskAppetite * 0.3).toFixed(1),
      )
      console.log("  Valuation:", result.pillars.valuation, "× 20% =", (result.pillars.valuation * 0.2).toFixed(1))
      console.log("  Macro:", result.pillars.macro, "× 10% =", (result.pillars.macro * 0.1).toFixed(1))

      const calculatedCCPI =
        result.pillars.momentum * 0.4 +
        result.pillars.riskAppetite * 0.3 +
        result.pillars.valuation * 0.2 +
        result.pillars.macro * 0.1
      console.log("  Calculated CCPI:", calculatedCCPI.toFixed(1), "| API CCPI:", result.ccpi)

      const cachedData = {
        ...result,
        cachedAt: new Date().toISOString(),
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
        // Don't fail the whole operation if caching fails
      }

      await fetchExecutiveSummary(cachedData)
    } catch (error) {
      console.error("[v0] CCPI API error:", error)
      setError(error instanceof Error ? error.message : "Failed to load CCPI data")
    } finally {
      setIsRefreshing(false)
      setLoading(false) // Clear loading state
      setRefreshProgress(0)
      setRefreshStatus("")
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
          activeCanaries: ccpiData.canaries.filter((c) => c.severity === "high" || c.severity === "medium").length,
          totalIndicators: 34,
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
          <Button variant="outline" onClick={fetchData} className="mt-4 bg-transparent">
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
      icon: TrendingUp,
    },
    { name: "Pillar 3 - Valuation & Market Structure", value: data.pillars.valuation, weight: "15%", icon: DollarSign },
    { name: "Pillar 4 - Macro", value: data.pillars.macro, weight: "20%", icon: BarChart3 },
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
            <RefreshButton onClick={fetchData} isLoading={isRefreshing} loadingText="Refreshing..." />
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
                  {/* CHANGE: Enhanced Certainty Score tooltip with clearer explanation */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-gray-400 hover:text-gray-600"></button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md p-3">
                        <p className="font-semibold mb-2">Certainty Score - How Confident Are We?</p>
                        <p className="text-sm leading-relaxed mb-2">
                          This score measures how confident we are in our crash prediction. Think of it like weather
                          forecasting - sometimes all the data points to rain (high certainty), other times the forecast
                          is less clear (low certainty).
                        </p>
                        <p className="text-sm leading-relaxed mb-2">
                          <strong>How It's Calculated:</strong>
                        </p>
                        <ul className="text-sm space-y-1 mb-2">
                          <li>
                            • <strong>70% weight:</strong> How much our 4 pillars agree with each other (when all
                            pillars point the same direction, we're more confident)
                          </li>
                          <li>
                            • <strong>30% weight:</strong> How many warning signals ("canaries") are triggered across
                            all indicators
                          </li>
                        </ul>
                        <p className="text-xs text-gray-600">
                          Current calculation:{" "}
                          {Math.round(
                            ((100 -
                              (Math.max(...Object.values(data.pillars)) - Math.min(...Object.values(data.pillars)))) /
                              100) *
                              70,
                          )}
                          % from pillar alignment +{" "}
                          {Math.round(
                            (data.canaries.filter((c) => c.severity === "high" || c.severity === "medium").length /
                              15) *
                              30,
                          )}
                          % from active warnings
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

        {data.totalBonus && data.totalBonus > 0 && (
          <Card className="border-2 border-red-600 bg-gradient-to-r from-red-50 to-orange-50 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-900">
                <AlertTriangle className="h-6 w-6 text-red-600 animate-pulse" />🚨 CRASH AMPLIFIERS ACTIVE +
                {data.totalBonus} BONUS POINTS
              </CardTitle>
              <CardDescription className="text-red-700 font-medium">
                Multiple extreme crash signals detected - CCPI boosted from {data.baseCCPI} to {data.ccpi}
                <span className="block mt-1 text-xs text-red-600">
                  Last updated: {new Date(data.cachedAt || data.timestamp).toLocaleString()}
                </span>
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
                  ⚠️ CRASH AMPLIFIERS = Short-term (1-14 day) indicators that trigger 10%+ corrections. These are
                  automatically recalculated on every page load to ensure real-time accuracy. Maximum bonus capped at
                  +100 points to prevent over-signaling.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-red-50">
          <CardHeader>
            {/* Added tooltip to Canaries section header */}
            <CardTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Canaries in the Coal Mine - Active Warning Signals
                {/* CHANGE: Enhanced Canaries section tooltip */}
                {tooltipsEnabled && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md bg-yellow-50 border-yellow-200">
                      <p className="font-semibold mb-2">Early Warning System - What Are "Canaries"?</p>
                      <p className="text-sm mb-2">
                        Historically, coal miners brought canaries into mines because these birds would show signs of
                        distress before dangerous gases reached toxic levels for humans. Similarly, these market
                        indicators give us early warning signs before a potential crash.
                      </p>
                      <p className="text-sm mb-2">
                        Each warning appears when a specific market indicator crosses a dangerous threshold - like when
                        market valuations get extremely high, volatility spikes dramatically, or investor sentiment
                        becomes too one-sided.
                      </p>
                      <ul className="text-sm mt-2 space-y-2">
                        <li>
                          <strong className="text-red-600">High Risk (Red):</strong> Critical danger zone - this
                          indicator has reached levels historically associated with market crashes. Immediate attention
                          recommended.
                        </li>
                        <li>
                          <strong className="text-yellow-600">Medium Risk (Yellow):</strong> Warning zone - this
                          indicator is showing concerning signs but hasn't reached critical levels yet. Increased
                          caution advised.
                        </li>
                      </ul>
                      <p className="text-xs mt-2 text-gray-600">
                        We monitor {data.canaries.length} total warning signals across all of the market indicators.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <span className="text-2xl font-bold text-red-600">
                {data.canaries.filter((canary) => canary.severity === "high" || canary.severity === "medium").length}/
                {data.totalIndicators || 34}
              </span>
            </CardTitle>
            <CardDescription>
              Executive summary of medium and high severity red flags across all indicators
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
                      {/* CHANGE: Enhanced individual canary card tooltips */}
                      <div className="flex items-start gap-2">
                        <p className={`text-sm font-semibold ${severityConfig.textColor} flex-1`}>{canary.signal}</p>
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help flex-shrink-0 mt-0.5" />
                            </TooltipTrigger>
                            <TooltipContent
                              className={`max-w-md ${canary.severity === "high" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}
                            >
                              <p className="font-semibold mb-2">{canary.signal}</p>
                              <p className="text-sm mb-2">
                                {canary.severity === "high"
                                  ? "This indicator has crossed into the danger zone. Historical data shows that when this indicator reaches these levels, market crashes or significant corrections often follow within weeks to months. The specific threshold has been breached based on historical crash patterns."
                                  : "This indicator is flashing a warning sign. While not at critical levels yet, it's showing patterns that have preceded market downturns in the past. This suggests increased caution and closer monitoring of market conditions."}
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Why This Matters:</strong> The {canary.pillar} pillar, where this indicator
                                belongs, helps us understand{" "}
                                {canary.pillar === "Pillar 1"
                                  ? "price momentum and technical breakdowns"
                                  : canary.pillar === "Pillar 2"
                                    ? "investor fear and risk appetite"
                                    : canary.pillar === "Pillar 3"
                                      ? "whether stocks are overvalued"
                                      : "broader economic health"}
                                . When multiple canaries trigger in the same pillar, it strengthens the crash warning
                                signal.
                              </p>
                              {canary.indicatorWeight !== undefined && canary.pillarWeight !== undefined && (
                                <div className="text-xs bg-white/50 p-2 rounded mt-2">
                                  <p className="font-semibold mb-1">Impact Calculation:</p>
                                  <p>• Indicator importance within its pillar: {canary.indicatorWeight}/100 points</p>
                                  <p>• Pillar's weight in overall CCPI: {canary.pillarWeight}%</p>
                                  <p className="font-semibold mt-1">
                                    Combined impact on CCPI score: {canary.impactScore?.toFixed(2)} points
                                  </p>
                                </div>
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
        <Accordion type="multiple" defaultValue={[]} className="space-y-4 pb-6">
          {/* Pillar 1 - Momentum & Technical */}
          <AccordionItem value="pillar1" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-10">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-cyan-600" />
                  <span className="text-lg font-semibold">Pillar 1 - Momentum & Technical</span>
                  {/* CHANGE: Updated from 16 to 12 indicators after removing duplicates (ATR, LTV, Bullish Percent, Yield Curve) */}
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
                        {/* CHANGE: Enhanced NVIDIA Momentum tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">NVIDIA Momentum Score - The AI Sector Bellwether</p>
                              <p className="text-sm mb-2">
                                NVIDIA has become the most important indicator of AI and technology sector health. As
                                the leading AI chip maker, NVIDIA's stock performance often predicts broader tech market
                                movements.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> This score combines NVIDIA's recent price trend with
                                trading volume and relative strength compared to the overall market. Higher scores mean
                                strong momentum (bullish), lower scores mean weakening momentum (bearish).
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Above 80:</strong> NVIDIA is in a strong uptrend - tech sector is healthy,
                                  lower crash risk
                                </li>
                                <li>
                                  • <strong>40-60:</strong> Neutral momentum - tech sector is treading water, moderate
                                  risk
                                </li>
                                <li>
                                  • <strong>Below 20:</strong> NVIDIA is falling - tech sector weakness often leads to
                                  broader market selloffs
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Real-time price data from major stock exchanges, analyzed
                                using technical momentum indicators.
                              </p>
                              <p className="text-xs text-gray-600">
                                Why it matters: NVIDIA's market cap exceeds $3 trillion, making it one of the largest
                                companies in the world. When it falls, it can drag down entire indexes.
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
                        {/* CHANGE: Enhanced SOX Index tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">SOX Semiconductor Index - Chip Sector Health Check</p>
                              <p className="text-sm mb-2">
                                The SOX (PHLX Semiconductor Index) tracks 30 of the largest semiconductor companies.
                                Think of semiconductors as the building blocks of all modern technology - they're in
                                everything from smartphones to cars to data centers.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> The combined stock price performance of major chip
                                makers including NVIDIA, AMD, Intel, Taiwan Semiconductor, and others. This index is
                                often called a "leading indicator" because chip demand tends to slow before broader
                                economic slowdowns.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Above 5500:</strong> Chip sector is strong - healthy tech ecosystem, low
                                  crash risk
                                </li>
                                <li>
                                  • <strong>Around 5000 (baseline):</strong> Normal levels - tech sector is stable
                                </li>
                                <li>
                                  • <strong>Below 4500:</strong> Chip sector weakness - may signal broader tech and
                                  economic problems ahead
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Philadelphia Stock Exchange (PHLX), updated daily based on
                                trading prices of semiconductor stocks.
                              </p>
                              <p className="text-xs text-gray-600">
                                Historical note: The SOX Index often peaks 6-12 months before major market corrections,
                                making it an important early warning indicator.
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
                        {/* CHANGE: Enhanced QQQ Daily Return tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">QQQ Daily Return - Tech Sector Daily Performance</p>
                              <p className="text-sm mb-2">
                                QQQ is an ETF (Exchange Traded Fund) that tracks the Nasdaq-100 Index - the 100 largest
                                non-financial companies on the Nasdaq stock exchange. This includes major tech companies
                                like Apple, Microsoft, Amazon, Google, and Meta (Facebook).
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> The percentage change in QQQ's price from yesterday's
                                close to today's close. It tells us whether big tech stocks went up or down today, and
                                by how much.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>The 5× Downside Amplifier:</strong> We give extra weight to negative days
                                because research shows markets fall faster than they rise. A -2% day gets treated as
                                more significant than a +2% day in our crash calculations.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Above +1%:</strong> Tech stocks are rallying - bullish momentum, lower crash
                                  risk
                                </li>
                                <li>
                                  • <strong>-1% to +1%:</strong> Normal daily fluctuation - neutral market conditions
                                </li>
                                <li>
                                  • <strong>Below -1%:</strong> Tech stocks are selling off - bearish pressure,
                                  increased crash risk
                                </li>
                                <li>
                                  • <strong>Below -3%:</strong> Sharp selloff - panic selling may be beginning
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Real-time pricing from Nasdaq stock exchange, updated
                                every trading day.
                              </p>
                              <p className="text-xs text-gray-600">
                                Why it matters: The Nasdaq-100 represents about 40% of the total U.S. stock market
                                value, so its daily moves significantly impact the overall market.
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
                      <span className="text-yellow-600">Flat: -1% to +1%</span>
                      <span>Up: {">"} +1%</span>
                    </div>
                  </div>
                )}

                {/* QQQ Consecutive Down Days */}
                {data.indicators?.qqqConsecDown !== undefined && (
                  <div className="space-y-2">
                    {/* Added tooltip to QQQ Consecutive Down Days indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1">
                        QQQ Consecutive Down Days
                        {/* CHANGE: Enhanced QQQ Consecutive Down Days tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">QQQ Consecutive Down Days - Losing Streak Tracker</p>
                              <p className="text-sm mb-2">
                                This indicator counts how many trading days in a row the QQQ (Nasdaq-100 tech stocks)
                                has closed lower than the previous day. Think of it like a sports team's losing streak -
                                the longer it goes, the more concerning it becomes.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> Simply the number of consecutive days where QQQ's
                                closing price was lower than the day before. It resets to zero whenever QQQ has an up
                                day.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Why Consecutive Losses Matter:</strong> Markets typically bounce back and forth
                                between up and down days. When we see multiple consecutive down days, it suggests
                                persistent selling pressure rather than normal volatility. This pattern often precedes
                                larger market declines.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>0-1 days:</strong> Healthy market - normal buying and selling balance
                                </li>
                                <li>
                                  • <strong>2-3 days:</strong> Warning sign - sellers are gaining control, watch closely
                                </li>
                                <li>
                                  • <strong>4+ days:</strong> Danger zone - sustained selling pressure often leads to
                                  accelerated declines
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Daily closing prices from Nasdaq exchange, tracked
                                continuously.
                              </p>
                              <p className="text-xs text-gray-600">
                                Historical pattern: Market crashes often feature 5-7+ consecutive down days as panic
                                selling takes hold. The 2020 COVID crash had 6 consecutive down days, and the 2008
                                financial crisis had multiple 5-7 day losing streaks.
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
                        {/* CHANGE: Add tooltips for QQQ Below SMAs - these appear to be missing */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">QQQ Below 20-Day SMA - Short-Term Trend</p>
                              <p className="text-sm mb-2">
                                SMA stands for "Simple Moving Average" - it's the average closing price over the last 20
                                trading days (about one month). Think of it like a smoothed-out trend line that filters
                                out daily noise to show the short-term direction.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> Whether today's QQQ price is above or below its
                                20-day average price. Traders use this to identify whether the short-term trend is up
                                (price above average) or down (price below average).
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>0% (far above):</strong> QQQ is trading well above its 20-day average -
                                  strong short-term uptrend
                                </li>
                                <li>
                                  • <strong>~50%:</strong> QQQ is near its 20-day average - neutral, no clear short-term
                                  trend
                                </li>
                                <li>
                                  • <strong>100% (breached):</strong> QQQ has dropped below its 20-day average -
                                  short-term downtrend developing, increased crash risk
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Calculation:</strong> Add up the closing prices from the last 20 trading days,
                                divide by 20. Compare today's price to this average.
                              </p>
                              <p className="text-xs text-gray-600">
                                Trading signal: When price crosses below the 20-day SMA, many traders interpret this as
                                a "sell" signal, which can create self-fulfilling selling pressure.
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
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">QQQ Below 50-Day SMA - Medium-Term Trend</p>
                              <p className="text-sm mb-2">
                                The 50-day SMA is a key medium-term trend indicator watched by institutional investors.
                                It represents the average price over the last 10 weeks (roughly 2.5 months).
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> Whether QQQ's price is currently trading above or
                                below its 50-day moving average. A break below this level is a significant bearish
                                signal.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Above SMA50:</strong> Healthy medium-term uptrend, low risk
                                </li>
                                <li>
                                  • <strong>~50% proximity:</strong> Testing critical support, moderate risk
                                </li>
                                <li>
                                  • <strong>Below SMA50 (100% breached):</strong> Broken support, major bearish signal,
                                  high crash risk
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Calculated from 50 days of closing prices for QQQ.
                              </p>
                              <p className="text-xs text-gray-600">
                                Institutional Significance: Many large funds use the 50-day SMA as a benchmark for trend
                                following. Breaking below it can trigger significant selling pressure from these
                                entities.
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
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">QQQ Below 200-Day SMA - Long-Term Trend</p>
                              <p className="text-sm mb-2">
                                The 200-day SMA is the most critical long-term technical indicator, representing the
                                average price over the last 40 weeks (about 9 months). A break below this level signals
                                a major shift from a bull market to a bear market.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> Whether QQQ's price is trading above or below its
                                200-day moving average. This is the ultimate test of the long-term trend's health.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Above SMA200:</strong> Confirmed bull market, low crash risk
                                </li>
                                <li>
                                  • <strong>~50% proximity:</strong> Testing major support, high risk
                                </li>
                                <li>
                                  • <strong>Below SMA200 (100% breached):</strong> Bear market confirmed, very high
                                  crash risk
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Calculated from 200 days of closing prices for QQQ.
                              </p>
                              <p className="text-xs text-gray-600">
                                Historically: The 200-day SMA has acted as a major support/resistance level in all major
                                market cycles. Breaking below it has consistently marked the beginning of significant
                                bear markets and precedes major crashes.
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
                        QQQ Below Bollinger Band (Lower) - Oversold Signal
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">QQQ Below Bollinger Band (Lower) - Oversold Signal</p>
                              <p className="text-sm mb-2">
                                Bollinger Bands are volatility indicators. The lower band represents a price level two
                                standard deviations below the 20-day moving average. When QQQ falls below this band, it
                                signals that the price is unusually low and the market may be oversold.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> Whether QQQ's current price is below the lower
                                Bollinger Band.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>0% (far above):</strong> Normal trading range, low risk
                                </li>
                                <li>
                                  • <strong>~50% proximity:</strong> Approaching oversold territory, moderate risk
                                </li>
                                <li>
                                  • <strong>100% (breached):</strong> Significantly oversold, high crash risk signal
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Calculation:</strong> Lower Band = 20-Day SMA - (2 * 20-Day Standard Deviation).
                              </p>
                              <p className="text-xs text-gray-600">
                                Trading implication: While touching or slightly breaking the lower band can signal
                                buying opportunities, a significant sustained break below it often precedes sharp
                                downward moves as panic selling takes hold.
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
                            <TooltipContent className="max-w-md bg-red-50 border-red-200">
                              <p className="font-semibold mb-2">Death Cross - Major Bearish Signal</p>
                              <p className="text-sm mb-2">
                                A "Death Cross" occurs when the 50-day moving average (medium-term trend) crosses BELOW
                                the 200-day moving average (long-term trend). This is a widely watched bearish signal
                                that historically precedes major market declines.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> The crossover point between the 50-day SMA and the
                                200-day SMA for QQQ.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>NO (Golden Cross):</strong> 50-day SMA is above 200-day SMA - bullish
                                  long-term trend, low crash risk
                                </li>
                                <li>
                                  • <strong>YES (Death Cross):</strong> 50-day SMA is below 200-day SMA - bearish
                                  long-term trend, high crash risk
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Daily closing prices for QQQ, used to calculate 50-day and
                                200-day SMAs.
                              </p>
                              <p className="text-xs text-gray-600">
                                Major death crosses for the S&P 500 occurred in 1974, 2000, 2007, 2020, and 2022,
                                preceding significant bear markets and crashes.
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
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">VIX - Market Volatility Expectation</p>
                              <p className="text-sm mb-2">
                                The VIX measures how much investors expect the S&P 500 to fluctuate over the next 30
                                days. Think of it as the market's anxiety level—when investors fear significant price
                                swings, they pay more for portfolio insurance, driving the VIX higher.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Financial Impact of Higher Values:</strong> When the VIX spikes above 40,
                                historical data shows the S&P 500 typically experiences 20-40% declines. Portfolio
                                values can evaporate rapidly as panic selling accelerates. Options become prohibitively
                                expensive, making hedging unaffordable for average investors. During the 2008 crisis,
                                VIX hit 80 while portfolios lost 50%+ of their value.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Financial Impact of Lower Values:</strong> VIX below 15 signals complacency,
                                where investors underestimate risk. This creates dangerous conditions where sudden
                                shocks trigger massive sell-offs because nobody prepared. The calm before the storm
                                often sees VIX near 10-12 before violent reversals that catch portfolios unprotected.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Key Thresholds:</strong> VIX below 15 = market complacency, rising crash risk |
                                VIX 15-25 = normal volatility | VIX 25-40 = fear emerging, expect 10-15% corrections |
                                VIX above 40 = panic mode, 20%+ crashes underway
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
                      <span className="text-yellow-600">Elevated: 15-25</span>
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
                        {/* CHANGE: Enhanced VXN tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">VXN - Nasdaq Volatility (Tech Fear Gauge)</p>
                              <p className="text-sm mb-2">
                                VXN is like the VIX, but specifically for the Nasdaq-100 tech stocks instead of the
                                broader S&P 500. Since tech stocks tend to be more volatile than the overall market, VXN
                                helps us measure fear specifically in the technology sector.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> Expected volatility (price swings) in Nasdaq-100
                                stocks over the next 30 days, calculated from options prices on the QQQ ETF. Higher VXN
                                means traders expect bigger tech stock price movements.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Why Tech Volatility Matters:</strong> Technology companies often fall harder and
                                faster than other sectors during market crashes because they typically have higher
                                valuations and are seen as riskier investments.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Below 15:</strong> Tech sector is calm - low volatility, stable conditions
                                </li>
                                <li>
                                  • <strong>15-25:</strong> Normal tech volatility - healthy fluctuation range
                                </li>
                                <li>
                                  • <strong>Above 35:</strong> Tech sector panic - elevated fear, increased crash risk
                                  for tech stocks
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Chicago Board Options Exchange (CBOE), calculated from
                                Nasdaq-100 options prices.
                              </p>
                              <p className="text-xs text-gray-600">
                                VXN tends to spike higher than VIX during tech selloffs, making it an early warning
                                system for tech-led market crashes.
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
                      <span className="text-yellow-600">Elevated: 15-25</span>
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
                        {/* CHANGE: Enhanced RVX tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">RVX - Russell 2000 Volatility (Small Cap Fear)</p>
                              <p className="text-sm mb-2">
                                RVX measures expected volatility in the Russell 2000 Index, which tracks 2,000 small
                                American companies. Small companies are often more vulnerable during economic downturns,
                                so RVX can be an early warning signal.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> Expected 30-day price swings in small-cap stocks,
                                calculated from Russell 2000 ETF (IWM) options prices. Small companies tend to be more
                                volatile than large companies, so RVX is typically higher than VIX.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Why Small Caps Matter:</strong> Small companies are often the "canary in the
                                coal mine" - they struggle first during economic slowdowns because they have less cash,
                                less pricing power, and more debt relative to their size.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Below 18:</strong> Small caps are stable - healthy economic conditions
                                </li>
                                <li>
                                  • <strong>18-25:</strong> Normal small-cap volatility - standard risk levels
                                </li>
                                <li>
                                  • <strong>Above 30:</strong> Small caps are in trouble - economic stress, increased
                                  crash risk
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> Chicago Board Options Exchange (CBOE), derived from
                                Russell 2000 options.
                              </p>
                              <p className="text-xs text-gray-600">
                                Leading indicator: RVX often spikes before VIX during the early stages of market
                                selloffs, as smart money sells risky small caps first.
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
                      <span className="text-yellow-600">Normal: 18-25</span>
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
                        {/* CHANGE: Enhanced VIX Term Structure tooltip */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">VIX Term Structure - Fear Now vs. Fear Later</p>
                              <p className="text-sm mb-2">
                                This indicator compares today's VIX (spot VIX - fear right now) to VIX futures one month
                                out. It tells us whether traders think volatility will increase or decrease over the
                                next month.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>What It Measures:</strong> The ratio of current VIX to 1-month VIX futures. When
                                spot VIX is higher than futures (ratio above 1.0), the market structure is "inverted" -
                                a warning sign called "backwardation."
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Understanding Backwardation:</strong> Normally, traders expect volatility to be
                                higher in the future than today, so VIX futures trade above spot VIX (ratio below 1.0).
                                But during market stress, fear spikes so high RIGHT NOW that it exceeds future
                                expectations - this is backwardation, and it's dangerous.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>How to Read It:</strong>
                              </p>
                              <ul className="text-sm space-y-1 mb-2">
                                <li>
                                  • <strong>Below 1.0 (Contango):</strong> Normal market structure - today's fear is
                                  lower than expected future fear. Safe.
                                </li>
                                <li>
                                  • <strong>1.0-1.2 (Slight Backwardation):</strong> Market stress building - fear is
                                  elevated but manageable
                                </li>
                                <li>
                                  • <strong>Above 1.2 (Deep Backwardation):</strong> Market panic - immediate fear
                                  dominates, crash conditions forming
                                </li>
                              </ul>
                              <p className="text-sm mb-2">
                                <strong>Data Source:</strong> CBOE spot VIX and VIX futures contracts, updated
                                continuously during trading.
                              </p>
                              <p className="text-xs text-gray-600">
                                Crisis signal: During the 2008 crash and 2020 COVID crash, VIX term structure went into
                                deep backwardation (ratios above 1.5) as panic set in.
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
                      <span className="text-yellow-600">Normal: 1.0-1.2</span>
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
                        {/* CHANGE: Enhanced ATR tooltip to focus on financial impact */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">ATR - Daily Price Swing Magnitude</p>
                              <p className="text-sm mb-2">
                                ATR measures the average daily price range over the past 14 trading days. It quantifies
                                how violently prices are moving—a $50 ATR means the market swings roughly $50 per day on
                                average.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Financial Impact of Higher Values:</strong> When ATR exceeds 50 points, your
                                portfolio can lose or gain $5,000+ daily on a $100,000 position. High ATR forces traders
                                to reduce position sizes dramatically—risking normal amounts becomes financially
                                dangerous. Stop-losses get triggered more frequently, locking in losses. During 2020's
                                crash, SPY's ATR hit 70+, meaning daily $7,000 swings per $100K invested.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Financial Impact of Lower Values:</strong> ATR below 25 suggests stable
                                conditions where portfolio volatility is minimal. However, extremely low ATR (under 15)
                                often precedes volatility explosions—when complacency breaks, ATR can triple overnight,
                                catching investors in positions sized for calm markets that suddenly face violent
                                swings.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Key Thresholds:</strong> ATR below 25 = low volatility, stable portfolios | ATR
                                25-40 = normal fluctuations | ATR 50-70 = high volatility, significant daily losses
                                possible | ATR above 70 = extreme chaos, portfolios whipsawing violently
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
                      <span className="text-yellow-600">Normal: 25-40</span>
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
                        {/* CHANGE: Revised LTV tooltip to focus on financial impact */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">LTV - 90-Day Volatility Pattern</p>
                              <p className="text-sm mb-2">
                                LTV measures price variability over 90 days, showing whether market turbulence is
                                temporary or sustained. It's expressed as an annualized percentage representing expected
                                annual fluctuation.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Financial Impact of Higher Values:</strong> LTV above 20% means your portfolio
                                could realistically swing 20%+ annually based on recent patterns—a $500,000 portfolio
                                faces potential $100,000+ fluctuations. When LTV sustained above 30% during 2008-2009,
                                portfolios experienced -50% crashes. High LTV signals prolonged market stress where
                                recovery takes quarters or years, not days.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Financial Impact of Lower Values:</strong> LTV below 10% indicates remarkably
                                stable conditions with minimal portfolio fluctuation expected. However, extended periods
                                under 10% often breed complacency—investors increase leverage and take outsized risks,
                                amplifying damage when LTV inevitably surges.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>Key Thresholds:</strong> LTV below 10% = very stable, possible complacency | LTV
                                10-15% = normal healthy volatility | LTV 15-20% = elevated uncertainty, increased risk |
                                LTV above 20% = sustained market stress, major losses likely | LTV above 30% = extreme
                                prolonged chaos
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
                      <span className="text-yellow-600">Normal: 10-15%</span>
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
                        {/* CHANGE: Revised Bullish Percent tooltip to focus on financial impact */}
                        {tooltipsEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                              <p className="font-semibold mb-2">Bullish Percent Index - Market Breadth Strength</p>
                              <p className="text-sm mb-2">
                                This measures the percentage of stocks in the S&P 500 showing bullish technical patterns
                                on point-and-figure charts, ranging from 0-100%.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>FINANCIAL IMPACT OF HIGH VALUES (Above 70%):</strong> Overbought conditions
                                where too many stocks are extended and vulnerable. Above 80% historically precedes
                                10-15% corrections as fewer stocks can continue rallying—market runs out of fuel. Like a
                                party where everyone's already dancing, no new buyers remain to push prices higher,
                                leading to reversals as early bulls take profits.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>FINANCIAL IMPACT OF LOW VALUES (Below 30%):</strong> Oversold conditions
                                signaling capitulation where panic selling has exhausted itself. Below 20% often marks
                                major bottoms where patient investors find exceptional entry points—stocks are hated and
                                cheap. However, during severe crashes, readings can stay depressed for months as bear
                                markets grind lower.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>KEY THRESHOLDS:</strong> Below 30% = oversold, possible bottom forming | 30-50%
                                = normal healthy breadth | 50-70% = strong uptrend, momentum positive | Above 70% =
                                overbought, correction risk rising | Above 80% = extremely overbought, major reversal
                                likely
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <span className="font-bold">{data.indicators.bullishPercent.toFixed(0)}%</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      <div
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          marginLeft: `${Math.min(100, Math.max(0, data.indicators.bullishPercent))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Oversold: {"<"}30%</span>
                      <span className="text-yellow-600">Normal: 30-50%</span>
                      <span>Overbought: {">"}70%</span>
                    </div>
                  </div>
                )}

                {/* Yield Curve (10Y-2Y Spread) */}
                {data.indicators.yieldCurve !== undefined && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">Yield Curve (10Y-2Y Spread)</h4>
                      {/* CHANGE: Revised Yield Curve tooltip to focus on financial impact */}
                      {tooltipsEnabled && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                            <p className="font-semibold mb-2">Yield Curve - Recession Warning Signal</p>
                            <p className="text-sm mb-2">
                              This measures the difference between 10-year and 2-year Treasury bond interest rates. It
                              reveals bond investors' economic expectations—when short-term rates exceed long-term rates
                              (inversion), recession is imminent.
                            </p>
                            <p className="text-sm mb-2">
                              <strong>Financial Impact of Inversion (Below 0%):</strong> Yield curve inversions have
                              preceded every recession since 1950, occurring 6-24 months before major crashes. When it
                              inverts, stock markets typically decline 20-40% during the subsequent recession. Bond
                              investors are essentially betting the economy will contract so badly that the Federal
                              Reserve must slash rates dramatically. Portfolios face systematic destruction as earnings
                              collapse and unemployment surges.
                            </p>
                            <p className="text-sm mb-2">
                              <strong>Financial Impact of Positive Values:</strong> Spreads above 100 basis points
                              indicate healthy economic growth expectations where stocks can appreciate steadily.
                              Moderate spreads (50-100 bps) suggest stable conditions. However, when spreads narrow
                              toward zero, it signals growth is slowing and recession risk is building—time to reduce
                              portfolio risk.
                            </p>
                            <p className="text-sm mb-2">
                              <strong>Key Thresholds:</strong> Above +100 bps = strong growth, bullish for stocks | +50
                              to +100 bps = normal economy | 0 to +50 bps = slowing growth, rising risk | Below 0%
                              (inverted) = recession warning, expect 20-40% stock declines within 24 months
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">Inverted: &lt;0</span>
                        <span className="text-gray-700">Flat: 0-50</span>
                        <span className="text-gray-700">Steep: &gt;100</span>
                      </div>
                      <div className="w-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded h-4"></div>
                      <div
                        className="absolute top-[28px] w-1 h-6 bg-black"
                        style={{
                          left: `${Math.min(Math.max(((data.indicators.yieldCurve + 100) / 300) * 100, 0), 100)}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-2xl font-bold">{data.indicators.yieldCurve.toFixed(0)} bps</span>
                      <span
                        className={`text-sm font-medium ${
                          data.indicators.yieldCurve < 0
                            ? "text-red-600"
                            : data.indicators.yieldCurve > 100
                              ? "text-green-600"
                              : "text-yellow-600"
                        }`}
                      >
                        {data.indicators.yieldCurve < 0
                          ? "Inverted (Recession Risk)"
                          : data.indicators.yieldCurve > 100
                            ? "Steep (Healthy)"
                            : "Flat"}
                      </span>
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
                  <TrendingUp className="h-5 w-5 text-orange-600" />
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
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">Put/Call Ratio</h4>
                      <InfoTooltip title="Put/Call Ratio - Options Market Fear Gauge: This compares bearish put option volume to bullish call option volume. Higher ratios mean more investors are buying insurance against crashes. FINANCIAL IMPACT OF HIGH VALUES (Above 1.0): Extreme fear dominates—investors are aggressively hedging, signaling they expect major declines. When above 1.3, markets often experience 10-20% corrections as defensive positioning becomes self-fulfilling. However, extreme readings can also mark capitulation bottoms where panic reaches maximum. FINANCIAL IMPACT OF LOW VALUES (Below 0.7): Dangerous complacency where investors buy calls (bets on gains) instead of protecting portfolios with puts. This unhedged euphoria precedes crashes—when sentiment shifts suddenly, unprotected portfolios suffer full losses with no insurance. The 2021 meme stock bubble saw ratios near 0.5 before sharp reversals. KEY THRESHOLDS: Below 0.6 = extreme complacency, crash setup | 0.7-1.0 = balanced sentiment | Above 1.0 = rising fear | Above 1.3 = panic, possible capitulation bottom" />
                    </div>
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">Extreme Fear: &gt;1.3</span>
                        <span className="text-gray-700">Balanced: 0.7-1.0</span>
                        <span className="text-gray-700">Complacency: &lt;0.6</span>
                      </div>
                      <div className="w-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded h-4"></div>
                      <div
                        className="absolute top-[28px] w-1 h-6 bg-black"
                        style={{
                          left: `${Math.min(Math.max(((data.indicators.putCallRatio - 0.4) / 1.2) * 100, 0), 100)}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-2xl font-bold">{data.indicators.putCallRatio.toFixed(2)}</span>
                      <span
                        className={`text-sm font-medium ${
                          data.indicators.putCallRatio > 1.0
                            ? "text-red-600"
                            : data.indicators.putCallRatio < 0.7
                              ? "text-green-600"
                              : "text-yellow-600"
                        }`}
                      >
                        {data.indicators.putCallRatio > 1.0
                          ? "High Fear"
                          : data.indicators.putCallRatio < 0.7
                            ? "Complacent"
                            : "Balanced"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Fear & Greed Index */}
                {data.indicators.fearGreedIndex !== undefined && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">Fear & Greed Index</h4>
                      <InfoTooltip title="The Fear & Greed Index is a composite score (0-100) created by CNN Money that measures market emotions by analyzing seven factors: stock price momentum, stock price strength, stock price breadth, put/call ratios, market volatility (VIX), safe haven demand (bonds vs stocks), and junk bond demand. Scores below 25 indicate 'Extreme Fear' where investors are too worried (potential buying opportunity), while scores above 75 show 'Extreme Greed' where euphoria dominates (crash warning). The index updates daily and combines these diverse sentiment signals into one number, making it easy to gauge whether fear or greed is driving the market. Historically, extreme greed readings have preceded major corrections." />
                    </div>
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">Extreme Fear: &lt;25</span>
                        <span className="text-gray-700">Neutral: 45-55</span>
                        <span className="text-gray-700">Extreme Greed: &gt;75</span>
                      </div>
                      <div className="w-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded h-4"></div>
                      <div
                        className="absolute top-[28px] w-1 h-6 bg-black"
                        style={{ left: `${Math.min(Math.max(data.indicators.fearGreedIndex, 0), 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-2xl font-bold">{data.indicators.fearGreedIndex.toFixed(0)}</span>
                      <span
                        className={`text-sm font-medium ${
                          data.indicators.fearGreedIndex < 25
                            ? "text-red-600"
                            : data.indicators.fearGreedIndex > 75
                              ? "text-green-600"
                              : "text-yellow-600"
                        }`}
                      >
                        {data.indicators.fearGreedIndex < 25
                          ? "Extreme Fear"
                          : data.indicators.fearGreedIndex > 75
                            ? "Extreme Greed"
                            : "Neutral"}
                      </span>
                    </div>
                  </div>
                )}

                {/* AAII Bullish Sentiment */}
                {data.indicators.aaiiBullish !== undefined && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">AAII Bullish Sentiment</h4>
                      <InfoTooltip title="The American Association of Individual Investors (AAII) Bullish Sentiment is a weekly survey asking individual investors whether they expect stocks to rise, fall, or stay flat over the next six months. The percentage who are bullish (expecting gains) typically ranges from 20-60%. Readings above 50% indicate excessive optimism where retail investors are overly confident (often a contrarian sell signal), while readings below 30% show pessimism (potential buy signal). This survey has been conducted since 1987 and captures the mood of everyday investors rather than professionals. Historically, when retail sentiment becomes extremely bullish, it has preceded market corrections as 'dumb money' piles in at the top." />
                    </div>
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">Bearish: &lt;30%</span>
                        <span className="text-gray-700">Neutral: 40-50%</span>
                        <span className="text-gray-700">Euphoric: &gt;55%</span>
                      </div>
                      <div className="w-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded h-4"></div>
                      <div
                        className="absolute top-[28px] w-1 h-6 bg-black"
                        style={{ left: `${Math.min(Math.max(data.indicators.aaiiBullish, 0), 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-2xl font-bold">{data.indicators.aaiiBullish.toFixed(1)}%</span>
                      <span
                        className={`text-sm font-medium ${
                          data.indicators.aaiiBullish > 55
                            ? "text-red-600"
                            : data.indicators.aaiiBullish < 30
                              ? "text-green-600"
                              : "text-yellow-600"
                        }`}
                      >
                        {data.indicators.aaiiBullish > 55
                          ? "Euphoric"
                          : data.indicators.aaiiBullish < 30
                            ? "Bearish"
                            : "Neutral"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Short Interest */}
                {data.indicators.shortInterest !== undefined && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">Short Interest (% of Float)</h4>
                      <InfoTooltip title="Short Interest - Professional Bearish Bets: Measures the percentage of shares sold short, indicating how many investors are betting on price declines. FINANCIAL IMPACT OF HIGH VALUES (Above 5%): Sophisticated traders are massively positioned for crashes, expecting 15-30% declines. High short interest validates bearish scenarios but also creates 'short squeeze' risk where shorts are forced to buy back shares at losses, temporarily spiking prices before resumption of downtrend. During 2008, financial stocks had 20%+ short interest before collapsing 80%. FINANCIAL IMPACT OF LOW VALUES (Below 2%): Minimal bearish positioning suggests either genuine optimism or dangerous complacency. Low shorts remove a natural buyer (short covering) that cushions declines, allowing for faster crashes when selling begins. It also signals few sophisticated investors see crash risk. KEY THRESHOLDS: Below 2% = low professional concern, possibly complacent | 2-4% = normal skepticism | Above 5% = widespread bearish conviction | Above 10% = extreme pessimism, massive downside expected" />
                    </div>
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">Low: &lt;2%</span>
                        <span className="text-gray-700">Normal: 2-4%</span>
                        <span className="text-gray-700">High: &gt;5%</span>
                      </div>
                      <div className="w-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded h-4"></div>
                      <div
                        className="absolute top-[28px] w-1 h-6 bg-black"
                        style={{
                          left: `${Math.min(Math.max(((data.indicators.shortInterest - 1) / 6) * 100, 0), 100)}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-2xl font-bold">{data.indicators.shortInterest.toFixed(1)}%</span>
                      <span
                        className={`text-sm font-medium ${
                          data.indicators.shortInterest > 5
                            ? "text-red-600"
                            : data.indicators.shortInterest < 2
                              ? "text-green-600"
                              : "text-yellow-600"
                        }`}
                      >
                        {data.indicators.shortInterest > 5
                          ? "High Shorts"
                          : data.indicators.shortInterest < 2
                            ? "Low Shorts"
                            : "Normal"}
                      </span>
                    </div>
                  </div>
                )}

                {/* ATR - Average True Range */}
                {data.indicators.atr !== undefined && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">ATR - Average True Range</h4>
                      <InfoTooltip title="Average True Range (ATR) measures the average volatility or 'choppiness' of price movements over 14 days, expressed in index points. For the S&P 500, typical ATR values range from 15-30 points during calm markets, but can spike to 50+ during turbulent periods. ATR increases when prices swing wildly (large daily ranges), signaling uncertainty and emotional trading. The calculation takes the greatest of: (today's high - today's low), (today's high - yesterday's close), or (yesterday's close - today's low), then averages these 'true ranges' over 14 periods. Higher ATR means bigger intraday swings and greater market stress, often preceding or during corrections. It's a pure volatility measure without directional bias." />
                    </div>
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">Low Vol: &lt;25</span>
                        <span className="text-gray-700">Normal: 25-40</span>
                        <span className="text-gray-700">High Vol: &gt;50</span>
                      </div>
                      <div className="w-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded h-4"></div>
                      <div
                        className="absolute top-[28px] w-1 h-6 bg-black"
                        style={{
                          left: `${Math.min(Math.max(((data.indicators.atr - 10) / 60) * 100, 0), 100)}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-2xl font-bold">{data.indicators.atr.toFixed(1)}</span>
                      <span
                        className={`text-sm font-medium ${
                          data.indicators.atr > 50
                            ? "text-red-600"
                            : data.indicators.atr < 25
                              ? "text-green-600"
                              : "text-yellow-600"
                        }`}
                      >
                        {data.indicators.atr > 50 ? "High Vol" : data.indicators.atr < 25 ? "Low Vol" : "Normal"}
                      </span>
                    </div>
                  </div>
                )}

                {/* LTV - Long-term Volatility */}
                {data.indicators.ltv !== undefined && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">LTV - Long-term Volatility</h4>
                      <InfoTooltip title="Long-term Volatility (LTV) measures the annualized standard deviation of daily returns over 252 trading days (one year), expressed as a percentage. It captures how much prices have varied from their average over the long term. Typical LTV for the S&P 500 is 10-15% during stable periods, but spikes to 20%+ during market stress and can exceed 30% during crashes like 2008 or 2020. The calculation uses the statistical standard deviation formula applied to daily percentage returns over the past year, then multiplied by the square root of 252 to annualize it. Higher LTV indicates sustained uncertainty and risk, while very low LTV (<10%) suggests complacency that often precedes volatility spikes. It's a backward-looking measure of realized price swings." />
                    </div>
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">Stable: &lt;10%</span>
                        <span className="text-gray-700">Normal: 10-15%</span>
                        <span className="text-gray-700">Elevated: &gt;20%</span>
                      </div>
                      <div className="w-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded h-4"></div>
                      <div
                        className="absolute top-[28px] w-1 h-6 bg-black"
                        style={{
                          left: `${Math.min(Math.max(((data.indicators.ltv - 5) / 30) * 100, 0), 100)}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-2xl font-bold">{data.indicators.ltv.toFixed(1)}%</span>
                      <span
                        className={`text-sm font-medium ${
                          data.indicators.ltv > 20
                            ? "text-red-600"
                            : data.indicators.ltv < 10
                              ? "text-green-600"
                              : "text-yellow-600"
                        }`}
                      >
                        {data.indicators.ltv > 20 ? "Elevated" : data.indicators.ltv < 10 ? "Stable" : "Normal"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Bullish Percent Index */}
                {data.indicators.bullishPercent !== undefined && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">Bullish Percent Index</h4>
                      <InfoTooltip title="The Bullish Percent Index (BPI) measures the percentage of stocks in a major index (like the S&P 500) that are showing bullish technical patterns on point-and-figure charts, ranging from 0-100%. FINANCIAL IMPACT OF HIGH VALUES (Above 70%): Overbought conditions where too many stocks are extended and vulnerable. Above 80% historically precedes 10-15% corrections as fewer stocks can continue rallying—market runs out of fuel. Like a party where everyone's already dancing, no new buyers remain to push prices higher, leading to reversals as early bulls take profits. FINANCIAL IMPACT OF LOW VALUES (Below 30%): Oversold conditions signaling capitulation where panic selling has exhausted itself. Below 20% often marks major bottoms where patient investors find exceptional entry points—stocks are hated and cheap. However, during severe crashes, readings can stay depressed for months as bear markets grind lower. KEY THRESHOLDS: Below 30% = oversold, possible bottom forming | 30-50% = normal healthy breadth | 50-70% = strong uptrend, momentum positive | Above 70% = overbought, correction risk rising | Above 80% = extremely overbought, major reversal likely" />
                    </div>
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">Oversold: &lt;30%</span>
                        <span className="text-gray-700">Normal: 30-50%</span>
                        <span className="text-gray-700">Overbought: &gt;70%</span>
                      </div>
                      <div className="w-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded h-4"></div>
                      <div
                        className="absolute top-[28px] w-1 h-6 bg-black"
                        style={{ left: `${Math.min(Math.max(data.indicators.bullishPercent, 0), 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-2xl font-bold">{data.indicators.bullishPercent.toFixed(0)}%</span>
                      <span
                        className={`text-sm font-medium ${
                          data.indicators.bullishPercent > 70
                            ? "text-red-600"
                            : data.indicators.bullishPercent < 30
                              ? "text-green-600"
                              : "text-yellow-600"
                        }`}
                      >
                        {data.indicators.bullishPercent > 70
                          ? "Overbought"
                          : data.indicators.bullishPercent < 30
                            ? "Oversold"
                            : "Normal"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Yield Curve (10Y-2Y Spread) */}
                {data.indicators.yieldCurve !== undefined && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">Yield Curve (10Y-2Y Spread)</h4>
                      {/* CHANGE: Revised Yield Curve tooltip to focus on financial impact */}
                      {tooltipsEnabled && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-md bg-blue-50 border-blue-200">
                            <p className="font-semibold mb-2">Yield Curve - Recession Warning Signal</p>
                            <p className="text-sm mb-2">
                              This measures the difference between 10-year and 2-year Treasury bond interest rates. It
                              reveals bond investors' economic expectations—when short-term rates exceed long-term rates
                              (inversion), recession is imminent.
                            </p>
                            <p className="text-sm mb-2">
                              <strong>Financial Impact of Inversion (Below 0%):</strong> Yield curve inversions have
                              preceded every recession since 1950, occurring 6-24 months before major crashes. When it
                              inverts, stock markets typically decline 20-40% during the subsequent recession. Bond
                              investors are essentially betting the economy will contract so badly that the Federal
                              Reserve must slash rates dramatically. Portfolios face systematic destruction as earnings
                              collapse and unemployment surges.
                            </p>
                            <p className="text-sm mb-2">
                              <strong>Financial Impact of Positive Values:</strong> Spreads above 100 basis points
                              indicate healthy economic growth expectations where stocks can appreciate steadily.
                              Moderate spreads (50-100 bps) suggest stable conditions. However, when spreads narrow
                              toward zero, it signals growth is slowing and recession risk is building—time to reduce
                              portfolio risk.
                            </p>
                            <p className="text-sm mb-2">
                              <strong>Key Thresholds:</strong> Above +100 bps = strong growth, bullish for stocks | +50
                              to +100 bps = normal economy | 0 to +50 bps = slowing growth, rising risk | Below 0%
                              (inverted) = recession warning, expect 20-40% stock declines within 24 months
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">Inverted: &lt;0</span>
                        <span className="text-gray-700">Flat: 0-50</span>
                        <span className="text-gray-700">Steep: &gt;100</span>
                      </div>
                      <div className="w-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded h-4"></div>
                      <div
                        className="absolute top-[28px] w-1 h-6 bg-black"
                        style={{
                          left: `${Math.min(Math.max(((data.indicators.yieldCurve + 100) / 300) * 100, 0), 100)}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-2xl font-bold">{data.indicators.yieldCurve.toFixed(0)} bps</span>
                      <span
                        className={`text-sm font-medium ${
                          data.indicators.yieldCurve < 0
                            ? "text-red-600"
                            : data.indicators.yieldCurve > 100
                              ? "text-green-600"
                              : "text-yellow-600"
                        }`}
                      >
                        {data.indicators.yieldCurve < 0
                          ? "Inverted (Recession Risk)"
                          : data.indicators.yieldCurve > 100
                            ? "Steep (Healthy)"
                            : "Flat"}
                      </span>
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
                                <strong>Impact:</strong> High P/E ratios indicate markets vulnerable to corrections
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
                              <p className="font-semibold mb-1">Buffett Indicator - Market Size vs Economy</p>
                              <p className="text-sm mb-2">
                                This divides total stock market value by Gross Domestic Product, showing whether stock
                                prices are proportional to the economy's actual production capacity. Warren Buffett
                                calls it "probably the best single measure" of valuation.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>FINANCIAL IMPACT OF HIGH VALUES (Above 150%):</strong> Markets are severely
                                disconnected from economic reality. At 200%+, stocks are priced as if companies will
                                generate profits impossible given actual GDP. The 2000 tech bubble peaked at 140% before
                                a -50% crash. Above 180% signals 30-50% corrections as prices realign with economic
                                fundamentals.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>FINANCIAL IMPACT OF LOW VALUES (Below 120%):</strong> Stocks are reasonably
                                valued relative to economic output, offering attractive risk/reward. Historical average
                                is 75-100%—buying below 120% typically provides strong long-term returns with lower
                                crash risk.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>KEY THRESHOLDS:</strong> Below 120% = undervalued to fair | 120-150% =
                                moderately overvalued | 150-180% = significantly overvalued, high risk | Above 200% =
                                extreme bubble, major crash likely
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
                              <p className="font-semibold mb-1">Shiller CAPE - Long-Term Valuation Gauge</p>
                              <p className="text-sm mb-2">
                                This compares current stock prices to average inflation-adjusted earnings over the past
                                10 years, revealing whether markets are expensive or cheap relative to fundamental
                                profits.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>FINANCIAL IMPACT OF HIGH VALUES (Above 30):</strong> Markets are overvalued by
                                50-100%+ compared to historical norms. The higher CAPE goes, the worse subsequent
                                returns become. CAPE above 35 preceded the 1929 crash (-89%), 2000 tech bubble (-50%),
                                and signals 20-50% corrections are likely over the next 3-5 years as valuations revert
                                to the mean.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>FINANCIAL IMPACT OF LOW VALUES (Below 20):</strong> Stocks are reasonably priced
                                or undervalued, offering attractive entry points with lower crash risk. Historical
                                average is 16-17—buying below 20 typically generates strong 10-year returns.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>KEY THRESHOLDS:</strong> Below 20 = undervalued | 20-30 = fair value | 30-35 =
                                significantly overvalued, elevated crash risk | Above 35 = extreme bubble territory,
                                major corrections likely
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
          <AccordionItem value="pillar4" className="border border-b rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-10">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  <span className="text-lg font-semibold">Pillar 4 - Macro</span>
                  <span className="text-sm text-gray-600">Weight: 20% | 7 indicators</span>
                </div>
                <span className="text-2xl font-bold text-blue-600">{Math.round(data.pillars.macro)}/100</span>
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
                      <span className="text-yellow-600">Neutral: 2-4%</span>
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
                      <span className="text-yellow-600">Normal: 3-5%</span>
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
                              <p className="font-semibold mb-1">US Debt-to-GDP - Government Leverage</p>
                              <p className="text-sm mb-2">
                                This measures total federal government debt as a percentage of GDP, indicating how much
                                the nation has borrowed relative to its economic output and ability to repay.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>FINANCIAL IMPACT OF HIGH VALUES (Above 120%):</strong> Excessive debt burdens
                                constrain economic growth and force governments to choose between raising taxes (killing
                                growth) or inflating away debt (destroying savings). Above 130% historically triggers
                                fiscal crises—bond yields spike, currency weakens, and stock markets decline 20-40% as
                                confidence erodes. Greece, Japan, and other high-debt nations experienced prolonged
                                economic stagnation and market crashes.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>FINANCIAL IMPACT OF LOW VALUES (Below 90%):</strong> Sustainable debt levels
                                where government spending doesn't crowd out private investment. Below 60% is considered
                                ideal, providing fiscal flexibility to respond to crises without triggering inflation or
                                default concerns.
                              </p>
                              <p className="text-sm mb-2">
                                <strong>KEY THRESHOLDS:</strong> Below 90% = healthy and sustainable | 90-120% =
                                elevated but manageable | Above 120% = very high risk, fiscal crisis possible | Above
                                130% = dangerous territory, potential for currency and market crisis
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
                      <span className="text-yellow-600">Elevated: 100-120%</span>
                      <span className="text-red-600">Danger: {">"}130%</span>
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
            Final CCPI = Σ(Pillar Score × Weight)
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
