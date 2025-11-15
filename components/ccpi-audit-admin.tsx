"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Download, Database, TrendingUp, Activity } from 'lucide-react'

interface AuditData {
  timestamp: string
  indicators: any[]
  pillars: any[]
  ccpiAggregation: any
  confidence: any
  canaries: any
  summary: {
    totalIndicators: number
    liveIndicators: number
    baselineIndicators: number
    failedIndicators: number
  }
}

export function CcpiAuditAdmin() {
  const [loading, setLoading] = useState(false)
  const [auditData, setAuditData] = useState<AuditData | null>(null)

  useEffect(() => {
    fetchAudit()
  }, [])

  const fetchAudit = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/ccpi-audit")
      const data = await response.json()
      setAuditData(data)
    } catch (error) {
      console.error("Failed to fetch CCPI audit:", error)
    } finally {
      setLoading(false)
    }
  }

  const exportReport = () => {
    if (!auditData) return
    
    const report = `# CCPI AUDIT REPORT
Generated: ${new Date(auditData.timestamp).toLocaleString()}

## Summary
- Total Indicators: ${auditData.summary.totalIndicators}
- Live Data: ${auditData.summary.liveIndicators}
- Baseline Fallback: ${auditData.summary.baselineIndicators}
- Failed: ${auditData.summary.failedIndicators}
- Coverage: ${Math.round((auditData.summary.liveIndicators / auditData.summary.totalIndicators) * 100)}%

## All 23 Indicators
${auditData.indicators.map((ind: any, i: number) => `
${i + 1}. **${ind.name}**
   - Pillar: ${ind.pillar}
   - Source: ${ind.source_url}
   - API Endpoint: ${ind.api_endpoint}
   - Fetch Method: ${ind.fetch_method}
   - Status: ${ind.status}
   - Last Fetched: ${ind.last_fetched_at}
   - Current Value: ${JSON.stringify(ind.raw_sample)}
   - Thresholds: ${JSON.stringify(ind.threshold)}
`).join("\n")}

## Pillar Formulas
${auditData.pillars.map((pillar: any) => `
### ${pillar.pillar} (Weight: ${pillar.weight * 100}%)
Formula: ${pillar.formula}
Calculation: ${pillar.calculation}

Indicators:
${pillar.indicators.map((ind: any) => `
- ${ind.name} (Weight: ${ind.weight * 100}%)
  Scoring: ${ind.scoring}
`).join("\n")}
`).join("\n")}

## CCPI Aggregation
Formula: ${auditData.ccpiAggregation.formula}
Weights: ${JSON.stringify(auditData.ccpiAggregation.weights, null, 2)}
Validation: ${auditData.ccpiAggregation.validation}

Interpretation:
${auditData.ccpiAggregation.interpretation.map((int: any) => `
- ${int.range}: ${int.level} - ${int.description}
`).join("\n")}

## Confidence Score
Formula: ${auditData.confidence.formula}

Components:
${auditData.confidence.components.map((comp: any) => `
- ${comp.name} (${comp.weight * 100}%): ${comp.logic}
`).join("\n")}

Output: ${auditData.confidence.output}

## Canary Signals
Total Possible: ${auditData.canaries.total_possible}
Logic: ${auditData.canaries.logic}

Severity Levels:
- High: ${auditData.canaries.severity_levels.high}
- Medium: ${auditData.canaries.severity_levels.medium}
- Low: ${auditData.canaries.severity_levels.low}

Alert Levels:
${auditData.canaries.alert_levels.map((alert: any) => `
- ${alert.canaries} canaries: ${alert.alert} - ${alert.action}
`).join("\n")}

---
**END OF AUDIT REPORT**
`
    
    const blob = new Blob([report], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ccpi-audit-${new Date().toISOString().split("T")[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white rounded-lg p-6 border">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">CCPI Audit Dashboard</h2>
          <p className="text-sm text-gray-600">
            Complete transparency for all 23 indicators, pillar formulas, and CCPI calculation
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAudit} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Run Audit
          </Button>
          {auditData && (
            <Button onClick={exportReport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          )}
        </div>
      </div>

      {auditData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-white border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-blue-900">Total Indicators</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">{auditData.summary.totalIndicators}</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-green-900">Live Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">{auditData.summary.liveIndicators}</p>
                <p className="text-xs text-green-700">Real-time APIs</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-yellow-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-yellow-900">Baseline Values</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-yellow-600">{auditData.summary.baselineIndicators}</p>
                <p className="text-xs text-yellow-700">Historical averages (fallback)</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-red-900">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">{auditData.summary.failedIndicators}</p>
                <p className="text-xs text-red-700">Need attention</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="indicators" className="w-full">
            <TabsList className="grid grid-cols-5 gap-2 bg-gray-100 p-1">
              <TabsTrigger value="indicators">
                <Database className="h-4 w-4 mr-2" />
                Indicators (23)
              </TabsTrigger>
              <TabsTrigger value="pillars">
                <Activity className="h-4 w-4 mr-2" />
                Pillar Formulas
              </TabsTrigger>
              <TabsTrigger value="aggregation">
                <TrendingUp className="h-4 w-4 mr-2" />
                CCPI Aggregation
              </TabsTrigger>
              <TabsTrigger value="confidence">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confidence Logic
              </TabsTrigger>
              <TabsTrigger value="canaries">
                <AlertCircle className="h-4 w-4 mr-2" />
                Canary Signals
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: All 23 Indicators */}
            <TabsContent value="indicators">
              <Card className="bg-white">
                <CardHeader className="bg-white">
                  <CardTitle className="text-gray-900">All 23 Indicators - Live Data Sources</CardTitle>
                  <CardDescription className="text-gray-600">
                    Comprehensive list of every indicator with API endpoints, fetch methods, and current values
                  </CardDescription>
                </CardHeader>
                <CardContent className="bg-white">
                  <div className="space-y-4">
                    {["Valuation Stress", "Technical Fragility", "Macro & Liquidity Risk", "Sentiment & Media Feedback", "Capital Flows & Positioning", "Structural"].map((pillar) => {
                      const pillarIndicators = auditData.indicators.filter((ind: any) => ind.pillar === pillar)
                      
                      return (
                        <Card key={pillar} className="bg-gray-50">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg">{pillar} ({pillarIndicators.length})</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {pillarIndicators.map((ind: any) => (
                                <div key={ind.id} className="border rounded-lg p-4 bg-white">
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                      <h4 className="font-semibold text-gray-900">{ind.name}</h4>
                                      <p className="text-xs text-gray-600 mt-1">ID: {ind.id} | Pillar: {ind.pillar}</p>
                                    </div>
                                    <Badge className={
                                      ind.status === "Live" ? "bg-green-100 text-green-800" :
                                      ind.status === "Baseline" ? "bg-yellow-100 text-yellow-800" :
                                      "bg-red-100 text-red-800"
                                    }>
                                      {ind.status}
                                    </Badge>
                                  </div>
                                  
                                  <div className="space-y-2 text-sm">
                                    <div>
                                      <span className="font-semibold">Source URL:</span>
                                      <p className="text-gray-600 break-all">{ind.source_url}</p>
                                    </div>
                                    <div>
                                      <span className="font-semibold">API Endpoint:</span>
                                      <p className="text-gray-600">{ind.api_endpoint}</p>
                                    </div>
                                    <div>
                                      <span className="font-semibold">Fetch Method:</span>
                                      <p className="text-gray-600">{ind.fetch_method}</p>
                                    </div>
                                    <div>
                                      <span className="font-semibold">Last Fetched:</span>
                                      <p className="text-gray-600">{new Date(ind.last_fetched_at).toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <span className="font-semibold">Current Value:</span>
                                      <code className="block bg-gray-100 p-2 rounded mt-1 text-xs">
                                        {JSON.stringify(ind.raw_sample, null, 2)}
                                      </code>
                                    </div>
                                    <div>
                                      <span className="font-semibold">Thresholds:</span>
                                      <code className="block bg-gray-100 p-2 rounded mt-1 text-xs">
                                        {JSON.stringify(ind.threshold, null, 2)}
                                      </code>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 2: Pillar Formulas */}
            <TabsContent value="pillars">
              <Card className="bg-white">
                <CardHeader className="bg-white">
                  <CardTitle className="text-gray-900">Pillar Score Formulas - Full Transparency</CardTitle>
                  <CardDescription className="text-gray-600">
                    Exact formulas, weights, and scoring logic for each of the 6 pillars
                  </CardDescription>
                </CardHeader>
                <CardContent className="bg-white">
                  <div className="space-y-4">
                    {auditData.pillars.map((pillar: any, index: number) => (
                      <Card key={index} className="bg-blue-50">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle>{pillar.pillar}</CardTitle>
                            <Badge className="bg-blue-600 text-white">
                              Weight: {(pillar.weight * 100).toFixed(0)}%
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-700 font-mono mt-2">{pillar.formula}</p>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-700 mb-4"><strong>Calculation:</strong> {pillar.calculation}</p>
                          
                          <div className="space-y-3">
                            {pillar.indicators.map((ind: any, idx: number) => (
                              <div key={idx} className="border rounded-lg p-3 bg-white">
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="font-semibold">{ind.name}</h5>
                                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                    Weight: {(ind.weight * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600"><strong>Scoring:</strong> {ind.scoring}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 3: CCPI Aggregation */}
            <TabsContent value="aggregation">
              <Card className="bg-white">
                <CardHeader className="bg-white">
                  <CardTitle className="text-gray-900">CCPI Final Score - Weighted Pillar Aggregation</CardTitle>
                  <CardDescription className="text-gray-600">
                    How the 6 pillar scores combine into the final CCPI score (0-100)
                  </CardDescription>
                </CardHeader>
                <CardContent className="bg-white">
                  <div className="space-y-6">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h3 className="font-semibold text-blue-900 mb-2">Formula</h3>
                      <code className="block bg-white p-3 rounded text-sm">
                        {auditData.ccpiAggregation.formula}
                      </code>
                    </div>
                    
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <h3 className="font-semibold text-green-900 mb-3">Pillar Weights</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(auditData.ccpiAggregation.weights).map(([key, value]: [string, any]) => (
                          <div key={key} className="flex items-center justify-between bg-white p-3 rounded">
                            <span className="font-medium capitalize">{key}:</span>
                            <span className="text-lg font-bold">{(value * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-sm text-green-800">
                        <strong>{auditData.ccpiAggregation.validation}</strong>
                      </p>
                    </div>
                    
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <h3 className="font-semibold text-purple-900 mb-3">Interpretation</h3>
                      <div className="space-y-2">
                        {auditData.ccpiAggregation.interpretation.map((int: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between bg-white p-3 rounded">
                            <div>
                              <span className="font-mono text-sm">{int.range}</span>
                              <span className="ml-3 font-semibold">{int.level}</span>
                            </div>
                            <span className="text-sm text-gray-600">{int.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 4: Confidence & Certainty */}
            <TabsContent value="confidence">
              <Card className="bg-white">
                <CardHeader className="bg-white">
                  <CardTitle className="text-gray-900">Confidence & Certainty Score</CardTitle>
                  <CardDescription className="text-gray-600">
                    How certainty is calculated from data freshness, pillar alignment, and indicator consistency
                  </CardDescription>
                </CardHeader>
                <CardContent className="bg-white">
                  <div className="space-y-6">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h3 className="font-semibold text-blue-900 mb-2">Formula</h3>
                      <code className="block bg-white p-3 rounded text-sm break-all">
                        {auditData.confidence.formula}
                      </code>
                    </div>
                    
                    <div className="space-y-3">
                      {auditData.confidence.components.map((comp: any, idx: number) => (
                        <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">{comp.name}</h4>
                            <Badge>{(comp.weight * 100).toFixed(0)}%</Badge>
                          </div>
                          <p className="text-sm text-gray-700">{comp.logic}</p>
                        </div>
                      ))}
                    </div>
                    
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <h3 className="font-semibold text-green-900 mb-2">Output</h3>
                      <p className="text-sm text-green-800">{auditData.confidence.output}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 5: Canary Signals */}
            <TabsContent value="canaries">
              <Card className="bg-white">
                <CardHeader className="bg-white">
                  <CardTitle className="text-gray-900">Canary Signals - Early Warning System</CardTitle>
                  <CardDescription className="text-gray-600">
                    How the system triggers warnings based on indicator thresholds
                  </CardDescription>
                </CardHeader>
                <CardContent className="bg-white">
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <Card className="bg-blue-50 border-blue-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg text-blue-900">Total Indicators</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-3xl font-bold text-blue-600">{auditData.canaries.total_possible}</p>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-red-50 border-red-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg text-red-900">High Severity</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-red-800">{auditData.canaries.severity_levels.high}</p>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-yellow-50 border-yellow-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg text-yellow-900">Medium Severity</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-yellow-800">{auditData.canaries.severity_levels.medium}</p>
                        </CardContent>
                      </Card>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="font-semibold mb-2">Logic</h3>
                      <p className="text-sm text-gray-700">{auditData.canaries.logic}</p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-3">Alert Levels</h3>
                      <div className="space-y-2">
                        {auditData.canaries.alert_levels.map((alert: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-3 border rounded">
                            <div>
                              <span className="font-semibold">{alert.canaries} active canaries</span>
                              <span className="ml-3 text-sm text-gray-600">→ {alert.alert}</span>
                            </div>
                            <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded">
                              {alert.action}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
