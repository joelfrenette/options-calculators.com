/**
 * The Buffett Indicator from FRED — store first, live FRED second, never a
 * scrape and never a model.
 *
 * P7-73a (owner decision 2026-08-14, CCPI_DESIGN §8b option a): the CCPI scores
 * the FRED nonfinancial-corporate-equities basis through the recalibrated
 * ladder in `lib/ccpi/buffett-bands.ts`, and the GuruFocus/ScrapingBee scrape
 * is retired for this input. Both halves are quarterly:
 *
 *   NCBEILQ027S  nonfinancial corporate equities, MILLIONS of USD (Z.1)
 *   GDP          nominal GDP, BILLIONS of USD (SAAR)
 *
 * The unit conversion and every refusal rule live in
 * `lib/ccpi/buffett-indicator.ts` (15 assertions, including the 1000× trap).
 * This module only finds the two observations: the market_series store is
 * populated by the snapshot cron on production; on hosts where the cron has
 * never run (staging previews) it falls through to one live FRED call per
 * half, and when neither source answers it returns null — the indicator is
 * then excluded from scoring (P6-34), never estimated.
 */

import { resolveApiKey } from "@/lib/api-keys"
import { fetchWithTimeout } from "@/lib/fetch-timeout"
import { fredLatestFromStore } from "@/lib/fred-store"
import { computeBuffettIndicator, type BuffettReading } from "@/lib/ccpi/buffett-indicator"

export interface FredBuffettResult {
  reading: BuffettReading
  /** Which path answered, for the provenance panel. */
  source: "FRED-store" | "FRED-live"
}

async function liveObservation(seriesId: string): Promise<{ value: number; day: string } | null> {
  const key = resolveApiKey("FRED_API_KEY")
  if (!key) return null
  try {
    const url =
      `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}` +
      `&api_key=${key}&file_type=json&sort_order=desc&limit=4`
    const res = await fetchWithTimeout(url, {}, 8000)
    if (!res.ok) return null
    const json = await res.json()
    for (const obs of json?.observations ?? []) {
      const v = Number(obs?.value)
      if (obs?.value !== "." && Number.isFinite(v)) return { value: v, day: obs.date }
    }
    return null
  } catch {
    return null
  }
}

async function observation(
  seriesId: string,
): Promise<{ value: number; day: string; fromStore: boolean } | null> {
  try {
    const stored = await fredLatestFromStore(seriesId)
    if (stored) return { ...stored, fromStore: true }
  } catch {
    /* store unreachable — the live path below still gets its chance */
  }
  const live = await liveObservation(seriesId)
  return live ? { ...live, fromStore: false } : null
}

export async function fetchFredBuffett(): Promise<FredBuffettResult | null> {
  const [equities, gdp] = await Promise.all([observation("NCBEILQ027S"), observation("GDP")])
  const reading = computeBuffettIndicator(
    { corporateEquitiesMillions: equities?.value ?? null, gdpBillions: gdp?.value ?? null },
    equities?.day ?? null,
    gdp?.day ?? null,
  )
  if (!reading || !equities || !gdp) return null
  // The label names the weaker path: if either half needed the live call, the
  // pair is not a pure store read.
  return { reading, source: equities.fromStore && gdp.fromStore ? "FRED-store" : "FRED-live" }
}
