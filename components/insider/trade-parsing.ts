/**
 * Reading a dollar figure and a date out of the strings the insider feeds hand
 * back, and the shapes those rows take.
 *
 * Split out of `components/insider-trading-dashboard.tsx` (P6-13) unchanged.
 *
 * `parseValueToUsd` exists because the upstream value arrives as prose — "$1.2M",
 * a range, sometimes a bare number — and the big-move filter depends on reading
 * it correctly. A parse that silently returned 0 would put every unreadable row
 * BELOW the threshold rather than flagging it as unknown.
 */

// Threshold for the "Big moves only" toggle ($500K+)
export const BIG_MOVE_THRESHOLD = 500_000

// Parse a single dollar token like "$22M", "$50K", "1000000" into a USD number
export function parseSingleValue(token: string): number {
  const cleaned = token.replace(/[$,\s]/g, "")
  const num = Number.parseFloat(cleaned.replace(/[KMBkmb]/g, ""))
  if (isNaN(num)) return 0
  if (/B/i.test(cleaned)) return num * 1_000_000_000
  if (/M/i.test(cleaned)) return num * 1_000_000
  if (/K/i.test(cleaned)) return num * 1_000
  return num
}

// Parse value strings including congressional range format "$500,001-$1,000,000"
// Returns the midpoint for ranges so sorting is accurate
export function parseValueToUsd(valueStr: string): number {
  if (!valueStr || valueStr === "N/A" || valueStr === "See filing") return 0
  if (valueStr.includes("-")) {
    const parts = valueStr.split("-")
    const low = parseSingleValue(parts[0])
    const high = parseSingleValue(parts[parts.length - 1])
    if (low > 0 && high > 0) return (low + high) / 2
    if (high > 0) return high
    if (low > 0) return low
    return 0
  }
  return parseSingleValue(valueStr)
}

export interface AiSignal {
  ticker: string
  direction: "Bullish" | "Bearish" | "Neutral"
  confidence: "High" | "Medium" | "Low"
  headline: string
  rationale: string
  optionsIdea?: string
  sources?: string[]
}

export interface Trade {
  _date?: string  // ISO YYYY-MM-DD from API — used for reliable date sorting
  date: string    // Formatted display string e.g. "Jun 3, 2026"
  type: string
  owner: string
  role: string
  category: string
  ticker: string
  shares: string
  price: string
  value: string
  notes: string
}

export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "N/A"

  // If already in "MMM DD" format, return as-is
  if (/^[A-Z][a-z]{2}\s\d{1,2}$/.test(dateStr)) {
    return dateStr
  }

  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return dateStr
  }
}



export type SortField = "date" | "owner" | "ticker" | "shares" | "price" | "value" | "notes"
export type SortDirection = "asc" | "desc" | null
