"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Database, HelpCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// Renders the REAL three-tier provenance emitted by /api/data-source-status,
// which derives it from the CCPI engine (lib/ccpi/scoring.ts). The previous
// version rendered a hardcoded object literal whose `baseline: 0` / `failed: 0`
// made the "some APIs are using baseline data" warning unreachable (AUDIT A-5).

type SourceStatus = "live" | "ai-estimate" | "baseline" | "unknown"
type StatusColor = "green" | "yellow" | "orange" | "slate"

interface DataSource {
  key: string
  name: string
  pillar: string
  pillarKey: string
  primarySource: string
  fallbackChain: string[]
  currentSource: string | null
  lastUpdated: string | null
  status: SourceStatus
  statusLabel: string
  color: StatusColor
  excludedFromScore: boolean
}

interface PillarProvenance {
  key: string
  name: string
  score: number | null
  scoredMax: number | null
  liveMax: number | null
  aiMax: number | null
  excluded: string[]
  indicatorCount: number
}

interface DataSourceStatusPayload {
  timestamp: string
  measuredBy: string
  ccpiTimestamp: string | null
  ccpi: number | null
  certainty: number | null
  summary: {
    total: number
    live: number
    aiEstimate: number
    baseline: number
    unknown: number
  }
  pillars: PillarProvenance[]
  sources: DataSource[]
}

/** Render a nullable value honestly. */
function dash(v: string | number | null | undefined): string {
  return v === null || v === undefined || v === "" ? "—" : String(v)
}

