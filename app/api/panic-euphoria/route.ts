import { NextResponse } from "next/server"
import { sma } from "@/lib/indicators"
import { getApiKey } from "@/lib/api-keys"
import { meteredFetch } from "@/lib/metered-fetch"
import { upsertSeriesPoint, latestWithPercentile } from "@/lib/market-series"
import { fredLatestFromStore, fredPercentileFromStore } from "@/lib/fred-store"

// Helper function to fetch Yahoo Finance data
async function fetchYahooData(symbol: string, range = "5y") {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1wk&range=${range}`,
  )
  const data = await response.json()
  return data.chart.result[0]
}

// SMA from the shared lib (house rule: indicators only from lib/indicators.ts).
// The old local copy returned the LAST PRICE — or 0 — when history was too
// short, silently presenting a non-average as an average (P6-9). Insufficient
// history now throws, which the route's catch turns into an honest 500.
function smaOrThrow(prices: number[], period: number, label: string): number {
  const v = sma(prices, period)
  if (v === null) throw new Error(`Insufficient history for ${label}: have ${prices.length}, need ${period}`)
  return v
}

// Helper function to normalize indicator to -1 to +1 scale
function normalize(value: number, min: number, max: number, neutral: number): number {
  if (value === neutral) return 0
  if (value > neutral) {
    // Map from neutral to max => 0 to 1
    return (value - neutral) / (max - neutral)
  } else {
    // Map from min to neutral => -1 to 0
    return (value - neutral) / (neutral - min)
  }
}

async function fetchWithScrapingBee(url: string) {
  const apiKey = getApiKey("SCRAPINGBEE_API_KEY")
  if (!apiKey) {
    console.log("[v0] ScrapingBee API key not found, using direct fetch")
    const response = await fetch(url)
    return response
  }

  const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=false`
  console.log("[v0] Fetching with ScrapingBee:", url)
  return fetch(scrapingBeeUrl)
}

