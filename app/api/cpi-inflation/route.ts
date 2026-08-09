import { NextResponse } from "next/server"
import { getApiKey } from "@/lib/api-keys"
import { fredHistoryFromStore } from "@/lib/fred-store"

// E-7d: BLS/FRED series update monthly-to-daily, never intraday. ISR caches
// the whole response at the edge for 15 min instead of re-pulling full
// history from FRED on every page view.
export const revalidate = 900


export async function GET() {
  try {
    const fredApiKey = getApiKey("FRED_API_KEY")

    /** Index level series, oldest-first. E-7b: store first, live FRED after. */
    const fetchCpiLevels = async (): Promise<{ date: string; value: number }[]> => {
      const stored = await fredHistoryFromStore("CPIAUCSL", 36)
      if (stored && stored.length >= 13) {
        return stored.map((r) => ({ date: r.day, value: r.value })).reverse()
      }
      if (!fredApiKey) return []
      try {
        const response = await fetch(
          `https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=${fredApiKey}&file_type=json&sort_order=desc&limit=36`,
        )
        if (!response.ok) return []
        const data = await response.json()
        const obs = Array.isArray(data?.observations) ? data.observations : []
        return obs
          .map((o: any) => ({ date: String(o.date), value: Number.parseFloat(o.value) }))
          .filter((r: { value: number }) => Number.isFinite(r.value))
          .reverse()
      } catch {
        return []
      }
    }

    const fetchCPIData = async () => {
      const levels = await fetchCpiLevels()
      if (levels.length < 13) return null
      // Pair each month with the SAME MONTH one year earlier by date, not by
      // counting back twelve rows: CPIAUCSL has no 2025-10 observation, so a
      // row offset would compare Nov-2025 against Oct-2024 and label the
      // 13-month result "year-over-year". A month whose base is missing yields
      // no point at all rather than a mismeasured one.
      const byDate = new Map(levels.map((r) => [r.date, r.value]))
      const out: { date: string; yoyChange: number }[] = []
      for (const row of levels) {
        const [y, m] = row.date.split("-").map(Number)
        const base = new Date(Date.UTC(y - 1, m - 1, 1))
        const baseKey = `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-01`
        const yearAgo = byDate.get(baseKey)
        if (yearAgo === undefined || yearAgo === 0) continue
        out.push({
          date: row.date,
          yoyChange: Number((((row.value - yearAgo) / yearAgo) * 100).toFixed(2)),
        })
      }
      return out.length > 0 ? out : null
    }

    const historicalCPI = await fetchCPIData()

    if (!historicalCPI || historicalCPI.length === 0) {
      throw new Error("Failed to fetch CPI data from FRED")
    }

    // Get current and previous CPI
    const currentCPI = historicalCPI[historicalCPI.length - 1].yoyChange
    const previousCPI = historicalCPI[historicalCPI.length - 2].yoyChange
    const trend = currentCPI > previousCPI ? "up" : currentCPI < previousCPI ? "down" : "stable"

    const fedTarget = 2.0 // Fed's inflation target

    // Determine inflation pressure
    let inflationPressure = "Low"
    if (currentCPI > 4.0) {
      inflationPressure = "High"
    } else if (currentCPI > 3.0) {
      inflationPressure = "Moderate"
    }

    // Generate forecast for next 24 months
    const forecastData = []

    // Calculate trend from last 6 months
    const recentMonths = historicalCPI.slice(-6)
    const avgChange =
      recentMonths.length > 1
        ? (recentMonths[recentMonths.length - 1].yoyChange - recentMonths[0].yoyChange) / (recentMonths.length - 1)
        : -0.1 // Default to declining trend

    // Generate 24-month forecast. Months run forward from the LATEST PUBLISHED
    // observation, not from today: CPI is released 4-6 weeks in arrears, so
    // anchoring on today left the months between the last release and now
    // missing from the chart entirely.
    const [latestY, latestM] = historicalCPI[historicalCPI.length - 1].date.split("-").map(Number)
    let lastCPI = currentCPI
    for (let i = 1; i <= 24; i++) {
      const forecastDate = new Date(Date.UTC(latestY, latestM - 1 + i, 1))

      // Apply gradual convergence to Fed target with some randomness
      const targetPull = (fedTarget - lastCPI) * 0.15 // 15% pull toward target each month
      const trendContinuation = avgChange * 0.7 // 70% of recent trend continues
      const monthlyChange = targetPull + trendContinuation

      lastCPI = Math.max(1.5, Math.min(5.0, lastCPI + monthlyChange)) // Keep within reasonable bounds

      forecastData.push({
        month: forecastDate.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
        cpi: Number(lastCPI.toFixed(2)),
        yoyChange: Number((lastCPI - currentCPI).toFixed(2)),
      })
    }

    // Generate chart data (2 years historical + 2 years forecast)
    const chartData = []

    // Historical data (last 24 months). FRED dates are YYYY-MM-01; formatting
    // them through `new Date(...)` renders in local time, so west of UTC every
    // point silently shifted to the previous month. Build the label from the
    // date parts instead — same approach as /api/jobs-report.
    const monthLabel = (isoDay: string) => {
      const [y, m] = isoDay.split("-").map(Number)
      return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    }

    const historicalForChart = historicalCPI.slice(-24)
    historicalForChart.forEach((point) => {
      chartData.push({
        date: monthLabel(point.date),
        historical: point.yoyChange,
        forecast: null,
        type: "historical",
      })
    })

    // Bridge point joining history to forecast. It carries the LATEST PUBLISHED
    // reading, so it must be labelled with that reading's month — labelling it
    // with today's date drew the June figure at August and implied a release
    // that has not happened (CPI runs 4-6 weeks in arrears).
    const latestObservedMonth = historicalCPI[historicalCPI.length - 1].date
    chartData.push({
      date: monthLabel(latestObservedMonth),
      historical: currentCPI,
      forecast: currentCPI,
      type: "current",
    })

    // Forecast data (next 24 months)
    forecastData.forEach((point) => {
      chartData.push({
        date: point.month,
        historical: null,
        forecast: point.cpi,
        type: "forecast",
      })
    })

    // Generate options strategies based on inflation outlook
    const optionsStrategies = []

    if (inflationPressure === "High" || (inflationPressure === "Moderate" && trend === "up")) {
      // High/Rising Inflation = Buy inflation hedges
      optionsStrategies.push({
        name: "Bull Call Spread on XLB (Materials)",
        ticker: "XLB",
        type: "Inflation Beneficiary",
        rationale: `CPI at ${currentCPI.toFixed(1)}% with ${trend === "up" ? "rising" : "elevated"} trend. Materials producers with pricing power pass rising input costs through and outperform in high inflation environments.`,
        entry: "Buy ATM call, sell call 5-7% OTM",
        target: "Max profit if XLB rallies above short strike",
        stopLoss: "Exit at 50% loss or if CPI trends down",
        timeframe: "60-90 DTE, hold through next CPI release",
        risk: "Defined risk. Max loss = net debit paid.",
      })

      optionsStrategies.push({
        name: "Long Puts on XLRE (Real Estate)",
        ticker: "XLRE",
        type: "Rate-Sensitive Sector Bearish",
        rationale:
          "High inflation pushes yields higher. Rate-sensitive sectors like real estate are hit hardest as financing costs rise.",
        entry: "Buy ATM puts on XLRE",
        target: "3-5% decline in XLRE as yields rise",
        stopLoss: "Exit if inflation data shows cooling trend",
        timeframe: "45-60 DTE",
        risk: "Limited to premium. XLRE can be volatile on inflation data.",
      })

      optionsStrategies.push({
        name: "Bull Call Spread on XLE (Energy)",
        ticker: "XLE",
        type: "Sector Rotation",
        rationale:
          "Energy stocks correlate with inflation. Oil/gas prices often drive CPI higher, benefiting energy companies.",
        entry: "Buy ATM call, sell call 7-10% OTM",
        target: "Max profit if XLE rallies above short strike",
        stopLoss: "Exit at 50% loss or if energy prices decline",
        timeframe: "30-60 DTE",
        risk: "Defined risk. Max loss = net debit paid.",
      })

      optionsStrategies.push({
        name: "Long Calls on GDX (Gold Miners)",
        ticker: "GDX",
        type: "Gold-Industry Equity Hedge",
        rationale:
          "Gold-mining stocks historically perform well during inflationary periods, with operating leverage to rising gold prices.",
        entry: "Buy ATM or slightly OTM calls",
        target: "+5-8% move in GDX",
        stopLoss: "Exit if GDX breaks below key support",
        timeframe: "60-90 DTE",
        risk: "Limited to premium. Gold miners can be volatile short-term.",
      })
    } else if (inflationPressure === "Low" || (inflationPressure === "Moderate" && trend === "down")) {
      // Low/Falling Inflation = Bullish for rate-sensitive sectors and growth stocks
      optionsStrategies.push({
        name: "Bull Call Spread on XLRE (Real Estate)",
        ticker: "XLRE",
        type: "Rate-Sensitive Sector Bullish",
        rationale: `CPI at ${currentCPI.toFixed(1)}% and ${trend === "down" ? "falling" : "stable"}. Declining inflation pulls yields down, lifting rate-sensitive sectors like real estate.`,
        entry: "Buy ATM call, sell call 5% OTM",
        target: "Max profit as yields decline",
        stopLoss: "Exit if CPI readings surprise higher",
        timeframe: "45-60 DTE",
        risk: "Defined risk. Max loss = net debit paid.",
      })

      optionsStrategies.push({
        name: "Long Calls on QQQ (Tech/Growth)",
        ticker: "QQQ",
        type: "Growth Stocks",
        rationale:
          "Low inflation environment favors growth stocks. Tech benefits from lower discount rates on future earnings.",
        entry: "Buy ATM or slightly OTM calls (0.45-0.55 delta)",
        target: "+5-7% rally in tech sector",
        stopLoss: "Exit if QQQ breaks below support or loses 50% of premium",
        timeframe: "30-45 DTE",
        risk: "Limited to premium. Tech can be volatile.",
      })

      optionsStrategies.push({
        name: "Bull Call Spread on XLU (Utilities)",
        ticker: "XLU",
        type: "Defensive Sector",
        rationale: "Utilities perform well in low inflation as their dividend yields become more attractive.",
        entry: "Buy ATM call, sell call 5% OTM",
        target: "Max profit at short strike",
        stopLoss: "Exit at 50% loss",
        timeframe: "45-60 DTE",
        risk: "Defined risk. Max loss = net debit.",
      })

      optionsStrategies.push({
        name: "Long Calls on SPY",
        ticker: "SPY",
        type: "Broad Market",
        rationale: "Declining inflation reduces recession risk and supports equity valuations across all sectors.",
        entry: "Buy ATM calls (0.50 delta)",
        target: "+4-6% market rally",
        stopLoss: "Exit if SPY breaks key support levels",
        timeframe: "30-45 DTE",
        risk: "Limited to premium. Diversified exposure to entire market.",
      })
    } else {
      // Moderate/Neutral Inflation = Range-bound strategies
      optionsStrategies.push({
        name: "Iron Condor on SPY",
        ticker: "SPY",
        type: "Neutral Income",
        rationale: `CPI at ${currentCPI.toFixed(1)}% near stable levels. Market likely range-bound until next catalyst.`,
        entry: "Sell OTM call spread + OTM put spread",
        target: "Collect premium if SPY stays in range",
        stopLoss: "Exit at 2x credit received",
        timeframe: "30-45 DTE",
        risk: "Defined risk. Max loss = strike width - credit.",
      })

      optionsStrategies.push({
        name: "Calendar Spread on QQQ",
        ticker: "QQQ",
        type: "Time Decay",
        rationale: "Neutral inflation outlook. Profit from time decay if the index stays range-bound.",
        entry: "Sell near-term options, buy longer-term same strike",
        target: "Profit from faster near-term decay",
        stopLoss: "Exit if QQQ moves >3% either way",
        timeframe: "Front month 30 DTE, back month 60 DTE",
        risk: "Limited to net debit paid.",
      })

      optionsStrategies.push({
        name: "Covered Calls on Dividend Stocks",
        ticker: "Portfolio",
        type: "Income Strategy",
        rationale: "Stable inflation supports dividend stocks. Sell calls to generate income.",
        entry: "Sell OTM calls 5-7% above current price",
        target: "Collect premium monthly",
        stopLoss: "Buy back if strong rally",
        timeframe: "30-45 DTE",
        risk: "Caps upside. Requires stock ownership.",
      })

      optionsStrategies.push({
        name: "Straddle Sell Before CPI Release",
        ticker: "SPY",
        type: "Volatility Play",
        rationale: "If expecting muted CPI data, sell straddle to capture elevated pre-release IV.",
        entry: "Sell ATM call and put 1-2 days before CPI",
        target: "Profit from IV crush after release",
        stopLoss: "Exit if SPY moves >2% before release",
        timeframe: "Close immediately after CPI announcement",
        risk: "High risk. Use small position size. Undefined risk if wrong.",
      })
    }

    return NextResponse.json({
      currentCPI: Number(currentCPI.toFixed(2)),
      previousCPI: Number(previousCPI.toFixed(2)),
      trend,
      targetCPI: fedTarget,
      chartData,
      forecastData,
      optionsStrategies,
      inflationPressure,
      fedTarget,
      lastUpdated: new Date().toISOString(),
      dataSource: "FRED Economic Data (CPI-U, Consumer Price Index for All Urban Consumers)",
    })
  } catch (error) {
    console.error("Error fetching CPI inflation data:", error)
    return NextResponse.json({ error: "Failed to fetch CPI inflation data" }, { status: 500 })
  }
}
