/**
 * The owner's entry rules for /api/strategy-scanner (P7-30, P7-32).
 *
 * Split out of `app/api/strategy-scanner/route.ts` (P6-13) unchanged. The
 * comments below travel with the code they annotate — several of them record a
 * decision that looks arbitrary until you read them, notably why there is no
 * single shared gate across the nine generators.
 */
import { sma } from "@/lib/indicators"
import {
  SESSIONS_PER_MONTH,
  isStage4Decline,
  relativeReturnPoints,
  sessionMovePercent,
  trailingReturnPercent,
} from "@/lib/trend-filters"
import { meteredFetch } from "@/lib/metered-fetch"
import { POLYGON_API_KEY } from "./market-data"

/**
 * A ticker's trailing year, fetched once per request.
 *
 * WHY THIS EXISTS AND WHY IT IS NOT `getStockPrice`. That helper fetches
 * `aggs/<T>/prev` — a single bar. It is enough to price a spread and not enough
 * to know whether the stock just ripped or has fallen all year, which is what
 * the owner's entry rules ask (P7-30, built first in the Sell Put scanner where
 * Step 3 already had the history).
 *
 * ONE CALL PER TICKER PER REQUEST, and the memo below is the whole reason that
 * is true: nine generators share overlapping ticker lists, so without it a scan
 * of `type=all` would re-fetch the same year several times. Polygon is metered
 * against a flat monthly plan (E-5 budget guard), so a helper that quietly
 * multiplies calls is a spend defect, not just a slow one.
 *
 * The memo is module-scoped but request-scoped in effect: this route runs in a
 * fresh isolate per invocation. It is deliberately NOT a cross-request cache —
 * `lib/market-closes.ts` is the place for that, and inventing a second one here
 * with its own staleness rules is how two sources of truth start.
 */
export interface TrendProfile {
  /** Percent move of the session named by `dayMoveSource`. */
  dayMovePercent: number | null
  /**
   * WHICH session `dayMovePercent` measures. A daily-aggregates request that
   * runs to today includes today's PARTIAL bar while the market is open. That
   * bar is exactly what the big-up-day rule wants, and exactly what a
   * "previous close" must not be, so the two are separated rather than sharing
   * a number.
   */
  dayMoveSource: "today" | "last_session" | "unknown"
  /** Trailing 252-session return, percent. */
  return12m: number | null
  /** Weinstein Stage 4 — price below a FALLING 150-session average. */
  stage4: boolean | null
}

const trendProfileMemo = new Map<string, Promise<TrendProfile | null>>()

export async function fetchTrendProfile(ticker: string): Promise<TrendProfile | null> {
  if (!POLYGON_API_KEY) return null
  const memoized = trendProfileMemo.get(ticker)
  if (memoized) return memoized

  const work = (async (): Promise<TrendProfile | null> => {
    try {
      const to = new Date()
      const from = new Date(to.getTime() - 400 * 24 * 60 * 60 * 1000)
      const iso = (d: Date) => d.toISOString().split("T")[0]
      // 400 calendar days, limit 400: ~275 sessions, comfortably more than the
      // 252 the trailing-year window needs plus the 21 the Stage 4 slope reads
      // back. A window sized exactly to 252 sessions would come up short across
      // any holiday-heavy stretch and the return would go null for no reason.
      const res = await meteredFetch(
        "polygon",
        `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${iso(from)}/${iso(to)}?adjusted=true&sort=asc&limit=400&apiKey=${POLYGON_API_KEY}`,
        { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000), routeTag: "strategy-scanner" },
      )
      if (!res.ok) return null
      const data = await res.json()
      const bars: any[] = Array.isArray(data.results) ? data.results : []
      const closes = bars.map((b) => b?.c).filter((c: unknown): c is number => typeof c === "number" && c > 0)
      if (closes.length < 2) return null

      const lastBarDay = new Date(bars[bars.length - 1]?.t ?? 0).toISOString().split("T")[0]
      const isToday = lastBarDay === iso(to)

      return {
        dayMovePercent: sessionMovePercent(closes[closes.length - 1], closes[closes.length - 2]),
        dayMoveSource: isToday ? "today" : "last_session",
        return12m: trailingReturnPercent(closes),
        stage4: isStage4Decline(
          closes[closes.length - 1],
          sma(closes, 150),
          closes.length > SESSIONS_PER_MONTH ? sma(closes.slice(0, -SESSIONS_PER_MONTH), 150) : null,
        ),
      }
    } catch {
      return null
    }
  })()

  trendProfileMemo.set(ticker, work)
  return work
}

