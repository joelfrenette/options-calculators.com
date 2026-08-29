"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Download,
  LogOut,
  Database,
  BarChart3,
  Github,
  ExternalLink,
  Zap,
  Key,
  DollarSign,
  HeartPulse,
  Users,
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

export default function AdminDashboard() {
  const router = useRouter()

  // The standalone "APIs" tab (vendor-endpoint reachability probe) was folded
  // away 2026-08-29 (admin audit): the Health tab already probes every /api
  // route, which exercises the same vendors, so the separate vendor probe was
  // the weakest, most-redundant surface. Its state + fetch + render are gone —
  // and with them the `loading` and `activeTab` state, whose only readers lived
  // in that tab (the Tabs component tracks its own active tab via defaultValue).

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  const handleBackup = async () => {
    try {
      const response = await fetch("/api/admin/backup")
      if (!response.ok) throw new Error("Backup check failed")
      const data = await response.json()
      alert(`Backup Information:\n\n${data.instructions.join("\n\n")}`)
    } catch (error) {
      alert("Unable to check backup status")
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
        <Tabs defaultValue="health" className="w-full">
          <TabsList className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-8 gap-1 bg-gray-100 border border-gray-200 p-1 h-auto mb-6">
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
              value="users"
              className="text-gray-600 data-[state=active]:bg-emerald-700 data-[state=active]:text-white text-xs md:text-sm"
            >
              <Users className="h-4 w-4 mr-1 md:mr-2" />
              Users
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

          <TabsContent value="keys">
            <ApiKeysManager />
          </TabsContent>

          <TabsContent value="users">
            <MembersManager />
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
        </Tabs>
        </div>
      </div>
    </div>
  )
}
