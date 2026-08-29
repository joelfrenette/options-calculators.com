import { NextResponse } from "next/server"
import { resolveApiKey } from "@/lib/api-keys"
import { fredLatestFromStore, fredHistoryFromStore } from "@/lib/fred-store"
import { meteredFetch } from "@/lib/metered-fetch"

// Macro Indicators API - USD Index, M2, Unemployment, Debt-to-GDP.
// No in-repo consumer (probed by health checks only). E-7b: FRED values come
// store-first from the fred-snapshot cron, live FRED as fallback. Data
// honesty pass in the same change: the old code stamped missing observations
// as 0 (`|| "0"`), and its "growth_rate_yoy" was really month-over-month —
// obs[0] vs obs[1] of a monthly series. YoY now compares 12 months back and
// is null until 13 observations exist.

const num = (v: unknown): number | null => {
  const n = Number.parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

async function fredLive(seriesId: string, key: string, limit: number): Promise<{ day: string; value: number }[] | null> {
  try {
    const res = await meteredFetch(
      "fred",
      `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&limit=${limit}&sort_order=desc`,
      { signal: AbortSignal.timeout(10000), routeTag: "/api/macro-indicators" },
    )
    if (!res.ok) return null
    const j = await res.json()
    const obs = Array.isArray(j?.observations) ? j.observations : []
    const rows = obs
      .map((o: any) => ({ day: String(o.date), value: Number.parseFloat(o.value) }))
      .filter((r: { value: number }) => Number.isFinite(r.value))
    return rows.length > 0 ? rows : null
  } catch {
    return null
  }
}

export async function GET() {
  const FRED_API_KEY = resolveApiKey("FRED_API_KEY")
  const ALPHA_VANTAGE_API_KEY = resolveApiKey("ALPHA_VANTAGE_API_KEY")

  try {
    // USD index proxy (inverted USD/EUR) — live only, intraday by nature.
    let usdIndex: number | null = null
    if (ALPHA_VANTAGE_API_KEY) {
      try {
        const dxyRes = await meteredFetch(
          "alphavantage",
          `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=EUR&apikey=${ALPHA_VANTAGE_API_KEY}`,
          { signal: AbortSignal.timeout(10000), routeTag: "/api/macro-indicators" },
        )
        if (dxyRes.ok) {
          const dxyData = await dxyRes.json()
          const rate = num(dxyData?.["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"])
          usdIndex = rate && rate > 0 ? Number(((1 / rate) * 100).toFixed(2)) : null
        }
      } catch {
        // usd_index stays null
      }
    }

    // FRED series: store first, live fallback. M2 needs 13 monthly points for
    // a true YoY comparison.
    const [m2Store, unempStore, debtStore] = await Promise.all([
      fredHistoryFromStore("M2SL", 13),
      fredLatestFromStore("UNRATE"),
      fredLatestFromStore("GFDEGDQ188S"),
    ])
    const m2Rows =
      m2Store && m2Store.length >= 13 ? m2Store : FRED_API_KEY ? await fredLive("M2SL", FRED_API_KEY, 13) : m2Store
    const unemp =
      unempStore ?? (FRED_API_KEY ? (await fredLive("UNRATE", FRED_API_KEY, 1))?.[0] ?? null : null)
    const debt =
      debtStore ?? (FRED_API_KEY ? (await fredLive("GFDEGDQ188S", FRED_API_KEY, 1))?.[0] ?? null : null)

    const m2Latest = m2Rows?.[0]?.value ?? null
    const m2YearAgo = m2Rows && m2Rows.length >= 13 ? m2Rows[12].value : null
    const m2Growth =
      m2Latest !== null && m2YearAgo !== null && m2YearAgo > 0
        ? Number((((m2Latest - m2YearAgo) / m2YearAgo) * 100).toFixed(2))
        : null

    const unempValue = unemp?.value ?? null
    const debtValue = debt?.value ?? null

    return NextResponse.json({
      status: "success",
      timestamp: new Date().toISOString(),
      data: {
        usd_index: usdIndex,
        m2_money_supply: {
          value: m2Latest,
          growth_rate_yoy: m2Growth,
          unit: "billions_usd",
        },
        unemployment_rate: {
          value: unempValue,
          unit: "percent",
        },
        debt_to_gdp: {
          value: debtValue,
          unit: "percent",
        },
        interpretation: {
          dollar_strength: usdIndex === null ? null : usdIndex > 105 ? "Strong" : usdIndex > 100 ? "Moderate" : "Weak",
          money_supply: m2Growth === null ? null : m2Growth > 10 ? "Inflationary" : m2Growth > 5 ? "Moderate" : "Tight",
          labor_market: unempValue === null ? null : unempValue < 4 ? "Strong" : "Weakening",
          fiscal_health: debtValue === null ? null : debtValue > 120 ? "High Risk" : "Manageable",
        },
      },
    })
  } catch (error) {
    console.error("[v0] Macro Indicators error:", error)
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to fetch macro indicators",
        error: String(error),
      },
      { status: 500 },
    )
  }
}
