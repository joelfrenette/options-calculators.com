// Top Performers Leaderboard — ranks members by trailing performance using
// Quiver's pre-computed ExcessReturn (% over SPY from trade date). We also
// surface an Insider Cluster Buys section: tickers where many *different*
// members bought in the trailing window (a high-signal pattern).

import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

interface MemberRow {
  member: string
  party: "D" | "R" | "I" | "?"
  chamber: "House" | "Senate"
  tradeCount: number
  avgExcessReturnPct: number
  bestTickerByXr: string
  bestXrPct: number
  // weighted by dollar amount (rough — uses range midpoint)
  weightedAvgXrPct: number | null
}

interface ClusterRow {
  ticker: string
  buyerCount: number // distinct members
  totalBuys: number
  avgExcessReturnPct: number | null
  members: string[]
}

function inferParty(raw: unknown): "D" | "R" | "I" | "?" {
  const s = String(raw || "").toUpperCase()
  if (s.startsWith("D")) return "D"
  if (s.startsWith("R")) return "R"
  if (s.startsWith("I")) return "I"
  return "?"
}

function parseRangeMid(s: string): number {
  if (!s) return 0
  const m = s.match(/\$([\d,]+)\s*-\s*\$([\d,]+)/)
  if (m) {
    const lo = Number.parseInt(m[1].replace(/,/g, ""), 10) || 0
    const hi = Number.parseInt(m[2].replace(/,/g, ""), 10) || 0
    return Math.round((lo + hi) / 2)
  }
  return 0
}

export async function GET(request: Request) {
  const days = Math.min(365, Math.max(30, Number.parseInt(new URL(request.url).searchParams.get("days") || "180", 10)))
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffMs = cutoff.getTime()
  const minTradesForRanking = Math.max(3, Math.floor(days / 60)) // require some sample size

  try {
    const res = await fetch("https://api.quiverquant.com/beta/live/congresstrading", {
      headers: { Accept: "application/json", "User-Agent": "options-calculators.com contact@options-calculators.com" },
      next: { revalidate: 3600 },
    })
    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          message:
            res.status === 401 || res.status === 429
              ? "Quiver Quant rate-limited briefly. Try again in a moment."
              : `Upstream HTTP ${res.status}`,
          windowDays: days,
          members: [],
          clusters: [],
        },
        { status: 200 },
      )
    }
    const data = (await res.json()) as any[]
    if (!Array.isArray(data)) {
      return NextResponse.json({ success: false, message: "Unexpected payload" }, { status: 200 })
    }

    // Aggregate per-member statistics
    const memberAgg = new Map<
      string,
      {
        name: string
        party: "D" | "R" | "I" | "?"
        chamber: "House" | "Senate"
        xrSum: number
        xrCount: number
        dollarWeightedXrSum: number
        dollarSum: number
        bestXr: number
        bestTicker: string
        trades: number
      }
    >()

    // Aggregate cluster buys (distinct members per ticker that BOUGHT in window)
    const clusterByTicker = new Map<
      string,
      {
        buyers: Set<string>
        totalBuys: number
        xrSum: number
        xrCount: number
      }
    >()

    for (const t of data) {
      const tradeDate = String(t.TransactionDate || t.Date || "").slice(0, 10)
      const td = new Date(tradeDate).getTime()
      if (!td || isNaN(td) || td < cutoffMs) continue

      const name = String(t.Representative || t.Senator || t.Name || "Unknown").trim()
      if (!name || name === "Unknown") continue
      const ticker = String(t.Ticker || "").replace(/\s/g, "").toUpperCase()
      if (!ticker || ticker === "--" || ticker === "N/A") continue

      const rawType = String(t.Transaction || "").toLowerCase()
      const isBuy = rawType.includes("purchase") || rawType.includes("buy")

      const xr = Number(t.ExcessReturn)
      const xrValid = Number.isFinite(xr)
      const houseStr = String(t.House || t.Chamber || "Representatives")
      const isSenate = houseStr.toLowerCase().includes("senate")
      const party = inferParty(t.Party)
      const dollar = parseRangeMid(String(t.Range || t.Amount || ""))

      // Member side
      const memEntry =
        memberAgg.get(name) ||
        {
          name,
          party,
          chamber: (isSenate ? "Senate" : "House") as "House" | "Senate",
          xrSum: 0,
          xrCount: 0,
          dollarWeightedXrSum: 0,
          dollarSum: 0,
          bestXr: -Infinity,
          bestTicker: "",
          trades: 0,
        }
      memEntry.trades += 1
      if (xrValid) {
        memEntry.xrSum += xr
        memEntry.xrCount += 1
        if (dollar > 0) {
          memEntry.dollarWeightedXrSum += xr * dollar
          memEntry.dollarSum += dollar
        }
        if (xr > memEntry.bestXr) {
          memEntry.bestXr = xr
          memEntry.bestTicker = ticker
        }
      }
      memberAgg.set(name, memEntry)

      // Cluster side (buys only)
      if (isBuy) {
        const clusterEntry = clusterByTicker.get(ticker) || { buyers: new Set<string>(), totalBuys: 0, xrSum: 0, xrCount: 0 }
        clusterEntry.buyers.add(name)
        clusterEntry.totalBuys += 1
        if (xrValid) {
          clusterEntry.xrSum += xr
          clusterEntry.xrCount += 1
        }
        clusterByTicker.set(ticker, clusterEntry)
      }
    }

    // Build member rows + rank by avg excess return
    const memberRows: MemberRow[] = []
    for (const m of memberAgg.values()) {
      if (m.trades < minTradesForRanking) continue
      if (m.xrCount === 0) continue
      memberRows.push({
        member: m.name,
        party: m.party,
        chamber: m.chamber,
        tradeCount: m.trades,
        avgExcessReturnPct: Math.round((m.xrSum / m.xrCount) * 100) / 100,
        bestTickerByXr: m.bestTicker,
        bestXrPct: Math.round(m.bestXr * 100) / 100,
        weightedAvgXrPct: m.dollarSum > 0 ? Math.round((m.dollarWeightedXrSum / m.dollarSum) * 100) / 100 : null,
      })
    }
    memberRows.sort((a, b) => b.avgExcessReturnPct - a.avgExcessReturnPct)

    // Top 25 + bottom 25 for the leaderboard ends
    const top = memberRows.slice(0, 25)
    const bottom = memberRows.slice(-25).reverse()

    // Build cluster rows — require >= 3 distinct buyers
    const clusterRows: ClusterRow[] = []
    for (const [ticker, c] of clusterByTicker.entries()) {
      if (c.buyers.size < 3) continue
      clusterRows.push({
        ticker,
        buyerCount: c.buyers.size,
        totalBuys: c.totalBuys,
        avgExcessReturnPct: c.xrCount > 0 ? Math.round((c.xrSum / c.xrCount) * 100) / 100 : null,
        members: Array.from(c.buyers).slice(0, 8),
      })
    }
    clusterRows.sort((a, b) => b.buyerCount - a.buyerCount || (b.avgExcessReturnPct ?? -999) - (a.avgExcessReturnPct ?? -999))

    return NextResponse.json({
      success: true,
      source: "Quiver Quant (free public feed)",
      windowDays: days,
      minTradesForRanking,
      top, // highest avg excess return
      bottom, // lowest avg excess return (worst performers)
      clusters: clusterRows.slice(0, 25),
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 200 },
    )
  }
}
