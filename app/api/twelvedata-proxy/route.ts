import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const ticker = searchParams.get("ticker")
  const endpoint = searchParams.get("endpoint")

  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker parameter" }, { status: 400 })
  }

  const apiKey = process.env.TWELVEDATA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Twelve Data API key not configured" }, { status: 500 })
  }

  try {
    let url: string

    if (endpoint === "statistics") {
      url = `https://api.twelvedata.com/statistics?symbol=${ticker}&apikey=${apiKey}`
    } else if (endpoint === "profile") {
      url = `https://api.twelvedata.com/profile?symbol=${ticker}&apikey=${apiKey}`
    } else {
      return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 })
    }

    console.log(`[v0] Twelve Data API: ${endpoint} for ${ticker}`)

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[v0] Twelve Data API error for ${ticker}: ${response.status} ${errorText}`)
      return NextResponse.json(
        { error: `Twelve Data API error: ${response.status}`, details: errorText },
        { status: response.status },
      )
    }

    const data = await response.json()

    if (data.status === "error") {
      console.error(`[v0] Twelve Data API error for ${ticker}:`, data.message)
      return NextResponse.json({ error: data.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error(`[v0] Twelve Data proxy error for ${ticker}:`, error)
    return NextResponse.json({ error: "Failed to fetch from Twelve Data API" }, { status: 500 })
  }
}
