"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Settings2, Loader2, Check, ChevronDown, ChevronRight } from "lucide-react"
import { DEFAULT_WHEEL_PROFILE, type WheelProfile } from "@/lib/research/types"

/** A labelled number field. Module-scope so it is not remounted on every parent
 * render (an inner component definition loses input focus on each keystroke). */
function Num({
  label,
  value,
  onChange,
  step = 1,
  hint,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  step?: number
  hint?: string
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      <span>{label}</span>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 text-sm"
      />
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </label>
  )
}

/**
 * Editor for the owner's wheel_profile — the premium-selling preferences the
 * Research Queue computes against. Loads GET /api/research-profile on open and
 * saves via PATCH, which clamps every field server-side (so the inputs here are
 * a convenience, not the source of truth for what's valid). Collapsed by default
 * so it never crowds the queue.
 */
export function WheelProfileSettings() {
  const [open, setOpen] = useState(false)
  const [p, setP] = useState<WheelProfile>(DEFAULT_WHEEL_PROFILE)
  const [state, setState] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setState("loading")
    fetch("/api/research-profile")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (!cancelled && d.profile) {
          setP(d.profile)
          setState("idle")
        }
      })
      .catch(() => {
        if (!cancelled) setState("idle")
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const save = async () => {
    setState("saving")
    setError(null)
    try {
      const res = await fetch("/api/research-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType: p.accountType,
          willingToBeAssigned: p.willingToBeAssigned,
          avoidEarningsWithinDte: p.avoidEarningsWithinDte,
          maxCapitalPerTradeUsd: p.maxCapitalPerTradeUsd,
          minIvRankForPremiumSale: p.minIvRankForPremiumSale,
          targetCspDeltaLow: p.targetCspDelta[0],
          targetCspDeltaHigh: p.targetCspDelta[1],
          preferredDteLow: p.preferredDte[0],
          preferredDteHigh: p.preferredDte[1],
          leapsMinDte: p.leapsMinDte,
          leapsTargetDeltaLow: p.leapsTargetDelta[0],
          leapsTargetDeltaHigh: p.leapsTargetDelta[1],
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState("error")
        setError(d?.error ?? `HTTP ${res.status}`)
        return
      }
      if (d.profile) setP(d.profile) // reflect any server-side clamping
      setState("saved")
      setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 2000)
    } catch {
      setState("error")
      setError("Request failed")
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Settings2 className="h-4 w-4 text-slate-500" />
        Wheel preferences
        <span className="ml-auto text-xs font-normal text-slate-400">what the research computes against</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-200 p-3">
          {state === "loading" ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your preferences…
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  <span>Account type</span>
                  <select
                    value={p.accountType}
                    onChange={(e) => setP({ ...p, accountType: e.target.value as WheelProfile["accountType"] })}
                    className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm"
                  >
                    <option value="taxable">Taxable</option>
                    <option value="ira">IRA</option>
                    <option value="401k">401k</option>
                  </select>
                </label>
                <Num
                  label="Max capital / trade ($)"
                  value={p.maxCapitalPerTradeUsd}
                  step={500}
                  onChange={(n) => setP({ ...p, maxCapitalPerTradeUsd: n })}
                />
                <Num
                  label="Min IV rank to sell premium"
                  value={p.minIvRankForPremiumSale}
                  onChange={(n) => setP({ ...p, minIvRankForPremiumSale: n })}
                  hint="0–100 (estimate until IV history builds)"
                />
                <Num
                  label="CSP delta — low"
                  value={p.targetCspDelta[0]}
                  step={0.01}
                  onChange={(n) => setP({ ...p, targetCspDelta: [n, p.targetCspDelta[1]] })}
                  hint="deeper OTM / safer"
                />
                <Num
                  label="CSP delta — high"
                  value={p.targetCspDelta[1]}
                  step={0.01}
                  onChange={(n) => setP({ ...p, targetCspDelta: [p.targetCspDelta[0], n] })}
                  hint="richer premium"
                />
                <div />
                <Num
                  label="Preferred DTE — low"
                  value={p.preferredDte[0]}
                  onChange={(n) => setP({ ...p, preferredDte: [n, p.preferredDte[1]] })}
                />
                <Num
                  label="Preferred DTE — high"
                  value={p.preferredDte[1]}
                  onChange={(n) => setP({ ...p, preferredDte: [p.preferredDte[0], n] })}
                />
                <Num
                  label="LEAPS min DTE"
                  value={p.leapsMinDte}
                  step={30}
                  onChange={(n) => setP({ ...p, leapsMinDte: n })}
                />
                <Num
                  label="LEAPS delta — low"
                  value={p.leapsTargetDelta[0]}
                  step={0.01}
                  onChange={(n) => setP({ ...p, leapsTargetDelta: [n, p.leapsTargetDelta[1]] })}
                />
                <Num
                  label="LEAPS delta — high"
                  value={p.leapsTargetDelta[1]}
                  step={0.01}
                  onChange={(n) => setP({ ...p, leapsTargetDelta: [p.leapsTargetDelta[0], n] })}
                />
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={p.willingToBeAssigned}
                    onChange={(e) => setP({ ...p, willingToBeAssigned: e.target.checked })}
                  />
                  Willing to be assigned
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={p.avoidEarningsWithinDte}
                    onChange={(e) => setP({ ...p, avoidEarningsWithinDte: e.target.checked })}
                  />
                  Avoid earnings within DTE
                </label>
              </div>

              <div className="flex items-center gap-3">
                <Button size="sm" onClick={save} disabled={state === "saving"}>
                  {state === "saving" ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : state === "saved" ? (
                    <Check className="mr-1 h-4 w-4 text-green-600" />
                  ) : null}
                  {state === "saved" ? "Saved" : "Save preferences"}
                </Button>
                {error && <span className="text-xs text-red-600">{error}</span>}
                <span className="text-[11px] text-slate-400">Values are clamped to sane ranges on save.</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
