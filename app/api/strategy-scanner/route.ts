/**
 * /api/strategy-scanner — nine option-strategy scanners over live price and
 * implied volatility, plus a POST handler that refuses to invent trade setups.
 *
 * THE BODY OF THIS ROUTE LIVES IN `lib/strategy-scanner/` (P6-13). It was 1,808
 * lines in one file; the split is by what the code KNOWS rather than by size:
 *
 *   - `market-data.ts`      what was measured — price, ATM IV, earnings, names
 *   - `pricing.ts`          what was derived — Black-Scholes output, provenance
 *   - `entry-exclusions.ts` the owner's entry rules (P7-30, P7-32)
 *   - `generators/`         one file per strategy family
 *
 * Two checks read across that boundary and were widened with it:
 * `check-playbook-rules.ts` derives the exclusion call sites per generator, and
 * `check-provenance.ts` walks route-side files for withheld fields. A split
 * that left them pointed at this file alone would have kept every PASS line
 * while covering a quarter of the code.
 */
import { type NextRequest, NextResponse } from "next/server"
import { resolveMaxDayMove } from "@/lib/trend-filters"
import { ATM_BAND, FINNHUB_API_KEY, POLYGON_API_KEY, RISK_FREE_RATE } from "@/lib/strategy-scanner/market-data"
import {
  BENCHMARK_TICKER,
  type ExclusionContext,
  getBenchmarkReturn12m,
} from "@/lib/strategy-scanner/entry-exclusions"
import { generateCreditSpreads, generateIronCondors } from "@/lib/strategy-scanner/generators/credit-spreads"
import { generateEarningsPlays, generateHighIVWatchlist } from "@/lib/strategy-scanner/generators/watchlists"
import { generateWheelCandidates } from "@/lib/strategy-scanner/generators/wheel"
import {
  CALENDAR_SPREAD_TICKERS,
  generateCalendarSpreads,
} from "@/lib/strategy-scanner/generators/calendar-spreads"
import { BUTTERFLY_TICKERS, generateButterflies } from "@/lib/strategy-scanner/generators/butterflies"
import { LEAPS_TICKERS, generateLEAPS } from "@/lib/strategy-scanner/generators/leaps"
import { ZEBRA_TICKERS, generateZEBRA } from "@/lib/strategy-scanner/generators/zebra"

