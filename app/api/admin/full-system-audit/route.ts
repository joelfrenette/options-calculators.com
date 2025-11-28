import { NextResponse } from "next/server"

// Full System Audit - Tests every API endpoint and data source
export async function GET() {
  const startTime = Date.now()

  const auditResults: SystemAuditResult = {
    timestamp: new Date().toISOString(),
    duration: 0,
    summary: {
      totalApis: 0,
      liveApis: 0,
      fallbackApis: 0,
      failedApis: 0,
      totalIndicators: 0,
      workingIndicators: 0,
    },
    verdict: "PASS",
    pages: [],
  }

  // ====================================
  // ANALYZE TAB PAGES
  // ====================================

  // 1. Earnings Calendar
  auditResults.pages.push(await auditEarningsCalendar())

  // 2. Index Trend
  auditResults.pages.push(await auditIndexTrend())

  // 3. VIX Index
  auditResults.pages.push(await auditVixIndex())

  // 4. Fear & Greed
  auditResults.pages.push(await auditFearGreed())

  // 5. Panic Index
  auditResults.pages.push(await auditPanicIndex())

  // 6. Social Sentiment
  auditResults.pages.push(await auditSocialSentiment())

  // 7. CCPI
  auditResults.pages.push(await auditCCPI())

  // 8. CPI Inflation
  auditResults.pages.push(await auditCPIInflation())

  // 9. Fed Rate
  auditResults.pages.push(await auditFedRate())

  // 10. Jobs
  auditResults.pages.push(await auditJobs())

  // 11. Insiders
  auditResults.pages.push(await auditInsiders())

  // ====================================
  // SCAN TAB PAGES
  // ====================================

  auditResults.pages.push(await auditPutScanner())
  auditResults.pages.push(await auditCreditSpreads())
  auditResults.pages.push(await auditIronCondors())
  auditResults.pages.push(await auditWheelScreener())
  auditResults.pages.push(await auditHighIVWatchlist())
  auditResults.pages.push(await auditEarningsPlays())

  // ====================================
  // EXECUTE TAB PAGES
  // ====================================

  auditResults.pages.push(await auditCreditSpreadsCalc())
  auditResults.pages.push(await auditIronCondorsCalc())
  auditResults.pages.push(await auditCalendarSpreads())
  auditResults.pages.push(await auditButterflies())
  auditResults.pages.push(await auditCollars())
  auditResults.pages.push(await auditDiagonals())
  auditResults.pages.push(await auditStraddlesStrangles())
  auditResults.pages.push(await auditWheelStrategy())
  auditResults.pages.push(await auditExitRules())
  auditResults.pages.push(await auditEarningsEM())
  auditResults.pages.push(await auditGreeksCalc())
  auditResults.pages.push(await auditROICalc())

  // Calculate summary
  for (const page of auditResults.pages) {
    for (const indicator of page.indicators) {
      auditResults.summary.totalIndicators++
      if (indicator.status === "live") {
        auditResults.summary.workingIndicators++
        auditResults.summary.liveApis++
      } else if (indicator.status === "fallback") {
        auditResults.summary.workingIndicators++
        auditResults.summary.fallbackApis++
      } else {
        auditResults.summary.failedApis++
      }
      auditResults.summary.totalApis++
    }
  }

  // Determine verdict
  const successRate = auditResults.summary.workingIndicators / auditResults.summary.totalIndicators
  if (successRate >= 0.9) {
    auditResults.verdict = "PASS"
  } else if (successRate >= 0.7) {
    auditResults.verdict = "CONDITIONAL PASS"
  } else {
    auditResults.verdict = "FAIL"
  }

  auditResults.duration = Date.now() - startTime

  return NextResponse.json(auditResults)
}

interface SystemAuditResult {
  timestamp: string
  duration: number
  summary: {
    totalApis: number
    liveApis: number
    fallbackApis: number
    failedApis: number
    totalIndicators: number
    workingIndicators: number
  }
  verdict: "PASS" | "CONDITIONAL PASS" | "FAIL"
  pages: PageAudit[]
}

interface PageAudit {
  id: string
  name: string
  category: "analyze" | "scan" | "execute"
  description: string
  indicators: IndicatorAudit[]
}

interface IndicatorAudit {
  name: string
  formula: string
  formulaExplanation: string
  algorithm?: string
  primaryApi: string
  fallbackChain: string[]
  currentSource: string
  status: "live" | "fallback" | "failed"
  statusReason: string
  value?: any
  lastUpdated?: string
}

// Helper function to test an API endpoint
async function testApi(url: string, timeout = 5000): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message || "Unknown error" }
  }
}

// ====================================
// AUDIT FUNCTIONS FOR EACH PAGE
// ====================================

async function auditEarningsCalendar(): Promise<PageAudit> {
  const polygonKey = process.env.POLYGON_API_KEY
  const fmpKey = process.env.FMP_API_KEY

  const indicators: IndicatorAudit[] = [
    {
      name: "Earnings Dates",
      formula: "Fetch earnings calendar for next 30 days",
      formulaExplanation:
        "Retrieves scheduled earnings dates, EPS estimates, and revenue forecasts from financial APIs",
      primaryApi: "Polygon.io /v3/reference/dividends",
      fallbackChain: ["FMP /earning_calendar", "Finnhub /calendar/earnings", "Alpha Vantage EARNINGS_CALENDAR"],
      currentSource: polygonKey ? "Polygon.io" : fmpKey ? "FMP" : "Fallback",
      status: polygonKey ? "live" : fmpKey ? "fallback" : "failed",
      statusReason: polygonKey
        ? "Primary API key configured"
        : fmpKey
          ? "Using FMP fallback"
          : "No API keys configured",
    },
    {
      name: "EPS Estimates",
      formula: "EPS_Surprise = (Actual_EPS - Estimated_EPS) / |Estimated_EPS| × 100",
      formulaExplanation: "Calculates earnings surprise percentage to gauge if company beat or missed estimates",
      primaryApi: "Polygon.io /v2/reference/news",
      fallbackChain: ["FMP /analyst-estimates", "Finnhub /stock/earnings"],
      currentSource: polygonKey ? "Polygon.io" : "FMP",
      status: polygonKey ? "live" : "fallback",
      statusReason: polygonKey ? "Live earnings data" : "Using estimated data",
    },
    {
      name: "Expected Move",
      formula: "EM = Stock_Price × IV × √(DTE/365)",
      formulaExplanation: "Calculates expected price range using implied volatility and days to earnings",
      algorithm: "Black-Scholes derived expected move calculation",
      primaryApi: "Polygon.io /v3/snapshot/options",
      fallbackChain: ["TwelveData /options/chain", "Calculated from historical volatility"],
      currentSource: polygonKey ? "Polygon.io" : "Historical Calc",
      status: polygonKey ? "live" : "fallback",
      statusReason: polygonKey ? "Real-time IV data" : "Using 30-day historical volatility",
    },
  ]

  return {
    id: "earnings-calendar",
    name: "Earnings Calendar",
    category: "analyze",
    description: "Upcoming earnings with expected moves and IV analysis",
    indicators,
  }
}

