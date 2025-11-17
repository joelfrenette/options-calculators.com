import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { url, options = {} } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.SCRAPINGBEE_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ScrapingBee API key not configured' },
        { status: 500 }
      )
    }

    // Build ScrapingBee API URL with parameters
    const params = new URLSearchParams({
      api_key: apiKey,
      url: url,
      render_js: options.renderJs !== false ? 'true' : 'false',
      premium_proxy: options.premiumProxy === true ? 'true' : 'false',
      country_code: options.countryCode || 'us',
      ...options.customParams || {}
    })

    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?${params.toString()}`

    const response = await fetch(scrapingBeeUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/html, */*'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[v0] ScrapingBee API Error:', response.status, errorText)
      return NextResponse.json(
        { 
          error: 'ScrapingBee request failed', 
          status: response.status,
          message: errorText 
        },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type')
    let data

    if (contentType?.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    return NextResponse.json({
      success: true,
      data,
      metadata: {
        url,
        contentType,
        timestamp: new Date().toISOString(),
        creditsUsed: response.headers.get('spb-cost') || '1'
      }
    })

  } catch (error) {
    console.error('[v0] ScrapingBee Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to scrape URL',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    )
  }

  // Forward to POST handler
  return POST(new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  }))
}
