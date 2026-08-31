"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { DataLoadGate } from "@/components/data-load-gate"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import { SENTIMENT_ALLOCATION, bandForScore } from "@/lib/allocation"
import { AllocationBar } from "@/components/allocation-bar"
// P6-13. This file was 1,497 lines. The pieces that carry no component state —
// the payload shape, the hand-written SVG icons, the sparkline, the per-indicator
// tooltip copy, the series-to-indicator mapping and the per-band allocation copy —
// are now in `components/market-sentiment/`. `getChartDataForIndicator` took one
// mechanical change on the way: it read `marketData` from this closure and now
// takes it as an argument.
import type { MarketData } from "@/components/market-sentiment/market-data"
import {
  ActivityIcon,
  BarChartIcon,
  DollarSignIcon,
  InfoIcon,
  LightbulbIcon,
  MinusIcon,
  RefreshIcon,
  ShieldIcon,
  TargetIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "@/components/market-sentiment/icons"
import { MiniLineChart } from "@/components/market-sentiment/mini-line-chart"
import {
  cnnComponentTooltips,
  componentTooltips,
  getIndicatorSentiment,
  getSentimentColor,
} from "@/components/market-sentiment/indicator-meta"
import { getChartDataForIndicator } from "@/components/market-sentiment/chart-data"
import { getTradeRecommendations } from "@/components/market-sentiment/trade-recommendations"
import { buildIndicatorCards } from "@/components/market-sentiment/indicator-cards"
import { getScoreBackground, getScoreColor } from "@/components/market-sentiment/score-colors"
import { ConditionalTooltip } from "@/components/ui/conditional-tooltip"
import { HistoricalScaleCard } from "@/components/market-sentiment/historical-scale-card"
import { TradeRecommendationsCard } from "@/components/market-sentiment/trade-recommendations-card"

// import {
//   Activity,
//   TrendingUp,
//   TrendingDown,
//   Minus,
//   Target,
//   DollarSign,
//   Shield,
//   Lightbulb,
//   RefreshCw,
//   Info,
//   BarChart3,
// } from "lucide-react"

// Anything the route could not measure arrives as null. It is never a 0 or a
// neutral 50 — those read as measurements on a 0-100 fear scale.



export function MarketSentiment() {
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)
  const [error, setError] = useState<string | null>(null) // Added error state
  const [loaded, setLoaded] = useState(false)

  // Define cache keys and version
  const CACHE_KEY = "market_sentiment_data"
  const CACHE_TIMESTAMP_KEY = "market_sentiment_timestamp"
  const CACHE_VERSION_KEY = "fearGreedCacheVersion"
  const CACHE_VERSION = "12.0" // Updated cache version for new caching behavior
  // Define components based on CNN's Fear & Greed Index indicators.
  //
  // Every entry used to end in `?? 50`, so a component CNN never supplied
  // rendered as a measured neutral reading. Two of them were worse than a
  // default: `?? marketData?.vix` put a raw VIX level (say 18) on a 0-100
  // sentiment scale, and `putCallRatio * 50` invented a score out of a ratio.
  // A missing component is null and the card says so.
  const componentScore = (index: number, flat: number | null | undefined): number | null => {
    const fromCnn = marketData?.cnnComponents?.[index]?.score
    if (fromCnn !== null && fromCnn !== undefined) return fromCnn
    return flat ?? null
  }

  const components: { name: string; description: string; value: number | null }[] = [
    {
      name: "Market Momentum",
      description: "S&P 500 vs 125-Day MA",
      value: componentScore(0, marketData?.marketMomentum),
    },
    {
      name: "Stock Price Strength",
      description: "52-week highs vs lows",
      value: componentScore(1, marketData?.stockPriceStrength),
    },
    {
      name: "Stock Price Breadth",
      description: "McClellan Volume Summation",
      value: componentScore(2, marketData?.stockBreadth),
    },
    {
      name: "Put and Call Options",
      description: "5-day average ratio",
      value: componentScore(3, null),
    },
    {
      name: "Market Volatility",
      description: "VIX vs 50-day MA",
      value: componentScore(4, null),
    },
    {
      name: "Safe Haven Demand",
      description: "20-day stock vs bond returns",
      value: componentScore(5, marketData?.safeHavenDemand),
    },
    {
      name: "Junk Bond Demand",
      description: "Yield spread analysis",
      value: componentScore(6, marketData?.junkBondSpread),
    },
  ]

  const missingComponents = components.filter((c) => c.value === null).map((c) => c.name)

  const cnnIndicatorCards = buildIndicatorCards(components)



  useEffect(() => {
    if (!loaded) return

    const cachedData = localStorage.getItem(CACHE_KEY)
    const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
    const cacheVersion = localStorage.getItem(CACHE_VERSION_KEY)

    // AGE, not just shape and version.
    //
    // `cachedTimestamp` has always been written as an ISO string and READ ONLY
    // FOR DISPLAY — `setLastUpdated(new Date(cachedTimestamp))` below. The
    // validity predicate that follows checks the payload's SHAPE and the
    // CACHE_VERSION, then returns early with "don't auto-fetch when cache is
    // valid". Neither of those is time: a code change could invalidate this
    // cache, but the passage of a day could not, so a Fear & Greed reading from
    // any distance in the past rendered as the current one.
    //
    // Seventh instance of this shape found on 2026-08-30 — after the CCPI
    // snapshot and the six scanner caches. Four hours, matching the CCPI cache
    // rather than the scanners' thirty minutes, because this is the same KIND
    // of reading: a slow-moving sentiment index, not strike-level option
    // pricing that moves continuously.
    const CACHE_TTL_MS = 4 * 60 * 60 * 1000
    const cachedAgeMs = cachedTimestamp ? Date.now() - Date.parse(cachedTimestamp) : Number.NaN
    const cacheIsFresh = Number.isFinite(cachedAgeMs) && cachedAgeMs <= CACHE_TTL_MS
    if (cachedTimestamp && !cacheIsFresh) {
      console.log(
        `[v0] Fear & Greed cache is ${Math.round(cachedAgeMs / 60000)} min old (TTL ${CACHE_TTL_MS / 60000} min) — refetching rather than showing a stale reading as current`,
      )
    }

    // Check cache version, age, and if data is from cache
    const isDataFromCache = cachedData && cachedTimestamp && cacheVersion === CACHE_VERSION && cacheIsFresh

    if (isDataFromCache) {
      try {
        const data = JSON.parse(cachedData)

        if (
          typeof data.score === "number" &&
          data.score >= 0 &&
          data.score <= 100 &&
          data.cnnComponents &&
          Array.isArray(data.cnnComponents) &&
          data.cnnComponents.length === 7 &&
          // P3-18. This gate used to require all four changes to be numbers,
          // which is why the fabrication was load-bearing: making them honest
          // would have made every cached payload "invalid" and refetched CNN on
          // every mount. A cache entry is valid when its SCORE is usable; a null
          // change is a correct value, not a corrupt one. The fields are not
          // rendered anywhere, so they never belonged in this predicate.
          (data.yesterdayChange === null || Number.isFinite(data.yesterdayChange)) &&
          (data.lastWeekChange === null || Number.isFinite(data.lastWeekChange)) &&
          data.chartData?.dates?.length > 0 && // Require chartData with actual dates
          data.chartData?.spy?.length > 0 && // Require SPY price data
          data.chartData?.vix?.length > 0 // Require VIX data
        ) {
          setMarketData(data)
          setLastUpdated(new Date(cachedTimestamp))
          setFromCache(true)
          setCacheTimestamp(cachedTimestamp)
          console.log(
            "[v0] Loaded valid cached CNN data with charts (score:",
            data.score,
            ", version:",
            cacheVersion,
            ")",
          )
          setLoading(false)

          return // Return early - don't auto-fetch when cache is valid
        } else {
          console.log("[v0] Cache data invalid, fetching fresh CNN data with charts...")
          fetchData()
        }
      } catch (error) {
        console.error("[v0] Error loading cached data:", error)
        fetchData()
      }
    } else {
      if (cacheVersion !== CACHE_VERSION) {
        console.log(
          "[v0] Cache version mismatch (",
          cacheVersion,
          "!==",
          CACHE_VERSION,
          "), clearing and fetching fresh CNN data with charts...",
        )
        localStorage.removeItem(CACHE_KEY)
        localStorage.removeItem(CACHE_TIMESTAMP_KEY)
        localStorage.removeItem(CACHE_VERSION_KEY)
      }
      fetchData()
    }

  }, [loaded])

  const fetchData = async () => {
    try {
      // Only set loading to true if we are actually fetching and don't have marketData yet
      if (!marketData && !loading) {
        setLoading(true)
      }
      setFromCache(false)
      console.log("[v0] Fetching fresh Fear & Greed data from API...")
      const marketRes = await fetch("/api/market-sentiment", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      })

      if (marketRes.ok) {
        const market = await marketRes.json()
        console.log("[v0] ✓ Received Fear & Greed data from API")
        console.log(`[v0] CNN Score: ${market.score}/100 (${market.sentiment})`)
        console.log(`[v0] Data Source: ${market.dataSource}`)

        // Validate we have real data
        if ((!market.score && market.score !== 0) || typeof market.score !== "number") {
          console.error("[v0] ✗ Received invalid data (no valid score)")
          throw new Error("Invalid data received from API")
        }
        // Also validate cnnComponents as per the updated cache validation logic
        if (!market.cnnComponents || !Array.isArray(market.cnnComponents) || market.cnnComponents.length !== 7) {
          console.error("[v0] ✗ Received invalid data (cnnComponents array invalid)")
          throw new Error("Invalid data received from API")
        }
        // Also validate chartData as per the updated cache validation logic
        if (!market.chartData || !market.chartData.dates || !market.chartData.spy || !market.chartData.vix) {
          console.error("[v0] ✗ Received invalid data (chartData invalid)")
          throw new Error("Invalid data received from API")
        }

        setMarketData(market)
        const timestamp = new Date().toISOString()
        localStorage.setItem(CACHE_KEY, JSON.stringify(market))
        localStorage.setItem(CACHE_TIMESTAMP_KEY, timestamp)
        localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION)
        setCacheTimestamp(timestamp)
        console.log("[v0] Fear & Greed data cached successfully with version", CACHE_VERSION)
      } else {
        const errorData = await marketRes.json().catch(() => ({}))
        console.error("[v0] ✗ Market sentiment API error:", marketRes.status, errorData)
        throw new Error(errorData.error || `API returned ${marketRes.status}`)
      }

      setLastUpdated(new Date())
    } catch (error) {
      console.error("[v0] Error fetching market sentiment data:", error)
      setError(error instanceof Error ? error.message : "An unknown error occurred") // Set error message
      // Ensure loading is false even if there's an error
      setLoading(false)
    } finally {
      // Set loading to false after all fetching is done or attempted
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const formatCacheTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString()
  }

  // const getSentimentColor = (score: number) => { // REMOVED AND REPLACED BY getSentimentColor FUNCTION ABOVE
  //   if (score > 20) return "bg-green-500"
  //   if (score > 0) return "bg-green-300"
  //   if (score > -20) return "bg-red-300"
  //   return "bg-red-500"
  // }

  // Keyed by level, never by score. The caller has already asked
  // SENTIMENT_ALLOCATION which band it is in; re-deriving it here is what
  // produced the colour-versus-text mismatch this replaced.

  if (!loaded) {
    return (
      <DataLoadGate
        title="Load CNN Fear & Greed Index?"
        description="Fetch the latest CNN Fear & Greed Index and market sentiment data. Nothing loads until you choose to."
        onConfirm={() => setLoaded(true)}
      />
    )
  }

  // CHANGE: Replace custom loading spinner with LoadingSpinner
  if (loading) {
    return <LoadingSpinner message="Loading Fear & Greed Index data..." />
  }

  // CHANGE: Display error message if fetching fails
  if (error) {
    return (
      <Card className="shadow-sm border-red-300 bg-red-50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <InfoIcon className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-bold text-red-900 mb-1">Error Loading Data</h3>
              <p className="text-sm text-red-800 leading-relaxed">{error}</p>
              <button
                onClick={handleRefresh}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Retry
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!marketData) {
    return <LoadingSpinner message="Loading market data..." />
  }

  // The single classification of this score. null when it is unreadable —
  // never falls back to the calmest band. Everything below reads off it.
  const sentimentBand = bandForScore(SENTIMENT_ALLOCATION.bands, marketData.overallScore)
  const recommendations = getTradeRecommendations(sentimentBand?.level ?? null)


  /**
   * When this reading was taken, and whether it came from localStorage.
   *
   * P7-26, and the same defect as P7-16 in the CCPI dashboard: `lastUpdated`,
   * `fromCache` and `cacheTimestamp` were all WRITTEN on the cache-load path
   * (and nowhere read), so this tab restored a snapshot of any age and said
   * nothing about it. The component knew and did not tell.
   *
   * Fixing one instance of a pattern is not fixing the pattern — the CCPI fix
   * landed earlier the same day and this second copy went unnoticed until
   * `check-write-only-state.ts` listed it.
   */
  const readingTaken = cacheTimestamp ?? lastUpdated?.toISOString() ?? null
  const readingWhen = readingTaken && !Number.isNaN(new Date(readingTaken).getTime())
    ? new Date(readingTaken).toLocaleString()
    : null

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {readingWhen && (
          <p className="text-xs text-muted-foreground">
            {fromCache ? "Cached reading from" : "Updated"} {readingWhen}
          </p>
        )}
        {marketData?.usingFallback && (
          <Card className="shadow-sm border-yellow-200 bg-yellow-50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <InfoIcon />
                <div>
                  {/* Was: "the same 7-indicator methodology. Values may differ
                      slightly from CNN's official index but follow the same
                      formula." The equal-weight arithmetic does match CNN's. The
                      inputs do not: "Put and Call Options" is computed from VIX
                      against its 50-day MA rather than from any options ratio, so
                      two of the seven components read the same instrument. And
                      "slightly" was never supported — components can drop out
                      entirely, and the fallback previously invented the NYSE
                      highs/lows behind Stock Price Strength from SPY momentum,
                      which indicator 1 already measures. Same move as claiming
                      CME FedWatch because the output was a probability (P6-45). */}
                  <h3 className="font-bold text-yellow-900 mb-1">Using This Site&apos;s Own Calculation</h3>
                  <p className="text-sm text-yellow-800 leading-relaxed">
                    CNN&apos;s Fear &amp; Greed Index is unreachable, so this reading is computed here from VIX, SPY,
                    TLT and HYG. It borrows CNN&apos;s seven component names and their equal weighting, but the inputs
                    are this site&apos;s own — Put and Call Options is derived from VIX rather than an options ratio.
                    Components with no data are excluded and the average is taken over the rest, so expect this number
                    to differ from CNN&apos;s by more than a rounding step. Treat it as a second opinion, not a
                    substitute.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <HistoricalScaleCard
          marketData={marketData}
          refreshing={refreshing}
          handleRefresh={handleRefresh}
          tooltipsEnabled={tooltipsEnabled}
          setTooltipsEnabled={setTooltipsEnabled}
        />

        {/* 7 FEAR & GREED INDICATORS section with individual cards and charts */}
        <div className="space-y-6">
          <div className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUpIcon className="h-6 w-6 text-primary" />7 FEAR & GREED INDICATORS
          </div>

          {/* Says which components CNN did not supply, so a "NO DATA" badge
              reads as missing data rather than a rendering fault. */}
          {missingComponents.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-900">
                <span className="font-semibold">Insufficient data:</span> CNN did not supply{" "}
                {missingComponents.join(", ")} on this fetch. {missingComponents.length === 1 ? "It is" : "They are"}{" "}
                shown as "—" and excluded — no neutral placeholder is substituted. The headline score is CNN's own
                published figure and is unaffected.
              </p>
            </div>
          )}

          {/* A permanently unsourced indicator is a different fact from one CNN
              happened not to send today, and saying so stops anyone chasing a
              feed that does not exist. */}
          {marketData?.notTracked && marketData.notTracked.length > 0 && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Not tracked:</span> {marketData.notTracked.join(", ")}. No free data
                source exists for {marketData.notTracked.length === 1 ? "it" : "them"}, so{" "}
                {marketData.notTracked.length === 1 ? "it is" : "they are"} reported as null rather than estimated from
                something else.
              </p>
            </div>
          )}

          {cnnIndicatorCards.map((indicator, index) => {
            const chartInfo = getChartDataForIndicator(marketData, indicator.name) // Use indicator.name to match tooltip keys
            console.log(`[v0] Chart for ${indicator.name}:`, {
              dataPoints: chartInfo.data.length,
              datePoints: chartInfo.dates.length,
              firstValue: chartInfo.data[0],
              lastValue: chartInfo.data[chartInfo.data.length - 1],
            })

            return (
              <Card key={index} className="bg-white border-gray-200">
                <CardHeader className="bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-gray-900 mb-1">{indicator.name}</CardTitle>
                      <CardDescription className="text-sm text-gray-600">{indicator.description}</CardDescription>
                    </div>
                    <div className={`px-3 py-1 rounded text-xs font-bold ${getSentimentColor(indicator.sentiment)}`}>
                      {indicator.sentiment}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <MiniLineChart
                      data={chartInfo.data}
                      dates={chartInfo.dates}
                      color="#2563eb"
                      yAxisLabel={chartInfo.label}
                    />

                    {/* Explanation text */}
                    <div className="flex items-center">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {componentTooltips[indicator.tooltipKey as keyof typeof componentTooltips].description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <TradeRecommendationsCard
          marketData={marketData}
          recommendations={recommendations}
          sentimentBand={sentimentBand}
          refreshing={refreshing}
        />

        {/* Volatility Products accordion */}
        <Accordion type="multiple" defaultValue={["volatility-products"]} className="space-y-0">
          <AccordionItem value="volatility-products" className="border-0">
            <Card className="shadow-sm border-gray-200">
              <AccordionTrigger className="hover:no-underline px-6 py-4 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <ActivityIcon className="h-5 w-5 text-primary" />
                  Volatility Products Analysis
                </CardTitle>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* VIX Section */}
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <InfoIcon className="h-5 w-5 text-primary" />
                        VIX (Volatility Index)
                      </h4>
                      <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                        <p className="text-sm text-gray-700 leading-relaxed mb-4">
                          The VIX, or CBOE Volatility Index, measures the stock market's expectation of volatility over
                          the next 30 days, derived from S&P 500 index options. It is often called the "fear index".
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-gray-50 rounded border border-gray-200">
                            <div className="text-xs font-semibold text-gray-700 uppercase mb-1">Current VIX</div>
                            <div className="text-lg font-bold text-gray-900">{marketData.vix?.toFixed(2) ?? "N/A"}</div>
                          </div>
                          <div className="p-3 bg-gray-50 rounded border border-gray-200">
                            <div className="text-xs font-semibold text-gray-700 uppercase mb-1">50-Day MA</div>
                            {/* Was `vixVs50DayMA * 50 + vix` — a linear combination
                                of a ratio and the spot level, printed to two
                                decimals as if it were a moving average. Now the
                                real 50-day mean of FRED VIXCLS (P6-22), or "—"
                                when the store cannot supply 50 observations. */}
                            {marketData.vix50DayMA === null || marketData.vix50DayMA === undefined ? (
                              <>
                                <div className="text-lg font-bold text-gray-400">—</div>
                                <div className="text-xs text-gray-500 mt-1">Insufficient stored history</div>
                              </>
                            ) : (
                              <>
                                <div className="text-lg font-bold text-gray-900">
                                  {marketData.vix50DayMA.toFixed(2)}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">FRED VIXCLS, 50-day mean</div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* VIX Term Structure Section */}
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <BarChartIcon className="h-5 w-5 text-primary" />
                        VIX Term Structure
                      </h4>
                      <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                        <p className="text-sm text-gray-700 leading-relaxed mb-4">
                          The VIX term structure refers to the shape of the VIX futures curve, indicating market
                          expectations about future volatility.
                        </p>
                        <div className="flex items-center justify-center py-3">
                          <span className="text-lg font-bold text-gray-900">
                            {marketData.vixTermStructure ?? "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>

        {/* About section */}
        <Card className="shadow-sm border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <InfoIcon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-2">About the Fear & Greed Index</h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  This index quantifies investor emotions on a scale from 0 (extreme fear) to 100 (extreme greed). Based
                  on CNN's methodology, it combines <strong>7 equally-weighted market indicators</strong> with
                  additional options-specific metrics. Options pricing and activity are highly sensitive to
                  sentiment—fear drives higher put buying and volatility, while greed boosts call activity and
                  risk-taking. Each indicator is normalized to a 0-100 scale based on historical extremes, then averaged
                  for the final score.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
