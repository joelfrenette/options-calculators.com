"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DollarSign, TrendingDown, CheckCircle2, XCircle, ArrowDownCircle, RefreshCw } from "lucide-react"

interface ServiceCost {
  key: string
  vendor: string
  category: string
  monthlyCost: number
  targetCost: number
  status: "keep-paid" | "keep-free" | "downgrade" | "eliminate"
  provides: string
  replacement: string
  configured: boolean
  usageCount: number
  lastUsedISO: string | null
}

interface UsageData {
  summary: {
    currentMonthly: number
    targetMonthly: number
    monthlySavings: number
    annualSavings: number
  }
  services: ServiceCost[]
}

const STATUS_META: Record<ServiceCost["status"], { label: string; className: string }> = {
  "keep-paid": { label: "Keep (paid)", className: "bg-blue-100 text-blue-800" },
  "keep-free": { label: "Keep (free)", className: "bg-green-100 text-green-800" },
  downgrade: { label: "Downgrade → free", className: "bg-amber-100 text-amber-800" },
  eliminate: { label: "Eliminate", className: "bg-red-100 text-red-800" },
}

export function CostsUsageAdmin() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/usage")
      setData(await res.json())
    } catch (e) {
      console.error("Failed to load cost data:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading && !data) {
    return <p className="text-slate-300">Loading cost data…</p>
  }
  if (!data) {
    return <p className="text-red-400">Failed to load cost data.</p>
  }

  const { summary, services } = data
  const categories = Array.from(new Set(services.map((s) => s.category)))

  return (
    <div className="space-y-6">
      {/* Savings summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Current est. spend
            </CardDescription>
            <CardTitle className="text-3xl">${summary.currentMonthly}/mo</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> Optimized target
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">${summary.targetMonthly}/mo</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-green-700">
              <TrendingDown className="h-4 w-4" /> Potential savings
            </CardDescription>
            <CardTitle className="text-3xl text-green-700">
              ${summary.monthlySavings}/mo
              <span className="text-base font-normal text-green-600"> (${summary.annualSavings}/yr)</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-400">
          Usage counts are best-effort (reset per serverless instance). Costs are estimates — adjust in{" "}
          <code className="bg-slate-800 px-1 rounded">lib/api-costs.ts</code> to match your actual plans.
        </p>
        <Button onClick={load} disabled={loading} size="sm" variant="outline" className="bg-transparent">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {categories.map((category) => (
        <Card key={category} className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg">{category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {services
              .filter((s) => s.category === category)
              .map((s) => {
                const meta = STATUS_META[s.status]
                return (
                  <div key={s.key} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">{s.vendor}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${meta.className}`}>
                          {meta.label}
                        </span>
                        {s.configured ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-green-700">
                            <CheckCircle2 className="h-3 w-3" /> key set
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                            <XCircle className="h-3 w-3" /> no key
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{s.provides}</p>
                      {s.status === "eliminate" || s.status === "downgrade" ? (
                        <p className="text-xs text-amber-700 mt-1 inline-flex items-start gap-1">
                          <ArrowDownCircle className="h-3 w-3 mt-0.5 shrink-0" />
                          {s.replacement}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-slate-900">${s.monthlyCost}/mo</p>
                      {s.targetCost !== s.monthlyCost && (
                        <p className="font-mono text-xs text-green-600">→ ${s.targetCost}/mo</p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-1">{s.usageCount} calls</p>
                    </div>
                  </div>
                )
              })}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
