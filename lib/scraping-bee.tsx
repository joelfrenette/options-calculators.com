/**
 * ScrapingBee Utility Functions
 * Web scraping service for extracting data from websites
 */

import { fetchMarketDataWithGrok } from "./grok-market-data"
import { resolveApiKey } from "./api-keys"

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
export async function scrapeUrl(url: string, options: ScrapingBeeOptions = {}): Promise<ScrapingBeeResponse> {
  // Short-circuit when ScrapingBee is unconfigured/disabled. (The original
  // implementation used a relative `/api/scraping-bee` fetch which is invalid
  // server-side and always threw — callers swallowed the rejection and fell
  // back to baseline. Fail cleanly so callers can branch instead.)
  const key = resolveApiKey("SCRAPINGBEE_API_KEY") // respects DISABLED_APIS
  if (!key) {
    throw new Error("ScrapingBee is not configured")
  }

  const params = new URLSearchParams({
    api_key: key,
    url,
    render_js: options.renderJs === false ? "false" : "true",
    premium_proxy: options.premiumProxy === false ? "false" : "true",
    country_code: options.countryCode || "us",
    ...(options.customParams || {}),
  })
  const response = await fetch(`https://app.scrapingbee.com/api/v1/?${params.toString()}`, {
    headers: { Accept: "text/html, application/json, */*" },
    signal: AbortSignal.timeout(25000),
  })

  if (!response.ok) {
    throw new Error(`ScrapingBee HTTP ${response.status}`)
  }
  const text = await response.text()
  return {
    success: true,
    data: text,
    metadata: {
      url,
      contentType: response.headers.get("content-type"),
      timestamp: new Date().toISOString(),
      creditsUsed: response.headers.get("Spb-cost") || "0",
    },
  }
}

/**
 * Extract text content from a webpage
 */
export async function extractText(url: string): Promise<string> {
  const result = await scrapeUrl(url, { renderJs: true })

  if (typeof result.data === "string") {
    // Strip HTML tags and return clean text
    return result.data
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  return JSON.stringify(result.data)
}

/**
 * Extract structured data from a webpage using CSS selectors
 */
export async function extractData(url: string, selectors: Record<string, string>): Promise<Record<string, string>> {
  const result = await scrapeUrl(url, { renderJs: true })
  const html = typeof result.data === "string" ? result.data : ""

  // Simple extraction (for more complex cases, use a server-side parser)
  const extracted: Record<string, string> = {}

  for (const [key, selector] of Object.entries(selectors)) {
    const regex = new RegExp(`<[^>]*class="${selector}"[^>]*>([^<]*)<`, "i")
    const match = html.match(regex)
    extracted[key] = match ? match[1].trim() : ""
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
    premiumProxy: true, // Use premium proxy for financial sites
  })

  return {
    raw: result.data,
    metadata: result.metadata,
  }
}

export async function scrapeBuffettIndicator(): Promise<{
  ratio: number
  status: "live" | "baseline"
}> {
  try {
    const result = await scrapeUrl("https://www.gurufocus.com/stock-market-valuations.php", {
      renderJs: true,
      premiumProxy: true,
    })

    const html = typeof result.data === "string" ? result.data : ""

    // Parse the clearly stated ratio from GuruFocus
    const patterns = [
      /currently at\s+<strong>(\d+\.\d+)%<\/strong>/,
      /Ratio = \*\*(\d+\.\d+)%\*\*/,
      /(\d+\.\d+)%.*?Significantly Overvalued/s,
      /total market cap.*?GDP.*?(\d+\.\d+)%/is,
    ]

    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match) {
        const ratio = Number.parseFloat(match[1])
        if (ratio > 50 && ratio < 300) {
          // Sanity check
          console.log("[v0] Buffett Indicator scraped successfully:", ratio)
          return {
            ratio,
            status: "live",
          }
        }
      }
    }

    throw new Error("Could not parse Buffett Indicator")
  } catch (error) {
    // "not configured" is the user's deliberate choice (DISABLED_APIS) -> info, not error.
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes("not configured")) {
      console.log("[v0] Buffett Indicator: ScrapingBee disabled — using baseline")
    } else {
      console.error("[v0] Buffett Indicator scraping failed:", error)
    }
    return {
      ratio: 180, // Baseline: moderately elevated
      status: "baseline",
    }
  }
}

