import type { QualifyingStock } from "@/components/scanner/types"
import type { ReportPayload } from "./types"

/**
 * Shape a wheel/CSP scan's qualifying stocks into a ReportPayload — the first
 * page wired to the report-email pipeline (owner ask 2026-08-27).
 *
 * Ranking is by annualized yield DESCENDING, so the email's top 3 are the
 * richest opportunities the scan found — but only among rows with a REAL
 * quote. A synthesized premium (the 35% IV fallback, priceSource
 * "synthesized") is excluded from the ranking's leading edge the way the tab's
 * own sort warns about it: it looks identical to a measured yield and must not
 * top the list silently. Synthesized rows still appear, lower down, with their
 * source named in a column.
 */
export function buildWheelReport(results: QualifyingStock[]): ReportPayload | null {
  if (!results || results.length === 0) return null

  const yieldOf = (s: QualifyingStock): number | null => {
    const y = s.optionAnnualizedYield ?? s.annualizedYield
    return typeof y === "number" && Number.isFinite(y) ? y : null
  }

  // Real quotes first (ranked by yield), synthesized/unknown after.
  const sorted = [...results].sort((a, b) => {
    const aSynth = a.priceSource === "synthesized" ? 1 : 0
    const bSynth = b.priceSource === "synthesized" ? 1 : 0
    if (aSynth !== bSynth) return aSynth - bSynth
    return (yieldOf(b) ?? -Infinity) - (yieldOf(a) ?? -Infinity)
  })

  const num = (v: number | null | undefined): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null

  const rows = sorted.map((s) => ({
    ticker: s.ticker,
    price: num(s.currentPrice),
    strike: num(s.optionStrike ?? s.putStrike),
    premium: num(s.optionPremium ?? s.premium),
    annualizedYield: yieldOf(s),
    delta: num(s.optionDelta ?? s.delta),
    dte: num(s.optionDaysToExpiry ?? s.daysToExpiry),
    source: s.priceSource === "synthesized" ? "synthesized (est.)" : "live quote",
  }))

  const real = sorted.filter((s) => s.priceSource !== "synthesized")
  const best = real.length ? yieldOf(real[0]) : null
  const bestLine =
    real.length && best !== null
      ? `The strongest live-quoted opportunity is ${real[0].ticker} at a ${best.toFixed(1)}% annualized yield on a $${(real[0].optionStrike ?? real[0].putStrike).toFixed(0)} put.`
      : "No row carried a live option quote; every yield shown is estimated from a 35% IV assumption."

  const summary =
    `This cash-secured put scan qualified ${results.length} ${results.length === 1 ? "stock" : "stocks"} ` +
    `against your fundamental and technical filters. ${bestLine} ` +
    `Rows are ranked by annualized yield, with live quotes ahead of estimated ones — an estimated yield looks ` +
    `identical to a measured one, so treat the "source" column as part of the number. Figures are point-in-time.`

  return {
    title: "Cash-Secured Put Scan",
    description: "Qualifying cash-secured put candidates from the strategy scanner.",
    executiveSummary: summary,
    subtitle: `${results.length} qualifying · ${real.length} with a live quote`,
    generatedAt: new Date().toISOString(),
    topN: 3,
    columns: [
      { key: "ticker", label: "Ticker", format: "text" },
      { key: "price", label: "Price", format: "currency" },
      { key: "strike", label: "Put Strike", format: "currency" },
      { key: "premium", label: "Premium", format: "currency" },
      { key: "annualizedYield", label: "Annualized Yield", format: "percent" },
      { key: "delta", label: "Delta", format: "number" },
      { key: "dte", label: "DTE", format: "number" },
      { key: "source", label: "Source", format: "text" },
    ],
    rows,
  }
}
