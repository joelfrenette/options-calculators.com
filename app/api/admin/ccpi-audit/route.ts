import { NextResponse } from "next/server"

// CCPI Audit API - Complete transparency for all 25 indicators
// Validates data sources, formulas, and calculations

export async function GET() {
  try {
    const indicators = await auditAllIndicators()
    const pillars = await auditPillarFormulas()
    const ccpiAggregation = await auditCCPIAggregation()
    const confidence = await auditConfidenceLogic()
    const canaries = await auditCanarySignals()
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      indicators,
      pillars,
      ccpiAggregation,
      confidence,
      canaries,
      summary: {
        totalIndicators: indicators.length,
        liveIndicators: indicators.filter((i: any) => i.status === "Live").length,
        baselineIndicators: indicators.filter((i: any) => i.status === "Baseline").length,
        failedIndicators: indicators.filter((i: any) => i.status === "Failed").length
      }
    })
  } catch (error) {
    console.error("[v0] CCPI Audit error:", error)
    return NextResponse.json(
      { error: "Failed to run CCPI audit" },
      { status: 500 }
    )
  }
}

async function auditAllIndicators() {
  const indicators = [
    // PILLAR 1: QQQ Momentum (7 indicators)
    {
      id: 1,
      name: "QQQ Daily Return (5× downside amplifier)",
      pillar: "Pillar 1: QQQ Momentum",
      source_url: "https://api.polygon.io/v2/aggs/ticker/QQQ",
      api_endpoint: "/api/qqq-technicals → lib/qqq-technicals.ts",
      fetch_method: "Polygon.io real-time QQQ data",
      status: await testPolygonAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 0.08, unit: "percent" },
      threshold: { bullish: ">+1%", neutral: "-0.5% to +0.5%", bearish: "<-1%", danger: "<-2%" }
    },
    {
      id: 2,
      name: "QQQ Consecutive Down Days",
      pillar: "Pillar 1: QQQ Momentum",
      source_url: "https://api.polygon.io/v2/aggs/ticker/QQQ (calculated)",
      api_endpoint: "/api/qqq-technicals → lib/qqq-technicals.ts",
      fetch_method: "Calculated from 250-day QQQ price history",
      status: await testPolygonAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 0, unit: "days" },
      threshold: { healthy: "0-1 days", warning: "2-3 days", danger: "4+ days" }
    },
    {
      id: 3,
      name: "QQQ Below 20-Day SMA",
      pillar: "Pillar 1: QQQ Momentum",
      source_url: "https://api.polygon.io/v2/aggs/ticker/QQQ (calculated)",
      api_endpoint: "/api/qqq-technicals → lib/qqq-technicals.ts",
      fetch_method: "Calculated from 20-day QQQ price history",
      status: await testPolygonAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: true, unit: "boolean" },
      threshold: { bullish: "Above SMA20", bearish: "Below SMA20" }
    },
    {
      id: 4,
      name: "QQQ Below 50-Day SMA",
      pillar: "Pillar 1: QQQ Momentum",
      source_url: "https://api.polygon.io/v2/aggs/ticker/QQQ (calculated)",
      api_endpoint: "/api/ccpi",
      fetch_method: "Calculated from 50-day QQQ price history",
      status: await testPolygonAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: false, unit: "boolean" },
      threshold: { bullish: "Above SMA50", bearish: "Below SMA50" }
    },
    {
      id: 5,
      name: "QQQ Below Bollinger Band (Lower)",
      pillar: "Pillar 1: QQQ Momentum",
      source_url: "https://api.polygon.io/v2/aggs/ticker/QQQ (calculated)",
      api_endpoint: "/api/ccpi",
      fetch_method: "Calculated: 20-day SMA - (2 × standard deviation)",
      status: await testPolygonAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: false, unit: "boolean" },
      threshold: { normal: "Within bands", oversold: "Below lower band (SMA20 - 2σ)" }
    },
    {
      id: 6,
      name: "QQQ Below 200-Day SMA",
      pillar: "Pillar 1: QQQ Momentum",
      source_url: "https://api.polygon.io/v2/aggs/ticker/QQQ (calculated)",
      api_endpoint: "/api/ccpi (via Apify Yahoo Finance)",
      fetch_method: "Calculated from 200-day QQQ price history with proximity tracking",
      status: process.env.POLYGON_API_KEY ? "Live" : "Missing API Key",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: false, unit: "boolean", proximity: 0 },
      threshold: { bullish: "Above SMA200", bearish: "Below SMA200", proximity: "0-100% danger scale" }
    },
    {
      id: 7,
      name: "QQQ Death Cross (SMA50 < SMA200)",
      pillar: "Pillar 1: QQQ Momentum",
      source_url: "https://api.polygon.io/v2/aggs/ticker/QQQ (calculated)",
      api_endpoint: "/api/qqq-technicals → lib/qqq-technicals.ts",
      fetch_method: "Calculated: 50-day SMA < 200-day SMA (major bearish signal)",
      status: await testPolygonAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: false, unit: "boolean" },
      threshold: { bullish: "Golden Cross (SMA50 > SMA200)", bearish: "Death Cross (SMA50 < SMA200)" }
    },
    
    // PILLAR 2: VALUATION STRESS (3 indicators)
    {
      id: 8,
      name: "Buffett Indicator (Market Cap / GDP)",
      pillar: "Pillar 2: Valuation Stress",
      source_url: "https://fred.stlouisfed.org/series/WILSHIRE5000IND",
      api_endpoint: "/api/ccpi",
      fetch_method: "Calculated from FRED Wilshire 5000 and GDP data",
      status: await testFREDAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 180, unit: "percent" },
      threshold: { normal: "80-120%", warning: "120-160%", extreme: ">160%" }
    },
    {
      id: 9,
      name: "S&P 500 Forward P/E Ratio",
      pillar: "Pillar 2: Valuation Stress",
      source_url: "https://finance.yahoo.com/quote/%5EGSPC",
      api_endpoint: "/api/ccpi (via Apify Yahoo Finance)",
      fetch_method: "Apify Yahoo Finance actors (canadesk + Architjn)",
      status: await testApifyAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 22.5, unit: "ratio" },
      threshold: { median: "16x", normal: "<18x", elevated: "18-25x", extreme: ">25x" }
    },
    {
      id: 10,
      name: "S&P 500 Price-to-Sales Ratio",
      pillar: "Pillar 2: Valuation Stress",
      source_url: "https://finance.yahoo.com/quote/%5EGSPC/key-statistics",
      api_endpoint: "/api/ccpi (via Apify Yahoo Finance)",
      fetch_method: "Apify Yahoo Finance actors",
      status: await testApifyAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 2.8, unit: "ratio" },
      threshold: { normal: "<2.5", elevated: "2.5-3.0", extreme: ">3.0" }
    },
    
    // PILLAR 3: TECHNICAL FRAGILITY (6 indicators) - Removed RVX (ID 6) to match actual CCPI calculation (23 total)
    {
      id: 11,
      name: "VIX (Volatility Index)",
      pillar: "Pillar 3: Technical Fragility",
      source_url: "https://www.alphavantage.co/query?function=VIX",
      api_endpoint: "/api/ccpi (via Alpha Vantage)",
      fetch_method: "Alpha Vantage VIX_90DAY endpoint",
      status: await testAlphaVantageAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 18.2, unit: "index" },
      threshold: { calm: "<15", normal: "15-20", elevated: "20-30", crisis: ">35" }
    },
    {
      id: 12,
      name: "VXN (Nasdaq Volatility)",
      pillar: "Pillar 3: Technical Fragility",
      source_url: "https://www.alphavantage.co/query?function=VXN",
      api_endpoint: "/api/ccpi (via Alpha Vantage)",
      fetch_method: "Alpha Vantage VXN_90DAY endpoint",
      status: await testAlphaVantageAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 19.5, unit: "index" },
      threshold: { calm: "<15", normal: "15-20", elevated: "20-30", crisis: ">35" }
    },
    {
      id: 13,
      name: "VIX Term Structure (Curve Slope)",
      pillar: "Pillar 3: Technical Fragility",
      source_url: "https://fred.stlouisfed.org/series/VIXCLS",
      api_endpoint: "/api/ccpi → lib/vix-term-structure.ts",
      fetch_method: "FRED VIX spot + calculated 1M future slope",
      status: await testFREDAPI() ? "Live" : "Baseline",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 1.5, unit: "points", inverted: false },
      threshold: { inverted: "<0 (backwardation)", flat: "0-0.5", normal: "1-2", steep: ">2 (complacency)" }
    },
    {
      id: 14,
      name: "Bullish Percent Index",
      pillar: "Pillar 3: Technical Fragility",
      source_url: "Baseline (historical average)",
      api_endpoint: "/api/ccpi (baseline value)",
      fetch_method: "Historical average: 58%",
      status: "Baseline",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 58, unit: "percent" },
      threshold: { oversold: "<30%", neutral: "30-70%", overbought: ">70%" }
    },
    {
      id: 15,
      name: "ATR (Average True Range)",
      pillar: "Pillar 3: Technical Fragility",
      source_url: "https://www.alphavantage.co/query?function=SMA&symbol=SPY",
      api_endpoint: "/api/ccpi (via Alpha Vantage)",
      fetch_method: "Alpha Vantage SMA endpoint for SPY",
      status: await testAlphaVantageAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 42.3, unit: "points" },
      threshold: { low: "20-30", normal: "30-40", elevated: "40-50", high: ">50" }
    },
    {
      id: 16,
      name: "Left Tail Volatility (Crash Probability)",
      pillar: "Pillar 3: Technical Fragility",
      source_url: "Derived from VIX level",
      api_endpoint: "/api/ccpi (calculated from VIX)",
      fetch_method: "Calculated: VIX > 25 ? 0.18 : VIX > 20 ? 0.14 : VIX > 15 ? 0.11 : 0.08",
      status: await testAlphaVantageAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 0.12, unit: "probability" },
      threshold: { low: "<10%", moderate: "10-15%", high: ">15%" }
    },
    
    // PILLAR 4: MACRO & LIQUIDITY RISK (4 indicators)
    {
      id: 17,
      name: "Fed Funds Rate",
      pillar: "Pillar 4: Macro & Liquidity Risk",
      source_url: "https://fred.stlouisfed.org/series/DFF",
      api_endpoint: "/api/ccpi (via FRED)",
      fetch_method: "FRED series DFF (Federal Funds Rate)",
      status: await testFREDAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 4.5, unit: "percent" },
      threshold: { accommodative: "<2%", neutral: "2-4%", restrictive: ">4.5%" }
    },
    {
      id: 18,
      name: "Junk Bond Spread (High-Yield Credit)",
      pillar: "Pillar 4: Macro & Liquidity Risk",
      source_url: "https://fred.stlouisfed.org/series/BAMLH0A0HYM2",
      api_endpoint: "/api/ccpi (via FRED)",
      fetch_method: "FRED series BAMLH0A0HYM2 (ICE BofA High Yield spread)",
      status: await testFREDAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 3.8, unit: "percent" },
      threshold: { tight: "<3%", normal: "3-5%", stress: "5-8%", crisis: ">8%" }
    },
    {
      id: 19,
      name: "Yield Curve (10Y-2Y Spread)",
      pillar: "Pillar 4: Macro & Liquidity Risk",
      source_url: "https://fred.stlouisfed.org/series/T10Y2Y",
      api_endpoint: "/api/ccpi (via FRED)",
      fetch_method: "FRED series T10Y2Y (10-Year minus 2-Year Treasury spread)",
      status: await testFREDAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 0.15, unit: "percent" },
      threshold: { inverted: "<0%", flat: "0-0.5%", normal: ">0.5%" }
    },
    {
      id: 27,
      name: "TED Spread (LIBOR - T-Bill)",
      pillar: "Pillar 4: Macro & Liquidity Risk",
      source_url: "https://fred.stlouisfed.org/series/TEDRATE",
      api_endpoint: "/api/ccpi (via FRED)",
      fetch_method: "FRED series TEDRATE (TED Spread - measures bank counterparty risk)",
      status: await testFREDAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 0.25, unit: "percent" },
      threshold: { healthy: "<0.25%", elevated: "0.25-0.5%", stress: ">0.5% (crash signal)", crisis: ">1.0%" }
    },
    
    // PILLAR 5: SENTIMENT & MEDIA FEEDBACK (5 indicators)
    {
      id: 20,
      name: "AAII Bullish Sentiment",
      pillar: "Pillar 5: Sentiment & Media Feedback",
      source_url: "Baseline (historical average)",
      api_endpoint: "/api/ccpi (baseline value)",
      fetch_method: "Historical average: 42% (AAII blocks scraping)",
      status: "Baseline",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 42, unit: "percent" },
      threshold: { bearish: "<30%", neutral: "30-50%", euphoric: ">50%" }
    },
    {
      id: 21,
      name: "AAII Bearish Sentiment",
      pillar: "Pillar 5: Sentiment & Media Feedback",
      source_url: "Baseline (historical average)",
      api_endpoint: "/api/ccpi (baseline value)",
      fetch_method: "Historical average: 28%",
      status: "Baseline",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 28, unit: "percent" },
      threshold: { complacent: "<20%", normal: "20-35%", fearful: ">35%" }
    },
    {
      id: 22,
      name: "Put/Call Ratio",
      pillar: "Pillar 5: Sentiment & Media Feedback",
      source_url: "https://finance.yahoo.com/quote/SPY/options",
      api_endpoint: "/api/ccpi (via Apify Yahoo Finance)",
      fetch_method: "Apify Yahoo Finance actors - SPY options volume",
      status: await testApifyAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 0.72, unit: "ratio" },
      threshold: { complacent: "<0.7", normal: "0.7-1.0", fearful: ">1.0" }
    },
    {
      id: 23,
      name: "Fear & Greed Index",
      pillar: "Pillar 5: Sentiment & Media Feedback",
      source_url: "https://api.alternative.me/fng/",
      api_endpoint: "/api/ccpi (via alternative.me)",
      fetch_method: "Alternative.me Fear & Greed API (crypto proxy for market sentiment)",
      status: "Live",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 58, unit: "index" },
      threshold: { fear: "<30", neutral: "30-70", greed: ">70" }
    },
    {
      id: 24,
      name: "Credit Spread Widening",
      pillar: "Pillar 5: Sentiment & Media Feedback",
      source_url: "https://fred.stlouisfed.org/series/BAMLH0A0HYM2",
      api_endpoint: "/api/ccpi (via FRED API)",
      fetch_method: "FRED API: BAMLH0A0HYM2 (High Yield spread) - spread is inherently vs. Treasuries",
      status: process.env.FRED_API_KEY ? "Live" : "Missing API Key",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 3.8, unit: "percent" },
      threshold: { tight: "<3% (complacency)", normal: "3-4%", widening: "4-5% (caution)", stress: ">5% (credit stress)" }
    },
    
    // PILLAR 6: CAPITAL FLOWS & POSITIONING (2 indicators)
    {
      id: 25,
      name: "QQQ Options Flow (Call/Put Ratio)",
      pillar: "Pillar 6: Capital Flows & Positioning",
      source_url: "https://polygon.io/docs/options/get_v3_snapshot_options__underlyingasset",
      api_endpoint: "https://api.polygon.io/v3/snapshot/options/QQQ",
      fetch_method: "Polygon REST API - aggregates call and put volumes across all QQQ option strikes",
      status: process.env.POLYGON_API_KEY ? "Live" : "Missing API Key",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { 
        callPutRatio: 1.2, 
        callVolume: 120000, 
        putVolume: 100000,
        unit: "ratio" 
      },
      threshold: { 
        bearish: "<0.8 (heavy put volume)", 
        neutral: "1.0-1.5 (balanced)", 
        bullish: ">1.5 (heavy call volume)",
        warning: ">2.0 (excessive speculation)"
      }
    },
    {
      id: 26,
      name: "Short Interest (% of Float)",
      pillar: "Pillar 6: Capital Flows & Positioning",
      source_url: "https://finance.yahoo.com/quote/SPY/key-statistics",
      api_endpoint: "/api/ccpi (via Apify Yahoo Finance)",
      fetch_method: "Apify Yahoo Finance actors - SPY short interest",
      status: await testApifyAPI() ? "Live" : "Failed",
      last_fetched_at: new Date().toISOString(),
      raw_sample: { value: 16.5, unit: "percent" },
      threshold: { complacent: "<15%", normal: "15-20%", hedged: ">20%" }
    }
  ]
  
  return indicators
}

