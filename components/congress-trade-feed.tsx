"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Building2,
  RefreshCw,
  Info,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Filter,
  ExternalLink,
} from "lucide-react"
import { DataLoadGate } from "@/components/data-load-gate"

interface Trade {
  reportDate: string
  tradeDate: string
  disclosureLagDays: number
  member: string
  bioGuideId: string
  party: "D" | "R" | "I" | "?"
  chamber: "House" | "Senate"
  ticker: string
  tickerType: "stock" | "option" | "other"
  type: "Buy" | "Sell" | "Other"
  valueLabel: string
  valueMidUsd: number
  description: string
  excessReturnPct: number | null
  priceChangePct: number | null
  spyChangePct: number | null
}

interface FeedResponse {
  success: boolean
  source: string
  fetched?: number
  returned?: number
  trades: Trade[]
  generatedAt: string
  message?: string // shown when upstream rate-limits or fails
  upstreamStatus?: number
}

const PARTY_COLOR: Record<Trade["party"], string> = {
  D: "bg-blue-100 text-blue-800 border-blue-300",
  R: "bg-red-100 text-red-800 border-red-300",
  I: "bg-purple-100 text-purple-800 border-purple-300",
  "?": "bg-slate-100 text-slate-700 border-slate-300",
}

function fmtUsd(n: number): string {
  if (!n) return "—"
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

export function CongressTradeFeed() {
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FeedResponse | null>(null)

  // Filters
  const [days, setDays] = useState(30)
  const [party, setParty] = useState<"" | "D" | "R" | "I">("")
  const [chamber, setChamber] = useState<"" | "house" | "senate">("")
  const [type, setType] = useState<"" | "buy" | "sell">("")
  const [owner, setOwner] = useState("")
  const [ticker, setTicker] = useState("")
  const [minSize, setMinSize] = useState(0)
  const [optionsOnly, setOptionsOnly] = useState(false)

  const fetchTrades = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        days: String(days),
        ...(party ? { party } : {}),
        ...(chamber ? { chamber } : {}),
        ...(type ? { type } : {}),
        ...(owner ? { owner } : {}),
        ...(ticker ? { ticker: ticker.toUpperCase() } : {}),
        ...(minSize > 0 ? { minSize: String(minSize) } : {}),
      })
      const res = await fetch(`/api/congress-trades?${qs.toString()}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as FeedResponse
      setData(json)
      // Soft upstream failure (e.g. Quiver rate-limit): show message, not error banner.
      if (!json.success && json.message) {
        setError(json.message)
      }
    } catch (e) {
      console.error("[v0] Congress feed error:", e)
      setError("Could not load congressional trades. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [days, party, chamber, type, owner, ticker, minSize])

  useEffect(() => {
    if (loaded) fetchTrades()
  }, [loaded, fetchTrades])

  // Client-side options filter (server already cut by other filters)
  const visibleTrades = useMemo(() => {
    if (!data?.trades) return []
    return optionsOnly ? data.trades.filter((t) => t.tickerType === "option") : data.trades
  }, [data, optionsOnly])

  if (!loaded) {
    return (
      <DataLoadGate
        title="Load Congressional Trade Feed?"
        description="Pulls the latest STOCK Act disclosures from senators and representatives, with Party / Chamber / dollar-range / disclosure-lag context. Free public data via Quiver Quant."
        onConfirm={() => setLoaded(true)}
      />
    )
  }

  return (
    <TooltipProvider delayDuration={250}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Building2 className="h-6 w-6 text-emerald-600" />
              Congressional Trade Feed
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Live feed of senator + representative stock and options trades disclosed under the STOCK Act.
            </p>
          </div>
          <Button onClick={fetchTrades} disabled={loading} size="sm" variant="outline" className="bg-white">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* STOCK Act disclaimer */}
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p>
                <strong>Heads-up:</strong> The STOCK Act allows members <strong>up to 45 days</strong> to disclose a
                trade. Use the <em>lag</em> column to see how stale a record is — fresher = more actionable. Excess
                Return shows the trade&apos;s performance vs. SPY since the trade date. This is informational only, not
                investment advice.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
              <label className="space-y-1">
                <span className="font-medium text-slate-700">Window (days)</span>
                <select
                  value={days}
                  onChange={(e) => setDays(Number.parseInt(e.target.value, 10))}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white"
                >
                  {[7, 14, 30, 60, 90, 180].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-700">Party</span>
                <select
                  value={party}
                  onChange={(e) => setParty(e.target.value as any)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white"
                >
                  <option value="">All</option>
                  <option value="D">Democrat</option>
                  <option value="R">Republican</option>
                  <option value="I">Independent</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-700">Chamber</span>
                <select
                  value={chamber}
                  onChange={(e) => setChamber(e.target.value as any)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white"
                >
                  <option value="">All</option>
                  <option value="house">House</option>
                  <option value="senate">Senate</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-700">Buy/Sell</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white"
                >
                  <option value="">All</option>
                  <option value="buy">Buys only</option>
                  <option value="sell">Sells only</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-700">Member</span>
                <Input
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="e.g. Pelosi"
                  className="h-7 text-xs bg-white"
                />
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-700">Ticker</span>
                <Input
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="e.g. NVDA"
                  className="h-7 text-xs bg-white uppercase"
                />
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-700">Min size ($)</span>
                <select
                  value={minSize}
                  onChange={(e) => setMinSize(Number.parseInt(e.target.value, 10))}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white"
                >
                  <option value={0}>Any</option>
                  <option value={15000}>$15K+</option>
                  <option value={50000}>$50K+</option>
                  <option value={100000}>$100K+</option>
                  <option value={500000}>$500K+</option>
                  <option value={1000000}>$1M+</option>
                </select>
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={optionsOnly}
                  onChange={(e) => setOptionsOnly(e.target.checked)}
                  className="h-3.5 w-3.5 accent-emerald-600"
                />
                Options trades only (frequently signal high conviction)
              </label>
              <Button size="sm" onClick={fetchTrades} disabled={loading} className="h-7 text-xs">
                Apply filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {data && (
          <p className="text-xs text-slate-500">
            Showing <strong>{visibleTrades.length}</strong> of {data.returned} matching trades · pulled from{" "}
            {data.source} ·{" "}
            <span title={new Date(data.generatedAt).toLocaleString()}>
              fetched {new Date(data.generatedAt).toLocaleTimeString()}
            </span>
          </p>
        )}

        {/* Errors */}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Trade table */}
        <Card className="bg-white">
          <CardContent className="p-0 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Trade Date</th>
                  <th className="px-3 py-2 text-left font-semibold">
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center gap-1">
                        Lag <Info className="h-3 w-3 text-slate-400" />
                      </TooltipTrigger>
                      <TooltipContent>Days between transaction and disclosure (STOCK Act limit: 45).</TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Member</th>
                  <th className="px-3 py-2 text-left font-semibold">Ticker</th>
                  <th className="px-3 py-2 text-left font-semibold">Side</th>
                  <th className="px-3 py-2 text-left font-semibold">Size</th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center gap-1">
                        Excess vs SPY <Info className="h-3 w-3 text-slate-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Trade&apos;s % return minus SPY&apos;s % return, since the trade date.
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && visibleTrades.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-400 text-sm">
                      Loading trades…
                    </td>
                  </tr>
                )}
                {!loading && visibleTrades.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-400 text-sm">
                      No trades match these filters.
                    </td>
                  </tr>
                )}
                {visibleTrades.map((t, i) => (
                  <tr key={`${t.member}-${t.ticker}-${t.tradeDate}-${i}`} className="hover:bg-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap text-slate-700">{t.tradeDate}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                          t.disclosureLagDays <= 7
                            ? "bg-green-100 text-green-800"
                            : t.disclosureLagDays <= 30
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {t.disclosureLagDays}d
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-900">{t.member}</span>
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${PARTY_COLOR[t.party]}`}>
                          {t.party}-{t.chamber === "Senate" ? "Sen" : "Hou"}
                        </Badge>
                      </div>
                      {t.description && (
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1" title={t.description}>
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono font-semibold text-slate-900">{t.ticker}</span>
                      {t.tickerType === "option" && (
                        <span className="ml-1 text-[10px] uppercase font-semibold text-purple-600">OPT</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {t.type === "Buy" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <TrendingUp className="h-3.5 w-3.5" /> Buy
                        </span>
                      ) : t.type === "Sell" ? (
                        <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                          <TrendingDown className="h-3.5 w-3.5" /> Sell
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      <div>{t.valueLabel || fmtUsd(t.valueMidUsd)}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {t.excessReturnPct == null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={
                            t.excessReturnPct > 0
                              ? "text-emerald-700 font-semibold"
                              : t.excessReturnPct < 0
                                ? "text-red-700 font-semibold"
                                : "text-slate-600"
                          }
                        >
                          {t.excessReturnPct > 0 ? "+" : ""}
                          {t.excessReturnPct}%
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <a
                        href={`https://finance.yahoo.com/quote/${t.ticker}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                      >
                        Quote <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