/**
 * Which exclusions a strategy is subject to.
 *
 * NOT one shared flag across all nine generators, and that is the finding
 * P7-32 recorded rather than the convenience it looked like. The strategies do
 * not share a direction:
 *
 *   - `trend: true` — the position is LONG the stock in substance. A short put
 *     ends in ownership; a deep-ITM LEAPS call and a ZEBRA are stock
 *     replacements; a bull put spread is a bullish bet. A year of decline is a
 *     year of the market disagreeing with all four.
 *   - `trend: false` — a bear call spread PROFITS from that decline, so the
 *     same gate would remove exactly the candidates it wants; and iron condors,
 *     butterflies and calendars are neutral, where a downtrend is not
 *     disqualifying at all.
 *
 * The big-up-day rule is the one that applies everywhere, for a different
 * reason in each case: it inflates the reference price for a short put, and it
 * breaks the range premise and distorts near-term implied volatility for the
 * neutral structures.
 */
/**
 * Per-request exclusion state, created once in the handler and threaded into
 * every gated generator.
 *
 * THREADED RATHER THAN MODULE-SCOPED, and the distinction is not stylistic. The
 * trend memo above can safely be module-scoped because its values are keyed by
 * ticker and identical for any caller — a bleed between concurrent requests in
 * the same isolate reuses a fetch, which is the point. An accumulating list of
 * exclusions has no such property: bleed there would report one caller's
 * rejected tickers to another. So it is passed, not shared.
 *
 * `generateHighIVWatchlist` and `generateEarningsPlays` are deliberately NOT
 * gated. Their tabs were deleted in P7-27 as unreachable components, and adding
 * a rule to a generator with no reader is the dead-code trap that finding was
 * about. They still answer `type=all` and are left exactly as they were.
 */
export interface ExclusionContext {
  benchmarkReturn12m: number | null
  /** Big-up-day threshold for THIS request. */
  maxDayMovePercent: number
  excluded: Array<{ ticker: string; reasons: string[] }>
}

export interface ExclusionPolicy {
  /** Big-up-day gate. Every strategy uses it. */
  spike: boolean
  /** The year-long trend gates. Long-the-stock strategies only. */
  trend: boolean
}

// The threshold's range, default and clamp live in lib/trend-filters.ts —
// imported above, never re-derived here. It had briefly been written in three
// places (this clamp, the Sell Put slider, the six tabs' control), which is the
// P7-28 shape: nothing wrong yet, nothing structural stopping it.

/** The benchmark the relative-strength gate compares against. Matches the Sell Put scanner. */
export const BENCHMARK_TICKER = "SPY"

/**
 * The benchmark's own trailing year — one fetch for the whole request.
 *
 * It goes through the same memo as every other ticker, so a scan that also
 * screens SPY does not fetch it twice.
 */
export async function getBenchmarkReturn12m(): Promise<number | null> {
  const profile = await fetchTrendProfile(BENCHMARK_TICKER)
  return profile?.return12m ?? null
}

/**
 * @returns the exclusion reasons, or an empty array to keep the candidate.
 *
 * A null profile — no history, or the fetch failed — returns "history
 * unavailable" and therefore EXCLUDES. That is the same fail-safe convention
 * the Sell Put scanner uses: a stock whose trailing year cannot be measured
 * must not pass a filter that exists to measure it. It is stricter than the
 * route's older habit of skipping a check when data is missing, and stricter is
 * the correct direction for a rule whose whole purpose is to keep candidates
 * out.
 */
export function entryExclusionReasons(
  profile: TrendProfile | null,
  policy: ExclusionPolicy,
  benchmarkReturn12m: number | null,
  maxDayMovePercent: number,
): string[] {
  if (!policy.spike && !policy.trend) return []
  if (profile === null) return ["history unavailable"]

  const reasons: string[] = []
  if (policy.spike) {
    if (profile.dayMovePercent === null) reasons.push("session move unavailable")
    else if (profile.dayMovePercent >= maxDayMovePercent) reasons.push(`big up day (>= ${maxDayMovePercent}%)`)
  }
  if (policy.trend) {
    if (profile.return12m === null) reasons.push("12-month return unavailable")
    else if (profile.return12m < 0) reasons.push("down on the year")

    const relative = relativeReturnPoints(profile.return12m, benchmarkReturn12m)
    if (relative === null) reasons.push("relative strength unavailable")
    else if (relative < 0) reasons.push("trailed SPY")

    if (profile.stage4 === null) reasons.push("trend unavailable")
    else if (profile.stage4) reasons.push("Stage 4 decline")
  }
  return reasons
}
