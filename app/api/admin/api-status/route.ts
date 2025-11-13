import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  // Construct base URL from request headers (works in both development and production)
  const protocol = request.headers.get("x-forwarded-proto") || "http"
  const host = request.headers.get("host") || "localhost:3000"
  const baseUrl = `${protocol}://${host}`

  const apis = [
    { name: "Polygon", url: "/api/polygon-proxy?endpoint=snapshot&ticker=AAPL", key: process.env.POLYGON_API_KEY },
    { name: "FMP", url: "/api/fmp-proxy?symbol=AAPL", key: process.env.FMP_API_KEY },
    {
      name: "TwelveData",
      url: "/api/twelve-data-proxy?symbol=AAPL&interval=1day&outputsize=1",
      key: process.env.TWELVE_DATA_API_KEY,
    },
    { name: "FRED", url: "/api/vix", key: process.env.FRED_API_KEY },
    { name: "Yahoo", url: "/api/yahoo-proxy?endpoint=quote&symbol=AAPL", key: null },
    { name: "Apify", url: "/api/apify-proxy", key: process.env.APIFY_API_TOKEN },
  ]

  const results = await Promise.all(
    apis.map(async (api) => {
      const hasKey = !!api.key
      let status = "unknown"
      let message = ""

      if (!hasKey && api.key !== null) {
        status = "error"
        message = "API key not configured"
      } else {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5000)

          const response = await fetch(`${baseUrl}${api.url}`, {
            signal: controller.signal,
          })
          clearTimeout(timeoutId)

          if (response.ok) {
            status = "online"
            message = "API responding normally"
          } else {
            status = "error"
            message = `HTTP ${response.status}`
          }
        } catch (error: any) {
          status = "error"
          message = error.name === "AbortError" ? "Timeout" : "Connection failed"
        }
      }

      return {
        name: api.name,
        status,
        message,
        hasKey,
      }
    }),
  )

  return NextResponse.json({ apis: results })
}
