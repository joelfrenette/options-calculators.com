// Data-source status — DERIVED, not declared.
//
// AUDIT A-5 / A-9 / A-15. The previous version of this file was a single object
// literal: `summary { total: 15, live: 8, aiFallback: 7, baseline: 0, failed: 0 }`
// with `new Date().toISOString()` glued on top so the payload read as if it had
// just been measured. Nothing here ever touched a provider. Because
// `baseline: 0` and `failed: 0` were literals, the consuming UI's "some APIs are
// using baseline data" warning was unreachable in every possible environment.
// It also named a phantom "BarChart" provider (no key, no route, no code in the
// repo), credited Alpha Vantage for the VIX term structure (moved to FRED
// VXVCLS in P3-1/P3-14), and credited Twelve Data for the QQQ technicals
// (they come from Polygon — lib/qqq-technicals.ts).
//
// This route now reports the REAL three-tier provenance that the CCPI engine
// already computes (lib/ccpi/scoring.ts → `provenance` in /api/ccpi):
//   live        — a provider actually returned the value on this run
//   ai-estimate — an LLM's recollection of the value (scored, but flagged)
//   baseline    — a hardcoded constant; EXCLUDED from scoring, pillar renormalizes
//   unknown     — provenance did not report this indicator; never reported as live
//
// It is admin-gated (A-9): it enumerates the provider stack and the fallback
// chains, which is exactly the disclosure `run-health-checks` is gated for.

import { NextResponse } from "next/server"
import { isAuthenticated } from "@/lib/auth"

export const dynamic = "force-dynamic"

/** Tier vocabulary emitted by lib/ccpi/scoring.ts, plus an honest "unknown". */
export type SourceStatus = "live" | "ai-estimate" | "baseline" | "unknown"

type PillarKey = "momentum" | "riskAppetite" | "valuation" | "macro"

interface IndicatorMeta {
  /** Provenance tier key — must match the keys in /api/ccpi `provenance[pillar].tiers`. */
  key: string
  name: string
  /** Provider that serves this indicator when it is live. */
  primarySource: string
  /** What is tried when the primary is unavailable. Empty = nothing; it degrades to baseline. */
  fallbackChain: string[]
  /** Key into the CCPI payload's `apiStatus` block, when one covers this indicator. */
  apiStatusKey: string | null
}

const PILLAR_NAMES: Record<PillarKey, string> = {
  momentum: "Momentum & Technical",
  riskAppetite: "Risk Appetite & Sentiment",
  valuation: "Valuation & Market Structure",
  macro: "Macro",
}

const AI_CHAIN = ["AI fallback chain (lib/unified-ai-fallback.ts)"]
const NO_FALLBACK: string[] = []

