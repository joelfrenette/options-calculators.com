import { NextResponse } from "next/server"

export async function GET() {
  const apis = [
    {
      name: "Alpha Vantage API",
      key: process.env.ALPHA_VANTAGE_API_KEY,
      testUrl: "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=",
      endpoint: "https://www.alphavantage.co/query",
      purpose: "Stock data & technical indicators (VIX, VXN, RVX, ATR, SMA)",
      usedIn: ["CCPI Dashboard (VIX, VXN, ATR)", "Market Sentiment", "Panic/Euphoria"],
    },
    {
      name: "Alternative.me API",
      key: null,
      testUrl: "https://api.alternative.me/fng/?limit=1",
      endpoint: "https://api.alternative.me/fng",
      purpose: "Crypto Fear & Greed Index",
      usedIn: ["CCPI Dashboard (Fear & Greed component)"],
    },
    {
      name: "Apify API",
      key: process.env.APIFY_API_TOKEN,
      testUrl: "https://api.apify.com/v2/acts?token=",
      endpoint: "https://api.apify.com/v2/acts/{actor-id}/runs",
      purpose: "Yahoo Finance data scraping (canadesk & Architjn actors for valuation metrics)",
      usedIn: ["CCPI Dashboard (S&P 500 P/E, P/S ratios via Yahoo Finance)"],
    },
    {
      name: "Financial Modeling Prep API",
      key: process.env.FMP_API_KEY,
      testUrl: "https://financialmodelingprep.com/stable/quote?symbol=AAPL&apikey=",
      endpoint: "https://financialmodelingprep.com/stable/quote",
      purpose: "Financial statements & valuation metrics (now using stable endpoint)",
      usedIn: ["CCPI Dashboard (S&P 500 P/E, P/S ratios - primary source)"],
    },
    {
      name: "FRED API",
      key: process.env.FRED_API_KEY,
      testUrl: "https://api.stlouisfed.org/fred/series?series_id=GDP&api_key=",
      endpoint: "https://api.stlouisfed.org/fred/series/observations",
      purpose: "Federal Reserve economic data (Fed Funds Rate, Yield Curve, Junk Bond Spread, CPI, M2 Money Supply)",
      usedIn: [
        "CCPI Dashboard (Fed Funds, Yield Curve, Junk Spread)",
        "FOMC Predictions",
        "CPI/Inflation",
        "Panic/Euphoria",
      ],
    },
    {
      name: "Polygon.io API",
      key: process.env.POLYGON_API_KEY,
      testUrl: "https://api.polygon.io/v2/aggs/ticker/AAPL/range/1/day/2023-01-01/2023-01-02?apiKey=",
      endpoint: "https://api.polygon.io/v2/aggs/ticker/{ticker}/range",
      purpose: "Real-time options chains, stock quotes, Greeks, fundamentals, and market data",
      usedIn: ["Options Calculators", "Wheel Scanner", "CCPI Dashboard", "Greeks Calculator"],
    },
    {
      name: "Resend API",
      key: process.env.RESEND_API_KEY,
      testUrl: null,
      endpoint: "https://api.resend.com/emails",
      purpose: "Transactional email notifications (password reset emails)",
      usedIn: ["Authentication System (password reset)"],
    },
    {
      name: "Twelve Data API",
      key: process.env.TWELVE_DATA_API_KEY || process.env.TWELVEDATA_API_KEY,
      testUrl: "https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&apikey=",
      endpoint: "https://api.twelvedata.com/time_series",
      purpose: "Technical indicators, fundamentals, and market data (backup source)",
      usedIn: ["CCPI Dashboard (backup)", "Wheel Scanner", "Market Data"],
    },
    {
      name: "ScrapingBee API",
      key: process.env.SCRAPINGBEE_API_KEY,
      testUrl: "https://app.scrapingbee.com/api/v1/?api_key=",
      endpoint: "https://app.scrapingbee.com/api/v1/",
      purpose: "Web scraping for social media sentiment (Reddit, Twitter, StockTwits) and CNN data",
      usedIn: ["Social Sentiment Score", "Fear & Greed Index", "Market Sentiment"],
    },
    {
      name: "Serper",
      key: process.env.SERPER_API_KEY,
      testUrl: null,
      endpoint: "https://google.serper.dev/search",
      purpose: "Google Search data for sentiment analysis and stock news",
      usedIn: ["Social Sentiment Score", "Stock News"],
    },
    {
      name: "Grok (xAI)",
      key: process.env.GROK_XAI_API_KEY || process.env.XAI_API_KEY,
      testUrl: null,
      endpoint: "https://api.x.ai/v1/chat/completions",
      purpose: "LLM sentiment analysis (fastest option)",
      usedIn: ["Social Sentiment Score"],
    },
    {
      name: "Groq",
      key: process.env.GROQ_API_KEY,
      testUrl: null,
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      purpose: "LLM sentiment analysis (fast fallback)",
      usedIn: ["Social Sentiment Score"],
    },
    {
      name: "OpenAI",
      key: process.env.OPENAI_API_KEY,
      testUrl: null,
      endpoint: "https://api.openai.com/v1/chat/completions",
      purpose: "LLM sentiment analysis (reliable fallback)",
      usedIn: ["Social Sentiment Score"],
    },
    {
      name: "Google AI",
      key: process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      testUrl: null,
      endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
      purpose: "LLM sentiment analysis (final fallback)",
      usedIn: ["Social Sentiment Score"],
    },
  ]

  // Test each API
  const results = await Promise.all(
    apis.map(async (api) => {
      const hasKey = !!api.key

      // If no key required (like Alternative.me), test the endpoint directly
      if (api.key === null && api.testUrl) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5000)

          const response = await fetch(api.testUrl, {
            signal: controller.signal,
            headers: { "User-Agent": "OPTIONS-CALCULATORS.COM/1.0" },
          })
          clearTimeout(timeoutId)

          if (response.ok) {
            return {
              name: api.name,
              status: "online" as const,
              message: `Responding normally`,
              purpose: api.purpose,
              usedIn: api.usedIn,
              endpoint: api.endpoint,
              hasKey: false,
            }
          } else {
            return {
              name: api.name,
              status: "error" as const,
              message: `HTTP ${response.status}`,
              purpose: api.purpose,
              usedIn: api.usedIn,
              endpoint: api.endpoint,
              hasKey: false,
            }
          }
        } catch (error: any) {
          return {
            name: api.name,
            status: "error" as const,
            message: error.name === "AbortError" ? "Request timeout (>5s)" : `Connection failed: ${error.message}`,
            purpose: api.purpose,
            usedIn: api.usedIn,
            endpoint: api.endpoint,
            hasKey: false,
          }
        }
      }

      // For APIs that require keys
      if (!hasKey) {
        return {
          name: api.name,
          status: "error" as const,
          message: `API key not configured in environment variables`,
          purpose: api.purpose,
          usedIn: api.usedIn,
          endpoint: api.endpoint,
          hasKey: false,
        }
      }

      if (!api.testUrl) {
        return {
          name: api.name,
          status: "online" as const,
          message: `Key configured (no test endpoint available)`,
          purpose: api.purpose,
          usedIn: api.usedIn,
          endpoint: api.endpoint,
          hasKey: true,
        }
      }

      // Test API with key
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const testEndpoint = api.testUrl + api.key
        const response = await fetch(testEndpoint, {
          signal: controller.signal,
          headers: { "User-Agent": "OPTIONS-CALCULATORS.COM/1.0" },
        })
        clearTimeout(timeoutId)

        if (response.ok) {
          return {
            name: api.name,
            status: "online" as const,
            message: `Responding normally`,
            purpose: api.purpose,
            usedIn: api.usedIn,
            endpoint: api.endpoint,
            hasKey: true,
          }
        } else if (response.status === 401 || response.status === 403) {
          return {
            name: api.name,
            status: "error" as const,
            message: `Invalid or expired API key (HTTP ${response.status})`,
            purpose: api.purpose,
            usedIn: api.usedIn,
            endpoint: api.endpoint,
            hasKey: true,
          }
        } else if (response.status === 429) {
          return {
            name: api.name,
            status: "warning" as const,
            message: `Rate limit exceeded - API is working but throttled`,
            purpose: api.purpose,
            usedIn: api.usedIn,
            endpoint: api.endpoint,
            hasKey: true,
          }
        } else {
          return {
            name: api.name,
            status: "error" as const,
            message: `HTTP ${response.status}`,
            purpose: api.purpose,
            usedIn: api.usedIn,
            endpoint: api.endpoint,
            hasKey: true,
          }
        }
      } catch (error: any) {
        return {
          name: api.name,
          status: "unknown" as const,
          message: error.name === "AbortError" ? "Request timeout (>5s)" : `Connection test failed: ${error.message}`,
          purpose: api.purpose,
          usedIn: api.usedIn,
          endpoint: api.endpoint,
          hasKey: true,
        }
      }
    }),
  )

  return NextResponse.json({ apis: results })
}
