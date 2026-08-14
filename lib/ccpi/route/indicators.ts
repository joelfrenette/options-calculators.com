/**
 * The macro and sentiment feeds behind /api/ccpi: FRED, Alpha Vantage, and the
 * equity fear/greed reading.
 *
 * Split out of `app/api/ccpi/route.ts` (P6-13) unchanged.
 */
import { resolveApiKey } from "@/lib/api-keys"
import { fredLatestFromStore } from "@/lib/fred-store"

export async function fetchFREDIndicators() {
  const FRED_API_KEY = resolveApiKey("FRED_API_KEY")

  // Nulls, not constants (P6-6). The assembly layer applies its labeled
  // `?? baseline` there, and the per-field tier map reads null = "baseline" so
  // the constant is excluded from scoring. Returning numbers here would make
  // the per-field null-checks stamp invented values as live.
  const baselineValues = {
    fedFundsRate: null as number | null,
    junkSpread: null as number | null,
    yieldCurve: null as number | null,
    debtToGDP: null as number | null,
    tedSpread: null as number | null,
    dxyIndex: null as number | null,
    ismPMI: null as number | null,
    fedReverseRepo: null as number | null,
    shillerCAPE: null as number | null,
    yieldCurve10Y: null as number | null,
    source: "baseline" as const,
  }

  // E-7b store-first: the daily fred-snapshot cron already holds these series
  // in market_series; eight sub-second Supabase reads replace eight FRED round
  // trips per CCPI load. All-or-nothing — any stale/missing series falls
  // through to the live path unchanged, so the store is never a new failure
  // mode (and works even when FRED itself is down or the key is absent).
  try {
    // TEDRATE is deliberately NOT read (P7-87): FRED discontinued it on
    // 2022-01-21 when LIBOR ended, so its "latest" observation is that day's
    // 0.09 forever. Reading it here meant a four-year-old number tiered "live"
    // and scored as today's interbank stress — present-but-terminal passed
    // every missing-data guard the P6-6 fix added. tedSpread is null below,
    // which the tier map turns into "baseline" and scoring excludes; whether
    // the weight moves to a SOFR-era successor is an owner decision.
    const [sDff, sJunk, sCurve, sDebt, sDxy, sRrp, s10y] = await Promise.all([
      fredLatestFromStore("DFF"),
      fredLatestFromStore("BAMLH0A0HYM2"),
      fredLatestFromStore("T10Y2Y"),
      fredLatestFromStore("GFDEGDQ188S"),
      fredLatestFromStore("DTWEXBGS"),
      fredLatestFromStore("RRPONTSYD"),
      fredLatestFromStore("DGS10"),
    ])
    if (sDff && sJunk && sCurve && sDebt && sDxy && sRrp && s10y) {
      return {
        fedFundsRate: sDff.value,
        junkSpread: sJunk.value,
        yieldCurve: sCurve.value,
        debtToGDP: sDebt.value,
        tedSpread: null, // discontinued series — see P7-87 note above
        dxyIndex: sDxy.value,
        ismPMI: null, // never carried by FRED; comes from the AI fallback
        fedReverseRepo: sRrp.value,
        shillerCAPE: null, // dead field, see live path note (P6-7)
        yieldCurve10Y: s10y.value,
        // Measured FRED observations, served from the snapshot store — same
        // provenance tier as a direct FRED read, not an estimate.
        source: "live" as const,
      }
    }
  } catch {
    // fall through to live FRED
  }

  if (!FRED_API_KEY) {
    return baselineValues
  }

  try {
    const baseUrl = "https://api.stlouisfed.org/fred/series/observations"

    const [fedFundsRes, junkSpreadRes, yieldCurveRes, debtToGDPRes, dxyRes, rrpRes, treasury10YRes] =
      await Promise.all([
        fetch(`${baseUrl}?series_id=DFF&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, {
          signal: AbortSignal.timeout(10000),
        }),
        fetch(`${baseUrl}?series_id=BAMLH0A0HYM2&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, {
          signal: AbortSignal.timeout(10000),
        }),
        fetch(`${baseUrl}?series_id=T10Y2Y&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, {
          signal: AbortSignal.timeout(10000),
        }),
        fetch(`${baseUrl}?series_id=GFDEGDQ188S&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, {
          signal: AbortSignal.timeout(10000),
        }),
        fetch(`${baseUrl}?series_id=DTWEXBGS&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, {
          signal: AbortSignal.timeout(10000),
        }),
        fetch(`${baseUrl}?series_id=RRPONTSYD&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, {
          signal: AbortSignal.timeout(10000),
        }),
        fetch(`${baseUrl}?series_id=DGS10&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, {
          signal: AbortSignal.timeout(10000),
        }),
      ])

    const [fedFunds, junkSpread, yieldCurve, debtToGDP, dxy, rrp, treasury10Y] = await Promise.all([
      fedFundsRes.json(),
      junkSpreadRes.json(),
      yieldCurveRes.json(),
      debtToGDPRes.json(),
      dxyRes.json(),
      rrpRes.json(),
      treasury10YRes.json(),
    ])

    // Per-series honesty (P6-6): a missing FRED observation parses to null,
    // never to a constant. The old `|| "5.33"`-style fallbacks meant one dead
    // series silently entered the CCPI as an invented number stamped "live" —
    // the assembly layer's `?? baseline` + per-field tier is where a fallback
    // is allowed to happen, because there it is labeled and excluded from
    // scoring.
    const obs = (r: any): number | null => {
      const v = Number.parseFloat(r?.observations?.[0]?.value)
      return Number.isFinite(v) ? v : null
    }

    return {
      fedFundsRate: obs(fedFunds),
      junkSpread: obs(junkSpread),
      yieldCurve: obs(yieldCurve),
      debtToGDP: obs(debtToGDP),
      tedSpread: null, // discontinued series — see P7-87 note above
      dxyIndex: obs(dxy),
      ismPMI: null, // never carried by FRED; comes from the AI fallback
      fedReverseRepo: obs(rrp),
      // Dead field kept for shape only. The scored CAPE is shillerCAPEResult
      // from the tiered AI-fallback path; the old fetchShillerCAPEWithGrok()
      // call here burned an LLM request per CCPI load for a value nothing
      // consumed (P6-7).
      shillerCAPE: null,
      yieldCurve10Y: obs(treasury10Y),
      source: "live" as const,
    }
  } catch (error) {
    console.error("[v0] FRED API error:", error instanceof Error ? error.message : String(error))
    // No CAPE call here either — same dead field as the happy path (P6-7).
    return baselineValues
  }
}

export async function fetchAlphaVantageIndicators() {
  const ALPHA_VANTAGE_API_KEY = resolveApiKey("ALPHA_VANTAGE_API_KEY")

  // P7-10. **This is where the fabricated 50 actually came from.** The caller
  // reads `alphaVantageData?.nvidiaMomentum ?? null`, and that `??` never fired:
  // this function returns `baselineValues` — not null — whenever the key is
  // missing or the fetch throws, so a full set of invented numbers arrived
  // looking exactly like measurements. A default written at the source outlives
  // every null-guard written at the call site.
  //
  // Only `nvidiaMomentum` and `source` are read from this object at all
  // (`nvidiaPrice` and `soxIndex` are taken from their own AI-fallback results,
  // and `mag7Concentration` has no reader), so the other three were invented
  // constants sitting where a future caller would have found them and believed
  // them. All four are null; `source: "baseline"` is what the tier map reads to
  // exclude the input from scoring.
  const baselineValues = {
    nvidiaPrice: null,
    nvidiaMomentum: null,
    soxIndex: null,
    mag7Concentration: null,
    source: "baseline" as const,
  }

  if (!ALPHA_VANTAGE_API_KEY) {
    return baselineValues
  }

  try {
    const [nvidiaRes, soxRes, aaplRes, msftRes, googlRes, amznRes, metaRes, tslaRes] = await Promise.all([
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=NVDA&apikey=${ALPHA_VANTAGE_API_KEY}`, {
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SOXX&apikey=${ALPHA_VANTAGE_API_KEY}`, {
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${ALPHA_VANTAGE_API_KEY}`, {
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=MSFT&apikey=${ALPHA_VANTAGE_API_KEY}`, {
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=GOOGL&apikey=${ALPHA_VANTAGE_API_KEY}`, {
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AMZN&apikey=${ALPHA_VANTAGE_API_KEY}`, {
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=META&apikey=${ALPHA_VANTAGE_API_KEY}`, {
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=TSLA&apikey=${ALPHA_VANTAGE_API_KEY}`, {
        signal: AbortSignal.timeout(10000),
      }),
    ])

    const [nvidiaData, soxData, aaplData, msftData, googlData, amznData, metaData, tslaData] = await Promise.all([
      nvidiaRes.json(),
      soxRes.json(),
      aaplRes.json(),
      msftRes.json(),
      googlRes.json(),
      amznRes.json(),
      metaRes.json(),
      tslaRes.json(),
    ])

    const nvidiaPrice = Number.parseFloat(nvidiaData?.["Global Quote"]?.["05. price"] || "800")
    const nvidiaChangePercent = Number.parseFloat(
      nvidiaData?.["Global Quote"]?.["10. change percent"]?.replace("%", "") || "0",
    )
    // Map momentum to 0-100 scale: -10% = 100 (high risk), 0% = 50, +10% = 0 (low risk)
    const nvidiaMomentum = Math.min(100, Math.max(0, 50 - nvidiaChangePercent * 5))

    const soxIndex = Number.parseFloat(soxData?.["Global Quote"]?.["05. price"] || "5000")

    // This is a proxy based on stock price strength
    const mag7Avg =
      [aaplData, msftData, googlData, amznData, metaData, tslaData, nvidiaData]
        .map((d) => Number.parseFloat(d?.["Global Quote"]?.["10. change percent"]?.replace("%", "") || "0"))
        .reduce((a, b) => a + b, 0) / 7

    // Higher = more concentrated (using simplified proxy)
    const mag7Concentration = 55 + (mag7Avg > 0 ? 5 : -5)

    console.log(
      `[v0] Alpha Vantage Phase 2: NVDA=${nvidiaPrice}, Change=${nvidiaChangePercent}%, Momentum=${nvidiaMomentum.toFixed(1)}, SOX=${soxIndex}, Mag7=${mag7Concentration.toFixed(1)}%`,
    )

    return {
      nvidiaPrice,
      nvidiaMomentum,
      soxIndex,
      mag7Concentration,
      source: "live" as const,
    }
  } catch (error) {
    console.error("[v0] Alpha Vantage error:", error)
    return baselineValues
  }
}

/**
 * CNN equity Fear & Greed index (P3-11). The previous implementation fetched
 * api.alternative.me — the CRYPTO Fear & Greed index — and scored it as equity
 * sentiment. On failure this returns null and the indicator is excluded from
 * Pillar 2 with renormalization (rule P3-12), instead of silently deflating
 * the pillar.
 */
export async function fetchEquityFearGreed(): Promise<{ fearGreed: number | null; dataSource: string }> {
  try {
    const res = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      throw new Error(`CNN F&G API returned ${res.status}`)
    }

    const data = await res.json()
    const score = Number(data?.fear_and_greed?.score)
    if (Number.isFinite(score) && score >= 0 && score <= 100) {
      console.log(`[v0] ✓ CNN Fear & Greed: ${Math.round(score)}`)
      return { fearGreed: Math.round(score), dataSource: "cnn-live" }
    }
    throw new Error("CNN F&G payload missing fear_and_greed.score")
  } catch (error) {
    console.warn("[v0] CNN Fear & Greed fetch failed:", error instanceof Error ? error.message : String(error))
    return { fearGreed: null, dataSource: "unavailable" }
  }
}