export function ApiDataSourceStatus() {
  const [status, setStatus] = useState<DataSourceStatusPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/data-source-status")
      if (!response.ok) {
        let detail = `HTTP ${response.status}`
        try {
          const body = await response.json()
          if (body?.error) detail = `${detail} — ${body.error}`
        } catch {
          /* non-JSON error body */
        }
        throw new Error(detail)
      }
      const data = (await response.json()) as DataSourceStatusPayload
      setStatus(data)
      setError(null)
    } catch (e) {
      console.error("[data-source-status] fetch failed:", e)
      setStatus(null)
      setError(e instanceof Error ? e.message : "Unable to load data-source provenance.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const getStatusIcon = (color: StatusColor) => {
    switch (color) {
      case "green":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case "yellow":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case "orange":
        return <AlertTriangle className="h-5 w-5 text-orange-600" />
      default:
        return <HelpCircle className="h-5 w-5 text-slate-400" />
    }
  }

  const getStatusBadge = (color: StatusColor, label: string) => {
    const colorClasses: Record<StatusColor, string> = {
      green: "bg-green-100 text-green-800 border-green-300",
      yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
      orange: "bg-orange-100 text-orange-800 border-orange-300",
      slate: "bg-slate-100 text-slate-700 border-slate-300",
    }
    return (
      <Badge variant="outline" className={`${colorClasses[color]} font-semibold`}>
        {label}
      </Badge>
    )
  }

  const getStatusLight = (color: StatusColor) => {
    const lightColors: Record<StatusColor, string> = {
      green: "bg-green-500",
      yellow: "bg-yellow-500",
      orange: "bg-orange-500",
      slate: "bg-slate-400",
    }
    return <div className={`w-3 h-3 ${lightColors[color]} rounded-full`} />
  }

  const degraded = status ? status.summary.baseline > 0 || status.summary.unknown > 0 : false

  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              CCPI Data-Source Provenance
            </CardTitle>
            <CardDescription>
              The tier each of the 29 scored CCPI indicators was actually served from on the last run. Derived from the
              CCPI engine&apos;s <code className="text-xs">provenance</code> block — not a declared list.
            </CardDescription>
          </div>
          <Button onClick={fetchStatus} disabled={loading} size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Checking..." : "Refresh"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-4 bg-red-50 border border-red-300 rounded-lg mb-6">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-900 mb-1">Provenance unavailable</h4>
                <p className="text-sm text-red-800">{error}</p>
                <p className="text-xs text-red-700 mt-1">
                  No status is shown rather than a guessed one. This panel is admin-gated; a 401 means the session
                  expired.
                </p>
              </div>
            </div>
          </div>
        )}

        {status && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{status.summary.live}</div>
                <div className="text-sm text-green-600">Live API data</div>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">{status.summary.aiEstimate}</div>
                <div className="text-sm text-yellow-600">AI estimate</div>
              </div>
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="text-2xl font-bold text-orange-700">{status.summary.baseline}</div>
                <div className="text-sm text-orange-600">Baseline (not scored)</div>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-2xl font-bold text-slate-700">{status.summary.unknown}</div>
                <div className="text-sm text-slate-600">Unknown</div>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">
                  {status.certainty === null ? "—" : `${status.certainty}%`}
                </div>
                <div className="text-sm text-blue-600">Data quality (certainty)</div>
              </div>
            </div>

            <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <h4 className="font-semibold text-sm mb-3 text-slate-700">Legend: provenance tiers</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="font-medium">Live</span>
                  <span className="text-slate-600">- a provider returned the value on this run</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <span className="font-medium">AI estimate</span>
                  <span className="text-slate-600">- an LLM&apos;s recollection; scored but flagged</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full" />
                  <span className="font-medium">Baseline</span>
                  <span className="text-slate-600">- hardcoded constant; excluded, pillar renormalizes</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-slate-400 rounded-full" />
                  <span className="font-medium">Unknown</span>
                  <span className="text-slate-600">- provenance did not report it; never assumed live</span>
                </div>
              </div>
            </div>

            {/* Per-pillar renormalization: how much of each pillar's 100 weight was backed by data. */}
            <div className="mb-6">
              <h3 className="font-semibold text-lg mb-3">Per-pillar scored weight</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {status.pillars.map((p) => (
                  <div key={p.key} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-900">{p.name}</span>
                      <span className="text-lg font-bold text-slate-700">
                        {p.score === null ? "—" : `${p.score}/100`}
                      </span>
                    </div>
                    {/* P6-34: only live weight scores. `aiMax` is now weight
                        DROPPED for being an LLM estimate, not weight counted at
                        half credit — so it reads as a deduction, not a source. */}
                    <p className="text-xs text-slate-600">
                      Scored weight: <span className="font-mono">{dash(p.scoredMax)}</span>/100, all live
                      {typeof p.aiMax === "number" && p.aiMax > 0 && (
                        <>
                          {" "}
                          · <span className="font-mono">{p.aiMax}</span> dropped as AI-estimated
                        </>
                      )}{" "}
                      across {p.indicatorCount} indicators
                    </p>
                    {p.score === null && (
                      <p className="text-xs text-orange-700 mt-1">
                        Below the 40-point minimum — this pillar reports no score and is dropped from the composite.
                      </p>
                    )}
                    {p.excluded.length > 0 && (
                      <p className="text-xs text-slate-500 mt-1">Excluded: {p.excluded.join(", ")}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                Scored indicators ({status.summary.total})
              </h3>

              <div className="space-y-3">
                {status.sources.map((source) => (
                  <div
                    key={`${source.pillarKey}-${source.key}`}
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusLight(source.color)}
                      {getStatusIcon(source.color)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-slate-900">{source.name}</h4>
                          <p className="text-xs text-slate-500">
                            {source.pillar} · <code className="text-[10px]">{source.key}</code>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {source.excludedFromScore && (
                            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 text-xs">
                              not scored
                            </Badge>
                          )}
                          {getStatusBadge(source.color, source.statusLabel)}
                        </div>
                      </div>

                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700">Primary:</span>
                          <span className="text-slate-600">{dash(source.primarySource)}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-medium text-slate-700">Fallback:</span>
                          <span className="text-slate-600 text-xs">
                            {source.fallbackChain.length > 0
                              ? source.fallbackChain.join(" → ")
                              : "none — degrades to a baseline constant and is excluded from scoring"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700">Reported source:</span>
                          <span className="text-slate-600 font-semibold">{dash(source.currentSource)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {degraded && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-yellow-900 mb-1">Data quality notice</h4>
                    <p className="text-sm text-yellow-800">
                      {status.summary.baseline} indicator{status.summary.baseline === 1 ? " is" : "s are"} on a baseline
                      constant and {status.summary.unknown} {status.summary.unknown === 1 ? "is" : "are"} unknown. Those
                      contribute no weight — each affected pillar renormalizes over what it could actually source, so
                      the CCPI is built on less evidence than the headline number implies. Check the relevant API keys
                      and <code className="text-xs">DISABLED_APIS</code>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="text-xs text-slate-500 mt-6 space-y-0.5">
              <p>Rendered: {new Date(status.timestamp).toLocaleString()}</p>
              <p>
                Provenance measured by <code>{status.measuredBy}</code>
                {status.ccpiTimestamp ? ` at ${new Date(status.ccpiTimestamp).toLocaleString()}` : ""}
              </p>
            </div>
          </>
        )}

        {!status && !loading && !error && (
          <div className="text-center py-8 text-slate-500">
            <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Click &quot;Refresh&quot; to load data-source provenance</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
