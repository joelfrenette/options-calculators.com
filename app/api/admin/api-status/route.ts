import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const protocol = request.headers.get("x-forwarded-proto") || "http"
  const host = request.headers.get("host") || "localhost:3000"
  const baseUrl = `${protocol}://${host}`

  const dataSources = [
    // PILLAR 1: VALUATION STRESS
    {
      indicator: "Buffett Indicator",
      pillar: "Valuation",
      primary: { name: "CurrentMarketValuation.com", url: "https://www.currentmarketvaluation.com/models/buffett-indicator.php" },
      secondary: { name: "GuruFocus", url: "https://www.gurufocus.com/stock-market-valuations.php" },
      tertiary: { name: "FRED GDP Calculation", url: `${baseUrl}/api/fred-proxy?series=GDP` }
    },
    {
      indicator: "S&P 500 Forward P/E",
      pillar: "Valuation",
      primary: { name: "Apify Yahoo Finance Actor", url: "apify-actor-api", key: process.env.APIFY_API_TOKEN },
      secondary: { name: "Yahoo Finance API (Direct)", url: "yahoo-finance-api", key: "public" },
      tertiary: { name: "Multpl.com", url: "https://www.multpl.com/s-p-500-pe-ratio/table/by-month" }
    },
    {
      indicator: "S&P 500 Price-to-Sales",
      pillar: "Valuation",
      primary: { name: "Apify Yahoo Finance Actor", url: "apify-actor-api", key: process.env.APIFY_API_TOKEN },
      secondary: { name: "Yahoo Finance API (Direct)", url: "yahoo-finance-api", key: "public" },
      tertiary: { name: "Multpl.com", url: "https://www.multpl.com/s-p-500-price-to-sales/table/by-month" }
    },
    
    // PILLAR 2: TECHNICAL FRAGILITY
    {
      indicator: "VIX",
      pillar: "Technical",
      primary: { name: "Alpha Vantage API", url: `alpha-vantage-api`, key: process.env.ALPHA_VANTAGE_API_KEY },
      secondary: { name: "Yahoo Finance", url: "https://finance.yahoo.com/quote/%5EVIX" },
      tertiary: { name: "CBOE", url: "https://www.cboe.com/tradable_products/vix/" }
    },
    {
      indicator: "VXN",
      pillar: "Technical",
      primary: { name: "Alpha Vantage API", url: `alpha-vantage-api`, key: process.env.ALPHA_VANTAGE_API_KEY },
      secondary: { name: "Yahoo Finance", url: "https://finance.yahoo.com/quote/%5EVXN" },
      tertiary: null
    },
    {
      indicator: "High-Low Index",
      pillar: "Technical",
      primary: { name: "Historical Average (42%)", url: "baseline" },
      secondary: { name: "StockCharts", url: "https://stockcharts.com/h-sc/ui" },
      tertiary: null
    },
    {
      indicator: "Bullish Percent Index",
      pillar: "Technical",
      primary: { name: "Historical Average (58%)", url: "baseline" },
      secondary: { name: "StockCharts", url: "https://stockcharts.com/h-sc/ui?s=$BPSPX" },
      tertiary: null
    },
    {
      indicator: "Left Tail Volatility",
      pillar: "Technical",
      primary: { name: "CBOE SKEW Index", url: "https://www.cboe.com/tradable_products/vix/skew_index/" },
      secondary: { name: "Calculated from VIX", url: `${baseUrl}/api/ccpi` },
      tertiary: null
    },
    {
      indicator: "ATR",
      pillar: "Technical",
      primary: { name: "Alpha Vantage API", url: `alpha-vantage-api`, key: process.env.ALPHA_VANTAGE_API_KEY },
      secondary: { name: "TradingView", url: "https://www.tradingview.com/symbols/SPY/technicals/" },
      tertiary: null
    },
    
    // PILLAR 3: MACRO & LIQUIDITY RISK
    {
      indicator: "Fed Funds Rate",
      pillar: "Macro",
      primary: { name: "FRED API", url: `fred-api`, key: process.env.FRED_API_KEY },
      secondary: null,
      tertiary: null
    },
    {
      indicator: "Junk Bond Spread",
      pillar: "Macro",
      primary: { name: "FRED API", url: `fred-api`, key: process.env.FRED_API_KEY },
      secondary: null,
      tertiary: null
    },
    {
      indicator: "Yield Curve (10Y-2Y)",
      pillar: "Macro",
      primary: { name: "FRED API", url: `fred-api`, key: process.env.FRED_API_KEY },
      secondary: null,
      tertiary: null
    },
    
    // PILLAR 4: SENTIMENT
    {
      indicator: "AAII Bullish Sentiment",
      pillar: "Sentiment",
      primary: { name: "AAII.com", url: "https://www.aaii.com/sentimentsurvey" },
      secondary: { name: "Yahoo Finance News", url: "https://finance.yahoo.com/news/" },
      tertiary: { name: "Baseline (Updated Quarterly)", url: "baseline" }
    },
    {
      indicator: "AAII Bearish Sentiment",
      pillar: "Sentiment",
      primary: { name: "AAII.com", url: "https://www.aaii.com/sentimentsurvey" },
      secondary: { name: "Yahoo Finance News", url: "https://finance.yahoo.com/news/" },
      tertiary: { name: "Baseline (Updated Quarterly)", url: "baseline" }
    },
    {
      indicator: "Put/Call Ratio",
      pillar: "Sentiment",
      primary: { name: "Apify Yahoo Finance Actor", url: "apify-actor-api", key: process.env.APIFY_API_TOKEN },
      secondary: { name: "Yahoo Finance API (Direct)", url: "yahoo-finance-api", key: "public" },
      tertiary: { name: "Baseline (0.72)", url: "baseline" }
    },
    {
      indicator: "Fear & Greed Index",
      pillar: "Sentiment",
      primary: { name: "Alternative.me API", url: "https://api.alternative.me/fng/?limit=1" },
      secondary: { name: "CNN Markets", url: "https://edition.cnn.com/markets/fear-and-greed" },
      tertiary: null
    },
    {
      indicator: "Risk Appetite Index",
      pillar: "Sentiment",
      primary: { name: "Calculated from Sentiment Metrics", url: `${baseUrl}/api/ccpi` },
      secondary: { name: "State Street", url: "https://www.statestreet.com/us/en/asset-manager/insights/investor-confidence-index" },
      tertiary: null
    },
    
    // PILLAR 5: CAPITAL FLOWS
    {
      indicator: "Tech ETF Flows",
      pillar: "Flows",
      primary: { name: "ETF.com", url: "https://www.etf.com/channels/technology-etfs" },
      secondary: { name: "ETFdb.com", url: "https://etfdb.com/etfs/sector/technology/" },
      tertiary: { name: "Baseline (Recent Averages)", url: "baseline" }
    },
    {
      indicator: "Short Interest",
      pillar: "Flows",
      primary: { name: "Apify Yahoo Finance Actor", url: "apify-actor-api", key: process.env.APIFY_API_TOKEN },
      secondary: { name: "Yahoo Finance API (Direct)", url: "yahoo-finance-api", key: "public" },
      tertiary: { name: "Nasdaq.com", url: "https://www.nasdaq.com/market-activity/stocks/spy/short-interest" }
    },
    
    // PILLAR 6: STRUCTURAL AI
    {
      indicator: "AI CapEx Growth",
      pillar: "Structural",
      primary: { name: "Seeking Alpha Earnings", url: "https://seekingalpha.com/symbol/MSFT/earnings" },
      secondary: { name: "SEC EDGAR", url: "https://www.sec.gov/edgar/searchedgar/companysearch.html" },
      tertiary: { name: "Manual Quarterly Update", url: "manual" }
    },
    {
      indicator: "AI Revenue Growth",
      pillar: "Structural",
      primary: { name: "Seeking Alpha Earnings", url: "https://seekingalpha.com/symbol/GOOG/earnings" },
      secondary: { name: "Company IR Pages", url: "investor-relations" },
      tertiary: { name: "Manual Quarterly Update", url: "manual" }
    },
    {
      indicator: "GPU Pricing Premium",
      pillar: "Structural",
      primary: { name: "eBay Sold Listings", url: "https://www.ebay.com/sch/i.html?_nkw=nvidia+h100&LH_Sold=1" },
      secondary: { name: "StockX", url: "https://stockx.com/electronics" },
      tertiary: { name: "Baseline (Market Reports)", url: "baseline" }
    },
    {
      indicator: "AI Job Postings Growth",
      pillar: "Structural",
      primary: { name: "Manual Quarterly Update", url: "manual" },
      secondary: { name: "LinkedIn Jobs API", url: "linkedin-api" },
      tertiary: { name: "Baseline (Hiring Reports)", url: "baseline" }
    }
  ]

  // Test each data source
  const results = await Promise.all(
    dataSources.map(async (source) => {
      const primaryStatus = await testDataSource(source.primary)
      const secondaryStatus = source.secondary ? await testDataSource(source.secondary) : null
      const tertiaryStatus = source.tertiary ? await testDataSource(source.tertiary) : null
      
      // Determine which fallback level is active
      let activeSource = "primary"
      let status = primaryStatus.status
      
      if (primaryStatus.status === "error" && secondaryStatus) {
        activeSource = "secondary"
        status = secondaryStatus.status
      }
      if (status === "error" && tertiaryStatus) {
        activeSource = "tertiary"
        status = tertiaryStatus.status
      }
      
      return {
        indicator: source.indicator,
        pillar: source.pillar,
        primary: {
          name: source.primary.name,
          status: primaryStatus.status,
          message: primaryStatus.message
        },
        secondary: source.secondary ? {
          name: source.secondary.name,
          status: secondaryStatus?.status || "unknown",
          message: secondaryStatus?.message || ""
        } : null,
        tertiary: source.tertiary ? {
          name: source.tertiary.name,
          status: tertiaryStatus?.status || "unknown",
          message: tertiaryStatus?.message || ""
        } : null,
        activeSource,
        overallStatus: status
      }
    })
  )

  return NextResponse.json({ 
    dataSources: results,
    summary: {
      total: results.length,
      online: results.filter(r => r.overallStatus === "online").length,
      usingFallback: results.filter(r => r.activeSource !== "primary").length,
      offline: results.filter(r => r.overallStatus === "error").length
    }
  })
}

