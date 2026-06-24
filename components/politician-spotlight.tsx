"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, ExternalLink, Building2, Star } from "lucide-react"
import { DataLoadGate } from "@/components/data-load-gate"

interface Trade {
  date: string
  ticker: string
  type: "Buy" | "Sell" | "Other"
  range: string
  midUsd: number
  tickerType: "stock" | "option" | "other"
  excessReturnPct: number | null
}

interface Member {
  key: string
  displayName: string
  party: "D" | "R" | "I"
  chamber: "House" | "Senate"
  blurb: string
  totalTrades: number
  buys: number
  sells: number
  estimatedActivityUsd: number
  avgExcessReturnPct: number | null
  topTickers: Array<{ ticker: string; count: number }>
  recentTrades: Trade[]
}

interface Resp {
  success: boolean
  source?: string
  windowDays?: number
  members: Member[]
  message?: string
  generatedAt?: string
}

const PARTY_COLOR: Record<Member["party"], string> = {
  D: "bg-blue-100 text-blue-800 border-blue-300",
  R: "bg-red-100 text-red-800 border-red-300",
  I: "bg-purple-100 text-purple-800 border-purple-300",
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

export function PoliticianSpotlight() {
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Resp | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/politician-spotlight?days=180", { cache: "no-store" })
      const json = (await res.json()) as Resp
      setData(json)
    } catch (e) {
      console.error("[v0] Politician spotlight error:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (loaded) fetchData()
  }, [loaded, fetchData])

  if (!loaded) {
    return (
      <DataLoadGate
        title="Load Politician Spotlight?"
        description="Curated portfolios of the most-watched senators and representatives — recent trades, top tickers, average excess return vs SPY. Free data via Quiver Quant."
        onConfirm={() => setLoaded(true)}
      />
    )
  }

  const toggleExpand = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Star className="h-6 w-6 text-amber-500" />
            Politician Spotlight
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Last {data?.windowDays ?? 180} days of trades by the most-watched members of Congress.
          </p>
        </div>
        <Button onClick={fetchData} disabled={loading} size="sm" variant="outline" className="bg-white">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Disclosures lag <strong>up to 45 days</strong> under the STOCK Act. Past performance ≠ future. This is
          informational only, not investment advice.
        </span>
      </div>

      {data?.message && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{data.message}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(data?.members ?? []).map((m) => {
          const xrUp = m.avgExcessReturnPct != null && m.avgExcessReturnPct > 0
          const xrDown = m.avgExcessReturnPct != null && m.avgExcessReturnPct < 0
          const isExpanded = expanded.has(m.key)
          return (
            <Card key={m.key} className="bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {m.displayName}
                      <Badge variant="outline" className={`text-[10px] ${PARTY_COLOR[m.party]}`}>
                        {m.party}-{m.chamber === "Senate" ? "Sen" : "Hou"}
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-slate-600 mt-1">{m.blurb}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2 mb-3 text-center">
                  <div className="bg-slate-50 rounded p-2">
                    <div className="text-[10px] uppercase text-slate-500">Trades</div>
                    <div className="text-base font-bold text-slate-900">{m.totalTrades}</div>
                  </div>
                  <div className="bg-emerald-50 rounded p-2">
                    <div className="text-[10px] uppercase text-emerald-700">Buys</div>
                    <div className="text-base font-bold text-emerald-700">{m.buys}</div>
                  </div>
                  <div className="bg-red-50 rounded p-2">
                    <div className="text-[10px] uppercase text-red-700">Sells</div>
                    <div className="text-base font-bold text-red-700">{m.sells}</div>
                  </div>
                  <div className="bg-blue-50 rounded p-2">
                    <div className="text-[10px] uppercase text-blue-700">Est. $</div>
                    <div className="text-base font-bold text-blue-700">{fmtUsd(m.estimatedActivityUsd)}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="text-slate-700">
                    <strong>Avg excess vs SPY:</strong>{" "}
                    {m.avgExcessReturnPct == null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span
                        className={
                          xrUp ? "text-emerald-700 font-bold" : xrDown ? "text-red-700 font-bold" : "text-slate-600"
                        }
                      >
                        {xrUp ? <TrendingUp className="h-3 w-3 inline" /> : xrDown ? <TrendingDown className="h-3 w-3 inline" /> : null}{" "}
                        {m.avgExcessReturnPct > 0 ? "+" : ""}
                        {m.avgExcessReturnPct.toFixed(2)}%
                      </span>
                    )}
                  </span>
                  {m.topTickers.length > 0 && (
                    <span className="text-slate-600">
                      <strong>Top:</strong>{" "}
                      {m.topTickers.slice(0, 3).map((t) => (
                        <span key={t.ticker} className="font-mono ml-1">
                          {t.ticker}
                          <span className="text-slate-400">×{t.count}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </div>

                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => toggleExpand(m.key)}>
                  {isExpanded ? "Hide recent trades" : `Show ${m.recentTrades.length} recent trades`}
                </Button>

                {isExpanded && (
                  <div className="mt-3 border-t pt-3">
                    {m.recentTrades.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No recent trades on file.</p>
                    ) : (
                      <ul className="space-y-1.5 text-xs">
                        {m.recentTrades.map((t, i) => (
                          <li key={i} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 last:border-0">
                            <span className="text-slate-500 font-mono w-20 shrink-0">{t.date}</span>
                            <span className="font-mono font-semibold w-16 shrink-0">{t.ticker}</span>
                            {t.tickerType === "option" && <span className="text-[9px] font-bold text-purple-600 w-6">OPT</span>}
                            <span className={`font-semibold w-10 shrink-0 ${t.type === "Buy" ? "text-emerald-700" : t.type === "Sell" ? "text-red-700" : "text-slate-500"}`}>
                              {t.type}
                            </span>
                            <span className="text-slate-600 flex-1 truncate" title={t.range}>{t.range || "—"}</span>
                            {t.excessReturnPct != null && (
                              <span className={`font-mono font-semibold w-14 text-right ${t.excessReturnPct > 0 ? "text-emerald-700" : t.excessReturnPct < 0 ? "text-red-700" : "text-slate-500"}`}>
                                {t.excessReturnPct > 0 ? "+" : ""}{t.excessReturnPct}%
                              </span>
                            )}
                            <a
                              href={`https://finance.yahoo.com/quote/${t.ticker}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 hover:underline shrink-0"
                              title="Quote"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {data?.source && (
        <p className="text-xs text-slate-400 italic">
          Source: {data.source} ·{" "}
          {data.generatedAt ? `fetched ${new Date(data.generatedAt).toLocaleTimeString()}` : ""}
        </p>
      )}
    </div>
  )
}
