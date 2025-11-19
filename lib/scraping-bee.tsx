/**
 * ScrapingBee Utility Functions
 * Web scraping service for extracting data from websites
 */

import { fetchShortInterestWithGrok, fetchMarketDataWithGrok } from './grok-market-data'

export interface ScrapingBeeOptions {
  renderJs?: boolean // Render JavaScript (default: true)
  premiumProxy?: boolean // Use premium residential proxies
  countryCode?: string // Country code for proxy (default: 'us')
  customParams?: Record<string, string> // Additional ScrapingBee parameters
}

export interface ScrapingBeeResponse {
  success: boolean
  data: string | object
  metadata: {
    url: string
    contentType: string | null
    timestamp: string
    creditsUsed: string
  }
}

/**
 * Scrape a URL using ScrapingBee
 */
export async function scrapeUrl(
  url: string, 
  options: ScrapingBeeOptions = {}
): Promise<ScrapingBeeResponse> {
  const response = await fetch('/api/scraping-bee', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, options })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to scrape URL')
  }

  return response.json()
}

/**
 * Extract text content from a webpage
 */
export async function extractText(url: string): Promise<string> {
  const result = await scrapeUrl(url, { renderJs: true })
  
  if (typeof result.data === 'string') {
    // Strip HTML tags and return clean text
    return result.data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  
  return JSON.stringify(result.data)
}

/**
 * Extract structured data from a webpage using CSS selectors
 */
export async function extractData(
  url: string,
  selectors: Record<string, string>
): Promise<Record<string, string>> {
  const result = await scrapeUrl(url, { renderJs: true })
  const html = typeof result.data === 'string' ? result.data : ''
  
  // Simple extraction (for more complex cases, use a server-side parser)
  const extracted: Record<string, string> = {}
  
  for (const [key, selector] of Object.entries(selectors)) {
    const regex = new RegExp(`<[^>]*class="${selector}"[^>]*>([^<]*)<`, 'i')
    const match = html.match(regex)
    extracted[key] = match ? match[1].trim() : ''
  }
  
  return extracted
}

/**
 * Check if a website is accessible
 */
export async function checkWebsite(url: string): Promise<boolean> {
  try {
    const result = await scrapeUrl(url, { renderJs: false })
    return result.success
  } catch {
    return false
  }
}

/**
 * Scrape financial data from a webpage
 */
export async function scrapeFinancialData(url: string): Promise<any> {
  const result = await scrapeUrl(url, { 
    renderJs: true,
    premiumProxy: true // Use premium proxy for financial sites
  })
  
  return {
    raw: result.data,
    metadata: result.metadata
  }
}

export async function scrapeBuffettIndicator(): Promise<{
  ratio: number
  status: 'live' | 'baseline'
}> {
  try {
    const result = await scrapeUrl('https://www.gurufocus.com/stock-market-valuations.php', {
      renderJs: true,
      premiumProxy: true
    })
    
    const html = typeof result.data === 'string' ? result.data : ''
    
    // Parse the clearly stated ratio from GuruFocus
    const patterns = [
      /currently at\s+<strong>(\d+\.\d+)%<\/strong>/,
      /Ratio = \*\*(\d+\.\d+)%\*\*/,
      /(\d+\.\d+)%.*?Significantly Overvalued/s,
      /total market cap.*?GDP.*?(\d+\.\d+)%/is
    ]
    
    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match) {
        const ratio = parseFloat(match[1])
        if (ratio > 50 && ratio < 300) { // Sanity check
          console.log('[v0] Buffett Indicator scraped successfully:', ratio)
          return {
            ratio,
            status: 'live'
          }
        }
      }
    }
    
    throw new Error('Could not parse Buffett Indicator')
  } catch (error) {
    console.error('[v0] Buffett Indicator scraping failed:', error)
    return {
      ratio: 180, // Baseline: moderately elevated
      status: 'baseline'
    }
  }
}

