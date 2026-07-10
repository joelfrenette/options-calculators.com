import { type NextRequest, NextResponse } from "next/server"
import { getApiKey, resolveApiKey } from "@/lib/api-keys"

export const runtime = "edge"
export const dynamic = "force-dynamic"

// FMP stock-screener: proper universe, filters by market cap / volume / price
// server-side, pre-sorted by market cap desc. Returns null on error so the
// caller can fall through to the hardcoded Polygon list.
async function fetchFMPScreener(params: {
  minMarketCap: number
  minVolume: number
  maxPrice: number | null
  limit: number
}): Promise<string[] | null> {
  const key = resolveApiKey("FMP_API_KEY") // respects DISABLED_APIS
  if (!key) return null

  const qs = new URLSearchParams()
  if (params.minMarketCap > 0) qs.set("marketCapMoreThan", String(params.minMarketCap))
  if (params.minVolume > 0) qs.set("volumeMoreThan", String(params.minVolume))
  if (params.maxPrice != null) qs.set("priceLowerThan", String(params.maxPrice))
  qs.set("isActivelyTrading", "true")
  qs.set("isEtf", "false")
  qs.set("isFund", "false")
  qs.set("country", "US")
  qs.set("exchange", "nyse,nasdaq")
  qs.set("limit", String(Math.max(1, Math.min(1000, params.limit))))
  qs.set("apikey", key)

  const url = `https://financialmodelingprep.com/api/v3/stock-screener?${qs.toString()}`
  console.log(`[v0] FMP screener request: ${url.replace(key, "API_KEY")}`)

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) {
      console.error(`[v0] FMP screener HTTP ${res.status}`)
      return null
    }
    const rows: Array<{ symbol: string; marketCap?: number; price?: number; volume?: number }> = await res.json()
    if (!Array.isArray(rows)) {
      console.error(`[v0] FMP screener returned non-array`)
      return null
    }
    // FMP returns market-cap-desc by default; sort explicitly to be safe.
    rows.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    const tickers = rows
      .map((r) => (typeof r.symbol === "string" ? r.symbol.trim().toUpperCase() : ""))
      .filter((t) => t.length > 0 && /^[A-Z][A-Z0-9.-]{0,6}$/.test(t))
    console.log(
      `[v0] FMP screener returned ${tickers.length} tickers (top 5: ${tickers.slice(0, 5).join(", ")})`,
    )
    return tickers.slice(0, params.limit)
  } catch (err) {
    console.error(`[v0] FMP screener fetch error:`, err instanceof Error ? err.message : String(err))
    return null
  }
}

// Cached common-stock allowlist. Polygon's Grouped Daily Bars returns EVERY
// security (ETFs, warrants, ADRs, ETNs, preferreds) with no type field, so we
// intersect its results against Polygon's /v3/reference/tickers?type=CS list —
// the canonical US common-stock universe — before returning. The reference
// list changes slowly (new IPOs / delistings), so a 6-hour in-memory cache is
// plenty and keeps the CS fetch out of the hot path for repeat requests within
// the same edge isolate.
let CS_ALLOWLIST_CACHE: { set: Set<string>; expiresAt: number } | null = null
const CS_ALLOWLIST_TTL_MS = 6 * 60 * 60 * 1000 // 6h

async function fetchPolygonCommonStocksAllowlist(): Promise<Set<string> | null> {
  const now = Date.now()
  if (CS_ALLOWLIST_CACHE && CS_ALLOWLIST_CACHE.expiresAt > now) {
    console.log(`[v0] CS allowlist cache hit (${CS_ALLOWLIST_CACHE.set.size} tickers)`)
    return CS_ALLOWLIST_CACHE.set
  }

  const key = resolveApiKey("POLYGON_API_KEY")
  if (!key) return null

  const tickers = new Set<string>()
  let url = `https://api.polygon.io/v3/reference/tickers?market=stocks&type=CS&active=true&limit=1000&apiKey=${key}`
  for (let page = 0; page < 6; page++) {
    // hard cap at 6 pages (6000 CS tickers) to stay under the edge budget.
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) {
        console.log(`[v0] CS allowlist page ${page} HTTP ${res.status}`)
        break
      }
      const data = await res.json()
      const rows: any[] = Array.isArray(data.results) ? data.results : []
      for (const r of rows) {
        if (typeof r.ticker === "string") tickers.add(r.ticker.toUpperCase())
      }
      if (!data.next_url) break
      // next_url comes back WITHOUT apiKey — append it.
      url = `${data.next_url}&apiKey=${key}`
    } catch (err) {
      console.error(
        `[v0] CS allowlist page ${page} error:`,
        err instanceof Error ? err.message : String(err),
      )
      break
    }
  }

  if (tickers.size === 0) return null
  console.log(`[v0] CS allowlist fetched: ${tickers.size} common-stock tickers`)
  CS_ALLOWLIST_CACHE = { set: tickers, expiresAt: now + CS_ALLOWLIST_TTL_MS }
  return tickers
}

