"use client"

import { useCallback, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Landmark, Megaphone, Info, AlertTriangle, Search } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"

interface ContractRow {
  date: string
  agency: string
  description: string
  amountUsd: number
}

interface LobbyingRow {
  date: string
  client: string
  registrant: string
  issue: string
  specificIssue: string
  amountUsd: number
}

interface Section<T> {
  count: number
  totalUsd: number
  oldestSeen: string | null
  windowTruncated: boolean
  rows: T[]
}

interface Resp {
  success: boolean
  source?: string
  ticker?: string
  windowDays?: number
  scored?: boolean
  scoringNote?: string
  contracts?: Section<ContractRow> | null
  lobbying?: Section<LobbyingRow> | null
  contractsError?: string | null
  lobbyingError?: string | null
  error?: string
  message?: string
}

const WINDOWS = [
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
  { days: 1095, label: "3 years" },
]

function usd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export function FederalMoneyTrail() {
  const [ticker, setTicker] = useState("")
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [days, setDays] = useState(365)
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

  const fetchData = useCallback(
    async (sym: string, windowDays: number) => {
      if (!sym) return
      setLoading(true)
      try {
        const res = await fetch(`/api/federal-money?ticker=${encodeURIComponent(sym)}&days=${windowDays}`, {
          cache: "no-store",
        })
        const json = (await res.json()) as Resp
        setData(json)
        setSubmitted(sym)
      } catch (e) {
        console.error("[v0] Federal money trail error:", e)
        setData({ success: false, message: "Could not reach the federal-money feed." })
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const sym = ticker.trim().toUpperCase()
    if (sym) void fetchData(sym, days)
  }

  const onWindowChange = (nextDays: number) => {
    setDays(nextDays)
    if (submitted) void fetchData(submitted, nextDays)
  }

  const contracts = data?.contracts ?? null
  const lobbying = data?.lobbying ?? null

  return (
    <TooltipProvider delayDuration={250}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Landmark className="h-6 w-6 text-emerald-600" />
              Federal Money Trail
              <InfoTooltip content="Two sides of the same relationship: money the federal government pays a company (contract awards), and money the company spends trying to influence the government (lobbying filings). Both are public record, and both are reported after the fact." />
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Government contract awards and lobbying spend for any ticker — context on how much of a company&apos;s
              business depends on Washington.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
            {submitted && (
              <RefreshButton onClick={() => fetchData(submitted, days)} isLoading={loading} loadingText="Refreshing..." />
            )}
          </div>
        </div>

        {/* Lag warning — stated before any number, because it governs how every
            number below may be used. */}
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <strong>Backward-looking by nature.</strong> Contract awards post weeks after they are signed and lobbying is
            filed quarterly, so this data describes what already happened. It is never used in the Crash Confidence
            Index and should not be read as an early warning.
          </span>
        </div>

        {/* Ticker form */}
        <Card className="bg-white">
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <label htmlFor="fmt-ticker" className="block text-xs font-medium text-slate-700 mb-1">
                  Ticker symbol
                </label>
                <Input
                  id="fmt-ticker"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="LMT, RTX, BA, NOC…"
                  className="font-mono uppercase"
                  autoComplete="off"
                />
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-700 mb-1">Look back</span>
                <div className="flex gap-1">
                  {WINDOWS.map((w) => (
                    <Button
                      key={w.days}
                      type="button"
                      variant={days === w.days ? "default" : "outline"}
                      size="sm"
                      onClick={() => onWindowChange(w.days)}
                    >
                      {w.label}
                    </Button>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={loading || !ticker.trim()}>
                <Search className="h-4 w-4 mr-1" />
                {loading ? "Looking up…" : "Look up"}
              </Button>
            </form>
            <p className="text-xs text-slate-500 mt-3">
              Defense, aerospace, health and infrastructure names show the most here. A company with no federal business
              returns nothing — which is itself an answer.
            </p>
          </CardContent>
        </Card>

        {data && !data.success && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {data.message || data.error || "The federal-money feed could not be read."}
          </div>
        )}

        {data?.success && submitted && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-slate-600" />
                    Government contracts
                    <InfoTooltip content="Awards published by federal agencies. The total is the sum of the awards actually returned inside your chosen window — it is not an estimate of the company's total federal revenue." />
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {contracts
                      ? `${contracts.count} award${contracts.count === 1 ? "" : "s"} in the last ${data.windowDays} days`
                      : "Feed unavailable"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {contracts ? (
                    <div className="text-3xl font-bold text-slate-900 tabular-nums">
                      {contracts.count > 0 ? usd(contracts.totalUsd) : "—"}
                    </div>
                  ) : (
                    <p className="text-sm text-red-800">{data.contractsError}</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-slate-600" />
                    Lobbying spend
                    <InfoTooltip content="Quarterly disclosures filed under the Lobbying Disclosure Act. The registrant is the firm doing the lobbying; the client is who paid for it." />
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {lobbying
                      ? `${lobbying.count} filing${lobbying.count === 1 ? "" : "s"} in the last ${data.windowDays} days`
                      : "Feed unavailable"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {lobbying ? (
                    <div className="text-3xl font-bold text-slate-900 tabular-nums">
                      {lobbying.count > 0 ? usd(lobbying.totalUsd) : "—"}
                    </div>
                  ) : (
                    <p className="text-sm text-red-800">{data.lobbyingError}</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {contracts?.count === 0 && lobbying?.count === 0 && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                No federal contract awards or lobbying filings found for{" "}
                <span className="font-mono font-semibold">{submitted}</span> in this window. Most companies have none —
                this is a normal result, not a data failure.
              </div>
            )}

            {/* Contract detail */}
            {contracts && contracts.rows.length > 0 && (
              <Card className="bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Contract awards</CardTitle>
                  <CardDescription className="text-xs">
                    Newest first{contracts.rows.length < contracts.count && `, showing ${contracts.rows.length} of ${contracts.count}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b">
                        <th className="pb-2 pr-4 font-medium">Date</th>
                        <th className="pb-2 pr-4 font-medium">Agency</th>
                        <th className="pb-2 pr-4 font-medium">Description</th>
                        <th className="pb-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.rows.map((r, i) => (
                        <tr key={`${r.date}-${i}`} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="py-2 pr-4 font-mono text-xs text-slate-600 whitespace-nowrap">{r.date}</td>
                          <td className="py-2 pr-4 text-slate-800">{r.agency}</td>
                          <td className="py-2 pr-4 text-slate-600 text-xs max-w-md">{r.description}</td>
                          <td className="py-2 text-right font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                            {usd(r.amountUsd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Lobbying detail */}
            {lobbying && lobbying.rows.length > 0 && (
              <Card className="bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Lobbying filings</CardTitle>
                  <CardDescription className="text-xs">
                    Newest first{lobbying.rows.length < lobbying.count && `, showing ${lobbying.rows.length} of ${lobbying.count}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b">
                        <th className="pb-2 pr-4 font-medium">Date</th>
                        <th className="pb-2 pr-4 font-medium">Lobbying firm</th>
                        <th className="pb-2 pr-4 font-medium">Issue</th>
                        <th className="pb-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lobbying.rows.map((r, i) => (
                        <tr key={`${r.date}-${i}`} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="py-2 pr-4 font-mono text-xs text-slate-600 whitespace-nowrap">{r.date}</td>
                          <td className="py-2 pr-4 text-slate-800">{r.registrant}</td>
                          <td className="py-2 pr-4 text-slate-600 text-xs max-w-md">
                            {r.issue}
                            {r.specificIssue && r.specificIssue !== "—" && (
                              <span className="block text-slate-400">{r.specificIssue}</span>
                            )}
                          </td>
                          <td className="py-2 text-right font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                            {usd(r.amountUsd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Coverage honesty */}
            {(contracts?.windowTruncated || lobbying?.windowTruncated) && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <strong>Partial history.</strong> The upstream feed returns a fixed number of the most recent records
                across all companies, so records older than{" "}
                {contracts?.oldestSeen && (
                  <>
                    <span className="font-mono">{contracts.oldestSeen}</span> (contracts)
                  </>
                )}
                {contracts?.oldestSeen && lobbying?.oldestSeen && " and "}
                {lobbying?.oldestSeen && (
                  <>
                    <span className="font-mono">{lobbying.oldestSeen}</span> (lobbying)
                  </>
                )}{" "}
                may exist but were not visible to this lookup. Totals cover what was returned, nothing more.
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700 border-slate-300">
                Display only — not scored in CCPI
              </Badge>
              {data.source && <span className="text-[10px] text-slate-400">Source: {data.source}</span>}
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  )
}
