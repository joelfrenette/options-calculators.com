import { NextResponse } from 'next/server'

/**
 * Diagnostic endpoint for ScrapingBee integration
 * GET /api/scraping-bee/diagnostics
 */
export async function GET() {
  const apiKey = process.env.SCRAPINGBEE_API_KEY
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    apiKeyConfigured: !!apiKey,
    apiKeyPreview: apiKey ? `${apiKey.substring(0, 15)}...` : 'NOT CONFIGURED',
    requiredFor: [
      'Buffett Indicator (Market Cap / GDP)',
      'Put/Call Ratio (CBOE)',
      'AAII Sentiment (Bullish/Bearish %)',
      'Short Interest Ratio (SPY)'
    ],
    status: apiKey ? 'READY' : 'MISSING_API_KEY',
    impact: apiKey ? 'Live data available' : 'Falling back to baseline historical data'
  }
  
  if (!apiKey) {
    return NextResponse.json({
      ...diagnostics,
      error: 'SCRAPINGBEE_API_KEY environment variable is not configured',
      solution: 'Add SCRAPINGBEE_API_KEY to your environment variables in Vercel dashboard'
    }, { status: 500 })
  }
  
  // Test the API key with a simple request
  try {
    const testUrl = 'https://www.example.com'
    const params = new URLSearchParams({
      api_key: apiKey,
      url: testUrl,
      render_js: 'false'
    })
    
    const response = await fetch(`https://app.scrapingbee.com/api/v1/?${params.toString()}`, {
      signal: AbortSignal.timeout(10000)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({
        ...diagnostics,
        testResult: 'FAILED',
        error: `API key test failed with status ${response.status}`,
        details: errorText,
        creditsRemaining: response.headers.get('spb-credits-remaining') || 'unknown'
      }, { status: 500 })
    }
    
    return NextResponse.json({
      ...diagnostics,
      testResult: 'SUCCESS',
      message: 'ScrapingBee API is working correctly',
      creditsRemaining: response.headers.get('spb-credits-remaining') || 'unknown',
      creditsUsed: response.headers.get('spb-cost') || '1'
    })
    
  } catch (error) {
    return NextResponse.json({
      ...diagnostics,
      testResult: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error during API test',
      solution: 'Check your API key and network connectivity'
    }, { status: 500 })
  }
}
