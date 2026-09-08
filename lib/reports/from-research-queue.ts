import type { OptionsRecommendation, ResearchRow } from "@/lib/research/types"
import type { ReportPayload } from "./types"

/**
 * Shape one Research Queue ticker into a ReportPayload — the per-ticker report
 * behind the digest attachments and the queue-card Export menu (owner ask
 * 2026-09-07). One recommendation becomes a metric/value document: the written
 * read is the executive summary, and the computed numbers are the table.
 *
 * PURE and client-safe on purpose — no server imports. The queue card builds
 * this in the browser and posts it to /api/report/download, exactly as the
 * scanner's ExportMenu does; the digest cron calls it server-side. Either way
 * the numbers are the queue's own computed fields, never re-derived here.
 *
 * The P6-34 rule holds: a null input renders "—", never a stand-in. Values are
 * pre-formatted to strings because a metric/value table mixes currency, percent
 * and text down one column, which the per-column format hint cannot express.
 */

const STRATEGY_LABEL: Record<OptionsRecommendation["strategy"], string> = {
  CSP: "SELL PUTS (cash-secured)",
  CC: "SELL COVERED CALLS",
  LEAPS: "BUY LEAPS",
  LONG_CALL: "BUY CALLS",
  PMCC: "POOR-MAN'S COVERED CALL",
  NO_TRADE: "NO TRADE",
}

const money = (v: number | null): string => (v === null ? "—" : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const pct = (v: number | null): string => (v === null ? "—" : `${v}%`)
const plain = (v: number | null): string => (v === null ? "—" : String(v))

/** The one-line headline shown on the queue card, reused as the doc subtitle. */
function headline(r: OptionsRecommendation): string {
  if (r.strategy === "CSP" && r.cspStrikeLow !== null)
    return `Sell puts between $${r.cspStrikeLow} and $${r.cspStrikeHigh} · ~${r.cspDte} DTE`
  if (r.strategy === "LEAPS" && r.leapsStrike !== null)
    return `Buy a ${r.leapsDte}-day $${r.leapsStrike} LEAPS if it drops to ~$${r.leapsBuyBelowPrice}`
  if (r.strategy === "CC" && r.ccStrike !== null)
    return `Sell covered calls at ~$${r.ccStrike} (credit ~$${r.ccCredit})`
  return STRATEGY_LABEL[r.strategy]
}

/** A one-sentence summary for the digest body — the strategy plus its lead number. */
export function tickerSummaryLine(row: ResearchRow): string {
  const r = row.recommendation
  if (!r) return `${row.ticker}: not researched yet.`
  return `${row.ticker} — ${STRATEGY_LABEL[r.strategy]} (${r.rating}). ${headline(r)}.`
}

export function buildResearchReport(row: ResearchRow): ReportPayload | null {
  const r = row.recommendation
  if (!r) return null

  type Row = { metric: string; value: string }
  const rows: Row[] = [
    { metric: "Strategy", value: STRATEGY_LABEL[r.strategy] },
    { metric: "Recommendation", value: headline(r) },
    { metric: "Rating", value: `${r.rating} (fit ${r.fitScore}/5)` },
    { metric: "Underlying price", value: money(r.price) },
    { metric: "ATM implied volatility", value: pct(r.atmIvPct) },
    { metric: "IV rank", value: r.ivRank === null ? "—" : `${r.ivRank}${r.ivRankIsEstimate ? " (estimate)" : ""}` },
  ]

  if (r.strategy === "CSP") {
    rows.push(
      { metric: "Sell-put band", value: r.cspStrikeLow === null ? "—" : `$${r.cspStrikeLow} – $${r.cspStrikeHigh}` },
      { metric: "Days to expiry", value: plain(r.cspDte) },
      { metric: "Credit", value: money(r.cspCredit) },
      { metric: "Probability of profit", value: pct(r.cspProbabilityOfProfit) },
      { metric: "Breakeven", value: money(r.cspBreakeven) },
      { metric: "Annualized return", value: pct(r.cspAnnualizedReturnPct) },
      { metric: "Capital required", value: money(r.cspCapitalRequired) },
      { metric: "Pricing source", value: r.pricingSource === "chain" ? "live option chain" : r.pricingSource === "computed" ? "Black-Scholes estimate" : "—" },
      { metric: "Cushion to breakeven", value: r.cspCushionPct === null ? "—" : `${r.cspCushionPct}%` },
      {
        metric: "Underwater if it falls 20/30/40%",
        value: r.cspAssignmentShock
          ? `${r.cspAssignmentShock.drop20}% / ${r.cspAssignmentShock.drop30}% / ${r.cspAssignmentShock.drop40}%`
          : "—",
      },
      { metric: "Strike vs 200-DMA", value: r.cspStrikeBelow200dma === null ? "—" : r.cspStrikeBelow200dma ? "below (assignment into a downtrend)" : "above" },
    )
  } else if (r.strategy === "LEAPS" || r.strategy === "PMCC" || r.strategy === "LONG_CALL") {
    rows.push(
      { metric: "LEAPS strike", value: money(r.leapsStrike) },
      { metric: "LEAPS days to expiry", value: plain(r.leapsDte) },
      { metric: "Buy below price", value: money(r.leapsBuyBelowPrice) },
    )
  } else if (r.strategy === "CC") {
    rows.push(
      { metric: "Covered-call strike", value: money(r.ccStrike) },
      { metric: "Covered-call credit", value: money(r.ccCredit) },
    )
  }

  if (row.sharesHeld > 0) {
    rows.push({ metric: "Shares held", value: plain(row.sharesHeld) })
    if (row.costBasis !== null) {
      rows.push({ metric: "Cost basis", value: money(row.costBasis) })
      if (r.price !== null && row.costBasis > 0) {
        const pnl = ((r.price - row.costBasis) / row.costBasis) * 100
        rows.push({ metric: "Unrealized vs cost basis", value: `${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}%` })
      }
    }
  }

  const parts = [r.rationale.trim()]
  if (r.riskFlags.length > 0) parts.push(`Risks: ${r.riskFlags.join(" · ")}.`)
  if (r.managementPlan) parts.push(`Management: ${r.managementPlan}`)
  if (r.definedRiskAlternative) parts.push(`Defined-risk alternative: ${r.definedRiskAlternative}`)
  if (r.ratingBasis) parts.push(`Rating basis: ${r.ratingBasis}`)
  const executiveSummary = parts.join("\n\n").slice(0, 2000)

  return {
    title: `${row.ticker} — Options Research`,
    description: `${STRATEGY_LABEL[r.strategy]} — ${headline(r)}`.slice(0, 300),
    subtitle: r.asOf ? `As of ${r.asOf}` : undefined,
    executiveSummary,
    generatedAt: r.asOf ?? new Date().toISOString(),
    topN: 1,
    columns: [
      { key: "metric", label: "Metric", format: "text" },
      { key: "value", label: "Value", format: "text" },
    ],
    rows,
  }
}
