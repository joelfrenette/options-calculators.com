import { NextResponse } from "next/server"
import { sma } from "@/lib/indicators"
import { getApiKey } from "@/lib/api-keys"

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

    // NYSE Short Interest estimate based on VIX (inverse correlation)
    // Low VIX = complacent market = low short interest (10-15%)
    // High VIX = fearful market = high short interest (20-30%)
    let nyseShortInterest = 15 + ((currentVix - 15) / 30) * 10
    nyseShortInterest = Math.max(10, Math.min(30, nyseShortInterest))
    console.log("[v0] Calculated NYSE short interest from VIX:", nyseShortInterest)

    // Try AI estimate as backup
    if (currentVix > 30 || currentVix < 12) {
      const aiEstimate = await getAIEstimate(
        "NYSE Short Interest Ratio",
        `Current VIX is ${currentVix.toFixed(2)}, SPX is ${currentSpx.toFixed(2)}. Typical range is 10-30%. High VIX suggests high short interest.`,
      )
      if (aiEstimate > 0 && aiEstimate <= 30) {
        nyseShortInterest = aiEstimate
        console.log("[v0] AI estimated NYSE short interest:", nyseShortInterest)
      }
    }

    const shortInterestScore = Math.max(-1, Math.min(1, normalize(nyseShortInterest, 10, 30, 15))) * -1

    const spx125DayMA = smaOrThrow(spxPrices, 125, "SPX 125-day MA")
    const spxMomentum = ((currentSpx - spx125DayMA) / spx125DayMA) * 100

    // Margin Debt estimate based on SPX momentum and VIX
    // Strong positive momentum + low VIX = high margin (750-850B)
    // Weak/negative momentum + high VIX = low margin (600-700B)
    let marginDebt = 700 + spxMomentum * 5 - (currentVix - 15) * 3
    marginDebt = Math.max(600, Math.min(850, marginDebt))
    console.log("[v0] Calculated margin debt from SPX momentum and VIX:", marginDebt)

    const marginScore = Math.max(-1, Math.min(1, normalize(marginDebt, 600, 850, 700)))

    const qqqVolumes = qqqData.indicators.quote[0].volume.filter((v: number) => v !== null && v > 0)
    const diaVolumes = diaData.indicators.quote[0].volume.filter((v: number) => v !== null && v > 0)
    const qqqAvgVol = qqqVolumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20
    const diaAvgVol = diaVolumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20
    const volumeRatio = qqqAvgVol / diaAvgVol
    const volumeScore = Math.max(-1, Math.min(1, normalize(volumeRatio, 0.8, 1.5, 1.0)))

    const investorIntelligence = Math.max(30, Math.min(70, 100 - ((currentVix - 10) / 40) * 60))
    const iiScore = Math.max(-1, Math.min(1, normalize(investorIntelligence, 30, 70, 50)))

    const aaiiBullish = Math.max(25, Math.min(65, investorIntelligence * 0.9))
    const aaiiScore = Math.max(-1, Math.min(1, normalize(aaiiBullish, 25, 65, 40)))

    let moneyMarketFunds = 6.0 - spxMomentum * 0.02
    let mmfIsLive = false
    let mmfScore = Math.max(-1, Math.min(1, normalize(moneyMarketFunds, 5.0, 7.0, 6.0))) * -1

    const fredApiKey = getApiKey("FRED_API_KEY")
    if (fredApiKey) {
      try {
        const fredResponse = await fetch(
          `https://api.stlouisfed.org/fred/series/observations?series_id=WRMFSL&api_key=${fredApiKey}&file_type=json&limit=1&sort_order=desc`,
        )
        if (fredResponse.ok) {
          const fredData = await fredResponse.json()
          if (fredData.observations && fredData.observations.length > 0) {
            moneyMarketFunds = Number.parseFloat(fredData.observations[0].value) / 1000
            mmfScore = Math.max(-1, Math.min(1, normalize(moneyMarketFunds, 5.0, 7.0, 6.0))) * -1
            mmfIsLive = true
            console.log("[v0] Real MMF from FRED:", moneyMarketFunds)
          }
        }
      } catch (error) {
        console.log("[v0] FRED API error, using calculated estimate:", error)
      }
    }

    const vix50DayMA = smaOrThrow(vixPrices, 50, "VIX 50-day MA")
    const vixShortTerm = smaOrThrow(vixPrices.slice(-5), 5, "VIX 5-day MA")
    const vixLongTerm = vix50DayMA
    const putCallRatio = Math.max(0.8, Math.min(1.3, vixShortTerm / vixLongTerm))
    const pcScore = Math.max(-1, Math.min(1, normalize(putCallRatio, 0.8, 1.3, 1.0))) * -1

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
    const [commodityPrices, gasPrices] = await Promise.all([fredSeries("PPIACO"), fredSeries("GASREGW")])
    const commodityScore =
      commodityPrices !== null ? Math.max(-1, Math.min(1, normalize(commodityPrices, 250, 320, 280))) : null
    const gasScore = gasPrices !== null ? Math.max(-1, Math.min(1, normalize(gasPrices, 2.5, 4.5, 3.25))) * -1 : null

    // Composite over the components that actually have a value — a null
    // (unavailable FRED series) drops out instead of entering as a fake
    // neutral. Divisor = count actually scored.
    const componentScores = [
      shortInterestScore,
      marginScore,
      volumeScore,
      iiScore,
      aaiiScore,
      mmfScore,
      pcScore,
      commodityScore,
      gasScore,
    ].filter((s): s is number => s !== null)
    const overallScore = componentScores.reduce((a, b) => a + b, 0) / componentScores.length

    const clampedScore = Math.max(-1, Math.min(1, overallScore))

    console.log("[v0] Component scores:", {
      shortInterestScore,
      marginScore,
      volumeScore,
      iiScore,
      aaiiScore,
      mmfScore,
      pcScore,
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
      nyseShortInterest: Math.round(nyseShortInterest * 10) / 10,
      marginDebt: Math.round(marginDebt),
      volumeRatio: Math.round(volumeRatio * 100) / 100,
      investorIntelligence: Math.round(investorIntelligence),
      aaiiBullish: Math.round(aaiiBullish),
      moneyMarketFunds: Math.round(moneyMarketFunds * 10) / 10,
      putCallRatio: Math.round(putCallRatio * 100) / 100,
      commodityPrices: commodityPrices !== null ? Math.round(commodityPrices * 10) / 10 : null,
      gasPrices: gasPrices !== null ? Math.round(gasPrices * 100) / 100 : null,
      // Which components are synthetic proxies (derived from SPX/VIX or AI
      // estimates) rather than measured series. The UI badges these (P6-8).
      syntheticComponents: [
        "nyseShortInterest",
        "marginDebt",
        "investorIntelligence",
        "aaiiBullish",
        "putCallRatio",
        ...(moneyMarketFunds !== null && mmfIsLive ? [] : ["moneyMarketFunds"]),
      ],
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
