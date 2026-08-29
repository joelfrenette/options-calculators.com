"use client"

// Sell Put (Wheel) Scanner — entry point. Phase 4 modularization: all state and
// scan actions live in components/scanner/use-wheel-scanner.ts; step cards and
// results tables live in components/scanner/*. This file only composes them —
// zero behavior change from the pre-split single-file version.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { TrendingUp, Info, Loader2, BarChart3, Filter, AlertCircle } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { useWheelScanner } from "@/components/scanner/use-wheel-scanner"
import { Step1DollarFilterCard } from "@/components/scanner/step1-dollar-filter-card"
import { Step2PreFilterCard } from "@/components/scanner/step2-prefilter-card"
import { Step3FundamentalsCard } from "@/components/scanner/step3-fundamentals-card"
import { Step4TechnicalCard } from "@/components/scanner/step4-technical-card"
import { FundamentalResultsTable } from "@/components/scanner/fundamental-results-table"
import { StrictResultsTable } from "@/components/scanner/strict-results-table"
import { RelaxedResultsTable } from "@/components/scanner/relaxed-results-table"
import {
  RejectionSummaryCard,
  NoTechnicalPassCard,
  NoRelaxedResultsCard,
  EntryExclusionCard,
} from "@/components/scanner/scanner-notices"
import { stepTitled, SCANNER_STEPS } from "./scanner/steps"