// Polygon Grouped Daily Bars — one free call returns prev-day OHLCV for the entire
// US stock market (~10k tickers). Ideal for a proper Step-2 universe: server-side
// filtering by price + volume, sorted by dollar volume (best free proxy for the
// combination of size + liquidity + options interest). No per-ticker enrichment
// loop, so the request stays well under Vercel's edge timeout.
async function fetchPolygonGroupedBars(params: {
  minVolume: number
  maxPrice: number | null
  limit: number
}): Promise<{ ticker: string; price: number; volume: number }[] | null> {
  const key = resolveApiKey("POLYGON_API_KEY")
  if (!key) return null

  // Kick off the CS allowlist fetch in parallel with the grouped bars call.
  // If it fails, we degrade to unfiltered grouped bars (better than nothing).
  const allowlistPromise = fetchPolygonCommonStocksAllowlist()

  // The grouped endpoint needs a specific TRADING day. Weekends and market holidays
  // 404. Try the 5 most recent calendar days and use whichever has data.
  const now = new Date()
  const attempts: string[] = []
  for (let daysBack = 1; daysBack <= 5; daysBack++) {
    const d = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    const dow = d.getUTCDay()
    if (dow === 0 || dow === 6) continue
    attempts.push(d.toISOString().slice(0, 10))
  }

  for (const date of attempts) {
    const url = `https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${date}?adjusted=true&apiKey=${key}`
    console.log(`[v0] Polygon grouped bars: trying date=${date}`)
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
      if (!res.ok) {
        console.log(`[v0] Polygon grouped bars ${date} HTTP ${res.status}`)
        continue
      }
      const data = await res.json()
      const results: any[] = Array.isArray(data.results) ? data.results : []
      if (results.length === 0) {
        console.log(`[v0] Polygon grouped bars ${date} empty — trying older date`)
        continue
      }

      // Basic sanity filter to drop warrants, preferreds, units, ETNs, etc.
      // Real US common stocks are 1–5 alpha chars (BRK.B etc. are represented as "BRKB"
      // in Polygon grouped bars — we handle Class-B rename downstream via DUPLICATE_TICKERS).
      const filtered = results
        .map((r) => ({
          ticker: (typeof r.T === "string" ? r.T : "").toUpperCase(),
          price: Number(r.c) || 0,
          volume: Number(r.v) || 0,
        }))
        .filter((r) => {
          if (!r.ticker || r.ticker.length === 0 || r.ticker.length > 5) return false
          if (!/^[A-Z]+$/.test(r.ticker)) return false
          if (r.price <= 0 || r.volume <= 0) return false
          if (params.minVolume > 0 && r.volume < params.minVolume) return false
          if (params.maxPrice != null && r.price > params.maxPrice) return false
          return true
        })

      // Await the allowlist and intersect. Grouped bars contain ETFs, warrants,
      // preferreds, ETNs, ADRs — none of which have income statements, so
      // Step 3 would reject them anyway. Strip them here for a cleaner Step 2.
      const allowlist = await allowlistPromise
      const csFiltered = allowlist ? filtered.filter((r) => allowlist.has(r.ticker)) : filtered

      // Sort by dollar volume desc — proxy for "biggest liquid names first".
      csFiltered.sort((a, b) => b.price * b.volume - a.price * a.volume)
      const top = csFiltered.slice(0, Math.min(1000, params.limit))
      console.log(
        `[v0] Polygon grouped bars ${date}: ${results.length} total → ${filtered.length} pass price/vol → ${csFiltered.length} after CS allowlist (${allowlist ? "applied" : "unavailable, skipped"}) → returning top ${top.length}`,
      )
      return top
    } catch (err) {
      console.error(
        `[v0] Polygon grouped bars ${date} error:`,
        err instanceof Error ? err.message : String(err),
      )
      continue
    }
  }

  return null
}

