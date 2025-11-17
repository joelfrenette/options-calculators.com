import { NextResponse } from 'next/server'

/**
 * Test endpoint for ScrapingBee integration
 * GET /api/scraping-bee/test
 */
export async function GET() {
  const apiKey = process.env.SCRAPINGBEE_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      status: 'error',
      message: 'SCRAPINGBEE_API_KEY environment variable not found',
      configured: false
    })
  }

  try {
    // Test with a simple scrape of example.com
    const testUrl = 'https://example.com'
    const params = new URLSearchParams({
      api_key: apiKey,
      url: testUrl,
      render_js: 'false'
    })

    const response = await fetch(`https://app.scrapingbee.com/api/v1/?${params.toString()}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({
        status: 'error',
        message: 'ScrapingBee API test failed',
        details: errorText,
        configured: true,
        apiWorking: false
      })
    }

    const content = await response.text()
    const creditsUsed = response.headers.get('spb-cost') || 'unknown'

    return NextResponse.json({
      status: 'success',
      message: 'ScrapingBee API is working correctly',
      configured: true,
      apiWorking: true,
      testUrl,
      creditsUsed,
      sampleContent: content.substring(0, 200) + '...'
    })

  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      configured: true,
      apiWorking: false
    })
  }
}
