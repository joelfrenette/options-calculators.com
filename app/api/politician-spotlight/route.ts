// Politician Spotlight — for each tracked member, return their last N
// trades from Quiver Quant's free public feed, with pattern statistics
// computed on the server (avoids client-side data shuffling).

import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

interface Trade {
  date: string
  ticker: string
  type: "Buy" | "Sell" | "Other"
  range: string
  midUsd: number
  tickerType: "stock" | "option" | "other"
  excessReturnPct: number | null
}

interface MemberSpotlight {
  key: string
  displayName: string
  matcher: string // case-insensitive substring used to filter Quiver records
  party: "D" | "R" | "I"
  chamber: "House" | "Senate"
  blurb: string
  totalTrades: number
  buys: number
  sells: number
  estimatedActivityUsd: number // sum of midpoints (very rough)
  avgExcessReturnPct: number | null
  topTickers: Array<{ ticker: string; count: number }>
  recentTrades: Trade[] // most recent 10
}

// Curated starter roster — mix of parties + chambers, all historically active.
const ROSTER: Array<Omit<MemberSpotlight, "totalTrades" | "buys" | "sells" | "estimatedActivityUsd" | "avgExcessReturnPct" | "topTickers" | "recentTrades">> = [
  { key: "pelosi", displayName: "Nancy Pelosi", matcher: "pelosi", party: "D", chamber: "House", blurb: "Former Speaker. Best-known retail copy-trade target; frequent options trades on mega-cap tech." },
  { key: "tuberville", displayName: "Tommy Tuberville", matcher: "tuberville", party: "R", chamber: "Senate", blurb: "Sen. (AL). High-volume stock trader; cattle, energy, agriculture tilt historically." },
  { key: "khanna", displayName: "Ro Khanna", matcher: "khanna", party: "D", chamber: "House", blurb: "Rep. (CA-17). Silicon Valley district; transparent trades posted to public feed." },
  { key: "crenshaw", displayName: "Dan Crenshaw", matcher: "crenshaw", party: "R", chamber: "House", blurb: "Rep. (TX-2). Active equity trades across sectors; energy involvement common." },
  { key: "hagerty", displayName: "Bill Hagerty", matcher: "hagerty", party: "R", chamber: "Senate", blurb: "Sen. (TN). Former US Ambassador; well-disclosed financial portfolio." },
  { key: "whitehouse", displayName: "Sheldon Whitehouse", matcher: "whitehouse", party: "D", chamber: "Senate", blurb: "Sen. (RI). Frequent disclosures; broad-market ETF and individual-name mix." },
]

function parseRangeMid(s: string): number {
  if (!s) return 0
  const m = s.match(/\$([\d,]+)\s*-\s*\$([\d,]+)/)
  if (m) {
    const lo = Number.parseInt(m[1].replace(/,/g, ""), 10) || 0
    const hi = Number.parseInt(m[2].replace(/,/g, ""), 10) || 0
    return Math.round((lo + hi) / 2)
  }
  const single = s.match(/\$([\d,]+)/)
  return single ? Number.parseInt(single[1].replace(/,/g, ""), 10) || 0 : 0
}

export async function GET(request: Request) {
  const days = Math.min(365, Math.max(30, Number.parseInt(new URL(request.url).searchParams.get("days") || "180", 10)))
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffMs = cutoff.getTime()

  try {
    const res = await fetch("https://api.quiverquant.com/beta/live/congresstrading", {
      headers: { Accept: "application/json", "User-Agent": "options-calculators.com contact@options-calculators.com" },
      next: { revalidate: 3600 },
    })
    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          message: res.status === 401 || res.status === 429 ? "Quiver Quant rate-limited briefly. Try again in a moment." : `Upstream HTTP ${res.status}`,
          members: ROSTER.map((r) => ({ ...r, totalTrades: 0, buys: 0, sells: 0, estimatedActivityUsd: 0, avgExcessReturnPct: null, topTickers: [], recentTrades: [] })),
        },
        { status: 200 },
      )
    }
    const data = (await res.json()) as any[]
    if (!Array.isArray(data)) {
      return NextResponse.json({ success: false, message: "Unexpected payload" }, { status: 200 })
    }

    const members: MemberSpotlight[] = ROSTER.map((m) => {
      const matched = data
        .filter((t) => String(t.Representative || t.Senator || t.Name || "").toLowerCase().includes(m.matcher))
        .map((t) => {
          const tradeDate = String(t.TransactionDate || t.Date || "").slice(0, 10)
          const ttype: Trade["type"] = (() => {
            const r = String(t.Transaction || "").toLowerCase()
            if (r.includes("purchase") || r.includes("buy")) return "Buy"
            if (r.includes("sale") || r.includes("sell")) return "Sell"
            return "Other"
          })()
          const tt = String(t.TickerType || "").toUpperCase()
          const tickerType: Trade["tickerType"] = tt === "OP" ? "option" : tt === "ST" ? "stock" : "other"
          const range = String(t.Range || t.Amount || "")
          const er = Number(t.ExcessReturn)
          return {
            date: tradeDate,
            ticker: String(t.Ticker || "").toUpperCase(),
            type: ttype,
            range,
            midUsd: parseRangeMid(range),
            tickerType,
            excessReturnPct: Number.isFinite(er) ? Math.round(er * 100) / 100 : null,
          } as Trade
        })
        .filter((t) => t.date && new Date(t.date).getTime() >= cutoffMs && t.ticker)

      const buys = matched.filter((t) => t.type === "Buy").length
      const sells = matched.filter((t) => t.type === "Sell").length
      const totalDollars = matched.reduce((s, t) => s + t.midUsd, 0)
      const xrValues = matched.map((t) => t.excessReturnPct).filter((v): v is number => v != null)
      const avgXr = xrValues.length > 0 ? Math.round((xrValues.reduce((s, v) => s + v, 0) / xrValues.length) * 100) / 100 : null

      const tickerCounts = new Map<string, number>()
      matched.forEach((t) => tickerCounts.set(t.ticker, (tickerCounts.get(t.ticker) || 0) + 1))
      const topTickers = Array.from(tickerCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([ticker, count]) => ({ ticker, count }))

      const recentTrades = matched.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)

      return {
        ...m,
        totalTrades: matched.length,
        buys,
        sells,
        estimatedActivityUsd: totalDollars,
        avgExcessReturnPct: avgXr,
        topTickers,
        recentTrades,
      }
    })

    return NextResponse.json({
      success: true,
      source: "Quiver Quant (free public feed)",
      windowDays: days,
      members,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "unknown", members: [] },
      { status: 200 },
    )
  }
}
