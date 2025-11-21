// CCPI Caching Utilities
// Handles localStorage operations for CCPI data

import type { CCPIData, HistoricalData } from "./types"
import { CACHE_KEYS } from "./constants"

/**
 * Saves CCPI data to localStorage
 */
export function saveCCPIToCache(data: CCPIData): boolean {
  try {
    const cachedData = {
      ...data,
      cachedAt: new Date().toISOString(),
    }
    localStorage.setItem(CACHE_KEYS.CCPI_DATA, JSON.stringify(cachedData))
    console.log("[v0] CCPI data saved to localStorage")
    return true
  } catch (error) {
    console.error("[v0] Failed to save to localStorage:", error)
    return false
  }
}

/**
 * Loads CCPI data from localStorage
 */
export function loadCCPIFromCache(): CCPIData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.CCPI_DATA)
    if (!cached) return null

    const parsedCache = JSON.parse(cached) as CCPIData
    console.log("[v0] CCPI: Loaded from localStorage", parsedCache.timestamp)
    return parsedCache
  } catch (error) {
    console.error("[v0] Failed to parse cached CCPI data:", error)
    return null
  }
}

export const getCachedData = loadCCPIFromCache
export const setCachedData = saveCCPIToCache

/**
 * Clears CCPI data from localStorage
 */
export function clearCCPICache(): void {
  try {
    localStorage.removeItem(CACHE_KEYS.CCPI_DATA)
    console.log("[v0] CCPI cache cleared")
  } catch (error) {
    console.error("[v0] Failed to clear CCPI cache:", error)
  }
}

/**
 * Saves historical data to localStorage
 */
export function saveHistoryToCache(history: HistoricalData): boolean {
  try {
    localStorage.setItem(CACHE_KEYS.CCPI_HISTORY, JSON.stringify(history))
    return true
  } catch (error) {
    console.error("[v0] Failed to save history to localStorage:", error)
    return false
  }
}

/**
 * Loads historical data from localStorage
 */
export function loadHistoryFromCache(): HistoricalData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.CCPI_HISTORY)
    return cached ? JSON.parse(cached) : null
  } catch (error) {
    console.error("[v0] Failed to parse cached history:", error)
    return null
  }
}

/**
 * Saves executive summary to localStorage
 */
export function saveSummaryToCache(summary: string): boolean {
  try {
    localStorage.setItem(CACHE_KEYS.EXECUTIVE_SUMMARY, summary)
    return true
  } catch (error) {
    console.error("[v0] Failed to save summary to localStorage:", error)
    return false
  }
}

/**
 * Loads executive summary from localStorage
 */
export function loadSummaryFromCache(): string | null {
  try {
    return localStorage.getItem(CACHE_KEYS.EXECUTIVE_SUMMARY)
  } catch (error) {
    console.error("[v0] Failed to load summary from localStorage:", error)
    return null
  }
}

/**
 * Checks if cached data is fresh (within specified minutes)
 */
export function isCacheFresh(cachedAt: string | undefined, maxAgeMinutes = 5): boolean {
  if (!cachedAt) return false

  const cacheTime = new Date(cachedAt).getTime()
  const now = Date.now()
  const ageMinutes = (now - cacheTime) / (1000 * 60)

  return ageMinutes < maxAgeMinutes
}

export function hasFreshCache(maxAgeMinutes = 5): boolean {
  const cached = loadCCPIFromCache()
  if (!cached) return false
  return isCacheFresh(cached.cachedAt, maxAgeMinutes)
}
