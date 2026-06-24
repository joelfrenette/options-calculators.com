// Hedge Fund 13F Tracker — for each curated fund, look up the latest 13F-HR
// filing date from SEC EDGAR (free, no key) and surface a direct link to
// view holdings. Top-holdings parsing requires fetching + parsing the XML
// Information Table per filing (heavy and rate-limited per IP); we
// intentionally LINK OUT to SEC EDGAR for holdings rather than re-parse, so
// users always get current, canonical data.

import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const SEC_USER_AGENT = "options-calculators.com 13f-tracker contact@options-calculators.com"

interface Fund {
  cik: string
  name: string
  manager: string
  blurb: string
  ticker?: string // public proxy ticker if one exists (e.g. BRK.B for Berkshire)
}

// Curated set of widely-watched 13F filers. CIKs from SEC EDGAR full-text search.
const FUNDS: Fund[] = [
  { cik: "1067983", name: "Berkshire Hathaway", manager: "Warren Buffett", ticker: "BRK.B", blurb: "Long-duration value & financials; iconic Coca-Cola, Apple, BAC stakes." },
  { cik: "1037389", name: "Renaissance Technologies", manager: "Quant / Jim Simons", blurb: "Quantitative fund; Medallion is closed-out but RIEF holdings disclosed in 13F." },
  { cik: "1336528", name: "Bridgewater Associates", manager: "Ray Dalio (founder)", blurb: "Macro-driven holdings; ETF-heavy 13F skews to broad-market exposure." },
  { cik: "1336528", name: "Pershing Square Capital", manager: "Bill Ackman", blurb: "Concentrated activist long-only book; current focus: restaurants & rate plays." },
  { cik: "846222", name: "Soros Fund Management", manager: "Soros / Scott Bessent legacy", blurb: "Macro/event-driven; tech tilt in recent quarters." },
  { cik: "1029160", name: "Appaloosa Management", manager: "David Tepper", blurb: "Hedge fund with big tech-overweight (META, AMZN historically). Sharp turnover." },
  { cik: "1633313", name: "Scion Asset Management", manager: "Michael Burry", blurb: "'The Big Short' guy. Small but watched concentrated book; often contrarian." },
  { cik: "1535219", name: "Greenlight Capital", manager: "David Einhorn", blurb: "Long/short equity; well-known short calls historically." },
]

interface FundWithFiling extends Fund {
  latestFiling: {
    accession: string | null
    filedAt: string | null
    period: string | null
    holdingsUrl: string | null
  } | null
}

// Look up the most recent 13F-HR filing for a CIK via EDGAR's data JSON.
async function fetchLatest13F(cik: string): Promise<FundWithFiling["latestFiling"]> {
  try {
    // The 10-digit zero-padded CIK is required for the JSON endpoint.
    const padded = cik.padStart(10, "0")
    const res = await fetch(`https://data.sec.gov/submissions/CIK${padded}.json`, {
      headers: { "User-Agent": SEC_USER_AGENT, Accept: "application/json" },
      next: { revalidate: 21600 }, // 6-hour cache
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const recent = data?.filings?.recent
    if (!recent || !Array.isArray(recent.form)) return null
    // Find first index where form is "13F-HR".
    let idx = -1
    for (let i = 0; i < recent.form.length; i++) {
      if (recent.form[i] === "13F-HR" || recent.form[i] === "13F-HR/A") {
        idx = i
        break
      }
    }
    if (idx < 0) return null
    const accession = String(recent.accessionNumber[idx] || "")
    const filedAt = String(recent.filingDate[idx] || "")
    const period = String(recent.reportDate?.[idx] || recent.reportDate?.[idx] || "")
    // Build the holdings-page URL on EDGAR.
    const accNoDashes = accession.replace(/-/g, "")
    const holdingsUrl = accession
      ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${padded}&type=13F-HR&dateb=&owner=include&count=10`
      : null
    return {
      accession,
      filedAt,
      period,
      holdingsUrl: accession
        ? `https://www.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${accNoDashes}/`
        : holdingsUrl,
    }
  } catch {
    return null
  }
}

export async function GET() {
  const results = await Promise.all(
    FUNDS.map(async (f) => ({
      ...f,
      latestFiling: await fetchLatest13F(f.cik),
    })),
  )
  return NextResponse.json({
    success: true,
    source: "SEC EDGAR (data.sec.gov submissions API)",
    funds: results,
    generatedAt: new Date().toISOString(),
  })
}