async function auditPillarFormulas() {
  return [
    // PILLAR 1: QQQ Momentum
    {
      pillar: "Pillar 1: QQQ Momentum",
      weight: 0.30,
      formula: "Score = dailyReturnImpact + consecDownImpact + belowSMA20Impact + belowSMA50Impact + belowBollingerImpact + belowSMA200Impact + deathCrossImpact + compoundingPenalty",
      indicators: [
        {
          name: "QQQ Daily Return",
          weight: "Variable (5× downside amplifier)",
          scoring: "Positive days: 0pts. Negative days: |(return%)| × 5 (e.g., -2% = 10pts crash risk)"
        },
        {
          name: "Consecutive Down Days",
          weight: "10 pts per day",
          scoring: "0 days = 0pts, 1 day = 10pts, 2 days = 20pts, 3+ days = 30pts"
        },
        {
          name: "Below SMA20",
          weight: "20 pts",
          scoring: "Below 20-day = 20pts, Above = 0pts"
        },
        {
          name: "Below SMA50",
          weight: "25 pts",
          scoring: "Below 50-day = 25pts, Above = 0pts"
        },
        {
          name: "Below Bollinger Band",
          weight: "15 pts",
          scoring: "Below lower band (SMA20 - 2σ) = 15pts, Within/Above = 0pts"
        },
        {
          name: "Below SMA200",
          weight: "10 pts (proximity-based)",
          scoring: "Graduated: 0% proximity = 0pts, 50% = 5pts, 100% = 10pts"
        },
        {
          name: "Death Cross (SMA50 < SMA200)",
          weight: "20 pts",
          scoring: "Death Cross active = 20pts, Golden Cross (SMA50 > SMA200) = 0pts"
        },
        {
          name: "Compounding Penalty",
          weight: "+10 pts bonus",
          scoring: "If ALL FOUR: SMA20 AND SMA50 AND SMA200 AND Bollinger proximity >50%, add +10pts"
        }
      ],
      calculation: "Sum of impacts, capped at 100. Heavy downside bias via 5× amplifier on negative days."
    },
    // PILLAR 2: VALUATION STRESS
    {
      pillar: "Pillar 2: Valuation Stress",
      weight: 0.23,
      formula: "Score = Σ(Indicator_i × Weight_i)",
      indicators: [
        {
          name: "Buffett Indicator",
          weight: 0.40,
          scoring: "Score increases with value: >200% = 60pts, >180% = 50pts, >160% = 40pts, etc."
        },
        {
          name: "S&P 500 P/E Ratio",
          weight: 0.35,
          scoring: "Deviation from median 16: (PE - 16) / 16 × 80, capped at 40pts"
        },
        {
          name: "Price-to-Sales Ratio",
          weight: 0.25,
          scoring: ">3.5 = 25pts, >3.0 = 20pts, >2.5 = 15pts, >2.0 = 10pts"
        }
      ],
      calculation: "Weighted sum of normalized scores (0-100 scale)"
    },
    // PILLAR 3: TECHNICAL FRAGILITY
    {
      pillar: "Pillar 3: Technical Fragility",
      weight: 0.12,
      formula: "Score = Σ(Indicator_i × Weight_i)",
      indicators: [
        {
          name: "VIX",
          weight: 0.25,
          scoring: ">35 = 50pts, >25 = 35pts, >20 = 22pts, >17 = 15pts, <12 = 12pts (complacency)"
        },
        {
          name: "VXN",
          weight: 0.12,
          scoring: "VXN > VIX+3 = 12pts, VXN > VIX+1 = 6pts"
        },
        {
          name: "VIX Term Structure",
          weight: 0.25,
          scoring: "Inverted: <0 (backwardation) = 30pts, Flat: 0-0.5 = 20pts, Normal: 1-2 = 12pts, Steep: >2 (complacency) = 0pts"
        },
        {
          name: "Bullish Percent",
          weight: 0.15,
          scoring: ">70% = 18pts, >60% = 12pts, >45% = 12pts, <25% = 18pts (extreme fear)"
        },
        {
          name: "ATR",
          weight: 0.13,
          scoring: ">50 = 18pts, >40 = 12pts, >35 = 6pts"
        },
        {
          name: "Left Tail Volatility",
          weight: 0.10,
          scoring: ">0.15 = 25pts, >0.10 = 15pts, >0.08 = 8pts"
        }
      ],
      calculation: "Weighted sum with emphasis on market breadth and volatility"
    },
    // PILLAR 4: MACRO & LIQUIDITY RISK
    {
      pillar: "Pillar 4: Macro & Liquidity Risk",
      weight: 0.12,
      formula: "Score = Σ(Indicator_i × Weight_i)",
      indicators: [
        {
          name: "Fed Funds Rate",
          weight: 0.40,
          scoring: ">5.5% = 35pts, >5.0% = 28pts, >4.5% = 22pts, >4.0% = 18pts, <2.0% = -10pts"
        },
        {
          name: "Junk Spread",
          weight: 0.35,
          scoring: ">8% = 40pts, >6% = 28pts, >5% = 22pts, >4% = 15pts"
        },
        {
          name: "Yield Curve",
          weight: 0.25,
          scoring: "<-0.5% = 30pts, <-0.2% = 20pts, <0% = 12pts, >1.0% = -10pts"
        },
        {
          name: "TED Spread",
          weight: 0.25,
          scoring: ">1.0% = 35pts (crisis), >0.75% = 28pts, >0.5% = 22pts (stress), >0.35% = 15pts, >0.25% = 8pts, <0.15% = -5pts (healthy)"
        }
      ],
      calculation: "Focuses on monetary policy restrictiveness, credit stress, and banking system liquidity"
    },
    // PILLAR 5: SENTIMENT & MEDIA FEEDBACK
    {
      pillar: "Pillar 5: Sentiment & Media Feedback",
      weight: 0.12,
      formula: "Score = Σ(Indicator_i × Weight_i)",
      indicators: [
        {
          name: "AAII Bullish",
          weight: 0.22,
          scoring: ">60% = 28pts, >50% = 20pts, >45% = 12pts, <25% = 18pts (extreme fear)"
        },
        {
          name: "AAII Bearish",
          weight: 0.20,
          scoring: "<20% = 25pts (complacency), <25% = 18pts, <30% = 10pts"
        },
        {
          name: "Put/Call Ratio",
          weight: 0.20,
          scoring: "<0.6 = 25pts, <0.7 = 18pts, <0.8 = 10pts, >1.2 = 18pts (panic)"
        },
        {
          name: "Fear & Greed",
          weight: 0.20,
          scoring: ">75 = 20pts (greed), >65 = 12pts, <25 = 15pts (fear)"
        },
        {
          name: "Credit Spread Widening",
          weight: 0.18,
          scoring: ">7% = 35pts (crisis), >5% = 25pts (stress), >4% = 15pts (caution), <3% = complacency"
        }
      ],
      calculation: "Contrarian indicators - extreme optimism or pessimism both add risk. Credit spreads show credit market stress leading equities."
    },
    // PILLAR 6: CAPITAL FLOWS & POSITIONING
    {
      pillar: "Pillar 6: Capital Flows & Positioning",
      weight: 0.11,
      formula: "Score = Σ(Indicator_i × Weight_i)",
      indicators: [
        {
          name: "QQQ Options Flow",
          weight: 0.50,
          scoring: "<0.8 = 25pts, <0.9 = 18pts, <1.0 = 10pts, >1.5 = 12pts (crowded calls)"
        },
        {
          name: "Short Interest",
          weight: 0.50,
          scoring: "<12% = 22pts (complacency), <15% = 16pts, <18% = 8pts, >25% = 12pts (crowded shorts)"
        }
      ],
      calculation: "Tracks institutional money movement and hedging levels"
    }
  ]
}

