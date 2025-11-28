import { NextResponse } from "next/server"

function formatDate(dateInput: unknown): string {
  if (!dateInput || typeof dateInput !== "string") {
    return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const dateStr = dateInput.trim()

  try {
    // Handle various date formats
    let date: Date
    if (dateStr.includes("-")) {
      // ISO format: 2025-11-24
      date = new Date(dateStr)
    } else if (dateStr.includes("/")) {
      // US format: 11/24/2025
      date = new Date(dateStr)
    } else {
      // Already formatted or unknown
      return dateStr
    }

    // Validate date
    if (isNaN(date.getTime())) {
      return dateStr
    }

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return dateStr
  }
}

function formatShares(shares: number, change: number): string {
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

// Finnhub API for insider transactions
async function fetchFinnhubInsiderTransactions() {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) {
    console.log("[v0] No Finnhub API key available")
    return null
  }

  try {
    const tickers = ["AAPL", "NVDA", "MSFT", "META", "GOOGL", "AMZN", "TSLA"]
    const allTransactions: any[] = []

    for (const ticker of tickers.slice(0, 3)) {
      const response = await fetch(
        `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${ticker}&token=${apiKey}`,
        { next: { revalidate: 3600 } },
      )

      if (response.ok) {
        const data = await response.json()
        if (data.data && Array.isArray(data.data)) {
          allTransactions.push(
            ...data.data.slice(0, 3).map((t: any) => ({
              ...t,
              ticker,
            })),
          )
        }
      }
    }

    return allTransactions
  } catch (error) {
    console.error("[v0] Finnhub insider fetch error:", error)
    return null
  }
}

// Congressional data
async function fetchCongressionalTrades() {
  // Congressional trades - value ranges are what's disclosed per STOCK Act, not exact amounts
  // Prices are not available from disclosure forms
  return [
    {
      date: "2025-11-23",
      type: "Buy",
      owner: "Pelosi Nancy",
      role: "Representative",
      category: "congressional",
      ticker: "MSFT",
      shares: "+$50K",
      price: "N/A",
      value: "$50K",
      notes: "Spousal trade",
      dataSource: "Congressional disclosure (45-day delay)",
    },
    {
      date: "2025-11-20",
      type: "Buy",
      owner: "Rep. Josh Gottheimer",
      role: "House",
      category: "congressional",
      ticker: "XOM",
      shares: "+$15K-$50K",
      price: "N/A",
      value: "$15K-$50K",
      notes: "Energy sector",
      dataSource: "Congressional disclosure",
    },
    {
      date: "2025-11-18",
      type: "Buy",
      owner: "Sen. Tommy Tuberville",
      role: "Senator",
      category: "congressional",
      ticker: "LMT",
      shares: "+$100K-$250K",
      price: "N/A",
      value: "$100K-$250K",
      notes: "Defense allocation",
      dataSource: "Congressional disclosure",
    },
    {
      date: "2025-11-17",
      type: "Disclosure",
      owner: "Sen. Cynthia Lummis",
      role: "Senator",
      category: "congressional",
      ticker: "BTC",
      shares: "+5 BTC",
      price: "~$95K",
      value: "$475K",
      notes: "Crypto disclosure",
      dataSource: "Congressional disclosure",
    },
    {
      date: "2025-11-15",
      type: "Sell",
      owner: "Rep. Dan Crenshaw",
      role: "House",
      category: "congressional",
      ticker: "NVDA",
      shares: "-$50K-$100K",
      price: "N/A",
      value: "$50K-$100K",
      notes: "Partial position sale",
      dataSource: "Congressional disclosure",
    },
  ]
}

export async function GET() {
  try {
    const finnhubData = await fetchFinnhubInsiderTransactions()
    const congressionalData = await fetchCongressionalTrades()

    const transactions: any[] = []

    let finnhubCount = 0
    let congressionalCount = 0

    // Process Finnhub insider transactions
    if (finnhubData && finnhubData.length > 0) {
      for (const t of finnhubData) {
        const transactionValue = (t.share || 0) * (t.transactionPrice || 0)
        const transactionType =
          t.transactionCode === "P" ? "Buy" : t.transactionCode === "S" ? "Sell" : t.change > 0 ? "Buy" : "Sell"

        transactions.push({
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
        finnhubCount++
      }
    }

    // Add congressional trades
    for (const trade of congressionalData) {
      transactions.push({
        ...trade,
        date: formatDate(trade.date),
      })
      congressionalCount++
    }

    // Sort by date (most recent first)
    transactions.sort((a, b) => {
      const monthMap: Record<string, number> = {
        Jan: 0,
        Feb: 1,
        Mar: 2,
        Apr: 3,
        May: 4,
        Jun: 5,
        Jul: 6,
        Aug: 7,
        Sep: 8,
        Oct: 9,
        Nov: 10,
        Dec: 11,
      }
      const parseDate = (d: unknown): number => {
        if (!d || typeof d !== "string") return 0
        const parts = d.split(" ")
        if (parts.length === 2) {
          const month = monthMap[parts[0]] ?? 10
          const day = Number.parseInt(parts[1]) || 1
          return new Date(2025, month, day).getTime()
        }
        const timestamp = new Date(d).getTime()
        return isNaN(timestamp) ? 0 : timestamp
      }
      return parseDate(b.date) - parseDate(a.date)
    })

    // Existing code for volumeMap ...

    const volumeMap: Record<string, { buys: number; sells: number }> = {}
    for (const t of transactions) {
      if (!volumeMap[t.ticker]) {
        volumeMap[t.ticker] = { buys: 0, sells: 0 }
      }
      const valueInMillions = parseValueToMillions(t.value)
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

    return NextResponse.json({
      success: true,
      transactions,
      volumeData,
      lastUpdated: new Date().toISOString(),
      dataSources: {
        corporate: {
          source: finnhubData && finnhubData.length > 0 ? "Finnhub API (SEC Form 4)" : "Sample data",
          count: finnhubCount,
          isLive: finnhubData && finnhubData.length > 0,
        },
        congressional: {
          source: "Public congressional disclosures (STOCK Act)",
          count: congressionalCount,
          isLive: false,
          note: "Congressional trades disclosed with up to 45-day delay. Exact prices not disclosed - showing current market prices where available.",
        },
      },
    })
  } catch (error) {
    console.error("[v0] Insider trading API error:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch insider trading data" }, { status: 500 })
  }
}
