import { type NextRequest, NextResponse } from "next/server"

let cachedCrumb: string | null = null
let cachedCookies: string | null = null
let crumbExpiry = 0

async function getYahooCrumbAndCookies() {
  // Check if cached crumb is still valid (valid for 30 minutes)
  if (cachedCrumb && cachedCookies && Date.now() < crumbExpiry) {
    return { crumb: cachedCrumb, cookies: cachedCookies }
  }

  try {
    // Step 1: Get initial cookies from Yahoo Finance homepage
    const initResponse = await fetch("https://finance.yahoo.com", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    })

    const setCookieHeaders = initResponse.headers.getSetCookie?.() || []
    const cookies = setCookieHeaders
      .map((cookie) => cookie.split(";")[0])
      .filter((c) => c)
      .join("; ")

    if (!cookies) {
      console.error("[v0] No cookies received from Yahoo Finance")
      return null
    }

    // Step 2: Get crumb token using the cookies
    const crumbResponse = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://finance.yahoo.com/",
        Cookie: cookies,
      },
    })

    if (!crumbResponse.ok) {
      console.error("[v0] Failed to get crumb:", crumbResponse.status)
      return null
    }

    const crumb = await crumbResponse.text()

    // Cache for 30 minutes
    cachedCrumb = crumb
    cachedCookies = cookies
    crumbExpiry = Date.now() + 30 * 60 * 1000

    console.log("[v0] Successfully obtained Yahoo crumb and cookies")
    return { crumb, cookies }
  } catch (error) {
    console.error("[v0] Error getting Yahoo crumb:", error)
    return null
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint")
  const ticker = searchParams.get("ticker")
  const date = searchParams.get("date")

  if (!endpoint || !ticker) {
    return NextResponse.json({ error: "Missing endpoint or ticker" }, { status: 400 })
  }

  let url = ""
  let needsAuth = false

  switch (endpoint) {
    case "quote":
      url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y&includePrePost=false&events=div%7Csplit`
      break
    case "options":
      url = `https://query2.finance.yahoo.com/v7/finance/options/${ticker}${date ? `?date=${date}` : ""}`
      break
    case "fundamentals":
      needsAuth = true
      url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=price,summaryDetail,defaultKeyStatistics,financialData,earnings`
      break
    default:
      return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 })
  }

  try {
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://finance.yahoo.com/",
      Origin: "https://finance.yahoo.com",
    }

    if (needsAuth) {
      const auth = await getYahooCrumbAndCookies()
      if (!auth) {
        console.error(`[v0] Failed to authenticate for ${ticker}`)
        return NextResponse.json(
          {
            error: "Yahoo Finance authentication failed",
            ticker,
          },
          { status: 401 },
        )
      }

      headers["Cookie"] = auth.cookies
      url += `${url.includes("?") ? "&" : "?"}crumb=${encodeURIComponent(auth.crumb)}`
    }

    const response = await fetch(url, {
      headers,
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      if (response.status !== 404) {
        console.error(`[v0] Yahoo API error for ${ticker}:`, response.status, errorBody)
      }
      return NextResponse.json(
        {
          error: `Yahoo API returned ${response.status}`,
          details: errorBody,
          ticker,
          endpoint,
        },
        { status: response.status },
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error(`[v0] Yahoo API fetch error for ${ticker}:`, error)
    return NextResponse.json(
      {
        error: "Failed to fetch data from Yahoo Finance",
        details: error instanceof Error ? error.message : "Unknown error",
        ticker,
      },
      { status: 500 },
    )
  }
}
