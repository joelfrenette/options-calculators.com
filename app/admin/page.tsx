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
  Shield,
} from "lucide-react"
import { ApiKeysManager } from "@/components/api-keys-manager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CcpiAuditAdmin } from "@/components/ccpi-audit-admin"
import { ApiDataSourceStatus } from "@/components/api-data-source-status"
import { AIStatusAdmin } from "@/components/ai-status-admin"
import { RemainingSiteAudit } from "@/components/remaining-site-audit"
import { FullSystemAudit } from "@/components/admin/full-system-audit"

interface ApiStatus {
  name: string
  status: "online" | "error" | "unknown" | "warning"
  message: string
  hasKey: boolean
  endpoint?: string
  usedIn?: string[]
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
  const [activeTab, setActiveTab] = useState("full-audit")

  useEffect(() => {
    // Don't auto-fetch on mount, let user click tabs
  }, [])

  useEffect(() => {
    if (activeTab === "status" && apiStatuses.length === 0) {
      fetchApiStatus()
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
**END OF AUDIT REPORT**
`

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
      if (!response.ok) throw new Error("Backup check failed")
      const data = await response.json()
      alert(`Backup Information:\n\n${data.instructions.join("\n\n")}`)
    } catch (error) {
      alert("Unable to check backup status")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-400 mt-1">Complete System Monitoring & Audit</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800"
              size="sm"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Site
            </Button>
            <Button onClick={handleLogout} className="bg-white text-slate-900 hover:bg-slate-100" size="sm">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="full-audit" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-1 bg-slate-800 p-1 h-auto mb-6">
            <TabsTrigger
              value="full-audit"
              className="text-slate-200 data-[state=active]:bg-green-600 data-[state=active]:text-white text-xs md:text-sm"
            >
              <Shield className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">Full</span> Audit
            </TabsTrigger>
            <TabsTrigger
              value="status"
              className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 text-xs md:text-sm"
            >
              <Activity className="h-4 w-4 mr-1 md:mr-2" />
              APIs
            </TabsTrigger>
            <TabsTrigger
              value="ai-status"
              className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 text-xs md:text-sm"
            >
              <Zap className="h-4 w-4 mr-1 md:mr-2" />
              AI
            </TabsTrigger>
            <TabsTrigger
              value="sources"
              className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 text-xs md:text-sm"
            >
              <Database className="h-4 w-4 mr-1 md:mr-2" />
              Data
            </TabsTrigger>
            <TabsTrigger
              value="keys"
              className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 text-xs md:text-sm"
            >
              <Key className="h-4 w-4 mr-1 md:mr-2" />
              Keys
            </TabsTrigger>
            <TabsTrigger
              value="ccpi-audit"
              className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 text-xs md:text-sm"
            >
              <BarChart3 className="h-4 w-4 mr-1 md:mr-2" />
              CCPI
            </TabsTrigger>
            <TabsTrigger
              value="audit"
              className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 text-xs md:text-sm"
            >
              <CheckCircle2 className="h-4 w-4 mr-1 md:mr-2" />
              Site
            </TabsTrigger>
            <TabsTrigger
              value="backup"
              className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 text-xs md:text-sm"
            >
              <Github className="h-4 w-4 mr-1 md:mr-2" />
              Backup
            </TabsTrigger>
            <TabsTrigger
              value="ads"
              className="text-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 text-xs md:text-sm"
            >
              <ImageIcon className="h-4 w-4 mr-1 md:mr-2" />
              Ads
            </TabsTrigger>
          </TabsList>

          <TabsContent value="full-audit">
            <FullSystemAudit />
          </TabsContent>

          <TabsContent value="ai-status">
            <AIStatusAdmin />
          </TabsContent>

          <TabsContent value="sources">
            <ApiDataSourceStatus />
          </TabsContent>

          <TabsContent value="status">
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
                      Update Keys
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
                        className="flex items-start gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors"
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
                              {api.endpoint}
                            </p>
                          )}
                          {api.usedIn && api.usedIn.length > 0 && (
                            <p className="text-sm text-slate-600">
                              <span className="font-semibold">Used in:</span> {api.usedIn.join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {api.status === "online" ? (
                            <div className="relative">
                              <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse" />
                              <div className="absolute inset-0 w-4 h-4 bg-green-400 rounded-full blur-sm" />
                            </div>
                          ) : api.status === "warning" ? (
                            <div className="relative">
                              <div className="w-4 h-4 bg-yellow-500 rounded-full animate-pulse" />
                            </div>
                          ) : (
                            <div className="relative">
                              <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                            </div>
                          )}
                          {api.status === "online" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : api.status === "error" ? (
                            <XCircle className="h-5 w-5 text-red-600" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-yellow-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="keys">
            <ApiKeysManager />
          </TabsContent>

          <TabsContent value="ccpi-audit">
            <CcpiAuditAdmin />
          </TabsContent>

          <TabsContent value="audit">
            <RemainingSiteAudit />
          </TabsContent>

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
                    <p className="font-semibold">Deployment Features:</p>
                    <ul className="space-y-2 ml-4 text-slate-600">
                      <li>• Instant rollback to any previous deployment</li>
                      <li>• Preview deployments for every branch</li>
                      <li>• Automatic SSL and CDN</li>
                    </ul>
                  </div>
                  <Button
                    onClick={() =>
                      window.open("https://vercel.com/joelfrenettes/options-calculators-com/deployments", "_blank")
                    }
                    variant="outline"
                    className="w-full"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Deployments
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ads">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-orange-600" />
                  Rotating Ad Banner Management
                </CardTitle>
                <CardDescription>Manage the rotating banner ads shown on the site</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label>Target URL (where ads link to)</Label>
                    <Input
                      value={adUrl}
                      onChange={(e) => setAdUrl(e.target.value)}
                      placeholder="https://example.com/promo"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Ad Images</Label>
                    <div className="space-y-2 mt-2">
                      {adImages.map((img, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 border rounded">
                          <span className="flex-1 text-sm truncate">{img}</span>
                          <Button variant="ghost" size="sm" onClick={() => deleteAdImage(index)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Input
                        value={newAdImage}
                        onChange={(e) => setNewAdImage(e.target.value)}
                        placeholder="Image URL"
                      />
                      <Button onClick={addAdImage}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Button onClick={saveAdData} disabled={loading} className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  Save Ad Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
