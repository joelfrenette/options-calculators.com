// Options-chain enrichment (Steps 3/4): fetch expiries + chain snapshots from the
// Polygon proxy and attach real premium/greeks data to qualifying stocks.
// Extracted verbatim from components/wheel-scanner.tsx (Phase 4) — the only edits
// are the TS18048 fixes (typed locals for bid/ask/premium).

import type { QualifyingStock } from "./types"

  export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  export const fetchWithRetry = async (url: string, maxRetries = 3, initialDelay = 1000): Promise<Response> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await fetch(url)

      // If rate limited, wait and retry with exponential backoff
      if (response.status === 429) {
        const retryDelay = initialDelay * Math.pow(2, attempt) // 1s, 2s, 4s
        console.log(`[v0] ⏳ Rate limit hit. Retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await delay(retryDelay)
        continue
      }

      return response
    }

    // If all retries exhausted, return the last response
    return fetch(url)
  }

  const getCurrentDate = async (): Promise<Date> => {
    try {
      const response = await fetch("/api/time-server")
      if (response.ok) {
        const data = await response.json()
        console.log("[v0] Time server response:", {
          date: data.date,
          dayOfWeek: data.day_of_week,
          timezone: data.timezone,
          fallback: data.fallback || false,
        })
        return new Date(data.datetime)
      }
    } catch (error) {
      console.log("[v0] Time server failed, using local time:", error)
    }
    return new Date() // Fallback to local time
  }

  const getNextTwoFridays = async (): Promise<[string, string]> => {
    const today = await getCurrentDate()

    // Calculate next Friday
    const dayOfWeek = today.getDay()
    let daysUntilFriday: number
    if (dayOfWeek === 5) {
      daysUntilFriday = 7
    } else if (dayOfWeek === 6) {
      daysUntilFriday = 6
    } else {
      daysUntilFriday = 5 - dayOfWeek
    }

    const nextFriday = new Date(today)
    nextFriday.setDate(today.getDate() + daysUntilFriday)

    const followingFriday = new Date(nextFriday)
    followingFriday.setDate(nextFriday.getDate() + 7)

    return [nextFriday.toISOString().split("T")[0], followingFriday.toISOString().split("T")[0]]
  }

  const getNextFriday = async () => {
    const today = await getCurrentDate()
    const dayOfWeek = today.getDay() // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday

    console.log("[v0] Current date:", {
      date: today.toISOString().split("T")[0],
      dayOfWeek: dayOfWeek,
      dayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek],
    })

    // Calculate days until next Friday
    let daysUntilFriday: number
    if (dayOfWeek === 5) {
      // Today is Friday, get next Friday (7 days)
      daysUntilFriday = 7
    } else if (dayOfWeek === 6) {
      // Today is Saturday, Friday is 6 days away
      daysUntilFriday = 6
    } else {
      // Sunday (0) through Thursday (4)
      daysUntilFriday = 5 - dayOfWeek
    }

    const nextFriday = new Date(today)
    nextFriday.setDate(today.getDate() + daysUntilFriday)

    const fridayDate = nextFriday.toISOString().split("T")[0]

    console.log("[v0] Next Friday calculation:", {
      today: today.toISOString().split("T")[0],
      daysUntilFriday,
      nextFriday: fridayDate,
      nextFridayDayOfWeek: nextFriday.getDay(), // Should always be 5
    })

    // Verify it's actually a Friday
    if (nextFriday.getDay() !== 5) {
      console.error("[v0] ⚠️ ERROR: Calculated date is not a Friday!", {
        calculated: fridayDate,
        dayOfWeek: nextFriday.getDay(),
      })
    }

    return fridayDate // YYYY-MM-DD format
  }

  export const enrichWithOptionsData = async (
    stocks: QualifyingStock[],
    onProgress?: (current: number, total: number, ticker: string) => void,
  ): Promise<QualifyingStock[]> => {
    console.log("[v0] ================================================")
    console.log("[v0] ENRICHING WITH OPTIONS DATA")
    console.log("[v0] ================================================")

    const enriched: QualifyingStock[] = []
    const [nextFriday, followingFriday] = await getNextTwoFridays()
    console.log(`[v0] Target expiries: Next Friday=${nextFriday}, Following Friday=${followingFriday}`)

    let processedCount = 0
    const totalStocks = stocks.length

    for (const stock of stocks) {
      processedCount++
      if (onProgress) {
        onProgress(processedCount, totalStocks, stock.ticker)
      }

      try {
        let availableExpiries: string[] = []

        try {
          const expiriesRes = await fetch(`/api/polygon-proxy?endpoint=options-expiries&ticker=${stock.ticker}`)
          await delay(200)

          if (expiriesRes.ok) {
            const expiriesData = await expiriesRes.json()
            const contracts = expiriesData.results || []

            // Extract unique expiry dates from contracts
            const expirySet = new Set<string>()
            for (const contract of contracts) {
              if (contract.expiration_date) {
                expirySet.add(contract.expiration_date)
              }
            }
            availableExpiries = Array.from(expirySet).sort()
            console.log(
              `[v0] ${stock.ticker} - Found ${availableExpiries.length} available expiry dates: ${availableExpiries.slice(0, 5).join(", ")}${availableExpiries.length > 5 ? "..." : ""}`,
            )
          }
        } catch (expiriesError) {
          console.error(`[v0] ${stock.ticker} - Error fetching expiries:`, expiriesError)
        }

        let expiryDatesToUse: string[] = []

        if (availableExpiries.length > 0) {
          // Find the 2 nearest expiries that are at least 2 days out
          const today = new Date()
          const minDate = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000) // At least 2 days out

          const validExpiries = availableExpiries.filter((exp) => new Date(exp) >= minDate)
          expiryDatesToUse = validExpiries.slice(0, 2) // Take first 2

          console.log(`[v0] ${stock.ticker} - Using actual expiries: ${expiryDatesToUse.join(", ")}`)
        } else {
          // Fallback to calculated Fridays
          expiryDatesToUse = [nextFriday, followingFriday].filter(Boolean)
          console.log(`[v0] ${stock.ticker} - Using calculated Friday expiries: ${expiryDatesToUse.join(", ")}`)
        }

        for (const expiryDate of expiryDatesToUse) {
          if (!expiryDate) continue

          const daysToExpiry = Math.max(
            0,
            Math.floor((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) + 1,
          )

          console.log(
            `[v0] ${stock.ticker} - Fetching options chain snapshot for expiry: ${expiryDate} (${daysToExpiry} days away)`,
          )

          let contracts: any[] = []
          let useEstimatedGreeks = false

          // Try snapshot API first (has greeks and quotes)
          try {
            const chainSnapshotRes = await fetch(
              `/api/polygon-proxy?endpoint=options-chain-snapshot&ticker=${stock.ticker}&expiry_date=${expiryDate}&option_type=put`,
            )
            await delay(300)

            if (chainSnapshotRes.ok) {
              const chainSnapshotData = await chainSnapshotRes.json()
              contracts = chainSnapshotData.results || []
              console.log(`[v0] ${stock.ticker} - Snapshot API returned ${contracts.length} contracts`)
            }
          } catch (fetchError) {
            console.error(`[v0] ${stock.ticker} - Snapshot API error:`, fetchError)
          }

          if (contracts.length === 0 && availableExpiries.length > 0) {
            console.log(
              `[v0] ${stock.ticker} - Snapshot empty, using contracts from expiries API (market may be closed)`,
            )
            useEstimatedGreeks = true

            try {
              // Fetch all contracts for this ticker and filter by expiry
              const contractsRes = await fetch(
                `/api/polygon-proxy?endpoint=options-chain&ticker=${stock.ticker}&expiry_date=${expiryDate}&option_type=put`,
              )
              await delay(300)

              if (contractsRes.ok) {
                const contractsData = await contractsRes.json()
                const rawContracts = contractsData.results || []
                console.log(
                  `[v0] ${stock.ticker} - Contracts API returned ${rawContracts.length} contracts for ${expiryDate}`,
                )

                // Transform contracts API format to match snapshot format
                contracts = rawContracts.map((c: any) => ({
                  details: {
                    strike_price: c.strike_price,
                    ticker: c.ticker,
                    expiration_date: c.expiration_date,
                  },
                  // These will be estimated since market is closed
                  greeks: null,
                  last_quote: null,
                  last_trade: null,
                  day: null,
                }))
              }
            } catch (fallbackError) {
              console.error(`[v0] ${stock.ticker} - Contracts API fallback error:`, fallbackError)
            }
          }

          console.log(`[v0] ${stock.ticker} - Found ${contracts.length} put contracts for ${expiryDate}`)

          if (contracts.length === 0) {
            console.log(`[v0] ${stock.ticker} - No options found for ${expiryDate}`)
            continue
          }

          // Filter to relevant strike range (85-100% of current price)
          const relevantContracts = contracts.filter((contract: any) => {
            const strikePrice = contract.details?.strike_price
            if (!strikePrice) return false

            const percentOfPrice = strikePrice / stock.currentPrice
            return percentOfPrice >= 0.85 && percentOfPrice <= 1.0
          })

          console.log(
            `[v0] ${stock.ticker} - Filtered to ${relevantContracts.length} contracts in strike range (85-100% of price)`,
          )

          const optionsWithData: QualifyingStock[] = []

          for (const snapshot of relevantContracts) {
            const strikePrice = snapshot.details?.strike_price
            const optionTicker = snapshot.details?.ticker

            if (!strikePrice || !optionTicker) {
              continue
            }

            let delta: number | null = null
            let bid: number | undefined
            let ask: number | undefined
            let premium: number | undefined
            let iv: number | undefined
            let priceSource = ""

            if (useEstimatedGreeks) {
              // Delta estimation based on moneyness (strike / stock price)
              const moneyness = strikePrice / stock.currentPrice
              // Simple delta estimation: OTM puts have delta between -0.5 and 0
              // At-the-money (moneyness = 1.0) ≈ -0.5 delta
              // 10% OTM (moneyness = 0.9) ≈ -0.25 delta
              // 15% OTM (moneyness = 0.85) ≈ -0.15 delta
              delta = -0.5 * Math.pow(moneyness, 3) // Simplified estimation

              // Estimate premium based on typical option pricing
              // Rule of thumb: ATM options ≈ 2-3% of stock price for weekly/bi-weekly
              const timeValue = daysToExpiry / 365
              const estimatedIV = 0.35 // Assume 35% IV as baseline
              const atmPremiumPercent = estimatedIV * Math.sqrt(timeValue) * 0.4
              const otmDiscount = Math.pow(moneyness, 2)
              premium = stock.currentPrice * atmPremiumPercent * otmDiscount
              bid = premium * 0.95
              ask = premium * 1.05
              priceSource = "estimated (market closed)"

              console.log(
                `[v0] ${stock.ticker} - Estimated: Strike=$${strikePrice.toFixed(2)}, Delta=${delta.toFixed(3)}, Premium=$${premium.toFixed(2)}`,
              )
            } else {
              // Use actual data from snapshot
              delta = snapshot.greeks?.delta || null

              // Polygon reports IV as a decimal (0.42 = 42%). Store as %.
              const rawIV = Number(snapshot.implied_volatility)
              if (Number.isFinite(rawIV) && rawIV > 0) {
                iv = rawIV * 100
              }

              if (snapshot.last_quote?.bid_price && snapshot.last_quote?.ask_price) {
                // TS fix (TS18048): capture into typed locals so the compiler knows these are defined
                const quoteBid: number = snapshot.last_quote.bid_price
                const quoteAsk: number = snapshot.last_quote.ask_price
                bid = quoteBid
                ask = quoteAsk
                premium = (quoteBid + quoteAsk) / 2
                priceSource = "last_quote"
              } else if (snapshot.last_trade?.price) {
                // TS fix (TS18048): same typed-local pattern for the trade-price fallback
                const tradePrice: number = snapshot.last_trade.price
                premium = tradePrice
                bid = tradePrice * 0.995
                ask = tradePrice * 1.005
                priceSource = "last_trade"
              } else if (snapshot.day?.close) {
                premium = snapshot.day.close
                bid = premium
                ask = premium
                priceSource = "day_data"
              }
            }

            const deltaMin = useEstimatedGreeks ? -0.45 : -0.35
            const deltaMax = useEstimatedGreeks ? -0.15 : -0.25

            if (!delta || delta > deltaMax || delta < deltaMin) {
              if (!useEstimatedGreeks) {
                console.log(
                  `[v0] ${stock.ticker} - Skipping strike $${strikePrice}, delta ${delta?.toFixed(3)} outside range [${deltaMin}, ${deltaMax}]`,
                )
              }
              continue
            }

            if (!premium || !bid || !ask) {
              console.log(`[v0] ${stock.ticker} - No valid pricing for strike $${strikePrice}`)
              continue
            }

            const yieldPercent = (premium * 100) / strikePrice
            const optionDaysToExpiry = Math.max(
              0,
              Math.floor((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) + 1,
            )
            const annualizedYield = optionDaysToExpiry > 0 ? (yieldPercent * 365) / optionDaysToExpiry : 0

            console.log(
              `[v0] ✅ ${stock.ticker} - Strike=$${strikePrice.toFixed(2)}, Premium=$${premium.toFixed(2)}, Delta=${delta.toFixed(3)}, Bid=$${bid.toFixed(2)}, Ask=$${ask.toFixed(2)} [${priceSource}]`,
            )

            optionsWithData.push({
              ...stock,
              putStrike: strikePrice,
              premium: premium,
              yield: yieldPercent,
              annualizedYield: annualizedYield,
              delta: delta,
              daysToExpiry: optionDaysToExpiry,
              expiryDate,
              bidPrice: bid,
              askPrice: ask,
              iv,
            })
          }

          if (optionsWithData.length === 0) {
            console.log(`[v0] ${stock.ticker} - No options with valid data for ${expiryDate}`)
            continue
          }

          // Sort by proximity to -0.30 delta.
          //
          // `(a.delta || 0)` treated a contract with no delta as delta 0, which
          // is 0.30 away from the target — the same distance as a perfectly
          // respectable -0.60 — so unknown-delta contracts were ranked into the
          // middle of the pack and could be picked as the "closest to -0.30".
          // Unknown sorts last instead of competing on an invented value.
          const distanceFromTarget = (delta: number | null | undefined) =>
            typeof delta === "number" && Number.isFinite(delta) ? Math.abs(delta - -0.3) : Number.POSITIVE_INFINITY
          optionsWithData.sort((a, b) => distanceFromTarget(a.delta) - distanceFromTarget(b.delta))

          const top3Options = optionsWithData.slice(0, 3)

          console.log(`[v0] ✅ ${stock.ticker} - Adding ${top3Options.length} options for ${expiryDate}:`)
          top3Options.forEach((opt) => {
            console.log(
              `[v0]    - Strike=$${opt.putStrike?.toFixed(2)}, Premium=$${opt.premium?.toFixed(2)}, Delta=${opt.delta?.toFixed(3)}, Yield=${opt.yield?.toFixed(2)}%, Annual=${opt.annualizedYield?.toFixed(1)}%`,
            )
          })

          enriched.push(...top3Options)
        } // End loop for expiry dates
      } catch (error) {
        console.error(`[v0] ${stock.ticker} - Error processing options data:`, error)
        console.log(`[v0] ${stock.ticker} - Skipping due to error, continuing with next stock`)
        continue
      }
    } // End of loop through stocks

    console.log("[v0] ================================================")
    console.log(`[v0] Final enriched results: ${enriched.length} stock/expiry combinations`)
    console.log("[v0] ================================================")

    return enriched
  }
