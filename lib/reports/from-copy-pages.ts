import type { ReportPayload, CellValue } from "./types"

/**
 * ReportPayload mappers for the COPY-tab "follow the smart money" pages
 * (owner ask 2026-08-27: an email report from any result-table page). Each
 * page decides its own ranking — the rows are handed over already ordered, and
 * the pipeline's top-N leads the email. Missing figures stay null → "—".
 *
 * These consume the SAME record shapes the components render, kept as loose
 * structural types so a field the page adds later does not break the mapper.
 */

const iso = () => new Date().toISOString()
const num = (v: unknown): CellValue => (typeof v === "number" && Number.isFinite(v) ? v : null)
const str = (v: unknown): CellValue => (typeof v === "string" && v ? v : null)

// ---- Congress trades ----------------------------------------------------

interface CongressTrade {
  member: string
  party: string
  chamber: string
  ticker: string
  type: string
  valueLabel: string
  tradeDate: string
  excessReturnPct: number | null
}

export function buildCongressReport(trades: CongressTrade[]): ReportPayload | null {
  if (!trades || trades.length === 0) return null
  const rows = trades.map((t) => ({
    ticker: str(t.ticker),
    member: str(t.member),
    party: str(t.party),
    chamber: str(t.chamber),
    action: str(t.type),
    value: str(t.valueLabel),
    tradeDate: str(t.tradeDate),
    excessReturn: num(t.excessReturnPct),
  }))
  const withXr = trades.filter((t) => typeof t.excessReturnPct === "number").length
  return {
    title: "Congressional Trades",
    description: "Recent disclosed trades by members of Congress.",
    executiveSummary:
      `${trades.length} disclosed ${trades.length === 1 ? "trade" : "trades"} in this view. ` +
      `${withXr} carry a measured excess return versus SPY over the holding window; the rest are too recent to score. ` +
      `Rows are in the order the page shows them — disclosure is lagged by law, so a trade date is when it happened, not when it was known.`,
    subtitle: `${trades.length} trades · ${withXr} with a measured excess return`,
    generatedAt: iso(),
    topN: 3,
    columns: [
      { key: "ticker", label: "Ticker", format: "text" },
      { key: "member", label: "Member", format: "text" },
      { key: "party", label: "Party", format: "text" },
      { key: "chamber", label: "Chamber", format: "text" },
      { key: "action", label: "Action", format: "text" },
      { key: "value", label: "Value", format: "text" },
      { key: "tradeDate", label: "Trade Date", format: "text" },
      { key: "excessReturn", label: "Excess vs SPY", format: "percent" },
    ],
    rows,
  }
}

// ---- Smart-money ETFs ---------------------------------------------------

interface SmartEtf {
  ticker: string
  name: string
  category: string
  changePct: number | null
  close: number | null
  asOf: string | null
}

export function buildSmartMoneyReport(etfs: SmartEtf[]): ReportPayload | null {
  if (!etfs || etfs.length === 0) return null
  const rows = etfs.map((e) => ({
    ticker: str(e.ticker),
    name: str(e.name),
    category: str(e.category),
    close: num(e.close),
    changePct: num(e.changePct),
    asOf: str(e.asOf),
  }))
  const live = etfs.filter((e) => typeof e.close === "number").length
  return {
    title: "Smart-Money ETFs",
    description: "ETFs that track Congress, hedge-fund and insider activity.",
    executiveSummary:
      `${etfs.length} smart-money ${etfs.length === 1 ? "ETF" : "ETFs"} across Congress, hedge-fund and insider ` +
      `strategies. ${live} have a live quote; the rest show "—" rather than a stale price. These are thematic ` +
      `vehicles, not the underlying trades — a way to follow the theme without picking the names yourself.`,
    subtitle: `${etfs.length} ETFs · ${live} with a live quote`,
    generatedAt: iso(),
    topN: 3,
    columns: [
      { key: "ticker", label: "Ticker", format: "text" },
      { key: "name", label: "Name", format: "text" },
      { key: "category", label: "Tracks", format: "text" },
      { key: "close", label: "Close", format: "currency" },
      { key: "changePct", label: "Change", format: "percent" },
      { key: "asOf", label: "As Of", format: "text" },
    ],
    rows,
  }
}

// ---- Top performers (congressional members ranked by excess return) -----

interface PerformerRow {
  member: string
  party: string
  chamber: string
  tradeCount: number
  avgExcessReturnPct: number
  bestTickerByXr: string
  bestXrPct: number
  weightedAvgXrPct: number | null
}

export function buildTopPerformersReport(members: PerformerRow[], windowDays?: number): ReportPayload | null {
  if (!members || members.length === 0) return null
  const rows = members.map((m) => ({
    member: str(m.member),
    party: str(m.party),
    chamber: str(m.chamber),
    trades: num(m.tradeCount),
    avgExcess: num(m.avgExcessReturnPct),
    weightedExcess: num(m.weightedAvgXrPct),
    bestTicker: str(m.bestTickerByXr),
    bestExcess: num(m.bestXrPct),
  }))
  const best = members[0]
  return {
    title: "Top Congressional Performers",
    description: "Members of Congress ranked by trade excess return versus SPY.",
    executiveSummary:
      `${members.length} ${members.length === 1 ? "member" : "members"} ranked by average excess return over ` +
      `${windowDays ? `the last ${windowDays} days` : "the ranking window"}. ${best ? `${best.member} leads at ` +
      `${best.avgExcessReturnPct.toFixed(1)}% average excess, best single name ${best.bestTickerByXr} at ` +
      `${best.bestXrPct.toFixed(1)}%.` : ""} Excess return is versus SPY over each trade's holding window; ` +
      `past disclosed performance is not a forecast.`,
    subtitle: windowDays ? `Ranking window: ${windowDays} days` : undefined,
    generatedAt: iso(),
    topN: 3,
    columns: [
      { key: "member", label: "Member", format: "text" },
      { key: "party", label: "Party", format: "text" },
      { key: "chamber", label: "Chamber", format: "text" },
      { key: "trades", label: "Trades", format: "number" },
      { key: "avgExcess", label: "Avg Excess", format: "percent" },
      { key: "weightedExcess", label: "Wtd Excess", format: "percent" },
      { key: "bestTicker", label: "Best Name", format: "text" },
      { key: "bestExcess", label: "Best Excess", format: "percent" },
    ],
    rows,
  }
}