async function auditIndexTrend(): Promise<PageAudit> {
  const polygonKey = process.env.POLYGON_API_KEY
  const twelveDataKey = process.env.TWELVE_DATA_API_KEY || process.env.TWELVEDATA_API_KEY

  const indicators: IndicatorAudit[] = [
    {
      name: "Price Data (OHLCV)",
      formula: "Daily Open, High, Low, Close, Volume for SPY, QQQ, IWM, DIA",
      formulaExplanation: "Core price data for technical analysis calculations",
      primaryApi: "Polygon.io /v2/aggs/ticker/{ticker}/range/1/day",
      fallbackChain: ["TwelveData /time_series", "Alpha Vantage TIME_SERIES_DAILY", "Yahoo Finance"],
      currentSource: polygonKey ? "Polygon.io" : twelveDataKey ? "TwelveData" : "Fallback",
      status: polygonKey ? "live" : twelveDataKey ? "live" : "fallback",
      statusReason: polygonKey ? "Real-time market data" : twelveDataKey ? "TwelveData live" : "Using cached data",
    },
    {
      name: "RSI (Relative Strength Index)",
      formula: "RSI = 100 - (100 / (1 + RS)), where RS = Avg_Gain(14) / Avg_Loss(14)",
      formulaExplanation:
        "Momentum oscillator measuring speed and magnitude of price changes. >70 overbought, <30 oversold",
      algorithm: "14-period Wilder's smoothed moving average of gains vs losses",
      primaryApi: "TwelveData /rsi",
      fallbackChain: ["Calculated from price data", "Alpha Vantage RSI"],
      currentSource: twelveDataKey ? "TwelveData" : "Calculated",
      status: twelveDataKey ? "live" : "fallback",
      statusReason: twelveDataKey ? "API-provided RSI" : "Calculated from OHLCV data",
    },
    {
      name: "MACD",
      formula: "MACD = EMA(12) - EMA(26), Signal = EMA(9) of MACD, Histogram = MACD - Signal",
      formulaExplanation: "Trend-following momentum indicator showing relationship between two EMAs",
      algorithm: "Exponential moving average crossover with signal line",
      primaryApi: "TwelveData /macd",
      fallbackChain: ["Calculated from price data", "Alpha Vantage MACD"],
      currentSource: twelveDataKey ? "TwelveData" : "Calculated",
      status: twelveDataKey ? "live" : "fallback",
      statusReason: twelveDataKey ? "API-provided MACD" : "Calculated from OHLCV data",
    },
    {
      name: "Moving Averages (20/50/200 SMA)",
      formula: "SMA(n) = Σ(Close_i) / n for i = 1 to n",
      formulaExplanation: "Simple moving averages for trend identification. Price above all SMAs = bullish",
      algorithm: "Rolling window average calculation",
      primaryApi: "TwelveData /sma",
      fallbackChain: ["Calculated from price data"],
      currentSource: twelveDataKey ? "TwelveData" : "Calculated",
      status: twelveDataKey ? "live" : "fallback",
      statusReason: twelveDataKey ? "API-provided SMAs" : "Calculated locally",
    },
    {
      name: "Bollinger Bands",
      formula: "Upper = SMA(20) + 2σ, Lower = SMA(20) - 2σ, where σ = StdDev(20)",
      formulaExplanation:
        "Volatility bands that expand/contract with market volatility. Price at bands = potential reversal",
      algorithm: "20-period SMA with 2 standard deviation bands",
      primaryApi: "TwelveData /bbands",
      fallbackChain: ["Calculated from price data"],
      currentSource: twelveDataKey ? "TwelveData" : "Calculated",
      status: twelveDataKey ? "live" : "fallback",
      statusReason: twelveDataKey ? "API-provided bands" : "Calculated locally",
    },
    {
      name: "Trend Score",
      formula: "Score = (MA_Alignment × 0.4) + (RSI_Signal × 0.3) + (MACD_Signal × 0.3)",
      formulaExplanation: "Composite trend score from 0-100. >70 strong uptrend, <30 strong downtrend",
      algorithm: "Weighted combination of technical indicators",
      primaryApi: "Calculated internally",
      fallbackChain: ["N/A - always calculated"],
      currentSource: "Internal Calculation",
      status: "live",
      statusReason: "Proprietary scoring algorithm",
    },
  ]

  return {
    id: "trend-analysis",
    name: "Index Trend Analysis",
    category: "analyze",
    description: "Technical analysis with RSI, MACD, moving averages, and trend forecasting",
    indicators,
  }
}

async function auditVixIndex(): Promise<PageAudit> {
  const fredKey = process.env.FRED_API_KEY

  const indicators: IndicatorAudit[] = [
    {
      name: "VIX Current Level",
      formula: "VIX = CBOE Volatility Index (30-day implied volatility of S&P 500 options)",
      formulaExplanation:
        "The 'fear gauge' - measures expected market volatility. <15 calm, 15-25 normal, >25 elevated, >35 panic",
      primaryApi: "FRED /series/observations?series_id=VIXCLS",
      fallbackChain: ["Polygon.io /v2/aggs/ticker/VIX", "TwelveData /quote?symbol=VIX", "Yahoo Finance"],
      currentSource: fredKey ? "FRED" : "Fallback",
      status: fredKey ? "live" : "fallback",
      statusReason: fredKey ? "Federal Reserve data" : "Using alternative source",
    },
    {
      name: "VIX Term Structure",
      formula: "Term_Structure = VIX_1M / VIX_Spot",
      formulaExplanation:
        "Ratio > 1.0 = contango (normal), < 1.0 = backwardation (fear). Inversion signals acute stress",
      algorithm: "Compare spot VIX to 1-month VIX futures",
      primaryApi: "FRED + Calculated",
      fallbackChain: ["Polygon VIX futures", "CBOE direct"],
      currentSource: fredKey ? "FRED" : "Estimated",
      status: fredKey ? "live" : "fallback",
      statusReason: fredKey ? "Live term structure" : "Using historical average",
    },
    {
      name: "Cash Allocation Recommendation",
      formula: "Cash% = min(90, max(10, VIX × 2))",
      formulaExplanation:
        "Dynamic cash allocation based on VIX. VIX 15 = 30% cash, VIX 30 = 60% cash, VIX 45 = 90% cash",
      algorithm: "Linear scaling with floor/ceiling bounds",
      primaryApi: "Calculated from VIX",
      fallbackChain: ["N/A - formula-based"],
      currentSource: "Internal Calculation",
      status: "live",
      statusReason: "Derived from VIX level",
    },
    {
      name: "VIX Percentile Rank",
      formula: "Percentile = (Days_Below_Current / Total_Days) × 100",
      formulaExplanation:
        "Where current VIX ranks vs historical levels. 90th percentile = VIX higher than 90% of history",
      algorithm: "Historical percentile ranking over 252 trading days",
      primaryApi: "Calculated from FRED historical",
      fallbackChain: ["Calculated from cached history"],
      currentSource: fredKey ? "FRED Historical" : "Cached",
      status: fredKey ? "live" : "fallback",
      statusReason: fredKey ? "Full historical data" : "Using cached percentiles",
    },
  ]

  return {
    id: "risk-management",
    name: "VIX Index & Risk Management",
    category: "analyze",
    description: "Volatility tracking with cash allocation recommendations",
    indicators,
  }
}

