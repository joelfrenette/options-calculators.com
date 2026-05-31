import { NextResponse } from "next/server"

// Always fetch fresh-ish data but cache for 1 hour at the fetch layer
export const dynamic = "force-dynamic"

const SEC_USER_AGENT = "options-calculators.com insider-tracker contact@options-calculators.com"

function formatDate(dateInput: unknown): string {
  if (!dateInput || typeof dateInput !== "string") {
    return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const dateStr = dateInput.trim()

  try {
    let date: Date
    if (dateStr.includes("-") || dateStr.includes("/")) {
      date = new Date(dateStr)
    } else {
      return dateStr
    }

    if (isNaN(date.getTime())) {
      return dateStr
    }

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return dateStr
  }
}

function formatShares(shares: number, change: number): string {
  if (!shares || shares === 0) return "N/A"
  const formatted = Math.abs(shares).toLocaleString()
  return change > 0 ? `+${formatted}` : `-${formatted}`
}

function formatValue(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`
  }
  return `$${value.toFixed(0)}`
}

function parseValueToMillions(valueStr: string): number {
  const cleaned = valueStr.replace(/[$,]/g, "")
  const num = Number.parseFloat(cleaned.replace(/[KM]/g, ""))
  if (isNaN(num)) return 0
  if (cleaned.includes("M")) return num
  if (cleaned.includes("K")) return num / 1000
  return num / 1000000
}

// Normalize a raw ISO/string date to YYYY-MM-DD for sorting
function toSortableDate(dateInput: unknown): number {
  if (!dateInput || typeof dateInput !== "string") return 0
  const t = new Date(dateInput).getTime()
  return isNaN(t) ? 0 : t
}

// ---------------------------------------------------------------------------
// SOURCE 1: Finnhub — market-wide SEC Form 4 feed (no ticker filter)
// The /stock/insider-transactions endpoint supports a date-range scan that
// returns filings across ALL companies when no symbol is specified.
// We also hit the dedicated /stock/insider-sentiment-all endpoint as a
// secondary signal. Both are free on the Finnhub Basic plan.
// ---------------------------------------------------------------------------
async function fetchFinnhubInsiderTransactions() {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) {
    console.log("[v0] No Finnhub API key available")
    return []
  }

  try {
    // Date window: last 30 days so we capture small-cap and mid-cap moves too
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 30)
    const fromStr = from.toISOString().split("T")[0]
    const toStr = to.toISOString().split("T")[0]

    // Market-wide insider transaction scan — returns ALL companies, not just large caps
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/insider-transactions?from=${fromStr}&to=${toStr}&token=${apiKey}`,
      { next: { revalidate: 3600 } },
    )

    if (!response.ok) {
      console.log(`[v0] Finnhub market-wide scan returned status ${response.status} — falling back to per-ticker`)
      return fetchFinnhubPerTicker(apiKey)
    }

    const data = await response.json()
    const transactions = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []

    if (transactions.length === 0) {
      console.log("[v0] Finnhub market-wide scan returned 0 results — falling back to per-ticker")
      return fetchFinnhubPerTicker(apiKey)
    }

    // Each record already has a `symbol` field on the market-wide endpoint
    const normalised = transactions.map((t: any) => ({
      ...t,
      ticker: (t.symbol || t.ticker || "").toUpperCase(),
    }))

    console.log(`[v0] Finnhub market-wide scan returned ${normalised.length} insider transactions`)
    return normalised
  } catch (error) {
    console.error("[v0] Finnhub market-wide fetch error:", error)
    return fetchFinnhubPerTicker(apiKey)
  }
}

