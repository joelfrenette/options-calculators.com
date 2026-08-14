/**
 * Parsers for the free, keyless valuation sources — and the detector that says
 * when a 200 is not an answer.
 *
 * IMPORT-FREE ON PURPOSE, so a check script can load it under plain `node`
 * (P7-67). Every function here is pure: HTML in, number or null out.
 *
 * ── WHY `looksBlocked` EXISTS ────────────────────────────────────────────────
 * P7-75. aaii.com answers a plain server-side fetch with **HTTP 200 and an
 * Imperva interstitial** — "Pardon Our Interruption" — roughly 6 KB of block
 * page where 60 KB of survey table should be. The first request of a session
 * gets real data; the next does not.
 *
 * That is this project's own house rule turned around on it: *never 200 with an
 * error body*. Somebody else's server does it to us, so a probe that reads the
 * status code and stops would have reported aaii.com as a working free source —
 * and it was reported that way, for one turn, on exactly that evidence.
 *
 * So every source here is judged on whether a VALUE came back, never on the
 * status code.
 */

/** Markers of a bot-wall served with a success status. */
const BLOCK_MARKERS = [
  "pardon our interruption",
  "access denied",
  "are you a robot",
  "captcha",
  "unusual traffic",
  "request unsuccessful",
  "incapsula",
  "cf-browser-verification",
]

/**
 * True when the body is an interstitial rather than the page asked for.
 *
 * Deliberately also flags a suspiciously small body: the AAII block page is
 * ~6 KB against ~60 KB of real page, and a marker list only catches the vendors
 * already seen. A caller passes the size it expects to be exceeded.
 */
export function looksBlocked(html: string, minimumPlausibleBytes = 0): boolean {
  if (!html) return true
  if (minimumPlausibleBytes > 0 && html.length < minimumPlausibleBytes) return true
  const lower = html.slice(0, 4000).toLowerCase()
  return BLOCK_MARKERS.some((m) => lower.includes(m))
}

/**
 * The current S&P 500 P/E from multpl.com.
 *
 * Read from the `<meta name="description">`, which carries the figure as prose:
 * `Current S&P 500 PE Ratio is 30.06, a change of +0.21 from previous market
 * close.` That is a more stable target than the rendered table — it needs no JS
 * and does not move when the page is restyled.
 *
 * Returns null on a block page, a missing tag, or a value outside a sane band.
 * The band is wide (1–200): it exists to reject a parse that latched onto the
 * wrong number, not to second-guess the market.
 */
export function parseMultplPE(html: string): number | null {
  if (looksBlocked(html, 5000)) return null
  const m = /Current S&P 500 PE Ratio is\s*([0-9]+(?:\.[0-9]+)?)/i.exec(html)
  if (!m) return null
  const v = Number.parseFloat(m[1])
  if (!Number.isFinite(v) || v <= 1 || v > 200) return null
  return v
}

/**
 * The current S&P 500 price-to-sales from multpl.com, same mechanism.
 *
 * Band 0.1–50 for the same reason: a P/S of 0 or 500 is a parse failure, not a
 * market condition.
 */
export function parseMultplPS(html: string): number | null {
  if (looksBlocked(html, 5000)) return null
  const m = /Current S&P 500 Price to Sales Ratio is\s*([0-9]+(?:\.[0-9]+)?)/i.exec(html)
  if (!m) return null
  const v = Number.parseFloat(m[1])
  if (!Number.isFinite(v) || v <= 0.1 || v > 50) return null
  return v
}
