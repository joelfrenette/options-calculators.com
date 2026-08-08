// Congress Trade Feed — dedicated endpoint for the COPY > Congress Trades tab.
// Reads Quiver Quant's live congressional trading feed and normalizes records
// with Party, chamber, value-range, and a disclosure-lag metric (days between
// trade date and report date — key context for traders).
//
// The feed REQUIRES an API key (QUIVER_API_KEY). This comment used to say "no
// key needed", which is what the code assumed, and Quiver answered 401 to every
// request. See lib/quiver.ts and AUDIT_BACKLOG P6-1.

import { NextResponse } from "next/server"
import { fetchCongressTrading } from "@/lib/quiver"

export const dynamic = "force-dynamic"

// STOCK Act disclosure ranges (the exact discrete buckets used in PTR filings).
// We map the string back to a midpoint dollar value so we can sort/filter by size.
function parseValueRange(raw: string): { label: string; midUsd: number } {
  const s = (raw || "").trim()
  if (!s) return { label: "—", midUsd: 0 }
  // Common Quiver formats: "$1,001 - $15,000", "$15,001 - $50,000", etc.
  const m = s.match(/\$([\d,]+)\s*-\s*\$([\d,]+)/)
  if (m) {
    const lo = Number.parseInt(m[1].replace(/,/g, ""), 10) || 0
    const hi = Number.parseInt(m[2].replace(/,/g, ""), 10) || 0
    return { label: s, midUsd: Math.round((lo + hi) / 2) }
  }
  // Sometimes a single value (e.g., "$1,500,000+")
  const m2 = s.match(/\$([\d,]+)\+?/)
  if (m2) {
    const v = Number.parseInt(m2[1].replace(/,/g, ""), 10) || 0
    return { label: s, midUsd: v }
  }
  return { label: s, midUsd: 0 }
}

function inferParty(raw: unknown): "D" | "R" | "I" | "?" {
  const s = String(raw || "").toUpperCase()
  if (s.startsWith("D")) return "D"
  if (s.startsWith("R")) return "R"
  if (s.startsWith("I")) return "I"
  return "?"
}

interface Trade {
  reportDate: string // YYYY-MM-DD — when filed with Congress
  tradeDate: string // YYYY-MM-DD — when the actual transaction happened
  disclosureLagDays: number // tradeDate -> reportDate; STOCK Act allows up to 45
  member: string
  bioGuideId: string // for future deep-links
  party: "D" | "R" | "I" | "?"
  chamber: "House" | "Senate"
  ticker: string
  tickerType: "stock" | "option" | "other" // OP from Quiver = options
  type: "Buy" | "Sell" | "Other"
  valueLabel: string // original range string for display
  valueMidUsd: number // midpoint for filtering/sorting
  description: string
  // Quiver pre-computes these:
  excessReturnPct: number | null // member's return on this trade vs SPY, since trade date
  priceChangePct: number | null
  spyChangePct: number | null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const days = Math.min(180, Math.max(1, Number.parseInt(url.searchParams.get("days") || "30", 10)))
  const party = (url.searchParams.get("party") || "").toUpperCase() // "", D, R, I
  const chamber = (url.searchParams.get("chamber") || "").toLowerCase() // "", house, senate
  const owner = (url.searchParams.get("owner") || "").toLowerCase()
  const ticker = (url.searchParams.get("ticker") || "").toUpperCase()
  const type = (url.searchParams.get("type") || "").toLowerCase() // "", buy, sell
  const minSize = Number.parseInt(url.searchParams.get("minSize") || "0", 10) || 0

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffMs = cutoff.getTime()

