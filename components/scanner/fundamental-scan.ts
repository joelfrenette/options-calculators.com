// Step 3 fundamental scan core: pulls Polygon snapshot/financials/aggregates per
// ticker, applies the fundamental filters, and buckets rejects/skips for the
// on-screen diagnostics. Extracted verbatim from components/wheel-scanner.tsx
// (Phase 4) — progress state setters became the onProgress callback; everything
// else (including every console.log) is unchanged.

import type { QualifyingStock } from "./types"
import { PRE_FILTER_MARKET_CAP_TIERS } from "./constants"
import { delay, fetchWithRetry } from "./enrichment"
import {
  sma,
  rsi as calcRSI,
  macd as calcMACD,
  bollinger as calcBollinger,
  stochasticK as calcStochastic,
  atr as calcATR,
} from "@/lib/indicators"
import { stepLabel } from "./steps"

  // Technical indicators (SMA/RSI/Bollinger/MACD/Stochastic/ATR) now come from
  // the shared lib/indicators.ts (Phase 4 extraction). All of them return null
  // on insufficient history — see the compute site in the fundamental scan for
  // the fail-safe handling.

  // Extract earnings data from Polygon snapshot
  const extractEarningsData = (tickerData: any, currentPrice: number, atrPercent: number) => {
    const earningsTimestamp = tickerData?.next_earnings_date
    let earningsDate: string | undefined
    let daysToEarnings: number | undefined
    let expectedMove: number | undefined

    if (earningsTimestamp) {
      const earnDate = new Date(earningsTimestamp)
      earningsDate = earnDate.toLocaleDateString()
      const today = new Date()
      daysToEarnings = Math.floor((earnDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      // S-10, closed 2026-08-11. This was
      //   currentPrice × (atrPercent / 100) × √(daysToEarnings / 7) × 1.5
      // — an ATR-based move with a `1.5` fudge factor that has no reference
      // anywhere, presented in the table as an expected move. The standard
      // form is S · σ · √T off IMPLIED volatility, and `expectedMove` in
      // `lib/black-scholes.ts` has implemented it since Phase 1 — **its own
      // docstring already claimed it "replaces the ad-hoc ATR × 1.5 fudge",
      // and the call site was never changed.** A fix that exists, is tested,
      // and is not wired is not a fix.
      //
      // The fundamental scan has no IV: the options chain is not fetched until
      // enrichment. So this stage supplies the earnings DATE and leaves the
      // move undefined; `enrichment.ts` fills it from the measured IV it just
      // read. An unknown move stays undefined rather than falling back to a
      // volatility proxy wearing the name of an implied one — the whole
      // labelling problem this audit exists to remove.
    }

    return { earningsDate, daysToEarnings, expectedMove }
  }

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

      // Diagnostics: track WHY each ticker was rejected/skipped so we can show it on-screen
      const rejectionBuckets: Record<string, string[]> = {
        priceCap: [],
        volume: [],
        debtEquity: [],
        roe: [],
        profitableQuarters: [],
        marketCap: [],
      }
      const skipBuckets: Record<string, string[]> = {
        rateLimit: [],
        apiError: [],
        thinFinancials: [],
        exception: [],
      }

      const batchSize = 2 // Reduced from 5 to 2 for better rate limit compliance
      const batchDelay = 2000 // Increased from 1000ms to 2000ms between batches
      const apiDelay = 300 // Increased from 100ms to 300ms between API calls

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

            // Quarterly filings, most recent first (sorted defensively by period end)
            const qRows: any[] = (financialsData.results || [])
              .filter((r: any) => r?.financials)
              .sort((a: any, b: any) => String(b.end_date || "").localeCompare(String(a.end_date || "")))

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

            // Count CONSECUTIVE profitable quarters starting from the most recent
            // filing — this is what the "Min Profitable Quarters" slider now gates on.
            let profitableQuarters = 0
            for (const row of qRows) {
              const ni = row.financials?.income_statement?.net_income_loss?.value
              if (typeof ni === "number" && Number.isFinite(ni) && ni > 0) profitableQuarters++
              else break
            }

            // TTM figures — FOUR quarters, each of them actually reported.
            //
            // This used to read "graceful when fewer exist": `qRows.slice(0, 4)`
            // summed with `|| 0` per quarter, so a company with two filings on
            // record produced a TWO-quarter sum labelled trailing-twelve-month.
            // That understates earnings and inflates every P/E, EPS and ROE
            // derived from it — and the shorter the history, the more confident
            // and the more wrong the number looked. A partial year is not a
            // year, so it is null.
            const ttmRows = qRows.slice(0, 4)
            const ttmQuarters = ttmRows.length
            const quarterlyNetIncome = ttmRows.map(
              (row: any) => row.financials?.income_statement?.net_income_loss?.value,
            )
            const net_income: number | null =
              ttmQuarters === 4 && quarterlyNetIncome.every((v: any) => typeof v === "number" && Number.isFinite(v))
                ? quarterlyNetIncome.reduce((sum: number, v: number) => sum + v, 0)
                : null

            // Balance-sheet legs: absent is unknown, not zero. `total_liabilities
            // || 0` reported a company with no balance sheet as debt-free.
            const rawEquity = balance_sheet.equity?.value
            const rawLiabilities = balance_sheet.liabilities?.value
            const stockholders_equity: number | null =
              typeof rawEquity === "number" && Number.isFinite(rawEquity) ? rawEquity : null
            const total_liabilities: number | null =
              typeof rawLiabilities === "number" && Number.isFinite(rawLiabilities) ? rawLiabilities : null

            // Extract shares outstanding from multiple possible sources
            const basic_shares = income_statement.basic_average_shares?.value || 0
            const shares_outstanding =
              ticker_data?.shares_outstanding ||
              ticker_data?.weighted_shares_outstanding ||
              qRows[0]?.shares_outstanding ||
              basic_shares ||
              0

            // TTM EPS = sum of the last 4 quarterly EPS figures. Same rule as
            // net income: a quarter with no reported EPS used to contribute 0,
            // turning three quarters of earnings into a "twelve-month" total.
            const quarterEPS = ttmRows.map((row: any) => {
              const is = row.financials?.income_statement || {}
              const v = is.diluted_earnings_per_share?.value ?? is.basic_earnings_per_share?.value
              return typeof v === "number" && Number.isFinite(v) ? v : null
            })
            let eps: number | null =
              ttmQuarters === 4 && quarterEPS.every((v: number | null) => v !== null)
                ? (quarterEPS as number[]).reduce((a: number, b: number) => a + b, 0)
                : null
            if (eps === null && shares_outstanding > 0 && net_income !== null && net_income !== 0) {
              // Derivable from a complete TTM net income, which is itself
              // already gated on four reported quarters.
              eps = net_income / shares_outstanding
            }

            // Calculate Market Cap: Price × Shares Outstanding
            let marketCap: number | null = null
            if (shares_outstanding > 0) {
              marketCap = currentPrice * shares_outstanding
            } else if (ticker_data?.market_cap) {
              marketCap = ticker_data.market_cap
            } else {
              // Fallback: estimate from financials (PE ratio method)
              // If PE is typically 15-20 for large caps, and we have net income
              if (net_income !== null && net_income > 0 && eps !== null && eps > 0) {
                marketCap = (currentPrice / eps) * net_income
              }
            }

            // Calculate PE Ratio — null when neither route has complete inputs.
            let peRatio: number | null = null
            if (eps !== null && eps > 0) {
              peRatio = currentPrice / eps
            } else if (marketCap !== null && marketCap > 0 && net_income !== null && net_income > 0) {
              // Fallback: use market cap / net income as approximation
              peRatio = marketCap / net_income
            }

            // Debt-to-Equity. Unknown equity gave 0, which reads as "no debt" —
            // the most flattering possible value for a company we know nothing
            // about.
            const debtToEquity: number | null =
              stockholders_equity !== null && stockholders_equity > 0 && total_liabilities !== null
                ? total_liabilities / stockholders_equity
                : null

            // ROE needs a complete TTM net income AND positive equity.
            const roe: number | null =
              net_income !== null && stockholders_equity !== null && stockholders_equity > 0
                ? (net_income / stockholders_equity) * 100
                : null

            const earningsTimestamp =
              snapshotData.ticker?.earnings?.announcement_date ||
              snapshotData.ticker?.earnings_date ||
              ticker_data?.next_earnings_date ||
              snapshotData.results?.earnings?.date

            let earningsDate: string | undefined
            let daysToEarnings: number | undefined

            if (earningsTimestamp) {
              const earnDate = new Date(earningsTimestamp)
              earningsDate = earnDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              const today = new Date()
              daysToEarnings = Math.floor((earnDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            }

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
              rejectionBuckets.roe.push(`${ticker}(ROE unknown)`)
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
              rejectionBuckets.marketCap.push(`${ticker}(unknown)`)
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

            const {
              earningsDate: finalEarningsDate,
              daysToEarnings: finalDaysToEarnings,
              expectedMove: fundamentalExpectedMove,
            } = extractEarningsData(ticker_data, currentPrice, atrPercent)

            // Calculate estimated premium and yield
            const putStrike = currentPrice * 0.95
            const daysToExpiration = 7

            let premiumMultiplier = 1.0
            if (finalDaysToEarnings !== undefined && finalDaysToEarnings >= 0 && finalDaysToEarnings <= 14) {
              premiumMultiplier = 1.5 + ((14 - finalDaysToEarnings) / 14) * 0.3
            }

            // When ATR is unknown, derive the dollar ATR from the same 2.5%
            // placeholder atrPercent already falls back to, so the labeled
            // estimate stays internally consistent (previously null→0 zeroed it).
            const atrForEstimate = atr ?? (atrPercent / 100) * currentPrice
            const estimatedPremium = atrForEstimate * 0.4 * Math.sqrt(daysToExpiration / 7) * premiumMultiplier
            const yieldPercent = putStrike > 0 ? (estimatedPremium / putStrike) * 100 : 0
            const volatilityAdjustedYield = yieldPercent * (1 + (atrPercent - 2) * 0.1)
            const finalYield = Math.max(0.5, Math.min(5, volatilityAdjustedYield))

            const estimatedDelta = -0.3

            const stockEarningsDate = earningsDate || finalEarningsDate
            const stockDaysToEarnings = daysToEarnings !== undefined ? daysToEarnings : finalDaysToEarnings

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
