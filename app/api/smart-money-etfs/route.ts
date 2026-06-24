// Smart-Money ETF tracker — live prices for the ETFs that "copy" insider/
// congressional/hedge-fund flows. Uses Polygon's previous-close endpoint
// (free tier 5/min, the only API the user keeps paid). For each ETF we
// return: name, description, recent 1-day return, last close, and a curated
// short summary of what the ETF does.

import { NextResponse } from "next/server"
import { resolveApiKey } from "@/lib/api-keys"

export const dynamic = "force-dynamic"

interface ETFEntry {
  ticker: string
  name: string
  category: "Congress" | "Hedge Fund" | "Insider"
  summary: string
}

// Curated catalog of "follow-the-smart-money" ETFs.
const ETFS: ETFEntry[] = [
  {
    ticker: "NANC",
    name: "Unusual Whales Subversive Democratic Trading ETF",
    category: "Congress",
    summary: "Mirrors stock trades disclosed by Democratic members of Congress and their families. Updated monthly.",
  },
  {
    ticker: "KRUZ",
    name: "Unusual Whales Subversive Republican Trading ETF",
    category: "Congress",
    summary: "Mirrors stock trades disclosed by Republican members of Congress and their families. Updated monthly.",
  },
  {
    ticker: "GURU",
    name: "Global X Guru Index ETF",
    category: "Hedge Fund",
    summary: "Tracks top US-equity holdings of leading hedge funds as disclosed in their quarterly 13F filings.",
  },
  {
    ticker: "BRK.B",
    name: "Berkshire Hathaway Class B",
    category: "Hedge Fund",
    summary: "Warren Buffett's holding company — effectively a 'copy Buffett' shortcut without buying a $700K Class A share.",
  },
  {
    ticker: "ALFA",
    name: "AlphaClone Alternative Alpha ETF",
    category: "Hedge Fund",
    summary: "Mimics best ideas of hedge funds and institutional managers using a proprietary alpha-clone methodology.",
  },
]

interface PriceQuote {
  ticker: string
  close: number | null
  change: number | null
  changePct: number | null
  asOf: string | null
}

async function fetchPolygonPrev(ticker: string, apiKey: string): Promise<PriceQuote> {
  // Polygon uses a "." -> "-" convention for class B / preferred tickers.
  const polygonTicker = ticker.replace(".", "-")
  try {
    const res = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${polygonTicker}/prev?adjusted=true&apiKey=${apiKey}`,
      { next: { revalidate: 900 }, signal: AbortSignal.timeout(8000) }, // 15 min cache
    )
    if (!res.ok) return { ticker, close: null, change: null, changePct: null, asOf: null }
    const data = await res.json()
    const r = Array.isArray(data?.results) ? data.results[0] : null
    if (!r) return { ticker, close: null, change: null, changePct: null, asOf: null }
    const close = Number(r.c)
    const open = Number(r.o)
    const change = Number.isFinite(close - open) ? close - open : null
    const changePct = open ? ((close - open) / open) * 100 : null
    return {
      ticker,
      close: Number.isFinite(close) ? Math.round(close * 100) / 100 : null,
      change: change != null ? Math.round(change * 100) / 100 : null,
      changePct: changePct != null ? Math.round(changePct * 100) / 100 : null,
      asOf: r.t ? new Date(r.t).toISOString().slice(0, 10) : null,
    }
  } catch {
    return { ticker, close: null, change: null, changePct: null, asOf: null }
  }
}

export async function GET() {
  const apiKey = resolveApiKey("POLYGON_API_KEY")
  if (!apiKey) {
    return NextResponse.json({
      success: false,
      message: "Polygon API key not configured — prices unavailable.",
      etfs: ETFS.map((e) => ({ ...e, close: null, change: null, changePct: null, asOf: null })),
      generatedAt: new Date().toISOString(),
    })
  }

  // Fetch in parallel; Polygon free tier caps at 5 calls/min so this works
  // with the kept Polygon plan and our 15-min cache.
  const quotes = await Promise.all(ETFS.map((e) => fetchPolygonPrev(e.ticker, apiKey)))
  const merged = ETFS.map((entry, i) => ({ ...entry, ...quotes[i] }))

  return NextResponse.json({
    success: true,
    source: "Polygon.io",
    etfs: merged,
    generatedAt: new Date().toISOString(),
  })
}
