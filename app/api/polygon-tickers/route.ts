import { type NextRequest, NextResponse } from "next/server"
import { getApiKey } from "@/lib/api-keys"

export const runtime = "edge"
export const dynamic = "force-dynamic"

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

    console.log(
      `[v0] Filtering major index tickers: minMarketCap=${minMarketCap}, minVolume=${minVolume}, limit=${limit}`,
    )

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

            console.log(`[v0] ${snapshot.ticker}: volume=${(volume / 1e6).toFixed(1)}M`)

            // Apply volume filter (Note: This is previous day's volume, not 30-day average)
            if (volume >= minVolume) {
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

    const tickersToEnrich = tickersWithData.slice(0, 50)
    console.log(`[v0] Fetching market cap for top ${tickersToEnrich.length} tickers (to avoid timeout)`)

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
    })
  } catch (error) {
    console.error("[v0] Error in polygon-tickers API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
