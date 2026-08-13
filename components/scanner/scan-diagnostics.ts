// The Step 3 scan's rejection/skip vocabulary, defined once (P7-53).
//
// WHY THIS FILE EXISTS. The scan built its buckets as an object literal in
// `fundamental-scan.ts` and the notice card rendered their names as a chain of
// `{reason === "x" && "…"}` expressions in `scanner-notices.tsx`. Nothing
// connected the two, and both directions were already broken:
//
//   - A bucket with NO label rendered an empty heading beside a live count. The
//     JSX has no `else`, so the failure is a blank space, not an error.
//   - A label with NO bucket never rendered at all. `fundamentalsIncomplete`
//     had a written, reviewed, carefully-worded label — "fewer than 4 reported
//     quarters, so ROE/market cap could not be computed" — and it was
//     unreachable, because `fundamentalsIncomplete` is a `failedFilters` tag and
//     was never a bucket key.
//
// The second one had teeth. A ticker whose ROE could not be computed was pushed
// into the `roe` bucket, so the user was told **"ROE below Min ROE %"** — a
// measured claim about a company whose earnings never reported. P6-24 fixed
// exactly that sentence in the LOG line and left the bucket alone. **The comment
// recording a fix is a reliable place to look for the instance that was missed**
// (the rule Phase 7 kept proving), and this is the fifth instance.
//
// Import-free on purpose: `scripts/check-scan-diagnostics.ts` loads both this
// and the scan under node's type stripping to assert the two key sets agree.

/**
 * Why a ticker was REJECTED: it was measured, and it failed a filter the user
 * set. Each key is a bucket in the scan and a heading in the notice card.
 */
export const REJECTION_REASONS = {
  // `{step}` is substituted with `stepLabel("dollarFilter")` at render. The
  // placeholder keeps the label in this file — one source for key→text — while
  // leaving the step NUMBER where it belongs, in `steps.ts` (S-18).
  priceCap: "Above Max Stock Price ({step})",
  volume: "Volume below Min Volume",
  debtEquity: "Debt/Equity above Max",
  roe: "ROE below Min ROE %",
  fundamentalsIncomplete:
    "Financials incomplete — fewer than 4 reported quarters, so ROE/market cap could not be computed",
  profitableQuarters: "Fewer consecutive profitable quarters than required",
  marketCap: "Market cap below Min",
} as const

/**
 * Why a ticker was SKIPPED: we never got a usable measurement, so no filter
 * verdict is available. The distinction is the point — "it failed" and "we
 * never looked" are different answers and this scan used to give the first when
 * it meant the second.
 */
export const SKIP_REASONS = {
  noPrice: "Skipped — no price (Polygon returned neither a live nor a previous close)",
  rateLimit: "Skipped — Polygon rate limit (429)",
  apiError: "Skipped — Polygon API error (non-200)",
  thinFinancials: "Warn — Polygon returned thin financials (likely null ROE/EPS)",
  exception: "Skipped — client-side exception in loop",
} as const

export type RejectionReason = keyof typeof REJECTION_REASONS
export type SkipReason = keyof typeof SKIP_REASONS

/** An empty bucket per key, so the scan cannot invent a bucket name. */
export function emptyBuckets<K extends string>(labels: Record<K, string>): Record<K, string[]> {
  const out = {} as Record<K, string[]>
  for (const key of Object.keys(labels) as K[]) out[key] = []
  return out
}