export async function scrapePutCallRatio(): Promise<{
  /** NULL when nothing measured or estimated one. Never a stand-in number. */
  ratio: number | null
  // "ai-estimate" added. This function had only "live" and "baseline", and it
  // returned "live" for two things that are not a measured put/call ratio:
  // an LLM's recollection, and `0.6 + vix / 50`. `/api/ccpi` maps
  // `status === "live"` straight to the `live` tier, and `live` SCORES — so
  // P6-34's decision that AI estimates must not score was bypassed on
  // `putCallRatio`, worth 29 of Risk Appetite's 100 points, by a self-report.
  status: "live" | "ai-estimate" | "baseline"
}> {
  // CBOE FIRST (P7-72). Grok used to run before it: the model was asked to
  // recall the CBOE put/call ratio, and any answer between 0.3 and 3 was
  // returned immediately as `ai-estimate` — so the REAL source was only ever
  // reached when the guess failed. P6-72 had correctly stopped that guess from
  // SCORING, which made the ordering look harmless; it was not. `ai-estimate`
  // does not score, so an LLM answering first meant `putCallRatio` contributed
  // nothing on almost every request, and the 29 points it is worth were
  // excluded by a call order rather than by any absence of data.
  //
  // Reversed. A measurement is tried before a recollection of one.
  try {
    const cboeResult = await scrapeUrl("https://www.cboe.com/us/options/market_statistics/daily/", {
      renderJs: true,
      premiumProxy: true,
      customParams: { timeout: "15000" }, // Shorter timeout
    })

    const cboeHtml = typeof cboeResult.data === "string" ? cboeResult.data : ""

    const cboePatterns = [
      /Total\s+Put\/Call\s+Ratio[:\s]+(\d+\.\d+)/is,
      /CPCE.*?(\d+\.\d+)/,
      /<td[^>]*>(\d+\.\d+)<\/td>.*?Put\/Call/is,
    ]

    for (const pattern of cboePatterns) {
      const match = cboeHtml.match(pattern)
      if (match && match[1]) {
        const ratio = Number.parseFloat(match[1])
        if (ratio > 0.3 && ratio < 3) {
          console.log("[v0] Put/Call ratio scraped from CBOE:", ratio)
          return {
            ratio,
            status: "live",
          }
        }
      }
    }
  } catch (cboeError) {
    console.log("[v0] CBOE scraping failed, falling back to an AI estimate:", cboeError)
  }

  // Only now the model, and only ever as `ai-estimate`, which does not score.
  console.log("[v0] Put/Call: CBOE unavailable, trying Grok (ai-estimate, does not score)...")
  try {
    const grokValue = await fetchMarketDataWithGrok(
      "CBOE equity put/call ratio",
      "Current CBOE total equity put/call ratio (CPCE index). Return just the decimal number like 0.85 or 1.05",
    )

    if (grokValue && grokValue > 0.3 && grokValue < 3) {
      console.log(`[v0] Put/Call: Grok value ${grokValue} (ai-estimate — excluded from scoring)`)
      return { ratio: grokValue, status: "ai-estimate" }
    }
  } catch (grokError) {
    console.log("[v0] Grok Put/Call fetch failed:", grokError)
  }

  // The Alpha Vantage branch that used to sit here computed
  // `estimatedPutCall = 0.6 + vix / 50` and returned it as `status: "live"`.
  // Three things wrong at once: it is not a put/call ratio, it is VIX; the CCPI
  // already scores `vix` as its own indicator, so this made two "independent"
  // Risk Appetite and Momentum inputs the same instrument (the P6-61 defect
  // inside the CCPI); and the variable was named `estimatedPutCall` with a log
  // line reading "estimated from VIX" while the status claimed live. Removed
  // rather than re-tiered — a derived value is not an input, and there is no
  // honest tier for a number that is not the thing it is named after.

  // Was `ratio: 0.95` (P7-72). A baseline tier keeps a number out of SCORING,
  // and this one was never scored — but it was still handed to the payload as
  // `putCallRatio`, where 0.95 is a perfectly ordinary reading. The rule from
  // P6-34 is that a missing value is null, not a plausible constant; the tier
  // says how good a number is, it cannot say that there is no number.
  console.log("[v0] Put/Call: all sources failed, returning null")
  return {
    ratio: null,
    status: "baseline",
  }
}

