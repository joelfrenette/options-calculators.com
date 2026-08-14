/**
 * S&P 500 P/E and P/S — free source first, paid source as fallback.
 *
 * P7-75. `/api/ccpi` scores `spxPE` (18 points) and `spxPS` (12), and derives
 * `equityRiskPremium` (10) from the P/E. Until now both came from Apify or FMP,
 * and on both hosts neither answered — `apify: baseline-no-token`, and FMP's
 * only other endpoint (the screener) is paid-tier and already latched off
 * (P7-41). So 40 of Valuation's 100 points had no live source at all.
 *
 * multpl.com publishes both figures for free, with no key, and survives a plain
 * server-side fetch — tested three times in a row for a stable body and an
 * extractable value, because a single successful request proves nothing (that
 * is exactly how aaii.com was briefly mistaken for a working free source; see
 * `looksBlocked`).
 *
 * ── ORDER MATTERS, AND P7-72 IS WHY ──────────────────────────────────────────
 * The free source is tried FIRST and the paid one is the fallback. The opposite
 * order would work equally well on any given request and would quietly mean the
 * free path never runs — which is precisely the defect P7-72 found in
 * `scrapePutCallRatio`, where an LLM was asked before CBOE and the real source
 * was reached only when the guess failed.
 *
 * Both paths are `live`: multpl and FMP are each reporting a measured figure.
 * The distinction the payload needs is WHICH one answered, not a tier.
 */
import { fetchFMPValuation } from "@/lib/fmp-valuation"
import { parseMultplPE, parseMultplPS } from "@/lib/valuation-parsers"

const MULTPL_PE = "https://www.multpl.com/s-p-500-pe-ratio"
const MULTPL_PS = "https://www.multpl.com/s-p-500-price-to-sales"

/**
 * A browser User-Agent, stated plainly rather than hidden.
 *
 * multpl serves the default Node agent too, but a request that identifies the
 * project is the courteous form and is what was tested. It is NOT an attempt to
 * defeat a bot wall: where a site blocks datacentre traffic (aaii.com does),
 * this module reports the failure and the caller falls back — it does not
 * escalate.
 */
const UA =
  "Mozilla/5.0 (compatible; options-calculators.com/1.0; +https://www.options-calculators.com)"

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export interface SpxValuation {
  /** NULL when no source produced a reading. Never a stand-in. */
  spxPE: number | null
  spxPS: number | null
  /** Which source actually answered, per field. */
  peSource: "multpl" | "fmp" | null
  psSource: "multpl" | "fmp" | null
}

/**
 * @returns both ratios with the source that produced each.
 *
 * The two fields are resolved INDEPENDENTLY. multpl can serve the P/E page and
 * fail the P/S one, and a combined "did the free source work" flag would then
 * throw away a good reading — the same half-a-reading mistake the CCPI canary
 * pairs were fixed for in P6-32.
 */
export async function fetchSpxValuation(): Promise<SpxValuation> {
  const [peHtml, psHtml] = await Promise.all([fetchText(MULTPL_PE), fetchText(MULTPL_PS)])

  let spxPE = peHtml ? parseMultplPE(peHtml) : null
  let spxPS = psHtml ? parseMultplPS(psHtml) : null
  let peSource: SpxValuation["peSource"] = spxPE === null ? null : "multpl"
  let psSource: SpxValuation["psSource"] = spxPS === null ? null : "multpl"

  // Only reach for the paid key for the field that is actually still missing.
  if (spxPE === null || spxPS === null) {
    const fmp = await fetchFMPValuation("SPY")
    if (fmp) {
      if (spxPE === null && typeof fmp.spxPE === "number") {
        spxPE = fmp.spxPE
        peSource = "fmp"
      }
      if (spxPS === null && typeof fmp.spxPS === "number") {
        spxPS = fmp.spxPS
        psSource = "fmp"
      }
    }
  }

  return { spxPE, spxPS, peSource, psSource }
}
