import { NextResponse } from "next/server"
import { resolveApiKey } from "@/lib/api-keys"
import { sma } from "@/lib/indicators"
import { getStoredCloses } from "@/lib/market-closes"
import { getSeriesHistory } from "@/lib/market-series"

/**
 * Raw indicators computed from OUR OWN stored data — P6-22.
 *
 * These are the three fields that correctly read "NO DATA" after P6-18 removed
 * their invented constants: spot VIX (was a literal 0), its 50-day average
 * (was `vixVs50DayMA * 50 + vix`, a linear combination of a ratio and a spot
 * level printed to two decimals) and SPY momentum (was divided by a hardcoded
 * 125 regardless of how many closes came back).
 *
 * The E-7c snapshot now stores both inputs, so they can be measured instead of
 * guessed: VIXCLS from FRED and SPY closes from Polygon.
 *
 * THESE ARE NOT CNN COMPONENT SCORES and are deliberately not wired into the
 * seven-component list. They are raw measured quantities on their own scales —
 * a VIX level, a percentage versus a moving average. Turning them into 0-100
 * component scores would mean inventing a transform CNN has never published
 * and rendering the result alongside CNN's own figures as if it were one.
 *
 * putCallRatio is absent on purpose: nothing in the codebase sources one, and
 * there is no free feed. It stays null and is named in `notTracked`.
 */
async function fetchStoredRawIndicators(): Promise<{
  vix: number | null
  vix50DayMA: number | null
  stockPriceMomentum: number | null
}> {
  const [vixRows, spyRows] = await Promise.all([
    getSeriesHistory("fred:VIXCLS", 80),
    getStoredCloses("SPY", 200, 125),
  ])

  let vix: number | null = null
  let vix50DayMA: number | null = null
  if (vixRows && vixRows.length > 0) {
    vix = vixRows[0].value
    // Both stores return newest-first; sma() takes oldest-first.
    const ma = sma([...vixRows].reverse().map((r) => r.value), 50)
    vix50DayMA = ma !== null && ma > 0 ? Number(ma.toFixed(2)) : null
  }

  let stockPriceMomentum: number | null = null
  if (spyRows && spyRows.length >= 125) {
    const closes = [...spyRows].reverse().map((r) => r.close)
    // sma() returns null on short history rather than a stand-in, so a thin
    // store yields null momentum instead of a percentage against a fake mean.
    const ma125 = sma(closes, 125)
    if (ma125 !== null && ma125 > 0) {
      stockPriceMomentum = Number((((closes[closes.length - 1] - ma125) / ma125) * 100).toFixed(2))
    }
  }

  return { vix, vix50DayMA, stockPriceMomentum }
}