// ========== GET HANDLER (Live Data Scanners) ==========
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") || "all"

  const defaultTickers = [
    "SPY",
    "QQQ",
    "AAPL",
    "MSFT",
    "NVDA",
    "TSLA",
    "AMD",
    "META",
    "AMZN",
    "GOOGL",
    "IWM",
    "JPM",
    "COST",
    "NFLX",
  ]
  const customTickers = searchParams.get("tickers")?.split(",").filter(Boolean) || []
  const tickers = customTickers.length > 0 ? customTickers : defaultTickers

  try {
    const results: Record<string, any> = {
      timestamp: new Date().toISOString(),
      dataSource: "polygon.io + finnhub.io + black-scholes",
      // `isLive` was `!!POLYGON_API_KEY` — i.e. "a key is configured" — and the
      // scanner tabs rendered it as a green "Live Data" badge over tables whose
      // numbers were fabricated (AUDIT_BACKLOG P1-10). Provenance is now stated
      // per field on each row; this block says what the payload actually is.
      provenance: {
        underlyingPrice: "polygon:prev-close (measured)",
        impliedVolatility: "polygon:options-snapshot ATM average (measured)",
        earningsDates: FINNHUB_API_KEY ? "finnhub:calendar (measured)" : "unavailable",
        premiumsGreeksProbabilities: "black-scholes model output (derived, not a tradeable quote)",
      },
      assumptions: {
        riskFreeRate: RISK_FREE_RATE,
        dividendYield: 0,
        atmBand: ATM_BAND,
      },
      // Rows are omitted entirely when their measured inputs are unavailable, so
      // an empty array means "could not be established", never "none found".
      incomplete: !POLYGON_API_KEY,
    }

    // Entry exclusions (P7-30/P7-32). The benchmark's trailing year is fetched
    // once here — every generator that needs relative strength reads the same
    // number, and the trend memo means SPY is not fetched twice even when it is
    // also a candidate.
    const ctx: ExclusionContext = {
      benchmarkReturn12m: await getBenchmarkReturn12m(),
      maxDayMovePercent: resolveMaxDayMove(searchParams.get("maxDayMove")),
      excluded: [],
    }

    if (type === "all" || type === "credit-spreads") {
      results.creditSpreads = await generateCreditSpreads(tickers, ctx)
    }

    if (type === "all" || type === "iron-condors") {
      results.ironCondors = await generateIronCondors(tickers, ctx)
    }

    if (type === "all" || type === "calendar-spreads") {
      results.calendarSpreads = await generateCalendarSpreads(CALENDAR_SPREAD_TICKERS, ctx)
    }

    if (type === "all" || type === "butterflies") {
      results.butterflies = await generateButterflies(BUTTERFLY_TICKERS, ctx)
    }

    if (type === "all" || type === "leaps") {
      results.leaps = await generateLEAPS(LEAPS_TICKERS, ctx)
    }

    if (type === "all" || type === "zebra") {
      results.zebra = await generateZEBRA(ZEBRA_TICKERS, ctx)
    }

    if (type === "all" || type === "high-iv") {
      results.highIV = await generateHighIVWatchlist(tickers)
    }

    if (type === "all" || type === "earnings") {
      results.earningsPlays = await generateEarningsPlays()
    }

    if (type === "all" || type === "wheel") {
      results.wheelCandidates = await generateWheelCandidates(tickers, ctx)
    }

    // What the exclusions removed, with reasons. Reported rather than swallowed:
    // a scanner that silently returns fewer rows is indistinguishable from a
    // market with fewer candidates, and an empty array here means nothing was
    // excluded — not that nothing was checked, which `entryExclusionPolicy`
    // below makes explicit.
    results.entryExclusions = ctx.excluded
    results.entryExclusionPolicy = {
      maxDayMovePercent: ctx.maxDayMovePercent,
      benchmark: BENCHMARK_TICKER,
      benchmarkReturn12m: ctx.benchmarkReturn12m,
      trendGatedStrategies: ["wheel", "leaps", "zebra", "credit-spreads (bull-put leg only)"],
      spikeGatedStrategies: [
        "credit-spreads",
        "iron-condors",
        "calendar-spreads",
        "butterflies",
        "leaps",
        "zebra",
        "wheel",
      ],
      ungated: ["high-iv", "earnings"],
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error("[Strategy Scanner] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to generate scanner data",
        details: String(error),
        creditSpreads: [],
        ironCondors: [],
        highIV: [],
        earningsPlays: [],
        wheelCandidates: [],
        calendarSpreads: [],
        butterflies: [],
        leaps: [],
        zebra: [],
        isLive: false,
      },
      // Was `{ status: 200 } // Return 200 with empty arrays instead of 500`.
      // The arrays being empty is honest; the 200 is not. Seven scanner tabs
      // read this route, and each shows "no candidates found" on an empty
      // array — so a total failure and a genuinely quiet scan were the same
      // response, and the consuming components all check `res.ok` before they
      // check anything else. A 502 lets them tell the two apart.
      { status: 502 },
    )
  }
}

// ========== POST HANDLER (AI Strategy Scanning) ==========
export async function POST(request: NextRequest) {
  // This handler used to invent three trade setups and serve them at HTTP 200.
  //
  // Its own comment said what it was doing — "Since AI functionality is not
  // used, we return default setups" — and it returned SPY 595/590 for $2.35 at
  // 72% POP, QQQ 510/505 for $2.10 at 70%, IWM 235/230 for $1.85 at 68%. Real
  // tickers, specific strikes, specific credits, specific probabilities, none
  // of them measured. The prices were anchored to a prompt template that opens
  // "Based on current market conditions (late November 2025, VIX around 18-22)",
  // so they were stale as well as invented.
  //
  // The consequence was the opposite of harmless. options-strategy-toolbox
  // renders `config.setups` by default and labels them honestly — "illustrative
  // teaching examples, not live trade recommendations". Pressing Scan replaced
  // that labelled set with THESE, and stamped "Last scanned: <time>" beside
  // them. The refresh made the page less honest than it was at rest, and the
  // timestamp is what sold it: an illustrative example wearing a scan time
  // reads as a result. Nine LEARN tabs share that component.
  //
  // There is no live setup scan behind this route, so it now says so with a
  // real status code rather than 200 (house rule: never 200 with an error
  // body). The UI keeps showing its labelled examples, which is the honest
  // resting state it already had.
  return NextResponse.json(
    {
      error: "Live setup scanning is not available",
      message:
        "This site does not scan for specific trade setups. The examples shown are illustrative and are not refreshed from market data.",
    },
    { status: 501 },
  )
}