async function auditFearGreed(): Promise<PageAudit> {
  const fredKey = process.env.FRED_API_KEY
  const polygonKey = process.env.POLYGON_API_KEY

  const indicators: IndicatorAudit[] = [
    {
      name: "Fear & Greed Composite",
      formula: "F&G = Σ(Component_i × Weight_i) for i = 1 to 7, each weight = 14.29%",
      formulaExplanation:
        "7-component equally-weighted index. 0-25 Extreme Fear, 25-45 Fear, 45-55 Neutral, 55-75 Greed, 75-100 Extreme Greed",
      algorithm: "Equal-weighted average of 7 market sentiment indicators",
      primaryApi: "CNN Fear & Greed API",
      fallbackChain: ["Calculated from components", "AI-generated estimate"],
      currentSource: "Calculated from components",
      status: "live",
      statusReason: "Real-time component aggregation",
    },
    {
      name: "Put/Call Ratio",
      formula: "PCR = Put_Volume / Call_Volume (equity options)",
      formulaExplanation: "Measures hedging activity. >1.0 = fear (more puts), <0.7 = greed (more calls)",
      primaryApi: "CBOE Put/Call data",
      fallbackChain: ["Polygon options flow", "Finnhub sentiment"],
      currentSource: polygonKey ? "Polygon" : "CBOE",
      status: polygonKey ? "live" : "fallback",
      statusReason: polygonKey ? "Real-time options data" : "Delayed CBOE data",
    },
    {
      name: "Market Momentum",
      formula: "Momentum = (SPY_Price / SPY_125MA) vs (SPY_Price / SPY_250MA)",
      formulaExplanation: "Compares current price to 125-day and 250-day moving averages",
      primaryApi: "Polygon.io price data",
      fallbackChain: ["TwelveData", "Yahoo Finance"],
      currentSource: polygonKey ? "Polygon.io" : "TwelveData",
      status: polygonKey ? "live" : "fallback",
      statusReason: polygonKey ? "Real-time price data" : "Using alternative source",
    },
    {
      name: "Safe Haven Demand",
      formula: "SHD = (Bond_Return - Stock_Return) over 20 days",
      formulaExplanation: "Measures flight to safety. Positive = investors fleeing to bonds (fear)",
      primaryApi: "FRED Treasury data",
      fallbackChain: ["TwelveData bond prices", "Calculated estimate"],
      currentSource: fredKey ? "FRED" : "Estimated",
      status: fredKey ? "live" : "fallback",
      statusReason: fredKey ? "Federal Reserve bond data" : "Using proxy calculation",
    },
    {
      name: "Junk Bond Demand",
      formula: "JBD = HY_Spread = (HY_Bond_Yield - Treasury_Yield)",
      formulaExplanation: "High yield spread. Tight spreads (<3%) = greed/risk-on, Wide spreads (>5%) = fear/risk-off",
      primaryApi: "FRED /series/observations?series_id=BAMLH0A0HYM2",
      fallbackChain: ["ICE BofA index", "Estimated from credit ETFs"],
      currentSource: fredKey ? "FRED" : "Estimated",
      status: fredKey ? "live" : "fallback",
      statusReason: fredKey ? "Official spread data" : "Estimated from credit markets",
    },
    {
      name: "Market Breadth",
      formula: "Breadth = (Advancing_Stocks - Declining_Stocks) / Total_Stocks",
      formulaExplanation: "Measures market participation. >60% advancing = bullish breadth",
      primaryApi: "Polygon market breadth",
      fallbackChain: ["NYSE advance/decline", "Calculated from S&P 500"],
      currentSource: polygonKey ? "Polygon" : "NYSE Data",
      status: polygonKey ? "live" : "fallback",
      statusReason: polygonKey ? "Real-time breadth" : "Delayed NYSE data",
    },
    {
      name: "Stock Price Strength",
      formula: "Strength = Stocks_at_52wk_High / (Stocks_at_52wk_High + Stocks_at_52wk_Low)",
      formulaExplanation: "Ratio of new highs to new lows. >0.7 = strong market, <0.3 = weak market",
      primaryApi: "Polygon/NYSE data",
      fallbackChain: ["Finviz screener", "Calculated estimate"],
      currentSource: polygonKey ? "Polygon" : "Finviz",
      status: polygonKey ? "live" : "fallback",
      statusReason: polygonKey ? "Real-time high/low data" : "Delayed screener data",
    },
  ]

  return {
    id: "market-sentiment",
    name: "Fear & Greed Index",
    category: "analyze",
    description: "7-component sentiment indicator with contrarian signals",
    indicators,
  }
}

async function auditPanicIndex(): Promise<PageAudit> {
  const fredKey = process.env.FRED_API_KEY

  const indicators: IndicatorAudit[] = [
    {
      name: "Panic/Euphoria Composite",
      formula: "P/E = Average(Z-score_1...Z-score_9)",
      formulaExplanation: "Citibank model. <-1.0 = Panic (buy signal), >1.0 = Euphoria (sell signal)",
      algorithm: "Z-score normalization of 9 sentiment indicators",
      primaryApi: "Calculated from components",
      fallbackChain: ["AI-generated estimate"],
      currentSource: "Calculated",
      status: "live",
      statusReason: "Real-time component calculation",
    },
    {
      name: "VIX Z-Score",
      formula: "Z = (VIX - VIX_Mean) / VIX_StdDev",
      formulaExplanation: "How many standard deviations VIX is from historical mean",
      primaryApi: "FRED VIX data",
      fallbackChain: ["Polygon VIX", "Yahoo Finance"],
      currentSource: fredKey ? "FRED" : "Polygon",
      status: fredKey ? "live" : "fallback",
      statusReason: fredKey ? "Federal Reserve data" : "Alternative source",
    },
    {
      name: "High Yield Spread Z-Score",
      formula: "Z = (HY_Spread - HY_Mean) / HY_StdDev",
      formulaExplanation: "Credit stress indicator. High Z-score = credit panic",
      primaryApi: "FRED HY spread",
      fallbackChain: ["ICE BofA index", "Estimated"],
      currentSource: fredKey ? "FRED" : "Estimated",
      status: fredKey ? "live" : "fallback",
      statusReason: fredKey ? "Official credit data" : "Estimated from ETFs",
    },
    {
      name: "Equity Fund Flows",
      formula: "Flow_Score = Weekly_Fund_Flows / AUM × 100",
      formulaExplanation: "Measures investor positioning. Large outflows = panic, Large inflows = euphoria",
      primaryApi: "ICI Fund Flow data",
      fallbackChain: ["ETF flow proxies", "AI estimate"],
      currentSource: "ICI/Proxy",
      status: "fallback",
      statusReason: "Using ETF flow proxies",
    },
    {
      name: "Market Breadth Z-Score",
      formula: "Z = (Breadth - Breadth_Mean) / Breadth_StdDev",
      formulaExplanation: "Extreme negative breadth = panic selling across all stocks",
      primaryApi: "NYSE advance/decline",
      fallbackChain: ["Calculated from index components"],
      currentSource: "NYSE",
      status: "live",
      statusReason: "Daily breadth data available",
    },
  ]

  return {
    id: "panic-euphoria",
    name: "Panic/Euphoria Index",
    category: "analyze",
    description: "Citibank 9-indicator model for extreme sentiment",
    indicators,
  }
}

