// CCPI Constants & Configuration
// Centralized thresholds, weights, and color mappings

export const CCPI_THRESHOLDS = {
  CRASH_WATCH: 80,
  HIGH_ALERT: 60,
  CAUTION: 40,
  NORMAL: 20,
  LOW_RISK: 0,
} as const

export const PILLAR_WEIGHTS = {
  momentum: 0.35, // 35%
  riskAppetite: 0.3, // 30%
  valuation: 0.15, // 15%
  macro: 0.2, // 20%
} as const

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

export const SEVERITY_CONFIGS = {
  high: {
    bgColor: "bg-red-100",
    textColor: "text-red-900",
    borderColor: "border-red-400",
    badgeColor: "bg-red-600 text-white",
    label: "HIGH RISK",
  },
  medium: {
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-900",
    borderColor: "border-yellow-400",
    badgeColor: "bg-yellow-600 text-white",
    label: "MEDIUM RISK",
  },
  low: {
    bgColor: "bg-green-100",
    textColor: "text-green-900",
    borderColor: "border-green-400",
    badgeColor: "bg-green-600 text-white",
    label: "LOW RISK",
  },
} as const

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
