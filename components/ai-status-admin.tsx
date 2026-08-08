"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, MinusCircle, PowerOff, RefreshCw, XCircle, Zap } from "lucide-react"

/**
 * Admin AI tab (AUDIT_BACKLOG A-7).
 *
 * Everything rendered here comes from GET /api/ai-status, which is generated
 * from `providerConfigs` in lib/ai-providers.ts. Deliberately absent:
 *   - hardcoded "average latency" strings (were shown as if measured) — this
 *     panel renders "—" and points at the Costs tab, which has real numbers;
 *   - the handwritten "How the fallback chain works" list (had the order
 *     backwards and counted 4 providers while 7 exist).
 */

interface AIProvider {
  order: number
  name: string
  displayName: string
  model: string
  keyName: string
  tier: "free" | "paid"
  endpoint: string
  hasKey: boolean
  rawPresent: boolean
  disabled: boolean
  willBeTried: boolean
  latencyMs: number | null
}

interface AIStatusData {
  timestamp: string
  source: string
  measurement: string
  summary: {
    total: number
    configured: number
    unconfigured: number
    disabled: number
    free: number
    paid: number
    firstAttempted: string | null
    firstAttemptedIsPaid: boolean
  }
  providers: AIProvider[]
}

function statusChip(provider: AIProvider) {
  if (provider.disabled) {
    return {
      label: "DISABLED (kill switch)",
      className: "bg-slate-200 text-slate-700 border-slate-300",
      Icon: PowerOff,
    }
  }
  if (provider.willBeTried) {
    return {
      label: "KEY RESOLVED — in the chain",
      className: "bg-green-100 text-green-800 border-green-300",
      Icon: CheckCircle2,
    }
  }
  return {
    label: "NO KEY — skipped by the chain",
    className: "bg-red-100 text-red-800 border-red-300",
    Icon: XCircle,
  }
}

export function AIStatusAdmin() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<AIStatusData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchAIStatus()
  }, [])

  const fetchAIStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/ai-status")
      if (!response.ok) {
        throw new Error(`/api/ai-status returned HTTP ${response.status}`)
      }
      setData(await response.json())
    } catch (err) {
      console.error("Failed to fetch AI status:", err)
      setData(null)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600" />
              AI Fallback Chain
            </CardTitle>
            <CardDescription>
              Generated from <code className="font-mono">lib/ai-providers.ts</code> — the same list the code walks, in
              the same order. Key presence only: no AI provider is called to build this panel.
            </CardDescription>
          </div>
          <Button onClick={fetchAIStatus} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>Could not load the AI chain: {error}</span>
          </div>
        )}

        {!data && !error && !loading && <p className="text-sm text-slate-600">No data.</p>}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="text-3xl font-bold text-green-700">{data.summary.configured}</div>
                <div className="text-sm font-medium text-green-700">In the chain (key resolved)</div>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="text-3xl font-bold text-red-700">{data.summary.unconfigured}</div>
                <div className="text-sm font-medium text-red-700">No key — skipped</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-100 p-4">
                <div className="text-3xl font-bold text-slate-700">{data.summary.disabled}</div>
                <div className="text-sm font-medium text-slate-700">Kill-switched</div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="text-3xl font-bold text-blue-700">{data.summary.total}</div>
                <div className="text-sm font-medium text-blue-700">
                  Providers ({data.summary.free} free / {data.summary.paid} paid)
                </div>
              </div>
            </div>

            <div
              className={`rounded-lg border p-4 text-sm ${
                data.summary.firstAttempted === null
                  ? "border-red-200 bg-red-50 text-red-800"
                  : data.summary.firstAttemptedIsPaid
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-green-200 bg-green-50 text-green-800"
              }`}
            >
              {data.summary.firstAttempted === null ? (
                <>
                  <strong>No provider is reachable.</strong> Every entry in the chain is unconfigured or kill-switched,
                  so AI generation throws instead of falling back.
                </>
              ) : (
                <>
                  <strong>Next request goes to: {data.summary.firstAttempted}</strong> — the first entry whose key
                  resolves.{" "}
                  {data.summary.firstAttemptedIsPaid
                    ? "This is a PAY-PER-USE provider: every free-tier entry ahead of it is unconfigured or kill-switched, so requests are billed."
                    : "This is a free-tier provider ($0 per token)."}
                </>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-900">
                Fallback order (tried top to bottom; a provider with no resolved key is skipped)
              </h3>

              {data.providers.map((provider) => {
                const chip = statusChip(provider)
                const Icon = chip.Icon
                return (
                  <div
                    key={provider.name}
                    className={`flex items-start gap-4 rounded-lg border p-4 ${
                      provider.willBeTried ? "border-slate-200" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                      #{provider.order}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900">{provider.displayName}</p>
                        <span
                          className={`rounded border px-2 py-1 text-xs font-semibold ${
                            provider.tier === "free"
                              ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                              : "border-amber-300 bg-amber-100 text-amber-900"
                          }`}
                        >
                          {provider.tier === "free" ? "FREE TIER" : "PAY-PER-USE"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold ${chip.className}`}
                        >
                          <Icon className="h-3 w-3" />
                          {chip.label}
                        </span>
                      </div>

                      <p className="mb-1 break-all rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
                        model: {provider.model} · {provider.endpoint}
                      </p>

                      <p className="text-sm text-slate-600">
                        <span className="font-semibold">Key:</span> {provider.keyName} —{" "}
                        {provider.disabled
                          ? provider.rawPresent
                            ? "listed in DISABLED_APIS; the key is set but never used"
                            : "listed in DISABLED_APIS (no key set either)"
                          : provider.hasKey
                            ? "resolved"
                            : "not configured"}
                      </p>

                      <p className="flex items-center gap-1 text-sm text-slate-500">
                        <MinusCircle className="h-3 w-3" />
                        <span className="font-semibold">Latency:</span> —{" "}
                        <span className="text-xs">(not measured here — see the Costs tab / metering ledger)</span>
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <p>
                <span className="font-semibold">Source:</span> {data.source}
              </p>
              <p className="mt-1">
                <span className="font-semibold">Measurement:</span> {data.measurement}
              </p>
              <p className="mt-1">
                <span className="font-semibold">Generated:</span> {new Date(data.timestamp).toLocaleString()}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
