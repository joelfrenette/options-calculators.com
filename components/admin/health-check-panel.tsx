"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { diagnose } from "@/lib/remediation"
import { RemediationCard } from "@/components/admin/remediation-card"
import { BudgetGuardPanel } from "@/components/admin/budget-guard-panel"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  KeyRound,
  PlayCircle,
  RefreshCw,
  XCircle,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Payload types — mirror app/api/admin/run-health-checks/route.ts exactly.
// That route is the single source of truth for this shape.
// ---------------------------------------------------------------------------

type ProbeStatus = "pass" | "fail" | "degraded" | "skipped" | "blocked"

interface ProbeResult {
  path: string
  method: string
  status: ProbeStatus
  httpStatus: number | null
  latencyMs: number | null
  budgetMs: number
  overBudget: boolean
  tabs: string[]
  detail: string | null
  schemaIssues?: string[]
  missingKeys?: string[]
}

interface KeyInfo {
  name: string
  aliases: string[]
  /** Which alias spelling is actually set in the environment. */
  resolvedVia: string | null
  configured: boolean
  disabled: boolean
  gates: string[]
}

interface Coverage {
  routesOnDisk: number
  contracted: number
  missingContract: string[]
  contractWithoutRoute: string[]
}

interface HealthReport {
  timestamp: string
  origin: string
  durationMs: number
  summary: {
    total: number
    pass: number
    fail: number
    degraded: number
    skipped: number
    blocked: number
    healthy: boolean
    affectedTabs: string[]
  }
  results: ProbeResult[]
  keys: KeyInfo[]
  coverage: Coverage
}

// ---------------------------------------------------------------------------

const STATUS_META: Record<ProbeStatus, { label: string; chip: string; row: string }> = {
  pass: { label: "pass", chip: "bg-green-100 text-green-800", row: "text-green-700" },
  degraded: { label: "degraded", chip: "bg-amber-100 text-amber-800", row: "text-amber-700" },
  fail: { label: "fail", chip: "bg-red-100 text-red-800", row: "text-red-700" },
  blocked: { label: "blocked", chip: "bg-orange-100 text-orange-800", row: "text-orange-700" },
  skipped: { label: "skipped", chip: "bg-slate-100 text-gray-500", row: "text-gray-500" },
}

/** Sort weight: worst news first when sorting by status. */
const STATUS_WEIGHT: Record<ProbeStatus, number> = { fail: 0, degraded: 1, blocked: 2, pass: 3, skipped: 4 }

type SortKey = "path" | "status" | "httpStatus" | "latencyMs"

