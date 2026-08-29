import { NextResponse } from 'next/server'
import { resolveApiKey } from "@/lib/api-keys"
import { meteredFetch } from "@/lib/metered-fetch"

/**
 * Diagnostic endpoint for ScrapingBee integration
 * GET /api/scraping-bee/diagnostics
 *
 * NO KEY MATERIAL IS RETURNED, and that is the point of this comment (P7-70).
 *
 * This route is UNAUTHENTICATED — it carries no `needsAuth` in the contract and
 * checks no session — and it used to return
 * `apiKeyPreview: apiKey.substring(0, 15)`. Fifteen characters of a ScrapingBee
 * key, published to anyone who asked, on a route with no auth in front of it.
 *
 * It was harmless when found only because `SCRAPINGBEE_API_KEY` was unset in
 * both environments, so the field read "NOT CONFIGURED". **The leak would have
 * begun the moment the key was set**, which was the action being recommended at
 * the time — a fix that arms a defect is the worst shape for one to have.
 *
 * The same rule `budgetEnvReport` follows in the health check applies here:
 * report the STATE, never the value. `apiKeyConfigured` is the whole of what
 * anyone acting on this needs, and a preview never helped diagnose anything
 * `configured: true/false` did not already answer.
 *
 * `creditsRemaining` and `creditsUsed` stay. A quota is not a credential, and
 * an exhausted quota is one of the two states this endpoint exists to tell
 * apart — the other being an absent key, which is why they must not collapse
 * into one "scraping is down" message.
 */
export async function GET() {
  const apiKey = resolveApiKey("SCRAPINGBEE_API_KEY")

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    apiKeyConfigured: !!apiKey,
    requiredFor: [
      // Buffett Indicator removed 2026-08-14 (P7-73a): it now comes from FRED
      // and never touches ScrapingBee.
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

    const response = await meteredFetch("scrapingbee", `https://app.scrapingbee.com/api/v1/?${params.toString()}`, {
      signal: AbortSignal.timeout(10000),
      routeTag: "scraping-bee-diagnostics",
    })

    if (!response.ok) {
      // ScrapingBee echoes the request in some error bodies, and the request
      // carries `api_key` in its query string. Report the status, not the body.
      return NextResponse.json({
        ...diagnostics,
        testResult: 'FAILED',
        error: `API key test failed with status ${response.status}`,
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
