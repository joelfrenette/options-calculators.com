// CCPI logging utilities
// Centralized console logging with consistent formatting

import type { CCPIData } from "./types"
import { calculateCCPI, countActiveWarnings } from "./calculations"

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
    totalIndicators: data.totalIndicators || 34,
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
  console.log("Pillar Breakdown (weighted contribution to CCPI):")
  console.log("  Momentum:", data.pillars.momentum, "× 35% =", (data.pillars.momentum * 0.35).toFixed(1))
  console.log("  Risk Appetite:", data.pillars.riskAppetite, "× 30% =", (data.pillars.riskAppetite * 0.3).toFixed(1))
  console.log("  Valuation:", data.pillars.valuation, "× 15% =", (data.pillars.valuation * 0.15).toFixed(1))
  console.log("  Macro:", data.pillars.macro, "× 20% =", (data.pillars.macro * 0.2).toFixed(1))

  const calculatedCCPI = calculateCCPI(data.pillars)
  console.log("  Calculated CCPI:", calculatedCCPI.toFixed(1), "| API CCPI:", data.ccpi)
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
