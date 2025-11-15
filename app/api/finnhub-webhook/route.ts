import { NextRequest, NextResponse } from 'next/server'

const FINNHUB_SECRET = 'd4cf599r01qudf6i2050'

export async function POST(request: NextRequest) {
  try {
    // Authenticate the webhook request
    const secret = request.headers.get('X-Finnhub-Secret')
    
    if (secret !== FINNHUB_SECRET) {
      console.log('[v0] FinnHub webhook authentication failed')
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    // Parse the webhook payload
    const payload = await request.json()
    
    console.log('[v0] FinnHub webhook received:', {
      type: payload.type,
      data: payload.data,
      timestamp: new Date().toISOString()
    })

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
        message: 'Webhook received',
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('[v0] FinnHub webhook error:', error)
    
    // Still return 200 to acknowledge receipt even if processing fails
    return NextResponse.json(
      { 
        success: true,
        message: 'Webhook acknowledged'
      },
      { status: 200 }
    )
  }
}

// Handle GET requests for webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/finnhub-webhook',
    description: 'FinnHub webhook endpoint for real-time market data',
    webhookUrl: `${request.nextUrl.origin}/api/finnhub-webhook`
  })
}