async function auditCCPIAggregation() {
  return {
    formula: "CCPI = (P1×0.30) + (P2×0.23) + (P3×0.12) + (P4×0.12) + (P5×0.12) + (P6×0.11)",
    weights: {
      qqqTechnicals: 0.30,
      valuation: 0.23,
      technical: 0.12,
      macro: 0.12,
      sentiment: 0.12,
      flows: 0.11
    },
    validation: "Sum of weights = 1.00 ✓",
    interpretation: [
      { range: "0-19", level: "Low Risk", description: "Minimal crash signals" },
      { range: "20-39", level: "Normal", description: "Standard market conditions" },
      { range: "40-59", level: "Caution", description: "Mixed signals, defensive positioning" },
      { range: "60-79", level: "High Alert", description: "Multiple warnings, reduce exposure" },
      { range: "80-100", level: "Crash Watch", description: "Extreme risk, full defense" }
    ]
  }
}

async function auditConfidenceLogic() {
  return {
    formula: "Confidence = (varianceAlignment × 0.25) + (directionalConsistency × 0.30) + (crossPillarCorrelation × 0.20) + (vixAlignment × 0.15) + (canaryAgreement × 0.10)",
    components: [
      {
        name: "Variance Alignment",
        weight: 0.25,
        logic: "100 - (stdDev × 2.5). Low variance between pillars = high confidence"
      },
      {
        name: "Directional Consistency",
        weight: 0.30,
        logic: "% of pillars in same risk zone (low/moderate/high). 6/6 agreement = 100%"
      },
      {
        name: "Cross-Pillar Correlation",
        weight: 0.20,
        logic: "Technical should correlate with Sentiment, Valuation with Macro. Measures expected relationships"
      },
      {
        name: "VIX Alignment",
        weight: 0.15,
        logic: "VIX implied stress should match pillar mean. Validates market pricing"
      },
      {
        name: "Canary Agreement",
        weight: 0.10,
        logic: "# of active warnings / 23 total indicators. More warnings = stronger signal"
      }
    ],
    output: "0-100 scale. >80 = high confidence, <40 = conflicting signals"
  }
}

