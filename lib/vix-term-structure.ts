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

import { resolveApiKey } from "@/lib/api-keys"
import { meteredFetch } from "@/lib/metered-fetch"
import { getSeriesHistory } from "@/lib/market-series"
import { computeTermStructure, BASELINE_RATIO, BASELINE_SPOT } from "@/lib/vix-term"

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

// The maths lives in lib/vix-term.ts, which stays import-free so the check
// scripts can load it under node's type stripping. Re-exported here so
// existing importers do not have to care which file it is in.
export { computeTermStructure, BASELINE_RATIO, BASELINE_SPOT }

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
  const res = await meteredFetch(
    "fred",
    `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&limit=5&sort_order=desc`,
    { signal: AbortSignal.timeout(10000), routeTag: "vix-term-structure" },
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

/**
 * Store-first read of the pair (E-7c). Both legs must come from the SAME day:
 * pairing a stale spot VIX with a fresh VIX3M manufactures a ratio move out of
 * a data gap, and this ratio crossing 1 IS the backwardation signal.
 */
async function fetchFromStore(): Promise<{ spotVIX: number; vix3m: number } | null> {
  const [spotRows, vix3mRows] = await Promise.all([
    getSeriesHistory("fred:VIXCLS", 10),
    getSeriesHistory("fred:VXVCLS", 10),
  ])
  if (!spotRows?.length || !vix3mRows?.length) return null
  const vix3mByDay = new Map(vix3mRows.map((r) => [r.day, r.value]))
  const paired = spotRows.find((r) => vix3mByDay.has(r.day))
  if (!paired) return null
  const spotVIX = paired.value
  const vix3m = vix3mByDay.get(paired.day) as number
  if (!(spotVIX > 0) || !(vix3m > 0)) return null
  return { spotVIX, vix3m }
}

export async function fetchVIXTermStructure(): Promise<VIXTermStructureData> {
  // E-7c: the daily market-snapshot cron stores both legs, so the common path
  // costs no FRED call at all.
  const stored = await fetchFromStore()
  if (stored) {
    const { termStructure, isInverted } = computeTermStructure(stored.spotVIX, stored.vix3m)
    return { ...stored, termStructure, isInverted, source: "live", timestamp: new Date().toISOString() }
  }

  // P6-12: through resolveApiKey, so DISABLED_APIS and the admin key panel
  // apply. This read `process.env.FRED_API_KEY` directly.
  const FRED_API_KEY = resolveApiKey("FRED_API_KEY")

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