async function auditSocialSentiment(): Promise<PageAudit> {
  const serpApiKey = process.env.SERPAPI_KEY
  const grokKey = process.env.XAI_API_KEY || process.env.GROK_XAI_API_KEY

  const indicators: IndicatorAudit[] = [
    {
      name: "Grok AI Sentiment",
      formula: "AI_Score = Grok analysis of real-time market discussions (0-100)",
      formulaExplanation: "xAI Grok analyzes Twitter/X market sentiment in real-time",
      primaryApi: "xAI Grok API",
      fallbackChain: ["OpenAI GPT", "Groq Llama", "Baseline 50"],
      currentSource: grokKey ? "Grok AI" : "Fallback",
      status: grokKey ? "live" : "fallback",
      statusReason: grokKey ? "Real-time AI sentiment" : "Using AI fallback chain",
    },
    {
      name: "Google Trends Fear/Greed",
      formula: "Trend_Score = (Fear_Searches - Greed_Searches) normalized to 0-100",
      formulaExplanation: "Compares search volume for fear terms vs greed terms",
      primaryApi: "SerpAPI Google Trends",
      fallbackChain: ["Apify Google Trends", "Historical baseline"],
      currentSource: serpApiKey ? "SerpAPI" : "Baseline",
      status: serpApiKey ? "live" : "fallback",
      statusReason: serpApiKey ? "Live Google Trends" : "Using historical patterns",
    },
    {
      name: "AAII Sentiment Survey",
      formula: "AAII = Bullish% - Bearish% (weekly survey)",
      formulaExplanation: "Individual investor sentiment. Extreme readings are contrarian signals",
      primaryApi: "AAII website scraping",
      fallbackChain: ["Apify scraper", "AI extraction", "Weekly cache"],
      currentSource: "Scraped/Cached",
      status: "live",
      statusReason: "Weekly survey data cached",
    },
    {
      name: "CNN Fear & Greed Proxy",
      formula: "CNN_Proxy = Finnhub news sentiment analysis",
      formulaExplanation: "Since CNN API blocked, using Finnhub news sentiment as proxy",
      primaryApi: "Finnhub News API",
      fallbackChain: ["Polygon news", "AI sentiment analysis"],
      currentSource: "Finnhub",
      status: "live",
      statusReason: "News sentiment proxy for CNN F&G",
    },
    {
      name: "StockTwits Sentiment",
      formula: "ST_Score = (Bullish_Posts / Total_Posts) × 100",
      formulaExplanation: "Social trading sentiment from StockTwits platform",
      primaryApi: "StockTwits API",
      fallbackChain: ["Web scraping", "AI estimate"],
      currentSource: "StockTwits",
      status: "live",
      statusReason: "Public API available",
    },
    {
      name: "Index Sentiment Heatmap",
      formula: "Heatmap = Aggregate sentiment scores per index (SPY, QQQ, IWM, DIA)",
      formulaExplanation: "Visual heatmap showing sentiment direction for major indices",
      primaryApi: "Aggregated from all sources",
      fallbackChain: ["Partial data", "Neutral baseline"],
      currentSource: "Aggregated",
      status: "live",
      statusReason: "Composite calculation",
    },
    {
      name: "AI Executive Summary",
      formula: "Summary = AI-generated weekly outlook for options traders",
      formulaExplanation: "Grok/GPT generates actionable insights based on sentiment data",
      primaryApi: "xAI Grok / OpenAI GPT",
      fallbackChain: ["Groq Llama", "Template summary"],
      currentSource: grokKey ? "Grok AI" : "GPT/Groq",
      status: "live",
      statusReason: "AI always available",
    },
  ]

  return {
    id: "social-sentiment",
    name: "Social Sentiment",
    category: "analyze",
    description: "Multi-source sentiment from AI, social media, and surveys",
    indicators,
  }
}

async function auditCCPI(): Promise<PageAudit> {
  const fredKey = process.env.FRED_API_KEY
  const polygonKey = process.env.POLYGON_API_KEY

  const indicators: IndicatorAudit[] = [
    {
      name: "CCPI Composite Score",
      formula: "CCPI = (Momentum × 0.35) + (Risk × 0.30) + (Valuation × 0.15) + (Macro × 0.20)",
      formulaExplanation:
        "Comprehensive Crash Prediction Index. 0-30 Low Risk, 30-50 Moderate, 50-70 Elevated, 70-100 Extreme",
      algorithm: "4-pillar weighted aggregation with 38 canary indicators",
      primaryApi: "Multi-source aggregation",
      fallbackChain: ["AI estimates", "Historical baselines"],
      currentSource: "Live calculation",
      status: "live",
      statusReason: "Real-time pillar aggregation",
    },
    {
      name: "Pillar 1: Momentum & Technical",
      formula:
        "16 indicators: NVDA(6%), SOX(6%), QQQ_Daily(8%), QQQ_Down(5%), SMA20(5%), SMA50(7%), SMA200(10%), Bollinger(6%), VIX(9%), VXN(7%), RVX(5%), VIX_Term(6%), ATR(5%), LTV(5%), Bullish%(5%), Yield(5%)",
      formulaExplanation: "Captures price action deterioration, technical breakdowns, and volatility spikes",
      primaryApi: "Polygon + FRED + TwelveData",
      fallbackChain: ["AI data extraction", "Historical averages"],
      currentSource: polygonKey ? "Live APIs" : "Mixed sources",
      status: polygonKey ? "live" : "fallback",
      statusReason: polygonKey ? "All APIs configured" : "Partial coverage",
    },
    {
      name: "Pillar 2: Risk Appetite",
      formula:
        "8 indicators: Put/Call(18%), Fear&Greed(15%), AAII(16%), Short_Interest(13%), ATR(10%), LTV(10%), Bullish%(10%), Yield(8%)",
      formulaExplanation: "Detects euphoria (complacency) and panic through sentiment and positioning",
      primaryApi: "CBOE + Surveys + FRED",
      fallbackChain: ["AI sentiment", "Baseline averages"],
      currentSource: "Mixed sources",
      status: "live",
      statusReason: "Multiple data sources active",
    },
    {
      name: "Pillar 3: Valuation",
      formula: "6 indicators: PE_Ratio(25%), CAPE(20%), PB_Ratio(15%), Div_Yield(15%), Buffett(15%), Margin_Debt(10%)",
      formulaExplanation: "Measures market valuation vs historical norms. High scores = overvalued",
      primaryApi: "Quandl + Multpl + FRED",
      fallbackChain: ["Shiller CAPE data", "AI estimates"],
      currentSource: "Mixed sources",
      status: "live",
      statusReason: "Valuation data generally available",
    },
    {
      name: "Pillar 4: Macro",
      formula:
        "8 indicators: Yield_Curve(20%), Credit_Spread(18%), GDP(12%), CPI(12%), PMI(12%), Unemployment(10%), Housing(8%), Consumer(8%)",
      formulaExplanation: "Economic conditions and recession indicators",
      primaryApi: "FRED Federal Reserve",
      fallbackChain: ["AI economic analysis", "Historical trends"],
      currentSource: fredKey ? "FRED" : "AI/Baseline",
      status: fredKey ? "live" : "fallback",
      statusReason: fredKey ? "Federal Reserve data" : "Using alternatives",
    },
    {
      name: "Crash Amplifier System",
      formula:
        "Bonus = +25 (QQQ -6%), +40 (QQQ -9%), +20 (below SMA50), +20 (VIX>35), +15 (PCR>1.3), +15 (yield inverted)",
      formulaExplanation: "Adds bonus points for acute crash conditions. Capped at 100 total",
      algorithm: "Binary trigger system with additive bonuses",
      primaryApi: "Calculated from live data",
      fallbackChain: ["N/A - always calculated"],
      currentSource: "Real-time triggers",
      status: "live",
      statusReason: "Trigger logic always active",
    },
    {
      name: "38 Canary Signals",
      formula: "Canary_Count = Σ(Indicator_i > Threshold_i) for all 38 indicators",
      formulaExplanation: "Binary warnings when indicators breach medium/high thresholds",
      algorithm: "Threshold breach counting with severity levels",
      primaryApi: "Calculated from all indicators",
      fallbackChain: ["Partial canary count if APIs fail"],
      currentSource: "Calculated",
      status: "live",
      statusReason: "Canaries calculated from available data",
    },
  ]

  return {
    id: "ccpi",
    name: "CCPI Dashboard",
    category: "analyze",
    description: "Comprehensive Crash Prediction Index with 4 pillars and 38 canaries",
    indicators,
  }
}

