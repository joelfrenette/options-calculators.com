"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  PlayCircle,
  Clock,
  Database,
  Zap,
  BarChart3,
  Search,
  Calculator,
} from "lucide-react"

interface IndicatorAudit {
  name: string
  formula: string
  formulaExplanation: string
  algorithm?: string
  primaryApi: string
  fallbackChain: string[]
  currentSource: string
  status: "live" | "fallback" | "failed"
  statusReason: string
  value?: any
  lastUpdated?: string
}

interface PageAudit {
  id: string
  name: string
  category: "analyze" | "scan" | "execute"
  description: string
  indicators: IndicatorAudit[]
}

interface SystemAuditResult {
  timestamp: string
  duration: number
  summary: {
    totalApis: number
    liveApis: number
    fallbackApis: number
    failedApis: number
    totalIndicators: number
    workingIndicators: number
  }
  verdict: "PASS" | "CONDITIONAL PASS" | "FAIL"
  pages: PageAudit[]
}

export function FullSystemAudit() {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentCheck, setCurrentCheck] = useState("")
  const [auditResult, setAuditResult] = useState<SystemAuditResult | null>(null)

  const runFullAudit = async () => {
    setLoading(true)
    setProgress(0)
    setCurrentCheck("Initializing audit...")

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev
        return prev + Math.random() * 15
      })
    }, 500)

    const checks = [
      "Checking Earnings Calendar APIs...",
      "Auditing Index Trend data sources...",
      "Testing VIX Index connections...",
      "Verifying Fear & Greed components...",
      "Scanning Panic Index indicators...",
      "Analyzing Social Sentiment sources...",
      "Validating CCPI calculations...",
      "Checking CPI Inflation data...",
      "Testing Fed Rate APIs...",
      "Auditing Jobs data sources...",
      "Verifying Insider Trading feeds...",
      "Testing SCAN tab calculators...",
      "Validating EXECUTE tab formulas...",
      "Compiling results...",
    ]

    let checkIndex = 0
    const checkInterval = setInterval(() => {
      if (checkIndex < checks.length) {
        setCurrentCheck(checks[checkIndex])
        checkIndex++
      }
    }, 800)

    try {
      const response = await fetch("/api/admin/full-system-audit")
      const data = await response.json()
      setAuditResult(data)
      setProgress(100)
      setCurrentCheck("Audit complete!")
    } catch (error) {
      console.error("Audit failed:", error)
      setCurrentCheck("Audit failed - check console")
    } finally {
      clearInterval(progressInterval)
      clearInterval(checkInterval)
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "live":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case "fallback":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusLight = (status: string) => {
    const colors = {
      live: "bg-green-500",
      fallback: "bg-yellow-500",
      failed: "bg-red-500",
    }
    return (
      <div className="relative flex-shrink-0">
        <div
          className={`w-3 h-3 ${colors[status as keyof typeof colors] || "bg-gray-400"} rounded-full animate-pulse`}
        />
        <div
          className={`absolute inset-0 w-3 h-3 ${colors[status as keyof typeof colors] || "bg-gray-400"} rounded-full blur-sm`}
        />
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      live: "bg-green-100 text-green-800 border-green-300",
      fallback: "bg-yellow-100 text-yellow-800 border-yellow-300",
      failed: "bg-red-100 text-red-800 border-red-300",
    }
    const labels = {
      live: "LIVE",
      fallback: "FALLBACK",
      failed: "FAILED",
    }
    return (
      <Badge variant="outline" className={`${styles[status as keyof typeof styles]} font-semibold text-xs`}>
        {labels[status as keyof typeof labels]}
      </Badge>
    )
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "analyze":
        return <BarChart3 className="h-4 w-4" />
      case "scan":
        return <Search className="h-4 w-4" />
      case "execute":
        return <Calculator className="h-4 w-4" />
      default:
        return <Database className="h-4 w-4" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "analyze":
        return "text-blue-600 bg-blue-50 border-blue-200"
      case "scan":
        return "text-purple-600 bg-purple-50 border-purple-200"
      case "execute":
        return "text-green-600 bg-green-50 border-green-200"
      default:
        return "text-gray-600 bg-gray-50 border-gray-200"
    }
  }

  const exportAuditReport = () => {
    if (!auditResult) return

    const report = `# FULL SYSTEM AUDIT REPORT
Generated: ${new Date(auditResult.timestamp).toLocaleString()}
Duration: ${auditResult.duration}ms

## VERDICT: ${auditResult.verdict}

## SUMMARY
- Total Indicators: ${auditResult.summary.totalIndicators}
- Working Indicators: ${auditResult.summary.workingIndicators}
- Live APIs: ${auditResult.summary.liveApis}
- Fallback APIs: ${auditResult.summary.fallbackApis}
- Failed APIs: ${auditResult.summary.failedApis}
- Success Rate: ${((auditResult.summary.workingIndicators / auditResult.summary.totalIndicators) * 100).toFixed(1)}%

---

${auditResult.pages
  .map(
    (page) => `
## ${page.name.toUpperCase()} (${page.category.toUpperCase()})
${page.description}

${page.indicators
  .map(
    (ind) => `
### ${ind.name}
- **Status**: ${ind.status.toUpperCase()} - ${ind.statusReason}
- **Formula**: ${ind.formula}
- **Explanation**: ${ind.formulaExplanation}
${ind.algorithm ? `- **Algorithm**: ${ind.algorithm}` : ""}
- **Primary API**: ${ind.primaryApi}
- **Fallback Chain**: ${ind.fallbackChain.join(" → ")}
- **Current Source**: ${ind.currentSource}
`,
  )
  .join("\n")}
`,
  )
  .join("\n---\n")}

---
END OF AUDIT REPORT
`

    const blob = new Blob([report], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `full-system-audit-${new Date().toISOString().split("T")[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const analyzePages = auditResult?.pages.filter((p) => p.category === "analyze") || []
  const scanPages = auditResult?.pages.filter((p) => p.category === "scan") || []
  const executePages = auditResult?.pages.filter((p) => p.category === "execute") || []

  return (
    <div className="space-y-6">
      {/* Audit Control Panel */}
      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <Zap className="h-6 w-6 text-yellow-400" />
                Full System Audit
              </CardTitle>
              <CardDescription className="text-slate-300">
                Comprehensive audit of all APIs, data sources, formulas, and algorithms across every page
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {auditResult && (
                <Button
                  onClick={exportAuditReport}
                  variant="outline"
                  className="bg-transparent border-white text-white hover:bg-white/10"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Report
                </Button>
              )}
              <Button onClick={runFullAudit} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Auditing...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Run Full Audit
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {loading && (
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{currentCheck}</span>
                <span className="text-slate-400">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Audit Results */}
      {auditResult && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card
              className={`${auditResult.verdict === "PASS" ? "bg-green-50 border-green-300" : auditResult.verdict === "CONDITIONAL PASS" ? "bg-yellow-50 border-yellow-300" : "bg-red-50 border-red-300"}`}
            >
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-center text-slate-900">{auditResult.verdict}</div>
                <div className="text-sm text-center text-slate-600">Verdict</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-green-700 text-center">{auditResult.summary.liveApis}</div>
                <div className="text-sm text-center text-green-600">Live APIs</div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-yellow-700 text-center">{auditResult.summary.fallbackApis}</div>
                <div className="text-sm text-center text-yellow-600">Fallback</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-red-700 text-center">{auditResult.summary.failedApis}</div>
                <div className="text-sm text-center text-red-600">Failed</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-blue-700 text-center">
                  {((auditResult.summary.workingIndicators / auditResult.summary.totalIndicators) * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-center text-blue-600">Success Rate</div>
              </CardContent>
            </Card>
          </div>

          {/* Audit Duration */}
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Clock className="h-4 w-4" />
            Audit completed in {auditResult.duration}ms at {new Date(auditResult.timestamp).toLocaleString()}
          </div>

          {/* ANALYZE Tab Pages */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <BarChart3 className="h-5 w-5 text-blue-400" />
                ANALYZE Tab ({analyzePages.length} pages)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="space-y-2">
                {analyzePages.map((page) => (
                  <AccordionItem
                    key={page.id}
                    value={page.id}
                    className="border border-slate-600 rounded-lg px-4 bg-slate-700"
                  >
                    <AccordionTrigger className="hover:no-underline text-white">
                      <div className="flex items-center gap-3 w-full">
                        <Badge variant="outline" className={getCategoryColor(page.category)}>
                          {getCategoryIcon(page.category)}
                        </Badge>
                        <span className="font-semibold text-white">{page.name}</span>
                        <span className="text-sm text-slate-300 ml-auto mr-4">
                          {page.indicators.filter((i) => i.status === "live").length}/{page.indicators.length} live
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        <p className="text-sm text-slate-300">{page.description}</p>
                        {page.indicators.map((indicator, idx) => (
                          <div key={idx} className="border border-slate-500 rounded-lg p-4 bg-slate-600">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                {getStatusLight(indicator.status)}
                                {getStatusIcon(indicator.status)}
                                <span className="font-semibold text-white">{indicator.name}</span>
                              </div>
                              {getStatusBadge(indicator.status)}
                            </div>

                            <div className="space-y-2 text-sm">
                              <div className="bg-slate-800 p-3 rounded border border-slate-500">
                                <div className="font-mono text-xs text-green-400 mb-1">{indicator.formula}</div>
                                <div className="text-slate-300">{indicator.formulaExplanation}</div>
                              </div>

                              {indicator.algorithm && (
                                <div className="flex gap-2">
                                  <span className="font-medium text-slate-200">Algorithm:</span>
                                  <span className="text-slate-300">{indicator.algorithm}</span>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-4 mt-3">
                                <div>
                                  <span className="font-medium text-slate-200">Primary API:</span>
                                  <div className="text-xs text-cyan-400 mt-1">{indicator.primaryApi}</div>
                                </div>
                                <div>
                                  <span className="font-medium text-slate-200">Current Source:</span>
                                  <div className="text-xs text-yellow-400 mt-1 font-semibold">
                                    {indicator.currentSource}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-2">
                                <span className="font-medium text-slate-200">Fallback Chain:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {indicator.fallbackChain.map((fb, i) => (
                                    <Badge
                                      key={i}
                                      variant="outline"
                                      className="text-xs bg-slate-700 text-slate-200 border-slate-500"
                                    >
                                      {i + 1}. {fb}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              <div className="mt-2 p-2 bg-slate-700 rounded text-xs border border-slate-500">
                                <span className="font-medium text-slate-200">Status Reason:</span>{" "}
                                <span className="text-slate-300">{indicator.statusReason}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* SCAN Tab Pages */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Search className="h-5 w-5 text-purple-400" />
                SCAN Tab ({scanPages.length} pages)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="space-y-2">
                {scanPages.map((page) => (
                  <AccordionItem
                    key={page.id}
                    value={page.id}
                    className="border border-slate-600 rounded-lg px-4 bg-slate-700"
                  >
                    <AccordionTrigger className="hover:no-underline text-white">
                      <div className="flex items-center gap-3 w-full">
                        <Badge variant="outline" className={getCategoryColor(page.category)}>
                          {getCategoryIcon(page.category)}
                        </Badge>
                        <span className="font-semibold text-white">{page.name}</span>
                        <span className="text-sm text-slate-300 ml-auto mr-4">
                          {page.indicators.filter((i) => i.status === "live").length}/{page.indicators.length} live
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        <p className="text-sm text-slate-300">{page.description}</p>
                        {page.indicators.map((indicator, idx) => (
                          <div key={idx} className="border border-slate-500 rounded-lg p-4 bg-slate-600">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                {getStatusLight(indicator.status)}
                                {getStatusIcon(indicator.status)}
                                <span className="font-semibold text-white">{indicator.name}</span>
                              </div>
                              {getStatusBadge(indicator.status)}
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="bg-slate-800 p-3 rounded border border-slate-500">
                                <div className="font-mono text-xs text-green-400 mb-1">{indicator.formula}</div>
                                <div className="text-slate-300">{indicator.formulaExplanation}</div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="font-medium text-slate-200">Primary API:</span>
                                  <div className="text-xs text-cyan-400 mt-1">{indicator.primaryApi}</div>
                                </div>
                                <div>
                                  <span className="font-medium text-slate-200">Current Source:</span>
                                  <div className="text-xs text-yellow-400 mt-1 font-semibold">
                                    {indicator.currentSource}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2">
                                <span className="font-medium text-slate-200">Fallback Chain:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {indicator.fallbackChain.map((fb, i) => (
                                    <Badge
                                      key={i}
                                      variant="outline"
                                      className="text-xs bg-slate-700 text-slate-200 border-slate-500"
                                    >
                                      {i + 1}. {fb}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="mt-2 p-2 bg-slate-700 rounded text-xs border border-slate-500">
                                <span className="font-medium text-slate-200">Status Reason:</span>{" "}
                                <span className="text-slate-300">{indicator.statusReason}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* EXECUTE Tab Pages */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Calculator className="h-5 w-5 text-green-400" />
                EXECUTE Tab ({executePages.length} pages)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="space-y-2">
                {executePages.map((page) => (
                  <AccordionItem
                    key={page.id}
                    value={page.id}
                    className="border border-slate-600 rounded-lg px-4 bg-slate-700"
                  >
                    <AccordionTrigger className="hover:no-underline text-white">
                      <div className="flex items-center gap-3 w-full">
                        <Badge variant="outline" className={getCategoryColor(page.category)}>
                          {getCategoryIcon(page.category)}
                        </Badge>
                        <span className="font-semibold text-white">{page.name}</span>
                        <span className="text-sm text-slate-300 ml-auto mr-4">
                          {page.indicators.filter((i) => i.status === "live").length}/{page.indicators.length} live
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        <p className="text-sm text-slate-300">{page.description}</p>
                        {page.indicators.map((indicator, idx) => (
                          <div key={idx} className="border border-slate-500 rounded-lg p-4 bg-slate-600">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                {getStatusLight(indicator.status)}
                                {getStatusIcon(indicator.status)}
                                <span className="font-semibold text-white">{indicator.name}</span>
                              </div>
                              {getStatusBadge(indicator.status)}
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="bg-slate-800 p-3 rounded border border-slate-500">
                                <div className="font-mono text-xs text-green-400 mb-1">{indicator.formula}</div>
                                <div className="text-slate-300">{indicator.formulaExplanation}</div>
                              </div>
                              {indicator.algorithm && (
                                <div className="flex gap-2">
                                  <span className="font-medium text-slate-200">Algorithm:</span>
                                  <span className="text-slate-300">{indicator.algorithm}</span>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="font-medium text-slate-200">Primary API:</span>
                                  <div className="text-xs text-cyan-400 mt-1">{indicator.primaryApi}</div>
                                </div>
                                <div>
                                  <span className="font-medium text-slate-200">Current Source:</span>
                                  <div className="text-xs text-yellow-400 mt-1 font-semibold">
                                    {indicator.currentSource}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2">
                                <span className="font-medium text-slate-200">Fallback Chain:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {indicator.fallbackChain.map((fb, i) => (
                                    <Badge
                                      key={i}
                                      variant="outline"
                                      className="text-xs bg-slate-700 text-slate-200 border-slate-500"
                                    >
                                      {i + 1}. {fb}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="mt-2 p-2 bg-slate-700 rounded text-xs border border-slate-500">
                                <span className="font-medium text-slate-200">Status Reason:</span>{" "}
                                <span className="text-slate-300">{indicator.statusReason}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!auditResult && !loading && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-12 text-center">
            <Zap className="h-16 w-16 mx-auto mb-4 text-yellow-400 opacity-50" />
            <h3 className="text-xl font-semibold mb-2 text-white">No Audit Results</h3>
            <p className="text-slate-400 mb-4">
              Click "Run Full Audit" to scan all APIs, data sources, and algorithms across your entire system.
            </p>
            <Button onClick={runFullAudit} className="bg-green-600 hover:bg-green-700 text-white">
              <PlayCircle className="mr-2 h-4 w-4" />
              Run Full Audit
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
