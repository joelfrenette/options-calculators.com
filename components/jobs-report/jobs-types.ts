/**
 * Payload shape and formatters for the BLS Jobs Rate Forecaster. Split from
 * components/jobs-report-dashboard.tsx (P6-13).
 */

export interface JobsData {
  current: {
    unrate: number
    unratePrevMonth: number
    unratePrevYear: number
    unrateYoY: number
    u6: number
    u6PrevYear: number
    u6YoY: number
    unrateU6Diff: number
    nfp: number | null
    nfpPrevMonth: number | null
    nfp3MonthAvg: number | null
    earnings: number | null
    earningsMoM: number | null
    earningsYoY: number | null
    latestMonth: string
  }
  forecast: {
    nextRelease: string
    unratePrediction: number
    unrateRange: { low: number; high: number }
    u6Prediction: number
    u6Range: { low: number; high: number }
    nfpPrediction: string
    nfpRange: { low: string; high: string }
    confidence: number
    trend: "rising" | "falling" | "stable"
    analysis: string
    keyFactors: string[]
    tradingImplications: string[]
  }
  chartData: any[]
  historicalTable: { month: string; rate: number; yoyChange: string }[]
  lastUpdated: string
  dataSource: string
}

export const fmtSigned = (v: number, suffix = "%") => `${v > 0 ? "+" : ""}${v}${suffix}`
export const fmtNfp = (v: number | null) => (v === null ? "n/a" : `${v >= 0 ? "+" : ""}${v}K`)