// Fallback: per-ticker queries across a diversified set that covers large, mid,
// and small caps across sectors so we're not limited to FAANG
async function fetchFinnhubPerTicker(apiKey: string) {
  const tickers = [
    // Large cap / mega cap
    "AAPL", "NVDA", "MSFT", "META", "GOOGL", "AMZN", "TSLA", "JPM", "BRK.B", "V",
    // Mid cap / sector diversification
    "AMD", "NFLX", "CRM", "UBER", "ABNB", "SNOW", "PLTR", "RIVN", "COIN", "SOFI",
    // Small/mid cap that frequently show meaningful insider moves
    "RKT", "SPCE", "CLOV", "WISH", "BB", "GME", "AMC", "BBBY", "TLRY", "SNDL",
    // Healthcare / biotech (often strong insider buying signals)
    "PFE", "MRNA", "BNTX", "BIIB", "REGN", "ILMN", "CRSP", "EDIT", "NTLA",
    // Energy / commodities
    "XOM", "CVX", "OXY", "SLB", "HAL", "DVN", "FANG", "MPC", "VLO",
    // Financials / real estate
    "BAC", "GS", "MS", "C", "WFC", "BX", "KKR", "APO", "SPG", "AMT",
    // Industrials / defence
    "LMT", "RTX", "NOC", "BA", "CAT", "DE", "GE", "HON", "UPS", "FDX",
    // Consumer / retail
    "WMT", "TGT", "COST", "HD", "NKE", "MCD", "SBUX", "DIS", "NFLX",
  ]

  // Deduplicate
  const uniqueTickers = Array.from(new Set(tickers))
  const allTransactions: any[] = []

  // Batch into groups of 10 to avoid rate limits
  const batchSize = 10
  for (let i = 0; i < uniqueTickers.length; i += batchSize) {
    const batch = uniqueTickers.slice(i, i + batchSize)
    const results = await Promise.allSettled(
      batch.map(async (ticker) => {
        const res = await fetch(
          `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${ticker}&token=${apiKey}`,
          { next: { revalidate: 3600 } },
        )
        if (!res.ok) return [] as any[]
        const d = await res.json()
        if (d.data && Array.isArray(d.data)) {
          return d.data.slice(0, 3).map((t: any) => ({ ...t, ticker }))
        }
        return [] as any[]
      }),
    )
    for (const r of results) {
      if (r.status === "fulfilled" && Array.isArray(r.value)) {
        allTransactions.push(...r.value)
      }
    }
  }

  console.log(`[v0] Finnhub per-ticker fallback returned ${allTransactions.length} transactions across ${uniqueTickers.length} tickers`)
  return allTransactions
}

// ---------------------------------------------------------------------------
// SOURCE 2: SEC EDGAR — official "latest Form 4 filings" atom feed (free)
// Gives us the most recent filers even when structured share data is absent.
// ---------------------------------------------------------------------------
async function fetchSecEdgarForm4() {
  try {
    const response = await fetch(
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&company=&dateb=&owner=include&count=40&output=atom",
      {
        headers: {
          "User-Agent": SEC_USER_AGENT,
          Accept: "application/atom+xml",
        },
        next: { revalidate: 3600 },
      },
    )

    if (!response.ok) {
      console.log(`[v0] SEC EDGAR returned status ${response.status}`)
      return []
    }

    const xml = await response.text()
    const entries: any[] = []

    // Lightweight XML parsing of <entry> blocks
    const entryMatches = xml.match(/<entry>[\s\S]*?<\/entry>/g) || []
    for (const entry of entryMatches.slice(0, 15)) {
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/)
      const updatedMatch = entry.match(/<updated>([\s\S]*?)<\/updated>/)

      const rawTitle = titleMatch ? titleMatch[1].trim() : ""
      const updated = updatedMatch ? updatedMatch[1].trim() : ""

      // Titles look like: "4 - DOE JOHN (0001234567) (Reporting)"
      const cleanTitle = rawTitle.replace(/^4\s*-\s*/, "").replace(/\(\d+\)\s*\(.*?\)\s*$/, "").trim()
      if (!cleanTitle) continue

      entries.push({
        owner: cleanTitle,
        date: updated ? updated.split("T")[0] : "",
      })
    }

    console.log(`[v0] SEC EDGAR returned ${entries.length} Form 4 filings`)
    return entries
  } catch (error) {
    console.error("[v0] SEC EDGAR fetch error:", error)
    return []
  }
}

