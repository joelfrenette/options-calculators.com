"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  TrendingUp,
  Activity,
  Shield,
  Database,
  Gauge,
} from "lucide-react"
// P6-13. This component was 1,636 lines, roughly 900 of them pure data-shaping
// with no JSX in it: the four pillar builders, the composite validation, the
// data-quality card and the downloadable report. All of that is now under
// `lib/ccpi/audit/`, where it is import-light `.ts` and can be asserted —
// P7-52's lesson, arriving again. What is left here is state, one fetch, the
// badge vocabulary, the download plumbing and the render.
import { type IndicatorDetail, type PillarAudit, type Tier, EM_DASH, fx, raw } from "@/lib/ccpi/audit/format"
import { buildAuditStructure } from "@/lib/ccpi/audit/structure"
import { buildAuditReport } from "@/lib/ccpi/audit/report"

export function CcpiAuditAdmin() {
  const [loading, setLoading] = useState(false)
  const [auditData, setAuditData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAudit()
  }, [])

  const fetchAudit = async () => {
    setLoading(true)
    setError(null)
    try {
      const ccpiRes = await fetch("/api/ccpi", { cache: "no-store" })
      const ccpi = await ccpiRes.json()

      if (!ccpiRes.ok) {
        // /api/ccpi returns 503 with a provenance block when every pillar is
        // unscorable, and 500 on an internal error. Surface it rather than
        // spinning forever.
        throw new Error(ccpi?.error ? `HTTP ${ccpiRes.status} — ${ccpi.error}` : `HTTP ${ccpiRes.status}`)
      }
      if (!ccpi?.pillars || !ccpi?.indicators) {
        throw new Error("The CCPI payload has no `pillars`/`indicators` block — nothing to audit.")
      }

      setAuditData(buildAuditStructure(ccpi))
    } catch (e) {
      console.error("Failed to fetch CCPI audit:", e)
      setAuditData(null)
      setError(e instanceof Error ? e.message : "Failed to load the CCPI audit.")
    } finally {
      setLoading(false)
    }
  }


  // Badge vocabulary now matches the engine's tiers exactly. The old
  // "aiFallback"/"failed" cases came from /api/data-source-status, which never
  // measured anything; "ai-estimate" and "baseline" are what scoring.ts emits.
  const getStatusBadge = (status: Tier) => {
    switch (status) {
      case "live":
        return <Badge className="bg-green-500 text-white">🟢 Live</Badge>
      // P6-34: an AI estimate no longer scores, so the badge has to say so.
      // "AI estimate" alone read as a weaker source; it is now an excluded one.
      case "ai-estimate":
        return <Badge className="bg-yellow-500 text-white">🟡 AI estimate — not scored</Badge>
      case "baseline":
        return <Badge className="bg-orange-500 text-white">🟠 Baseline (not scored)</Badge>
      default:
        return <Badge className="bg-slate-400 text-gray-900">❓ Unknown</Badge>
    }
  }

  const exportReport = () => {
    if (!auditData) return

    const blob = new Blob([buildAuditReport(auditData)], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ccpi-audit-detailed-${new Date().toISOString().split("T")[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }


  // A real error state. The old code had only the spinner, so any thrown
  // TypeError left the tab loading forever with nothing to diagnose (A-8).
  if (error) {
    return (
      <div className="bg-white rounded-lg p-6 border border-red-300">
        <div className="flex items-start gap-3">
          <XCircle className="h-6 w-6 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="font-bold text-red-900">CCPI audit could not be loaded</h3>
            <p className="text-sm text-red-800 mt-1">{error}</p>
            <p className="text-xs text-red-700 mt-2">
              Nothing is shown rather than a partially-invented audit. Check the CCPI route&apos;s logs and the provider
              keys it depends on.
            </p>
            <Button onClick={fetchAudit} disabled={loading} size="sm" className="mt-3">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!auditData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600">Loading CCPI Audit...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg p-6 border">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            CCPI Audit - Complete Transparency
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Formulas, thresholds, provenance and validation for the{" "}
            {auditData.canaries.total === null ? EM_DASH : auditData.canaries.total} scored indicators across{" "}
            {auditData.pillars.length} pillars. Values the engine could not source render {EM_DASH}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAudit} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={exportReport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Data Quality — built from ccpi.certainty + ccpi.provenance. The
          reworked certainty number was emitted by the route and rendered
          nowhere until now (A-8). */}
      <Card className="bg-white border-slate-300">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Gauge className="h-6 w-6 text-slate-700" />
            Data Quality
          </CardTitle>
          <CardDescription>
            What this score is actually built on. Certainty is pure data provenance — the share of scored weight backed
            by live data, plus half credit for AI estimates. Canary counts do not raise it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!auditData.dataQuality.hasProvenance ? (
            <p className="text-sm text-slate-600">
              This CCPI payload carried no <code>provenance</code> block, so no per-indicator tiers can be shown.
            </p>
          ) : null}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-4 rounded-lg border bg-slate-50">
              <div className="text-3xl font-bold text-slate-800">
                {auditData.dataQuality.certainty === null ? EM_DASH : `${auditData.dataQuality.certainty}%`}
              </div>
              <div className="text-xs text-slate-600">Certainty</div>
            </div>
            <div className="p-4 rounded-lg border bg-green-50">
              <div className="text-3xl font-bold text-green-700">{auditData.dataQuality.tierCounts.live}</div>
              <div className="text-xs text-green-700">Live</div>
            </div>
            <div className="p-4 rounded-lg border bg-yellow-50">
              <div className="text-3xl font-bold text-yellow-700">{auditData.dataQuality.tierCounts.aiEstimate}</div>
              <div className="text-xs text-yellow-700">AI estimate</div>
            </div>
            <div className="p-4 rounded-lg border bg-orange-50">
              <div className="text-3xl font-bold text-orange-700">{auditData.dataQuality.tierCounts.baseline}</div>
              <div className="text-xs text-orange-700">Baseline (excluded)</div>
            </div>
            <div className="p-4 rounded-lg border bg-slate-50">
              <div className="text-3xl font-bold text-slate-600">{auditData.dataQuality.tierCounts.unknown}</div>
              <div className="text-xs text-slate-600">Unknown</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {auditData.dataQuality.pillars.map((p: any) => (
              <div key={p.key} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-900">{p.name}</span>
                  <span className="text-lg font-bold text-slate-700">{p.score === null ? EM_DASH : `${p.score}/100`}</span>
                </div>
                <p className="text-xs text-slate-600">
                  Scored weight <span className="font-mono">{raw(p.scoredMax)}</span>/100 — live{" "}
                  <span className="font-mono">{raw(p.liveMax)}</span>, AI <span className="font-mono">{raw(p.aiMax)}</span>
                </p>
                {p.belowMinimum && (
                  <p className="text-xs text-orange-700 mt-1">
                    Below the {auditData.dataQuality.minScoredMax}-point minimum — this pillar reports no score and is
                    dropped from the composite, which renormalizes over the rest.
                  </p>
                )}
                {p.excluded.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">Excluded from scoring: {p.excluded.join(", ")}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 1: CCPI Index Calculation */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            1. CCPI Index Calculation
          </CardTitle>
          <CardDescription>Overall crash prediction score formula and validation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white p-6 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Current CCPI Score</h3>
              <div className="text-4xl font-bold text-blue-600">{raw(auditData.ccpi.finalCCPI)}/100</div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Formula</h4>
                <code className="block bg-gray-50 p-3 rounded text-sm">{auditData.ccpi.formula}</code>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Executive Summary</h4>
                <p className="text-sm text-gray-700">{auditData.ccpi.executiveSummary}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Pillar Weights</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(auditData.ccpi.weights).map(([key, value]: [string, any]) => (
                    <div key={key} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                      <span className="capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                      <span className="font-bold">{value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* The badge colour now follows the actual result. Previously the
                  card was hardcoded green regardless of what validateCCPI said. */}
              <div
                className={`p-4 border rounded ${
                  auditData.ccpi.validation.ok === true
                    ? "bg-green-50 border-green-200"
                    : auditData.ccpi.validation.ok === false
                      ? "bg-red-50 border-red-200"
                      : "bg-slate-50 border-slate-200"
                }`}
              >
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  {auditData.ccpi.validation.ok === true ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : auditData.ccpi.validation.ok === false ? (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-gray-500" />
                  )}
                  Validation
                </h4>
                <p
                  className={`text-sm ${
                    auditData.ccpi.validation.ok === true
                      ? "text-green-800"
                      : auditData.ccpi.validation.ok === false
                        ? "text-red-800"
                        : "text-slate-700"
                  }`}
                >
                  {auditData.ccpi.validation.text}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            2. Crash Amplifier "Bonus" System
          </CardTitle>
          <CardDescription>Extreme condition multipliers that amplify crash risk beyond base score</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white p-6 rounded-lg border border-red-200">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Base CCPI</div>
                <div className="text-3xl font-bold text-blue-600">{raw(auditData.crashAmplifier.baseScore)}</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Amplifier Bonus</div>
                <div className="text-3xl font-bold text-orange-600">{auditData.crashAmplifier.totalBonus === null ? EM_DASH : `+${auditData.crashAmplifier.totalBonus}`}</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Final CCPI</div>
                <div className="text-3xl font-bold text-red-600">{raw(auditData.crashAmplifier.finalScore)}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Formula</h4>
                <code className="block bg-gray-50 p-3 rounded text-sm">{auditData.crashAmplifier.formula}</code>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Executive Summary</h4>
                <p className="text-sm text-gray-700">{auditData.crashAmplifier.executiveSummary}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Crash Amplifier Triggers</h4>
                <div className="space-y-2">
                  {auditData.crashAmplifier.triggers.map((trigger: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded">
                      <div className="mt-0.5">
                        {auditData.crashAmplifier.bonuses.find((b: any) =>
                          b.reason.includes(trigger.condition.split(" ")[0]),
                        ) ? (
                          <CheckCircle2 className="h-5 w-5 text-red-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-gray-900">{trigger.condition}</div>
                        <div className="text-sm text-red-700">{trigger.bonus}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {auditData.crashAmplifier.bonuses.length > 0 && (
                <div className="p-4 bg-red-100 border border-red-300 rounded">
                  <h4 className="font-semibold mb-2 text-red-900">🔴 Active Amplifiers</h4>
                  <div className="space-y-1">
                    {auditData.crashAmplifier.bonuses.map((bonus: any, idx: number) => (
                      <div key={idx} className="text-sm text-red-800">
                        • {bonus.reason}: <span className="font-bold">+{bonus.points} points</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
            3. Canary Warning System
          </CardTitle>
          <CardDescription>Early warning signals and threshold logic</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white p-6 rounded-lg border border-yellow-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Active Warnings</h3>
              <div className="text-4xl font-bold text-yellow-600">
                {raw(auditData.canaries.active)}/{raw(auditData.canaries.total)}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Formula</h4>
                <code className="block bg-gray-50 p-3 rounded text-sm">{auditData.canaries.formula}</code>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Executive Summary</h4>
                <p className="text-sm text-gray-700">{auditData.canaries.executiveSummary}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Severity Levels</h4>
                <div className="space-y-2">
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <span className="font-semibold text-red-900">🔴 High Severity: </span>
                    <span className="text-sm text-red-800">{auditData.canaries.severityLevels.high}</span>
                  </div>
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <span className="font-semibold text-yellow-900">🟡 Medium Severity: </span>
                    <span className="text-sm text-yellow-800">{auditData.canaries.severityLevels.medium}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Activity className="h-6 w-6 text-purple-600" />
            4. Four Pillars - Detailed Breakdown
          </CardTitle>
          <CardDescription>Complete formulas, indicators, data sources, and thresholds for all pillars</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="space-y-4">
            {auditData.pillars.map((pillar: PillarAudit, pillarIdx: number) => (
              <AccordionItem
                key={pillarIdx}
                value={`pillar-${pillarIdx}`}
                className="border rounded-lg overflow-hidden bg-white"
              >
                <AccordionTrigger className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="text-left">
                      <h3 className="font-bold text-lg">{pillar.name}</h3>
                      <p className="text-sm text-gray-600">
                        Weight: {pillar.weight}% | {pillar.indicators.length} indicators | scored weight{" "}
                        {raw(pillar.scoredMax)}/100 (live {raw(pillar.liveMax)}, AI {raw(pillar.aiMax)})
                      </p>
                    </div>
                    <div className="text-2xl font-bold text-purple-600">{raw(pillar.score)}/100</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  <div className="space-y-6">
                    {/* Pillar Summary */}
                    <div className="bg-purple-50 p-5 rounded-lg border border-purple-200">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold mb-2">Formula</h4>
                          <code className="block bg-white p-3 rounded text-xs">{pillar.formula}</code>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2">Calculation</h4>
                          <p className="text-sm text-gray-700">{pillar.calculation}</p>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2">Executive Summary</h4>
                          <p className="text-sm text-gray-700">{pillar.executiveSummary}</p>
                        </div>

                        <div className="p-3 bg-white border border-purple-300 rounded">
                          <p className="text-sm font-semibold">{pillar.validation}</p>
                        </div>
                      </div>
                    </div>

                    {/* Indicators */}
                    <div>
                      <h4 className="font-semibold mb-4 flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Indicators ({pillar.indicators.length})
                      </h4>
                      <Accordion type="single" collapsible className="space-y-3">
                        {pillar.indicators.map((indicator: IndicatorDetail, indIdx: number) => (
                          <AccordionItem
                            key={indIdx}
                            value={`indicator-${pillarIdx}-${indIdx}`}
                            className="border rounded-lg"
                          >
                            <AccordionTrigger className="px-4 py-3 hover:bg-gray-50">
                              <div className="flex items-center justify-between w-full pr-4">
                                <div className="text-left">
                                  <span className="font-semibold">{indicator.name}</span>
                                  <div className="flex items-center gap-2 mt-1">
                                    {getStatusBadge(indicator.dataSources.status)}
                                    <span className="text-xs text-gray-600">{String(indicator.currentValue)}</span>
                                  </div>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                              <div className="space-y-4">
                                <div>
                                  <h5 className="font-semibold text-sm mb-1">Technical Formula</h5>
                                  <code className="block bg-gray-50 p-2 rounded text-xs">{indicator.formula}</code>
                                </div>

                                <div>
                                  <h5 className="font-semibold text-sm mb-1">Executive Summary</h5>
                                  <p className="text-sm text-gray-700">{indicator.executiveSummary}</p>
                                </div>

                                <div>
                                  <h5 className="font-semibold text-sm mb-2">Value Ranges</h5>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-green-600">🟢 Safe:</span>
                                      <span className="text-gray-700">{indicator.ranges.safe}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-yellow-600">🟡 Warning:</span>
                                      <span className="text-gray-700">{indicator.ranges.warning}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-red-600">🔴 Danger:</span>
                                      <span className="text-gray-700">{indicator.ranges.danger}</span>
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <h5 className="font-semibold text-sm mb-2">Data Sources</h5>
                                  <div className="bg-gray-50 p-3 rounded space-y-2">
                                    <div className="text-sm">
                                      <span className="font-semibold">Primary:</span> {indicator.dataSources.primary}
                                    </div>
                                    <div className="text-sm">
                                      <span className="font-semibold">Current:</span>{" "}
                                      {indicator.dataSources.currentSource}{" "}
                                      {getStatusBadge(indicator.dataSources.status)}
                                    </div>
                                    <div className="text-sm">
                                      <span className="font-semibold">Fallback Chain:</span>
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {indicator.dataSources.fallbackChain.map((source: string, idx: number) => (
                                          <Badge key={idx} variant="outline" className="text-xs">
                                            {source}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <h5 className="font-semibold text-sm mb-2">Canary Thresholds</h5>
                                  <div className="space-y-1">
                                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                                      <span className="font-semibold">🟡 Medium Risk:</span>{" "}
                                      {indicator.canaryThresholds.medium}
                                    </div>
                                    <div className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                                      <span className="font-semibold">🔴 High Risk:</span>{" "}
                                      {indicator.canaryThresholds.high}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}
