"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, ExternalLink, Wallet, Building2, Users, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DataLoadGate } from "@/components/data-load-gate"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"

interface ETF {
  ticker: string
  name: string
  category: "Congress" | "Hedge Fund" | "Insider"
  summary: string
  close: number | null
  change: number | null
  changePct: number | null
  asOf: string | null
}

interface Resp {
  success: boolean
  source?: string
  etfs: ETF[]
  generatedAt: string
  message?: string
}

const CATEGORY_META: Record<ETF["category"], { color: string; icon: typeof Users }> = {
  Congress: { color: "bg-purple-100 text-purple-800 border-purple-300", icon: Building2 },
  "Hedge Fund": { color: "bg-blue-100 text-blue-800 border-blue-300", icon: Wallet },
  Insider: { color: "bg-amber-100 text-amber-800 border-amber-300", icon: Users },
}

export function SmartMoneyEtfs() {
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Resp | null>(null)
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
      const res = await fetch("/api/smart-money-etfs", { cache: "no-store" })
      const json = (await res.json()) as Resp
      setData(json)
    } catch (e) {
      console.error("[v0] Smart-money ETFs error:", e)
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
        title="Load Smart-Money ETF tracker?"
        description="Live prices for ETFs that mirror the trades of Congress, hedge funds, and prominent investors. Uses your Polygon data."
        onConfirm={() => setLoaded(true)}
      />
    )
  }

  const categories: ETF["category"][] = ["Congress", "Hedge Fund", "Insider"]

  return (
    <TooltipProvider delayDuration={250}>
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Wallet className="h-6 w-6 text-emerald-600" />
            Smart-Money ETF Tracker
            <InfoTooltip content="These ETFs do the copying for you. NANC/KRUZ mirror disclosed Democrat/Republican trades. GURU follows top hedge-fund holdings. BRK.B is Buffett. Holdings update on the fund's cadence (monthly or quarterly), so they lag actual trades." />
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            ETFs that <em>copy by design</em> — let a fund mirror Congress/hedge-fund/insider trades for you.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
          <RefreshButton onClick={fetchData} isLoading={loading} loadingText="Refreshing..." />
        </div>
      </div>

      {data?.message && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {data.message}
        </div>
      )}

      {categories.map((cat) => {
        const items = (data?.etfs ?? []).filter((e) => e.category === cat)
        if (items.length === 0) return null
        const meta = CATEGORY_META[cat]
        const Icon = meta.icon
        return (
          <Card key={cat} className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-600" />
                {cat} mirror ETFs
              </CardTitle>
              <CardDescription className="text-xs">
                {cat === "Congress" && "Mirror Pelosi, Tuberville, and other STOCK Act disclosers."}
                {cat === "Hedge Fund" && "Mirror Berkshire, Renaissance, Bridgewater and other 13F holdings."}
                {cat === "Insider" && "Mirror corporate insider Form 4 buying."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((etf) => {
                const up = etf.changePct != null && etf.changePct > 0
                const down = etf.changePct != null && etf.changePct < 0
                return (
                  <div key={etf.ticker} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-lg text-slate-900">{etf.ticker}</span>
                          <Badge variant="outline" className={`text-[10px] ${meta.color}`}>
                            {cat}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">{etf.name}</div>
                      </div>
                      {etf.close != null ? (
                        <div className="text-right">
                          <div className="font-bold text-slate-900">${etf.close.toFixed(2)}</div>
                          {etf.changePct != null && (
                            <div
                              className={`text-xs font-semibold inline-flex items-center gap-1 ${
                                up ? "text-emerald-700" : down ? "text-red-700" : "text-slate-500"
                              }`}
                            >
                              {up ? <TrendingUp className="h-3 w-3" /> : down ? <TrendingDown className="h-3 w-3" /> : null}
                              {etf.changePct > 0 ? "+" : ""}
                              {etf.changePct.toFixed(2)}%
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">—</div>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{etf.summary}</p>
                    <div className="mt-2 flex items-center justify-between">
                      {etf.asOf && <span className="text-[10px] text-slate-400">Close {etf.asOf}</span>}
                      <a
                        href={`https://finance.yahoo.com/quote/${etf.ticker.replace(".", "-")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                      >
                        Quote / holdings <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })}

      <p className="text-xs text-slate-500 italic">
        Prices via Polygon.io (15-min cached). Past performance never guarantees future results. ETF holdings are
        disclosed at vendor cadence (monthly for NANC/KRUZ, quarterly for 13F-based funds), so they lag real-time trades.
      </p>
    </div>
    </TooltipProvider>
  )
}