// Map of duplicate tickers - key is the ticker to remove, value is the primary ticker to keep
const DUPLICATE_TICKERS: Record<string, string> = {
  GOOG: "GOOGL", // Alphabet Class C → Class A (more liquid)
  "BRK.A": "BRK.B", // Berkshire Hathaway Class A → Class B (more accessible)
}

// Hardcoded lists of major index constituents (updated periodically)
// These are the Top 100 most liquid stocks from S&P 500, Nasdaq-100, and Dow 30
const MAJOR_INDEX_TICKERS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "GOOGL",
  "GOOG",
  "AMZN",
  "META",
  "BRK.B",
  "AVGO",
  "TSLA",
  "LLY",
  "JPM",
  "V",
  "UNH",
  "WMT",
  "XOM",
  "MA",
  "PG",
  "JNJ",
  "HD",
  "COST",
  "NFLX",
  "BAC",
  "CRM",
  "ABBV",
  "CVX",
  "KO",
  "ORCL",
  "MRK",
  "AMD",
  "PEP",
  "ADBE",
  "ACN",
  "TMO",
  "CSCO",
  "MCD",
  "LIN",
  "ABT",
  "WFC",
  "INTC",
  "GE",
  "INTU",
  "DHR",
  "IBM",
  "VZ",
  "TXN",
  "CMCSA",
  "AMGN",
  "QCOM",
  "PM",
  "CAT",
  "NOW",
  "ISRG",
  "RTX",
  "UNP",
  "LOW",
  "HON",
  "SPGI",
  "T",
  "NEE",
  "PLD",
  "UBER",
  "BA",
  "ELV",
  "COP",
  "BKNG",
  "GS",
  "SYK",
  "AXP",
  "DE",
  "BLK",
  "MS",
  "VRTX",
  "TJX",
  "MDT",
  "PGR",
  "LMT",
  "GILD",
  "SCHW",
  "ADP",
  "MMC",
  "PANW",
  "CB",
  "ADI",
  "C",
  "SLB",
  "MDLZ",
  "ETN",
  "BMY",
  "AMT",
  "SO",
  "REGN",
  "CI",
  "FI",
  "TMUS",
  "BSX",
  "ZTS",
  "LRCX",
  "AMAT",
  "MU",
  "DUK",
  "EOG",
  "PH",
  "BDX",
  "APH",
  "PNC",
  "SNPS",
  "NOC",
  "SHW",
  "USB",
  "GD",
  "CL",
  "TGT",
  "MCO",
  "AON",
  "WELL",
  "ICE",
  "EMR",
  "KLAC",
  "EQIX",
  "ITW",
  "PSX",
  "APD",
  "CMG",
  "MAR",
  "HCA",
  "HUM",
  "FCX",
  "CSX",
  "NSC",
  "WM",
  "MCK",
  "PYPL",
  "AJG",
  "CME",
  "MPC",
  "COF",
  "GM",
  "F",
  "ABNB",
  "ECL",
  "AFL",
  "TT",
  "APO",
  "SRE",
  "TDG",
  "CCI",
  "CARR",
  "PCAR",
  "AIG",
  "NEM",
  "JCI",
  "ALL",
  "ROP",
  "AEP",
  "TFC",
  "AZO",
  "PSA",
  "KMI",
  "NXPI",
  "PEG",
  "MSCI",
  "ROST",
  "CNC",
  "RSG",
  "PCG",
  "VLO",
  "ORLY",
  "GWW",
  "CVS",
  "O",
  "CHTR",
  "DLR",
  "MCHP",
  "ADSK",
  "PAYX",
  "CPRT",
  "CTVA",
  "EW",
  "SYY",
  "PLTR",
  "PFE",
]

interface TickerData {
  ticker: string
  volume: number
  marketCap: number
  price: number
}