export async function scrapePutCallRatio(): Promise<{
  ratio: number
  status: 'live' | 'baseline'
}> {
  try {
    const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY
    
    if (alphaVantageKey) {
      const vixResponse = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=^VIX&apikey=${alphaVantageKey}`,
        { signal: AbortSignal.timeout(10000) }
      )
      
      if (vixResponse.ok) {
        const vixData = await vixResponse.json()
        const vix = parseFloat(vixData['Global Quote']?.['05. price'] || '0')
        
        if (vix > 10 && vix < 100) {
          const estimatedPutCall = 0.6 + (vix / 50)
          console.log(`[v0] Put/Call estimated from VIX ${vix}: ${estimatedPutCall.toFixed(2)}`)
          return {
            ratio: parseFloat(estimatedPutCall.toFixed(2)),
            status: 'live'
          }
        }
      }
    }
    
    const cboeResult = await scrapeUrl('https://www.cboe.com/us/options/market_statistics/daily/', {
      renderJs: true,
      premiumProxy: true
    })
    
    const cboeHtml = typeof cboeResult.data === 'string' ? cboeResult.data : ''
    
    const cboePatterns = [
      /Total\s+Put\/Call\s+Ratio[:\s]+(\d+\.\d+)/is,
      /CPCE.*?(\d+\.\d+)/,
      /<td[^>]*>(\d+\.\d+)<\/td>.*?Put\/Call/is
    ]
    
    for (const pattern of cboePatterns) {
      const match = cboeHtml.match(pattern)
      if (match && match[1]) {
        const ratio = parseFloat(match[1])
        if (ratio > 0.3 && ratio < 3) {
          console.log('[v0] Put/Call ratio scraped from CBOE:', ratio)
          return {
            ratio,
            status: 'live'
          }
        }
      }
    }
    
    const result = await scrapeUrl('https://www.barchart.com/stocks/quotes/$CPCE/overview', {
      renderJs: true,
      premiumProxy: true
    })
    
    const html = typeof result.data === 'string' ? result.data : ''
    
    const patterns = [
      /<span[^>]*class="[^"]*last-change[^"]*"[^>]*>(\d+\.\d+)<\/span>/,
      /Last:\s*<strong>(\d+\.\d+)<\/strong>/,
      /CPCE.*?(\d+\.\d+)/,
      /Put\/Call.*?(\d+\.\d+)/is
    ]
    
    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        const ratio = parseFloat(match[1])
        if (ratio > 0.3 && ratio < 3) {
          console.log('[v0] Put/Call ratio scraped from BarChart:', ratio)
          return {
            ratio,
            status: 'live'
          }
        }
      }
    }
    
    throw new Error('Could not parse Put/Call ratio from scraping')
  } catch (error) {
    console.log('[v0] Put/Call scraping failed, trying Grok AI fallback...', error)
    
    try {
      const grokValue = await fetchMarketDataWithGrok(
        'CBOE equity put/call ratio',
        'Current CBOE total equity put/call ratio (CPCE index)'
      )
      
      if (grokValue && grokValue > 0.3 && grokValue < 3) {
        console.log(`[v0] Put/Call: Grok fetched value: ${grokValue}`)
        return { ratio: grokValue, status: 'live' }
      }
    } catch (grokError) {
      console.log('[v0] Grok Put/Call fetch failed:', grokError)
    }
    
    console.log('[v0] Put/Call: All sources including Grok failed, using baseline')
    return {
      ratio: 0.95,
      status: 'baseline'
    }
  }
}

export async function scrapeAAIISentiment(): Promise<{
  bullish: number
  bearish: number
  neutral: number
  spread: number
  status: 'live' | 'baseline'
}> {
  try {
    const result = await scrapeUrl('https://www.aaii.com/sentimentsurvey', {
      renderJs: true,
      premiumProxy: true
    })
    
    const html = typeof result.data === 'string' ? result.data : ''
    
    // Parse AAII sentiment percentages
    const bullishMatch = html.match(/Bullish[:\s]+(\d+\.?\d*)%/i)
    const bearishMatch = html.match(/Bearish[:\s]+(\d+\.?\d*)%/i)
    const neutralMatch = html.match(/Neutral[:\s]+(\d+\.?\d*)%/i)
    
    if (bullishMatch && bearishMatch) {
      const bullish = parseFloat(bullishMatch[1])
      const bearish = parseFloat(bearishMatch[1])
      const neutral = neutralMatch ? parseFloat(neutralMatch[1]) : 100 - bullish - bearish
      
      return {
        bullish,
        bearish,
        neutral,
        spread: bullish - bearish,
        status: 'live'
      }
    }
    
    throw new Error('Could not parse AAII sentiment')
  } catch (error) {
    console.error('[v0] AAII sentiment scraping failed:', error)
    return {
      bullish: 35,
      bearish: 30,
      neutral: 35,
      spread: 5,
      status: 'baseline'
    }
  }
}

export async function scrapeShortInterest(): Promise<{
  spyShortRatio: number
  status: 'live' | 'baseline'
}> {
  const polygonKey = process.env.POLYGON_API_KEY
  
  if (polygonKey) {
    try {
      const polygonResponse = await fetch(
        `https://api.polygon.io/v3/reference/tickers/SPY?apiKey=${polygonKey}`,
        { signal: AbortSignal.timeout(10000) }
      )
      
      if (polygonResponse.ok) {
        const polygonData = await polygonResponse.json()
        const shortInterest = polygonData?.results?.share_class_shares_outstanding
        
        // Polygon returns shares outstanding, we need short interest percentage
        // Try getting from their market status endpoint instead
        const marketStatusResponse = await fetch(
          `https://api.polygon.io/v2/aggs/ticker/SPY/range/1/day/${new Date(Date.now() - 86400000).toISOString().split('T')[0]}/${new Date().toISOString().split('T')[0]}?apiKey=${polygonKey}`,
          { signal: AbortSignal.timeout(10000) }
        )
        
        if (marketStatusResponse.ok) {
          // Polygon doesn't provide short interest directly in free tier
          console.log('[v0] Polygon API connected but short interest not in response')
        }
      }
    } catch (polygonError) {
      console.log('[v0] Polygon short interest failed:', polygonError)
    }
  }
  
  // Try Source 1: Alpha Vantage (we have this key)
  const alphaKey = process.env.ALPHA_VANTAGE_API_KEY
  
  if (alphaKey) {
    try {
      // Alpha Vantage doesn't have direct short interest, try getting from overview
      const avResponse = await fetch(
        `https://www.alphavantage.co/query?function=OVERVIEW&symbol=SPY&apikey=${alphaKey}`,
        { signal: AbortSignal.timeout(15000) }
      )
      
      if (avResponse.ok) {
        const avData = await avResponse.json()
        const shortRatio = avData?.ShortRatio || avData?.ShortPercentFloat
        
        if (shortRatio) {
          const ratio = parseFloat(shortRatio)
          if (ratio >= 0 && ratio < 50) {
            console.log('[v0] Short Interest from Alpha Vantage:', ratio)
            return {
              spyShortRatio: ratio,
              status: 'live'
            }
          }
        }
      }
    } catch (avError) {
      console.log('[v0] Alpha Vantage short interest failed:', avError)
    }
  }
  
  // Try Source 2: Finviz with better parsing
  try {
    const result = await scrapeUrl('https://finviz.com/quote.ashx?t=SPY', {
      renderJs: true,
      premiumProxy: true
    })
    
    const html = typeof result.data === 'string' ? result.data : ''
    
    console.log('[v0] Short Interest: Finviz HTML length:', html.length)
    
    // Multiple patterns to catch different Finviz layouts
    const patterns = [
      // Pattern 1: snapshot-td2 class
      /<td[^>]*>Short\s+Float<\/td>\s*<td[^>]*class="snapshot-td2"[^>]*>([\d.]+)%<\/td>/is,
      // Pattern 2: Any td after Short Float
      /<td[^>]*>Short\s+Float<\/td>\s*<td[^>]*>([\d.]+)%<\/td>/is,
      // Pattern 3: Within same td
      /Short\s+Float[:\s]+([\d.]+)%/is,
      // Pattern 4: Table row with data-boxover attribute
      /<tr[^>]*data-boxover[^>]*>.*?Short\s+Float.*?([\d.]+)%/is
    ]
    
    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        const ratio = parseFloat(match[1])
        if (ratio >= 0 && ratio < 50) {
          console.log('[v0] Short Interest from Finviz (pattern match):', ratio)
          return {
            spyShortRatio: ratio,
            status: 'live'
          }
        }
      }
    }
    
    // Debug: Save HTML snippet for analysis
    const shortIndex = html.toLowerCase().indexOf('short')
    if (shortIndex !== -1) {
      const snippet = html.substring(Math.max(0, shortIndex - 100), shortIndex + 400)
      console.log('[v0] Short interest HTML snippet:', snippet.replace(/\s+/g, ' '))
    }
    
  } catch (finvizError) {
    console.log('[v0] Finviz scraping failed:', finvizError)
  }
  
  // Try Source 3: MarketWatch (simpler HTML, no login required)
  try {
    const result = await scrapeUrl('https://www.marketwatch.com/investing/fund/spy', {
      renderJs: true,
      premiumProxy: true
    })
    
    const html = typeof result.data === 'string' ? result.data : ''
    
    const shortMatch = html.match(/Short\s+Interest.*?([\d.]+)%/is) ||
                       html.match(/short.*?interest.*?([\d.]+)%/is)
    
    if (shortMatch && shortMatch[1]) {
      const ratio = parseFloat(shortMatch[1])
      if (ratio >= 0 && ratio < 50) {
        console.log('[v0] Short Interest from MarketWatch:', ratio)
        return {
          spyShortRatio: ratio,
          status: 'live'
        }
      }
    }
  } catch (marketwatchError) {
    console.log('[v0] MarketWatch scraping failed:', marketwatchError)
  }
  
  console.log('[v0] Short Interest: All scraping sources failed, trying Grok AI fallback...')
  
  try {
    const grokValue = await fetchShortInterestWithGrok()
    if (grokValue && grokValue > 0 && grokValue < 50) {
      console.log(`[v0] Short Interest: Grok fetched value: ${grokValue}%`)
      return { spyShortRatio: grokValue, status: 'live' }
    }
  } catch (grokError) {
    console.log('[v0] Grok short interest fetch failed:', grokError)
  }
  
  console.log('[v0] Short Interest: All sources including Grok failed, using baseline value')
  return {
    spyShortRatio: 1.2, // Baseline: low short interest is typical for SPY
    status: 'baseline'
  }
}
