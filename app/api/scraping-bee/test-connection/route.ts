import { NextRequest, NextResponse } from 'next/server'

/**
 * Test ScrapingBee connection and configuration
 * Uses the official httpbin.scrapingbee.com test endpoint
 */
export async function GET(request: NextRequest) {
  const apiKey = process.env.SCRAPINGBEE_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'SCRAPINGBEE_API_KEY not configured'
    }, { status: 500 })
  }

  try {
    // Test 1: Basic connection test with httpbin
    const testUrl = 'https://httpbin.scrapingbee.com/anything?json'
    const scrapingBeeUrl = new URL('https://app.scrapingbee.com/api/v1/')
    scrapingBeeUrl.searchParams.set('api_key', apiKey)
    scrapingBeeUrl.searchParams.set('url', testUrl)
    scrapingBeeUrl.searchParams.set('render_js', 'false')

    console.log('[v0] Testing ScrapingBee with:', testUrl)

    const response = await fetch(scrapingBeeUrl.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(30000)
    })

    const creditsUsed = response.headers.get('spb-cost') || 'unknown'
    const creditsRemaining = response.headers.get('spb-credits-remaining') || 'unknown'

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({
        success: false,
        error: `ScrapingBee API error: ${response.status} ${response.statusText}`,
        details: errorText,
        headers: {
          creditsUsed,
          creditsRemaining
        }
      }, { status: response.status })
    }

    const data = await response.json()
    
    console.log('[v0] ScrapingBee test successful!')

    return NextResponse.json({
      success: true,
      message: 'ScrapingBee connection successful',
      testEndpoint: testUrl,
      response: data,
      credits: {
        used: creditsUsed,
        remaining: creditsRemaining
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[v0] ScrapingBee test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
