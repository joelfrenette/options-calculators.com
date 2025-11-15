import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('[v0] FinnHub webhook POST received')
  console.log('[v0] Headers:', Object.fromEntries(request.headers.entries()))
  
  try {
    const body = await request.text()
    console.log('[v0] Body:', body)
    
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[v0] Error:', error)
    return NextResponse.json({ success: true }, { status: 200 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    message: 'FinnHub webhook endpoint is active',
    timestamp: new Date().toISOString()
  })
}
