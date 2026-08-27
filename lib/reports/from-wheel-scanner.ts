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

  const num = (v: number | null | undefined): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null
  const dteOf = (s: QualifyingStock): number | null => num(s.optionDaysToExpiry ?? s.daysToExpiry)
  const premOf = (s: QualifyingStock): number | null => num(s.optionPremium ?? s.premium)

  // Owner order (2026-08-27): grouped by EXPIRY, ALL lower DTE first, then the
  // higher DTE after, and within each expiry the HIGHEST PREMIUM leads. An
  // unknown DTE or premium sorts to the end of its comparison so it never
  // displaces a real reading. Synthesized rows are flagged by the "source"
  // column, not pushed down by sort — the honesty is in the column, not the
  // order the owner chose.
  const sorted = [...results].sort((a, b) => {
    const ad = dteOf(a),
      bd = dteOf(b)
    if (ad !== bd) return (ad ?? Infinity) - (bd ?? Infinity)
    return (premOf(b) ?? -Infinity) - (premOf(a) ?? -Infinity)
  })

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

  // "Strongest" is the highest YIELD among live quotes — computed here rather
  // than taken from row[0], because the table is now ordered by expiry, not
  // yield, so the first row is no longer the richest.
  const real = sorted.filter((s) => s.priceSource !== "synthesized")
  const bestRow = real.reduce<QualifyingStock | null>((top, s) => {
    const y = yieldOf(s)
    if (y === null) return top
    return top === null || y > (yieldOf(top) ?? -Infinity) ? s : top
  }, null)
  const best = bestRow ? yieldOf(bestRow) : null
  const bestLine =
    bestRow && best !== null
      ? `The strongest live-quoted opportunity is ${bestRow.ticker} at a ${best.toFixed(1)}% annualized yield on a $${(bestRow.optionStrike ?? bestRow.putStrike).toFixed(0)} put.`
      : "No row carried a live option quote; every yield shown is estimated from a 35% IV assumption."

  const summary =
    `This cash-secured put scan qualified ${results.length} ${results.length === 1 ? "stock" : "stocks"} ` +
    `against your fundamental and technical filters. ${bestLine} ` +
    `Rows are grouped by expiry — all the lower days-to-expiry first, the higher ones after — and within each ` +
    `expiry the highest premium leads. An estimated yield looks identical to a measured one, so treat the ` +
    `"source" column as part of the number. Figures are point-in-time.`

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
