"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, ExternalLink, Building2, Info } from "lucide-react"
import { DataLoadGate } from "@/components/data-load-gate"

interface Fund {
  cik: string
  name: string
  manager: string
  blurb: string
  ticker?: string
  latestFiling: {
    accession: string | null
    filedAt: string | null
    period: string | null
    holdingsUrl: string | null
  } | null
}
interface Resp {
  success: boolean
  source?: string
  funds: Fund[]
  message?: string
  generatedAt?: string
}

function daysAgo(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso).getTime()
  if (isNaN(d)) return iso
  const days = Math.round((Date.now() - d) / 86_400_000)
  if (days <= 1) return "yesterday"
  if (days < 30) return `${days}d ago`
  if (days < 90) return `${Math.round(days / 7)}w ago`
  return `${Math.round(days / 30)}mo ago`
}

export function HedgeFund13F() {
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Resp | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/hedge-fund-13f", { cache: "no-store" })
      const json = (await res.json()) as Resp
      setData(json)
    } catch (e) {
      console.error("[v0] 13F tracker error:", e)
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
        title="Load 13F Hedge Fund Tracker?"
        description="Quarterly holdings disclosures from the biggest hedge funds. Each card shows last filing date + a one-click link into the full holdings table on SEC EDGAR."
        onConfirm={() => setLoaded(true)}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            13F Hedge Fund Tracker
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Quarterly equity holdings of widely-watched funds — direct links into SEC EDGAR for the canonical data.
          </p>
        </div>
        <Button onClick={fetchData} disabled={loading} size="sm" variant="outline" className="bg-white">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          <strong>How 13F works:</strong> Institutional managers with $100M+ AUM must disclose their long US-equity
          positions <strong>within 45 days</strong> after each quarter ends. So holdings are AT LEAST 45 days stale —
          and the position may already be exited. Use 13F for thesis ideas, not for timing.
        </span>
      </div>

      {data?.message && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{data.message}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(data?.funds ?? []).map((f) => (
          <Card key={`${f.cik}-${f.name}`} className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                {f.name}
                {f.ticker && (
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                    Public: {f.ticker}
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-slate-600 mt-0.5">
                <strong>Manager:</strong> {f.manager}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-700">{f.blurb}</p>
              <div className="bg-slate-50 rounded p-2 text-xs">
                {f.latestFiling?.accession ? (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-600">Latest 13F-HR:</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {f.latestFiling.filedAt || "—"} ({daysAgo(f.latestFiling.filedAt)})
                      </span>
                    </div>
                    {f.latestFiling.period && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-600">For period ending:</span>
                        <span className="font-mono text-slate-700">{f.latestFiling.period}</span>
                      </div>
                    )}
                    {f.latestFiling.holdingsUrl && (
                      <a
                        href={f.latestFiling.holdingsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 hover:underline text-xs font-semibold"
                      >
                        Open holdings on SEC EDGAR <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </>
                ) : (
                  <span className="text-slate-400 italic">No 13F-HR found for CIK {f.cik}.</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
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
