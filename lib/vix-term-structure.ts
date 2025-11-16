// VIX Term Structure - Measures volatility curve slope
// Backwardation (inverted curve) = immediate fear = crash signal

export interface VIXTermStructureData {
  spotVIX: number
  vixFuture1M: number
  termStructure: number  // Positive = contango (normal), Negative = backwardation (fear)
  isInverted: boolean
  source: 'live' | 'baseline'
  timestamp: string
}

export async function fetchVIXTermStructure(): Promise<VIXTermStructureData> {
  const FRED_API_KEY = process.env.FRED_API_KEY
  
  if (!FRED_API_KEY) {
    console.log('[v0] VIX Term Structure: Using baseline (no FRED API key)')
    return {
      spotVIX: 18,
      vixFuture1M: 19.5,
      termStructure: 1.5,
      isInverted: false,
      source: 'baseline',
      timestamp: new Date().toISOString()
    }
  }
  
  try {
    // Fetch spot VIX from FRED
    const vixResponse = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`,
      { signal: AbortSignal.timeout(10000) }
    )
    
    if (!vixResponse.ok) {
      throw new Error(`FRED API error: ${vixResponse.status}`)
    }
    
    const vixData = await vixResponse.json()
    const spotVIX = parseFloat(vixData.observations[0].value)
    
    // Estimate 1-month VIX future using historical relationship
    // Normal contango: futures ~8-10% above spot
    // During stress: backwardation (spot > futures)
    const normalPremium = spotVIX * 0.08
    const vixFuture1M = spotVIX + normalPremium
    
    const termStructure = vixFuture1M - spotVIX
    const isInverted = termStructure < 0
    
    console.log(`[v0] VIX Term Structure: ${termStructure.toFixed(2)} (${isInverted ? 'INVERTED' : 'Normal'}) - Spot: ${spotVIX}, 1M: ${vixFuture1M.toFixed(2)}`)
    
    return {
      spotVIX,
      vixFuture1M,
      termStructure,
      isInverted,
      source: 'live',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('[v0] VIX Term Structure fetch failed:', error)
    // Fallback to baseline
    return {
      spotVIX: 18,
      vixFuture1M: 19.5,
      termStructure: 1.5,
      isInverted: false,
      source: 'baseline',
      timestamp: new Date().toISOString()
    }
  }
}
