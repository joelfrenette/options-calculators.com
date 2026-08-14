import { type NextRequest, NextResponse } from "next/server"
import { isAuthenticated } from "@/lib/auth"
import { looksBlocked, parseMultplPE, parseMultplPS } from "@/lib/valuation-parsers"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Can this deployment reach the free data sources directly, or does it need a
 * scraping proxy?
 *
 * P7-75. The question is a spend question — `SCRAPINGBEE_API_KEY` and
 * `FMP_API_KEY` both cost money, and several of the figures they fetch are
 * published free — but it cannot be answered from a laptop. Datacentre IP
 * ranges get blocked where a residential one does not, and that is most of what
 * a scraping proxy is for. Only the deployment can answer it about itself.
 *
 * ── A 200 IS NOT AN ANSWER, AND THAT IS THE WHOLE DESIGN ─────────────────────
 * aaii.com replies to a plain server-side fetch with **HTTP 200 and an Imperva
 * interstitial**: about 6 KB of "Pardon Our Interruption" where 60 KB of survey
 * table belongs. A probe that recorded status codes would have called it a
 * working free source — and did, for one turn, on exactly that evidence, before
 * a second request returned the block page and exposed it.
 *
 * So every source is judged on whether a VALUE came back. `httpStatus` is
 * reported beside it, never instead of it. This is the project's own rule
 * ("never 200 with an error body") applied in the direction it is usually met:
 * somebody else's server doing it to us.
 *
 * ── WHY IT IS ADMIN-ONLY ─────────────────────────────────────────────────────
 * It makes the server fetch arbitrary fixed third-party URLs on request. The
 * list is hardcoded and cannot be steered by a caller, but an unauthenticated
 * endpoint that performs outbound requests on demand is a thing worth not
 * having — and P7-70 was an unauthenticated diagnostics route that turned out to
 * publish a credential.
 */

interface ProbeResult {
  source: string
  url: string
  /** What the source is wanted FOR, so a reader knows the cost of losing it. */
  provides: string
  httpStatus: number | null
  bytes: number | null
  /** True when the body is an interstitial served with a success status. */
  blocked: boolean
  /** The parsed figure, or null. This — not the status — is the verdict. */
  value: number | string | null
  /**
   * `usable` is the only field to act on. A source is usable when a value came
   * back, whatever the status said.
   */
  usable: boolean
  detail: string | null
}

const UA =
  "Mozilla/5.0 (compatible; options-calculators.com/1.0; +https://www.options-calculators.com)"

async function probe(
  source: string,
  url: string,
  provides: string,
  extract: (html: string) => number | string | null,
  minimumPlausibleBytes: number,
): Promise<ProbeResult> {
  const base = { source, url, provides }
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,text/csv" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    })
    const body = await res.text().catch(() => "")
    const blocked = looksBlocked(body, minimumPlausibleBytes)
    const value = res.ok && !blocked ? extract(body) : null
    return {
      ...base,
      httpStatus: res.status,
      bytes: body.length,
      blocked,
      value,
      usable: value !== null,
      detail: blocked
        ? "answered with a bot interstitial — a scraping proxy is required for this source"
        : !res.ok
          ? `HTTP ${res.status}`
          : value === null
            ? "reachable, but no value could be parsed — the page shape may have changed"
            : null,
    }
  } catch (e) {
    return {
      ...base,
      httpStatus: null,
      bytes: null,
      blocked: false,
      value: null,
      usable: false,
      detail: `request failed: ${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

/** Latest dated P/C ratio out of a CBOE volume CSV, or null. */
function extractCboeRatio(csv: string): string | null {
  const lines = csv.trim().split("\n")
  for (let i = lines.length - 1; i >= 0; i--) {
    const cols = lines[i].split(",").map((c) => c.trim())
    if (cols.length < 5) continue
    const ratio = Number.parseFloat(cols[4])
    if (Number.isFinite(ratio) && ratio > 0.1 && ratio < 5) return `${cols[0]} → ${ratio}`
  }
  return null
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const results = await Promise.all([
    probe(
      "multpl",
      "https://www.multpl.com/s-p-500-pe-ratio",
      "spxPE — 18 pts of CCPI Valuation, and equityRiskPremium (10) is derived from it",
      parseMultplPE,
      5000,
    ),
    probe(
      "multpl",
      "https://www.multpl.com/s-p-500-price-to-sales",
      "spxPS — 12 pts of CCPI Valuation",
      parseMultplPS,
      5000,
    ),
    probe(
      "aaii",
      "https://www.aaii.com/sentimentsurvey/sent_results",
      "aaiiBullish — 26 pts of CCPI Risk Appetite",
      // Any percentage in the survey table is enough to prove the page arrived;
      // a real parser is only worth writing if this ever comes back usable.
      (html) => /([0-9]{1,2}\.[0-9])%/.exec(html)?.[1] ?? null,
      20_000,
    ),
    probe(
      "cboe-archive",
      "https://cdn.cboe.com/resources/options/volume_and_call_put_ratios/totalpc.csv",
      "putCallRatio — 29 pts of CCPI Risk Appetite",
      extractCboeRatio,
      1000,
    ),
  ])

  const usable = results.filter((r) => r.usable).map((r) => `${r.source}:${r.provides.split(" ")[0]}`)
  const blocked = results.filter((r) => r.blocked).map((r) => r.source)

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    // Stated so a reader knows what this run is evidence ABOUT. A probe from a
    // laptop and a probe from the deployment answer different questions, and
    // only the second one decides whether a subscription can be cancelled.
    probedFrom: new URL(request.url).origin,
    summary: {
      usable,
      blocked,
      note:
        "`usable` is the verdict. httpStatus is reported for diagnosis only — aaii.com serves a bot interstitial at HTTP 200, so a status-code probe reports it as working (P7-75).",
    },
    results,
  })
}