// The 29 scored indicators, in pillar order. Provider names were re-verified
// against lib/ (qqq-technicals → Polygon; vix-term-structure → FRED VIXCLS +
// VXVCLS; scraping-bee → put/call, AAII, Buffett; apify-yahoo-finance and
// fmp-valuation → S&P multiples).
const INDICATORS: Record<PillarKey, IndicatorMeta[]> = {
  momentum: [
    {
      key: "nvidiaMomentum",
      name: "NVIDIA Momentum",
      primarySource: "Alpha Vantage API",
      fallbackChain: AI_CHAIN,
      apiStatusKey: "alphaVantage",
    },
    {
      key: "soxIndex",
      name: "SOX Semiconductor Index",
      primarySource: "AI fallback chain — no live provider is wired for SOX",
      fallbackChain: NO_FALLBACK,
      apiStatusKey: null,
    },
    {
      key: "qqqDailyReturn",
      name: "QQQ Daily Return",
      primarySource: "Polygon.io daily aggregates",
      fallbackChain: NO_FALLBACK,
      apiStatusKey: "technical",
    },
    {
      key: "qqqConsecDown",
      name: "QQQ Consecutive Down Days",
      primarySource: "Polygon.io daily aggregates",
      fallbackChain: NO_FALLBACK,
      apiStatusKey: "technical",
    },
    {
      key: "qqqSMA20",
      name: "QQQ vs 20-Day SMA",
      primarySource: "Polygon.io daily aggregates → lib/indicators.ts",
      fallbackChain: NO_FALLBACK,
      apiStatusKey: "technical",
    },
    {
      key: "qqqSMA50",
      name: "QQQ vs 50-Day SMA",
      primarySource: "Polygon.io daily aggregates → lib/indicators.ts",
      fallbackChain: NO_FALLBACK,
      apiStatusKey: "technical",
    },
    {
      key: "qqqSMA200",
      name: "QQQ vs 200-Day SMA",
      primarySource: "Polygon.io daily aggregates → lib/indicators.ts",
      fallbackChain: NO_FALLBACK,
      apiStatusKey: "technical",
    },
    {
      key: "qqqBollinger",
      name: "QQQ vs Lower Bollinger Band",
      primarySource: "Polygon.io daily aggregates → lib/indicators.ts",
      fallbackChain: NO_FALLBACK,
      apiStatusKey: "technical",
    },
    {
      key: "vix",
      name: "Spot VIX",
      primarySource: "FRED VIXCLS",
      fallbackChain: AI_CHAIN,
      apiStatusKey: "vixTerm",
    },
    {
      key: "vixTermStructure",
      name: "VIX Term Structure (VIX3M ÷ VIX)",
      primarySource: "FRED VXVCLS ÷ FRED VIXCLS",
      fallbackChain: NO_FALLBACK,
      apiStatusKey: "vixTerm",
    },
  ],
  riskAppetite: [
    {
      key: "putCallRatio",
      name: "Put/Call Ratio",
      primarySource: "ScrapingBee scrape",
      fallbackChain: AI_CHAIN,
      apiStatusKey: "putCall",
    },
    {
      key: "fearGreedIndex",
      name: "Fear & Greed Index (CNN equity index)",
      primarySource: "CNN Fear & Greed API",
      fallbackChain: NO_FALLBACK,
      apiStatusKey: "fearGreed",
    },
    {
      key: "aaiiBullish",
      name: "AAII Bullish Sentiment",
      primarySource: "ScrapingBee scrape",
      fallbackChain: AI_CHAIN,
      apiStatusKey: "aaii",
    },
    {
      key: "shortInterest",
      name: "SPY Short Interest",
      primarySource: "AI fallback chain — no live provider is wired for short interest",
      fallbackChain: NO_FALLBACK,
      apiStatusKey: "shortInterest",
    },
  ],
  valuation: [
    {
      key: "spxPE",
      name: "S&P 500 Forward P/E",
      primarySource: "Apify Yahoo Finance",
      fallbackChain: ["FMP key-metrics"],
      apiStatusKey: "apify",
    },
    {
      key: "spxPS",
      name: "S&P 500 Price-to-Sales",
      primarySource: "Apify Yahoo Finance",
      fallbackChain: ["FMP key-metrics"],
      apiStatusKey: "apify",
    },
    {
      key: "buffettIndicator",
      name: "Buffett Indicator (Market Cap / GDP)",
      primarySource: "ScrapingBee scrape",
      fallbackChain: AI_CHAIN,
      apiStatusKey: "buffett",
    },
    {
      key: "qqqPE",
      name: "QQQ Forward P/E",
      primarySource: "AI fallback chain — no live provider is wired for QQQ P/E",
      fallbackChain: NO_FALLBACK,
      apiStatusKey: null,
    },
    {
      key: "mag7Concentration",
      name: "Magnificent 7 Concentration",
      primarySource: "AI fallback chain — no live provider is wired for Mag7 weight",
      fallbackChain: NO_FALLBACK,
      apiStatusKey: null,
    },
    {
      key: "shillerCAPE",
      name: "Shiller CAPE",
      primarySource: "AI fallback chain — no live provider is wired for CAPE",
      fallbackChain: NO_FALLBACK,
      apiStatusKey: null,
    },
    {
      key: "equityRiskPremium",
      name: "Equity Risk Premium",
      primarySource: "Derived: S&P earnings yield − FRED 10Y (tier = weaker of the two)",
      fallbackChain: NO_FALLBACK,
      apiStatusKey: null,
    },
  ],
  macro: [
    { key: "tedSpread", name: "TED Spread", primarySource: "FRED API", fallbackChain: NO_FALLBACK, apiStatusKey: "fred" },
    { key: "dxyIndex", name: "US Dollar Index (DXY)", primarySource: "FRED API", fallbackChain: NO_FALLBACK, apiStatusKey: "fred" },
    {
      key: "ismPMI",
      name: "ISM Manufacturing PMI",
      primarySource: "AI fallback chain — no live provider is wired for ISM",
      fallbackChain: NO_FALLBACK,
      apiStatusKey: null,
    },
    { key: "fedFundsRate", name: "Fed Funds Rate", primarySource: "FRED API", fallbackChain: NO_FALLBACK, apiStatusKey: "fred" },
    { key: "fedReverseRepo", name: "Fed Reverse Repo", primarySource: "FRED API", fallbackChain: NO_FALLBACK, apiStatusKey: "fred" },
    { key: "junkSpread", name: "Junk Bond Spread", primarySource: "FRED API", fallbackChain: NO_FALLBACK, apiStatusKey: "fred" },
    { key: "debtToGDP", name: "US Debt-to-GDP", primarySource: "FRED API", fallbackChain: NO_FALLBACK, apiStatusKey: "fred" },
    { key: "yieldCurve", name: "Yield Curve (10Y−2Y)", primarySource: "FRED API", fallbackChain: NO_FALLBACK, apiStatusKey: "fred" },
  ],
}

