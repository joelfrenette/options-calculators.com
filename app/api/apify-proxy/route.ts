import { getApiKey } from "@/lib/api-keys"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get("ticker")

  if (!ticker) {
    return Response.json({ error: "Ticker symbol is required" }, { status: 400 })
  }

  const APIFY_API_TOKEN = getApiKey("APIFY_API_TOKEN")

  if (!APIFY_API_TOKEN) {
    return Response.json({ error: "Apify API token not configured" }, { status: 500 })
  }

  try {
    console.log(`[v0] Apify: Starting actor for ${ticker}...`)

    // Start the Apify Yahoo Finance actor
    const runResponse = await fetch(`https://api.apify.com/v2/acts/3ThU47mCoIXQUkYDh/runs?token=${APIFY_API_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tickers: [ticker],
        proxy: { useApifyProxy: true },
      }),
    })

    if (!runResponse.ok) {
      throw new Error(`Apify actor start failed: ${runResponse.status}`)
    }

    const runData = await runResponse.json()
    const runId = runData.data.id
    const datasetId = runData.data.defaultDatasetId

    // Poll for completion (max 30 seconds)
    let attempts = 0
    const maxAttempts = 30

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`)
      const statusData = await statusResponse.json()
      const status = statusData.data.status

      if (status === "SUCCEEDED") {
        // Get results from dataset
        const itemsResponse = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`,
        )

        if (!itemsResponse.ok) {
          throw new Error(`Failed to fetch dataset items: ${itemsResponse.status}`)
        }

        const items = await itemsResponse.json()
        console.log(`[v0] Apify: Successfully fetched data for ${ticker}`)

        return Response.json({ data: items[0] || null })
      }

      if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        throw new Error(`Actor run ${status}`)
      }

      attempts++
    }

    throw new Error("Actor run timed out after 30 seconds")
  } catch (error) {
    console.error("[v0] Apify proxy error:", error)
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
