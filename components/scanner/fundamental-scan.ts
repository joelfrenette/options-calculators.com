// Step 3 fundamental scan core: pulls Polygon snapshot/financials/aggregates per
// ticker, applies the fundamental filters, and buckets rejects/skips for the
// on-screen diagnostics. Extracted verbatim from components/wheel-scanner.tsx
// (Phase 4) — progress state setters became the onProgress callback; everything
// else (including every console.log) is unchanged.

import type { QualifyingStock } from "./types"
import { BENCHMARK_TICKER, PRE_FILTER_MARKET_CAP_TIERS } from "./constants"
import { delay, fetchWithRetry } from "./enrichment"
import {
  sma,
  rsi as calcRSI,
  macd as calcMACD,
  bollinger as calcBollinger,
  stochasticK as calcStochastic,
  atr as calcATR,
} from "@/lib/indicators"
import {
  SESSIONS_PER_MONTH,
  isStage4Decline,
  momentum12m1,
  moveInAtrUnits,
  relativeReturnPoints,
  sessionMovePercent,
  trailingReturnPercent,
} from "@/lib/trend-filters"
import { stepLabel } from "./steps"
// The scan's arithmetic — TTM derivation, the earnings extraction and the
// premium estimate — lives in the import-free `fundamental-metrics.ts` so that
// a check script can load and assert it (P6-13). This file keeps the fetching,
// the batching and the rejection diagnostics.
import {
  deriveFundamentals,
  estimatePremium,
  extractEarningsData,
  sortQuarterRows,
} from "./fundamental-metrics"
import { REJECTION_REASONS, SKIP_REASONS, emptyBuckets } from "./scan-diagnostics"

  // Technical indicators (SMA/RSI/Bollinger/MACD/Stochastic/ATR) now come from
  // the shared lib/indicators.ts (Phase 4 extraction). All of them return null
  // on insufficient history — see the compute site in the fundamental scan for
  // the fail-safe handling.

// Slider values arrive as the same number[] state arrays the component holds,
// so the filter logic below reads [0] exactly as it did before extraction.
export interface FundamentalScanParams {
  tickers: string[]
  maxStockPrice: number[]
  minVolume: number[]
  maxDebtToEquity: number[]
  minROE: number[]
  minProfitableQuarters: number[]
  minMarketCapCategory: number[]
  onProgress?: (progress: number, ticker: string) => void
}

export interface FundamentalScanOutcome {
  qualifyingStocks: QualifyingStock[]
  nearMissStocks: QualifyingStock[]
  rejectionBuckets: Record<string, string[]>
  skipBuckets: Record<string, string[]>
  skippedTickers: string[]
}