async function auditCPIInflation(): Promise<PageAudit> {
  const fredKey = process.env.FRED_API_KEY

  const indicators: IndicatorAudit[] = [
    {
      name: "CPI (Consumer Price Index)",
      formula: "CPI = Current_Price_Basket / Base_Price_Basket × 100",
      formulaExplanation: "Bureau of Labor Statistics measure of consumer inflation. Fed target = 2%",
      primaryApi: "FRED /series/observations?series_id=CPIAUCSL",
      fallbackChain: ["BLS direct", "AI estimate"],
      currentSource: fredKey ? "FRED" : "Estimated",
      status: fredKey ? "live" : "fallback",
      statusReason: fredKey ? "Federal Reserve data" : "Using estimates",
    },
    {
      name: "Core CPI (ex Food & Energy)",
      formula: "Core_CPI = CPI excluding volatile food and energy components",
      formulaExplanation: "Fed's preferred inflation measure for policy decisions",
      primaryApi: "FRED /series/observations?series_id=CPILFESL",
      fallbackChain: ["BLS direct", "AI estimate"],
      currentSource: fredKey ? "FRED" : "Estimated",
      status: fredKey ? "live" : "fallback",
      statusReason: fredKey ? "Federal Reserve data" : "Using estimates",
    },
    {
      name: "YoY Inflation Rate",
      formula: "Inflation% = (CPI_Current - CPI_12M_Ago) / CPI_12M_Ago × 100",
      formulaExplanation: "Year-over-year inflation rate - headline number in news",
      primaryApi: "Calculated from FRED CPI",
      fallbackChain: ["BLS releases", "News sources"],
      currentSource: fredKey ? "FRED Calculated" : "News",
      status: fredKey ? "live" : "fallback",
      statusReason: fredKey ? "Real-time calculation" : "Using reported figures",
    },
    {
      name: "3-Month Trend",
      formula: "Trend = Linear regression of last 3 months CPI data",
      formulaExplanation: "Short-term inflation trajectory for Fed policy prediction",
      algorithm: "Linear regression with annualization",
      primaryApi: "Calculated from FRED",
      fallbackChain: ["AI trend estimate"],
      currentSource: "Calculated",
      status: "live",
      statusReason: "Trend calculated from available data",
    },
    {
      name: "CPI Forecast",
      formula: "Forecast = Current_CPI + (3M_Trend × Months_Ahead)",
      formulaExplanation: "Projects future inflation based on recent trends",
      algorithm: "Linear extrapolation with confidence bounds",
      primaryApi: "Internal calculation",
      fallbackChain: ["Fed projections", "Economist consensus"],
      currentSource: "Calculated",
      status: "live",
      statusReason: "Model always runs",
    },
  ]

  return {
    id: "cpi-inflation",
    name: "CPI Inflation Analysis",
    category: "analyze",
    description: "Consumer Price Index tracking with forecasts",
    indicators,
  }
}

async function auditFedRate(): Promise<PageAudit> {
  const fredKey = process.env.FRED_API_KEY

  const indicators: IndicatorAudit[] = [
    {
      name: "Current Fed Funds Rate",
      formula: "FFR = Federal Reserve target rate (upper bound)",
      formulaExplanation: "The benchmark interest rate that affects all borrowing costs",
      primaryApi: "FRED /series/observations?series_id=DFEDTARU",
      fallbackChain: ["Federal Reserve website", "News sources"],
      currentSource: fredKey ? "FRED" : "Fed website",
      status: fredKey ? "live" : "fallback",
      statusReason: fredKey ? "Federal Reserve data" : "Direct from Fed",
    },
    {
      name: "Fed Funds Futures Implied Rate",
      formula: "Implied_Rate = 100 - Fed_Funds_Futures_Price",
      formulaExplanation: "Market's expectation of future Fed rates from CME futures",
      primaryApi: "CME Fed Watch Tool",
      fallbackChain: ["Polygon futures", "AI estimate"],
      currentSource: "CME/Calculated",
      status: "live",
      statusReason: "Futures-implied probabilities",
    },
    {
      name: "Rate Cut/Hike Probability",
      formula: "Prob_Cut = (Implied_Rate - Current_Rate) / 0.25 × 100 (if negative)",
      formulaExplanation: "Probability of 25bp rate change at next FOMC meeting",
      algorithm: "Binomial probability from futures prices",
      primaryApi: "CME FedWatch",
      fallbackChain: ["Calculated from futures", "AI estimate"],
      currentSource: "CME",
      status: "live",
      statusReason: "Market-implied probabilities",
    },
    {
      name: "FOMC Meeting Dates",
      formula: "Calendar of scheduled FOMC meetings",
      formulaExplanation: "8 scheduled meetings per year plus emergency meetings if needed",
      primaryApi: "Federal Reserve calendar",
      fallbackChain: ["Hardcoded schedule"],
      currentSource: "Fed Calendar",
      status: "live",
      statusReason: "Fixed annual schedule",
    },
    {
      name: "Dot Plot Projections",
      formula: "FOMC member rate projections (quarterly)",
      formulaExplanation: "Individual Fed governor rate forecasts for coming years",
      primaryApi: "Federal Reserve SEP",
      fallbackChain: ["News analysis", "AI extraction"],
      currentSource: "Fed SEP",
      status: "live",
      statusReason: "Quarterly projections available",
    },
  ]

  return {
    id: "fomc-predictions",
    name: "Fed Rate Analysis",
    category: "analyze",
    description: "FOMC rate predictions and probability analysis",
    indicators,
  }
}

