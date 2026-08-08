"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle2, HelpCircle, RefreshCw, ShieldOff, ShieldCheck, XCircle } from "lucide-react"

/**
 * Budget guard panel — AUDIT_BACKLOG E-5.
 *
 * Shows metered spend against the hard stops, whether the automatic shutoff has
 * tripped, and the button that re-enables paid APIs afterwards.
 *
 * House rule throughout: unknown is rendered as an em-dash and said out loud,
 * never as $0. "We can't reach the ledger" and "you spent nothing" must not
 * look the same on a page whose whole job is telling you how much you spent.
 */

interface SpendWindow {
  usd: number | null
  unpricedCalls: number
  byProvider: Record<string, number>
}

interface GuardResponse {
  timestamp: string
  state: {
    tripped: boolean
    reason: string | null
    spendUsd: number | null
    thresholdUsd: number | null
    trippedAt: string | null
    clearedAt: string | null
    clearedBy: string | null
  }
  stateAvailable: boolean
  spend: {
    day: string
    month: string
    daily: SpendWindow
    monthly: SpendWindow
    dailyHardStop: number
    monthlyHardStop: number
    breached: boolean | null
    breachReason: "daily" | "monthly" | null
    unavailableReason: string | null
  }
  guardedVendors: string[]
  metering: { configured: boolean; note: string }
}

const money = (usd: number | null) => (usd === null ? "—" : `$${usd.toFixed(2)}`)

