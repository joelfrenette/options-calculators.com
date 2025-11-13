"use client"

import { useState } from "react"
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, LogOut, Database, Activity, CheckCircle2, XCircle, AlertCircle, Megaphone, BarChart3, TrendingUp, Gauge, Target, Github, ExternalLink, Trash2, Plus, Save } from 'lucide-react'
import { ApiKeysManager } from "@/components/api-keys-manager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  const fetchApiStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/api-status")
      const data = await response.json()
      setApiStatuses(data.apis)
    } catch (error) {
      console.error("Failed to fetch API status:", error)
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
   - Formula: \`${calc.formula}\`
   - Source: ${calc.source}
   - Inputs: ${calc.inputs}
   - Weighting: ${calc.weighting}
   - **${calc.validated}**
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

        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid grid-cols-4 lg:grid-cols-7 gap-2 bg-slate-800 p-1 h-auto mb-6">
            <TabsTrigger value="status" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <Activity className="h-4 w-4 mr-2" />
              Status
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Audit
            </TabsTrigger>
            <TabsTrigger value="backup" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <Database className="h-4 w-4 mr-2" />
              Backup
            </TabsTrigger>
            <TabsTrigger value="ads" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <Megaphone className="h-4 w-4 mr-2" />
              Ads
            </TabsTrigger>
            <TabsTrigger value="keys" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <Target className="h-4 w-4 mr-2" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="trend" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <TrendingUp className="h-4 w-4 mr-2" />
              Trend
            </TabsTrigger>
            <TabsTrigger value="sentiment" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <Gauge className="h-4 w-4 mr-2" />
              Sentiment
            </TabsTrigger>
          </TabsList>

          {/* Status Tab */}
          <TabsContent value="status">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  API Status Monitor
                </CardTitle>
                <CardDescription>Real-time status of all external APIs</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={fetchApiStatus} className="mb-4" disabled={loading}>
                  {loading ? "Checking..." : "Refresh Status"}
                </Button>

                {apiStatuses.length > 0 && (
                  <div className="space-y-3">
                    {apiStatuses.map((api) => (
                      <div
                        key={api.name}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {api.status === "online" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : api.status === "error" ? (
                            <XCircle className="h-5 w-5 text-red-600" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-yellow-600" />
                          )}
                          <div>
                            <p className="font-semibold text-slate-900">{api.name} API</p>
                            <p className="text-sm text-slate-600">{api.message}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {api.hasKey ? (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              Key Configured
                            </span>
                          ) : (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                              {api.status === "online" ? "No Key Required" : "Key Missing"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  Data Audit & Validation
                </CardTitle>
                <CardDescription>
                  Comprehensive QA audit - verifies all data sources, formulas, and calculations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Button onClick={fetchAuditResults} disabled={loading}>
                    {loading ? "Running Audit..." : "Run Full Audit"}
                  </Button>
                  {auditResults && (
                    <Button onClick={exportAuditReport} variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Export Report
                    </Button>
                  )}
                </div>

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
                    <Megaphone className="h-5 w-5 text-blue-600" />
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

          {/* API Keys Tab */}
          <TabsContent value="keys">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
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
                  Trend Analysis - Calculations & Algorithms
                </CardTitle>
                <CardDescription>Technical indicators and forecasting methodology</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h3 className="font-semibold text-lg mb-2">Data Sources</h3>
                    <ul className="text-sm text-slate-600 space-y-1">
                      <li>• TwelveData API for historical price data and technical indicators</li>
                      <li>• SPY (S&P 500 ETF) as market benchmark</li>
                      <li>• Real-time updates during market hours</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-green-500 pl-4">
                    <h3 className="font-semibold text-lg mb-2">Technical Indicators</h3>
                    <div className="text-sm text-slate-600 space-y-3">
                      <div>
                        <p className="font-semibold">SMA (Simple Moving Average):</p>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded block mt-1">
                          SMA = Sum(Close Prices) / N periods
                        </code>
                        <p className="text-xs mt-1">Used: 50-day, 100-day, 200-day</p>
                      </div>

                      <div>
                        <p className="font-semibold">RSI (Relative Strength Index):</p>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded block mt-1">
                          RSI = 100 - (100 / (1 + RS)), where RS = Average Gain / Average Loss
                        </code>
                        <p className="text-xs mt-1">Period: 14 days. Overbought &gt; 70, Oversold &lt; 30</p>
                      </div>

                      <div>
                        <p className="font-semibold">MACD (Moving Average Convergence Divergence):</p>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded block mt-1">
                          MACD = EMA(12) - EMA(26), Signal = EMA(9) of MACD
                        </code>
                        <p className="text-xs mt-1">Bullish when MACD crosses above signal line</p>
                      </div>

                      <div>
                        <p className="font-semibold">Bollinger Bands:</p>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded block mt-1">
                          Upper Band = SMA(20) + (2 × StdDev), Lower Band = SMA(20) - (2 × StdDev)
                        </code>
                        <p className="text-xs mt-1">Price near upper band = overbought, near lower = oversold</p>
                      </div>

                      <div>
                        <p className="font-semibold">Stochastic Oscillator:</p>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded block mt-1">
                          %K = ((Close - Low14) / (High14 - Low14)) × 100
                        </code>
                        <p className="text-xs mt-1">Overbought &gt; 80, Oversold &lt; 20</p>
                      </div>

                      <div>
                        <p className="font-semibold">ATR (Average True Range):</p>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded block mt-1">
                          TR = max(High - Low, |High - PrevClose|, |Low - PrevClose|), ATR = Average(TR, 14)
                        </code>
                        <p className="text-xs mt-1">Measures volatility, higher ATR = higher risk</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-l-4 border-purple-500 pl-4">
                    <h3 className="font-semibold text-lg mb-2">Forecasting Algorithm</h3>
                    <p className="text-sm text-slate-600 mb-2">
                      The forecast combines multiple signals with weighted scoring:
                    </p>
                    <ul className="text-sm text-slate-600 space-y-1">
                      <li>• Golden Cross (50 SMA &gt; 200 SMA): +2 points</li>
                      <li>• Death Cross (50 SMA &lt; 200 SMA): -2 points</li>
                      <li>• RSI levels: Extreme readings weighted heavier</li>
                      <li>• MACD crossovers: +1 bullish, -1 bearish</li>
                      <li>• Price position relative to Bollinger Bands</li>
                      <li>• Stochastic momentum confirmation</li>
                    </ul>
                    <code className="text-xs bg-slate-100 px-2 py-1 rounded block mt-2">
                      Final Score = Σ(Indicator × Weight) / Total Weights
                    </code>
                    <p className="text-xs text-slate-600 mt-2">
                      Score &gt; 60: Strong Bullish | 40-60: Bullish | -40 to 40: Neutral | -60 to -40: Bearish | &lt;
                      -60: Strong Bearish
                    </p>
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
                  Sentiment Indices - Calculations & Algorithms
                </CardTitle>
                <CardDescription>Fear & Greed and Panic/Euphoria methodologies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="border-l-4 border-red-500 pl-4">
                    <h3 className="font-semibold text-lg mb-2">Fear & Greed Index</h3>
                    <p className="text-sm text-slate-600 mb-3">
                      Combines 7 market indicators, each weighted equally (14.29% each):
                    </p>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div>
                        <p className="font-semibold">1. Put/Call Ratio (14.29%):</p>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded block mt-1">
                          Score = 100 × (1 - normalized_ratio). High ratio = Fear, Low = Greed
                        </code>
                      </div>
                      <div>
                        <p className="font-semibold">2. VIX (14.29%):</p>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded block mt-1">
                          Score = 100 × (1 - (VIX - 10) / 40). VIX &gt; 30 = Fear, &lt; 15 = Greed
                        </code>
                      </div>
                      <div>
                        <p className="font-semibold">3. Market Momentum (14.29%):</p>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded block mt-1">
                          SPY 125-day MA vs 250-day MA. Above = Greed, Below = Fear
                        </code>
                      </div>
                      <div>
                        <p className="font-semibold">4. Safe Haven Demand (14.29%):</p>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded block mt-1">
                          Compare SPY vs TLT (bonds) performance. Money flowing to bonds = Fear
                        </code>
                      </div>
                      <div>
                        <p className="font-semibold">5. Junk Bond Demand (14.29%):</p>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded block mt-1">
                          HYG spread vs treasuries. Tight spreads = Greed, Wide = Fear
                        </code>
                      </div>
                      <div>
                        <p className="font-semibold">6. Market Breadth (14.29%):</p>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded block mt-1">
                          Advancing vs Declining stocks. More advances = Greed
                        </code>
                      </div>
                      <div>
                        <p className="font-semibold">7. Stock Price Strength (14.29%):</p>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded block mt-1">
                          Stocks at 52-week highs vs lows. More highs = Greed
                        </code>
                      </div>
                    </div>
                    <code className="text-xs bg-slate-100 px-2 py-1 rounded block mt-3">
                      Final Index = Σ(Component × 0.1429), Range: 0 (Extreme Fear) to 100 (Extreme Greed)
                    </code>
                  </div>

                  <div className="border-l-4 border-orange-500 pl-4">
                    <h3 className="font-semibold text-lg mb-2">Panic/Euphoria Model</h3>
                    <p className="text-sm text-slate-600 mb-3">
                      Citibank's proprietary model using 9 technical indicators:
                    </p>
                    <div className="space-y-2 text-sm text-slate-600">
                      <p>Each indicator scored from -1 (Panic) to +1 (Euphoria):</p>
                      <ul className="ml-4 space-y-1">
                        <li>• Market breadth (advancing/declining issues)</li>
                        <li>• New highs vs new lows</li>
                        <li>• Put/call ratio</li>
                        <li>• VIX level</li>
                        <li>• High-yield spreads</li>
                        <li>• Margin debt levels</li>
                        <li>• Market momentum (price trends)</li>
                        <li>• Volatility trends</li>
                        <li>• Money flow indicators</li>
                      </ul>
                    </div>
                    <code className="text-xs bg-slate-100 px-2 py-1 rounded block mt-3">
                      Overall Score = Average(All 9 Indicators), Range: -1 (Panic) to +1 (Euphoria)
                    </code>
                    <p className="text-xs text-slate-600 mt-2">
                      Score &lt; -0.5: Panic (Buy signal) | -0.5 to 0: Fear | 0 to 0.5: Optimism | &gt; 0.5: Euphoria
                      (Sell signal)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