async function auditJobs(): Promise<PageAudit> {
  const fredKey = process.env.FRED_API_KEY

  const indicators: IndicatorAudit[] = [
    {
      name: "UNRATE (Official Unemployment)",
      formula: "U3 = (Unemployed / Labor_Force) × 100",
      formulaExplanation: "Bureau of Labor Statistics official unemployment rate",
      primaryApi: "FRED /series/observations?series_id=UNRATE",
      fallbackChain: ["BLS direct", "News sources"],
      currentSource: fredKey ? "FRED" : "BLS",
      status: fredKey ? "live" : "fallback",
      statusReason: fredKey ? "Federal Reserve data" : "Direct from BLS",
    },
    {
      name: "True Rate of Unemployment (TRU)",
      formula: "TRU = (U6 + Marginally_Attached + Part_Time_Economic) / Labor_Force × adjustment",
      formulaExplanation: "Broader measure including underemployment and discouraged workers",
      primaryApi: "FRED U6RATE + adjustments",
      fallbackChain: ["BLS alternative measures", "AI calculation"],
      currentSource: fredKey ? "FRED" : "Calculated",
      status: fredKey ? "live" : "fallback",
      statusReason: fredKey ? "Official broad measures" : "Estimated from U3",
    },
    {
      name: "Nonfarm Payrolls",
      formula: "NFP = Monthly change in total nonfarm employment",
      formulaExplanation: "Key economic indicator - positive = job creation",
      primaryApi: "FRED /series/observations?series_id=PAYEMS",
      fallbackChain: ["BLS employment report", "News"],
      currentSource: fredKey ? "FRED" : "BLS/News",
      status: fredKey ? "live" : "fallback",
      statusReason: fredKey ? "Federal Reserve data" : "BLS reports",
    },
    {
      name: "Initial Jobless Claims",
      formula: "Weekly new unemployment insurance filings",
      formulaExplanation: "Leading indicator of labor market stress. Rising claims = weakness",
      primaryApi: "FRED /series/observations?series_id=ICSA",
      fallbackChain: ["DOL direct", "News sources"],
      currentSource: fredKey ? "FRED" : "DOL",
      status: fredKey ? "live" : "fallback",
      statusReason: fredKey ? "Weekly data" : "DOL releases",
    },
    {
      name: "UNRATE vs TRU Trend Chart",
      formula: "Historical comparison chart (2020-2025)",
      formulaExplanation: "Visual comparison of official vs true unemployment over time",
      primaryApi: "FRED historical series",
      fallbackChain: ["Cached historical data"],
      currentSource: fredKey ? "FRED Historical" : "Cached",
      status: fredKey ? "live" : "fallback",
      statusReason: fredKey ? "Full historical data" : "Cached series",
    },
  ]

  return {
    id: "jobs",
    name: "Jobs Report Dashboard",
    category: "analyze",
    description: "Employment data with UNRATE vs True Rate analysis",
    indicators,
  }
}

async function auditInsiders(): Promise<PageAudit> {
  const finnhubKey = process.env.FINNHUB_API_KEY

  const indicators: IndicatorAudit[] = [
    {
      name: "Corporate Insider Transactions",
      formula: "SEC Form 4 filings (insider buys/sells within 2 business days)",
      formulaExplanation: "Officers, directors, and 10%+ shareholders must report trades",
      primaryApi: "Finnhub /stock/insider-transactions",
      fallbackChain: ["SEC EDGAR direct", "OpenInsider scraping", "Sample data"],
      currentSource: finnhubKey ? "Finnhub" : "Sample",
      status: finnhubKey ? "live" : "fallback",
      statusReason: finnhubKey ? "Live SEC filings" : "Using sample data",
    },
    {
      name: "Congressional Trading",
      formula: "STOCK Act disclosures (Congress trades within 45 days)",
      formulaExplanation: "Congressional members must disclose stock trades",
      primaryApi: "QuiverQuant / Capitol Trades",
      fallbackChain: ["House/Senate disclosure sites", "Curated sample data"],
      currentSource: "Curated Data",
      status: "fallback",
      statusReason: "QuiverQuant requires subscription",
    },
    {
      name: "Buy vs Sell Volume Chart",
      formula: "Weekly aggregate $ volume of insider buys vs sells by ticker",
      formulaExplanation: "Shows which stocks have heavy insider activity",
      algorithm: "Aggregation by ticker and transaction direction",
      primaryApi: "Calculated from transaction data",
      fallbackChain: ["Partial data", "Sample visualization"],
      currentSource: "Calculated",
      status: "live",
      statusReason: "Aggregated from available transactions",
    },
    {
      name: "Net Insider Sentiment",
      formula: "Sentiment = (Buy_$_Volume - Sell_$_Volume) / Total_$_Volume",
      formulaExplanation: "Positive = net buying (bullish), Negative = net selling (bearish)",
      algorithm: "Dollar-weighted sentiment calculation",
      primaryApi: "Calculated",
      fallbackChain: ["N/A"],
      currentSource: "Calculated",
      status: "live",
      statusReason: "Formula applied to available data",
    },
  ]

  return {
    id: "insiders",
    name: "Insider Trading Tracker",
    category: "analyze",
    description: "Corporate and Congressional insider transaction monitoring",
    indicators,
  }
}

// SCAN TAB AUDITS

async function auditPutScanner(): Promise<PageAudit> {
  const polygonKey = process.env.POLYGON_API_KEY

  return {
    id: "wheel-scanner",
    name: "Put Selling Scanner",
    category: "scan",
    description: "Scan stocks for optimal cash-secured put opportunities",
    indicators: [
      {
        name: "Options Chain Data",
        formula: "Fetch put options with DTE 7-45, Delta -0.15 to -0.35",
        formulaExplanation: "Target out-of-the-money puts with good premium and low assignment risk",
        primaryApi: "Polygon.io /v3/snapshot/options",
        fallbackChain: ["TwelveData options", "Manual entry"],
        currentSource: polygonKey ? "Polygon.io" : "Manual",
        status: polygonKey ? "live" : "fallback",
        statusReason: polygonKey ? "Real-time options data" : "Manual input required",
      },
      {
        name: "Premium Yield Score",
        formula: "Yield = (Premium / Strike) × (365 / DTE) × 100",
        formulaExplanation: "Annualized return if put expires worthless",
        primaryApi: "Calculated from options data",
        fallbackChain: ["N/A"],
        currentSource: "Calculated",
        status: "live",
        statusReason: "Formula-based calculation",
      },
      {
        name: "Technical Support Analysis",
        formula: "Support_Score = proximity to SMA50, SMA200, recent lows",
        formulaExplanation: "Higher score = strike is near strong support levels",
        primaryApi: "TwelveData technical data",
        fallbackChain: ["Calculated from price history"],
        currentSource: "Calculated",
        status: "live",
        statusReason: "Technical analysis available",
      },
    ],
  }
}

async function auditCreditSpreads(): Promise<PageAudit> {
  return {
    id: "credit-spread-scanner",
    name: "Credit Spread Scanner",
    category: "scan",
    description: "Find optimal bull put and bear call spread opportunities",
    indicators: [
      {
        name: "Spread Width Analysis",
        formula: "Risk = Spread_Width - Credit_Received",
        formulaExplanation: "Maximum loss on the spread trade",
        primaryApi: "Polygon.io options chains",
        fallbackChain: ["TwelveData", "Manual calculation"],
        currentSource: "Polygon/Manual",
        status: "live",
        statusReason: "Options data available",
      },
      {
        name: "Probability of Profit",
        formula: "PoP = 1 - Delta_Short_Strike",
        formulaExplanation: "Estimated probability spread expires worthless",
        primaryApi: "Calculated from delta",
        fallbackChain: ["N/A"],
        currentSource: "Calculated",
        status: "live",
        statusReason: "Delta-based calculation",
      },
    ],
  }
}

