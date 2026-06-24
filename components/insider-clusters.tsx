"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink, Users, TrendingUp, AlertCircle, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DataLoadGate } from "@/components/data-load-gate"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"

interface Buyer {
  name: string
  title: string
  shares: number
  value: number
  date: string
}
interface Cluster {
  ticker: string
  buyerCount: number
  totalBuys: number
  totalDollarValue: number
  buyers: Buyer[]
}
interface Resp {
  success: boolean
  source?: string
  windowDays: number
  minBuyers: number
  totalCompaniesScanned?: number
  clusters: Cluster[]
  message?: string
  generatedAt?: string
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

export function InsiderClusters() {
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Resp | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  const InfoTooltip = ({ content }: { content: string }) => {
    if (!tooltipsEnabled) return null
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help ml-1 inline-block align-middle" />
        </TooltipTrigger>
        <TooltipContent className="max-w-sm bg-white border shadow-lg p-3">
          <p className="text-sm text-gray-700">{content}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/insider-clusters?days=${days}&minBuyers=2`, { cache: "no-store" })
      const json = (await res.json()) as Resp
      setData(json)
    } catch (e) {
      console.error("[v0] Insider clusters error:", e)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    if (loaded) fetchData()
  }, [loaded, fetchData])

  if (!loaded) {
    return (
      <DataLoadGate
        title="Load Insider Cluster Buys?"
        description="Companies where multiple different insiders bought stock on the open market in a short window — a classic high-signal pattern. Uses your existing Finnhub free feed."
        onConfirm={() => setLoaded(true)}
      />
    )
  }

  const toggle = (t: string) =>
    setExpanded((p) => {
      const n = new Set(p)
      n.has(t) ? n.delete(t) : n.add(t)
      return n
    })

  return (
    <TooltipProvider delayDuration={250}>
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-600" />
            Insider Cluster Buys
            <InfoTooltip content="A 'cluster' is when 2+ DIFFERENT officers/directors at the same company each buy stock on the open market within a short window. Academic research treats this as one of the strongest insider-trading signals — much more meaningful than any single trade." />
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Companies where <strong>multiple different insiders</strong> have bought on the open market in the last{" "}
            {days} days.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-600">
            Window:{" "}
            <select
              value={days}
              onChange={(e) => setDays(Number.parseInt(e.target.value, 10))}
              className="ml-1 p-1 border border-slate-300 rounded text-xs bg-white"
            >
              {[14, 30, 60].map((d) => (
                <option key={d} value={d}>{d}d</option>
              ))}
            </select>
          </label>
          <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
          <RefreshButton onClick={fetchData} isLoading={loading} loadingText="Refreshing..." />
        </div>
      </div>

      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-start gap-2">
        <TrendingUp className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          <strong>Why this works:</strong> when several officers/directors of the same company each open their wallet
          to buy stock at the same time, they usually agree on something positive that hasn&apos;t been priced in yet.
          This is one of the most-cited alpha signals in academic insider-trading research.
        </span>
      </div>

      {data?.message && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {data.message}
        </div>
      )}

      <Card className="bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {data?.clusters?.length ?? 0} cluster{data?.clusters?.length === 1 ? "" : "s"} found
          </CardTitle>
          {data?.totalCompaniesScanned != null && (
            <CardDescription className="text-xs">
              Scanned {data.totalCompaniesScanned} companies with at least one insider purchase in the window.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Ticker</th>
                <th className="px-3 py-2 text-right font-semibold">Buyers</th>
                <th className="px-3 py-2 text-right font-semibold">Total buys</th>
                <th className="px-3 py-2 text-right font-semibold">Total $</th>
                <th className="px-3 py-2 text-left font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.clusters ?? []).length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-400 text-sm">
                    No clusters in this window. Try a longer window or check back tomorrow.
                  </td>
                </tr>
              )}
              {(data?.clusters ?? []).map((c) => (
                <>
                  <tr key={c.ticker} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono font-bold text-slate-900">{c.ticker}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-xs">
                        {c.buyerCount}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{c.totalBuys}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-700">
                      {fmtUsd(c.totalDollarValue)}
                    </td>
                    <td className="px-3 py-2 text-xs flex items-center gap-3">
                      <button
                        onClick={() => toggle(c.ticker)}
                        className="text-emerald-700 hover:underline font-semibold"
                      >
                        {expanded.has(c.ticker) ? "Hide" : "Show"} buyers
                      </button>
                      <a
                        href={`https://finance.yahoo.com/quote/${c.ticker}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                      >
                        Quote <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                  {expanded.has(c.ticker) && (
                    <tr key={`${c.ticker}-detail`} className="bg-slate-50">
                      <td colSpan={5} className="px-6 py-3">
                        <ul className="text-xs space-y-1.5">
                          {c.buyers.map((b, i) => (
                            <li key={i} className="grid grid-cols-12 gap-2">
                              <span className="col-span-3 text-slate-500 font-mono">{b.date.slice(0, 10)}</span>
                              <span className="col-span-4 font-medium text-slate-900">{b.name}</span>
                              <span className="col-span-2 text-slate-600">{b.title}</span>
                              <span className="col-span-1 text-right text-slate-600">{b.shares.toLocaleString()} sh</span>
                              <span className="col-span-2 text-right text-emerald-700 font-mono font-semibold">
                                {fmtUsd(b.value)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {data?.source && (
        <p className="text-xs text-slate-400 italic">
          Source: {data.source} ·{" "}
          {data.generatedAt ? `fetched ${new Date(data.generatedAt).toLocaleTimeString()}` : ""}
        </p>
      )}
    </div>
    </TooltipProvider>
  )
}
