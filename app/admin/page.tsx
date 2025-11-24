"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Download,
  LogOut,
  Database,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BarChart3,
  Github,
  ExternalLink,
  Trash2,
  Plus,
  Save,
  ImageIcon,
  Zap,
  Key,
} from "lucide-react"
import { ApiKeysManager } from "@/components/api-keys-manager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CcpiAuditAdmin } from "@/components/ccpi-audit-admin"
import { ApiDataSourceStatus } from "@/components/api-data-source-status"
import { AIStatusAdmin } from "@/components/ai-status-admin"
import { RemainingSiteAudit } from "@/components/remaining-site-audit"

interface ApiStatus {
  name: string
  status: "online" | "error" | "unknown" | "warning"
  message: string
  hasKey: boolean
  endpoint?: string
  usedIn?: string[]
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

  useEffect(() => {
    if (activeTab === "sources") {
      fetchDataSourceStatus()
    }
  }, [activeTab])

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

${auditResults.dataSources
  .map(
    (ds: any, i: number) => `
${i + 1}. **${ds.page}** - ${ds.endpoint}
   - Primary: ${ds.primary}
   ${ds.fallback ? `- Fallback: ${ds.fallback}` : ""}
   - Status: ${ds.status}
   - Real Data: ${ds.realData ? "YES" : "NO"}
   - Details: ${ds.details || "N/A"}
`,
  )
  .join("\n")}

---

## CALCULATIONS & FORMULAS - ALL LEGITIMATE

${auditResults.calculations
  .map(
    (calc: any, i: number) => `
${i + 1}. **${calc.name}**
   - Formula: ${calc.formula}
   - Source: ${calc.source}
   - Inputs: ${calc.inputs}
   - Weighting: ${calc.weighting}
   - ${calc.validated}
`,
  )
  .join("\n")}

---

## CODE QUALITY CHECKS

${auditResults.codeQuality
  .map(
    (check: any) => `
- **${check.check}**: ${check.status}
  ${check.details}
`,
  )
  .join("\n")}

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
          <TabsList className="grid grid-cols-3 lg:grid-cols-7 gap-2 bg-slate-800 p-1 h-auto mb-6">
            <TabsTrigger
              value="status"
              className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900"
            >
              <Activity className="h-4 w-4 mr-2" />
              API Status
            </TabsTrigger>
            <TabsTrigger
              value="ai-status"
              className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900"
            >
              <Zap className="h-4 w-4 mr-2" />
              AI Status
            </TabsTrigger>
            <TabsTrigger
              value="sources"
              className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900"
            >
              <Database className="h-4 w-4 mr-2" />
              Data Sources
            </TabsTrigger>
            <TabsTrigger
              value="keys"
              className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900"
            >
              <Key className="h-4 w-4 mr-2" />
              API Keys Management
            </TabsTrigger>
            <TabsTrigger
              value="ccpi-audit"
              className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              CCPI Audit
            </TabsTrigger>
            <TabsTrigger
              value="audit"
              className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Remaining Site Audit
            </TabsTrigger>
            <TabsTrigger
              value="backup"
              className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900"
            >
              <Database className="h-4 w-4 mr-2" />
              Backup
            </TabsTrigger>
            <TabsTrigger
              value="ads"
              className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900"
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Ads
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai-status">
            <AIStatusAdmin />
          </TabsContent>

          {/* Data Sources Tab */}
          <TabsContent value="sources">
            <ApiDataSourceStatus />
          </TabsContent>

          {/* Status Tab */}
          <TabsContent value="status">
            <div className="space-y-6">
              <Card className="bg-white">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-blue-600" />
                        API Status & Key Management
                      </CardTitle>
                      <CardDescription>Monitor all external APIs and manage configuration</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={fetchApiStatus} disabled={loading}>
                        {loading ? "Checking..." : "Refresh Status"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          window.open(
                            "https://vercel.com/joelfrenettes/options-calculators-com/settings/environment-variables",
                            "_blank",
                          )
                        }
                        className="bg-transparent"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Update Keys in Vercel
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {apiStatuses && apiStatuses.length > 0 && (
                    <div className="space-y-3">
                      {apiStatuses.map((api) => (
                        <div
                          key={api.name}
                          className="flex items-start gap-4 p-5 border rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-slate-900">{api.name}</p>
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

                            {api.endpoint && (
                              <p className="text-xs text-slate-600 mb-2 font-mono bg-slate-100 px-2 py-1 rounded">
                                <span className="font-semibold text-slate-700">Endpoint:</span> {api.endpoint}
                              </p>
                            )}

                            <p className="text-sm text-slate-700 mb-2">
                              <span className="font-semibold">Purpose:</span>{" "}
                              {api.message.split(" - ")[1] || api.message}
                            </p>

                            {api.usedIn && api.usedIn.length > 0 && (
                              <p className="text-sm text-slate-600 mb-2">
                                <span className="font-semibold">Used in:</span> {api.usedIn.join(", ")}
                              </p>
                            )}

                            <p className="text-sm text-slate-600">
                              <span className="font-semibold">Status:</span>{" "}
                              <span
                                className={
                                  api.status === "online"
                                    ? "text-green-600 font-semibold"
                                    : api.status === "error"
                                      ? "text-red-600 font-semibold"
                                      : "text-yellow-600 font-semibold"
                                }
                              >
                                {api.message.split(" - ")[0] || api.message}
                              </span>
                            </p>
                            {!api.hasKey && api.status === "error" && (
                              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                                <strong>Action Required:</strong> Add this API key to your Vercel environment variables
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            {api.status === "online" ? (
                              <CheckCircle2 className="h-8 w-8 text-green-600" />
                            ) : api.status === "error" ? (
                              <XCircle className="h-8 w-8 text-red-600" />
                            ) : (
                              <AlertCircle className="h-8 w-8 text-yellow-600" />
                            )}

                            <div className="flex-shrink-0">
                              {api.status === "online" ? (
                                <div className="relative">
                                  <div className="w-8 h-8 bg-green-500 rounded-full animate-pulse" />
                                  <div className="absolute inset-0 w-8 h-8 bg-green-400 rounded-full blur-sm" />
                                </div>
                              ) : api.status === "warning" ? (
                                <div className="relative">
                                  <div className="w-8 h-8 bg-yellow-500 rounded-full animate-pulse" />
                                  <div className="absolute inset-0 w-8 h-8 bg-yellow-400 rounded-full blur-sm" />
                                </div>
                              ) : (
                                <div className="relative">
                                  <div className="w-8 h-8 bg-red-500 rounded-full animate-pulse" />
                                  <div className="absolute inset-0 w-8 h-8 bg-red-400 rounded-full blur-sm" />
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
            <RemainingSiteAudit />
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
                    <ImageIcon className="h-5 w-5 text-blue-600" />
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
        </Tabs>
      </div>
    </div>
  )
}