async function testDataSource(source: { name: string; url: string; key?: string } | null) {
  if (!source) return { status: "unknown", message: "Not configured" }
  
  // Check if Apify Actor API
  if (source.url === "apify-actor-api") {
    if (source.key) {
      return { status: "online", message: "Apify API token configured" }
    }
    return { status: "error", message: "Apify API token not configured" }
  }
  
  // Check if API key is required and configured
  if (source.url.endsWith('-api')) {
    if (source.key === "public") {
      return { status: "online", message: "Public API (no key required)" }
    }
    if (source.key) {
      return { status: "online", message: "API key configured" }
    }
    return { status: "error", message: "API key not configured" }
  }
  
  // For manual/calculated/baseline sources
  if (source.url === "manual" || source.url === "baseline" || source.url === "investor-relations" || source.url.includes("${baseUrl}")) {
    return { status: "online", message: "Calculated/Manual" }
  }
  
  // Test web scraping endpoints
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    clearTimeout(timeoutId)
    
    if (response.ok) {
      const html = await response.text()
      // Check for bot protection
      if (html.includes('Cloudflare') || html.includes('Incapsula') || html.includes('CAPTCHA')) {
        return { status: "error", message: "Bot protection detected" }
      }
      return { status: "online", message: "Responding" }
    } else {
      return { status: "error", message: `HTTP ${response.status}` }
    }
  } catch (error: any) {
    return { 
      status: "error", 
      message: error.name === "AbortError" ? "Timeout" : "Connection failed" 
    }
  }
}
