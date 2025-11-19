"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Zap, AlertCircle, RefreshCw } from 'lucide-react'

interface AIProvider {
  name: string
  priority: number
  speed: string
  hasKey: boolean
  status: "online" | "offline"
  endpoint: string
  usedFor: string[]
  averageLatency: string
}

interface AIStatusData {
  timestamp: string
  summary: {
    total: number
    online: number
    offline: number
  }
  providers: AIProvider[]
}

export function AIStatusAdmin() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<AIStatusData | null>(null)

  useEffect(() => {
    fetchAIStatus()
  }, [])

  const fetchAIStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/ai-status")
      const statusData = await response.json()
      setData(statusData)
    } catch (error) {
      console.error("Failed to fetch AI status:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600" />
              AI Provider Status & Fallback Chain
            </CardTitle>
            <CardDescription>
              Real-time tracking of AI providers in order of priority (fastest to slowest)
            </CardDescription>
          </div>
          <Button onClick={fetchAIStatus} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="text-3xl font-bold text-green-700">{data.summary.online}</div>
                <div className="text-sm text-green-600 font-medium">Online</div>
              </div>
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="text-3xl font-bold text-red-700">{data.summary.offline}</div>
                <div className="text-sm text-red-600 font-medium">Offline</div>
              </div>
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="text-3xl font-bold text-blue-700">{data.summary.total}</div>
                <div className="text-sm text-blue-600 font-medium">Total Providers</div>
              </div>
            </div>

            <div className="space-y-2 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="font-semibold text-slate-900 mb-2">Legend: AI Provider Status</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="text-slate-700">
                    <strong>Online</strong> - API key configured & ready
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <span className="text-slate-700">
                    <strong>Offline</strong> - API key missing
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-yellow-600" />
                  <span className="text-slate-700">
                    <strong>Priority</strong> - Fallback order (1st → 4th)
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-slate-900">AI Provider Fallback Chain</h3>
              <div className="space-y-3">
                {data.providers.map((provider) => (
                  <div
                    key={provider.name}
                    className="flex items-start gap-4 p-5 border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="relative">
                        {provider.status === "online" ? (
                          <>
                            <div className="w-8 h-8 bg-green-500 rounded-full animate-pulse" />
                            <div className="absolute inset-0 w-8 h-8 bg-green-400 rounded-full blur-sm" />
                          </>
                        ) : (
                          <>
                            <div className="w-8 h-8 bg-red-500 rounded-full" />
                          </>
                        )}
                      </div>
                      {provider.status === "online" ? (
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                      ) : (
                        <XCircle className="h-8 w-8 text-red-600" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-slate-900">{provider.name}</p>
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded font-semibold">
                          Priority #{provider.priority}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-semibold">
                          {provider.speed}
                        </span>
                        {provider.hasKey ? (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">
                            ✓ KEY CONFIGURED
                          </span>
                        ) : (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-semibold">
                            ✗ KEY MISSING
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 mb-2 font-mono bg-slate-100 px-2 py-1 rounded">
                        <span className="font-semibold text-slate-700">Endpoint:</span> {provider.endpoint}
                      </p>

                      <p className="text-sm text-slate-700 mb-2">
                        <span className="font-semibold">Average Latency:</span> {provider.averageLatency}
                      </p>

                      <p className="text-sm text-slate-600 mb-2">
                        <span className="font-semibold">Used For:</span> {provider.usedFor.join(", ")}
                      </p>

                      {!provider.hasKey && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                          <strong>Action Required:</strong> Add this API key to your Vercel environment variables
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">How the AI Fallback Chain Works:</h4>
              <ol className="text-sm text-blue-800 space-y-1 ml-4">
                <li>1. <strong>OpenAI GPT-4o</strong> is tried first (fastest, highest quality)</li>
                <li>2. If OpenAI fails, falls back to <strong>Anthropic Claude</strong></li>
                <li>3. If Claude fails, falls back to <strong>Groq Llama</strong></li>
                <li>4. If Groq fails, falls back to <strong>Grok xAI</strong></li>
                <li>5. Only if all 4 AI providers fail, uses historical baseline data</li>
              </ol>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
