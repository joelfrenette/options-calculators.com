import { NextResponse } from "next/server"
// P6-13. This route was 1,140 lines. Its body is now `lib/market-sentiment/`:
// `stored-indicators.ts` (what this site computes from its own stored closes),
// `upstream.ts` (Yahoo, the NYSE highs/lows scrape, chart history),
// `scoring.ts` (the seven component scores, pure arithmetic and network-free),
// `fallback-index.ts` (this site's own Fear & Greed, used when the scrape
// fails) and `cnn-scrape.ts`. What is left here is the cache policy and GET.
import { NOT_TRACKED, fetchStoredRawIndicators } from "@/lib/market-sentiment/stored-indicators"
import { DATA_SOURCES, fetchHistoricalDataForCharts, fetchYahooData } from "@/lib/market-sentiment/upstream"
import { calculateMarketVolatility } from "@/lib/market-sentiment/scoring"
import { calculateFallbackIndex } from "@/lib/market-sentiment/fallback-index"
import { getIndicatorDescription, scrapeCNNFearGreed } from "@/lib/market-sentiment/cnn-scrape"


const CACHE_VERSION = "10.0" // Increment version to invalidate cache with missing indicator sentiments
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function GET(request: Request) {
  try {
    console.log("[v0] ====== FETCHING REAL CNN DATA ======")

    const scrapedData = await scrapeCNNFearGreed()

    const chartData = await fetchHistoricalDataForCharts()

    if (scrapedData) {
      console.log(`[v0] ✓ Successfully scraped CNN: Score ${scrapedData.score}/100 (${scrapedData.sentiment})`)
      console.log(`[v0] CNN Indicators scraped:`)
      scrapedData.indicators.forEach((ind, idx) => {
        console.log(`[v0]   ${idx + 1}. ${ind.name}: ${ind.score}/100 (${ind.sentiment || "NO SENTIMENT"})`)
      })

      // P3-18. A change exists only where a historical point does, and the
      // scrape supplies none — so all four are null rather than a computed 0.0.
      const delta = (past: number | null) =>
        typeof past === "number" && Number.isFinite(scrapedData.score - past)
          ? Math.round((scrapedData.score - past) * 10) / 10
          : null
      const yesterdayChange = delta(scrapedData.historical.yesterday)
      const lastWeekChange = delta(scrapedData.historical.lastWeek)
      const lastMonthChange = delta(scrapedData.historical.lastMonth)
      const lastYearChange = delta(scrapedData.historical.lastYear)

      const fmtDelta = (d: number | null) => (d === null ? "not supplied" : d.toFixed(1))
      console.log(
        `[v0] Historical Changes: Yesterday=${fmtDelta(yesterdayChange)}, Week=${fmtDelta(lastWeekChange)}, Month=${fmtDelta(lastMonthChange)}, Year=${fmtDelta(lastYearChange)}`,
      )

      // Also fetch live Yahoo data for the raw indicator values
      const [vixData, spyData] = await Promise.all([fetchYahooData("^VIX"), fetchYahooData("SPY", "6mo")])

      // P6-22: stored VIX first (E-7c snapshot), the live Yahoo meta price
      // only as the fallback.
      const stored = await fetchStoredRawIndicators()
      const rawVix = vixData?.meta?.regularMarketPrice
      const vixPrice = stored.vix ?? (Number.isFinite(rawVix) ? Number(rawVix) : null)

      // Was `const putCallRatio = 1.0 // Default neutral put/call ratio`, then
      // reported as a measured figure under a "Live Raw Data" log line. Nothing
      // here fetches a put/call ratio, so the honest value is null.
      const putCallRatio: number | null = null

      // SPY momentum vs its 125-day MA. The old code divided by a hardcoded 125
      // regardless of how many closes came back, so a short series produced a
      // deflated MA and a wildly overstated momentum percentage.
      const spyPrices: number[] = spyData?.indicators?.quote?.[0]?.close?.filter((p: number) => p !== null) || []
      let spyMomentumPct: number | null = stored.stockPriceMomentum
      if (spyMomentumPct === null && spyPrices.length >= 125) {
        const window = spyPrices.slice(-125)
        const ma125 = window.reduce((a: number, b: number) => a + b, 0) / window.length
        const currentSPY = spyPrices[spyPrices.length - 1]
        if (ma125 > 0) spyMomentumPct = ((currentSPY - ma125) / ma125) * 100
      }

      const num = (v: number | null) => (v === null ? "unavailable" : v.toFixed(2))
      console.log(
        `[v0] Live Raw Data: VIX=${num(vixPrice)}, Put/Call=${num(putCallRatio)}, SPY Momentum=${num(spyMomentumPct)}%`,
      )

      const scrapedComponent = (needle: string) =>
        scrapedData.indicators.find((i) => i.name.toLowerCase().includes(needle))?.score ?? null

      return NextResponse.json({
        score: scrapedData.score, // Added missing 'score' field for client compatibility
        overallScore: scrapedData.score,
        sentiment: scrapedData.sentiment,
        // P3-18. `trend` was derived from a change that was structurally 0 on
        // this path, so the scrape branch reported "neutral" on every request
        // regardless of what the market did — a direction asserted from an
        // arithmetic identity. Null when there is no prior point to compare to.
        trend: (yesterdayChange === null
          ? null
          : yesterdayChange > 1
            ? "up"
            : yesterdayChange < -1
              ? "down"
              : "neutral") as "up" | "down" | "neutral" | null,
        yesterdayChange,
        lastWeekChange,
        lastMonthChange,
        lastYearChange,
        cnnComponents: scrapedData.indicators.map((ind) => ({
          name: ind.name,
          score: ind.score,
          description: ind.description,
          sentiment: ind.sentiment,
        })),
        chartData: chartData || { dates: [], spy: [], vix: [] },
        // Missing components are null, not 0. `|| 0` put a real reading at the
        // bottom of a 0-100 fear scale — "EXTREME FEAR" — whenever CNN's page
        // simply did not carry that indicator.
        marketVolatility: vixPrice,
        vix: vixPrice,
        vix50DayMA: stored.vix50DayMA,
        putCallRatio,
        stockPriceMomentum: spyMomentumPct,
        notTracked: NOT_TRACKED,
        stockPriceStrength: scrapedComponent("strength"),
        stockPriceBreadth: scrapedComponent("breadth"),
        junkBondSpread: scrapedComponent("junk"),
        safeHavenDemand: scrapedComponent("safe"),
        lastUpdate: new Date().toISOString(),
        dataSource: "CNN (Scraped)",
      })
    }

    console.log("[v0] Scraping failed, trying CNN API directly...")
    const cnnResponse = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!cnnResponse.ok) {
      throw new Error(`CNN API returned ${cnnResponse.status} - ${cnnResponse.statusText}`)
    }

    const cnnData = await cnnResponse.json()
    console.log(`[v0] ✓ CNN API Success: Score ${cnnData.fear_and_greed?.score}/100`)

    // The headline score is the whole tab. `|| 50` painted a measured-looking
    // "Neutral 50" gauge whenever CNN's payload lacked a score — fail instead,
    // the catch below returns a real error the UI already renders.
    const rawCnnScore = cnnData.fear_and_greed?.score
    if (!Number.isFinite(rawCnnScore)) {
      throw new Error("CNN API returned no fear_and_greed score")
    }
    const cnnScore = Number(rawCnnScore)
    const cnnSentiment = cnnData.fear_and_greed?.rating?.toLowerCase() || "neutral"

    // CNN API returns indicators in fear_and_greed_historical.data array
    const cnnIndicators = cnnData.fear_and_greed_historical?.data || []

    console.log(`[v0] CNN API raw data structure:`, JSON.stringify(cnnData.fear_and_greed, null, 2))
    console.log(`[v0] CNN returned ${cnnIndicators.length} historical data points`)

    // Try to extract current indicator values from the most recent data point
    let indicatorValues: any[] = []
    if (cnnIndicators.length > 0) {
      // Get the most recent data point (today)
      const latestData = cnnIndicators[0]
      console.log(`[v0] Latest CNN data point:`, JSON.stringify(latestData, null, 2))

      // Extract indicator scores from the latest data
      if (latestData && typeof latestData === "object") {
        const dataKeys = Object.keys(latestData)
        console.log(`[v0] Available data keys:`, dataKeys.join(", "))

        // First key CNN actually supplies wins; absent from all of them means
        // absent, not 50. `|| 50` sat a fabricated neutral reading in the
        // middle of a 0-100 fear scale and it rendered like a measurement.
        const firstScore = (...keys: string[]): number | null => {
          for (const k of keys) {
            const v = latestData[k]
            if (Number.isFinite(v)) return Number(v)
          }
          return null
        }

        // Map CNN API keys to our indicator names
        indicatorValues = [
          {
            name: "Market Momentum",
            score: firstScore("momentum_score", "market_momentum_score", "sp500_momentum"),
            description: "S&P 500 vs 125-day MA",
          },
          {
            name: "Stock Price Strength",
            score: firstScore("strength_score", "price_strength", "stock_strength"),
            description: "52-week highs vs lows",
          },
          {
            name: "Stock Price Breadth",
            score: firstScore("breadth_score", "price_breadth", "mcclellan"),
            description: "McClellan Volume Summation",
          },
          {
            name: "Put and Call Options",
            score: firstScore("options_score", "put_call", "put_call_ratio"),
            description: "5-day average ratio",
          },
          {
            name: "Market Volatility",
            score: firstScore("volatility_score", "vix_score", "market_volatility"),
            description: "VIX vs 50-day MA",
          },
          {
            name: "Safe Haven Demand",
            score: firstScore("safe_haven_score", "bonds_score", "safe_haven"),
            description: "20-day stock vs bond returns",
          },
          {
            name: "Junk Bond Demand",
            score: firstScore("junk_bond_score", "junk_demand", "credit_spread"),
            description: "Yield spread analysis",
          },
        ]
      }
    }

    // If no indicator values extracted, calculate from live market data.
    // Sentinel was `every(score === 50)`, which only worked because the missing
    // case WAS 50; it now tests for the absence it means to test for.
    if (indicatorValues.length === 0 || indicatorValues.every((i) => i.score === null)) {
      console.log("[v0] No indicator data from CNN API, calculating from live market data...")
      const fallbackData = await calculateFallbackIndex()

      indicatorValues = fallbackData.components.map((comp) => ({
        name: comp.name,
        score: comp.value,
        description: comp.description,
      }))

      console.log("[v0] Using calculated indicator values from live market data")
    }

    const finalIndicators = indicatorValues.map((ind, index) => {
      const indicatorScore: number | null = ind.score ?? null

      // A null score has no sentiment. Every comparison below is false against
      // null, so the old code labelled unknown indicators "NEUTRAL".
      let sentiment: string | null = null
      if (indicatorScore !== null) {
        sentiment = "NEUTRAL"
        if (indicatorScore < 25) sentiment = "EXTREME FEAR"
        else if (indicatorScore < 45) sentiment = "FEAR"
        else if (indicatorScore >= 55 && indicatorScore < 75) sentiment = "GREED"
        else if (indicatorScore >= 75) sentiment = "EXTREME GREED"
      }

      console.log(
        `[v0] Indicator ${index + 1} - ${ind.name}: ${indicatorScore === null ? "unavailable" : `${indicatorScore}/100 (${sentiment})`}`,
      )

      return {
        name: ind.name,
        score: indicatorScore,
        description: ind.description,
        sentiment,
      }
    })

    console.log(`[v0] Final indicators count: ${finalIndicators.length}`)

    const storedRaw = await fetchStoredRawIndicators()

    const componentScore = (needle: string): number | null =>
      finalIndicators.find((i) => i.name.toLowerCase().includes(needle))?.score ?? null
    const volatilityScore = componentScore("volatility")

    const yesterdayData = await fetchYahooData("^VIX", "5d")
    const weekAgoData = await fetchYahooData("^VIX", "2mo")

    const vixHistorical = yesterdayData.indicators.quote[0].close.filter((p: number) => p !== null)
    const vixYesterday = vixHistorical[vixHistorical.length - 2] || 0
    const vixWeekAgo =
      weekAgoData.indicators.quote[0].close.filter((p: number) => p !== null)[Math.max(0, vixHistorical.length - 7)] ||
      0

    const yesterdayScore = calculateMarketVolatility(vixYesterday)
    const lastWeekScore = calculateMarketVolatility(vixWeekAgo)

    const yesterdayChange = isFinite(cnnScore - yesterdayScore) ? cnnScore - yesterdayScore : 0
    const lastWeekChange = isFinite(cnnScore - lastWeekScore) ? cnnScore - lastWeekScore : 0
    const lastMonthChange = isFinite(cnnScore - lastWeekScore * 1.2) ? cnnScore - lastWeekScore * 1.2 : 0
    const lastYearChange = isFinite(cnnScore - lastWeekScore * 2) ? cnnScore - lastWeekScore * 2 : 0

    console.log(
      `[v0] Historical Changes: Yesterday=${yesterdayChange.toFixed(1)}, Week=${lastWeekChange.toFixed(1)}, Month=${lastMonthChange.toFixed(1)}, Year=${lastYearChange.toFixed(1)}`,
    )

    return NextResponse.json({
      score: cnnScore,
      overallScore: cnnScore,
      sentiment: cnnSentiment,
      lastUpdated: new Date().toISOString(),
      trend: cnnScore > 50 ? ("up" as const) : cnnScore < 50 ? ("down" as const) : ("neutral" as const),
      yesterdayChange,
      lastWeekChange,
      lastMonthChange,
      lastYearChange,

      cnnComponents: finalIndicators,

      chartData: chartData || { dates: [], spy: [], vix: [] },

      // These five shipped as literal 0 on every response — not a fallback, a
      // constant. Nothing in this branch measures them, so they are null and
      // the UI renders "—".
      // P6-22: measured from the stored VIXCLS and SPY closes the E-7c
      // snapshot writes. Null only when the store genuinely cannot serve them.
      vix: storedRaw.vix,
      vix50DayMA: storedRaw.vix50DayMA,
      putCallRatio: null, // no free source — see NOT_TRACKED
      stockPriceMomentum: storedRaw.stockPriceMomentum,
      stockPriceStrength: componentScore("strength"),
      stockPriceBreadth: componentScore("breadth"),
      junkBondSpread: componentScore("junk"),
      safeHavenDemand: componentScore("safe"),

      volatilitySkew: null,
      openInterestPutCall: null,
      vixTermStructure: componentScore("volatility"),
      // Was `100 - (… ?? 50)`, which returned a confident 50 when the
      // volatility component was missing. Null in, null out.
      cboeSkewIndex: volatilityScore === null ? null : 100 - volatilityScore,

      // Components CNN did not supply, so a consumer cannot mistake a "—" for
      // a rendering bug.
      unavailableComponents: finalIndicators.filter((i) => i.score === null).map((i) => i.name),
      notTracked: NOT_TRACKED,
      dataSource: "CNN API + Live Market Data",
      methodology:
        "CNN's published Fear & Greed component scores. Components CNN did not return are reported as null and excluded — never substituted with a neutral 50.",
    })
  } catch (error) {
    console.error("[v0] ✗ All CNN data sources failed:", error)
    console.log("[v0] Returning error - no fallback calculations")

    return NextResponse.json(
      {
        error: "Unable to fetch CNN Fear & Greed data. Please refresh the page.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    )
  }
}

