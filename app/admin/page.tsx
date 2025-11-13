"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Upload, LogOut, Database } from "lucide-react"
import { ApiKeysManager } from "@/components/api-keys-manager"

export default function AdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [backupStatus, setBackupStatus] = useState("")

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  const handleBackup = async () => {
    setLoading(true)
    setBackupStatus("Checking backup status...")

    try {
      const response = await fetch("/api/admin/backup")

      if (!response.ok) {
        throw new Error("Backup check failed")
      }

      const data = await response.json()

      alert(
        `Backup Information:\n\n${data.instructions.join("\n\n")}\n\nYour code is version-controlled via Git and automatically backed up with each deployment on Vercel.`,
      )

      setBackupStatus("Backup info displayed")
      setTimeout(() => setBackupStatus(""), 3000)
    } catch (error) {
      setBackupStatus("Unable to check backup status")
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = () => {
    alert(
      "Restore from Backup:\n\n" +
        "On Vercel, restoring is done via:\n" +
        "1. Go to your Vercel Dashboard\n" +
        "2. Select your project\n" +
        "3. Go to 'Deployments' tab\n" +
        "4. Find the deployment you want to restore\n" +
        "5. Click 'Promote to Production'\n\n" +
        "For database restores, use your database provider's backup tools (Supabase, Neon, etc.)",
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-400 mt-1">Manage your Options Calculator website</p>
          </div>
          <Button onClick={handleLogout} className="bg-white text-slate-900 hover:bg-slate-100" size="sm">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <Card className="bg-white">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                <CardTitle>Backup & Restore</CardTitle>
              </div>
              <CardDescription>Manage backups via Git and Vercel deployment history</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleBackup} className="w-full" disabled={loading}>
                <Download className="mr-2 h-4 w-4" />
                View Backup Info
              </Button>

              <Button onClick={handleRestore} variant="outline" className="w-full bg-transparent" disabled={loading}>
                <Upload className="mr-2 h-4 w-4" />
                Restore Instructions
              </Button>

              {backupStatus && (
                <div className="text-sm text-center p-3 bg-blue-50 text-blue-600 rounded">{backupStatus}</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
              <CardDescription>Overview of your website</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Status</span>
                <span className="text-sm font-medium text-green-600">Online</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Last Backup</span>
                <span className="text-sm font-medium">Never</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Admin Email</span>
                <span className="text-sm font-medium">joelfrenette@gmail.com</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6">
          <ApiKeysManager />
        </div>
      </div>
    </div>
  )
}
