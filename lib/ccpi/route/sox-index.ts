/**
 * The PHLX Semiconductor Index (^SOX), measured.
 *
 * P7-89. The scored `soxIndex` input had exactly one source — an LLM's
 * recollection — which meant it could never reach tier "live" and its 9 points
 * of Momentum weight were a permanent hole in the certainty ceiling (P6-35
 * counted it among the six). The index itself is public: Yahoo's chart API
 * serves ^SOX without a key, the same host the QQQ technicals already fall
 * back to. One request, last regular-session close, null on anything odd.
 *
 * The LLM getter remains as a DISPLAY fallback in market-data (ai-estimate
 * never scores, P6-34); this module is what lets the input score at all.
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout"

export interface SoxReading {
  level: number
  asOf: string
}

export async function fetchSoxIndex(): Promise<SoxReading | null> {
  try {
    const res = await fetchWithTimeout(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5ESOX?range=5d&interval=1d",
      { headers: { "User-Agent": "Mozilla/5.0" } },
      8000,
    )
    if (!res.ok) return null
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close ?? []
    const stamps: number[] = result?.timestamp ?? []
    for (let i = closes.length - 1; i >= 0; i--) {
      const v = closes[i]
      if (v != null && Number.isFinite(v) && v > 0) {
        const asOf = stamps[i] ? new Date(stamps[i] * 1000).toISOString().slice(0, 10) : ""
        if (!asOf) return null
        return { level: v, asOf }
      }
    }
    return null
  } catch {
    return null
  }
}
