"use client"

// All state + scan actions for the Sell Put (Wheel) Scanner, extracted from
// components/wheel-scanner.tsx (Phase 4 modularization — zero behavior change).
// The component composes the step cards/tables; this hook owns the pipeline.

import React from "react"
import { useEffect, useState } from "react"
import {
  CACHE_VERSION,
  generateCacheKey,
  saveToCache,
  loadFromCache,
  pruneSupersededCaches,
} from "./scan-cache"
import {
  PRE_FILTER_MARKET_CAP_TIERS,
  PRE_FILTER_VOLATILITY_TIERS,
  getTopRankedValue,
  getTopRankedLabel,
} from "./constants"
import type { QualifyingStock, RejectionSummary, RelaxedFilters } from "./types"
import { runFundamentalScan } from "./fundamental-scan"
import { enrichWithOptionsData } from "./enrichment"
import {
  checkTechnicalCriteria as checkCriteriaWithSettings,
  partitionByEntryExclusions,
  type EntryExclusion,
  type TechnicalFilterSettings,
} from "./technical-criteria"
import { MAX_DAY_MOVE } from "@/lib/trend-filters"
import { useLandmines } from "./use-landmines"
import { stepLabel, stepTitled } from "./steps"

export function useWheelScanner() {
  const [tickersToScan, setTickersToScan] = useState<string>("")
  const [minVolume, setMinVolume] = useState([2])
  const [maxDebtToEquity, setMaxDebtToEquity] = useState([3]) // Default Max Debt/Eq 3.0
  const [minROE, setMinROE] = useState([4]) // Default Min ROE 4% — admits TSLA-class growth names (~4.6% TTM ROE)
  const [minProfitableQuarters, setMinProfitableQuarters] = useState([2]) // Default 2 quarters — admits newly-profitable names (BE-class)
  // Step 3 market-cap floor — index into PRE_FILTER_MARKET_CAP_TIERS.
  // Default 5 = $2B+ (was a hidden hardcoded $10B floor before being exposed as a slider).
  const [minMarketCapCategory, setMinMarketCapCategory] = useState([5])
  // S-8, closed 2026-08-11. `maxPE` was declared here and read by nothing —
  // no filter, no UI control, no return. The only edit it had ever received was
  // the comment "FIX: Declare maxPE state variable", which declared it rather
  // than fixing anything, and then read as evidence that the gap had been
  // handled. Deleted. Confirmed by a repo-wide symbol search: the declaration
  // and that comment were the sole occurrences of `maxPE` in the tree.

  const [preFilterMarketCap, setPreFilterMarketCap] = useState([7]) // 12-stop scale — see PRE_FILTER_MARKET_CAP_TIERS below; default 7 = $10B+
  const [preFilterVolatility, setPreFilterVolatility] = useState([2]) // index into PRE_FILTER_VOLATILITY_TIERS; default 3%+ (premium-richness bias)
  const [preFilterLiquidity, setPreFilterLiquidity] = useState([10]) // 10M — ensure liquidity default
  const [preFilterTopRanked, setPreFilterTopRanked] = useState([66]) // 66 = Top 50 bucket

  const [isLoadingPreFilter, setIsLoadingPreFilter] = useState(false) // Renamed from preFilterLoading
  const [preFilterCount, setPreFilterCount] = useState(0)

  const [loading, setLoading] = useState(false)
  // FIX: Renamed state variables to reflect their purpose more accurately
  const [technicalLoading, setTechnicalLoading] = useState(false) // Renamed from technicalLoading
  const [technicalScanAttempted, setTechnicalScanAttempted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fundamentalResults, setFundamentalResults] = useState<QualifyingStock[]>([])
  const [rejectionSummary, setRejectionSummary] = useState<{
    scanned: number
    passed: number
    rejected: Record<string, string[]>
    skipped: Record<string, string[]>
  } | null>(null)
  // Stocks that failed 1–2 fundamental filters but otherwise have real Polygon data.
  // Used as the Step-4 relaxed fallback when strict Step 3 returns 0.
  const [nearMissFundamentals, setNearMissFundamentals] = useState<QualifyingStock[]>([])
  const [technicalResults, setTechnicalResults] = useState<QualifyingStock[]>([])
  const [showRelaxedResults, setShowRelaxedResults] = useState(false)
  const [fundamentalSortColumn, setFundamentalSortColumn] = useState<string>("ticker")
  const [fundamentalSortDirection, setFundamentalSortDirection] = useState<"asc" | "desc">("asc")
  const [showAllFundamentals, setShowAllFundamentals] = useState(false)

  // Default: rank finalists by annualized premium yield — the "richest premium first" view
  const [sortColumn, setSortColumn] = useState<keyof QualifyingStock>("annualizedYield")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  // Default: shortest DTE first, then highest Yield % within each DTE group
  const [relaxedSortColumn, setRelaxedSortColumn] = useState<keyof QualifyingStock>("daysToExpiry")
  const [relaxedSortDirection, setRelaxedSortDirection] = useState<"asc" | "desc">("asc")

  const [scanProgress, setScanProgress] = useState(0)
  const [currentTicker, setCurrentTicker] = useState("")
  const [technicalProgress, setTechnicalProgress] = useState(0)
  const [technicalCurrentTicker, setTechnicalCurrentTicker] = useState("")
  const [isScanningTechnicals, setIsScanningTechnicals] = useState(false) // This is the correct state for tracking technical scan progress

  const [preFilterProgress, setPreFilterProgress] = useState(0)
  const [preFilterCurrentTicker, setPreFilterCurrentTicker] = useState("")

  const [step4Progress, setStep4Progress] = useState(0)
  const [step4CurrentTicker, setStep4CurrentTicker] = useState("")
  const [isEnrichingRelaxed, setIsEnrichingRelaxed] = useState(false)

  const [maxROE, setMaxROE] = useState(20)

  // Step 3: Technical Analysis Filters
  const [maxRSI, setMaxRSI] = useState([60]) // Default Max RSI 60 — 50 excludes normal uptrend momentum; overbought risk starts ~70
  const [maxStochastic, setMaxStochastic] = useState([70]) // Default Max Stochastic 70 — uptrending stocks sit high on the stochastic most of the time
  const [minATR, setMinATR] = useState([2]) // Default Min ATR 2% - min volatility
  const [maxATR, setMaxATR] = useState([15]) // Default Max ATR 15% - max volatility

  // Bollinger default OFF: "price at/below the 20-day mean" directly contradicts the
  // above-50-SMA uptrend gate for most volatile names — together they left strict
  // Step 4 empty. Re-enable for precise pullback-entry timing.
  const [requireBollingerBands, setRequireBollingerBands] = useState(false) // Bollinger Bands Setup
  // FIX: Renamed state variables from require200SMA to requireAbove200SMA and require50SMA to requireAbove50SMA
  const [requireAbove200SMA, setRequireAbove200SMA] = useState(true) // Above 200-day SMA
  const [requireAbove50SMA, setRequireAbove50SMA] = useState(true) // Above 50-day SMA
  const [requireGoldenCross, setRequireGoldenCross] = useState(true) // Golden Cross (50 > 200)
  // MACD-bullish + red-day defaults are OFF: demanding a bullish crossover AND a
  // down day AND oversold AND above all SMAs simultaneously left strict Step 4
  // empty on nearly every run. Users can re-enable either for stricter entries.
  const [requireMACDBullish, setRequireMACDBullish] = useState(false) // MACD Bullish Signal
  const [requireRedDay, setRequireRedDay] = useState(false) // Red Day Preferred

  // CSP entry filters (lib/trend-filters.ts). ALL FOUR DEFAULT ON, at the
  // owner's instruction: these are not stricter-entry preferences like the
  // toggles above, they are the two things he does not want to sell a put
  // into — a stock that just ripped, and a stock that has fallen for a year.
  //
  // Defaulting a gate ON is a deliberate break from the pattern above, where
  // MACD/red-day/Bollinger default OFF because stacking them empties strict
  // Step 4. These can empty it too, on a weak tape, and that is the intended
  // answer rather than a bug: "nothing qualifies today" is a result.
  const [excludeBigUpDay, setExcludeBigUpDay] = useState(true) // no puts into a spike
  // Annotated `number[]`: `MAX_DAY_MOVE` is `as const`, so an unannotated
  // useState infers the literal type `10[]` and the setter stops accepting any
  // other number.
  const [maxDayMove, setMaxDayMove] = useState<number[]>([MAX_DAY_MOVE.DEFAULT])
  const [excludeDownYear, setExcludeDownYear] = useState(true) // trailing year negative
  const [excludeBenchmarkLaggard, setExcludeBenchmarkLaggard] = useState(true) // trailed SPY
  const [excludeStage4, setExcludeStage4] = useState(true) // below a FALLING 150-day MA
  // What the exclusions removed, with reasons, so an empty Step 4 is explicable
  // rather than just empty.
  const [entryExclusionSummary, setEntryExclusionSummary] = useState<EntryExclusion[]>([])
  // Which universe Step 2 actually loaded (S-7).
  const [universeSource, setUniverseSource] = useState<string | null>(null)

  // S-16. Every bump of CACHE_VERSION orphans the previous version's entries —
  // never read, never expired, never removed, because loadFromCache only evicts
  // the key it just missed on. Once per mount is the right cadence: it is a few
  // string comparisons against localStorage's key list, and the alternative
  // (sweeping on every read) pays that cost per scan step.
  useEffect(() => {
    pruneSupersededCaches()
  }, [])

  const [cacheStatus, setCacheStatus] = useState<string>("")

  // S-8. **These two are HIDDEN GATES: they filter Step 3 results and no UI
  // control exposes them.** `technical-criteria.ts` tests `yieldCheck` on
  // `minYield` and `volumeCheck` on `minVolumeTechnicals`, so a stock can be
  // dropped from the scan by a threshold the user never set and cannot see.
  // Recorded here, and stated in the Step 3 explainer, until sliders exist.
  //
  // The comment that used to sit on the second line read "This variable is
  // declared but not used in the provided code snippet" — flatly false, and the
  // Wave-2 split introduced it. **A comment asserting that a live filter is
  // dead is worse than no comment**: it invites the next reader to delete a
  // gate that is changing results.
  const [minYield, setMinYield] = useState([1]) // percent — filters at yieldCheck
  const [minVolumeTechnicals, setMinVolumeTechnicals] = useState([2]) // millions — filters at volumeCheck

  const [relaxedResults, setRelaxedResults] = useState<QualifyingStock[]>([])
  const [relaxedResultsEnriched, setRelaxedResultsEnriched] = React.useState(false)

  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

  const [hasAttemptedTechnicalScan, setHasAttemptedTechnicalScan] = useState(false)

  // FIX: Added isRelaxedMode state variable
  const [isRelaxedMode, setIsRelaxedMode] = useState(false)

  const [step, setStep] = useState(1) // 1=Initial, 2=After fundamental scan, 3=After technical scan, 4=Relaxed results

  // Step 1: Dollar Amount Filtering
  const [maxStockPrice, setMaxStockPrice] = useState([500]) // Default $500 → $50,000 total cash ($1-$1000)

  const isScanning = loading // `loading` is for Step 3 (Fundamental Scan). Was mislabelled Step 2 (S-18).
  // const isScanningTechnicals = technicalLoading // This is the correct state for technical scanning

  const { fetchLandmines, getLandminesForRow, resetLandmines } = useLandmines()

  // Excel-style column filters for the relaxed results table. Empty string = no filter.
  const [relaxedFilters, setRelaxedFilters] = useState<RelaxedFilters>({
    ticker: "",
    maxDTE: "",
    minPremium: "",
    minYield: "",
    minAnnualYield: "",
    minIV: "",
  })
  const clearRelaxedFilters = () =>
    setRelaxedFilters({ ticker: "", maxDTE: "", minPremium: "", minYield: "", minAnnualYield: "", minIV: "" })

  // Slider/toggle values packaged for the shared technical gate functions
  // (components/scanner/technical-criteria.ts) — same reads as before extraction.
  const technicalFilterSettings: TechnicalFilterSettings = {
    maxRSI: maxRSI[0],
    maxStochastic: maxStochastic[0],
    minATR: minATR[0],
    maxATR: maxATR[0],
    requireBollingerBands,
    requireAbove200SMA,
    requireAbove50SMA,
    requireGoldenCross,
    requireMACDBullish,
    requireRedDay,
    minYield: minYield[0],
    minVolumeTechnicals: minVolumeTechnicals[0],
    excludeBigUpDay,
    maxDayMove: maxDayMove[0],
    excludeDownYear,
    excludeBenchmarkLaggard,
    excludeStage4,
  }

  const checkTechnicalCriteria = (stock: QualifyingStock) => checkCriteriaWithSettings(stock, technicalFilterSettings)

  const scanFundamentals = async () => {
    console.log("[v0] 🔴🔴🔴🔴🔴 SCAN FUNDAMENTALS CALLED 🔴🔴🔴🔴🔴")
    console.log("[v0] Time:", new Date().toISOString())

    const tickers = tickersToScan
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length > 0)

    if (tickers.length === 0) {
      setError("Please enter at least one ticker symbol")
      return
    }

    const cacheParams = {
      maxStockPrice: maxStockPrice[0], // Step 1 dollar filter is part of the cache identity
      minVolume: minVolume[0],
      maxDebtToEquity: maxDebtToEquity[0],
      minROE: minROE[0],
      minProfitableQuarters: minProfitableQuarters[0],
      minMarketCapCategory: minMarketCapCategory[0],
      tickers: tickers.join(","), // Use joined tickers for cache key
    }

    const cacheKey = generateCacheKey(cacheParams)
    console.log("[v0] 🔵 Generated cache key:", cacheKey)
    console.log("[v0] 🔵 Cache params:", JSON.stringify(cacheParams, null, 2))

    const rawCache = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null
    console.log("[v0] 🔵 Raw localStorage value:", rawCache ? "EXISTS" : "NULL")

    const cached = loadFromCache(cacheKey)
    console.log("[v0] 🔵 loadFromCache result:", cached ? `FOUND ${cached.length} stocks` : "NULL")

    if (cached && Array.isArray(cached) && cached.length > 0) {
      console.log("[v0] ✅✅✅ CACHE HIT! Using cached data ✅✅✅")
      setFundamentalResults(cached)
      setCacheStatus("✅ Using cached fundamental scan (saved today)")
      setLoading(false)
      setStep(2)
      return
    }

    console.log("[v0] ❌ No valid cache - Starting fresh scan")
    setCacheStatus("")

    setLoading(true)
    setError(null)
    setFundamentalResults([])
    setTechnicalResults([])
    setTechnicalScanAttempted(false)
    setScanProgress(0)
    setCurrentTicker("")
    setRejectionSummary(null)
    setNearMissFundamentals([])
    resetLandmines()

    try {
      const { qualifyingStocks, nearMissStocks, rejectionBuckets, skipBuckets } = await runFundamentalScan({
        tickers,
        maxStockPrice,
        minVolume,
        maxDebtToEquity,
        minROE,
        minProfitableQuarters,
        minMarketCapCategory,
        onProgress: (progress, ticker) => {
          setScanProgress(progress)
          setCurrentTicker(ticker)
        },
      })

      setScanProgress(100)
      setCurrentTicker("")

      setNearMissFundamentals(nearMissStocks)

      setRejectionSummary({
        scanned: tickers.length,
        passed: qualifyingStocks.length,
        rejected: rejectionBuckets,
        skipped: skipBuckets,
      })

      const qualified = qualifyingStocks // Alias for clarity
      setFundamentalResults(qualified)
      setLoading(false)
      setScanProgress(0)
      setCurrentTicker("")
      setStep(2)
      setCacheStatus("Fundamental scan completed and cached (valid until tomorrow 9:30 AM ET)")

      saveToCache(cacheKey, qualified)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while scanning")
      console.error("[v0] Scan error:", err)
    } finally {
      setLoading(false)
      setScanProgress(0)
      setCurrentTicker("")
    }
  }

  const scanTechnicals = async () => {
    setStep(3)
    setHasAttemptedTechnicalScan(true)

    console.log(`[v0] 🟢 ${stepTitled("technical")} button clicked`)
    console.log("[v0] fundamentalResults.length:", fundamentalResults.length)
    console.log("[v0] Current technicalResults.length:", technicalResults.length)

    if (fundamentalResults.length === 0) {
        setError(`Please complete ${stepTitled("fundamentals")} first`)
      setStep(2)
      return
    }

    setIsScanningTechnicals(true)
    setTechnicalProgress(0)
    setTechnicalCurrentTicker("")
    setError(null)

    const technicalCacheKey = `technical_scan_${CACHE_VERSION}_${maxRSI[0]}_${maxStochastic[0]}_${minATR[0]}_${maxATR[0]}_${requireBollingerBands}_${requireAbove200SMA}_${requireAbove50SMA}_${requireGoldenCross}_${requireMACDBullish}_${requireRedDay}_${minYield[0]}_${minVolumeTechnicals[0]}_${excludeBigUpDay}_${maxDayMove[0]}_${excludeDownYear}_${excludeBenchmarkLaggard}_${excludeStage4}_${fundamentalResults
      .map((s) => s.ticker)
      .join(",")
      .substring(0, 100)}`

    console.log("[v0] Technical scan cache check:", technicalCacheKey)
    const cached = loadFromCache(technicalCacheKey)
    if (cached) {
      console.log(`[v0] ✅ ${stepLabel("technical")}: Using cached technical analysis results (same filters, same day)`)
      console.log("[v0] Cached results count:", cached.length)
      setTechnicalResults(cached)
      setCacheStatus("Technical analysis completed and cached (parameters match, valid until tomorrow 9:30 AM ET)")
      setIsScanningTechnicals(false)
      console.log(`[v0] ✅ technicalResults state updated with ${cached.length} stocks`)
      console.log("[v0] Tickers:", cached.map((s: QualifyingStock) => s.ticker).join(", "))
      fetchLandmines(cached)
      return
    }

    setTechnicalScanAttempted(true)
    setTechnicalLoading(true)
    setError(null)
    setTechnicalResults([])
    setTechnicalProgress(0)
    setTechnicalCurrentTicker("")

    try {
      // ENTRY EXCLUSIONS RUN FIRST, before options enrichment.
      //
      // Two reasons, and the second is the one that matters. Enrichment is the
      // expensive part — an options-snapshot call per ticker — so screening
      // first saves calls on stocks that were never going to be shown. And
      // filtering here, rather than after the split, is what makes "excluded"
      // mean excluded: the relaxed table further down shows rows that pass
      // SOME criteria, so anything still in the list at that point can surface
      // as a near miss. A stock that gapped 12% must not appear as a near miss.
      const { kept: eligibleFundamentals, excluded: entryExcluded } = partitionByEntryExclusions(
        fundamentalResults,
        technicalFilterSettings,
      )
      setEntryExclusionSummary(entryExcluded)
      if (entryExcluded.length > 0) {
        console.log(
          `[v0] ${stepLabel("technical")}: ${entryExcluded.length} excluded before enrichment — ` +
            entryExcluded.map((e) => `${e.ticker}(${e.reasons.join("+")})`).join(", "),
        )
      }

      console.log(
        `[v0] ${stepLabel("technical")}: Fetching real options premium data and filtering by slider criteria for ${eligibleFundamentals.length} stocks`,
      )

      const enrichedStocks = await enrichWithOptionsData(eligibleFundamentals, (current, total, ticker) => {
        setTechnicalProgress(Math.round((current / total) * 100))
        setTechnicalCurrentTicker(ticker)
      })

      const filteredStocks = enrichedStocks.filter((stock) => {
        const criteria = checkTechnicalCriteria(stock)
        const passesAll = Object.values(criteria).every(Boolean)
        if (!passesAll) {
          console.log(
            `[v0] ${stock.ticker} (Strike: $${stock.putStrike?.toFixed(2)}) - FILTERED OUT:`,
            Object.entries(criteria)
              .filter(([_, v]) => !v)
              .map(([k]) => k)
              .join(", "),
          )
        }
        return passesAll
      })

      console.log(
        `[v0] Enriched: ${enrichedStocks.length} options, After filtering: ${filteredStocks.length} pass all criteria`,
      )
      setTechnicalResults(filteredStocks)
      fetchLandmines(filteredStocks)

      console.log(
        `[v0] ✅ ${stepLabel("technical")} Complete: ${filteredStocks.length} stocks passed technical filters (and enriched with options data)`,
      )

      saveToCache(technicalCacheKey, filteredStocks)
      setCacheStatus(`Technical analysis completed and cached (valid until tomorrow 9:30 AM ET)`)

      setIsScanningTechnicals(false)
      console.log(`[v0] 📊 ${stepLabel("technical")} Complete! ${filteredStocks.length} stocks passed technical analysis`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during technical analysis")
      console.error("[v0] Technical analysis error:", err)
      setIsScanningTechnicals(false)
    } finally {
      setTechnicalLoading(false)
      setTechnicalProgress(0)
      setTechnicalCurrentTicker("")
      setCacheStatus(`Technical analysis completed and cached (valid until tomorrow 9:30 AM ET)`)
    }
  }

  const loadPreFilteredTickers = async () => {
    console.log(`[v0] 🟢 ${stepTitled("preFilter")} button clicked`)
    setIsLoadingPreFilter(true) // Renamed from preFilterLoading

    setPreFilterProgress(0)
    setPreFilterCurrentTicker("")
    setError(null)

    try {
      const tier = PRE_FILTER_MARKET_CAP_TIERS[preFilterMarketCap[0]] ?? PRE_FILTER_MARKET_CAP_TIERS[0]
      const marketCapThreshold = tier.value
      const minVolumeValue = preFilterLiquidity[0] * 1000000
      const topRankedLimit = getTopRankedValue(preFilterTopRanked[0])
      const volTier = PRE_FILTER_VOLATILITY_TIERS[preFilterVolatility[0]] ?? PRE_FILTER_VOLATILITY_TIERS[0]

      console.log(`[v0] ${stepLabel("preFilter")} Filter Parameters:`)
      console.log(`  - Market Cap: ${tier.label} (${marketCapThreshold.toLocaleString()})`)
      console.log(`  - Min Daily Range (volatility): ${volTier.label}`)
      console.log(`  - Min Volume: ${(minVolumeValue / 1000000).toFixed(1)}M`)
      console.log(`  - Top Ranked: ${getTopRankedLabel(preFilterTopRanked[0])} (limit to ${topRankedLimit} stocks)`)

      setPreFilterProgress(10)
      setPreFilterCurrentTicker("Fetching major index tickers...")

      // Pass the Step-1 dollar ceiling through so the pre-filter itself
      // excludes tickers priced above it (previously only Step 3 filtered by price).
      const priceCap = maxStockPrice[0]
      const priceParam = priceCap > 0 && priceCap < 1000 ? `&maxPrice=${priceCap}` : ""
      const rangeParam = volTier.value > 0 ? `&minRangePct=${volTier.value}` : ""
      const response = await fetch(
        `/api/polygon-tickers?minMarketCap=${marketCapThreshold}&minVolume=${minVolumeValue}&limit=${topRankedLimit}${priceParam}${rangeParam}`,
      )

      setPreFilterProgress(50)
      setPreFilterCurrentTicker("Filtering by volume and market cap...")

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || response.statusText)
      }

      const data = await response.json()

      setPreFilterProgress(90)
      setPreFilterCurrentTicker("Processing results...")

      if (data.tickers && Array.isArray(data.tickers)) {
        const tickers = data.tickers.sort((a: string, b: string) => a.localeCompare(b))
        setTickersToScan(tickers.join(", "))
        setPreFilterCount(tickers.length)
        // S-7. `/api/polygon-tickers` has always returned which universe it
        // actually used — `fmp-screener`, `polygon-grouped-bars`, or
        // `polygon-hardcoded-fallback`, a fixed list of 100 names kept in the
        // route. The client threw that field away, so a silent degradation to
        // the hardcoded list rendered as "100 tickers loaded", identical to a
        // live screener returning 100. Kept and shown now.
        setUniverseSource(typeof data.source === "string" ? data.source : null)
        setPreFilterProgress(100)
        setPreFilterCurrentTicker("")
        console.log(`[v0] ✅ ${stepLabel("preFilter")} Complete: Loaded ${tickers.length} tickers`)
        console.log(`[v0] Tickers: ${tickers.slice(0, 10).join(", ")}${tickers.length > 10 ? "..." : ""}`)
        // Set step to 2 after step 1 completes
        setStep(2)
      } else {
        throw new Error("No tickers returned from API")
      }
    } catch (err: any) {
      console.error(`[v0] ${stepLabel("preFilter")} Error:`, err)
      setError(`${stepLabel("preFilter")} failed: ${err.message}`)
      setPreFilterProgress(0)
      setPreFilterCurrentTicker("")
    } finally {
      setIsLoadingPreFilter(false) // Renamed from setPreFilterLoading
    }
  }

  const resultsToDisplay = technicalResults.length > 0 ? technicalResults : fundamentalResults

  const handleFundamentalSort = (column: string) => {
    if (fundamentalSortColumn === column) {
      setFundamentalSortDirection(fundamentalSortDirection === "asc" ? "desc" : "asc")
    } else {
      setFundamentalSortColumn(column)
      setFundamentalSortDirection("desc")
    }
  }

  const handleRelaxedSort = (column: keyof QualifyingStock) => {
    if (relaxedSortColumn === column) {
      setRelaxedSortDirection(relaxedSortDirection === "asc" ? "desc" : "asc")
    } else {
      setRelaxedSortColumn(column)
      setRelaxedSortDirection("asc")
    }
  }

  const handleSort = (column: keyof QualifyingStock) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  // Determine the current step based on state
  const currentStep =
    tickersToScan.trim().length === 0
      ? 1
      : fundamentalResults.length === 0 && !loading
        ? 2
        : !technicalScanAttempted || isScanningTechnicals
          ? 3
          : technicalResults.length > 0 || hasAttemptedTechnicalScan
            ? 4 // This means step 3 finished and produced results (or was attempted and not yet shown)
            : 3 // Default to step 3 if no results yet but attempted scan

  const toggleRelaxedResults = () => {
    setShowRelaxedResults((prev) => !prev)
    if (!showRelaxedResults) {
      setIsEnrichingRelaxed(true)
      setStep4Progress(0)
      setStep4CurrentTicker("")
      setRelaxedResults([]) // Clear previous relaxed results

      // The SAME exclusion pass as the strict path above. This is the copy that
      // actually protects the owner's rule: the relaxed table is the one that
      // shows near misses, so an exclusion applied only to the strict path
      // would hide a gapped-up stock from the table nobody was worried about
      // and leave it in the table they were.
      const { kept: eligibleForRelaxed } = partitionByEntryExclusions(fundamentalResults, technicalFilterSettings)

      enrichWithOptionsData(eligibleForRelaxed, (current, total, ticker) => {
        setStep4Progress(Math.round((current / total) * 100))
        setStep4CurrentTicker(ticker)
      })
        .then((enrichedResults) => {
          console.log(`[v0] ${stepLabel("technical")}: Enrichment complete with ${enrichedResults.length} total options`)

          // These are options that didn't make it to Step 3 strict results
          const relaxedOptions = enrichedResults.filter((stock) => {
            const criteria = checkTechnicalCriteria(stock)
            const passesAll = Object.values(criteria).every(Boolean)
            const passesSome = Object.values(criteria).some(Boolean)

            // Relaxed = passes at least some criteria but NOT all (would have been in Step 3 otherwise)
            // Also include options that pass none but have valid data (exploratory)
            if (passesAll) {
              console.log(
                `[v0] ${stock.ticker} $${stock.putStrike} - Passes ALL criteria (already in ${stepLabel("fundamentals")}, excluding from ${stepLabel("technical")})`,
              )
              return false
            }

            // Count how many criteria pass
            const passCount = Object.values(criteria).filter(Boolean).length
            const totalCriteria = Object.values(criteria).length
            console.log(
              `[v0] ${stock.ticker} $${stock.putStrike} - Passes ${passCount}/${totalCriteria} criteria (included in relaxed)`,
            )

            return true // Include all options that don't pass ALL criteria
          })

          console.log(
            `[v0] ${stepLabel("technical")}: ${relaxedOptions.length} options meet relaxed criteria (out of ${enrichedResults.length} total)`,
          )
          setRelaxedResults(relaxedOptions)
          setIsEnrichingRelaxed(false)
          fetchLandmines(relaxedOptions)
        })
        .catch((error) => {
          console.error("[v0] Error enriching relaxed results:", error)
          setError("Failed to enrich relaxed criteria results.")
          setIsEnrichingRelaxed(false)
        })
    }
  }

  // Verbatim from the Step-3 "no stocks passed" card's button (Phase 4 extraction).
  const promoteNearMissesToStep4 = () => {
    console.log(
      `[v0] 🟣 Promoting ${nearMissFundamentals.length} near-miss stocks into ${stepLabel("technical")} relaxed flow`,
    )
    setFundamentalResults(nearMissFundamentals)
    setStep(2)
  }

  return {
    // Step 1 dollar filter + ticker universe
    tickersToScan, setTickersToScan,
    maxStockPrice, setMaxStockPrice,
    // Step 2 pre-filter
    preFilterMarketCap, setPreFilterMarketCap,
    preFilterVolatility, setPreFilterVolatility,
    preFilterLiquidity, setPreFilterLiquidity,
    preFilterTopRanked, setPreFilterTopRanked,
    isLoadingPreFilter, preFilterCount, preFilterProgress, preFilterCurrentTicker,
    loadPreFilteredTickers,
    // Step 3 fundamental criteria
    maxDebtToEquity, setMaxDebtToEquity,
    minROE, setMinROE,
    minProfitableQuarters, setMinProfitableQuarters,
    minMarketCapCategory, setMinMarketCapCategory,
    scanFundamentals,
    // Step 4 technical criteria
    maxRSI, setMaxRSI,
    maxStochastic, setMaxStochastic,
    minATR, setMinATR,
    maxATR, setMaxATR,
    requireBollingerBands, setRequireBollingerBands,
    requireAbove200SMA, setRequireAbove200SMA,
    requireAbove50SMA, setRequireAbove50SMA,
    requireGoldenCross, setRequireGoldenCross,
    requireMACDBullish, setRequireMACDBullish,
    requireRedDay, setRequireRedDay,
    // CSP entry filters
    excludeBigUpDay, setExcludeBigUpDay,
    maxDayMove, setMaxDayMove,
    excludeDownYear, setExcludeDownYear,
    excludeBenchmarkLaggard, setExcludeBenchmarkLaggard,
    excludeStage4, setExcludeStage4,
    entryExclusionSummary,
    universeSource,
    technicalFilterSettings,
    scanTechnicals,
    // Pipeline state
    step, loading, isScanning, isScanningTechnicals, error, cacheStatus,
    scanProgress, currentTicker, technicalProgress, technicalCurrentTicker,
    step4Progress, step4CurrentTicker, isEnrichingRelaxed,
    fundamentalResults, rejectionSummary, nearMissFundamentals,
    technicalResults, relaxedResults, showRelaxedResults,
    toggleRelaxedResults, promoteNearMissesToStep4,
    // Sorting + table UI state
    fundamentalSortColumn, fundamentalSortDirection, handleFundamentalSort,
    showAllFundamentals, setShowAllFundamentals,
    sortColumn, sortDirection, handleSort,
    relaxedSortColumn, relaxedSortDirection, handleRelaxedSort,
    relaxedFilters, setRelaxedFilters, clearRelaxedFilters,
    // Landmines + misc
    getLandminesForRow,
    tooltipsEnabled, setTooltipsEnabled,
  }
}
