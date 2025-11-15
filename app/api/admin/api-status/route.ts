import { NextResponse } from "next/server"

export async function GET() {
  const apis = [
    { 
      name: "Alpha Vantage API", 
      key: process.env.ALPHA_VANTAGE_API_KEY,
      testUrl: "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=",
      purpose: "Stock data & technical indicators (VIX, VXN, RVX, ATR, SMA)",
      usedIn: ["CCPI Dashboard", "Market Sentiment", "Panic/Euphoria"]
    },
    { 
      name: "Alternative.me API", 
      key: null,
      testUrl: "https://api.alternative.me/fng/?limit=1",
      purpose: "Crypto Fear & Greed Index",
      usedIn: ["CCPI Dashboard"]
    },
    { 
      name: "Apify API", 
      key: process.env.APIFY_API_TOKEN,
      testUrl: "https://api.apify.com/v2/acts?token=",
      purpose: "Yahoo Finance data scraping (canadesk & Architjn actors for valuation metrics)",
      usedIn: ["CCPI Dashboard"]
    },
    { 
      name: "Financial Modeling Prep API", 
      key: process.env.FMP_API_KEY,
      testUrl: null,
      purpose: "Financial statements & valuation metrics (legacy, not actively used)",
      usedIn: ["Not currently in use"]
    },
    { 
      name: "FRED API", 
      key: process.env.FRED_API_KEY,
      testUrl: "https://api.stlouisfed.org/fred/series?series_id=GDP&api_key=",
      purpose: "Federal Reserve economic data (Fed Funds Rate, Yield Curve, Junk Bond Spread, CPI, M2 Money Supply)",
      usedIn: ["CCPI Dashboard", "FOMC Predictions", "CPI/Inflation", "Panic/Euphoria"]
    },
    { 
      name: "Polygon.io API", 
      key: process.env.POLYGON_API_KEY,
      testUrl: "https://api.polygon.io/v2/aggs/ticker/AAPL/range/1/day/2023-01-01/2023-01-02?apiKey=",
      purpose: "Real-time options chains, stock quotes, Greeks, fundamentals, and market data",
      usedIn: ["Options Calculators", "Wheel Scanner", "CCPI Dashboard", "Greeks Calculator"]
    },
    { 
      name: "Resend API", 
      key: process.env.RESEND_API_KEY,
      testUrl: null,
      purpose: "Transactional email notifications (password reset emails)",
      usedIn: ["Authentication System"]
    },
    { 
      name: "Twelve Data API", 
      key: process.env.TWELVE_DATA_API_KEY || process.env.TWELVEDATA_API_KEY,
      testUrl: "https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&apikey=",
      purpose: "Technical indicators, fundamentals, and market data (backup source)",
      usedIn: ["CCPI Dashboard", "Wheel Scanner", "Market Data"]
    }
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
            headers: { 'User-Agent': 'OPTIONS-CALCULATORS.COM/1.0' }
          })
          clearTimeout(timeoutId)
          
          if (response.ok) {
            return {
              name: api.name,
              status: "online" as const,
              message: `Responding normally`,
              purpose: api.purpose,
              usedIn: api.usedIn,
              hasKey: false
            }
          } else {
            return {
              name: api.name,
              status: "error" as const,
              message: `HTTP ${response.status}`,
              purpose: api.purpose,
              usedIn: api.usedIn,
              hasKey: false
            }
          }
        } catch (error: any) {
          return {
            name: api.name,
            status: "error" as const,
            message: error.name === "AbortError" ? "Request timeout (>5s)" : `Connection failed: ${error.message}`,
            purpose: api.purpose,
            usedIn: api.usedIn,
            hasKey: false
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
          hasKey: false
        }
      }
      
      if (!api.testUrl) {
        return {
          name: api.name,
          status: "online" as const,
          message: `Key configured (no test endpoint available)`,
          purpose: api.purpose,
          usedIn: api.usedIn,
          hasKey: true
        }
      }
      
      // Test API with key
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        
        const testEndpoint = api.testUrl + api.key
        const response = await fetch(testEndpoint, {
          signal: controller.signal,
          headers: { 'User-Agent': 'OPTIONS-CALCULATORS.COM/1.0' }
        })
        clearTimeout(timeoutId)
        
        if (response.ok) {
          return {
            name: api.name,
            status: "online" as const,
            message: `Responding normally`,
            purpose: api.purpose,
            usedIn: api.usedIn,
            hasKey: true
          }
        } else if (response.status === 401 || response.status === 403) {
          return {
            name: api.name,
            status: "error" as const,
            message: `Invalid or expired API key (HTTP ${response.status})`,
            purpose: api.purpose,
            usedIn: api.usedIn,
            hasKey: true
          }
        } else if (response.status === 429) {
          return {
            name: api.name,
            status: "warning" as const,
            message: `Rate limit exceeded - API is working but throttled`,
            purpose: api.purpose,
            usedIn: api.usedIn,
            hasKey: true
          }
        } else {
          return {
            name: api.name,
            status: "error" as const,
            message: `HTTP ${response.status}`,
            purpose: api.purpose,
            usedIn: api.usedIn,
            hasKey: true
          }
        }
      } catch (error: any) {
        return {
          name: api.name,
          status: "unknown" as const,
          message: error.name === "AbortError" ? "Request timeout (>5s)" : `Connection test failed: ${error.message}`,
          purpose: api.purpose,
          usedIn: api.usedIn,
          hasKey: true
        }
      }
    })
  )

  return NextResponse.json({ apis: results })
}
