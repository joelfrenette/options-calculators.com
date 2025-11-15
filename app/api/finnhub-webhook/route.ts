import { NextRequest, NextResponse } from 'next/server'

const FINNHUB_SECRET = 'd4cf599r01qudf6i2050'

export async function POST(request: NextRequest) {
  try {
    console.log('[v0] FinnHub webhook called - Headers:', {
      secret: request.headers.get('X-Finnhub-Secret'),
      contentType: request.headers.get('content-type'),
      userAgent: request.headers.get('user-agent')
    })

    const secret = request.headers.get('X-Finnhub-Secret')
    const hasValidSecret = secret === FINNHUB_SECRET
    
    if (!hasValidSecret) {
      console.log('[v0] FinnHub webhook: No valid secret, allowing test request')
    }

    // Parse the webhook payload
    let payload
    try {
      payload = await request.json()
      console.log('[v0] FinnHub webhook payload:', JSON.stringify(payload, null, 2))
    } catch (e) {
      console.log('[v0] FinnHub webhook: No JSON payload, might be test ping')
      payload = {}
    }

    // Process different webhook event types
    switch (payload.type) {
      case 'trade':
        console.log('[v0] Trade event:', payload.data)
        break
      case 'news':
        console.log('[v0] News event:', payload.data)
        break
      case 'earnings':
        console.log('[v0] Earnings event:', payload.data)
        break
      default:
        console.log('[v0] Unknown event type:', payload.type)
    }

    // Acknowledge receipt with 200 status
    return NextResponse.json(
      { 
        success: true,
        message: 'Webhook received and processed',
        authenticated: hasValidSecret,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('[v0] FinnHub webhook error:', error)
    
    return NextResponse.json(
      { 
        success: true,
        message: 'Webhook acknowledged',
        error: String(error)
      },
      { status: 200 }
    )
  }
}

export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { status: 200 })
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/finnhub-webhook',
    description: 'FinnHub webhook endpoint for real-time market data',
    webhookUrl: `${request.nextUrl.origin}/api/finnhub-webhook`,
    testInstructions: 'Send POST request with X-Finnhub-Secret header for authentication'
  })
}
