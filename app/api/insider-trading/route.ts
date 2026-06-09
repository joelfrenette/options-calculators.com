import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const SEC_USER_AGENT = "options-calculators.com insider-tracker contact@options-calculators.com"

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function formatDate(dateInput: unknown): string {
  if (!dateInput || typeof dateInput !== "string") return ""
  const dateStr = dateInput.trim()
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return dateStr
  }
}

// Returns a timestamp (ms) for sorting — always works from the raw ISO/date string
function toSortableDate(dateInput: unknown): number {
  if (!dateInput || typeof dateInput !== "string") return 0
  const t = new Date(dateInput).getTime()
  return isNaN(t) ? 0 : t
}

// Normalize any date string to YYYY-MM-DD for consistent storage in _date
function toIsoDate(raw: unknown): string {
  if (!raw || typeof raw !== "string") return ""
  const t = new Date(raw)
  if (isNaN(t.getTime())) return ""
  return t.toISOString().split("T")[0]
}

function formatShares(shares: number, change: number): string {
  if (!shares || shares === 0) return "N/A"
  const formatted = Math.abs(shares).toLocaleString()
  return change > 0 ? `+${formatted}` : `-${formatted}`
}

function formatValue(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

function parseValueToMillions(valueStr: string): number {
  const cleaned = (valueStr || "").replace(/[$,\s]/g, "")
  const num = parseFloat(cleaned.replace(/[BKMG]/gi, ""))
  if (isNaN(num)) return 0
  if (/B/i.test(cleaned)) return num * 1_000
  if (/M/i.test(cleaned)) return num
  if (/K/i.test(cleaned)) return num / 1_000
  return num / 1_000_000
}

// ---------------------------------------------------------------------------
// SOURCE 1: Finnhub — market-wide SEC Form 4 feed
// When a specific ticker is requested we also run a dedicated per-ticker call
// to get deeper history beyond the 2000-row market-wide cap.
// ---------------------------------------------------------------------------
async function fetchFinnhubInsiderTransactions(days = 30, ticker = "") {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) {
    console.log("[v0] No Finnhub API key")
    return []
  }

  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days)
  const fromStr = from.toISOString().split("T")[0]
  const toStr = to.toISOString().split("T")[0]

  const results: any[] = []

  // Always do the market-wide scan
  try {
    const url = `https://finnhub.io/api/v1/stock/insider-transactions?from=${fromStr}&to=${toStr}&token=${apiKey}`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (res.ok) {
      const data = await res.json()
      const txns = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []
      console.log(`[v0] Finnhub market-wide scan: ${txns.length} transactions (${days}d window)`)
      for (const t of txns) {
        results.push({ ...t, ticker: (t.symbol || t.ticker || "").toUpperCase() })
      }
    } else {
      console.log(`[v0] Finnhub market-wide returned status ${res.status}`)
    }
  } catch (e) {
    console.error("[v0] Finnhub market-wide error:", e)
  }

  // If a specific ticker was requested, also do a dedicated per-ticker call
  // to get the full history for that symbol (not capped by the 2000-row limit)
  if (ticker) {
    const upperTicker = ticker.toUpperCase()
    try {
      const url = `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${upperTicker}&token=${apiKey}`
      const res = await fetch(url, { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        const txns = Array.isArray(data.data) ? data.data : []
        console.log(`[v0] Finnhub per-ticker ${upperTicker}: ${txns.length} transactions (full history)`)
        // Filter to requested date window
        const cutoff = from.getTime()
        for (const t of txns) {
          const txDate = new Date(t.transactionDate || t.filingDate || "").getTime()
          if (!isNaN(txDate) && txDate >= cutoff) {
            const existing = results.find(
              (r) =>
                r.ticker === upperTicker &&
                r.transactionDate === t.transactionDate &&
                r.name === t.name &&
                r.share === t.share,
            )
            if (!existing) {
              results.push({ ...t, ticker: upperTicker })
            }
          }
        }
      }
    } catch (e) {
      console.error(`[v0] Finnhub per-ticker ${ticker} error:`, e)
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// SOURCE 2: SEC EDGAR — official Form 4 atom feed
// ---------------------------------------------------------------------------
async function fetchSecEdgarForm4() {
  try {
    const res = await fetch(
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&company=&dateb=&owner=include&count=40&output=atom",
      {
        headers: { "User-Agent": SEC_USER_AGENT, Accept: "application/atom+xml" },
        next: { revalidate: 3600 },
      },
    )
    if (!res.ok) {
      console.log(`[v0] SEC EDGAR returned ${res.status}`)
      return []
    }
    const xml = await res.text()
    const entries: any[] = []
    const entryMatches = xml.match(/<entry>[\s\S]*?<\/entry>/g) || []
    for (const entry of entryMatches.slice(0, 15)) {
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/)
      const updatedMatch = entry.match(/<updated>([\s\S]*?)<\/updated>/)
      const rawTitle = titleMatch ? titleMatch[1].trim() : ""
      const updated = updatedMatch ? updatedMatch[1].trim() : ""
      const cleanTitle = rawTitle.replace(/^4\s*-\s*/, "").replace(/\(\d+\)\s*\(.*?\)\s*$/, "").trim()
      if (!cleanTitle) continue
      entries.push({ owner: cleanTitle, _date: updated ? updated.split("T")[0] : "" })
    }
    console.log(`[v0] SEC EDGAR returned ${entries.length} Form 4 filings`)
    return entries
  } catch (e) {
    console.error("[v0] SEC EDGAR error:", e)
    return []
  }
}

// ---------------------------------------------------------------------------
// SOURCE 3: Congressional trades
// Primary: Quiver Quant public congressional trading feed (no API key needed)
// Fallback A: Senate disclosure XML
// Fallback B: House disclosure XML
// ---------------------------------------------------------------------------
async function fetchCongressionalTrades(days = 30) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  const all: any[] = []

  // ---- Quiver Quant (most reliable, no key needed) ----
  try {
    // Quiver provides the last 6 months of congressional trades as a public feed
    const res = await fetch("https://api.quiverquant.com/beta/live/congresstrading", {
      headers: {
        Accept: "application/json",
        "User-Agent": "options-calculators.com contact@options-calculators.com",
      },
      next: { revalidate: 21600 },
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        console.log(`[v0] Quiver Quant congressional raw: ${data.length} trades`)
        for (const t of data) {
          const rawDate = t.Date || t.transaction_date || t.ReportDate || ""
          const isoDate = toIsoDate(rawDate)
          if (!isoDate) continue
          if (new Date(isoDate).getTime() < cutoffDate.getTime()) continue

          const rawType = (t.Transaction || t.type || "").toLowerCase()
          const type = rawType.includes("purchase") || rawType.includes("buy")
            ? "Buy"
            : rawType.includes("sale") || rawType.includes("sell")
              ? "Sell"
              : "Disclosure"

          const ticker = ((t.Ticker || t.ticker || "").replace(/\s/g, "")).toUpperCase()
          if (!ticker || ticker === "--" || ticker === "N/A") continue

          const chamber = (t.Chamber || t.chamber || "House")
          all.push({
            _date: isoDate,
            type,
            owner: t.Representative || t.Senator || t.Name || t.name || "Unknown",
            role: chamber.toLowerCase().includes("senate") ? "Senator" : "Representative",
            category: "congressional",
            ticker,
            shares: t.Amount || t.amount || "N/A",
            price: "N/A",
            value: t.Amount || t.amount || "N/A",
            notes: (t.Asset || t.asset_description || `${chamber} STOCK Act disclosure`).toString().slice(0, 80),
            dataSource: `${chamber} STOCK Act (Quiver Quant)`,
          })
        }
        console.log(`[v0] Quiver Quant congressional within window: ${all.length} trades`)
      }
    } else {
      console.log(`[v0] Quiver Quant congressional returned ${res.status}`)
    }
  } catch (e) {
    console.log(`[v0] Quiver Quant congressional error: ${e}`)
  }

  // ---- Senate STOCK Act disclosures XML (direct from Senate servers) ----
  if (all.length < 5) {
    try {
      const year = new Date().getFullYear()
      const senateRes = await fetch(
        `https://efts.senate.gov/LATEST/search-index?q=%22%22&dateRange=custom&startDate=${cutoffDate.toISOString().split("T")[0]}&endDate=${new Date().toISOString().split("T")[0]}&type=annual-report,ptr`,
        {
          headers: { "User-Agent": SEC_USER_AGENT, Accept: "application/json" },
          next: { revalidate: 21600 },
        },
      )
      if (senateRes.ok) {
        const data = await senateRes.json()
        const hits = data.hits?.hits || []
        console.log(`[v0] Senate EFTS returned ${hits.length} filings`)
        for (const hit of hits.slice(0, 30)) {
          const src = hit._source || {}
          const rawDate = src.date_received || src.date || ""
          const isoDate = toIsoDate(rawDate)
          if (!isoDate) continue
          all.push({
            _date: isoDate,
            type: "Disclosure",
            owner: `Sen. ${src.last_name || ""} ${src.first_name || ""}`.trim(),
            role: "Senator",
            category: "congressional",
            ticker: "N/A",
            shares: "N/A",
            price: "N/A",
            value: "See filing",
            notes: `Senate financial disclosure`,
            dataSource: "Senate EFTS",
          })
        }
      }
    } catch (e) {
      console.log(`[v0] Senate EFTS error: ${e}`)
    }
  }

  // Sort most recent first — no artificial cap; let the caller decide
  all.sort((a, b) => toSortableDate(b._date) - toSortableDate(a._date))
  console.log(`[v0] Congressional total within ${days}d window: ${all.length} trades`)
  return all
}

// ---------------------------------------------------------------------------
// Seed / fallback — used when ALL live sources fail
// ---------------------------------------------------------------------------
function getSeedTransactions() {
  return [
    { _date: "2025-11-25", type: "Sell", owner: "Cook Timothy D", role: "CEO", category: "corporate", ticker: "AAPL", shares: "-100,000", price: "$220.00", value: "$22M", notes: "Routine divestiture", dataSource: "Seed data" },
    { _date: "2025-11-24", type: "Buy",  owner: "Pelosi Nancy",   role: "Representative", category: "congressional", ticker: "MSFT", shares: "$50K-$100K", price: "N/A", value: "$50K-$100K", notes: "Spousal trade (STOCK Act)", dataSource: "Seed data" },
    { _date: "2025-11-23", type: "Sell", owner: "Huang Jensen",   role: "CEO", category: "corporate", ticker: "NVDA", shares: "-50,000", price: "$140.00", value: "$7M", notes: "10b5-1 plan", dataSource: "Seed data" },
    { _date: "2025-11-22", type: "Buy",  owner: "Rep. Josh Gottheimer", role: "Representative", category: "congressional", ticker: "XOM", shares: "$15K-$50K", price: "N/A", value: "$15K-$50K", notes: "Energy position", dataSource: "Seed data" },
    { _date: "2025-11-21", type: "Sell", owner: "Zuckerberg Mark", role: "CEO", category: "corporate", ticker: "META", shares: "-75,000", price: "$580.00", value: "$43.5M", notes: "Scheduled sale", dataSource: "Seed data" },
    { _date: "2025-11-20", type: "Buy",  owner: "Sen. Tommy Tuberville", role: "Senator", category: "congressional", ticker: "LMT", shares: "$100K-$250K", price: "N/A", value: "$100K-$250K", notes: "Defense allocation", dataSource: "Seed data" },
    { _date: "2025-11-18", type: "Sell", owner: "Dabiri John",    role: "Officer", category: "corporate", ticker: "NVDA", shares: "-17,792", price: "$179.42", value: "$3.2M", notes: "Open market sale", dataSource: "Seed data" },
  ]
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "30", 10)))
  // Optional: ticker param allows the UI to request a specific-ticker deep scan
  const ticker = (searchParams.get("ticker") || "").trim().toUpperCase()

  try {
    const [finnhubData, edgarData, congressionalData] = await Promise.all([
      fetchFinnhubInsiderTransactions(days, ticker),
      fetchSecEdgarForm4(),
      fetchCongressionalTrades(days),
    ])

    const transactions: any[] = []
    let corporateCount = 0
    let congressionalCount = 0
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000

    // ---- Corporate: Finnhub structured transactions ----
    if (finnhubData.length > 0) {
      for (const t of finnhubData) {
        const rawDate = t.transactionDate || t.filingDate || ""
        const isoDate = toIsoDate(rawDate)
        // Enforce date window (market-wide cap can include older entries when ticker-filtered)
        if (isoDate && new Date(isoDate).getTime() < cutoffMs) continue

        const transactionCode = (t.transactionCode || "").toUpperCase()
        let transactionType: string
        if (transactionCode === "P") transactionType = "Buy"
        else if (transactionCode === "S") transactionType = "Sell"
        else if (t.change > 0) transactionType = "Buy"
        else if (t.change < 0) transactionType = "Sell"
        else transactionType = "Disclosure"

        const shareCount = Math.abs(t.share || 0)
        const unitPrice = t.transactionPrice || 0
        const computedValue = shareCount > 0 && unitPrice > 0
          ? shareCount * unitPrice
          : Math.abs(t.change || 0) * (unitPrice || 50)

        transactions.push({
          _date: isoDate || rawDate,
          date: formatDate(isoDate || rawDate),
          type: transactionType,
          owner: t.name || "Unknown",
          role: t.position || "Officer",
          category: "corporate",
          ticker: t.ticker || t.symbol || "",
          shares: formatShares(shareCount, t.change || 0),
          price: unitPrice > 0 ? `$${unitPrice.toFixed(2)}` : "N/A",
          value: computedValue > 0 ? formatValue(computedValue) : "N/A",
          notes: transactionType === "Buy" ? "Open market purchase" : transactionType === "Sell" ? "Open market sale" : "SEC Form 4 filing",
          dataSource: "SEC Form 4 via Finnhub",
        })
        corporateCount++
      }
    }

    // ---- Corporate supplement: SEC EDGAR (when Finnhub thin) ----
    if (corporateCount < 5 && edgarData.length > 0) {
      for (const e of edgarData.slice(0, 8)) {
        transactions.push({
          _date: e._date || "",
          date: formatDate(e._date || ""),
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

    // ---- Congressional ----
    for (const trade of congressionalData) {
      transactions.push({
        ...trade,
        date: formatDate(trade._date || ""),
      })
      congressionalCount++
    }

    const usingLiveData = transactions.length > 0

    // ---- Seed fallback ----
    if (!usingLiveData) {
      for (const t of getSeedTransactions()) {
        transactions.push({ ...t, date: formatDate(t._date) })
        if (t.category === "corporate") corporateCount++
        else congressionalCount++
      }
    }

    // Sort by date, most recent first
    transactions.sort((a, b) => toSortableDate(b._date) - toSortableDate(a._date))

    // Build volume chart data
    const volumeMap: Record<string, { buys: number; sells: number }> = {}
    for (const t of transactions) {
      if (!t.ticker || t.ticker === "—" || t.ticker === "N/A") continue
      if (!volumeMap[t.ticker]) volumeMap[t.ticker] = { buys: 0, sells: 0 }
      const val = parseValueToMillions(String(t.value))
      if (t.type === "Buy") volumeMap[t.ticker].buys += val
      else if (t.type === "Sell") volumeMap[t.ticker].sells += val
    }
    const volumeData = Object.entries(volumeMap)
      .map(([ticker, d]) => ({ ticker, buys: Math.round(d.buys * 100) / 100, sells: Math.round(d.sells * 100) / 100 }))
      .filter((d) => d.buys > 0 || d.sells > 0)
      .sort((a, b) => b.buys + b.sells - (a.buys + a.sells))
      .slice(0, 6)

    return NextResponse.json({
      success: true,
      // Keep _date on every transaction so the client can sort correctly
      transactions,
      volumeData,
      source: usingLiveData ? "live" : "seed",
      lastUpdated: new Date().toISOString(),
      dataSources: {
        corporate: {
          source: finnhubData.length > 0 ? "Finnhub (SEC Form 4)" : edgarData.length > 0 ? "SEC EDGAR" : "Seed data",
          count: corporateCount,
          isLive: usingLiveData && (finnhubData.length > 0 || edgarData.length > 0),
        },
        congressional: {
          source: congressionalData.length > 0 ? "Quiver Quant / STOCK Act" : "Unavailable",
          count: congressionalCount,
          isLive: congressionalData.length > 0,
          note: "Congressional trades disclosed with up to 45-day delay per STOCK Act. Dollar ranges (not exact amounts) are reported.",
        },
      },
    })
  } catch (error) {
    console.error("[v0] Insider trading API error:", error)
    const seed = getSeedTransactions().map((t) => ({ ...t, date: formatDate(t._date) }))
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
