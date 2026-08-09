import { NextResponse } from "next/server"
import { getApiKey } from "@/lib/api-keys"
import { fredHistoryFromStore } from "@/lib/fred-store"

// E-7d: BLS/FRED series update monthly-to-daily, never intraday. ISR caches
// the whole response at the edge for 15 min instead of re-pulling full
// history from FRED on every page view.
export const revalidate = 900


// BLS Jobs Rate Forecaster - LIVE data from FRED Economic Data
// Series used:
//   UNRATE          - Civilian Unemployment Rate (U-3), percent
//   U6RATE          - Total unemployed + marginally attached + part-time for economic reasons (U-6), percent
//   PAYEMS          - All Employees: Total Nonfarm, thousands (monthly diff = NFP change)
//   CES0500000003   - Average Hourly Earnings of All Employees, Total Private, dollars

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"

type Obs = { date: string; value: string }

/**
 * Observations oldest -> newest. E-7b: the daily fred-snapshot cron holds all
 * four series, so the store answers first; live FRED remains the fallback when
 * the store is empty or has gone stale for the series' cadence.
 */
async function fetchSeries(seriesId: string, apiKey: string, limit: number): Promise<Obs[] | null> {
  const stored = await fredHistoryFromStore(seriesId, limit)
  if (stored && stored.length > 0) {
    return stored.map((r) => ({ date: r.day, value: String(r.value) })).reverse()
  }
  try {
    const res = await fetch(
      `${FRED_BASE}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`,
      { signal: AbortSignal.timeout(10000) },
    )
    if (!res.ok) return null
    const json = await res.json()
    if (!json.observations || json.observations.length === 0) return null
    // Return oldest -> newest, dropping FRED "." missing markers
    return (json.observations as Obs[]).filter((o) => o.value !== ".").reverse()
  } catch {
    return null
  }
}

function monthLabel(dateStr: string) {
  // FRED dates are YYYY-MM-01; build label without timezone drift
  const [y, m] = dateStr.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1, 1))
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
}

function nextFirstFriday(from: Date) {
  // BLS Employment Situation is released the first Friday of each month.
  const candidate = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1))
  const advance = () => candidate.setUTCMonth(candidate.getUTCMonth() + 1)
  for (let guard = 0; guard < 24; guard++) {
    const first = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), 1))
    const offsetToFriday = (5 - first.getUTCDay() + 7) % 7
    const firstFriday = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), 1 + offsetToFriday))
    if (firstFriday.getTime() > from.getTime()) {
      return firstFriday.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    }
    advance()
  }
  return from.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
}

