"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, AlertTriangle, CheckCircle2, MinusCircle, PowerOff, RefreshCw, XCircle, Zap } from "lucide-react"

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
  // --- Observed liveness, from the metering ledger (see lib/ai-provider-health.ts).
  // Everything above answers "is a key set". These answer "did calls succeed",
  // which is a different question and the one this panel used not to ask.
  observedState: "working" | "failing" | "degraded" | "untried" | "unknown"
  observedCalls: number
  observedOk: number
  observedFailed: number
  observedLastOk: string | null
  observedLastFailure: string | null
  observedErrorClass: string | null
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
  livenessUnavailableReason: string | null
  observedWindowDays: number
  providers: AIProvider[]
}

/**
 * CONFIGURATION chip. Deliberately no longer green on its own: a resolved key
 * says the chain will TRY this provider, not that the provider works. xAI wore
 * a green "KEY RESOLVED" badge here through 401 consecutive failures. Green is
 * now reserved for the observed chip beside it, which is the one backed by
 * calls that actually happened.
 */
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
      className: "bg-slate-100 text-slate-700 border-slate-300",
      Icon: CheckCircle2,
    }
  }
  return {
    label: "NO KEY — skipped by the chain",
    className: "bg-red-100 text-red-800 border-red-300",
    Icon: XCircle,
  }
}

/**
 * OBSERVED chip — what the ledger saw, not what the config claims.
 *
 * `untried` is its own state and is deliberately neutral, not green: a provider
 * nobody called is neither healthy nor broken, and collapsing it either way is
 * exactly how a dead provider reads as fine.
 */
function observedChip(provider: AIProvider, windowDays: number) {
  const seen = `${provider.observedOk}/${provider.observedCalls} ok · ${windowDays}d`
  switch (provider.observedState) {
    case "working":
      return {
        label: `WORKING — ${seen}`,
        className: "bg-green-100 text-green-800 border-green-300",
        Icon: CheckCircle2,
      }
    case "degraded":
      return {
        label: `INTERMITTENT — ${seen}`,
        className: "bg-amber-100 text-amber-900 border-amber-300",
        Icon: AlertTriangle,
      }
    case "failing":
      return {
        label: `FAILING — every call failed (${provider.observedCalls} in ${windowDays}d)`,
        className: "bg-red-100 text-red-800 border-red-300",
        Icon: XCircle,
      }
    case "untried":
      return {
        label: `NOT CALLED in ${windowDays}d`,
        className: "bg-slate-100 text-slate-600 border-slate-300",
        Icon: MinusCircle,
      }
    default:
      return {
        label: "LIVENESS UNREADABLE",
        className: "bg-slate-100 text-slate-600 border-slate-300",
        Icon: MinusCircle,
      }
  }
}

/** Plain-English fix for a recorded cause. Never invents one for a null. */
const ERROR_CLASS_HINT: Record<string, string> = {
  model_not_found: "the model id is retired or misspelled — change the slug",
  auth: "the key was rejected — rotate it",
  billing: "the account balance is exhausted — add credits",
  rate_limit: "quota or rate cap hit — back off or upgrade",
  bad_request: "the request itself was rejected — fix the call",
  upstream: "the vendor returned a server error — not ours",
  timeout: "we gave up waiting",
  transport: "never reached the vendor — network, DNS or TLS",
  unknown: "unclassified — read the detail on the row",
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
              the same order. Two different facts per provider:{" "}
              <span className="font-semibold">KEY RESOLVED</span> means the chain will try it;{" "}
              <span className="font-semibold">WORKING / FAILING</span> is what the metering ledger actually observed
              over the last 7 days. A resolved key is not a working provider — no AI provider is called to build this
              panel, so both come from code and from recorded calls, never from a probe. Manage keys in the{" "}
              <span className="font-semibold">Keys</span> tab (the canonical surface).
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
                const observed = observedChip(provider, data.observedWindowDays)
                const ObservedIcon = observed.Icon
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
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold ${observed.className}`}
                        >
                          <ObservedIcon className="h-3 w-3" />
                          {observed.label}
                        </span>
                      </div>

                      {provider.observedState === "failing" || provider.observedState === "degraded" ? (
                        <p className="mb-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-900">
                          <span className="font-semibold">Last failure:</span>{" "}
                          {provider.observedLastFailure
                            ? new Date(provider.observedLastFailure).toLocaleString()
                            : "—"}
                          {" · "}
                          <span className="font-semibold">Cause:</span>{" "}
                          {provider.observedErrorClass ? (
                            <>
                              <span className="font-mono">{provider.observedErrorClass}</span>
                              {ERROR_CLASS_HINT[provider.observedErrorClass]
                                ? ` — ${ERROR_CLASS_HINT[provider.observedErrorClass]}`
                                : ""}
                            </>
                          ) : (
                            // NOT RECORDED, which is not the same as "no cause".
                            // Failures logged before migration 0015 carry none.
                            <span className="italic">
                              not recorded — these failures predate cause logging (migration 0015)
                            </span>
                          )}
                        </p>
                      ) : null}

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
