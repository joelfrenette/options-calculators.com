// CEO / Insider Cluster Buys — when MULTIPLE different insiders at the same
// company buy stock within a short window, it's a well-known high-signal pattern.
// We pull recent Form 4 buys (already in the existing insider-trading route's
// Finnhub source) and aggregate by ticker.

import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

interface ClusterRow {
  ticker: string
  buyerCount: number // distinct insiders who bought
  totalBuys: number
  totalDollarValue: number
  buyers: Array<{ name: string; title: string; shares: number; value: number; date: string }>
}

interface FinnhubInsider {
  symbol: string
  name: string
  share: number // shares transacted
  change: number // > 0 = buy
  filingDate: string
  transactionDate: string
  transactionPrice: number
  transactionCode: string // P = open-market purchase, S = sale
  // Title isn't always returned, so we fall back to position field where available.
  position?: string
}

export async function GET(request: Request) {
  const days = Math.min(60, Math.max(7, Number.parseInt(new URL(request.url).searchParams.get("days") || "30", 10)))
  const minBuyers = Math.max(2, Number.parseInt(new URL(request.url).searchParams.get("minBuyers") || "2", 10))
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffMs = cutoff.getTime()

  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        message: "Finnhub API key not configured. Cluster Buys uses Finnhub's free insider-transactions feed.",
        clusters: [],
        windowDays: days,
        minBuyers,
      },
      { status: 200 },
    )
  }

  try {
    const fromStr = cutoff.toISOString().split("T")[0]
    const toStr = new Date().toISOString().split("T")[0]
    // Finnhub's market-wide insider feed (no symbol filter — returns all).
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/insider-transactions?from=${fromStr}&to=${toStr}&token=${apiKey}`,
      { next: { revalidate: 1800 }, signal: AbortSignal.timeout(15_000) },
    )
    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          message: `Finnhub returned HTTP ${res.status}.`,
          clusters: [],
          windowDays: days,
          minBuyers,
        },
        { status: 200 },
      )
    }
    const payload = await res.json()
    const rawTrades: FinnhubInsider[] = Array.isArray(payload?.data) ? payload.data : []

    // Filter to OPEN-MARKET BUYS only (transactionCode === "P") in window.
    const buysByTicker = new Map<string, FinnhubInsider[]>()
    for (const t of rawTrades) {
      if (t.transactionCode !== "P") continue // only true purchases
      if (!t.share || t.share <= 0) continue
      const td = new Date(t.transactionDate).getTime()
      if (!td || isNaN(td) || td < cutoffMs) continue
      const arr = buysByTicker.get(t.symbol) || []
      arr.push(t)
      buysByTicker.set(t.symbol, arr)
    }

    // Reduce to clusters with >= minBuyers distinct insiders.
    const clusters: ClusterRow[] = []
    for (const [ticker, trades] of buysByTicker.entries()) {
      const distinctBuyers = new Set(trades.map((t) => t.name))
      if (distinctBuyers.size < minBuyers) continue
      const buyers = trades.map((t) => ({
        name: t.name || "Unknown",
        title: t.position || "Insider",
        shares: t.share,
        value: t.share * (t.transactionPrice || 0),
        date: t.transactionDate,
      }))
      const totalDollarValue = buyers.reduce((s, b) => s + b.value, 0)
      clusters.push({
        ticker,
        buyerCount: distinctBuyers.size,
        totalBuys: trades.length,
        totalDollarValue: Math.round(totalDollarValue),
        buyers: buyers.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8),
      })
    }

    // Rank: more buyers first, then bigger dollar volume.
    clusters.sort((a, b) => b.buyerCount - a.buyerCount || b.totalDollarValue - a.totalDollarValue)

    return NextResponse.json({
      success: true,
      source: "Finnhub insider-transactions (open-market purchases only)",
      windowDays: days,
      minBuyers,
      totalCompaniesScanned: buysByTicker.size,
      clusters: clusters.slice(0, 50),
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "unknown",
        clusters: [],
        windowDays: days,
        minBuyers,
      },
      { status: 200 },
    )
  }
}