export const runFundamentalScan = async ({
  tickers,
  maxStockPrice,
  minVolume,
  maxDebtToEquity,
  minROE,
  minProfitableQuarters,
  minMarketCapCategory,
  onProgress,
}: FundamentalScanParams): Promise<FundamentalScanOutcome> => {
      console.log(`[v0] ${stepLabel("fundamentals")}: Scanning ${tickers.length} stocks with Polygon API`)
      console.log(`[v0] Using optimized batch processing for paid account: 5 stocks at a time with 1000ms delays`)

      const qualifyingStocks: QualifyingStock[] = []
      const nearMissStocks: QualifyingStock[] = []
      const skippedTickers: string[] = []

      // Diagnostics: track WHY each ticker was rejected/skipped so we can show
      // it on-screen. The KEYS come from scan-diagnostics.ts, which also owns
      // the label the notice card renders for each — a bucket without a label
      // used to render a blank heading beside a live count (P7-53).
      const rejectionBuckets = emptyBuckets(REJECTION_REASONS)
      const skipBuckets = emptyBuckets(SKIP_REASONS)

      const batchSize = 2 // Reduced from 5 to 2 for better rate limit compliance
      const batchDelay = 2000 // Increased from 1000ms to 2000ms between batches
      const apiDelay = 300 // Increased from 100ms to 300ms between API calls

      // The benchmark's own trailing year, fetched ONCE for the whole scan
      // rather than per ticker — it is the same number for every row, and the
      // scan is already batched at two tickers per two seconds to stay inside
      // the rate limit. One extra call, not N.
      //
      // Null on any failure, and null propagates: a relative-strength gate with
      // no benchmark cannot be evaluated, so it fails safe like every other
      // null indicator here rather than silently comparing against zero. The
      // notice text says the benchmark is missing so the empty result is
      // explicable.
      let benchmarkReturn12m: number | null = null
      try {
        const benchRes = await fetchWithRetry(`/api/polygon-proxy?endpoint=aggregates&ticker=${BENCHMARK_TICKER}`)
        if (benchRes.ok) {
          const benchData = await benchRes.json()
          const benchCloses = (benchData.results || [])
            .map((bar: any) => bar.c)
            .filter((c: number) => typeof c === "number")
          benchmarkReturn12m = trailingReturnPercent(benchCloses)
          console.log(
            `[v0] Benchmark ${BENCHMARK_TICKER} trailing-year return: ${
              benchmarkReturn12m === null ? "unavailable" : `${benchmarkReturn12m.toFixed(1)}%`
            }`,
          )
        } else {
          console.log(`[v0] ⚠️ Benchmark ${BENCHMARK_TICKER} aggregates failed (${benchRes.status}) — relative strength unavailable`)
        }
      } catch (e) {
        console.log(`[v0] ⚠️ Benchmark ${BENCHMARK_TICKER} fetch threw — relative strength unavailable`)
      }
      await delay(apiDelay)

      for (let i = 0; i < tickers.length; i += batchSize) {
        const batch = tickers.slice(i, i + batchSize)

        const batchPromises = batch.map(async (ticker, batchIndex) => {
          try {
            const currentIndex = i + batchIndex
            // Progress is reported via callback — the component wires this to its state.
            onProgress?.(Math.floor(((currentIndex + 1) / tickers.length) * 100), ticker)

            const snapshotRes = await fetchWithRetry(`/api/polygon-proxy?endpoint=snapshot&ticker=${ticker}`)
            await delay(apiDelay)

            const financialsRes = await fetchWithRetry(
              `/api/polygon-proxy?endpoint=financials&ticker=${ticker}&timeframe=quarterly&limit=12`,
            )
            await delay(apiDelay)

            const aggregatesRes = await fetchWithRetry(`/api/polygon-proxy?endpoint=aggregates&ticker=${ticker}`)

            if (snapshotRes.status === 429 || financialsRes.status === 429 || aggregatesRes.status === 429) {
              console.log(`[v0] ⚠️ ${ticker} - Rate limit hit after retries. Skipping...`)
              skippedTickers.push(ticker)
              skipBuckets.rateLimit.push(ticker)
              return null
            }

            if (!snapshotRes.ok || !aggregatesRes.ok) {
              console.log(
                `[v0] ⚠️ ${ticker} - Polygon API error. snapshot=${snapshotRes.status} financials=${financialsRes.status} aggregates=${aggregatesRes.status}. Skipping...`,
              )
              skippedTickers.push(ticker)
              skipBuckets.apiError.push(ticker)
              return null
            }

            const snapshotData = await snapshotRes.json()
            const financialsData = await financialsRes.json()
            const aggregatesData = await aggregatesRes.json()

            console.log(`[v0] ${ticker} - Raw Polygon snapshot:`, JSON.stringify(snapshotData.ticker, null, 2))
            console.log(
              `[v0] ${ticker} - Raw Polygon financials:`,
              JSON.stringify(financialsData.results?.[0], null, 2),
            )

            const ticker_data = snapshotData.ticker
            const prevDay = ticker_data?.prevDay || {}
            const day = ticker_data?.day || {}

            const currentPrice = day.c || prevDay.c || 0

            // P7-51. NO PRICE IS A SKIP, NOT A ROW.
            //
            // `day.c || prevDay.c || 0` yields 0 when Polygon returns neither a
            // live nor a previous close, and 0 sailed through everything below:
            // the price cap compares `0 > cap` and passes, and the ticker went
            // on to fail volume and incomplete-fundamentals — TWO failures,
            // which is a near miss, so it was not discarded but SHOWN in the
            // relaxed Step 4 table. It rendered a $0.00 strike, a $0.00 premium
            // and a **0.50% yield**, because the estimate's clamp has a floor
            // and a floor applies to a row with nothing in it.
            //
            // A clamp bound is not a measurement, and this is the house rule's
            // own shape: missing data must not render as a number. It is a skip
            // rather than a rejection because no filter was ever evaluated — we
            // never looked, which is a different answer from "it failed".
            if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
              console.log(`[v0] ⚠️ ${ticker} - no price (day.c and prevDay.c both absent). Skipping...`)
              skippedTickers.push(ticker)
              skipBuckets.noPrice.push(ticker)
              return null
            }

            // Step 1 Dollar Amount filter: exclude stocks priced above the chosen max.
            // A slider value of 1000 means "1,000+" and is treated as no upper limit.
            const priceCap = maxStockPrice[0]
            if (priceCap < 1000 && currentPrice > priceCap) {
              console.log(
                `[v0] ⏭️ ${ticker} - price $${currentPrice.toFixed(2)} exceeds max stock price $${priceCap}. Skipping...`,
              )
              skippedTickers.push(ticker)
              rejectionBuckets.priceCap.push(`${ticker}($${currentPrice.toFixed(0)})`)
              return null
            }

            const volume = day.v || prevDay.v || 0
            const volumeInMillions = volume / 1000000

            const qRows = sortQuarterRows(financialsData.results || [])

            const latestFinancials = qRows[0]?.financials || {}
            const income_statement = latestFinancials.income_statement || {}
            const balance_sheet = latestFinancials.balance_sheet || {}

            const hasIncome = Object.keys(income_statement).length > 0
            const hasBalance = Object.keys(balance_sheet).length > 0
            if (!hasIncome || !hasBalance) {
              console.log(
                `[v0] ⚠️ ${ticker} - Thin financials (income=${hasIncome}, balance=${hasBalance}, quarters=${qRows.length}). Filters below will likely reject with ROE=0/EPS=0.`,
              )
              skipBuckets.thinFinancials.push(ticker)
            }

            // Every derived fundamental — consecutive profitable quarters, the
            // four-quarter TTM gate, EPS, market cap, P/E, D/E and ROE — comes
            // from `fundamental-metrics.ts`, which is import-free and therefore
            // assertable. See scripts/check-fundamental-metrics.ts for the
            // null rules each of these encodes.
            const {
              profitableQuarters,
              ttmQuarters,
              quarterEPS,
              eps,
              marketCap,
              peRatio,
              debtToEquity,
              roe,
            } = deriveFundamentals(qRows, ticker_data, currentPrice)

            // S-17: the second, narrower extraction that used to live here is
            // gone. `extractEarningsData` below is the only reader of the
            // earnings fields, so the displayed date and the premium bump can
            // no longer come from different answers.
            const { earningsDate, daysToEarnings } = extractEarningsData(snapshotData)

            console.log(
              `[v0] ${ticker}: Price=$${currentPrice.toFixed(2)}, EPS(TTM)=${eps === null ? "n/a" : `$${eps.toFixed(4)}`}, PE=${peRatio === null ? "n/a" : peRatio.toFixed(1)}, MarketCap=${marketCap === null ? "n/a" : `$${(marketCap / 1e9).toFixed(1)}B`}, Vol=${volumeInMillions.toFixed(1)}M, D/E=${debtToEquity === null ? "n/a" : debtToEquity.toFixed(2)}, ROE=${roe === null ? "n/a" : `${roe.toFixed(1)}%`}, TTMQtrs=${ttmQuarters}/4, ProfitQtrs=${profitableQuarters}/${qRows.length}${earningsDate ? `, Earnings: ${earningsDate} (${daysToEarnings}d)` : " (no earnings date)"}`,
            )

            // Apply filters with REAL data from Polygon — record which ones fail so we
            // can build a "near miss" relaxed set even when strict Step 3 returns 0.
            const minVolumeValue = minVolume[0]
            const maxDebtValue = maxDebtToEquity[0]
            const minROEValue = minROE[0]
            const failedFilters: string[] = []

            if (volumeInMillions < minVolumeValue) {
              console.log(`[v0]   ❌ ${ticker}: Volume ${volumeInMillions.toFixed(1)}M < ${minVolumeValue}M`)
              rejectionBuckets.volume.push(`${ticker}(${volumeInMillions.toFixed(1)}M)`)
              failedFilters.push("volume")
            }
            if (debtToEquity !== null && debtToEquity > 0 && debtToEquity > maxDebtValue) {
              console.log(`[v0]   ❌ ${ticker}: D/E ${debtToEquity.toFixed(2)} > ${maxDebtValue}`)
              rejectionBuckets.debtEquity.push(`${ticker}(${debtToEquity.toFixed(2)})`)
              failedFilters.push("debtEquity")
            }
            // An unknown ROE is not an ROE of 0%. It used to be compared as 0
            // and rejected under the "ROE below minimum" reason, which told the
            // user a measured fact about a company whose earnings never
            // reported. It now fails under its own reason, so the notice says
            // "incomplete financials" instead of quoting a fabricated 0.0%.
            if (roe === null) {
              console.log(`[v0]   ❌ ${ticker}: ROE unknown (TTM covers ${ttmQuarters}/4 quarters)`)
              // P7-53: this used to push into the `roe` bucket, so the notice
              // card told the user "ROE below Min ROE %" about a company whose
              // earnings never reported. P6-24 fixed that exact sentence in the
              // LOG line above and left the bucket pointing at the wrong label.
              rejectionBuckets.fundamentalsIncomplete.push(`${ticker}(ROE unknown)`)
              failedFilters.push("fundamentalsIncomplete")
            } else if (roe < minROEValue) {
              console.log(`[v0]   ❌ ${ticker}: ROE ${roe.toFixed(1)}% < ${minROEValue}%`)
              rejectionBuckets.roe.push(`${ticker}(${roe.toFixed(1)}%)`)
              failedFilters.push("roe")
            }
            if (minProfitableQuarters[0] > 0) {
              // Clamp to the history we actually have so a data gap (e.g. only 8
              // filings available) can't fail a company that's clean across all of them.
              const requiredQ = Math.min(minProfitableQuarters[0], Math.max(1, qRows.length))
              if (profitableQuarters < requiredQ) {
                console.log(
                  `[v0]   ❌ ${ticker}: ${profitableQuarters} consecutive profitable quarters < ${requiredQ} required`,
                )
                rejectionBuckets.profitableQuarters.push(`${ticker}(${profitableQuarters}q)`)
                failedFilters.push("profitableQuarters")
              }
            }
            const minMarketCapValue = PRE_FILTER_MARKET_CAP_TIERS[minMarketCapCategory[0]]?.value ?? 0
            if (minMarketCapValue > 0 && marketCap === null) {
              // Unknown cap used to compare as 0 and be rejected as "below
              // minimum", quoting a $0.0B figure that was never measured.
              console.log(`[v0]   ❌ ${ticker}: Market Cap unknown (no shares outstanding and no complete TTM)`)
              // Same correction as ROE above: unknown is not "below minimum".
              rejectionBuckets.fundamentalsIncomplete.push(`${ticker}(market cap unknown)`)
              if (!failedFilters.includes("fundamentalsIncomplete")) failedFilters.push("fundamentalsIncomplete")
            } else if (minMarketCapValue > 0 && marketCap !== null && marketCap < minMarketCapValue) {
              console.log(
                `[v0]   ❌ ${ticker}: Market Cap $${(marketCap / 1e9).toFixed(1)}B < $${(minMarketCapValue / 1e9).toFixed(1)}B`,
              )
              rejectionBuckets.marketCap.push(`${ticker}($${(marketCap / 1e9).toFixed(1)}B)`)
              failedFilters.push("marketCap")
            }

            if (failedFilters.length === 0) {
              console.log(`[v0]   ✅ ${ticker} PASSED all filters with REAL Polygon data`)
            } else {
              console.log(`[v0]   ⚠️ ${ticker} — near-miss (${failedFilters.length} failed: ${failedFilters.join(",")})`)
            }

            const historicalData = aggregatesData.results || []
            const closes = historicalData.map((bar: any) => bar.c).filter((c: number) => c != null)
            const highs = historicalData.map((bar: any) => bar.h).filter((h: number) => h != null)
            const lows = historicalData.map((bar: any) => bar.l).filter((l: number) => l != null)

            // lib/indicators.ts: every indicator is null when the history is too
            // short — null NEVER becomes 0 (a 0 SMA made `sma50 > sma200` always
            // true for IPOs → false Golden Cross, FORMULAS.md §1).
            const sma50 = sma(closes, 50)
            const sma100 = sma(closes, 100)
            const sma200 = sma(closes, 200)
            const rsi = calcRSI(closes, 14)
            const bb = calcBollinger(closes, 20)
            const bbPosition =
              bb === null
                ? "—"
                : currentPrice <= bb.lower
                  ? "Below"
                  : currentPrice <= bb.middle
                    ? "Lower Half"
                    : "Upper Half"
            const macd = calcMACD(closes)
            const macdSignal = macd === null ? "—" : macd.macd > macd.signal ? "Bullish" : "Bearish"
            const stochastic = calcStochastic(closes, highs, lows, 14)
            const atr = calcATR(highs, lows, closes, 14)
            // atrPercent keeps its pre-existing 2.5% placeholder when ATR is
            // unknown — it feeds the premium ESTIMATE (already labeled as such),
            // not a pass/fail gate on real data.
            const atrPercent = atr !== null && atr > 0 ? (atr / currentPrice) * 100 : 2.5
            const redDay = closes.length >= 2 && closes[closes.length - 1] < closes[closes.length - 2]

            // --- CSP entry filters (lib/trend-filters.ts) -----------------
            //
            // THE SESSION MOVE, AND WHY IT HAS A SOURCE FIELD. `day` is the
            // live session and is empty outside market hours; `prevDay` is the
            // last close. Taking `day.c || prevDay.c` — which is what
            // currentPrice above does — and differencing it against prevDay
            // would yield exactly 0% whenever the market is shut, which reads
            // as "no big move" for a stock that gapped 12% at yesterday's open.
            // So: today when today exists, otherwise the last COMPLETED
            // session from the daily bars, and the row says which.
            const hasLiveSession = typeof day.c === "number" && day.c > 0 && typeof prevDay.c === "number" && prevDay.c > 0
            const dayMovePercent = hasLiveSession
              ? sessionMovePercent(day.c, prevDay.c)
              : closes.length >= 2
                ? sessionMovePercent(closes[closes.length - 1], closes[closes.length - 2])
                : null
            const dayMoveSource: "today" | "last_session" | "unknown" =
              dayMovePercent === null ? "unknown" : hasLiveSession ? "today" : "last_session"
            const dayMoveAtrMultiple = moveInAtrUnits(dayMovePercent, currentPrice, atr)

            // The trailing year. `closes` is oldest-first (the proxy requests
            // sort=asc over 365 calendar days, limit=300 — ~252 sessions, so
            // the window is not truncated by the limit).
            const return12m = trailingReturnPercent(closes)
            const momentum = momentum12m1(closes)

            // Stage 4 needs the 150-session average AND the same average a
            // month ago, so the slope can be read. Both come from the house
            // `sma()` — this file must not compute an average of its own.
            const sma150 = sma(closes, 150)
            const sma150Prior = closes.length > SESSIONS_PER_MONTH ? sma(closes.slice(0, -SESSIONS_PER_MONTH), 150) : null
            const stage4Decline = isStage4Decline(currentPrice, sma150, sma150Prior)

            const relativeReturn12m = relativeReturnPoints(return12m, benchmarkReturn12m)

            // Always undefined at this stage, and that is S-10's decision rather
            // than an oversight: the fundamental scan has no implied volatility
            // — the options chain is not fetched until enrichment — so the
            // expected move is left unset instead of being filled from an ATR
            // proxy wearing an implied-volatility label. Enrichment supplies it.
            const fundamentalExpectedMove: number | undefined = undefined
            // The premium bump now reads the SAME days-to-earnings the row
            // displays. It used to read the narrow extraction's, so a ticker
            // whose date came from `announcement_date` showed an imminent-
            // earnings warning beside a premium computed as though there were
            // none.
            const finalDaysToEarnings = daysToEarnings

            // Calculate estimated premium and yield — a labelled ESTIMATE, and
            // the only place the scan produces a number it did not measure.
            const { putStrike, estimatedPremium, finalYield } = estimatePremium(
              currentPrice,
              atr,
              atrPercent,
              finalDaysToEarnings,
            )

            const estimatedDelta = -0.3

            // One extraction, so no `a || b` reconciliation is needed (S-17).
            const stockEarningsDate = earningsDate
            const stockDaysToEarnings = daysToEarnings

            return {
              ticker,
              currentPrice,
              peRatio: peRatio !== null && peRatio > 0 ? Number(peRatio.toFixed(1)) : null,
              avgVolume: Number(volumeInMillions.toFixed(2)),
              // Real per-quarter EPS, or null. The fallback used to be
              // `[eps, eps, eps, eps].map(v => v / 4)` — four identical
              // synthetic quarters manufactured from the TTM total, i.e. an
              // invented earnings history with no variance at all, sitting
              // under a comment claiming it was real.
              last4EPS:
                quarterEPS.length === 4 && quarterEPS.every((v: number | null) => v !== null)
                  ? (quarterEPS as number[])
                  : null,
              sma50,
              sma100,
              sma200,
              // Null SMA = "unknown" — an unknown trend must NOT pass the
              // golden-cross gate (the old 0-SMA made this always true for IPOs).
              uptrend: sma50 !== null && sma200 !== null && sma50 > sma200,
              rsi: rsi !== null ? Number(rsi.toFixed(1)) : null,
              bollingerPosition: bbPosition,
              macdSignal,
              stochastic: stochastic !== null ? Number(stochastic.toFixed(1)) : null,
              atr: atr !== null ? Number(atr.toFixed(2)) : null,
              atrPercent: Number(atrPercent.toFixed(2)),
              putStrike: Number(putStrike.toFixed(2)),
              premium: Number(estimatedPremium.toFixed(2)),
              yield: Number(finalYield.toFixed(2)),
              delta: estimatedDelta,
              deltaSource: "estimated" as const, // Default to estimated for fundamental scan
              // Billions, or null when unknown. Zero used to render as a
              // confident "$0.0B".
              marketCap: marketCap !== null && marketCap > 0 ? Number((marketCap / 1_000_000_000).toFixed(1)) : null,
              redDay,
              earningsDate: stockEarningsDate, // Use real earnings date
              daysToEarnings: stockDaysToEarnings, // Use real days to earnings
              expectedMove: fundamentalExpectedMove,
              volume: volume, // Store raw volume
              roe: roe === null ? null : Number(roe.toFixed(1)), // Return on Equity %, null when TTM is incomplete
              debtToEquity: debtToEquity === null ? null : Number(debtToEquity.toFixed(2)),
              failedFilters, // [] on strict pass; 1–2 entries → near miss for relaxed Step 4
              profitableQuarters,
              // How many of the four TTM quarters actually reported, so the UI
              // can say why a fundamental is "—" rather than leaving it blank.
              ttmQuarters,
              // CSP entry filters. Every one may be null — see types.ts.
              dayMovePercent: dayMovePercent === null ? null : Number(dayMovePercent.toFixed(2)),
              dayMoveSource,
              dayMoveAtrMultiple: dayMoveAtrMultiple === null ? null : Number(dayMoveAtrMultiple.toFixed(2)),
              return12m: return12m === null ? null : Number(return12m.toFixed(1)),
              benchmarkReturn12m: benchmarkReturn12m === null ? null : Number(benchmarkReturn12m.toFixed(1)),
              relativeReturn12m: relativeReturn12m === null ? null : Number(relativeReturn12m.toFixed(1)),
              momentum12m1: momentum === null ? null : Number(momentum.toFixed(1)),
              stage4Decline,
            }
          } catch (err) {
            console.log(`[v0] Error processing ${ticker}:`, err)
            skippedTickers.push(ticker)
            skipBuckets.exception.push(ticker)
            return null
          }
        })

        const batchResults = await Promise.all(batchPromises)
        const validResults = batchResults.filter((r) => r !== null)
        // Only stocks that passed every filter belong in the strict results;
        // near-misses (1–2 failed filters) are held aside for the relaxed Step 4 fallback.
        for (const s of validResults) {
          if (!s) continue // preserve existing wide type; upstream predicate is already flagged
          const failedCount = s.failedFilters?.length ?? 0
          if (failedCount === 0) qualifyingStocks.push(s)
          else if (failedCount <= 2) nearMissStocks.push(s)
        }

        if (i + batchSize < tickers.length) {
          await delay(batchDelay)
        }
      }

      console.log(
        `[v0] ✅ ${stepLabel("fundamentals")} Complete with REAL Polygon data: ${qualifyingStocks.length} passed out of ${tickers.length} scanned`,
      )

      if (skippedTickers.length > 0) {
        console.log(`[v0] Skipped tickers: ${skippedTickers.join(", ")}`)
      }

      console.log(`[v0] 📊 REJECTION BREAKDOWN — ${qualifyingStocks.length}/${tickers.length} passed strict, ${nearMissStocks.length} near-miss (≤2 fails)`)
      Object.entries(rejectionBuckets).forEach(([reason, ts]) => {
        if (ts.length) console.log(`[v0]   ❌ ${reason} (${ts.length}): ${ts.slice(0, 25).join(", ")}${ts.length > 25 ? ", ..." : ""}`)
      })
      Object.entries(skipBuckets).forEach(([reason, ts]) => {
        if (ts.length) console.log(`[v0]   ⚠️ skip:${reason} (${ts.length}): ${ts.slice(0, 25).join(", ")}${ts.length > 25 ? ", ..." : ""}`)
      })

      return { qualifyingStocks, nearMissStocks, rejectionBuckets, skipBuckets, skippedTickers }
}
