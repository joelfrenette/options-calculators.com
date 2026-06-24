import { resolveApiKey } from "@/lib/api-keys"

// Fetch S&P 500 valuation (P/E, P/S) from Financial Modeling Prep, using SPY
// as the market proxy. Used as the live fallback for CCPI valuation when Apify
// is disabled. Returns null (or undefined fields) if FMP is unavailable so the
// caller can fall through to its baseline.
export async function fetchFMPValuation(
  symbol = "SPY",
): Promise<{ spxPE?: number; spxPS?: number; source: string } | null> {
  const key = resolveApiKey("FMP_API_KEY") // respects DISABLED_APIS
  if (!key) return null

  try {
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/key-metrics/${symbol}?limit=1&apikey=${key}`,
      { signal: AbortSignal.timeout(10000) },
    )
    if (!res.ok) return null
    const data = await res.json()
    const m = Array.isArray(data) ? data[0] : null
    if (!m) return null

    const pe = Number(m.peRatio)
    const ps = Number(m.priceToSalesRatio)
    return {
      spxPE: Number.isFinite(pe) && pe > 0 ? pe : undefined,
      spxPS: Number.isFinite(ps) && ps > 0 ? ps : undefined,
      source: "FMP key-metrics",
    }
  } catch {
    return null
  }
}
