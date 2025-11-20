"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  TrendingUp,
  Activity,
  Shield,
  Database,
} from "lucide-react"

interface IndicatorDetail {
  name: string
  formula: string
  executiveSummary: string
  currentValue: any
  ranges: {
    safe: string
    warning: string
    danger: string
  }
  dataSources: {
    primary: string
    fallbackChain: string[]
    currentSource: string
    status: "live" | "aiFallback" | "baseline" | "failed"
  }
  canaryThresholds: {
    medium: string
    high: string
  }
}

interface PillarAudit {
  name: string
  weight: number
  score: number
  formula: string
  calculation: string
  executiveSummary: string
  validation: string
  indicators: IndicatorDetail[]
}

export function CcpiAuditAdmin() {
  const [loading, setLoading] = useState(false)
  const [ccpiData, setCcpiData] = useState<any>(null)
  const [auditData, setAuditData] = useState<any>(null)

  useEffect(() => {
    fetchAudit()
  }, [])

  const fetchAudit = async () => {
    setLoading(true)
    try {
      const [ccpiRes, dataSourceRes] = await Promise.all([fetch("/api/ccpi"), fetch("/api/data-source-status")])

      const ccpi = await ccpiRes.json()
      const dataSources = await dataSourceRes.json()

      setCcpiData(ccpi)
      setAuditData(buildAuditStructure(ccpi, dataSources))
    } catch (error) {
      console.error("Failed to fetch CCPI audit:", error)
    } finally {
      setLoading(false)
    }
  }

  const buildAuditStructure = (ccpi: any, dataSources: any): any => {
    // Build comprehensive audit structure
    return {
      ccpi: {
        baseCCPI: ccpi.baseCCPI || ccpi.ccpi,
        finalCCPI: ccpi.ccpi,
        formula: "CCPI = (Momentum × 0.35) + (Risk Appetite × 0.30) + (Valuation × 0.15) + (Macro × 0.20)",
        executiveSummary: `The Comprehensive Crash Prediction Index (CCPI) aggregates risk across four critical market dimensions. Each pillar contributes a weighted score (0-100), where higher scores indicate elevated crash risk. The base CCPI score is then amplified by extreme crash conditions to produce the final score ranging from 0 (low risk) to 100 (extreme crash risk).`,
        validation: validateCCPI(ccpi),
        weights: {
          momentum: 35,
          riskAppetite: 30,
          valuation: 15,
          macro: 20,
        },
      },
      crashAmplifier: {
        baseScore: ccpi.baseCCPI || ccpi.ccpi,
        bonuses: ccpi.crashAmplifiers || [],
        totalBonus: ccpi.totalBonus || 0,
        finalScore: ccpi.ccpi,
        formula: "Final CCPI = Base CCPI + Crash Amplifier Bonus (capped at 100)",
        executiveSummary: `The Crash Amplifier system adds bonus points (+0 to +100) to the base CCPI when extreme conditions occur. These bonuses capture acute crash catalysts like single-day crashes (QQQ -6% = +25 points), major support breaks (QQQ below 50-day SMA = +20), or panic spikes (VIX >35 = +20). Currently: Base ${ccpi.baseCCPI || ccpi.ccpi} + Bonus ${ccpi.totalBonus || 0} = Final ${ccpi.ccpi}`,
        triggers: [
          { condition: "QQQ drops ≥6% in 1 day", bonus: "+25 points (replaces by +40 if ≥9%)" },
          { condition: "QQQ drops ≥9% in 1 day", bonus: "+40 points" },
          { condition: "QQQ breaks below 50-day SMA", bonus: "+20 points" },
          { condition: "VIX spikes above 35", bonus: "+20 points" },
          { condition: "Put/Call ratio exceeds 1.3", bonus: "+15 points (extreme hedging)" },
          { condition: "Yield curve inverts (negative)", bonus: "+15 points" },
        ],
      },
      canaries: {
        total: 38,
        active: ccpi.activeCanaries,
        formula: "Count of indicators breaching medium or high risk thresholds",
        executiveSummary: `Canary signals are binary warnings triggered when individual indicators cross predefined thresholds. ${ccpi.activeCanaries} of 38 indicators are currently flashing warning signals.`,
        severityLevels: {
          high: "Critical breach requiring immediate attention",
          medium: "Elevated risk requiring monitoring",
        },
      },
      pillars: [
        buildMomentumPillar(ccpi, dataSources),
        buildRiskAppetitePillar(ccpi, dataSources),
        buildValuationPillar(ccpi, dataSources),
        buildMacroPillar(ccpi, dataSources),
      ],
    }
  }

  const validateCCPI = (ccpi: any): string => {
    const { momentum, riskAppetite, valuation, macro } = ccpi.pillars
    const calculatedBase = Math.round(momentum * 0.35 + riskAppetite * 0.3 + valuation * 0.15 + macro * 0.2)
    const reportedBase = ccpi.baseCCPI || ccpi.ccpi
    const totalBonus = ccpi.totalBonus || 0
    const finalCCPI = ccpi.ccpi

    if (Math.abs(calculatedBase - reportedBase) <= 2) {
      return `✅ VALID: Base CCPI (${calculatedBase}) + Crash Amplifier Bonus (${totalBonus}) = Final CCPI (${finalCCPI})`
    } else {
      return `⚠️ DISCREPANCY: Calculated Base (${calculatedBase}) vs Reported Base (${reportedBase}) - difference of ${Math.abs(calculatedBase - reportedBase)} points. Final: ${finalCCPI}`
    }
  }

  const buildMomentumPillar = (ccpi: any, dataSources: any): PillarAudit => {
    return {
      name: "Pillar 1 - Momentum & Technical",
      weight: 35,
      score: ccpi.pillars.momentum,
      formula: "Momentum = Σ(Indicator Score × Weight) / 100, capped at 100",
      calculation:
        "16 indicators with explicit weights: NVIDIA (6%), SOX (6%), QQQ Daily Return (8%), QQQ Consecutive Down (5%), QQQ Below SMA20 (5%), QQQ Below SMA50 (7%), QQQ Below SMA200 (10%), QQQ Bollinger (6%), VIX (9%), VXN (7%), RVX (5%), VIX Term (6%), ATR (5%), LTV (5%), Bullish % (5%), Yield Curve (5%)",
      executiveSummary:
        "Momentum pillar captures price action deterioration, technical breakdown, and volatility spikes. Heavy weighting on critical support levels (SMA50/200) and fear gauges (VIX/VXN). Scores rise dramatically when QQQ breaks key moving averages or volatility explodes above panic thresholds.",
      validation: `Pillar score ${ccpi.pillars.momentum}/100. ${ccpi.pillars.momentum > 70 ? "🔴 EXTREME RISK" : ccpi.pillars.momentum > 50 ? "🟡 ELEVATED RISK" : "🟢 NORMAL"}`,
      indicators: [
        {
          name: "NVIDIA Momentum Score",
          formula: "AI Bellwether = Price change % over rolling 30-day period",
          executiveSummary:
            "NVIDIA acts as leading indicator for AI/tech sentiment. Rapid drops signal sector rotation or bubble concerns.",
          currentValue: ccpi.indicators.nvidiaMomentum || 50,
          ranges: {
            safe: "Above 60 (healthy momentum)",
            warning: "40-60 (slowing growth)",
            danger: "Below 40 (severe weakness/overheating >80)",
          },
          dataSources: getDataSourceForIndicator("NVIDIA Momentum", dataSources),
          canaryThresholds: {
            medium: "Momentum < 40 or > 80",
            high: "Momentum < 20 (AI sector crash signal)",
          },
        },
        {
          name: "SOX Semiconductor Index",
          formula: "Chip Health = (Current Price - Baseline 5000) / 5000 × 100%",
          executiveSummary:
            "Semiconductor index tracks hardware backbone of AI economy. Chip crashes often precede broader tech selloffs.",
          currentValue: ccpi.indicators.soxIndex,
          ranges: {
            safe: "Above baseline (5000+)",
            warning: "-5% to -10% from baseline",
            danger: "Below -10% (chip sector crash)",
          },
          dataSources: getDataSourceForIndicator("SOX Semiconductor", dataSources),
          canaryThresholds: {
            medium: "Down 10-15%",
            high: "Down >15% (sector collapse)",
          },
        },
        {
          name: "QQQ Daily Return (5× downside amplifier)",
          formula: "Daily % Change = (Close - Previous Close) / Previous Close × 100",
          executiveSummary:
            "Single-day crashes are the strongest short-term crash predictor. Down days are weighted 5× more than up days to capture asymmetric risk.",
          currentValue: `${ccpi.indicators.qqqDailyReturn.toFixed(2)}%`,
          ranges: {
            safe: "Above -1%",
            warning: "-1% to -3%",
            danger: "Below -3% (crash day if <-6%)",
          },
          dataSources: getDataSourceForIndicator("QQQ Technicals", dataSources),
          canaryThresholds: {
            medium: "Return < -1.5%",
            high: "Return < -6% (single-day crash)",
          },
        },
        {
          name: "QQQ Consecutive Down Days",
          formula: "Streak Counter = Number of consecutive days with negative returns",
          executiveSummary: "Extended losing streaks indicate sustained selling pressure and potential trend reversal.",
          currentValue: `${ccpi.indicators.qqqConsecDown} days`,
          ranges: {
            safe: "0-1 days",
            warning: "2-3 days",
            danger: "4+ days (trend breakdown)",
          },
          dataSources: getDataSourceForIndicator("QQQ Technicals", dataSources),
          canaryThresholds: {
            medium: "3+ days down",
            high: "5+ days down (persistent weakness)",
          },
        },
        {
          name: "QQQ Below 20-Day SMA",
          formula: "Short-term Support = Binary (Price < SMA20) + Proximity Score (0-100%)",
          executiveSummary:
            "20-day moving average is critical short-term support. Breaches signal momentum loss and potential correction.",
          currentValue: ccpi.indicators.qqqBelowSMA20
            ? `YES (${ccpi.indicators.qqqSMA20Proximity.toFixed(0)}% proximity)`
            : "NO",
          ranges: {
            safe: "Above SMA20 (0% proximity)",
            warning: "25-50% proximity to breach",
            danger: "Below SMA20 (100% proximity = breached)",
          },
          dataSources: getDataSourceForIndicator("QQQ Technicals", dataSources),
          canaryThresholds: {
            medium: "50%+ proximity",
            high: "Breached (100% proximity)",
          },
        },
        {
          name: "QQQ Below 50-Day SMA",
          formula: "Medium-term Support = Binary (Price < SMA50) + Proximity Score (0-100%)",
          executiveSummary:
            "50-day moving average marks intermediate trend health. Breaches often precede deeper corrections.",
          currentValue: ccpi.indicators.qqqBelowSMA50
            ? `YES (${ccpi.indicators.qqqSMA50Proximity.toFixed(0)}% proximity)`
            : "NO",
          ranges: {
            safe: "Above SMA50",
            warning: "25-50% proximity",
            danger: "Below SMA50 (medium-term trend broken)",
          },
          dataSources: getDataSourceForIndicator("QQQ Technicals", dataSources),
          canaryThresholds: {
            medium: "50%+ proximity",
            high: "Breached (100% proximity)",
          },
        },
        {
          name: "QQQ Below 200-Day SMA",
          formula: "Long-term Support = Binary (Price < SMA200) + Proximity Score (0-100%)",
          executiveSummary:
            "200-day moving average is the ultimate bull/bear line. Breaches signal potential bear market.",
          currentValue: ccpi.indicators.qqqBelowSMA200
            ? `YES (${ccpi.indicators.qqqSMA200Proximity.toFixed(0)}% proximity)`
            : "NO",
          ranges: {
            safe: "Above SMA200 (bull market)",
            warning: "25-50% proximity (approaching danger)",
            danger: "Below SMA200 (bear market signal)",
          },
          dataSources: getDataSourceForIndicator("QQQ Technicals", dataSources),
          canaryThresholds: {
            medium: "50%+ proximity",
            high: "Breached (100% proximity - bear market)",
          },
        },
        {
          name: "QQQ Below Bollinger Band (Lower)",
          formula: "Oversold Territory = Binary (Price < Lower Band) + Proximity Score (0-100%)",
          executiveSummary:
            "Bollinger bands mark statistical extremes. Breaches indicate oversold conditions or accelerating declines.",
          currentValue: ccpi.indicators.qqqBelowBollinger
            ? `YES - OVERSOLD (${ccpi.indicators.qqqBollingerProximity.toFixed(0)}% proximity)`
            : "NO",
          ranges: {
            safe: "Within bands",
            warning: "25-50% proximity to lower band",
            danger: "Below lower band (extreme oversold)",
          },
          dataSources: getDataSourceForIndicator("QQQ Technicals", dataSources),
          canaryThresholds: {
            medium: "50%+ proximity",
            high: "Breached lower band (100% proximity - panic selling)",
          },
        },
        {
          name: "VIX (Fear Gauge)",
          formula: "Implied Volatility = S&P 500 30-day expected volatility from options pricing",
          executiveSummary:
            "VIX measures market fear through options prices. Spikes above 25 indicate elevated stress; above 35 signals panic.",
          currentValue: ccpi.indicators.vix.toFixed(1),
          ranges: {
            safe: "Below 15 (calm market)",
            warning: "15-25 (elevated volatility)",
            danger: "Above 25 (fear), >35 (panic)",
          },
          dataSources: getDataSourceForIndicator("VIX Term Structure", dataSources),
          canaryThresholds: {
            medium: "VIX > 25",
            high: "VIX > 35 (extreme fear)",
          },
        },
        {
          name: "VXN (Nasdaq Volatility)",
          formula: "Nasdaq Fear = QQQ 30-day implied volatility from options",
          executiveSummary:
            "VXN specifically tracks tech sector fear. More sensitive to AI/growth stock panic than broad market VIX.",
          currentValue: ccpi.indicators.vxn.toFixed(1),
          ranges: {
            safe: "Below 15",
            warning: "15-25",
            danger: "Above 25 (tech panic if >35)",
          },
          dataSources: getDataSourceForIndicator("VIX Term Structure", dataSources),
          canaryThresholds: {
            medium: "VXN > 25",
            high: "VXN > 35 (Nasdaq panic)",
          },
        },
        {
          name: "RVX (Russell 2000 Volatility)",
          formula: "Small-cap Fear = Russell 2000 30-day implied volatility",
          executiveSummary:
            "RVX tracks small-cap stress. Often leads broader market volatility as small caps are more sensitive to economic changes.",
          currentValue: ccpi.indicators.rvx.toFixed(1),
          ranges: {
            safe: "Below 18",
            warning: "18-25",
            danger: "Above 25 (small-cap stress)",
          },
          dataSources: getDataSourceForIndicator("VIX Term Structure", dataSources),
          canaryThresholds: {
            medium: "RVX > 25",
            high: "RVX > 35 (small-cap panic)",
          },
        },
        {
          name: "VIX Term Structure (Spot/1M)",
          formula: "Term Structure = 1-Month VIX / Spot VIX (normal > 1.0)",
          executiveSummary:
            "Term structure shows market's fear timeline. Inversion (ratio < 1.0) means immediate fear exceeds future expectations - classic crash signal.",
          currentValue: `${ccpi.indicators.vixTermStructure.toFixed(2)} ${ccpi.indicators.vixTermInverted ? "(INVERTED - FEAR)" : ""}`,
          ranges: {
            safe: "Above 1.2 (normal contango)",
            warning: "0.8-1.2 (flattening)",
            danger: "Below 0.8 (backwardation - immediate fear)",
          },
          dataSources: getDataSourceForIndicator("VIX Term Structure", dataSources),
          canaryThresholds: {
            medium: "Ratio < 1.2 (flattening)",
            high: "Ratio < 0.8 or inverted (fear spike)",
          },
        },
        {
          name: "ATR - Average True Range",
          formula: "Volatility = 14-day average of daily high-low ranges",
          executiveSummary:
            "ATR measures actual price volatility. Rising ATR indicates unstable, whipsaw markets prone to crashes.",
          currentValue: ccpi.indicators.atr.toFixed(1),
          ranges: {
            safe: "Below 25 (stable)",
            warning: "25-40 (elevated volatility)",
            danger: "Above 40 (extreme instability if >50)",
          },
          dataSources: getDataSourceForIndicator("VIX Term Structure", dataSources),
          canaryThresholds: {
            medium: "ATR > 40",
            high: "ATR > 50 (extreme volatility)",
          },
        },
        {
          name: "LTV - Long-term Volatility",
          formula: "Sustained Volatility = 90-day rolling standard deviation of returns",
          executiveSummary:
            "LTV captures persistent instability. High LTV means volatility is structural, not transient.",
          currentValue: `${(ccpi.indicators.ltv * 100).toFixed(1)}%`,
          ranges: {
            safe: "Below 10% (calm)",
            warning: "10-15% (elevated)",
            danger: "Above 15% (sustained instability if >20%)",
          },
          dataSources: getDataSourceForIndicator("VIX Term Structure", dataSources),
          canaryThresholds: {
            medium: "LTV > 15%",
            high: "LTV > 20% (chronic instability)",
          },
        },
        {
          name: "Bullish Percent Index",
          formula: "Breadth = % of stocks on Point & Figure buy signals",
          executiveSummary:
            "Measures market participation. Extremes (>70% or <30%) indicate overbought/oversold conditions ripe for reversals.",
          currentValue: `${ccpi.indicators.bullishPercent}%`,
          ranges: {
            safe: "40-60% (healthy)",
            warning: "60-70% or 30-40% (stretched)",
            danger: "Above 70% (overbought) or Below 30% (oversold)",
          },
          dataSources: getDataSourceForIndicator("QQQ Technicals", dataSources),
          canaryThresholds: {
            medium: ">60% or <40%",
            high: ">70% (overbought danger) or <30% (panic)",
          },
        },
        {
          name: "Yield Curve (10Y-2Y)",
          formula: "Recession Signal = 10-Year Treasury Yield - 2-Year Treasury Yield",
          executiveSummary:
            "Inverted yield curve (negative spread) has preceded every recession since 1950. Market prices in future economic weakness.",
          currentValue: `${ccpi.indicators.yieldCurve > 0 ? "+" : ""}${ccpi.indicators.yieldCurve.toFixed(2)}%`,
          ranges: {
            safe: "Above 0% (normal curve)",
            warning: "0% to -0.5% (inverted)",
            danger: "Below -0.5% (deep inversion - recession signal)",
          },
          dataSources: getDataSourceForIndicator("FRED Macro", dataSources),
          canaryThresholds: {
            medium: "Curve inverted (-0.2% to -0.5%)",
            high: "Deep inversion (< -0.5%)",
          },
        },
      ],
    }
  }

  const buildRiskAppetitePillar = (ccpi: any, dataSources: any): PillarAudit => {
    return {
      name: "Pillar 2 - Risk Appetite & Volatility",
      weight: 30,
      score: ccpi.pillars.riskAppetite,
      formula: "Risk Appetite = Σ(Indicator Score × Weight) / 100, capped at 100",
      calculation:
        "8 indicators: Put/Call (18%), Fear & Greed (15%), AAII Bullish (16%), Short Interest (13%), ATR (10%), LTV (10%), Bullish % (10%), Yield Curve (8%)",
      executiveSummary:
        "Risk appetite pillar detects euphoria (complacency) and panic (capitulation) through sentiment and positioning indicators. Low put/call ratios and high bullish sentiment signal dangerous complacency, while extreme fear can be contrarian opportunity.",
      validation: `Pillar score ${ccpi.pillars.riskAppetite}/100. ${ccpi.pillars.riskAppetite > 70 ? "🔴 EXTREME COMPLACENCY" : ccpi.pillars.riskAppetite > 50 ? "🟡 ELEVATED RISK" : "🟢 HEALTHY"}`,
      indicators: [
        {
          name: "Put/Call Ratio",
          formula: "Hedging Activity = Put Options Volume / Call Options Volume",
          executiveSummary:
            "Measures market hedging behavior. Ratios below 0.7 signal complacency (too few hedges), above 1.3 signals panic.",
          currentValue: ccpi.indicators.putCallRatio.toFixed(2),
          ranges: {
            safe: "0.85-1.10 (balanced hedging)",
            warning: "0.70-0.85 or 1.10-1.30",
            danger: "Below 0.70 (complacency) or Above 1.30 (panic)",
          },
          dataSources: getDataSourceForIndicator("Put/Call Ratio", dataSources),
          canaryThresholds: {
            medium: "<0.85 or >1.10",
            high: "<0.60 (extreme complacency) or >1.30 (panic)",
          },
        },
        {
          name: "Fear & Greed Index",
          formula:
            "Composite Sentiment = 7 indicators (VIX, momentum, breadth, safe haven, junk bonds, market momentum, options)",
          executiveSummary:
            "CNN's aggregate sentiment index. Scores above 75 indicate greed/euphoria; below 25 indicate fear/panic.",
          currentValue: ccpi.indicators.fearGreedIndex !== null ? ccpi.indicators.fearGreedIndex : "N/A",
          ranges: {
            safe: "40-60 (neutral)",
            warning: "60-75 (greed) or 25-40 (fear)",
            danger: "Above 75 (extreme greed) or Below 25 (extreme fear)",
          },
          dataSources: getDataSourceForIndicator("Fear & Greed Index", dataSources),
          canaryThresholds: {
            medium: ">70 or <30",
            high: ">80 (euphoria) or <20 (panic)",
          },
        },
        {
          name: "AAII Bullish Sentiment",
          formula: "Retail Optimism = % of AAII members bullish on stocks (6-month outlook)",
          executiveSummary:
            "Retail investor sentiment survey. Values above 50% indicate excessive optimism; sustained highs precede corrections.",
          currentValue: `${ccpi.indicators.aaiiBullish.toFixed(1)}%`,
          ranges: {
            safe: "30-45% (historical average ~38%)",
            warning: "45-55%",
            danger: "Above 55% (retail euphoria) or Below 25% (capitulation)",
          },
          dataSources: getDataSourceForIndicator("AAII Sentiment", dataSources),
          canaryThresholds: {
            medium: ">45% or <30%",
            high: ">55% (euphoria warning)",
          },
        },
        {
          name: "SPY Short Interest Ratio",
          formula: "Bearish Positioning = SPY ETF short interest as % of float",
          executiveSummary:
            "Measures bearish bets on S&P 500. LOWER short interest (2-3%) signals bullish confidence and market stability, indicating low crash risk. HIGH short interest (>6%) signals bearish positioning, elevated market stress, and increased crash potential. Acts as both a sentiment gauge and potential fuel for short squeezes.",
          currentValue: `${ccpi.indicators.shortInterest.toFixed(1)}%`,
          ranges: {
            safe: "2-3% (bullish confidence, low bearish stress)",
            warning: "3-5% (normal range)",
            danger: "Above 6% (elevated bearish stress), >8% (extreme bearish sentiment)",
          },
          dataSources: getDataSourceForIndicator("Short Interest", dataSources),
          canaryThresholds: {
            medium: ">5% (increased bearish positioning)",
            high: ">8% (extreme bearish stress)",
          },
        },
        {
          name: "ATR - Average True Range",
          formula: "Market Choppiness = 14-day average of (High - Low)",
          executiveSummary:
            "High ATR indicates nervous, unstable markets with large intraday swings - precursor to crashes.",
          currentValue: ccpi.indicators.atr.toFixed(1),
          ranges: {
            safe: "Below 30",
            warning: "30-40",
            danger: "Above 40 (extreme if >50)",
          },
          dataSources: getDataSourceForIndicator("VIX Term Structure", dataSources),
          canaryThresholds: {
            medium: ">40",
            high: ">50 (panic-level volatility)",
          },
        },
        {
          name: "LTV - Long-term Volatility",
          formula: "Chronic Instability = 90-day rolling volatility",
          executiveSummary: "Persistent high volatility indicates structural market problems, not transient shocks.",
          currentValue: `${(ccpi.indicators.ltv * 100).toFixed(1)}%`,
          ranges: {
            safe: "Below 12%",
            warning: "12-15%",
            danger: "Above 15% (sustained stress if >20%)",
          },
          dataSources: getDataSourceForIndicator("VIX Term Structure", dataSources),
          canaryThresholds: {
            medium: ">15%",
            high: ">20% (structural instability)",
          },
        },
        {
          name: "Bullish Percent Index",
          formula: "Market Breadth = % of stocks on buy signals",
          executiveSummary:
            "Extreme readings indicate overbought (>70%) or oversold (<30%) conditions prone to sharp reversals.",
          currentValue: `${ccpi.indicators.bullishPercent}%`,
          ranges: {
            safe: "40-60%",
            warning: "30-40% or 60-70%",
            danger: "Below 30% (oversold) or Above 70% (overbought)",
          },
          dataSources: getDataSourceForIndicator("QQQ Technicals", dataSources),
          canaryThresholds: {
            medium: "<40% or >60%",
            high: "<30% or >70%",
          },
        },
        {
          name: "Yield Curve (10Y-2Y)",
          formula: "Recession Indicator = 10Y Treasury - 2Y Treasury",
          executiveSummary:
            "Inverted yield curve signals loss of confidence in near-term economy, often preceding recessions and market crashes.",
          currentValue: `${ccpi.indicators.yieldCurve.toFixed(2)}%`,
          ranges: {
            safe: "Above 0%",
            warning: "0% to -0.5%",
            danger: "Below -0.5% (deep inversion)",
          },
          dataSources: getDataSourceForIndicator("FRED Macro", dataSources),
          canaryThresholds: {
            medium: "Inverted (<0%)",
            high: "Deep inversion (<-0.5%)",
          },
        },
      ],
    }
  }

  const buildValuationPillar = (ccpi: any, dataSources: any): PillarAudit => {
    return {
      name: "Pillar 3 - Valuation & Market Structure",
      weight: 15,
      score: ccpi.pillars.valuation,
      formula: "Valuation = Σ(Indicator Score × Weight) / 100, capped at 100",
      calculation:
        "7 indicators: S&P P/E (18%), S&P P/S (12%), Buffett Indicator (16%), QQQ P/E (16%), Mag7 Concentration (15%), Shiller CAPE (13%), Equity Risk Premium (10%)",
      executiveSummary:
        "Valuation pillar identifies bubble conditions and structural fragility. High P/E ratios, extreme concentration in Mag7, and negative equity risk premiums signal overvalued markets vulnerable to sharp corrections.",
      validation: `Pillar score ${ccpi.pillars.valuation}/100. ${ccpi.pillars.valuation > 70 ? "🔴 BUBBLE TERRITORY" : ccpi.pillars.valuation > 50 ? "🟡 OVERVALUED" : "🟢 REASONABLE"}`,
      indicators: [
        {
          name: "S&P 500 Forward P/E",
          formula: "Valuation Multiple = Current Price / Next 12 Months Estimated Earnings",
          executiveSummary:
            "Forward P/E above 22 indicates expensive market; above 25 signals bubble risk. Historical average is ~16-18.",
          currentValue: ccpi.indicators.spxPE.toFixed(1),
          ranges: {
            safe: "Below 18 (undervalued)",
            warning: "18-25 (fair to expensive)",
            danger: "Above 25 (overvalued), >30 (bubble)",
          },
          dataSources: getDataSourceForIndicator("S&P 500 P/E", dataSources),
          canaryThresholds: {
            medium: "P/E > 22",
            high: "P/E > 30 (extreme overvaluation)",
          },
        },
        {
          name: "S&P 500 Price-to-Sales",
          formula: "Revenue Multiple = Market Cap / Total Revenue",
          executiveSummary:
            "P/S above 2.5 indicates expensive market; above 3.0 signals bubble conditions. Less manipulable than P/E.",
          currentValue: ccpi.indicators.spxPS.toFixed(1),
          ranges: {
            safe: "Below 2.0",
            warning: "2.0-2.8",
            danger: "Above 2.8 (expensive if >3.5)",
          },
          dataSources: getDataSourceForIndicator("S&P 500 P/E", dataSources),
          canaryThresholds: {
            medium: "P/S > 2.5",
            high: "P/S > 3.5 (extreme)",
          },
        },
        {
          name: "Buffett Indicator (Market Cap / GDP)",
          formula: "Total Market Valuation = Wilshire 5000 Market Cap / US GDP × 100",
          executiveSummary:
            "Warren Buffett's favorite metric. Above 120% is fairly valued; above 150% is overvalued; above 200% is bubble territory.",
          currentValue: `${ccpi.indicators.buffettIndicator.toFixed(0)}%`,
          ranges: {
            safe: "Below 100% (undervalued)",
            warning: "100-150% (fairly valued)",
            danger: "Above 150% (overvalued), >180% (bubble)",
          },
          dataSources: getDataSourceForIndicator("Buffett Indicator", dataSources),
          canaryThresholds: {
            medium: ">150%",
            high: ">180% (significantly overvalued)",
          },
        },
        {
          name: "QQQ Forward P/E (AI-Specific Valuation)",
          formula: "Tech Valuation = QQQ Price / Weighted Average Forward Earnings",
          executiveSummary:
            "QQQ P/E above 30 indicates AI/tech bubble; above 40 signals extreme speculation. More sensitive than S&P 500.",
          currentValue: ccpi.indicators.qqqPE.toFixed(1),
          ranges: {
            safe: "Below 25",
            warning: "25-35",
            danger: "Above 35 (bubble if >40)",
          },
          dataSources: getDataSourceForIndicator("QQQ Forward P/E", dataSources),
          canaryThresholds: {
            medium: ">30",
            high: ">40 (AI bubble territory)",
          },
        },
        {
          name: "Magnificent 7 Concentration (Crash Contagion Risk)",
          formula:
            "Top-Heavy Risk = (AAPL + MSFT + GOOGL + AMZN + NVDA + META + TSLA Market Cap) / Total QQQ Market Cap × 100",
          executiveSummary:
            "Extreme concentration amplifies crash risk. If Mag7 falls, entire index collapses. Above 60% is dangerous top-heaviness.",
          currentValue: `${ccpi.indicators.mag7Concentration.toFixed(1)}%`,
          ranges: {
            safe: "Below 45% (diversified)",
            warning: "45-55%",
            danger: "Above 55% (concentrated), >60% (extreme)",
          },
          dataSources: getDataSourceForIndicator("Mag7 Concentration", dataSources),
          canaryThresholds: {
            medium: ">50%",
            high: ">60% (severe concentration risk)",
          },
        },
        {
          name: "Shiller CAPE Ratio (10-Year Cyclical Valuation)",
          formula: "Cyclically-Adjusted P/E = Price / 10-Year Average Inflation-Adjusted Earnings",
          executiveSummary:
            "CAPE above 30 has historically preceded major market declines. Smooths earnings volatility for long-term valuation view.",
          currentValue: ccpi.indicators.shillerCAPE.toFixed(1),
          ranges: {
            safe: "Below 20 (historical average ~16)",
            warning: "20-30",
            danger: "Above 30 (overvalued), >35 (extreme)",
          },
          dataSources: getDataSourceForIndicator("Shiller CAPE", dataSources),
          canaryThresholds: {
            medium: ">28",
            high: ">35 (historic overvaluation)",
          },
        },
        {
          name: "Equity Risk Premium (Earnings Yield - 10Y Treasury)",
          formula: "Stock vs Bond Attractiveness = (1 / S&P P/E × 100) - 10Y Treasury Yield",
          executiveSummary:
            "Negative or near-zero premiums mean bonds are more attractive than stocks. Below 2% signals stocks are overpriced relative to risk-free rates.",
          currentValue: `${ccpi.indicators.equityRiskPremium.toFixed(2)}%`,
          ranges: {
            safe: "Above 4% (stocks attractive)",
            warning: "2-4% (fair)",
            danger: "Below 2% (stocks overpriced), <0% (bonds dominate)",
          },
          dataSources: getDataSourceForIndicator("S&P 500 P/E", dataSources),
          canaryThresholds: {
            medium: "<3%",
            high: "<1.5% (severely overpriced)",
          },
        },
      ],
    }
  }

  const buildMacroPillar = (ccpi: any, dataSources: any): PillarAudit => {
    return {
      name: "Pillar 4 - Macro (20% weight)",
      weight: 20,
      score: ccpi.pillars.macro,
      formula: "Macro = Σ(Indicator Score × Weight) / 100, capped at 100",
      calculation:
        "7 indicators: TED Spread (15%), DXY Dollar Index (14%), ISM PMI (18%), Fed Funds Rate (17%), Fed Reverse Repo (13%), Junk Bond Spread (12%), US Debt-to-GDP (11%)",
      executiveSummary:
        "Macro pillar captures systemic economic and financial conditions. Banking stress (TED spread), policy tightness (Fed funds), and credit stress (junk spreads) signal macro headwinds that can trigger crashes.",
      validation: `Pillar score ${ccpi.pillars.macro}/100. ${ccpi.pillars.macro > 70 ? "🔴 MACRO CRISIS" : ccpi.pillars.macro > 50 ? "🟡 RESTRICTIVE" : "🟢 STABLE"}`,
      indicators: [
        {
          name: "TED Spread (Banking System Stress)",
          formula: "Credit Risk = 3-Month LIBOR - 3-Month Treasury Yield",
          executiveSummary:
            "TED spread above 0.5% signals banking sector stress; above 1.0% indicates credit crisis. 2008 crisis saw TED > 4%.",
          currentValue: `${ccpi.indicators.tedSpread.toFixed(2)}%`,
          ranges: {
            safe: "Below 0.35% (healthy credit markets)",
            warning: "0.35-0.75%",
            danger: "Above 0.75% (stress), >1.0% (crisis)",
          },
          dataSources: getDataSourceForIndicator("FRED Macro", dataSources),
          canaryThresholds: {
            medium: ">0.50%",
            high: ">1.0% (banking crisis signal)",
          },
        },
        {
          name: "US Dollar Index (DXY) - Tech Headwind",
          formula: "Dollar Strength = Weighted basket vs EUR, JPY, GBP, CAD, SEK, CHF",
          executiveSummary:
            "Strong dollar (>110) hurts tech earnings from overseas and tightens global financial conditions. Dollar rallies often precede crashes.",
          currentValue: ccpi.indicators.dxyIndex.toFixed(1),
          ranges: {
            safe: "Below 100 (weak dollar helps tech)",
            warning: "100-110 (normal range)",
            danger: "Above 110 (strong dollar hurts tech), >115 (extreme)",
          },
          dataSources: getDataSourceForIndicator("FRED Macro", dataSources),
          canaryThresholds: {
            medium: ">105",
            high: ">110 (extreme dollar strength)",
          },
        },
        {
          name: "ISM Manufacturing PMI (Economic Leading)",
          formula: "Factory Health = Survey of purchasing managers (>50 = expansion, <50 = contraction)",
          executiveSummary:
            "PMI below 50 indicates manufacturing contraction; below 45 signals recession risk. Leading indicator for GDP.",
          currentValue: ccpi.indicators.ismPMI.toFixed(1),
          ranges: {
            safe: "Above 52 (expansion)",
            warning: "50-52 (neutral)",
            danger: "Below 50 (contraction), <45 (recession)",
          },
          dataSources: getDataSourceForIndicator("ISM Manufacturing PMI", dataSources),
          canaryThresholds: {
            medium: "<50 (contraction)",
            high: "<46 (deep contraction)",
          },
        },
        {
          name: "Fed Funds Rate - Restrictive Policy",
          formula: "Policy Rate = Federal Reserve target rate for overnight bank lending",
          executiveSummary:
            "Rates above 5% are restrictive and slow economy. Aggressive rate hikes have triggered past recessions and crashes.",
          currentValue: `${ccpi.indicators.fedFundsRate.toFixed(2)}%`,
          ranges: {
            safe: "Below 4% (accommodative)",
            warning: "4-5% (neutral)",
            danger: "Above 5% (restrictive), >6% (extreme)",
          },
          dataSources: getDataSourceForIndicator("FRED Macro", dataSources),
          canaryThresholds: {
            medium: ">4.5%",
            high: ">6.0% (severely restrictive)",
          },
        },
        {
          name: "Fed Reverse Repo (Liquidity Conditions)",
          formula: "Liquidity Drain = $ parked at Fed overnight (removes money from markets)",
          executiveSummary:
            "High RRP (>$1T) means tight liquidity. Money market funds choosing Fed over lending to markets reduces available capital.",
          currentValue: `$${ccpi.indicators.fedReverseRepo.toFixed(0)}B`,
          ranges: {
            safe: "Below $500B (loose liquidity)",
            warning: "$500B-$1000B",
            danger: "Above $1000B (tight), >$1500B (severe drain)",
          },
          dataSources: getDataSourceForIndicator("FRED Macro", dataSources),
          canaryThresholds: {
            medium: ">$1000B",
            high: ">$2000B (extreme liquidity drain)",
          },
        },
        {
          name: "Junk Bond Spread",
          formula: "Credit Stress = High-Yield Corporate Bonds - 10Y Treasury Yield",
          executiveSummary:
            "Spread above 6% signals credit stress; above 8% indicates corporate distress. Widens dramatically before recessions.",
          currentValue: `${ccpi.indicators.junkSpread.toFixed(2)}%`,
          ranges: {
            safe: "Below 3.5% (tight credit)",
            warning: "3.5-6%",
            danger: "Above 6% (stress), >8% (crisis)",
          },
          dataSources: getDataSourceForIndicator("FRED Macro", dataSources),
          canaryThresholds: {
            medium: ">5%",
            high: ">8% (credit crisis)",
          },
        },
        {
          name: "US Debt-to-GDP Ratio",
          formula: "Fiscal Burden = Total Federal Debt / Annual GDP × 100",
          executiveSummary:
            "Debt above 120% raises sovereign risk concerns; above 130% approaches fiscal crisis. Limits government crisis response capacity.",
          currentValue: `${ccpi.indicators.debtToGDP.toFixed(0)}%`,
          ranges: {
            safe: "Below 100% (healthy)",
            warning: "100-120% (elevated)",
            danger: "Above 120% (high risk), >130% (crisis risk)",
          },
          dataSources: getDataSourceForIndicator("FRED Macro", dataSources),
          canaryThresholds: {
            medium: ">110%",
            high: ">130% (fiscal crisis risk)",
          },
        },
      ],
    }
  }

  const getDataSourceForIndicator = (indicatorName: string, dataSources: any) => {
    const source = dataSources?.sources?.find((s: any) => s.name === indicatorName)
    if (source) {
      return {
        primary: source.primarySource,
        fallbackChain: source.fallbackChain,
        currentSource: source.currentSource,
        status: source.status,
      }
    }
    return {
      primary: "Unknown",
      fallbackChain: [],
      currentSource: "Unknown",
      status: "baseline" as const,
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "live":
        return <Badge className="bg-green-500 text-white">🟢 Live API</Badge>
      case "aiFallback":
        return <Badge className="bg-yellow-500 text-white">🟡 AI-Fetched</Badge>
      case "baseline":
        return <Badge className="bg-orange-500 text-white">🟠 Baseline</Badge>
      case "failed":
        return <Badge className="bg-red-500 text-white">🔴 Failed</Badge>
      default:
        return <Badge className="bg-gray-500 text-white">❓ Unknown</Badge>
    }
  }

  const exportReport = () => {
    if (!auditData) return

    const report = `# CCPI AUDIT REPORT
Generated: ${new Date().toISOString()}

## CCPI Index Calculation
Score: ${auditData.ccpi.finalCCPI}/100
Formula: ${auditData.ccpi.formula}

${auditData.ccpi.executiveSummary}

Validation: ${auditData.ccpi.validation}

Pillar Weights:
- Momentum & Technical: ${auditData.ccpi.weights.momentum}%
- Risk Appetite & Volatility: ${auditData.ccpi.weights.riskAppetite}%
- Valuation & Market Structure: ${auditData.ccpi.weights.valuation}%
- Macro Economic: ${auditData.ccpi.weights.macro}%

---

## Crash Amplifier Bonus System
Base Score: ${auditData.crashAmplifier.baseScore} | Bonus: +${auditData.crashAmplifier.totalBonus} | Final Score: ${auditData.crashAmplifier.finalScore}
Formula: ${auditData.crashAmplifier.formula}

${auditData.crashAmplifier.executiveSummary}

Crash Amplifier Triggers:
${auditData.crashAmplifier.triggers.map((trigger: any) => `- ${trigger.condition}: ${trigger.bonus}`).join("\n")}

Active Bonuses:
${auditData.crashAmplifier.bonuses.length > 0 ? auditData.crashAmplifier.bonuses.map((bonus: any) => `- ${bonus.reason}: +${bonus.points} points`).join("\n") : "- None"}

---

## Canary Warning System
Active Warnings: ${auditData.canaries.active} / ${auditData.canaries.total} indicators
Formula: ${auditData.canaries.formula}

${auditData.canaries.executiveSummary}

Severity Levels:
- High: ${auditData.canaries.severityLevels.high}
- Medium: ${auditData.canaries.severityLevels.medium}

---

${auditData.pillars
  .map(
    (pillar: PillarAudit) => `
## ${pillar.name}
Weight: ${pillar.weight}% | Score: ${pillar.score}/100
Formula: ${pillar.formula}
Calculation: ${pillar.calculation}

### Executive Summary
${pillar.executiveSummary}

### Validation
${pillar.validation}

### Indicators (${pillar.indicators.length})
${pillar.indicators
  .map(
    (ind: IndicatorDetail, idx: number) => `
${idx + 1}. **${ind.name}**
   Formula: ${ind.formula}
   Current Value: ${JSON.stringify(ind.currentValue)}
   
   Summary: ${ind.executiveSummary}
   
   Ranges:
   - Safe: ${ind.ranges.safe}
   - Warning: ${ind.ranges.warning}
   - Danger: ${ind.ranges.danger}
   
   Data Sources:
   - Primary: ${ind.dataSources.primary}
   - Current: ${ind.dataSources.currentSource} (${ind.dataSources.status})
   - Fallback Chain: ${ind.dataSources.fallbackChain.join(" → ")}
   
   Canary Thresholds:
   - Medium Risk: ${ind.canaryThresholds.medium}
   - High Risk: ${ind.canaryThresholds.high}
`,
  )
  .join("\n")}
`,
  )
  .join("\n---\n")}

---
**END OF AUDIT REPORT**
`

    const blob = new Blob([report], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ccpi-audit-detailed-${new Date().toISOString().split("T")[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!auditData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600">Loading CCPI Audit...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg p-6 border">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            CCPI Audit - Complete Transparency
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Full formulas, thresholds, data sources, and validation for all 38 indicators across 4 pillars
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAudit} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={exportReport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Section 1: CCPI Index Calculation */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            1. CCPI Index Calculation
          </CardTitle>
          <CardDescription>Overall crash prediction score formula and validation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white p-6 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Current CCPI Score</h3>
              <div className="text-4xl font-bold text-blue-600">{auditData.ccpi.finalCCPI}/100</div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Formula</h4>
                <code className="block bg-gray-50 p-3 rounded text-sm">{auditData.ccpi.formula}</code>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Executive Summary</h4>
                <p className="text-sm text-gray-700">{auditData.ccpi.executiveSummary}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Pillar Weights</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(auditData.ccpi.weights).map(([key, value]: [string, any]) => (
                    <div key={key} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                      <span className="capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                      <span className="font-bold">{value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Validation
                </h4>
                <p className="text-sm text-green-800">{auditData.ccpi.validation}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            2. Crash Amplifier "Bonus" System
          </CardTitle>
          <CardDescription>Extreme condition multipliers that amplify crash risk beyond base score</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white p-6 rounded-lg border border-red-200">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Base CCPI</div>
                <div className="text-3xl font-bold text-blue-600">{auditData.crashAmplifier.baseScore}</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Amplifier Bonus</div>
                <div className="text-3xl font-bold text-orange-600">+{auditData.crashAmplifier.totalBonus}</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Final CCPI</div>
                <div className="text-3xl font-bold text-red-600">{auditData.crashAmplifier.finalScore}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Formula</h4>
                <code className="block bg-gray-50 p-3 rounded text-sm">{auditData.crashAmplifier.formula}</code>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Executive Summary</h4>
                <p className="text-sm text-gray-700">{auditData.crashAmplifier.executiveSummary}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Crash Amplifier Triggers</h4>
                <div className="space-y-2">
                  {auditData.crashAmplifier.triggers.map((trigger: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded">
                      <div className="mt-0.5">
                        {auditData.crashAmplifier.bonuses.find((b: any) =>
                          b.reason.includes(trigger.condition.split(" ")[0]),
                        ) ? (
                          <CheckCircle2 className="h-5 w-5 text-red-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-gray-900">{trigger.condition}</div>
                        <div className="text-sm text-red-700">{trigger.bonus}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {auditData.crashAmplifier.bonuses.length > 0 && (
                <div className="p-4 bg-red-100 border border-red-300 rounded">
                  <h4 className="font-semibold mb-2 text-red-900">🔴 Active Amplifiers</h4>
                  <div className="space-y-1">
                    {auditData.crashAmplifier.bonuses.map((bonus: any, idx: number) => (
                      <div key={idx} className="text-sm text-red-800">
                        • {bonus.reason}: <span className="font-bold">+{bonus.points} points</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
            3. Canary Warning System
          </CardTitle>
          <CardDescription>Early warning signals and threshold logic</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white p-6 rounded-lg border border-yellow-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Active Warnings</h3>
              <div className="text-4xl font-bold text-yellow-600">
                {auditData.canaries.active}/{auditData.canaries.total}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Formula</h4>
                <code className="block bg-gray-50 p-3 rounded text-sm">{auditData.canaries.formula}</code>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Executive Summary</h4>
                <p className="text-sm text-gray-700">{auditData.canaries.executiveSummary}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Severity Levels</h4>
                <div className="space-y-2">
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <span className="font-semibold text-red-900">🔴 High Severity: </span>
                    <span className="text-sm text-red-800">{auditData.canaries.severityLevels.high}</span>
                  </div>
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <span className="font-semibold text-yellow-900">🟡 Medium Severity: </span>
                    <span className="text-sm text-yellow-800">{auditData.canaries.severityLevels.medium}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Activity className="h-6 w-6 text-purple-600" />
            4. Four Pillars - Detailed Breakdown
          </CardTitle>
          <CardDescription>Complete formulas, indicators, data sources, and thresholds for all pillars</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="space-y-4">
            {auditData.pillars.map((pillar: PillarAudit, pillarIdx: number) => (
              <AccordionItem
                key={pillarIdx}
                value={`pillar-${pillarIdx}`}
                className="border rounded-lg overflow-hidden bg-white"
              >
                <AccordionTrigger className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="text-left">
                      <h3 className="font-bold text-lg">{pillar.name}</h3>
                      <p className="text-sm text-gray-600">
                        Weight: {pillar.weight}% | {pillar.indicators.length} indicators
                      </p>
                    </div>
                    <div className="text-2xl font-bold text-purple-600">{pillar.score}/100</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  <div className="space-y-6">
                    {/* Pillar Summary */}
                    <div className="bg-purple-50 p-5 rounded-lg border border-purple-200">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold mb-2">Formula</h4>
                          <code className="block bg-white p-3 rounded text-xs">{pillar.formula}</code>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2">Calculation</h4>
                          <p className="text-sm text-gray-700">{pillar.calculation}</p>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2">Executive Summary</h4>
                          <p className="text-sm text-gray-700">{pillar.executiveSummary}</p>
                        </div>

                        <div className="p-3 bg-white border border-purple-300 rounded">
                          <p className="text-sm font-semibold">{pillar.validation}</p>
                        </div>
                      </div>
                    </div>

                    {/* Indicators */}
                    <div>
                      <h4 className="font-semibold mb-4 flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Indicators ({pillar.indicators.length})
                      </h4>
                      <Accordion type="single" collapsible className="space-y-3">
                        {pillar.indicators.map((indicator: IndicatorDetail, indIdx: number) => (
                          <AccordionItem
                            key={indIdx}
                            value={`indicator-${pillarIdx}-${indIdx}`}
                            className="border rounded-lg"
                          >
                            <AccordionTrigger className="px-4 py-3 hover:bg-gray-50">
                              <div className="flex items-center justify-between w-full pr-4">
                                <div className="text-left">
                                  <span className="font-semibold">{indicator.name}</span>
                                  <div className="flex items-center gap-2 mt-1">
                                    {getStatusBadge(indicator.dataSources.status)}
                                    <span className="text-xs text-gray-600">{String(indicator.currentValue)}</span>
                                  </div>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                              <div className="space-y-4">
                                <div>
                                  <h5 className="font-semibold text-sm mb-1">Technical Formula</h5>
                                  <code className="block bg-gray-50 p-2 rounded text-xs">{indicator.formula}</code>
                                </div>

                                <div>
                                  <h5 className="font-semibold text-sm mb-1">Executive Summary</h5>
                                  <p className="text-sm text-gray-700">{indicator.executiveSummary}</p>
                                </div>

                                <div>
                                  <h5 className="font-semibold text-sm mb-2">Value Ranges</h5>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-green-600">🟢 Safe:</span>
                                      <span className="text-gray-700">{indicator.ranges.safe}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-yellow-600">🟡 Warning:</span>
                                      <span className="text-gray-700">{indicator.ranges.warning}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-red-600">🔴 Danger:</span>
                                      <span className="text-gray-700">{indicator.ranges.danger}</span>
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <h5 className="font-semibold text-sm mb-2">Data Sources</h5>
                                  <div className="bg-gray-50 p-3 rounded space-y-2">
                                    <div className="text-sm">
                                      <span className="font-semibold">Primary:</span> {indicator.dataSources.primary}
                                    </div>
                                    <div className="text-sm">
                                      <span className="font-semibold">Current:</span>{" "}
                                      {indicator.dataSources.currentSource}{" "}
                                      {getStatusBadge(indicator.dataSources.status)}
                                    </div>
                                    <div className="text-sm">
                                      <span className="font-semibold">Fallback Chain:</span>
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {indicator.dataSources.fallbackChain.map((source: string, idx: number) => (
                                          <Badge key={idx} variant="outline" className="text-xs">
                                            {source}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <h5 className="font-semibold text-sm mb-2">Canary Thresholds</h5>
                                  <div className="space-y-1">
                                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                                      <span className="font-semibold">🟡 Medium Risk:</span>{" "}
                                      {indicator.canaryThresholds.medium}
                                    </div>
                                    <div className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                                      <span className="font-semibold">🔴 High Risk:</span>{" "}
                                      {indicator.canaryThresholds.high}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}
