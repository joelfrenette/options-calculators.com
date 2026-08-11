// CCPI API functions
// Handles all data fetching operations for CCPI dashboard

import type { CCPIData, HistoricalData } from "./types"

/**
 * Fetches current CCPI data from the API
 */
export async function fetchCCPI(): Promise<CCPIData> {
  const response = await fetch("/api/ccpi")

  if (!response.ok) {
    throw new Error(`Failed to fetch CCPI data: ${response.status}`)
  }

  const data = await response.json()
  return data
}

/**
 * Fetches CCPI historical data
 */
export async function fetchCCPIHistory(): Promise<HistoricalData> {
  const response = await fetch("/api/ccpi/history")

  if (!response.ok) {
    throw new Error(`Failed to fetch CCPI history: ${response.status}`)
  }

  const data = await response.json()
  return data
}

/**
 * Generates executive summary using AI
 */
export async function fetchExecutiveSummary(ccpiData: CCPIData): Promise<string> {
  const response = await fetch("/api/ccpi/executive-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ccpiData),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch executive summary: ${response.status}`)
  }

  const result = await response.json()
  return result.summary
}

// P2-2 / P7-9. `cacheCCPIToServer` deleted here: it POSTed to /api/ccpi/cache,
// which is gone, and nothing outside this file called it anyway — it was already
// on the dead-export list before the route was removed.

/**
 * Comprehensive CCPI data refresh
 * Fetches data, caches it, and generates executive summary
 */
export async function refreshCCPIData(): Promise<{
  data: CCPIData
  summary: string | null
}> {
  // Fetch CCPI data
  const ccpiData = await fetchCCPI()

  // Add timestamp
  const dataWithTimestamp = {
    ...ccpiData,
    timestamp: new Date().toISOString(),
  }

  // P2-2. The non-blocking `cacheCCPIToServer(...)` call was here. It wrote to a
  // module-level variable on whichever serverless instance answered, so the next
  // request usually could not read it back — and its `.catch` swallowed the
  // failure, which is why nobody noticed the cache mostly did not cache.

  // Fetch executive summary (can fail gracefully)
  let summary: string | null = null
  try {
    summary = await fetchExecutiveSummary(dataWithTimestamp)
  } catch (error) {
    console.error("[v0] Failed to fetch executive summary:", error)
  }

  return {
    data: dataWithTimestamp,
    summary,
  }
}