async function getAIEstimate(indicatorName: string, context: string): Promise<number> {
  console.log(`[v0] Getting AI estimate for ${indicatorName}`)

  // Try Grok first (fastest)
  const grokKey = getApiKey("XAI_API_KEY") || getApiKey("GROK_XAI_API_KEY")
  if (grokKey) {
    try {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${grokKey}`,
        },
        body: JSON.stringify({
          model: "grok-2",
          messages: [
            {
              role: "user",
              content: `You are a financial data expert. Estimate the current ${indicatorName} based on this context: ${context}. Respond with ONLY a number, no explanation.`,
            },
          ],
          temperature: 0.1,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const estimate = Number.parseFloat(data.choices[0].message.content.trim())
        if (!isNaN(estimate)) {
          console.log(`[v0] Grok estimate for ${indicatorName}: ${estimate}`)
          return estimate
        }
      }
    } catch (error) {
      console.log(`[v0] Grok failed for ${indicatorName}:`, error)
    }
  }

  // Fallback to Groq
  const groqKey = getApiKey("GROQ_API_KEY")
  if (groqKey) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "user",
              content: `Estimate current ${indicatorName} value. Context: ${context}. Reply with just the number.`,
            },
          ],
          temperature: 0.1,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const estimate = Number.parseFloat(data.choices[0].message.content.trim())
        if (!isNaN(estimate)) {
          console.log(`[v0] Groq estimate for ${indicatorName}: ${estimate}`)
          return estimate
        }
      }
    } catch (error) {
      console.log(`[v0] Groq failed for ${indicatorName}:`, error)
    }
  }

  return 0
}

async function calculatePanicEuphoria() {
  try {
    console.log("[v0] Fetching Panic/Euphoria model data with live sources...")

    const [spxData, vixData, qqqData, diaData] = await Promise.all([
      fetchYahooData("^GSPC", "5y"),
      fetchYahooData("^VIX", "1y"),
      fetchYahooData("QQQ", "1y"),
      fetchYahooData("DIA", "1y"),
    ])

    const spxPrices = spxData.indicators.quote[0].close.filter((p: number) => p !== null)
    const currentSpx = spxPrices[spxPrices.length - 1]
    const spx200WeekMA = smaOrThrow(spxPrices, 200, "SPX 200-week MA")
    const aboveMA = currentSpx > spx200WeekMA

    console.log("[v0] SPX:", currentSpx, "200-WMA:", spx200WeekMA, "Above MA:", aboveMA)

    const vixPrices = vixData.indicators.quote[0].close.filter((p: number) => p !== null)
    const currentVix = vixPrices[vixPrices.length - 1]

    // REAL short positioning (E-8a): aggregate FINRA off-exchange short-volume
    // ratio from Quiver (probed live 2026-08-08: included in Joel's plan,
    // 5,469 tickers/day). Replaces the old VIX-derived synthesis and its AI
    // backup entirely. Each reading lands in market_series and is scored as
    // the percentile of its own stored history (the P6-14 rule) — until 8
    // days accumulate, the component's SCORE is null and drops out of the
    // composite; the raw value still displays.
    let nyseShortInterest: number | null = null
    let shortInterestScore: number | null = null
    let shortInterestIsLive = false
    try {
      const quiverKey = getApiKey("QUIVER_API_KEY")
      if (quiverKey) {
        const oe = await meteredFetch("quiver", "https://api.quiverquant.com/beta/live/offexchange", {
          headers: { Accept: "application/json", Authorization: `Bearer ${quiverKey}` },
          signal: AbortSignal.timeout(15000),
          next: { revalidate: 3600 }, // FINRA data is daily; hourly cache is generous
          routeTag: "/api/panic-euphoria",
        })
        if (oe.ok) {
          const rows = (await oe.json()) as { Date?: string; OTC_Short?: number; OTC_Total?: number }[]
          if (Array.isArray(rows) && rows.length > 0) {
            const latestDate = rows.reduce((m, r) => (r.Date && r.Date > m ? r.Date : m), "")
            let shortSum = 0
            let totalSum = 0
            for (const r of rows) {
              if (r.Date === latestDate && Number.isFinite(r.OTC_Short) && Number.isFinite(r.OTC_Total)) {
                shortSum += r.OTC_Short as number
                totalSum += r.OTC_Total as number
              }
            }
            if (totalSum > 0 && latestDate) {
              nyseShortInterest = Math.round((shortSum / totalSum) * 10000) / 100
              shortInterestIsLive = true
              await upsertSeriesPoint("offexchange_short_pct", latestDate.slice(0, 10), nyseShortInterest)
              const hist = await latestWithPercentile("offexchange_short_pct", 8)
              // High short positioning = fear = panic side (negative score),
              // matching the Citi component's contrarian direction.
              if (hist && hist.pct !== null) shortInterestScore = -(hist.pct - 0.5) * 2
            }
          }
        }
      }
    } catch (e) {
      console.error("[v0] off-exchange short volume fetch failed:", e)
    }

    const spx125DayMA = smaOrThrow(spxPrices, 125, "SPX 125-day MA")
    const spxMomentum = ((currentSpx - spx125DayMA) / spx125DayMA) * 100

    // Margin Debt estimate based on SPX momentum and VIX
    // Strong positive momentum + low VIX = high margin (750-850B)
    // Weak/negative momentum + high VIX = low margin (600-700B)
    // Synthetic PROXY, used only when the real FRED series below is
    // unavailable — overridden by BOGZ1FL663067003Q when it fetches.
    //
    // P6-8, closed 2026-08-13 on the owner's decision to REMOVE rather than
    // buy sources. **"Used only when the real series is unavailable" described
    // the DISPLAY, never the score.** `marginScore` was computed from this
    // formula unconditionally and was never null, so on every request where
    // FRED was quiet the composite took an eighth of its value from
    // `700 + spxMomentum*5 - (vix-15)*3` — an equal-weight vote cast by a
    // formula, indistinguishable in the mean from the seven measured ones.
    // `syntheticComponents` disclosed it, which is a different fact: a reader
    // can accept a labelled proxy as a data point, and in an average it is not
    // one.
    //
    // The value still displays, labelled synthetic. Only the vote is gone.
    let marginDebt = 700 + spxMomentum * 5 - (currentVix - 15) * 3
    marginDebt = Math.max(600, Math.min(850, marginDebt))
    let marginScore: number | null = null
    let marginIsLive = false

    const qqqVolumes = qqqData.indicators.quote[0].volume.filter((v: number) => v !== null && v > 0)
    const diaVolumes = diaData.indicators.quote[0].volume.filter((v: number) => v !== null && v > 0)
    const qqqAvgVol = qqqVolumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20
    const diaAvgVol = diaVolumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20
    const volumeRatio = qqqAvgVol / diaAvgVol
    const volumeScore = Math.max(-1, Math.min(1, normalize(volumeRatio, 0.8, 1.5, 1.0)))

    // Investor Intelligence: a pure, monotonic function of VIX and nothing
    // else. There is no II survey behind it — the name is the whole of its
    // provenance.
    //
    // P6-8: DROPPED FROM THE SCORE, kept as a labelled display value, exactly
    // as `aaiiBullish` below already was. The reason is the same one P6-61 gave
    // for AAII and it applies one step earlier: a component that cannot
    // disagree with VIX is not evidence about the market, it is VIX wearing a
    // survey's name. It sat in an equal-weight mean beside VIX-derived
    // `putCallRatio`, so VIX level carried at least 2/8 of the composite
    // through components that read as independent sentiment sources.
    //
    // What remains VIX-derived and still scores is `vixMomentumScore`, and that is
    // deliberate: it reads the 5-day against the 50-day VIX, so it measures the
    // SHAPE of the curve rather than its level and can genuinely disagree with
    // a level reading. Its NAME is a separate defect — see P7-54.
    const investorIntelligence = Math.max(30, Math.min(70, 100 - ((currentVix - 10) / 40) * 60))

    // `aaiiBullish` is `investorIntelligence * 0.9`, and investorIntelligence is
    // itself a pure function of VIX. It is therefore a scaled copy of a
    // component already in the composite — it cannot disagree with it, at any
    // VIX level, ever. Two names, one number, both entering an equal-weight
    // mean: VIX level carried 2/9 of the composite through components that
    // looked independent, and more than that whenever a FRED series dropped out
    // and the divisor shrank.
    //
    // `syntheticComponents` already told the reader both were proxies. That is a
    // different fact and it did not cover this one — a reader can accept two
    // labelled proxies as two pieces of evidence, which is exactly what they are
    // not. Same defect as P6-54 (stability restating beta) and P6-58 (NYSE
    // highs/lows restating SPY momentum): a derived value is not an input.
    //
    // Kept as a DISPLAY field, dropped from the score.
    //
    // This sentence used to end "the VIX components that remain are
    // investorIntelligence (level) and putCallRatio (5-day vs 50-day term
    // structure), which can and do disagree with each other" — accurate when
    // written and stale two commits later, because P6-8 dropped
    // investorIntelligence from the score as well. **Exactly ONE VIX-derived
    // component still votes: `vixMomentumScore`**, and it votes because "VIX
    // stretched against its own 50-day norm" is a different question from "VIX
    // level", which is what investorIntelligence restated. A comment that
    // enumerates a set is a claim with an expiry date — this one has now been
    // corrected twice in a day, once for membership and once for the name.
    const aaiiBullish = Math.max(25, Math.min(65, investorIntelligence * 0.9))

    // FRED helper: latest value + its percentile within ~5y of history. The
    // percentile IS the normalization — the series scores against its own
    // range, so no hand-picked constants can drift out of scale (P6-14: the
    // old code normalized retail-MMF ~$1.4T against a 5.0–7.0 total-market
    // range, clamping the component to max-euphoria whenever FRED was live).
    const fredApiKey = getApiKey("FRED_API_KEY")
    const fredLatestWithPercentile = async (
      id: string,
      limit: number,
    ): Promise<{ value: number; pct: number } | null> => {
      if (!fredApiKey) return null
      try {
        const r = await fetch(
          `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${fredApiKey}&file_type=json&limit=${limit}&sort_order=desc`,
          { signal: AbortSignal.timeout(8000) },
        )
        if (!r.ok) return null
        const j = await r.json()
        const vals = (j?.observations ?? [])
          .map((o: any) => Number.parseFloat(o.value))
          .filter((v: number) => Number.isFinite(v))
        if (vals.length < 8) return null
        const latest = vals[0]
        const below = vals.filter((v: number) => v < latest).length
        return { value: latest, pct: below / vals.length }
      } catch {
        return null
      }
    }

    // Retail money market funds — Citi's model uses RETAIL MMF (Levkovich
    // component list), so WRMFSL is the right series. High cash on the
    // sidelines = fear, so the score is the inverted percentile.
    // E-7b store-first: percentile computed over the fred-snapshot store when
    // it has depth; live FRED history pull as fallback (store empty/stale).
    const mmf = (await fredPercentileFromStore("WRMFSL")) ?? (await fredLatestWithPercentile("WRMFSL", 260)) // ~5y weekly
    const moneyMarketFunds = mmf ? Math.round((mmf.value / 1000) * 100) / 100 : null
    const mmfIsLive = mmf !== null
    const mmfScore = mmf ? -(mmf.pct - 0.5) * 2 : null

    // Margin debt — real quarterly broker-dealer margin loans from FRED
    // (Z.1 flow of funds, $ millions) instead of the old `700 + momentum*5`
    // synthesis. High leverage percentile = euphoria.
    const marginReal =
      (await fredPercentileFromStore("BOGZ1FL663067003Q")) ?? (await fredLatestWithPercentile("BOGZ1FL663067003Q", 20)) // ~5y quarterly
    if (marginReal) {
      marginDebt = Math.round(marginReal.value / 1000) // $M → $B
      marginScore = (marginReal.pct - 0.5) * 2
      marginIsLive = true
      console.log("[v0] Real margin debt from FRED Z.1:", marginDebt, "B, pct", marginReal.pct)
    }

    const vix50DayMA = smaOrThrow(vixPrices, 50, "VIX 50-day MA")
    const vixShortTerm = smaOrThrow(vixPrices.slice(-5), 5, "VIX 5-day MA")
    const vixLongTerm = vix50DayMA
    // P7-54, CORRECTED BY P7-56 THE SAME DAY. THIS WAS CALLED `putCallRatio`,
    // AND IT IS NOT ONE — AND THE FIRST RENAME WAS ALSO WRONG.
    //
    // P7-54 renamed it `vixTermRatio` / "VIX Term Structure (5d/50d)". **A term
    // structure compares different MATURITIES.** This compares two LOOKBACKS of
    // the same spot series — a 5-day average of VIX against its 50-day average
    // — which is VIX momentum, not term structure. A more precise false noun is
    // still a false noun, and it is the harder kind to catch because it reads
    // like expertise.
    //
    // The site already HAS a real VIX term structure: `lib/vix-term.ts`
    // computes VIX3M ÷ spot VIX, where **above 1 means contango, i.e. CALM**.
    // This ratio runs the other way: above 1 means the near-term average is
    // elevated against the longer one, i.e. STRESS. Two quantities, one name,
    // opposite directions — and `data-source-status` publishes the concept as
    // "VIX Term Structure (VIX3M ÷ VIX)", the other one. See P7-56.
    //
    // The value is the 5-day VIX over the 50-day VIX: the SHAPE of the
    // volatility curve. That is real measured data and it is scored correctly —
    // it survived P6-8's cull precisely because shape can disagree with level,
    // unlike `investorIntelligence`, which could not disagree with VIX at all.
    //
    // The name was the defect, and the site contradicted itself about it:
    // `/api/market-sentiment` states in its own header that "putCallRatio is
    // absent on purpose: nothing in the codebase sources one", lists it in
    // `NOT_TRACKED` and returns null — while this route scored a number under
    // that name and the tab's tooltip attributed it to "options flow data" and,
    // one panel lower, to the "CBOE equity put/call ratio". Neither exists here.
    //
    // Renamed to what it measures. It also LEAVES `syntheticComponents`: it was
    // listed there as a proxy for a put/call ratio, and a direct reading of the
    // VIX term structure is not a proxy for anything — it is the measurement.
    const vixMomentumRatio = Math.max(0.8, Math.min(1.3, vixShortTerm / vixLongTerm))
    const vixMomentumScore = Math.max(-1, Math.min(1, normalize(vixMomentumRatio, 0.8, 1.3, 1.0))) * -1

    // Real series, not SPX echoes (P6-8). These were `280 + spxMomentum * 2`
    // and `3.2 + spxMomentum * 0.01` — zero independent information, presented
    // as commodity and gas prices while literally re-plotting SPX momentum.
    // Now: FRED PPIACO (producer price index, all commodities) and GASREGW
    // (US regular gas, $/gal), same pattern as the MMF fetch above. When FRED
    // is unavailable they are null and their scores drop out of the composite
    // instead of faking a reading.
    const fredSeries = async (id: string): Promise<number | null> => {
      if (!fredApiKey) return null
      try {
        const r = await fetch(
          `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${fredApiKey}&file_type=json&limit=1&sort_order=desc`,
          { signal: AbortSignal.timeout(8000) },
        )
        if (!r.ok) return null
        const j = await r.json()
        const v = Number.parseFloat(j?.observations?.[0]?.value)
        return Number.isFinite(v) ? v : null
      } catch {
        return null
      }
    }
    const [commodityStore, gasStore] = await Promise.all([
      fredLatestFromStore("PPIACO"),
      fredLatestFromStore("GASREGW"),
    ])
    const commodityPrices = commodityStore?.value ?? (await fredSeries("PPIACO"))
    const gasPrices = gasStore?.value ?? (await fredSeries("GASREGW"))
    const commodityScore =
      commodityPrices !== null ? Math.max(-1, Math.min(1, normalize(commodityPrices, 250, 320, 280))) : null
    const gasScore = gasPrices !== null ? Math.max(-1, Math.min(1, normalize(gasPrices, 2.5, 4.5, 3.25))) * -1 : null

    // Composite over the components that actually have a value — a null
    // (unavailable FRED series) drops out instead of entering as a fake
    // neutral. Divisor = count actually scored.
    // P6-8: `iiScore` is gone from this list, not set to null — Investor
    // Intelligence is a pure function of VIX and never had a source to lose.
    // `marginScore` remains, but is now null unless FRED answered.
    const componentScores = [
      shortInterestScore,
      marginScore,
      volumeScore,
      mmfScore,
      vixMomentumScore,
      commodityScore,
      gasScore,
    ].filter((s): s is number => s !== null)
    const overallScore = componentScores.reduce((a, b) => a + b, 0) / componentScores.length

    const clampedScore = Math.max(-1, Math.min(1, overallScore))

    console.log("[v0] Component scores:", {
      shortInterestScore,
      marginScore,
      volumeScore,
      mmfScore,
      vixMomentumScore,
      commodityScore,
      gasScore,
      overallScore: clampedScore,
    })

    let level = "Neutral"
    if (clampedScore <= -0.45) level = "Extreme Panic"
    else if (clampedScore <= -0.17 && aboveMA) level = "Panic (Above 200-Week MA)"
    else if (clampedScore <= -0.17 && !aboveMA) level = "Panic (Below 200-Week MA)"
    else if (clampedScore < 0) level = "Moderate"
    else if (clampedScore < 0.41) level = "Neutral"
    else level = "Euphoria"

    const yesterdayVix = vixPrices[vixPrices.length - 2] || currentVix
    const weekAgoVix = vixPrices[Math.max(0, vixPrices.length - 6)] || currentVix
    const monthAgoVix = vixPrices[Math.max(0, vixPrices.length - 25)] || currentVix

    const vixChangeYesterday = (currentVix - yesterdayVix) / yesterdayVix
    const vixChangeWeek = (currentVix - weekAgoVix) / weekAgoVix
    const vixChangeMonth = (currentVix - monthAgoVix) / monthAgoVix

    const yesterdayChange = -vixChangeYesterday * 0.1
    const weekChange = -vixChangeWeek * 0.1
    const monthChange = -vixChangeMonth * 0.1

    return {
      overallScore: Math.round(clampedScore * 1000) / 1000,
      level,
      // `x > x - d` is just `d > 0`: the trend is the sign of yesterday's move.
      // (Also clears a baseline TS1355 — `as const` on a ternary is invalid.)
      trend: (yesterdayChange > 0 ? "up" : yesterdayChange < 0 ? "down" : "neutral") as "up" | "down" | "neutral",
      yesterdayChange: Math.round(yesterdayChange * 1000) / 1000,
      lastWeekChange: Math.round(weekChange * 1000) / 1000,
      lastMonthChange: Math.round(monthChange * 1000) / 1000,
      spx: Math.round(currentSpx * 100) / 100,
      spx200WeekMA: Math.round(spx200WeekMA * 100) / 100,
      aboveMA,
      // Citi's Panic/Euphoria is proprietary and has no API. This is the last
      // PUBLISHED reading, entered manually — the date travels with it so the
      // UI can show its age instead of implying freshness. Update both together
      // when Citi publishes a new one (P6-8).
      latestCitiReading: 0.72,
      latestCitiDate: "Nov 7, 2025",
      ytdAverage: 0.44,
      nyseShortInterest: nyseShortInterest !== null ? Math.round(nyseShortInterest * 10) / 10 : null,
      marginDebt: Math.round(marginDebt),
      volumeRatio: Math.round(volumeRatio * 100) / 100,
      investorIntelligence: Math.round(investorIntelligence),
      aaiiBullish: Math.round(aaiiBullish),
      moneyMarketFunds,
      vixMomentumRatio: Math.round(vixMomentumRatio * 100) / 100,
      commodityPrices: commodityPrices !== null ? Math.round(commodityPrices * 10) / 10 : null,
      gasPrices: gasPrices !== null ? Math.round(gasPrices * 100) / 100 : null,
      // Which components are synthetic proxies (derived from SPX/VIX or AI
      // estimates) rather than measured series. Margin debt and MMF leave the
      // list when their FRED series fetched (P6-8/P6-14).
      syntheticComponents: [
        ...(shortInterestIsLive ? [] : ["nyseShortInterest"]),
        // Both are DISPLAY-ONLY: listed as synthetic, neither casts a vote in
        // the composite (P6-61 for aaiiBullish, P6-8 for investorIntelligence).
        // `putCallRatio` used to sit here too; P7-54 renamed it to
        // `vixMomentumRatio` (via P7-56) and took it OUT, because a direct reading of the VIX
        // term structure is not a proxy for anything.
        "investorIntelligence",
        "aaiiBullish",
        ...(marginIsLive ? [] : ["marginDebt"]),
        ...(mmfIsLive ? [] : ["moneyMarketFunds"]),
      ],
      // Server-computed scores for components whose scale changed to
      // percentile-of-history — the client bar must not recompute these with
      // the old hardcoded ranges (P6-14).
      componentScores: {
        moneyMarketFunds: mmfScore !== null ? Math.round(mmfScore * 100) / 100 : null,
        marginDebt: marginScore !== null ? Math.round(marginScore * 100) / 100 : null,
        shortInterest: shortInterestScore !== null ? Math.round(shortInterestScore * 100) / 100 : null,
      },
    }
  } catch (error) {
    console.error("[v0] Error calculating Panic/Euphoria:", error)
    throw error
  }
}

export async function GET() {
  try {
    const data = await calculatePanicEuphoria()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Error in Panic/Euphoria API:", error)
    return NextResponse.json({ error: "Failed to fetch Panic/Euphoria data" }, { status: 500 })
  }
}