const STATUS_META: Record<SourceStatus, { label: string; color: "green" | "yellow" | "orange" | "slate" }> = {
  live: { label: "Live API data", color: "green" },
  "ai-estimate": { label: "AI estimate", color: "yellow" },
  baseline: { label: "Baseline constant (not scored)", color: "orange" },
  unknown: { label: "Unknown — not reported by provenance", color: "slate" },
}

/** Normalize whatever the tier map holds into our vocabulary. Never guesses "live". */
function toStatus(raw: unknown): SourceStatus {
  if (raw === "live" || raw === "ai-estimate" || raw === "baseline") return raw
  return "unknown"
}

function originOf(request: Request): string {
  const requestOrigin = new URL(request.url).origin
  if (requestOrigin && requestOrigin !== "null") return requestOrigin
  const envBase = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
  return envBase ? (envBase.startsWith("http") ? envBase : `https://${envBase}`) : "http://localhost:3000"
}

interface CcpiPayload {
  provenance?: Record<string, { scoredMax?: number; liveMax?: number; aiMax?: number; excluded?: string[]; tiers?: Record<string, unknown> }>
  pillars?: Record<string, number | null>
  apiStatus?: Record<string, { live?: boolean; source?: string; lastUpdated?: string }>
  certainty?: number | null
  ccpi?: number | null
  timestamp?: string
}

/** Try the in-process CCPI cache first (cheap), then the live route. */
async function loadCcpi(origin: string): Promise<{ payload: CcpiPayload; from: string } | null> {
  try {
    const cached = await fetch(new URL("/api/ccpi/cache", origin), { cache: "no-store" })
    if (cached.ok) {
      const json = (await cached.json()) as CcpiPayload & { cached?: boolean }
      if (json?.provenance) return { payload: json, from: "/api/ccpi/cache" }
    }
  } catch {
    // fall through to the live route
  }

  try {
    const res = await fetch(new URL("/api/ccpi", origin), { cache: "no-store" })
    // /api/ccpi answers 503 with a provenance block when every pillar is
    // unscorable — that is still real provenance, so use it.
    const json = (await res.json()) as CcpiPayload
    if (json?.provenance) return { payload: json, from: "/api/ccpi" }
  } catch {
    return null
  }
  return null
}

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const loaded = await loadCcpi(originOf(request))

  if (!loaded) {
    // No provenance obtainable — say so with a real error status rather than
    // returning a 200 full of invented "live" rows.
    return NextResponse.json(
      {
        error: "Data-source status is unavailable: /api/ccpi returned no provenance block",
        timestamp: new Date().toISOString(),
      },
      { status: 502 },
    )
  }

  const { payload, from } = loaded
  const provenance = payload.provenance ?? {}
  const apiStatus = payload.apiStatus ?? {}

  const sources = (Object.keys(INDICATORS) as PillarKey[]).flatMap((pillarKey) => {
    const block = provenance[pillarKey]
    const tiers = block?.tiers ?? {}
    const excluded = new Set(block?.excluded ?? [])

    return INDICATORS[pillarKey].map((meta) => {
      const status = toStatus(tiers[meta.key])
      const st = meta.apiStatusKey ? apiStatus[meta.apiStatusKey] : undefined
      const meta_ = STATUS_META[status]
      return {
        key: meta.key,
        name: meta.name,
        pillar: PILLAR_NAMES[pillarKey],
        pillarKey,
        primarySource: meta.primarySource,
        fallbackChain: meta.fallbackChain,
        // Null (not "Unknown" prose) when nothing reports it — the UI renders "—".
        currentSource: st?.source ?? null,
        lastUpdated: st?.lastUpdated ?? null,
        status,
        statusLabel: meta_.label,
        color: meta_.color,
        /** True when this indicator contributed no weight to its pillar. */
        excludedFromScore: excluded.has(meta.key),
      }
    })
  })

  const count = (s: SourceStatus) => sources.filter((x) => x.status === s).length

  const pillars = (Object.keys(INDICATORS) as PillarKey[]).map((pillarKey) => {
    const block = provenance[pillarKey]
    return {
      key: pillarKey,
      name: PILLAR_NAMES[pillarKey],
      score: payload.pillars?.[pillarKey] ?? null,
      scoredMax: block?.scoredMax ?? null,
      liveMax: block?.liveMax ?? null,
      aiMax: block?.aiMax ?? null,
      excluded: block?.excluded ?? [],
      indicatorCount: INDICATORS[pillarKey].length,
    }
  })

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    // Provenance is measured by the CCPI engine, not by this route.
    measuredBy: from,
    ccpiTimestamp: payload.timestamp ?? null,
    ccpi: payload.ccpi ?? null,
    certainty: payload.certainty ?? null,
    summary: {
      total: sources.length,
      live: count("live"),
      aiEstimate: count("ai-estimate"),
      baseline: count("baseline"),
      unknown: count("unknown"),
    },
    pillars,
    sources,
  })
}
