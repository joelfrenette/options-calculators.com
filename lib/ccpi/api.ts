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

/**
 * Caches CCPI data to the server
 */
export async function cacheCCPIToServer(data: CCPIData): Promise<void> {
  const response = await fetch("/api/ccpi/cache", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`Failed to cache CCPI data: ${response.status}`)
  }
}

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

  // Cache to server (non-blocking)
  cacheCCPIToServer(dataWithTimestamp).catch((error) => {
    console.error("[v0] Failed to cache CCPI data to server:", error)
  })

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
