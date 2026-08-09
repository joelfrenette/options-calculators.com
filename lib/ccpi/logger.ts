// CCPI logging utilities
// Centralized console logging with consistent formatting

import type { CCPIData } from "./types"
import { calculateCCPI, countActiveWarnings, formatPillarContribution } from "./calculations"

/**
 * Logs CCPI data load summary
 */
export function logCCPIDataLoaded(data: CCPIData): void {
  console.log("[v0] CCPI Data Loaded:", {
    ccpi: data.ccpi,
    certainty: data.certainty,
    regime: data.regime.name,
    pillars: data.pillars,
    activeCanaries: countActiveWarnings(data.canaries),
    // Was `|| 34`, a stale count from before the P3-19 indicator cull.
    totalIndicators: data.totalIndicators ?? "unavailable",
    crashAmplifiers: data.crashAmplifiers?.length || 0,
    totalBonus: data.totalBonus || 0,
  })

  console.log("[v0] CCPI: crashAmplifiers from API:", data.crashAmplifiers)
  console.log("[v0] CCPI: totalBonus from API:", data.totalBonus)
  console.log("[v0] CCPI: baseCCPI from API:", data.baseCCPI)
}

/**
 * Logs pillar breakdown with weighted contributions
 */
export function logPillarBreakdown(data: CCPIData): void {
  // formatPillarContribution is null-aware (a pillar is null when excluded for
  // insufficient scored weight) and renormalizes like the scoring core.
  console.log("Pillar Breakdown (weighted contribution to CCPI):")
  console.log(formatPillarContribution(data.pillars))

  const calculatedCCPI = calculateCCPI(data.pillars)
  console.log(
    "  Calculated CCPI:",
    calculatedCCPI === null ? "n/a (no scoreable pillars)" : calculatedCCPI.toFixed(1),
    "| API CCPI:",
    data.ccpi,
  )
}

/**
 * Logs cache operations
 */
export function logCacheOperation(operation: "loaded" | "saved", timestamp?: string): void {
  if (operation === "loaded") {
    console.log("[v0] CCPI: Loaded from cache", timestamp)
  } else {
    console.log("[v0] CCPI data saved to cache")
  }
}

/**
 * Logs executive summary generation
 */
export function logExecutiveSummary(summary: string): void {
  console.log("[v0] Grok executive summary generated:", summary)
}

/**
 * Logs errors
 */
export function logError(context: string, error: unknown): void {
  console.error(`[v0] ${context}:`, error)
}