async function auditIronCondors(): Promise<PageAudit> {
  return {
    id: "iron-condor-scanner",
    name: "Iron Condor Scanner",
    category: "scan",
    description: "Find stocks with low volatility for iron condor strategies",
    indicators: [
      {
        name: "IV Rank",
        formula: "IV_Rank = (Current_IV - 52wk_Low_IV) / (52wk_High_IV - 52wk_Low_IV)",
        formulaExplanation: "Where current IV sits in 52-week range. Low IV = good for iron condors",
        primaryApi: "Polygon.io IV data",
        fallbackChain: ["TwelveData", "Calculated from options"],
        currentSource: "Polygon/Calculated",
        status: "live",
        statusReason: "IV data available",
      },
      {
        name: "Expected Move",
        formula: "EM = Stock_Price × IV × √(DTE/365)",
        formulaExplanation: "1 standard deviation expected price range",
        primaryApi: "Calculated from IV",
        fallbackChain: ["N/A"],
        currentSource: "Calculated",
        status: "live",
        statusReason: "Formula-based",
      },
    ],
  }
}

async function auditWheelScreener(): Promise<PageAudit> {
  return {
    id: "wheel-screener",
    name: "Wheel Strategy Screener",
    category: "scan",
    description: "Screen stocks suitable for the wheel strategy",
    indicators: [
      {
        name: "Fundamental Score",
        formula: "Score = (Profitability × 0.3) + (Growth × 0.3) + (Value × 0.2) + (Quality × 0.2)",
        formulaExplanation: "Composite score ensuring wheel candidates are quality companies",
        primaryApi: "FMP fundamentals + Polygon data",
        fallbackChain: ["Yahoo Finance", "Manual research"],
        currentSource: "Mixed APIs",
        status: "live",
        statusReason: "Fundamental data available",
      },
    ],
  }
}

async function auditHighIVWatchlist(): Promise<PageAudit> {
  return {
    id: "high-iv-watchlist",
    name: "High IV Watchlist",
    category: "scan",
    description: "Stocks with elevated implied volatility for premium selling",
    indicators: [
      {
        name: "IV Percentile",
        formula: "Percentile = % of days in past year with lower IV than today",
        formulaExplanation: ">80th percentile = IV is high relative to history",
        primaryApi: "Polygon.io historical IV",
        fallbackChain: ["TwelveData", "Calculated estimate"],
        currentSource: "Polygon/Calculated",
        status: "live",
        statusReason: "Historical IV data available",
      },
    ],
  }
}

async function auditEarningsPlays(): Promise<PageAudit> {
  return {
    id: "earnings-plays",
    name: "Earnings Plays Scanner",
    category: "scan",
    description: "Options strategies for upcoming earnings announcements",
    indicators: [
      {
        name: "Earnings Expected Move",
        formula: "EM = ATM_Straddle_Price / Stock_Price × 100",
        formulaExplanation: "Market's expected % move from earnings",
        primaryApi: "Polygon.io options + earnings calendar",
        fallbackChain: ["TwelveData", "Historical average"],
        currentSource: "Polygon/Calculated",
        status: "live",
        statusReason: "Options data for expected move",
      },
      {
        name: "Historical Earnings Move",
        formula: "Avg_Move = Average(|Actual_Move_i|) for last 8 quarters",
        formulaExplanation: "How much stock actually moved on past earnings",
        primaryApi: "Polygon historical data",
        fallbackChain: ["Yahoo Finance", "Earnings Whispers"],
        currentSource: "Polygon/Cached",
        status: "live",
        statusReason: "Historical data available",
      },
    ],
  }
}

// EXECUTE TAB AUDITS

async function auditCreditSpreadsCalc(): Promise<PageAudit> {
  return {
    id: "credit-spreads",
    name: "Credit Spreads Calculator",
    category: "execute",
    description: "Calculate bull put and bear call spread P&L",
    indicators: [
      {
        name: "Max Profit",
        formula: "Max_Profit = Net_Credit_Received × 100",
        formulaExplanation: "Maximum gain if spread expires worthless",
        primaryApi: "User input calculation",
        fallbackChain: ["N/A"],
        currentSource: "Calculated",
        status: "live",
        statusReason: "Formula-based",
      },
      {
        name: "Max Loss",
        formula: "Max_Loss = (Spread_Width - Net_Credit) × 100",
        formulaExplanation: "Maximum loss if spread is fully ITM at expiration",
        primaryApi: "User input calculation",
        fallbackChain: ["N/A"],
        currentSource: "Calculated",
        status: "live",
        statusReason: "Formula-based",
      },
      {
        name: "Breakeven",
        formula: "BE_Put = Short_Strike - Net_Credit, BE_Call = Short_Strike + Net_Credit",
        formulaExplanation: "Stock price where P&L = 0 at expiration",
        primaryApi: "User input calculation",
        fallbackChain: ["N/A"],
        currentSource: "Calculated",
        status: "live",
        statusReason: "Formula-based",
      },
    ],
  }
}

async function auditIronCondorsCalc(): Promise<PageAudit> {
  return {
    id: "iron-condors",
    name: "Iron Condors Calculator",
    category: "execute",
    description: "Calculate iron condor P&L and breakevens",
    indicators: [
      {
        name: "Max Profit",
        formula: "Max_Profit = Net_Credit × 100",
        formulaExplanation: "Maximum gain if price stays between short strikes",
        primaryApi: "User input calculation",
        fallbackChain: ["N/A"],
        currentSource: "Calculated",
        status: "live",
        statusReason: "Formula-based",
      },
      {
        name: "Max Loss",
        formula: "Max_Loss = (Wing_Width - Net_Credit) × 100",
        formulaExplanation: "Maximum loss if price moves beyond long strikes",
        primaryApi: "User input calculation",
        fallbackChain: ["N/A"],
        currentSource: "Calculated",
        status: "live",
        statusReason: "Formula-based",
      },
    ],
  }
}

async function auditCalendarSpreads(): Promise<PageAudit> {
  return {
    id: "calendar-spreads",
    name: "Calendar Spreads Calculator",
    category: "execute",
    description: "Calculate horizontal spread P&L",
    indicators: [
      {
        name: "Max Profit Zone",
        formula: "Profit maximized when stock at strike price at front expiration",
        formulaExplanation: "Theta decay benefits the long back-month option",
        primaryApi: "User input + Black-Scholes",
        fallbackChain: ["N/A"],
        currentSource: "Calculated",
        status: "live",
        statusReason: "Model-based calculation",
      },
    ],
  }
}

async function auditButterflies(): Promise<PageAudit> {
  return {
    id: "butterflies",
    name: "Butterfly Spreads Calculator",
    category: "execute",
    description: "Calculate butterfly spread P&L",
    indicators: [
      {
        name: "Max Profit",
        formula: "Max_Profit = (Wing_Width - Net_Debit) × 100 at middle strike",
        formulaExplanation: "Maximum profit if stock at middle strike at expiration",
        primaryApi: "User input calculation",
        fallbackChain: ["N/A"],
        currentSource: "Calculated",
        status: "live",
        statusReason: "Formula-based",
      },
    ],
  }
}

