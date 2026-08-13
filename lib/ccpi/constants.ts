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
export { PILLAR_WEIGHTS } from "./scoring.ts"

export const COLOR_MAP = {
  green: "#16a34a", // Green for low risk
  lime: "#65a30d", // Lime for normal
  yellow: "#f97316", // Orange for better readability
  orange: "#f97316", // Orange for caution
  red: "#dc2626", // Red for high alert/crash watch
  gray: "#6b7280", // Default fallback
} as const

// GRADIENT_BAR_COLORS and REGIME_COLORS were deleted here (P7-9), with
// `getBarColor` and `getRegimeColor` in ./calculations — their only readers.
// REGIME_COLORS was the second of two band tables for one score; COLOR_MAP
// above, read through `getRegimeZone`, is the one the dashboard renders.

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

// P7-9. `CCPI_HISTORY` and `EXECUTIVE_SUMMARY` were removed with the functions
// that named them (see lib/ccpi/cache.ts). One key, one cache, one reader.
//
// Note that `ccpi-history` may still be sitting in the localStorage of anyone
// who loaded the dashboard before this: the write-only history cache wrote it
// on every visit. Nothing reads it now, and browsers evict per-origin storage
// wholesale, so it is left rather than swept — a one-shot cleanup would need
// code that outlives the reason for it.
export const CACHE_KEYS = {
  CCPI_DATA: "ccpi-data",
} as const
