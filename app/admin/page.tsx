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
  DollarSign,
  HeartPulse,
  MinusCircle,
  PowerOff,
} from "lucide-react"
import { ApiKeysManager } from "@/components/api-keys-manager"
import { MembersManager } from "@/components/members-manager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import { CcpiAuditAdmin } from "@/components/ccpi-audit-admin"
import { ApiDataSourceStatus } from "@/components/api-data-source-status"
import { AIStatusAdmin } from "@/components/ai-status-admin"
import { CostsUsageAdmin } from "@/components/costs-usage-admin"
import { HealthCheckPanel } from "@/components/admin/health-check-panel"

/**
 * Shape emitted by GET /api/admin/api-status. Every field is the route's own
 * diagnosis — this component derives nothing about health on its own, it only
 * renders what the route measured (or states that it did not measure).
 */
interface ApiStatus {
  id: string
  name: string
  /** Raw env var was present (says nothing about whether it is usable). */
  rawPresent: boolean
  /** Kill-switched via DISABLED_APIS — never probed, never "online". */
  disabled: boolean
  /** Which env var / alias actually resolved, or null if none did. */
  resolvedVia: string | null
  /** False means no network request was made: status is a claim, not a measurement. */
  probed: boolean
  httpStatus: number | null
  status: "ok" | "error" | "disabled" | "unknown"
  /** The route's plain-language reason. Always rendered. */
  message: string
  endpoint?: string
  usedIn?: string[]
}

type Chip = { label: string; className: string; Icon: typeof CheckCircle2 }

/**
 * One derived chip per provider — the single source of truth for the row's
 * colour. Order matters: a kill-switched provider can never read as healthy,
 * and an unprobed provider can never read as "online".
 */
function deriveChip(api: ApiStatus): Chip {
  if (api.disabled || api.status === "disabled") {
    return {
      label: "DISABLED (kill switch)",
      className: "bg-slate-200 text-slate-700 border-slate-300",
      Icon: PowerOff,
    }
  }
  if (api.status === "ok") {
    return {
      label: api.httpStatus ? `OK (HTTP ${api.httpStatus})` : "OK",
      className: "bg-green-100 text-green-800 border-green-300",
      Icon: CheckCircle2,
    }
  }
  if (api.status === "error") {
    return {
      label: api.httpStatus ? `ERROR (HTTP ${api.httpStatus})` : "ERROR",
      className: "bg-red-100 text-red-800 border-red-300",
      Icon: XCircle,
    }
  }
  if (!api.probed) {
    return {
      label: "NOT PROBED",
      className: "bg-slate-100 text-slate-700 border-slate-300",
      Icon: MinusCircle,
    }
  }
  return {
    label: "UNKNOWN",
    className: "bg-amber-100 text-amber-900 border-amber-300",
    Icon: AlertCircle,
  }
}

/** Key provenance is descriptive text, never a status badge. */
function keyLine(api: ApiStatus): string {
  if (api.disabled) {
    return api.rawPresent
      ? "Key present in the environment, but the provider is kill-switched — the key is not used."
      : "No key configured; the provider is kill-switched regardless."
  }
  if (api.resolvedVia) return `Key resolved via ${api.resolvedVia}`
  if (api.rawPresent) return "Key present in the environment but did not resolve (alias or kill-switch)"
  return "No key configured"
}