  try {
    // Auth, status mapping and metering all live in lib/quiver.ts. This route
    // used to call Quiver unauthenticated and report the resulting permanent
    // 401 as "rate-limited briefly, try again in a moment" — see P6-1.
    const result = await fetchCongressTrading("/api/congress-trades")

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          source: "Quiver Quant",
          upstreamStatus: "upstreamStatus" in result ? result.upstreamStatus : null,
          message: result.message,
          transient: result.transient,
          trades: [],
          generatedAt: new Date().toISOString(),
        },
        { status: result.httpStatus },
      )
    }

    const data = result.data as any[]

    const all: Trade[] = []
    for (const t of data) {
      // Quiver actual field names: TransactionDate, ReportDate, Representative,
      // Senator (rare), Ticker, Transaction, Range, Amount (mid as string),
      // House ("Representatives" or "Senate"), Party (D/R/I), TickerType
      // (ST=stock, OP=option), Description, ExcessReturn, PriceChange, SPYChange.
      const tradeDate = String(t.TransactionDate || t.Date || "").slice(0, 10)
      const reportDate = String(t.ReportDate || t.disclosure_date || tradeDate).slice(0, 10)
      const td = new Date(tradeDate).getTime()
      if (!td || isNaN(td)) continue
      if (td < cutoffMs) continue

      const rawType = String(t.Transaction || "").toLowerCase()
      const tradeType: Trade["type"] =
        rawType.includes("purchase") || rawType.includes("buy")
          ? "Buy"
          : rawType.includes("sale") || rawType.includes("sell")
            ? "Sell"
            : "Other"

      const tickerStr = String(t.Ticker || "").replace(/\s/g, "").toUpperCase()
      if (!tickerStr || tickerStr === "--" || tickerStr === "N/A") continue

      const houseStr = String(t.House || t.Chamber || "Representatives")
      const isSenate = houseStr.toLowerCase().includes("senate")
      const memberStr = String(t.Representative || t.Senator || t.Name || "Unknown")
      const partyStr = inferParty(t.Party)

      // Quiver provides BOTH a Range ("$1,001 - $15,000") and Amount (the low
      // end of the range as a string). Use Range for display, derive midpoint.
      const rangeRaw = String(t.Range || t.Amount || "")
      const { label, midUsd } = parseValueRange(rangeRaw)
      // If Amount is a clean number and we have no midpoint, use it.
      const amountNum = Number.parseFloat(String(t.Amount || "")) || 0
      const finalMid = midUsd || amountNum

      const tt = String(t.TickerType || "").toUpperCase()
      const tickerType: Trade["tickerType"] = tt === "OP" ? "option" : tt === "ST" ? "stock" : "other"

      const lag = Math.max(0, Math.round((new Date(reportDate).getTime() - td) / 86_400_000))

      // Quiver's pre-computed return metrics — capture if present, else null.
      const toNumOrNull = (v: unknown) => {
        const n = Number(v)
        return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
      }

      all.push({
        reportDate,
        tradeDate,
        disclosureLagDays: lag,
        member: memberStr,
        bioGuideId: String(t.BioGuideID || ""),
        party: partyStr,
        chamber: isSenate ? "Senate" : "House",
        ticker: tickerStr,
        tickerType,
        type: tradeType,
        valueLabel: label,
        valueMidUsd: finalMid,
        description: String(t.Description || "").slice(0, 200),
        excessReturnPct: toNumOrNull(t.ExcessReturn),
        priceChangePct: toNumOrNull(t.PriceChange),
        spyChangePct: toNumOrNull(t.SPYChange),
      })
    }

    // Apply filters
    const filtered = all.filter((t) => {
      if (party && t.party !== party) return false
      if (chamber === "house" && t.chamber !== "House") return false
      if (chamber === "senate" && t.chamber !== "Senate") return false
      if (owner && !t.member.toLowerCase().includes(owner)) return false
      if (ticker && t.ticker !== ticker) return false
      if (type === "buy" && t.type !== "Buy") return false
      if (type === "sell" && t.type !== "Sell") return false
      if (minSize && t.valueMidUsd < minSize) return false
      return true
    })

    // Sort newest trade first
    filtered.sort((a, b) => new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime())

    return NextResponse.json({
      success: true,
      source: "Quiver Quant (free public feed)",
      fetched: all.length,
      returned: filtered.length,
      filters: { days, party: party || null, chamber: chamber || null, owner: owner || null, ticker: ticker || null, type: type || null, minSize },
      trades: filtered.slice(0, 200), // cap to keep response sane
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "unknown", trades: [] },
      { status: 500 },
    )
  }
}
