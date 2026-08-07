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
  Activity,
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

/**
 * Real (metered) usage block the API may return once call metering is deployed.
 * Shape owned by /api/admin/usage — `stats` and `recent` are rendered
 * defensively because their exact columns depend on the metering backend,
 * and the whole block may be absent on older deployments (deploy-order safety).
 */
interface RealUsage {
  source?: string // "supabase" | "memory-ephemeral"
  stats?: unknown
  recent?: unknown
}

interface UsageData {
  summary: { currentMonthly: number; targetMonthly: number; monthlySavings: number; annualSavings: number }
  controls: { budgetTarget: number; effectiveMonthly: number; overBudget: boolean; disabledServices: string[] }
  services: ServiceCost[]
  realUsage?: RealUsage
}

/** Normalize either an array of row objects or a keyed record into table rows. */
function toRows(v: unknown, keyColumn = "key"): Record<string, unknown>[] {
  if (Array.isArray(v)) {
    return v.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
  }
  if (typeof v === "object" && v !== null) {
    return Object.entries(v as Record<string, unknown>).map(([k, entry]) =>
      typeof entry === "object" && entry !== null
        ? { [keyColumn]: k, ...(entry as Record<string, unknown>) }
        : { [keyColumn]: k, value: entry },
    )
  }
  return []
}

function fmtCell(v: unknown): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v)
  return JSON.stringify(v)
}

/** Generic small table for measured-usage rows whose exact columns we don't hardcode. */
function UsageRowsTable({ rows, maxRows }: { rows: Record<string, unknown>[]; maxRows?: number }) {
  const shown = maxRows ? rows.slice(0, maxRows) : rows
  const columns = Array.from(new Set(shown.flatMap((r) => Object.keys(r))))
  if (shown.length === 0 || columns.length === 0) return <p className="text-xs text-slate-400">No rows recorded yet.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-left text-slate-500">
            {columns.map((c) => (
              <th key={c} className="py-1.5 pr-4 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {columns.map((c) => (
                <td key={c} className="py-1.5 pr-4 font-mono text-slate-700">
                  {fmtCell(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {maxRows && rows.length > maxRows && (
        <p className="text-[11px] text-slate-400 mt-1">Showing {maxRows} of {rows.length} rows.</p>
      )}
    </div>
  )
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

  const real = data.realUsage
  const provenance =
    real?.source === "supabase"
      ? "Supabase daily rollup"
      : real?.source === "memory-ephemeral"
        ? "Measured this instance since boot (ephemeral — resets when the serverless instance recycles)"
        : null
  const statRows = toRows(real?.stats, "service")
  const recentRows = toRows(real?.recent)

  return (
    <div className="space-y-6">
      {/* MEASURED usage — real counts, never estimates. */}
      <Card className="bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-blue-600" /> Measured usage
          </CardTitle>
          {provenance ? (
            <CardDescription>
              Source:{" "}
              <span
                className={`font-semibold px-2 py-0.5 rounded text-xs ${
                  real?.source === "supabase" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {provenance}
              </span>
            </CardDescription>
          ) : (
            <CardDescription>
              No metered-usage data in this response — call metering is not deployed on this instance yet (or has not
              recorded a call). Everything below this card is an <span className="font-semibold">estimate</span>, not a
              measurement.
            </CardDescription>
          )}
        </CardHeader>
        {provenance && (
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">Per-service counts</p>
              <UsageRowsTable rows={statRows} />
            </div>
            {recentRows.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Recent calls</p>
                <UsageRowsTable rows={recentRows} maxRows={20} />
              </div>
            )}
            <p className="text-[11px] text-slate-400">
              Per-call cost math (count × unit cost) appears here once the metering table has accumulated data.
            </p>
          </CardContent>
        )}
      </Card>

      {/* ESTIMATED section — flat subscription fees, not measured spend. */}
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <DollarSign className="h-5 w-5" /> Estimated (subscription flat fees)
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          These figures are published plan prices from <code>lib/api-costs.ts</code> — not metered spend.
        </p>
      </div>

      {/* Budget vs estimated spend */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Estimated spend now
            </CardDescription>
            <CardTitle className="text-2xl">${controls.effectiveMonthly}/mo</CardTitle>
            <CardDescription className="text-[11px]">active paid plans, flat-fee estimate</CardDescription>
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
            <CardDescription className="text-[11px]">
              <code>MONTHLY_BUDGET_TARGET</code>
              {controls.overBudget
                ? ` — estimate exceeds budget by $${controls.effectiveMonthly - controls.budgetTarget}/mo`
                : ` — estimate is $${controls.budgetTarget - controls.effectiveMonthly}/mo under budget`}
            </CardDescription>
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
                      <p className="font-mono text-sm text-slate-900">${s.monthlyCost}/mo est.</p>
                      <p className="text-[11px] text-slate-400 mt-1">{s.usageCount} calls (this instance)</p>
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