export function HealthCheckPanel() {
  const [report, setReport] = useState<HealthReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [tabFilter, setTabFilter] = useState("")
  const [pathFilter, setPathFilter] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("status")
  const [sortAsc, setSortAsc] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const runChecks = async () => {
    setLoading(true)
    setError(null)
    setElapsed(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    try {
      const params = new URLSearchParams({ includeSkipped: "1" })
      if (tabFilter.trim()) params.set("tab", tabFilter.trim())
      if (pathFilter.trim()) params.set("path", pathFilter.trim())
      // Same-origin fetch: the admin-session cookie rides along automatically.
      const res = await fetch(`/api/admin/run-health-checks?${params.toString()}`, { cache: "no-store" })
      if (res.status === 401) {
        setError("Unauthorized — your admin session has expired. Log in again.")
        return
      }
      if (!res.ok) {
        setError(`Health-check endpoint answered HTTP ${res.status}.`)
        return
      }
      const json: HealthReport = await res.json()
      setReport(json)
      setExpanded(new Set())
    } catch (e) {
      setError(`Request failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setLoading(false)
    }
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((a) => !a)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const toggleExpanded = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  const sortedResults = useMemo(() => {
    if (!report) return []
    const dir = sortAsc ? 1 : -1
    return [...report.results].sort((a, b) => {
      switch (sortKey) {
        case "path":
          return dir * a.path.localeCompare(b.path)
        case "status":
          return dir * (STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status]) || a.path.localeCompare(b.path)
        case "httpStatus":
          return dir * ((a.httpStatus ?? -1) - (b.httpStatus ?? -1)) || a.path.localeCompare(b.path)
        case "latencyMs":
          return dir * ((a.latencyMs ?? -1) - (b.latencyMs ?? -1)) || a.path.localeCompare(b.path)
      }
    })
  }, [report, sortKey, sortAsc])

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortAsc ? " ↑" : " ↓") : "")

  return (
    <div className="space-y-6">
      {/* Run controls */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-600" />
            API Health — live contract checks
          </CardTitle>
          <CardDescription>
            Probes every route in <code>lib/api-contracts.ts</code> with a real request (canary parameters) and
            validates status, latency budget and response schema. A full run makes real upstream calls and can take
            60+ seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <Input
              value={tabFilter}
              onChange={(e) => setTabFilter(e.target.value)}
              placeholder="Filter by tab (e.g. ccpi, wheel-scanner)"
              className="md:max-w-xs"
              disabled={loading}
            />
            <Input
              value={pathFilter}
              onChange={(e) => setPathFilter(e.target.value)}
              placeholder="Filter by exact path (e.g. /api/vix)"
              className="md:max-w-xs"
              disabled={loading}
            />
            <Button onClick={runChecks} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Probing… {elapsed}s
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Run All Checks
                </>
              )}
            </Button>
          </div>
          {loading && (
            <p className="text-xs text-gray-500">
              Running live probes against {tabFilter.trim() || pathFilter.trim() ? "the filtered routes" : "all contracted routes"} — leave
              this tab open. Auth-gated routes reuse your current admin session.
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600 flex items-center gap-2">
              <XCircle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}
        </CardContent>
      </Card>
      {/* Budget guard (E-5). The owner reads the live checks first (his ask,
          2026-08-27); the guard sits second as reference. Its card still
          explains itself when tripped, which is when it matters. */}
      <BudgetGuardPanel />

      {report && (
        <>
          {/* Summary chips */}
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {report.summary.healthy ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full bg-green-100 text-green-800">
                    <CheckCircle2 className="h-4 w-4" /> HEALTHY
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full bg-red-100 text-red-800">
                    <XCircle className="h-4 w-4" /> FAILURES DETECTED
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-xs font-normal text-gray-500">
                  <Clock className="h-3 w-3" /> {(report.durationMs / 1000).toFixed(1)}s ·{" "}
                  {new Date(report.timestamp).toLocaleString()} · {report.origin}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700">
                  {report.summary.total} probed
                </span>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-green-100 text-green-800">
                  {report.summary.pass} pass
                </span>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-red-100 text-red-800">
                  {report.summary.fail} fail
                </span>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-amber-100 text-amber-800">
                  {report.summary.degraded} degraded
                </span>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-orange-100 text-orange-800">
                  {report.summary.blocked} blocked
                </span>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-gray-500">
                  {report.summary.skipped} skipped
                </span>
              </div>
              {report.summary.affectedTabs.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-red-700 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Tabs with a failing dependency:
                  </span>
                  {report.summary.affectedTabs.map((tab) => (
                    <span key={tab} className="text-xs px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700">
                      {tab}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results table */}
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Per-route results</CardTitle>
              <CardDescription>Click a column header to sort; click a row to expand its detail.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500">
                      <th className="py-2 pr-2 w-6" />
                      <th className="py-2 pr-4 cursor-pointer select-none" onClick={() => toggleSort("path")}>
                        Route{sortArrow("path")}
                      </th>
                      <th className="py-2 pr-4 cursor-pointer select-none" onClick={() => toggleSort("status")}>
                        Status{sortArrow("status")}
                      </th>
                      <th className="py-2 pr-4 cursor-pointer select-none" onClick={() => toggleSort("httpStatus")}>
                        HTTP{sortArrow("httpStatus")}
                      </th>
                      <th className="py-2 pr-4 cursor-pointer select-none" onClick={() => toggleSort("latencyMs")}>
                        Latency / budget{sortArrow("latencyMs")}
                      </th>
                      <th className="py-2 pr-4">Tabs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResults.map((r) => {
                      const meta = STATUS_META[r.status]
                      const isOpen = expanded.has(r.path)
                      const hasDetail =
                        !!r.detail || (r.schemaIssues?.length ?? 0) > 0 || (r.missingKeys?.length ?? 0) > 0
                      return (
                        <FragmentRow
                          key={`${r.method} ${r.path}`}
                          r={r}
                          meta={meta}
                          isOpen={isOpen}
                          hasDetail={hasDetail}
                          onToggle={() => hasDetail && toggleExpanded(r.path)}
                        />
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Remediation — every problem gets an owner and concrete next steps.
              Passing rows are hidden unless they carry a warning (e.g. a key
              resolved via a non-canonical alias), so this list stays actionable. */}
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">What to do about it</CardTitle>
              <CardDescription>
                One card per problem, with who acts and the exact next steps. YOU = a dashboard, billing or env
                change; CLAUDE = a code fix (copy the prompt); WAIT = upstream, re-check shortly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const cards = report.results
                  .filter((r) => r.status !== "skipped")
                  .map((r) => ({ r, rem: diagnose(r, { keys: report.keys }) }))
                  .filter(({ r, rem }) => r.status !== "pass" || rem.headline.startsWith("Works, but"))
                return cards.length === 0 ? (
                  <p className="text-sm text-gray-500">Nothing needs attention — every probed route passed.</p>
                ) : (
                  cards.map(({ r, rem }) => (
                    <RemediationCard key={`${r.method} ${r.path}`} result={r} remediation={rem} />
                  ))
                )
              })()}
            </CardContent>
          </Card>

          {/* Keys panel */}
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-blue-600" /> API keys
              </CardTitle>
              <CardDescription>
                Which canonical keys resolve, which alias spelling actually provides them, and which routes each key
                gates. An alias flag means the env var is set under a non-canonical name.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500">
                      <th className="py-2 pr-4">Key</th>
                      <th className="py-2 pr-4">Configured</th>
                      <th className="py-2 pr-4">Kill switch</th>
                      <th className="py-2 pr-4">Resolved via</th>
                      <th className="py-2 pr-4">Gates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.keys.map((k) => {
                      const aliasMismatch = k.resolvedVia !== null && k.resolvedVia !== k.name
                      return (
                        <tr key={k.name} className="border-b last:border-0 align-top">
                          <td className="py-2 pr-4 font-mono text-xs text-gray-900">{k.name}</td>
                          <td className="py-2 pr-4">
                            {k.configured ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-700">
                                <CheckCircle2 className="h-3.5 w-3.5" /> yes
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                <XCircle className="h-3.5 w-3.5" /> no
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            {k.disabled ? (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-800">
                                DISABLED_APIS
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">—</span>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            {k.resolvedVia ? (
                              aliasMismatch ? (
                                <span
                                  className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800"
                                  title={`Set as ${k.resolvedVia}, canonical name is ${k.name}`}
                                >
                                  <AlertTriangle className="h-3 w-3" /> {k.resolvedVia}
                                </span>
                              ) : (
                                <span className="font-mono text-xs text-slate-600">{k.resolvedVia}</span>
                              )
                            ) : (
                              <span className="text-xs text-gray-500">—</span>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            {k.gates.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {k.gates.map((g) => (
                                  <span key={g} className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                    {g}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-500">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Contract coverage */}
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Contract coverage</CardTitle>
              <CardDescription>
                Routes on disk vs routes with a written contract — a passing run only vouches for contracted routes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                <span
                  className={`font-bold ${
                    report.coverage.contracted >= report.coverage.routesOnDisk ? "text-green-700" : "text-amber-700"
                  }`}
                >
                  {report.coverage.contracted}/{report.coverage.routesOnDisk}
                </span>{" "}
                <span className="text-slate-600">routes have a contract.</span>
              </p>
              {report.coverage.missingContract.length > 0 && (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                  <p className="font-semibold mb-1">No contract written (not probed):</p>
                  <div className="flex flex-wrap gap-1">
                    {report.coverage.missingContract.map((p) => (
                      <span key={p} className="font-mono px-1.5 py-0.5 rounded bg-white border border-amber-200">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {report.coverage.contractWithoutRoute.length > 0 && (
                <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded p-2">
                  <p className="font-semibold mb-1">Contract exists but route not on disk (stale contract?):</p>
                  <div className="flex flex-wrap gap-1">
                    {report.coverage.contractWithoutRoute.map((p) => (
                      <span key={p} className="font-mono px-1.5 py-0.5 rounded bg-white border border-red-200">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!report && !loading && !error && (
        <p className="text-gray-500 text-sm">
          No results yet — click <span className="font-semibold text-gray-600">Run All Checks</span> to probe the
          live deployment. Nothing on this panel is cached or estimated; every number comes from a real request.
        </p>
      )}
    </div>
  )
}

/** One result row plus its expandable detail row. */
function FragmentRow({
  r,
  meta,
  isOpen,
  hasDetail,
  onToggle,
}: {
  r: ProbeResult
  meta: { label: string; chip: string; row: string }
  isOpen: boolean
  hasDetail: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        className={`border-b last:border-0 ${hasDetail ? "cursor-pointer hover:bg-slate-50" : ""}`}
        onClick={onToggle}
      >
        <td className="py-2 pr-2 text-gray-500">
          {hasDetail ? (
            isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : null}
        </td>
        <td className="py-2 pr-4">
          <span className="font-mono text-xs text-gray-900">{r.path}</span>
          <span className="ml-2 text-[10px] text-gray-500">{r.method}</span>
        </td>
        <td className="py-2 pr-4">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${meta.chip}`}>{meta.label}</span>
        </td>
        <td className="py-2 pr-4 font-mono text-xs">
          {r.httpStatus !== null ? (
            <span className={r.httpStatus >= 400 ? "text-red-700" : "text-slate-700"}>{r.httpStatus}</span>
          ) : (
            <span className="text-gray-500">—</span>
          )}
        </td>
        <td className="py-2 pr-4 font-mono text-xs">
          {r.latencyMs !== null ? (
            <span className={r.overBudget ? "text-amber-700 font-semibold" : "text-slate-700"}>
              {r.latencyMs}ms
              <span className="text-gray-500 font-normal"> / {r.budgetMs}ms</span>
              {r.overBudget && <span className="ml-1 text-[10px] uppercase text-amber-700">over budget</span>}
            </span>
          ) : (
            <span className="text-gray-500">— / {r.budgetMs}ms</span>
          )}
        </td>
        <td className="py-2 pr-4">
          {r.tabs.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {r.tabs.map((t) => (
                <span key={t} className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-gray-500">—</span>
          )}
        </td>
      </tr>
      {isOpen && (
        <tr className="border-b last:border-0 bg-slate-50/60">
          <td />
          <td colSpan={5} className="py-2 pr-4">
            {r.detail && <p className={`text-xs ${meta.row}`}>{r.detail}</p>}
            {r.missingKeys && r.missingKeys.length > 0 && (
              <p className="text-xs text-orange-700 mt-1">
                Missing key(s): <span className="font-mono">{r.missingKeys.join(", ")}</span>
              </p>
            )}
            {r.schemaIssues && r.schemaIssues.length > 0 && (
              <div className="mt-1">
                <p className="text-xs font-semibold text-red-700">Schema issues:</p>
                <ul className="list-disc ml-5 text-xs text-red-700">
                  {r.schemaIssues.map((issue) => (
                    <li key={issue} className="font-mono">
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
