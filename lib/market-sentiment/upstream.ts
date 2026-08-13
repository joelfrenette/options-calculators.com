/**
 * Upstream fetchers for /api/market-sentiment: Yahoo quotes, the NYSE
 * highs/lows scrape, and the chart history.
 *
 * Split out of `app/api/market-sentiment/route.ts` (P6-13) unchanged, including
 * `DATA_SOURCES` — the record of which providers back which indicator, which is
 * a claim about this route and belongs beside the code making it.
 */
import { resolveApiKey } from "@/lib/api-keys"

/**
 * COMPREHENSIVE DATA SOURCE ANALYSIS & FALLBACK STRATEGY
 *
 * CNN Fear & Greed Index uses 7 indicators:
 * 1. Market Momentum (S&P 500 vs 125-day MA) - Yahoo Finance SPY/^GSPC - LIVE
 * 2. Stock Price Strength (52-week highs/lows) - Approximated from SPY momentum - CALCULATED
 * 3. Stock Price Breadth (McClellan Volume Summation) - Calculated from SPY volume patterns - CALCULATED
 * 4. Put/Call Ratio (5-day average) - Derived from VIX term structure - LIVE via CBOE
 * 5. Market Volatility (VIX vs 50-day MA) - Yahoo Finance ^VIX - LIVE
 * 6. Safe Haven Demand (20-day stock vs bond returns) - Yahoo SPY vs TLT - LIVE
 * 7. Junk Bond Demand (HY spread vs investment grade) - Yahoo HYG vs TLT - LIVE
 *
 * PRIMARY: CNN API (https://production.dataviz.cnn.io/index/fearandgreed/graphdata)
 * FALLBACK: Yahoo Finance + calculated indicators
 *
 * Data update frequency: Real-time during market hours, CNN updates continuously
 */

// Helper function to fetch Yahoo Finance data with timeout
export async function fetchYahooData(symbol: string, range = "1mo", timeout = 10000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`,
      { signal: controller.signal },
    )
    clearTimeout(timeoutId)

    if (!response.ok) throw new Error(`Yahoo Finance ${symbol} returned ${response.status}`)
    const data = await response.json()
    return data.chart.result[0]
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// SMA comes from the shared lib/indicators.ts (Phase 4). It returns null on
// short history — the old local copy silently averaged whatever bars were
// available, presenting a partial-window mean as the "125-day MA". Null is
// handled at the call sites below (neutral-50 component scores).

/**
 * CNN Fear & Greed Scale (0-100):
 * 0-24: Extreme Fear (RIGHT side of gradient bar, RED zone)
 * 25-44: Fear (CENTER-RIGHT, ORANGE zone)
 * 45-55: Neutral (CENTER, YELLOW zone)
 * 56-74: Greed (CENTER-LEFT, LIGHT GREEN zone)
 * 75-100: Extreme Greed (LEFT side of gradient bar, GREEN zone)
 */

// `calculateScoreFromData()` was deleted here. It was a SECOND seven-component
// Fear & Greed implementation, never called by anything, and it held the worst
// version of the defect P6-58/P6-61 describe. Of its seven "equal-weighted"
// components:
//
//   const putCallScore  = vixScore          // literally the same variable
//   const junkBondScore = vixScore * 0.9    // a scalar multiple of it
//   const safeHavenScore = momentumScore    // literally the same variable
//
// so vixScore was counted three times and momentumScore twice — **two
// instruments wearing seven names** — under the comment "Equal weighting as per
// CNN methodology". Its `nyseLows = 100, nyseHighs = 50` parameter defaults
// scored 33, a Fear reading, from no data at all.
//
// Deleted rather than fixed, following P6-34's precedent with the dead AI
// getters: a dormant function is where a defect waits for someone to wire it
// up. It is also the P6-72 lesson a second time in one file — the live sibling
// `calculateFallbackIndex` was repaired earlier today while this one sat
// untouched ten lines away.

export const DATA_SOURCES = {
  primary: {
    vix: "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX",
    spy: "https://query1.finance.yahoo.com/v8/finance/chart/SPY",
    hyg: "https://query1.finance.yahoo.com/v8/finance/chart/HYG",
    tlt: "https://query1.finance.yahoo.com/v8/finance/chart/TLT",
    nyse: "https://query1.finance.yahoo.com/v8/finance/chart/%5ENYA",
  },
  fallback: {
    cnn: "https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
  },
  scraping: {
    nyseHighsLows: resolveApiKey("SCRAPINGBEE_API_KEY") ? "https://www.barchart.com/stocks/highs-lows/highs" : null,
  },
}

export async function fetchNYSEHighsLows(): Promise<{ highs: number; lows: number } | null> {
  if (!resolveApiKey("SCRAPINGBEE_API_KEY")) {
    console.log("[v0] ScrapingBee API key not found, using calculated approximation")
    return null
  }

  try {
    const url = `https://app.scrapingbee.com/api/v1/?api_key=${resolveApiKey("SCRAPINGBEE_API_KEY")}&url=https://www.barchart.com/stocks/highs-lows/highs&render_js=false`
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) })

    if (!response.ok) {
      console.log(`[v0] ScrapingBee returned ${response.status}`)
      return null
    }

    const html = await response.text()
    // Parse NYSE highs/lows from HTML (simplified - actual parsing would be more robust)
    const highsMatch = html.match(/52-Week Highs.*?(\d+)/i)
    const lowsMatch = html.match(/52-Week Lows.*?(\d+)/i)

    if (highsMatch && lowsMatch) {
      return {
        highs: Number.parseInt(highsMatch[1]),
        lows: Number.parseInt(lowsMatch[1]),
      }
    }

    return null
  } catch (error) {
    console.error("[v0] Error fetching NYSE data via ScrapingBee:", error)
    return null
  }
}


// Function to fetch historical data for charts
export async function fetchHistoricalDataForCharts() {
  try {
    // Fetch 3 months of data for chart visualization
    const spyData = await fetchYahooData("SPY", "3mo")
    const vixData = await fetchYahooData("^VIX", "3mo")

    const timestamps = spyData.timestamp
    const spyPrices = spyData.indicators.quote[0].close.filter((p: number) => p !== null)
    const vixPrices = vixData.indicators.quote[0].close.filter((p: number) => p !== null)

    // Convert timestamps to dates
    const dates = timestamps.map((ts: number) => new Date(ts * 1000).toISOString().split("T")[0])

    return {
      dates: dates.slice(-60), // Last 60 days for chart
      spy: spyPrices.slice(-60),
      vix: vixPrices.slice(-60),
    }
  } catch (error) {
    console.error("[v0] Error fetching historical chart data:", error)
    return null
  }
}
