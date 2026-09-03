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
import type { QualifyingStock, RejectionSummary } from "./types"
import { runFundamentalScan } from "./fundamental-scan"
import { enrichWithOptionsData } from "./enrichment"
import {
  partitionByEntryExclusions,
  partitionByRelaxedEntryExclusions,
  type EntryExclusion,
} from "./technical-criteria"
import { useLandmines } from "./use-landmines"
import { useTechnicalFilters } from "./use-technical-filters"
import { getMarketStatus } from "@/lib/market-hours"
import { useScannerSorting } from "./use-scanner-sorting"
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
  // Volatility default 2%+ and universe default Top 500 (owner, 2026-08-28):
  // Top 50 + 3%+ selected beaten-down volatile names by construction — the day
  // the tiered exclusions landed, all 11 Step 3 survivors were down on the
  // year. Step 2 stays one grouped-bars call either way; Step 3's per-ticker
  // fundamentals volume rises with the survivor count, which the batch loop
  // and the metered-fetch budget absorb.
  const [preFilterVolatility, setPreFilterVolatility] = useState([1]) // index into PRE_FILTER_VOLATILITY_TIERS; default 2%+
  const [preFilterLiquidity, setPreFilterLiquidity] = useState([10]) // 10M — ensure liquidity default
  const [preFilterTopRanked, setPreFilterTopRanked] = useState([16]) // 16 = Top 500 bucket

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

  // Step 4's sliders, toggles and the four CSP entry exclusions, with the
  // settings object the shared gate functions read (components/scanner/
  // use-technical-filters.ts). Destructured rather than kept as one object so
  // that the pipeline below reads exactly as it did before the split.
  const {
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
    excludeBigUpDay, setExcludeBigUpDay,
    maxDayMove, setMaxDayMove,
    excludeDownYear, setExcludeDownYear,
    excludeBenchmarkLaggard, setExcludeBenchmarkLaggard,
    excludeStage4, setExcludeStage4,
    relaxedDeepDeclinePct, setRelaxedDeepDeclinePct,
    relaxedMildDownCapIndex, setRelaxedMildDownCapIndex,
    minYield, minVolumeTechnicals,
    technicalFilterSettings,
    checkTechnicalCriteria,
  } = useTechnicalFilters()

  // Table sort order + the relaxed table's column filters
  // (components/scanner/use-scanner-sorting.ts).
  const sorting = useScannerSorting()

  // What the exclusions removed, with reasons, so an empty Step 4 is explicable
  // rather than just empty.
  const [entryExclusionSummary, setEntryExclusionSummary] = useState<EntryExclusion[]>([])
  // What the HARD gates kept out of the relaxed pass (owner 2026-08-28) — the
  // relaxed table's own card, so "priced everything except these" is on screen.
  const [relaxedHardExcluded, setRelaxedHardExcluded] = useState<EntryExclusion[]>([])
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

  // Market-closed backstop. Every scan step depends on live quotes; outside the
  // regular session the provider returns nothing, so a run only burns API
  // budget and ends in a zero. The banner (components/market-closed-banner.tsx)
  // is the loud UI; this guard makes the block real even if a button is somehow
  // reached, and names the reason. Checked at click time so it flips exactly at
  // the open without a re-render race.
  const blockedWhenClosed = (): boolean => {
    const market = getMarketStatus()
    if (market.isOpen) return false
    setError(
      `Markets are closed (${market.reason}) — scanning is paused until the next open. ` +
        `Live option quotes aren't available now, so a scan would only return zeros.`,
    )
    return true
  }

  const scanFundamentals = async () => {
    if (blockedWhenClosed()) return
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
    if (blockedWhenClosed()) return
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

      // Auto-surface the relaxed pass when the strict pass came back empty
      // (owner 2026-08-31). The relaxed candidates are exactly what a user
      // reaches for next; hiding them behind a button they had to find is why
      // one owner turned off the guardrails by hand instead. Markets are known
      // open here — scanTechnicals returned early at blockedWhenClosed() — so
      // the relaxed pricing calls are safe. Only fires when there are
      // fundamentals to relax against, so an empty Step 3 does not trigger it.
      if (filteredStocks.length === 0 && fundamentalResults.length > 0) {
        console.log(`[v0] ${stepLabel("technical")} returned zero — auto-running the relaxed pass`)
        setShowRelaxedResults(true)
        runRelaxedPass()
      }

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
    if (blockedWhenClosed()) return
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

  // The relaxed pass, factored out (owner 2026-08-31) so it runs from BOTH the
  // manual toggle AND the automatic surface when strict Step 4 comes back
  // empty. A user should not have to discover a button — or disable the
  // guardrails by hand, which is what one owner did — to see the relaxed
  // candidates the design already computes. Callers own the market-closed gate
  // and the showRelaxedResults flag; this just does the work.
  const runRelaxedPass = () => {
      setIsEnrichingRelaxed(true)
      setStep4Progress(0)
      setStep4CurrentTicker("")
      setRelaxedResults([]) // Clear previous relaxed results
      setRelaxedHardExcluded([])

      // OWNER DECISION 2026-08-29: the relaxed pass GRADES the down-year gate
      // (partitionByRelaxedEntryExclusions), refining the 2026-08-28 tiering.
      // That tiering held down-year fully HARD here, which was right in spirit
      // but too blunt in practice: on a down-breadth day it emptied Step 5
      // entirely — the owner ran the scanner and got zero relaxed results while
      // AMZN / NVDA / CSCO sat excluded for being down a few percent, exactly
      // the large reliable names a put seller wants in a pullback. The relaxed
      // grade now is:
      //
      //   HARD here (never priced): big up day, Stage 4 decline (below a
      //   FALLING 150-day average — the structural knife at any magnitude), a
      //   DEEP decline (worse than −25%), and a MILD decline on a sub-$10B
      //   name. Plus unmeasurable history, fail-safe.
      //
      //   ADMITTED here: a large (≥$10B), mildly-down (0 to −25%), non-Stage-4
      //   name — the pullback, not the knife. Shown in the relaxed table.
      //
      //   SOFT (as before): trailed SPY — the Beat-SPY ✓/✗ column, never a gate.
      const { kept: relaxedEligible, excluded: hardExcluded } = partitionByRelaxedEntryExclusions(
        fundamentalResults,
        technicalFilterSettings,
      )
      setRelaxedHardExcluded(hardExcluded)
      if (hardExcluded.length > 0) {
        console.log(
          `[v0] ${stepLabel("relaxed")}: ${hardExcluded.length} hard-excluded, never priced — ` +
            hardExcluded.map((e) => `${e.ticker}(${e.reasons.join("+")})`).join(", "),
        )
      }
      // Failed the FULL policy but not the hard gates = failed only trailed
      // SPY. Strict Step 4 never showed these, so they belong in the relaxed
      // table even when they pass every slider criterion.
      const hardExcludedTickers = new Set(hardExcluded.map((e) => e.ticker))
      const { excluded: fullExcluded } = partitionByEntryExclusions(fundamentalResults, technicalFilterSettings)
      const softOnlyTickers = new Set(
        fullExcluded.map((e) => e.ticker).filter((t) => !hardExcludedTickers.has(t)),
      )

      enrichWithOptionsData(relaxedEligible, (current, total, ticker) => {
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
            // A strict-passing stock is already in the Step 4 table — UNLESS
            // it failed only the soft trailed-SPY gate, in which case Step 4
            // never showed it and the relaxed table is the only place it can
            // appear. (Hard-excluded tickers never reach this filter at all.)
            if (passesAll && !softOnlyTickers.has(stock.ticker)) {
              console.log(
                `[v0] ${stock.ticker} $${stock.putStrike} - Passes ALL criteria (already in ${stepLabel("technical")}, excluding from ${stepLabel("relaxed")})`,
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

  const toggleRelaxedResults = () => {
    // Turning the relaxed pass ON prices every candidate (an API call each), so
    // it carries the same closed-market backstop as the other steps. Hiding it
    // again is always allowed.
    if (!showRelaxedResults && blockedWhenClosed()) return
    const willShow = !showRelaxedResults
    setShowRelaxedResults(willShow)
    if (willShow) runRelaxedPass()
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
    relaxedDeepDeclinePct, setRelaxedDeepDeclinePct,
    relaxedMildDownCapIndex, setRelaxedMildDownCapIndex,
    entryExclusionSummary,
    relaxedHardExcluded,
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
    // Sorting + table UI state (use-scanner-sorting.ts)
    ...sorting,
    // Landmines + misc
    getLandminesForRow,
    tooltipsEnabled, setTooltipsEnabled,
  }
}
