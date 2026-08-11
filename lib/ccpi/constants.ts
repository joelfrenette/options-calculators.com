// CCPI Constants & Configuration
// Centralized thresholds, weights, and color mappings

export const CCPI_THRESHOLDS = {
  CRASH_WATCH: 80,
  HIGH_ALERT: 60,
  CAUTION: 40,
  NORMAL: 20,
  LOW_RISK: 0,
} as const

// Pillar shares of the composite (35/30/15/20). The definition lives in
// lib/ccpi/scoring.ts — the pure scoring core owns its weights — and is
// re-exported here so existing consumers keep importing it from constants.
export { PILLAR_WEIGHTS } from "./scoring"

export const COLOR_MAP = {
  green: "#16a34a", // Green for low risk
  lime: "#65a30d", // Lime for normal
  yellow: "#f97316", // Orange for better readability
  orange: "#f97316", // Orange for caution
  red: "#dc2626", // Red for high alert/crash watch
  gray: "#6b7280", // Default fallback
} as const

export const GRADIENT_BAR_COLORS = {
  low: "#22c55e", // green-500
  medium: "#eab308", // yellow-500
  high: "#ef4444", // red-500
} as const

export const REGIME_COLORS = {
  CRASH_WATCH: "bg-red-600",
  HIGH_ALERT: "bg-orange-500",
  CAUTION: "bg-yellow-500",
  NORMAL: "bg-lime-500",
  LOW_RISK: "bg-green-600",
} as const

// SEVERITY_CONFIGS was deleted here: a Tailwind class map for canary severity,
// exported and referenced nowhere. The canary components carry their own
// styling. Found by the P6-82 dead-code sweep.

export const REFRESH_STATUS_MESSAGES = [
  "Fetching market data...",
  "Analyzing technical indicators...",
  "Computing sentiment metrics...",
  "Evaluating valuation signals...",
  "Processing macro indicators...",
  "Calculating CCPI score...",
] as const

export const CACHE_KEYS = {
  CCPI_DATA: "ccpi-data",
  CCPI_HISTORY: "ccpi-history",
  EXECUTIVE_SUMMARY: "ccpi-executive-summary",
} as const
