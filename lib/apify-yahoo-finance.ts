import { getApiKey } from "@/lib/api-keys"

export async function fetchApifyYahooFinance(ticker: string) {
  const APIFY_API_TOKEN = getApiKey("APIFY_API_TOKEN")

  if (!APIFY_API_TOKEN) {
    console.error("[v0] Apify: API token not configured")
    return {
      data: null,
      dataSource: "baseline-no-token",
      error: "API token not configured",
    }
  }

  // User's two actors in priority order
  const actors = [
    { id: "canadesk~yahoo-finance", name: "Canadesk Yahoo Finance" },
    { id: "architjn~yahoo-finance", name: "Architjn Yahoo Finance" },
  ]

  // Try each actor in sequence until one succeeds
  for (let i = 0; i < actors.length; i++) {
    const actor = actors[i]
    console.log(`[v0] Apify: Attempting actor ${i + 1}/${actors.length}: ${actor.name}`)

    try {
      const result = await tryActor(actor.id, actor.name, ticker, APIFY_API_TOKEN)
      if (result) {
        console.log(`[v0] Apify: Success with ${actor.name}`)
        return result
      }
    } catch (error) {
      console.error(`[v0] Apify: ${actor.name} failed:`, error instanceof Error ? error.message : String(error))
      // Continue to next actor
    }
  }

  // All actors failed
  console.error("[v0] Apify: All actors failed, using baseline")
  return {
    data: null,
    dataSource: "baseline-all-actors-failed",
    error: "All actors failed",
  }
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      // If we get a 502, retry with exponential backoff
      if (response.status === 502 && attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000) // Max 5s delay
        console.log(`[v0] Apify: Got 502, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000)
        console.log(`[v0] Apify: Fetch error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
    }
  }

  throw lastError || new Error("Failed after retries")
}

async function tryActor(actorId: string, actorName: string, ticker: string, token: string) {
  console.log(`[v0] Apify: Starting ${actorName} for ${ticker}...`)

  const runResponse = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      tickers: [ticker],
      maxResults: 1,
      includeStats: true,
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!runResponse.ok) {
    const errorText = await runResponse.text()
    if (errorText.includes("Too Many Requests") || errorText.includes("rate limit")) {
      console.error(`[v0] Apify: ${actorName} rate limited`)
      throw new Error(`Rate limited`)
    }
    console.error(`[v0] Apify: ${actorName} start failed with status ${runResponse.status}:`, errorText)
    throw new Error(`Actor start failed: ${runResponse.status}`)
  }

  const contentType = runResponse.headers.get("content-type")
  if (!contentType || !contentType.includes("application/json")) {
    const errorText = await runResponse.text()
    console.error(`[v0] Apify: ${actorName} returned non-JSON response:`, errorText.substring(0, 200))
    throw new Error(`Non-JSON response received`)
  }

  const runData = await runResponse.json()
  console.log(`[v0] Apify: ${actorName} run created with ID: ${runData.data.id}`)

  const runId = runData.data.id
  const datasetId = runData.data.defaultDatasetId

  let attempts = 0
  const maxAttempts = 30 // Reduced from 60 to 30
  const pollInterval = 3000 // Increased from 2000ms to 3000ms

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval))

    try {
      const statusResponse = await fetchWithRetry(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`,
        {
          signal: AbortSignal.timeout(10000),
          headers: { Accept: "application/json" },
        },
        3, // Retry up to 3 times for 502s
      )

      if (!statusResponse.ok) {
        console.warn(
          `[v0] Apify: ${actorName} status check failed with ${statusResponse.status}, will retry on next poll`,
        )
        attempts++
        continue
      }

      const statusContentType = statusResponse.headers.get("content-type")
      if (!statusContentType || !statusContentType.includes("application/json")) {
        const errorText = await statusResponse.text()
        console.error(`[v0] Apify: ${actorName} status returned non-JSON:`, errorText.substring(0, 200))
        throw new Error(`Non-JSON status response`)
      }

      const statusData = await statusResponse.json()
      const status = statusData.data.status

      console.log(`[v0] Apify: ${actorName} poll ${attempts + 1}/${maxAttempts}, status: ${status}`)

      if (status === "SUCCEEDED") {
        console.log(`[v0] Apify: ${actorName} succeeded, fetching dataset ${datasetId}`)

        const itemsResponse = await fetchWithRetry(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`,
          {
            signal: AbortSignal.timeout(10000),
            headers: { Accept: "application/json" },
          },
          3,
        )

        if (!itemsResponse.ok) {
          throw new Error(`Failed to fetch dataset items: ${itemsResponse.status}`)
        }

        const itemsContentType = itemsResponse.headers.get("content-type")
        if (!itemsContentType || !itemsContentType.includes("application/json")) {
          const errorText = await itemsResponse.text()
          console.error(`[v0] Apify: ${actorName} dataset returned non-JSON:`, errorText.substring(0, 200))
          throw new Error(`Non-JSON dataset response`)
        }

        const items = await itemsResponse.json()
        console.log(`[v0] Apify: ${actorName} fetched ${items.length} items for ${ticker}`)

        if (!items || items.length === 0) {
          console.warn(`[v0] Apify: ${actorName} returned no data for ${ticker}`)
          return null
        }

        return {
          data: items[0],
          dataSource: `apify-live-${actorName.toLowerCase().replace(/\s/g, "-")}`,
          actorUsed: actorName,
          timestamp: new Date().toISOString(),
        }
      }

      if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        throw new Error(`Actor run ${status}`)
      }

      attempts++
    } catch (error) {
      console.warn(
        `[v0] Apify: ${actorName} poll ${attempts + 1} error:`,
        error instanceof Error ? error.message : String(error),
      )

      // If we're near the end of max attempts, throw the error
      if (attempts >= maxAttempts - 3) {
        throw error
      }

      // Otherwise, continue polling
      attempts++
    }
  }

  throw new Error(`Actor run timed out after ${(maxAttempts * pollInterval) / 1000} seconds`)
}
