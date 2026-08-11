/**
 * One outbound fetch with a deadline, and the default in one place.
 *
 * P0-4, built 2026-08-11. The row has asked for "a shared `fetchWithTimeout`
 * helper" since Phase 0 and nothing ever built one, so every route that wanted a
 * deadline hand-rolled an `AbortController` and every route that did not simply
 * had none. A hung upstream then ties the serverless function up until the
 * platform kills it — the caller waits, the budget is spent, and nothing in the
 * response says which upstream stalled.
 *
 * **The row's own figure was stale in the safe direction**: it recorded "40 of 61
 * routes have no timeout/abort wiring". Re-measured on 2026-08-11, 35 routes make
 * outbound calls, 26 were already wired, and 9 were not. Those 9 now use this.
 *
 * DELIBERATELY IMPORT-FREE. `lib/ccpi/calculations.ts` and `lib/budget-guard.ts`
 * are untestable by any check script because of what they import (P6-85, P6-87),
 * and that constraint has been silently deciding what gets verified. A module
 * this small has no excuse to inherit it.
 *
 * The default is 10s: long enough for the slow-but-working upstreams this site
 * uses (FRED, Finnhub, Polygon all sit well under it in the health check) and
 * short enough to fail before Vercel's own limit, so the route gets to return a
 * real error status instead of being killed mid-flight.
 */

/**
 * Not exported. `check-dead-exports.ts` — written an hour before this file —
 * failed on its first real run because this and `isTimeoutError` were exported
 * and nobody imported them. The right answer was not to add two entries to the
 * allowlist: **an unused export is speculative API, which is the thing the rule
 * exists to stop accumulating.** It is internal until a caller needs it.
 */
const DEFAULT_TIMEOUT_MS = 10_000

/**
 * `fetch` with an abort deadline.
 *
 * A caller's own `signal` wins if it passes one — this never silently replaces a
 * deadline someone chose on purpose.
 *
 * On timeout this rejects with the `TimeoutError` `AbortSignal.timeout` raises,
 * which is a DOMException, not a network error. Callers that map errors to
 * statuses should treat it as **504, not 502**: the upstream did not refuse, it
 * did not answer in time, and telling those apart is the same distinction that
 * made 403-vs-404 worth discriminating on the Quiver datasets (S-14).
 */
export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  if (init.signal) return fetch(input, init)
  return fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) })
}

// An `isTimeoutError` helper was written here and deleted unused, for the reason
// above. **The work it was for is real and is not done:** no route currently
// distinguishes a deadline from a refusal, so a stalled upstream is reported as
// whatever the catch block reports everything as — usually 502. It should be
// 504. Logged rather than shipped as an exported function nobody calls.