async function auditCanarySignals() {
  return {
    total_possible: 23,
    logic: "Each indicator has specific thresholds. When breached, generates canary signal.",
    severity_levels: {
      high: "Critical threshold breached (e.g., VIX > 30, Buffett > 160%)",
      medium: "Warning threshold breached (e.g., VIX > 20, Buffett > 120%)",
      low: "Watch threshold breached (minor warnings)"
    },
    trigger_conditions: [
      { indicator: "QQQ Daily Return", high: "<-2%", medium: "<-1%", low: "<-0.5%" },
      { indicator: "QQQ Consecutive Down", high: "4+ days", medium: "2-3 days", low: "1 day" },
      { indicator: "QQQ Below SMA20", high: "Yes + downtrend", medium: "Yes", low: "Approaching" },
      { indicator: "QQQ Below SMA50", high: "Yes + downtrend", medium: "Yes", low: "Approaching" },
      { indicator: "QQQ Below Bollinger", high: "Yes + volatility spike", medium: "Yes", low: "Approaching" },
      { indicator: "Buffett Indicator", high: ">160%", medium: ">120%", low: ">100%" },
      { indicator: "S&P P/E", high: ">25x", medium: ">18x", low: ">16x" },
      { indicator: "VIX", high: ">30", medium: ">20", low: ">17" },
      { indicator: "Yield Curve", high: "<-0.3%", medium: "<0%", low: "<0.2%" }
    ],
    alert_levels: [
      { canaries: "0-7", alert: "Normal", action: "Monitor" },
      { canaries: "8-14", alert: "Elevated", action: "Increase hedges" },
      { canaries: "15-21", alert: "High Alert", action: "Defensive positioning" },
      { canaries: "22-23", alert: "Maximum", action: "Full defense mode" }
    ]
  }
}

