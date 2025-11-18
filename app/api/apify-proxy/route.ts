import { getApiKey } from "@/lib/api-keys"
import { fetchApifyYahooFinance } from "@/lib/apify-yahoo-finance"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get("ticker")

  if (!ticker) {
    return Response.json({ error: "Ticker symbol is required" }, { status: 400 })
  }

  try {
    const result = await fetchApifyYahooFinance(ticker)
    
    if (result.error) {
      return Response.json(result, { status: 500 })
    }
    
    return Response.json(result)
  } catch (error) {
    console.error("[v0] Apify proxy error:", error)
    return Response.json({ 
      error: "Failed to fetch from Apify",
      dataSource: "apify-proxy-error",
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// async function tryActor(actorId: string, actorName: string, ticker: string, token: string) {
//   console.log(`[v0] Apify: Starting ${actorName} for ${ticker}...`)
//   console.log(`[v0] Apify: Actor ID: ${actorId}`)
//   console.log(`[v0] Apify: Token present: ${token.substring(0, 15)}...`)

//   const runResponse = await fetch(
//     `https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`,
//     {
//       method: "POST",
//       headers: { 
//         "Content-Type": "application/json",
//         "Accept": "application/json"
//       },
//       body: JSON.stringify({
//         tickers: [ticker],
//         // Additional options that might be required
//         maxResults: 1,
//         includeStats: true
//       }),
//       signal: AbortSignal.timeout(15000) // 15 second timeout for starting the run
//     }
//   )

//   console.log(`[v0] Apify: ${actorName} run response status: ${runResponse.status}`)
//   console.log(`[v0] Apify: ${actorName} run response headers:`, Object.fromEntries(runResponse.headers.entries()))
  
//   if (!runResponse.ok) {
//     const errorText = await runResponse.text()
//     console.error(`[v0] Apify: ${actorName} start failed with status ${runResponse.status}:`, errorText)
//     throw new Error(`Actor start failed: ${runResponse.status} - ${errorText}`)
//   }

//   const runData = await runResponse.json()
//   console.log(`[v0] Apify: ${actorName} full run response:`, JSON.stringify(runData, null, 2))
//   console.log(`[v0] Apify: ${actorName} run created with ID: ${runData.data.id}`)
  
//   const runId = runData.data.id
//   const datasetId = runData.data.defaultDatasetId

//   let attempts = 0
//   const maxAttempts = 60 // 2 minutes total (60 * 2 seconds)
//   const pollInterval = 2000 // Poll every 2 seconds

//   while (attempts < maxAttempts) {
//     await new Promise((resolve) => setTimeout(resolve, pollInterval))

//     const statusResponse = await fetch(
//       `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`,
//       { 
//         signal: AbortSignal.timeout(10000),
//         headers: { "Accept": "application/json" }
//       }
//     )
    
//     if (!statusResponse.ok) {
//       console.error(`[v0] Apify: Failed to fetch run status: ${statusResponse.status}`)
//       const errorText = await statusResponse.text()
//       console.error(`[v0] Apify: Status error details:`, errorText)
//       throw new Error(`Failed to fetch run status: ${statusResponse.status}`)
//     }
    
//     const statusData = await statusResponse.json()
//     const status = statusData.data.status
    
//     console.log(`[v0] Apify: ${actorName} poll ${attempts + 1}/${maxAttempts}, status: ${status}`)

//     if (status === "SUCCEEDED") {
//       console.log(`[v0] Apify: ${actorName} succeeded, fetching dataset ${datasetId}`)
      
//       const itemsResponse = await fetch(
//         `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`,
//         { 
//           signal: AbortSignal.timeout(10000),
//           headers: { "Accept": "application/json" }
//         }
//       )

//       if (!itemsResponse.ok) {
//         const errorText = await itemsResponse.text()
//         console.error(`[v0] Apify: Failed to fetch dataset items with status ${itemsResponse.status}:`, errorText)
//         throw new Error(`Failed to fetch dataset items: ${itemsResponse.status}`)
//       }

//       const items = await itemsResponse.json()
//       console.log(`[v0] Apify: ${actorName} fetched ${items.length} items for ${ticker}`)
      
//       if (items.length > 0) {
//         console.log(`[v0] Apify: ${actorName} sample data:`, JSON.stringify(items[0], null, 2).substring(0, 500))
//       }

//       if (!items || items.length === 0) {
//         console.warn(`[v0] Apify: ${actorName} returned no data for ${ticker}`)
//         return null // Try next actor
//       }

//       return { 
//         data: items[0],
//         dataSource: `apify-live-${actorName.toLowerCase().replace(/\s/g, '-')}`,
//         actorUsed: actorName,
//         timestamp: new Date().toISOString()
//       }
//     }

//     if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
//       console.error(`[v0] Apify: ${actorName} run ${status}`)
//       const errorMessage = statusData.data.statusMessage || `Actor run ${status}`
//       console.error(`[v0] Apify: Error message: ${errorMessage}`)
//       throw new Error(errorMessage)
//     }

//     attempts++
//   }

//   console.error(`[v0] Apify: ${actorName} timed out after ${maxAttempts * pollInterval / 1000} seconds`)
//   throw new Error(`Actor run timed out`)
// }
