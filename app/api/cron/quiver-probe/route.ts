import { NextResponse } from "next/server"
import { resolveApiKey } from "@/lib/api-keys"
import { meteredFetch } from "@/lib/metered-fetch"

/**
 * Quiver tier probe — E-8 gate.
 *
 * One read-only call per candidate dataset, reporting which of them Joel's
 * Quiver plan actually includes. E-8a/b/e/f/g/h build ONLY against endpoints
 * that answer here with real data — never against assumed ones.
 *
 * CRON_SECRET-gated (same posture as the other /api/cron routes): it spends
 * ~8 metered upstream calls per run and exists for operator use, not public
 * traffic. Nothing is stored; the response is the report.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 120

const CANDIDATES: { key: string; label: string; url: string }[] = [
  { key: "congresstrading", label: "Congress trading (baseline — known good)", url: "https://api.quiverquant.com/beta/live/congresstrading" },
  { key: "offexchange", label: "Off-exchange short volume (E-8a)", url: "https://api.quiverquant.com/beta/live/offexchange" },
  { key: "wallstreetbets", label: "WSB mentions (E-8b)", url: "https://api.quiverquant.com/beta/live/wallstreetbets" },
  { key: "insiders", label: "Insider transactions aggregate (E-8e)", url: "https://api.quiverquant.com/beta/live/insiders" },
  // "thirteenf" 404'd (name unknown); Django URL resolution 401s on real routes
  // and 404s on unknown ones, and sec13f/sec13fchanges answer 401 unauthenticated.
  { key: "sec13f", label: "13F holdings (E-8f)", url: "https://api.quiverquant.com/beta/live/sec13f" },
  { key: "sec13fchanges", label: "13F position changes (E-8f)", url: "https://api.quiverquant.com/beta/live/sec13fchanges" },
  { key: "govcontracts", label: "Government contracts (E-8g)", url: "https://api.quiverquant.com/beta/live/govcontractsall" },
  { key: "lobbying", label: "Lobbying (E-8g)", url: "https://api.quiverquant.com/beta/live/lobbying" },
  // ---- E-8h, endpoint name still unresolved --------------------------------
  // Both of these answered 404 on the PAID plan (2026-08-10). On this API a
  // 404 means the route does not exist, not that the dataset is unlicensed —
  // 403 is what "not in plan" looks like, and the four datasets we do hold
  // return 200. So the name is wrong rather than the entitlement, and it is
  // worth exhausting the plausible spellings before writing E-8h off.
  { key: "wikipedia", label: "Wikipedia page views (E-8h)", url: "https://api.quiverquant.com/beta/live/wikipedia" },
  { key: "wikipedia-historical", label: "Wikipedia page views, historical per-ticker (E-8h)", url: "https://api.quiverquant.com/beta/historical/wikipedia/AAPL" },
  { key: "wikipediapageviews", label: "E-8h variant: wikipediapageviews", url: "https://api.quiverquant.com/beta/live/wikipediapageviews" },
  { key: "wikipedia-views", label: "E-8h variant: wikipedia_page_views", url: "https://api.quiverquant.com/beta/live/wikipedia_page_views" },
  { key: "pageviews", label: "E-8h variant: pageviews", url: "https://api.quiverquant.com/beta/live/pageviews" },

  // ---- Off-exchange carries a column we do not read yet ---------------------
  // The offexchange rows include a `DPI` field (Quiver's Dark Pool Index)
  // alongside OTC_Short/OTC_Total, which is what E-8a scores. Probing the
  // per-ticker route tells us whether DPI has usable history before anyone
  // designs an indicator around it.
  { key: "offexchange-historical", label: "Off-exchange per-ticker history (DPI depth check)", url: "https://api.quiverquant.com/beta/historical/offexchange/AAPL" },
]

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  if (header.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const apiKey = resolveApiKey("QUIVER_API_KEY")
  if (!apiKey) {
    return NextResponse.json({ error: "QUIVER_API_KEY not configured" }, { status: 503 })
  }

  const results = []
  for (const c of CANDIDATES) {
    try {
      const r = await meteredFetch("quiver", c.url, {
        headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
        routeTag: "/api/cron/quiver-probe",
      })
      let rows = 0
      let sampleKeys: string[] = []
      if (r.ok) {
        const j = await r.json().catch(() => null)
        if (Array.isArray(j)) {
          rows = j.length
          sampleKeys = j.length > 0 && j[0] && typeof j[0] === "object" ? Object.keys(j[0]).slice(0, 12) : []
        }
      }
      results.push({
        dataset: c.key,
        label: c.label,
        httpStatus: r.status,
        // Included = answered 200 WITH rows. A 200 empty array is "reachable
        // but empty right now", reported distinctly rather than as failure.
        included: r.ok && rows > 0,
        rows,
        sampleKeys,
      })
    } catch (err) {
      results.push({
        dataset: c.key,
        label: c.label,
        httpStatus: 0,
        included: false,
        rows: 0,
        sampleKeys: [],
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    probedAt: new Date().toISOString(),
    note: "included = HTTP 200 with rows. 401/403 = not in plan. 404 = endpoint name wrong (try variants before concluding). E-8 builds only against included datasets.",
    results,
  })
}