export async function GET() {
  try {
    // No early bail on a missing key: with the E-7b store warm this route
    // serves entirely from Supabase, and FRED being unconfigured is only fatal
    // once the store also comes back empty (handled below, as 503).
    const fredApiKey = getApiKey("FRED_API_KEY")

    const [unrateObs, u6Obs, payemsObs, earningsObs] = await Promise.all([
      fetchSeries("UNRATE", fredApiKey, 40),
      fetchSeries("U6RATE", fredApiKey, 40),
      fetchSeries("PAYEMS", fredApiKey, 16),
      fetchSeries("CES0500000003", fredApiKey, 16),
    ])

    if (!unrateObs || unrateObs.length < 14 || !u6Obs || u6Obs.length < 2) {
      // Neither the store nor FRED could supply the labour series. 503 (not
      // 500): the data source is unavailable, the route itself is fine.
      return NextResponse.json(
        {
          error: fredApiKey
            ? "Labour-market data is unavailable: neither the stored series nor FRED returned enough observations."
            : "Labour-market data is unavailable: FRED_API_KEY is not configured and the stored series is empty.",
        },
        { status: 503 },
      )
    }

    const num = (o?: Obs) => (o ? Number.parseFloat(o.value) : Number.NaN)

    // ---- Current UNRATE figures ----
    const unrateLatest = unrateObs[unrateObs.length - 1]
    const unrateCurrent = num(unrateLatest)
    const unratePrevMonth = num(unrateObs[unrateObs.length - 2])
    const unrateYearAgo = num(unrateObs[unrateObs.length - 13])
    const unrateYoY = Number((unrateCurrent - unrateYearAgo).toFixed(1))

    // ---- Current U-6 figures ----
    const u6Latest = u6Obs[u6Obs.length - 1]
    const u6Current = num(u6Latest)
    const u6YearAgo = u6Obs.length >= 13 ? num(u6Obs[u6Obs.length - 13]) : num(u6Obs[0])
    const u6YoY = Number((u6Current - u6YearAgo).toFixed(1))
    const unrateU6Diff = Number((u6Current - unrateCurrent).toFixed(1))

    // ---- Non-Farm Payrolls (monthly change in thousands) ----
    let nfpCurrent: number | null = null
    let nfpPrevMonth: number | null = null
    let nfp3MonthAvg: number | null = null
    if (payemsObs && payemsObs.length >= 5) {
      const lvl = payemsObs.map(num)
      const n = lvl.length
      nfpCurrent = Math.round(lvl[n - 1] - lvl[n - 2])
      nfpPrevMonth = Math.round(lvl[n - 2] - lvl[n - 3])
      const diffs = [lvl[n - 1] - lvl[n - 2], lvl[n - 2] - lvl[n - 3], lvl[n - 3] - lvl[n - 4]]
      nfp3MonthAvg = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length)
    }

    // ---- Average Hourly Earnings ----
    let earningsCurrent: number | null = null
    let earningsMoM: number | null = null
    let earningsYoY: number | null = null
    if (earningsObs && earningsObs.length >= 13) {
      const e = earningsObs.map(num)
      const n = e.length
      earningsCurrent = Number(e[n - 1].toFixed(2))
      earningsMoM = Number((((e[n - 1] - e[n - 2]) / e[n - 2]) * 100).toFixed(1))
      earningsYoY = Number((((e[n - 1] - e[n - 13]) / e[n - 13]) * 100).toFixed(1))
    }

    // ---- Historical table: last 12 months of UNRATE with YoY ----
    const historicalTable: { month: string; rate: number; yoyChange: string }[] = []
    for (let i = unrateObs.length - 12; i < unrateObs.length; i++) {
      if (i < 0) continue
      const rate = num(unrateObs[i])
      const yearAgoIdx = i - 12
      let yoyChange = "n/a"
      if (yearAgoIdx >= 0) {
        const diff = rate - num(unrateObs[yearAgoIdx])
        yoyChange = diff > 0 ? `+${diff.toFixed(1)}%` : diff < 0 ? `${diff.toFixed(1)}%` : "0.0%"
      }
      historicalTable.push({ month: monthLabel(unrateObs[i].date), rate: Number(rate.toFixed(1)), yoyChange })
    }
    historicalTable.reverse() // newest first for the table

    // ---- Trend detection over the last 6 months of UNRATE ----
    const recent = unrateObs.slice(-6).map(num)
    const unrateSlope =
      recent.length > 1 ? (recent[recent.length - 1] - recent[0]) / (recent.length - 1) : 0
    const recentU6 = u6Obs.slice(-6).map(num)
    const u6Slope = recentU6.length > 1 ? (recentU6[recentU6.length - 1] - recentU6[0]) / (recentU6.length - 1) : 0

    const trend: "rising" | "falling" | "stable" =
      unrateSlope > 0.03 ? "rising" : unrateSlope < -0.03 ? "falling" : "stable"

    // ---- Chart data: last 13 months historical + 5 month forecast ----
    const chartData: any[] = []
    const histMonths = Math.min(13, unrateObs.length, u6Obs.length)
    for (let k = 0; k < histMonths; k++) {
      const uIdx = unrateObs.length - histMonths + k
      const u6Idx = u6Obs.length - histMonths + k
      chartData.push({
        month: monthLabel(unrateObs[uIdx].date),
        unrate: Number(num(unrateObs[uIdx]).toFixed(1)),
        u6: Number(num(u6Obs[u6Idx]).toFixed(1)),
        isForecast: false,
      })
    }
    // Bridge point so forecast lines connect to the last actual
    const lastActual = chartData[chartData.length - 1]
    chartData[chartData.length - 1] = {
      ...lastActual,
      unrateForecast: lastActual.unrate,
      u6Forecast: lastActual.u6,
      unrateLow: lastActual.unrate,
      unrateHigh: lastActual.unrate,
      u6Low: lastActual.u6,
      u6High: lastActual.u6,
    }

    let projUnrate = unrateCurrent
    let projU6 = u6Current
    const [ly, lm] = unrateLatest.date.split("-").map(Number)
    for (let i = 1; i <= 5; i++) {
      projUnrate = Math.max(2, Math.min(12, projUnrate + unrateSlope))
      projU6 = Math.max(4, Math.min(18, projU6 + u6Slope))
      const fDate = new Date(Date.UTC(ly, lm - 1 + i, 1))
      const band = 0.1 * i
      chartData.push({
        month: fDate.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
        unrateForecast: Number(projUnrate.toFixed(1)),
        u6Forecast: Number(projU6.toFixed(1)),
        unrateLow: Number((projUnrate - band).toFixed(1)),
        unrateHigh: Number((projUnrate + band).toFixed(1)),
        u6Low: Number((projU6 - band).toFixed(1)),
        u6High: Number((projU6 + band).toFixed(1)),
        isForecast: true,
      })
    }

    const unratePrediction = Number(Math.max(2, Math.min(12, unrateCurrent + unrateSlope)).toFixed(1))
    const u6Prediction = Number(Math.max(4, Math.min(18, u6Current + u6Slope)).toFixed(1))

    // ---- NFP forecast (3-month average as the central estimate) ----
    // `?? 150` invented a payrolls figure and forecast a ±35K band around it.
    // With no NFP observation there is no central estimate to publish.
    const nfpBase = nfp3MonthAvg ?? nfpCurrent ?? null
    const fmtK = (v: number) => `${v >= 0 ? "+" : ""}${v}K`
    const nfpPrediction = nfpBase === null ? null : fmtK(Math.round(nfpBase))
    const nfpRange =
      nfpBase === null ? null : { low: fmtK(Math.round(nfpBase - 35)), high: fmtK(Math.round(nfpBase + 35)) }

    // Confidence: tighter when the labor market is steady, looser when moving fast
    const volatility = Math.abs(unrateSlope) + Math.abs(u6Slope)
    const confidence = Math.max(55, Math.min(88, Math.round(82 - volatility * 60)))

    // ---- Heuristic analysis + trading implications ----
    const lastLabel = monthLabel(unrateLatest.date)
    let analysis = ""
    let keyFactors: string[] = []
    let tradingImplications: string[] = []

    if (trend === "rising") {
      analysis = `As of ${lastLabel}, the unemployment rate stands at ${unrateCurrent.toFixed(1)}% and has been trending higher over recent months. A cooling labor market raises the odds of Fed rate cuts but also signals slowing growth. U-6 at ${u6Current.toFixed(1)}% confirms broadening labor slack.`
      keyFactors = [
        `UNRATE rising ${(unrateSlope * 100).toFixed(0)} bps/month over the last 6 months`,
        `U-6 at ${u6Current.toFixed(1)}% (${unrateU6Diff > 0 ? "+" : ""}${unrateU6Diff}% above U-3), signaling hidden slack`,
        nfpCurrent !== null ? `Latest NFP at ${fmtK(nfpCurrent)}, ${nfpCurrent < 100 ? "below" : "near"} trend` : "Payrolls data unavailable",
        "Continuing claims and Fed policy lag effects materializing",
      ]
      tradingImplications = [
        "Protective Puts: Hedge cyclical exposure (XLY, IWM) against further labor weakness",
        "Bear Put Spreads on regional banks (KRE) if unemployment pushes above 4.5%",
        "Long Calls on TLT: Rising unemployment supports rate-cut expectations and bond prices",
      ]
    } else if (trend === "falling") {
      analysis = `As of ${lastLabel}, the unemployment rate is ${unrateCurrent.toFixed(1)}% and has been declining, pointing to a re-tightening labor market. This is supportive of consumer spending but may keep the Fed restrictive for longer. U-6 sits at ${u6Current.toFixed(1)}%.`
      keyFactors = [
        `UNRATE falling ${Math.abs(unrateSlope * 100).toFixed(0)} bps/month over the last 6 months`,
        `U-6 at ${u6Current.toFixed(1)}%, ${u6Slope < 0 ? "improving" : "stable"}`,
        nfpCurrent !== null ? `Latest NFP at ${fmtK(nfpCurrent)}, indicating resilient hiring` : "Payrolls data unavailable",
        earningsYoY !== null ? `Wage growth at ${earningsYoY}% YoY keeps Fed cautious` : "Wage growth data unavailable",
      ]
      tradingImplications = [
        "Bullish Call Spreads on cyclicals (XLF, XLI) as labor strength supports growth",
        "Sell Put Spreads on SPY into strength if unemployment stays low",
        "Bear Put Spreads on TLT: A tight labor market argues against near-term rate cuts",
      ]
    } else {
      analysis = `As of ${lastLabel}, the unemployment rate is holding steady around ${unrateCurrent.toFixed(1)}% with U-6 at ${u6Current.toFixed(1)}%. A stable labor market supports a soft-landing scenario and tends to keep employment-driven volatility contained.`
      keyFactors = [
        `UNRATE stable near ${unrateCurrent.toFixed(1)}% over the last 6 months`,
        `U-6 at ${u6Current.toFixed(1)}% (${unrateU6Diff > 0 ? "+" : ""}${unrateU6Diff}% above U-3)`,
        // `fmtK(nfp3MonthAvg ?? 0)` printed "+0K" as a 3-month average.
        nfpCurrent !== null
          ? nfp3MonthAvg !== null
            ? `Latest NFP at ${fmtK(nfpCurrent)}, near the 3-month average of ${fmtK(nfp3MonthAvg)}`
            : `Latest NFP at ${fmtK(nfpCurrent)}; 3-month average unavailable`
          : "Payrolls data unavailable",
        earningsYoY !== null ? `Average hourly earnings up ${earningsYoY}% YoY` : "Wage growth data unavailable",
      ]
      tradingImplications = [
        "Iron Condors on SPY: Range-bound employment data supports neutral, premium-selling strategies",
        "Bullish Credit Spreads on XLF if unemployment stays below 4.5%",
        "Calendar Spreads to harvest time decay while the labor backdrop is calm",
      ]
    }

    return NextResponse.json({
      current: {
        unrate: Number(unrateCurrent.toFixed(1)),
        unratePrevMonth: Number(unratePrevMonth.toFixed(1)),
        unratePrevYear: Number(unrateYearAgo.toFixed(1)),
        unrateYoY,
        u6: Number(u6Current.toFixed(1)),
        u6PrevYear: Number(u6YearAgo.toFixed(1)),
        u6YoY,
        unrateU6Diff,
        nfp: nfpCurrent,
        nfpPrevMonth,
        nfp3MonthAvg,
        earnings: earningsCurrent,
        earningsMoM,
        earningsYoY,
        latestMonth: lastLabel,
      },
      forecast: {
        nextRelease: nextFirstFriday(new Date()),
        unratePrediction,
        unrateRange: { low: Number((unratePrediction - 0.1).toFixed(1)), high: Number((unratePrediction + 0.1).toFixed(1)) },
        u6Prediction,
        u6Range: { low: Number((u6Prediction - 0.2).toFixed(1)), high: Number((u6Prediction + 0.2).toFixed(1)) },
        nfpPrediction,
        nfpRange,
        confidence,
        trend,
        analysis,
        keyFactors,
        tradingImplications,
      },
      chartData,
      historicalTable,
      lastUpdated: new Date().toISOString(),
      dataSource: "FRED Economic Data (BLS series: UNRATE, U6RATE, PAYEMS, CES0500000003)",
    })
  } catch (error) {
    console.error("[v0] Error fetching jobs report data:", error)
    return NextResponse.json({ error: "Failed to fetch jobs report data" }, { status: 500 })
  }
}
