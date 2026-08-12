// Universe lists and slider tier tables for the Sell Put (Wheel) Scanner.
// Extracted verbatim from components/wheel-scanner.tsx (Phase 4 modularization — zero behavior change).

// TODO(S-7): the MEGA_CAP universes below are currently unused by the scanner
// flow (Step 2 loads its ticker universe from /api/polygon-tickers). Kept
// pending the S-7 universe-source decision — do not delete until S-7 is resolved.
// MEGA_CAP_STOCKS and MEGA_CAP_STOCKS_ALPHABETIZED were deleted here: two
// hardcoded ticker universes, defined once and referenced nowhere. AUDIT_PLAN
// §2 item 5 suspected as much on 2026-08-07 — "MEGA_CAP_STOCKS ×2 in
// wheel-scanner — now unused?" — and nothing had confirmed it since. Step 2's
// universe comes from /api/polygon-tickers; a stale list of names sitting in
// the file is a fallback waiting for someone to reach for it.

// Helper function to get the numerical limit for top ranked stocks
export const getTopRankedValue = (percentage: number): number => {
  if (percentage <= 16) return 500 // Top 500
  if (percentage <= 50) return 100 // Top 100
  if (percentage <= 83) return 50 // Top 50
  return 10 // Top 10
}

// Helper function to get the label for top ranked stocks
export const getTopRankedLabel = (percentage: number): string => {
  if (percentage <= 16) return "Top 500"
  if (percentage <= 50) return "Top 100"
  if (percentage <= 83) return "Top 50"
  return "Top 10"
}

// Shared 12-stop market-cap ladder for the Step 2 pre-filter slider.
// Keep values and labels in lockstep — indexed together by preFilterMarketCap[0].
export const PRE_FILTER_MARKET_CAP_TIERS = [
  { value: 0, label: "Any" },
  { value: 100_000_000, label: "$100M+" },
  { value: 300_000_000, label: "$300M+" },
  { value: 500_000_000, label: "$500M+" },
  { value: 1_000_000_000, label: "$1B+" },
  { value: 2_000_000_000, label: "$2B+" },
  { value: 5_000_000_000, label: "$5B+" },
  { value: 10_000_000_000, label: "$10B+" },
  { value: 25_000_000_000, label: "$25B+" },
  { value: 50_000_000_000, label: "$50B+" },
  { value: 100_000_000_000, label: "$100B+" },
  { value: 250_000_000_000, label: "$250B+" },
] as const

// Step 2 volatility (premium-richness) ladder. Values are minimum daily
// range % ((high − low) / close) from Polygon grouped bars — a free realized-
// volatility proxy that tracks implied volatility (and therefore option
// premium) closely. 0 = no filter.
export const PRE_FILTER_VOLATILITY_TIERS = [
  { value: 0, label: "Any" },
  { value: 2, label: "2%+" },
  { value: 3, label: "3%+" },
  { value: 4, label: "4%+" },
  { value: 5, label: "5%+" },
  { value: 7, label: "7%+" },
  { value: 10, label: "10%+" },
] as const

/**
 * The benchmark the relative-strength gate compares against.
 *
 * SPY rather than ^GSPC because Polygon's aggregates endpoint covers the ETF
 * and not the index (the same reason lib/market-closes.ts keeps `^SPX` on a
 * live feed), and because the scanner's universe is US common stock, which is
 * what SPY tracks. One symbol, named once, so a future change to QQQ or IWM is
 * one edit rather than a search.
 */
export const BENCHMARK_TICKER = "SPY"
