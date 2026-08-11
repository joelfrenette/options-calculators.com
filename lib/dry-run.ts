/**
 * A probe that exercises a route's request path without spending a model call.
 *
 * P2-4, built 2026-08-11. Sixteen routes are marked `skip` in
 * `lib/api-contracts.ts` and therefore **have no automated verification at all** —
 * five of them because a probe costs an LLM call every run. The contract file has
 * carried the fix since Phase 2 ("give the LLM routes a `?dryRun=1` that exercises
 * the request path without calling a model") and nobody built it, so the routes
 * most likely to break silently are the ones nothing watches.
 *
 * WHAT A DRY RUN MUST NOT DO, because this project has shipped the mistake twice
 * (P6-53, P6-52): **it must not return content shaped like an answer.** A route
 * that replies with plausible prose when asked not to think is a synthetic-data
 * generator with a flag on it. The response carries `dryRun: true` and facts about
 * the request — never a summary, never an analysis, never a number.
 *
 * WHAT IT DOES VERIFY: routing, auth, body parsing, input validation, the budget
 * guard, key resolution, and the response envelope. That is most of what actually
 * breaks. It does NOT verify that a provider answers — `/api/ai-status` covers
 * reachability, and P6-34 is the standing decision on what a model's answer is
 * worth. Recorded here so "we have a check for that" cannot grow past what the
 * check does.
 *
 * DELIBERATELY IMPORT-FREE (P6-85, P6-87).
 */

/**
 * True when the caller asked for a dry run, by `?dryRun=1` or a `dryRun: true`
 * body field.
 *
 * Accepting both is not indecision: the health check sends a query string for
 * GET-shaped probes, and a body is the natural place for it on a POST whose
 * body is being validated anyway. Only the exact strings `1` and `true` count —
 * `?dryRun=0` and `?dryRun=false` mean what they say.
 */
export function isDryRun(request: Request, body?: unknown): boolean {
  const q = new URL(request.url).searchParams.get("dryRun")
  if (q === "1" || q === "true") return true
  if (body && typeof body === "object" && (body as Record<string, unknown>).dryRun === true) return true
  return false
}

/**
 * The body of a dry-run response. Facts about the request only.
 *
 * `wouldCall` names the provider chain the route would have used, so the probe
 * still reports which spend path it is standing in front of.
 */
export function dryRunPayload(route: string, wouldCall: string, promptChars: number) {
  return {
    dryRun: true,
    route,
    wouldCall,
    promptChars,
    note: "Request path exercised; no model was called and no content was generated.",
  }
}
