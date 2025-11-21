// CCPI Calculation & Utility Functions
// Pure functions for color mapping, scoring, and data transformations

import type { CCPIData, CCPIIndicatorThresholds, CCPIRegimeZone, CCPIIndicatorStatus } from "./types"
import { COLOR_MAP, GRADIENT_BAR_COLORS, CCPI_THRESHOLDS, REGIME_COLORS, PILLAR_WEIGHTS } from "./constants"

/**
 * Converts color name to hex value
 */
export function getReadableColor(colorName: string): string {
  return COLOR_MAP[colorName as keyof typeof COLOR_MAP] || COLOR_MAP.gray
}

/**
 * Gets color for gradient bar based on percentage (0-100)
 */
export function getBarColor(percentage: number): string {
  if (percentage <= 33) return GRADIENT_BAR_COLORS.low
  if (percentage <= 66) return GRADIENT_BAR_COLORS.medium
  return GRADIENT_BAR_COLORS.high
}

/**
 * Gets Tailwind CSS class for regime color based on CCPI level
 */
export function getRegimeColor(level: number): string {
  if (level >= CCPI_THRESHOLDS.CRASH_WATCH) return REGIME_COLORS.CRASH_WATCH
  if (level >= CCPI_THRESHOLDS.HIGH_ALERT) return REGIME_COLORS.HIGH_ALERT
  if (level >= CCPI_THRESHOLDS.CAUTION) return REGIME_COLORS.CAUTION
  if (level >= CCPI_THRESHOLDS.NORMAL) return REGIME_COLORS.NORMAL
  return REGIME_COLORS.LOW_RISK
}

/**
 * Gets regime zone information based on CCPI score
 */
export function getRegimeZone(ccpi: number): CCPIRegimeZone {
  if (ccpi >= CCPI_THRESHOLDS.CRASH_WATCH) return { color: "red", label: "CRASH WATCH" }
  if (ccpi >= CCPI_THRESHOLDS.HIGH_ALERT) return { color: "orange", label: "HIGH ALERT" }
  if (ccpi >= CCPI_THRESHOLDS.CAUTION) return { color: "yellow", label: "CAUTION" }
  if (ccpi >= CCPI_THRESHOLDS.NORMAL) return { color: "lightgreen", label: "NORMAL" }
  return { color: "green", label: "LOW RISK" }
}

/**
 * Determines indicator status based on value and thresholds
 */
export function getIndicatorStatus(value: number, thresholds: CCPIIndicatorThresholds): CCPIIndicatorStatus {
  // If ideal value provided, calculate deviation
  if (thresholds.ideal !== undefined) {
    const deviation = Math.abs(value - thresholds.ideal)
    if (deviation < 5) return { color: "bg-green-500", status: "Normal" }
    if (deviation < 15) return { color: "bg-yellow-500", status: "Elevated" }
    return { color: "bg-red-500", status: "Warning" }
  }

  // Otherwise use low/high thresholds
  if (value <= thresholds.low) return { color: "bg-green-500", status: "Low Risk" }
  if (value <= thresholds.high) return { color: "bg-yellow-500", status: "Moderate" }
  return { color: "bg-red-500", status: "High Risk" }
}

/**
 * Sorts canaries by severity (high > medium > low) then by impact score
 */
export function sortCanaries(canaries: CCPIData["canaries"]): CCPIData["canaries"] {
  return [...canaries].sort((a, b) => {
    // First sort by severity: high before medium before low
    if (a.severity === "high" && b.severity !== "high") return -1
    if (a.severity !== "high" && b.severity === "high") return 1
    if (a.severity === "medium" && b.severity === "low") return -1
    if (a.severity === "low" && b.severity === "medium") return 1

    // Within same severity, sort by impact score descending
    const impactA = a.impactScore ?? 0
    const impactB = b.impactScore ?? 0
    return impactB - impactA
  })
}

/**
 * Calculates CCPI score from pillar values using weighted average
 */
export function calculateCCPI(pillars: CCPIData["pillars"]): number {
  return (
    pillars.momentum * PILLAR_WEIGHTS.momentum +
    pillars.riskAppetite * PILLAR_WEIGHTS.riskAppetite +
    pillars.valuation * PILLAR_WEIGHTS.valuation +
    pillars.macro * PILLAR_WEIGHTS.macro
  )
}

/**
 * Validates that CCPI calculation matches expected value
 */
export function validateCCPICalculation(pillars: CCPIData["pillars"], expectedCCPI: number, tolerance = 0.5): boolean {
  const calculated = calculateCCPI(pillars)
  return Math.abs(calculated - expectedCCPI) <= tolerance
}

/**
 * Formats pillar contribution for logging
 */
export function formatPillarContribution(pillars: CCPIData["pillars"]): string {
  return [
    `Momentum: ${pillars.momentum} × 35% = ${(pillars.momentum * 0.35).toFixed(1)}`,
    `Risk Appetite: ${pillars.riskAppetite} × 30% = ${(pillars.riskAppetite * 0.3).toFixed(1)}`,
    `Valuation: ${pillars.valuation} × 15% = ${(pillars.valuation * 0.15).toFixed(1)}`,
    `Macro: ${pillars.macro} × 20% = ${(pillars.macro * 0.2).toFixed(1)}`,
  ].join("\n")
}

/**
 * Counts active warnings (high and medium severity canaries)
 */
export function countActiveWarnings(canaries: CCPIData["canaries"]): number {
  return canaries.filter((c) => c.severity === "high" || c.severity === "medium").length
}
