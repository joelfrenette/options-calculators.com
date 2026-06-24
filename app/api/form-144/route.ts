// Form 144 Watch — planned insider SALES filed with the SEC. Form 144 is
// filed by an insider when they INTEND to sell restricted/control stock —
// effectively an early-warning signal up to 90 days before the sale.
// SEC EDGAR publishes Form 144 filings via the "browse-edgar getcurrent"
// atom feed (free, no key, rate-limited by user-agent identification).

import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const SEC_USER_AGENT = "options-calculators.com form-144-watch contact@options-calculators.com"

interface Filing {
  filer: string
  cik: string
  accession: string
  filedAt: string
  url: string
}

export async function GET(request: Request) {
  const count = Math.min(100, Math.max(20, Number.parseInt(new URL(request.url).searchParams.get("count") || "40", 10)))

  try {
    const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=144&company=&dateb=&owner=include&count=${count}&output=atom`
    const res = await fetch(url, {
      headers: { "User-Agent": SEC_USER_AGENT, Accept: "application/atom+xml,application/xml,text/xml" },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: `SEC EDGAR returned HTTP ${res.status}.`, filings: [] },
        { status: 200 },
      )
    }
    const xml = await res.text()
    // Atom feed regex parse — simpler than adding fast-xml-parser. Each
    // <entry> block contains <title>, <link href="..."/>, <updated>.
    const filings: Filing[] = []
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
    let match: RegExpExecArray | null
    while ((match = entryRegex.exec(xml)) !== null) {
      const block = match[1]
      const titleRaw = (block.match(/<title>([\s\S]*?)<\/title>/) || ["", ""])[1].trim()
      const linkHref = (block.match(/<link\s+[^>]*href="([^"]+)"/) || ["", ""])[1]
      const updated = (block.match(/<updated>([\s\S]*?)<\/updated>/) || ["", ""])[1].trim()
      // EDGAR title format: "144 - Filer Name (0000000000)"
      const m = titleRaw.match(/^144\s*-\s*(.+?)\s*\((\d+)\)/)
      const filer = m ? m[1].trim() : titleRaw.replace(/^144\s*-\s*/, "").trim()
      const cik = m ? m[2] : ""
      const accMatch = linkHref.match(/(\d{10}-\d{2}-\d{6})/)
      filings.push({
        filer,
        cik,
        accession: accMatch ? accMatch[1] : "",
        filedAt: updated.slice(0, 19),
        url: linkHref,
      })
    }

    return NextResponse.json({
      success: true,
      source: "SEC EDGAR Form 144 current feed",
      count: filings.length,
      filings,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "unknown", filings: [] },
      { status: 200 },
    )
  }
}
