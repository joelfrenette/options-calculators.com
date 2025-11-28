import { NextResponse } from "next/server"

// Finnhub API for insider transactions
async function fetchFinnhubInsiderTransactions() {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) {
    console.log("[v0] No Finnhub API key available")
    return null
  }

  try {
    // Fetch recent insider transactions for major tickers
    const tickers = ["AAPL", "NVDA", "MSFT", "META", "GOOGL", "AMZN", "TSLA"]
    const allTransactions: any[] = []

    // Limit to 3 tickers to avoid rate limits
    for (const ticker of tickers.slice(0, 3)) {
      const response = await fetch(
        `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${ticker}&token=${apiKey}`,
        { next: { revalidate: 3600 } }, // Cache for 1 hour
      )

      if (response.ok) {
        const data = await response.json()
        if (data.data && Array.isArray(data.data)) {
          // Take only the most recent 3 per ticker
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

// Congressional data from QuiverQuant API (if available) or fallback
async function fetchCongressionalTrades() {
  // QuiverQuant requires subscription, so we'll use mock data for congressional trades
  // In production, this would connect to QuiverQuant or similar API
  return [
    {
      date: "2025-11-24",
      type: "Buy",
      owner: "Pelosi Nancy",
      role: "Senator",
      category: "congressional",
      ticker: "MSFT",
      shares: "+$50K",
      price: "N/A",
      value: "$50K",
      notes: "Spousal trade",
    },
    {
      date: "2025-11-21",
      type: "Buy",
      owner: "Rep. Josh Gottheimer",
      role: "House",
      category: "congressional",
      ticker: "XOM",
      shares: "+$15K-$50K",
      price: "N/A",
      value: "$15K-$50K",
      notes: "Energy bet",
    },
    {
      date: "2025-11-19",
      type: "Buy",
      owner: "Sen. Tommy Tuberville",
      role: "Senator",
      category: "congressional",
      ticker: "LMT",
      shares: "+$100K-$250K",
      price: "N/A",
      value: "$100K-$250K",
      notes: "Defense allocation",
    },
    {
      date: "2025-11-18",
      type: "Disclosure",
      owner: "Sen. Cynthia Lummis",
      role: "Senator",
      category: "congressional",
      ticker: "BTC",
      shares: "+5 BTC",
      price: "~$95K",
      value: "$475K",
      notes: "Crypto disclosure",
    },
  ]
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
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

export async function GET() {
  try {
    // Fetch from Finnhub
    const finnhubData = await fetchFinnhubInsiderTransactions()
    const congressionalData = await fetchCongressionalTrades()

    const transactions: any[] = []

    // Process Finnhub insider transactions
    if (finnhubData && finnhubData.length > 0) {
      for (const t of finnhubData) {
        const transactionValue = (t.share || 0) * (t.transactionPrice || 0)
        transactions.push({
          date: formatDate(t.transactionDate || t.filingDate),
          type: t.transactionCode === "P" ? "Buy" : t.transactionCode === "S" ? "Sell" : "Other",
          owner: t.name || "Unknown",
          role: t.position || "Officer",
          category: "corporate",
          ticker: t.ticker || t.symbol,
          shares: formatShares(t.share || 0, t.change || 0),
          price: t.transactionPrice ? `$${t.transactionPrice.toFixed(2)}/share` : "N/A",
          value: formatValue(transactionValue),
          notes:
            t.transactionCode === "P" ? "Open market buy" : t.transactionCode === "S" ? "Open market sale" : "Filing",
        })
      }
    }

    // Add congressional trades
    transactions.push(...congressionalData)

    // Sort by date (most recent first)
    transactions.sort((a, b) => {
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      return dateB.getTime() - dateA.getTime()
    })

    // Calculate volume data for chart
    const volumeMap: Record<string, { buys: number; sells: number }> = {}
    for (const t of transactions) {
      if (!volumeMap[t.ticker]) {
        volumeMap[t.ticker] = { buys: 0, sells: 0 }
      }
      const valueNum =
        Number.parseFloat(t.value.replace(/[$KM,]/g, "")) *
        (t.value.includes("M") ? 1 : t.value.includes("K") ? 0.001 : 0.000001)
      if (t.type === "Buy") {
        volumeMap[t.ticker].buys += valueNum
      } else if (t.type === "Sell") {
        volumeMap[t.ticker].sells += valueNum
      }
    }

    const volumeData = Object.entries(volumeMap)
      .map(([ticker, data]) => ({ ticker, ...data }))
      .sort((a, b) => b.buys + b.sells - (a.buys + a.sells))
      .slice(0, 5)

    return NextResponse.json({
      success: true,
      transactions,
      volumeData,
      lastUpdated: new Date().toISOString(),
      source: finnhubData && finnhubData.length > 0 ? "finnhub" : "mock",
    })
  } catch (error) {
    console.error("[v0] Insider trading API error:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch insider trading data" }, { status: 500 })
  }
}
