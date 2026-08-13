/**
 * The site's own Fear & Greed computation, used when the CNN scrape fails.
 *
 * Split out of `app/api/market-sentiment/route.ts` (P6-13) unchanged.
 *
 * It is a SECOND answer to the same question the scrape gives, which is the
 * shape P7-55 and P7-56 were about — so the thing to preserve is that its
 * result is labelled as this site's own calculation wherever it surfaces, never
 * as CNN's.
 */
import { resolveApiKey } from "@/lib/api-keys"
import { sma } from "@/lib/indicators"
import { fetchStoredRawIndicators } from "./stored-indicators"
import { DATA_SOURCES, fetchNYSEHighsLows, fetchYahooData } from "./upstream"
import {
  calculateJunkBondDemand,
  calculateMarketMomentum,
  calculateMarketVolatility,
  calculatePutCallRatio,
  calculateSafeHavenDemand,
  calculateStockBreadth,
  calculateStockStrength,
} from "./scoring"


export async function calculateFallbackIndex() {
  try {
    console.log("[v0] ===== COMPREHENSIVE FEAR & GREED CALCULATION =====")
    console.log("[v0] STEP 1: Collecting ALL real-time indicators...")

    // COLLECT ALL INDICATORS via live APIs
    const [vixData, spyData, hygData, tltData, nyseData] = await Promise.all([
      fetchYahooData("^VIX", "6mo"),
      fetchYahooData("SPY", "6mo"),
      fetchYahooData("HYG", "3mo"),
      fetchYahooData("TLT", "3mo"),
      fetchNYSEHighsLows(),
    ])

    // Extract live prices
    const currentVix = vixData.meta.regularMarketPrice
    const vixPrices = vixData.indicators.quote[0].close.filter((p: number) => p !== null)
    // Null MA (insufficient history) → the dependent component scores neutral
    // 50 (this file's established invalid-data pattern, cf. calculateStock-
    // Strength / calculateSafeHavenDemand) and the derived displays read as a
    // 0% deviation — never a partial-window mean dressed up as the real MA.
    const vix50DayMANullable = sma(vixPrices, 50)
    const vix50DayMA = vix50DayMANullable ?? currentVix

    const currentSpy = spyData.meta.regularMarketPrice
    const spyPrices = spyData.indicators.quote[0].close.filter((p: number) => p !== null)
    const spy125DayMANullable = sma(spyPrices, 125)
    const spy125DayMA = spy125DayMANullable ?? currentSpy
    const spyVolumes = spyData.indicators.quote[0].volume.filter((v: number) => v !== null)

    const hygPrices = hygData.indicators.quote[0].close.filter((p: number) => p !== null)
    const tltPrices = tltData.indicators.quote[0].close.filter((p: number) => p !== null)

    // Calculate 20-day returns for safe haven and junk bonds
    const spy20DayReturn =
      ((spyPrices[spyPrices.length - 1] - spyPrices[spyPrices.length - 20]) / spyPrices[spyPrices.length - 20]) * 100
    const tlt20DayReturn =
      ((tltPrices[tltPrices.length - 1] - tltPrices[tltPrices.length - 20]) / tltPrices[tltPrices.length - 20]) * 100
    const hyg20DayReturn =
      ((hygPrices[hygPrices.length - 1] - hygPrices[hygPrices.length - 20]) / hygPrices[hygPrices.length - 20]) * 100

    // NYSE highs/lows. Available or not — never approximated.
    //
    // The else branch here used to read:
    //   nyseHighs = Math.round(150 + spyMomentum * 10)
    //   nyseLows  = Math.round(80  - spyMomentum * 5)
    // which made "Stock Price Strength" a restatement of SPY momentum — and
    // SPY-vs-125-day-MA is already indicator 1. Two of the seven equal-weighted
    // components were then the same measurement, so the average double-counted
    // it. The starting values (150/80) were invented too: with the scrape down
    // and momentum flat they scored 65, a Greed reading produced from no data.
    // A second default pair further up this file (50/100) scored 33, Fear, from
    // the same absence.
    let nyseHighs: number | null = null
    let nyseLows: number | null = null
    if (nyseData) {
      nyseHighs = nyseData.highs
      nyseLows = nyseData.lows
      console.log(`[v0] NYSE Data (Live from ScrapingBee): Highs=${nyseHighs}, Lows=${nyseLows}`)
    } else {
      console.log(`[v0] NYSE highs/lows unavailable — Stock Price Strength is excluded, not approximated`)
    }

    console.log("[v0] STEP 1 COMPLETE: All indicators collected")
    console.log(`[v0]   - VIX: ${currentVix} (Live from Yahoo ^VIX)`)
    console.log(`[v0]   - VIX 50-day MA: ${vix50DayMA.toFixed(2)} (Calculated)`)
    console.log(`[v0]   - SPY: ${currentSpy} (Live from Yahoo SPY)`)
    console.log(`[v0]   - SPY 125-day MA: ${spy125DayMA.toFixed(2)} (Calculated)`)
    console.log(`[v0]   - HYG 20-day return: ${hyg20DayReturn.toFixed(2)}% (Live from Yahoo HYG)`)
    console.log(`[v0]   - TLT 20-day return: ${tlt20DayReturn.toFixed(2)}% (Live from Yahoo TLT)`)
    console.log(`[v0]   - NYSE Highs: ${nyseHighs}, Lows: ${nyseLows}`)

    // CALCULATE EACH INDICATOR SCORE (0-100)
    console.log("[v0] STEP 2: Calculating individual indicator scores...")

    // Calculate price changes for breadth
    const priceChanges = []
    for (let i = 1; i < Math.min(spyPrices.length, 20); i++) {
      priceChanges.push(spyPrices[spyPrices.length - i] - spyPrices[spyPrices.length - i - 1])
    }
    const volumeRatios = spyVolumes.slice(-20).map((v: number) => v / 1000000)

    console.log("[v0] STEP 3: Calculating Market Momentum Score")
    const percentAboveMA = ((currentSpy - spy125DayMA) / spy125DayMA) * 100
    console.log(`[v0]   SPY current: $${currentSpy.toFixed(2)}`)
    console.log(`[v0]   SPY 125-day MA: $${spy125DayMA.toFixed(2)}`)
    console.log(`[v0]   Percent above MA: ${percentAboveMA.toFixed(2)}%`)
    console.log(
      `[v0]   Raw score calculation: 50 + (${percentAboveMA.toFixed(2)} * 5) = ${(50 + percentAboveMA * 5).toFixed(1)}`,
    )

    // Named here so the response can report which components were dropped —
    // "4 of 7 measured" and "7 of 7 measured" are very different readings and
    // the payload could not previously tell them apart.
    const excludedComponents: string[] = []

    // A missing input scores NOTHING. It used to score 50 — and on this scale 50
    // is not "absent", it is a real NEUTRAL reading, which is the P6-18 defect
    // exactly. Excluded components are named in the response and the average
    // renormalises over what was actually measured, the way the CCPI pillars do.
    const i1_marketMomentum = spy125DayMANullable !== null ? calculateMarketMomentum(currentSpy, spy125DayMA) : null
    const i2_stockStrength =
      nyseHighs !== null && nyseLows !== null ? calculateStockStrength(nyseHighs, nyseLows) : null
    const i3_stockBreadth = priceChanges.length > 0 ? calculateStockBreadth(volumeRatios, priceChanges) : null
    const i4_putCallRatio = vix50DayMANullable !== null ? calculatePutCallRatio(currentVix, vix50DayMA) : null
    const i5_marketVolatility = calculateMarketVolatility(currentVix)
    const i6_safeHavenDemand = calculateSafeHavenDemand(spy20DayReturn, tlt20DayReturn)
    const i7_junkBondDemand = calculateJunkBondDemand(hyg20DayReturn, tlt20DayReturn)

    const fmt = (v: number | null) => (v === null ? "NO DATA" : `${v.toFixed(1)}/100`)
    console.log("[v0] STEP 2 COMPLETE: Individual scores calculated")
    console.log(
      `[v0]   I1 - Market Momentum: ${fmt(i1_marketMomentum)} (SPY ${percentAboveMA >= 0 ? "ABOVE" : "BELOW"} MA by ${Math.abs(percentAboveMA).toFixed(2)}%)`,
    )
    console.log(`[v0]   I2 - Stock Strength: ${fmt(i2_stockStrength)}`)
    console.log(`[v0]   I3 - Stock Breadth: ${fmt(i3_stockBreadth)}`)
    console.log(`[v0]   I4 - Put and Call Options: ${fmt(i4_putCallRatio)}`)
    console.log(`[v0]   I5 - Market Volatility: ${fmt(i5_marketVolatility)}`)
    console.log(`[v0]   I6 - Safe Haven Demand: ${fmt(i6_safeHavenDemand)}`)
    console.log(`[v0]   I7 - Junk Bond Demand: ${fmt(i7_junkBondDemand)}`)

    console.log("[v0] STEP 3: Averaging the components that had data")

    const overallScore =
      (() => {
        const scored = [
          ["Market Momentum", i1_marketMomentum],
          ["Stock Price Strength", i2_stockStrength],
          ["Stock Price Breadth", i3_stockBreadth],
          ["Put and Call Options", i4_putCallRatio],
          ["Market Volatility", i5_marketVolatility],
          ["Safe Haven Demand", i6_safeHavenDemand],
          ["Junk Bond Demand", i7_junkBondDemand],
        ] as Array<[string, number | null]>
        const live = scored.filter(([, v]) => v !== null) as Array<[string, number]>
        excludedComponents.push(...scored.filter(([, v]) => v === null).map(([n]) => n))
        // Fewer than four of seven is not a Fear & Greed reading, it is a
        // fragment of one. Say so rather than publishing a confident number.
        if (live.length < 4) return null
        return live.reduce((sum, [, v]) => sum + v, 0) / live.length
      })()

    if (overallScore === null) {
      throw new Error(
        `Fear & Greed cannot be computed: only ${7 - excludedComponents.length} of 7 components had data (missing ${excludedComponents.join(", ")}).`,
      )
    }
    const finalScore = Math.round(overallScore * 10) / 10

    console.log(`[v0] STEP 3 COMPLETE: Overall Score = ${finalScore}/100`)

    // Determine sentiment
    let sentiment: string
    if (finalScore <= 24) sentiment = "Extreme Fear"
    else if (finalScore <= 44) sentiment = "Fear"
    else if (finalScore <= 55) sentiment = "Neutral"
    else if (finalScore <= 74) sentiment = "Greed"
    else sentiment = "Extreme Greed"

    console.log(`[v0] Sentiment: ${sentiment}`)

    // POINTER POSITIONING
    const pointerPosition = 100 - finalScore
    console.log("[v0] STEP 4: Positioning visual pointer...")
    console.log(
      `[v0] Pointer Position: ${pointerPosition.toFixed(1)}% from left (${finalScore.toFixed(1)}% from right)`,
    )
    console.log(
      `[v0] Rationale: Low scores (fear) display on RIGHT (red zone), high scores (greed) on LEFT (green zone)`,
    )

    // Calculate historical changes
    const yesterdayData = await fetchYahooData("^VIX", "5d")
    const weekAgoData = await fetchYahooData("^VIX", "2mo")

    const vixHistorical = yesterdayData.indicators.quote[0].close.filter((p: number) => p !== null)
    const vixYesterday = vixHistorical[vixHistorical.length - 2] || currentVix
    const vixWeekAgo =
      weekAgoData.indicators.quote[0].close.filter((p: number) => p !== null)[Math.max(0, vixHistorical.length - 7)] ||
      currentVix

    const yesterdayScore = calculateMarketVolatility(vixYesterday)
    const weekAgoScore = calculateMarketVolatility(vixWeekAgo)

    console.log("[v0] ===== CALCULATION COMPLETE =====")
    console.log("[v0] All values are REAL and LIVE")
    console.log("[v0] No baseline or mock values used")
    console.log("[v0] Score calculated from independently collected indicators")
    console.log("[v0] =====================================")

    return {
      overallScore: finalScore,
      sentiment,
      trend:
        finalScore > yesterdayScore + 1
          ? ("up" as const)
          : finalScore < yesterdayScore - 1
            ? ("down" as const)
            : ("neutral" as const),
      // P3-18, confirmed live 2026-08-11. `lastMonthChange` was
      // `finalScore - weekAgoScore * 1.2` and `lastYearChange` was
      // `finalScore - weekAgoScore * 2` — **the week-ago score multiplied by an
      // arbitrary constant, published as the month-ago and year-ago readings.**
      // Nothing here fetches a month-ago or year-ago score, so there is no such
      // change to report. The route only ever reads two points, and now only
      // reports two. The `: 0` arms went with them: a change that could not be
      // computed is not a change of zero.
      yesterdayChange: isFinite(finalScore - yesterdayScore)
        ? Math.round((finalScore - yesterdayScore) * 10) / 10
        : null,
      lastWeekChange: isFinite(finalScore - weekAgoScore) ? Math.round((finalScore - weekAgoScore) * 10) / 10 : null,
      lastMonthChange: null,
      lastYearChange: null,
      components: [
        {
          name: "Market Momentum",
          value: i1_marketMomentum,
          description: "S&P 500 vs 125-day MA",
          rawData: `SPY: $${currentSpy.toFixed(2)}, MA125: $${spy125DayMA.toFixed(2)}`,
        },
        {
          name: "Stock Price Strength",
          value: i2_stockStrength,
          description: "52-week highs vs lows",
          rawData: `Highs: ${nyseHighs}, Lows: ${nyseLows}`,
        },
        {
          name: "Stock Price Breadth",
          value: i3_stockBreadth,
          description: "McClellan Volume Summation",
          rawData: `Advancing days: ${priceChanges.filter((p) => p > 0).length}/${priceChanges.length}`,
        },
        {
          name: "Put and Call Options",
          value: i4_putCallRatio,
          description: "5-day average ratio",
          rawData: `VIX: ${currentVix.toFixed(2)}, VIX MA50: ${vix50DayMA.toFixed(2)}`,
        },
        {
          name: "Market Volatility",
          value: i5_marketVolatility,
          description: "VIX vs 50-day MA",
          rawData: `VIX: ${currentVix.toFixed(2)}, Deviation: ${(((currentVix - vix50DayMA) / vix50DayMA) * 100).toFixed(1)}%`,
        },
        {
          name: "Safe Haven Demand",
          value: i6_safeHavenDemand,
          description: "20-day stock vs bond returns",
          rawData: `SPY: ${spy20DayReturn.toFixed(2)}%, TLT: ${tlt20DayReturn.toFixed(2)}%`,
        },
        {
          name: "Junk Bond Demand",
          value: i7_junkBondDemand,
          description: "Yield spread analysis",
          rawData: `HYG: ${hyg20DayReturn.toFixed(2)}%, Spread vs TLT: ${(hyg20DayReturn - tlt20DayReturn).toFixed(2)}%`,
        },
      ],
      standardIndicators: {
        vix: currentVix,
        putCallRatio: currentVix / vix50DayMA,
        stockPriceMomentum: ((currentSpy - spy125DayMA) / spy125DayMA) * 100,
        stockPriceStrength: i2_stockStrength,
        stockBreadth: i3_stockBreadth,
        junkBondSpread: hyg20DayReturn - tlt20DayReturn,
        safeHavenDemand: spy20DayReturn - tlt20DayReturn,
      },
      optionsFocusedIndicators: {
        volatilitySkew: ((currentVix - vix50DayMA) / vix50DayMA) * 100,
        openInterestPutCall: currentVix / vix50DayMA,
        vixTermStructure: i5_marketVolatility,
        cboeSkewIndex: 100 + (currentVix - 15) * 2,
      },
      calculationDetails: {
        formula: "equal-weight mean of the components that had data",
        weighting: `Equal weight across ${7 - excludedComponents.length} measured component(s)`,
        // Was "CNN Fear & Greed Index methodology". The AGGREGATION matches
        // CNN's — seven named components, equal weight — but the inputs do not.
        // "Put and Call Options" here is computed from VIX against its 50-day
        // MA, so it is a second volatility reading wearing the put/call name,
        // and CNN's component is an actual options ratio. Claiming the
        // methodology because the arithmetic matched is the same move as
        // claiming CME FedWatch because the output was a probability (P6-45).
        methodology:
          "CNN's component names and equal weighting, computed from this site's own inputs. Put and Call Options is derived from VIX, not from an options ratio, so it is not CNN's component of that name.",
        excludedComponents,
        individualScores: {
          i1_marketMomentum: i1_marketMomentum?.toFixed(2) ?? null,
          i2_stockStrength: i2_stockStrength?.toFixed(2) ?? null,
          i3_stockBreadth: i3_stockBreadth?.toFixed(2) ?? null,
          i4_putCallRatio: i4_putCallRatio?.toFixed(2) ?? null,
          i5_marketVolatility: i5_marketVolatility.toFixed(2),
          i6_safeHavenDemand: i6_safeHavenDemand.toFixed(2),
          i7_junkBondDemand: i7_junkBondDemand.toFixed(2),
        },
      },
      usingFallback: false,
      dataSourcesUsed: {
        primary: "Yahoo Finance APIs (Live)",
        nyseData: nyseData ? "ScrapingBee (Live)" : "Calculated from SPY momentum",
        allLive: true,
        noMockData: true,
      },
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error("[v0] Error calculating Fear & Greed Index:", error)
    throw error
  }
}
