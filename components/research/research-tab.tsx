"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FlaskConical, RefreshCw, Trash2, Loader2, PauseCircle } from "lucide-react"
import { RESEARCH_TTL_MS, type ResearchRow, type OptionsRecommendation, type ResearchStatus } from "@/lib/research/types"

/** A researched row is stale once it is older than one overnight refresh cycle. */
function isStale(row: ResearchRow): boolean {
  if (!row.researchedAt) return false
  return Date.now() - new Date(row.researchedAt).getTime() > RESEARCH_TTL_MS
}

const STRATEGY_STYLE: Record<string, string> = {
  CSP: "bg-emerald-100 text-emerald-800 border-emerald-300",
  CC: "bg-sky-100 text-sky-800 border-sky-300",
  LEAPS: "bg-violet-100 text-violet-800 border-violet-300",
  LONG_CALL: "bg-blue-100 text-blue-800 border-blue-300",
  PMCC: "bg-amber-100 text-amber-900 border-amber-300",
  NO_TRADE: "bg-slate-100 text-slate-600 border-slate-300",
}

const STRATEGY_LABEL: Record<string, string> = {
  CSP: "SELL PUTS", CC: "SELL COVERED CALLS", LEAPS: "BUY LEAPS",
  LONG_CALL: "BUY CALLS", PMCC: "POOR-MAN'S COVERED CALL", NO_TRADE: "NO TRADE",
}

const num = (v: number | null, prefix = "", suffix = "") => (v === null ? "—" : `${prefix}${v}${suffix}`)

function Rec({ r }: { r: OptionsRecommendation }) {
  const headline =
    r.strategy === "CSP" && r.cspStrikeLow !== null
      ? `Sell puts between $${r.cspStrikeLow} and $${r.cspStrikeHigh} · ~${r.cspDte} DTE`
      : r.strategy === "LEAPS" && r.leapsStrike !== null
        ? `Buy a ${r.leapsDte}-day $${r.leapsStrike} LEAPS if it drops to ~$${r.leapsBuyBelowPrice}`
        : r.strategy === "CC" && r.ccStrike !== null
          ? `Sell covered calls at ~$${r.ccStrike} (credit ~$${r.ccCredit})`
          : STRATEGY_LABEL[r.strategy]

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded border px-2 py-1 text-xs font-bold ${STRATEGY_STYLE[r.strategy]}`}>
          {STRATEGY_LABEL[r.strategy]}
        </span>
        <span className="text-sm font-semibold text-slate-900">{headline}</span>
        <span className="text-xs text-slate-500">fit {r.fitScore}/5</span>
      </div>

      <p className="text-sm text-slate-700">{r.rationale}</p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 md:grid-cols-3">
        <span><b>Rating:</b> {r.rating}</span>
        <span><b>Price:</b> {num(r.price, "$")}</span>
        <span><b>ATM IV:</b> {num(r.atmIvPct, "", "%")}</span>
        <span><b>IV rank:</b> {num(r.ivRank)}{r.ivRank !== null && r.ivRankIsEstimate ? " (est.)" : ""}</span>
        {r.strategy === "CSP" && (
          <>
            <span><b>Credit:</b> {num(r.cspCredit, "$")}</span>
            <span><b>POP:</b> {num(r.cspProbabilityOfProfit, "", "%")}</span>
            <span><b>Breakeven:</b> {num(r.cspBreakeven, "$")}</span>
            <span><b>Annualized:</b> {num(r.cspAnnualizedReturnPct, "", "%")}</span>
            <span><b>Capital:</b> {num(r.cspCapitalRequired, "$")}</span>
          </>
        )}
      </div>

      {r.riskFlags.length > 0 && (
        <p className="text-xs text-amber-800"><b>Risks:</b> {r.riskFlags.join(" · ")}</p>
      )}
      <p className="text-xs text-slate-500"><b>Manage:</b> {r.managementPlan}</p>
      <p className="text-xs text-slate-500"><b>Rating basis:</b> {r.ratingBasis}</p>
    </div>
  )
}

export function ResearchTab() {
  const [queue, setQueue] = useState<ResearchRow[]>([])
  const [loading, setLoading] = useState(false)
  const [ticker, setTicker] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/research-queue")
      if (res.ok) setQueue((await res.json()).queue ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const research = async (t: string) => {
    const sym = t.trim().toUpperCase()
    if (!/^[A-Z]{1,6}$/.test(sym)) {
      setError("Enter a ticker of 1–6 letters")
      return
    }
    setError(null)
    setBusy(sym)
    try {
      const res = await fetch("/api/research-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: sym }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data?.error ?? `HTTP ${res.status}`)
      else setTicker("")
      await load()
    } finally {
      setBusy(null)
    }
  }

  const patch = async (id: number, status: ResearchStatus) => {
    await fetch("/api/research-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
    await load()
  }
  const remove = async (id: number) => {
    await fetch(`/api/research-queue?id=${id}`, { method: "DELETE" })
    await load()
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-violet-600" />
          Research Queue
        </CardTitle>
        <p className="text-sm text-slate-600">
          Research any ticker for an options plan — should you run the wheel, sell puts, buy a LEAPS, sell calls against
          shares, or stand aside. Numbers are computed from current prices and the options-chain IV (IV rank is an
          estimate until an IV history builds); the read is written over them.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && research(ticker)}
            placeholder="Ticker (e.g. NVDA)"
            className="max-w-[180px] font-mono"
            maxLength={6}
          />
          <Button onClick={() => research(ticker)} disabled={busy !== null}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-1 h-4 w-4" />}
            Research
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh queue
          </Button>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}

        {queue.length === 0 && !loading && (
          <p className="text-sm text-slate-500">Your queue is empty. Research a ticker above, or use the Research button next to any ticker.</p>
        )}

        <div className="space-y-3">
          {queue.map((row) => (
            <div key={row.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-slate-900">{row.ticker}</span>
                  <span className="text-xs text-slate-500">
                    {row.status}
                    {row.researchedAt ? ` · ${new Date(row.researchedAt).toLocaleString()}` : ""}
                  </span>
                  {isStale(row) && (
                    <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                      STALE — re-research
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" title="Re-research" onClick={() => research(row.ticker)} disabled={busy === row.ticker}>
                    {busy === row.ticker ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" title={row.status === "paused" ? "Resume" : "Pause nightly"} onClick={() => patch(row.id, row.status === "paused" ? "pending" : "paused")}>
                    <PauseCircle className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" title="Remove" onClick={() => remove(row.id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
              {row.status === "failed" && <p className="mt-1 text-xs text-red-700">Research failed — retry, or the data may be unavailable.</p>}
              {row.recommendation && <Rec r={row.recommendation} />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
