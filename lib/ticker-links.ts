/**
 * The one place a ticker becomes an outbound link.
 *
 * WHY THIS FILE EXISTS. The same URL was hand-built in fifteen components —
 * `https://finance.yahoo.com/quote/${ticker}` — and it had already diverged:
 * `smart-money-etfs.tsx` normalised `.` to `-` (Yahoo's convention for class
 * shares: `BRK.B` is `BRK-B`, and `BRK.B` 404s) and the other fourteen did not,
 * while `scanner/fundamental-results-table.tsx` used a third form,
 * `/quote/${ticker}/chart`. Fifteen copies of a string is fourteen chances for
 * the fifteenth to be wrong, which is the shape this codebase keeps paying for.
 *
 * The destination is the ADVANCED CHART (`/chart/<TICKER>`), the owner's call:
 * every one of these links sits next to a strike, an expiry or a trade date,
 * and the chart is the page that answers the question the table just raised.
 *
 * IMPORT-FREE ON PURPOSE. `scripts/check-ticker-links.ts` loads this module
 * under node's type stripping, where `@/…` aliases do not resolve. Do not add
 * imports here.
 */

/**
 * Yahoo's base for the advanced (full-screen, drawable) chart.
 *
 * Deliberately NOT exported. Exporting it would hand callers the pieces to
 * rebuild the URL themselves, which is the exact habit this module exists to
 * end — and `check-dead-exports.ts` said so immediately, since nothing outside
 * this file has any business referencing it.
 */
const YAHOO_CHART_BASE = "https://finance.yahoo.com/chart/"

/**
 * The advanced-chart URL for a ticker, or `null` when there is no ticker.
 *
 * Returns null rather than a link to nowhere: a bare `/chart/` is a valid page
 * that shows an unrelated default symbol, so a blank ticker must not produce a
 * clickable link at all. Callers render plain text in that case.
 *
 * `.` becomes `-` because that is Yahoo's own spelling for class shares.
 * Everything else is percent-encoded, which leaves ordinary tickers untouched
 * and makes index symbols (`^SPX`) safe in a path.
 */
export function yahooChartUrl(ticker: string | null | undefined): string | null {
  if (typeof ticker !== "string") return null
  const cleaned = ticker.trim().toUpperCase().replace(/\./g, "-")
  if (cleaned.length === 0) return null
  return `${YAHOO_CHART_BASE}${encodeURIComponent(cleaned)}`
}
