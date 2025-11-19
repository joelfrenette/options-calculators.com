"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Database } from 'lucide-react'
import { Badge } from "@/components/ui/badge"

interface DataSource {
  name: string
  pillar: string
  primarySource: string
  fallbackChain?: string[]
  currentSource?: string
  fallback: string
  details?: string
  status: "live" | "aiFallback" | "grokFallback" | "baseline" | "failed"
  statusLabel: string
  color: "green" | "yellow" | "orange" | "red"
}

interface DataSourceStatus {
  timestamp: string
  summary: {
    total: number
    live: number
    aiFallback?: number
    grokFallback: number
    baseline: number
    failed: number
  }
  sources: DataSource[]
}

export function ApiDataSourceStatus() {
  const [status, setStatus] = useState<DataSourceStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/data-source-status")
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      setStatus(data)
      setError(null)
    } catch (error) {
      console.error("[v0] Failed to fetch data source status:", error)
      setError("Unable to load API status. Please check your connection.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const getStatusIcon = (color: string) => {
    switch (color) {
      case "green":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case "yellow":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case "orange":
        return <AlertTriangle className="h-5 w-5 text-orange-600" />
      case "red":
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <XCircle className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusBadge = (color: string, label: string) => {
    const colorClasses = {
      green: "bg-green-100 text-green-800 border-green-300",
      yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
      orange: "bg-orange-100 text-orange-800 border-orange-300",
      red: "bg-red-100 text-red-800 border-red-300"
    }
    return (
      <Badge variant="outline" className={`${colorClasses[color as keyof typeof colorClasses]} font-semibold`}>
        {label}
      </Badge>
    )
  }

  const getStatusLight = (color: string) => {
    const lightColors = {
      green: "bg-green-500",
      yellow: "bg-yellow-500",
      orange: "bg-orange-500",
      red: "bg-red-500"
    }
    return (
      <div className="relative">
        <div className={`w-3 h-3 ${lightColors[color as keyof typeof lightColors]} rounded-full animate-pulse`} />
        <div className={`absolute inset-0 w-3 h-3 ${lightColors[color as keyof typeof lightColors]} rounded-full blur-sm`} />
      </div>
    )
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              API Data Source Status
            </CardTitle>
            <CardDescription>
              Real-time tracking of data sources and API availability across the entire platform
            </CardDescription>
          </div>
          <Button onClick={fetchStatus} disabled={loading} size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? "Checking..." : "Refresh"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-4 bg-red-50 border border-red-300 rounded-lg mb-6">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-900 mb-1">Connection Error</h4>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {status && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{status.summary.live}</div>
                <div className="text-sm text-green-600">Live API Data</div>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">{status.summary.aiFallback || status.summary.grokFallback}</div>
                <div className="text-sm text-yellow-600">AI-Fetched Data</div>
              </div>
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="text-2xl font-bold text-orange-700">{status.summary.baseline}</div>
                <div className="text-sm text-orange-600">Baseline (Stale)</div>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-2xl font-bold text-red-700">{status.summary.failed}</div>
                <div className="text-sm text-red-600">Failed</div>
              </div>
            </div>

            <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <h4 className="font-semibold text-sm mb-3 text-slate-700">Legend: Data Source Status</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="font-medium">Live API Data</span>
                  <span className="text-slate-600">- Real-time from primary API</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <span className="font-medium">AI-Fetched</span>
                  <span className="text-slate-600">- Retrieved via AI (OpenAI/Anthropic/Groq/Grok)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full" />
                  <span className="font-medium">Baseline</span>
                  <span className="text-slate-600">- Historical average/fallback</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <span className="font-medium">Failed</span>
                  <span className="text-slate-600">- All sources unavailable</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                CCPI Calculator Data Sources
              </h3>

              <div className="space-y-3">
                {status.sources.map((source, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusLight(source.color)}
                      {getStatusIcon(source.color)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-slate-900">{source.name}</h4>
                          <p className="text-xs text-slate-500">{source.pillar}</p>
                        </div>
                        {getStatusBadge(source.color, source.statusLabel)}
                      </div>

                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700">Primary:</span>
                          <span className="text-slate-600">{source.primarySource}</span>
                        </div>
                        {source.fallbackChain && source.fallbackChain.length > 0 ? (
                          <div className="flex items-start gap-2">
                            <span className="font-medium text-slate-700">Fallback Chain:</span>
                            <span className="text-slate-600 text-xs">{source.fallbackChain.join(" → ")}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">Fallback:</span>
                            <span className="text-slate-600">{source.fallback}</span>
                          </div>
                        )}
                        {source.currentSource && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">Current Source:</span>
                            <span className="text-slate-600 font-semibold">{source.currentSource}</span>
                          </div>
                        )}
                        {source.details && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">Details:</span>
                            <span className="text-slate-600 text-xs">{source.details}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(status.summary.baseline > 0 || status.summary.failed > 0) && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-yellow-900 mb-1">Data Quality Notice</h4>
                    <p className="text-sm text-yellow-800">
                      Some APIs are using baseline/fallback data. CCPI scores may differ from production if live APIs are unavailable.
                      Check your environment variables and API keys to ensure all integrations are properly configured.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-500 mt-6">
              Last checked: {new Date(status.timestamp).toLocaleString()}
            </p>
          </>
        )}

        {!status && !loading && !error && (
          <div className="text-center py-8 text-slate-500">
            <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Click "Refresh" to check data source status</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
