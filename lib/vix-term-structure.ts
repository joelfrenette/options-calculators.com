// VIX Term Structure — slope of the volatility curve from REAL data.
//
// RATIO convention: termStructure = VIX3M / spot VIX.
//   > 1  contango (normal; 3-month vol priced above spot vol)
//   < 1  backwardation (near-term fear priced above 3-month vol) = crash signal
//
// Sources (FRED): VIXCLS (spot VIX), VXVCLS (Cboe 3-Month Volatility Index,
// a.k.a. VIX3M). The previous implementation fabricated the future leg as
// `spot × 1.08`, which made isInverted mathematically always false and the
// module's stated purpose (backwardation detection) impossible (AUDIT P3-14).

export interface VIXTermStructureData {
  spotVIX: number
  /** Cboe 3-month volatility index (VIX3M / VXVCLS) */
  vix3m: number
  /** RATIO: vix3m / spotVIX. <1 = backwardation. */
  termStructure: number
  isInverted: boolean
  source: "live" | "baseline"
  timestamp: string
}

/** Long-run normal contango ratio, used only on the baseline path. */
const BASELINE_RATIO = 1.08
const BASELINE_SPOT = 18

/** Pure helper so the ratio/inversion rule is unit-testable without I/O. */
export function computeTermStructure(spotVIX: number, vix3m: number): { termStructure: number; isInverted: boolean } {
  if (!(spotVIX > 0) || !(vix3m > 0)) {
    return { termStructure: BASELINE_RATIO, isInverted: false }
  }
  const termStructure = vix3m / spotVIX
  return { termStructure, isInverted: termStructure < 1 }
}

function baseline(): VIXTermStructureData {
  return {
    spotVIX: BASELINE_SPOT,
    vix3m: BASELINE_SPOT * BASELINE_RATIO,
    termStructure: BASELINE_RATIO,
    isInverted: false,
    source: "baseline",
    timestamp: new Date().toISOString(),
  }
}

/** FRED daily series can contain "." placeholders on holidays — take the most recent numeric value. */
async function fetchLatestFredValue(seriesId: string, apiKey: string): Promise<number> {
  const res = await fetch(
    `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&limit=5&sort_order=desc`,
    { signal: AbortSignal.timeout(10000) },
  )
  if (!res.ok) {
    throw new Error(`FRED API error for ${seriesId}: ${res.status}`)
  }
  const data = await res.json()
  for (const obs of data.observations ?? []) {
    const value = Number.parseFloat(obs.value)
    if (Number.isFinite(value) && value > 0) return value
  }
  throw new Error(`FRED ${seriesId}: no numeric observations`)
}

export async function fetchVIXTermStructure(): Promise<VIXTermStructureData> {
  const FRED_API_KEY = process.env.FRED_API_KEY

  if (!FRED_API_KEY) {
    console.log("[v0] VIX Term Structure: Using baseline (no FRED API key)")
    return baseline()
  }

  try {
    const [spotVIX, vix3m] = await Promise.all([
      fetchLatestFredValue("VIXCLS", FRED_API_KEY),
      fetchLatestFredValue("VXVCLS", FRED_API_KEY),
    ])

    const { termStructure, isInverted } = computeTermStructure(spotVIX, vix3m)

    console.log(
      `[v0] VIX Term Structure: ratio ${termStructure.toFixed(3)} (${isInverted ? "BACKWARDATION" : "contango"}) - Spot: ${spotVIX}, VIX3M: ${vix3m}`,
    )

    return {
      spotVIX,
      vix3m,
      termStructure,
      isInverted,
      source: "live",
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error("[v0] VIX Term Structure fetch failed:", error)
    return baseline()
  }
}