function SpendBar({
  label,
  window: w,
  cap,
  windowLabel,
}: {
  label: string
  window: SpendWindow
  cap: number
  windowLabel: string
}) {
  const known = w.usd !== null
  // No bar at all when spend is unknown — a 0%-full bar would read as "nothing
  // spent", which is exactly the wrong conclusion.
  const pct = known && cap > 0 ? Math.min(100, ((w.usd as number) / cap) * 100) : null
  const hot = pct !== null && pct >= 100
  const warm = pct !== null && pct >= 75 && pct < 100

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">
          {label} <span className="text-xs font-normal text-slate-500">({windowLabel})</span>
        </span>
        <span className={`text-sm font-mono ${hot ? "text-red-700 font-bold" : warm ? "text-amber-700" : "text-slate-700"}`}>
          {money(w.usd)} <span className="text-slate-400">/ ${cap.toFixed(2)}</span>
        </span>
      </div>
      {pct === null ? (
        <div className="h-2 rounded bg-slate-100 border border-dashed border-slate-300" title="Spend unknown" />
      ) : (
        <div className="h-2 rounded bg-slate-100 overflow-hidden">
          <div
            className={`h-full ${hot ? "bg-red-600" : warm ? "bg-amber-500" : "bg-emerald-600"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {w.unpricedCalls > 0 && (
        <p className="text-xs text-amber-700 flex items-start gap-1">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          {w.unpricedCalls} call{w.unpricedCalls === 1 ? "" : "s"} used a model with no price on file and{" "}
          <strong>are not counted above</strong> — real spend is higher. Add the model to{" "}
          <code>MODEL_TOKEN_PRICES</code> in <code>lib/api-costs.ts</code>.
        </p>
      )}
    </div>
  )
}

export function BudgetGuardPanel() {
  const [data, setData] = useState<GuardResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/budget-guard", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      setData((await res.json()) as GuardResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const act = useCallback(
    async (action: "clear" | "trip") => {
      setActing(true)
      setError(null)
      try {
        const res = await fetch("/api/admin/budget-guard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setActing(false)
      }
    },
    [load],
  )

  const spend = data?.spend
  const tripped = data?.state.tripped === true
  const unknown = !data || !data.metering.configured || spend?.unavailableReason != null

  return (
    <Card className="bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {tripped ? (
            <ShieldOff className="h-5 w-5 text-red-600" />
          ) : unknown ? (
            <HelpCircle className="h-5 w-5 text-slate-500" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          )}
          Budget guard — automatic shutoff
        </CardTitle>
        <CardDescription>
          Cuts off pay-per-use API keys when metered spend breaches a hard stop. Flat-rate and free providers are left
          running, so the site keeps working on its free AI path.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status banner */}
        {tripped ? (
          <div className="rounded border border-red-300 bg-red-50 p-3 space-y-2">
            <p className="text-sm font-bold text-red-800 flex items-center gap-2">
              <ShieldOff className="h-4 w-4" /> TRIPPED — paid API keys are cut off
            </p>
            <p className="text-xs text-red-800">
              Reason: <strong>{data?.state.reason ?? "—"}</strong> cap. Spend at trip:{" "}
              <strong>{money(data?.state.spendUsd ?? null)}</strong> against a{" "}
              <strong>{money(data?.state.thresholdUsd ?? null)}</strong> hard stop.
              {data?.state.trippedAt ? ` Tripped ${new Date(data.state.trippedAt).toLocaleString()}.` : ""}
            </p>
            <Button
              onClick={() => act("clear")}
              disabled={acting}
              className="bg-red-600 hover:bg-red-700 text-white"
              size="sm"
            >
              {acting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Re-enable paid APIs
            </Button>
            <p className="text-xs text-red-700">
              Re-enabling does not raise the cap. If spend is still over the hard stop, the next cron run trips it again
              — raise <code>DAILY_BUDGET_HARD_STOP</code> / <code>MONTHLY_BUDGET_HARD_STOP</code> first, or wait for the
              UTC day to roll over.
            </p>
          </div>
        ) : unknown ? (
          <div className="rounded border border-slate-300 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <HelpCircle className="h-4 w-4" /> UNKNOWN — spend cannot be read
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {data?.spend.unavailableReason ??
                (data && !data.metering.configured
                  ? "Supabase metering is not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)."
                  : "Loading…")}{" "}
              The guard fails <strong>open</strong>: paid APIs keep working rather than the site going down over a
              metering outage. Provider-side caps in each vendor console are the backstop.
            </p>
          </div>
        ) : (
          <div className="rounded border border-emerald-300 bg-emerald-50 p-3">
            <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> ACTIVE — under budget
            </p>
            {data?.state.clearedAt && (
              <p className="text-xs text-emerald-800 mt-1">
                Last re-enabled {new Date(data.state.clearedAt).toLocaleString()}
                {data.state.clearedBy ? ` by ${data.state.clearedBy}` : ""}.
              </p>
            )}
          </div>
        )}

        {/* Spend vs caps */}
        {spend && (
          <div className="space-y-3">
            <SpendBar label="Today" window={spend.daily} cap={spend.dailyHardStop} windowLabel={`UTC ${spend.day}`} />
            <SpendBar
              label="Month to date"
              window={spend.monthly}
              cap={spend.monthlyHardStop}
              windowLabel={`UTC ${spend.month}`}
            />
          </div>
        )}

        {/* Per-provider breakdown, month to date */}
        {spend && Object.keys(spend.monthly.byProvider).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">Month to date by provider</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(spend.monthly.byProvider)
                .sort((a, b) => b[1] - a[1])
                .map(([provider, usd]) => (
                  <span
                    key={provider}
                    className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    {provider} {money(usd)}
                  </span>
                ))}
            </div>
          </div>
        )}

        {data && data.guardedVendors.length > 0 && (
          <p className="text-xs text-slate-600">
            <strong>Cut off when tripped:</strong> {data.guardedVendors.join(", ")}. Everything else bills a flat rate or
            is free-tier, so shutting it off would break features without saving anything.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button onClick={() => void load()} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {!tripped && (
            <Button
              onClick={() => act("trip")}
              disabled={acting || unknown}
              variant="outline"
              size="sm"
              className="text-red-700 border-red-300 hover:bg-red-50"
            >
              <ShieldOff className="h-4 w-4 mr-2" />
              Trip now (test / panic)
            </Button>
          )}
        </div>

        {data && (
          <p className="text-xs text-slate-500 border-t pt-2">
            {data.metering.note} Layer 1 is the hard cap set in each vendor console — that is the only control that
            still works if this app is down.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