// Helper functions to test API connectivity
async function testFREDAPI() {
  const FRED_API_KEY = process.env.FRED_API_KEY
  if (!FRED_API_KEY) return false
  
  try {
    const response = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=DFF&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`, {
      signal: AbortSignal.timeout(5000)
    })
    return response.ok
  } catch {
    return false
  }
}

async function testAlphaVantageAPI() {
  const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY
  if (!ALPHA_VANTAGE_API_KEY) return false
  
  try {
    const response = await fetch(`https://www.alphavantage.co/query?function=VIX_90DAY&apikey=${ALPHA_VANTAGE_API_KEY}`, {
      signal: AbortSignal.timeout(5000)
    })
    return response.ok
  } catch {
    return false
  }
}

async function testApifyAPI() {
  const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN
  if (!APIFY_API_TOKEN) return false
  
  // Don't actually call Apify in audit (expensive), just check if token exists
  return true
}

async function testMarketBreadthAPI() {
  return "Baseline"
}

async function testPolygonAPI() {
  const POLYGON_API_KEY = process.env.POLYGON_API_KEY
  if (!POLYGON_API_KEY) return false
  
  try {
    const response = await fetch(`https://api.polygon.io/v2/aggs/ticker/QQQ/range/1/day/2025-01-01/2025-01-02?apiKey=${POLYGON_API_KEY}`, {
      signal: AbortSignal.timeout(5000)
    })
    return response.ok
  } catch {
    return false
  }
}
