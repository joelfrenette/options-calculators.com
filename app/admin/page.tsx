"use client"

import { useState, useEffect } from "react"
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, LogOut, Database, Activity, CheckCircle2, XCircle, AlertCircle, Megaphone, BarChart3, TrendingUp, Gauge, Target, Github, ExternalLink, Trash2, Plus, Save, Image, Key } from 'lucide-react'
import { ApiKeysManager } from "@/components/api-keys-manager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CcpiAuditAdmin } from "@/components/ccpi-audit-admin"

interface ApiStatus {
  name: string
  status: "online" | "error" | "unknown"
  message: string
  hasKey: boolean
}

interface AuditCheck {
  name: string
  status: "pass" | "fail"
  message: string
  details: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [apiStatuses, setApiStatuses] = useState<ApiStatus[]>([])
  const [auditResults, setAuditResults] = useState<any>(null)
  const [adImages, setAdImages] = useState<string[]>([])
  const [adUrl, setAdUrl] = useState("")
  const [newAdImage, setNewAdImage] = useState("")
  const [dataSourceStatus, setDataSourceStatus] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("status")

  useEffect(() => {
    fetchApiStatus()
  }, [])

  useEffect(() => {
    if (activeTab === "audit" && !auditResults) {
      fetchAuditResults()
    }
  }, [activeTab, auditResults])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  const fetchApiStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/api-status")
      const data = await response.json()
      setApiStatuses(data.apis || [])
    } catch (error) {
      console.error("Failed to fetch API status:", error)
      setApiStatuses([])
    } finally {
      setLoading(false)
    }
  }

  const fetchAuditResults = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/audit")
      const data = await response.json()
      setAuditResults(data)
    } catch (error) {
      console.error("Failed to fetch audit results:", error)
    } finally {
      setLoading(false)
    }
  }

  const exportAuditReport = () => {
    if (!auditResults) return

    const report = `
# AUDIT REPORT - OPTIONS-CALCULATORS.COM
Generated: ${new Date(auditResults.timestamp).toLocaleString()}

## VERDICT: ${auditResults.verdict}
${auditResults.summary}

## ISSUES FOUND: ${auditResults.issues.length === 0 ? "NONE" : auditResults.issues.length}
${auditResults.issues.length === 0 ? "✓ No fake data detected\n✓ No random number generators\n✓ No hardcoded values pretending to be live data\n✓ All formulas match industry standards" : auditResults.issues.map((issue: string) => `- ${issue}`).join("\n")}

---

## DATA SOURCES - ALL VERIFIED AS REAL

${auditResults.dataSources.map((ds: any, i: number) => `
${i + 1}. **${ds.page}** - ${ds.endpoint}
   - Primary: ${ds.primary}
   ${ds.fallback ? `- Fallback: ${ds.fallback}` : ""}
   - Status: ${ds.status}
   - Real Data: ${ds.realData ? "YES" : "NO"}
   - Details: ${ds.details || "N/A"}
`).join("\n")}

---

## CALCULATIONS & FORMULAS - ALL LEGITIMATE

${auditResults.calculations.map((calc: any, i: number) => `
${i + 1}. **${calc.name}**
   - Formula: ${calc.formula}
   - Source: ${calc.source}
   - Inputs: ${calc.inputs}
   - Weighting: ${calc.weighting}
   - ${calc.validated}
`).join("\n")}

---

## ENVIRONMENT VARIABLES CONFIRMED

${auditResults.environmentVariables.map((env: any) => `
- ${env.key}: ${env.configured} - ${env.purpose} ${env.required ? "(REQUIRED)" : "(OPTIONAL)"}
  Status: ${env.status}
`).join("\n")}

---

## CODE QUALITY CHECKS

${auditResults.codeQuality.map((check: any) => `
- **${check.check}**: ${check.status}
  ${check.details}
`).join("\n")}

---

**END OF AUDIT REPORT**
`

    // Create downloadable file
    const blob = new Blob([report], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `audit-report-${new Date().toISOString().split("T")[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }


  const fetchAdData = async () => {
    try {
      const response = await fetch("/api/admin/ads")
      const data = await response.json()
      setAdImages(data.images)
      setAdUrl(data.targetUrl)
    } catch (error) {
      console.error("Failed to fetch ad data:", error)
    }
  }

  const saveAdData = async () => {
    setLoading(true)
    try {
      await fetch("/api/admin/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: adImages, targetUrl: adUrl }),
      })
      alert("Ad settings saved successfully!")
    } catch (error) {
      alert("Failed to save ad settings")
    } finally {
      setLoading(false)
    }
  }

  const addAdImage = () => {
    if (newAdImage.trim()) {
      setAdImages([...adImages, newAdImage.trim()])
      setNewAdImage("")
    }
  }

  const deleteAdImage = (index: number) => {
    setAdImages(adImages.filter((_, i) => i !== index))
  }

  const handleBackup = async () => {
    setLoading(true)

    try {
      const response = await fetch("/api/admin/backup")

      if (!response.ok) {
        throw new Error("Backup check failed")
      }

      const data = await response.json()

      alert(
        `Backup Information:\n\n${data.instructions.join("\n\n")}\n\nYour code is version-controlled via Git and automatically backed up with each deployment on Vercel.`,
      )
    } catch (error) {
      alert("Unable to check backup status")
    } finally {
      setLoading(false)
    }
  }

  const fetchDataSourceStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/api-status")
      const data = await response.json()
      setDataSourceStatus(data)
    } catch (error) {
      console.error("Failed to fetch data source status:", error)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-400 mt-1">Manage OPTIONS-CALCULATORS.COM</p>
          </div>
          <Button onClick={handleLogout} className="bg-white text-slate-900 hover:bg-slate-100" size="sm">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        <Tabs defaultValue="status" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 lg:grid-cols-8 gap-2 bg-slate-800 p-1 h-auto mb-6">
            <TabsTrigger value="status" className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <Activity className="h-4 w-4 mr-2" />
              API Status
            </TabsTrigger>
            <TabsTrigger value="ccpi-audit" className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              CCPI Audit
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Audit
            </TabsTrigger>
            <TabsTrigger value="backup" className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <Database className="h-4 w-4 mr-2" />
              Backup
            </TabsTrigger>
            <TabsTrigger value="ads" className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <Image className="h-4 w-4 mr-2" />
              Ads
            </TabsTrigger>
            <TabsTrigger value="trend" className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <TrendingUp className="h-4 w-4 mr-2" />
              Trend
            </TabsTrigger>
            <TabsTrigger value="sentiment" className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <Gauge className="h-4 w-4 mr-2" />
              Sentiment
            </TabsTrigger>
            <TabsTrigger value="sources" className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <Database className="h-4 w-4 mr-2" />
              Data Sources
            </TabsTrigger>
          </TabsList>

          {/* Status Tab */}
          <TabsContent value="status">
            <div className="space-y-6">
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    API Status & Key Management
                  </CardTitle>
                  <CardDescription>Monitor all external APIs and manage configuration</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-6">
                    <Button onClick={fetchApiStatus} disabled={loading}>
                      {loading ? "Checking..." : "Refresh Status"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open('https://vercel.com/joelfrenettes/options-calculators-com/settings/environment-variables', '_blank')}
                      className="bg-transparent"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Update Keys in Vercel
                    </Button>
                  </div>

                  {apiStatuses && apiStatuses.length > 0 && (
                    <div className="space-y-3">
                      {apiStatuses.map((api) => (
                        <div
                          key={api.name}
                          className="flex items-start justify-between p-5 border rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-start gap-4 flex-1">
                            {api.status === "online" ? (
                              <CheckCircle2 className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                            ) : api.status === "error" ? (
                              <XCircle className="h-6 w-6 text-red-600 mt-1 flex-shrink-0" />
                            ) : (
                              <AlertCircle className="h-6 w-6 text-yellow-600 mt-1 flex-shrink-0" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-bold text-slate-900">{api.name} API</p>
                                {api.hasKey ? (
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">
                                    ✓ KEY SAVED
                                  </span>
                                ) : api.status === "online" ? (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-semibold">
                                    NO KEY REQUIRED
                                  </span>
                                ) : (
                                  <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-semibold">
                                    ✗ KEY MISSING
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-700 mb-2">
                                <span className="font-semibold">Purpose:</span> {api.message.split(' - ')[1] || api.message}
                              </p>
                              <p className="text-sm text-slate-600">
                                <span className="font-semibold">Status:</span>{' '}
                                <span className={
                                  api.status === "online" ? "text-green-600" :
                                  api.status === "error" ? "text-red-600" :
                                  "text-yellow-600"
                                }>
                                  {api.message.split(' - ')[0] || api.message}
                                </span>
                              </p>
                              {!api.hasKey && api.status === "error" && (
                                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                                  <strong>Action Required:</strong> Add this API key to your Vercel environment variables
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {(!apiStatuses || apiStatuses.length === 0) && !loading && (
                    <div className="text-center py-8 text-slate-500">
                      <Key className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No API status data available. Click "Refresh Status" to check all APIs.</p>
                    </div>
                  )}

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">How to Update API Keys:</h4>
                    <ol className="text-sm text-blue-800 space-y-1 ml-4">
                      <li>1. Click "Update Keys in Vercel" button above</li>
                      <li>2. Find the environment variable you want to update</li>
                      <li>3. Click "Edit" and paste your new API key</li>
                      <li>4. Save changes and redeploy if necessary</li>
                      <li>5. Return here and click "Refresh Status" to verify</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ccpi-audit">
            <CcpiAuditAdmin />
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit">
            <Card className="bg-white">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-blue-600" />
                      Data Audit & Validation
                    </CardTitle>
                    <CardDescription>
                      Comprehensive QA audit - verifies all data sources, formulas, and calculations
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={fetchAuditResults}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full inline-block" />
                          Running...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4 inline" />
                          Run Full Audit
                        </>
                      )}
                    </Button>
                    {auditResults && (
                      <Button
                        onClick={exportAuditReport}
                        variant="outline"
                        className="hover:bg-slate-100 transition-all duration-200"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export Report
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>

                {auditResults && (
                  <>
                    <div
                      className={`p-6 rounded-lg mb-6 ${
                        auditResults.verdict === "PASS"
                          ? "bg-green-50 border-2 border-green-500"
                          : auditResults.verdict === "CONDITIONAL PASS"
                            ? "bg-yellow-50 border-2 border-yellow-500"
                            : "bg-red-50 border-2 border-red-500"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        {auditResults.verdict === "PASS" ? (
                          <CheckCircle2 className="h-8 w-8 text-green-600" />
                        ) : auditResults.verdict === "CONDITIONAL PASS" ? (
                          <AlertCircle className="h-8 w-8 text-yellow-600" />
                        ) : (
                          <XCircle className="h-8 w-8 text-red-600" />
                        )}
                        <div>
                          <h3 className="text-2xl font-bold">VERDICT: {auditResults.verdict}</h3>
                          <p className="text-slate-600">{auditResults.summary}</p>
                        </div>
                      </div>
                    </div>

                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle>Issues Found: {auditResults.issues.length === 0 ? "NONE" : auditResults.issues.length}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {auditResults.codeQuality.find((c: any) => c.check.includes("Math.random"))?.status === "PASS" ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <span>No fake data detected</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {auditResults.codeQuality.find((c: any) => c.check.includes("random"))?.status === "PASS" ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <span>No random number generators</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {auditResults.codeQuality.find((c: any) => c.check.includes("hardcoded"))?.status === "PASS" ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <span>No hardcoded values pretending to be live data</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {auditResults.calculations.every((c: any) => c.validated.includes("STANDARD")) ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-yellow-600" />
                            )}
                            <span>All formulas match industry standards</span>
                          </div>
                        </div>
                        {auditResults.issues.length > 0 && (
                          <div className="mt-4 p-4 bg-red-50 rounded border border-red-200">
                            <p className="font-semibold text-red-900 mb-2">Critical Issues:</p>
                            <ul className="text-sm text-red-800 space-y-1">
                              {auditResults.issues.map((issue: string, i: number) => (
                                <li key={i}>• {issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle>Data Sources ({auditResults.dataSources.length})</CardTitle>
                        <CardDescription>All verified as real - no fake/random values</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {auditResults.dataSources.map((ds: any, index: number) => (
                            <div key={index} className="p-4 border rounded-lg">
                              <div className="flex items-start gap-3">
                                {ds.status === "VERIFIED" ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <p className="font-semibold">{ds.page}</p>
                                  <p className="text-sm text-slate-600 mt-1">Endpoint: {ds.endpoint}</p>
                                  <p className="text-sm text-slate-600">Primary: {ds.primary}</p>
                                  {ds.fallback && <p className="text-sm text-slate-600">Fallback: {ds.fallback}</p>}
                                  <p className="text-xs text-slate-500 mt-2">{ds.details}</p>
                                  <span
                                    className={`inline-block mt-2 text-xs px-2 py-1 rounded ${ds.realData ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                                  >
                                    {ds.realData ? "ALL REAL DATA" : "DATA ISSUE"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle>Calculations & Formulas ({auditResults.calculations.length})</CardTitle>
                        <CardDescription>All legitimate and validated</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {auditResults.calculations.map((calc: any, index: number) => (
                            <div key={index} className="p-4 border rounded-lg bg-slate-50">
                              <h4 className="font-semibold text-lg mb-2">{calc.name}</h4>
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="font-semibold">Formula:</span>
                                  <code className="block bg-white p-2 rounded mt-1 text-xs">{calc.formula}</code>
                                </div>
                                <div>
                                  <span className="font-semibold">Source:</span> {calc.source}
                                </div>
                                <div>
                                  <span className="font-semibold">Inputs:</span> {calc.inputs}
                                </div>
                                <div>
                                  <span className="font-semibold">Weighting:</span> {calc.weighting}
                                </div>
                                <span
                                  className={`inline-block mt-2 text-xs px-3 py-1 rounded font-semibold ${
                                    calc.validated.includes("STANDARD")
                                      ? "bg-green-100 text-green-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {calc.validated}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle>Environment Variables ({auditResults.environmentVariables.length})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {auditResults.environmentVariables.map((env: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-3 border rounded">
                              <div className="flex-1">
                                <p className="font-mono text-sm">{env.key}</p>
                                <p className="text-xs text-slate-600">{env.purpose}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-xs px-2 py-1 rounded ${env.configured === "YES" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
                                >
                                  {env.configured}
                                </span>
                                <span
                                  className={`text-xs px-2 py-1 rounded ${env.status === "OK" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                                >
                                  {env.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Code Quality Checks ({auditResults.codeQuality.length})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {auditResults.codeQuality.map((check: any, index: number) => (
                            <div key={index} className="flex items-start gap-3 p-3 border rounded">
                              {check.status === "PASS" ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                              )}
                              <div>
                                <p className="font-semibold">{check.check}</p>
                                <p className="text-sm text-slate-600">{check.details}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <p className="text-xs text-slate-500 mt-6">
                      Last audit: {new Date(auditResults.timestamp).toLocaleString()}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Backup Tab */}
          <TabsContent value="backup">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-white">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Github className="h-5 w-5 text-blue-600" />
                    <CardTitle>GitHub Backup</CardTitle>
                  </div>
                  <CardDescription>Your code is version-controlled with Git</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 text-sm">
                    <p className="font-semibold">Automatic Backups:</p>
                    <ul className="space-y-2 ml-4 text-slate-600">
                      <li>• Every code change is automatically committed to GitHub</li>
                      <li>• Full version history is preserved</li>
                      <li>• You can rollback to any previous version</li>
                    </ul>
                  </div>
                  <Button onClick={handleBackup} className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    View Backup Details
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-purple-600" />
                    <CardTitle>Vercel Deployments</CardTitle>
                  </div>
                  <CardDescription>Access deployment history and restore</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 text-sm">
                    <p className="font-semibold">How to Restore:</p>
                    <ol className="space-y-2 ml-4 text-slate-600">
                      <li>1. Go to Vercel Dashboard</li>
                      <li>2. Select your project</li>
                      <li>3. Navigate to 'Deployments' tab</li>
                      <li>4. Find the deployment to restore</li>
                      <li>5. Click 'Promote to Production'</li>
                    </ol>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full bg-transparent"
                    onClick={() => window.open("https://vercel.com/dashboard", "_blank")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Vercel Dashboard
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-green-600" />
                    <CardTitle>Download ZIP</CardTitle>
                  </div>
                  <CardDescription>Download a complete copy of your site</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 text-sm">
                    <p className="font-semibold">What's Included:</p>
                    <ul className="space-y-2 ml-4 text-slate-600">
                      <li>• All source code files</li>
                      <li>• Configuration files</li>
                      <li>• Component library</li>
                      <li>• API routes</li>
                    </ul>
                    <p className="text-xs text-slate-500 italic">
                      Note: Environment variables and database contents are not included in ZIP downloads
                    </p>
                  </div>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      alert(
                        "To download the complete ZIP:\n\n1. Click the three dots (...) in the top right of the v0 interface\n2. Select 'Download ZIP'\n3. Follow the shadcn CLI instructions to install locally",
                      )
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Instructions
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-orange-600" />
                    <CardTitle>Database Backups</CardTitle>
                  </div>
                  <CardDescription>For API keys and user data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 text-sm text-slate-600">
                    <p>Your API keys are stored as Vercel Environment Variables and are automatically backed up.</p>
                    <p className="font-semibold mt-3">To backup/restore:</p>
                    <ul className="space-y-2 ml-4">
                      <li>• Go to Project Settings on Vercel</li>
                      <li>• Navigate to Environment Variables</li>
                      <li>• Copy/paste keys as needed</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Ads & Analytics Tab */}
          <TabsContent value="ads">
            <div className="grid gap-6">
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Image className="h-5 w-5 text-blue-600" />
                    Ad Banner Management
                  </CardTitle>
                  <CardDescription>Manage rotating banner ads on your site</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Button onClick={fetchAdData} variant="outline" size="sm">
                    Load Current Ads
                  </Button>

                  <div className="space-y-3">
                    <Label>Target URL (where ads link to)</Label>
                    <Input value={adUrl} onChange={(e) => setAdUrl(e.target.value)} placeholder="https://example.com" />
                  </div>

                  <div className="space-y-3">
                    <Label>Ad Images ({adImages.length})</Label>
                    <div className="space-y-2">
                      {adImages.map((img, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 border rounded">
                          <span className="text-xs text-slate-600 flex-1 truncate">{img}</span>
                          <Button variant="ghost" size="sm" onClick={() => deleteAdImage(index)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        value={newAdImage}
                        onChange={(e) => setNewAdImage(e.target.value)}
                        placeholder="https://your-image-url.com/banner.png"
                      />
                      <Button onClick={addAdImage} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Button onClick={saveAdData} className="w-full" disabled={loading}>
                    <Save className="mr-2 h-4 w-4" />
                    Save Ad Settings
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                    Google Analytics
                  </CardTitle>
                  <CardDescription>Track visitor activity and engagement</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-4">
                    To integrate Google Analytics, add your GA4 Measurement ID to your environment variables.
                  </p>
                  <div className="space-y-3 text-sm text-slate-600 bg-slate-50 p-4 rounded">
                    <p className="font-semibold">Setup Instructions:</p>
                    <ol className="space-y-2 ml-4">
                      <li>1. Create a Google Analytics 4 property</li>
                      <li>2. Get your Measurement ID (G-XXXXXXXXXX)</li>
                      <li>3. Add it to Vercel environment variables</li>
                      <li>4. Variable name: NEXT_PUBLIC_GA_ID</li>
                    </ol>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-4 bg-transparent"
                    onClick={() => window.open("https://analytics.google.com", "_blank")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Google Analytics
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* API Keys Tab - now in position 2 */}
          <TabsContent value="keys">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-blue-600" />
                  API Keys Management
                </CardTitle>
                <CardDescription>Configure external API connections</CardDescription>
              </CardHeader>
              <CardContent>
                <ApiKeysManager />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trend Analysis Tab */}
          <TabsContent value="trend">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Trend Analysis Algorithms
                </CardTitle>
                <CardDescription>How momentum and trend scores are calculated</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-2">RSI (Relative Strength Index)</h3>
                    <p className="text-sm text-blue-800 mb-2">
                      Formula: <code className="bg-white px-2 py-1 rounded">RSI = 100 - (100 / (1 + RS))</code>
                    </p>
                    <p className="text-xs text-blue-700">
                      Where RS = Average Gain / Average Loss over 14 periods. Measures overbought ({">"} 70) and
                      oversold ({"<"} 30) conditions.
                    </p>
                  </div>

                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h3 className="font-semibold text-green-900 mb-2">MACD (Moving Average Convergence Divergence)</h3>
                    <p className="text-sm text-green-800 mb-2">
                      Formula: <code className="bg-white px-2 py-1 rounded">MACD = EMA(12) - EMA(26)</code>
                    </p>
                    <p className="text-xs text-green-700">
                      Signal Line = EMA(9) of MACD. Histogram = MACD - Signal. Identifies trend changes and momentum
                      shifts.
                    </p>
                  </div>

                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <h3 className="font-semibold text-purple-900 mb-2">Momentum Strength Score</h3>
                    <p className="text-sm text-purple-800 mb-2">
                      Composite scoring from multiple indicators weighted equally
                    </p>
                    <ul className="text-xs text-purple-700 space-y-1 ml-4">
                      <li>• RSI contribution: 33.3%</li>
                      <li>• MACD contribution: 33.3%</li>
                      <li>• Price vs MA contribution: 33.3%</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sentiment Analysis Tab */}
          <TabsContent value="sentiment">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-blue-600" />
                  Sentiment Analysis Algorithms
                </CardTitle>
                <CardDescription>How fear & greed and panic/euphoria scores are calculated</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="font-semibold text-red-900 mb-2">Fear & Greed Index</h3>
                    <p className="text-sm text-red-800 mb-2">
                      Composite of 9 weighted market indicators (0-100 scale)
                    </p>
                    <ul className="text-xs text-red-700 space-y-1 ml-4">
                      <li>• VIX Volatility: 20% weight</li>
                      <li>• Safe Haven Demand: 15% weight</li>
                      <li>• Market Momentum: 15% weight</li>
                      <li>• Stock Price Strength: 10% weight</li>
                      <li>• Market breadth: 10% weight</li>
                      <li>• Put/Call Ratio: 10% weight</li>
                      <li>• Junk Bond Demand: 10% weight</li>
                      <li>• Stock Price Breadth: 5% weight</li>
                      <li>• Market returns: 5% weight</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <h3 className="font-semibold text-orange-900 mb-2">Panic/Euphoria Model</h3>
                    <p className="text-sm text-orange-800 mb-2">
                      Citibank's contrarian sentiment model (range: -1.0 to +1.0)
                    </p>
                    <ul className="text-xs text-orange-700 space-y-1 ml-4">
                      <li>• High/low spreads: Equal weighted</li>
                      <li>• New highs/lows: Equal weighted</li>
                      <li>• Put/call ratios: Equal weighted</li>
                      <li>• VIX term structure: Equal weighted</li>
                      <li>• Credit spreads: Equal weighted</li>
                      <li>• Money flows: Equal weighted</li>
                      <li>• Margin debt: Equal weighted</li>
                      <li>• Short interest: Equal weighted</li>
                      <li>• Volatility risk premium: Equal weighted</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sources">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  CCPI Data Sources - All 23 Indicators
                </CardTitle>
                <CardDescription>
                  Primary, secondary, and tertiary data sources with fallback chains. Green = online, Yellow = using fallback, Red = offline.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={fetchDataSourceStatus} className="mb-4" disabled={loading}>
                  {loading ? "Checking..." : "Check All Data Sources"}
                </Button>

                {dataSourceStatus && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <Card className="bg-green-50 border-green-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg text-green-900">Online</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-3xl font-bold text-green-600">{dataSourceStatus.summary.online}</p>
                          <p className="text-xs text-green-700">of {dataSourceStatus.summary.total} sources</p>
                        </CardContent>
                      </Card>

                      <Card className="bg-yellow-50 border-yellow-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg text-yellow-900">Using Fallback</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-3xl font-bold text-yellow-600">{dataSourceStatus.summary.usingFallback}</p>
                          <p className="text-xs text-yellow-700">sources switched</p>
                        </CardContent>
                      </Card>

                      <Card className="bg-red-50 border-red-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg text-red-900">Offline</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-3xl font-bold text-red-600">{dataSourceStatus.summary.offline}</p>
                          <p className="text-xs text-red-700">sources down</p>
                        </CardContent>
                      </Card>

                      <Card className="bg-blue-50 border-blue-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg text-blue-900">Coverage</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-3xl font-bold text-blue-600">
                            {Math.round((dataSourceStatus.summary.online / dataSourceStatus.summary.total) * 100)}%
                          </p>
                          <p className="text-xs text-blue-700">real data coverage</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-4">
                      {["Valuation", "Technical", "Macro", "Sentiment", "Flows", "Structural"].map((pillar) => {
                        const pillarSources = dataSourceStatus.dataSources.filter((s: any) => s.pillar === pillar)

                        return (
                          <Card key={pillar} className="bg-slate-50">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-lg">
                                {pillar} Pillar ({pillarSources.length} indicators)
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {pillarSources.map((source: any, idx: number) => (
                                  <div key={idx} className="border rounded-lg p-4 bg-white">
                                    <div className="flex items-start justify-between mb-3">
                                      <h4 className="font-semibold text-slate-900">{source.indicator}</h4>
                                      <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                                        source.overallStatus === "online"
                                          ? "bg-green-100 text-green-800"
                                          : "bg-red-100 text-red-800"
                                      }`}>
                                        {source.overallStatus === "online" ? "✓ LIVE" : "✗ OFFLINE"}
                                      </span>
                                    </div>

                                    <div className="space-y-2 text-sm">
                                      {/* Primary Source */}
                                      <div className="flex items-center gap-2">
                                        {source.primary.status === "online" ? (
                                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        ) : (
                                          <XCircle className="h-4 w-4 text-red-600" />
                                        )}
                                        <span className="font-semibold">Primary:</span>
                                        <span className="text-slate-600">{source.primary.name}</span>
                                        <span className="text-xs text-slate-500">({source.primary.message})</span>
                                        {source.activeSource === "primary" && (
                                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">ACTIVE</span>
                                        )}
                                      </div>

                                      {/* Secondary Source */}
                                      {source.secondary && (
                                        <div className="flex items-center gap-2 ml-4">
                                          {source.secondary.status === "online" ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                          ) : source.secondary.status === "error" ? (
                                            <XCircle className="h-4 w-4 text-red-600" />
                                          ) : (
                                            <AlertCircle className="h-4 w-4 text-gray-400" />
                                          )}
                                          <span className="font-semibold">Fallback:</span>
                                          <span className="text-slate-600">{source.secondary.name}</span>
                                          {source.secondary.message && (
                                            <span className="text-xs text-slate-500">({source.secondary.message})</span>
                                          )}
                                          {source.activeSource === "secondary" && (
                                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">ACTIVE</span>
                                          )}
                                        </div>
                                      )}

                                      {/* Tertiary Source */}
                                      {source.tertiary && (
                                        <div className="flex items-center gap-2 ml-8">
                                          {source.tertiary.status === "online" ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                          ) : source.tertiary.status === "error" ? (
                                            <XCircle className="h-4 w-4 text-red-600" />
                                          ) : (
                                            <AlertCircle className="h-4 w-4 text-gray-400" />
                                          )}
                                          <span className="font-semibold">Backup:</span>
                                          <span className="text-slate-600">{source.tertiary.name}</span>
                                          {source.tertiary.message && (
                                            <span className="text-xs text-slate-500">({source.tertiary.message})</span>
                                          )}
                                          {source.activeSource === "tertiary" && (
                                            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">ACTIVE</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
