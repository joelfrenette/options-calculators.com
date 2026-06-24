"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DollarSign,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Power,
  PowerOff,
  RefreshCw,
  Copy,
  AlertTriangle,
} from "lucide-react"

interface ServiceCost {
  key: string
  vendor: string
  category: string
  monthlyCost: number
  targetCost: number
  status: "keep-paid" | "keep-free" | "downgrade" | "eliminate"
  provides: string
  replacement: string
  keyPresent: boolean
  disabled: boolean
  active: boolean
  effectiveCost: number
  usageCount: number
}

interface UsageData {
  summary: { currentMonthly: number; targetMonthly: number; monthlySavings: number; annualSavings: number }
  controls: { budgetTarget: number; effectiveMonthly: number; overBudget: boolean; disabledServices: string[] }
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
  const [staged, setStaged] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/usage")
      const json: UsageData = await res.json()
      setData(json)
      setStaged(new Set(json.controls.disabledServices))
    } catch (e) {
      console.error("Failed to load cost data:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const disabledString = useMemo(() => Array.from(staged).sort().join(","), [staged])

  // Spend if the staged disable set were applied (paid + key present + not staged-off).
  const stagedSpend = useMemo(() => {
    if (!data) return 0
    return data.services
      .filter((s) => s.keyPresent && !staged.has(s.key))
      .reduce((sum, s) => sum + s.monthlyCost, 0)
  }, [data, staged])

  if (loading && !data) return <p className="text-slate-300">Loading cost data…</p>
  if (!data) return <p className="text-red-400">Failed to load cost data.</p>

  const { summary, controls, services } = data
  const categories = Array.from(new Set(services.map((s) => s.category)))

  const toggleStaged = (key: string) => {
    setStaged((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
    setCopied(false)
  }

  const copyEnv = async () => {
    try {
      await navigator.clipboard.writeText(`DISABLED_APIS=${disabledString}`)
      setCopied(true)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="space-y-6">
      {/* Budget vs spend */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Effective spend now
            </CardDescription>
            <CardTitle className="text-2xl">${controls.effectiveMonthly}/mo</CardTitle>
          </CardHeader>
        </Card>
        <Card className={controls.overBudget ? "bg-red-50 border-red-200" : "bg-white"}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              {controls.overBudget ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
              Budget target
            </CardDescription>
            <CardTitle className={`text-2xl ${controls.overBudget ? "text-red-700" : ""}`}>
              ${controls.budgetTarget}/mo
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> If fully optimized
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">${summary.targetMonthly}/mo</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-green-700">
              <TrendingDown className="h-4 w-4" /> Max savings
            </CardDescription>
            <CardTitle className="text-2xl text-green-700">
              ${summary.monthlySavings}/mo
              <span className="block text-xs font-normal text-green-600">${summary.annualSavings}/yr</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Kill-switch control panel */}
      <Card className="bg-slate-50 border-slate-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PowerOff className="h-5 w-5 text-red-600" /> Disable APIs (kill switch)
          </CardTitle>
          <CardDescription>
            Check an API below to stage it for disabling. Disabled APIs return no key and the app falls back to its
            free/local path — so you stop paying without deleting the key. Apply by setting this env var in Vercel and
            redeploying. Staged spend:{" "}
            <span className="font-semibold text-slate-900">${stagedSpend}/mo</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-slate-900 text-slate-100 px-3 py-2 rounded font-mono overflow-x-auto">
              DISABLED_APIS={disabledString || "(none)"}
            </code>
            <Button onClick={copyEnv} size="sm" variant="outline" className="bg-white shrink-0">
              <Copy className="h-4 w-4 mr-1" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Vercel → Project → Settings → Environment Variables → set <code>DISABLED_APIS</code> to the value above →
            Redeploy. Set <code>MONTHLY_BUDGET_TARGET</code> to change the budget.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
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
                const isStaged = staged.has(s.key)
                return (
                  <div
                    key={s.key}
                    className={`flex items-start gap-3 p-3 border rounded-lg ${isStaged ? "bg-red-50/40 border-red-200" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-red-600"
                      checked={isStaged}
                      onChange={() => toggleStaged(s.key)}
                      aria-label={`Disable ${s.vendor}`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">{s.vendor}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${meta.className}`}>
                          {meta.label}
                        </span>
                        {s.disabled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-red-700 font-semibold">
                            <PowerOff className="h-3 w-3" /> disabled
                          </span>
                        ) : s.active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-green-700">
                            <Power className="h-3 w-3" /> active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                            <XCircle className="h-3 w-3" /> no key
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{s.provides}</p>
                      {(s.status === "eliminate" || s.status === "downgrade") && (
                        <p className="text-xs text-amber-700 mt-1">↳ {s.replacement}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-slate-900">${s.monthlyCost}/mo</p>
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
