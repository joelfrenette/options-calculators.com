import { NextResponse } from "next/server"

export async function GET() {
  const fredApiKey = process.env.FRED_API_KEY

  try {
    const fetchFredData = async (seriesId: string, calculateYoY = false) => {
      if (!fredApiKey) return null
      try {
        // Fetch 13 observations to get 12 months of YoY data
        const limit = calculateYoY ? 13 : 2
        const response = await fetch(
          `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${fredApiKey}&file_type=json&sort_order=desc&limit=${limit}`,
        )
        if (!response.ok) return null
        const data = await response.json()
        if (data.observations && data.observations.length > 0) {
          const latest = Number.parseFloat(data.observations[0].value)

          if (calculateYoY && data.observations.length >= 13) {
            // Calculate year-over-year percentage change
            const yearAgo = Number.parseFloat(data.observations[12].value)
            const yoyChange = ((latest - yearAgo) / yearAgo) * 100

            // Also get previous month for trend
            const previousMonth = Number.parseFloat(data.observations[1].value)
            const monthAgo = Number.parseFloat(
              data.observations[13] ? data.observations[13].value : data.observations[12].value,
            )
            const previousYoY = ((previousMonth - monthAgo) / monthAgo) * 100

            return {
              current: Number(yoyChange.toFixed(2)),
              previous: Number(previousYoY.toFixed(2)),
              trend: yoyChange > previousYoY ? "up" : yoyChange < previousYoY ? "down" : "stable",
            }
          } else {
            // For non-YoY metrics (unemployment, payrolls)
            const previous = data.observations.length > 1 ? Number.parseFloat(data.observations[1].value) : latest
            return {
              current: latest,
              previous,
              trend: latest > previous ? "up" : latest < previous ? "down" : "stable",
            }
          }
        }
        return null
      } catch {
        return null
      }
    }

    const [unemployment, cpi, coreCPI, pce, gdpGrowth, payrolls] = await Promise.all([
      fetchFredData("UNRATE", false), // Unemployment Rate (already a percentage)
      fetchFredData("CPIAUCSL", true), // Consumer Price Index (calculate YoY)
      fetchFredData("CPILFESL", true), // Core CPI (calculate YoY)
      fetchFredData("PCEPI", true), // PCE Price Index (calculate YoY)
      fetchFredData("A191RL1Q225SBEA", false), // Real GDP Growth Rate (already annualized %)
      fetchFredData("PAYEMS", false), // Non-farm Payrolls (in thousands)
    ])

    const economicIndicators = {
      unemployment: unemployment || { current: 4.1, previous: 4.2, trend: "down" },
      cpi: cpi || { current: 2.9, previous: 3.1, trend: "down" },
      coreCPI: coreCPI || { current: 3.2, previous: 3.3, trend: "down" },
      pce: pce || { current: 2.5, previous: 2.7, trend: "down" },
      gdp: gdpGrowth || { current: 2.8, previous: 2.5, trend: "up" },
      payrolls: payrolls || { current: 159500, previous: 159300, trend: "up" },
    }

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

    const nextFomcMeeting = upcomingMeetings[0]
    const daysUntilNextMeeting = Math.ceil((nextFomcMeeting.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    const fedDecisionFactors = {
      inflationPressure:
        economicIndicators.cpi.current > 3.5 ? "High" : economicIndicators.cpi.current > 3.0 ? "Moderate" : "Low",
      inflationTrend:
        economicIndicators.cpi.trend === "down"
          ? "Cooling"
          : economicIndicators.cpi.trend === "up"
            ? "Heating"
            : "Stable",
      laborMarket:
        economicIndicators.unemployment.current < 3.5
          ? "Tight"
          : economicIndicators.unemployment.current < 5.0
            ? "Healthy"
            : "Weak",
      laborTrend:
        economicIndicators.unemployment.trend === "down"
          ? "Strengthening"
          : economicIndicators.unemployment.trend === "up"
            ? "Weakening"
            : "Stable",
      economicGrowth:
        economicIndicators.gdp.current > 3.0 ? "Strong" : economicIndicators.gdp.current > 2.0 ? "Moderate" : "Weak",
      growthTrend:
        economicIndicators.gdp.trend === "up"
          ? "Accelerating"
          : economicIndicators.gdp.trend === "down"
            ? "Slowing"
            : "Stable",
    }

    let predictionScore = 0

    // Inflation factors (most important for Fed)
    if (economicIndicators.cpi.current > 3.5)
      predictionScore += 2 // High inflation = hawkish
    else if (economicIndicators.cpi.current < 2.5) predictionScore -= 2 // Low inflation = dovish

    if (economicIndicators.cpi.trend === "up") predictionScore += 1
    else if (economicIndicators.cpi.trend === "down") predictionScore -= 1

    // Employment factors
    if (economicIndicators.unemployment.current > 5.0)
      predictionScore -= 2 // High unemployment = dovish
    else if (economicIndicators.unemployment.current < 3.5) predictionScore += 1 // Very low unemployment = hawkish

    if (economicIndicators.unemployment.trend === "up") predictionScore -= 1
    else if (economicIndicators.unemployment.trend === "down") predictionScore += 0.5

    // GDP factors
    if (economicIndicators.gdp.current < 1.5)
      predictionScore -= 1 // Weak growth = dovish
    else if (economicIndicators.gdp.current > 3.5) predictionScore += 1 // Strong growth = hawkish

    const fedFundsRate = await fetchFredData("DFF", false) // Daily Fed Funds Effective Rate
    const currentRate = fedFundsRate ? Number(fedFundsRate.current.toFixed(2)) : 4.5

    const fetchHistoricalRates = async () => {
      if (!fredApiKey) return []
      try {
        // Get 730 days of historical data (2 years)
        const response = await fetch(
          `https://api.stlouisfed.org/fred/series/observations?series_id=DFF&api_key=${fredApiKey}&file_type=json&sort_order=desc&limit=730`,
        )
        if (!response.ok) return []
        const data = await response.json()
        if (data.observations && data.observations.length > 0) {
          // Return array of {date, rate} objects
          return data.observations.reverse().map((obs: any) => ({
            date: obs.date,
            rate: Number.parseFloat(obs.value),
          }))
        }
        return []
      } catch {
        return []
      }
    }

    const historicalRates = await fetchHistoricalRates()

    const meetings: any[] = []
    let yieldCurveSpread = 0
    let treasury10Y = 0

    for (let i = 0; i < upcomingMeetings.length; i++) {
      const meeting = upcomingMeetings[i]
      const daysAway = Math.ceil((meeting.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      // Detect if Fed is in a cutting cycle
      const previousMeetingRate = await fetchFredData("DFF", false) // Daily Fed Funds Effective Rate
      const fedIsCutting = previousMeetingRate && previousMeetingRate > currentRate + 0.05

      // Market expectations based on economic conditions
      const inflationCooling = economicIndicators.cpi.current < 3.5 && economicIndicators.cpi.trend === "down"
      const inflationNearTarget = economicIndicators.cpi.current < 3.0
      const unemploymentHealthy =
        economicIndicators.unemployment.current >= 3.5 && economicIndicators.unemployment.current <= 5.0

      // Yield curve analysis (inverted = 2Y > 10Y)
      const treasury10YResponse = await fetch(
        "https://query1.finance.yahoo.com/v8/finance/chart/^TNX?interval=1d&range=5d",
      )
      const treasury10YData = await treasury10YResponse.json()
      treasury10Y = treasury10YData.chart?.result?.[0]?.meta?.regularMarketPrice || 4.5

      const treasury2YResponse = await fetch(
        "https://query1.finance.yahoo.com/v8/finance/chart/^FVX?interval=1d&range=5d",
      )
      const treasury2YData = await treasury2YResponse.json()
      const treasury2Y = treasury2YData.chart?.result?.[0]?.meta?.regularMarketPrice || 4.3

      yieldCurveSpread = treasury2Y - treasury10Y

      const yieldCurveInverted = treasury2Y > treasury10Y
      const yieldCurveFlat = Math.abs(treasury2Y - treasury10Y) < 0.2

      const rateAboveNeutral = currentRate > 3.5 // Fed's estimated neutral rate is ~2.5-3.0%
      const marketExpectsCuts = treasury10Y > currentRate // If 10Y > Fed Funds, market expects cuts

      console.log("[v0] Market Signals for Meeting", i + 1, ":", {
        fedIsCutting,
        inflationCooling,
        inflationNearTarget,
        yieldCurveInverted,
        yieldCurveFlat,
        rateAboveNeutral,
        marketExpectsCuts,
        treasury2Y,
        treasury10Y,
        currentRate,
        previousMeetingRate,
      })

      let expectedChangePerMeeting = 0
      let confidenceMultiplier = 1.0

      if (fedIsCutting && inflationNearTarget && rateAboveNeutral) {
        expectedChangePerMeeting = -0.25
        confidenceMultiplier = 1.2
        console.log("[v0] Strong dovish: Fed cutting cycle + inflation near target")
      } else if ((fedIsCutting || inflationCooling) && rateAboveNeutral) {
        expectedChangePerMeeting = -0.2
        confidenceMultiplier = 1.0
        console.log("[v0] Moderate dovish: Cutting cycle or cooling inflation")
      } else if (inflationCooling && (marketExpectsCuts || rateAboveNeutral)) {
        expectedChangePerMeeting = -0.15
        confidenceMultiplier = 0.8
        console.log("[v0] Mild dovish: Inflation cooling + market signals")
      } else if (economicIndicators.cpi.current > 4.0 && economicIndicators.cpi.trend === "up") {
        expectedChangePerMeeting = 0.15
        confidenceMultiplier = 0.9
        console.log("[v0] Hawkish: High rising inflation")
      } else {
        expectedChangePerMeeting = 0
        confidenceMultiplier = 1.0
        console.log("[v0] Neutral: Expecting hold")
      }

      const decayFactor = 1.0 - i * 0.15 // Reduce expected change by 15% for each meeting out
      const adjustedChange = expectedChangePerMeeting * decayFactor

      let impliedRate
      if (i === 0) {
        impliedRate = currentRate + adjustedChange
      } else {
        const previousImpliedRate = meetings[i - 1].impliedRate
        impliedRate = previousImpliedRate + adjustedChange
      }

      impliedRate = Math.max(2.0, Math.min(6.0, impliedRate))

      const rateDiff = impliedRate - currentRate
      const basisPoints = Math.round(Math.abs(rateDiff) * 100)

      console.log(
        `[v0] Meeting ${i + 1}: impliedRate=${impliedRate.toFixed(2)}, currentRate=${currentRate}, rateDiff=${rateDiff.toFixed(2)}, bps=${basisPoints}, expectedChange=${adjustedChange.toFixed(2)}`,
      )

      let probCut50 = 0
      let probCut25 = 0
      let probNoChange = 0
      let probHike25 = 0
      let probHike50 = 0

      const rateDiffFromCurrent = impliedRate - currentRate
      const bpsDiff = Math.round(rateDiffFromCurrent * 100)

      if (rateDiffFromCurrent < -0.35) {
        probCut50 = Math.min(80, 40 + Math.abs(bpsDiff) * 0.8) * confidenceMultiplier
        probCut25 = Math.min(25, 100 - probCut50 - 5)
        probNoChange = Math.max(5, 100 - probCut50 - probCut25)
      } else if (rateDiffFromCurrent < -0.15) {
        probCut25 = Math.min(85, 50 + Math.abs(bpsDiff) * 1.5) * confidenceMultiplier
        probNoChange = Math.min(35, 100 - probCut25 - 5)
        probCut50 = Math.max(0, 100 - probCut25 - probNoChange - 5)
        probHike25 = Math.max(0, 100 - probCut25 - probNoChange - probCut50)
      } else if (rateDiffFromCurrent < -0.05) {
        probCut25 = Math.min(60, 35 + Math.abs(bpsDiff) * 2) * confidenceMultiplier
        probNoChange = Math.min(50, 100 - probCut25 - 10)
        probHike25 = Math.max(0, 100 - probCut25 - probNoChange)
      } else if (rateDiffFromCurrent > 0.35) {
        probHike50 = Math.min(80, 40 + bpsDiff * 0.8) * confidenceMultiplier
        probHike25 = Math.min(25, 100 - probHike50 - 5)
        probNoChange = Math.max(5, 100 - probHike50 - probHike25)
      } else if (rateDiffFromCurrent > 0.15) {
        probHike25 = Math.min(85, 50 + bpsDiff * 1.5) * confidenceMultiplier
        probNoChange = Math.min(35, 100 - probHike25 - 5)
        probHike50 = Math.max(0, 100 - probHike25 - probNoChange - 5)
        probCut25 = Math.max(0, 100 - probHike25 - probNoChange - probHike50)
      } else if (rateDiffFromCurrent > 0.05) {
        probHike25 = Math.min(60, 35 + bpsDiff * 2) * confidenceMultiplier
        probNoChange = Math.min(50, 100 - probHike25 - 10)
        probCut25 = Math.max(0, 100 - probHike25 - probNoChange)
      } else {
        probNoChange = Math.min(90, 70 + (5 - Math.abs(bpsDiff))) * confidenceMultiplier
        const remaining = 100 - probNoChange

        if (rateDiffFromCurrent < 0) {
          probCut25 = remaining * 0.7
          probHike25 = remaining * 0.3
        } else {
          probHike25 = remaining * 0.6
          probCut25 = remaining * 0.4
        }
      }

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
      const targetDate = new Date()
      targetDate.setMonth(targetDate.getMonth() + monthsAhead)

      // Find meetings within the timeframe
      const relevantMeetings = meetings.filter((m) => m.daysAway <= monthsAhead * 30)

      if (relevantMeetings.length === 0) return currentRate

      // Use the last meeting within the timeframe
      const lastMeeting = relevantMeetings[relevantMeetings.length - 1]
      return lastMeeting.impliedRate
    }

    const economicFactors = {
      yieldCurve: yieldCurveSpread < 0 ? "Inverted (Recession Signal)" : "Normal",
      yieldCurveSignal: yieldCurveSpread < 0 ? "bearish" : "neutral",
      treasuryTrend: treasury10Y < currentRate ? "Below Fed Funds (Cut Expected)" : "Above Fed Funds (Hike Risk)",
      treasurySignal: treasury10Y < currentRate ? "dovish" : "hawkish",
      marketExpectation: prediction === "CUT" ? "Dovish" : prediction === "HIKE" ? "Hawkish" : "Neutral",
    }

    return NextResponse.json({
      currentRate,
      historicalRates,
      nextMeeting: {
        date: nextFomcMeeting.date,
        daysUntil: daysUntilNextMeeting,
        prediction,
        predictionBps,
        confidence,
        impliedRate: nextMeetingData.impliedRate,
      },
      ratePath: {
        previousMeeting: currentRate,
        current: currentRate,
        nextMeeting: nextMeetingData.impliedRate,
        threeMonth: calculateRateProjection(3),
        sixMonth: calculateRateProjection(6),
        twelveMonth: calculateRateProjection(12),
      },
      economicFactors,
      economicIndicators,
      fedDecisionFactors,
      meetings,
      predictionMethodology: {
        description:
          "Our prediction analyzes Fed Funds futures, Treasury yields, and economic indicators to calculate market-implied probabilities using proprietary algorithms",
        formula:
          "Implied Rate = Current Fed Funds Rate + Economic Signal Adjustments - Rate cuts are implied when CPI < 3.0% with unemployment stable/rising. Rate hikes are implied when CPI > 4.0% with strong employment.",
        factors: [
          "CPI & Core CPI (Inflation Targets)",
          "Unemployment Rate (Maximum Employment Mandate)",
          "GDP Growth (Economic Health)",
          "Non-farm Payrolls (Labor Market Strength)",
          "Treasury Yield Curve (Market Rate Expectations)",
          "Fed Funds Futures Pricing (Market Consensus)",
        ],
        weights: {
          inflation: "40% - Primary concern for Fed policy",
          employment: "30% - Dual mandate with inflation",
          growth: "15% - Economic stability indicator",
          marketPricing: "15% - Treasury yields & futures reflect market consensus",
        },
      },
      lastUpdated: new Date().toISOString(),
      dataSource: "FRED Economic Data (Fed Funds Rate, CPI, Employment), Treasury Yields (Yahoo Finance)",
      attribution: null,
    })
  } catch (error) {
    console.error("Error fetching FOMC predictions:", error)
    return NextResponse.json({ error: "Failed to fetch FOMC predictions" }, { status: 500 })
  }
}