export async function scrapeAAIISentiment(): Promise<{
  bullish: number
  bearish: number
  neutral: number
  spread: number
  // "ai-estimate" added for the Grok path below — see P6-72.
  status: "live" | "ai-estimate" | "baseline"
}> {
  try {
    const result = await scrapeUrl("https://www.aaii.com/sentimentsurvey", {
      renderJs: true,
      premiumProxy: true,
    })

    const html = typeof result.data === "string" ? result.data : ""

    // Parse AAII sentiment percentages
    const bullishMatch = html.match(/Bullish[:\s]+(\d+\.?\d*)%/i)
    const bearishMatch = html.match(/Bearish[:\s]+(\d+\.?\d*)%/i)
    const neutralMatch = html.match(/Neutral[:\s]+(\d+\.?\d*)%/i)

    if (bullishMatch && bearishMatch) {
      const bullish = Number.parseFloat(bullishMatch[1])
      const bearish = Number.parseFloat(bearishMatch[1])
      const neutral = neutralMatch ? Number.parseFloat(neutralMatch[1]) : 100 - bullish - bearish

      console.log("[v0] AAII sentiment scraped successfully:", { bullish, bearish, neutral })
      return {
        bullish,
        bearish,
        neutral,
        spread: bullish - bearish,
        status: "live",
      }
    }

    throw new Error("Could not parse AAII sentiment")
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes("not configured")) {
      console.log("[v0] AAII: ScrapingBee disabled — trying AI fallback")
    } else {
      console.error("[v0] AAII sentiment scraping failed:", error)
    }
    console.log("[v0] AAII: Trying Grok AI fallback...")

    try {
      const bullishValue = await fetchMarketDataWithGrok(
        "AAII Bullish Sentiment Percentage",
        "Current American Association of Individual Investors (AAII) bullish sentiment survey percentage",
      )

      if (bullishValue && bullishValue > 0 && bullishValue < 100) {
        // Second instance of P6-72's bypass, in the same file. This returned
        // `status: "live"` for an LLM's recollection of the AAII survey, and
        // /api/ccpi scores `live` — `aaiiBullish` is worth 26 of Risk
        // Appetite's 100 points.
        //
        // It is also P6-61: only `bullish` came from the model. `bearish` was
        // `65 - bullish` clamped to 15-50 and `neutral` was the remainder, so
        // the whole three-way split — and the `spread` computed from it — was
        // manufactured from one guess. A survey's three figures are three
        // measurements; these could not disagree with each other.
        const bearish = Math.max(15, Math.min(50, 65 - bullishValue))
        const neutral = 100 - bullishValue - bearish

        console.log(`[v0] AAII bullish ${bullishValue} from Grok (ai-estimate — does not score)`)
        return {
          bullish: bullishValue,
          bearish: Number.parseFloat(bearish.toFixed(1)),
          neutral: Number.parseFloat(neutral.toFixed(1)),
          spread: bullishValue - bearish,
          status: "ai-estimate",
        }
      }
    } catch (grokError) {
      console.log("[v0] Grok AAII fetch failed:", grokError)
    }

    console.log("[v0] AAII: All sources including Grok failed, using baseline")
    return {
      bullish: 35,
      bearish: 30,
      neutral: 35,
      spread: 5,
      status: "baseline",
    }
  }
}

