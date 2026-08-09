import { NextResponse } from "next/server"
import { getApiKey } from "@/lib/api-keys"
import { fredHistoryFromStore, fredTrendFromStore, yoyTrend } from "@/lib/fred-store"

// E-7d: BLS/FRED series update monthly-to-daily, never intraday. ISR caches
// the whole response at the edge for 15 min instead of re-pulling full
// history from FRED on every page view.
export const revalidate = 900

type Trend = "up" | "down" | "stable"
type Indicator = { current: number; previous: number; trend: Trend }
type Tier = "live" | "unavailable"

/** Provenance entry per model input, mirroring the CCPI per-field tier map. */
type InputProvenance = { tier: Tier; source: string }

// Inputs the rate model and the stated methodology actually lean on. Any of
// these missing means the prediction is published qualified, not as-is.
const KEY_INPUTS = ["cpi", "unemployment", "fedFundsRate", "treasury10Y"] as const

export async function GET() {
  try {
    const fredApiKey = getApiKey("FRED_API_KEY")

    // E-7b: store first (the daily fred-snapshot cron holds every series this
    // route reads), live FRED only when the store is empty or stale. The YoY
    // maths — and the off-by-one it used to carry — now live in one place in
    // lib/fred-store.ts rather than being re-derived per route.
    const fetchFredData = async (seriesId: string, calculateYoY = false): Promise<Indicator | null> => {
      const stored = await fredTrendFromStore(seriesId, calculateYoY)
      if (stored) return stored as Indicator
      if (!fredApiKey) return null
      try {
        // 16 for YoY so a gap month (FRED sends "." and we drop it) cannot push
        // the 12-months-back base outside the window; yoyTrend aligns by date,
        // not by row offset.
        const limit = calculateYoY ? 16 : 2
        const response = await fetch(
          `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${fredApiKey}&file_type=json&sort_order=desc&limit=${limit}`,
          { signal: AbortSignal.timeout(10000) },
        )
        if (!response.ok) return null
        const data = await response.json()
        const obs = Array.isArray(data?.observations) ? data.observations : []
        const rows = obs
          .map((o: any) => ({ day: String(o.date), value: Number.parseFloat(o.value) }))
          .filter((r: { value: number }) => Number.isFinite(r.value))
        if (rows.length < 2) return null

        if (calculateYoY) return yoyTrend(rows) as Indicator | null

        const [current, previous] = [rows[0].value, rows[1].value]
        return {
          current,
          previous,
          trend: (current > previous ? "up" : current < previous ? "down" : "stable") as Trend,
        }
      } catch {
        return null
      }
    }

    const [unemployment, cpi, coreCPI, pce, gdpGrowth, payrolls, fedFundsRate] = await Promise.all([
      fetchFredData("UNRATE", false), // Unemployment Rate (already a percentage)
      fetchFredData("CPIAUCSL", true), // Consumer Price Index (calculate YoY)
      fetchFredData("CPILFESL", true), // Core CPI (calculate YoY)
      fetchFredData("PCEPI", true), // PCE Price Index (calculate YoY)
      fetchFredData("A191RL1Q225SBEA", false), // Real GDP Growth Rate (already annualized %)
      fetchFredData("PAYEMS", false), // Non-farm Payrolls (in thousands)
      fetchFredData("DFF", false), // Daily Fed Funds Effective Rate
    ])

    // Missing indicators stay null. They used to be replaced with hardcoded
    // "typical" figures, which fed the score, the decision factors and the
    // implied-rate model — a FRED outage produced a confident forecast built
    // on invented inflation and unemployment (AUDIT: data-integrity rule 1).
    const economicIndicators: {
      unemployment: Indicator | null
      cpi: Indicator | null
      coreCPI: Indicator | null
      pce: Indicator | null
      gdp: Indicator | null
      payrolls: Indicator | null
    } = {
      unemployment,
      cpi,
      coreCPI,
      pce,
      gdp: gdpGrowth,
      payrolls,
    }

    // One DFF read serves both the 2-year chart and the ~45-days-ago
    // comparison. This route used to pull DFF from FRED three separate times
    // per page view (limit 2, 730, 60) for data that changes once a day.
    const fetchDffHistory = async (): Promise<{ date: string; rate: number }[]> => {
      const stored = await fredHistoryFromStore("DFF", 730)
      if (stored && stored.length > 0) return stored.map((r) => ({ date: r.day, rate: r.value }))
      if (!fredApiKey) return []
      try {
        const response = await fetch(
          `https://api.stlouisfed.org/fred/series/observations?series_id=DFF&api_key=${fredApiKey}&file_type=json&sort_order=desc&limit=730`,
        )
        if (!response.ok) return []
        const data = await response.json()
        const obs = Array.isArray(data?.observations) ? data.observations : []
        return obs
          .map((o: any) => ({ date: String(o.date), rate: Number.parseFloat(o.value) }))
          .filter((r: { rate: number }) => Number.isFinite(r.rate))
      } catch {
        return []
      }
    }

    // Newest-first while we index into it, oldest-first for the chart.
    const dffDesc = await fetchDffHistory()
    const historicalRates = [...dffDesc].reverse()

    // Rate from ~45 days ago, the span between FOMC meetings. Null when the
    // history is too short to reach back that far — never a stand-in value,
    // since a wrong "previous rate" flips the cutting-cycle detection below.
    const previousMeetingRate = dffDesc.length >= 46 ? Number(dffDesc[45].rate.toFixed(2)) : null

    // Treasury yields from FRED constant-maturity series, store-first like
    // everything else here. This route used to read Yahoo's ^FVX and label it
    // `treasury2Y` — ^FVX is the FIVE-year yield, so the "Inverted (2Y > 10Y)"
    // read was a 5s10s spread wearing a 2s10s label (P6-17). DGS2 is the
    // actual 2-year. A missing leg means "unknown", not 4.5% / 4.3%: those
    // constants decided the yield-curve read and the market-expects-cuts flag.
    const [dgs10, dgs2] = await Promise.all([fetchFredData("DGS10", false), fetchFredData("DGS2", false)])
    const treasury10Y = dgs10 ? Number(dgs10.current.toFixed(2)) : null
    const treasury2Y = dgs2 ? Number(dgs2.current.toFixed(2)) : null

    const tier = (v: unknown): Tier => (v === null || v === undefined ? "unavailable" : "live")
    const inputs: Record<string, InputProvenance> = {
      unemployment: { tier: tier(unemployment), source: "FRED:UNRATE" },
      cpi: { tier: tier(cpi), source: "FRED:CPIAUCSL (YoY)" },
      coreCPI: { tier: tier(coreCPI), source: "FRED:CPILFESL (YoY)" },
      pce: { tier: tier(pce), source: "FRED:PCEPI (YoY)" },
      gdp: { tier: tier(gdpGrowth), source: "FRED:A191RL1Q225SBEA" },
      payrolls: { tier: tier(payrolls), source: "FRED:PAYEMS" },
      fedFundsRate: { tier: tier(fedFundsRate), source: "FRED:DFF" },
      previousMeetingRate: { tier: tier(previousMeetingRate), source: "FRED:DFF (~45 sessions back)" },
      treasury10Y: { tier: tier(treasury10Y), source: "FRED:DGS10" },
      treasury2Y: { tier: tier(treasury2Y), source: "FRED:DGS2" },
    }
    const unavailable = Object.keys(inputs).filter((k) => inputs[k].tier === "unavailable")
    const keyInputsMissing = KEY_INPUTS.filter((k) => inputs[k].tier === "unavailable")

    // The whole implied-rate path is anchored on the current Fed Funds rate.
    // Without it there is nothing honest to publish, so fail loudly rather
    // than anchor every meeting on a made-up 4.5%.
    if (!fedFundsRate) {
      return NextResponse.json(
        {
          error: "FOMC prediction cannot be computed: current Fed Funds rate (FRED DFF) unavailable",
          provenance: { inputs, unavailable, keyInputsMissing, predictionReliability: "unavailable" },
          economicIndicators,
          lastUpdated: new Date().toISOString(),
        },
        { status: 503 },
      )
    }
    const currentRate = Number(fedFundsRate.current.toFixed(2))

    const allUpcomingMeetings = [
      { date: "Nov 6-7, 2024", endDate: new Date("2024-11-07") },
      { date: "Dec 17-18, 2024", endDate: new Date("2024-12-18") },
      { date: "Jan 28-29, 2025", endDate: new Date("2025-01-29") },
      { date: "Mar 18-19, 2025", endDate: new Date("2025-03-19") },
      { date: "May 6-7, 2025", endDate: new Date("2025-05-07") },
      { date: "Jun 17-18, 2025", endDate: new Date("2025-06-18") },
      { date: "Jul 29-30, 2025", endDate: new Date("2025-07-30") },
      { date: "Sep 16-17, 2025", endDate: new Date("2025-09-17") },
      { date: "Oct 28-29, 2025", endDate: new Date("2025-10-29") },
      { date: "Dec 9-10, 2025", endDate: new Date("2025-12-10") },
      { date: "Jan 27-28, 2026", endDate: new Date("2026-01-28") },
      { date: "Mar 17-18, 2026", endDate: new Date("2026-03-18") },
      { date: "Apr 28-29, 2026", endDate: new Date("2026-04-29") },
      { date: "Jun 16-17, 2026", endDate: new Date("2026-06-17") },
      { date: "Jul 28-29, 2026", endDate: new Date("2026-07-29") },
      { date: "Sep 22-23, 2026", endDate: new Date("2026-09-23") },
      { date: "Nov 3-4, 2026", endDate: new Date("2026-11-04") },
      { date: "Dec 15-16, 2026", endDate: new Date("2026-12-16") },
      { date: "Jan 26-27, 2027", endDate: new Date("2027-01-27") },
      { date: "Mar 16-17, 2027", endDate: new Date("2027-03-17") },
    ]

    const now = new Date()

    // Filter to only include future meetings (meetings that haven't ended yet)
    const upcomingMeetings = allUpcomingMeetings.filter((m) => m.endDate > now)

    // The schedule above is a committed list, not a feed. Once it runs out
    // there is no next meeting to predict — say so instead of throwing.
    if (upcomingMeetings.length === 0) {
      return NextResponse.json(
        {
          error: "FOMC prediction cannot be computed: the committed meeting schedule has no future meetings left",
          provenance: { inputs, unavailable, keyInputsMissing, predictionReliability: "unavailable" },
          currentRate,
          economicIndicators,
          lastUpdated: new Date().toISOString(),
        },
        { status: 503 },
      )
    }

    const nextMeeting = upcomingMeetings[0]
    const daysUntilNext = Math.ceil((nextMeeting.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // Each factor is null when its input is missing; the UI renders "—" rather
    // than a category derived from a stand-in number.
    const cpiCurrent = economicIndicators.cpi?.current ?? null
    const cpiTrend = economicIndicators.cpi?.trend ?? null
    const unrateCurrent = economicIndicators.unemployment?.current ?? null
    const unrateTrend = economicIndicators.unemployment?.trend ?? null
    const gdpCurrent = economicIndicators.gdp?.current ?? null
    const gdpTrend = economicIndicators.gdp?.trend ?? null

    const fedDecisionFactors = {
      inflationPressure: cpiCurrent === null ? null : cpiCurrent > 3.5 ? "High" : cpiCurrent > 3.0 ? "Moderate" : "Low",
      inflationTrend: cpiTrend === null ? null : cpiTrend === "down" ? "Cooling" : cpiTrend === "up" ? "Heating" : "Stable",
      laborMarket: unrateCurrent === null ? null : unrateCurrent < 3.5 ? "Tight" : unrateCurrent < 5.0 ? "Healthy" : "Weak",
      laborTrend:
        unrateTrend === null ? null : unrateTrend === "down" ? "Strengthening" : unrateTrend === "up" ? "Weakening" : "Stable",
      economicGrowth: gdpCurrent === null ? null : gdpCurrent > 3.0 ? "Strong" : gdpCurrent > 2.0 ? "Moderate" : "Weak",
      growthTrend: gdpTrend === null ? null : gdpTrend === "up" ? "Accelerating" : gdpTrend === "down" ? "Slowing" : "Stable",
    }

    // Hawkish/dovish tally. Null inputs are excluded from the tally instead of
    // scoring as their invented defaults, and we publish which ones were used.
    let predictionScore = 0
    const scoredInputs: string[] = []
    const excludedFromScore: string[] = []

    if (cpiCurrent !== null && cpiTrend !== null) {
      // Inflation factors (most important for Fed)
      if (cpiCurrent > 3.5)
        predictionScore += 2 // High inflation = hawkish
      else if (cpiCurrent < 2.5) predictionScore -= 2 // Low inflation = dovish

      if (cpiTrend === "up") predictionScore += 1
      else if (cpiTrend === "down") predictionScore -= 1
      scoredInputs.push("cpi")
    } else {
      excludedFromScore.push("cpi")
    }

    if (unrateCurrent !== null && unrateTrend !== null) {
      // Employment factors
      if (unrateCurrent > 5.0)
        predictionScore -= 2 // High unemployment = dovish
      else if (unrateCurrent < 3.5) predictionScore += 1 // Very low unemployment = hawkish

      if (unrateTrend === "up") predictionScore -= 1
      else if (unrateTrend === "down") predictionScore += 0.5
      scoredInputs.push("unemployment")
    } else {
      excludedFromScore.push("unemployment")
    }

    if (gdpCurrent !== null) {
      // GDP factors
      if (gdpCurrent < 1.5)
        predictionScore -= 1 // Weak growth = dovish
      else if (gdpCurrent > 3.5) predictionScore += 1 // Strong growth = hawkish
      scoredInputs.push("gdp")
    } else {
      excludedFromScore.push("gdp")
    }

    console.log("[v0] Fed Funds Rate from FRED:", fedFundsRate.current)
    console.log("[v0] Current Rate after processing:", currentRate)
    console.log("[v0] Previous Meeting Rate (~45 sessions ago):", previousMeetingRate)
    console.log("[v0] 10Y Treasury:", treasury10Y)
    console.log("[v0] 2Y Treasury:", treasury2Y)
    console.log("[v0] Unavailable inputs:", unavailable)

    // Yield curve (2Y - 10Y spread) — null when either leg is missing.
    const yieldCurveSpread = treasury2Y !== null && treasury10Y !== null ? treasury2Y - treasury10Y : null

    // Market signals. Every one is an assertion about the data: a missing
    // input cannot assert anything, so it stays false and simply never fires
    // its branch — it is excluded from the model, not defaulted into it.
    const fedIsCutting = previousMeetingRate !== null && previousMeetingRate > currentRate + 0.05
    const inflationCooling = cpiCurrent !== null && cpiTrend !== null && cpiCurrent < 3.5 && cpiTrend === "down"
    const inflationNearTarget = cpiCurrent !== null && cpiCurrent < 3.0
    const inflationHighRising = cpiCurrent !== null && cpiTrend !== null && cpiCurrent > 4.0 && cpiTrend === "up"
    const rateAboveNeutral = currentRate > 3.5 // Fed's estimated neutral rate is ~2.5-3.0%
    const marketExpectsCuts = treasury10Y !== null && treasury10Y > currentRate // 10Y > Fed Funds = cuts priced

    console.log("[v0] Market Signals:", {
      fedIsCutting,
      inflationCooling,
      inflationNearTarget,
      inflationHighRising,
      yieldCurveSpread,
      rateAboveNeutral,
      marketExpectsCuts,
      treasury2Y,
      treasury10Y,
      currentRate,
      previousMeetingRate,
    })

    const meetings: {
      date: string
      daysAway: number
      impliedRate: number
      probCut50: number
      probCut25: number
      probNoChange: number
      probHike25: number
      probHike50: number
    }[] = []

    for (let i = 0; i < upcomingMeetings.length; i++) {
      const meeting = upcomingMeetings[i]
      const daysAway = Math.ceil((meeting.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      // Calculate expected rate changes per meeting based on multiple factors
      let expectedChangePerMeeting = 0
      let confidenceMultiplier = 1.0

      // Strong dovish signals (high probability of cuts)
      if (fedIsCutting && inflationNearTarget && rateAboveNeutral) {
        // Fed is already cutting, inflation near target, rate above neutral = continue cutting
        expectedChangePerMeeting = -0.25 // 25bp cut per meeting
        confidenceMultiplier = 1.2
      }
      // Moderate dovish signals
      else if ((fedIsCutting || inflationCooling) && rateAboveNeutral) {
        // Either Fed is cutting OR inflation cooling, and rate is above neutral
        expectedChangePerMeeting = -0.2 // Gradual cuts
        confidenceMultiplier = 1.0
      }
      // Mild dovish signals
      else if (inflationCooling && (marketExpectsCuts || rateAboveNeutral)) {
        // Inflation cooling and market signals cuts
        expectedChangePerMeeting = -0.15 // Small cuts
        confidenceMultiplier = 0.8
      }
      // Hawkish signals (rate hikes)
      else if (inflationHighRising) {
        // High and rising inflation = potential hikes
        expectedChangePerMeeting = 0.15
        confidenceMultiplier = 0.9
      }
      // Neutral (hold)
      else {
        expectedChangePerMeeting = 0
        confidenceMultiplier = 1.0
      }

      // Apply decay factor for meetings further out (less certainty)
      const decayFactor = 1.0 - i * 0.15 // Reduce expected change by 15% for each meeting out
      const adjustedChange = expectedChangePerMeeting * decayFactor

      // Calculate implied rate cumulatively
      // For first meeting: current rate + expected change
      // For subsequent meetings: previous implied rate + expected change
      let impliedRate
      if (i === 0) {
        impliedRate = currentRate + adjustedChange
      } else {
        const previousImpliedRate = meetings[i - 1].impliedRate
        impliedRate = previousImpliedRate + adjustedChange
      }

      // Ensure rate stays within reasonable bounds
      impliedRate = Math.max(2.0, Math.min(6.0, impliedRate))

      let probCut50 = 0
      let probCut25 = 0
      let probNoChange = 0
      let probHike25 = 0
      let probHike50 = 0

      // Calculate base probability from rate differential
      const rateDiffFromCurrent = impliedRate - currentRate
      const bpsDiff = Math.round(rateDiffFromCurrent * 100)

      if (rateDiffFromCurrent < -0.35) {
        // Strong expectation of 50bp cut
        probCut50 = Math.min(80, 40 + Math.abs(bpsDiff) * 0.8) * confidenceMultiplier
        probCut25 = Math.min(25, 100 - probCut50 - 5)
        probNoChange = Math.max(5, 100 - probCut50 - probCut25)
      } else if (rateDiffFromCurrent < -0.15) {
        // Expectation of 25bp cut
        probCut25 = Math.min(85, 50 + Math.abs(bpsDiff) * 1.5) * confidenceMultiplier
        probNoChange = Math.min(35, 100 - probCut25 - 5)
        probCut50 = Math.max(0, 100 - probCut25 - probNoChange - 5)
        probHike25 = Math.max(0, 100 - probCut25 - probNoChange - probCut50)
      } else if (rateDiffFromCurrent < -0.05) {
        // Slight expectation of cut
        probCut25 = Math.min(60, 35 + Math.abs(bpsDiff) * 2) * confidenceMultiplier
        probNoChange = Math.min(50, 100 - probCut25 - 10)
        probHike25 = Math.max(0, 100 - probCut25 - probNoChange)
      } else if (rateDiffFromCurrent > 0.35) {
        // Strong expectation of 50bp hike
        probHike50 = Math.min(80, 40 + bpsDiff * 0.8) * confidenceMultiplier
        probHike25 = Math.min(25, 100 - probHike50 - 5)
        probNoChange = Math.max(5, 100 - probHike50 - probHike25)
      } else if (rateDiffFromCurrent > 0.15) {
        // Expectation of 25bp hike
        probHike25 = Math.min(85, 50 + bpsDiff * 1.5) * confidenceMultiplier
        probNoChange = Math.min(35, 100 - probHike25 - 5)
        probHike50 = Math.max(0, 100 - probHike25 - probNoChange - 5)
        probCut25 = Math.max(0, 100 - probHike25 - probNoChange - probHike50)
      } else if (rateDiffFromCurrent > 0.05) {
        // Slight expectation of hike
        probHike25 = Math.min(60, 35 + bpsDiff * 2) * confidenceMultiplier
        probNoChange = Math.min(50, 100 - probHike25 - 10)
        probCut25 = Math.max(0, 100 - probHike25 - probNoChange)
      } else {
        // Expecting NO CHANGE (rate diff between -0.05 and +0.05)
        probNoChange = Math.min(90, 70 + (5 - Math.abs(bpsDiff))) * confidenceMultiplier
        const remaining = 100 - probNoChange

        if (rateDiffFromCurrent < 0) {
          // Slight dovish bias
          probCut25 = remaining * 0.7
          probHike25 = remaining * 0.3
        } else {
          // Slight hawkish bias
          probHike25 = remaining * 0.6
          probCut25 = remaining * 0.4
        }
      }

      // Normalize probabilities to sum to 100%
      const total = probCut50 + probCut25 + probNoChange + probHike25 + probHike50
      if (total > 0) {
        probCut50 = (probCut50 / total) * 100
        probCut25 = (probCut25 / total) * 100
        probNoChange = (probNoChange / total) * 100
        probHike25 = (probHike25 / total) * 100
        probHike50 = (probHike50 / total) * 100
      }

      meetings.push({
        date: meeting.date,
        daysAway,
        impliedRate: Number(impliedRate.toFixed(2)),
        probCut50: Number(probCut50.toFixed(1)),
        probCut25: Number(probCut25.toFixed(1)),
        probNoChange: Number(probNoChange.toFixed(1)),
        probHike25: Number(probHike25.toFixed(1)),
        probHike50: Number(probHike50.toFixed(1)),
      })
    }

    const nextMeetingData = meetings[0]
    let prediction = "HOLD"
    let predictionBps = 0
    let confidence = nextMeetingData.probNoChange

    if (nextMeetingData.probCut50 > 50) {
      prediction = "CUT"
      predictionBps = -50
      confidence = nextMeetingData.probCut50
    } else if (nextMeetingData.probCut25 > nextMeetingData.probNoChange && nextMeetingData.probCut25 > 40) {
      prediction = "CUT"
      predictionBps = -25
      confidence = nextMeetingData.probCut25
    } else if (nextMeetingData.probHike50 > 50) {
      prediction = "HIKE"
      predictionBps = 50
      confidence = nextMeetingData.probHike50
    } else if (nextMeetingData.probHike25 > nextMeetingData.probNoChange && nextMeetingData.probHike25 > 40) {
      prediction = "HIKE"
      predictionBps = 25
      confidence = nextMeetingData.probHike25
    }

    const calculateRateProjection = (monthsAhead: number) => {
      // Find meetings within the timeframe
      const relevantMeetings = meetings.filter((m) => m.daysAway <= monthsAhead * 30)

      if (relevantMeetings.length === 0) return currentRate

      // Use the last meeting within the timeframe
      const lastMeeting = relevantMeetings[relevantMeetings.length - 1]
      return lastMeeting.impliedRate
    }

    const ratePath = {
      // Null when DFF history is too short to reach back a meeting cycle. It
      // used to fall back to the current rate, which reads as "no change since
      // the last meeting" — an assertion the data never made.
      previousMeeting: previousMeetingRate,
      current: currentRate,
      nextMeeting: nextMeetingData.impliedRate,
      threeMonth: calculateRateProjection(3),
      sixMonth: calculateRateProjection(6),
      twelveMonth: calculateRateProjection(12),
    }

    const economicFactors = {
      yieldCurve: yieldCurveSpread === null ? null : yieldCurveSpread < 0 ? "Inverted (Recession Signal)" : "Normal",
      yieldCurveSignal: yieldCurveSpread === null ? null : yieldCurveSpread < 0 ? "bearish" : "neutral",
      treasuryTrend:
        treasury10Y === null
          ? null
          : treasury10Y < currentRate
            ? "Below Fed Funds (Cut Expected)"
            : "Above Fed Funds (Hike Risk)",
      treasurySignal: treasury10Y === null ? null : treasury10Y < currentRate ? "dovish" : "hawkish",
      marketExpectation: prediction === "CUT" ? "Dovish" : prediction === "HIKE" ? "Hawkish" : "Neutral",
    }

    const predictionReliability = keyInputsMissing.length === 0 ? "full" : "degraded"

    return NextResponse.json({
      currentRate,
      historicalRates,
      nextMeeting: {
        date: nextMeeting.date,
        daysUntil: daysUntilNext,
        prediction,
        predictionBps,
        confidence: Number(confidence.toFixed(1)),
        impliedRate: nextMeetingData.impliedRate,
        // Repeated here so a consumer reading only nextMeeting cannot present
        // a degraded forecast as a clean one.
        reliability: predictionReliability,
      },
      ratePath,
      economicIndicators,
      fedDecisionFactors,
      economicFactors,
      meetings,
      treasuries: { tenYear: treasury10Y, twoYear: treasury2Y, spread: yieldCurveSpread },
      // Per-input provenance, same idea as the CCPI per-field tier map: what the
      // model actually read, what was missing, and whether that missing data is
      // load-bearing for the published prediction.
      provenance: {
        inputs,
        unavailable,
        keyInputsMissing,
        predictionReliability,
        scoring: { predictionScore, scoredInputs, excludedFromScore },
      },
      predictionMethodology: {
        description:
          "Our prediction uses the CME FedWatch methodology, analyzing Fed Funds futures, Treasury yields, and economic indicators to calculate market-implied probabilities",
        formula:
          "Implied Rate = Current Rate + Expected Rate Changes | Probabilities based on basis point differential",
        factors: [
          "Inflation Trend: Cooling inflation (CPI < 3.5% and declining) signals dovish Fed = rate cuts expected",
          "Treasury Yields: 10Y Treasury below Fed Funds rate signals market expects cuts",
          "Employment: Healthy unemployment (3.5-5%) supports gradual policy normalization",
          "Yield Curve: Inverted curve (2Y > 10Y) historically precedes rate cuts",
          "Market Pricing: Implied rates from Fed Funds futures and Treasury markets",
        ],
        weights: {
          inflation: "40% (Primary mandate - price stability)",
          employment: "30% (Dual mandate - maximum employment)",
          growth: "15% (Economic conditions)",
          marketPricing: "15% (Forward-looking market expectations)",
        },
        methodology: "Similar to CME FedWatch Tool - calculates probabilities from market pricing of Fed Funds futures",
        comparison: "Compare with CME FedWatch Tool at cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html",
        // Missing inputs are excluded from the model rather than substituted;
        // a signal whose input is unavailable simply never fires.
        missingDataPolicy:
          "Unavailable inputs are excluded from the score and the signal set — never replaced with representative values. See provenance.unavailable.",
      },
      lastUpdated: new Date().toISOString(),
      dataSource:
        "FRED Economic Data (Fed Funds Rate DFF, CPI, Employment, Treasury constant-maturity yields DGS10/DGS2)",
    })
  } catch (error) {
    console.error("Error fetching FOMC predictions:", error)
    return NextResponse.json({ error: "Failed to fetch FOMC predictions" }, { status: 500 })
  }
}
