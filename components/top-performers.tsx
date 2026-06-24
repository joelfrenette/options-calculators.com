"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Trophy, TrendingUp, TrendingDown, Users, Info } from "lucide-react"
import { DataLoadGate } from "@/components/data-load-gate"

interface MemberRow {
  member: string
  party: "D" | "R" | "I" | "?"
  chamber: "House" | "Senate"
  tradeCount: number
  avgExcessReturnPct: number
  bestTickerByXr: string
  bestXrPct: number
  weightedAvgXrPct: number | null
}

interface ClusterRow {
  ticker: string
  buyerCount: number
  totalBuys: number
  avgExcessReturnPct: number | null
  members: string[]
}

interface Resp {
  success: boolean
  source?: string
  windowDays?: number
  minTradesForRanking?: number
  top: MemberRow[]
  bottom: MemberRow[]
  clusters: ClusterRow[]
  message?: string
  generatedAt?: string
}

const PARTY_COLOR: Record<MemberRow["party"], string> = {
  D: "bg-blue-100 text-blue-800 border-blue-300",
  R: "bg-red-100 text-red-800 border-red-300",
  I: "bg-purple-100 text-purple-800 border-purple-300",
  "?": "bg-slate-100 text-slate-700 border-slate-300",
}

export function TopPerformers() {
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(180)
  const [data, setData] = useState<Resp | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/top-performers?days=${days}`, { cache: "no-store" })
      const json = (await res.json()) as Resp
      setData(json)
    } catch (e) {
      console.error("[v0] Top performers error:", e)
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
        title="Load Top Performers Leaderboard?"
        description="Rank members of Congress by average excess return vs SPY across their disclosed trades. Plus cluster-buy alerts: tickers many members bought in the same window."
        onConfirm={() => setLoaded(true)}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            Top Performers Leaderboard
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Ranked by average <strong>excess return vs SPY</strong>. Minimum {data?.minTradesForRanking ?? "—"} trades to qualify.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600">
            Window:{" "}
            <select
              value={days}
              onChange={(e) => setDays(Number.parseInt(e.target.value, 10))}
              className="ml-1 p-1 border border-slate-300 rounded text-xs bg-white"
            >
              {[90, 180, 365].map((d) => (
                <option key={d} value={d}>
                  {d}d
                </option>
              ))}
            </select>
          </label>
          <Button onClick={fetchData} disabled={loading} size="sm" variant="outline" className="bg-white">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          <strong>Excess Return</strong> = trade&apos;s % return minus SPY&apos;s % return from the trade date. Positive
          means the member beat the market on that ticker; negative means they trailed. Quiver Quant calculates this
          per-trade; we average across each member&apos;s trades in the window.
        </span>
      </div>

      {data?.message && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{data.message}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* TOP performers */}
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
              <TrendingUp className="h-4 w-4" /> Top 25 — best vs SPY
            </CardTitle>
            <CardDescription className="text-xs">Members whose trades have outperformed the market.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <RankedTable rows={data?.top ?? []} positive />
          </CardContent>
        </Card>

        {/* BOTTOM performers */}
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <TrendingDown className="h-4 w-4" /> Bottom 25 — worst vs SPY
            </CardTitle>
            <CardDescription className="text-xs">Members whose trades have underperformed. Useful as a contra-signal.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <RankedTable rows={data?.bottom ?? []} positive={false} />
          </CardContent>
        </Card>
      </div>

      {/* Cluster buys */}
      <Card className="bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" /> Cluster Buys
          </CardTitle>
          <CardDescription className="text-xs">
            Tickers <strong>multiple different</strong> members bought in the {days}-day window. Higher buyer count = stronger signal.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Ticker</th>
                <th className="px-3 py-2 text-right font-semibold">Distinct buyers</th>
                <th className="px-3 py-2 text-right font-semibold">Total buys</th>
                <th className="px-3 py-2 text-right font-semibold">Avg Excess vs SPY</th>
                <th className="px-3 py-2 text-left font-semibold">Sample buyers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.clusters ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-400 text-sm">
                    No cluster buys yet for this window.
                  </td>
                </tr>
              )}
              {(data?.clusters ?? []).map((c) => {
                const up = (c.avgExcessReturnPct ?? 0) > 0
                const down = (c.avgExcessReturnPct ?? 0) < 0
                return (
                  <tr key={c.ticker} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono font-bold text-slate-900">{c.ticker}</td>
                    <td className="px-3 py-2 text-right font-semibold">{c.buyerCount}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{c.totalBuys}</td>
                    <td className={`px-3 py-2 text-right font-mono ${up ? "text-emerald-700 font-semibold" : down ? "text-red-700 font-semibold" : "text-slate-500"}`}>
                      {c.avgExcessReturnPct == null ? "—" : `${c.avgExcessReturnPct > 0 ? "+" : ""}${c.avgExcessReturnPct.toFixed(2)}%`}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">{c.members.slice(0, 4).join(", ")}{c.members.length > 4 ? ` (+${c.members.length - 4})` : ""}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {data?.source && (
        <p className="text-xs text-slate-400 italic">
          Source: {data.source} · {data.generatedAt ? `fetched ${new Date(data.generatedAt).toLocaleTimeString()}` : ""}
        </p>
      )}
    </div>
  )
}

function RankedTable({ rows, positive }: { rows: MemberRow[]; positive: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-semibold w-10">#</th>
            <th className="px-3 py-2 text-left font-semibold">Member</th>
            <th className="px-3 py-2 text-right font-semibold">Trades</th>
            <th className="px-3 py-2 text-right font-semibold">Avg XR</th>
            <th className="px-3 py-2 text-left font-semibold">Best pick</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-slate-400 text-sm">
                Loading…
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={`${r.member}-${i}`} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-400">{i + 1}</td>
              <td className="px-3 py-2">
                <span className="font-medium text-slate-900">{r.member}</span>
                <Badge variant="outline" className={`ml-1.5 text-[10px] ${PARTY_COLOR[r.party]}`}>
                  {r.party}-{r.chamber === "Senate" ? "Sen" : "Hou"}
                </Badge>
              </td>
              <td className="px-3 py-2 text-right text-slate-600">{r.tradeCount}</td>
              <td className={`px-3 py-2 text-right font-mono font-semibold ${positive ? "text-emerald-700" : "text-red-700"}`}>
                {r.avgExcessReturnPct > 0 ? "+" : ""}
                {r.avgExcessReturnPct.toFixed(2)}%
              </td>
              <td className="px-3 py-2 text-xs">
                {r.bestTickerByXr ? (
                  <span>
                    <span className="font-mono font-semibold">{r.bestTickerByXr}</span>{" "}
                    <span className="text-slate-500">({r.bestXrPct > 0 ? "+" : ""}{r.bestXrPct}%)</span>
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