export default function AdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [apiStatuses, setApiStatuses] = useState<ApiStatus[]>([])
  const [apiStatusError, setApiStatusError] = useState<string | null>(null)
  const [apiStatusLoaded, setApiStatusLoaded] = useState(false)
  const [adImages, setAdImages] = useState<string[]>([])
  const [adUrl, setAdUrl] = useState("")
  const [newAdImage, setNewAdImage] = useState("")
  const [activeTab, setActiveTab] = useState("health")

  useEffect(() => {
    // Don't auto-fetch on mount, let user click tabs
  }, [])

  useEffect(() => {
    if (activeTab === "status" && !apiStatusLoaded) {
      fetchApiStatus()
    }
  }, [activeTab, apiStatusLoaded])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  const fetchApiStatus = async () => {
    setLoading(true)
    setApiStatusError(null)
    try {
      const response = await fetch("/api/admin/api-status")
      if (!response.ok) {
        throw new Error(`/api/admin/api-status returned HTTP ${response.status}`)
      }
      const data = await response.json()
      setApiStatuses(Array.isArray(data?.apis) ? data.apis : [])
      setApiStatusLoaded(true)
    } catch (error) {
      console.error("Failed to fetch API status:", error)
      setApiStatuses([])
      setApiStatusLoaded(true)
      setApiStatusError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setLoading(false)
    }
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
    <div className="min-h-screen bg-gray-50">
      {/* Same header strip as the main site: white, compact, max-w-5xl. */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between py-2 gap-4">
              <div className="flex items-center gap-2">
                <Image src="/logo.png" alt="Options Calculators Logo" width={32} height={32} className="h-8 w-8 rounded-md" />
                <a href="/" className="text-xl md:text-2xl font-bold text-gray-900 hover:text-primary transition-colors">
                  OPTIONS-CALCULATORS.COM
                </a>
                <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  Admin
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => router.push("/")}
                  variant="outline"
                  className="border-gray-200 text-gray-700 hover:bg-gray-100 bg-transparent"
                  size="sm"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Site
                </Button>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="border-gray-200 text-gray-700 hover:bg-gray-100 bg-transparent"
                  size="sm"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Complete System Monitoring & Audit</p>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="health" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-1 bg-gray-100 border border-gray-200 p-1 h-auto mb-6">
            <TabsTrigger
              value="health"
              className="text-gray-600 data-[state=active]:bg-emerald-700 data-[state=active]:text-white text-xs md:text-sm"
            >
              <HeartPulse className="h-4 w-4 mr-1 md:mr-2" />
              Health
            </TabsTrigger>
            <TabsTrigger
              value="costs"
              className="text-gray-600 data-[state=active]:bg-emerald-700 data-[state=active]:text-white text-xs md:text-sm"
            >
              <DollarSign className="h-4 w-4 mr-1 md:mr-2" />
              Costs
            </TabsTrigger>
            <TabsTrigger
              value="status"
              className="text-gray-600 data-[state=active]:bg-emerald-700 data-[state=active]:text-white text-xs md:text-sm"
            >
              <Activity className="h-4 w-4 mr-1 md:mr-2" />
              APIs
            </TabsTrigger>
            <TabsTrigger
              value="ai-status"
              className="text-gray-600 data-[state=active]:bg-emerald-700 data-[state=active]:text-white text-xs md:text-sm"
            >
              <Zap className="h-4 w-4 mr-1 md:mr-2" />
              AI
            </TabsTrigger>
            <TabsTrigger
              value="sources"
              className="text-gray-600 data-[state=active]:bg-emerald-700 data-[state=active]:text-white text-xs md:text-sm"
            >
              <Database className="h-4 w-4 mr-1 md:mr-2" />
              Data
            </TabsTrigger>
            <TabsTrigger
              value="keys"
              className="text-gray-600 data-[state=active]:bg-emerald-700 data-[state=active]:text-white text-xs md:text-sm"
            >
              <Key className="h-4 w-4 mr-1 md:mr-2" />
              Keys
            </TabsTrigger>
            <TabsTrigger
              value="ccpi-audit"
              className="text-gray-600 data-[state=active]:bg-emerald-700 data-[state=active]:text-white text-xs md:text-sm"
            >
              <BarChart3 className="h-4 w-4 mr-1 md:mr-2" />
              CCPI
            </TabsTrigger>
            <TabsTrigger
              value="backup"
              className="text-gray-600 data-[state=active]:bg-emerald-700 data-[state=active]:text-white text-xs md:text-sm"
            >
              <Github className="h-4 w-4 mr-1 md:mr-2" />
              Backup
            </TabsTrigger>
            <TabsTrigger
              value="ads"
              className="text-gray-600 data-[state=active]:bg-emerald-700 data-[state=active]:text-white text-xs md:text-sm"
            >
              <ImageIcon className="h-4 w-4 mr-1 md:mr-2" />
              Ads
            </TabsTrigger>
          </TabsList>

          <TabsContent value="health">
            <HealthCheckPanel />
          </TabsContent>

          <TabsContent value="costs">
            <CostsUsageAdmin />
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
                    <CardDescription>
                      One derived status per provider, straight from the route&apos;s own diagnosis. A key being
                      present is not a health signal and is never shown as one.
                    </CardDescription>
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
                {apiStatusError ? (
                  <div className="border border-red-300 bg-red-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <p className="font-semibold text-red-900">Could not load API status</p>
                    </div>
                    <p className="text-sm text-red-800 font-mono">{apiStatusError}</p>
                    <p className="text-sm text-red-800 mt-2">
                      Nothing below is measured — this panel is reporting its own failure, not a healthy stack.
                    </p>
                    <Button onClick={fetchApiStatus} disabled={loading} size="sm" className="mt-3">
                      Retry
                    </Button>
                  </div>
                ) : !apiStatusLoaded ? (
                  <p className="text-sm text-slate-600 py-6 text-center">
                    {loading ? "Probing providers…" : "Click “Refresh Status” to probe the providers."}
                  </p>
                ) : apiStatuses.length === 0 ? (
                  <div className="border border-amber-300 bg-amber-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="h-5 w-5 text-amber-700" />
                      <p className="font-semibold text-amber-900">No providers returned</p>
                    </div>
                    <p className="text-sm text-amber-900">
                      The route responded successfully but listed zero providers. That is a fault in
                      /api/admin/api-status, not an all-clear.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {apiStatuses.map((api) => {
                      const chip = deriveChip(api)
                      return (
                        <div
                          key={api.id || api.name}
                          className="flex items-start gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p className="font-bold text-gray-900">{api.name}</p>
                              <span
                                className={`text-xs px-2 py-1 rounded font-semibold border inline-flex items-center gap-1 ${chip.className}`}
                              >
                                <chip.Icon className="h-3.5 w-3.5" />
                                {chip.label}
                              </span>
                              {!api.probed && !api.disabled && (
                                <span className="text-xs text-gray-500">no network request was made</span>
                              )}
                            </div>
                            <p className="text-sm text-slate-800">{api.message || "No diagnosis reported."}</p>
                            <p className="text-xs text-slate-600 mt-1">{keyLine(api)}</p>
                            {api.endpoint && (
                              <p className="text-xs text-slate-600 mt-2 font-mono bg-slate-100 px-2 py-1 rounded break-all">
                                {api.endpoint}
                              </p>
                            )}
                            {api.usedIn && api.usedIn.length > 0 && (
                              <p className="text-sm text-slate-600 mt-1">
                                <span className="font-semibold">Used in:</span> {api.usedIn.join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="keys" className="space-y-6">
            <MembersManager />
            <ApiKeysManager />
          </TabsContent>

          <TabsContent value="ccpi-audit">
            <CcpiAuditAdmin />
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
                    <p className="font-semibold">How backups actually work here:</p>
                    <ul className="space-y-2 ml-4 text-slate-600">
                      <li>• Commits are manual — nothing is auto-committed on your behalf</li>
                      <li>• Work lands on the staging branch first, then merges to main after UAT</li>
                      <li>• Every commit that is pushed is preserved in GitHub history</li>
                      <li>• Rollback is done from the Vercel deployments list, not from this page</li>
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
    </div>
  )
}
