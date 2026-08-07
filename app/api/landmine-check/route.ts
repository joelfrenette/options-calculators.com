import { type NextRequest, NextResponse } from "next/server"
import { resolveApiKey } from "@/lib/api-keys"
import { generateCuratedEconomicEvents } from "@/lib/economic-events"

export const runtime = "edge"
export const dynamic = "force-dynamic"

// Landmine check for the Sell Put Scanner: given a set of tickers and a
// horizon date (the furthest option expiry on screen), report every scheduled
// event that could spike or crush premiums before expiry:
//   - per-ticker earnings dates (Finnhub earnings calendar, one call for all)
//   - curated macro events (CPI, NFP, FOMC, jobless claims)
// Awareness only — the client renders a warning column, never filters on it.

interface EarningsHit {
  date: string
  timing: string // BMO | AMC | TBD
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tickersRaw = searchParams.get("tickers") || ""
  const until = searchParams.get("until") || ""

  const tickers = new Set(
    tickersRaw
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter((t) => /^[A-Z][A-Z0-9.-]{0,6}$/.test(t)),
  )
  if (tickers.size === 0) {
    return NextResponse.json({ error: "No valid tickers" }, { status: 400 })
  }

  const today = new Date()
  const from = today.toISOString().split("T")[0]
  // Clamp horizon: at least tomorrow, at most 45 days out
  const untilDate = new Date(until)
  const maxHorizon = new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000)
  const to = (
    Number.isFinite(untilDate.getTime()) && untilDate > today && untilDate <= maxHorizon ? untilDate : maxHorizon
  )
    .toISOString()
    .split("T")[0]

  // Per-ticker earnings within [from, to] — one Finnhub call covers all tickers
  const earnings: Record<string, EarningsHit[]> = {}
  const finnhubKey = resolveApiKey("FINNHUB_API_KEY")
  let earningsSource = "unavailable"
  if (finnhubKey) {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${finnhubKey}`, {
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const data = await res.json()
        const rows: any[] = data.earningsCalendar || []
        for (const row of rows) {
          const symbol = (row.symbol || "").toUpperCase()
          if (!tickers.has(symbol)) continue
          const timing = row.hour === "bmo" ? "BMO" : row.hour === "amc" ? "AMC" : row.hour === "dmh" ? "DMH" : "TBD"
          if (!earnings[symbol]) earnings[symbol] = []
          earnings[symbol].push({ date: row.date, timing })
        }
        earningsSource = "finnhub"
      } else {
        console.error(`[v0] Landmine: Finnhub earnings HTTP ${res.status}`)
      }
    } catch (err) {
      console.error("[v0] Landmine: Finnhub earnings error:", err instanceof Error ? err.message : String(err))
    }
  }

  // Macro events within the window (pure date math, no API)
  const macro = generateCuratedEconomicEvents(today, new Date(to)).map((e) => ({
    date: e.date,
    event: e.event,
    impact: e.impact,
    time: e.time,
  }))

  console.log(
    `[v0] Landmine check: ${tickers.size} tickers, ${from} → ${to}, earnings hits for ${Object.keys(earnings).length} tickers (${earningsSource}), ${macro.length} macro events`,
  )

  return NextResponse.json({
    from,
    to,
    earnings,
    macro,
    earningsSource,
  })
}
