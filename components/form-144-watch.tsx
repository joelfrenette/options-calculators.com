"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink, AlertTriangle, FileText, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DataLoadGate } from "@/components/data-load-gate"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"

interface Filing {
  filer: string
  cik: string
  accession: string
  filedAt: string
  url: string
}
interface Resp {
  success: boolean
  source?: string
  count?: number
  filings: Filing[]
  message?: string
  generatedAt?: string
}

export function Form144Watch() {
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Resp | null>(null)
  const [filter, setFilter] = useState("")
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
      const res = await fetch("/api/form-144?count=60", { cache: "no-store" })
      const json = (await res.json()) as Resp
      setData(json)
    } catch (e) {
      console.error("[v0] Form 144 watch error:", e)
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
        title="Load Form 144 Watch?"
        description="Insiders file SEC Form 144 when they INTEND to sell restricted/control stock — an early warning up to 90 days before the actual sale. Free data via SEC EDGAR."
        onConfirm={() => setLoaded(true)}
      />
    )
  }

  const visible = (data?.filings ?? []).filter((f) =>
    !filter ? true : f.filer.toLowerCase().includes(filter.toLowerCase()),
  )

  return (
    <TooltipProvider delayDuration={250}>
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-amber-600" />
            Form 144 Watch
            <InfoTooltip content="Form 144 is an SEC filing an insider files when they INTEND to sell restricted or control stock — usually 1-90 days before the actual sale. Most are routine diversification; large or unusually-timed 144s near earnings can be a warning." />
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Insider <strong>planned-sale</strong> filings — the early warning before stock actually hits the tape.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
          <RefreshButton onClick={fetchData} isLoading={loading} loadingText="Refreshing..." />
        </div>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          <strong>How to read this:</strong> Form 144 is filed BEFORE the sale, giving up to 90 days&apos; lead time.
          Most insiders sell to diversify or fund lifestyle, not because they expect a drop — but unusual clusters or
          oversized 144s right before earnings can be meaningful. Always cross-check with Form 4 (actual completed
          sales) and recent insider buying.
        </span>
      </div>

      {data?.message && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{data.message}</div>
      )}

      <Card className="bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">
                {visible.length} {visible.length === 1 ? "filing" : "filings"}{filter && ` matching "${filter}"`}
              </CardTitle>
              <CardDescription className="text-xs">
                Sorted newest first. Click any row to open the full filing on SEC EDGAR.
              </CardDescription>
            </div>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by filer name…"
              className="text-xs px-2 py-1 border border-slate-300 rounded bg-white w-56"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Filed</th>
                <th className="px-3 py-2 text-left font-semibold">Filer</th>
                <th className="px-3 py-2 text-left font-semibold">CIK</th>
                <th className="px-3 py-2 text-left font-semibold">Accession</th>
                <th className="px-3 py-2 text-left font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-400 text-sm">
                    No filings match this filter.
                  </td>
                </tr>
              )}
              {visible.map((f, i) => (
                <tr key={`${f.cik}-${f.accession}-${i}`} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-700 font-mono text-xs">{f.filedAt.replace("T", " ")}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{f.filer}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{f.cik}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{f.accession || "—"}</td>
                  <td className="px-3 py-2">
                    {f.url && (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                      >
                        Open on EDGAR <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </td>
                </tr>
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
