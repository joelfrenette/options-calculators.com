/**
 * The CNN Fear & Greed scrape, and the per-indicator description copy.
 *
 * Split out of `app/api/market-sentiment/route.ts` (P6-13) unchanged.
 */
import { resolveApiKey } from "@/lib/api-keys"
import { meteredFetch } from "@/lib/metered-fetch"


export async function scrapeCNNFearGreed() {
  if (!resolveApiKey("SCRAPINGBEE_API_KEY")) {
    console.log("[v0] ScrapingBee API key not found, skipping CNN scraping")
    return null
  }

  try {
    const url = `https://app.scrapingbee.com/api/v1/?api_key=${resolveApiKey("SCRAPINGBEE_API_KEY")}&url=${encodeURIComponent("https://www.cnn.com/markets/fear-and-greed")}&render_js=true&wait=5000&wait_for=.market-fng-gauge`

    console.log("[v0] Fetching CNN Fear & Greed page with JavaScript rendering...")
    const response = await meteredFetch("scrapingbee", url, { signal: AbortSignal.timeout(30000), routeTag: "cnn-fear-greed" })

    if (!response.ok) {
      console.log(`[v0] ScrapingBee returned ${response.status}`)
      return null
    }

    const html = await response.text()
    console.log(`[v0] Received HTML, length: ${html.length} characters`)

    let mainScore = 50
    let mainSentiment = "neutral"

    // Try multiple patterns to find the main Fear & Greed score
    const scorePatterns = [
      // Look for the number displayed prominently on the gauge (usually in a span or div with specific classes)
      /market-fng-gauge__dial-number[^>]*>(\d+)/i,
      /fng-score[^>]*>(\d+)/i,
      /fear-greed-score[^>]*>(\d+)/i,
      // Look for data attributes
      /data-score="(\d+)"/i,
      /data-value="(\d+)"/i,
      // Look for JSON data with score
      /"score"\s*:\s*(\d+\.?\d*)/i,
      /"rating_score"\s*:\s*(\d+\.?\d*)/i,
      // Generic patterns as fallback
      /score[^>]{0,50}>(\d+)</i,
      />(\d+)<.*?(fear|greed)/i,
    ]

    for (const pattern of scorePatterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        const parsedScore = Number.parseFloat(match[1])
        // Validate the score is in expected range (0-100)
        if (parsedScore >= 0 && parsedScore <= 100) {
          mainScore = Math.round(parsedScore)
          console.log(`[v0] ✓ Extracted main CNN score: ${mainScore} using pattern: ${pattern.source.substring(0, 50)}`)
          break
        }
      }
    }

    if (mainScore === 50) {
      console.log("[v0] ⚠️ Could not extract score from HTML, defaulting to 50")
      // Save a portion of HTML for debugging
      console.log("[v0] HTML sample (first 1000 chars):", html.substring(0, 1000))
    }

    // Determine main sentiment from score
    if (mainScore < 25) mainSentiment = "extreme fear"
    else if (mainScore < 45) mainSentiment = "fear"
    else if (mainScore <= 55) mainSentiment = "neutral"
    else if (mainScore < 75) mainSentiment = "greed"
    else mainSentiment = "extreme greed"

    console.log(`[v0] CNN Main Score: ${mainScore}/100 (${mainSentiment})`)

    // CNN displays each indicator with a label like "EXTREME FEAR", "FEAR", "NEUTRAL", "GREED", "EXTREME GREED"
    const indicators: Array<{ name: string; score: number; sentiment: string; description: string }> = []

    // Define indicator names and their patterns in the HTML
    const indicatorPatterns = [
      { name: "Market Momentum", keywords: ["market momentum", "s&amp;p 500", "moving average"] },
      { name: "Stock Price Strength", keywords: ["stock price strength", "52-week", "highs"] },
      { name: "Stock Price Breadth", keywords: ["stock price breadth", "mcclellan", "volume"] },
      { name: "Put and Call Options", keywords: ["put and call", "options", "put/call"] },
      { name: "Market Volatility", keywords: ["market volatility", "vix", "volatility"] },
      { name: "Safe Haven Demand", keywords: ["safe haven", "bond", "treasury"] },
      { name: "Junk Bond Demand", keywords: ["junk bond", "high yield", "credit"] },
    ]

    for (const indicator of indicatorPatterns) {
      let foundScore = mainScore // Default to main score
      let foundSentiment = mainSentiment // Default to main sentiment

      // Try to find this indicator's section in the HTML
      for (const keyword of indicator.keywords) {
        // Look for the indicator name followed by a sentiment label
        const regex = new RegExp(keyword + "[\\s\\S]{0,500}?(extreme\\s+fear|fear|neutral|greed|extreme\\s+greed)", "i")
        const match = html.match(regex)

        if (match) {
          const sentimentText = match[1].toLowerCase().trim()
          console.log(`[v0] Found sentiment for ${indicator.name}: ${sentimentText}`)

          // Map sentiment text to score
          if (sentimentText.includes("extreme fear")) {
            foundScore = 10
            foundSentiment = "EXTREME FEAR"
          } else if (sentimentText === "fear") {
            foundScore = 30
            foundSentiment = "FEAR"
          } else if (sentimentText === "neutral") {
            foundScore = 50
            foundSentiment = "NEUTRAL"
          } else if (sentimentText === "greed") {
            foundScore = 70
            foundSentiment = "GREED"
          } else if (sentimentText.includes("extreme greed")) {
            foundScore = 90
            foundSentiment = "EXTREME GREED"
          }
          break
        }
      }

      indicators.push({
        name: indicator.name,
        score: foundScore,
        sentiment: foundSentiment,
        description: getIndicatorDescription(indicator.name),
      })

      console.log(`[v0] CNN Indicator: ${indicator.name} = ${foundScore}/100 (${foundSentiment})`)
    }

    // P3-18, confirmed live 2026-08-11. This block was captioned "Extract
    // historical data points for changes" and extracted nothing: all four were
    // set to `mainScore`, today's reading, so every change downstream computed
    // to exactly 0.0 and was published as a measured delta meaning "unchanged".
    // **A comment describing an extraction that does not happen is the same
    // defect as a label naming a source the code does not read.** The scrape
    // reads one page showing one score; it has no history, and now says so.
    const historical = {
      yesterday: null,
      lastWeek: null,
      lastMonth: null,
      lastYear: null,
    }

    return {
      score: mainScore,
      sentiment: mainSentiment,
      indicators: indicators,
      historical: historical,
    }
  } catch (error) {
    console.error("[v0] Error scraping CNN Fear & Greed:", error)
    return null
  }
}

// Helper function to get indicator descriptions
export function getIndicatorDescription(name: string): string {
  const descriptions: Record<string, string> = {
    "Market Momentum": "S&P 500 vs 125-day MA",
    "Stock Price Strength": "52-week highs vs lows",
    "Stock Price Breadth": "McClellan Volume Summation",
    "Put and Call Options": "5-day average ratio",
    "Market Volatility": "VIX vs 50-day MA",
    "Safe Haven Demand": "20-day stock vs bond returns",
    "Junk Bond Demand": "Yield spread analysis",
  }
  return descriptions[name] || "Market indicator"
}
