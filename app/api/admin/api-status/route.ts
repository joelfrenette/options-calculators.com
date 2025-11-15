import { NextResponse } from "next/server"


export async function GET() {
  // List of all APIs used on the website
  const apis = [
    { 
      name: "Alpha Vantage", 
      key: process.env.ALPHA_VANTAGE_API_KEY,
      testUrl: "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=",
      purpose: "Stock data & technical indicators (VIX, VXN, ATR)"
    },
    { 
      name: "FRED (Federal Reserve)", 
      key: process.env.FRED_API_KEY,
      testUrl: "https://api.stlouisfed.org/fred/series?series_id=GDP&api_key=",
      purpose: "Economic data (Fed Funds, Yield Curve, Junk Bond Spread)"
    },
    { 
      name: "Apify", 
      key: process.env.APIFY_API_TOKEN,
      testUrl: "https://api.apify.com/v2/acts",
      purpose: "Yahoo Finance data scraping actors"
    },
    { 
      name: "Twelve Data", 
      key: process.env.TWELVE_DATA_API_KEY || process.env.TWELVEDATA_API_KEY,
      testUrl: "https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&apikey=",
      purpose: "Market data backup source"
    },
    { 
      name: "Polygon.io", 
      key: process.env.POLYGON_API_KEY,
      testUrl: "https://api.polygon.io/v2/aggs/ticker/AAPL/range/1/day/2023-01-01/2023-01-02?apiKey=",
      purpose: "Real-time market data backup"
    },
    { 
      name: "Financial Modeling Prep", 
      key: process.env.FMP_API_KEY,
      testUrl: "https://financialmodelingprep.com/api/v3/quote/AAPL?apikey=",
      purpose: "Financial statements & valuation metrics"
    },
    { 
      name: "Alternative.me", 
      key: null,
      testUrl: "https://api.alternative.me/fng/?limit=1",
      purpose: "Fear & Greed Index (no key required)"
    },
    { 
      name: "Resend", 
      key: process.env.RESEND_API_KEY,
      testUrl: null,
      purpose: "Email notifications"
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
          const timeoutId = setTimeout(() => controller.abort(), 3000)
          
          const response = await fetch(api.testUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          })
          clearTimeout(timeoutId)
          
          if (response.ok) {
            return {
              name: api.name,
              status: "online" as const,
              message: `${api.purpose} - Responding normally`,
              hasKey: false
            }
          } else {
            return {
              name: api.name,
              status: "error" as const,
              message: `HTTP ${response.status} - ${api.purpose}`,
              hasKey: false
            }
          }
        } catch (error: any) {
          return {
            name: api.name,
            status: "error" as const,
            message: `${error.name === "AbortError" ? "Timeout" : "Connection failed"} - ${api.purpose}`,
            hasKey: false
          }
        }
      }
      
      // For APIs that require keys
      if (!hasKey) {
        return {
          name: api.name,
          status: "error" as const,
          message: `API key not configured - ${api.purpose}`,
          hasKey: false
        }
      }
      
      // Test API with key
      if (api.testUrl) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 3000)
          
          const testEndpoint = api.testUrl + api.key
          const response = await fetch(testEndpoint, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          })
          clearTimeout(timeoutId)
          
          if (response.ok) {
            return {
              name: api.name,
              status: "online" as const,
              message: `${api.purpose} - Responding normally`,
              hasKey: true
            }
          } else if (response.status === 401 || response.status === 403) {
            return {
              name: api.name,
              status: "error" as const,
              message: `Invalid API key - ${api.purpose}`,
              hasKey: true
            }
          } else {
            return {
              name: api.name,
              status: "error" as const,
              message: `HTTP ${response.status} - ${api.purpose}`,
              hasKey: true
            }
          }
        } catch (error: any) {
          return {
            name: api.name,
            status: "unknown" as const,
            message: `${error.name === "AbortError" ? "Timeout" : "Connection test failed"} - ${api.purpose}`,
            hasKey: true
          }
        }
      }
      
      // If no test URL, just confirm key is configured
      return {
        name: api.name,
        status: "online" as const,
        message: `${api.purpose} - Key configured`,
        hasKey: true
      }
    })
  )

  return NextResponse.json({ apis: results })
}