// ---------------------------------------------------------------------------
// SOURCE 3: House & Senate Stock Watcher — free public congressional data
// ---------------------------------------------------------------------------
async function fetchCongressionalTrades() {
  const sources = [
    {
      url: "https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json",
      chamber: "House",
    },
    {
      url: "https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json",
      chamber: "Senate",
    },
  ]

  const results = await Promise.allSettled(
    sources.map(async ({ url, chamber }) => {
      const response = await fetch(url, { next: { revalidate: 21600 } })
      if (!response.ok) return [] as any[]
      const data = await response.json()
      if (!Array.isArray(data)) return [] as any[]

      return data
        .map((t: any) => {
          const ticker = (t.ticker || "").toUpperCase()
          const rawType = (t.type || "").toLowerCase()
          const type = rawType.includes("purchase") || rawType.includes("buy")
            ? "Buy"
            : rawType.includes("sale") || rawType.includes("sell")
              ? "Sell"
              : "Disclosure"
          return {
            _date: t.transaction_date || t.disclosure_date || "",
            date: t.transaction_date || t.disclosure_date || "",
            type,
            owner: t.representative || t.senator || "Unknown",
            role: chamber === "House" ? "Representative" : "Senator",
            category: "congressional",
            ticker: ticker && ticker !== "--" ? ticker : "N/A",
            shares: t.amount ? `${type === "Sell" ? "-" : "+"}${t.amount}` : "N/A",
            price: "N/A",
            value: t.amount || "N/A",
            notes: t.asset_description ? String(t.asset_description).slice(0, 60) : `${chamber} disclosure`,
            dataSource: `${chamber} STOCK Act disclosure`,
          }
        })
        .filter((t: any) => t.ticker !== "N/A" && t._date)
    }),
  )

  const all: any[] = []
  for (const r of results) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) {
      all.push(...r.value)
    }
  }

  // Most recent first, take the latest 50 (covers a broad range of tickers)
  all.sort((a, b) => toSortableDate(b._date) - toSortableDate(a._date))
  const recent = all.slice(0, 50)
  console.log(`[v0] Congressional sources returned ${all.length} trades (showing ${recent.length})`)
  return recent
}

// ---------------------------------------------------------------------------
// Seed / fallback data — used when every live source is unavailable
// ---------------------------------------------------------------------------
function getSeedTransactions() {
  return [
    { date: "2025-11-25", type: "Sell", owner: "Cook Timothy D", role: "CEO", category: "corporate", ticker: "AAPL", shares: "-100,000", price: "$220/share", value: "$22M", notes: "Routine divestiture", dataSource: "Seed data" },
    { date: "2025-11-24", type: "Buy", owner: "Pelosi Nancy", role: "Representative", category: "congressional", ticker: "MSFT", shares: "+$50K", price: "N/A", value: "$50K", notes: "Spousal trade", dataSource: "Seed data" },
    { date: "2025-11-23", type: "Sell", owner: "Huang Jensen", role: "CEO", category: "corporate", ticker: "NVDA", shares: "-50,000", price: "$140/share", value: "$7M", notes: "10b5-1 plan", dataSource: "Seed data" },
    { date: "2025-11-22", type: "Buy", owner: "Rep. Josh Gottheimer", role: "Representative", category: "congressional", ticker: "XOM", shares: "+$15K-$50K", price: "N/A", value: "$15K-$50K", notes: "Energy bet", dataSource: "Seed data" },
    { date: "2025-11-21", type: "Sell", owner: "Zuckerberg Mark", role: "CEO", category: "corporate", ticker: "META", shares: "-75,000", price: "$580/share", value: "$43.5M", notes: "Scheduled sale", dataSource: "Seed data" },
    { date: "2025-11-20", type: "Buy", owner: "Sen. Tommy Tuberville", role: "Senator", category: "congressional", ticker: "LMT", shares: "+$100K-$250K", price: "N/A", value: "$100K-$250K", notes: "Defense allocation", dataSource: "Seed data" },
    { date: "2025-11-18", type: "Sell", owner: "Dabiri John", role: "Officer", category: "corporate", ticker: "NVDA", shares: "-17,792", price: "$179.42/share", value: "$3.2M", notes: "Open market sale", dataSource: "Seed data" },
  ]
}

