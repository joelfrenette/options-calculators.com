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

/** Copy of an array sorted by a numeric key, DESC, with null/undefined last. */
function byDesc<T>(arr: T[], key: (t: T) => number | null | undefined): T[] {
  return [...arr].sort((a, b) => {
    const av = key(a),
      bv = key(b)
    const an = typeof av === "number" && Number.isFinite(av)
    const bn = typeof bv === "number" && Number.isFinite(bv)
    if (an && bn) return (bv as number) - (av as number)
    if (an) return -1
    if (bn) return 1
    return 0
  })
}

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
  const rows = byDesc(trades, (t) => t.excessReturnPct).map((t) => ({
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
      `Rows lead with the largest measured excess return versus SPY; trades too recent to score follow. Disclosure is lagged by law, so a trade date is when it happened, not when it was known.`,
    subtitle: `${trades.length} trades · ${withXr} with a measured excess return`,
    generatedAt: iso(),
    topN: 3,
    highlightKeys: ["excessReturn", "member", "action", "value"],
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
  const rows = byDesc(etfs, (e) => e.changePct).map((e) => ({
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
    highlightKeys: ["changePct", "close", "category"],
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
    highlightKeys: ["avgExcess", "trades", "bestTicker", "bestExcess"],
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

// ---- Insider clusters (multiple insiders buying the same name) ----------

interface InsiderCluster {
  ticker: string
  buyerCount: number
  totalBuys: number
  totalDollarValue: number
}

export function buildInsiderClustersReport(clusters: InsiderCluster[], windowDays?: number): ReportPayload | null {
  if (!clusters || clusters.length === 0) return null
  const rows = byDesc(clusters, (c) => c.totalDollarValue).map((c) => ({
    ticker: str(c.ticker),
    buyers: num(c.buyerCount),
    totalBuys: num(c.totalBuys),
    dollarValue: num(c.totalDollarValue),
  }))
  const total = clusters.reduce((s, c) => s + (c.totalDollarValue || 0), 0)
  return {
    title: "Insider Buying Clusters",
    description: "Companies where multiple insiders bought within the same window.",
    executiveSummary:
      `${clusters.length} ${clusters.length === 1 ? "company" : "companies"} saw clustered insider buying` +
      `${windowDays ? ` over the last ${windowDays} days` : ""}, totalling ` +
      `$${(total / 1_000_000).toFixed(1)}M. A cluster — several insiders buying the same name at once — is a ` +
      `stronger signal than a lone purchase, though insiders buy for many reasons and are sometimes early.`,
    subtitle: windowDays ? `Window: ${windowDays} days` : undefined,
    generatedAt: iso(),
    topN: 3,
    highlightKeys: ["dollarValue", "buyers", "totalBuys"],
    columns: [
      { key: "ticker", label: "Ticker", format: "text" },
      { key: "buyers", label: "Insiders Buying", format: "number" },
      { key: "totalBuys", label: "Total Buys", format: "number" },
      { key: "dollarValue", label: "Total $ Value", format: "currency" },
    ],
    rows,
  }
}

// ---- Insider transactions (individual Form 4 rows; string-formatted) -----

interface InsiderTrade {
  ticker: string
  owner: string
  role: string
  type: string
  shares: string
  price: string
  value: string
  date: string
}

export function buildInsiderTradesReport(trades: InsiderTrade[]): ReportPayload | null {
  if (!trades || trades.length === 0) return null
  const rows = trades.map((t) => ({
    ticker: str(t.ticker),
    owner: str(t.owner),
    role: str(t.role),
    type: str(t.type),
    shares: str(t.shares),
    price: str(t.price),
    value: str(t.value),
    date: str(t.date),
  }))
  return {
    title: "Insider Transactions",
    description: "Recent insider buys and sells (Form 4 filings).",
    executiveSummary:
      `${trades.length} recent insider ${trades.length === 1 ? "transaction" : "transactions"} in this view, ` +
      `each an officer, director or large holder filing a Form 4. Values are as reported. A sale can be routine ` +
      `(scheduled, tax) while a purchase is discretionary — read the role and type together, not the dollar value alone.`,
    subtitle: `${trades.length} transactions`,
    generatedAt: iso(),
    topN: 3,
    highlightKeys: ["value", "type", "owner", "date"],
    columns: [
      { key: "ticker", label: "Ticker", format: "text" },
      { key: "owner", label: "Insider", format: "text" },
      { key: "role", label: "Role", format: "text" },
      { key: "type", label: "Type", format: "text" },
      { key: "shares", label: "Shares", format: "text" },
      { key: "price", label: "Price", format: "text" },
      { key: "value", label: "Value", format: "text" },
      { key: "date", label: "Date", format: "text" },
    ],
    rows,
  }
}

// ---- Politician spotlight (members with activity + excess return) --------

interface SpotlightMember {
  displayName: string
  party: string
  chamber: string
  totalTrades: number
  buys: number
  sells: number
  estimatedActivityUsd: number
  avgExcessReturnPct: number | null
}

export function buildPoliticianReport(members: SpotlightMember[], windowDays?: number): ReportPayload | null {
  if (!members || members.length === 0) return null
  const rows = byDesc(members, (m) => m.estimatedActivityUsd).map((m) => ({
    member: str(m.displayName),
    party: str(m.party),
    chamber: str(m.chamber),
    trades: num(m.totalTrades),
    buys: num(m.buys),
    sells: num(m.sells),
    activity: num(m.estimatedActivityUsd),
    avgExcess: num(m.avgExcessReturnPct),
  }))
  return {
    title: "Politician Trading Spotlight",
    description: "Congressional members by disclosed trading activity.",
    executiveSummary:
      `${members.length} ${members.length === 1 ? "member" : "members"} in the spotlight` +
      `${windowDays ? ` over the last ${windowDays} days` : ""}, by disclosed trade count and estimated activity. ` +
      `Estimated activity is a midpoint of the disclosed value RANGES — Congress reports bands, not exact amounts — ` +
      `so treat it as an order of magnitude, and excess return is versus SPY where the holding window allows it.`,
    subtitle: windowDays ? `Window: ${windowDays} days` : undefined,
    generatedAt: iso(),
    topN: 3,
    highlightKeys: ["activity", "trades", "buys", "avgExcess"],
    columns: [
      { key: "member", label: "Member", format: "text" },
      { key: "party", label: "Party", format: "text" },
      { key: "chamber", label: "Chamber", format: "text" },
      { key: "trades", label: "Trades", format: "number" },
      { key: "buys", label: "Buys", format: "number" },
      { key: "sells", label: "Sells", format: "number" },
      { key: "activity", label: "Est. Activity", format: "currency" },
      { key: "avgExcess", label: "Avg Excess", format: "percent" },
    ],
    rows,
  }
}

// ---- Form 144 filings (proposed insider sales) --------------------------

interface Form144Filing {
  filer: string
  filedAt: string
  accession: string
}

export function buildForm144Report(filings: Form144Filing[]): ReportPayload | null {
  if (!filings || filings.length === 0) return null
  const rows = filings.map((f) => ({
    filer: str(f.filer),
    filedAt: str(f.filedAt),
    accession: str(f.accession),
  }))
  return {
    title: "Form 144 Watch",
    description: "Recent Form 144 filings — notices of proposed insider sales.",
    executiveSummary:
      `${filings.length} recent Form 144 ${filings.length === 1 ? "filing" : "filings"}. A Form 144 is a NOTICE of ` +
      `intent to sell restricted stock, not a completed sale — the insider may sell less, later, or not at all. It is ` +
      `an early, soft signal, useful mainly in aggregate or alongside a completed Form 4.`,
    subtitle: `${filings.length} filings`,
    generatedAt: iso(),
    topN: 3,
    highlightKeys: ["filedAt", "accession"],
    columns: [
      { key: "filer", label: "Filer", format: "text" },
      { key: "filedAt", label: "Filed", format: "text" },
      { key: "accession", label: "Accession", format: "text" },
    ],
    rows,
  }
}