/** Indicators with no source at all — named so a null is not read as a bug. */
const NOT_TRACKED = ["putCallRatio"]

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
async function fetchYahooData(symbol: string, range = "1mo", timeout = 10000) {
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

const DATA_SOURCES = {
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

async function fetchNYSEHighsLows(): Promise<{ highs: number; lows: number } | null> {
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

/**
 * INDICATOR CALCULATION FUNCTIONS
 * Each function returns a score from 0-100 where:
 * - 0-24 = Extreme Fear
 * - 25-44 = Fear
 * - 45-55 = Neutral
 * - 56-74 = Greed
 * - 75-100 = Extreme Greed
 */

function calculateMarketMomentum(currentPrice: number, ma125: number): number {
  const percentAboveMA = ((currentPrice - ma125) / ma125) * 100
  // Mapping: -10% below MA = 0 (extreme fear), +10% above MA = 100 (extreme greed)
  const score = 50 + percentAboveMA * 5
  return Math.max(0, Math.min(100, score))
}

function calculateStockStrength(highs: number, lows: number): number {
  if (highs + lows === 0) return 50 // Neutral if no data
  const ratio = highs / (highs + lows)
  // Mapping: ratio of 0 (all lows) = 0, ratio of 1 (all highs) = 100
  return ratio * 100
}

function calculateStockBreadth(volumeRatios: number[], priceChanges: number[]): number {
  if (priceChanges.length === 0) return 50

  const advancingDays = priceChanges.filter((change) => change > 0).length
  const advancingVolume = volumeRatios.slice(0, advancingDays).reduce((sum, vol) => sum + vol, 0)
  const totalVolume = volumeRatios.reduce((sum, vol) => sum + vol, 0)

  const breadthRatio = totalVolume > 0 ? advancingVolume / totalVolume : 0.5
  return breadthRatio * 100
}

function calculatePutCallRatio(vixCurrent: number, vix50DayMA: number): number {
  // Approximation: High VIX vs MA = more puts = fear = lower score
  const vixRatio = vixCurrent / vix50DayMA
  // Mapping: VIX 150% above MA = 0 (extreme fear), VIX 50% below MA = 100 (extreme greed)
  const score = 100 - (vixRatio - 1) * 100
  return Math.max(0, Math.min(100, score))
}

/**
 * Market Volatility, mapped from the VIX LEVEL: 10 → 100 (calm/greed),
 * 40 → 0 (stressed/fear), clamped.
 *
 * This function used to take a `vix50DayMA` parameter, compute
 * `percentAboveMA` from it, never use the result, and carry the comment
 * "Mapping: VIX +50% above MA = 0 ... VIX -50% below MA = 100" — describing a
 * VIX-versus-its-average calculation the body does not perform. Three ways of
 * saying the same thing: a dead parameter, a dead variable, and a comment
 * documenting the intent rather than the code.
 *
 * **The comment was describing CNN's actual method.** CNN's Market Volatility
 * component compares VIX to its 50-day moving average; this maps the raw level,
 * so a persistently high-VIX regime reads as fear here and as neutral for CNN
 * once the average catches up. The level map is KEPT — changing a live score
 * needs evidence that the alternative is better, not just that a stale comment
 * preferred it — and the divergence is disclosed with the rest of the
 * CNN-methodology caveats (P6-59). Deleting the parameter is what stops the
 * next reader believing the average is involved.
 */
function calculateMarketVolatility(vixCurrent: number): number {
  const score = 100 - ((vixCurrent - 10) / 30) * 100
  return Math.max(0, Math.min(100, score))
}

function calculateSafeHavenDemand(spyReturn: number, tltReturn: number): number {
  if (isNaN(spyReturn) || isNaN(tltReturn) || !isFinite(spyReturn) || !isFinite(tltReturn)) {
    console.log("[v0] Safe Haven data is invalid (NaN), using neutral score 50")
    return 50
  }
  const spread = spyReturn - tltReturn
  // Mapping: Bonds outperform by 10% = 0 (extreme fear), Stocks outperform by 10% = 100 (extreme greed)
  const score = 50 + spread * 5
  return Math.max(0, Math.min(100, score))
}

function calculateJunkBondDemand(hygReturn: number, tltReturn: number): number {
  if (isNaN(hygReturn) || isNaN(tltReturn) || !isFinite(hygReturn) || !isFinite(tltReturn)) {
    console.log("[v0] Junk Bond data is invalid (NaN), using neutral score 50")
    return 50
  }
  const spread = hygReturn - tltReturn
  // Mapping: Wide spread (bonds winning) = 0 (fear), Narrow spread = 100 (greed)
  const score = 50 + spread * 10
  return Math.max(0, Math.min(100, score))
}

async function calculateFallbackIndex() {
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

async function scrapeCNNFearGreed() {
  if (!resolveApiKey("SCRAPINGBEE_API_KEY")) {
    console.log("[v0] ScrapingBee API key not found, skipping CNN scraping")
    return null
  }

  try {
    const url = `https://app.scrapingbee.com/api/v1/?api_key=${resolveApiKey("SCRAPINGBEE_API_KEY")}&url=${encodeURIComponent("https://www.cnn.com/markets/fear-and-greed")}&render_js=true&wait=5000&wait_for=.market-fng-gauge`

    console.log("[v0] Fetching CNN Fear & Greed page with JavaScript rendering...")
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) })

    if (!response.ok) {
      console.log(`[v0] ScrapingBee returned ${response.status}`)
      return null
    }

    const html = await response.text()
    console.log(`[v0] Received HTML, length: ${html.length} characters`)

    let mainScore = 50
    let mainSentiment = "neutral"

    // Try multiple patterns to find the main Fear & Greed score
    const scorePatterns = [
      // Look for the number displayed prominently on the gauge (usually in a span or div with specific classes)
      /market-fng-gauge__dial-number[^>]*>(\d+)/i,
      /fng-score[^>]*>(\d+)/i,
      /fear-greed-score[^>]*>(\d+)/i,
      // Look for data attributes
      /data-score="(\d+)"/i,
      /data-value="(\d+)"/i,
      // Look for JSON data with score
      /"score"\s*:\s*(\d+\.?\d*)/i,
      /"rating_score"\s*:\s*(\d+\.?\d*)/i,
      // Generic patterns as fallback
      /score[^>]{0,50}>(\d+)</i,
      />(\d+)<.*?(fear|greed)/i,
    ]

    for (const pattern of scorePatterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        const parsedScore = Number.parseFloat(match[1])
        // Validate the score is in expected range (0-100)
        if (parsedScore >= 0 && parsedScore <= 100) {
          mainScore = Math.round(parsedScore)
          console.log(`[v0] ✓ Extracted main CNN score: ${mainScore} using pattern: ${pattern.source.substring(0, 50)}`)
          break
        }
      }
    }

    if (mainScore === 50) {
      console.log("[v0] ⚠️ Could not extract score from HTML, defaulting to 50")
      // Save a portion of HTML for debugging
      console.log("[v0] HTML sample (first 1000 chars):", html.substring(0, 1000))
    }

    // Determine main sentiment from score
    if (mainScore < 25) mainSentiment = "extreme fear"
    else if (mainScore < 45) mainSentiment = "fear"
    else if (mainScore <= 55) mainSentiment = "neutral"
    else if (mainScore < 75) mainSentiment = "greed"
    else mainSentiment = "extreme greed"

    console.log(`[v0] CNN Main Score: ${mainScore}/100 (${mainSentiment})`)

    // CNN displays each indicator with a label like "EXTREME FEAR", "FEAR", "NEUTRAL", "GREED", "EXTREME GREED"
    const indicators: Array<{ name: string; score: number; sentiment: string; description: string }> = []

    // Define indicator names and their patterns in the HTML
    const indicatorPatterns = [
      { name: "Market Momentum", keywords: ["market momentum", "s&amp;p 500", "moving average"] },
      { name: "Stock Price Strength", keywords: ["stock price strength", "52-week", "highs"] },
      { name: "Stock Price Breadth", keywords: ["stock price breadth", "mcclellan", "volume"] },
      { name: "Put and Call Options", keywords: ["put and call", "options", "put/call"] },
      { name: "Market Volatility", keywords: ["market volatility", "vix", "volatility"] },
      { name: "Safe Haven Demand", keywords: ["safe haven", "bond", "treasury"] },
      { name: "Junk Bond Demand", keywords: ["junk bond", "high yield", "credit"] },
    ]

    for (const indicator of indicatorPatterns) {
      let foundScore = mainScore // Default to main score
      let foundSentiment = mainSentiment // Default to main sentiment

      // Try to find this indicator's section in the HTML
      for (const keyword of indicator.keywords) {
        // Look for the indicator name followed by a sentiment label
        const regex = new RegExp(keyword + "[\\s\\S]{0,500}?(extreme\\s+fear|fear|neutral|greed|extreme\\s+greed)", "i")
        const match = html.match(regex)

        if (match) {
          const sentimentText = match[1].toLowerCase().trim()
          console.log(`[v0] Found sentiment for ${indicator.name}: ${sentimentText}`)

          // Map sentiment text to score
          if (sentimentText.includes("extreme fear")) {
            foundScore = 10
            foundSentiment = "EXTREME FEAR"
          } else if (sentimentText === "fear") {
            foundScore = 30
            foundSentiment = "FEAR"
          } else if (sentimentText === "neutral") {
            foundScore = 50
            foundSentiment = "NEUTRAL"
          } else if (sentimentText === "greed") {
            foundScore = 70
            foundSentiment = "GREED"
          } else if (sentimentText.includes("extreme greed")) {
            foundScore = 90
            foundSentiment = "EXTREME GREED"
          }
          break
        }
      }

      indicators.push({
        name: indicator.name,
        score: foundScore,
        sentiment: foundSentiment,
        description: getIndicatorDescription(indicator.name),
      })

      console.log(`[v0] CNN Indicator: ${indicator.name} = ${foundScore}/100 (${foundSentiment})`)
    }

    // P3-18, confirmed live 2026-08-11. This block was captioned "Extract
    // historical data points for changes" and extracted nothing: all four were
    // set to `mainScore`, today's reading, so every change downstream computed
    // to exactly 0.0 and was published as a measured delta meaning "unchanged".
    // **A comment describing an extraction that does not happen is the same
    // defect as a label naming a source the code does not read.** The scrape
    // reads one page showing one score; it has no history, and now says so.
    const historical = {
      yesterday: null,
      lastWeek: null,
      lastMonth: null,
      lastYear: null,
    }

    return {
      score: mainScore,
      sentiment: mainSentiment,
      indicators: indicators,
      historical: historical,
    }
  } catch (error) {
    console.error("[v0] Error scraping CNN Fear & Greed:", error)
    return null
  }
}

// Helper function to get indicator descriptions
function getIndicatorDescription(name: string): string {
  const descriptions: Record<string, string> = {
    "Market Momentum": "S&P 500 vs 125-day MA",
    "Stock Price Strength": "52-week highs vs lows",
    "Stock Price Breadth": "McClellan Volume Summation",
    "Put and Call Options": "5-day average ratio",
    "Market Volatility": "VIX vs 50-day MA",
    "Safe Haven Demand": "20-day stock vs bond returns",
    "Junk Bond Demand": "Yield spread analysis",
  }
  return descriptions[name] || "Market indicator"
}

// Function to fetch historical data for charts
async function fetchHistoricalDataForCharts() {
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