export async function GET(request: NextRequest) {
  try {
    const POLYGON_API_KEY = getApiKey("POLYGON_API_KEY")

    if (!POLYGON_API_KEY) {
      return NextResponse.json({ error: "Polygon API key not configured" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const minMarketCap = Number.parseFloat(searchParams.get("minMarketCap") || "0")
    const minVolume = Number.parseFloat(searchParams.get("minVolume") || "0")
    const limit = Number.parseInt(searchParams.get("limit") || "500")
    // Step 1 dollar ceiling. Anything ≥ 1000 (or absent) is treated as "no cap".
    const maxPriceRaw = Number.parseFloat(searchParams.get("maxPrice") || "0")
    const maxPrice = maxPriceRaw > 0 && maxPriceRaw < 1000 ? maxPriceRaw : null

    console.log(
      `[v0] Ticker screener request: minMarketCap=${minMarketCap}, minVolume=${minVolume}, maxPrice=${maxPrice ?? "none"}, limit=${limit}`,
    )

    // Preferred: FMP stock-screener does all filtering server-side and
    // returns up to `limit` tickers pre-sorted by market cap. Requires a
    // paid FMP tier — returns null / HTTPS 403 on the free plan.
    const fmpTickers = await fetchFMPScreener({ minMarketCap, minVolume, maxPrice, limit })
    if (fmpTickers && fmpTickers.length > 0) {
      console.log(`[v0] Returning ${fmpTickers.length} tickers from FMP screener`)
      return NextResponse.json({
        tickers: fmpTickers,
        count: fmpTickers.length,
        source: "fmp-screener",
      })
    }

    // Next best: Polygon Grouped Daily Bars — one free call, whole US market
    // (~10k tickers) with price+volume. Filters by price/volume server-side,
    // sorts by dollar volume as a market-cap proxy. Skips the market-cap
    // threshold (unavailable in grouped bars); Step 3's per-ticker fundamentals
    // scan applies the real market-cap filter downstream.
    const groupedRows = await fetchPolygonGroupedBars({ minVolume, maxPrice, limit })
    if (groupedRows && groupedRows.length > 0) {
      const tickers = groupedRows.map((r) => r.ticker)
      console.log(
        `[v0] Returning ${tickers.length} tickers from Polygon grouped bars (top 5: ${tickers.slice(0, 5).join(", ")})`,
      )
      return NextResponse.json({
        tickers,
        count: tickers.length,
        source: "polygon-grouped-bars",
        note:
          minMarketCap > 0
            ? "Market cap threshold not applied at this stage (grouped bars have no market cap). Step 3 fundamentals scan enforces it per ticker."
            : undefined,
      })
    }
    console.log(`[v0] FMP + grouped bars unavailable — falling back to hardcoded Polygon universe`)

    async function fetchWithRetry(url: string, maxRetries = 3, timeoutMs = 10000): Promise<Response | null> {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

          const response = await fetch(url, {
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          // If rate limited, wait and retry
          if (response.status === 429) {
            const delay = Math.pow(2, attempt) * 1000 // Exponential backoff: 1s, 2s, 4s
            console.log(`[v0] Rate limited, retrying in ${delay}ms...`)
            await new Promise((resolve) => setTimeout(resolve, delay))
            continue
          }

          // Return response for both success and error cases (let caller handle)
          return response
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          console.error(`[v0] Fetch attempt ${attempt + 1} failed:`, errorMsg)
          if (attempt === maxRetries - 1) return null
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        }
      }
      return null
    }

    const tickersWithData: TickerData[] = []

    // Fetch data for all major index tickers in batches
    const batchSize = 100
    for (let i = 0; i < MAJOR_INDEX_TICKERS.length; i += batchSize) {
      const batch = MAJOR_INDEX_TICKERS.slice(i, i + batchSize)
      const tickerSymbols = batch.join(",")

      try {
        const snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickerSymbols}&apiKey=${POLYGON_API_KEY}`
        const snapshotResponse = await fetchWithRetry(snapshotUrl)

        if (snapshotResponse?.ok) {
          const snapshotData = await snapshotResponse.json()
          const snapshots = snapshotData.tickers || []

          for (const snapshot of snapshots) {
            const volume = snapshot.prevDay?.v || snapshot.day?.v || 0
            const price = snapshot.prevDay?.c || snapshot.day?.c || 0

            console.log(`[v0] ${snapshot.ticker}: price=$${price.toFixed(2)} volume=${(volume / 1e6).toFixed(1)}M`)

            // Apply volume + Step-1 price filter (prev day's numbers)
            if (volume >= minVolume && (maxPrice == null || price <= maxPrice)) {
              tickersWithData.push({
                ticker: snapshot.ticker,
                volume: volume,
                marketCap: 0, // Will fetch separately
                price: price,
              })
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`[v0] Error fetching snapshot batch:`, error)
      }
    }

    console.log(`[v0] ${tickersWithData.length} tickers passed volume filter (>= ${minVolume})`)

    // Enrichment loop is sequential w/ 300ms delay per ticker so cap at ~60
    // to stay under Vercel's 25s edge budget. This is a LAST-RESORT fallback —
    // the FMP + grouped-bars paths above are the real universes.
    const enrichCap = Math.min(60, Math.max(30, limit))
    const tickersToEnrich = tickersWithData.slice(0, enrichCap)
    console.log(`[v0] Fetching market cap for top ${tickersToEnrich.length} tickers (enrichCap=${enrichCap}, last-resort path)`)

    // Fetch market cap for tickers that passed volume filter
    const tickersWithMarketCap: TickerData[] = []
    let failedFetches = 0

    for (const tickerData of tickersToEnrich) {
      try {
        const detailsUrl = `https://api.polygon.io/v3/reference/tickers/${tickerData.ticker}?apiKey=${POLYGON_API_KEY}`
        const detailsResponse = await fetchWithRetry(detailsUrl, 2, 5000) // Reduced retries to 2 and timeout to 5s

        if (detailsResponse?.ok) {
          try {
            const detailsData = await detailsResponse.json()
            const marketCap = detailsData.results?.market_cap || 0

            // Apply market cap filter
            if (marketCap >= minMarketCap) {
              tickersWithMarketCap.push({
                ...tickerData,
                marketCap: marketCap,
              })
            }
          } catch (jsonError) {
            console.error(`[v0] Failed to parse JSON for ${tickerData.ticker}`)
            failedFetches++
          }
        } else if (detailsResponse) {
          console.log(`[v0] Failed to fetch ${tickerData.ticker}: status ${detailsResponse.status}`)
          failedFetches++
        } else {
          failedFetches++
        }

        await new Promise((resolve) => setTimeout(resolve, 300)) // Reduced delay to 300ms
      } catch (error) {
        failedFetches++
      }
    }

    console.log(`[v0] Successfully fetched ${tickersWithMarketCap.length} tickers, ${failedFetches} failed`)

    // Sort by market cap descending
    tickersWithMarketCap.sort((a, b) => b.marketCap - a.marketCap)

    const deduplicatedTickers: TickerData[] = []
    const includedTickers = new Set<string>()

    for (const tickerData of tickersWithMarketCap) {
      const ticker = tickerData.ticker

      // Check if this is a duplicate ticker that should be skipped
      const primaryTicker = DUPLICATE_TICKERS[ticker]

      if (primaryTicker) {
        // This is a duplicate - only include if the primary ticker isn't already included
        if (!includedTickers.has(primaryTicker)) {
          // Primary not included yet, so include this duplicate for now
          deduplicatedTickers.push(tickerData)
          includedTickers.add(ticker)
        }
        // If primary is already included, skip this duplicate
      } else {
        // Not a duplicate - include it
        deduplicatedTickers.push(tickerData)
        includedTickers.add(ticker)
      }
    }

    console.log(
      `[v0] After deduplication: ${deduplicatedTickers.length} tickers (removed ${tickersWithMarketCap.length - deduplicatedTickers.length} duplicates)`,
    )

    const finalTickers = deduplicatedTickers.slice(0, limit).map((t) => t.ticker)

    if (tickersWithMarketCap.length > 0) {
      console.log(`[v0] Returning top ${finalTickers.length} tickers:`, finalTickers.slice(0, 10))
      console.log(
        `[v0] Market cap range: $${(tickersWithMarketCap[0]?.marketCap / 1e9).toFixed(2)}B to $${(tickersWithMarketCap[Math.min(limit, tickersWithMarketCap.length) - 1]?.marketCap / 1e9).toFixed(2)}B`,
      )
    }

    return NextResponse.json({
      tickers: finalTickers,
      count: finalTickers.length,
      source: "polygon-hardcoded-fallback",
    })
  } catch (error) {
    console.error("[v0] Error in polygon-tickers API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
