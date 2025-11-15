import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FINNHUB_SECRET = 'd4cf599r01qudf6i2050'

export async function POST(request: NextRequest) {
  console.log('[v0] FinnHub webhook POST received')
  
  try {
    const secret = request.headers.get('X-Finnhub-Secret') || 
                   request.headers.get('x-finnhub-secret')
    
    console.log('[v0] FinnHub webhook - Headers:', {
      secret: secret ? 'present' : 'missing',
      contentType: request.headers.get('content-type'),
      origin: request.headers.get('origin'),
      allHeaders: Object.fromEntries(request.headers.entries())
    })

    const hasValidSecret = secret === FINNHUB_SECRET
    
    if (!hasValidSecret) {
      console.log('[v0] FinnHub webhook: Invalid or missing secret, but acknowledging request')
    } else {
      console.log('[v0] FinnHub webhook: Valid secret authenticated')
    }

    // Parse the webhook payload
    let payload
    try {
      const text = await request.text()
      console.log('[v0] FinnHub webhook raw body:', text)
      
      if (text) {
        payload = JSON.parse(text)
        console.log('[v0] FinnHub webhook parsed payload:', JSON.stringify(payload, null, 2))
      } else {
        console.log('[v0] FinnHub webhook: Empty body (test ping)')
        payload = {}
      }
    } catch (e) {
      console.log('[v0] FinnHub webhook: Failed to parse JSON, treating as test ping')
      payload = {}
    }

    const response = NextResponse.json(
      { 
        success: true,
        message: 'Webhook received',
        authenticated: hasValidSecret,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    )

    // Process events after acknowledging (async)
    if (payload.type) {
      console.log('[v0] FinnHub event type:', payload.type, 'Data:', payload.data)
    }

    return response

  } catch (error) {
    console.error('[v0] FinnHub webhook error:', error)
    
    return NextResponse.json(
      { 
        success: true,
        message: 'Webhook acknowledged'
      },
      { status: 200 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': 'X-Finnhub-Secret, Content-Type',
    }
  })
}

export async function HEAD(request: NextRequest) {
  console.log('[v0] FinnHub webhook HEAD received')
  return new NextResponse(null, { status: 200 })
}

export async function GET(request: NextRequest) {
  console.log('[v0] FinnHub webhook GET received')
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/finnhub-webhook',
    description: 'FinnHub webhook endpoint for real-time market data',
    webhookUrl: `${request.nextUrl.origin}/api/finnhub-webhook`,
    testInstructions: 'Send POST request with X-Finnhub-Secret header for authentication',
    timestamp: new Date().toISOString()
  }, { status: 200 })
}