export function WheelScanner() {
  const {
    tickersToScan, setTickersToScan,
    maxStockPrice, setMaxStockPrice,
    preFilterMarketCap, setPreFilterMarketCap,
    preFilterVolatility, setPreFilterVolatility,
    preFilterLiquidity, setPreFilterLiquidity,
    preFilterTopRanked, setPreFilterTopRanked,
    isLoadingPreFilter, preFilterCount, preFilterProgress, preFilterCurrentTicker,
    loadPreFilteredTickers,
    maxDebtToEquity, setMaxDebtToEquity,
    minROE, setMinROE,
    minProfitableQuarters, setMinProfitableQuarters,
    minMarketCapCategory, setMinMarketCapCategory,
    scanFundamentals,
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
    entryExclusionSummary,
    relaxedHardExcluded,
    universeSource,
    technicalFilterSettings,
    scanTechnicals,
    step, loading, isScanning, isScanningTechnicals, error, cacheStatus,
    scanProgress, currentTicker, technicalProgress, technicalCurrentTicker,
    step4Progress, step4CurrentTicker, isEnrichingRelaxed,
    fundamentalResults, rejectionSummary, nearMissFundamentals,
    technicalResults, relaxedResults, showRelaxedResults,
    toggleRelaxedResults, promoteNearMissesToStep4,
    fundamentalSortColumn, fundamentalSortDirection, handleFundamentalSort,
    showAllFundamentals, setShowAllFundamentals,
    sortColumn, sortDirection, handleSort,
    relaxedSortColumn, relaxedSortDirection, handleRelaxedSort,
    relaxedFilters, setRelaxedFilters, clearRelaxedFilters,
    getLandminesForRow,
    tooltipsEnabled, setTooltipsEnabled,
  } = useWheelScanner()

  return (
    <TooltipProvider delayDuration={300}>
      <Card className="w-full max-w-7xl mx-auto shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-target h-5 w-5 text-primary"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="6"></circle>
                <circle cx="12" cy="12" r="2"></circle>
              </svg>
              Sell Put Scanner
            </CardTitle>

            <div className="flex items-center gap-2">
              {/* No Refresh control here on purpose. This scanner has no single
                  thing to refresh — the pipeline is four explicit user-run steps
                  with their own buttons. The header used to carry a Refresh
                  wired to `onClick={() => {}}`, which looked wired and did
                  nothing. */}
              <TooltipsToggle enabled={tooltipsEnabled} onChange={setTooltipsEnabled} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-6">
          {/* Educational Info Banner */}
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-indigo-800">
                <strong>Cash-Secured Puts (CSP)</strong> generate income by selling a put while setting aside enough cash
                to buy 100 shares at the strike. You keep the premium if the stock stays above your strike, or you get
                assigned the shares at a <strong>discount to today&apos;s price</strong> if it drops. Best on{" "}
                <strong>quality stocks you would happily own</strong> at the strike. Look for elevated implied
                volatility (richer premium), strikes below support, and strong annualized return on the cash you tie up.
              </div>
            </div>
          </div>

          {/* STEP 1: DOLLAR AMOUNT FILTERING — always visible so selections stay on screen after scanning */}
          <Step1DollarFilterCard
            maxStockPrice={maxStockPrice}
            setMaxStockPrice={setMaxStockPrice}
            tooltipsEnabled={tooltipsEnabled}
          />

          {/* STEP 2: PRE-FILTERING — always visible so selections stay on screen after scanning */}
          <Step2PreFilterCard
            preFilterMarketCap={preFilterMarketCap}
            setPreFilterMarketCap={setPreFilterMarketCap}
            preFilterLiquidity={preFilterLiquidity}
            setPreFilterLiquidity={setPreFilterLiquidity}
            preFilterTopRanked={preFilterTopRanked}
            setPreFilterTopRanked={setPreFilterTopRanked}
            preFilterVolatility={preFilterVolatility}
            setPreFilterVolatility={setPreFilterVolatility}
            tooltipsEnabled={tooltipsEnabled}
            isLoadingPreFilter={isLoadingPreFilter}
            isScanning={isScanning}
            isScanningTechnicals={isScanningTechnicals}
            preFilterProgress={preFilterProgress}
            preFilterCurrentTicker={preFilterCurrentTicker}
            preFilterCount={preFilterCount}
            universeSource={universeSource}
            onScan={loadPreFilteredTickers}
          />
        </CardContent>
      </Card>

      {tickersToScan.trim().length > 0 && (
        <Card className="mt-8 w-full max-w-7xl mx-auto shadow-lg">
          <CardContent className="pt-6">
            <Label className="text-base font-bold text-gray-900 mb-2 block">Tickers to Scan</Label>
            <Textarea
              value={tickersToScan}
              onChange={(e) => setTickersToScan(e.target.value)}
              placeholder="Enter ticker symbols separated by commas (e.g., AAPL, MSFT, GOOGL) or use Step ${SCANNER_STEPS.preFilter.n} above to load automatically"
              className="h-32 font-mono text-sm"
            />
          </CardContent>
        </Card>
      )}

      {tickersToScan.trim().length > 0 && (
        <Step3FundamentalsCard
          maxDebtToEquity={maxDebtToEquity}
          setMaxDebtToEquity={setMaxDebtToEquity}
          minROE={minROE}
          setMinROE={setMinROE}
          minProfitableQuarters={minProfitableQuarters}
          setMinProfitableQuarters={setMinProfitableQuarters}
          minMarketCapCategory={minMarketCapCategory}
          setMinMarketCapCategory={setMinMarketCapCategory}
          tooltipsEnabled={tooltipsEnabled}
        />
      )}

      {/* CHANGE: Fixed button condition to show at step 1 and before technical scan */}
      {step <= 2 && tickersToScan.trim().length > 0 && !loading && !isScanningTechnicals && (
        <Button
          onClick={scanFundamentals}
          disabled={isScanning || isScanningTechnicals || tickersToScan.trim() === ""}
          size="lg"
          className="mt-4 w-full max-w-7xl mx-auto h-12 text-base font-semibold bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <BarChart3 className="mr-2 h-5 w-5" />
                {stepTitled("fundamentals")}
            </>
          )}
        </Button>
      )}

      {/* Scan Progress */}
      {loading && scanProgress > 0 && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg w-full max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-blue-900">Scanning Fundamentals: {currentTicker}</span>
            <span className="text-sm font-bold text-blue-900">{scanProgress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${scanProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {!loading && rejectionSummary && rejectionSummary.passed === 0 && (
        <RejectionSummaryCard
          rejectionSummary={rejectionSummary}
          nearMissFundamentals={nearMissFundamentals}
          onUseRelaxedFundamentals={promoteNearMissesToStep4}
        />
      )}

      {fundamentalResults.length > 0 && (
        <FundamentalResultsTable
          fundamentalResults={fundamentalResults}
          fundamentalSortColumn={fundamentalSortColumn}
          fundamentalSortDirection={fundamentalSortDirection}
          handleFundamentalSort={handleFundamentalSort}
          showAllFundamentals={showAllFundamentals}
          setShowAllFundamentals={setShowAllFundamentals}
        />
      )}

      {step >= 2 && fundamentalResults.length > 0 && (
        <Step4TechnicalCard
          maxRSI={maxRSI}
          setMaxRSI={setMaxRSI}
          maxStochastic={maxStochastic}
          setMaxStochastic={setMaxStochastic}
          minATR={minATR}
          setMinATR={setMinATR}
          maxATR={maxATR}
          setMaxATR={setMaxATR}
          requireBollingerBands={requireBollingerBands}
          setRequireBollingerBands={setRequireBollingerBands}
          requireAbove200SMA={requireAbove200SMA}
          setRequireAbove200SMA={setRequireAbove200SMA}
          requireAbove50SMA={requireAbove50SMA}
          setRequireAbove50SMA={setRequireAbove50SMA}
          requireGoldenCross={requireGoldenCross}
          setRequireGoldenCross={setRequireGoldenCross}
          requireMACDBullish={requireMACDBullish}
          setRequireMACDBullish={setRequireMACDBullish}
          requireRedDay={requireRedDay}
          setRequireRedDay={setRequireRedDay}
          excludeBigUpDay={excludeBigUpDay}
          setExcludeBigUpDay={setExcludeBigUpDay}
          maxDayMove={maxDayMove}
          setMaxDayMove={setMaxDayMove}
          excludeDownYear={excludeDownYear}
          setExcludeDownYear={setExcludeDownYear}
          excludeBenchmarkLaggard={excludeBenchmarkLaggard}
          setExcludeBenchmarkLaggard={setExcludeBenchmarkLaggard}
          excludeStage4={excludeStage4}
          setExcludeStage4={setExcludeStage4}
          relaxedDeepDeclinePct={relaxedDeepDeclinePct}
          setRelaxedDeepDeclinePct={setRelaxedDeepDeclinePct}
          relaxedMildDownCapIndex={relaxedMildDownCapIndex}
          setRelaxedMildDownCapIndex={setRelaxedMildDownCapIndex}
          tooltipsEnabled={tooltipsEnabled}
        />
      )}

      {step >= 2 && fundamentalResults.length > 0 && (
        <Button
          onClick={scanTechnicals}
          disabled={isScanningTechnicals || fundamentalResults.length === 0}
          className="mt-4 w-full max-w-7xl mx-auto h-12 text-base font-semibold bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
        >
          {isScanningTechnicals ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Analyzing Technical Indicators...
            </>
          ) : (
            <>
              <TrendingUp className="mr-2 h-5 w-5" />
                {stepTitled("technical")}
            </>
          )}
        </Button>
      )}

      {isScanningTechnicals && (
        <Card className="mt-4 w-full max-w-7xl mx-auto border-2 border-blue-300 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Analyzing {technicalCurrentTicker || "..."}</span>
              <span className="text-sm font-semibold text-blue-700">{technicalProgress}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${technicalProgress}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && technicalResults.length > 0 && (
        <StrictResultsTable
          technicalResults={technicalResults}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          handleSort={handleSort}
          technicalFilterSettings={technicalFilterSettings}
          getLandminesForRow={getLandminesForRow}
        />
      )}


      {/* CHANGE: Added Step 4 button when Step 3 has results (previously only showed when no results) */}
      {step >= 3 && !isScanningTechnicals && technicalResults.length > 0 && !showRelaxedResults && (
        <Button
          onClick={toggleRelaxedResults}
          className="mt-4 w-full max-w-7xl mx-auto h-12 text-base font-semibold bg-purple-600 hover:bg-purple-700 text-white"
          disabled={isEnrichingRelaxed}
        >
          <Filter className="mr-2 h-5 w-5" />
          {stepTitled("relaxed")}
        </Button>
      )}

      {/* Shown whenever the exclusions removed anything, not only on an empty
          result — a user with three rows on screen still needs to know that
          five others were dropped before pricing. */}
      {step >= 3 && !isScanningTechnicals && <EntryExclusionCard excluded={entryExclusionSummary} />}

      {step >= 3 && !isScanningTechnicals && technicalResults.length === 0 && fundamentalResults.length > 0 && (
        <NoTechnicalPassCard fundamentalCount={fundamentalResults.length} maxRSI={technicalFilterSettings.maxRSI} />
      )}

      {step >= 3 && !isScanningTechnicals && technicalResults.length === 0 && fundamentalResults.length > 0 && (
        <Button
          onClick={toggleRelaxedResults}
          className="mt-4 w-full max-w-7xl mx-auto h-12 text-base font-semibold bg-yellow-600 hover:bg-yellow-700 text-white"
          disabled={isEnrichingRelaxed}
        >
          <Filter className="mr-2 h-5 w-5" />
          {stepTitled("relaxed")}
        </Button>
      )}

      {isEnrichingRelaxed && step4Progress > 0 && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg w-full max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-blue-900">Enriching Options Data: {step4CurrentTicker}</span>
            <span className="text-sm font-bold text-blue-900">{step4Progress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${step4Progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Step 5 (relaxed) table. The exclusions are tiered here (owner
          2026-08-28, superseding the 2026-08-27 relax-everything ruling): the
          hard gates — big up day, down on the year, Stage 4 — hold in the
          relaxed pass too, and the card above the table names what they kept
          out. The one soft gate, trailed SPY, is relaxed and shown as the
          table's Beat SPY column rather than folded into Landmine. */}
      {showRelaxedResults && !isEnrichingRelaxed && relaxedHardExcluded.length > 0 && (
        <EntryExclusionCard excluded={relaxedHardExcluded} variant="relaxedHard" />
      )}
      {showRelaxedResults && !isEnrichingRelaxed && relaxedResults.length > 0 && (
        <RelaxedResultsTable
          relaxedResults={relaxedResults}
          relaxedFilters={relaxedFilters}
          setRelaxedFilters={setRelaxedFilters}
          clearRelaxedFilters={clearRelaxedFilters}
          relaxedSortColumn={relaxedSortColumn}
          relaxedSortDirection={relaxedSortDirection}
          handleRelaxedSort={handleRelaxedSort}
          showRelaxedResults={showRelaxedResults}
          technicalFilterSettings={technicalFilterSettings}
          getLandminesForRow={getLandminesForRow}
        />
      )}

      {/* Add message when Step 4 enrichment completes but finds no options */}
      {showRelaxedResults && !isEnrichingRelaxed && relaxedResults.length === 0 && (
        <NoRelaxedResultsCard fundamentalCount={fundamentalResults.length} />
      )}

      {error && (
        <div className="mt-4 w-full max-w-7xl mx-auto p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span className="font-bold">Error:</span> {error}
          </div>
        </div>
      )}

      {cacheStatus && (
        <div className="mt-4 w-full max-w-7xl mx-auto p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-center text-sm">
          {cacheStatus}
        </div>
      )}
    </TooltipProvider>
  )
}