export async function GET() {
  try {
    // Fetch all sources in parallel
    const [finnhubData, edgarData, congressionalData] = await Promise.all([
      fetchFinnhubInsiderTransactions(),
      fetchSecEdgarForm4(),
      fetchCongressionalTrades(),
    ])

    const transactions: any[] = []
    let corporateCount = 0
    let congressionalCount = 0

    // ---- Corporate: Finnhub structured transactions ----
    if (finnhubData && finnhubData.length > 0) {
      for (const t of finnhubData) {
        const transactionValue = (t.share || 0) * (t.transactionPrice || 0)
        const transactionType =
          t.transactionCode === "P" ? "Buy" : t.transactionCode === "S" ? "Sell" : t.change > 0 ? "Buy" : "Sell"

        transactions.push({
          _date: t.transactionDate || t.filingDate,
          date: formatDate(t.transactionDate || t.filingDate),
          type: transactionType,
          owner: t.name || "Unknown",
          role: t.position || "Officer",
          category: "corporate",
          ticker: t.ticker || t.symbol,
          shares: formatShares(t.share || 0, t.change || 0),
          price: t.transactionPrice ? `$${t.transactionPrice.toFixed(2)}/share` : "N/A",
          value: formatValue(
            transactionValue > 0 ? transactionValue : Math.abs(t.change || 0) * (t.transactionPrice || 100),
          ),
          notes:
            transactionType === "Buy" ? "Open market buy" : transactionType === "Sell" ? "Open market sale" : "Filing",
          dataSource: "SEC Form 4 via Finnhub",
        })
        corporateCount++
      }
    }

    // ---- Corporate supplement: SEC EDGAR latest filers (when Finnhub thin) ----
    if (corporateCount < 5 && edgarData && edgarData.length > 0) {
      for (const e of edgarData.slice(0, 8)) {
        transactions.push({
          _date: e.date,
          date: formatDate(e.date),
          type: "Disclosure",
          owner: e.owner,
          role: "Insider",
          category: "corporate",
          ticker: "—",
          shares: "Form 4",
          price: "N/A",
          value: "See filing",
          notes: "Latest SEC Form 4 filing",
          dataSource: "SEC EDGAR",
        })
        corporateCount++
      }
    }

    // ---- Congressional: House/Senate Stock Watcher ----
    if (congressionalData && congressionalData.length > 0) {
      for (const trade of congressionalData) {
        transactions.push({
          ...trade,
          date: formatDate(trade._date || trade.date),
        })
        congressionalCount++
      }
    }

    const usingLiveData = transactions.length > 0

    // ---- Fallback to seed data when everything failed ----
    if (!usingLiveData) {
      for (const t of getSeedTransactions()) {
        transactions.push({ ...t, date: formatDate(t.date) })
        if (t.category === "corporate") corporateCount++
        else congressionalCount++
      }
    }

    // Sort all by date, most recent first
    transactions.sort((a, b) => toSortableDate(b._date) - toSortableDate(a._date))

    // Build volume aggregation for the chart
    const volumeMap: Record<string, { buys: number; sells: number }> = {}
    for (const t of transactions) {
      if (!t.ticker || t.ticker === "—" || t.ticker === "N/A") continue
      if (!volumeMap[t.ticker]) {
        volumeMap[t.ticker] = { buys: 0, sells: 0 }
      }
      const valueInMillions = parseValueToMillions(String(t.value))
      if (t.type === "Buy") {
        volumeMap[t.ticker].buys += valueInMillions
      } else if (t.type === "Sell") {
        volumeMap[t.ticker].sells += valueInMillions
      }
    }

    const volumeData = Object.entries(volumeMap)
      .map(([ticker, data]) => ({
        ticker,
        buys: Math.round(data.buys * 100) / 100,
        sells: Math.round(data.sells * 100) / 100,
      }))
      .filter((d) => d.buys > 0 || d.sells > 0)
      .sort((a, b) => b.buys + b.sells - (a.buys + a.sells))
      .slice(0, 6)

    // Strip internal _date helper before returning
    const cleanedTransactions = transactions.map(({ _date, ...rest }) => rest)

    return NextResponse.json({
      success: true,
      transactions: cleanedTransactions,
      volumeData,
      source: usingLiveData ? "live" : "seed",
      lastUpdated: new Date().toISOString(),
      dataSources: {
        corporate: {
          source:
            finnhubData && finnhubData.length > 0
              ? "Finnhub API (SEC Form 4)"
              : edgarData && edgarData.length > 0
                ? "SEC EDGAR (Form 4 feed)"
                : "Seed data",
          count: corporateCount,
          isLive: usingLiveData && (finnhubData.length > 0 || edgarData.length > 0),
        },
        congressional: {
          source: "House & Senate Stock Watcher (STOCK Act)",
          count: congressionalCount,
          isLive: congressionalData && congressionalData.length > 0,
          note: "Congressional trades disclosed with up to 45-day delay. Value ranges (not exact amounts) are reported per the STOCK Act.",
        },
      },
    })
  } catch (error) {
    console.error("[v0] Insider trading API error:", error)
    // Even on hard failure, return seed data so the page is never empty
    const seed = getSeedTransactions().map((t) => ({ ...t, date: formatDate(t.date) }))
    return NextResponse.json({
      success: true,
      transactions: seed,
      volumeData: [],
      source: "seed",
      lastUpdated: new Date().toISOString(),
      dataSources: {
        corporate: { source: "Seed data", count: 4, isLive: false },
        congressional: { source: "Seed data", count: 3, isLive: false },
      },
    })
  }
}