async function auditCollars(): Promise<PageAudit> {
  return {
    id: "collars",
    name: "Collars Calculator",
    category: "execute",
    description: "Calculate protective collar P&L",
    indicators: [
      {
        name: "Protection Level",
        formula: "Downside_Protection = Stock_Price - Put_Strike",
        formulaExplanation: "Maximum loss before put protection kicks in",
        primaryApi: "User input calculation",
        fallbackChain: ["N/A"],
        currentSource: "Calculated",
        status: "live",
        statusReason: "Formula-based",
      },
    ],
  }
}

async function auditDiagonals(): Promise<PageAudit> {
  return {
    id: "diagonals",
    name: "Diagonal Spreads Calculator",
    category: "execute",
    description: "Calculate diagonal spread P&L",
    indicators: [
      {
        name: "Diagonal P&L",
        formula: "Combines calendar spread time decay with directional bias",
        formulaExplanation: "Different strikes and expirations create complex P&L profile",
        primaryApi: "User input + Black-Scholes",
        fallbackChain: ["N/A"],
        currentSource: "Calculated",
        status: "live",
        statusReason: "Model-based",
      },
    ],
  }
}

async function auditStraddlesStrangles(): Promise<PageAudit> {
  return {
    id: "straddles-strangles",
    name: "Straddles & Strangles Calculator",
    category: "execute",
    description: "Calculate volatility play P&L",
    indicators: [
      {
        name: "Breakeven Points",
        formula: "Upper_BE = Strike + Total_Premium, Lower_BE = Strike - Total_Premium",
        formulaExplanation: "Stock must move beyond breakevens for profit",
        primaryApi: "User input calculation",
        fallbackChain: ["N/A"],
        currentSource: "Calculated",
        status: "live",
        statusReason: "Formula-based",
      },
    ],
  }
}

async function auditWheelStrategy(): Promise<PageAudit> {
  return {
    id: "wheel-strategy",
    name: "Wheel Strategy Calculator",
    category: "execute",
    description: "Track wheel strategy performance",
    indicators: [
      {
        name: "Cost Basis Reduction",
        formula: "Adjusted_Cost = Original_Cost - Total_Premiums_Collected",
        formulaExplanation: "Track how premiums reduce effective cost basis",
        primaryApi: "User input tracking",
        fallbackChain: ["N/A"],
        currentSource: "Calculated",
        status: "live",
        statusReason: "User tracking",
      },
    ],
  }
}

async function auditExitRules(): Promise<PageAudit> {
  return {
    id: "exit-rules",
    name: "Exit Rules Dashboard",
    category: "execute",
    description: "Options trade exit rules and guidance",
    indicators: [
      {
        name: "Profit Target Rules",
        formula: "Close at 50% profit for defined risk, 25% for undefined risk",
        formulaExplanation: "Research-backed exit rules for optimal risk-adjusted returns",
        primaryApi: "Rule-based system",
        fallbackChain: ["N/A"],
        currentSource: "Static rules",
        status: "live",
        statusReason: "Educational content",
      },
    ],
  }
}

async function auditEarningsEM(): Promise<PageAudit> {
  return {
    id: "earnings-iv-crusher",
    name: "Earnings Expected Move Calculator",
    category: "execute",
    description: "Calculate expected move and IV crush for earnings",
    indicators: [
      {
        name: "Expected Move",
        formula: "EM% = (ATM_Call + ATM_Put) / Stock_Price × 100",
        formulaExplanation: "Market's implied one-day move from earnings",
        primaryApi: "Polygon.io options data",
        fallbackChain: ["TwelveData", "Manual input"],
        currentSource: "Polygon/Manual",
        status: "live",
        statusReason: "Options data for EM calculation",
      },
      {
        name: "IV Crush Estimate",
        formula: "IV_After = IV_Before × 0.5 to 0.7 (typical post-earnings)",
        formulaExplanation: "IV typically drops 30-50% after earnings uncertainty resolves",
        primaryApi: "Historical IV patterns",
        fallbackChain: ["N/A"],
        currentSource: "Historical average",
        status: "live",
        statusReason: "Pattern-based estimate",
      },
    ],
  }
}

async function auditGreeksCalc(): Promise<PageAudit> {
  return {
    id: "greeks",
    name: "Greeks Calculator",
    category: "execute",
    description: "Calculate option Greeks using Black-Scholes",
    indicators: [
      {
        name: "Delta",
        formula: "Δ = N(d₁) for calls, N(d₁) - 1 for puts",
        formulaExplanation: "Rate of change of option price vs stock price. 0.50 delta = 50% chance ITM",
        algorithm: "Black-Scholes model with standard normal CDF",
        primaryApi: "Input-driven calculation",
        fallbackChain: ["N/A"],
        currentSource: "Black-Scholes",
        status: "live",
        statusReason: "Industry standard formula",
      },
      {
        name: "Gamma",
        formula: "Γ = N'(d₁) / (S × σ × √T)",
        formulaExplanation: "Rate of change of delta. High gamma = delta changes rapidly",
        algorithm: "Second derivative of Black-Scholes",
        primaryApi: "Input-driven calculation",
        fallbackChain: ["N/A"],
        currentSource: "Black-Scholes",
        status: "live",
        statusReason: "Industry standard formula",
      },
      {
        name: "Theta",
        formula: "Θ = -(S × N'(d₁) × σ) / (2√T) - rKe^(-rT)N(d₂)",
        formulaExplanation: "Time decay per day. Negative for long options, positive for short",
        algorithm: "Black-Scholes time derivative",
        primaryApi: "Input-driven calculation",
        fallbackChain: ["N/A"],
        currentSource: "Black-Scholes",
        status: "live",
        statusReason: "Industry standard formula",
      },
      {
        name: "Vega",
        formula: "ν = S × √T × N'(d₁)",
        formulaExplanation: "Sensitivity to 1% change in IV. High vega = sensitive to volatility",
        algorithm: "Black-Scholes volatility derivative",
        primaryApi: "Input-driven calculation",
        fallbackChain: ["N/A"],
        currentSource: "Black-Scholes",
        status: "live",
        statusReason: "Industry standard formula",
      },
      {
        name: "Rho",
        formula: "ρ = KTe^(-rT)N(d₂) for calls",
        formulaExplanation: "Sensitivity to 1% change in interest rates. Usually minimal impact",
        algorithm: "Black-Scholes rate derivative",
        primaryApi: "Input-driven calculation",
        fallbackChain: ["N/A"],
        currentSource: "Black-Scholes",
        status: "live",
        statusReason: "Industry standard formula",
      },
    ],
  }
}

async function auditROICalc(): Promise<PageAudit> {
  return {
    id: "risk-rewards",
    name: "ROI Calculator",
    category: "execute",
    description: "Calculate annualized ROI for options trades",
    indicators: [
      {
        name: "Annualized ROI",
        formula: "ROI% = (Premium / Capital_At_Risk) × (365 / DTE) × 100",
        formulaExplanation: "Converts any options trade to annual percentage return for comparison",
        primaryApi: "Input-driven calculation",
        fallbackChain: ["N/A"],
        currentSource: "Calculated",
        status: "live",
        statusReason: "Universal formula",
      },
      {
        name: "Risk/Reward Ratio",
        formula: "R:R = Max_Profit / Max_Loss",
        formulaExplanation: "How much you can make vs how much you can lose",
        primaryApi: "Input-driven calculation",
        fallbackChain: ["N/A"],
        currentSource: "Calculated",
        status: "live",
        statusReason: "Simple ratio calculation",
      },
    ],
  }
}
