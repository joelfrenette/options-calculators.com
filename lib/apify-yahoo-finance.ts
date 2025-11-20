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
  const maxAttempts = 60
  const pollInterval = 2000

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval))

    const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`, {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json" },
    })

    if (!statusResponse.ok) {
      throw new Error(`Failed to fetch run status: ${statusResponse.status}`)
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

      const itemsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`, {
        signal: AbortSignal.timeout(10000),
        headers: { Accept: "application/json" },
      })

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
  }

  throw new Error(`Actor run timed out after ${(maxAttempts * pollInterval) / 1000} seconds`)
}
